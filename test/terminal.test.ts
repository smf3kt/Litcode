import assert from 'node:assert/strict';
import { once } from 'node:events';
import { PassThrough, Readable, Writable } from 'node:stream';
import { test } from 'node:test';
import { inputCursor, layoutInput } from '../src/tui-input-navigation.js';
import { At } from '../src/tui-input-cursor.js';
import { InputUndo } from '../src/tui-input-undo.js';
import { InputPaste, expandPastedText } from '../src/tui-input-paste.js';
import { cellWidth, createEditorState, createTerminalInput, decodeTerminalKeybindings, layoutEditor, MAX_PASTE_BYTES,
  questionPreviewText, reduceEditor, TerminalKeyDecoder, type EditorAction, type EditorState } from '../src/terminal.js';

function edit(actions: EditorAction[], initial = createEditorState()): EditorState {
  return actions.reduce((state, action) => reduceEditor(state, action).state, initial);
}
test('question previews use the recovered sanitise pass', () => {
  const withheld = '(preview cannot be shown in full — compare the option labels and descriptions instead)';
  assert.equal(questionPreviewText(undefined), undefined);
  assert.equal(questionPreviewText('a\u0007b'), 'a�b');
  assert.equal(questionPreviewText('a\tb'), 'a       b');
  assert.equal(questionPreviewText('a​b'), 'a�b');
  assert.equal(questionPreviewText('a‌b'), 'a‌b');
  assert.equal(questionPreviewText('a\r\nb'), 'a�\nb');
  assert.equal(questionPreviewText('�'), undefined);
  assert.equal(questionPreviewText('… [+3 graphemes]'), withheld);
  assert.equal(questionPreviewText('a' + '́'.repeat(9)), withheld);
  assert.equal(questionPreviewText('x'.repeat(2001)), withheld);
});

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
  assert.deepEqual(decoder.push('\x1b[13u'), [{ type: 'submit' }]);
  assert.deepEqual(decoder.push('\x1b[99;6u'), [{ type: 'selectionCopy' }]);
  // Shift+arrows extend a selection and shift+home/end reach the line ends.
  assert.deepEqual(decoder.push('\x1b[1;2D\x1b[1;2C\x1b[1;2A\x1b[1;2B\x1b[1;2H\x1b[1;2F'), [
    { type: 'extendLeft' }, { type: 'extendRight' }, { type: 'extendUp' }, { type: 'extendDown' },
    { type: 'extendLineStart' }, { type: 'extendLineEnd' },
  ]);
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

test('source terminal responses stay outside editor text across splits, modal boundaries and overlong strings', () => {
  const reports = ['\x1b]11;rgb:ffff/ffff/ffff\x07', '\x1b]11;#000\x1b\\', '\x1b[?997;2n', '\x1b[?1;2c'];
  const expected = [{ type: 'terminalResponse', response: { type: 'osc', code: 11, data: 'rgb:ffff/ffff/ffff' } },
    { type: 'terminalResponse', response: { type: 'osc', code: 11, data: '#000' } },
    { type: 'terminalResponse', response: { type: 'themeNotify', dark: false } },
    { type: 'terminalResponse', response: { type: 'da1', params: [1, 2] } }];
  for (const [index, report] of reports.entries()) {
    for (let split = 1; split < report.length; split++) {
      const decoder = new TerminalKeyDecoder();
      assert.deepEqual(decoder.push(report.slice(0, split)), []);
      assert.deepEqual(decoder.push(report.slice(split)), [expected[index]]);
    }
    const state = edit([{ type: 'insert', text: 'retained' }]);
    assert.equal(reduceEditor(state, new TerminalKeyDecoder().push(report)[0]!).state, state);
  }
  const decoder = new TerminalKeyDecoder(); decoder.push('\x1b]11;rgb:'); decoder.discardPending();
  assert.deepEqual(decoder.push('ffff/ffff/ffff\x07ok'), [expected[0], { type: 'insert', text: 'ok' }]);
  for (const ending of ['\x07', '\x1b\\']) {
    const large = new TerminalKeyDecoder(); const actions: EditorAction[] = [];
    for (const character of '\x1b]11;' + 'x'.repeat(400) + ending + 'ok') actions.push(...large.push(character));
    assert.equal(edit(actions).text, 'ok'); assert.ok(actions.every(action => action.type === 'insert'));
  }
  assert.deepEqual(new TerminalKeyDecoder().push('\x1bPunknown\x1b\\x'), [{ type: 'insert', text: 'x' }]);
  assert.deepEqual(new TerminalKeyDecoder().push('\x1b_x'), [{ type: 'insert', text: 'x' }]);
  assert.deepEqual(new TerminalKeyDecoder().push('\x1b[200~' + reports[0] + '\x1b[201~'), [{ type: 'paste', text: reports[0] }]);
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

test('a submit drops placeholders whose paste record is gone and hands the prompt back', () => {
  const gone = { id: 1, type: 'text' as const, content: '', unavailable: true };
  const onlyPlaceholder: EditorState = { ...createEditorState(), text: '[Pasted text #1 +2 lines]',
    cursor: 8, pastedContents: { 1: gone } };
  const cancelled = reduceEditor(onlyPlaceholder, { type: 'submit' });
  assert.deepEqual(cancelled.effects, [{ type: 'pasteGone',
    text: 'Pasted text #1 is no longer available and was removed from the prompt' }]);
  assert.equal(cancelled.state.text, onlyPlaceholder.text);
  assert.equal(cancelled.state.cursor, onlyPlaceholder.text.length);
  // A slash command that only held the gone paste is handed back too.
  const command: EditorState = { ...onlyPlaceholder, text: '/review [Pasted text #1 +2 lines]' };
  assert.deepEqual(reduceEditor(command, { type: 'submit' }).effects, [{ type: 'pasteGone',
    text: 'Pasted text #1 is no longer available and was removed from the prompt' }]);
  // With text left over, the prompt is sent without the placeholder and still announces it.
  const mixed: EditorState = { ...onlyPlaceholder, text: 'hello [Pasted text #1 +2 lines]' };
  assert.deepEqual(reduceEditor(mixed, { type: 'submit' }).effects, [
    { type: 'pasteGone', text: 'Pasted text #1 is no longer available and was removed from the prompt' },
    { type: 'submit', text: 'hello ' }]);
  // A live record still expands, and several gone pastes are listed together.
  const live: EditorState = { ...mixed, pastedContents: { 1: { id: 1, type: 'text', content: 'PASTED' } } };
  assert.deepEqual(reduceEditor(live, { type: 'submit' }).effects, [{ type: 'submit', text: 'hello PASTED' }]);
  const two: EditorState = { ...onlyPlaceholder, text: '[Pasted text #1][Image #2][...Truncated text #3]',
    pastedContents: { 1: gone, 3: gone } };
  // An image placeholder is never stripped, so what is left of the draft still goes out.
  assert.deepEqual(reduceEditor(two, { type: 'submit' }).effects, [
    { type: 'pasteGone',
      text: 'Pasted text #1, Truncated text #3 are no longer available and were removed from the prompt' },
    { type: 'submit', text: '[Image #2]' }]);
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

test('copied input navigation follows visual rows, readline words and whole placeholders without changing raw text', () => {
  const cursor = inputCursor('abcdefghijk', 6, 8);
  assert.deepEqual(cursor.getPosition(), { line: 1, column: 3 });
  assert.equal(cursor.up().offset, 3); assert.equal(cursor.down().offset, 11);
  assert.equal(cursor.startOfLine().offset, 5); assert.equal(cursor.endOfLine().offset, 10);
  assert.deepEqual(layoutInput({ text: cursor.text, cursor: 8 }, 6, 2), {
    lines: ['abcde', 'fghij'], cursorRow: 1, cursorColumn: 3, hiddenRows: 1, viewportStartRow: 0,
    // Each row also reports the draft offset it starts at, which is what the highlight row mapping is
    // handed together with the rendered value.
    rowStartOffsets: [0, 5],
  });
  assert.equal(inputCursor('one two-three', 40, 4).forwardWord().offset, 7);
  const placeholder = '[Pasted text #1 +3 lines]';
  assert.equal(inputCursor(placeholder + ' tail', 40, placeholder.length).left().offset, 0);
  assert.equal(inputCursor(placeholder + ' tail', 40, 0).right().offset, placeholder.length);
  const raw = 'a\u{1f469}‍\u{1f4bb}é中\u{2fa1d}';
  const end = inputCursor(raw, 8, raw.length);
  assert.equal(end.text, raw);
  assert.equal(end.left().offset, raw.length - 2);
  assert.equal(end.left().left().offset, raw.length - 3);
  assert.equal(layoutInput({ text: raw, cursor: raw.length }, 8, 4).lines.join(''), raw);
  const fallback = At('abcdef', 3, () => 'different rows');
  assert.equal(fallback.degraded, true);
  assert.deepEqual(fallback.rows.map((row: { text: string }) => row.text), ['abc', 'def']);
  const columns = 8;
  const initial = { ...createEditorState(['old task']), text: 'abcdefghijk', cursor: 8 };
  assert.equal(reduceEditor(initial, { type: 'up' }, { navigationColumns: columns }).state.cursor, 1);
  assert.equal(reduceEditor(initial, { type: 'logicalHome' }, { navigationColumns: columns }).state.cursor, 0);
});

test('TTY measured navigation submits edits from wrapped rows and preserves history and Unicode', () => {
  const input = new FakeInput(), output = new FakeOutput(); output.columns = 10;
  const submitted: string[] = [];
  const terminal = createTerminalInput({ input, output, history: ['previous'], onSubmit: text => submitted.push(text) }).start();
  try {
    input.key('abcdefghijk\x1b[A'); assert.equal(terminal.state.cursor, 4);
    input.key('X\x1b[B'); assert.equal(terminal.state.cursor, 12);
    input.key('\x1b[H'); assert.equal(terminal.state.cursor, 7);
    input.key('Y\u0001'); assert.equal(terminal.state.cursor, 0);
    input.key('Z\u0005\r'); assert.deepEqual(submitted, ['ZabcdXefYghijk']);
    input.key('\x1b[A'); assert.equal(terminal.state.text, submitted[0]);
    input.key('\u0005\x1b[B'); assert.equal(terminal.state.text, '');
    const raw = 'é\u{1f469}‍\u{1f4bb}中';
    input.key(raw + '\x1b[D!\r'); assert.equal(submitted[1], 'é\u{1f469}‍\u{1f4bb}!中');
  } finally { terminal.close(); }
  assert.equal(input.isRaw, false); assert.equal(input.listenerCount('data'), 0);
  const clippedInput = new FakeInput(), clippedOutput = new FakeOutput();
  clippedOutput.columns = 10; clippedOutput.rows = 3;
  const clipped = createTerminalInput({ input: clippedInput, output: clippedOutput }).start();
  try {
    clippedInput.key('abcdefghijklmnopqrstuvwx\u0001');
    assert.ok(screen(clippedOutput.text).lines.some(row => row === '> abcdefg'));
    clippedInput.key('\u0005');
    assert.ok(screen(clippedOutput.text).lines.some(row => row === '  opqrstu'));
  } finally { clipped.close(); }
});

test('source kills coalesce by direction and yank spans survive only consecutive yank commands', () => {
  const decoder = new TerminalKeyDecoder();
  const apply = (value: string, initial = createEditorState()) => decoder.push(value)
    .reduce((state, action) => reduceEditor(state, action, { navigationColumns: 38 }).state, initial);
  let state = apply('alpha beta gamma\u0017\u0017');
  assert.equal(state.text, 'alpha '); assert.deepEqual(state.killRing.ring, ['beta gamma']);
  state = apply('\u0019\r', state); assert.equal(state.text, '');
  assert.deepEqual(state.killRing.ring, ['beta gamma']); assert.equal(state.killRing.mode.type, 'idle');
  state = apply('one two-three\x1b\u007f\x1b[D\x1b\u007f\u0019\x1by', state);
  assert.equal(state.text, 'one three-');
  assert.deepEqual(state.killRing.mode, { type: 'yanked', start: 4, length: 5, index: 1 });
  state = apply('X\x1by', state); assert.equal(state.text, 'one threeX-');
  assert.equal(state.killRing.mode.type, 'idle');
  const original = apply('\x1b[200~ab\ncd\x1b[201~\u0001\u000b\u0015');
  assert.equal(original.text, 'ab'); assert.deepEqual(original.killRing.ring, ['\ncd']);
  assert.equal(apply('\u0019', original).text, 'ab\ncd');
  assert.equal(apply('one two-three\u0017').text, 'one ');
  assert.equal(apply('one two-three\x1b\u007f').text, 'one two-');
  const forward = apply('one two three\u0001\x1bd\x1bd');
  assert.equal(forward.text, ' three'); assert.deepEqual(forward.killRing.ring, ['one two']);
  assert.equal(apply('[Pasted text #1 +3 lines]\u0017').text, '');
  const raw = 'é\u{1f469}‍\u{1f4bb}中';
  assert.equal(apply(raw + '\u0015\u0019').text, raw);
  const limited = apply('large\u0015');
  const denied = reduceEditor(limited, { type: 'yank' }, { maxPasteBytes: 3 });
  assert.equal(denied.state.text, ''); assert.deepEqual(denied.state.killRing, limited.killRing);
  assert.deepEqual(denied.effects, [{ type: 'pasteRejected', bytes: 5 }]);
  assert.equal(limited.text, ''); assert.equal(createEditorState().killRing.ring.length, 0);
  const wrapped = { ...createEditorState(), text: 'abcdefghijk', cursor: 8 };
  const killed = reduceEditor(wrapped, { type: 'killLineStart' }, { navigationColumns: 6 }).state;
  assert.equal(killed.text, 'abcdeijk'); assert.deepEqual(killed.killRing.ring, ['fgh']);
});

test('line TTY kill defaults, overrides and running cancellation retain a per-owner ring', () => {
  const input = new FakeInput(), output = new FakeOutput(); output.columns = 40;
  const submitted: string[] = [];
  const terminal = createTerminalInput({ input, output, onSubmit: text => submitted.push(text) }).start();
  try {
    input.key('first second\u0017\u0019\r'); assert.deepEqual(submitted, ['first second']);
    input.key('\u0019'); assert.equal(terminal.state.text, 'second');
    terminal.setRunning(true); input.key('\u0003'); terminal.setRunning(false);
    assert.equal(terminal.state.text, 'second'); assert.equal(terminal.state.killRing.mode.type, 'idle');
    input.key('\u0003\u0019'); assert.equal(terminal.state.text, 'second');
    terminal.setKeybindings({ '\u0017': null }); input.key('\u0017'); assert.equal(terminal.state.text, 'second');
    terminal.setKeybindings({ '\u0015': 'submit' }); input.key('\u0015');
    assert.deepEqual(submitted, ['first second', 'second']);
    const snapshot = terminal.state; snapshot.killRing.ring.length = 0;
    assert.deepEqual(terminal.state.killRing.ring, ['second']);
  } finally { terminal.close(); }
  const isolatedInput = new FakeInput(), isolatedOutput = new FakeOutput();
  const isolated = createTerminalInput({ input: isolatedInput, output: isolatedOutput }).start();
  try { isolatedInput.key('\u0019'); assert.equal(isolated.state.text, ''); }
  finally { isolated.close(); }
});

test('source text paste folds at character and row thresholds and expands exact raw payloads', () => {
  const empty = () => ({text:'',cursor:0,pastedContents:{}});
  assert.equal(new InputPaste().paste(empty(),'x'.repeat(800),24).text.length,800);
  const owner = new InputPaste(), raw='one\ntwo\nthree\nfour';
  let state=owner.paste(empty(),raw,24);
  assert.equal(state.text,'[Pasted text #1 +3 lines]'); assert.equal(expandPastedText(state.text,state.pastedContents),raw);
  state=owner.paste(state,raw,24); assert.equal(state.text,raw); assert.deepEqual(state.pastedContents,{});
  state=owner.paste(state,'x'.repeat(801),24); assert.match(state.text,/\[Pasted text #2\]$/);
  assert.equal(new InputPaste().paste(empty(),'a\nb',10).text,'[Pasted text #1 +1 lines]');
  const collision=new InputPaste().paste({text:'[Pasted text #7]',cursor:'[Pasted text #7]'.length,pastedContents:{}},'x'.repeat(801),24);
  assert.equal(collision.text,'[Pasted text #7][Pasted text #8]');
  assert.equal(expandPastedText(collision.text,collision.pastedContents),'[Pasted text #7]'+'x'.repeat(801));
  const normalized=new InputPaste().paste(empty(),'\x1b[31mé👩‍💻\x1b[0m\tA\rB\r\nC',24);
  assert.equal(normalized.text,'é👩‍💻    A\nB\nC');
});

test('line folded paste travels through undo and history while rejection and close retain ownership', context => {
  context.mock.timers.enable({apis:['setTimeout','Date'],now:10000});
  const input=new FakeInput(),output=new FakeOutput(),submitted:string[]=[];
  const terminal=createTerminalInput({input,output,onSubmit:text=>submitted.push(text)}).start();
  const raw='one\ntwo\nthree\nfour',paste='\x1b[200~'+raw+'\x1b[201~';
  try {
    input.key(paste); assert.equal(terminal.state.text,'[Pasted text #1 +3 lines]');
    context.mock.timers.tick(1100);input.key(' suffix\u001f');assert.equal(terminal.state.text,'[Pasted text #1 +3 lines]');
    const snapshot=terminal.state;snapshot.pastedContents['1']!.content='external mutation';
    input.key('\r');assert.deepEqual(submitted,[raw]);assert.deepEqual(terminal.state.pastedContents,{});
    input.key('\x1b[A\r');assert.deepEqual(submitted,[raw,raw]);
    input.key(paste);assert.match(terminal.state.text,/\[Pasted text #2 /);
    input.key(paste);assert.equal(terminal.state.text,raw);assert.deepEqual(terminal.state.pastedContents,{});
    input.key('\u0003');assert.equal(terminal.state.text,'');
    input.key('two\u0012\r');assert.equal(submitted.at(-1),raw);
    input.key(paste);const marker=terminal.state.text;
    input.key('\u007f');assert.equal(terminal.state.text,'');assert.deepEqual(terminal.state.pastedContents,{});
    input.key(marker+'\r');assert.equal(submitted.at(-1),marker);
    input.key(paste+'\u0015scratch\u0003\u0019\r');assert.equal(submitted.at(-1),raw);
    terminal.close();assert.deepEqual(terminal.state.pastedContents,{});assert.deepEqual(terminal.state.historyPastes,[]);
    const before=output.text;context.mock.timers.tick(2000);assert.equal(output.text,before);
  } finally {terminal.close();context.mock.timers.reset();}
  const limitedInput=new FakeInput(),limitedOutput=new FakeOutput();
  const limited=createTerminalInput({input:limitedInput,output:limitedOutput,maxPasteBytes:3}).start();
  try {limitedInput.key(paste);assert.equal(limited.state.text,'');assert.deepEqual(limited.state.pastedContents,{});}
  finally {limited.close();}
});

test('copied undo buffer debounces snapshots, cancels pending work and truncates the undone branch', context => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
  const undo = new InputUndo();
  try {
    undo.record('first', 2); assert.equal(undo.canUndo, true);
    context.mock.timers.tick(100); undo.record('second', 3);
    context.mock.timers.tick(900); undo.record('third', 4);
    assert.equal(undo.undo()?.text, 'third');
    assert.equal(undo.undo()?.text, 'first'); assert.equal(undo.undo(), undefined);
    context.mock.timers.tick(2000); assert.equal(undo.canUndo, false);
    undo.record('a', 1, { immediate: true }); undo.record('b', 1, { immediate: true });
    undo.record('c', 1, { immediate: true }); assert.equal(undo.undo()?.text, 'c');
    undo.record('new branch', 10, { immediate: true }); assert.equal(undo.undo()?.text, 'new branch');
    assert.equal(undo.undo()?.text, 'b'); assert.equal(undo.undo()?.text, 'a');
    undo.clear();
    for (let index = 0; index < 55; index++) undo.record(String(index), 0, { immediate: true });
    let count = 0, oldest = '';
    while (undo.canUndo) { oldest = undo.undo()!.text; count++; }
    assert.equal(count, 50); assert.equal(oldest, '5');
    undo.clear(); undo.record('same', 1, { immediate: true }); undo.record('same', 3, { immediate: true });
    assert.equal(undo.undo()?.cursorOffset, 1); assert.equal(undo.canUndo, false);
    undo.record('committed', 3, { immediate: true }); undo.record('pending', 2);
    undo.clear(); context.mock.timers.tick(2000); assert.equal(undo.canUndo, false);
  } finally { undo.clear(); context.mock.timers.reset(); }
});

test('line input undo restores raw text and cursor while submit, cancel and close bound its lifetime', context => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
  const input = new FakeInput(), output = new FakeOutput();
  const submitted: string[] = [];
  const terminal = createTerminalInput({ input, output, onSubmit: text => submitted.push(text) }).start();
  try {
    input.key('first'); context.mock.timers.tick(1000);
    input.key('\x1b[D!\u001f'); assert.equal(terminal.state.text, 'first'); assert.equal(terminal.state.cursor, 4);
    input.key('\u001f'); assert.equal(terminal.state.text, '');
    input.key('base'); context.mock.timers.tick(1000); context.mock.timers.tick(1000);
    input.key(' tail'); input.key('!');
    input.key('\u001f'); assert.equal(terminal.state.text, 'base');
    input.key('\r\u001f'); assert.deepEqual(submitted, ['base']); assert.equal(terminal.state.text, '');
    const raw = 'é\u{1f469}‍\u{1f4bb}中';
    input.key(raw); context.mock.timers.tick(1000);
    input.key('\x1b[D!\u001f'); assert.equal(terminal.state.text, raw); assert.equal(terminal.state.cursor, raw.length - 1);
    terminal.setRunning(true); input.key('\u0003'); terminal.setRunning(false);
    input.key('\u001f'); assert.equal(terminal.state.text, '');
    input.key('cleared\u0003\u001f'); assert.equal(terminal.state.text, '');
    terminal.setKeybindings({ '\u001f': 'newline' }); input.key('override\u001f'); assert.equal(terminal.state.text, 'override\n');
    terminal.setKeybindings(); input.key('pending'); terminal.close();
    const before = output.text; context.mock.timers.tick(2000); assert.equal(output.text, before);
  } finally { terminal.close(); context.mock.timers.reset(); }
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
