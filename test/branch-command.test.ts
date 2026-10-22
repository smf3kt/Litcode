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
import type { TerminalCallbacks, TerminalSurface } from '../src/terminal.js';

async function drive(commands: readonly string[], seed?: (session: Session) => void) {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-branch-')));
  const config = { ...defaultConfig(workspace, []), model: 'test' };
  const provider: ModelProvider = { count: async () => 0,
    complete: async () => { throw new Error('no completion in this fixture'); } };
  const session = Session.open(workspace, { config });
  seed?.(session);
  const chunks: string[] = [];
  const watcher = new Writable({ write(chunk, _encoding, done) { chunks.push(String(chunk)); done(); } });
  let callbacks: TerminalCallbacks | undefined;
  const queue = [...commands];
  const input = new PassThrough();
  const surface: TerminalSurface = { isTTY: true, outputStream: watcher,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    start() {
      const next = () => {
        const command = queue.shift();
        if (command === undefined) { setImmediate(() => callbacks?.onExit?.()); return; }
        queueMicrotask(() => callbacks!.onSubmit!(command));
        setTimeout(next, 30);
      };
      next();
    },
    async prompt() { return undefined; } };
  const runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [] };
  try {
    await interactiveLoop(session, provider, runtime,
      { input, output: watcher, status: watcher, signal: new AbortController().signal, terminal: surface });
    // Read the journals before the workspace goes away; the branch lives in its own file.
    const dir = path.join(workspace, '.agent');
    const journals = fs.readdirSync(dir).filter(name => name.endsWith('.jsonl'))
      .map(name => ({ name, text: fs.readFileSync(path.join(dir, name), 'utf8') }));
    return { text: chunks.join(''), originalId: session.id, journals };
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
}

function say(session: Session, role: 'user' | 'assistant', text: string, extra: Record<string, unknown> = {}) {
  session.append({ kind: 'message', message: { role, content: text }, ...extra } as never);
}

test('/branch copies the conversation into a titled branch and switches to it', async () => {
  const run = await drive(['/branch'], session => {
    say(session, 'user', 'Fix the parser');
    say(session, 'assistant', 'working');
    session.append({ kind: 'turn_end', reason: 'end_turn' });
  });
  // A bare `/branch` derives the title; the source does not quote a derived one in the line.
  assert.ok(run.text.includes('Branched conversation. You are now in the new branch'), run.text);
  assert.equal(run.journals.length, 2);
  const branch = run.journals.find(item => !item.name.startsWith(run.originalId))!;
  assert.ok(branch.text.includes('"title":"Fix the parser (Branch)"'), branch.text);
  assert.ok(branch.text.includes('"kind":"branch"'), branch.text);
  assert.ok(branch.text.includes('Fix the parser'), branch.text);
  assert.ok(branch.text.includes('working'), branch.text);
});

test('a typed name is the stored title, without a branch suffix', async () => {
  const run = await drive(['/branch my-topic'], session => {
    say(session, 'user', 'Fix the parser');
    session.append({ kind: 'turn_end', reason: 'end_turn' });
  });
  assert.ok(run.text.includes('Branched conversation "my-topic".'), run.text);
  const branch = run.journals.find(item => !item.name.startsWith(run.originalId))!;
  assert.ok(branch.text.includes('"title":"my-topic"'), branch.text);
});

test('a second bare branch of the same source takes the next ordinal', async () => {
  const run = await drive(['/branch', '/branch'], session => {
    say(session, 'user', 'Fix the parser');
    session.append({ kind: 'turn_end', reason: 'end_turn' });
  });
  // A branch copies the source's title records and appends its own, so the last one is its title.
  const titles = run.journals.map(item => [...item.text.matchAll(/"title":"([^"]+)"/g)].at(-1)?.[1]).filter(Boolean);
  assert.deepEqual(new Set(titles), new Set(['Fix the parser (Branch)', 'Fix the parser (Branch 2)']));
});

test('the branch hint names the way back to the original', async () => {
  const run = await drive(['/branch'], session => {
    say(session, 'user', 'Fix the parser');
    session.append({ kind: 'turn_end', reason: 'end_turn' });
  });
  assert.ok(run.text.includes('Use /resume '), run.text);
  assert.ok(run.text.includes('to return to the original'), run.text);
});

test('a slash command alone names the branch after the command', async () => {
  const run = await drive(['/branch'], session => {
    say(session, 'user', '<command-name>/compact</command-name>');
    session.append({ kind: 'turn_end', reason: 'end_turn' });
  });
  const branch = run.journals.find(item => !item.name.startsWith(run.originalId))!;
  assert.ok(branch.text.includes('"title":"/compact (Branch)"'), branch.text);
});

test('an empty conversation falls back to the recovered title', async () => {
  const run = await drive(['/branch']);
  const branch = run.journals.find(item => !item.name.startsWith(run.originalId))!;
  assert.ok(branch.text.includes('"title":"Branched conversation (Branch)"'), branch.text);
});
