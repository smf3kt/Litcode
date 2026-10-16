// Resolve the names the composer's draft-span path uses inside chunk-24k7d6mw.js itself: whether each
// is declared at this module's top level or imported from another chunk (minified names are module-local).
import fs from 'node:fs';
import * as acorn from 'acorn';

const module = process.argv[2] ?? 'extracted-v2/modules/chunk-24k7d6mw.js';
const want = new Set(process.argv.slice(3));
if (want.size === 0) throw new Error('Usage: node .audit/w45-9-find.mjs MODULE.js NAME...');

const t = fs.readFileSync(module, 'utf8');
const ast = acorn.parse(t, { ecmaVersion: 'latest', sourceType: 'module' });
const found = new Map();
for (const node of ast.body) {
  if (node.type === 'ImportDeclaration') {
    for (const spec of node.specifiers) {
      if (want.has(spec.local.name)) found.set(spec.local.name, ['import', spec.imported?.name ?? 'default', node.source.value, node.start]);
    }
    continue;
  }
  if (node.type === 'VariableDeclaration') {
    for (const d of node.declarations) if (d.id.type === 'Identifier' && want.has(d.id.name)) found.set(d.id.name, ['var', 'local', module, node.start]);
    continue;
  }
  if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id && want.has(node.id.name)) {
    found.set(node.id.name, [node.type, 'local', module, node.start]);
  }
}
for (const [name, row] of found) console.log([name, ...row].join('  '));
for (const name of want) if (!found.has(name)) console.log([name, 'UNRESOLVED'].join('  '));
