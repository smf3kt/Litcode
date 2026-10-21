import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { PassThrough, Writable } from 'node:stream';
import { defaultConfig } from '../src/agent.js';
import { interactiveLoop } from '../src/interactive.js';
import type { ModelProvider } from '../src/provider.js';
import { Session } from '../src/session.js';
import type { TerminalCallbacks, TerminalPromptRequest, TerminalSurface } from '../src/terminal.js';

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
