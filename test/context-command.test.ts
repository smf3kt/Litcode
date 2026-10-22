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

test('/context opens the recovered grid panel over the live counts', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-context-')));
  const config = { ...defaultConfig(workspace, []), model: 'test' };
  const counted: number[] = [];
  const provider: ModelProvider = {
    count: async request => {
      const size = (request.messages as unknown[]).length;
      counted.push(size);
      return size === 0 ? 1000 : 4000;
    },
    complete: async () => { throw new Error('no completion in this fixture'); },
  };
  const session = Session.open(workspace, { config });
  session.append({ kind: 'message', message: { role: 'user', content: [{ type: 'text', text: 'hi' }] } });
  const watcher = new Writable({ write(_chunk, _encoding, done) { done(); } });
  let callbacks: TerminalCallbacks | undefined;
  const prompts: TerminalPromptRequest[] = [];
  let shown!: () => void;
  const settled = new Promise<void>(resolve => { shown = resolve; });
  const terminal: TerminalSurface = {
    isTTY: true, outputStream: watcher,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { queueMicrotask(() => callbacks!.onSubmit!('/context')); },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    async prompt(request) { prompts.push(request); shown(); return undefined; },
  };
  const runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [] };
  const input = new PassThrough();
  try {
    const loop = interactiveLoop(session, provider, runtime,
      { input, output: watcher, status: watcher, signal: new AbortController().signal, terminal });
    await settled;
    assert.deepEqual(counted, [0, 0, 1]);
    assert.equal(prompts.length, 1);
    assert.equal(prompts[0]!.title, 'Context');
    assert.equal(prompts[0]!.readOnly, true);
    const message = prompts[0]!.message;
    assert.match(message, /^Context Usage\ntest\n4k\/1m tokens \(0%\)/);
    assert.match(message, /⛁ System prompt: 1k tokens \(0\.1%\)/);
    assert.match(message, /⛁ Messages: 3k tokens \(0\.3%\)/);
    assert.match(message, /⛝ Autocompact buffer: 488k tokens \(48\.8%\)/);
    assert.match(message, /⛶ Free space: 508k \(50\.8%\)/);
    callbacks!.onExit!();
    await loop;
  } finally {
    session.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});
