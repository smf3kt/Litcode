// W45-9 against the built artifact: how a highlight run reaches the rendered rows, from the copied row
// mapping (dist/plugin-chain-decorations-source.js) and the copied ANSI tokenizer
// (dist/tui-sgr-tokens-source.js) through the input path in dist/tui-input-decorations.js.
import assert from 'node:assert/strict';
import { S9r, b9r, Hht, Bht, OOe, $ht } from '../dist/plugin-chain-decorations-source.js';
import { _ns } from '../dist/tui-sgr-tokens-source.js';
import { caretVisibleRuns, highlightRows } from '../dist/tui-input-decorations.js';
import { layoutInput } from '../dist/tui-input-navigation.js';

const run = (start, end, color) => ({ start, end, color, priority: 0 });

// The tokenizer: escape sequences are ansi tokens carrying their close code, every other code point a char.
assert.deepEqual(_ns('\u001b[31mab\u001b[39m').map(token => [token.type, token.code ?? token.value]),
  [['ansi', '\u001b[31m'], ['char', 'a'], ['char', 'b'], ['ansi', '\u001b[39m']]);

// Overlap resolution keeps the runs that do not touch an earlier one, longer first on a tie.
assert.deepEqual(OOe([run(0, 4), run(2, 6)]).map(s => [s.start, s.end]), [[0, 4]]);

// The row mapping: a run stated in draft offsets comes back stated in rendered-value offsets, row by row.
assert.deepEqual(S9r([run(4, 8, '#e5484d')], 'aaaa\nbbbb', [0, 4]).map(s => [s.start, s.end, s.color]), [[5, 9, '#e5484d']],
  'the soft-wrapped second row starts after the join newline');
assert.deepEqual($ht([{ textStart: 0, renderedStart: 0, length: 4 }, { textStart: 4, renderedStart: 5, length: 4 }], 4, false), 5);

// Segmentation: without runs the whole text is one segment; with runs each segment carries its run, and a
// segment inside coloured text keeps the escapes that are open where it starts.
assert.deepEqual(b9r('aaaabbbb', []), [{ text: 'aaaabbbb', start: 0 }]);
assert.deepEqual(b9r('aaaa\nbbbb', S9r([run(4, 8, '#e5484d')], 'aaaa\nbbbb', [0, 4])).map(s => [s.text, s.start, s.highlight?.color]),
  [['aaaa\n', 0, undefined], ['bbbb', 5, '#e5484d']]);
const coloured = b9r('\u001b[31mabcd\u001b[39m', [{ start: 2, end: 3, color: '#3e63dd' }]);
assert.deepEqual(coloured.map(s => [s.text, s.start, s.highlight?.color]),
  [['\u001b[31mab\u001b[39m', 0, undefined], ['\u001b[31mc\u001b[39m', 2, '#3e63dd'], ['\u001b[31md\u001b[39m', 3, undefined]],
  'each segment re-opens the codes open at its start');
assert.deepEqual(Bht([{ type: 'ansi', code: '\u001b[1m', endCode: '\u001b[22m' },
  { type: 'ansi', code: '\u001b[39m', endCode: '\u001b[39m' }]).map(code => code.code), ['\u001b[1m'],
  'the codes a segment opens with are the ones still open, a self-closing reset among them dropped');
assert.deepEqual(new Hht('ab').segment([{ start: 1, end: 2 }]).map(s => [s.text, s.start]), [['a', 0], ['b', 1]]);

// The input path: the caret drops the run it sits in, and the rows come from the rendered value.
const state = { text: 'hello world', cursor: 11 };
const body = layoutInput(state, 8, 4);
assert.deepEqual(body.lines, ['hello', 'world']);
assert.deepEqual(body.rowStartOffsets, [0, 6]);
const runs = [run(6, 11, '#e5484d')];
assert.deepEqual(caretVisibleRuns(runs, 8), [], 'the caret strictly inside the run withholds it');
assert.deepEqual(caretVisibleRuns(runs, 11).map(s => [s.start, s.end]), [[6, 11]],
  'the caret at the run end keeps it: the source drops a span only when start <= cursorOffset < end');
assert.deepEqual(highlightRows(runs, body.lines.join('\n'), body.rowStartOffsets, 8).map(row => row.map(s => [s.text, s.style.color ?? null])),
  [[['hello', null]], [['world', null]]], 'the text stays, the paint is withheld');
assert.deepEqual(highlightRows(runs, body.lines.join('\n'), body.rowStartOffsets, 2).map(row => row.map(s => [s.text, s.style.color ?? null])),
  [[['hello', null]], [['world', '#e5484d']]], 'with the caret elsewhere the run is painted on its row');

console.log(JSON.stringify({
  schema: 'W45HighlightsCompiled.v1',
  artifact: 'dist',
  mapped: S9r([run(4, 8, '#e5484d')], 'aaaa\nbbbb', [0, 4]).map(s => [s.start, s.end]),
  segmented: b9r('aaaa\nbbbb', S9r([run(4, 8, '#e5484d')], 'aaaa\nbbbb', [0, 4])).map(s => [s.text, s.start, s.highlight?.color ?? null]),
  ansiPreserved: coloured.map(s => [s.text, s.highlight?.color ?? null]),
  rows: highlightRows(runs, body.lines.join('\n'), body.rowStartOffsets, 2).map(row => row.map(s => [s.text, s.style.color ?? null])),
  recoveredApplicationEntrypointsExecuted: false,
}, null, 2));
