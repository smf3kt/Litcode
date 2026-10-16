// Fill the empty `note` of each W45-14 plan block with what the copied body actually declares, derived
// by parsing the block's own source slice. A mechanical note cannot drift from the body the way a
// hand-written summary can, and the ledger is where the record cites each range.
import fs from 'node:fs';
import * as acorn from 'acorn';

const PLANS = [
  'research/ports/W45-classic-sites-blocks.plan.json',
  'research/ports/W45-lodash-memoize-source-blocks.plan.json',
  'research/ports/W45-lodash-internals-source-blocks.plan.json',
  'research/ports/W45-lodash-mapvalues-source-blocks.plan.json',
];
const texts = new Map();
const text = (mod) => {
  if (!texts.has(mod)) texts.set(mod, fs.readFileSync('extracted-v2/modules/' + mod, 'utf8'));
  return texts.get(mod);
};
const walk = (node, fn) => {
  if (!node || typeof node.type !== 'string') return;
  fn(node);
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) for (const item of value) walk(item, fn);
    else if (value && typeof value.type === 'string') walk(value, fn);
  }
};
function namesOf(slice) {
  let ast;
  try { ast = acorn.parse(slice, { ecmaVersion: 'latest', sourceType: 'module' }); }
  catch { return []; }
  const names = [];
  const collect = (pattern) => {
    if (!pattern) return;
    if (pattern.type === 'Identifier') names.push(pattern.name);
    else if (pattern.type === 'ObjectPattern') for (const p of pattern.properties) collect(p.value ?? p.argument);
    else if (pattern.type === 'ArrayPattern') for (const p of pattern.elements) collect(p);
    else if (pattern.type === 'AssignmentPattern') collect(pattern.left);
    else if (pattern.type === 'RestElement') collect(pattern.argument);
  };
  for (const node of ast.body) {
    if (node.type === 'VariableDeclaration') for (const d of node.declarations) collect(d.id);
    else if (node.type === 'FunctionDeclaration' && node.id) names.push(node.id.name);
    else if (node.type === 'ClassDeclaration' && node.id) names.push(node.id.name);
    else if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      const inner = node.declaration;
      if (inner.type === 'VariableDeclaration') for (const d of inner.declarations) collect(d.id);
      else if (inner.id) names.push(inner.id.name);
    } else if (node.type === 'ExpressionStatement' || node.type === 'ReturnStatement') {
      walk(node, (n) => { if (n.type === 'ArrowFunctionExpression' || n.type === 'FunctionExpression') for (const p of n.params) collect(p); });
    }
  }
  return names;
}

let filled = 0;
for (const plan of PLANS) {
  const json = JSON.parse(fs.readFileSync(plan, 'utf8'));
  for (const block of json.blocks) {
    if (block.note && block.note.trim()) continue;
    const slice = text(block.file).slice(block.range[0], block.range[1]);
    const names = namesOf(slice);
    const unique = [...new Set(names)];
    const excerpt = slice.replace(/\s+/g, ' ').trim().slice(0, 72);
    block.note = unique.length
      ? `declares ${unique.slice(0, 6).join(', ')}${unique.length > 6 ? ', …' : ''}`
      : `excerpt: ${excerpt}${slice.length > 72 ? '…' : ''}`;
    filled++;
  }
  fs.writeFileSync(plan, JSON.stringify(json, null, 1) + '\n');
}
console.log('notes filled:', filled);
