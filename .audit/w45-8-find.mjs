// Locate the bindings the decoration bodies use but this chunk does not declare at top level.
import fs from 'node:fs';
import * as acorn from 'acorn';

const t = fs.readFileSync('extracted-v2/modules/chunk-sfn1dbxq.js', 'utf8');
const ast = acorn.parse(t, {ecmaVersion: 'latest', sourceType: 'module'});
const want = new Set(['D', 'ra', 'pn', 'nQt', 'qi', 'HK', 'SCt', 'yBe', 'IOe', 'Ire', 'Nht', 'Iht', 'DOe', 'wY', 'Fht', 'POe', 'Ckn', 'drr', 'Lht', 'a7o', 'Rke', 'ihe']);

const found = [];
for (const node of ast.body) {
  if (node.type === 'ImportDeclaration') {
    for (const spec of node.specifiers) {
      const local = spec.local.name;
      if (want.has(local)) found.push([local, spec.imported?.name ?? 'default', node.source.value, node.start]);
    }
    continue;
  }
  if (node.type === 'VariableDeclaration') {
    for (const d of node.declarations) if (d.id.type === 'Identifier' && want.has(d.id.name)) found.push([d.id.name, 'var', 'local', node.start]);
    continue;
  }
  if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id && want.has(node.id.name)) {
    found.push([node.id.name, node.type, 'local', node.start]);
  }
}
for (const f of found) console.log(f.join('  '));
