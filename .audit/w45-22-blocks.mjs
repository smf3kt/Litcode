// Which copied block references which name. The bundle reuses short names across modules, so a name
// used in two blocks can need two different declarations; this prints the block-by-block usage so a
// collision is visible before the copy is wired up.
import fs from 'node:fs';

const file = process.argv[2];
const names = process.argv.slice(3);
const text = fs.readFileSync(file, 'utf8');
const blocks = [];
const marker = /^\/\/ (\S+) ([^\[]*)\[(\d+),(\d+)\) (\d+) units sha256 ([0-9a-f]{64})$/;
let current = null;
for (const line of text.split('\n')) {
  const m = marker.exec(line);
  if (m) { current = { module: m[1], note: m[2].trim(), range: [+m[3], +m[4]], units: +m[5], body: '' }; blocks.push(current); continue; }
  if (current !== null) current.body += line + '\n';
}
for (const b of blocks) {
  const word = (n) => new RegExp(`(?<![A-Za-z0-9_$])${n.replace(/[$]/g, '\\$&')}(?![A-Za-z0-9_$])`, 'u').test(b.body);
  const used = names.filter(word);
  console.log(`${b.module} [${b.range[0]},${b.range[1]}) ${b.units}u  ${b.note}\n    ${used.join(' ') || '(none)'}`);
}
