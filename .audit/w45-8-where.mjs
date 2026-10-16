// Which function contains an offset, and where is a name used inside it.
import fs from 'node:fs';
import * as acorn from 'acorn';

const [file, offsetText, name] = process.argv.slice(2);
const offset = Number(offsetText);
const t = fs.readFileSync(`extracted-v2/modules/${file}`, 'utf8');
const ast = acorn.parse(t, {ecmaVersion: 'latest', sourceType: 'module'});

let best = null;
const walk = (node) => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const child of node) walk(child); return; }
  if (typeof node.type === 'string' && typeof node.start === 'number' && node.start <= offset && offset < node.end) {
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      if (best === null || node.end - node.start < best.end - best.start) best = node;
    }
  }
  for (const key of Object.keys(node)) if (key !== 'type' && key !== 'start' && key !== 'end') walk(node[key]);
};
walk(ast);
if (best === null) { console.log('no enclosing function'); process.exit(1); }
const body = t.slice(best.start, best.end);
console.log(`enclosing ${best.type} [${best.start},${best.end}) units ${best.end - best.start}`);
if (name !== undefined) {
  const re = new RegExp(`[^A-Za-z0-9_$.]${name.replace(/\$/g, '\\$')}[^A-Za-z0-9_$]`, 'g');
  let m, hits = [];
  while ((m = re.exec(body)) && hits.length < 20) hits.push(best.start + m.index);
  console.log(`${name} uses:`, hits.join(',') || 'none');
  for (const h of hits.slice(0, 8)) console.log('  ', h, JSON.stringify(t.slice(h - 150, h + 150)));
}
