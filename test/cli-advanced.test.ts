import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type Anthropic from '@anthropic-ai/sdk';
import { assertPaired } from '../src/agent.js';
import { Session } from '../src/session.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = 'gateway/advanced-parent';
type Request = { model: string; system: string; tools: Anthropic.Tool[]; messages: Anthropic.MessageParam[]; output_config?: { effort: string } };
type Call = { id: string; name: string; input: unknown };

function events(body: Request, call?: Call): unknown[] {
  const block = call ? { type: 'tool_use', id: call.id, name: call.name, input: {} } : { type: 'text', text: '' };
  return [
    { type: 'message_start', message: { id: 'fixture-message', type: 'message', role: 'assistant', model: body.model,
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: block },
    { type: 'content_block_delta', index: 0, delta: call
      ? { type: 'input_json_delta', partial_json: JSON.stringify(call.input) }
      : { type: 'text_delta', text: 'Advanced loopback completed.' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: call ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 4 } },
    { type: 'message_stop' },
  ];
}

async function fixture(route: (body: Request) => Call | undefined) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cli-advanced-')));
  const workspace = path.join(root, 'workspace');
  const user = path.join(root, 'user');
  fs.mkdirSync(workspace); fs.mkdirSync(user);
  const requests: Request[] = [];
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/messages') { res.writeHead(404); res.end(); return; }
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 4 * 1024 * 1024) { req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Request;
        requests.push(body);
        const response = events(body, route(body)).map(event =>
          `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('');
        res.writeHead(200, { 'content-type': 'text/event-stream', connection: 'close' }); res.end(response);
      } catch { res.writeHead(500); res.end(); }
    });
    req.on('error', () => {});
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject); server.listen(0, '127.0.0.1', resolve);
  });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const put = (relative: string, content: string) => {
    const file = path.join(workspace, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content);
  };
  const settings = (config: object) => put('.harness/settings.json', JSON.stringify(config));
  const run = (prompt: string, resume?: string, extra: string[] = []) => new Promise<{ id: string; stdout: string; stderr: string }>((resolve, reject) => {
    // Clear model/gateway overrides and route all model traffic to this owned peer.
    const env = { ...process.env };
    for (const name of Object.keys(env)) if (name.startsWith('LLM_') || name.startsWith('ANTHROPIC_')) delete env[name];
    Object.assign(env, { LLM_API_KEY: 'advanced-fixture-key', LLM_THINKING: 'false' });
    const args = ['--workspace', workspace, ...(resume ? ['--resume', resume]
      : ['--user-dir', user, '--model', MODEL, '--base-url', url]), ...extra, prompt];
    const child = spawn(process.execPath, ['--import', 'tsx', path.join(ROOT, 'src/cli.ts'), ...args], {
      cwd: ROOT, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = '';
    const timer = setTimeout(() => {
      try { process.kill(-child.pid!, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
    }, 20_000);
    child.stdout.on('data', chunk => { stdout = (stdout + chunk.toString()).slice(-100_000); });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-100_000); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => {
      clearTimeout(timer);
      if (code !== 0) { reject(new Error(`CLI exited ${code}: ${stderr}`)); return; }
      const id = /session: ([a-f0-9-]+)/.exec(stderr)?.[1];
      if (!id) { reject(new Error(`Missing session ID: ${stderr}`)); return; }
      resolve({ id, stdout, stderr });
    });
  });
  return { root, workspace, user, requests, put, settings, run, async close() {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(root, { recursive: true, force: true });
  } };
}

function results(request: Request): Anthropic.ToolResultBlockParam[] {
  return request.messages.flatMap(message => typeof message.content === 'string' ? []
    : message.content.filter((block): block is Anthropic.ToolResultBlockParam => block.type === 'tool_result'));
}
function lastPrompt(request: Request): string {
  const message = request.messages.at(-1);
  return typeof message?.content === 'string' ? message.content : '';
}
function readSession(workspace: string, id: string, check: (session: Session) => void): void {
  const session = Session.open(workspace, { id });
  try { assertPaired(session.messages); check(session); } finally { session.close(); }
}

test('CLI defaults to bypass for real file and enabled shell effects and pins that mode on resume', { timeout: 60_000 }, async () => {
  let step = 0;
  const fx = await fixture(() => {
    switch (++step) {
      case 1: return { id: 'default-write', name: 'write_file', input: { path: 'bypass.txt', content: 'file effect' } };
      case 2: return { id: 'default-shell', name: 'run_command', input: { command: 'printf shell-effect > shell.txt', timeout_ms: 2000 } };
      default: return;
    }
  });
  try {
    fx.settings({ allowShell: true });
    const first = await fx.run('DEFAULT_BYPASS');
    assert.equal(fs.readFileSync(path.join(fx.workspace, 'bypass.txt'), 'utf8'), 'file effect');
    assert.equal(fs.readFileSync(path.join(fx.workspace, 'shell.txt'), 'utf8'), 'shell-effect');
    assert.equal(results(fx.requests.at(-1)!).length, 2);
    assert.ok(results(fx.requests.at(-1)!).every(result => result.is_error !== true));
    readSession(fx.workspace, first.id, session => assert.equal(session.config.permissions?.mode, 'bypass'));
    fx.settings({ permissions: { mode: 'plan' } });
    await fx.run('PINNED_BYPASS', first.id);
    readSession(fx.workspace, first.id, session => assert.equal(session.config.permissions?.mode, 'bypass'));
  } finally { await fx.close(); }
});

test('CLI custom types select literal models and fork paired history; resume pins the catalog', { timeout: 60_000 }, async () => {
  let parentCalls = 0; let resumed = false;
  const fx = await fixture(body => {
    if (lastPrompt(body) === 'CUSTOM_CHILD' || lastPrompt(body) === 'FORK_CHILD') return;
    if (resumed) return ++parentCalls === 1
      ? { id: 'resume-custom', name: 'agent', input: { prompt: 'CUSTOM_CHILD', subagent_type: 'reviewer' } } : undefined;
    switch (++parentCalls) {
      case 1: return { id: 'prior-cron', name: 'cron_list', input: {} };
      case 2: return { id: 'custom', name: 'agent', input: { prompt: 'CUSTOM_CHILD', subagent_type: 'reviewer' } };
      case 3: return { id: 'fork', name: 'agent', input: { prompt: 'FORK_CHILD', subagent_type: 'fork', model: 'ignored-fork-model', effort: 'max' } };
      default: return;
    }
  });
  try {
    fx.settings({ permissions: { mode: 'bypass', allow: [], deny: [] } });
    fx.put('.harness/agents/reviewer.md', '---\nname: reviewer\ndescription: Fixture reviewer\nmode: explore\ntools: read_file\nmodel: gateway/custom-worker\neffort: low\nmaxTurns: 3\n---\nPINNED_AGENT_BODY\n');
    const first = await fx.run('PARENT_HISTORY_MARKER', undefined, ['--effort', 'high']);
    for (const id of ['custom', 'fork']) {
      const result = fx.requests.flatMap(results).find(result => result.tool_use_id === id);
      assert.ok(result, `${id} is missing its paired result`);
      assert.equal(result.is_error ?? false, false, String(result.content));
      assert.equal(JSON.parse(String(result.content)).status, 'completed', String(result.content));
    }
    assert.equal(fx.requests.length, 6);
    const initial = fx.requests[0]!;
    assert.equal(initial.tools.length, 46);
    assert.equal(initial.tools.some(tool => tool.name.startsWith('plugin_')), false);
    assert.match(initial.system, /Available agent types/);
    assert.match(initial.system, /"name":"reviewer"/);
    assert.match(initial.system, /gateway\/custom-worker/);
    const custom = fx.requests.find(body => lastPrompt(body) === 'CUSTOM_CHILD')!;
    assert.equal(custom.model, 'gateway/custom-worker');
    assert.equal(custom.output_config?.effort, 'low');
    assert.deepEqual(custom.tools.map(tool => tool.name), ['read_file']);
    assert.match(custom.system, /PINNED_AGENT_BODY/);
    assert.equal(JSON.stringify(custom.messages).includes('PARENT_HISTORY_MARKER'), false);
    const fork = fx.requests.find(body => lastPrompt(body) === 'FORK_CHILD')!;
    assert.equal(fork.model, MODEL); assert.equal(fork.output_config?.effort, 'high');
    assertPaired(fork.messages);
    assert.match(JSON.stringify(fork.messages), /PARENT_HISTORY_MARKER/);
    assert.ok(results(fork).some(result => result.tool_use_id === 'prior-cron'));
    assert.equal(JSON.stringify(fork.messages).includes('"id":"fork"'), false);
    for (const call of ['custom', 'fork']) {
      const result = results(fx.requests.at(-1)!).find(result => result.tool_use_id === call)!;
      assert.equal(result.is_error ?? false, false);
      const child = JSON.parse(String(result.content));
      assert.equal(child.status, 'completed');
      readSession(fx.workspace, child.session_id, session => assert.equal(session.awaitingResponse, false));
    }
    let pinned: unknown;
    readSession(fx.workspace, first.id, session => { pinned = structuredClone(session.config); });
    fs.rmSync(path.join(fx.workspace, '.harness/agents'), { recursive: true });
    fx.settings({ features: { agentTypes: false, interaction: false } });
    resumed = true; parentCalls = 0;
    await fx.run('RESUME_WITH_PINNED_TYPE', first.id);
    assert.equal(fx.requests.length, 9);
    assert.deepEqual(fx.requests[6]!.tools, initial.tools);
    assert.equal(fx.requests[6]!.system, initial.system);
    assert.match(fx.requests[7]!.system, /PINNED_AGENT_BODY/);
    assert.equal(fx.requests[7]!.model, 'gateway/custom-worker');
    readSession(fx.workspace, first.id, session => assert.deepEqual(session.config, pinned));
    assert.equal(fs.readdirSync(path.join(fx.workspace, '.agent')).some(file => file.endsWith('.lock')), false);
  } finally { await fx.close(); }
});

test('CLI plugin opt-in installs locally and loads pinned skill bodies on new sessions', { timeout: 60_000 }, async () => {
  let phase = 'install'; let calls = 0;
  const fx = await fixture(() => ++calls === 1 ? phase === 'install'
    ? { id: 'install', name: 'plugin_install', input: { directory: 'local-package' } }
    : phase === 'load' ? { id: 'skill', name: 'skill', input: { name: 'fixture-plugin-skill' } } : undefined : undefined);
  try {
    fx.settings({ plugins: { enabled: true }, permissions: { mode: 'bypass', allow: [], deny: [] } });
    fx.put('local-package/plugin.json', JSON.stringify({ name: 'fixture', version: '1', skills: 'skills' }));
    fx.put('local-package/skills/example/SKILL.md', '---\nname: fixture-plugin-skill\ndescription: Installed fixture catalog\n---\nPINNED_PLUGIN_BODY\n');
    await fx.run('Install local fixture.');
    assert.deepEqual(fx.requests[0]!.tools.filter(tool => tool.name.startsWith('plugin_')).map(tool => tool.name),
      ['plugin_list', 'plugin_install', 'plugin_update', 'plugin_remove']);
    assert.equal(results(fx.requests[1]!)[0]!.is_error ?? false, false);
    phase = 'load'; calls = 0;
    const loaded = await fx.run('Load installed fixture skill.');
    assert.match(fx.requests[2]!.system, /- fixture-plugin-skill: Installed fixture catalog/);
    assert.match(String(results(fx.requests[3]!)[0]!.content), /PINNED_PLUGIN_BODY/);
    readSession(fx.workspace, loaded.id, session => {
      assert.equal(session.config.plugins?.enabled, true);
      assert.match(session.config.skills!.find(skill => skill.name === 'fixture-plugin-skill')!.body, /PINNED_PLUGIN_BODY/);
    });
    fx.settings({}); phase = 'disabled'; calls = 0;
    const disabled = await fx.run('Default plugins stay opt-in.');
    assert.equal(fx.requests[4]!.tools.some(tool => tool.name.startsWith('plugin_')), false);
    assert.equal(fx.requests[4]!.system.includes('fixture-plugin-skill'), false);
    readSession(fx.workspace, disabled.id, session => assert.equal(session.config.plugins, undefined));
  } finally { await fx.close(); }
});

test('CLI headless interactions return explicit paired callback errors and typed findings', { timeout: 30_000 }, async () => {
  let calls = 0;
  const fx = await fixture(() => ++calls === 1 ? { id: 'question', name: 'ask_user_question', input: {
    questions: [{ question: 'Choose output.', multiSelect: false, options: [{ label: 'Text', description: 'Plain text' }, { label: 'JSON', description: 'JSON output' }] }],
  } } : calls === 2 ? { id: 'plan', name: 'submit_plan', input: { plan: 'Complete fixture plan.' } }
    : calls === 3 ? { id: 'findings', name: 'report_findings', input: { findings: [{ file: 'sample.ts', line: 1, summary: 'Fixture finding', severity: 'info' }] } } : undefined);
  try {
    fx.settings({ permissions: { mode: 'bypass', allow: [], deny: [] } });
    const result = await fx.run('Headless interaction fixture.', undefined, ['--output-format', 'json', '--max-model-calls', '4']);
    const final = JSON.parse(result.stdout);
    assert.equal(final.reason, 'end_turn'); assert.equal(final.model_calls, 4);
    assert.equal(fx.requests[0]!.tools.length, 46);
    const paired = results(fx.requests[3]!);
    for (const [id, error] of [['question', 'host ask callback is missing'], ['plan', 'host plan callback is missing']]) {
      const item = paired.find(block => block.tool_use_id === id)!;
      assert.equal(item.is_error, true); assert.ok(String(item.content).includes(error!));
    }
    const report = paired.find(block => block.tool_use_id === 'findings')!;
    assert.equal(report.is_error ?? false, false);
    assert.deepEqual(JSON.parse(String(report.content)), { findings: [{ file: 'sample.ts', line: 1, summary: 'Fixture finding', severity: 'info' }] });
    readSession(fx.workspace, result.id, session => {
      assert.equal(session.config.features?.agentTypes, true); assert.equal(session.config.features?.interaction, true);
      assert.equal(session.config.contextTokens, 1_000_000); assert.equal(session.config.compactAt, 512_000);
      assert.equal(session.config.effort, undefined); assert.equal(session.awaitingResponse, false);
    });
  } finally { await fx.close(); }
});

test('CLI explicit settings disable advanced agent and interaction schemas', { timeout: 30_000 }, async () => {
  const fx = await fixture(() => undefined);
  try {
    fx.settings({ features: { agentTypes: false, interaction: false }, plugins: { enabled: false } });
    const result = await fx.run('Use explicitly disabled feature settings.');
    const request = fx.requests[0]!;
    assert.equal(request.tools.length, 43);
    const agent = request.tools.find(tool => tool.name === 'agent')!;
    assert.equal(Object.hasOwn(agent.input_schema.properties!, 'subagent_type'), false);
    assert.equal(request.tools.some(tool => ['ask_user_question', 'submit_plan', 'report_findings'].includes(tool.name)), false);
    assert.equal(request.tools.some(tool => tool.name.startsWith('plugin_')), false);
    assert.equal(request.system.includes('# Available agent types'), false);
    readSession(fx.workspace, result.id, session => {
      assert.equal(session.config.features?.agentTypes, false);
      assert.equal(session.config.features?.interaction, false);
      assert.equal(session.config.plugins?.enabled, false);
    });
  } finally { await fx.close(); }
});
