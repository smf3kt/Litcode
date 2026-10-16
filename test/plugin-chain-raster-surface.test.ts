// The raster surface engine (W45-61). The bodies are the copy's src/plugin-chain-raster-surface-source.ts
// — chunk-n3ykh62m.js [248705,248715), [252200,252243), [252256,252455), [252481,252898),
// [253057,253816), [253943,253969) and [254367,256690), plus the CSI helper's three statements in
// chunk-yn0pfn70.js. Assertions are written from the measurement probes .audit/w45-61-probe{,b,c}.ts.

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { it } from '../src/plugin-chain-host.js';
import { encodeCell, mb } from '../src/plugin-chain-raster-cells.js';
import {
  BELL, CELL_STRIDE, CHARSET_RESET, CONTROL_CODES, createRasterSurface, CSI, CSI_BYTES, csi,
  EVALUATION_BUDGET, ESCAPE, frameRuns, freshSurfaceState, nearestSlot, packColourPair,
  PARAMETER_BYTE_RANGES, PARAMETER_SEPARATOR, renderRows, REUSE_COST, resetSgr, SGR_CODES, sgrPair,
  sgrSide, SLOT_CAPACITY, staleSlots, toPackedColour, channelByte,
} from '../src/plugin-chain-raster-surface.js';

const RED = 0xff0000;
const GREEN = 0x00ff00;
const BLUE = 0x0000ff;
const NO_COLOUR = 0x1000000;
const RED_ON_BLACK = packColourPair(RED, 0x000000);
const GREEN_ON_BLACK = packColourPair(GREEN, 0x000000);

/** A surface whose clock stands still and whose admission row is the registry's own. */
function surface() {
  it().rasterAdmission = undefined;
  return createRasterSurface(() => 0, mb());
}

afterEach(() => {
  it().rasterAdmission = undefined;
});

test('the CSI helper writes the introducer and joins all but the last argument', () => {
  assert.equal(ESCAPE, '\x1b');
  assert.equal(CSI, '\x1b[');
  assert.equal(PARAMETER_SEPARATOR, ';');
  assert.equal(BELL, '\x07');
  assert.equal(CHARSET_RESET, '\x1b(B\x0f');
  assert.equal(csi(), '\x1b[');
  assert.equal(csi(0), '\x1b[0');
  assert.equal(csi('m'), '\x1b[m');
  assert.equal(csi(38, 2, 255, 0, 0, 'm'), '\x1b[38;2;255;0;0m');
  assert.equal(csi(1, 2, 3), '\x1b[1;23',
    'every argument but the last is joined with the separator and the last is appended as it stands, which is why the SGR builder passes its final byte as a string');
});

test('the grammar the helper is written against is the source\'s own', () => {
  assert.equal(CSI_BYTES.CSI, 91);
  assert.equal(CSI_BYTES.OSC, 93);
  assert.equal(CSI_BYTES.APC, 95);
  assert.equal(CONTROL_CODES.ESC, 27);
  assert.equal(CONTROL_CODES.BEL, 7);
  assert.equal(CONTROL_CODES.DEL, 127);
  assert.deepEqual(PARAMETER_BYTE_RANGES,
    { PARAM_START: 48, PARAM_END: 63, INTERMEDIATE_START: 32, INTERMEDIATE_END: 47, FINAL_START: 64, FINAL_END: 126 });
});

test('a colour narrows to four bits a channel, and the sentinel answers the default marker', () => {
  assert.equal(toPackedColour(RED), 3840, '0xF00: red at shift 8');
  assert.equal(toPackedColour(GREEN), 240, '0x0F0');
  assert.equal(toPackedColour(BLUE), 15, '0x00F');
  assert.equal(toPackedColour(NO_COLOUR), 32768, 'the no-colour sentinel becomes the default marker');
  assert.equal(channelByte(0xf00, 8), 255, 'a channel widens back to 0..255');
  assert.equal(channelByte(0xf00, 4), 0);
  assert.equal(packColourPair(RED, BLUE), 986880, '0xF000F00: the foreground low, the background high');
  assert.equal(packColourPair(NO_COLOUR, NO_COLOUR), -2147450880,
    'two markers pack to 0x80008000, which the signed bitwise operators read as negative');
});

test('the SGR a colour is drawn with, and the side that is a reset', () => {
  assert.equal(sgrSide(packColourPair(RED, BLUE) & 0xffff, 'foreground'), '38;2;255;0;0');
  assert.equal(sgrSide(packColourPair(RED, BLUE) >>> 16, 'background'), '48;2;0;0;255');
  assert.equal(sgrSide(32768, 'foreground'), '39', 'the default marker is that side\'s reset code');
  assert.equal(sgrSide(32768, 'background'), '49');
  assert.equal(sgrPair(packColourPair(RED, BLUE)), '\x1b[38;2;255;0;0m\x1b[48;2;0;0;255m');
  assert.equal(resetSgr(), '\x1b[39m\x1b[49m', 'a paint starts with both sides reset');
  assert.deepEqual(SGR_CODES, { setForeground: 38, setBackground: 48, resetForeground: 39, resetBackground: 49, truecolor: 2 });
});

test('a fresh surface holds nothing and starts from the reset sequence', () => {
  const state = freshSurfaceState();
  assert.deepEqual(state.slots, []);
  assert.equal(state.held.size, 0);
  assert.equal(state.aliases.size, 0);
  assert.equal(state.table.length, SLOT_CAPACITY * 8, 'one eight-word cell per slot');
  assert.equal(state.probe.length, 8, 'and a one-cell probe');
  assert.deepEqual([state.admissions, state.paint, state.evaluated, state.netMatched], [0, 0, 0, 0]);
  assert.equal(state.lastSgr, resetSgr());
  assert.deepEqual([state.isStarved, state.hasCarried, state.hasStale], [false, false, false]);
  assert.equal(state.frame.size, 0);
  assert.equal(REUSE_COST, 1024);
  assert.equal(EVALUATION_BUDGET, 131072);
});

test('the matcher answers the closest slot, and the first one wins a tie', () => {
  const state = freshSurfaceState();
  encodeCell(state.table, 0, packColourPair(RED, 0x000000));
  encodeCell(state.table, 1, packColourPair(GREEN, 0x000000));
  encodeCell(state.table, 2, packColourPair(BLUE, 0x000000));
  encodeCell(state.probe, 0, packColourPair(RED, 0x000000));
  assert.equal(nearestSlot(state.table, 3, state.probe), 0);
  encodeCell(state.probe, 0, packColourPair(GREEN, 0x000000));
  assert.equal(nearestSlot(state.table, 3, state.probe), 1);
  encodeCell(state.probe, 0, packColourPair(BLUE, 0x000000));
  assert.equal(nearestSlot(state.table, 3, state.probe), 2);
  encodeCell(state.probe, 0, packColourPair(NO_COLOUR, 0x000000));
  assert.equal(nearestSlot(state.table, 3, state.probe), 0,
    'every slot differs only by the default flag, so they tie at the mismatch cost and the first wins');
  assert.equal(nearestSlot(state.table, 0, state.probe), -1, 'with no slots to compare there is no answer');
});

test('the stale list is the slots a paint has not touched, oldest first', () => {
  const state = freshSurfaceState();
  state.slots = [
    { key: 1, sgr: 'a', lastPaint: 0 },
    { key: 2, sgr: 'b', lastPaint: 5 },
    { key: 3, sgr: 'c', lastPaint: 2 },
  ];
  state.paint = 5;
  assert.deepEqual(staleSlots(state), [0, 2], 'the slot touched at this paint is not stale');
  state.paint = 6;
  assert.deepEqual(staleSlots(state), [0, 2, 1]);
  state.paint = 0;
  assert.deepEqual(staleSlots(state), [], 'at paint 0 nothing has been touched yet, so nothing is stale');
});

test('a paint admits the colours it does not hold and reuses the ones it does', () => {
  const engine = surface();
  assert.deepEqual([engine.size(), engine.standing()], [0, 'complete']);

  engine.beginPaint(new Set([RED_ON_BLACK, GREEN_ON_BLACK]));
  assert.deepEqual([engine.size(), engine.standing()], [2, 'complete']);

  engine.beginPaint(new Set([RED_ON_BLACK, GREEN_ON_BLACK]));
  assert.equal(engine.size(), 2, 'a colour the surface holds is not admitted a second time');

  engine.beginPaint(new Set([RED_ON_BLACK, GREEN_ON_BLACK, packColourPair(BLUE, 0x000000)]));
  assert.equal(engine.size(), 3);
});

test('a colour the surface holds answers its own escape, and one it does not answers the nearest hold', () => {
  const engine = surface();
  engine.beginPaint(new Set([RED_ON_BLACK]));
  assert.equal(engine.sgrOf(RED_ON_BLACK), '\x1b[38;2;255;0;0m\x1b[48;2;0;0;0m');

  const matched = engine.sgrOf(GREEN_ON_BLACK);
  assert.equal(matched, '\x1b[38;2;255;0;0m\x1b[48;2;0;0;0m',
    'a colour that has to be matched takes the escape of the slot it matched, and the only slot is red');
  assert.equal(engine.size(), 1, 'and matching records an alias rather than a new slot');
});

test('a surface with nothing to match answers the last escape it emitted', () => {
  const engine = surface();
  engine.beginPaint(new Set());
  assert.equal(engine.sgrOf(RED_ON_BLACK), resetSgr(),
    'there is no slot to match, so the escape is the one the paint started from');
  assert.deepEqual([engine.size(), engine.standing()], [0, 'complete']);
});

test('a starved paint reports waiting and places nothing', () => {
  it().rasterAdmission = { tokens: 0, refilledAt: 0 };
  const engine = createRasterSurface(() => 0, mb());
  engine.beginPaint(new Set([RED_ON_BLACK]));
  assert.deepEqual([engine.size(), engine.standing()], [0, 'waiting'],
    'the row had nothing to spend, so the frame was never placed');
});

test('a paint that stops matching reports progressing once it has evaluated the budget', () => {
  const engine = surface();
  engine.beginPaint(new Set([RED_ON_BLACK]));
  assert.equal(engine.standing(), 'complete');

  let flipped: number | undefined;
  for (let index = 0; index <= EVALUATION_BUDGET; index += 1) {
    engine.sgrOf(0x1000 + index);
    if (engine.standing() !== 'complete') { flipped = index; break; }
  }
  assert.equal(flipped, EVALUATION_BUDGET,
    'the matcher stops once a paint has evaluated the budget, and the paint reports it carried colours');
  assert.equal(engine.size(), 1, 'nothing was placed while it was not matching');
});

test('a frame\'s runs are one key per colour change, with the distinct set beside them', () => {
  const oneColour = frameRuns([65, RED, BLUE, 66, RED, BLUE], { columns: 2, rows: 1 });
  assert.deepEqual(oneColour.keys, [packColourPair(RED, BLUE)],
    'a key is pushed only where the colour changes, so a row of one colour is one run');
  assert.deepEqual([...oneColour.distinct], [packColourPair(RED, BLUE)]);

  const changed = frameRuns([65, RED, 0x000000, 66, GREEN, 0x000000, 67, RED, 0x000000], { columns: 3, rows: 1 });
  assert.deepEqual(changed.keys,
    [packColourPair(RED, 0x000000), packColourPair(GREEN, 0x000000), packColourPair(RED, 0x000000)],
    'the change back is a run of its own, so a three-colour row is three keys');
  assert.equal(changed.distinct.size, 2, 'and only two of them are distinct');
  assert.equal(CELL_STRIDE, 3, 'a cell is a code point and two colours');
});

test('the rows emit an escape only where the colour changes, and join with a newline', () => {
  const engine = surface();
  assert.equal(renderRows([65, RED, BLUE, 66, RED, BLUE], { columns: 2, rows: 1 }, engine),
    '\x1b[38;2;255;0;0m\x1b[48;2;0;0;255mAB',
    'one run of two cells takes one escape');

  const changed = renderRows([65, RED, 0x000000, 66, GREEN, 0x000000, 67, RED, 0x000000], { columns: 3, rows: 1 }, engine);
  assert.equal(changed,
    '\x1b[38;2;255;0;0m\x1b[48;2;0;0;0mA\x1b[38;2;0;255;0m\x1b[48;2;0;0;0mB\x1b[38;2;255;0;0m\x1b[48;2;0;0;0mC',
    'every colour change is announced, including the change back');

  const two = renderRows([65, RED, 0x000000, 66, GREEN, 0x000000], { columns: 2, rows: 1 }, engine);
  assert.equal(two.split('\n').length, 1, 'a one-row frame is one line');
});
