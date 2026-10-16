// After the two deletion passes: which of the 46 absent modules still have a live reference in the
// tree, and what shape is it? Pass 1 handled imports and gated requires, pass 2 followed the
// compiler's error list to the usage sites. Anything left is a shape neither could remove.
import fs from 'node:fs';
import path from 'node:path';

const HARNESS = '/tmp/cc-2188-src';
const classification = JSON.parse(fs.readFileSync('.audit/w47-gap-classification.json', 'utf8'));
const fills = JSON.parse(fs.readFileSync('.audit/w47-fills.json', 'utf8'));
const record = new Map(fills.results.map((r) => [r.relative, r]));
const ported = new Set(['tools/WorkflowTool/createWorkflowCommand.ts', 'services/skillSearch/prefetch.ts']);
const absent = classification.rows.filter((r) => r.verdict === 'absent' && !ported.has(r.module));

const strip = JSON.parse(fs.readFileSync('.audit/w47-strip-absent.json', 'utf8'));
const deleted = new Map();
for (const r of strip.report) for (const s of r.sites) deleted.set(s.module, (deleted.get(s.module) ?? 0) + 1);

// Every .ts/.tsx under the harness, minus the recovered tree and the tool's own backups.
const walk = (dir) => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'recovered' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.w47bak') && !e.name.endsWith('.w47p2bak')) out.push(p);
  }
  return out;
};
const files = walk(HARNESS);
const texts = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));

const rows = [];
for (const gap of absent) {
  const entry = record.get(gap.module);
  if (entry === undefined) continue;
  // Match the specifier text, not the basename alone: `index.js` from four modules would collide.
  const spec = entry.specifier ?? './' + path.basename(gap.module);
  const stem = spec.replace(/\.js$/, '');
  const hits = [];
  for (const [file, text] of texts) {
    for (const quote of ["'", '"']) {
      const needle = `${stem}.js${quote}`;
      let at = text.indexOf(needle);
      while (at >= 0) {
        const before = text.slice(Math.max(0, at - 120), at);
        const line = text.slice(0, at).split('\n').length;
        const shape = /typeof\s+import\s*\(\s*$/.test(before) ? 'typeof'
          : /import\s*\(\s*$/.test(before) ? 'dynamic'
          : /require\s*\(\s*$/.test(before) ? 'require'
          : /from\s*$/.test(before) ? 'import'
          : 'other';
        hits.push({ file: path.relative(HARNESS, file), line, shape });
        at = text.indexOf(needle, at + 1);
      }
    }
  }
  rows.push({ module: gap.module, deleted: deleted.get(gap.module) ?? 0, residual: hits.length, hits });
}

const withResidual = rows.filter((r) => r.residual > 0);
console.log(`absent modules ${rows.length} | deleted at least one site: ${rows.filter((r) => r.deleted > 0).length} | still referenced: ${withResidual.length}`);
const byShape = {};
for (const r of withResidual) for (const h of r.hits) byShape[h.shape] = (byShape[h.shape] ?? 0) + 1;
console.log('residual shapes:', JSON.stringify(byShape));
console.log('');
for (const r of withResidual.sort((a, b) => b.residual - a.residual)) {
  console.log(`${r.module}  (deleted ${r.deleted}, residual ${r.residual})`);
  for (const h of r.hits.slice(0, 6)) console.log(`    ${h.shape.padEnd(8)} ${h.file}:${h.line}`);
  if (r.hits.length > 6) console.log(`    ... ${r.hits.length - 6} more`);
}
fs.writeFileSync('.audit/w47-residual.json', JSON.stringify({ rows }, null, 1) + '\n');
