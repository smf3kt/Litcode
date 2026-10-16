// Name resolution by the source's own import map: for each MODULE NAME..., reports the chunk the
// module imports that name from. Minified bundles reuse short names across hundreds of chunks, so a
// name is only trustworthy when the using module's import statement names it — the rule Q-089 recorded
// for the generated copies, mechanized here.
//   node .audit/w45-import-map.mjs chunk-nyce03br.js mlt Aws zd se
import fs from 'node:fs';

const root = 'extracted-v2/modules/';
const [file, ...names] = process.argv.slice(2);
if (!file || names.length === 0) throw new Error('Usage: node .audit/w45-import-map.mjs MODULE NAME...');

const text = fs.readFileSync(root + file, 'utf8');
const imports = new Map();
const re = /import\{([^}]*)\}from"([^"]+)"/g;
let match;
while ((match = re.exec(text))) {
  for (const raw of match[1].split(',')) {
    const name = raw.trim().split(/\s+as\s+/).pop();
    if (name) imports.set(name, match[2].replace('/$bunfs/root/', ''));
  }
}
for (const name of names) {
  const from = imports.get(name);
  console.log(`${name}\t${from ? 'imported from ' + from : 'not imported (module-local or a property name)'}`);
}
