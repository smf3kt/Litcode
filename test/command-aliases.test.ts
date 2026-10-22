import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { PassThrough, Writable } from 'node:stream';
import { defaultConfig } from '../src/agent.js';
import { COMMAND_ALIASES, canonicalCommand, interactiveLoop } from '../src/interactive.js';
import type { ModelProvider } from '../src/provider.js';
import { Session } from '../src/session.js';
import type { TerminalCallbacks, TerminalSurface } from '../src/terminal.js';

async function drive(commands: readonly string[]) {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-alias-')));
  const config = { ...defaultConfig(workspace, []), model: 'test' };
  const provider: ModelProvider = {
    count: async () => 0,
    complete: async () => { throw new Error('no completion in this fixture'); },
  };
  const session = Session.open(workspace, { config });
  const chunks: string[] = [];
  const watcher = new Writable({ write(chunk, _encoding, done) { chunks.push(String(chunk)); done(); } });
  let callbacks: TerminalCallbacks | undefined;
  const queue = [...commands];
  const input = new PassThrough();
  const surface: TerminalSurface = {
    isTTY: true, outputStream: watcher,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() {
      const next = () => {
        const command = queue.shift();
        if (command === undefined) { setImmediate(() => callbacks?.onExit?.()); return; }
        queueMicrotask(() => callbacks!.onSubmit!(command));
        setTimeout(next, 30);
      };
      next();
    },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    async prompt() { return undefined; },
  };
  const runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [] };
  try {
    await interactiveLoop(session, provider, runtime,
      { input, output: watcher, status: watcher, signal: new AbortController().signal, terminal: surface });
    return { session, text: chunks.join(''), workspace };
  } finally {
    session.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
}

test('the recovered alias table maps every taken name', () => {
  assert.deepEqual(COMMAND_ALIASES, {
    name: 'rename', bashes: 'tasks', 'allowed-tools': 'permissions', quit: 'exit',
    reset: 'clear', new: 'clear', undo: 'rewind',
  });
  assert.equal(canonicalCommand('bashes'), 'tasks');
  assert.equal(canonicalCommand('tasks'), 'tasks');
  assert.equal(canonicalCommand('toString'), 'toString');
});

test('a typed alias reaches its canonical command', async () => {
  const run = await drive(['/name Alias title', '/quit']);
  assert.ok(run.text.includes('Session title: Alias title'), run.text);
  assert.equal(run.session.events.filter(event => event.kind === 'title').length, 1);
});

test('an alias argument reaches the canonical argument parser', async () => {
  const run = await drive(['/undo']);
  assert.ok(run.text.includes('error: Use /rewind N with a completed turn number'), run.text);
});

test('/quit closes the session instead of reaching the model', async () => {
  const run = await drive(['/quit']);
  assert.equal(run.text.includes('no completion in this fixture'), false);
});
