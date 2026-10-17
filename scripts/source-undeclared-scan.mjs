// Lists identifiers a generated source-copy file references but never declares or imports.
//
// The copied bodies are minified module scopes: a name that is not visible at the reference must come
// from an import, and anything else is a gap the copy still has to fill. Run it after regenerating a
// *-source.ts file to see what the next blocks have to be.
//
//   node scripts/source-undeclared-scan.mjs src/plugin-chain-loader-source.ts
//
// Resolution is scope-aware, and that is the point of this version: W45-22 shipped
// src/plugin-chain-stream-source.ts with a reference to `a8` that no block declared, and this scan
// reported `unresolved 0` because it counted every declaration at any depth. Minified bodies reuse
// short names as parameters and loop bindings everywhere, so a `let a8` inside one copied function
// satisfied a reference in another. A declaration now counts only for the scope it belongs to:
// `var`/function declarations bind to their enclosing function (or the module), `let`/`const`/`class`
// to their block, parameters to their function, and a reference resolves outward from where it sits.
import fs from 'node:fs';
import * as acorn from 'acorn';

const GLOBALS = new Set([
  'globalThis', 'global', 'self', 'undefined', 'null', 'true', 'false', 'this', 'arguments', 'NaN', 'Infinity',
  'Object', 'Array', 'Function', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt', 'Math', 'JSON',
  'Date', 'RegExp', 'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'EvalError', 'URIError',
  'AggregateError', 'Map', 'Set', 'WeakMap', 'WeakSet', 'WeakRef', 'Promise', 'Proxy', 'Reflect',
  'ArrayBuffer', 'SharedArrayBuffer', 'DataView', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray',
  'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array',
  'BigInt64Array', 'BigUint64Array', 'Atomics', 'Intl', 'console', 'performance', 'process',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate',
  'queueMicrotask', 'structuredClone', 'fetch', 'URL', 'URLSearchParams', 'TextEncoder',
  'TextDecoder', 'AbortController', 'AbortSignal', 'DOMException', 'Event', 'EventTarget',
  'FinalizationRegistry', 'escape', 'unescape', 'encodeURIComponent', 'decodeURIComponent',
  'encodeURI', 'decodeURI', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'eval', 'Buffer',
  'require', 'module', 'exports', '__dirname', '__filename', 'crypto', 'localStorage', 'navigator',
  // The recovered application runs on Bun, so a copied body may reach its runtime global the way a
  // copied body reaches `process`. One does: the version comparison behind the keybinding defaults
  // (`Yho`, chunk-bk5ct2gw.js [342203,342254)) calls `Bun.semver.satisfies`, and under Node that
  // reach is a boundary the keys seam names rather than a name the copy failed to declare.
  'Bun',
]);

const file = process.argv[2];
const text = fs.readFileSync(file, 'utf8');
// The pragma is neutralised rather than removed: dropping the line would shift every reported line
// and column by one against the file the reader opens.
const ast = acorn.parse(text.replace(/^\/\/ @ts-nocheck/, '//'), {
  ecmaVersion: 'latest', sourceType: 'module', locations: true,
});

const scopeOf = (parent) => {
  const scope = { parent, names: new Set(), children: [] };
  if (parent !== null) parent.children.push(scope);
  return scope;
};
const moduleScope = scopeOf(null);
const references = []; // { name, scope, loc }
const imported = new Set();

const isFunction = (node) =>
  node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression';

/** Bind every name a pattern introduces into `scope` (`{a, b: c} = e` binds `a` and `c`). */
function bindPattern(node, scope) {
  if (!node) return;
  switch (node.type) {
    case 'Identifier': scope.names.add(node.name); break;
    case 'ObjectPattern': for (const p of node.properties) bindPattern(p.type === 'RestElement' ? p.argument : p.value, scope); break;
    case 'ArrayPattern': for (const e of node.elements) bindPattern(e, scope); break;
    case 'AssignmentPattern': bindPattern(node.left, scope); break;
    case 'RestElement': bindPattern(node.argument, scope); break;
    default: break;
  }
}

function eachChild(node, fn) {
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) if (child !== null && typeof child === 'object' && typeof child.type === 'string') fn(child);
    } else if (value !== null && typeof value === 'object' && typeof value.type === 'string') fn(value);
  }
}

/** `var` and function declarations bind to the nearest function (or module) scope, wherever they sit,
 *  so they are collected before the body is walked. Nested functions are their own pass. */
function hoist(body, scope) {
  const visit = (node) => {
    if (isFunction(node)) return;
    if (node.type === 'VariableDeclaration' && node.kind === 'var') {
      for (const d of node.declarations) bindPattern(d.id, scope);
    }
    if (node.type === 'FunctionDeclaration' && node.id) scope.names.add(node.id.name);
    eachChild(node, visit);
  };
  visit(body);
}

function walkFunction(node, outer) {
  const scope = scopeOf(outer);
  if (node.type === 'FunctionDeclaration' && node.id) outer.names.add(node.id.name);
  if (node.type === 'FunctionExpression' && node.id) scope.names.add(node.id.name);
  for (const parameter of node.params ?? []) bindPattern(parameter, scope);
  hoist(node.body, scope);
  walk(node.body, scope);
}

function walkBlock(statements, outer) {
  const scope = scopeOf(outer);
  for (const statement of statements) walk(statement, scope);
}

function walkIdentifier(node, scope) {
  references.push({ name: node.name, scope, loc: node.loc });
}

function walkDeclaration(node, scope) {
  // `var` is already bound by `hoist`; binding it again here is harmless and keeps this pass local.
  for (const declarator of node.declarations) {
    bindPattern(declarator.id, scope);
    walk(declarator.init, scope);
  }
}

function walk(node, scope) {
  if (node === null || node === undefined) return;
  switch (node.type) {
    case 'ImportDeclaration':
      for (const specifier of node.specifiers) { scope.names.add(specifier.local.name); imported.add(node.source.value); }
      return;
    case 'ExportNamedDeclaration': case 'ExportDefaultDeclaration':
      if (node.declaration) walk(node.declaration, scope);
      return;
    case 'ExportAllDeclaration':
      imported.add(node.source.value);
      return;
    case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression':
      walkFunction(node, scope);
      return;
    case 'ClassDeclaration': {
      // A class declaration binds its name in the enclosing scope (where `hoist` does not reach it,
      // unlike a function declaration) and its body introduces one scope of its own.
      if (node.id) scope.names.add(node.id.name);
      const classScope = scopeOf(scope);
      if (node.id) classScope.names.add(node.id.name);
      if (node.superClass) walk(node.superClass, classScope);
      walk(node.body, classScope);
      return;
    }
    case 'ClassExpression': {
      const classScope = scopeOf(scope);
      if (node.id) classScope.names.add(node.id.name);
      if (node.superClass) walk(node.superClass, classScope);
      walk(node.body, classScope);
      return;
    }
    case 'BlockStatement':
      walkBlock(node.body, scope);
      return;
    case 'VariableDeclaration':
      walkDeclaration(node, scope);
      return;
    case 'CatchClause': {
      const catchScope = scopeOf(scope);
      bindPattern(node.param, catchScope);
      walk(node.body, catchScope);
      return;
    }
    case 'ForStatement': case 'ForInStatement': case 'ForOfStatement': {
      const loopScope = scopeOf(scope);
      if (node.init) walk(node.init, loopScope);
      if (node.left) walk(node.left, loopScope);
      if (node.right) walk(node.right, loopScope);
      walk(node.body, loopScope);
      return;
    }
    case 'Identifier':
      walkIdentifier(node, scope);
      return;
    case 'MemberExpression':
      walk(node.object, scope);
      if (node.computed) walk(node.property, scope);
      return;
    case 'Property':
      if (node.computed) walk(node.key, scope);
      walk(node.value, scope);
      return;
    case 'MethodDefinition': case 'PropertyDefinition':
      if (node.computed) walk(node.key, scope);
      walk(node.value, scope);
      return;
    case 'LabeledStatement':
      walk(node.body, scope);
      return;
    case 'BreakStatement': case 'ContinueStatement':
      return;
    case 'MetaProperty':
      return;
    case 'ImportExpression':
      walk(node.source, scope);
      return;
    default:
      eachChild(node, (child) => walk(child, scope));
  }
}

walk(ast, moduleScope);
const resolve = (scope, name) => {
  for (let at = scope; at !== null; at = at.parent) if (at.names.has(name)) return true;
  return false;
};


const missing = new Map();
for (const reference of references) {
  const { name } = reference;
  if (GLOBALS.has(name) || resolve(reference.scope, name)) continue;
  if (!missing.has(name)) missing.set(name, reference.loc.start.line);
}
const bound = new Set();
const visitScope = (scope) => {
  for (const name of scope.names) bound.add(name);
  for (const child of scope.children) visitScope(child);
};
visitScope(moduleScope);
console.log(`file ${file}`);
console.log(`declared ${bound.size}  imports ${[...imported].join(', ')}`);
console.log(`unresolved ${missing.size}`);
for (const [name, line] of [...missing].sort()) console.log(`  ${name}  (line ${line})`);
