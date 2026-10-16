// Measures the `$` table's ui.blit entry (W45-58) before any assertion is written: the check's
// refusals, the two run paths against seeded mounted registries, the cell decoder's problems, the
// rate window's boundary, and the `bFo` selector. Prints one JSON line per case.
import { it } from '../src/plugin-chain-host.js';
import { bFo, fNs, fur, kFo, mNs, rb, ZPn } from '../src/plugin-chain-ui-blit-source.js';

const caller = { plugin: 'tips', origin: [] };
const SEP = String.fromCharCode(0);
const siteKey = (plugin: string, requestId: string, key: string) => [plugin, requestId, key].join(SEP);
const show = (label: string, value: unknown) => console.log(label, JSON.stringify(value));

function encodedCells(cells: Array<[number, number, number]>): string {
  const bytes = Buffer.alloc(cells.length * 12);
  cells.forEach(([code, fg, bg], index) => {
    bytes.writeUInt32LE(code, index * 12);
    bytes.writeUInt32LE(fg, index * 12 + 4);
    bytes.writeUInt32LE(bg, index * 12 + 8);
  });
  return bytes.toString('base64');
}

console.log('--- check ---');
show('ok cells', fNs({ requestId: 'r', key: 'k', cells: 'x' }));
show('ok source', fNs({ requestId: 'r', key: 'k', source: { png: 'x' } }));
show('both', fNs({ requestId: 'r', key: 'k', cells: 'x', source: { png: 'x' } }));
show('neither', fNs({ requestId: 'r', key: 'k' }));
show('no requestId', fNs({ key: 'k', cells: 'x' }));
show('empty key', fNs({ requestId: 'r', key: '', cells: 'x' }));
show('source not object', fNs({ requestId: 'r', key: 'k', cells: 'x', source: 1 }));
show('source array', fNs({ requestId: 'r', key: 'k', source: [] }));
show('columns string', fNs({ requestId: 'r', key: 'k', cells: 'x', columns: '4' }));
show('rows string', fNs({ requestId: 'r', key: 'k', cells: 'x', rows: '4' }));
show('columns number', fNs({ requestId: 'r', key: 'k', cells: 'x', columns: 4, rows: 4 }));

console.log('--- bFo ---');
show('cells', bFo({ cells: 'x' }));
show('source object', bFo({ source: {} }));
show('source undefined', bFo({ source: undefined }));
show('source array', bFo({ source: [] }));
show('empty', bFo({}));

console.log('--- fur ---');
show('rb 1x1', rb(1, 1));
show('rb 2x2', rb(2, 2));
show('good 1x1', fur(encodedCells([[65, 0, 0]]), 1, 1));
show('good 2x2 words', [...(fur(encodedCells([[65, 0, 0], [66, 1, 2], [67, 0, 0], [68, 0, 0]]), 2, 2).words as Uint32Array)]);
show('short', fur('AAAA', 1, 1));
show('bad base64', fur('!'.repeat(16), 1, 1));
show('control char', fur(encodedCells([[1, 0, 0]]), 1, 1));
show('wide char', fur(encodedCells([[0x4e16, 0, 0]]), 1, 1));
show('beyond bmp', fur(encodedCells([[0x1f600, 0, 0]]), 1, 1));
show('default color', fur(encodedCells([[65, 0x1000000, 0xffffff]]), 1, 1));
show('bad color', fur(encodedCells([[65, 0x2000000, 0]]), 1, 1));

console.log('--- Raster run ---');
const paint: number[][] = [];
const raster = (columns: number, rows: number, plugin = 'tips', requestId = 'r', key = 'k') => ({
  plugin, requestId, key, columns, rows, paint: (words: Uint32Array) => paint.push([...words]),
});
show('no row', await mNs({ requestId: 'r', key: 'k', cells: encodedCells([[65, 0, 0]]) }, caller));
it().mountedRasters.set(siteKey('other', 'r', 'nope'), { rasters: new Set([raster(1, 1, 'other', 'r', 'nope')]), windowStart: 0, blits: 0 });
show('another plugin', await mNs({ requestId: 'r', key: 'nope', cells: encodedCells([[65, 0, 0]]) }, caller));
const row = { rasters: new Set([raster(2, 2)]), windowStart: Date.now(), blits: 0 };
it().mountedRasters.set(siteKey('tips', 'r', 'k'), row);
show('size mismatch', await mNs({ requestId: 'r', key: 'k', cells: encodedCells([[65, 0, 0]]), columns: 4, rows: 4 }, caller));
show('good 2x2', await mNs({ requestId: 'r', key: 'k', cells: encodedCells([[65, 0, 0], [66, 0, 0], [67, 0, 0], [68, 0, 0]]) }, caller));
show('painted', paint);
show('blits now', row.blits);
show('bad cells', await mNs({ requestId: 'r', key: 'k', cells: 'short' }, caller));
const twin = { rasters: new Set([raster(1, 1), raster(1, 1)]), windowStart: Date.now(), blits: 0 };
it().mountedRasters.set(siteKey('tips', 't', 'k'), twin);
show('twin ok', await mNs({ requestId: 't', key: 'k', cells: encodedCells([[65, 0, 0]]) }, caller));
show('twin painted', paint.length);
row.blits = ZPn;
show('at cap', await mNs({ requestId: 'r', key: 'k', cells: encodedCells([[65, 0, 0], [66, 0, 0], [67, 0, 0], [68, 0, 0]]) }, caller));
row.windowStart = Date.now() - 1000;
show('window rolled', await mNs({ requestId: 'r', key: 'k', cells: encodedCells([[65, 0, 0], [66, 0, 0], [67, 0, 0], [68, 0, 0]]) }, caller));
show('blits after roll', row.blits);

console.log('--- Image run ---');
const swaps: unknown[] = [];
const image = (columns: number, rows: number, answer: unknown, plugin = 'tips', requestId = 'r', key = 'k') => ({
  plugin, requestId, key, columns, rows, swap: (source: unknown) => (swaps.push(source), answer),
});
// A png source the validator admits: the 8-byte signature, the IHDR chunk type at 12 and a 1x1 size.
const pngSource = (width = 1, height = 1) => {
  const bytes = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.write('IHDR', 12, 'latin1');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return { png: bytes.toString('base64') };
};
const imageRow = { images: new Set([image(1, 1, void 0)]), windowStart: Date.now(), blits: 0 };
it().mountedImages.set(siteKey('tips', 'r', 'k'), imageRow);
show('no image', await kFo({ requestId: 'r', key: 'zz', source: pngSource() }, caller));
it().mountedImages.set(siteKey('other', 'r', 'zz'), { images: new Set([image(1, 1, void 0, 'other', 'r', 'zz')]), windowStart: 0, blits: 0 });
show('another plugin image', await kFo({ requestId: 'r', key: 'zz', source: pngSource() }, caller));
show('bad source', await kFo({ requestId: 'r', key: 'k', source: { png: '!!' } }, caller));
show('not a png', await kFo({ requestId: 'r', key: 'k', source: { png: encodedCells([[65, 0, 0]]) } }, caller));
show('good png source', await kFo({ requestId: 'r', key: 'k', source: pngSource() }, caller));
show('swap called', swaps.length);
show('swap source identity', swaps.at(-1));
const failing = { images: new Set([image(1, 1, 'the surface refused it')]), windowStart: Date.now(), blits: 0 };
it().mountedImages.set(siteKey('tips', 'f', 'k'), failing);
show('swap refused', await kFo({ requestId: 'f', key: 'k', source: { file: '/tmp/a.png', format: 'png' } }, caller));
show('size mismatch', await kFo({ requestId: 'r', key: 'k', source: pngSource(), columns: 4 }, caller));
const twinImages = { images: new Set([image(1, 1, void 0), image(1, 1, void 0)]), windowStart: Date.now(), blits: 0 };
it().mountedImages.set(siteKey('tips', 'tw', 'k'), twinImages);
show('twin swap ok', await kFo({ requestId: 'tw', key: 'k', source: pngSource() }, caller));
const mixed = { images: new Set([image(1, 1, void 0), image(1, 1, 'one surface said no')]), windowStart: Date.now(), blits: 0 };
it().mountedImages.set(siteKey('tips', 'mx', 'k'), mixed);
show('one of two refused', await kFo({ requestId: 'mx', key: 'k', source: pngSource() }, caller));
show('image at cap', await kFo({ requestId: 'r', key: 'k', source: pngSource(), columns: 1, rows: 1 }, caller));
