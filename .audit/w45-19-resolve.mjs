// Resolves each name to the module whose top level declares it, and prints the declaration's extent.
// Minified bundles reuse short names across chunks, so a name is only accepted from the module the
// caller names, or reported with every candidate so the choice is explicit.
import fs from 'node:fs';
import * as acorn from 'acorn';

const root = 'extracted-v2/modules/';
const files = fs.readdirSync(root).filter((f) => f.endsWith('.js'));
const cache = new Map();
const astOf = (file) => {
  if (!cache.has(file)) {
    try {
      cache.set(file, acorn.parse(fs.readFileSync(root + file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' }));
    } catch { cache.set(file, null); }
  }
  return cache.get(file);
};

const wanted = process.argv.slice(2);
for (const spec of wanted) {
  const [file, name] = spec.includes(':') ? spec.split(':') : [null, spec];
  const hits = [];
  for (const candidate of file ? [file] : files) {
    const ast = astOf(candidate);
    if (!ast) continue;
    for (const node of ast.body) {
      const declares =
        (node.type === 'VariableDeclaration' && node.declarations.some((d) => d.id.type === 'Identifier' && d.id.name === name)) ||
        (node.type === 'FunctionDeclaration' && node.id?.name === name) ||
        (node.type === 'ClassDeclaration' && node.id?.name === name);
      if (declares) hits.push(`${candidate} [${node.start},${node.end}) ${node.end - node.start} units`);
    }
  }
  console.log(`${name}${file ? ' in ' + file : ''}: ${hits.length ? hits.join(' | ') : 'NOT FOUND'}`);
}
