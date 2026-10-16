// W45-9 reconnaissance: for a module and a list of exact ranges, report every identifier the copied
// bodies use that is neither declared inside those ranges nor listed as an import, with the module's own
// top-level declaration site for each (so a block is added by module+offset, never by bare name).
import fs from 'node:fs';
import * as acorn from 'acorn';
import crypto from 'node:crypto';

const [module, ...rest] = process.argv.slice(2);
const ranges = rest.map((pair) => pair.split(',').map(Number));
if (!module || ranges.length === 0) throw new Error('Usage: node .audit/w45-9-closure.mjs MODULE.js START,END ...');

const text = fs.readFileSync(`extracted-v2/modules/${module}`, 'utf8');
const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
const inside = (node) => ranges.some(([a, b]) => node.start >= a && node.end <= b);

const declared = new Set();
const used = new Map();
const walk = (node, fn) => {
  if (!node || typeof node.type !== 'string') return;
  fn(node);
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) for (const item of value) walk(item, fn);
    else if (value && typeof value.type === 'string') walk(value, fn);
  }
};
for (const node of ast.body) {
  if (!inside(node)) continue;
  walk(node, (n) => {
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') declared.add(n.id.name);
    if (n.type === 'FunctionDeclaration' && n.id) declared.add(n.id.name);
    if (n.type === 'ClassDeclaration' && n.id) declared.add(n.id.name);
    if (n.type === 'Identifier' && !(n === n.parent)) used.set(n.name, n.start);
  });
}
// Local bindings inside the copied bodies (params, nested declarations) also count as declared.
for (const node of ast.body) {
  if (!inside(node)) continue;
  walk(node, (n) => {
    if (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression' || n.type === 'FunctionDeclaration') {
      for (const p of n.params) walk(p, (q) => { if (q.type === 'Identifier') declared.add(q.name); });
    }
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') declared.add(n.id.name);
    if (n.type === 'ClassDeclaration' || n.type === 'ClassExpression') {
      if (n.id) declared.add(n.id.name);
      for (const m of n.body.body) walk(m, (q) => {
        if (q.type === 'PropertyDefinition' && q.key.type === 'PrivateIdentifier') declared.add(q.key.name);
        if (q.type === 'PropertyDefinition' && q.key.type === 'Identifier') declared.add(q.key.name);
        if (q.type === 'MethodDefinition' && q.key.type === 'Identifier') declared.add(q.key.name);
      });
    }
    if (n.type === 'CatchClause' && n.param?.type === 'Identifier') declared.add(n.param.name);
  });
}

const topLevel = new Map();
for (const node of ast.body) {
  if (inside(node)) continue;
  if (node.type === 'VariableDeclaration') for (const d of node.declarations) if (d.id.type === 'Identifier') topLevel.set(d.id.name, node.start);
  if (node.type === 'FunctionDeclaration' && node.id) topLevel.set(node.id.name, node.start);
  if (node.type === 'ClassDeclaration' && node.id) topLevel.set(node.id.name, node.start);
  if (node.type === 'ImportDeclaration') for (const s of node.specifiers) topLevel.set(s.local.name, node.start);
}


const externals = new Set([...used.keys()].filter((name) => !declared.has(name)));
const globals = new Set(["Math","Number","String","Object","Array","Set","Map","JSON","Infinity","undefined","NaN","Boolean","RegExp","Symbol","BigInt","Intl","Date","Error","Promise","structuredClone","console","globalThis","process","isNaN","parseInt","parseFloat"]);
// Every block already copied from this module, across the product ledgers.
const copied = [];
for (const file of fs.readdirSync("src")) {
  if (!file.endsWith("-source-blocks.json")) continue;
  const ledger = JSON.parse(fs.readFileSync("src/" + file, "utf8"));
  for (const block of ledger.blocks) if (block.module === module) copied.push(block.range);
}
const covered = (at) => copied.some(([a, b]) => at >= a && at < b);
// A declaration statement ends at the next top-level statement start; use the AST node end when it is a
// single declaration, else the following top-level node start.
const extentOf = (at) => {
  for (const node of ast.body) {
    if (node.start !== at) continue;
    if (node.type === "VariableDeclaration" || node.type === "FunctionDeclaration" || node.type === "ClassDeclaration" || node.type === "ImportDeclaration") return node.end;
  }
  return at;
};
const missing = [];
for (const name of [...externals].sort()) {
  if (globals.has(name)) continue;
  const at = topLevel.get(name);
  if (at === undefined || covered(at)) continue;
  const end = extentOf(at);
  const body = text.slice(at, end);
  missing.push({ name, at, end, units: end - at, sha: crypto.createHash("sha256").update(body).digest("hex").slice(0, 16) });
}
missing.sort((a, b) => a.at - b.at);
// A candidate whose declaration site is an import statement is not a block: copying the line would
// emit an unresolvable `/$bunfs/root/...` specifier. Report it as an import instead, so a plan is
// never built from it (three passes of this work added such a block before this check existed).
const importOf = new Map();
for (const node of ast.body) if (node.type === 'ImportDeclaration') for (const s of node.specifiers) importOf.set(s.local.name, node.source.value);
const blocks = missing.filter((m) => !importOf.has(m.name));
const imported = missing.filter((m) => importOf.has(m.name));
console.log("MISSING blocks:", blocks.length, "units:", blocks.reduce((n, m) => n + m.units, 0));
for (const m of blocks) console.log(m.name + "\t[" + m.at + "," + m.end + ")\t" + m.units + "\t" + m.sha);
for (const m of imported) console.log("IMPORT " + m.name + " from " + importOf.get(m.name));
const absent = [...externals].filter((n) => !globals.has(n) && topLevel.get(n) === undefined);
if (absent.length) console.log("NOT-IN-MODULE:", absent.sort().join(" "));
