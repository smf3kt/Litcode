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

test('a bare /effort opens the slider once and its skip key keeps the level session-only', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-effort-opener-')));
  const userDir = path.join(workspace, 'user');
  fs.mkdirSync(userDir);
  const config = { ...defaultConfig(workspace, []), model: 'test', configSources: { userDir } };
  const provider: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('Unexpected model call'); } };
  const session = Session.open(workspace, { config });
  const watcher = (() => { let value = ''; return { stream: new Writable({
    write(chunk, _encoding, done) { value += String(chunk); done(); } }), value: () => value }; })();
  let callbacks: TerminalCallbacks | undefined;
  const requests: TerminalPromptRequest[] = [];
  let answered!: () => void;
  const settled = new Promise<void>(resolve => { answered = resolve; });
  const terminal: TerminalSurface = {
    isTTY: true, outputStream: watcher.stream,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { queueMicrotask(() => callbacks!.onSubmit!('/effort')); },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    async prompt(request) {
      requests.push(request);
      setImmediate(answered);
      return { selected: [], adjusted: 'high', key: 's' };
    },
  };
  const input = new PassThrough();
  try {
    const loop = interactiveLoop(session, provider,
      { tools: [], buildTools: () => [], close: async () => {}, limits: [] },
      { input, output: watcher.stream, status: watcher.stream, signal: new AbortController().signal, terminal });
    await settled;
    // The answer belongs to this one dialog. A second opener would consume `key: 's'` itself and
    // turn the skip into a saved default, so the count and the absent store both prove one owner.
    assert.equal(requests.length, 1);
    assert.equal(requests[0]!.title, 'Effort');
    assert.equal(session.config.effort, 'high');
    assert.equal(fs.existsSync(path.join(userDir, 'settings.json')), false);
    callbacks!.onExit!();
    await loop;
    assert.match(watcher.value(), /Set effort level to high \(this session only\)/);
    assert.doesNotMatch(watcher.value(), /Usage: \/effort|Unknown command/);
  } finally {
    session.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});
