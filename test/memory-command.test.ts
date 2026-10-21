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

test('bare /memory lists the instruction files and opens the selected one in the editor', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-memory-panel-')));
  const userDir = path.join(workspace, 'user');
  fs.mkdirSync(userDir);
  const projectFile = path.join(workspace, 'HARNESS.md');
  fs.writeFileSync(projectFile, '# Project\n');
  const previous = process.env.EDITOR;
  const previousVisual = process.env.VISUAL;
  process.env.EDITOR = 'true';
  process.env.VISUAL = '';
  const config = { ...defaultConfig(workspace, []), model: 'test', configSources: { userDir } };
  const provider: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('Unexpected model call'); } };
  const session = Session.open(workspace, { config });
  const watcher = (() => { let value = ''; return { stream: new Writable({
    write(chunk, _encoding, done) { value += String(chunk); done(); } }), value: () => value }; })();
  let callbacks: TerminalCallbacks | undefined;
  const requests: TerminalPromptRequest[] = [];
  const opened: string[] = [];
  let answered!: () => void;
  const settled = new Promise<void>(resolve => { answered = resolve; });
  const terminal: TerminalSurface = {
    isTTY: true, outputStream: watcher.stream,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { queueMicrotask(() => callbacks!.onSubmit!('/memory')); },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    async prompt(request) {
      requests.push(request);
      setImmediate(answered);
      return { selected: [projectFile] };
    },
    async openFile(file) { opened.push(file); return { content: null }; },
  };
  const input = new PassThrough();
  try {
    const loop = interactiveLoop(session, provider,
      { tools: [], buildTools: () => [], close: async () => {}, limits: [] },
      { input, output: watcher.stream, status: watcher.stream, signal: new AbortController().signal, terminal });
    await settled;
    assert.equal(requests.length, 1);
    assert.equal(requests[0]!.title, 'Memory');
    assert.equal(requests[0]!.message, '');
    assert.deepEqual(requests[0]!.choices?.map(choice => choice.label), ['Project instructions', 'User instructions']);
    assert.equal(requests[0]!.choices?.[1]!.value, path.join(os.homedir(), 'HARNESS.md'));
    callbacks!.onExit!();
    await loop;
    assert.deepEqual(opened, [projectFile]);
    assert.match(watcher.value(), /Opened \.\/HARNESS\.md/);
    assert.match(watcher.value(), /Using \$EDITOR="true"\. To change editor, set \$EDITOR or \$VISUAL environment variable\./);
  } finally {
    if (previous === undefined) delete process.env.EDITOR; else process.env.EDITOR = previous;
    if (previousVisual === undefined) delete process.env.VISUAL; else process.env.VISUAL = previousVisual;
    session.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});
