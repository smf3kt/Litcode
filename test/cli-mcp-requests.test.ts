import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { assertPaired } from '../src/agent.js';
import { Session } from '../src/session.js';
import { createHash } from 'node:crypto';
const IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PzWvWQAAAABJRU5ErkJggg==';
const AUDIO = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = 'gateway/mcp-cli-fixture';
const KEY = 'mcp-cli-fixture-key';
const ROTATED_KEY = 'mcp-cli-rotated-key';
const HOST_CONTEXT = 'HOST_SYSTEM_PRIVATE_MARKER';
const HOST_HISTORY = 'HOST_CONVERSATION_PRIVATE_MARKER';
const SAMPLE_TEXT = 'standalone sampling completed';
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 40_000;

type Rpc = { jsonrpc: string; id?: string | number; method?: string; params?: any; result?: any; error?: any };
type WireRequest = { body: any; headers: http.IncomingHttpHeaders };
type CliResult = { code: number | null; stdout: string; stderr: string; timedOut: boolean };

function messageEvents(body: any): unknown[] {
  const sampling = body.tool_choice?.type === 'none';
  return [
    { type: 'message_start', message: { id: 'mcp-cli-message', type: 'message', role: 'assistant', model: body.model,
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: sampling ? SAMPLE_TEXT : 'CLI parent completed' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 4 } },
    { type: 'message_stop' },
  ];
}

async function readBody(request: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_REQUEST_BYTES) throw new Error('Fixture request byte limit');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

async function fixture(t: TestContext, reverseMethods: string[] = [], image = false, arrays = false, audio = false) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cli-mcp-requests-')));
  const workspace = path.join(root, 'workspace space');
  const user = path.join(root, 'user');
  fs.mkdirSync(workspace); fs.mkdirSync(user);
  const messages: WireRequest[] = [];
  const rpc: WireRequest[] = [];
  const capabilities: unknown[] = [];
  const replies: Rpc[] = [];
  const failures: string[] = [];
  const children = new Set<ReturnType<typeof spawn>>();
  const kill = (child: ReturnType<typeof spawn>) => {
    try { process.kill(-child.pid!, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
  };
  let serial = 0;
  const waiting = new Map<string, () => void>();
  const samplingParams = {
    messages: [{ role: 'user', content: arrays ? [{ type: 'text', text: 'SERVER_TASK_MARKER' }, { type: 'image', data: IMAGE, mimeType: 'image/png' }, { type: 'text', text: 'AFTER_IMAGE' }]
      : image ? { type: 'image', data: IMAGE, mimeType: 'image/png' }
      : audio ? { type: 'audio', data: AUDIO, mimeType: 'audio/wav' } : { type: 'text', text: 'SERVER_TASK_MARKER' } }],
    systemPrompt: 'SERVER_SYSTEM_DATA_MARKER', includeContext: 'allServers', maxTokens: 500,
    modelPreferences: { hints: [{ name: 'gateway/ignored-server-model' }] },
  };
  const server = http.createServer((request, response) => {
    void (async () => {
      if (request.method === 'DELETE' && request.url === '/mcp') { response.writeHead(204); response.end(); return; }
      if (request.method !== 'POST') { response.writeHead(404); response.end(); return; }
      const body = await readBody(request);
      if (request.url === '/v1/messages') {
        messages.push({ body, headers: request.headers });
        response.writeHead(200, { 'content-type': 'text/event-stream', connection: 'close' });
        response.end(messageEvents(body).map(event =>
          `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
        return;
      }
      if (request.url !== '/mcp') { response.writeHead(404); response.end(); return; }
      rpc.push({ body, headers: request.headers });
      if (body.method === 'initialize') {
        capabilities.push(body.params.capabilities);
        response.writeHead(200, { 'content-type': 'application/json', 'mcp-session-id': `fixture-${serial++}` });
        response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: {
          protocolVersion: '2025-06-18', capabilities: { tools: {} },
          serverInfo: { name: 'owned-cli-fixture', version: '1' },
        } }));
      } else if (body.method === 'tools/list') {
        response.writeHead(200, { 'content-type': 'text/event-stream', connection: 'close' });
        response.flushHeaders();
        // Hold the tools response until reverse replies arrive, so startup cannot
        // race a sampling call or close the connection before roots are observed.
        for (const method of reverseMethods) {
          const id = `reverse-${serial++}`;
          let timer: NodeJS.Timeout | undefined;
          const arrived = new Promise<void>((resolve, reject) => {
            waiting.set(id, resolve);
            timer = setTimeout(() => { waiting.delete(id); reject(new Error('Fixture reverse reply timeout')); }, 5000);
          });
          response.write(`data: ${JSON.stringify({ jsonrpc: '2.0', id, method,
            params: method === 'sampling/createMessage' ? samplingParams : {} })}\n\n`);
          try { await arrived; } finally { clearTimeout(timer); waiting.delete(id); }
        }
        response.end(`data: ${JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { tools: [] } })}\n\n`);
      } else {
        if (body.id !== undefined && body.method === undefined) {
          replies.push(body);
          waiting.get(String(body.id))?.();
        }
        response.writeHead(202); response.end();
      }
    })().catch(error => { failures.push(String(error)); response.destroy(); });
    request.on('error', () => {});
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject); server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const put = (relative: string, text: string) => {
    const file = path.join(workspace, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text);
  };
  const settings = (extra: object = {}) => put('.harness/settings.json', JSON.stringify({
    mcpServers: { fixture: { type: 'http', url: `${url}/mcp` } },
    features: { mcpDynamic: false }, ...extra,
  }));
  const run = (extra: string[] = [], options: { resume?: string; key?: string; prompt?: string } = {}) =>
    new Promise<CliResult>((resolve, reject) => {
      const env = { ...process.env };
      for (const name of Object.keys(env)) if (name.startsWith('LLM_') || name.startsWith('ANTHROPIC_')) delete env[name];
      Object.assign(env, { LLM_API_KEY: options.key ?? KEY });
      const args = ['--workspace', workspace, ...(options.resume ? ['--resume', options.resume]
        : ['--user-dir', user, '--model', MODEL, '--base-url', url]), '--output-format', 'json', ...extra,
      options.prompt ?? HOST_HISTORY];
      const entry = process.env.HARNESS_SMOKE_COMPILED === '1' ? [path.join(ROOT, 'dist/cli.js')]
        : ['--import', 'tsx', path.join(ROOT, 'src/cli.ts')];
      const child = spawn(process.execPath, [...entry, ...args], {
        cwd: ROOT, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
      });
      children.add(child);
      let stdout = ''; let stderr = ''; let timedOut = false;
      const cap = (text: string) => Buffer.from(text).subarray(-MAX_OUTPUT_BYTES).toString('utf8');
      child.stdout.on('data', chunk => { stdout = cap(stdout + String(chunk)); });
      child.stderr.on('data', chunk => { stderr = cap(stderr + String(chunk)); });
      const aborted = () => kill(child);
      t.signal.addEventListener('abort', aborted, { once: true });
      if (t.signal.aborted) aborted();
      const timer = setTimeout(() => { timedOut = true; kill(child); }, 20_000);
      const cleanup = () => {
        clearTimeout(timer); children.delete(child); t.signal.removeEventListener('abort', aborted);
      };
      child.once('error', error => { cleanup(); reject(error); });
      child.once('close', code => { cleanup(); resolve({ code, stdout, stderr, timedOut }); });
    });
  t.after(async () => {
    for (const child of children) kill(child);
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { workspace, messages, rpc, capabilities, replies, failures, samplingParams, settings, put, run };
}

function success(result: CliResult): { session_id: string; reason: string; model_calls: number; usage: any } {
  assert.equal(result.timedOut, false, result.stderr);
  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.reason, 'end_turn');
  return output;
}

function journal(workspace: string, id: string): { text: string; metadata: any } {
  const text = fs.readFileSync(path.join(workspace, '.agent', `${id}.jsonl`), 'utf8');
  return { text, metadata: JSON.parse(text.split('\n')[0]!) };
}

function assertParentTools(request: WireRequest): void {
  assert.ok(Array.isArray(request.body.tools), 'parent request must expose host tools');
  const names = request.body.tools.map((tool: { name: string }) => tool.name);
  for (const name of [
    'read_file', 'write_file', 'run_command', 'mcp_reconnect',
    'ask_user_question', 'submit_plan', 'report_findings',
  ]) {
    assert.ok(names.includes(name), `parent request must expose ${name}`);
  }
  // The fixture advertises neither catalogs nor enabled dynamic discovery.
  for (const name of [
    'mcp_resources_list', 'mcp_resource_read', 'mcp_prompts_list', 'mcp_prompt_get',
    'mcp_tool_search', 'mcp_tool_call', 'mcp_refresh',
  ]) {
    assert.equal(names.includes(name), false, `unavailable MCP tool ${name} must stay hidden`);
  }
}

function assertIsolatedSampling(request: WireRequest, samplingParams: object): void {
  assert.equal(request.body.model, MODEL);
  assert.deepEqual(request.body.tool_choice, { type: 'none' });
  assert.equal(request.body.tools, undefined);
  assert.equal(request.body.output_config.effort, 'low');
  assert.equal(request.body.max_tokens, 128);
  assert.equal(request.body.thinking, undefined);
  assert.equal(request.body.messages.length, 1);
  assert.equal(request.body.messages[0].role, 'user');
  assert.match(request.body.messages[0].content, /SERVER_TASK_MARKER/);
  assert.match(request.body.messages[0].content, /SERVER_SYSTEM_DATA_MARKER/);
  assert.doesNotMatch(JSON.stringify(request.body), new RegExp(`${HOST_CONTEXT}|${HOST_HISTORY}|${KEY}|${ROTATED_KEY}`));
  assert.equal(request.body.includeContext, undefined);
  assert.equal(request.body.modelPreferences, undefined);
  assert.equal((samplingParams as any).includeContext, 'allServers');
}

test('CLI image sampling preserves bytes, pinned resume, shared budget and absent/managed gates', { timeout: 40_000 }, async t => {
  const fx = await fixture(t, ['sampling/createMessage'], true);
  fx.settings({ mcpClient: { sampling: true, samplingImages: true } });
  fx.put('HARNESS.md', HOST_CONTEXT);
  const first = success(await fx.run(['--effort', 'low', '--max-tokens', '128', '--max-model-calls', '2']));
  const before = journal(fx.workspace, first.session_id);
  assert.equal(before.metadata.config.mcpClient.samplingImages, true);
  fx.put('.harness/settings.json', '{ malformed settings ignored on resume');
  const resumed = success(await fx.run([], { resume: first.session_id, key: ROTATED_KEY }));
  assert.equal(resumed.session_id, first.session_id);
  assert.equal(resumed.model_calls, 2); assert.equal(resumed.usage.input_tokens, 20);
  for (const index of [0, 2]) {
    const body = fx.messages[index]!.body;
    assert.equal(body.model, MODEL); assert.equal(body.max_tokens, 128);
    assert.deepEqual(body.tool_choice, { type: 'none' }); assert.equal(body.tools, undefined);
    assert.deepEqual(body.messages[0].content[1], { type: 'image', source: { type: 'base64', media_type: 'image/png', data: IMAGE } });
    assert.match(body.messages[0].content[0].text, /SERVER_SYSTEM_DATA_MARKER/);
    assert.doesNotMatch(JSON.stringify(body), new RegExp(`${HOST_CONTEXT}|${HOST_HISTORY}|${KEY}|${ROTATED_KEY}`));
  }
  for (const reply of fx.replies) assert.equal(reply.result.content.text, SAMPLE_TEXT);
  fx.settings({ mcpClient: { sampling: true, samplingImages: true } });
  const limited = await fx.run(['--max-model-calls', '1']);
  assert.equal(limited.code, 2); assert.equal(JSON.parse(limited.stdout).model_calls, 1);
  const count = fx.messages.length;
  fx.settings({ mcpClient: { sampling: true } });
  success(await fx.run()); assert.equal(fx.replies.at(-1)!.error.code, -32603);
  assert.equal(fx.messages.length, count + 1);
  fx.settings({ mcpClient: { sampling: true, samplingImages: true } });
  fx.put('managed.json', JSON.stringify({ mcpClient: { samplingImages: false } }));
  const managed = success(await fx.run(['--managed-settings', path.join(fx.workspace, 'managed.json')]));
  assert.equal(fx.replies.at(-1)!.error.code, -32603);
  assert.equal(journal(fx.workspace, managed.session_id).metadata.config.mcpClient.samplingImages, false);
  const after = journal(fx.workspace, first.session_id);
  assert.doesNotMatch(after.text, new RegExp(`${KEY}|${ROTATED_KEY}`));
  assert.equal(after.text.includes(IMAGE), false);
  const session = Session.open(fx.workspace, { id: first.session_id });
  try { assertPaired(session.messages); } finally { session.close(); }
  assert.equal(fs.readdirSync(path.join(fx.workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  assert.deepEqual(fx.failures, []);
  if (process.env.HARNESS_SMOKE_RECEIPT === '1') console.log(JSON.stringify({ samplingImages: 'passed',
    compiledCLI: process.env.HARNESS_SMOKE_COMPILED === '1', gatewayRequests: fx.messages.length,
    pinnedResume: true, budget: true, legacyGate: true, managedGate: true, bytePreserving: true, locksReleased: true,
    imageSha256: createHash('sha256').update(Buffer.from(IMAGE, 'base64')).digest('hex') }));
});

test('CLI array sampling restores pinned mixed blocks and enforces managed and legacy gates', { timeout: 40_000 }, async t => {
  const fx = await fixture(t, ['sampling/createMessage'], true, true);
  const client = { sampling: true, samplingImages: true, samplingArrays: true };
  fx.settings({ mcpClient: client }); fx.put('HARNESS.md', HOST_CONTEXT);
  const first = success(await fx.run(['--max-model-calls', '2']));
  assert.equal(journal(fx.workspace, first.session_id).metadata.config.mcpClient.samplingArrays, true);
  fx.put('.harness/settings.json', '{ ignored current config');
  const resumed = success(await fx.run([], { resume: first.session_id, key: ROTATED_KEY }));
  assert.equal(resumed.session_id, first.session_id); assert.equal(resumed.model_calls, 2);
  for (const index of [0, 2]) {
    const body = fx.messages[index]!.body;
    assert.equal(body.model, MODEL); assert.deepEqual(body.tool_choice, { type: 'none' });
    assert.equal(body.tools, undefined);
    const native = body.messages[0].content;
    assert.deepEqual(native[1], { type: 'image', source: { type: 'base64', media_type: 'image/png', data: IMAGE } });
    const quoted = JSON.parse(native[0].text.split('\n')[1]);
    assert.deepEqual(quoted.messages[0].content, [
      { type: 'text', text: 'SERVER_TASK_MARKER' }, { type: 'image', mimeType: 'image/png', attachment: 1 },
      { type: 'text', text: 'AFTER_IMAGE' },
    ]);
    assert.doesNotMatch(JSON.stringify(body), new RegExp(`${HOST_CONTEXT}|${HOST_HISTORY}|${KEY}|${ROTATED_KEY}`));
  }
  fx.settings({ mcpClient: client }); const limited = await fx.run(['--max-model-calls', '1']);
  assert.equal(limited.code, 2); assert.equal(JSON.parse(limited.stdout).model_calls, 1);
  const before = fx.messages.length; fx.settings({ mcpClient: { sampling: true, samplingImages: true } });
  success(await fx.run()); assert.equal(fx.messages.length, before + 1); assert.equal(fx.replies.at(-1)!.error.code, -32603);
  fx.settings({ mcpClient: client }); fx.put('managed.json', JSON.stringify({ mcpClient: { samplingArrays: false } }));
  const managed = success(await fx.run(['--managed-settings', path.join(fx.workspace, 'managed.json')]));
  assert.equal(journal(fx.workspace, managed.session_id).metadata.config.mcpClient.samplingArrays, false);
  assert.equal(fx.replies.at(-1)!.error.code, -32603);
  assert.equal(journal(fx.workspace, first.session_id).text.includes(IMAGE), false);
  assert.doesNotMatch(journal(fx.workspace, first.session_id).text, new RegExp(`${KEY}|${ROTATED_KEY}`));
  assert.equal(fs.readdirSync(path.join(fx.workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  assert.deepEqual(fx.failures, []);
  if (process.env.HARNESS_SMOKE_RECEIPT === '1') console.log(JSON.stringify({ samplingArrays: 'passed',
    compiledCLI: process.env.HARNESS_SMOKE_COMPILED === '1', gatewayRequests: fx.messages.length,
    ordering: true, bytePreserving: true, pinnedResume: true, managedGate: true, legacyGate: true, budget: true, locksReleased: true }));
});

test('CLI roots flag overrides false settings and exposes exactly the current workspace URI', { timeout: 30_000 }, async t => {
  const fx = await fixture(t, ['roots/list']);
  fx.settings({ mcpClient: { roots: false, sampling: false } });
  const result = success(await fx.run(['--mcp-roots']));
  assert.deepEqual(fx.capabilities, [{ roots: { listChanged: false } }]);
  assert.deepEqual(fx.replies.map(reply => reply.result), [{ roots: [{ uri: pathToFileURL(fx.workspace).href }] }]);
  assert.deepEqual(journal(fx.workspace, result.session_id).metadata.config.mcpClient, { roots: true, sampling: false });
  assert.equal(fx.messages.length, 1);
  assertParentTools(fx.messages[0]!);
  assert.ok(fx.rpc.every(request => request.headers.authorization === undefined && request.headers['x-api-key'] === undefined));
  assert.deepEqual(fx.failures, []);
});

test('CLI legacy MCP config advertises empty capabilities and preserves absent mcpClient', { timeout: 30_000 }, async t => {
  const fx = await fixture(t, ['roots/list', 'sampling/createMessage']);
  fx.settings();
  const result = success(await fx.run());
  assert.deepEqual(fx.capabilities, [{}]);
  assert.deepEqual(fx.replies.map(reply => reply.error.code), [-32601, -32601]);
  assert.equal(Object.hasOwn(journal(fx.workspace, result.session_id).metadata.config, 'mcpClient'), false);
  assert.equal(fx.messages.length, 1);
  assertParentTools(fx.messages[0]!);
  assert.deepEqual(fx.failures, []);
});

test('CLI sampling flag uses configured model and effort without host tools or conversation', { timeout: 30_000 }, async t => {
  const fx = await fixture(t, ['sampling/createMessage']);
  fx.settings({ mcpClient: { roots: false, sampling: false } });
  fx.put('HARNESS.md', `${HOST_CONTEXT}\n`);
  const result = success(await fx.run(['--mcp-sampling', '--effort', 'low', '--max-tokens', '128', '--max-model-calls', '2']));
  assert.deepEqual(fx.capabilities, [{ sampling: {} }]);
  assert.equal(fx.messages.length, 2);
  assertIsolatedSampling(fx.messages[0]!, fx.samplingParams);
  assertParentTools(fx.messages[1]!);
  assert.match(fx.messages[1]!.body.system, new RegExp(HOST_CONTEXT));
  assert.match(JSON.stringify(fx.messages[1]!.body.messages), new RegExp(HOST_HISTORY));
  assert.deepEqual(fx.replies[0]!.result, { role: 'assistant', content: { type: 'text', text: SAMPLE_TEXT }, model: MODEL, stopReason: 'endTurn' });
  assert.equal(result.model_calls, 2);
  assert.equal(result.usage.input_tokens, 20);
  assert.equal(result.usage.output_tokens, 8);
  assert.deepEqual(journal(fx.workspace, result.session_id).metadata.config.mcpClient, { roots: false, sampling: true });
  assert.deepEqual(fx.failures, []);
});

test('CLI sampling and parent completions share max-model-calls invocation budget', { timeout: 30_000 }, async t => {
  const fx = await fixture(t, ['sampling/createMessage']);
  fx.settings();
  const result = await fx.run(['--mcp-sampling', '--effort', 'low', '--max-tokens', '128', '--max-model-calls', '1']);
  assert.equal(result.timedOut, false, result.stderr);
  assert.equal(result.code, 2, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.reason, 'budget_exceeded');
  assert.equal(output.model_calls, 1);
  assert.equal(output.usage.input_tokens, 10);
  assert.equal(fx.messages.length, 1, 'sampling must consume the call reserved for the parent');
  assertIsolatedSampling(fx.messages[0]!, fx.samplingParams);
  assert.equal(fx.replies[0]!.result.content.text, SAMPLE_TEXT);
  assert.deepEqual(fx.failures, []);
});

test('CLI resume pins MCP capabilities independently of current settings and rotated credentials', { timeout: 40_000 }, async t => {
  const fx = await fixture(t, ['roots/list', 'sampling/createMessage']);
  fx.settings({ mcpClient: { roots: true, sampling: true } });
  fx.put('HARNESS.md', `${HOST_CONTEXT}\n`);
  const first = success(await fx.run(['--effort', 'low', '--max-tokens', '128']));
  const before = journal(fx.workspace, first.session_id).metadata;
  assert.deepEqual(before.config.mcpClient, { roots: true, sampling: true });
  // Even malformed current settings must be irrelevant to a pinned resume.
  fx.put('.harness/settings.json', '{ current settings are intentionally invalid');
  fx.put('HARNESS.md', 'REPLACED_CURRENT_SYSTEM');
  const resumed = success(await fx.run([], { resume: first.session_id, key: ROTATED_KEY, prompt: 'RESUMED_PARENT_TASK' }));
  assert.equal(resumed.session_id, first.session_id);
  assert.equal(resumed.model_calls, 2);
  assert.deepEqual(fx.capabilities, [{ roots: { listChanged: false }, sampling: {} }, { roots: { listChanged: false }, sampling: {} }]);
  assert.deepEqual(fx.replies.filter(reply => reply.result?.roots).map(reply => reply.result), [
    { roots: [{ uri: pathToFileURL(fx.workspace).href }] }, { roots: [{ uri: pathToFileURL(fx.workspace).href }] },
  ]);
  assert.equal(fx.messages.length, 4);
  assertIsolatedSampling(fx.messages[2]!, fx.samplingParams);
  assert.match(JSON.stringify(fx.messages[3]!.body.messages), new RegExp(HOST_HISTORY));
  assert.equal(fx.messages[3]!.body.system, fx.messages[1]!.body.system);
  assert.deepEqual(fx.messages[3]!.body.tools, fx.messages[1]!.body.tools);
  assert.equal(fx.messages[2]!.headers.authorization, `Bearer ${ROTATED_KEY}`);
  assert.ok(fx.rpc.every(request => request.headers.authorization === undefined && request.headers['x-api-key'] === undefined));
  const after = journal(fx.workspace, first.session_id);
  assert.deepEqual(after.metadata, before);
  assert.doesNotMatch(after.text, new RegExp(`${KEY}|${ROTATED_KEY}|apiKey|authToken`));
  const session = Session.open(fx.workspace, { id: first.session_id });
  try { assertPaired(session.messages); assert.equal(session.awaitingResponse, false); } finally { session.close(); }
  for (const flag of ['--mcp-roots', '--mcp-sampling']) {
    const rejected = await fx.run([flag], { resume: first.session_id });
    assert.equal(rejected.code, 1, rejected.stderr);
    assert.match(rejected.stderr, /Resume uses stored settings/);
  }
  assert.equal(fx.messages.length, 4);
  assert.deepEqual(fx.failures, []);
});

test('CLI audio sampling stores clips, pins the gate and keeps managed and legacy gates', { timeout: 40_000 }, async t => {
  const fx = await fixture(t, ['sampling/createMessage'], false, false, true);
  const client = { sampling: true, samplingAudio: true };
  fx.settings({ mcpClient: client }); fx.put('HARNESS.md', HOST_CONTEXT);
  const first = success(await fx.run(['--max-model-calls', '2']));
  assert.equal(journal(fx.workspace, first.session_id).metadata.config.mcpClient.samplingAudio, true);
  fx.put('.harness/settings.json', '{ ignored current config');
  const resumed = success(await fx.run([], { resume: first.session_id, key: ROTATED_KEY }));
  assert.equal(resumed.session_id, first.session_id); assert.equal(resumed.model_calls, 2);
  const stored: string[] = [];
  for (const index of [0, 2]) {
    const body = fx.messages[index]!.body;
    assert.equal(body.model, MODEL); assert.deepEqual(body.tool_choice, { type: 'none' }); assert.equal(body.tools, undefined);
    const quoted = body.messages[0].content as string;
    const reference = JSON.parse(quoted.split('\n')[1]).messages[0].content.text as string;
    assert.match(reference, /^\[Audio from fixture\] Binary content \(audio\/wav, 44 B\) saved to \.harness\/attachments\/mcp-fixture-[0-9a-f-]{36}\.wav$/);
    stored.push(path.join(fx.workspace, reference.slice(reference.indexOf('saved to ') + 'saved to '.length)));
    assert.doesNotMatch(JSON.stringify(body), new RegExp(`${HOST_CONTEXT}|${HOST_HISTORY}|${KEY}|${ROTATED_KEY}`));
  }
  assert.equal(new Set(stored).size, 2);
  for (const file of stored) assert.deepEqual(fs.readFileSync(file), Buffer.from(AUDIO, 'base64'));
  fx.settings({ mcpClient: client }); const limited = await fx.run(['--max-model-calls', '1']);
  assert.equal(limited.code, 2); assert.equal(JSON.parse(limited.stdout).model_calls, 1);
  const before = fx.messages.length; fx.settings({ mcpClient: { sampling: true } });
  // Only the parent turn reaches the gateway; the rejected sampling never spends a model call.
  success(await fx.run()); assert.equal(fx.messages.length, before + 1); assert.equal(fx.replies.at(-1)!.error.code, -32603);
  fx.settings({ mcpClient: client }); fx.put('managed.json', JSON.stringify({ mcpClient: { samplingAudio: false } }));
  const managed = success(await fx.run(['--managed-settings', path.join(fx.workspace, 'managed.json')]));
  assert.equal(journal(fx.workspace, managed.session_id).metadata.config.mcpClient.samplingAudio, false);
  assert.equal(fx.replies.at(-1)!.error.code, -32603);
  const text = journal(fx.workspace, first.session_id).text;
  assert.equal(text.includes(AUDIO), false);
  assert.doesNotMatch(text, new RegExp(`${KEY}|${ROTATED_KEY}`));
  assert.equal(fs.readdirSync(path.join(fx.workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  assert.deepEqual(fx.failures, []);
  if (process.env.HARNESS_SMOKE_RECEIPT === '1') console.log(JSON.stringify({ samplingAudio: 'passed',
    compiledCLI: process.env.HARNESS_SMOKE_COMPILED === '1', gatewayRequests: fx.messages.length,
    pinnedResume: true, managedGate: true, legacyGate: true, budget: true, bytePreserving: true, locksReleased: true,
    audioSha256: createHash('sha256').update(Buffer.from(AUDIO, 'base64')).digest('hex') }));
});
