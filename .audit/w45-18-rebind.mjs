import fs from 'node:fs';

const replaced = [
  ['research/ports/W45-permission-evidence.json', '"sha256": "da146ac6…"', '"sha256": "82806551…"'],
  ['research/ports/W45-permission-evidence.json', '"sha256": "00b3c443…", "files": 297', '"sha256": "e3bd2e99…", "files": 297'],
  ['research/ports/W45-permission-evidence.json', '"sha256": "9b6d72c0…", "files": 209', '"sha256": "60a50e5e…", "files": 209'],
  ['research/ports/W45-chain-runner.md', 'Identity `da146ac6…` (inputs 00b3c443 / 297, validation 53f9298f / 118, build\n9b6d72c0 / 209)', 'Identity `82806551…` (inputs e3bd2e99 / 297, validation 53f9298f / 118, build\n60a50e5e / 209)'],
  ['research/CURRENT.md', '身份 da146ac6…', '身份 82806551…'],
  ['research/STATUS.md', 'Identity `da146ac6…` (inputs 00b3c443 / 297, validation 53f9298f / 118, build\n9b6d72c0 / 209)', 'Identity `82806551…` (inputs e3bd2e99 / 297, validation 53f9298f / 118, build\n60a50e5e / 209)'],
  ['.audit/w45-runtime.todo.md', 'Identity `da146ac6…` (inputs 00b3c443 / 297, validation 53f9298f / 118, build 9b6d72c0 / 209)', 'Identity `82806551…` (inputs e3bd2e99 / 297, validation 53f9298f / 118, build 60a50e5e / 209)'],
  ['.audit/w45-runtime.tsv', '身份 da146ac6…', '身份 82806551…'],
];
for (const [file, from, to] of replaced) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(from)) { console.log(`${file}: NOT FOUND ${from.slice(0, 40)}`); continue; }
  fs.writeFileSync(file, text.replace(from, to));
  console.log(`${file}: rebound`);
}
const stale = ['da146ac6', '00b3c443', '9b6d72c0'];
for (const file of replaced.map(([f]) => f)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const value of stale) if (text.includes(value) && ![replaced[0][0]].includes(file)) console.log(`${file}: still holds ${value}`);
}
