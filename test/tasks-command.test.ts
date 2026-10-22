import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { defaultConfig } from '../src/agent.js';
import { interactiveLoop } from '../src/interactive.js';
import type { ModelProvider } from '../src/provider.js';
import type { McpClientRequests } from '../src/mcp-client-requests.js';
import { Session } from '../src/session.js';
import type { TerminalCallbacks, TerminalPromptRequest, TerminalSurface } from '../src/terminal.js';
import { TuiTerminal } from '../src/tui.js';

import { backgroundFooterLabel } from '../src/tui-background.js';
import type { Terminal } from '@xterm/headless';
import type { BackgroundTaskSnapshot } from '../src/tasks-panel.js';

const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };

test('/tasks lists live background work and stops the focused row with x', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-tasks-panel-')));
  const config = { ...defaultConfig(workspace, []), model: 'test' };
  const provider: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('Unexpected model call'); } };
  const session = Session.open(workspace, { config });
  const watcher = (() => { let value = ''; return { stream: new Writable({
    write(chunk, _encoding, done) { value += String(chunk); done(); } }), value: () => value }; })();
  let callbacks: TerminalCallbacks | undefined;
  const requests: TerminalPromptRequest[] = [];
  const stopped: string[] = [];
  let jobs = [{ id: 'job-1', kind: 'run', state: 'running', command: 'npm test', description: 'Run the suite' }];
  let answered!: () => void;
  const settled = new Promise<void>(resolve => { answered = resolve; });
  const terminal: TerminalSurface = {
    isTTY: true, outputStream: watcher.stream,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { queueMicrotask(() => callbacks!.onSubmit!('/tasks')); },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    async prompt(request) {
      requests.push(request);
      if (requests.length === 1) return { selected: ['task:shell:job-1'], key: 'x' };
      setImmediate(answered);
      return undefined;
    },
  };
  const runtime = {
    tools: [], buildTools: () => [], close: async () => {}, limits: [],
    backgroundTasks: () => ({ jobs, agents: [], crons: [] }),
    stopTask: async (_owner: string, id: string) => { stopped.push(id); jobs = []; return 'shell' as const; },
  };
  const input = new PassThrough();
  try {
    const loop = interactiveLoop(session, provider, runtime,
      { input, output: watcher.stream, status: watcher.stream, signal: new AbortController().signal, terminal });
    await settled;
    assert.equal(requests.length, 2);
    assert.equal(requests[0]!.title, 'Background');
    assert.equal(requests[0]!.message, '1 active shell');
    assert.equal(requests[0]!.choices?.[0]!.label, 'npm test');
    assert.equal(requests[0]!.choices?.[0]!.description, 'shell · running · Run the suite');
    assert.deepEqual(requests[0]!.keys?.map(entry => entry.key), ['x']);
    assert.deepEqual(stopped, ['job-1']);
    assert.equal(requests[1]!.message, 'No tasks currently running');
    callbacks!.onExit!();
    await loop;
  } finally {
    session.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('background notifications repaint only the current session and unsubscribe on exit', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-background-footer-')));
  const userDir = path.join(workspace, 'user'); fs.mkdirSync(userDir);
  const config = { ...defaultConfig(workspace, []), model: 'test', configSources: { userDir }, watchConfig: false };
  const provider: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('Unexpected model call'); } };
  const session = Session.open(workspace, { config });
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  let callbacks: TerminalCallbacks = {}, currentOwner = session.id;
  let probe: (() => BackgroundTaskSnapshot) | undefined;
  const labels: (string | undefined)[] = [];
  const listeners = new Set<(owner: string) => void>();
  const snapshots = new Map<string, BackgroundTaskSnapshot>([[session.id, {
    jobs: [{ id: 'job', kind: 'run', state: 'running', command: 'sleep 60', description: '' }], agents: [], crons: [],
  }]]);
  const empty: BackgroundTaskSnapshot = { jobs: [], agents: [], crons: [] };
  const terminal: TerminalSurface = {
    isTTY: true, outputStream: output,
    subscribe(value) { callbacks = value; return () => { callbacks = {}; }; },
    start() {}, close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    bindStatusLine(value) { currentOwner = value.id; },
    bindBackgroundWork(_count, _stop, tasks) { probe = tasks; },
    backgroundWorkChanged() { labels.push(backgroundFooterLabel(probe!())); },
  };
  const runtime = {
    tools: [], buildTools: () => [], close: async () => {}, limits: [],
    subscribe(listener: (owner: string) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    backgroundTasks: (owner: string) => snapshots.get(owner) ?? empty,
    releaseSession: async (owner: string) => { snapshots.delete(owner); },
  };
  const notify = (owner: string) => { for (const listener of listeners) listener(owner); };
  const controller = new AbortController();
  const loop = interactiveLoop(session, provider, runtime, { input: new PassThrough(), output, status: output,
    signal: controller.signal, terminal });
  const until = async (predicate: () => boolean) => {
    const end = Date.now() + 5_000;
    while (!predicate()) { assert.ok(Date.now() < end, 'interactive state settled'); await delay(10); }
  };
  try {
    await until(() => listeners.size === 1);
    notify('another-owner'); assert.equal(labels.length, 0);
    notify(session.id); assert.deepEqual(labels, ['1 shell']);
    snapshots.set(session.id, empty); notify(session.id);
    assert.deepEqual(labels, ['1 shell', undefined]);
    callbacks.onSubmit!('/clear');
    await until(() => currentOwner !== session.id && listeners.size === 1);
    assert.equal(backgroundFooterLabel(probe!()), undefined);
    const before = labels.length;
    notify(session.id); assert.equal(labels.length, before, 'old owner cannot repaint the successor');
    snapshots.set(currentOwner, { ...empty, agents: [{ id: 'child', status: 'running' }] });
    notify(currentOwner); assert.equal(labels.at(-1), '1 local agent');
    callbacks.onExit!(); await loop;
    assert.equal(listeners.size, 0);
  } finally {
    controller.abort(); await loop; session.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('a footer click opens Background during a held turn without replacing its owner', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
    ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'harness-live-task-click-')));
  const userDir = path.join(workspace, 'user'); fs.mkdirSync(userDir);
  const config = { ...defaultConfig(workspace, []), model: 'test', configSources: { userDir }, watchConfig: false };
  const session = Session.open(workspace, { config });
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode() {} });
  const screen = new HeadlessTerminal({ cols: 120, rows: 30, allowProposedApi: true, logLevel: 'off' });
  const output = new Writable({ write(chunk, _encoding, done) {
    Reflect.apply(Reflect.get(Reflect.get(screen, '_core'), 'writeSync'), Reflect.get(screen, '_core'), [String(chunk)]); done();
  } });
  Object.assign(output, { isTTY: true, columns: 120, rows: 30 });
  const tui = new TuiTerminal({ input, output, prefersReducedMotion: true, userDir });
  const frame = () => Array.from({ length: 30 }, (_, row) => screen.buffer.active.getLine(row)?.translateToString(true) ?? '').join('\n');
  const key = (text: string) => input.emit('data', text);
  let modelSignal: AbortSignal | undefined;
  let release: (() => void) | undefined;
  const provider: ModelProvider = { count: async () => 0, complete: async (_request, signal) => {
    modelSignal = signal;
    await new Promise<void>(resolve => { release = resolve; });
    return { id: 'fixture', model: 'test', type: 'message', role: 'assistant',
      content: [{ type: 'text', text: 'done', citations: null }], container: null, diagnostics: null,
      stop_details: null, stop_reason: 'end_turn', stop_sequence: null, usage: {
        input_tokens: 1, output_tokens: 1, cache_creation: null, cache_creation_input_tokens: null,
        cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null,
        server_tool_use: null, service_tier: null,
      } };
  } };
  let jobs = [{ id: 'job', kind: 'run', state: 'running', command: 'owned shell', description: '' }];
  const stopped: string[] = [];
  const listeners = new Set<(owner: string) => void>();
  let elicitation: NonNullable<McpClientRequests['elicitation']> | undefined;
  const runtime = {
    tools: [], buildTools: () => [], close: async () => {}, limits: [],
    registerElicitation(_owner: string, callback: NonNullable<McpClientRequests['elicitation']>) {
      elicitation = callback; return () => { elicitation = undefined; };
    },
    subscribe(listener: (owner: string) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    backgroundWorkCount: () => jobs.length,
    backgroundTasks: () => ({ jobs, agents: [], crons: [] }),
    stopTask: async (_owner: string, id: string) => {
      stopped.push(id); jobs = []; for (const listener of listeners) listener(session.id); return 'shell' as const;
    },
  };
  const controller = new AbortController();
  const loop = interactiveLoop(session, provider, runtime, { input, output, status: tui.statusStream,
    signal: controller.signal, terminal: tui });
  const until = async (check: () => boolean) => {
    const end = Date.now() + 5_000;
    while (!check()) { assert.ok(Date.now() < end, frame()); await delay(10); }
  };
  const click = () => {
    const footer = screen.buffer.active.getLine(29)?.translateToString(true) ?? '';
    const column = footer.indexOf('1 shell') + 1; assert.ok(column > 0, footer);
    key(`\x1b[<0;${column};30M\x1b[<0;${column};30m`);
  };
  try {
    await until(() => listeners.size === 1 && frame().includes('1 shell'));
    key('hold request\r'); await until(() => release !== undefined);
    key('retained draft'); click();
    await until(() => tui.currentScreen === 'dialog' && frame().includes('1 active shell'));
    assert.equal(modelSignal?.aborted, false);
    key('\x03'); await until(() => tui.currentScreen === 'chat');
    await delay(0);
    assert.equal(modelSignal?.aborted, false);
    assert.equal(tui.state.text, 'retained draft');
    key('\x1b[B\r'); await until(() => tui.currentScreen === 'dialog');
    assert.equal(modelSignal?.aborted, false);
    assert.ok(elicitation);
    const form = elicitation({ mode: 'form', message: 'Choose a local label', requestedSchema: {
      type: 'object', properties: { label: { type: 'string' } }, required: ['label'],
    } }, controller.signal, { serverName: 'fixture', requestId: 'background-form' });
    await until(() => frame().includes('MCP form from fixture') && !frame().includes('1 active shell'));
    key('{"label":"chosen"}\r');
    assert.deepEqual(await form, { action: 'accept', content: { label: 'chosen' } });
    assert.equal(modelSignal?.aborted, false);
    assert.equal(tui.state.text, 'retained draft');
    await delay(0);
    click(); await until(() => tui.currentScreen === 'dialog');
    key('x'); await until(() => frame().includes('No tasks currently running'));
    assert.deepEqual(stopped, ['job']);
    assert.equal(modelSignal?.aborted, false);
    key('\x03'); await until(() => tui.currentScreen === 'chat');
    assert.equal(tui.state.text, 'retained draft');
    release!(); await until(() => frame().includes('done') && !session.awaitingResponse);
    key('\x15/exit\r'); await loop;
    assert.equal(listeners.size, 0);
  } finally {
    release?.(); controller.abort(); await loop; tui.close(); screen.dispose(); session.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
