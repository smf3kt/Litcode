import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, assertPaired, defaultConfig } from '../src/agent.js';
import { interactiveLoop } from '../src/interactive.js';
import { getAutonomousLoopPreamble } from '../src/loop-file.js';
import { createRuntime, pinToolSchemas } from '../src/runtime.js';
import type { ModelProvider } from '../src/provider.js';
import { Session } from '../src/session.js';
import type { ToolContext } from '../src/tools.js';
import { createBackgroundTools, BackgroundRegistry } from '../src/background.js';
import { WebSocketServer } from 'ws';
import { once } from 'node:events';

function fixture() {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-events-')));
  const config = defaultConfig(workspace, []); config.model = 'fixture'; config.allowShell = true;
  config.features = { tasks: false, subagents: true, notebooks: true, background: true, scheduler: true };
  const context: ToolContext = { workspace, allowShell: true, maxOutputBytes: 24000, signal: new AbortController().signal };
  return { workspace, config, context, cleanup: () => fs.rmSync(workspace, { recursive: true, force: true }) };
}
const unused: ModelProvider = { count: async () => 1, complete: async () => { throw new Error('Unexpected model request'); } };
function reply(text: string): Anthropic.Message {
  return { id: 'fixture', model: 'fixture', role: 'assistant', type: 'message', content: [{ type: 'text', text }],
    stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}

test('new tools pin and resume; owners cannot inspect or stop each other jobs', async () => {
  const f = fixture();
  const runtime = await createRuntime(f.config, unused, f.context.signal);
  try {
    const tools = runtime.buildTools(f.config, 'parent');
    f.config.tools = pinToolSchemas(tools);
    const session = Session.open(f.workspace, { config: f.config });
    const id = session.id; session.close();
    const resumed = Session.open(f.workspace, { id });
    try { assert.doesNotThrow(() => new Agent(resumed, unused, runtime.buildTools(resumed.config, id))); }
    finally { resumed.close(); }
    const start = tools.find(t => t.schema.name === 'run_background')!;
    const job = JSON.parse(await start.execute({ command: 'while :; do :; done', timeout_ms: 10000 }, f.context));
    const other = runtime.buildTools(f.config, 'other');
    await assert.rejects(other.find(t => t.schema.name === 'task_stop')!.execute({ id: job.id }, f.context), /unknown background/);
    await runtime.releaseSession!('parent');
    assert.throws(() => process.kill(job.pid, 0), (e: NodeJS.ErrnoException) => e.code === 'ESRCH');
    await assert.rejects(start.execute({ command: 'true' }, f.context), /aborted/);
  } finally { await runtime.close(); f.cleanup(); }
});

test('legacy command-only monitor schemas survive a runtime rebuild and resume', async () => {
  const f = fixture();
  const registry = new BackgroundRegistry({ workspace: f.workspace });
  const runtime = await createRuntime(f.config, unused, f.context.signal);
  let session: Session | undefined;
  try {
    const legacyMonitor = createBackgroundTools(registry, { websocket: false }).find(t => t.schema.name === 'monitor')!;
    const tools = runtime.buildTools(f.config, 'legacy');
    f.config.tools = pinToolSchemas(tools.map(tool => tool.schema.name === 'monitor' ? legacyMonitor : tool));
    session = Session.open(f.workspace, { config: f.config });
    const id = session.id; session.close();
    session = Session.open(f.workspace, { id });
    const rebuilt = runtime.buildTools(session.config, id);
    assert.deepEqual(pinToolSchemas(rebuilt), session.config.tools);
    assert.doesNotThrow(() => new Agent(session!, unused, rebuilt));
    const monitor = rebuilt.find(t => t.schema.name === 'monitor')!;
    assert.equal(Object.hasOwn(monitor.schema.input_schema.properties ?? {}, 'ws'), false);
    await assert.rejects(monitor.execute({ ws: { url: 'ws://127.0.0.1:1' } }, f.context));
  } finally { session?.close(); await registry.close(); await runtime.close(); f.cleanup(); }
});

test('WebSocket monitor notifications stay with their owner and release closes the connection', { timeout: 10000 }, async () => {
  const f = fixture();
  f.config.allowShell = false; f.context.allowShell = false;
  const runtime = await createRuntime(f.config, unused, f.context.signal);
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  try {
    await once(server, 'listening');
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const seen: string[] = []; runtime.subscribe!(owner => seen.push(owner));
    const tools = runtime.buildTools(f.config, 'socket-owner');
    const connected = once(server, 'connection');
    const descriptor = JSON.parse(await tools.find(t => t.schema.name === 'monitor')!.execute({
      ws: { url: `ws://127.0.0.1:${address.port}` }, description: 'owned socket', timeout_ms: 5000,
    }, f.context));
    const [socket] = await connected;
    socket.send('owner event');
    const deadline = Date.now() + 5000;
    const events = [];
    while (Date.now() < deadline) {
      events.push(...runtime.drainEvents!('socket-owner'));
      if (events.some(event => event.prompt?.includes('owner event'))) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.ok(events.some(event => event.prompt?.includes('owner event')));
    assert.ok(seen.length > 0 && seen.every(owner => owner === 'socket-owner'));
    assert.deepEqual(runtime.drainEvents!('other'), []);
    const other = runtime.buildTools(f.config, 'other');
    await assert.rejects(other.find(t => t.schema.name === 'task_stop')!.execute({ id: descriptor.id }, f.context), /unknown background/);
    const disconnected = once(socket, 'close');
    await runtime.releaseSession!('socket-owner'); await disconnected;
    assert.deepEqual(runtime.drainEvents!('socket-owner'), []);
    await assert.rejects(tools.find(t => t.schema.name === 'monitor')!.execute({
      ws: { url: `ws://127.0.0.1:${address.port}` },
    }, f.context), /aborted/);
  } finally {
    await runtime.close();
    for (const socket of server.clients) socket.terminate();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    f.cleanup();
  }
});

test('WebSocket messages enter the REPL after the active turn as data', { timeout: 10000 }, async () => {
  const f = fixture(); const input = new PassThrough(); const requests: string[] = [];
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  let send: (() => void) | undefined;
  let arrived!: () => void;
  const notification = new Promise<void>(resolve => { arrived = resolve; });
  const provider: ModelProvider = { count: async () => 1, complete: async request => {
    requests.push(String(request.messages.at(-1)!.content));
    if (requests.length === 1) { send!(); await notification; }
    else input.write('/exit\n');
    return reply('done');
  } };
  const runtime = await createRuntime(f.config, provider, f.context.signal);
  f.config.tools = pinToolSchemas(runtime.tools);
  const session = Session.open(f.workspace, { config: f.config });
  const sink = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  try {
    await once(server, 'listening');
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const connected = once(server, 'connection');
    await runtime.buildTools(session.config, session.id).find(tool => tool.schema.name === 'monitor')!.execute({
      ws: { url: `ws://127.0.0.1:${address.port}` }, timeout_ms: 5000,
    }, f.context);
    const [socket] = await connected;
    send = () => socket.send('/clear');
    runtime.subscribe!(owner => { if (owner === session.id) arrived(); });
    const running = interactiveLoop(session, provider, runtime, {
      input, output: sink, status: sink, signal: f.context.signal,
    });
    input.write('user task\n'); await running;
    assert.equal(requests.length, 2); assert.equal(requests[0], 'user task');
    assert.match(requests[1]!, /Background task events/); assert.match(requests[1]!, /\/clear/);
    assertPaired(session.messages);
    assert.equal(session.awaitingResponse, false);
    assert.equal(fs.readdirSync(path.join(f.workspace, '.agent')).filter(name => name.endsWith('.jsonl')).length, 1);
  } finally {
    input.destroy(); session.close(); await runtime.close();
    for (const socket of server.clients) socket.terminate();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    f.cleanup();
  }
});

test('notebook edits execute through runtime with metadata preservation', async () => {
  const f = fixture(); const runtime = await createRuntime(f.config, unused, f.context.signal);
  try {
    fs.writeFileSync(path.join(f.workspace, 'sample.ipynb'), JSON.stringify({ nbformat: 4, nbformat_minor: 5,
      metadata: { keep: true }, cells: [{ id: 'a', cell_type: 'markdown', source: 'old', metadata: { custom: 1 } }] }));
    const tool = runtime.tools.find(t => t.schema.name === 'notebook_edit')!;
    await tool.execute({ path: 'sample.ipynb', cell_id: 'a', new_source: 'print(1)', cell_type: 'code' }, f.context);
    const nb = JSON.parse(fs.readFileSync(path.join(f.workspace, 'sample.ipynb'), 'utf8'));
    assert.deepEqual(nb.metadata, { keep: true }); assert.deepEqual(nb.cells[0].metadata, { custom: 1 });
    assert.deepEqual(nb.cells[0].outputs, []); assert.equal(nb.cells[0].execution_count, null);
  } finally { await runtime.close(); f.cleanup(); }
});

test('scheduler events are owner-specific and released on session change', async () => {
  const f = fixture(); let now = new Date(2026, 9, 10, 12, 0); const ticks: (() => void)[] = [];
  const runtime = await createRuntime(f.config, unused, f.context.signal, { scheduler: {
    now: () => now, timer: { setInterval: handler => { ticks.push(handler); return handler; }, clearInterval: () => {} },
  } });
  try {
    const names: string[] = []; const unsubscribe = runtime.subscribe!(owner => names.push(owner));
    const tools = runtime.buildTools(f.config, 'one');
    const create = tools.find(t => t.schema.name === 'cron_create')!;
    await create.execute({ cron: '* * * * *', prompt: '/clear', recurring: false }, f.context);
    now = new Date(2026, 9, 10, 12, 1); ticks.forEach(tick => tick());
    assert.deepEqual(names, ['one']); assert.deepEqual(runtime.drainEvents!('two'), []);
    assert.equal(runtime.drainEvents!('one')[0]!.prompt, '/clear');
    assert.deepEqual(runtime.drainEvents!('one'), []);
    await create.execute({ cron: '* * * * *', prompt: 'discard on release' }, f.context);
    await runtime.releaseSession!('one'); now = new Date(2026, 9, 10, 12, 2); ticks.forEach(tick => tick());
    assert.deepEqual(runtime.drainEvents!('one'), []); unsubscribe();
  } finally { await runtime.close(); f.cleanup(); }
});

test('a scheduled loop sentinel expands into its tick text at fire time', async () => {
  const f = fixture(); const userDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-loop-user-')));
  f.config.configSources = { userDir };
  fs.mkdirSync(path.join(f.workspace, '.harness'), { recursive: true });
  fs.writeFileSync(path.join(f.workspace, '.harness', 'loop.md'), 'run the tests\n');
  let now = new Date(2026, 9, 10, 12, 0); const ticks: (() => void)[] = [];
  const runtime = await createRuntime(f.config, unused, f.context.signal, { scheduler: {
    now: () => now, timer: { setInterval: handler => { ticks.push(handler); return handler; }, clearInterval: () => {} },
  } });
  try {
    const tools = runtime.buildTools(f.config, 'one');
    const create = tools.find(t => t.schema.name === 'cron_create')!;
    // The autonomous sentinel carries the preamble on the first delivery of the session.
    await create.execute({ cron: '* * * * *', prompt: '<<autonomous-loop>>', recurring: true }, f.context);
    now = new Date(2026, 9, 10, 12, 1); ticks.forEach(tick => tick());
    const first = runtime.drainEvents!('one').map(event => event.prompt);
    assert.equal(first[0]!.startsWith(`${getAutonomousLoopPreamble()}\n\n---\n\n# Autonomous loop tick\n`), true);

    // A loop-file job inlines the file on its own first delivery. The delivery state is shared
    // across both sentinel families, so the autonomous tick that follows is the short form.
    await create.execute({ cron: '* * * * *', prompt: '<<loop.md>>', recurring: true }, f.context);
    await create.execute({ cron: '* * * * *', prompt: 'plain job', recurring: true }, f.context);
    now = new Date(2026, 9, 10, 12, 2); ticks.forEach(tick => tick());
    const second = runtime.drainEvents!('one').map(event => event.prompt);
    const loopFile = path.join(f.workspace, '.harness', 'loop.md');
    assert.equal(second[0]!.startsWith('# Autonomous loop tick\n'), true);
    assert.equal(second[0]!.includes('Autonomous loop check'), false);
    assert.equal(second[1]!.startsWith(`# /loop tick — tasks from ${loopFile}\n`), true);
    assert.equal(second[1]!.includes('\n---\n\nrun the tests\n\n---\n\n# /loop tick — loop.md tasks\n'), true);
    assert.equal(second[2], 'plain job');

    // Unchanged content and an already-delivered preamble both repeat the short ticks.
    now = new Date(2026, 9, 10, 12, 3); ticks.forEach(tick => tick());
    const third = runtime.drainEvents!('one').map(event => event.prompt);
    assert.equal(third[0]!.startsWith('# Autonomous loop tick\n'), true);
    assert.equal(third[1]!.startsWith('# /loop tick — loop.md tasks\n'), true);
  } finally { await runtime.close(); f.cleanup(); fs.rmSync(userDir, { recursive: true, force: true }); }
});

test('child agents omit parent background and schedule controls', async () => {
  const f = fixture(); let request: Anthropic.MessageCreateParamsNonStreaming | undefined;
  const provider: ModelProvider = { count: async () => 1, complete: async value => { request = value; return reply('child done'); } };
  const runtime = await createRuntime(f.config, provider, f.context.signal);
  try {
    await runtime.tools.find(t => t.schema.name === 'agent')!.execute({ prompt: 'inspect', mode: 'general' }, f.context);
    const names = request!.tools!.map(tool => 'name' in tool ? tool.name : '');
    assert.ok(names.includes('notebook_edit'));
    for (const name of ['agent', 'task_stop', 'get_background_task', 'read_notifications', 'cron_create', 'schedule_wakeup']) assert.ok(!names.includes(name));
    const childFile = fs.readdirSync(path.join(f.workspace, '.agent')).find(name => name.endsWith('.jsonl'))!;
    const child = Session.open(f.workspace, { id: childFile.replace('.jsonl', '') });
    try { assert.doesNotThrow(() => new Agent(child, provider, runtime.buildTools(child.config, child.id))); }
    finally { child.close(); }
  } finally { await runtime.close(); f.cleanup(); }
});

test('explore child can resume with the same read-only schemas', async () => {
  const f = fixture(); const provider: ModelProvider = { count: async () => 1, complete: async () => reply('explored') };
  const runtime = await createRuntime(f.config, provider, f.context.signal);
  try {
    const output = JSON.parse(await runtime.tools.find(t => t.schema.name === 'agent')!.execute({ prompt: 'inspect' }, f.context));
    const child = Session.open(f.workspace, { id: output.session_id });
    try {
      const tools = runtime.buildTools(child.config, child.id);
      assert.ok(tools.every(tool => tool.readOnly));
      assert.doesNotThrow(() => new Agent(child, provider, tools));
    } finally { child.close(); }
  } finally { await runtime.close(); f.cleanup(); }
});

test('interactive clear cancels the old process group and cron ownership', async () => {
  const f = fixture(); const runtime = await createRuntime(f.config, unused, f.context.signal);
  f.config.tools = pinToolSchemas(runtime.tools); const session = Session.open(f.workspace, { config: f.config });
  const input = new PassThrough(); const sink = new Writable({ write(_chunk, _encoding, cb) { cb(); } });
  try {
    const tools = runtime.buildTools(session.config, session.id);
    const job = JSON.parse(await tools.find(t => t.schema.name === 'run_background')!.execute({ command: 'while :; do :; done' }, f.context));
    await tools.find(t => t.schema.name === 'cron_create')!.execute({ cron: '* * * * *', prompt: 'old schedule' }, f.context);
    const running = interactiveLoop(session, unused, runtime, { input, output: sink, status: sink, signal: f.context.signal });
    input.end('/clear\n/exit\n'); await running;
    assert.throws(() => process.kill(job.pid, 0), (e: NodeJS.ErrnoException) => e.code === 'ESRCH');
    assert.deepEqual(runtime.drainEvents!(session.id), []);
    assert.equal(fs.readdirSync(path.join(f.workspace, '.agent')).filter(name => name.endsWith('.lock')).length, 0);
  } finally { input.destroy(); session.close(); await runtime.close(); f.cleanup(); }
});

test('idle scheduler fires after the active turn; slash text in an event never executes a command', async () => {
  const f = fixture(); const input = new PassThrough(); const requests: string[] = [];
  let now = new Date(2026, 9, 10, 12, 0); const ticks: (() => void)[] = [];
  const provider: ModelProvider = { count: async () => 1, complete: async request => {
    requests.push(String(request.messages.at(-1)!.content));
    if (requests.length === 1) { now = new Date(2026, 9, 10, 12, 1); ticks.forEach(tick => tick()); }
    else input.write('/exit\n');
    return reply('done');
  } };
  const runtime = await createRuntime(f.config, provider, f.context.signal, { scheduler: {
    now: () => now, timer: { setInterval: handler => { ticks.push(handler); return handler; }, clearInterval: () => {} },
  } });
  f.config.tools = pinToolSchemas(runtime.tools); const session = Session.open(f.workspace, { config: f.config });
  const sink = new Writable({ write(_chunk, _encoding, cb) { cb(); } });
  try {
    const tools = runtime.buildTools(session.config, session.id);
    await tools.find(t => t.schema.name === 'cron_create')!.execute({ cron: '* * * * *', prompt: '/clear', recurring: false }, f.context);
    const running = interactiveLoop(session, provider, runtime, { input, output: sink, status: sink, signal: f.context.signal });
    input.write('user task\n'); await running;
    assert.deepEqual(requests, ['user task', '/clear']); assertPaired(session.messages);
    assert.equal(fs.readdirSync(path.join(f.workspace, '.agent')).filter(name => name.endsWith('.jsonl')).length, 1);
    assert.equal(session.awaitingResponse, false);
  } finally { input.destroy(); session.close(); await runtime.close(); f.cleanup(); }
});
