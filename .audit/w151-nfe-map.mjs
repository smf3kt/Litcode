// Maps the NFe unresolved names to the import module the AbovePrompt chunk names, and to a
// top-level declaration range within that module when the name is declared there.
import fs from 'node:fs';
import * as acorn from 'acorn';

const names = new Set(process.argv.slice(2).map((n) => n.replace(/^'/, '')));
const dir = 'extracted-v2/modules';
const host = 'chunk-24k7d6mw.js';
const text = fs.readFileSync(`${dir}/${host}`, 'utf8');
const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });

const imports = new Map();
for (const n of ast.body) {
  if (n.type !== 'ImportDeclaration') continue;
  const mod = n.source.value.replace('/$bunfs/root/', '');
  for (const sp of n.specifiers) imports.set(sp.local.name, mod);
}

const caches = new Map();
function cacheFor(file) {
  if (!caches.has(file)) {
    const t = fs.readFileSync(`${dir}/${file}`, 'utf8');
    caches.set(file, { t, ast: acorn.parse(t, { ecmaVersion: 'latest', sourceType: 'module' }) });
  }
  return caches.get(file);
}

function declRange(file, name) {
  const { ast: a } = cacheFor(file);
  for (const n of a.body) {
    if (n.type === 'FunctionDeclaration' && n.id?.name === name) return [n.start, n.end];
    if (n.type === 'ClassDeclaration' && n.id?.name === name) return [n.start, n.end];
    if (n.type === 'VariableDeclaration') {
      for (const d of n.declarations) {
        if (d.id.type === 'Identifier' && d.id.name === name) return [n.start, n.end];
      }
    }
  }
  return null;
}

for (const name of [...names].sort()) {
  const mod = imports.get(name);
  if (mod === undefined) {
    const local = declRange(host, name);
    console.log(`${name}\tLOCAL:${host}${local ? `\t${local[0]}\t${local[1]}\t${local[1] - local[0]}` : '\tNO-DECL'}`);
    continue;
  }
  const r = mod.endsWith('.js') ? declRange(mod, name) : null;
  console.log(`${name}\t${mod}${r ? `\t${r[0]}\t${r[1]}\t${r[1] - r[0]}` : '\tIMPORT-ONLY'}`);
}
