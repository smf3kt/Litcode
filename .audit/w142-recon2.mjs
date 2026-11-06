import fs from 'node:fs';
import * as acorn from 'acorn';
const t = fs.readFileSync('extracted-v2/modules/chunk-n3ykh62m.js', 'utf8');
const ast = acorn.parse(t, { ecmaVersion: 'latest', sourceType: 'module' });
const decls = new Map();
for (const node of ast.body) {
  const add = (name, n) => { if (!decls.has(name)) decls.set(name, n); };
  if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id) add(node.id.name, node);
  else if (node.type === 'VariableDeclaration') for (const d of node.declarations) {
    if (d.id.type === 'Identifier') add(d.id.name, node);
    if (d.id.type === 'ObjectPattern') for (const p of d.id.properties) if (p.value.type === 'Identifier') add(p.value.name, node);
  }
}
const imports = new Map();
for (const node of ast.body) if (node.type === 'ImportDeclaration') for (const s of node.specifiers) imports.set(s.local.name, node.source.value);
const wanted = process.argv.slice(2);
const seen = new Set();
const queue = [...wanted];
while (queue.length) {
  const name = queue.shift();
  if (seen.has(name)) continue;
  seen.add(name);
  const node = decls.get(name);
  if (!node) { console.log(`UNRESOLVED ${name}${imports.has(name) ? ` import ${imports.get(name)}` : ''}`); continue; }
  const body = t.slice(node.start, node.end);
  console.log(`\n### ${name} [${node.start},${node.end}) ${node.end - node.start}u`);
  console.log(body);
  const refs = new Set();
  for (const m of body.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) refs.add(m[0]);
  for (const r of refs) if (r !== name && (decls.has(r) || imports.has(r))) queue.push(r);
}
