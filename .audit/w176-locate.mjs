// Locate top-level declarations by name in extracted modules.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const acorn = require('acorn');

const root = 'extracted-v2/modules';
const targets = process.argv.slice(2);
for (const spec of targets) {
  const [mod, ...parts] = spec.split(':');
  const names = parts.flatMap((part) => part.split(','));
  const file = path.join(root, mod);
  const text = fs.readFileSync(file, 'utf8');
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
  const wanted = new Set(names);
  const found = new Map();
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' && node.id && wanted.has(node.id.name)) {
      found.set(node.id.name, { kind: 'function', start: node.start, end: node.end, units: node.end - node.start });
    }
    if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations) {
        if (d.id.type === 'Identifier' && wanted.has(d.id.name)) {
          found.set(d.id.name, { kind: node.kind, start: node.start, end: node.end, units: node.end - node.start });
        }
      }
    }
    if (node.type === 'ClassDeclaration' && node.id && wanted.has(node.id.name)) {
      found.set(node.id.name, { kind: 'class', start: node.start, end: node.end, units: node.end - node.start });
    }
  }
  console.log(mod, JSON.stringify(Object.fromEntries(found)));
}
