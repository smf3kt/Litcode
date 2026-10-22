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

const FIXTURE_ID = '11111111-1111-4111-8111-111111111111';
const AT = Date.UTC(2026, 9, 20, 10, 0, 0);

function writeJournal(workspace: string): void {
  const dir = path.join(workspace, '.agent');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${FIXTURE_ID}.jsonl`), [
    JSON.stringify({ kind: 'metadata', version: 1, id: FIXTURE_ID, config: {}, fingerprint: 'f', startedAt: AT }),
    JSON.stringify({ kind: 'message', message: { role: 'user', content: 'hi' } }),
    JSON.stringify({ kind: 'message', message: { role: 'assistant', content: [] },
      response: { model: 'fixture', usage: { input_tokens: 1000, output_tokens: 500,
        cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }),
    JSON.stringify({ kind: 'turn_end', reason: 'done', duration: { durationMs: 1,
      timestamp: '2026-10-20T10:30:00.000Z' } }),
  ].join('\n') + '\n');
}

async function drive(command: string, answers: readonly (readonly string[])[]) {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-usage-')));
  writeJournal(workspace);
  const config = { ...defaultConfig(workspace, []), model: 'test' };
  const provider: ModelProvider = {
    count: async () => 0,
    complete: async () => { throw new Error('no completion in this fixture'); },
  };
  const session = Session.open(workspace, { config });
  const watcher = new Writable({ write(_chunk, _encoding, done) { done(); } });
  let callbacks: TerminalCallbacks | undefined;
  const prompts: TerminalPromptRequest[] = [];
  let escaped!: () => void;
  const settled = new Promise<void>(resolve => { escaped = resolve; });
  const terminal: TerminalSurface = {
    isTTY: true, outputStream: watcher,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { queueMicrotask(() => callbacks!.onSubmit!(command)); },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    async prompt(request) {
      prompts.push(request);
      if (prompts.length <= answers.length) return { selected: [], key: answers[prompts.length - 1]![0]! };
      setImmediate(escaped);
      return undefined;
    },
  };
  const runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [] };
  const input = new PassThrough();
  try {
    const loop = interactiveLoop(session, provider, runtime,
      { input, output: watcher, status: watcher, signal: new AbortController().signal, terminal });
    await settled;
    return { prompts, loop, callbacks: callbacks!, session, workspace };
  } catch (error) {
    session.close(); fs.rmSync(workspace, { recursive: true, force: true });
    throw error;
  }
}

test('/usage opens the Stats tab and cycles the range', async () => {
  const run = await drive('/usage', [['t']]);
  try {
    assert.equal(run.prompts.length, 2);
    assert.equal(run.prompts[0]!.title, 'Stats');
    const lines = run.prompts[0]!.message.split('\n');
    assert.equal(lines[0], 'Range: All time');
    assert.ok(lines[1]!.startsWith('Favorite model: fixture'));
    assert.ok(run.prompts[0]!.message.includes('Input 1.0k · Output 500 · Cache read 0 · Cache write 0'));
    assert.deepEqual(run.prompts[0]!.keys, [{ key: 't', label: 'Last 7 days' }]);
    assert.equal(run.prompts[1]!.message.split('\n')[0], 'Range: Last 7 days');
    assert.deepEqual(run.prompts[1]!.keys, [{ key: 't', label: 'Last 30 days' }]);
    run.callbacks.onExit!();
    await run.loop;
  } finally {
    run.session.close(); fs.rmSync(run.workspace, { recursive: true, force: true });
  }
});

test('/stats and /cost reach the same panel', async () => {
  for (const command of ['/stats', '/cost']) {
    const run = await drive(command, []);
    try {
      assert.equal(run.prompts.length, 1);
      assert.equal(run.prompts[0]!.title, 'Stats');
      assert.ok(run.prompts[0]!.message.includes('Sessions: 1'));
      run.callbacks.onExit!();
      await run.loop;
    } finally {
      run.session.close(); fs.rmSync(run.workspace, { recursive: true, force: true });
    }
  }
});
