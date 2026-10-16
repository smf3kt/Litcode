// Can a stub's shape be recovered? A decompiled chunk can supply the runtime surface a type was
// derived from — zod schemas, discriminator literals, enum values — and that surface is in the
// bundle even though the declaration is not. This maps each stub name to the literals it would carry
// and asks whether any recovered chunk has them.
//
//   node .audit/w48-literal-probe.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const RECOVERED = '/Users/mant1ssa/Projects/cc_reverse/recovered';
const CACHE = '.audit/w48-recovered-literals.json';
const ts = createRequire(import.meta.url)('/tmp/w47-tools/node_modules/typescript');

let literalToChunks;
if (fs.existsSync(CACHE)) {
  literalToChunks = new Map(Object.entries(JSON.parse(fs.readFileSync(CACHE, 'utf8'))));
} else {
  literalToChunks = new Map();
  for (const f of fs.readdirSync(RECOVERED).filter((x) => x.endsWith('.js'))) {
    const text = fs.readFileSync(path.join(RECOVERED, f), 'utf8');
    const source = ts.createSourceFile(f, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
    const visit = (node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        const v = node.text;
        if (v.length >= 3 && v.length <= 60 && /^[a-z0-9_.:-]+$/i.test(v)) {
          if (!literalToChunks.has(v)) literalToChunks.set(v, []);
          const list = literalToChunks.get(v);
          if (list.length < 6 && !list.includes(f)) list.push(f);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  fs.writeFileSync(CACHE, JSON.stringify(Object.fromEntries(literalToChunks)));
  console.log(`indexed ${literalToChunks.size} distinct literals`);
}

const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[-\s]+/g, '_').toLowerCase();
const PREFIXES = ['system', 'sdk', 'lsp', 'mcp', 'oauth', 'user', 'assistant', 'attachment', 'progress', 'normalized', 'is', 'get', 'create', 'claude', 'ai', 'http', 'sse', 'stdio', 'agent'];
const SUFFIXES = ['message', 'type', 'config', 'state', 'data', 'info', 'response', 'request', 'options', 'result', 'event', 'props', 'context', 'block', 'delta', 'shape', 'item', 'input', 'output', 'manager', 'session', 'task', 'signal', 'value'];

const stubs = JSON.parse(fs.readFileSync('.audit/w48-stubs.json', 'utf8'));
const rows = [];
for (const s of stubs) {
  const hits = [];
  for (const name of s.names) {
    const base = snake(name);
    const cands = new Set([base]);
    // `SystemMicrocompactBoundaryMessage` -> `microcompact_boundary`: the discriminator is the name
    // with its role words removed, which is how the message types name their `type` literal.
    let stripped = base;
    for (const p of PREFIXES) if (stripped.startsWith(`${p}_`)) stripped = stripped.slice(p.length + 1);
    for (const suf of SUFFIXES) if (stripped.endsWith(`_${suf}`)) stripped = stripped.slice(0, -suf.length - 1);
    if (stripped.length >= 3) cands.add(stripped);
    for (const c of cands) {
      const chunks = literalToChunks.get(c);
      if (chunks) hits.push({ name, literal: c, chunks: chunks.length, first: chunks[0] });
    }
  }
  rows.push({ file: s.file, names: s.names.length, hits });
}

console.log(`\nstubs with at least one literal present in recovered: ${rows.filter((r) => r.hits.length > 0).length} / ${rows.length}`);
for (const r of rows.sort((a, b) => b.hits.length - a.hits.length)) {
  if (r.hits.length === 0) continue;
  console.log(`\n${r.file}  (${r.hits.length}/${r.names} names)`);
  for (const h of r.hits) console.log(`   ${h.name} -> "${h.literal}"  in ${h.chunks} chunks  e.g. ${h.first}`);
}
console.log('\nno literal found:');
for (const r of rows.filter((x) => x.hits.length === 0)) console.log(`   ${r.file}  (${r.names} names)`);
fs.writeFileSync('.audit/w48-literal-probe.json', JSON.stringify({ rows }, null, 1) + '\n');
