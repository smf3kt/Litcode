// Depth-0 declaration ranges of one extracted module, by name. The frontier walker needs an end
// offset to run, and guessing one from a regex is how the earlier closure walker went wrong.
//   node .audit/w45-35-decls.mjs FILE [NAME…]
import fs from 'node:fs';
import * as acorn from 'acorn';

const dir = 'extracted-v2/modules/';
const [file, ...wanted] = process.argv.slice(2);
const text = fs.readFileSync(dir + file, 'utf8');
const decls = new Map();
const exportsMap = new Map();
for (const node of acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' }).body) {
  if (node.type === 'FunctionDeclaration' && node.id !== null) decls.set(node.id.name, [node.start, node.end, 'function']);
  else if (node.type === 'ClassDeclaration' && node.id !== null) decls.set(node.id.name, [node.start, node.end, 'class']);
  else if (node.type === 'VariableDeclaration') {
    for (const d of node.declarations) if (d.id.type === 'Identifier') decls.set(d.id.name, [node.start, node.end, 'var']);
  } else if (node.type === 'ExportNamedDeclaration') {
    for (const spec of node.specifiers) exportsMap.set(spec.exported.name, spec.local.name);
    if (node.declaration?.id != null) decls.set(node.declaration.id.name, [node.declaration.start, node.declaration.end, 'exported']);
  }
}
console.log(`${file} ${text.length} units; exports ${[...exportsMap].map(([a, b]) => (a === b ? a : `${b} as ${a}`)).join(', ')}`);
const names = wanted.length > 0 ? wanted : [...decls.keys()];
for (const name of names) {
  const found = decls.get(name);
  if (found === undefined) { console.log(`  ${name}: absent at depth 0`); continue; }
  const [start, end, kind] = found;
  console.log(`  ${name} (${kind}) [${start},${end}) ${end - start} units :: ${JSON.stringify(text.slice(start, Math.min(end, start + 150)))}`);
}
