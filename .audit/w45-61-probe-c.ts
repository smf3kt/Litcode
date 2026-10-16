import { it } from '../src/plugin-chain-host.js';
import { mb } from '../src/plugin-chain-raster-cells-source.js';
import { gNs, hb, pc } from '../src/plugin-chain-raster-surface-source.js';

const show = (label: string, value: unknown) => console.log(label, JSON.stringify(value));
const A = pc(0xff0000, 0x000000);

// The evaluated budget: `T` stops matching once a paint has evaluated hb slots' worth.
it().rasterAdmission = undefined;
const s = gNs(() => 0, mb());
s.beginPaint(new Set([A]));
show('after a paint', [s.size(), s.standing()]);
let progressed = null;
for (let index = 0; index < hb + 4; index += 1) {
  s.sgrOf(0x1000 + index);
  const standing = s.standing();
  if (standing !== 'complete') { progressed = [index, standing]; break; }
}
show('the budget boundary', [hb, progressed]);
show('after the loop', [s.size(), s.standing()]);
