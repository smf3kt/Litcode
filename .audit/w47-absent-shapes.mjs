// How are the 46 absent modules reached? A static import needs the module's names, a gated require
// needs the module gone at run time, a typeof import needs only a type. The shape decides whether a
// reference site can be deleted mechanically.
import fs from 'node:fs';
import path from 'node:path';

const HARNESS = '/tmp/cc-2188-src';
const classification = JSON.parse(fs.readFileSync('.audit/w47-gap-classification.json', 'utf8'));
const fills = JSON.parse(fs.readFileSync('.audit/w47-fills.json', 'utf8'));
const record = new Map(fills.results.map((r) => [r.relative, r]));
const ported = new Set(['tools/WorkflowTool/createWorkflowCommand.ts', 'services/skillSearch/prefetch.ts']);

const absent = classification.rows.filter((r) => r.verdict === 'absent' && !ported.has(r.module));
const totals = { staticImport: 0, gatedRequire: 0, dynamicImport: 0, typeofImport: 0, other: 0 };
const perModule = [];

for (const gap of absent) {
  const entry = record.get(gap.module);
  if (entry === undefined) continue;
  const shape = { staticImport: 0, gatedRequire: 0, dynamicImport: 0, typeofImport: 0, other: 0 };
  // A target is reached by more than one relative spelling (`./x.js` from its own directory,
  // `../dir/x.js` from a sibling), and the record keeps only the first, so match on the basename.
  const stem = path.basename(entry.specifier ?? gap.module).replace(/\.js$/, '');
  for (const importer of entry.importersList) {
    const text = fs.readFileSync(path.join(HARNESS, importer), 'utf8');
    const sites = [];
    for (const quote of ["'", '"']) {
      const needle = `${stem}.js${quote}`;
      let at = text.indexOf(needle);
      while (at >= 0) { sites.push(at - `${stem}.js`.length + `${stem}.js`.length); at = text.indexOf(needle, at + 1); }
    }
    for (const at of sites) {
      const before = text.slice(Math.max(0, at - 200), at);
      if (/typeof\s+import\s*\(\s*$/.test(before)) shape.typeofImport += 1;
      else if (/import\s*\(\s*$/.test(before)) shape.dynamicImport += 1;
      else if (/require\s*\(\s*$/.test(before)) shape.gatedRequire += 1;
      else if (/(?:^|[\n;}])\s*import\b/.test(before)) shape.staticImport += 1;
      else shape.other += 1;
    }
  }
  for (const key of Object.keys(totals)) totals[key] += shape[key];
  perModule.push({ module: gap.module, specifier: gap.specifier, importers: entry.importersList.length, ...shape });
}

const gatedOnly = perModule.filter((m) => m.gatedRequire > 0 && m.staticImport === 0 && m.typeofImport === 0 && m.dynamicImport === 0).length;
const staticOnly = perModule.filter((m) => m.staticImport > 0 && m.gatedRequire === 0 && m.typeofImport === 0).length;
console.log(`absent modules ${absent.length}`);
console.log('reference shapes:', JSON.stringify(totals));
console.log(`modules reached only by gated require: ${gatedOnly} | only by static import: ${staticOnly}`);
console.log('\nper module (gate/static/typeof/dyn/other):');
for (const m of perModule.sort((a, b) => (b.gatedRequire + b.staticImport) - (a.gatedRequire + a.staticImport))) {
  console.log(`  g${String(m.gatedRequire).padStart(2)} s${String(m.staticImport).padStart(2)} t${String(m.typeofImport).padStart(2)} d${m.dynamicImport} o${m.other}  ${m.module}`);
}
fs.writeFileSync('.audit/w47-absent-shapes.json', JSON.stringify({ totals, gatedOnly, staticOnly, perModule }, null, 1) + '\n');
