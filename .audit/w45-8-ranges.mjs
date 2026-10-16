// Exact top-level statement ranges for the names the decoration paint path needs.
import fs from 'node:fs';
import * as acorn from 'acorn';

const files = process.argv.slice(2);
for (const file of files) {
  const t = fs.readFileSync(`extracted-v2/modules/${file}`, 'utf8');
  const ast = acorn.parse(t, {ecmaVersion: 'latest', sourceType: 'module'});
  const rows = [];
  for (const node of ast.body) {
    if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations) if (d.id.type === 'Identifier') rows.push([d.id.name, node.start, node.end]);
    } else if (node.type === 'FunctionDeclaration' && node.id) rows.push([node.id.name, node.start, node.end]);
    else if (node.type === 'ClassDeclaration' && node.id) rows.push([node.id.name, node.start, node.end]);
  }
  console.log(`### ${file}`);
  for (const [name, start, end] of rows.sort((a, b) => a[1] - b[1])) {
    console.log(`${name}\t[${start},${end})`);
  }
}
