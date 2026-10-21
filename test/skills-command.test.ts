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

test('/skills cycles a mode, reports the row and saves the local override', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-skills-panel-')));
  const userDir = path.join(workspace, 'user');
  fs.mkdirSync(userDir);
  const config = { ...defaultConfig(workspace, []), model: 'test', configSources: { userDir } };
  config.skills = [
    { name: 'alpha', description: 'First skill', path: path.join(workspace, 'alpha/SKILL.md'), body: 'body',
      source: 'projectSettings', userInvocable: true, disableModelInvocation: false },
    { name: 'locked', description: 'Author locked', path: path.join(workspace, 'locked/SKILL.md'), body: 'body',
      source: 'projectSettings', userInvocable: true, disableModelInvocation: true },
  ];
  const provider: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('Unexpected model call'); } };
  const session = Session.open(workspace, { config });
  const watcher = (() => { let value = ''; return { stream: new Writable({
    write(chunk, _encoding, done) { value += String(chunk); done(); } }), value: () => value }; })();
  let callbacks: TerminalCallbacks | undefined;
  const requests: TerminalPromptRequest[] = [];
  const commands: readonly { name: string }[][] = [];
  let answered!: () => void;
  const settled = new Promise<void>(resolve => { answered = resolve; });
  const terminal: TerminalSurface = {
    isTTY: true, outputStream: watcher.stream,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { queueMicrotask(() => callbacks!.onSubmit!('/skills')); },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    setCommands(next) { commands.push(next as { name: string }[]); },
    async prompt(request) {
      requests.push(request);
      if (requests.length === 1) return { selected: ['skill:alpha'] };
      setImmediate(answered);
      return undefined;
    },
  };
  const input = new PassThrough();
  try {
    const loop = interactiveLoop(session, provider,
      { tools: [], buildTools: () => [], close: async () => {}, limits: [] },
      { input, output: watcher.stream, status: watcher.stream, signal: new AbortController().signal, terminal });
    await settled;
    assert.equal(requests.length, 2);
    assert.equal(requests[0]!.title, 'Skills');
    assert.deepEqual(requests[0]!.choices?.map(choice => choice.label), ['alpha', 'locked']);
    assert.equal(requests[0]!.choices?.[1]!.description, 'locked by author · user-only · project · < 20 tok');
    assert.deepEqual(requests[0]!.keys?.map(entry => entry.key), ['t']);
    assert.equal(requests[1]!.choices?.[0]!.description, 'name-only · project · < 20 tok');
    callbacks!.onExit!();
    await loop;
    const local = JSON.parse(fs.readFileSync(path.join(workspace, '.harness/settings.local.json'), 'utf8'));
    assert.deepEqual(local, { skillOverrides: { alpha: 'name-only' } });
    assert.match(watcher.value(), /Updated 1 skill override/);
    assert.ok(commands.length > 0);
  } finally {
    session.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});
