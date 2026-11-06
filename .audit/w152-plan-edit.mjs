import fs from 'node:fs';
const path = '.audit/w152-probe.plan.json';
const p = JSON.parse(fs.readFileSync(path, 'utf8'));
const imports = [
  'import { Xe as e, Xe as r, s, n, y, P, R, Z, le, en, Ae, Rt, hh, qt, w } from "./plugin-chain-react-hooks.js";',
  'import { Ge, bs, CFe } from "./plugin-chain-source.js";',
  'import { W1, xFe, kFe } from "./plugin-chain-above-prompt-parts-source.js";',
  'import { Ohe, TIe } from "./plugin-chain-press-dispatch-source.js";',
  'import { fd } from "./plugin-chain-above-prompt-select-keys-source.js";',
  'import { Ey } from "./plugin-chain-client-host-source.js";',
  'import { _z, ahe } from "./plugin-chain-scroll-focus-source.js";',
  'import { N5t } from "./plugin-chain-classic-raise-source.js";',
  'import { P0 } from "./plugin-chain-records.js";',
  'import { k0 } from "./plugin-chain-above-prompt-select-keys-source.js";',
  'import { Re } from "./plugin-chain-hover-source.js";',
  'import { t } from "./plugin-chain-host.js";',
  'import { V } from "./plugin-chain-app-state.js";',
  'import { $r, v } from "./plugin-chain-session.js";',
];
p.imports = imports;
p.blocks = p.blocks.filter((b) => b.file !== 'chunk-z6yhgx3x.js' && b.file !== 'chunk-7n39kxwj.js');
const add = [
  ['chunk-sfn1dbxq.js', 1699480, 1699936, 'record list wrapper'],
  ['chunk-sfn1dbxq.js', 476733, 476926, 'scroll site apply'],
  ['chunk-sfn1dbxq.js', 476538, 476681, 'above-prompt scroll state'],
  ['chunk-24k7d6mw.js', 126204, 126611, 'wheel accel setup'],
  ['chunk-24k7d6mw.js', 124336, 126011, 'wheel accel step'],
  ['chunk-sxm1dh4y.js', 865, 887, 'store factory'],
  ['chunk-wz8v981w.js', 1438, 1463, 'app state context read'],
  ['chunk-z7whhrje.js', 2670, 2712, 'host mode read'],
];
for (const [file, a, b, note] of add) {
  if (!p.blocks.some((x) => x.file === file && x.range[0] === a)) p.blocks.push({ file, range: [a, b], note });
}
fs.writeFileSync(path, JSON.stringify(p));
console.log('blocks', p.blocks.length, 'imports', p.imports.length);
