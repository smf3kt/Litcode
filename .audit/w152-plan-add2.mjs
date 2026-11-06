import fs from 'node:fs';
const path = '.audit/w152-probe.plan.json';
const p = JSON.parse(fs.readFileSync(path, 'utf8'));
for (const imp of [
  'import { aJ } from "./plugin-chain-records.js";',
  'import { aP, Ooe } from "./plugin-chain-source.js";',
]) if (!p.imports.includes(imp)) p.imports.push(imp);
const add = [
  ['chunk-24k7d6mw.js', 124024, 124140, 'wheel constants'],
  ['chunk-24k7d6mw.js', 124299, 124336, 'wheel constants two'],
  ['chunk-24k7d6mw.js', 126011, 126204, 'wheel factory'],
  ['chunk-4bw62nzm.js', 76502, 76526, 'mode value'],
  ['chunk-z7whhrje.js', 10370, 10380, 'app state token'],
  ['chunk-z7whhrje.js', 9540, 9565, 'wheel threshold'],
  ['chunk-js2bhabe.js', 1114, 1499, 'setting hook'],
  ['chunk-4bw62nzm.js', 56759, 56979, 'store class'],
  ['chunk-z7whhrje.js', 9339, 9540, 'wheel platform read'],
  ['chunk-sfn1dbxq.js', 476681, 476733, 'scroll site lookup'],
  ['chunk-sfn1dbxq.js', 476009, 476078, 'scroll site check'],
  ['chunk-sxm1dh4y.js', 709, 865, 'store initial'],
  ['chunk-z7whhrje.js', 2647, 2670, 'store fac'],
  ['chunk-z7whhrje.js', 9266, 9339, 'wheel gesture read'],
];
for (const [file, a, b, note] of add) {
  if (!p.blocks.some((x) => x.file === file && x.range[0] === a)) p.blocks.push({ file, range: [a, b], note });
}
fs.writeFileSync(path, JSON.stringify(p));
console.log('blocks', p.blocks.length, 'imports', p.imports.length);
