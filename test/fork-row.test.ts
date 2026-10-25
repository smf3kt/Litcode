import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';

import { defaultConfig } from '../src/agent.js';
import { SESSION_RUNNING, SESSION_WAITING, forkRowChip, forkSessionLine as forkRowLine } from '../src/fork-command.js';
import { fitForkRow, forkCopyName, forkRowFields, forkRowName } from '../src/fork-row.js';
import { interactiveLoop } from '../src/interactive.js';
import { cellWidth } from '../src/terminal.js';
import type { ModelProvider } from '../src/provider.js';
import type { Runtime } from '../src/runtime.js';
import { Session } from '../src/session.js';

function reply(text: string): Anthropic.Message {
  return { id: 'fixture', model: 'test', role: 'assistant', type: 'message', content: [{ type: 'text', text }],
    stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}
function capture() {
  let text = '';
  const stream = new Writable({ write(chunk, _encoding, callback) { text += String(chunk); callback(); } });
  return { stream, value: () => text };
}

test('the copy name joins the parent name to the prompt with the fork glyph', () => {
  assert.equal(forkCopyName('fix-parser', 'split the lexer'), 'fix-parser ⑂ split the lexer');
  assert.equal(forkCopyName(undefined, 'split the lexer'), '⑂ split the lexer');
  assert.equal(forkCopyName(undefined, '   '), '');
  assert.equal(forkCopyName('  fix\u0000-parser ', ' a\nb '), 'fix-parser ⑂ a b');
  assert.equal(forkRowName(forkCopyName('fix-parser', 'split the lexer')), 'fix-parser ⑂ split the lexer');
  assert.equal(forkRowName('  ⑂  '), undefined);
});

test('the row parses back into its fields and only fork rows parse', () => {
  assert.deepEqual(forkRowFields('session running · fix · abcdef01 · runs in the origin tree'),
    { state: 'session running', name: 'fix', id: 'abcdef01', chips: ['runs in the origin tree'] });
  assert.deepEqual(forkRowFields('session waiting for a prompt'), { state: 'session waiting for a prompt', chips: [] });
  assert.equal(forkRowFields('Forking…'), null);
  assert.equal(forkRowFields('session running · two\nlines'), null);
  // `Bcn` reads a segment that is not a short id as part of the name, not as a rejection.
  assert.deepEqual(forkRowFields('session running · not-an-id'),
    { state: 'session running', name: 'not-an-id', chips: [] });
});

test('the fitting ladder shortens the state, then clips the name to at least twenty cells', () => {
  const long = forkRowName(forkCopyName('fix-parser', 'split the lexer into its tokens and keep the trivia'));
  const row = { state: SESSION_WAITING, name: long, id: 'abcdef01',
    chips: [forkRowChip({ editsIn: 'own-worktree' }) ?? 'own-worktree'] };
  assert.equal(forkRowLine(fitForkRow(row, 200)), forkRowLine(row));
  const shortened = fitForkRow(row, forkRowLine(row).length - 1);
  assert.equal(shortened.state, 'session waiting');
  assert.equal(shortened.id, 'abcdef01');
  const clipped = fitForkRow({ ...row, state: SESSION_RUNNING }, 60);
  assert.equal(clipped.state, SESSION_RUNNING);
  assert.ok(clipped.name!.endsWith('…'));
  // `RMr` floors the clipped name at `gn` (20 cells) even when the row then overflows the
  // terminal, so the row is shorter than before but not necessarily within 60.
  assert.ok(cellWidth(clipped.name!) >= 20 && cellWidth(clipped.name!) < cellWidth(long!));
  assert.ok(cellWidth(forkRowLine(clipped)) < cellWidth(forkRowLine({ ...row, state: SESSION_RUNNING })));
  const dropped = fitForkRow({ ...row, state: SESSION_RUNNING }, 40, true);
  assert.equal(dropped.id, undefined);
});

test('/fork prints the named row the recovered grammar parses back', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-fork-row-')));
  const config = defaultConfig(root, []); config.model = 'test';
  const session = Session.open(root, { config });
  session.append({ kind: 'message', message: { role: 'user', content: 'earlier task' } });
  session.append({ kind: 'message', message: { role: 'assistant', content: 'earlier answer' } });
  session.append({ kind: 'turn_end', reason: 'end_turn' });
  session.append({ kind: 'title', title: 'fix-parser' });
  const provider: ModelProvider = { count: async () => 0, complete: async () => reply('unused') };
  const stdout = capture(), stderr = capture();
  const saved = { ...process.env };
  delete process.env.CLAUDE_CODE_DISABLE_AGENT_VIEW; delete process.env.IS_DEMO;
  delete process.env.CLAUDE_CODE_COORDINATOR_MODE;
  const runtime: Partial<Runtime> = { tools: [], buildTools: () => [], close: async () => {}, limits: [] };
  try {
    await interactiveLoop(session, provider, runtime as Runtime, {
      input: Readable.from(['/fork split the lexer\n', '/exit\n']),
      output: stdout.stream, status: stderr.stream, signal: new AbortController().signal,
      startBackground: ({ session: parent }) => ({ sessionId: `${parent.id.slice(0, 4)}abcd01`, pid: undefined,
        log: path.join(root, '.agent', 'background', 'copy.log') }),
    });
  } finally { Object.assign(process.env, saved); session.close(); }
  const line = stdout.value().split('\n').find(text => text.startsWith(SESSION_RUNNING));
  assert.ok(line, stdout.value());
  const fields = forkRowFields(line!);
  assert.ok(fields, line);
  assert.equal(fields!.name, 'fix-parser ⑂ split the lexer');
  // `RMr` may clip a long name to the terminal, so the row only promises the eight-hex id.
  assert.match(fields!.id!, /^[0-9a-f]{8}$/);
  assert.deepEqual(fields!.chips, []);
  assert.notEqual(fields!.state, SESSION_WAITING);
});
