// Stubs to fill: which of a stub's names does the recovered tree actually export, and is the name a
// value or a type? A decompiled JS chunk can supply a value binding; it can never supply a type
// declaration, so a type-only stub is not fillable from `recovered/` at all and has to be settled a
// different way.
//
//   node .audit/w48-stub-matrix.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const HARNESS = '/tmp/cc-2188-src';
const RECOVERED = '/Users/mant1ssa/Projects/cc_reverse/recovered';
const CACHE = '.audit/w48-recovered-exports.json';
const ts = createRequire(import.meta.url)('/tmp/w47-tools/node_modules/typescript');

let index;
if (fs.existsSync(CACHE)) {
  index = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
} else {
  index = {};
  for (const f of fs.readdirSync(RECOVERED).filter((x) => x.endsWith('.js'))) {
    const text = fs.readFileSync(path.join(RECOVERED, f), 'utf8');
    const source = ts.createSourceFile(f, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
    const names = new Set();
    const visit = (node) => {
      const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : [];
      const exported = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (exported && node.name && ts.isIdentifier(node.name)) names.add(node.name.text);
      // `export { a as b }` re-exports carry the public name in `name`.
      if (ts.isExportSpecifier(node) && node.name && ts.isIdentifier(node.name)) names.add(node.name.text);
      ts.forEachChild(node, visit);
    };
    visit(source);
    index[f] = [...names];
  }
  fs.writeFileSync(CACHE, JSON.stringify(index));
  console.log(`built index over ${Object.keys(index).length} chunks`);
}

// name -> chunks exporting it
const byName = new Map();
for (const [f, names] of Object.entries(index)) {
  for (const n of names) {
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push(f);
  }
}

const stubs = JSON.parse(fs.readFileSync('.audit/w48-stubs.json', 'utf8'));
const rows = [];
for (const s of stubs) {
  const full = path.join(HARNESS, s.file);
  const text = fs.readFileSync(full, 'utf8');
  const kinds = new Map();
  for (const m of text.matchAll(/^export (?:declare )?(const|let|function|class|type|interface|enum)\s+(\w+)/gm)) {
    kinds.set(m[2], ['type', 'interface', 'enum'].includes(m[1]) && m[1] !== 'enum' ? 'type' : 'value');
  }
  for (const m of text.matchAll(/^export \{\s*([^}]+)\}/gm)) {
    for (const raw of m[1].split(',')) {
      const n = raw.trim().split(/\s+as\s+/).pop().trim();
      if (n) kinds.set(n, kinds.get(n) ?? 'value');
    }
  }
  const names = s.names.filter((n) => kinds.has(n) || true);
  const found = [];
  for (const n of names) {
    const chunks = byName.get(n);
    if (chunks) found.push({ name: n, kind: kinds.get(n) ?? '?', chunks: chunks.length, first: chunks[0] });
  }
  // Score: which single chunk carries the most of these names.
  const tally = new Map();
  for (const f of found) for (const c of byName.get(f.name)) tally.set(c, (tally.get(c) ?? 0) + 1);
  const best = [...tally].sort((a, b) => b[1] - a[1])[0];
  rows.push({
    file: s.file,
    names: names.length,
    values: names.filter((n) => kinds.get(n) === 'value').length,
    types: names.filter((n) => kinds.get(n) === 'type').length,
    inRecovered: found.length,
    bestChunk: best ? best[0] : null,
    bestScore: best ? best[1] : 0,
    detail: found.map((f) => `${f.name}(${f.kind})->${f.chunks}`),
  });
}

const fillable = rows.filter((r) => r.bestScore > 0);
console.log(`stubs ${rows.length} | names found in recovered: ${rows.filter((r) => r.inRecovered > 0).length} files`);
console.log(`value names total ${rows.reduce((n, r) => n + r.values, 0)} | type names total ${rows.reduce((n, r) => n + r.types, 0)}`);
console.log('');
for (const r of rows.sort((a, b) => b.bestScore - a.bestScore)) {
  console.log(`${r.file}  names ${r.names} (v${r.values}/t${r.types})  inRecovered ${r.inRecovered}  best ${r.bestScore} ${r.bestChunk ?? ''}`);
  if (r.detail.length) console.log(`     ${r.detail.join(' ')}`);
}
fs.writeFileSync('.audit/w48-stub-matrix.json', JSON.stringify({ rows }, null, 1) + '\n');
