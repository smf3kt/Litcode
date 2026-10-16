// Measures the mount side of the raster surface (W45-59) before any assertion is written: the register
// helper's row reuse, its empties-only unregister and its same-row guard, the two writers' keys and row
// shapes, the Image builder's spread, and the end-to-end chain into W45-58's ui.blit. One JSON line per
// case.
import { it } from '../src/plugin-chain-host.js';
import { mountImage, mountRaster, registerSiteMount, withSwap } from '../src/plugin-chain-raster-mount.js';
import { raiseUiCall } from '../src/plugin-chain-ui.js';
import { hNs, ELs, vLs, Yto } from '../src/plugin-chain-raster-mount-source.js';

const caller = { plugin: 'tips', origin: [] };
const SEP = String.fromCharCode(0);
const show = (label: string, value: unknown) => console.log(label, JSON.stringify(value));
const shape = (row: unknown) => JSON.stringify(row, (key, value) => (value instanceof Set ? [...value] : value));

console.log('--- the raw bodies are the copied ones ---');
show('Yto/hNs/ELs/vLs', [typeof Yto, typeof hNs, typeof ELs, typeof vLs]);

console.log('--- registerSiteMount: row reuse, unregister, guard ---');
{
  const sites = new Map<string, { mounts: Set<unknown>; windowStart: number; blits: number }>();
  const mountsOf = (row: { mounts: Set<unknown> }) => row.mounts;
  const register = (mount: unknown, siteKey: string) => registerSiteMount({
    sites, siteKey, mount, mountsOf, freshSite: () => ({ mounts: new Set(), windowStart: 0, blits: 0 }),
  });
  const a = { id: 'a' };
  const b = { id: 'b' };
  const offA = register(a, 'k');
  show('after first mount', [...sites.keys()]);
  show('row holds', shape(sites.get('k')));
  const firstRow = sites.get('k');
  const offB = register(b, 'k');
  show('same row object', sites.get('k') === firstRow);
  show('row holds both', shape(sites.get('k')));
  offA();
  show('after one unregister', [...sites.keys()]);
  show('row holds one', shape(sites.get('k')));
  offB();
  show('after the last unregister', [...sites.keys()]);
  offB();
  show('unregister twice', [...sites.keys()], 'the second call sees the key gone');
  // The guard: a row the map no longer holds is left alone even when its set empties.
  const offC = register(a, 'g');
  const replaced = { mounts: new Set(['other']), windowStart: 0, blits: 0 };
  sites.set('g', replaced);
  offC();
  show('a replaced row survives', shape(sites.get('g')));
  // A Set, so the same element twice is one mount.
  const offD = register(a, 'd');
  const offE = register(a, 'd');
  show('same element twice', shape(sites.get('d')));
  offD();
  show('after unregistering one of two', [...sites.keys()]);
  offE();
  show('after both', [...sites.keys()]);
}

console.log('--- hNs: the key and the row ---');
{
  const element = { requestId: 'r', key: 'k', plugin: 'tips', columns: 1, rows: 1, paint: () => void 0 };
  const off = mountRaster(element as never);
  const key = ['tips', 'r', 'k'].join(SEP);
  show('mountedRasters keys', [...it().mountedRasters.keys()].map((k) => k.split(SEP)));
  show('row shape', shape(it().mountedRasters.get(key)));
  show('the element itself', shape([...it().mountedRasters.get(key)!.rasters][0]) === shape([element]));
  off();
  show('after unmount', [...it().mountedRasters.keys()].length);
}

console.log('--- ELs and vLs ---');
{
  const base = { requestId: 'r', key: 'i', plugin: 'tips', columns: 2, rows: 2 };
  const swap = (source: unknown) => source;
  const element = withSwap(base as never, { columns: 4 }, swap as never);
  show('built element', Object.keys(element).join(','));
  show('props win over the element', (element as { columns: number }).columns);
  show('swap is the argument', (element as { swap: unknown }).swap === swap);
  const off = mountImage(element as never);
  show('mountedImages keys', [...it().mountedImages.keys()].map((k) => k.split(SEP)));
  show('row shape', shape(it().mountedImages.get(['tips', 'r', 'i'].join(SEP))));
  off();
  show('after unmount', [...it().mountedImages.keys()].length);
}

console.log('--- the chain into ui.blit ---');
{
  const painted: number[][] = [];
  const element = { requestId: 'r', key: 'k', plugin: 'tips', columns: 2, rows: 2, paint: (words: Uint32Array) => painted.push([...words]) };
  const unmount = mountRaster(element as never);
  const bytes = Buffer.alloc(48);
  [65, 66, 67, 68].forEach((code, index) => bytes.writeUInt32LE(code, index * 12));
  const cells = bytes.toString('base64');
  show('blit after mount', await raiseUiCall({ event: 'ui.blit', args: { requestId: 'r', key: 'k', cells }, caller: caller as never }));
  show('painted', painted);
  show('row blits', it().mountedRasters.get(['tips', 'r', 'k'].join(SEP))!.blits);
  unmount();
  show('blit after unmount', await raiseUiCall({ event: 'ui.blit', args: { requestId: 'r', key: 'k', cells }, caller: caller as never }));
  // A second mount under the same key reuses the row, so the rate window is the row's, not the mount's.
  const row = { rasters: new Set([element]), windowStart: Date.now(), blits: 7 };
  it().mountedRasters.set(['tips', 'r', 'k'].join(SEP), row as never);
  const unmount2 = mountRaster(element as never);
  show('a remount keeps the count', it().mountedRasters.get(['tips', 'r', 'k'].join(SEP))!.blits);
  unmount2();
}
