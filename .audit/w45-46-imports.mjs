// Resolve names against every import statement in a module, not just the contiguous header: these
// bundles concatenate many modules, so an import can sit anywhere in the file. A name that is not
// imported is reported with whether the file declares it at all.
import fs from 'node:fs';

const FILE = process.argv[2];
const names = process.argv.slice(3);
const text = fs.readFileSync(FILE, 'utf8');
const map = new Map();
const re = /import\s*\{([^}]*)\}\s*from\s*"([^"]+)";/g;
let m;
while ((m = re.exec(text)) !== null) {
  for (const part of m[1].split(',')) {
    const p = part.trim();
    if (p === '') continue;
    const [local, exported] = p.includes(' as ') ? p.split(' as ').map((s) => s.trim()) : [p, p];
    if (!map.has(local)) map.set(local, { from: m[2], imported: exported, at: m.index });
  }
}
for (const name of names) {
  const hit = map.get(name);
  const declared = new RegExp(`(?:var|let|const|function)\\s+${name.replace(/\$/g, '\\$')}\\s*[=(]`).test(text);
  console.log(JSON.stringify({ name, import: hit ?? null, declaredInFile: declared }));
}
