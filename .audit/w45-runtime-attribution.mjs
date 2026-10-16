// Attributes every selected block to the request entry that first reached it, resolving names
// through each module's import/export aliases, and reports the cross-file frontier per entry.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const closure = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const root = path.resolve('extracted-v2/modules');
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const declares = new Set(), exports = new Map(), imports = new Map();
  const push = name => { if (ts.isIdentifier(name)) declares.add(name.text);
    else if (ts.isObjectBindingPattern(name)) for (const e of name.elements) if (ts.isBindingElement(e)) push(e.name); };
  for (const node of source.statements) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause, from = node.moduleSpecifier.text;
      if (clause?.name) imports.set(clause.name.text, {from, imported: 'default', exported: true});
      if (clause?.namedBindings) {
        if (ts.isNamedImports(clause.namedBindings)) for (const b of clause.namedBindings.elements)
          imports.set(b.name.text, {from, imported: (b.propertyName ?? b.name).text, exported: false});
        else imports.set(clause.namedBindings.name.text, {from, imported: '*', exported: false});
      }
    } else if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const b of node.exportClause.elements) exports.set(b.name.text, (b.propertyName ?? b.name).text);
    } else {
      if (ts.isVariableStatement(node)) for (const d of node.declarationList.declarations) push(d.name);
      if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) push(node.name);
    }
  }
  const value = {file, text, declares, exports, imports};
  modules.set(file, value);
  return value;
}
const resolved = new Map();
function resolve(file, name, depth = 0) {
  const key = `${file}:${name}`;
  if (resolved.has(key)) return resolved.get(key);
  resolved.set(key, null);
  let result = null;
  if (depth < 32) {
    const module = load(file), local = module.exports.get(name) ?? name;
    if (module.declares.has(local)) result = `${file}:${local}`;
    else if (module.exports.has(name)) result = resolve(file, module.exports.get(name), depth + 1);
    else {
      const imported = module.imports.get(local);
      if (imported?.from.startsWith('/$bunfs/root/')) {
        const target = path.basename(imported.from);
        if (imported.imported === '*') result = `${target}:*`;
        else result = resolve(target, imported.imported, depth + 1) ?? `${target}:${imported.imported}`;
      }
    }
  }
  resolved.set(key, result);
  return result;
}
const index = new Map();
for (const block of closure.blocks) for (const name of block.names) index.set(`${block.file}:${name}`, block);
const children = new Map();
for (const block of closure.blocks) {
  if (!block.parent) continue;
  const key = `${block.file}:${block.names[0]}`;
  if (!children.has(block.parent)) children.set(block.parent, []);
  children.get(block.parent).push(key);
}
const cache = new Map();
function entryOf(key) {
  if (cache.has(key)) return cache.get(key);
  const block = index.get(key);
  let current = block?.parent ?? null, last = null, steps = 0;
  while (current && steps++ < 512) {
    const [file, ...rest] = [current.slice(0, current.lastIndexOf(':')), current.slice(current.lastIndexOf(':') + 1)];
    const canonical = resolve(file, rest);
    last = canonical ?? current;
    const next = canonical ? index.get(canonical)?.parent ?? null : null;
    if (!next) break;
    current = next;
  }
  const result = last ?? '(entry)';
  cache.set(key, result);
  return result;
}
function subtree(key) {
  const seen = new Set(), stack = [key];
  let units = 0, blocks = 0;
  const files = new Map();
  while (stack.length) {
    const k = stack.pop();
    if (seen.has(k)) continue;
    seen.add(k);
    const block = index.get(k);
    if (!block) continue;
    units += block.units; blocks++;
    files.set(block.file, (files.get(block.file) ?? 0) + block.units);
    for (const name of block.names) for (const child of children.get(`${block.file}:${name}`) ?? []) stack.push(child);
  }
  return {units, blocks, files};
}
const byEntry = new Map();
for (const block of closure.blocks) {
  const key = `${block.file}:${block.names[0]}`;
  const entry = entryOf(key);
  if (!byEntry.has(entry)) byEntry.set(entry, {units: 0, blocks: 0, files: new Map(), roots: new Map()});
  const row = byEntry.get(entry);
  row.units += block.units; row.blocks++;
  row.files.set(block.file, (row.files.get(block.file) ?? 0) + block.units);
}
if (process.argv.includes('--frontier')) {
  const wanted = process.argv[process.argv.indexOf('--frontier') + 1];
  for (const block of closure.blocks) {
    if (block.origin !== wanted) continue;
    for (const reference of block.references) {
      const canonical = resolve(block.file, reference);
      if (!canonical || canonical.startsWith(block.file + ':')) continue;
      const size = subtree(canonical);
      console.log([`${block.file}:${block.names[0]}`, reference, canonical, size.units, size.blocks].join('\t'));
    }
  }
} else {
  const rows = [...byEntry].sort((a, b) => b[1].units - a[1].units);
  let total = 0;
  for (const [entry, row] of rows) {
    total += row.units;
    console.log([entry, row.units, row.blocks, [...row.files].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([f, u]) => `${f}:${u}`).join(' ')].join('\t'));
  }
  console.log('total', total, 'of', closure.blocks.reduce((sum, block) => sum + block.units, 0));
}
