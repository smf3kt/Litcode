// W45-49: the transitive closure of a set of top-level names inside one module, so a package is sized
// and planned from the source's own references rather than from guesswork. Minified names collide
// across chunks, so a name is only ever resolved inside the module that reads it.
// Usage: node .audit/w45-49-closure.mjs <module.js> <name> [name...]
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';

const root = path.resolve(import.meta.dirname, '..');
const [moduleName, ...seeds] = process.argv.slice(2);
if (!moduleName || seeds.length === 0) {
  console.error('Usage: node .audit/w45-49-closure.mjs <module.js> <name> [name...]');
  process.exit(2);
}
const text = fs.readFileSync(path.join(root, 'extracted-v2/modules', moduleName), 'utf8');
let tree;
try { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' }); }
catch { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script' }); }

const topLevel = new Map();   // declared name -> statement node
const imports = new Map();    // local name -> {module, imported}
const namespaceImports = new Set();
for (const node of tree.body) {
  if (node.type === 'ImportDeclaration') {
    for (const specifier of node.specifiers) {
      if (specifier.type === 'ImportSpecifier') {
        imports.set(specifier.local.name, { module: node.source.value, imported: specifier.imported.name ?? specifier.imported.value });
      } else {
        imports.set(specifier.local.name, { module: node.source.value, imported: '*' });
        namespaceImports.add(specifier.local.name);
      }
    }
    continue;
  }
  const names = [];
  if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
    if (node.id) names.push(node.id.name);
  } else if (node.type === 'VariableDeclaration') {
    for (const declarator of node.declarations) {
      const walk = (pattern) => {
        if (!pattern) return;
        if (pattern.type === 'Identifier') names.push(pattern.name);
        else if (pattern.type === 'ObjectPattern') pattern.properties.forEach((p) => walk(p.value ?? p.argument));
        else if (pattern.type === 'ArrayPattern') pattern.elements.forEach(walk);
        else if (pattern.type === 'AssignmentPattern') walk(pattern.left);
        else if (pattern.type === 'RestElement') walk(pattern.argument);
      };
      walk(declarator.id);
    }
  } else continue;
  for (const name of names) if (!topLevel.has(name)) topLevel.set(name, node);
}

// Every binding declared anywhere inside one statement, so a local shadows a top-level name.
function boundInside(node) {
  const names = new Set();
  const walk = (current, isRoot) => {
    if (!current || typeof current.type !== 'string') return;
    switch (current.type) {
      case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': {
        if (current.id) names.add(current.id.name);
        for (const parameter of current.params) bindPattern(parameter, names);
        for (const key of Object.keys(current)) {
          if (key === 'id' || key === 'params') continue;
          walkChild(current[key]);
        }
        return;
      }
      case 'ClassDeclaration': case 'ClassExpression': {
        if (current.id) names.add(current.id.name);
        break;
      }
      case 'VariableDeclarator': bindPattern(current.id, names); break;
      case 'CatchClause': if (current.param) bindPattern(current.param, names); break;
      case 'ImportDeclaration': for (const s of current.specifiers) names.add(s.local.name); break;
      default: break;
    }
    for (const key of Object.keys(current)) {
      if (key === 'id' && !isRoot) continue;
      walkChild(current[key]);
    }
  };
  const walkChild = (value) => {
    if (Array.isArray(value)) value.forEach((entry) => walk(entry, false));
    else if (value && typeof value.type === 'string') walk(value, false);
  };
  walk(node, true);
  return names;
}
function bindPattern(pattern, names) {
  if (!pattern) return;
  if (pattern.type === 'Identifier') names.add(pattern.name);
  else if (pattern.type === 'ObjectPattern') pattern.properties.forEach((p) => bindPattern(p.value ?? p.argument, names));
  else if (pattern.type === 'ArrayPattern') pattern.elements.forEach((element) => bindPattern(element, names));
  else if (pattern.type === 'AssignmentPattern') bindPattern(pattern.left, names);
  else if (pattern.type === 'RestElement') bindPattern(pattern.argument, names);
}

// Identifier references: skip member property names, property keys, labels, and declaration ids.
function referencedInside(node) {
  const references = new Map(); // name -> first position
  const visit = (current, parent, key) => {
    if (!current || typeof current.type !== 'string') return;
    if (current.type === 'Identifier') {
      const position = current.start;
      if (!references.has(current.name)) references.set(current.name, position);
      return;
    }
    if (current.type === 'MemberExpression') {
      visit(current.object, current, 'object');
      if (current.computed) visit(current.property, current, 'property');
      return;
    }
    if (current.type === 'Property') {
      if (current.computed) visit(current.key, current, 'key');
      visit(current.value, current, 'value');
      return;
    }
    if (current.type === 'MethodDefinition' || current.type === 'PropertyDefinition') {
      if (current.computed) visit(current.key, current, 'key');
      visit(current.value, current, 'value');
      return;
    }
    if (current.type === 'LabeledStatement' || current.type === 'BreakStatement' || current.type === 'ContinueStatement') {
      visit(current.body, current, 'body');
      return;
    }
    for (const childKey of Object.keys(current)) {
      if (childKey === 'start' || childKey === 'end' || childKey === 'loc' || childKey === 'range' || childKey.endsWith('Comments')) continue;
      const value = current[childKey];
      if (Array.isArray(value)) value.forEach((entry) => visit(entry, current, childKey));
      else if (value && typeof value.type === 'string') visit(value, current, childKey);
    }
  };
  visit(node, null, null);
  return references;
}

const needed = new Map();     // node -> names that pulled it in
const usedImports = new Map();
const unknown = new Map();
const queue = [];
for (const seed of seeds) {
  const node = topLevel.get(seed);
  if (!node) { console.error(`seed ${seed} is not a top-level declaration of ${moduleName}`); process.exit(1); }
  queue.push([seed, node]);
}
const seen = new Set();
while (queue.length) {
  const [via, node] = queue.shift();
  if (seen.has(node)) { needed.get(node).push(via); continue; }
  seen.add(node);
  needed.set(node, [via]);
  const bound = boundInside(node);
  for (const [name, position] of referencedInside(node)) {
    if (bound.has(name)) continue;
    if (topLevel.has(name)) { queue.push([name, topLevel.get(name)]); continue; }
    if (imports.has(name)) {
      const entry = imports.get(name);
      if (!usedImports.has(name)) usedImports.set(name, entry);
      continue;
    }
    if (!unknown.has(name)) unknown.set(name, text.slice(Math.max(0, position - 1), position + 30).replace(/\n/g, ' '));
  }
}

const ordered = [...needed.keys()].sort((a, b) => a.start - b.start);
let units = 0;
for (const node of ordered) {
  const size = node.end - node.start;
  units += size;
  const label = node.type === 'VariableDeclaration'
    ? node.declarations.map((d) => (d.id.type === 'Identifier' ? d.id.name : `(${d.id.type})`)).join(',')
    : node.id?.name ?? node.type;
  console.log(`${String(size).padStart(6)}u [${node.start},${node.end}) ${node.type} ${label}   <- ${[...new Set(needed.get(node))].join(', ')}`);
}
console.log(`# ${moduleName}: ${ordered.length} statements, ${units} units`);
console.log(`# imports: ${[...usedImports].map(([name, e]) => `${name} <- ${e.imported} of ${e.module}`).join(' | ') || 'none'}`);
console.log(`# unresolved: ${[...unknown].map(([name, where]) => `${name} @ …${where}`).join(' | ') || 'none'}`);
