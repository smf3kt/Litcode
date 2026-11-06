import fs from 'node:fs';
const plan = {
  imports: [
    'import { P, R, Z } from "./plugin-chain-react-hooks.js";',
    'import { Ge, bs } from "./plugin-chain-source.js";',
    'import { Ey } from "./plugin-chain-client-host-source.js";',
    'import { TIe } from "./plugin-chain-press-dispatch-source.js";',
    'import { $r } from "./plugin-chain-session.js";',
    'import { V } from "./plugin-chain-app-state.js";',
  ],
  exports: ['vp', 'IV', 'q1', 'tK', 'cK', 'Ine', 'Z1'],
  blocks: [
    ['chunk-24k7d6mw.js', 299367, 299397, 'session selector'],
    ['chunk-24k7d6mw.js', 299493, 299598, 'longer input value'],
    ['chunk-24k7d6mw.js', 447223, 447294, 'plugin context value'],
    ['chunk-24k7d6mw.js', 450848, 450963, 'hotkey presses'],
    ['chunk-24k7d6mw.js', 453589, 453644, 'release on gone'],
    ['chunk-24k7d6mw.js', 453648, 453782, 'release on edit'],
    ['chunk-24k7d6mw.js', 450435, 450470, 'settled budget store'],
    ['chunk-24k7d6mw.js', 299468, 299493, 'longer input marker'],
    ['chunk-24k7d6mw.js', 447122, 447223, 'plugin context'],
    ['chunk-24k7d6mw.js', 450686, 450848, 'hotkey press lookup'],
    ['chunk-sxm1dh4y.js', 887, 917, 'store read'],
    ['chunk-sxm1dh4y.js', 865, 887, 'store factory'],
    ['chunk-sxm1dh4y.js', 709, 865, 'store initial'],
    ['chunk-4bw62nzm.js', 56759, 56979, 'store class'],
    ['chunk-sfn1dbxq.js', 1699480, 1699936, 'record list wrapper'],
  ].map(([file, a, b, note]) => ({ file, range: [a, b], note })),
};
fs.writeFileSync('.audit/w152a-probe.plan.json', JSON.stringify(plan));
console.log('blocks', plan.blocks.length);
