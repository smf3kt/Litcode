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
import { pad, TuiTerminal } from '../src/tui.js';
import { createSelection, moveSelectionColumn, reduceSelection, selectionColumn, selectionText } from '../src/tui-selection.js';
import { osc52Payload } from '../src/clipboard-osc52.js';
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

test('pointer and keyboard selection copy the visible transcript without changing the draft', () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  let drawn = '';
  const output = new Writable({ write(chunk, _encoding, done) { drawn += String(chunk); done(); } });
  Object.assign(output, { isTTY: true, columns: 40, rows: 10 });
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  const copy = () => {
    drawn = ''; key('\x1b[99;6u');
    const encoded = /\x1b\]52;c;([A-Za-z0-9+/=]*)(?:\x07|\x1b\\)/.exec(drawn)?.[1];
    return encoded === undefined ? undefined : Buffer.from(encoded, 'base64').toString('utf8');
  };
  try {
    assert.ok(drawn.includes('\x1b[?1002h'));
    for (let index = 0; index < 20; index++) tui.append({ kind: 'assistant', text: `line ${index}` });
    key('draft');
    // Seven visible rows: row 1 is line 13, row 2 is line 14.
    key('\x1b[<0;1;1M\x1b[<32;4;2M\x1b[<0;4;9m');
    assert.ok(drawn.includes('\x1b[7mline\x1b[27m'));
    // A release on the prompt ends dragging; subsequent motion cannot extend it.
    key('\x1b[<32;7;3M');
    tui.append({ kind: 'assistant', text: 'new output' });
    assert.equal(copy(), 'line 13\nline');
    assert.equal(copy(), undefined);
    assert.equal(tui.state.text, 'draft');
    let submitted = 0;
    tui.on('submit', () => { submitted++; });
    key('\x1b[13;2u');
    assert.equal(tui.state.text, 'draft\n');
    assert.equal(submitted, 0);
    key('\x7f');
    // Reversing direction moves the focus, not the ordered end of the span.
    key('\x1b[<0;5;1M\x1b[<0;5;1m\x1b[1;2D\x1b[1;2D');
    assert.equal(copy(), 'ne');
    key('\x1b[1;2C');
    assert.equal(copy(), 'li');
    key('\x1b[<0;1;1M\x1b[<32;2;1M\x1b[<0;5;1m');
    assert.equal(copy(), 'line');
    tui.append({ kind: 'assistant', text: 'A\tBCDEFGHIJKLMN' });
    key('\x1b[<0;9;7M\x1b[<32;10;7M\x1b[<0;10;7m');
    assert.ok(drawn.includes('\x1b[7mBC\x1b[27m'));
    assert.equal(copy(), 'BC');
    key('\x1b[<0;1;1M\x1b[<32;3;1M\x1b[<0;3;1m');
    output.emit('resize');
    assert.equal(copy(), undefined);
    key('\u0012\x1b[1;2C');
    assert.equal(copy(), undefined);
    assert.equal(tui.state.text, 'draft');
    key('\u0003'); // Leave search before selecting the collapsed notice.
    Object.assign(output, { columns: 20, rows: 40 }); output.emit('resize');
    tui.append({ kind: 'tool', text: Array.from({ length: 30 }, (_, i) => `row ${i}`).join('\n') });
    const noticeRow = transcriptLines(tui.transcriptState, 20).findIndex(line => line.startsWith('  ... 18')) + 1;
    key(`\x1b[<0;1;${noticeRow}M\x1b[<0;1;${noticeRow}m\x1b[1;2F`);
    assert.equal(copy(), '  ... 18 earlier lin');
  } finally { tui.close(); }
});

test('multi-click selects the word and then the whole row, and a drag extends that span', () => {
  // Each case starts a fresh terminal so the click sequence cannot carry over.
  const open = () => {
    const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
    input.isTTY = true; input.setRawMode = () => {};
    let drawn = '';
    const output = new Writable({ write(chunk, _encoding, done) { drawn += String(chunk); done(); } });
    Object.assign(output, { isTTY: true, columns: 40, rows: 10 });
    const tui = new TuiTerminal({ input, output }).start();
    tui.append({ kind: 'assistant', text: 'alpha beta-gamma delta' });
    tui.append({ kind: 'assistant', text: 'second row' });
    const copy = () => {
      drawn = ''; input.emit('data', '\x1b[99;6u');
      const encoded = /\x1b\]52;c;([A-Za-z0-9+/=]*)(?:\x07|\x1b\\)/.exec(drawn)?.[1];
      return encoded === undefined ? undefined : Buffer.from(encoded, 'base64').toString('utf8');
    };
    return { tui, key: (text: string) => input.emit('data', text), copy };
  };
  // Row 1 is 'alpha beta-gamma delta', row 2 is 'second row'.
  // A double click on 'beta-gamma' takes the whole hyphenated run, not just 'beta'.
  const double = open();
  try {
    double.key('\x1b[<0;7;1M\x1b[<0;7;1m\x1b[<0;7;1M');
    assert.equal(double.copy(), 'beta-gamma');
  } finally { double.tui.close(); }
  // A drag in the same sequence keeps the word span and grows its far edge.
  const dragged = open();
  try {
    dragged.key('\x1b[<0;7;1M\x1b[<0;7;1m\x1b[<0;7;1M\x1b[<32;22;1M');
    assert.equal(dragged.copy(), 'beta-gamma delta');
  } finally { dragged.tui.close(); }
  // A third press selects the whole rendered row.
  const triple = open();
  try {
    triple.key('\x1b[<0;7;1M\x1b[<0;7;1m\x1b[<0;7;1M\x1b[<0;7;1m\x1b[<0;7;1M');
    assert.equal(triple.copy(), 'alpha beta-gamma delta');
  } finally { triple.tui.close(); }
  // A line span drags by row, and its moving end snaps to the whole row under
  // the pointer rather than to the raw cell.
  const byLine = open();
  try {
    byLine.key('\x1b[<0;7;1M\x1b[<0;7;1m\x1b[<0;7;1M\x1b[<0;7;1m\x1b[<0;7;1M\x1b[<32;4;2M');
    assert.equal(byLine.copy(), 'alpha beta-gamma delta\nsecond row');
  } finally { byLine.tui.close(); }
  // A word span snaps the moving end to the word under the pointer, so a drag
  // into the middle of the next word takes that whole word rather than the
  // raw cells between the two points.
  const snapped = open();
  try {
    snapped.key('\x1b[<0;7;1M\x1b[<0;7;1m\x1b[<0;7;1M\x1b[<32;20;1M');
    assert.equal(snapped.copy(), 'beta-gamma delta');
  } finally { snapped.tui.close(); }
  // A press far from the previous one restarts the sequence at one click, so a
  // drag from it is a plain character span rather than a word or row.
  const restarted = open();
  try {
    restarted.key('\x1b[<0;7;1M\x1b[<0;7;1m\x1b[<0;7;1M');
    restarted.key('\x1b[<0;1;2M\x1b[<32;4;2M');
    assert.equal(restarted.copy(), 'seco');
  } finally { restarted.tui.close(); }
  // Changing screens between presses restarts the sequence, so the press after
  // the change is a plain one rather than the second half of a double click.
  const acrossScreens = open();
  try {
    acrossScreens.key('\x1b[<0;7;1M');
    acrossScreens.key('\u000f');
    acrossScreens.key('\x1b[<0;7;1M\x1b[<0;4;1m');
    // A plain span between cells 6 and 3, i.e. 'ha b' reversed into reading order.
    assert.equal(acrossScreens.copy(), 'ha b');
  } finally { acrossScreens.tui.close(); }
});

test('wrapped rows copy as one logical line while explicit newlines keep theirs', () => {
  const open = (columns: number, text: string) => {
    const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
    input.isTTY = true; input.setRawMode = () => {};
    let drawn = '';
    const output = new Writable({ write(chunk, _encoding, done) { drawn += String(chunk); done(); } });
    Object.assign(output, { isTTY: true, columns, rows: 10 });
    const tui = new TuiTerminal({ input, output }).start();
    if (text) tui.append({ kind: 'assistant', text });
    const copy = () => {
      drawn = ''; input.emit('data', '\x1b[99;6u');
      const encoded = /\x1b\]52;c;([A-Za-z0-9+/=]*)(?:\x07|\x1b\\)/.exec(drawn)?.[1];
      return encoded === undefined ? undefined : Buffer.from(encoded, 'base64').toString('utf8');
    };
    return { tui, key: (keys: string) => input.emit('data', keys), copy };
  };
  // 20 columns with the '> ' user indent leaves 18 cells per row, so the
  // first line wraps and the second line is an explicit newline.
  const indented = open(20, '');
  try {
    indented.tui.append({ kind: 'user', text: 'aaaaaaaaaaaaaaaaaaaaaaaa\nbbbb' });
    // Selecting all three rows joins the wrapped tail back onto the first line,
    // while the explicit newline keeps its own prefix.
    indented.key('\x1b[<0;1;1M\x1b[<32;10;3M\x1b[<0;10;3m');
    assert.equal(indented.copy(), '> aaaaaaaaaaaaaaaaaaaaaaaa\n> bbbb');
  } finally { indented.tui.close(); }
  // A wrap point that lands on a space keeps it, so the halves do not glue.
  const spaced = open(12, 'hello world foo bar baz');
  try {
    spaced.key('\x1b[<0;1;1M\x1b[<32;12;2M\x1b[<0;12;2m');
    assert.equal(spaced.copy(), 'hello world foo bar baz');
  } finally { spaced.tui.close(); }
});

test('selection spans preserve wide and combining graphemes in both directions', () => {
  const lines = ['A中👩‍💻éZ', 'next   '];
  let state = reduceSelection(createSelection(), { type: 'start', at: { line: 0, column: 1 } });
  state = reduceSelection(state, { type: 'drag', at: { line: 0, column: 5 } });
  assert.equal(selectionText(state, lines), '中👩‍💻é');
  assert.equal(selectionColumn(lines[0]!, 2), 1);
  assert.equal(moveSelectionColumn(lines[0]!, 5, -1), 3);
  state = reduceSelection(state, { type: 'extend', to: { line: 1, column: 2 } });
  assert.equal(selectionText(state, lines), '中👩‍💻éZ\nnex');
  assert.equal(selectionText({ ...state, anchor: state.focus, focus: state.anchor }, lines), '中👩‍💻éZ\nnex');
  assert.equal(pad('中👩‍💻é', 5), '中👩‍💻é');
});

test('clipboard sequences match raw, kitty, tmux and screen framing with a byte cap', () => {
  const text = '中\u001b]52;test';
  const body = Buffer.from(text).toString('base64');
  const raw = `\x1b]52;c;${body}\x07`;
  assert.equal(osc52Payload(text, {}), raw);
  assert.equal(osc52Payload(text, { TERM: 'xterm-kitty' }), `\x1b]52;c;${body}\x1b\\`);
  assert.equal(osc52Payload(text, { TMUX: 'fixture' }), raw + `\x1bPtmux;${raw.replaceAll('\x1b', '\x1b\x1b')}\x1b\\`);
  const long = 'a'.repeat(80), encoded = Buffer.from(long).toString('base64');
  assert.equal(osc52Payload(long, { STY: 'fixture' }),
    `\x1bP\x1b]52;c;${encoded.slice(0, 76)}\x1b\\\x1bP${encoded.slice(76)}\x07\x1b\\`);
  assert.throws(() => osc52Payload('中'.repeat(33334), {}), /100000 UTF-8 bytes/);
});

test('actual TUI input reaches contextual navigation while paste and overrides keep their intent', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 40, rows: 10 });
  const tui = new TuiTerminal({ input, output, history: ['previous task'] }).start();
  const key = (text: string) => input.emit('data', text);
  const wait = () => new Promise(resolve => setTimeout(resolve, 70));
  try {
    for (let i = 0; i < 20; i++) tui.append({ kind: 'assistant', text: `line ${i}` });
    key('draft'); key('\u000f');
    assert.equal(tui.currentScreen, 'transcript');
    key('k'); assert.equal(tui.transcriptState.offset, 12);
    key('j'); assert.equal(tui.transcriptState.offset, 13);
    key('\u0005'); assert.equal(tui.transcriptState.showAll, true);
    key('g'); assert.equal(tui.transcriptState.offset, 0);
    key('G'); assert.equal(tui.transcriptState.offset, 13);
    key('\x1b[5~'); assert.equal(tui.transcriptState.offset, 6);
    key('q'); assert.equal(tui.currentScreen, 'chat');
    assert.equal(tui.state.text, 'draft');
    key('\u000f\x1b'); await wait();
    assert.equal(tui.currentScreen, 'chat');
    key('\x1b[200~jkq\x1b[201~');
    assert.equal(tui.state.text, 'draftjkq');
    key('\u001b'); key('c'); // Split Meta+C is a complete key, not Escape + ordinary c.
    assert.equal(tui.state.text, 'draftjkq');
    let submitted = 0; tui.on('submit', () => { submitted++; });
    key('\x1b[13;2u'); assert.equal(submitted, 0);
    assert.equal(tui.state.text, 'draftjkq\n');
    key('\x7f\u0012\t'); assert.equal(tui.currentScreen, 'chat');
    tui.setKeybindings({ '\u000f': null, '\r': 'newline' });
    key('\u000f\r'); assert.equal(tui.currentScreen, 'chat');
    assert.equal(tui.state.text, 'draftjkq\n');
    assert.equal(submitted, 0);
    tui.setKeybindings(); key('\r'); assert.equal(submitted, 1);
    key('\x1b[A'); assert.equal(tui.state.text, 'draftjkq\n');
  } finally { tui.close(); }
});

test('grouped questions step through each question and review before submitting', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  let drawn = '';
  const output = new Writable({ write(chunk, _encoding, done) { drawn += String(chunk); done(); } });
  Object.assign(output, { isTTY: true, columns: 60, rows: 14 });
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  const frame = () => drawn.slice(drawn.lastIndexOf('\x1b[H'))
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').split('\r\n').map(line => line.trim()).filter(Boolean);
  try {
    const pending = tui.prompt({ title: 'Questions', message: '', groups: [
      { key: 'First', title: 'First', message: 'Pick one', choices: [{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }] },
      { key: 'Second', title: 'Second', message: 'Pick many',
        choices: [{ label: 'X', value: 'X' }, { label: 'Y', value: 'Y' }], multiple: true },
    ] }, new AbortController().signal);
    assert.equal(frame()[0], 'First');
    assert.match(frame().at(-1)!, /Question 1 of 2/);
    key('\x1b[B\r');
    assert.equal(frame()[0], 'Second');
    assert.match(frame().at(-1)!, /Question 2 of 2/);
    key(' \x1b[B \r');
    // The review page lists every answer before the request settles.
    assert.equal(frame()[0], 'Review your answers');
    assert.ok(frame().includes('-   B'), drawn);
    assert.ok(frame().includes('-   X, Y'), drawn);
    assert.ok(frame().includes('Ready to submit your answers?'));
    assert.ok(frame().includes('[ Submit answers ]  [ Cancel ]'));
    assert.match(frame().at(-1)!, /Enter submit/);
    key('\r');
    assert.deepEqual(await pending, { selected: [], groups: [
      { key: 'First', selected: ['B'] }, { key: 'Second', selected: ['X', 'Y'] }] });
  } finally { tui.close(); }
});

test('a grouped question can be reopened from the review page and cancelled', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  let drawn = '';
  const output = new Writable({ write(chunk, _encoding, done) { drawn += String(chunk); done(); } });
  Object.assign(output, { isTTY: true, columns: 60, rows: 14 });
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  const frame = () => drawn.slice(drawn.lastIndexOf('\x1b[H'))
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').split('\r\n').map(line => line.trim()).filter(Boolean);
  try {
    const pending = tui.prompt({ message: '', groups: [
      { key: 'First', title: 'First', message: 'Pick one', choices: [{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }] },
      { key: 'Second', title: 'Second', message: 'Pick many',
        choices: [{ label: 'X', value: 'X' }, { label: 'Y', value: 'Y' }], multiple: true },
    ] }, new AbortController().signal);
    key('\r');            // first question keeps A
    key(' \r');           // second question takes X
    assert.equal(frame()[0], 'Review your answers');
    // Left steps back one question, so it reopens the last one with its answer.
    key('\x1b[D');
    assert.equal(frame()[0], 'Second');
    assert.ok(frame().includes('Selected: X'), drawn);
    key('\x1b[D');
    assert.equal(frame()[0], 'First');
    assert.ok(frame().includes('Selected: A'), drawn);
    key('\x1b[B\r');      // change it to B, which advances to the second question
    assert.equal(frame()[0], 'Second');
    // Right on the last question opens the review page, as the last tab does.
    key('\x1b[C');
    assert.equal(frame()[0], 'Review your answers');
    key('\r');
    assert.deepEqual(await pending, { selected: [], groups: [
      { key: 'First', selected: ['B'] }, { key: 'Second', selected: ['X'] }] });
    // Escape on the review page cancels the whole request.
    const cancelled = tui.prompt({ message: '', groups: [
      { key: 'Only', title: 'Only', message: 'Pick', choices: [{ label: 'A', value: 'A' }] }] }, new AbortController().signal);
    key('\r'); key('\x1b');
    assert.equal(await cancelled, undefined);
  } finally { tui.close(); }
});

test('modal choices and Other text own input and restore the previous draft', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  let drawn = '';
  const output = new Writable({ write(chunk, _encoding, done) { drawn += String(chunk); done(); } });
  Object.assign(output, { isTTY: true, columns: 50, rows: 10 });
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  const signal = new AbortController().signal;
  const choices = [{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }];
  try {
    key('draft\x1b[D');
    const before = tui.state;
    let submissions = 0; tui.on('submit', () => { submissions++; });
    const single = tui.prompt({ title: 'Choose', message: 'Choose an option', choices, allowText: true }, signal);
    assert.equal(tui.currentScreen, 'dialog');
    assert.ok(drawn.includes('Choose an option'));
    await assert.rejects(tui.prompt({ message: 'collision' }, signal), /Another interaction/);
    key('\x1b[B\rignored\r');
    assert.deepEqual(await single, { selected: ['B'] });
    assert.deepEqual(tui.state, before);
    assert.equal(submissions, 0);
    const multi = tui.prompt({ message: 'Choose several', choices, multiple: true, allowText: true }, signal);
    key('\r'); assert.equal(tui.currentScreen, 'dialog');
    assert.ok(drawn.includes('Space selects an option'));
    key(' '); key('\x1b[B '); key('\tcustom\x1b[13;2uanswer\x1b[A\r');
    assert.deepEqual(await multi, { selected: ['A', 'B'], text: 'custom\nanswer' });
    assert.deepEqual(tui.state, before);
    const confirmation = tui.prompt({ title: 'Approve', message: Array.from({ length: 30 }, (_, i) => `plan line ${i}`).join('\n'),
      choices: [{ label: 'No', value: 'no' }, { label: 'Yes', value: 'yes' }] }, signal);
    assert.ok(drawn.slice(drawn.lastIndexOf('\x1b[H')).includes('plan line 0'));
    key('\x1b[6~'); assert.ok(drawn.slice(drawn.lastIndexOf('\x1b[H')).includes('plan line 7'));
    key('\x1b[5~'); assert.ok(drawn.slice(drawn.lastIndexOf('\x1b[H')).includes('plan line 0'));
    key('\r'); assert.deepEqual(await confirmation, { selected: ['no'] });
    assert.deepEqual(tui.state, before);
    const bounded = tui.prompt({ message: 'Small answer', maxTextChars: 4 }, signal);
    key('12345'); assert.ok(drawn.includes('Answer exceeds 4 characters'));
    key('ok\r'); assert.deepEqual(await bounded, { selected: [], text: 'ok' });
  } finally { tui.close(); }
});

test('modal cancellation abort and close settle once without changing the draft', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 40, rows: 10 });
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  try {
    key('retained');
    const controller = new AbortController();
    let settled = 0;
    const aborted = tui.prompt({ message: 'Form', allowText: true }, controller.signal).then(answer => { settled++; return answer; });
    key('partial'); controller.abort();
    assert.equal(await aborted, undefined); assert.equal(settled, 1);
    assert.equal(tui.state.text, 'retained');
    const cancelled = tui.prompt({ message: 'Form' }, new AbortController().signal);
    key('\u0003tail'); assert.equal(await cancelled, undefined);
    assert.equal(tui.state.text, 'retained');
    key('\x1b[200~stale paste');
    const duringPaste = tui.prompt({ message: 'Confirmation', choices: [{ label: 'No', value: 'no' }, { label: 'Yes', value: 'yes' }] }, new AbortController().signal);
    key('\x1b[B\r\x1b[201~');
    assert.equal(tui.currentScreen, 'dialog'); // Paste tail is drained, never interpreted as approval keys.
    key('\r'); assert.deepEqual(await duringPaste, { selected: ['no'] });
    const partialController = new AbortController();
    const partial = tui.prompt({ message: 'Form' }, partialController.signal);
    key('\x1b[200~partial'); partialController.abort();
    assert.equal(await partial, undefined);
    key('tail\r\x1b[201~'); assert.equal(tui.state.text, 'retained');
    const escaped = tui.prompt({ message: 'Form' }, new AbortController().signal);
    key('\x1b'); await new Promise(resolve => setTimeout(resolve, 70));
    assert.equal(await escaped, undefined);
    const closing = tui.prompt({ message: 'Form' }, new AbortController().signal);
    tui.close(); assert.equal(await closing, undefined);
    assert.equal(tui.state.text, 'retained');
  } finally { tui.close(); }
});

test('common action keys preserve drafts and stash swaps text with its cursor', () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 50, rows: 10 });
  const actions: string[] = [];
  const tui = new TuiTerminal({ input, output, onAction: action => actions.push(action) }).start();
  const key = (text: string) => input.emit('data', text);
  try {
    key('draft\x1b[D');
    const cursor = tui.state.cursor;
    key('\x1bp\x1bt\u0014');
    assert.deepEqual(actions, ['chat:modelPicker', 'chat:thinkingToggle', 'app:toggleTodos']);
    assert.equal(tui.state.text, 'draft'); assert.equal(tui.state.cursor, cursor);
    key('\u0013'); assert.equal(tui.state.text, '');
    key('other\u0013'); assert.equal(tui.state.text, 'draft'); assert.equal(tui.state.cursor, cursor);
    key('\u0013'); assert.equal(tui.state.text, 'other');
    key('\r\u0013'); assert.equal(tui.state.text, 'draft'); assert.equal(tui.state.cursor, cursor);
  } finally { tui.close(); }
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
  assert.match(collapsed[0]!, /\.\.\. 18 earlier lines \(ctrl\+e/);
  assert.equal(collapsed[0]!.length, 40); // The notice shares the viewport's clipping boundary.
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
