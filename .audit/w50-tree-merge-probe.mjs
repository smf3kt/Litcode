// Can the two source trees be unified into one? The 2.1.88 dump carries the original file paths and
// identifiers but is incomplete; `recovered/` carries the 2.1.296 code but only chunk names. They
// share no path names, so the only honest key is the module surface — the names an import site asks
// for. This measures how well that key works, per dump module, before anything is assembled.
//
//   node .audit/w50-tree-merge-probe.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const HARNESS = '/Users/mant1ssa/Projects/cc-base-2188';
const RECOVERED = '/Users/mant1ssa/Projects/cc_reverse/recovered';
const ts = createRequire(import.meta.url)('/tmp/w47-tools/node_modules/typescript');

const walk = (dir, keep) => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'recovered', '.git', 'assets', 'public'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, keep));
    else if (keep(e.name)) out.push(p);
  }
  return out;
};

// Exported names of one module, plus whether it emits runtime code at all. A module whose only
// exports are types is erased from a bundle, which is why those are absent from `recovered/` too.
const surface = (file) => {
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const names = new Set();
  let runtime = false;
  let star = false;
  for (const node of sf.statements) {
    const mods = node.modifiers ?? [];
    const exported = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const isType = ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node);
    if (exported && ts.isVariableStatement(node)) {
      runtime = true;
      for (const d of node.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) names.add(d.name.text);
      }
    } else if (exported && (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node))) {
      runtime = true;
      if (node.name) names.add(node.name.text);
    } else if (exported && isType && node.name) {
      names.add(node.name.text);
    } else if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const el of node.exportClause.elements) {
          names.add(el.name.text);
          if (!node.isTypeOnly && !el.isTypeOnly) runtime = true;
        }
      } else if (!node.exportClause) {
        star = true;
        runtime = true;
      }
    } else if (ts.isExportAssignment(node)) {
      names.add('default');
      runtime = true;
    }
  }
  return { names, runtime, star };
};

const dumpFiles = walk(HARNESS, (n) => /\.tsx?$/.test(n) && !/\.w4[a-z0-9]*bak$/.test(n));
const recFiles = fs.readdirSync(RECOVERED).filter((n) => n.endsWith('.js')).map((n) => path.join(RECOVERED, n));

const dump = new Map();
for (const f of dumpFiles) {
  const s = surface(f);
  if (s.names.size || s.runtime) dump.set(path.relative(HARNESS, f), s);
}
const rec = new Map();
const byName = new Map();
for (const f of recFiles) {
  const s = surface(f);
  const base = path.basename(f);
  rec.set(base, s);
  for (const n of s.names) {
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push(base);
  }
}

// Rank candidates by how much of the dump module's surface they carry.
const rows = [];
for (const [rel, s] of dump) {
  const score = new Map();
  for (const n of s.names) {
    for (const c of byName.get(n) ?? []) score.set(c, (score.get(c) ?? 0) + 1);
  }
  const ranked = [...score].sort((a, b) => b[1] - a[1]).map(([c, hits]) => ({ chunk: c, hits, cover: hits / s.names.size }));
  rows.push({ rel, names: s.names.size, runtime: s.runtime, star: s.star, ranked });
}

const runtimeRows = rows.filter((r) => r.runtime && !r.star);
const typedRows = rows.filter((r) => !r.runtime);
const starRows = rows.filter((r) => r.star);

const tier = (r, t) => r.ranked.length > 0 && r.ranked[0].cover >= t;
const unique = (r, t) => tier(r, t) && (r.ranked.length === 1 || r.ranked[1].cover < t);

const report = [];
const pct = (n, d) => `${n} (${((n / d) * 100).toFixed(1)}%)`;
report.push(`dump modules parsed           ${rows.length}`);
report.push(`  emit runtime code           ${runtimeRows.length}`);
report.push(`  type-only (erased by bundle)${' '.repeat(3)}${typedRows.length}`);
report.push(`  carry "export *"            ${starRows.length}`);
report.push('');
report.push(`recovered modules             ${rec.size}`);
report.push(`distinct recovered names      ${byName.size}`);
report.push('');
report.push('runtime dump modules, best recovered candidate by surface coverage:');
for (const t of [1, 0.8, 0.6, 0.5, 0.4, 0.25]) {
  const any = runtimeRows.filter((r) => tier(r, t)).length;
  const uniq = runtimeRows.filter((r) => unique(r, t)).length;
  report.push(`  cover >= ${String(t).padEnd(5)} ${String(any).padStart(5)} have a candidate   ${String(uniq).padStart(5)} unique best`);
}

const dist = { 1: 0, '0.8+': 0, '0.6+': 0, '0.4+': 0, '0.25+': 0, '<0.25': 0, none: 0 };
for (const r of runtimeRows) {
  if (r.names === 0) { dist.none++; continue; }
  const c = r.ranked[0]?.cover ?? 0;
  if (c >= 1) dist[1]++;
  else if (c >= 0.8) dist['0.8+']++;
  else if (c >= 0.6) dist['0.6+']++;
  else if (c >= 0.4) dist['0.4+']++;
  else if (c >= 0.25) dist['0.25+']++;
  else dist['<0.25']++;
}
report.push('');
report.push(`coverage of the best candidate: ${JSON.stringify(dist)}`);

const byDir = new Map();
for (const r of runtimeRows) {
  const d = r.rel.includes('/') ? r.rel.slice(0, r.rel.indexOf('/')) : '(root)';
  if (!byDir.has(d)) byDir.set(d, []);
  byDir.get(d).push(r);
}
report.push('');
report.push('by top-level directory (runtime modules; matched = unique best at cover >= 0.6):');
for (const [d, list] of [...byDir].sort((a, b) => b[1].length - a[1].length).slice(0, 20)) {
  const m = list.filter((r) => unique(r, 0.6)).length;
  report.push(`  ${d.padEnd(22)} ${String(list.length).padStart(4)}  matched ${String(m).padStart(4)}  ${pct(m, list.length)}`);
}

const total = runtimeRows.length;
const matched = runtimeRows.filter((r) => unique(r, 0.6)).length;
report.push('');
report.push(`MATCHED ${matched} / ${total} runtime dump modules (${((matched / total) * 100).toFixed(1)}%) at unique-best cover >= 0.6`);

console.log(report.join('\n'));
fs.mkdirSync(path.dirname('/Users/mant1ssa/Projects/cc_reverse/.audit/w50-tree-merge.json'), { recursive: true });
fs.writeFileSync('/Users/mant1ssa/Projects/cc_reverse/.audit/w50-tree-merge.json', JSON.stringify({
  totals: { dumpModules: rows.length, runtime: runtimeRows.length, typeOnly: typedRows.length, star: starRows.length, recovered: rec.size, matched },
  rows: rows.map((r) => ({ rel: r.rel, names: r.names, runtime: r.runtime, star: r.star, best: r.ranked.slice(0, 3) })),
}, null, 1) + '\n');
