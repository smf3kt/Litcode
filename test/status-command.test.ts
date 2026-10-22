import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { PassThrough, Writable } from 'node:stream';
import { defaultConfig } from '../src/agent.js';
import { interactiveLoop } from '../src/interactive.js';
import { DEFAULT_GATEWAY, type ModelProvider } from '../src/provider.js';
import { Session } from '../src/session.js';
import type { TerminalCallbacks, TerminalPromptRequest, TerminalSurface } from '../src/terminal.js';

test('/status opens the local Status tab with the session rows', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-status-')));
  const config = { ...defaultConfig(workspace, []), model: 'test' };
  config.gateway = { ...DEFAULT_GATEWAY, baseURL: 'http://127.0.0.1:9999' };
  const provider: ModelProvider = {
    count: async () => 0,
    complete: async () => { throw new Error('no completion in this fixture'); },
  };
  const session = Session.open(workspace, { config });
  session.append({ kind: 'title', title: 'Fixture session' });
  const watcher = new Writable({ write(_chunk, _encoding, done) { done(); } });
  let callbacks: TerminalCallbacks | undefined;
  const prompts: TerminalPromptRequest[] = [];
  let shown!: () => void;
  const settled = new Promise<void>(resolve => { shown = resolve; });
  const terminal: TerminalSurface = {
    isTTY: true, outputStream: watcher,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { queueMicrotask(() => callbacks!.onSubmit!('/status')); },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    async prompt(request) { prompts.push(request); shown(); return undefined; },
  };
  const runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [] };
  const input = new PassThrough();
  try {
    const loop = interactiveLoop(session, provider, runtime,
      { input, output: watcher, status: watcher, signal: new AbortController().signal, terminal });
    await settled;
    assert.equal(prompts.length, 1);
    assert.equal(prompts[0]!.title, 'Status');
    assert.equal(prompts[0]!.readOnly, true);
    const message = prompts[0]!.message;
    assert.match(message, /^Version: \d+\.\d+\.\d+\nSession name: Fixture session\nSession ID: /);
    assert.match(message, /\nSession kind: interactive\n/);
    assert.match(message, new RegExp(`\\ncwd: ${workspace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n`));
    assert.match(message, /\nModel: test\n/);
    assert.match(message, /\nGateway URL: http:\/\/127\.0\.0\.1:9999$/);
    callbacks!.onExit!();
    await loop;
  } finally {
    session.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});
