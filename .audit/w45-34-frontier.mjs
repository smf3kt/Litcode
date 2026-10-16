// The frontier of one body: every identifier it reads from outside itself, marked as ported or not,
// with the declaration site of each unported name. No recursion — the walk is driven one level at a
// time, so every step is checkable, which the general closure walker in w45-33-closure.mjs is not.
//   node .audit/w45-34-frontier.mjs FILE START END
import fs from 'node:fs';
import * as acorn from 'acorn';

const dir = 'extracted-v2/modules/';
const [file, from, to] = process.argv.slice(2);
const GLOBALS = new Set(['undefined', 'Array', 'Object', 'Math', 'Date', 'Set', 'Map', 'WeakMap', 'WeakSet',
  'JSON', 'String', 'Number', 'Boolean', 'Symbol', 'RegExp', 'Error', 'TypeError', 'RangeError', 'Promise',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'console',
  'process', 'Buffer', 'performance', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask',
  'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder', 'Uint8Array', 'Uint32Array', 'Uint16Array', 'Int8Array',
  'Int16Array', 'Int32Array', 'Float64Array', 'BigInt64Array', 'ArrayBuffer', 'DataView', 'structuredClone',
  'globalThis', 'Infinity', 'NaN', 'arguments', 'require', 'module', 'exports', 'Reflect', 'Proxy', 'Intl', 'crypto',
  'AbortController', 'AbortSignal', 'Function', 'eval', 'Atomics', 'SharedArrayBuffer', 'URLPattern']);

const text = (f) => fs.readFileSync(dir + f, 'utf8');

/** Names every generated copy exports, plus the seams' re-exports. */
const ported = new Set();
for (const f of fs.readdirSync('src').filter((name) => name.endsWith('.ts'))) {
  const source = fs.readFileSync('src/' + f, 'utf8');
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.split(/\s+as\s+/).pop().trim();
      if (name !== '') ported.add(name);
    }
  }
  for (const m of source.matchAll(/export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g)) ported.add(m[1]);
  for (const m of source.matchAll(/export\s+(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) ported.add(m[1]);
}

/** Depth-0 declarations, imports and exports of a module. */
const info = new Map();
function moduleInfo(f) {
  if (info.has(f)) return info.get(f);
  const s = text(f);
  const decls = new Map();
  const imports = new Map();
  const exports = new Map();
  for (const node of acorn.parse(s, { ecmaVersion: 'latest', sourceType: 'module' }).body) {
    if (node.type === 'FunctionDeclaration' && node.id !== null) decls.set(node.id.name, [node.start, node.end]);
    else if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations) if (d.id.type === 'Identifier') decls.set(d.id.name, [node.start, node.end]);
    } else if (node.type === 'ImportDeclaration') {
      for (const spec of node.specifiers) {
        imports.set(spec.local.name, { module: String(node.source.value).split('/').pop(), name: spec.imported?.name ?? spec.local.name });
      }
    } else if (node.type === 'ExportNamedDeclaration') {
      for (const spec of node.specifiers) exports.set(spec.exported.name, spec.local.name);
      if (node.declaration?.id != null) decls.set(node.declaration.id.name, [node.declaration.start, node.declaration.end]);
    }
  }
  info.set(f, { decls, imports, exports });
  return info.get(f);
}

/** The identifiers the body reads from outside itself. */
function freeNames(body) {
  const ast = acorn.parse(body, { ecmaVersion: 'latest', sourceType: 'module' });
  const bound = new Set();
  const reads = new Set();
  const bind = (node) => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const child of node) bind(child); return; }
    if (node.type === 'Identifier') bound.add(node.name);
    else if (node.type === 'AssignmentPattern') bind(node.left);
    else if (node.type === 'RestElement') bind(node.argument);
    else if (node.type === 'ObjectPattern') for (const p of node.properties) bind(p.type === 'RestElement' ? p.argument : p.value);
    else if (node.type === 'ArrayPattern') for (const el of node.elements) bind(el);
  };
  const walk = (node, parent) => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const child of node) walk(child, parent); return; }
    if (node.type === 'VariableDeclarator') bind(node.id);
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      if (node.id) bound.add(node.id.name);
      for (const param of node.params) bind(param);
    }
    if (node.type === 'CatchClause') bind(node.param);
    for (const [key, value] of Object.entries(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
      if (node.type === 'MemberExpression' && key === 'property' && node.computed === false) continue;
      if (node.type === 'Property' && key === 'key' && node.computed === false) continue;
      if (value !== null && typeof value === 'object') walk(value, node);
    }
    if (node.type === 'Identifier' && parent !== null) reads.add(node.name);
  };
  walk(ast, null);
  return [...reads].filter((name) => !bound.has(name) && !GLOBALS.has(name));
}

const start = Number(from);
const end = Number(to);
const body = text(file).slice(start, end);
console.log(`${file} [${start},${end}) ${end - start} units\n${body.slice(0, 200)}${body.length > 200 ? '…' : ''}\n`);
const { decls, imports } = moduleInfo(file);
let unported = 0;
for (const name of freeNames(body)) {
  if (ported.has(name)) { console.log(`  ${name}: ported`); continue; }
  unported += 1;
  if (decls.has(name)) {
    const [a, b] = decls.get(name);
    console.log(`  ${name}: NOT ported — declared in ${file} [${a},${b}) ${b - a} units`);
    continue;
  }
  const imported = imports.get(name);
  if (imported === undefined) { console.log(`  ${name}: NOT ported — no depth-0 declaration and no import in ${file}`); continue; }
  const target = imported.module;
  if (!fs.existsSync(dir + target)) { console.log(`  ${name}: NOT ported — imported from ${target} (not an extracted module)`); continue; }
  const local = moduleInfo(target).exports.get(imported.name);
  const range = local === undefined ? undefined : moduleInfo(target).decls.get(local);
  console.log(range === undefined
    ? `  ${name}: NOT ported — ${target}.${imported.name} is not a depth-0 declaration there`
    : `  ${name}: NOT ported — ${target} [${range[0]},${range[1]}) ${range[1] - range[0]} units`);
}
console.log(`\n${unported} unported of ${freeNames(body).length} free names`);
