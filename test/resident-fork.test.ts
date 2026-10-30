import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Readable, Writable } from 'node:stream';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { ChildProcess, type spawn } from 'node:child_process';
import http from 'node:http';
import { forkSession } from '../src/sessions.js';
import { defaultConfig } from '../src/agent.js';
import { startBackgroundSession } from '../src/background-session.js';
import { interactiveLoop } from '../src/interactive.js';
import { createLocalPeerTransport, createLocalPeerTools, type LocalPeerTransport } from '../src/local-peer.js';
import { reloadConfig } from '../src/reload.js';
import { createRuntime, parseSettings, pinToolSchemas } from '../src/runtime.js';
import { configSchema, managedPolicySchema, Session } from '../src/session.js';
import { relocateSession } from '../src/workspace-session.js';
import type { ModelProvider } from '../src/provider.js';

const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'resident-fork-test-')));
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
async function until(check: () => boolean): Promise<void> {
  const end = Date.now() + 5000;
  while (!check()) { if (Date.now() >= end) throw new Error('Resident condition timed out'); await delay(10); }
}
function reply(text: string): Anthropic.Message {
  return { id: 'fixture', type: 'message', role: 'assistant', model: 'fixture', content: [{ type: 'text', text, citations: null }],
    container: null, diagnostics: null, stop_details: null, stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
      cache_creation: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null } };
}
const output = () => { let text = ''; return { stream: new Writable({ write(chunk, _encoding, next) {
  text += String(chunk); next(); } }), text: () => text }; };

class Worker extends ChildProcess {
  override pid = 4242;
  override connected = true;
  override signalCode: NodeJS.Signals | null = null;
  override unref() {}
  override disconnect() { this.connected = false; }
  override kill(signal: NodeJS.Signals | number = 'SIGTERM') {
    this.signalCode = typeof signal === 'string' ? signal : 'SIGTERM';
    queueMicrotask(() => this.emit('exit', null, signal));
    return true;
  }
}

test('resident choice pins schemas, keeps legacy absence and acknowledges only the copied session', async () => {
  const workspace = temporary();
  const config = defaultConfig(workspace, []); config.model = 'fixture';
  config.features = { tasks: false, subagents: false, crossSessionMessaging: true, residentForks: true };
  config.configSources = { userDir: path.join(workspace, 'user') };
  fs.mkdirSync(config.configSources.userDir!);
  const parent = Session.open(workspace, { config });
  parent.append({ kind: 'message', message: { role: 'user', content: 'old seed' } });
  parent.append({ kind: 'message', message: { role: 'assistant', content: 'old answer' } });
  parent.append({ kind: 'turn_end', reason: 'end_turn' });
  const before = fs.readFileSync(parent.file);
  try {
    assert.equal(parseSettings({ features: { residentForks: true } }).features?.residentForks, true);
    assert.equal(managedPolicySchema.parse({ features: { residentForks: false } }).features?.residentForks, false);
    assert.throws(() => parseSettings({ features: { residentForks: 'true' } }));
    assert.equal(configSchema.parse(parent.config).features?.residentForks, true);
    const old = parent.snapshotConfig(); delete old.features!.residentForks;
    assert.equal(Object.hasOwn(configSchema.parse(old).features!, 'residentForks'), false);
    fs.mkdirSync(path.join(workspace, '.harness'), { recursive: true });
    fs.writeFileSync(path.join(workspace, '.harness/settings.json'), JSON.stringify({ features: { residentForks: false } }));
    assert.equal(reloadConfig(parent.config).features?.residentForks, false);
    fs.writeFileSync(path.join(workspace, '.harness/settings.json'), '{}');
    assert.equal(Object.hasOwn(reloadConfig(parent.config).features!, 'residentForks'), false);
    for (const prompt of ['', '--help is task text']) {
      const worker = new Worker(); let args: readonly string[] = [], stdio: unknown;
      const spawnProcess = ((_command, argv, options) => {
        args = argv ?? []; stdio = options?.stdio; return worker;
      }) as typeof spawn;
      const copy = startBackgroundSession({ session: parent, mode: 'fork', prompt,
        entry: '/owned/cli.js', execArgv: [], spawnProcess });
      let ready = false; void copy.ready!.then(() => { ready = true; });
      worker.emit('message', { type: 'resident_ready', sessionId: parent.id });
      await delay(0); assert.equal(ready, false);
      worker.emit('message', { type: 'resident_ready', sessionId: copy.sessionId });
      await copy.ready;
      assert.equal(worker.connected, false);
      assert.deepEqual(args, ['/owned/cli.js', '--resume', copy.sessionId, '--resident-worker',
        ...(prompt === '' ? [] : ['--', prompt])]);
      assert.equal(Array.isArray(stdio) && stdio[3], 'ipc');
      const opened = Session.open(workspace, { id: copy.sessionId });
      assert.deepEqual(opened.messages, parent.messages); opened.close();
    }
    const failedWorker = new Worker(), controller = new AbortController();
    const failed = startBackgroundSession({ session: parent, mode: 'fork', prompt: '', signal: controller.signal,
      spawnProcess: (() => failedWorker) as typeof spawn });
    assert.ok(failed.ready);
    controller.abort(); await assert.rejects(failed.ready, /startup interrupted/);
    assert.equal(failedWorker.signalCode, 'SIGTERM');
    assert.equal(failedWorker.listenerCount('message'), 0);
    assert.equal(failedWorker.listenerCount('exit'), 0);
    parent.config.features!.crossSessionMessaging = false;
    assert.throws(() => startBackgroundSession({ session: parent, mode: 'fork', prompt: '' }), /require crossSessionMessaging/);
    assert.deepEqual(fs.readFileSync(parent.file), before);
  } finally { parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('resident mounts its peer tools before SessionStart and processes exact admitted text once', async () => {
  const workspace = temporary();
  const runtimeRoot = fs.realpathSync(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'rf-')));
  const previousRuntime = process.env.XDG_RUNTIME_DIR; process.env.XDG_RUNTIME_DIR = runtimeRoot;
  const userDir = path.join(workspace, 'user'); fs.mkdirSync(userDir);
  const config = defaultConfig(workspace, []); config.model = 'fixture'; config.automaticCheckpoints = false;
  config.permissions = { mode: 'bypass', allow: [], deny: [] };
  config.features = { tasks: false, subagents: false, crossSessionMessaging: true, residentForks: true };
  config.configSources = { userDir };
  const controller = new AbortController(), out = output(), status = output();
  const received: string[] = [];
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    const content = request.messages.at(-1)?.content;
    received.push(typeof content === 'string' ? content : JSON.stringify(content));
    return reply('done');
  } };
  const mcpMethods: string[] = [];
  const mcp = http.createServer((request, response) => {
    if (request.method !== 'POST') { response.writeHead(405).end(); return; }
    const chunks: Buffer[] = [];
    request.on('data', chunk => chunks.push(Buffer.from(chunk)));
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      mcpMethods.push(body.method);
      if (body.id === undefined) { response.writeHead(202).end(); return; }
      const result = body.method === 'initialize' ? { protocolVersion: '2025-06-18', capabilities: { tools: {} } }
        : body.method === 'tools/list' ? { tools: [{ name: 'ping', inputSchema: { type: 'object', properties: {} } }] } : {};
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
    });
  });
  await new Promise<void>(resolve => mcp.listen(0, '127.0.0.1', resolve));
  const mcpAddress = mcp.address(); assert.ok(mcpAddress && typeof mcpAddress !== 'string');
  config.mcpServers = { owned: { type: 'http', url: `http://127.0.0.1:${mcpAddress.port}/mcp` } };
  const runtime = await createRuntime(config, provider, controller.signal);
  config.tools = pinToolSchemas(runtime.tools);
  const session = Session.open(workspace, { config });
  let sender: LocalPeerTransport | undefined, loop: Promise<void> | undefined;
  try {
    let ready = false;
    loop = interactiveLoop(session, provider, runtime, { input: Readable.from([]), output: out.stream,
      status: status.stream, signal: controller.signal, sessionStart: 'resume',
      residentWorker: { initialTask: 'explicit initial task', ready: () => { ready = true; } } });
    await until(() => ready && received.length === 1);
    assert.equal(received[0], 'explicit initial task');
    assert.ok(mcpMethods.includes('initialize') && mcpMethods.includes('tools/list'));
    sender = await createLocalPeerTransport({ userDir, workspace, name: 'sender',
      mode: () => ({ mode: 'bypass' }), onEvent() {} });
    const peer = (await sender.list()).find(row => row.kind === 'bg');
    assert.ok(peer);
    const address = peer.address;
    const target = path.join(workspace, 'relocated'); fs.mkdirSync(target);
    assert.throws(() => relocateSession(session, target, next => runtime.buildTools(next, 'relocation')), /pinned configuration changed/);
    const liveToolExtensions = createLocalPeerTools(sender);
    const copied = forkSession(session); copied.close();
    const copy = Session.open(workspace, { id: copied.id });
    const resumedRuntime = await createRuntime(copy.config, provider, controller.signal);
    try {
      await resumedRuntime.bindSession?.(copy);
      assert.ok(copy.config.tools.some(tool => tool.name === 'mcp__owned__ping'));
    } finally { await resumedRuntime.close(); copy.close(); }
    const changedConfig = session.snapshotConfig();
    const changedPeer = changedConfig.tools.find(tool => tool.name === 'list_peers'); assert.ok(changedPeer);
    changedPeer.description = 'changed schema';
    const changed = Session.open(workspace, { config: changedConfig });
    const changedRuntime = await createRuntime(changed.config, provider, controller.signal);
    try { await assert.rejects(() => changedRuntime.bindSession!(changed), /Session tool schemas changed/); }
    finally { await changedRuntime.close(); changed.close(); }
    const relocated = relocateSession(session, target, next => runtime.buildTools(next, 'relocation'), { liveToolExtensions });
    relocated.close();
    const originalSystem = session.config.system; session.config.system = 'untracked mutation';
    assert.throws(() => relocateSession(session, target, next => runtime.buildTools(next, 'relocation'),
      { liveToolExtensions }), /pinned configuration changed/);
    session.config.system = originalSystem;
    await sender.send(address, '/exit is exact peer data');
    try { await until(() => received.length === 2 && status.text().includes('event finished: end_turn')); }
    catch (error) { throw new Error(`${String(error)}\n${status.text()}\n${JSON.stringify(received)}`); }
    assert.match(received[1]!, /\/exit is exact peer data/);
    assert.equal(fs.existsSync(`${session.file}.lock`), true);
    await delay(30); assert.equal(received.length, 2);
    controller.abort(); await loop;
    assert.equal(fs.existsSync(`${session.file}.lock`), false);
    assert.equal(fs.existsSync(peer.address.slice(4)), false);
  } finally {
    controller.abort(); await loop; await sender?.close(); await runtime.close(); session.close();
    mcp.closeAllConnections(); await new Promise<void>(resolve => mcp.close(() => resolve()));
    if (previousRuntime === undefined) delete process.env.XDG_RUNTIME_DIR; else process.env.XDG_RUNTIME_DIR = previousRuntime;
    fs.rmSync(workspace, { recursive: true, force: true }); fs.rmSync(runtimeRoot, { recursive: true, force: true });
  }
});

test('closed human input never approves held resident messages or permission requests', async () => {
  const workspace = temporary();
  const runtimeRoot = fs.realpathSync(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'rf-')));
  const previousRuntime = process.env.XDG_RUNTIME_DIR; process.env.XDG_RUNTIME_DIR = runtimeRoot;
  const userDir = path.join(workspace, 'user'); fs.mkdirSync(userDir);
  const config = defaultConfig(workspace, []); config.model = 'fixture'; config.automaticCheckpoints = false;
  config.permissions = { mode: 'ask', allow: [], deny: [] };
  const rewriteFlag = path.join(workspace, 'rewrite-flag');
  const hookAnswer = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: {
    behavior: 'allow', updatedInput: { path: 'rewritten.txt', content: 'effect' },
  } } });
  config.hooks = { PermissionRequest: [{ matcher: 'write_file', command: `if test -e '${rewriteFlag}'; then printf '%s' '${hookAnswer}'; fi` }] };
  config.features = { tasks: false, subagents: false, crossSessionMessaging: true, residentForks: true };
  config.configSources = { userDir };
  const session = Session.open(workspace, { config });
  const controller = new AbortController(), out = output(), status = output();
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    calls++;
    return calls % 2 === 1 ? { ...reply(''), content: [{ type: 'tool_use', id: 'denied-write', name: 'write_file',
      input: { path: 'must-stay-absent.txt', content: 'effect' }, caller: { type: 'direct' } }], stop_reason: 'tool_use' }
      : reply('done');
  } };
  const runtime = await createRuntime(config, provider, controller.signal);
  let sender: LocalPeerTransport | undefined, loop: Promise<void> | undefined;
  try {
    let ready = false;
    loop = interactiveLoop(session, provider, runtime, { input: new PassThrough(), output: out.stream,
      status: status.stream, signal: controller.signal, residentWorker: { ready: () => { ready = true; } } });
    await until(() => ready);
    sender = await createLocalPeerTransport({ userDir, workspace, name: 'sender', mode: () => ({ mode: 'bypass' }), onEvent() {} });
    const peer = (await sender.list()).find(row => row.kind === 'bg'); assert.ok(peer);
    await sender.send(peer.address, 'held because modes differ');
    await until(() => status.text().includes('held for approval'));
    assert.equal(calls, 0);
    session.config.crossSessionInbound = 'accept';
    await sender.send(peer.address, 'explicitly admitted task');
    await until(() => calls === 2 && status.text().includes('event finished: end_turn'));
    assert.equal(fs.existsSync(path.join(workspace, 'must-stay-absent.txt')), false);
    const result = session.events.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'denied-write');
    assert.ok(result?.kind === 'tool_result' && result.result.is_error);
    assert.equal(calls, 2);

    session.adoptPermissionUpdates([{ type: 'addRules', rules: [{ toolName: 'write_file' }], behavior: 'ask', destination: 'session' }]);
    fs.writeFileSync(rewriteFlag, 'rewrite');
    await sender.send(peer.address, 'rewritten permission request');
    try { await until(() => calls === 4 && session.events.filter(event => event.kind === 'tool_result' && event.result.tool_use_id === 'denied-write').length === 2); }
    catch (error) { throw new Error(`${String(error)} calls=${calls}\n${status.text()}\n${JSON.stringify(session.events.filter(event => event.kind === 'tool_result' || event.kind === 'hook_start'))}`); }
    const rewritten = session.events.filter(event => event.kind === 'tool_result' && event.result.tool_use_id === 'denied-write').at(-1);
    assert.ok(rewritten?.kind === 'tool_result' && rewritten.result.is_error);
    assert.match(String(rewritten.result.content), /requires approval by permission rule/);
    assert.equal(fs.existsSync(path.join(workspace, 'must-stay-absent.txt')), false);
    assert.equal(fs.existsSync(path.join(workspace, 'rewritten.txt')), false);
    assert.equal(session.events.filter(event => event.kind === 'hook_start' && event.event === 'PermissionRequest').length, 2);
    controller.abort(); await loop;
    assert.equal(fs.existsSync(`${session.file}.lock`), false);
  } finally {
    controller.abort(); await loop; await sender?.close(); await runtime.close(); session.close();
    if (previousRuntime === undefined) delete process.env.XDG_RUNTIME_DIR; else process.env.XDG_RUNTIME_DIR = previousRuntime;
    fs.rmSync(workspace, { recursive: true, force: true }); fs.rmSync(runtimeRoot, { recursive: true, force: true });
  }
});
