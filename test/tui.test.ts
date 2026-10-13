import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { defaultConfig } from '../src/agent.js';
import { interactiveLoop } from '../src/interactive.js';
import { createKillRing, emptyKillRing, nextYank, reduceKillRing } from '../src/kill-ring.js';
import type { ModelProvider } from '../src/provider.js';
import type { Runtime } from '../src/runtime.js';
import { Session } from '../src/session.js';
import { ENTER_ALT_SCREEN, LEAVE_ALT_SCREEN, MOUSE_OFF, MOUSE_SCROLL, TerminalModeController } from '../src/tui-modes.js';
import { Keymap, contextStack, expandChord, type TuiContext } from '../src/tui-keys.js';
import { createTranscriptState, layoutTranscript, reduceTranscript, transcriptLines } from '../src/tui-transcript.js';
import { TuiTerminal } from '../src/tui.js';
import { TerminalKeyDecoder } from '../src/terminal.js';

const cli = path.join(import.meta.dirname, '..', 'src', 'cli.ts');

test('mouse reports survive fragmentation and stay outside the input draft', () => {
  const reports = ['\x1b[<64;12;3M', '\x1b[<65;12;3m', '\x1b[M' + String.fromCharCode(96, 44, 35)];
  for (const report of reports) {
    const whole = new TerminalKeyDecoder().push(report);
    assert.equal(whole.length, 1);
    assert.equal(whole[0]?.type, 'mouse');
    for (let split = 1; split < report.length; split++) {
      const decoder = new TerminalKeyDecoder();
      assert.deepEqual(decoder.push(report.slice(0, split)), []);
      assert.deepEqual(decoder.push(report.slice(split)), whole);
    }
  }
  const decoder = new TerminalKeyDecoder();
  assert.deepEqual(decoder.push('\x1b[<84;2;3M'), [{ type: 'mouse', action: 'wheelup',
    button: 84, col: 2, row: 3, ctrl: true, meta: false, shift: true }]);
  assert.equal(decoder.push('\x1b[<35;2;3M')[0]?.type, 'mouse');
  assert.equal(decoder.push('\x1b[<0;2;3m')[0]?.type, 'mouse');
  assert.deepEqual(decoder.push('\x1b[<66;2;3M\x1b[M !!!'), [{ type: 'insert', text: '!' }]);
  assert.deepEqual(decoder.push('\x1b[<' + '9'.repeat(100)), []);
  assert.deepEqual(decoder.push(';2;3Mdraft'), [{ type: 'insert', text: 'draft' }]);
  assert.deepEqual(decoder.push('\x1b[<64;2;'), []);
  decoder.flushEscape();
  assert.deepEqual(decoder.push('3Mdraft'), [{ type: 'insert', text: 'draft' }]);
  assert.deepEqual(decoder.push('\x1b[200~\x1b[<64;2;3M\x1b[201~'),
    [{ type: 'paste', text: '\x1b[<64;2;3M' }]);
});

test('wheel scrolling unpins the live tail and respects prompt, screen and mode boundaries', () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 40, rows: 10 });
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  try {
    for (let i = 0; i < 20; i++) tui.append({ kind: 'assistant', text: `line ${i}` });
    key('draft');
    key('\x1b[<64;2;3M');
    assert.equal(tui.transcriptState.offset, 12); // Seven visible rows, one up from the tail.
    tui.append({ kind: 'assistant', text: 'new output' });
    assert.equal(tui.transcriptState.offset, 12);
    key('\x1b[M' + String.fromCharCode(97, 34, 35));
    assert.equal(tui.transcriptState.offset, 13);
    key('\x1b[<64;2;9M\x1b[<64;0;3M\x1b[<0;2;3M\x1b[<0;2;3m');
    assert.equal(tui.transcriptState.offset, 13);
    key('\u0012\x1b[<64;2;3M'); // Search owns its input; wheel does not move the transcript.
    assert.equal(tui.transcriptState.offset, 13);
    assert.equal(tui.state.text, 'draft');
  } finally { tui.close(); }
  const off = new TuiTerminal({ input, output, mouseTracking: 'off' }).start();
  try {
    for (let i = 0; i < 20; i++) off.append({ kind: 'assistant', text: `line ${i}` });
    const before = off.transcriptState.offset;
    key('\x1b[<64;2;3M');
    assert.equal(off.transcriptState.offset, before);
  } finally { off.close(); }
});

test('the kill ring coalesces, caps at ten, and cycles yank-pop', () => {
  let state = reduceKillRing(emptyKillRing, { type: 'kill', text: 'one' });
  assert.deepEqual(state.ring, ['one']);
  // A second kill while the run is open joins the head instead of adding an entry.
  state = reduceKillRing(state, { type: 'kill', text: 'two', direction: 'append' });
  assert.deepEqual(state.ring, ['onetwo']);
  state = reduceKillRing(state, { type: 'kill', text: 'zero', direction: 'prepend' });
  assert.deepEqual(state.ring, ['zeroonetwo']);
  // An empty kill only ends the run.
  state = reduceKillRing(state, { type: 'kill', text: '' });
  assert.equal(state.mode.type, 'idle');
  state = reduceKillRing(state, { type: 'kill', text: 'three' });
  assert.deepEqual(state.ring, ['three', 'zeroonetwo']);
  assert.equal(state.ring.length, 2);

  // Consecutive kills coalesce by design, so an entry only lands when the run
  // is broken between them; the ring then keeps the newest ten.
  for (let index = 0; index < 12; index++) {
    state = reduceKillRing(reduceKillRing(state, { type: 'interrupt' }), { type: 'kill', text: `e${index}` });
  }
  assert.equal(state.ring.length, 10);
  assert.equal(state.ring[0], 'e11');
  assert.equal(state.ring.at(-1), 'e2');

  // yankPop cycles the ring and reports the span it would replace.
  let yanked = reduceKillRing({ ring: ['a', 'b', 'c'], mode: { type: 'idle' } },
    { type: 'yank', start: 4, length: 1 });
  assert.deepEqual(nextYank(yanked), { text: 'b', start: 4, length: 1 });
  yanked = reduceKillRing(yanked, { type: 'yankPop' });
  assert.deepEqual(nextYank(yanked), { text: 'c', start: 4, length: 1 });
  // A single-entry ring has nothing to cycle to.
  assert.equal(nextYank({ ring: ['only'], mode: { type: 'yanked', start: 0, length: 4, index: 0 } }), null);
  // A store reads the same transitions.
  const ring = createKillRing();
  ring.dispatch({ type: 'kill', text: 'stored' });
  assert.deepEqual(ring.state.ring, ['stored']);
});

test('the keymap layers contexts and resolves multi-key chords', () => {
  const keymap = new Keymap();
  // `q` closes the transcript but is ordinary text in the chat context.
  const transcript = contextStack({ screen: 'transcript' });
  assert.deepEqual(keymap.push('q', transcript), { kind: 'match', match: {
    context: 'Transcript', action: 'transcript:exit', chord: 'q', consumed: ['q'] } });
  assert.equal(keymap.push('q', contextStack({ screen: 'chat' })).kind, 'none');

  // A sequence chord stays pending until its second key arrives.
  const diff: TuiContext[] = ['DiffPanel', 'Global'];
  assert.deepEqual(keymap.push('\u0018', diff), { kind: 'pending' });
  assert.equal(keymap.pendingChord, 'ctrl+x');
  const second = keymap.push('b', diff);
  assert.equal(second.kind, 'match');
  assert.equal(second.kind === 'match' ? second.match.action : '', 'app:cycleDiffBase');

  // A pending chord that cannot complete returns its buffered bytes.
  keymap.push('\u0018', diff);
  const replayed = keymap.push('\u0003', diff);
  assert.deepEqual(replayed, { kind: 'none', replay: '\u0018' });

  // Global is reachable from every screen, and the expansion covers alternatives.
  assert.equal(keymap.push('\u000f', contextStack({ screen: 'chat' })).kind, 'match');
  assert.deepEqual(expandChord('up'), [['\x1b[A'], ['\x1bOA']]);
  assert.deepEqual(expandChord('ctrl+x b'), [['\u0018', 'b']]);
  // An unbound key name expands to nothing rather than to a wrong sequence.
  assert.deepEqual(expandChord('ctrl+f13'), []);
});

test('the transcript viewport clamps its scroll and follows the tail only when pinned', () => {
  const view = { rows: 4, total: 0 };
  let state = createTranscriptState();
  for (let index = 0; index < 6; index++) {
    const total = transcriptLines(state, 40).length;
    state = reduceTranscript(state, { type: 'append', entry: { kind: 'assistant', text: `line ${index}` } }, { rows: 4, total });
  }
  const pinned = layoutTranscript(state, 40, 4);
  assert.equal(pinned.lines.length, 4);
  assert.equal(pinned.scrolled, false);
  assert.match(pinned.lines.at(-1)!, /line 5/);

  // Scrolling up unpins the view, and new output must not drag it back down.
  let scrolled = reduceTranscript(state, { type: 'scroll', command: 'top' }, { rows: 4, total: 6 });
  assert.equal(layoutTranscript(scrolled, 40, 4).lines[0], 'line 0');
  scrolled = reduceTranscript(scrolled, { type: 'scroll', command: 'lineDown' }, { rows: 4, total: 6 });
  scrolled = reduceTranscript(scrolled, { type: 'append', entry: { kind: 'assistant', text: 'line 6' } }, { rows: 4, total: 6 });
  assert.equal(layoutTranscript(scrolled, 40, 4).lines[0], 'line 1');

  // Half a page moves half the region, and the clamp holds at both ends.
  assert.equal(reduceTranscript({ ...state, offset: 0 }, { type: 'scroll', command: 'halfPageUp' }, { rows: 4, total: 6 }).offset, 0);
  assert.equal(reduceTranscript({ ...state, offset: 6 }, { type: 'scroll', command: 'halfPageDown' }, { rows: 4, total: 6 }).offset, 2);
  assert.equal(reduceTranscript({ ...state, offset: 0 }, { type: 'scroll', command: 'bottom' }, { rows: 4, total: 6 }).offset, 2);

  // Collapsed, a long entry keeps its tail and says how much it hid.
  const long = createTranscriptState([{ kind: 'tool', text: Array.from({ length: 30 }, (_, i) => `row ${i}`).join('\n') }]);
  const collapsed = transcriptLines(long, 40);
  assert.match(collapsed[0]!, /\.\.\. 18 earlier lines \(ctrl\+e shows all\)/);
  // One notice plus the retained tail of twelve lines.
  assert.equal(collapsed.length, 13);
  const shown = transcriptLines({ ...long, showAll: true }, 40);
  assert.equal(shown.length, 30);
});

test('the full-screen layer draws, scrolls and restores the terminal it took', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-tui-')));
  const config = defaultConfig(workspace, []); config.model = 'test';
  const session = Session.open(workspace, { config });
  const provider: ModelProvider = {
    count: async () => 10,
    complete: async (_request, _signal, onText) => {
      onText?.('answer body');
      return { id: 'fixture', model: 'test', role: 'assistant', type: 'message',
        content: [{ type: 'text', text: 'answer body' }], stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
    },
  };
  const runtime: Runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [] };

  let drawn = '';
  const output = new Writable({ write(chunk, _encoding, callback) { drawn += String(chunk); callback(); } });

  Object.assign(output, { isTTY: true, columns: 40, rows: 10 });
  const input = new PassThrough() as PassThrough & { isTTY: boolean; isRaw: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.isRaw = false; input.setRawMode = (raw: boolean) => { input.isRaw = raw; };

  const tui = new TuiTerminal({ input, output, prompt: '> ', mouseTracking: 'scroll' });
  // The stream buffers until the layer attaches its reader, so both lines can
  // be queued up front: one task, then the exit that ends the session.
  input.write('hello\r/exit\r');
  try {
    await interactiveLoop(session, provider, runtime, { input, output,
      status: new Writable({ write(_chunk, _encoding, callback) { callback(); } }),
      signal: new AbortController().signal, terminal: tui });

    assert.match(drawn, new RegExp(ENTER_ALT_SCREEN.replace(/[?[\]]/g, '\\$&')));
    assert.match(drawn, new RegExp(MOUSE_SCROLL.replace(/[?[\]]/g, '\\$&')));
    // The task's answer reached the transcript, not the raw stream.
    assert.match(drawn, /answer body/);
    // The status row carries the hints rather than scrolling the transcript.
    assert.match(drawn, /ctrl\+o transcript/);
    assert.match(drawn, new RegExp(LEAVE_ALT_SCREEN.replace(/[?[\]]/g, '\\$&')));
    assert.match(drawn, new RegExp(MOUSE_OFF.replace(/[?[\]]/g, '\\$&')));
  } finally {
    tui.close(); session.close();
  }

  // The controller restores every mode it set and is idempotent on both ends.
  let sequences: string[] = [];
  const controller = new TerminalModeController({ output: { write: (chunk: string) => { sequences.push(chunk); } },
    mouseTracking: 'scroll', synchronizedUpdate: true });
  controller.enter(); controller.enter();
  assert.equal(sequences.filter(sequence => sequence === ENTER_ALT_SCREEN).length, 1);
  sequences = [];
  controller.leave(); controller.leave();
  assert.equal(sequences.filter(sequence => sequence === LEAVE_ALT_SCREEN).length, 1);
  assert.ok(sequences.includes(MOUSE_OFF));
});

test('a terminal can open the full-screen interface and leave it on exit', { timeout: 60_000 }, () => {
  // Same PTY arrangement as the bare-invocation case: `script` allocates the
  // terminal, and the session runs behind a shell pipeline because `script`
  // refuses a socket as its own standard input. A host without `script` skips.
  const quit = ["printf '/exit\\n'", '|', 'script -q /dev/null', process.execPath, '--import', 'tsx', cli,
    '--interactive', '--tui'].join(' ');
  const result = spawnSync('/bin/sh', ['-c', quit], {
    encoding: 'utf8', timeout: 50_000,
    env: { ...process.env, LLM_API_KEY: 'offline-fixture-key', LLM_BASE_URL: 'http://127.0.0.1:1',
      LLM_MODEL: 'test-model', LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate',
      LLM_THINKING: 'false', LLM_PROMPT_CACHE: 'false', LLM_EAGER_TOOL_INPUT: 'false' },
  });
  if (result.error || /script: .*Operation not supported/.test(result.stderr ?? '')) return;
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(ENTER_ALT_SCREEN), 'the alternate screen was entered');
  assert.ok(result.stdout.includes(LEAVE_ALT_SCREEN), 'the alternate screen was restored');
  // The allocating terminal is narrow, so the row shows as much of the hint as
  // fits; the key itself must survive the clip.
  assert.match(result.stdout, /ctrl\+o/);
  // No task was given, so the session must not have spent a model call.
  assert.doesNotMatch(result.stdout, /model calls: [1-9]/);
});
