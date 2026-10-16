// The `$` table's ui.blit entry (W45-58). The floor is ported verbatim — `{check:fNs,run:(n,r)=>bFo(n)?kFo(n,r):mNs(n,r)}`
// from the source's table literal in chunk-sfn1dbxq.js [2353695,2353752) — and the bodies are the copy's
// src/plugin-chain-ui-blit-source.ts (the Raster run at chunk-n3ykh62m.js [248812,252131), the Image run
// at chunk-sfn1dbxq.js [1868588,1869519), the validator at [242947,245185)). Assertions are written from
// the measurement probe .audit/w45-58-probe.ts.

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { it } from '../src/plugin-chain-host.js';
import { BLITS_PER_SECOND, raiseUiCall, uiCallTable } from '../src/plugin-chain-ui.js';
import { bFo, fNs, fur, kFo, mNs } from '../src/plugin-chain-ui-blit-source.js';
import type { MountedImageSite, MountedRasterSite } from '../src/plugin-chain-registry-state.js';

type RasterElement = Parameters<MountedRasterSite['rasters']['add']>[0];
type ImageElement = Parameters<MountedImageSite['images']['add']>[0];

const caller = { plugin: 'tips', origin: [] };
const OTHER = { plugin: 'rival', origin: [] };
const SEP = String.fromCharCode(0);
const siteKey = (plugin: string, requestId: string, key: string) => [plugin, requestId, key].join(SEP);

/** One cell is three little-endian words: the code point, the foreground and the background. */
function encodedCells(cells: Array<[number, number, number]>): string {
  const bytes = Buffer.alloc(cells.length * 12);
  cells.forEach(([code, fg, bg], index) => {
    bytes.writeUInt32LE(code, index * 12);
    bytes.writeUInt32LE(fg, index * 12 + 4);
    bytes.writeUInt32LE(bg, index * 12 + 8);
  });
  return bytes.toString('base64');
}

/** A `source.png` the validator admits: the signature, the IHDR type at 12 and the declared size. */
function pngSource(width = 1, height = 1): { png: string } {
  const bytes = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.write('IHDR', 12, 'latin1');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return { png: bytes.toString('base64') };
}

const painted: number[][] = [];
const swapped: unknown[] = [];

function raster(columns: number, rows: number, plugin = 'tips', requestId = 'r', key = 'k'): RasterElement {
  return { plugin, requestId, key, columns, rows, paint: (words: Uint32Array) => painted.push([...words]) };
}

function image(columns: number, rows: number, answer: unknown, plugin = 'tips', requestId = 'r', key = 'k'): ImageElement {
  return { plugin, requestId, key, columns, rows, swap: (source: unknown) => (swapped.push(source), answer) };
}

/** Mount one raster row the way the site mount does, and answer it. */
function mountRaster(plugin: string, requestId: string, key: string, rasters: RasterElement[]) {
  const row = { rasters: new Set(rasters), windowStart: Date.now(), blits: 0 };
  it().mountedRasters.set(siteKey(plugin, requestId, key), row);
  return row;
}

function mountImage(plugin: string, requestId: string, key: string, images: ImageElement[]) {
  const row = { images: new Set(images), windowStart: Date.now(), blits: 0 };
  it().mountedImages.set(siteKey(plugin, requestId, key), row);
  return row;
}

afterEach(() => {
  it().mountedRasters.clear();
  it().mountedImages.clear();
  painted.length = 0;
  swapped.length = 0;
});

test('the table carries the blit entry as the last of the six ui names', () => {
  const table = uiCallTable();
  assert.equal(Object.keys(table).join(','), 'ui.toast,ui.status,ui.log,ui.selection,ui.notify,ui.blit');
  assert.equal(Object.keys(table['ui.blit']).sort().join(','), 'check,run',
    'this entry carries no stamp, unlike its neighbours ui.copy and ui.notify');
  assert.equal(table['ui.blit'].check, fNs, 'the check is the copied body itself');
});

test('the check takes one of cells or source, and numbers when given', () => {
  const takes = 'takes { requestId, key, cells } (strings; the site, the Raster\'s key, its encoded cells)'
    + ' or { requestId, key, source } (the Image\'s key, its next ImageSource)';
  assert.equal(fNs({ requestId: 'r', key: 'k', cells: 'anything' }), undefined);
  assert.equal(fNs({ requestId: 'r', key: 'k', source: { png: 'x' } }), undefined);
  assert.equal(fNs({ requestId: 'r', key: 'k', cells: 'x', source: { png: 'x' } }), takes);
  assert.equal(fNs({ requestId: 'r', key: 'k' }), takes);
  assert.equal(fNs({ key: 'k', cells: 'x' }), takes);
  assert.equal(fNs({ requestId: 'r', key: '', cells: 'x' }), takes);
  assert.equal(fNs({ requestId: 'r', key: 'k', cells: 'x', source: 1 }), takes,
    'a `source` that is not a plain object is not one');
  assert.equal(fNs({ requestId: 'r', key: 'k', source: [] }), takes, 'nor is an array');
  assert.equal(fNs({ requestId: 'r', key: 'k', cells: 'x', columns: '4' }), 'columns and rows are numbers when given');
  assert.equal(fNs({ requestId: 'r', key: 'k', cells: 'x', rows: '4' }), 'columns and rows are numbers when given');
  assert.equal(fNs({ requestId: 'r', key: 'k', cells: 'x', columns: 4, rows: 4 }), undefined);
});

test('the selector sends a `source` to the Image run and the rest to the Raster run', () => {
  assert.equal(bFo({ source: {} }), true);
  assert.equal(bFo({ cells: 'x' }), false);
  assert.equal(bFo({ source: undefined }), false, 'the key is there but its value is not a plain object');
  assert.equal(bFo({ source: [] }), false);
  assert.equal(bFo({}), false);
});

test('the cell decoder holds cells to the size and to width-1 printable code points', () => {
  assert.deepEqual([...(fur(encodedCells([[65, 0, 0]]), 1, 1).words ?? [])], [65, 0, 0]);
  assert.deepEqual(
    [...(fur(encodedCells([[65, 0, 0], [66, 1, 2], [67, 0, 0], [68, 0, 0]]), 2, 2).words ?? [])],
    [65, 0, 0, 66, 1, 2, 67, 0, 0, 68, 0, 0],
  );
  assert.deepEqual(fur('AAAA', 1, 1),
    { problem: 'cells must be the base64 of 1 cells of 12 bytes (16 characters for 1x1)' });
  assert.deepEqual(fur('!'.repeat(16), 1, 1), { problem: 'cells is not base64 (standard alphabet, padded)' });
  assert.deepEqual(fur(encodedCells([[1, 0, 0]]), 1, 1), {
    problem: 'cell 0 holds U+0001, which is not one printable width-1 code point (a control, combining or wide character)',
  });
  assert.deepEqual(fur(encodedCells([[0x4e16, 0, 0]]), 1, 1), {
    problem: 'cell 0 holds U+4E16, which is not one printable width-1 code point (a control, combining or wide character)',
  }, 'a wide character is refused by the product\'s own width notion');
  assert.deepEqual(fur(encodedCells([[0x1f600, 0, 0]]), 1, 1),
    { problem: 'cell 0 holds code point 128512, beyond the Basic Multilingual Plane' });
  assert.deepEqual([...(fur(encodedCells([[65, 0x1000000, 0xffffff]]), 1, 1).words ?? [])], [65, 0x1000000, 0xffffff],
    'the default color 0x1000000 is allowed beside 0xRRGGBB');
  assert.deepEqual(fur(encodedCells([[65, 0x2000000, 0]]), 1, 1),
    { problem: 'cell 0 holds a color that is neither 0xRRGGBB nor 0x1000000 (the default)' });
});

test('the Raster run paints every mounted element of the size, and answers {}', async () => {
  mountRaster('tips', 'r', 'k', [raster(2, 2), raster(2, 2)]);
  assert.deepEqual(await mNs({ requestId: 'r', key: 'k', cells: encodedCells([[65, 0, 0], [66, 0, 0], [67, 0, 0], [68, 0, 0]]) }, caller),
    {});
  assert.equal(painted.length, 2, 'both mounted rasters of that size are painted');
  assert.deepEqual(painted[0], [65, 0, 0, 66, 0, 0, 67, 0, 0, 68, 0, 0]);
});

test('a blit the site does not hold is a denial, not a throw', async () => {
  assert.deepEqual(await mNs({ requestId: 'r', key: 'k', cells: encodedCells([[65, 0, 0]]) }, caller),
    { deny: 'no Raster of its own is mounted under key "k" in r' });
  assert.deepEqual(await kFo({ requestId: 'r', key: 'k', source: pngSource() }, caller),
    { deny: 'no Image of its own is mounted under key "k" in r' });
  mountRaster('rival', 'r', 'k', [raster(1, 1, 'rival', 'r', 'k')]);
  assert.deepEqual(await mNs({ requestId: 'r', key: 'k', cells: encodedCells([[65, 0, 0]]) }, caller),
    { deny: 'the Raster under key "k" in r is another plugin\'s, not its to paint' },
    'the rival\'s row is named rather than painted');
  assert.deepEqual(await kFo({ requestId: 'r', key: 'k', source: pngSource() }, caller),
    { deny: 'no Image of its own is mounted under key "k" in r' },
    'the Raster side and the Image side look in their own registry');
});

test('a size the mounted element does not have is refused by name', async () => {
  mountRaster('tips', 'r', 'k', [raster(2, 2)]);
  assert.deepEqual(await mNs({ requestId: 'r', key: 'k', cells: encodedCells([[65, 0, 0]]), columns: 4, rows: 4 }, caller),
    { deny: 'the mounted Raster is 2x2, not 4x4; a resize is a redraw (ui.invalidate)' });
  mountImage('tips', 'r', 'i', [image(1, 1, void 0)]);
  assert.deepEqual(await kFo({ requestId: 'r', key: 'i', source: pngSource(), columns: 4 }, caller),
    { deny: 'the mounted Image is 1x1, not 4x1; a resize is a redraw (ui.invalidate)' });
});

test('cells the size cannot read are refused with the decoder\'s own problem', async () => {
  mountRaster('tips', 'r', 'k', [raster(2, 2)]);
  assert.deepEqual(await mNs({ requestId: 'r', key: 'k', cells: 'short' }, caller),
    { deny: 'cells must be the base64 of 4 cells of 12 bytes (64 characters for 2x2)' });
  assert.deepEqual(await mNs({ requestId: 'r', key: 'k', cells: encodedCells([[65, 0, 0x2000000, ]] as never) }, caller),
    { deny: 'cells must be the base64 of 4 cells of 12 bytes (64 characters for 2x2)' },
    'a 1-cell payload is short for a 2x2 request before its colors are read');
});

test('the window admits 120 blits a second per site, then refuses', async () => {
  const row = mountRaster('tips', 'r', 'k', [raster(1, 1)]);
  const cells = encodedCells([[65, 0, 0]]);
  assert.deepEqual(await mNs({ requestId: 'r', key: 'k', cells }, caller), {});
  assert.equal(row.blits, 1, 'an admitted blit counts against the row');
  row.blits = BLITS_PER_SECOND;
  assert.deepEqual(await mNs({ requestId: 'r', key: 'k', cells }, caller),
    { deny: 'more than 120 blits a second; the surface paints at its frame rate, so one blit a frame is all that shows' });
  assert.equal(row.blits, BLITS_PER_SECOND, 'a refused blit is not counted');
  row.windowStart = Date.now() - 1000;
  assert.deepEqual(await mNs({ requestId: 'r', key: 'k', cells }, caller), {},
    'once the window has passed the count starts again');
  assert.equal(row.blits, 1);
});

test('the Image run validates the source, swaps it, and reports only the first answer', async () => {
  mountImage('tips', 'r', 'k', [image(1, 1, void 0)]);
  assert.deepEqual(await kFo({ requestId: 'r', key: 'k', source: { png: '!!' } }, caller),
    { deny: 'source.png must be standard padded base64' });
  assert.deepEqual(await kFo({ requestId: 'r', key: 'k', source: { png: encodedCells([[65, 0, 0]]) } }, caller),
    { deny: 'source.png does not start as a PNG file does' });
  assert.deepEqual(await kFo({ requestId: 'r', key: 'k', source: { png: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64') } }, caller),
    { deny: 'source.png has no IHDR header after its signature' },
    'the signature passes and the header is missing');
  const source = pngSource();
  assert.deepEqual(await kFo({ requestId: 'r', key: 'k', source }, caller), {});
  assert.deepEqual(swapped, [source], 'the swap is handed the source the plugin passed');
});

test('a refused swap of the first mounted element is the answer', async () => {
  mountImage('tips', 'r', 'k', [image(1, 1, 'the surface refused it')]);
  assert.deepEqual(await kFo({ requestId: 'r', key: 'k', source: pngSource() }, caller),
    { deny: 'the surface refused it' });
  // Measured: the run reports `he[0]` alone, so a later element's refusal is dropped when the first
  // answers nothing. The source has the same hole.
  mountImage('tips', 'm', 'k', [image(1, 1, void 0), image(1, 1, 'the second surface refused it')]);
  assert.deepEqual(await kFo({ requestId: 'm', key: 'k', source: pngSource() }, caller), {});
});

test('the seam raises the entry, and a hookless raise runs the floor without the check', async () => {
  mountRaster('tips', 'r', 'k', [raster(1, 1)]);
  const cells = encodedCells([[65, 0, 0]]);
  assert.deepEqual(await raiseUiCall({ event: 'ui.blit', args: { requestId: 'r', key: 'k', cells }, caller: caller as never }), {});
  assert.equal(painted.length, 1);
  assert.deepEqual(await raiseUiCall({ event: 'ui.blit', args: { requestId: 'r', key: 'k', cells, columns: '4' }, caller: caller as never }),
    { deny: 'the mounted Raster is 1x1, not 4x1; a resize is a redraw (ui.invalidate)' },
    'with no handler ahead of the floor the check is not consulted, so the string size reaches the run');
  assert.equal(painted.length, 1, 'and the requested size 4x4 matched nothing');
  assert.deepEqual(await raiseUiCall({ event: 'ui.blit', args: {}, caller: OTHER as never }),
    { deny: 'no Raster of its own is mounted under key "undefined" in undefined' },
    'an empty argument reaches the floor and its denial names what it looked for');
});
