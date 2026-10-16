// Exact declaration ranges for a name in a module, plus whether the product already carries the body.
import fs from 'node:fs';
import * as acorn from 'acorn';

const [file, ...names] = process.argv.slice(2);
const text = fs.readFileSync('extracted-v2/modules/' + file, 'utf8');
const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
const found = new Map();
for (const node of ast.body) {
  if (node.type === 'FunctionDeclaration' && node.id) found.set(node.id.name, [node.start, node.end]);
  if (node.type === 'VariableDeclaration') for (const d of node.declarations) if (d.id?.name) found.set(d.id.name, [node.start, node.end]);
}
const product = fs.readdirSync('src').filter((f) => f.endsWith('.ts')).map((f) => [f, fs.readFileSync('src/' + f, 'utf8')]);
for (const name of names) {
  const range = found.get(name);
  if (!range) { console.log(`${name}\tNOT A TOP-LEVEL DECLARATION`); continue; }
  const body = text.slice(range[0], range[1]);
  const carrier = product.find(([, t]) => t.includes(body));
  console.log(`${name}\t[${range[0]},${range[1]})\t${range[1] - range[0]}u\t${carrier ? carrier[0] : 'NEW'}\n\t${body.slice(0, 300).replace(/\n/g, ' ')}`);
}
