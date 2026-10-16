// The keybinding module's row reader (W45-68). The bodies are the copy's
// src/plugin-chain-keys-rows-source.ts (chunk-6ccen3s8.js [10481,10621) `Ace` and [11037,11145) `ge`;
// chunk-4bw62nzm.js [21687,21738) `Yr`/`JMt` and [24850,24946) `Di`/`oo`, this chunk's lodash
// `mapValues`), with `h9`/`Q`/`Re` imported from the editor copy and `Lxr`/`Wpe`/`uU`/`zZ` from the
// internals copy. Assertions are written from the measurement probe .audit/w45-68-probe.ts.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_BINDINGS } from '../src/plugin-chain-keys.js';
import { LEGACY_ACTION_NAMES, LEGACY_ACTION_READ_AS } from '../src/plugin-chain-keys-editor.js';
import {
  bindingRows, MAP_VALUES_ALIAS, mapValuesForRows, rewriteLegacyBindings, SOURCE_BODIES,
} from '../src/plugin-chain-keys-rows.js';

test('the reader answers one row per binding, with the chord already split', () => {
  const rows = bindingRows(DEFAULT_BINDINGS as never);
  assert.equal(rows.length, 226, 'measured: the product\'s own defaults are 226 bindings');
  assert.deepEqual(rows[0], {
    chord: [{ key: 'c', ctrl: true, alt: false, shift: false, meta: false, super: false }],
    action: 'app:interrupt',
    context: 'Global',
  }, 'measured: the first row is the one the defaults bind first, in the context they bind it in');
  assert.equal(new Set(rows.map((row) => row.context)).size, 27, 'and they span the 27 contexts');
  assert.equal(rows.every((row) => Array.isArray(row.chord) && typeof row.context === 'string'), true,
    'a row carries keys rather than the chord string it was written as');
});

test('the row order is the block order and the file\'s own binding order', () => {
  const rows = bindingRows([
    { context: 'Chat', bindings: { 'ctrl+z': 'app:exit', 'ctrl+y': 'app:interrupt' } },
    { context: 'Global', bindings: { 'ctrl+x': 'app:exit' } },
  ]);
  assert.deepEqual(rows.map((row) => [row.context, row.action, row.chord.map((key) => key.key).join('+')]), [
    ['Chat', 'app:exit', 'z'],
    ['Chat', 'app:interrupt', 'y'],
    ['Global', 'app:exit', 'x'],
  ], 'measured: rows come out in the order they were written, and the chord is split as the row is built');
});

test('a chord of several keys becomes several key records in one row, and a null action is a row too', () => {
  const rows = bindingRows([{ context: 'Global', bindings: { 'ctrl+x shift+y': 'app:interrupt', g: null } }]);
  assert.deepEqual(rows[0].chord, [
    { key: 'x', ctrl: true, alt: false, shift: false, meta: false, super: false },
    { key: 'y', ctrl: false, alt: false, shift: true, meta: false, super: false },
  ], 'measured: the editor\'s splitter is what runs here, so a chord is keys');
  assert.equal(rows[1].action, null,
    'measured: unbinding a default is a row like any other — the reader does not read the null');
  assert.equal(rows[1].chord[0].key, 'g');
  assert.deepEqual(bindingRows([]), [], 'and there are no rows without blocks');
});

test('the mapper rewrites the legacy names and leaves every other value where it was', () => {
  const blocks = [{ context: 'Global', bindings: {
    'ctrl+k': 'messageSelector:up',
    'ctrl+j': null,
    'ctrl+l': 'app:interrupt',
    'ctrl+d': 'diff:viewDetails',
  } }];
  const mapped = rewriteLegacyBindings(blocks);
  assert.deepEqual(mapped, [{ context: 'Global', bindings: {
    'ctrl+k': 'select:previous',
    'ctrl+j': null,
    'ctrl+l': 'app:interrupt',
    'ctrl+d': 'select:accept',
  } }], 'measured: exactly two of the four values are rewritten');
  assert.equal(mapped[0].context, 'Global', 'the context is carried over as it stands');
  assert.deepEqual(Object.keys(mapped[0].bindings), Object.keys(blocks[0].bindings),
    'measured: the keys keep their order');
  assert.deepEqual(rewriteLegacyBindings([]), []);
});

test('the mapper rewrites the legacy names as they are read, and only those', () => {
  const bindings = Object.fromEntries(LEGACY_ACTION_NAMES.map((name, index) => [`ctrl+${index}`, name]));
  const mapped = rewriteLegacyBindings([{ context: 'Global', bindings }]);
  const readAs: Record<string, string> = LEGACY_ACTION_READ_AS;
  LEGACY_ACTION_NAMES.forEach((name, index) => {
    assert.equal(mapped[0].bindings[`ctrl+${index}`], readAs[name], name);
  });
  for (const value of ['select:previous', 'app:interrupt', 'command:help', '', null]) {
    assert.equal(rewriteLegacyBindings([{ context: 'Global', bindings: { 'ctrl+k': value } }])[0].bindings['ctrl+k'],
      value, String(value));
  }
});

test('the blocks a caller hands in are not rewritten behind its back', () => {
  const blocks = [{ context: 'Global', bindings: { 'ctrl+k': 'messageSelector:up' } }];
  const before = JSON.stringify(blocks);
  const mapped = rewriteLegacyBindings(blocks);
  assert.equal(JSON.stringify(blocks), before, 'measured: the argument is untouched');
  assert.notEqual(mapped[0].bindings, blocks[0].bindings, 'and the answer is a new map');
  assert.equal(mapped[0] === blocks[0], false, 'the block itself is new too');
});

test('this chunk\'s map-values maps value-wise, and answers a plain object', () => {
  const seen: Array<unknown[]> = [];
  const mapped = mapValuesForRows({ a: 1, b: 2 }, (value, key, object) => {
    seen.push([value, key, object === undefined]);
    return value + 1;
  });
  assert.deepEqual(mapped, { a: 2, b: 3 });
  assert.deepEqual(seen, [[1, 'a', false], [2, 'b', false]],
    'measured: the iteratee is handed the value, the key and the object');
  assert.equal(MAP_VALUES_ALIAS, SOURCE_BODIES.Di, 'measured: the name the mapper calls is the same function');
  // The seam's wrappers are not the copied functions themselves — they are the named door in front of
  // them — so what is asserted is that each one answers exactly what the copy it calls answers.
  const blocks = [{ context: 'Global', bindings: { 'ctrl+k': 'messageSelector:up' } }];
  assert.deepEqual(bindingRows(blocks), SOURCE_BODIES.Ace(blocks), 'the reader answers what `Ace` answers');
  assert.deepEqual(rewriteLegacyBindings(blocks), SOURCE_BODIES.ge(blocks), 'and the mapper what `ge` answers');
  assert.deepEqual(mapValuesForRows({ a: 1 }, (value) => value),
    SOURCE_BODIES.Di({ a: 1 }, (value: number) => value));
});

test('only own keys are mapped, and a key named __proto__ stays a key', () => {
  const prototype = Object.create({ inherited: 9 }) as Record<string, number>;
  prototype.a = 1;
  const mapped = mapValuesForRows(prototype, (value) => value);
  assert.deepEqual(mapped, { a: 1 }, 'measured: an inherited key is not mapped');
  assert.equal(Object.getPrototypeOf(mapped), Object.prototype, 'and the answer has the ordinary prototype');
  const tricky: Record<string, number> = {};
  Object.defineProperty(tricky, '__proto__', { value: 5, enumerable: true, configurable: true, writable: true });
  const guarded = mapValuesForRows(tricky, (value) => value + 1);
  assert.deepEqual(Object.getOwnPropertyNames(guarded), ['__proto__'],
    'measured: the value is written through a guard, so it stays an own key');
  assert.equal(Object.getPrototypeOf(guarded), Object.prototype, 'and does not become the prototype');
  assert.deepEqual(mapValuesForRows(null, (value) => value), {},
    'measured: a null object is not an error here — the walk finds no keys to map');
  assert.deepEqual(mapValuesForRows({ a: null }, (value) => value), { a: null });
});
