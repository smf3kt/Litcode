import fs from 'node:fs';
import * as acorn from 'acorn';
const file = 'extracted-v2/modules/chunk-n3ykh62m.js';
const text = fs.readFileSync(file, 'utf8');
const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
const wanted = new Set(['gno', 'qss', 'zss', 'Wss', 'Uss', 'Bss', 'Gss', 'Nss', 'Eur', 'lur', 'M_']);
const names = (node) => {
  const out = [];
  if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
    if (node.id) out.push(node.id.name);
  } else if (node.type === 'VariableDeclaration') {
    for (const d of node.declarations) {
      if (d.id.type === 'Identifier') out.push(d.id.name);
      if (d.id.type === 'ObjectPattern') for (const p of d.id.properties) if (p.value.type === 'Identifier') out.push(p.value.name);
    }
  }
  return out;
};
for (const node of ast.body) {
  const hit = names(node).filter(n => wanted.has(n));
  if (hit.length) console.log(node.start, node.end, node.end - node.start, hit.join(','));
}
