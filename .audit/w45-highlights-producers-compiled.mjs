// W45-10 against the built artifact: the composer's own highlight producers and the merge that turns them
// into the input's `highlights` prop. Sources: dist/tui-input-highlights-source.js (the copied producers),
// dist/plugin-chain-decorations-source.js (the `w9r` overlay) and dist/tui-input-highlights.js (the
// adapter this package adds).
import assert from 'node:assert/strict';
import { Art, LF, UF, d3n, ewe, fB, j5r, mW, pue, vMe, YIt, Zp, uto } from '../dist/tui-input-highlights-source.js';
import { composerBaseSpans, composerHighlights } from '../dist/tui-input-highlights.js';
import { highlightRows, normalizedRuns } from '../dist/tui-input-decorations.js';
import { layoutInput } from '../dist/tui-input-navigation.js';

const spans = (list) => list.map(span => [span.start, span.end, span.color, span.dimColor === true ? 'dim' : undefined]);

// The palettes and their pick: seven colors, their shimmer twins, and a wrap-around index.
assert.deepEqual([LF.length, UF.length], [7, 7]);
assert.deepEqual([fB(0), fB(6), fB(7)], ['rainbow_red', 'rainbow_violet', 'rainbow_red']);
assert.deepEqual([fB(0, true), fB(13, true)], ['rainbow_red_shimmer', 'rainbow_violet_shimmer']);

// The keyword matcher: word boundaries, and nothing inside quotes or brackets.
assert.deepEqual(YIt('please ultrathink now'), [{ word: 'ultrathink', start: 7, end: 17 }]);
assert.deepEqual(YIt('ultrathinking'), []);
assert.deepEqual(Art('use ultracode'), [{ word: 'ultracode', start: 4, end: 13 }]);
assert.deepEqual([Zp('ultraplan'), uto('ultrareview')].map(hits => hits.length), [1, 1]);
assert.deepEqual(Art('say "ultracode" now'), [], 'a quoted keyword is skipped');
assert.deepEqual(Art('(ultracode)'), [], 'a bracketed keyword is skipped');
assert.deepEqual(Art('run/ultracode'), [], 'a slash before the word is a path, not a keyword');

// The other producers: the `/btw` notice anchored to the draft's start, the slash-command runs with their
// trailing dots trimmed, the first grapheme, the overlap test, the spread producer, the mark merge.
assert.deepEqual(d3n('/btw why'), [{ word: '/btw', start: 0, end: 4 }]);
assert.deepEqual(d3n(' /btw why'), []);
assert.deepEqual(spans(vMe('/help. /nope')), [[0, 5, undefined, undefined], [7, 12, undefined, undefined]]);
assert.deepEqual([ewe('éx'), ewe('ab'), ewe('')], ['é', 'a', '']);
assert.deepEqual([mW(0, 5, [[2, 4]]), mW(0, 5, [[5, 9]])], [true, false]);
assert.deepEqual(j5r('anything'), []);
assert.deepEqual(spans(pue([{ start: 0, end: 4 }], [{ start: 2, end: 3 }, { start: 9, end: 10 }])),
  [[0, 4, undefined, undefined], [9, 10, undefined, undefined]], 'a mark over a kept span is dropped');

// The composer's span list: the rainbow per cell, the notice, the command suggestion, the ghost, the marks.
const draft = 'ultrathink';
assert.deepEqual(spans(composerBaseSpans({ value: draft, caret: 0, storeValue: draft })), [
  [0, 1, 'rainbow_red'], [1, 2, 'rainbow_orange'], [2, 3, 'rainbow_yellow'], [3, 4, 'rainbow_green'],
  [4, 5, 'rainbow_blue'], [5, 6, 'rainbow_indigo'], [6, 7, 'rainbow_violet'], [7, 8, 'rainbow_red'],
  [8, 9, 'rainbow_orange'], [9, 10, 'rainbow_yellow'],
].map(([start, end, color]) => [start, end, color, undefined]));
assert.deepEqual(spans(composerBaseSpans({ value: 'ultrathink', caret: 0, storeValue: 'ultrathink', ultrathink: false })), [],
  'the gate the source leaves on by default');
assert.deepEqual(spans(composerBaseSpans({ value: '/btw q', caret: 6, storeValue: '/btw q' })), [[0, 4, 'warning', undefined]]);
assert.deepEqual(spans(composerBaseSpans({ value: '/help me', caret: 8, storeValue: '/help me', knownCommand: (name) => name === 'help' })),
  [[0, 5, 'suggestion', undefined]]);
assert.deepEqual(spans(composerBaseSpans({ value: 'abc', caret: 0, storeValue: 'abc', ghost: { start: 3, end: 8 } })),
  [[3, 8, undefined, 'dim']]);
assert.deepEqual(spans(composerBaseSpans({ value: 'ultracode', caret: 0, storeValue: 'ultracode', workflowKeyword: true }).slice(0, 2)),
  [[0, 1, 'autoAccept', undefined], [1, 2, 'autoAccept', undefined]]);

// The overlay: a chain run repaints the cells it covers, the caret cell is left to the base text, and a
// search hands the base spans over untouched.
const runs = normalizedRuns([{ start: 2, end: 5, color: 'red' }], draft);
assert.deepEqual(runs.map(span => [span.start, span.end, span.color]), [[2, 5, '#e5484d']]);
const overlay = composerHighlights({ value: draft, caret: 6, storeValue: draft }, runs);
assert.deepEqual(spans(overlay.filter(span => span.start >= 2 && span.start < 5)), [[2, 3, '#e5484d', undefined], [3, 4, '#e5484d', undefined], [4, 5, '#e5484d', undefined]]);
assert.equal(overlay.some(span => span.start === 6 && span.end === 7), false, 'the caret cell is cut out of the base span');
assert.equal(composerHighlights({ value: draft, caret: 6, storeValue: draft, isModalOverlayActive: true }, runs)
  .filter(span => span.start === 6).length, 1, 'a modal overlay keeps the caret cell painted');
assert.deepEqual(spans(composerHighlights({ value: draft, caret: 0, storeValue: draft }, [])).length, 10);

// The rows: the composer spans reach the rendered rows through the input's own mapping, and the row the
// caret sits in keeps its cell unstyled.
const body = layoutInput({ text: 'a ultrathink b', cursor: 0 }, 8, 4);
assert.deepEqual([body.lines, body.rowStartOffsets], [['a ultra', 'think b'], [0, 7]]);
const wrapped = highlightRows(composerBaseSpans({ value: 'a ultrathink b', caret: 0, storeValue: 'a ultrathink b' }),
  body.lines.join('\n'), body.rowStartOffsets, 0);
assert.deepEqual(wrapped.map(row => row.map(segment => [segment.text, segment.style.color])), [
  [['a ', undefined], ['u', 'rainbow_red'], ['l', 'rainbow_orange'], ['t', 'rainbow_yellow'], ['r', 'rainbow_green'], ['a', 'rainbow_blue']],
  [['t', 'rainbow_indigo'], ['h', 'rainbow_violet'], ['i', 'rainbow_red'], ['n', 'rainbow_orange'], ['k', 'rainbow_yellow'], [' b', undefined]],
], 'the rainbow crosses the wrap and stops at the word');
const caretRows = highlightRows(composerHighlights({ value: draft, caret: 6, storeValue: draft }, runs), draft, [0], 6);
assert.deepEqual(caretRows[0].map(segment => [segment.text, segment.style.color]),
  [['u', 'rainbow_red'], ['l', 'rainbow_orange'], ['t', '#e5484d'], ['r', '#e5484d'], ['a', '#e5484d'],
    ['t', 'rainbow_indigo'], ['h', undefined], ['i', 'rainbow_red'], ['n', 'rainbow_orange'], ['k', 'rainbow_yellow']]);

console.log('W45HighlightsProducersCompiled.v1');
