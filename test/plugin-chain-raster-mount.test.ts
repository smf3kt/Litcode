// The mount side of the `$` table's raster surface (W45-59): the register helper `Yto` and the two row
// writers that fill the registries W45-58's ui.blit reads — `hNs` (chunk-n3ykh62m.js [256712,257058)) and
// `ELs`/`vLs` (chunk-sfn1dbxq.js [1869519,1869714)). Assertions are written from the measurement probe
// .audit/w45-59-probe.ts; the mounts here go through the product seam a site calls.

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { it } from '../src/plugin-chain-host.js';
import { mountImage, mountRaster, registerSiteMount, withSwap } from '../src/plugin-chain-raster-mount.js';
import { raiseUiCall } from '../src/plugin-chain-ui.js';
import type { MountedImageElement, MountedRasterElement } from '../src/plugin-chain-raster-mount.js';

const caller = { plugin: 'tips', origin: [] };
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
const swaps: unknown[] = [];

function raster(columns = 1, rows = 1, plugin = 'tips', requestId = 'r', key = 'k'): MountedRasterElement {
  return { plugin, requestId, key, columns, rows, paint: (words: Uint32Array) => painted.push([...words]) };
}

/** An Image element whose `swap` answers `answer` — `undefined` accepts, a string is the reason it refuses. */
function image(columns = 1, rows = 1, answer?: unknown, plugin = 'tips', requestId = 'r', key = 'k'): MountedImageElement {
  return { plugin, requestId, key, columns, rows, swap: (source: unknown) => (swaps.push(source), answer) };
}

/** A bare register over a map of this test's own rows, for the helper's own behaviour. */
function harness() {
  const sites = new Map<string, { mounts: Set<unknown>; windowStart: number; blits: number }>();
  let built = 0;
  const register = (mount: unknown, key: string) => registerSiteMount({
    sites,
    siteKey: key,
    mount,
    mountsOf: (row) => row.mounts,
    freshSite: () => (built += 1, { mounts: new Set(), windowStart: 0, blits: 0 }),
  });
  return { sites, register, builtCount: () => built };
}

afterEach(() => {
  it().mountedRasters.clear();
  it().mountedImages.clear();
  painted.length = 0;
  swaps.length = 0;
});

test('a row is built once per key, and every later mount is written into that same row', () => {
  const { sites, register, builtCount } = harness();
  const first = { id: 'first' };
  const second = { id: 'second' };
  const offFirst = register(first, 'k');

  assert.deepEqual([...sites.keys()], ['k'], 'the first mount creates the key');
  const row = sites.get('k');
  assert.deepEqual([...row!.mounts], [first]);

  register(second, 'k');
  assert.equal(sites.get('k'), row, 'the second mount reuses the row object rather than building another');
  assert.deepEqual([...row!.mounts], [first, second]);
  assert.equal(builtCount(), 1, 'freshSite runs only for the first mount under a key');

  register({ id: 'third' }, 'other');
  assert.equal(builtCount(), 2, 'a different key builds its own row');
  offFirst();
});

test('the unregister drops the mount, and the key only once its set has emptied', () => {
  const { sites, register } = harness();
  const first = { id: 'first' };
  const second = { id: 'second' };
  const offFirst = register(first, 'k');
  const offSecond = register(second, 'k');

  offFirst();
  assert.deepEqual([...sites.keys()], ['k'], 'the key stays while one mount is left');
  assert.deepEqual([...sites.get('k')!.mounts], [second]);

  offSecond();
  assert.deepEqual([...sites.keys()], [], 'the last unregister takes the key with it');

  offSecond();
  assert.deepEqual([...sites.keys()], [], 'unregistering twice leaves the map as it was');
});

test('a row the map no longer holds is left alone, and a repeated mount is one mount', () => {
  const { sites, register } = harness();
  const element = { id: 'element' };
  const off = register(element, 'guard');
  const replacement = { mounts: new Set(['someone else']), windowStart: 0, blits: 0 };
  sites.set('guard', replacement);

  off();
  assert.deepEqual([...replacement.mounts], ['someone else'],
    'the map holds another row now, so this unregister does not empty it');

  const offFirst = register(element, 'twice');
  const offSecond = register(element, 'twice');
  assert.deepEqual([...sites.get('twice')!.mounts], [element], 'the row holds a Set, so the same element twice is one entry');
  offFirst();
  assert.deepEqual([...sites.keys()], ['guard'], 'the first unregister empties the set');
  offSecond();
  assert.deepEqual([...sites.keys()], ['guard']);
});

test('mountRaster fills the raster registry under the site key, and its unregister empties it', () => {
  const element = raster(2, 3);
  const off = mountRaster(element);

  assert.deepEqual([...it().mountedRasters.keys()], [siteKey('tips', 'r', 'k')],
    'the key is the plugin, the requestId and the element key joined with the NUL');
  const row = it().mountedRasters.get(siteKey('tips', 'r', 'k'))!;
  assert.equal([...row.rasters][0], element, 'the row holds the very element the site handed over');
  assert.deepEqual([...row.rasters], [element]);
  assert.equal(row.windowStart, 0, 'a fresh row starts outside any window');
  assert.equal(row.blits, 0);

  off();
  assert.equal(it().mountedRasters.size, 0, 'the unregister takes the last mount and the key with it');
});

test('mountImage fills the image registry the same way', () => {
  const element = image(2, 2);
  const off = mountImage(element);

  assert.deepEqual([...it().mountedImages.keys()], [siteKey('tips', 'r', 'k')]);
  const row = it().mountedImages.get(siteKey('tips', 'r', 'k'))!;
  assert.equal([...row.images][0], element);
  assert.equal(row.windowStart, 0);
  assert.equal(row.blits, 0);

  off();
  assert.equal(it().mountedImages.size, 0);
});

test('withSwap spreads the element, then the props, then the swap the blit will call', () => {
  const base = image(2, 2, undefined, 'tips', 'r', 'i');
  const swap = (source: unknown) => (swaps.push(source), undefined);
  const built = withSwap(base, { columns: 4, rows: 5 }, swap);

  assert.equal(built.columns, 4, 'the props win over the element they spread');
  assert.equal(built.rows, 5);
  assert.equal(built.requestId, 'r', 'the element fields the props do not name survive');
  assert.equal(built.swap, swap, 'the swap is the third argument, not one the props carried');
  assert.equal(withSwap(base, { swap: () => 'from the props' } as never, swap).swap, swap,
    'a swap among the props is overridden by the one the caller passes');
});

test('a mounted Raster is what the ui.blit entry paints, and unmounting it ends the blit', async () => {
  const element = raster(2, 1);
  const cells = encodedCells([[65, 0, 0], [66, 0, 0]]);
  const off = mountRaster(element);

  assert.deepEqual(await raiseUiCall({ event: 'ui.blit', args: { requestId: 'r', key: 'k', cells }, caller }),
    {}, 'the blit is accepted once the site has mounted');
  assert.deepEqual(painted, [[65, 0, 0, 66, 0, 0]], 'the element it mounted is the one painted');
  assert.equal(it().mountedRasters.get(siteKey('tips', 'r', 'k'))!.blits, 1, 'and the row counted it');

  off();
  assert.deepEqual(await raiseUiCall({ event: 'ui.blit', args: { requestId: 'r', key: 'k', cells }, caller }),
    { deny: 'no Raster of its own is mounted under key "k" in r' },
    'with the site unmounted there is nothing under that key for it to paint');
});

test('a mounted Image is what the entry swaps into, and its swap answers the blit', async () => {
  const source = pngSource();
  const accepting = mountImage(image());

  assert.deepEqual(await raiseUiCall({ event: 'ui.blit', args: { requestId: 'r', key: 'k', source }, caller }), {},
    'a swap that answers nothing accepts the blit');
  assert.equal(swaps.length, 1);
  assert.equal(swaps[0], source, 'the swap is handed the source as it arrived');
  assert.equal(it().mountedImages.get(siteKey('tips', 'r', 'k'))!.blits, 1);
  accepting();

  const refusing = mountImage(image(1, 1, 'the surface refused it'));
  assert.deepEqual(await raiseUiCall({ event: 'ui.blit', args: { requestId: 'r', key: 'k', source }, caller }),
    { deny: 'the surface refused it' }, 'the reason the swap answered is the answer');
  refusing();

  assert.deepEqual(await raiseUiCall({ event: 'ui.blit', args: { requestId: 'r', key: 'k', source }, caller }),
    { deny: 'no Image of its own is mounted under key "k" in r' });
});

test('a remount under a live key keeps the row, so the rate window is the row\'s and not the mount\'s', async () => {
  const element = raster();
  const cells = encodedCells([[65, 0, 0]]);
  const row = { rasters: new Set([element]), windowStart: Date.now(), blits: 7 };
  it().mountedRasters.set(siteKey('tips', 'r', 'k'), row);

  const off = mountRaster(element);
  assert.equal(it().mountedRasters.get(siteKey('tips', 'r', 'k')), row, 'the mount wrote into the row that was there');

  await raiseUiCall({ event: 'ui.blit', args: { requestId: 'r', key: 'k', cells }, caller });
  assert.equal(row.blits, 8, 'the count carries on from the row, not from zero');
  off();
});
