import assert from 'node:assert/strict';
import { once } from 'node:events';
import { PassThrough, Readable, Writable } from 'node:stream';
import { test } from 'node:test';
import { cellWidth, createEditorState, createTerminalInput, decodeTerminalKeybindings, layoutEditor, MAX_PASTE_BYTES,
  reduceEditor, TerminalKeyDecoder, type EditorAction, type EditorState } from '../src/terminal.js';

function edit(actions: EditorAction[], initial = createEditorState()): EditorState {
  return actions.reduce((state, action) => reduceEditor(state, action).state, initial);
}
class FakeInput extends PassThrough {
  isTTY = true;
  isRaw = false;
  rawCalls: boolean[] = [];
  setRawMode(value: boolean): this { this.isRaw = value; this.rawCalls.push(value); return this; }
  key(value: string | Buffer): void { this.emit('data', value); }
}
class FakeOutput extends Writable {
  isTTY = true;
  columns = 80;
  rows = 24;
  text = '';
  _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.text += chunk.toString(); callback();
  }
}

// A small independent screen interpreter checks rendered positions, not ANSI substrings alone.
function screen(text: string): { lines: string[]; row: number; column: number } {
  const lines: string[][] = [[]]; let row = 0, column = 0;
  for (let offset = 0; offset < text.length;) {
    const ansi = /^\x1b\[([?\d;]*)([A-Za-z])/u.exec(text.slice(offset));
    if (ansi) {
      const value = Number(ansi[1]) || 1;
      if (ansi[2] === 'A') row = Math.max(0, row - value);
      else if (ansi[2] === 'C') column += value;
      else if (ansi[2] === 'J') { lines[row] = (lines[row] ?? []).slice(0, column); lines.length = row + 1; }
      offset += ansi[0].length; continue;
    }
    const character = String.fromCodePoint(text.codePointAt(offset)!); offset += character.length;
    if (character === '\r') column = 0;
    else if (character === '\n') { row++; lines[row] ??= []; }
    else { lines[row] ??= []; lines[row]![column++] = character; }
  }
  return { lines: lines.map(line => line.join('')), row, column };
}

test('pure editor inserts, deletes and navigates within each logical line', () => {
  const initial = createEditorState();
  const state = edit([{ type: 'insert', text: 'ac' }, { type: 'left' }, { type: 'insert', text: 'b' },
    { type: 'home' }, { type: 'delete' }, { type: 'end' }, { type: 'backspace' },
    { type: 'newline' }, { type: 'insert', text: 'xy' }, { type: 'home' }], initial);
  assert.equal(state.text, 'b\nxy'); assert.equal(state.cursor, 2);
  assert.equal(edit([{ type: 'up' }], state).cursor, 0);
  assert.equal(edit([{ type: 'end' }], state).cursor, 4);
  assert.equal(initial.text, ''); assert.equal(initial.cursor, 0);
});

test('grapheme editing preserves astral, combining, emoji and cell widths', () => {
  const text = 'a\u{1f600}é\u{1f469}‍\u{1f4bb}中';
  let state = edit([{ type: 'insert', text }]);
  state = edit([{ type: 'left' }, { type: 'backspace' }], state);
  assert.equal(state.text, 'a\u{1f600}é中');
  state = edit([{ type: 'backspace' }, { type: 'left' }, { type: 'delete' }], state);
  assert.equal(state.text, 'a中'); assert.equal(state.cursor, 1);
  assert.equal(cellWidth('a\u{1f600}é\u{1f469}‍\u{1f4bb}中'), 8);
  assert.equal(cellWidth('\u{1f1e8}\u{1f1f3}'), 2);
  assert.equal(cellWidth('́'), 0);
  state = edit([{ type: 'insert', text: '中A\nxyz' }, { type: 'up' }]);
  assert.equal(state.cursor, 2); // Three cells map to two UTF-16 code units on the first line.
});

test('word motions and key mappings decode common terminal sequences', () => {
  const decoder = new TerminalKeyDecoder();
  const state = edit(decoder.push('one two-three\x1b[1;5D\x1bb'));
  assert.equal(state.cursor, 4);
  assert.equal(edit(decoder.push('\x1bf'), state).cursor, 8);
  assert.equal(edit(decoder.push('\x1b[1;5C'), state).cursor, 8);
  assert.deepEqual(decoder.push('\x1b[13;2u\x1b\r\x1b[27;2;13~\x1b[3~'),
    [{ type: 'newline' }, { type: 'newline' }, { type: 'newline' }, { type: 'delete' }]);
  assert.deepEqual(new TerminalKeyDecoder({ '\r': 'newline', '\u0013': 'submit' }).push('\r\u0013'),
    [{ type: 'newline' }, { type: 'submit' }]);
  assert.deepEqual(new TerminalKeyDecoder({ '\u0012': null }).push('\u0012'), []);
});

test('local keybinding JSON validation rejects empty keys and unsupported commands', () => {
  assert.deepEqual({ ...decodeTerminalKeybindings(JSON.parse('{"\\u0013":"submit","\\r":"newline"}')) },
    { '\u0013': 'submit', '\r': 'newline' });
  assert.throws(() => new TerminalKeyDecoder({ '': 'submit' }), /1 to 64/);
  assert.throws(() => decodeTerminalKeybindings({ x: 'execute' }), /Unknown terminal command/);
  assert.throws(() => decodeTerminalKeybindings([]), /must be an object/);
  const decoder = new TerminalKeyDecoder({ '\u0013x': 'submit' });
  assert.deepEqual(decoder.push('\u0013'), []);
  assert.deepEqual(decoder.push('x'), [{ type: 'submit' }]);
});

test('history moves only at first/last line and restores draft, bounded deduplicated history', () => {
  let state = edit([{ type: 'insert', text: 'draft\nsecond' }], createEditorState(['old', 'last\nline']));
  state = edit([{ type: 'up' }], state);
  assert.equal(state.text, 'draft\nsecond'); assert.equal(state.cursor, 5);
  state = edit([{ type: 'up' }], state);
  assert.equal(state.text, 'last\nline'); assert.equal(state.cursor, 4);
  state = edit([{ type: 'up' }], state); assert.equal(state.text, 'old');
  state = edit([{ type: 'down' }, { type: 'down' }], state); assert.equal(state.text, 'draft\nsecond');
  assert.equal(state.cursor, state.text.length);
  const result = reduceEditor(state, { type: 'submit' }, { historyLimit: 2 });
  assert.deepEqual(result.effects, [{ type: 'submit', text: 'draft\nsecond' }]);
  assert.deepEqual(result.state.history, ['last\nline', 'draft\nsecond']);
  assert.deepEqual(edit([{ type: 'insert', text: 'draft\nsecond' }, { type: 'submit' }], result.state).history,
    result.state.history);
  assert.deepEqual(reduceEditor(state, { type: 'submit' }, { historyLimit: 0 }).state.history, []);
});

test('reverse history search repeats and typing detaches from recalled history', () => {
  let state = edit([{ type: 'insert', text: 'find' }, { type: 'search' }],
    createEditorState(['find first', 'other', 'find second']));
  assert.equal(state.text, 'find second');
  state = edit([{ type: 'search' }], state); assert.equal(state.text, 'find first');
  state = edit([{ type: 'insert', text: '!' }, { type: 'down' }], state);
  assert.equal(state.text, 'find first!'); assert.equal(state.historyIndex, 3);
});

test('decoder handles UTF-8/escape/paste splits and CRLF submits once', () => {
  const decoder = new TerminalKeyDecoder();
  const emoji = Buffer.from('\u{1f600}');
  assert.deepEqual(decoder.push(emoji.subarray(0, 2)), []);
  assert.deepEqual(decoder.push(emoji.subarray(2)), [{ type: 'insert', text: '\u{1f600}' }]);
  assert.deepEqual(decoder.push('\x1b['), []);
  assert.deepEqual(decoder.push('D'), [{ type: 'left' }]);
  assert.deepEqual(decoder.push('\x1b[20'), []);
  assert.deepEqual(decoder.push('0~a\nb\r\nc\x1b[2'), []);
  assert.deepEqual(decoder.push('01~'), [{ type: 'paste', text: 'a\nb\r\nc' }]);
  assert.deepEqual(decoder.push('\r'), [{ type: 'submit' }]);
  assert.deepEqual(decoder.push('\n'), []);
  assert.deepEqual(decoder.push('\x1b[99~ok'), [{ type: 'insert', text: 'ok' }]);
  decoder.push('\x1b'); decoder.flushEscape();
  assert.deepEqual(decoder.push('x'), [{ type: 'insert', text: 'x' }]);
});

test('bracketed paste preserves multiline, strips controls and rejects over 256 KiB atomically', () => {
  const decoder = new TerminalKeyDecoder();
  assert.deepEqual(decoder.push('\x1b[200~a\nb\x03\x1b[201~'), [{ type: 'paste', text: 'a\nb\x03' }]);
  assert.equal(edit([{ type: 'paste', text: 'a\r\nb\x03\x1b[31m' }]).text, 'a\nb[31m');
  const initial = edit([{ type: 'insert', text: 'draft' }]);
  const result = reduceEditor(initial, { type: 'paste', text: 'x'.repeat(MAX_PASTE_BYTES + 1) });
  assert.equal(result.state.text, 'draft');
  assert.deepEqual(result.effects, [{ type: 'pasteRejected', bytes: MAX_PASTE_BYTES + 1 }]);
  decoder.push('\x1b[200~');
  for (let i = 0; i < 5; i++) assert.deepEqual(decoder.push('x'.repeat(64 * 1024)), []);
  assert.deepEqual(decoder.push('\x1b[201~ok'),
    [{ type: 'pasteRejected', bytes: 320 * 1024 }, { type: 'insert', text: 'ok' }]);
  const small = new TerminalKeyDecoder({}, 3);
  assert.deepEqual(small.push('\x1b[200~abcd\x1b[201~'), [{ type: 'pasteRejected', bytes: 4 }]);
});

test('render layout handles multiline, wide characters, wrapping and bounded viewport', () => {
  const state = edit([{ type: 'insert', text: '中\u{1f600}\nhi' }]);
  assert.deepEqual(layoutEditor(state, 20), {
    lines: ['> 中\u{1f600}', '  hi'], cursorRow: 1, cursorColumn: 4, hiddenRows: 0,
  });
  assert.deepEqual(layoutEditor({ text: 'abcdef', cursor: 6 }, 5), {
    lines: ['> abc', 'def'], cursorRow: 1, cursorColumn: 3, hiddenRows: 0,
  });
  assert.deepEqual(layoutEditor({ text: 'abc', cursor: 3 }, 5), {
    lines: ['> abc', ''], cursorRow: 1, cursorColumn: 0, hiddenRows: 0,
  });
  const clipped = layoutEditor({ text: 'a\nb\nc\nd', cursor: 7 }, 20, '> ', '  ', 2);
  assert.deepEqual(clipped.lines, ['  c', '  d']); assert.equal(clipped.cursorRow, 1);
  assert.equal(clipped.hiddenRows, 2);
  const wideWrap = layoutEditor({ text: 'ab中', cursor: 2 }, 5);
  assert.deepEqual(wideWrap.lines, ['> ab', '中']);
  assert.equal(wideWrap.cursorRow, 1); assert.equal(wideWrap.cursorColumn, 0);
});

test('Ctrl-C first cancels running model without losing draft; idle behavior is configurable', () => {
  let state = edit([{ type: 'insert', text: 'draft' }, { type: 'running', value: true }]);
  let result = reduceEditor(state, { type: 'interrupt' });
  assert.deepEqual(result.effects, [{ type: 'interrupt' }]); assert.equal(result.state.text, 'draft');
  state = result.state;
  assert.deepEqual(reduceEditor(state, { type: 'interrupt' }).effects, []);
  assert.deepEqual(reduceEditor(state, { type: 'eof' }).effects, []);
  state = edit([{ type: 'running', value: false }], state);
  result = reduceEditor(state, { type: 'interrupt' }); assert.equal(result.state.text, '');
  assert.deepEqual(result.effects, []);
  assert.deepEqual(reduceEditor(result.state, { type: 'interrupt' }).effects, [{ type: 'exit' }]);
  assert.deepEqual(reduceEditor(state, { type: 'interrupt' }, { idleInterrupt: 'exit' }).effects, [{ type: 'exit' }]);
  assert.deepEqual(reduceEditor(createEditorState(), { type: 'interrupt' }, { idleInterrupt: 'clear' }).effects, []);
  assert.deepEqual(reduceEditor(state, { type: 'eof' }).effects, [{ type: 'exit' }]);
});

test('TTY events preserve paste as one submission and raw/ANSI cleanup is idempotent', () => {
  const input = new FakeInput(), output = new FakeOutput();
  const submitted: string[] = []; let interrupts = 0, exits = 0;
  const terminal = createTerminalInput({ input, output, onSubmit: text => submitted.push(text),
    onInterrupt: () => interrupts++, onExit: () => exits++ });
  assert.equal(terminal.isTTY, true); terminal.start().start();
  assert.deepEqual(input.rawCalls, [true]);
  input.key('\x1b[200~one\ntwo\x1b[201~'); assert.deepEqual(submitted, []);
  input.key('\r'); assert.deepEqual(submitted, ['one\ntwo']);
  terminal.setRunning(true); input.key('draft\x03\x03\x04');
  assert.equal(interrupts, 1); assert.equal(exits, 0); assert.equal(terminal.state.text, 'draft');
  terminal.setRunning(false); input.key('\x04'); terminal.close();
  assert.equal(exits, 1); assert.deepEqual(input.rawCalls, [true, false]);
  assert.equal(input.isRaw, false); assert.equal(input.isPaused(), true);
  assert.equal(input.listenerCount('data'), 0); assert.equal(input.listenerCount('end'), 0);
  assert.equal(input.listenerCount('close'), 0); assert.equal(input.listenerCount('error'), 0);
  assert.equal(output.listenerCount('resize'), 0);
  assert.ok(output.text.endsWith('\x1b[?2004l\x1b[0m\x1b[?25h'));
});

test('TTY streamed output continues partial lines and keeps edited multiline prompt intact', () => {
  const input = new FakeInput(), output = new FakeOutput();
  const terminal = createTerminalInput({ input, output }).start();
  input.key('draft\x1b\rnext\x1b[D');
  terminal.outputStream.write('hello'); input.key('!'); terminal.write(' world\n');
  const view = screen(output.text);
  assert.deepEqual(view.lines, ['hello world', '> draft', '  nex!t']);
  assert.equal(view.row, 2); assert.equal(view.column, 6);
  assert.equal(terminal.state.text, 'draft\nnex!t');
  output.columns = 20; output.emit('resize');
  assert.deepEqual(screen(output.text).lines, view.lines);
  const draft = terminal.state, offset = output.text.length;
  const raw = "\x1b]2;fixture\x1b\\", escaped = raw.replaceAll("\x1b", "\x1b\x1b");
  const expected = process.env.TMUX ? `\x1bPtmux;${escaped}\x1b\\` : process.env.STY ? `\x1bP${escaped}\x1b\\` : raw;
  terminal.writeTerminalSequence("\x1b]2;fixture\x07");
  assert.equal(output.text.slice(offset), expected);
  assert.deepEqual(terminal.state, draft);
  terminal.writeTerminalSequence("\x1b[2J");
  assert.equal(output.text.slice(offset), expected);
  terminal.close();
});

test('hot keybindings preserve draft, pending paste and validation rollback', () => {
  const input = new FakeInput(), output = new FakeOutput();
  const submitted: string[] = [];
  const terminal = createTerminalInput({ input, output, onSubmit: text => submitted.push(text) }).start();
  try {
    input.key('draft\x1b[200~part');
    terminal.setKeybindings({ '\u0013': 'submit', '\r': 'newline' });
    input.key(' rest\x1b[201~\rnext');
    assert.equal(terminal.state.text, 'draftpart rest\nnext');
    assert.throws(() => terminal.setKeybindings({ '\u0013': 'bad' as never }), /Unknown terminal command/);
    input.key('\u0013');
    assert.deepEqual(submitted, ['draftpart rest\nnext']);
    terminal.setKeybindings(); input.key('default\r');
    assert.deepEqual(submitted, ['draftpart rest\nnext', 'default']);
  } finally { terminal.close(); }
});

test('submitting while a partial model line is visible keeps submission on a separate line', () => {
  const input = new FakeInput(), output = new FakeOutput();
  const terminal = createTerminalInput({ input, output }).start();
  terminal.write('partial'); input.key('queued\r');
  assert.deepEqual(screen(output.text).lines, ['partial', '> queued', '> ']);
  terminal.close();
});

test('outputStream preserves UTF-8 code points split across byte writes', async () => {
  const input = new FakeInput(), output = new FakeOutput();
  const terminal = createTerminalInput({ input, output }).start();
  const bytes = Buffer.from('\u{1f600}');
  terminal.outputStream.write(bytes.subarray(0, 2)); terminal.outputStream.end(bytes.subarray(2));
  await once(terminal.outputStream, 'finish');
  assert.equal(output.text.includes('�'), false); assert.equal(output.text.includes('\u{1f600}'), true);
  terminal.close();
});

test('cleanup preserves already-raw input and preexisting listeners, including failures', () => {
  const input = new FakeInput(), output = new FakeOutput(); input.isRaw = true;
  const listener = () => {}; input.on('data', listener);
  const terminal = createTerminalInput({ input, output }).start(); terminal.close();
  assert.deepEqual(input.rawCalls, []); assert.equal(input.isRaw, true);
  assert.equal(input.listenerCount('data'), 1); input.off('data', listener);
  const other = new FakeInput(), failing = new FakeOutput();
  const fail = createTerminalInput({ input: other, output: failing }).start();
  const original = failing.write;
  failing.write = (() => { throw new Error('fixture write failure'); }) as typeof failing.write;
  assert.throws(() => fail.close(), /fixture write failure/);
  assert.deepEqual(other.rawCalls, [true, false]); assert.equal(other.listenerCount('data'), 0);
  failing.write = original; fail.close();
});

test('non-TTY fallback emits lines, EOF and byte-identical output without raw mode/ANSI', async () => {
  for (const tty of [{ input: false, output: true }, { input: true, output: false }]) {
    const input = new FakeInput(), output = new FakeOutput(); input.isTTY = tty.input; output.isTTY = tty.output;
    const submitted: string[] = [];
    const terminal = createTerminalInput({ input, output, onSubmit: text => submitted.push(text) });
    const exited = once(terminal, 'exit'); terminal.start(); terminal.outputStream.write('plain\noutput');
    input.end('one\r\ntwo\nlast'); await exited;
    assert.equal(terminal.isTTY, false); assert.deepEqual(input.rawCalls, []);
    assert.deepEqual(submitted, ['one', 'two', 'last']); assert.equal(output.text, 'plain\noutput');
    assert.equal(input.listenerCount('data'), 0); assert.equal(input.listenerCount('error'), 0);
  }
  const output = new FakeOutput(); output.isTTY = false;
  const terminal = createTerminalInput({ input: Readable.from(['task\n']), output });
  const exited = once(terminal, 'exit'); terminal.start(); await exited;
  assert.equal(output.text, '');
});

test('subscription teardown, input errors and close-before-start release their ownership', () => {
  const input = new FakeInput(), output = new FakeOutput();
  const terminal = createTerminalInput({ input, output }); let submissions = 0;
  const unsubscribe = terminal.subscribe({ onSubmit: () => submissions++ });
  unsubscribe(); terminal.start(); input.key('task\r'); assert.equal(submissions, 0);
  let failure: Error | undefined, exits = 0;
  terminal.on('inputError', error => { failure = error; }); terminal.on('exit', () => exits++);
  input.emit('error', new Error('input fixture'));
  assert.equal(failure?.message, 'input fixture'); assert.deepEqual(input.rawCalls, [true, false]);
  assert.equal(exits, 1);
  const idleInput = new FakeInput(), idleOutput = new FakeOutput();
  const idle = createTerminalInput({ input: idleInput, output: idleOutput }); idle.close(); idle.start();
  assert.deepEqual(idleInput.rawCalls, []); assert.equal(idleOutput.text, '');
});
