import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { defaultConfig } from '../src/agent.js';
import { interactiveLoop } from '../src/interactive.js';
import type { ModelProvider } from '../src/provider.js';
import { Session } from '../src/session.js';
import type { TerminalCallbacks, TerminalPromptRequest, TerminalSurface } from '../src/terminal.js';

import { backgroundFooterLabel } from '../src/tui-background.js';
import type { BackgroundTaskSnapshot } from '../src/tasks-panel.js';
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
