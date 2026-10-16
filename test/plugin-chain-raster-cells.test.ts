// The raster cell encoder and the admission bucket (W45-60). The bodies are the copy's
// src/plugin-chain-raster-cells-source.ts — chunk-n3ykh62m.js [248693,248812), [252131,252200),
// [252243,252256), [252455,252481), [252898,253057), [253816,253943), [253969,254367),
// [256690,256712) and [257058,257143), plus `Kbr` in chunk-nyce03br.js [87140,87341). Assertions are
// written from the measurement probe .audit/w45-60-probe.ts.

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { it } from '../src/plugin-chain-host.js';
import {
  admitRasterFrame, backgroundHalf, CELL_WORDS, CHANNEL_LAYOUT, COLOUR_HALVES, DEFAULT_CHANNEL,
  DEFAULT_RASTER_COLUMNS, DEFAULT_RASTER_ROWS, encodeCell, foregroundHalf, freshRasterAdmission,
  RASTER_ADMISSION_CAPACITY, RASTER_REFILL_MS, RASTER_TOKENS_PER_SECOND, rasterAdmission,
  SITE_MOUNT_FIELDS, validateDefaultRasterSize, validateRasterSize,
} from '../src/plugin-chain-raster-cells.js';
import { mb } from '../src/plugin-chain-raster-cells-source.js';

afterEach(() => {
  it().rasterAdmission = undefined;
});

test('the constants are the source\'s own', () => {
  assert.equal(RASTER_ADMISSION_CAPACITY, 4096);
  assert.equal(RASTER_TOKENS_PER_SECOND, 160);
  assert.equal(RASTER_REFILL_MS, 1000, 'the refill rate is tokens a second over this base');
  assert.equal(DEFAULT_RASTER_COLUMNS, 512);
  assert.equal(DEFAULT_RASTER_ROWS, 256);
  assert.equal(DEFAULT_CHANNEL, 32768, '0x8000, the high bit that marks a channel as the default');
  assert.deepEqual(CHANNEL_LAYOUT, { channelBits: 4, channelMax: 15, step: 17, greenShift: 4, redShift: 8 });
  assert.deepEqual(COLOUR_HALVES, { halfBits: 16, halfMask: 65535, defaultMismatch: 4096 },
    'the low half is the foreground and the high half the background');
  assert.deepEqual([...SITE_MOUNT_FIELDS], ['key', 'columns', 'rows', 'cells']);
});

test('one painted cell is eight words: a flag and three channels twice', () => {
  assert.equal(CELL_WORDS.width, 8);
  assert.deepEqual(
    [CELL_WORDS.foregroundDefault, CELL_WORDS.foregroundRed, CELL_WORDS.foregroundGreen, CELL_WORDS.foregroundBlue],
    [0, 1, 2, 3]);
  assert.deepEqual(
    [CELL_WORDS.backgroundDefault, CELL_WORDS.backgroundRed, CELL_WORDS.backgroundGreen, CELL_WORDS.backgroundBlue],
    [4, 5, 6, 7]);
});

test('the call site of freshRasterAdmission builds an unspent row, and rasterAdmission holds it in the registry', () => {
  it().rasterAdmission = undefined;
  assert.deepEqual(freshRasterAdmission(), { tokens: 4096, refilledAt: 0 });

  const row = rasterAdmission();
  assert.deepEqual(row, { tokens: 4096, refilledAt: 0 });
  assert.equal(it().rasterAdmission, row, 'the first read writes the row into the registry');
  assert.equal(rasterAdmission(), row, 'and every later read is that same row');

  it().rasterAdmission = undefined;
  assert.notEqual(rasterAdmission(), row, 'clearing the field makes the next read build a new one');
});

test('the accessor carries no reset, because the source\'s memoizer is an identity in this build', () => {
  assert.equal(typeof (mb as { reset?: unknown }).reset, 'undefined',
    'Ge is `function Ge(t,e){return t}`, so the invalidator beside the factory is dropped by the source');
  assert.deepEqual(Object.keys(mb as object), [], 'the factory is the whole binding — nothing hangs off it');
});

test('admitting a frame refills against the clock and spends one token', () => {
  const row = { tokens: 4096, refilledAt: 0 };
  assert.equal(admitRasterFrame(row, 0, 0), true);
  assert.equal(row.tokens, 4095, 'one token per admitted frame');
  assert.equal(row.refilledAt, 0, 'and the clock it was admitted against is recorded');
});

test('the cost is a reserve that must be left behind, not a price', () => {
  const free = { tokens: 4096, refilledAt: 0 };
  assert.equal(admitRasterFrame(free, 0, 1024), true, 'a cost below the tokens is admitted');
  assert.equal(free.tokens, 4095, 'and still costs exactly one token, not the cost');

  const exact = { tokens: 4096, refilledAt: 0 };
  assert.equal(admitRasterFrame(exact, 0, 4096), false, 'a frame that would leave no token is refused');
  assert.equal(exact.tokens, 4096, 'a refused frame spends nothing');

  const empty = { tokens: 0, refilledAt: 0 };
  assert.equal(admitRasterFrame(empty, 0, 0), false, 'even a free frame needs one token to spend');
  assert.equal(empty.tokens, 0);
});

test('the refill is proportional to the elapsed time, capped at the capacity and never negative', () => {
  const half = { tokens: 10, refilledAt: 500 };
  assert.equal(admitRasterFrame(half, 1000, 0), true, 'half a second adds eighty tokens');
  assert.equal(half.tokens, 89, 'ten, plus eighty, less the one spent');

  const second = { tokens: 0, refilledAt: 0 };
  assert.equal(admitRasterFrame(second, 1000, 160), false, 'a second adds exactly the rate');
  assert.equal(second.tokens, 160, 'and a reserve equal to the tokens is still refused');

  const back = { tokens: 0, refilledAt: 1000 };
  assert.equal(admitRasterFrame(back, 0, 0), false, 'a clock that went backwards adds nothing');
  assert.equal(back.tokens, 0);
  assert.equal(back.refilledAt, 0, 'but the earlier clock is still recorded');

  const long = { tokens: 0, refilledAt: 0 };
  assert.equal(admitRasterFrame(long, 100000, 4096), false, 'a long wait cannot exceed the capacity');
  assert.equal(long.tokens, 4096);
});

test('encoding a cell writes the foreground from the low half and the background from the high half', () => {
  const table = new Uint32Array(CELL_WORDS.width);
  encodeCell(table, 0, 0x1234 | (0xabcd << 16));
  assert.deepEqual([...table], [0, 2, 3, 4, 0, 11, 12, 13],
    'each channel is the four bits at its shift, and neither side is a default');
  assert.equal(foregroundHalf(0x1234 | (0xabcd << 16)), 0x1234);
  assert.equal(backgroundHalf(0x1234 | (0xabcd << 16)), 0xabcd);
});

test('the default sentinel marks the side it is passed as, and the cell it is written at', () => {
  const table = new Uint32Array(CELL_WORDS.width * 3);
  encodeCell(table, 2, DEFAULT_CHANNEL);
  assert.deepEqual([...table.slice(0, CELL_WORDS.width)], new Array(CELL_WORDS.width).fill(0),
    'cell 0 is untouched');
  assert.deepEqual([...table.slice(CELL_WORDS.width * 2)], [1, 0, 0, 0, 0, 0, 0, 0],
    'the foreground is marked as the default and its channels are cleared');
  assert.equal([...table].filter((word) => word === 1).length, 1,
    'passing the sentinel as the whole pair marks the foreground only — the background half becomes 0');

  const both = new Uint32Array(CELL_WORDS.width);
  encodeCell(both, 0, DEFAULT_CHANNEL | (DEFAULT_CHANNEL << 16));
  assert.equal(both[CELL_WORDS.foregroundDefault], 1);
  assert.equal(both[CELL_WORDS.backgroundDefault], 1, 'a background default needs the sentinel in the high half');
});

test('a size is checked against the limit field by field, columns first', () => {
  const limits = { columns: 512, rows: 256 };
  assert.equal(validateRasterSize(1, 1, limits), undefined);
  assert.equal(validateRasterSize(512, 256, limits), undefined, 'the limit itself is whole and in range');
  assert.equal(validateRasterSize(0, 1, limits), 'columns must be a whole number from 1 to 512');
  assert.equal(validateRasterSize(513, 1, limits), 'columns must be a whole number from 1 to 512');
  assert.equal(validateRasterSize(1.5, 1, limits), 'columns must be a whole number from 1 to 512');
  assert.equal(validateRasterSize(Number.NaN, 1, limits), 'columns must be a whole number from 1 to 512');
  assert.equal(validateRasterSize(1, 0, limits), 'rows must be a whole number from 1 to 256');
  assert.equal(validateRasterSize(1, 257, limits), 'rows must be a whole number from 1 to 256');
  assert.equal(validateRasterSize(1, 1.5, limits), 'rows must be a whole number from 1 to 256');
  assert.equal(validateRasterSize(0, 0, limits), 'columns must be a whole number from 1 to 512',
    'a value bad on both fields reports columns, the field it checks first');
});

test('the validating mount checks against the default size, and takes no other', () => {
  assert.equal(validateDefaultRasterSize(512, 256), undefined);
  assert.equal(validateDefaultRasterSize(1, 1), undefined);
  assert.equal(validateDefaultRasterSize(513, 256), 'columns must be a whole number from 1 to 512');
  assert.equal(validateDefaultRasterSize(512, 257), 'rows must be a whole number from 1 to 256');
  assert.equal(validateDefaultRasterSize('4' as never, 1), 'columns must be a whole number from 1 to 512',
    'a string is not a number, however numeric it reads');
});
