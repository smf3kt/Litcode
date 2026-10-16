// Measure the label sanitiser's closure (W45-33) with sound resolution: a block's free names are
// resolved first against the module's own depth-0 declarations, then through its import map into the
// exporting module's export map (`export{a as b}`), which is what the earlier walker got wrong —
// it read the exporting module's *import* map, so names resolved to unrelated same-named code.
import fs from 'node:fs';
import * as acorn from 'acorn';

const dir = 'extracted-v2/modules/';
const GLOBALS = new Set(['undefined', 'Array', 'Object', 'Math', 'Date', 'Set', 'Map', 'WeakMap', 'WeakSet',
  'JSON', 'String', 'Number', 'Boolean', 'Symbol', 'RegExp', 'Error', 'TypeError', 'RangeError', 'Promise',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'console',
  'process', 'Buffer', 'performance', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask',
  'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder', 'Uint8Array', 'Int32Array', 'Float64Array', 'BigInt64Array',
  'ArrayBuffer', 'structuredClone', 'globalThis', 'Infinity', 'NaN', 'arguments', 'require', 'module', 'exports',
  'Reflect', 'Proxy', 'Intl', 'crypto', 'AbortController', 'AbortSignal', 'Function', 'eval', 'TextEncoder',
  'Uint32Array', 'Uint16Array', 'Int8Array', 'Int16Array', 'DataView', 'SharedArrayBuffer', 'Atomics', 'URLPattern']);

const texts = new Map();
const text = (f) => {
  if (!texts.has(f)) texts.set(f, fs.readFileSync(dir + f, 'utf8'));
  return texts.get(f);
};

/** Skips a string/template/regex-ish literal starting at `at`, returning the closing quote index. */
function skipString(s, at) {
  const quote = s[at];
  for (let i = at + 1; i < s.length; i++) {
    if (s[i] === '\\') i++;
    else if (s[i] === quote) return i;
  }
  return s.length;
}

/** The statement (or function body) starting at `at`, to its balanced end. */
function extent(s, at) {
  let depth = 0, seen = false;
  for (let i = at; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') { i = skipString(s, i); continue; }
    if (c === '{' || c === '(' || c === '[') { depth += 1; seen = true; continue; }
    if (c === '}' || c === ')' || c === ']') { depth -= 1; continue; }
    if (depth === 0 && (c === ';' || (seen && c === '}'))) return [at, i + 1];
  }
  return [at, at];
}

/** Depth-0 declarations, the import map and the export map of one module — read from the parse tree,
 *  so a nested declaration can never be mistaken for a module-level one. */
const moduleInfo = new Map();
function info(f) {
  if (moduleInfo.has(f)) return moduleInfo.get(f);
  const s = text(f);
  const decls = new Map();
  const imports = new Map();
  const exports = new Map();
  const ast = acorn.parse(s, { ecmaVersion: 'latest', sourceType: 'module' });
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' && node.id !== null) decls.set(node.id.name, [node.start, node.end]);
    else if (node.type === 'VariableDeclaration') {
      for (const declaration of node.declarations) {
        if (declaration.id.type === 'Identifier') decls.set(declaration.id.name, [node.start, node.end]);
        else bindPatternNames(declaration.id, (name) => decls.set(name, [node.start, node.end]));
      }
    } else if (node.type === 'ImportDeclaration') {
      for (const specifier of node.specifiers) {
        imports.set(specifier.local.name, {
          module: String(node.source.value).split('/').pop(),
          name: specifier.imported?.name ?? specifier.local.name,
        });
      }
    } else if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration !== null) {
        if (node.declaration.id !== undefined && node.declaration.id !== null) decls.set(node.declaration.id.name, [node.declaration.start, node.declaration.end]);
        if (node.declaration.type === 'VariableDeclaration') {
          for (const declaration of node.declaration.declarations) {
            if (declaration.id.type === 'Identifier') decls.set(declaration.id.name, [node.declaration.start, node.declaration.end]);
          }
        }
      }
      for (const specifier of node.specifiers) exports.set(specifier.exported.name, specifier.local.name);
    }
  }
  const value = { decls, imports, exports };
  moduleInfo.set(f, value);
  return value;
}

/** Names a binding pattern introduces. */
function bindPatternNames(node, take) {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const child of node) bindPatternNames(child, take); return; }
  if (node.type === 'Identifier') take(node.name);
  else if (node.type === 'AssignmentPattern') bindPatternNames(node.left, take);
  else if (node.type === 'RestElement') bindPatternNames(node.argument, take);
  else if (node.type === 'ObjectPattern') for (const p of node.properties) bindPatternNames(p.type === 'RestElement' ? p.argument : p.value, take);
  else if (node.type === 'ArrayPattern') for (const el of node.elements) bindPatternNames(el, take);
}

/** The identifiers the body reads from outside itself. */
function freeNames(body) {
  let ast;
  try { ast = acorn.parse(body, { ecmaVersion: 'latest', sourceType: 'module' }); } catch { return null; }
  const bound = new Set();
  const reads = new Set();
  const bindPattern = (node) => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const child of node) bindPattern(child); return; }
    if (node.type === 'Identifier') bound.add(node.name);
    else if (node.type === 'AssignmentPattern') bindPattern(node.left);
    else if (node.type === 'RestElement') bindPattern(node.argument);
    else if (node.type === 'ObjectPattern') for (const p of node.properties) bindPattern(p.type === 'RestElement' ? p.argument : p.value);
    else if (node.type === 'ArrayPattern') for (const el of node.elements) bindPattern(el);
  };
  const walk = (node, parent) => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const child of node) walk(child, parent); return; }
    switch (node.type) {
      case 'VariableDeclarator': bindPattern(node.id); break;
      case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression':
        if (node.id) bound.add(node.id.name);
        for (const param of node.params) bindPattern(param);
        break;
      case 'CatchClause': bindPattern(node.param); break;
      case 'LabeledStatement': bound.add(node.label.name); break;
      case 'BreakStatement': case 'ContinueStatement': if (node.label) bound.add(node.label.name); break;
      default: break;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
      if (node.type === 'MemberExpression' && key === 'property' && node.computed === false) continue;
      if (node.type === 'Property' && key === 'key' && node.computed === false) { walk(value, node); continue; }
      if (value !== null && typeof value === 'object') walk(value, node);
    }
    if (node.type === 'Identifier' && parent !== null) reads.add(node.name);
  };
  walk(ast, null);
  const free = new Set();
  for (const name of reads) if (!bound.has(name) && !GLOBALS.has(name)) free.add(name);
  return free;
}

const start = process.argv[2] ?? 'Mde';
const startFile = process.argv[3] ?? 'chunk-qq2mgstr.js';
const startRange = (process.argv[4] ?? '16350,16512').split(',').map(Number);

const seen = new Map();
const notes = [];
const queue = [[startFile, start, startRange]];
while (queue.length > 0) {
  const [file, name, range] = queue.shift();
  const key = `${file}:${name}`;
  if (seen.has(key)) continue;
  seen.set(key, { file, name, range });
  const body = text(file).slice(range[0], range[1]);
  const free = freeNames(body);
  if (free === null) { notes.push(`${key}: body does not parse`); continue; }
  const { decls, imports } = info(file);
  for (const dep of free) {
    if (dep === name) continue;
    if (decls.has(dep)) { queue.push([file, dep, decls.get(dep)]); continue; }
    const imported = imports.get(dep);
    if (imported === undefined) { notes.push(`${key} reads ${dep}: no depth-0 declaration and no import in ${file}`); continue; }
    const target = imported.module;
    if (!fs.existsSync(dir + target)) { notes.push(`${key} reads ${dep} from ${target}, which is not an extracted module`); continue; }
    const exported = info(target).exports.get(imported.name);
    if (exported === undefined) { notes.push(`${key} reads ${dep} from ${target}.${imported.name}, which that module does not export`); continue; }
    const range = info(target).decls.get(exported);
    if (range === undefined) { notes.push(`${key} reads ${dep} → ${target}.${exported}, which is not a depth-0 declaration there`); continue; }
    queue.push([target, exported, range]);
  }
}

let units = 0;
const byModule = new Map();
for (const { file, name, range } of seen.values()) {
  units += range[1] - range[0];
  if (!byModule.has(file)) byModule.set(file, []);
  byModule.get(file).push(`${name} [${range[0]},${range[1]}) ${range[1] - range[0]}`);
}
for (const [file, rows] of byModule) console.log(`\n${file} (${rows.length})\n  ${rows.join('\n  ')}`);
for (const note of notes) console.log(`NOTE ${note}`);
console.log(`\nclosure: ${seen.size} blocks, ${units} units over ${byModule.size} modules`);
