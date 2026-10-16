// W45-24 attribution: for each name the ui.* floor slice references, find its declaring module through
// chunk-sfn1dbxq.js's own import map, take that declaration's body, and test whether the product
// already carries that exact body (Q-089: a text match, not a name match).
import fs from 'node:fs';
import * as acorn from 'acorn';

const usingModule = process.env.USING ?? 'chunk-sfn1dbxq.js';
const root = 'extracted-v2/modules/';
const names = process.argv.slice(2);

const read = (f) => fs.readFileSync(root + f, 'utf8');
const importsOf = (text) => {
  const map = new Map();
  for (const m of text.matchAll(/import\{([^}]*)\}from"([^"]+)"/g)) {
    for (const raw of m[1].split(',')) {
      const alias = raw.trim().split(/\s+as\s+/);
      const local = alias.pop();
      if (local) map.set(local, m[2].replace('/$bunfs/root/', ''));
    }
  }
  return map;
};
const declsOf = (file) => {
  if (!declsOf.cache) declsOf.cache = new Map();
  if (!declsOf.cache.has(file)) {
    const text = read(file);
    const map = new Map();
    try {
      const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
      const record = (node, start, end) => {
        if (node.type === 'FunctionDeclaration' && node.id) map.set(node.id.name, [start, end, text]);
        if (node.type === 'VariableDeclaration') for (const d of node.declarations) if (d.id?.name) map.set(d.id.name, [start, end, text]);
      };
      for (const node of ast.body) record(node, node.start, node.end);
    } catch { /* not JS */ }
    declsOf.cache.set(file, map);
  }
  return declsOf.cache.get(file);
};
const product = fs.readdirSync('src').filter((f) => f.endsWith('.ts')).map((f) => [f, fs.readFileSync('src/' + f, 'utf8')]);
const exportsOf = (file) => {
  const t = product.find(([f]) => f === file)?.[1] ?? '';
  const out = new Set();
  for (const m of t.matchAll(/export \{([^}]*)\}/g)) {
    for (const raw of m[1].split(',')) out.add(raw.trim().split(/\s+as\s+/).pop());
  }
  return out;
};

const localModules = [usingModule];
const map = importsOf(read(usingModule));
for (const name of names) {
  const from = map.get(name) ?? localModules.find((f) => declsOf(f).has(name));
  if (!from) { console.log([name, 'not imported, not declared here', '', ''].join('\t')); continue; }
  const decl = declsOf(from).get(name);
  if (!decl) { console.log([name, from, 'no declaration found', ''].join('\t')); continue; }
  const body = decl[2].slice(decl[0], decl[1]);
  const carrier = product.find(([, t]) => t.includes(body));
  console.log([
    name,
    from,
    carrier ? `${carrier[0]}${exportsOf(carrier[0]).has(name) ? '' : ' (no export)'}` : 'NEW',
    String(decl[1] - decl[0]),
    String(decl[0]),
    String(decl[1]),
  ].join('\t'));
}
