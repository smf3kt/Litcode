import { it } from '../src/plugin-chain-host.js';
import { mb } from '../src/plugin-chain-raster-cells-source.js';
import { gNs, Lss, pc } from '../src/plugin-chain-raster-surface-source.js';

const show = (label: string, value: unknown) => console.log(label, JSON.stringify(value));
const A = pc(0xff0000, 0x000000);
const B = pc(0x00ff00, 0x000000);

// The same key painted twice: held, not re-admitted.
it().rasterAdmission = undefined;
const s = gNs(() => 0, mb());
s.beginPaint(new Set([A, B]));
show('two keys', [s.size(), s.standing()]);
s.beginPaint(new Set([A, B]));
show('the same two again', [s.size(), s.standing()]);
s.beginPaint(new Set([A, B, pc(0x0000ff, 0x000000)]));
show('a third', [s.size(), s.standing()]);

// Starvation: a row with nothing left to spend and no refill.
it().rasterAdmission = { tokens: 0, refilledAt: 0 };
const starved = gNs(() => 0, mb());
starved.beginPaint(new Set([A]));
show('starved', [starved.size(), starved.standing()]);

// A carried colour: a key whose slot was matched rather than held.
it().rasterAdmission = undefined;
const carried = gNs(() => 0, mb());
carried.beginPaint(new Set([A]));
show('sgr of the held key', carried.sgrOf(A));
show('sgr of a key that has to be matched', carried.sgrOf(B));
show('after matching', [carried.size(), carried.standing()]);

// A row that asks for a key it has never placed, with no slots to match against.
const empty = gNs(() => 0, mb());
empty.beginPaint(new Set());
show('nothing placed, an unknown key', empty.sgrOf(A));
show('after that', [empty.size(), empty.standing()]);

// Lss over a frame whose second row changes nothing.
const frame = [65, 0xff0000, 0x000000, 66, 0xff0000, 0x000000];
show('one row, one colour', JSON.stringify(Lss(frame, { columns: 2, rows: 1 }, carried)));
