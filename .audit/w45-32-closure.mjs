// Measure the label sanitiser's closure before deciding the package boundary: start from `Mde`
// (chunk-qq2mgstr.js [16350,16512)) and follow every free identifier to its declaration site, so
// the port either closes in this package or says exactly which blocks it would need.
import fs from 'node:fs';
import * as acorn from 'acorn';

const dir = 'extracted-v2/modules/';
const GLOBALS = new Set(['undefined', 'Array', 'Object', 'Math', 'Date', 'Set', 'Map', 'WeakMap', 'WeakSet',
  'JSON', 'String', 'Number', 'Boolean', 'Symbol', 'RegExp', 'Error', 'TypeError', 'RangeError', 'Promise',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'console',
  'process', 'Buffer', 'performance', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask',
  'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder', 'Uint8Array', 'Int32Array', 'Float64Array', 'BigInt64Array',
  'ArrayBuffer', 'structuredClone', 'globalThis', 'Infinity', 'NaN', 'arguments', 'require', 'module', 'exports',
  'Reflect', 'Proxy', 'Intl', 'crypto', 'structuredClone', 'AbortController', 'AbortSignal', 'arguments']);

const texts = new Map();
const index = new Map();
const text = (f) => {
  if (!texts.has(f)) texts.set(f, fs.readFileSync(dir + f, 'utf8'));
  return texts.get(f);
};
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));

/** Module-level declarations: `function X(`, `var/let/const X=`, comma lists, and the import map. */
function moduleIndex(f) {
  if (index.has(f)) return index.get(f);
  const s = text(f);
  const found = new Map();
  for (const m of s.matchAll(/(?:^|[;}\n])function\*?\s+([A-Za-z_$][\w$]*)\s*\(/g)) found.set(m[1], { kind: 'decl', at: m.index + 1 });
  for (const m of s.matchAll(/(?:^|[;}\n])(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/g)) if (!found.has(m[1])) found.set(m[1], { kind: 'decl', at: m.index + 1 });
  for (const m of s.matchAll(/import\{([^}]{0,8000}?)\}from"([^"]+)"/g)) {
    for (const part of m[1].split(',')) {
      const p = part.trim();
      if (p === '') continue;
      const [orig, alias] = p.split(/\s+as\s+/);
      found.set((alias ?? orig).trim(), { kind: 'import', module: m[2].split('/').pop(), name: orig.trim() });
    }
  }
  index.set(f, found);
  return found;
}

/** Every identifier the body reads from outside itself. */
function freeNames(body) {
  let ast;
  try { ast = acorn.parse(body, { ecmaVersion: 'latest', sourceType: 'module' }); } catch { return null; }
  const bound = new Set();
  const reads = new Set();
  /** Names a binding pattern introduces (`{a, b: c}` binds a and c; `[x]` binds x). */
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

/** The statement that starts at `at` (or the function body when one starts there). */
function extent(f, at) {
  const s = text(f);
  let depth = 0, seen = false;
  for (let i = at; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') { const q = c; i++; while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++; } continue; }
    if (c === '{' || c === '(' || c === '[') { depth++; seen = true; continue; }
    if (c === '}' || c === ')' || c === ']') { depth--; continue; }
    if (depth === 0 && (c === ';' || (seen && c === '}'))) return [at, i + 1];
  }
  return [at, at];
}

const seen = new Map();
const queue = [['chunk-qq2mgstr.js', 'Mde', [16350, 16512]]];
const notes = [];
while (queue.length > 0) {
  const [file, name, range] = queue.shift();
  const key = `${file} ${name}`;
  if (seen.has(key)) continue;
  seen.set(key, range);
  const body = text(file).slice(range[0], range[1]);
  const free = freeNames(body);
  if (free === null) { notes.push(`${key}: body did not parse`); continue; }
  for (const dep of free) {
    const where = moduleIndex(file).get(dep);
    if (where === undefined) { notes.push(`${key} reads ${dep}, which ${file} neither declares nor imports`); continue; }
    if (where.kind === 'import') {
      const target = [...files].find((g) => g === where.module);
      if (target === undefined) { notes.push(`${key} reads ${dep} from ${where.module}, which is not an extracted module`); continue; }
      const local = moduleIndex(target).get(where.name);
      if (local === undefined || local.kind !== 'decl') { notes.push(`${key} reads ${dep} from ${where.module}.${where.name}: not a local declaration there`); continue; }
      queue.push([target, where.name, extent(target, local.at)]);
      seen.set(`${file} ${dep}`, `import ${where.module}.${where.name}`);
      continue;
    }
    queue.push([file, dep, extent(file, where.at)]);
  }
}
let units = 0;
for (const [key, range] of seen) {
  if (typeof range === 'string') { console.log(`${key} → ${range}`); continue; }
  units += range[1] - range[0];
  console.log(`${key} [${range[0]},${range[1]}) ${range[1] - range[0]} units`);
}
for (const note of notes) console.log(`NOTE ${note}`);
console.log(`\nclosure: ${seen.size} names, ${units} units`);
