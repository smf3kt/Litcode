// Resolves a name against every extracted module's import table, then finds the declaration site in
// the module each importer points at.
import fs from 'node:fs';
import * as acorn from 'acorn';

const names = process.argv.slice(2);
const dir = 'extracted-v2/modules';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
const parsed = new Map();
for (const f of files) {
  const t = fs.readFileSync(`${dir}/${f}`, 'utf8');
  try {
    parsed.set(f, { t, ast: acorn.parse(t, { ecmaVersion: 'latest', sourceType: 'module' }) });
  } catch {
    // Not an ES module source; skip it.
  }
}

function declRange(file, name) {
  const { ast } = parsed.get(file);
  for (const n of ast.body) {
    if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id?.name === name) {
      return [n.start, n.end];
    }
    if (n.type === 'VariableDeclaration') {
      for (const d of n.declarations) {
        if (d.id.type === 'Identifier' && d.id.name === name) return [n.start, n.end];
      }
    }
  }
  return null;
}

for (const name of names) {
  const sources = new Set();
  for (const f of parsed.keys()) {
    const { ast } = parsed.get(f);
    for (const n of ast.body) {
      if (n.type !== 'ImportDeclaration') continue;
      for (const sp of n.specifiers) {
        if (sp.local.name === name) sources.add(n.source.value.replace('/$bunfs/root/', ''));
      }
    }
  }
  const rows = [...sources].sort().map((mod) => {
    if (!mod.endsWith('.js')) return `${mod}(non-js)`;
    const r = declRange(mod, name);
    return r ? `${mod}:${r[0]}-${r[1]}(${r[1] - r[0]})` : `${mod}:IMPORT-ONLY`;
  });
  console.log(`${name}\t${rows.length ? rows.join(' ') : 'NO-IMPORT'}`);
}
