// W45-8 against the built artifact: the decoration runs a chain answer leaves on the draft, from the
// copied geometry in dist/plugin-chain-decorations-source.js through the composer store to the rows.
import assert from 'node:assert/strict';
import { Rke, a7o, w9r } from '../dist/plugin-chain-decorations-source.js';
import { PaintedDecorations, normalizedRuns, highlightRows } from '../dist/tui-input-decorations.js';
import { layoutInput } from '../dist/tui-input-navigation.js';

const run = (start, end, color) => ({ start, end, color });
const where = (runs) => runs.map(({ start, end, color }) => [start, end, color]);

// The copied geometry: `Rke` clamps, resolves the named color and merges; `a7o` rebases across one edit.
const normalized = Rke([run(6, 11, 'red')], 'hello world');
assert.deepEqual(where(normalized), [[6, 11, '#e5484d']]);
const edit = { start: 1, end: 1, inputText: 'i h' };
assert.deepEqual(where(a7o(normalized, edit)), [[9, 14, '#e5484d']]);
assert.deepEqual(where(Rke([run(0, 4, 'red'), run(1, 6, 'red'), run(8, 99, 'blue')], 'hello world')),
  [[0, 6, '#e5484d'], [8, 11, '#3e63dd']]);

// The store: paint, publish, carry — the composer state class's three bodies.
let draft = 'hello world';
const store = new PaintedDecorations(() => draft, () => {});
store.paint(normalizedRuns([run(6, 11, 'red')], draft));
assert.deepEqual(where(store.runs('hello world')), [[6, 11, '#e5484d']]);
draft = 'hi hello world';
store.publish(draft);
assert.deepEqual(store.runs(draft), [], 'a draft that moved paints nothing until the edit is carried');
store.carry({ text: 'hello world', cursor: 11 }, { text: draft, cursor: 14 });
assert.deepEqual(where(store.runs(draft)), [[9, 14, '#e5484d']]);

// The row: what the composer hands the renderer for that draft, through the source's own row mapping.
const body = layoutInput({ text: draft, cursor: 14 }, 40, 6);
const rows = highlightRows(store.runs(draft), body.lines.join('\n'), body.rowStartOffsets, 14);
assert.equal(rows.length, 1);
assert.deepEqual(rows[0].map(({ text, style }) => [text, style.color ?? null]),
  [['hi hello ', null], ['world', '#e5484d']]);

// The overlay is the copied `w9r`: it merges normalized runs onto the row's own spans, in order.
// `Dht` drops a color that is neither a theme key nor a color string, which is why the source
// normalizes with `Rke` first; and `AOe` matches a span by its start, so a run reaching past the
// row's span is carried one boundary beyond it — the row's own mapper drops that tail.
assert.deepEqual(where(w9r([{ start: 0, end: 5 }], Rke([run(0, 2, 'red'), run(3, 9, 'blue')], 'hello world'), undefined)),
  [[0, 2, '#e5484d'], [2, 3, undefined], [3, 5, '#3e63dd'], [5, 9, '#3e63dd']]);
assert.deepEqual(where(w9r([{ start: 0, end: 5 }], [run(0, 2, 'red')], undefined)),
  [[0, 2, undefined], [2, 5, undefined]], 'a named color is not a color the overlay accepts');

console.log(JSON.stringify({
  schema: 'W45DecorationsCompiled.v1',
  artifact: 'dist',
  normalized: where(normalized),
  rebased: where(a7o(normalized, edit)),
  carried: where(store.runs(draft)),
  rows: rows[0].map(({ text, style }) => [text, style.color ?? null]),
  recoveredApplicationEntrypointsExecuted: false,
}, null, 2));
