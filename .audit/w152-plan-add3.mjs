import fs from 'node:fs';
const path = '.audit/w152-probe.plan.json';
const p = JSON.parse(fs.readFileSync(path, 'utf8'));
for (const imp of [
  'import { q } from "./plugin-chain-local-store-source.js";',
  'import { gs } from "./plugin-chain-registry-stores-source.js";',
]) if (!p.imports.includes(imp)) p.imports.push(imp);
const add = [
  ['chunk-bk5ct2gw.js', 576824, 577000, 'setting schema'],
  ['chunk-bk5ct2gw.js', 555601, 555684, 'setting group'],
  ['chunk-x0dc37w9.js', 88486, 88550, 'setting value read'],
  ['chunk-bk5ct2gw.js', 555522, 555601, 'setting entry'],
  ['chunk-wtch2p0g.js', 5585, 5823, 'settings provider'],
  ['chunk-bk5ct2gw.js', 555458, 555496, 'setting key'],
  ['chunk-x0dc37w9.js', 88256, 88349, 'setting context'],
  ['chunk-bk5ct2gw.js', 559209, 559326, 'setting lookup'],
  ['chunk-z7whhrje.js', 1978, 2647, 'store shell'],
  ['chunk-js2bhabe.js', 777, 1114, 'settings store'],
];
for (const [file, a, b, note] of add) {
  if (!p.blocks.some((x) => x.file === file && x.range[0] === a)) p.blocks.push({ file, range: [a, b], note });
}
fs.writeFileSync(path, JSON.stringify(p));
console.log('blocks', p.blocks.length, 'imports', p.imports.length);
