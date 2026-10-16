import fs from 'node:fs';
import * as acorn from 'acorn';
const dir = 'extracted-v2/modules/';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
const read = (f) => fs.readFileSync(dir + f, 'utf8');

// 1. Where does `Oe` come from, and does the product already carry it?
const qm = read('chunk-qm4226vk.js');
const imports = [...qm.matchAll(/import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)]
  .map((m) => ({ names: m[1].split(',').map((s) => s.trim()), from: m[2] }));
console.log('module imports:', JSON.stringify(imports));
const oeOwners = [];
for (const file of files) {
  const m = new RegExp(`(?:^|[;,{}])(?:function|var|let|const)\\s+Oe\\b`).exec(read(file));
  if (m) oeOwners.push(`${file}@${m.index + 1}`);
}
console.log('Oe declared in:', oeOwners.slice(0, 6).join(' '), `(${oeOwners.length} modules)`);
const product = fs.readdirSync('src').filter((f) => f.endsWith('.ts'));
console.log('product files exporting Oe:', product.filter((f) => /export\s*\{[^}]*\bOe\b/.test(fs.readFileSync('src/' + f, 'utf8'))).join(', ') || 'none');

// 2. Free identifiers of the class body (rough: every identifier not declared inside it).
const ast = acorn.parse(qm, { ecmaVersion: 'latest', sourceType: 'module' });
const cls = ast.body.find((n) => n.type === 'ClassDeclaration');
const declared = new Set();
const walk = (node, declare) => {
  if (!node || typeof node.type !== 'string') return;
  if (node.type === 'VariableDeclarator') collectPattern(node.id, declared);
  if ((node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') && node.id) declared.add(node.id.name);
  if (node.type === 'ClassDeclaration' && node.id) declared.add(node.id.name);
  for (const key of Object.keys(node)) {
    if (key === 'start' || key === 'end' || key === 'loc') continue;
    const value = node[key];
    if (Array.isArray(value)) for (const child of value) walk(child, declare);
    else if (value && typeof value.type === 'string') walk(value, declare);
  }
};
const collectPattern = (node, into) => {
  if (!node) return;
  if (node.type === 'Identifier') into.add(node.name);
  else if (node.type === 'ObjectPattern') for (const p of node.properties) collectPattern(p.value ?? p.argument, into);
  else if (node.type === 'ArrayPattern') for (const el of node.elements) collectPattern(el, into);
  else if (node.type === 'AssignmentPattern') collectPattern(node.left, into);
  else if (node.type === 'RestElement') collectPattern(node.argument, into);
};
walk(cls.body, true);
const used = new Set();
const walkUse = (node) => {
  if (!node || typeof node.type !== 'string') return;
  if (node.type === 'Identifier') used.add(node.name);
  for (const key of Object.keys(node)) {
    if (key === 'start' || key === 'end' || key === 'loc') continue;
    const value = node[key];
    if (Array.isArray(value)) for (const child of value) walkUse(child);
    else if (value && typeof value.type === 'string') walkUse(value);
  }
};
walkUse(cls.body);
const builtins = new Set(['undefined', 'Object', 'Map', 'Set', 'Array', 'JSON', 'String', 'Number', 'Boolean', 'Promise', 'WeakMap', 'Symbol', 'Math', 'Date', 'RegExp', 'Error', 'arguments', 'this', 'super', 'null', 'true', 'false', 'globalThis']);
const free = [...used].filter((n) => !declared.has(n) && !builtins.has(n));
console.log('class free identifiers:', free.join(' '));
for (const name of free) {
  const owners = files.filter((file) => new RegExp(`(?:^|[;,{}])(?:function|var|let|const|class)\\s+${name}\\b`).test(read(file))).slice(0, 3);
  console.log(`   ${name} declared in: ${owners.join(' ')}`);
}
