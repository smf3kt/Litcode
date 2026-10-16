// W45-49: the reliable top-level statement map for one module, so a package can be planned by name
// with true spans instead of a regex guess.
// Usage: node .audit/w45-49-top.mjs <module.js> [prefix]
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';

const root = path.resolve(import.meta.dirname, '..');
const [moduleName, prefix] = process.argv.slice(2);
const text = fs.readFileSync(path.join(root, 'extracted-v2/modules', moduleName), 'utf8');
let tree;
try {
  tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
} catch (error) {
  tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script' });
}
const nameOf = (node) => {
  if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') return node.id?.name ?? '(anonymous)';
  if (node.type === 'VariableDeclaration') {
    return node.declarations.map((d) => (d.id.type === 'Identifier' ? d.id.name : `(${d.id.type})`)).join(',');
  }
  if (node.type === 'ExpressionStatement') return `expr:${node.expression.type}`;
  if (node.type === 'ImportDeclaration') return `import:${node.source.value}`;
  if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') return 'export';
  return node.type;
};
let total = 0;
const rows = tree.body.map((node) => ({ node, name: nameOf(node) }))
  .filter(({ name }) => !prefix || name.startsWith(prefix));
for (const { node, name } of rows) {
  const units = node.end - node.start;
  total += units;
  console.log(`${String(units).padStart(6)}u [${node.start},${node.end}) ${node.type} ${name}`);
}
console.log(`# ${moduleName}: ${rows.length}/${tree.body.length} statements, ${total} units of ${text.length}`);
