// End-to-end CLI gateway fixture.
//
// This test drives a *real* new live CLI run (`node --import tsx src/cli.ts`)
// against a loopback HTTP server that speaks the Messages SSE wire format the
// fixed `@anthropic-ai/sdk` expects (the same event shapes exercised in
// provider.test.ts). No real network, no real model: the only peer is a
// 127.0.0.1 server owned by this test that scripts one `cron_list` tool_use
// turn followed by an end_turn.
//
// It proves, from what the model was actually offered and what the session
// journal actually pinned:
//   - the default tool pool of a new live session includes the notebook,
//     background, scheduler, durable-task and subagent tools;
//   - workspace/settings instructions and skill catalogs reach the system
//     prompt, and a settings SessionStart hook both runs and injects context
//     into the first model request;
//   - tool_use/tool_result pairing holds and the journal stores no credential;
//   - `--resume` reuses the pinned snapshot unchanged (same config) while the
//     credential is re-read from the environment.
//
// All output collection is capped and every child process / server / temp dir
// is torn down in `finally`, so a hung run cannot leak a process or a socket.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { once } from 'node:events';
import { WebSocketServer } from 'ws';

import { assertPaired } from '../src/agent.js';
import { Session } from '../src/session.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPILED_CLI = process.env.HARNESS_TEST_COMPILED_CLI === '1';
const CLI = path.join(ROOT, ...(COMPILED_CLI ? ['bin', 'personal-harness.mjs'] : ['src', 'cli.ts']));

const MODEL = 'gateway/loopback-model';
const KEY = 'dummy-loopback-key';
const ROTATED_KEY = 'rotated-loopback-key';
const FINAL_TEXT = 'loopback gateway completed the tool round.';
const START_CONTEXT = 'SESSION_START_MARKER';
const INSTRUCTION_MARKER = 'WORKSPACE_INSTRUCTION_MARKER_9271';
const RULE_MARKER = 'HARNESS_RULE_MARKER_5533';
const SKILL_NAME = 'loopback-skill';

const TOOL_ID = 'gw-tool-1';

// The full default tool pool a new live session must advertise (order-insensitive).
const EXPECTED_TOOLS = [
  // base workspace tools
  'read_file', 'list_files', 'search', 'write_file', 'edit_file', 'run_command',
  // durable task tools
  'task_create', 'task_get', 'task_list', 'task_update',
  // model-invocable skill loader
  'skill',
  // notebooks
  'notebook_read', 'notebook_edit',
  // background jobs
  'run_background', 'monitor', 'get_background_task', 'task_stop', 'read_notifications',
  // scheduler
  'cron_create', 'cron_delete', 'cron_list', 'schedule_wakeup',
  // agents, web, checkpoints, worktrees and memory
  'agent', 'list_agents', 'send_message', 'get_agent', 'stop_agent', 'poll_agents',
  'web_fetch', 'read_media', 'workflow_run', 'workflow_get', 'checkpoint_create', 'checkpoint_list', 'checkpoint_diff', 'checkpoint_restore',
  'worktree_create', 'worktree_list', 'worktree_remove',
  'memory_list', 'memory_read', 'memory_write', 'memory_delete',
  'ask_user_question', 'submit_plan', 'report_findings',
];

const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const MAX_CLI_OUTPUT = 40_000;
const RUN_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Loopback SSE gateway
// ---------------------------------------------------------------------------

type RecordedRequest = { url: string; headers: http.IncomingHttpHeaders; body: any };
type Gateway = { url: string; requests: RecordedRequest[]; close(): Promise<void> };

function responseEvents(body: any): unknown[] {
  const model = typeof body?.model === 'string' ? body.model : MODEL;
  const messages: any[] = Array.isArray(body?.messages) ? body.messages : [];
  const hasAssistant = messages.some(message => message?.role === 'assistant');
  const start = {
    type: 'message_start',
    message: {
      id: `gw-msg-${hasAssistant ? 2 : 1}`, type: 'message', role: 'assistant', model,
      content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 0 },
    },
  };
  if (!hasAssistant) {
    // Scripted first turn: one cron_list tool_use (read-only, deterministic).
    return [
      start,
      { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: TOOL_ID, name: 'cron_list', input: {} } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{}' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 5 } },
      { type: 'message_stop' },
    ];
  }
  // Second turn (and any resumed turn): a plain end_turn text response.
  return [
    start,
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: FINAL_TEXT } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 4 } },
    { type: 'message_stop' },
  ];
}

function startGateway(eventsFor: (body: any) => unknown[] = responseEvents): Promise<Gateway> {
  const requests: RecordedRequest[] = [];
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/messages') { res.writeHead(404); res.end(); return; }
    const chunks: Buffer[] = [];
    let size = 0;
    let rejected = false;
    req.on('data', (chunk: Buffer) => {
      if (rejected) return;
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) { rejected = true; res.writeHead(413); res.end(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (rejected) return;
      let body: any;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { res.writeHead(400); res.end(); return; }
      requests.push({ url: req.url!, headers: req.headers, body });
      const sse = eventsFor(body)
        .map(event => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`)
        .join('');
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'close' });
      res.end(sse);
    });
    req.on('error', () => { /* client aborted; nothing to retain */ });
  });
  return new Promise<Gateway>((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        requests,
        async close() {
          (server as http.Server & { closeAllConnections?: () => void }).closeAllConnections?.();
          await new Promise<void>(done => server.close(() => done()));
        },
      });
    });
  });
}

// ---------------------------------------------------------------------------
// CLI driver
// ---------------------------------------------------------------------------

type CliResult = { code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string; timedOut: boolean };

function runCli(args: string[], env: NodeJS.ProcessEnv, timeoutMs = RUN_TIMEOUT_MS): Promise<CliResult> {
  return new Promise<CliResult>((resolve, reject) => {
    const child = spawn(process.execPath, [...(COMPILED_CLI ? [] : ['--import', 'tsx']), CLI, ...args], {
      cwd: ROOT, env: { ...process.env, ...env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const cap = (value: string) => (value.length > MAX_CLI_OUTPUT ? value.slice(-MAX_CLI_OUTPUT) : value);
    child.stdout!.on('data', (chunk: Buffer) => { stdout = cap(stdout + chunk.toString('utf8')); });
    child.stderr!.on('data', (chunk: Buffer) => { stderr = cap(stderr + chunk.toString('utf8')); });
    const timer = setTimeout(() => {
      timedOut = true;
      try { if (child.pid !== undefined) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); }
      catch { try { child.kill('SIGKILL'); } catch { /* already gone */ } }
    }, timeoutMs);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', (code, signal) => { clearTimeout(timer); resolve({ code, signal, stdout, stderr, timedOut }); });
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];
const gateways: Gateway[] = [];

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}
function workspace(): string { return fs.realpathSync(tempDir('harness-gw-ws-')); }
function userDir(): string { return tempDir('harness-gw-user-'); }

/** POSIX single-quote a shell argument (safe for `/bin/sh -c`). */
function shq(value: string): string { return `'${value.replace(/'/g, "'\\''")}'`; }

/** A SessionStart hook that drops a marker file and injects `context` for the model. */
function sessionStartHook(markerPath: string, context: string): string {
  const json = JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } });
  return `printf %s ran > ${shq(markerPath)}; printf %s ${shq(json)}`;
}

function seedWorkspace(ws: string, markerPath: string): void {
  const harness = path.join(ws, '.harness');
  fs.mkdirSync(path.join(harness, 'rules'), { recursive: true });
  fs.mkdirSync(path.join(harness, 'skills', SKILL_NAME), { recursive: true });
  // Instructions: workspace HARNESS.md + a collected rules file.
  fs.writeFileSync(path.join(ws, 'HARNESS.md'), `# Loopback instructions\n\n${INSTRUCTION_MARKER}\n`);
  fs.writeFileSync(path.join(harness, 'rules', '01-loopback.md'), `${RULE_MARKER}\n`);
  // Skill catalog entry (model-invocable, so it lists in the system prompt).
  fs.writeFileSync(path.join(harness, 'skills', SKILL_NAME, 'SKILL.md'),
    `---\nname: ${SKILL_NAME}\ndescription: A loopback fixture skill\n---\nBody for ${SKILL_NAME}.\n`);
  // Settings: explicit feature flags plus a SessionStart hook.
  fs.writeFileSync(path.join(harness, 'settings.json'), JSON.stringify({
    features: { tasks: true, subagents: true, notebooks: true, background: true, scheduler: true },
    hooks: {
      SessionStart: [{ command: sessionStartHook(markerPath, START_CONTEXT) }],
      SessionEnd: [{ command: `printf %s ended > ${shq(markerPath + '.end')}` }],
    },
  }));
}

/** Environment overrides that pin the gateway credential and disable capability extras. */
function gatewayEnv(apiKey: string, auth: 'bearer' | 'api-key' = 'bearer'): NodeJS.ProcessEnv {
  return { LLM_API_KEY: apiKey, LLM_AUTH: auth, LLM_TOKEN_COUNTING: 'estimate',
    LLM_THINKING: 'false', LLM_PROMPT_CACHE: 'false', LLM_EAGER_TOOL_INPUT: 'false',
    ANTHROPIC_API_KEY: 'fixture-vendor-key', ANTHROPIC_AUTH_TOKEN: 'fixture-vendor-token',
    ANTHROPIC_BASE_URL: 'http://127.0.0.1:1', ANTHROPIC_CUSTOM_HEADERS:
      'Authorization: Bearer fixture-env-override\nx-api-key: fixture-env-extra\nx-fixture-route: fixture-env-route\nanthropic-version: fixture-env-version' };
}

function toolNames(body: any): string[] {
  assert.ok(Array.isArray(body?.tools), 'request has no tools array');
  return (body.tools as { name: string }[]).map(tool => tool.name);
}
function readJournal(ws: string, id: string): string {
  return fs.readFileSync(path.join(ws, '.agent', `${id}.jsonl`), 'utf8');
}
function sessionId(stderr: string): string {
  const id = /session: (.+)/.exec(stderr)?.[1];
  assert.ok(id, `no session id in stderr:\n${stderr}`);
  return id;
}

after(async () => {
  for (const gateway of gateways) { try { await gateway.close(); } catch { /* ignore */ } }
  for (const dir of tempDirs) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('CLI live loopback run wires tools, settings, hooks and instructions with paired results', async () => {
  const gateway = await startGateway();
  gateways.push(gateway);
  const ws = workspace();
  const user = userDir();
  const markerPath = path.join(ws, 'session-start.marker');
  seedWorkspace(ws, markerPath);

  const result = await runCli(
    ['--workspace', ws, '--user-dir', user, '--model', MODEL, '--base-url', gateway.url, '--max-turns', '5',
      'Loopback task: list the scheduled jobs.'],
    gatewayEnv(KEY),
  );

  assert.equal(result.timedOut, false, `CLI timed out\nstderr:\n${result.stderr}`);
  assert.equal(result.code, 0, `CLI failed (code ${result.code})\nstderr:\n${result.stderr}`);
  assert.match(result.stderr, /finished: end_turn; model calls: 2/);
  assert.match(result.stderr, /tool: cron_list/);
  assert.match(result.stdout, /loopback gateway completed the tool round\./);
  const id = sessionId(result.stderr);

  // The gateway saw exactly two Messages requests: a tool_use turn then end_turn.
  assert.equal(gateway.requests.length, 2, 'expected one tool turn and one end_turn');
  const [first, second] = gateway.requests as [RecordedRequest, RecordedRequest];

  // Request 1: explicit model, streamed, bearer credential, no vendor env leakage.
  assert.equal(first.url, '/v1/messages');
  assert.equal(first.body.model, MODEL);
  assert.equal(first.body.stream, true);
  assert.equal(first.headers.authorization, `Bearer ${KEY}`);
  assert.equal(first.headers['x-api-key'], undefined);
  assert.equal(first.headers['x-fixture-route'], undefined);
  assert.equal(first.headers['anthropic-version'], '2023-06-01');

  // Default tool pool: notebooks + background + scheduler + durable tasks + subagent.
  const offered = toolNames(first.body).slice().sort();
  assert.deepEqual(offered, EXPECTED_TOOLS.slice().sort());
  for (const name of ['notebook_read', 'notebook_edit', 'run_background', 'monitor',
    'get_background_task', 'task_stop', 'read_notifications', 'cron_create', 'cron_delete',
    'cron_list', 'schedule_wakeup', 'task_create', 'task_get', 'task_list', 'task_update', 'agent', 'skill']) {
    assert.ok(offered.includes(name), `default tool pool is missing ${name}`);
  }

  const monitorSchema = first.body.tools.find((tool: any) => tool.name === 'monitor').input_schema;
  assert.equal(monitorSchema.properties.ws.properties.url.type, 'string');
  assert.equal(monitorSchema.oneOf.length, 2);

  // Settings/instructions wiring: HARNESS.md, .harness/rules and the skill catalog.
  assert.equal(typeof first.body.system, 'string');
  assert.match(first.body.system, new RegExp(INSTRUCTION_MARKER));
  assert.match(first.body.system, new RegExp(RULE_MARKER));
  assert.match(first.body.system, /# Available skills/);
  assert.match(first.body.system, new RegExp(`- ${SKILL_NAME}: A loopback fixture skill`));

  // Settings hook ran and its SessionStart context reached the first model request.
  assert.equal(fs.readFileSync(markerPath, 'utf8'), 'ran');
  assert.equal(fs.readFileSync(markerPath + '.end', 'utf8'), 'ended');
  assert.match(JSON.stringify(first.body.messages), new RegExp(START_CONTEXT));

  // Turn 2 carries the paired cron_list tool_result produced by the real tool.
  const lastUser = (second.body.messages as any[]).at(-1);
  assert.equal(lastUser.role, 'user');
  assert.ok(Array.isArray(lastUser.content));
  assert.equal(lastUser.content[0].type, 'tool_result');
  assert.equal(lastUser.content[0].tool_use_id, TOOL_ID);
  assert.equal(lastUser.content[0].is_error ?? false, false);
  assert.match(String(lastUser.content[0].content), /"jobs":\s*\[\]/);

  // Journal: pinned config reproduces the offered tools and the settings wiring.
  const journal = readJournal(ws, id);
  const metadata = JSON.parse(journal.split('\n')[0]!) as { config: any };
  assert.equal(metadata.config.model, MODEL);
  assert.equal(metadata.config.gateway.baseURL, gateway.url);
  assert.equal(metadata.config.gateway.auth, 'bearer');
  assert.deepEqual(metadata.config.features, { tasks: true, subagents: true, notebooks: true, background: true, scheduler: true,
    agentMessaging: true, agentIdle: true, agentTypes: true, interaction: true, web: true, checkpoints: true, worktrees: true, memory: true, media: true, workflow: true,
    workflowPersistence: true, taskProjections: true, mcpSubscriptions: false, mcpCatalog: true, mcpDynamic: false, mcpDeferred: false, crossSessionMessaging: false, lsp: false });
  assert.deepEqual(metadata.config.hooks.SessionStart.length, 1);
  assert.deepEqual((metadata.config.tools as { name: string }[]).map(tool => tool.name).slice().sort(), EXPECTED_TOOLS.slice().sort());

  // Credential absent from the journal metadata and every stored record.
  assert.equal('apiKey' in metadata.config, false);
  assert.doesNotMatch(journal, /dummy-loopback-key/);
  assert.doesNotMatch(journal, /apiKey/);

  // Pairing holds across the committed run.
  const session = Session.open(ws, { id });
  try {
    assertPaired(session.messages);
    assert.equal(session.awaitingResponse, false);
    const last = session.events.at(-1); assert.equal(last?.kind, 'hook_result');
    assert.ok(last?.kind === 'hook_result' && last.event === 'SessionEnd');
    assert.ok(session.events.some(event => event.kind === 'tool_start' && event.name === 'cron_list'));
    assert.ok(session.events.some(event => event.kind === 'hook_start' && event.event === 'SessionStart'));
    assert.ok(session.events.some(event => event.kind === 'hook_result' && event.event === 'SessionStart'));
  } finally { session.close(); }
});

test('CLI api-key loopback run isolates the explicit credential from SDK environment headers', async (t) => {
  const gateway = await startGateway();
  gateways.push(gateway);
  const ws = workspace();
  const result = await runCli(
    ['--workspace', ws, '--user-dir', userDir(), '--model', MODEL, '--base-url', gateway.url,
      '--max-turns', '5', 'Loopback task: list the scheduled jobs.'],
    gatewayEnv(KEY, 'api-key'),
  );
  assert.equal(result.timedOut, false, result.stderr);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(gateway.requests.length, 2);
  assert.match(result.stdout, /loopback gateway completed the tool round\./);
  for (const { headers } of gateway.requests) {
    assert.equal(headers['x-api-key'], KEY);
    assert.equal(headers.authorization, undefined);
    assert.equal(headers['x-fixture-route'], undefined);
    assert.equal(headers['anthropic-version'], '2023-06-01');
  }
  const journal = readJournal(ws, sessionId(result.stderr));
  const metadata = JSON.parse(journal.split('\n')[0]!);
  assert.equal(metadata.config.gateway.auth, 'api-key');
  assert.doesNotMatch(journal, /dummy-loopback-key|env-api-key|env-token|env-override|env-lower|env-extra|env-route/);
  t.diagnostic(`CLI ${COMPILED_CLI ? 'compiled' : 'source'}: api-key; explicit auth only; environment route absent`);
});

test('CLI executes WebSocket monitoring without shell access and closes it on exit', { timeout: 15000 }, async () => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  try {
    await once(server, 'listening');
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const endpoint = `ws://127.0.0.1:${address.port}/events`;
    const gateway = await startGateway(body => {
      const events = responseEvents(body) as any[];
      for (const event of events) {
        if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
          event.content_block.name = 'monitor';
        }
        if (event.type === 'content_block_delta' && event.delta.type === 'input_json_delta') {
          event.delta.partial_json = JSON.stringify({ ws: { url: endpoint }, description: 'CLI socket', timeout_ms: 5000 });
        }
      }
      return events;
    });
    gateways.push(gateway);
    const ws = workspace(); const user = userDir();
    fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ allowShell: false }));
    const result = await runCli(['--workspace', ws, '--user-dir', user, '--model', MODEL,
      '--base-url', gateway.url, '--max-turns', '5', 'Watch the local event feed.'], gatewayEnv(KEY));
    assert.equal(result.timedOut, false); assert.equal(result.code, 0, result.stderr);
    assert.equal(gateway.requests.length, 2);
    const toolResult = gateway.requests[1]!.body.messages.at(-1).content[0];
    assert.equal(toolResult.is_error ?? false, false);
    const descriptor = JSON.parse(toolResult.content);
    assert.equal(descriptor.source, 'websocket'); assert.equal(descriptor.ws.url, endpoint);
    const session = Session.open(ws, { id: sessionId(result.stderr) });
    try { assert.equal(session.config.allowShell, false); assertPaired(session.messages); }
    finally { session.close(); }
    assert.equal(fs.readdirSync(path.join(ws, '.agent')).filter(name => name.endsWith('.lock')).length, 0);
    const deadline = Date.now() + 3000;
    while (server.clients.size && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(server.clients.size, 0, 'CLI exit must close every owned connection');
  } finally {
    for (const socket of server.clients) socket.terminate();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('CLI api-key mode ignores inherited SDK credentials and routing headers', async () => {
  const gateway = await startGateway();
  gateways.push(gateway);
  const ws = workspace();
  const result = await runCli(
    ['--workspace', ws, '--user-dir', userDir(), '--model', MODEL, '--base-url', gateway.url,
      '--max-turns', '5', 'Loopback task: list the scheduled jobs.'],
    gatewayEnv(KEY, 'api-key'),
  );
  assert.equal(result.timedOut, false);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(gateway.requests.length, 2);
  for (const { headers } of gateway.requests) {
    assert.equal(headers['x-api-key'], KEY);
    assert.equal(headers.authorization, undefined);
    assert.equal(headers['x-fixture-route'], undefined);
  }
  const journal = readJournal(ws, sessionId(result.stderr));
  assert.equal(JSON.parse(journal.split('\n')[0]!).config.gateway.auth, 'api-key');
  assert.doesNotMatch(journal, /dummy-loopback-key|fixture-vendor-|fixture-env-/);
});

test('CLI resume reuses the pinned snapshot over the loopback gateway without persisting the credential', async () => {
  const gateway = await startGateway();
  gateways.push(gateway);
  const ws = workspace();
  const user = userDir();
  const markerPath = path.join(ws, 'session-start.marker');
  seedWorkspace(ws, markerPath);

  const first = await runCli(
    ['--workspace', ws, '--user-dir', user, '--model', MODEL, '--base-url', gateway.url, '--max-turns', '5',
      'Loopback task: list the scheduled jobs.'],
    gatewayEnv(KEY),
  );
  assert.equal(first.code, 0, `initial run failed\nstderr:\n${first.stderr}`);
  const id = sessionId(first.stderr);
  assert.equal(gateway.requests.length, 2);

  // Resume with a rotated credential and no config-changing flags.
  const resumed = await runCli(
    ['--workspace', ws, '--resume', id, 'Loopback resume task.'],
    gatewayEnv(ROTATED_KEY),
  );
  assert.equal(resumed.timedOut, false, `resume timed out\nstderr:\n${resumed.stderr}`);
  assert.equal(resumed.code, 0, `resume failed (code ${resumed.code})\nstderr:\n${resumed.stderr}`);
  assert.match(resumed.stderr, /finished: end_turn; model calls: 1/);
  assert.equal(gateway.requests.length, 3);

  const [firstRequest, , resumedRequest] = gateway.requests as [RecordedRequest, RecordedRequest, RecordedRequest];
  // Same config: identical model, system prompt and pinned tool schemas.
  assert.equal(resumedRequest.body.model, MODEL);
  assert.equal(resumedRequest.body.system, firstRequest.body.system);
  assert.deepEqual(resumedRequest.body.tools, firstRequest.body.tools);
  // Credential is re-read from the environment, so the rotated key is used now.
  assert.equal(resumedRequest.headers.authorization, `Bearer ${ROTATED_KEY}`);
  assert.equal(resumedRequest.headers['x-api-key'], undefined);
  assert.equal(resumedRequest.headers['x-fixture-route'], undefined);

  // The journal grew but still stores neither credential and keeps pairing.
  const journal = readJournal(ws, id);
  assert.doesNotMatch(journal, /dummy-loopback-key/);
  assert.doesNotMatch(journal, /rotated-loopback-key/);
  const meta = JSON.parse(journal.split('\n')[0]!) as { config: any; fingerprint: string };
  assert.equal('apiKey' in meta.config, false);

  const session = Session.open(ws, { id });
  try {
    assertPaired(session.messages);
    assert.equal(session.awaitingResponse, false);
    assert.equal(session.config.model, MODEL);
    assert.equal(session.config.gateway?.baseURL, gateway.url);
    assert.equal(session.events.filter(event => event.kind === 'turn_end').length, 2);
  } finally { session.close(); }
});
