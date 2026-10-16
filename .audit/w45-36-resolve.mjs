// Resolve a name the way the bundler does, then ask the ledgers whether that body is already copied.
// The frontier walker answers "is some export named X anywhere in src/", which one- and two-letter
// minified names make meaningless; this resolves FILE → its import specifier → the exporting module's
// export map → that local name's declaration range, and matches the range against every block in
// every src/*-blocks.json ledger.
//   node .audit/w45-36-resolve.mjs FILE NAME [NAME…]
import fs from 'node:fs';
import * as acorn from 'acorn';

const dir = 'extracted-v2/modules/';

/** Every copied block, as {module, start, end}. */
const ledger = [];
for (const file of fs.readdirSync('src').filter((name) => name.endsWith('-blocks.json'))) {
  const record = JSON.parse(fs.readFileSync('src/' + file, 'utf8'));
  for (const block of record.blocks ?? []) ledger.push({ module: block.module, start: block.range[0], end: block.range[1], ledger: file });
}

const cache = new Map();
function info(file) {
  if (cache.has(file)) return cache.get(file);
  const text = fs.readFileSync(dir + file, 'utf8');
  const decls = new Map();
  const imports = new Map();
  const exports = new Map();
  for (const node of acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' }).body) {
    if (node.type === 'FunctionDeclaration' && node.id !== null) decls.set(node.id.name, [node.start, node.end]);
    else if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations) if (d.id.type === 'Identifier') decls.set(d.id.name, [node.start, node.end]);
    } else if (node.type === 'ImportDeclaration') {
      for (const spec of node.specifiers) {
        imports.set(spec.local.name, { module: String(node.source.value).split('/').pop(), imported: spec.imported?.name ?? spec.local.name });
      }
    } else if (node.type === 'ExportNamedDeclaration') {
      for (const spec of node.specifiers) exports.set(spec.exported.name, spec.local.name);
      if (node.declaration?.id != null) decls.set(node.declaration.id.name, [node.declaration.start, node.declaration.end]);
    }
  }
  const value = { text, decls, imports, exports };
  cache.set(file, value);
  return value;
}

const [file, ...names] = process.argv.slice(2);
const here = info(file);
for (const name of names) {
  const local = here.decls.get(name);
  if (local !== undefined) {
    const copied = ledger.find((block) => block.module === file && block.start <= local[0] && block.end >= local[1]);
    console.log(`  ${name}: declared here [${local[0]},${local[1]}) ${copied ? `COPIED by ${copied.ledger}` : 'NOT copied'}`);
    continue;
  }
  const imported = here.imports.get(name);
  if (imported === undefined) { console.log(`  ${name}: NO depth-0 declaration and no import in ${file}`); continue; }
  if (imported.module === file) { console.log(`  ${name}: imported from itself?`); continue; }
  if (!fs.existsSync(dir + imported.module)) { console.log(`  ${name}: imported from ${imported.module}, which is not an extracted module`); continue; }
  const there = info(imported.module);
  const target = there.exports.get(imported.imported);
  if (target === undefined) { console.log(`  ${name}: ${imported.module} does not export ${imported.imported}`); continue; }
  const range = there.decls.get(target);
  if (range === undefined) { console.log(`  ${name}: ${imported.module}.${imported.imported} (= ${target}) has no depth-0 declaration`); continue; }
  const copied = ledger.find((block) => block.module === imported.module && block.start <= range[0] && block.end >= range[1]);
  console.log(`  ${name}: ${imported.module} ${target} [${range[0]},${range[1]}) ${copied ? `COPIED by ${copied.ledger}` : 'NOT copied'}`);
}
