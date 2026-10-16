import fs from 'node:fs';
import * as acorn from 'acorn';
const src = fs.readFileSync('extracted-v2/modules/chunk-n3ykh62m.js', 'utf8');
let tree; try { tree = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }); }
catch { tree = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' }); }
const ranges = [[233140,233219],[233330,233611],[233864,235650],[235982,236820],[237485,238267],[246293,246804],[246992,247131],[247312,248693],[257601,259284],[260226,260804]];
const picked = tree.body.filter(n => ranges.some(([a,b]) => n.start >= a && n.end <= b));
const globals = new Set(['Object','Array','JSON','Math','Number','String','Boolean','Set','Map','Buffer','Uint8Array','Uint32Array','RegExp','Promise','Error','Date','parseInt','parseFloat','isNaN','encodeURIComponent','decodeURIComponent','Intl','Symbol','WeakMap','BigInt','undefined','NaN','Infinity','globalThis','console','process']);
const declared = new Set(); const free = new Map();
const declare = (name) => { if (name) declared.add(name); };
// Pass 1: every name declared anywhere in the picked statements (they are one scope: a module body).
for (const node of picked) {
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) { if (d.id.type === 'Identifier') declare(d.id.name); }
    if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) declare(n.id.name);
    for (const k of Object.keys(n)) { if (k === 'type' || k === 'start' || k === 'end') continue; walk(n[k]); }
  };
  walk(node);
}
// Pass 2: identifier references that are not declared inside the set, not property keys, not globals.
const visit = (n, fn, parent, key) => {
  if (!n || typeof n !== 'object') return;
  if (Array.isArray(n)) return n.forEach((c) => visit(c, fn, parent, key));
  fn(n, parent, key);
  for (const k of Object.keys(n)) {
    if (['type','start','end','loc','range'].includes(k)) continue;
    const child = n[k];
    if (child && typeof child === 'object') visit(child, fn, k === 'callee' || k === 'object' ? n : null, k);
  }
};
for (const node of picked) {
  visit(node, (n, parent, key) => {
    if (n.type !== 'Identifier') return;
    if (parent && parent.type === 'MemberExpression' && key === 'property' && !parent.computed) return;
    if (parent && (parent.type === 'Property' || parent.type === 'PropertyDefinition') && key === 'key' && !parent.computed) return;
    if (parent && parent.type === 'VariableDeclarator' && key === 'id') return;
    if (parent && (parent.type === 'FunctionDeclaration' || parent.type === 'FunctionExpression' || parent.type === 'ArrowFunctionExpression' || parent.type === 'ClassDeclaration') && key === 'id') return;
    if (n.name === 'arguments') return;
    if (declared.has(n.name) || globals.has(n.name)) return;
    if (!free.has(n.name)) free.set(n.name, []);
    free.get(n.name).push(n.start);
  });
}
console.log('picked statements', picked.length, 'declared', declared.size);
for (const [name, at] of [...free].sort()) console.log(name.padEnd(8), 'refs', at.length);
console.log('--- declared names:', [...declared].sort().join(' '));
