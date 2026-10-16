import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';

const root = path.resolve(process.argv[2]);
const request = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const full = path.join(root, 'modules', file);
  const bytes = fs.readFileSync(full);
  const digest = hash(bytes);
  assert.equal(digest, manifest.modules.find(row => row.path === file)?.decodedSha256, file);
  const text = bytes.toString('utf8');
  const source = ts.createSourceFile(full, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const options = {allowJs: true, checkJs: true, noLib: true, noResolve: true, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext};
  const host = ts.createCompilerHost(options);
  host.getSourceFile = name => path.resolve(name) === full ? source : undefined;
  host.fileExists = name => path.resolve(name) === full;
  const program = ts.createProgram([full], options, host);
  const checker = program.getTypeChecker();
  const declarations = new Map();
  const exports = new Map();
  const imports = new Map();
  for (const node of source.statements) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      if (clause?.name) imports.set(clause.name.text, {from: node.moduleSpecifier.text, imported: 'default', node});
      if (clause?.namedBindings) {
        if (ts.isNamedImports(clause.namedBindings)) for (const binding of clause.namedBindings.elements)
          imports.set(binding.name.text, {from: node.moduleSpecifier.text, imported: (binding.propertyName ?? binding.name).text, node});
        else imports.set(clause.namedBindings.name.text, {from: node.moduleSpecifier.text, imported: '*', node});
      }
    } else if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const binding of node.exportClause.elements) exports.set(binding.name.text, (binding.propertyName ?? binding.name).text);
    } else {
      if (ts.isVariableStatement(node)) {
        const bind = name => {
          if (ts.isIdentifier(name)) declarations.set(name.text, node);
          else for (const element of name.elements) if (ts.isBindingElement(element)) bind(element.name);
        };
        for (const declaration of node.declarationList.declarations) bind(declaration.name);
      }
      if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) declarations.set(node.name.text, node);
    }
  }
  const value = {file, text, digest, source, checker, declarations, exports, imports};
  cache.set(file, value);
  return value;
}
const selected = new Map();
const boundaries = new Map();
const unknowns = new Set();
const seen = new Set();
const refs = [];
function select(file, name, exported = false, via, origin, from = null) {
  const key = `${file}:${name}:${exported}`;
  if (seen.has(key)) return;
  seen.add(key);
  const override = request.boundaries?.[`${file}:${name}`];
  if (override) { boundaries.set(`${file}:${name}`, {file, name, reason: override, via, origin}); return; }
  const module = load(file);
  const local = exported ? module.exports.get(name) ?? name : name;
  if (local !== name && request.boundaries?.[`${file}:${local}`]) {
    select(file, local, false, via, origin, from); return;
  }
  const imported = module.imports.get(local);
  if (imported) {
    if (imported.from.startsWith('/$bunfs/root/')) select(path.basename(imported.from), imported.imported, true, `${file}:${local}`, origin, from);
    else boundaries.set(`${file}:${local}`, {file, name: local, from: imported.from, imported: imported.imported, via, origin});
    return;
  }
  const statement = module.declarations.get(local);
  if (!statement) {unknowns.add(`${file}:${local}`); return;}
  const start = statement.getStart(module.source), end = statement.end;
  const blockKey = `${file}:${start}`;
  if (selected.has(blockKey)) return;
  const names = [...module.declarations].filter(([, node]) => node === statement).map(([symbol]) => symbol);
  selected.set(blockKey, {file, names, range: [start, end], units: end - start,
    bodySha256: hash(module.text.slice(start, end)), parent: from, via: via ?? null, origin: origin ?? `${file}:${name}`, references: []});
  const children = new Set();
  const visit = node => {
    if (ts.isIdentifier(node)) {
      const symbol = module.checker.getSymbolAtLocation(node);
      if (symbol) for (const declaration of symbol.declarations ?? []) {
        let top = declaration;
        while (top.parent && top.parent !== module.source) top = top.parent;
        if (top.parent !== module.source || top === statement) continue;
        if (ts.isImportDeclaration(top)) {
          if (module.imports.has(node.text)) children.add(node.text);
        } else {
          const entry = [...module.declarations].find(([, value]) => value === top);
          if (entry) children.add(entry[0]);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(statement);
  selected.get(blockKey).references = [...children].sort();
  for (const child of children) select(file, child, false, `${file}:${local}`, origin, blockKey);
}
for (const entry of request.entries) select(entry.file, entry.name, entry.exported ?? false, undefined, `${entry.file}:${entry.name}`);
const blocks = [...selected.values()].sort((a,b)=>a.file.localeCompare(b.file)||a.range[0]-b.range[0]);
const modules = [...cache.values()].map(module=>({file:module.file,sha256:module.digest,blocks:blocks.filter(block=>block.file===module.file).length,units:blocks.filter(block=>block.file===module.file).reduce((sum,block)=>sum+block.units,0)}));
console.log(JSON.stringify({schema:'W45RuntimeClosure.v1',coordinates:'zero-based UTF-16 [start,end)',request,modules,blocks,boundaries:[...boundaries.values()],unknowns:[...unknowns]},null,2));
