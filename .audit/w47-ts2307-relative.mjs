// 135 TS2307s left: 75 vendor packages, 58 relative files, 2 alias paths. The packages are an
// environment gap; the relative ones are the same question W47 asked (does the feature survive in
// 2.1.296?) for specifiers the earlier gap scan never listed. Resolve each to a target and look it up.
import fs from 'node:fs';
import path from 'node:path';

const HARNESS = '/tmp/cc-2188-src';
const RECOVERED = '/Users/mant1ssa/Projects/cc_reverse/recovered';
const rows = JSON.parse(fs.readFileSync('.audit/w47-ts2307.json', 'utf8')).rows;

let classification = { rows: [] };
try { classification = JSON.parse(fs.readFileSync('.audit/w47-gap-classification.json', 'utf8')); } catch {}
const verdictOf = new Map(classification.rows.map((r) => [r.module, r]));

// Every named export of every recovered chunk, so a candidate can be scored by name match.
const exportIndex = new Map();
const chunkFiles = fs.existsSync(RECOVERED) ? fs.readdirSync(RECOVERED).filter((f) => f.endsWith('.js')) : [];

const rel = rows.filter((r) => r.spec.startsWith('.'));
const groups = new Map();
for (const r of rel) {
  const target = path.relative(HARNESS, path.resolve(HARNESS, path.dirname(r.file), r.spec));
  if (!groups.has(target)) groups.set(target, []);
  groups.get(target).push(r);
}

const out = [];
for (const [target, sites] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
  const key = target.replace(/\.js$/, '.ts');
  const v = verdictOf.get(key) ?? verdictOf.get(target);
  // Does any recovered chunk export a name that appears in these sites? Cheap signal: the module's
  // basename as an exported identifier, which is how W47 matched.
  const base = path.basename(target, '.js');
  let chunkHits = 0;
  for (const c of chunkFiles) {
    const text = fs.readFileSync(path.join(RECOVERED, c), 'utf8');
    if (text.includes(base)) chunkHits += 1;
  }
  out.push({ target, sites: sites.length, verdict: v?.verdict ?? 'unclassified', chunk: v?.sourceChunk ?? null, baseHits: chunkHits });
}

console.log(`${out.length} distinct relative targets for ${rel.length} sites`);
const byVerdict = {};
for (const r of out) byVerdict[r.verdict] = (byVerdict[r.verdict] ?? 0) + 1;
console.log('by verdict:', JSON.stringify(byVerdict));
console.log('');
for (const r of out) {
  console.log(`${String(r.sites).padStart(2)}x [${r.verdict}${r.chunk ? ' ' + r.chunk : ''}] baseHits ${r.baseHits}  ${r.target}`);
}
fs.writeFileSync('.audit/w47-ts2307-relative.json', JSON.stringify({ out }, null, 1) + '\n');
