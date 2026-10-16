// Attribute every name the streaming copy still references: find its declaring module through the
// using module's own import map, take that declaration's body, and test whether the product already
// carries that exact body. Prints the three outcomes (importable, needs an export, genuinely new).
import fs from 'node:fs';
import * as acorn from 'acorn';

const usingModule = 'chunk-nyce03br.js';
const root = 'extracted-v2/modules/';
const names = process.argv.slice(2);

const read = (f) => fs.readFileSync(root + f, 'utf8');
// The using module's own import map: the only trustworthy source of a short name (Q-089).
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
const exportsOf = (file) => {
  const t = product.find(([f]) => f === file)?.[1] ?? '';
  const out = new Set();
  for (const m of t.matchAll(/export \{([^}]*)\}/g)) {
    for (const raw of m[1].split(',')) out.add(raw.trim().split(/\s+as\s+/).pop());
  }
  return out;
};
const product = fs.readdirSync('src').filter((f) => f.endsWith('.ts')).map((f) => [f, fs.readFileSync('src/' + f, 'utf8')]);

// A name the using module does not import is declared inside the bundle itself; the copied range is
// a window into that module, so its declaration may sit outside it and have to come along.
const localModules = ['chunk-nyce03br.js', 'chunk-2kdsvp3x.js'];
const map = importsOf(read(usingModule));
const rows = [];
for (const name of names) {
  const from = map.get(name) ?? localModules.find((f) => declsOf(f).has(name));
  if (!from) { rows.push([name, 'not imported and not declared in ' + localModules.join('/'), '', '', '']); continue; }
  const decl = declsOf(from).get(name);
  if (!decl) { rows.push([name, from, 'no declaration found', '', '']); continue; }
  const body = decl[2].slice(decl[0], decl[1]);
  const carrier = product.find(([, t]) => t.includes(body));
  // `carried` is a text match, so it survives the bundle's repeated names; `exported` must be read on
  // that same carrier file, or a same-named export elsewhere reads as importable (the Q-089 trap).
  rows.push([name, from, carrier ? `${carrier[0]}${exportsOf(carrier[0]).has(name) ? '' : ' (no export)'}` : 'NEW', String(decl[1] - decl[0])]);
}
for (const r of rows) process.stdout.write(r.join('\t') + '\n');
