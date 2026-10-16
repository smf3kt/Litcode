// Measures the raster surface engine (W45-61) before any assertion is written. One JSON line per case.
import { it } from '../src/plugin-chain-host.js';
import { mb } from '../src/plugin-chain-raster-cells-source.js';
import {
  _b, _s, A, cb, CZ, db, fc, Ff, fl, gNs, gc, Hf, hc, lb, Lss, nG, nb, pc, PH, S, Sc, ub, xse, Y9e,
} from '../src/plugin-chain-raster-surface-source.js';

const show = (label: string, value: unknown) => console.log(label, JSON.stringify(value));

console.log('--- the grammar and the CSI helper ---');
show('introducer', [A === '\x1b[', PH === '\x1b', Y9e === ';', nG === '\x07']);
show('czi', CZ);
show('ranges', S);
show('a few codes', [xse.ESC, xse.BEL, xse.DEL]);
show('fl()', fl());
show('fl(0)', fl(0));
show('fl(38,2,255,0,0,"m")', fl(38, 2, 255, 0, 0, 'm'));
show('fl("m")', fl('m'));

console.log('--- colours ---');
show('fc(0xf00,8)', fc(0xf00, 8));
show('fc(0xf00,4)', fc(0xf00, 4));
show('Ff(0xff0000)', Ff(0xff0000));
show('Ff(0x00ff00)', Ff(0x00ff00));
show('Ff(0x0000ff)', Ff(0x0000ff));
show('Ff(0x1000000)', Ff(0x1000000));
show('pc(0xff0000,0x0000ff)', pc(0xff0000, 0x0000ff));
show('pc of two sentinels', pc(0x1000000, 0x1000000));
show('Hf(fg)', Hf(pc(0xff0000, 0x0000ff) & 0xffff, 'foreground'));
show('Hf(bg)', Hf(pc(0xff0000, 0x0000ff) >>> 16, 'background'));
show('Hf sentinel fg', Hf(32768, 'foreground'));
show('Hf sentinel bg', Hf(32768, 'background'));
show('gc', gc(pc(0xff0000, 0x0000ff)));
show('hc()', hc());

console.log('--- the surface state ---');
show('lb()', lb());
show('the table length', lb().table.length, lb().probe.length);
show('bounds', [nb, Sc, ub]);

console.log('--- the matcher ---');
{
  const state = lb();
  // One cell per slot, 8 words each, written through the same encoder the engine uses.
  const { encodeCell } = await import('../src/plugin-chain-raster-cells.js');
  encodeCell(state.table, 0, pc(0xff0000, 0x000000));
  encodeCell(state.table, 1, pc(0x00ff00, 0x000000));
  encodeCell(state.table, 2, pc(0x0000ff, 0x000000));
  const probe = state.probe;
  encodeCell(probe, 0, pc(0xff0000, 0x000000));
  show('exact match', db(state.table, 3, probe));
  encodeCell(probe, 0, pc(0x00ff00, 0x000000));
  show('the green slot', db(state.table, 3, probe));
  encodeCell(probe, 0, pc(0x0000ff, 0x000000));
  show('the blue slot', db(state.table, 3, probe));
  encodeCell(probe, 0, pc(0x1000000, 0x000000));
  show('a default foreground', db(state.table, 3, probe));
  show('no slots', db(state.table, 0, probe));
}

console.log('--- the stale list ---');
{
  const state = lb();
  state.slots = [{ key: 1, sgr: 'a', lastPaint: 0 }, { key: 2, sgr: 'b', lastPaint: 5 }, { key: 3, sgr: 'c', lastPaint: 2 }];
  state.paint = 5;
  show('cb at paint 5', cb(state));
  state.paint = 6;
  show('cb at paint 6', cb(state));
  state.paint = 0;
  show('cb at paint 0', cb(state));
}

console.log('--- the engine ---');
{
  it().rasterAdmission = undefined;
  const surface = gNs(() => 0, mb());
  show('a fresh surface', [surface.size(), surface.standing()]);
  const frame = new Set([pc(0xff0000, 0x0000ff), pc(0x00ff00, 0x000000)]);
  surface.beginPaint(frame);
  show('after one paint', [surface.size(), surface.standing()]);
  show('sgrOf the first', surface.sgrOf(pc(0xff0000, 0x0000ff)));
  show('sgrOf the second', surface.sgrOf(pc(0x00ff00, 0x000000)));
  show('sgrOf an unknown key', surface.sgrOf(0x12345678));
  show('the row', (() => { const r = lb(); return null; })());
}

console.log('--- the rows ---');
{
  const frame = [65, 0xff0000, 0x0000ff, 66, 0xff0000, 0x0000ff];
  const size = { columns: 2, rows: 1 };
  const runs = _b(frame, size);
  show('the runs of one row', [runs.keys, [...runs.distinct]]);
  it().rasterAdmission = undefined;
  const surface = gNs(() => 0, mb());
  show('the rendered row', Lss(frame, size, surface));
  const two = [65, 0xff0000, 0x000000, 66, 0x00ff00, 0x000000, 67, 0xff0000, 0x000000];
  show('two rows', Lss(two, { columns: 3, rows: 1 }, surface));
}
