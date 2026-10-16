// The 58 relative TS2307 sites, removed with the pass-1 machinery: a target set resolved from the
// error list itself, then the smallest unit per shape. Same rule as W47c — match the resolved path,
// never the basename.
//
//   node .audit/w47-strip-ts2307.mjs [--apply] [--restore]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const HARNESS = '/Users/mant1ssa/Projects/cc-base-2188';
const ts = createRequire(import.meta.url)('/tmp/w47-tools/node_modules/typescript');
const APPLY = process.argv.includes('--apply');

const rows = JSON.parse(fs.readFileSync('.audit/w47-ts2307.json', 'utf8')).rows;
// The two `src/cli/*` specifiers are ant-gated command registrations, not module gaps; their sites
// go with the gate, so they are excluded here and handled as guard blocks.
const targets = new Map();
const files = new Set();
for (const r of rows) {
  if (!r.spec.startsWith('.')) continue;
  const resolved = path.resolve(HARNESS, path.dirname(r.file), r.spec).replace(/\.js$/, '');
  targets.set(resolved, r.spec);
  files.add(r.file);
}

const scriptKind = (file) => (file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const edits = [];
const report = [];

for (const file of [...files].sort()) {
  const full = path.join(HARNESS, file);
  const text = fs.readFileSync(full, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, scriptKind(file));
  const local = [];

  const target = (node) => {
    if (!ts.isStringLiteral(node) || !node.text.startsWith('.')) return null;
    const resolved = path.resolve(path.dirname(full), node.text).replace(/\.js$/, '');
    return targets.has(resolved) ? resolved : null;
  };

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      const t = target(node.moduleSpecifier);
      if (t !== null) {
        const start = text.lastIndexOf('\n', node.getStart(source)) + 1;
        const end = node.getEnd();
        local.push({ kind: 'import', target: t, start, end: text[end] === '\n' ? end + 1 : end });
        return;
      }
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const t = target(node.arguments[0]);
      if (t !== null) {
        let stmt = node;
        while (stmt.parent && !ts.isExpressionStatement(stmt)) stmt = stmt.parent;
        if (ts.isExpressionStatement(stmt)) {
          const start = text.lastIndexOf('\n', stmt.getStart(source)) + 1;
          const end = stmt.getEnd();
          local.push({ kind: 'dynamic-import', target: t, start, end: text[end] === '\n' ? end + 1 : end });
          return;
        }
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
      const t = target(node.arguments[0]);
      if (t !== null) {
        let value = node;
        while (value.parent && (ts.isParenthesizedExpression(value.parent) || ts.isAsExpression(value.parent) || ts.isNonNullExpression(value.parent))) value = value.parent;
        const parent = value.parent;
        if (parent && (ts.isSpreadElement(parent) || (ts.isPropertyAssignment(parent) && parent.initializer === value))) {
          let start = parent.getStart(source);
          let end = parent.getEnd();
          const after = text.slice(end).match(/^\s*,/);
          const before = text.slice(0, start).match(/,\s*$/);
          if (after) end += after[0].length;
          else if (before) start -= before[0].length;
          local.push({ kind: ts.isSpreadElement(parent) ? 'spread' : 'property', target: t, start, end });
        } else {
          local.push({ kind: 'gated-require', target: t, start: value.getStart(source), end: value.getEnd(), to: 'null' });
        }
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  if (local.length === 0) continue;
  const accepted = [];
  for (const edit of [...local].sort((a, b) => a.start - b.start || b.end - a.end)) {
    if (accepted.some((e) => edit.start < e.end && e.start < edit.end)) continue;
    accepted.push(edit);
  }
  accepted.sort((a, b) => b.start - a.start);
  let updated = text;
  for (const edit of accepted) updated = updated.slice(0, edit.start) + (edit.to ?? '') + updated.slice(edit.end);

  const check = ts.createSourceFile(file, updated, ts.ScriptTarget.ES2022, true, scriptKind(file));
  if ((check.parseDiagnostics ?? []).length > 0) {
    console.log(`  SKIP ${file}: ${check.parseDiagnostics.length} parse errors after the edit`);
    continue;
  }
  edits.push({ file, full, text, updated, count: accepted.length, sites: accepted.map((e) => ({ kind: e.kind, target: targets.get(e.target) })) });
  report.push({ file, sites: accepted.map((e) => ({ kind: e.kind, target: targets.get(e.target) })) });
}

const byKind = {};
for (const r of report) for (const s of r.sites) byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
const touched = new Set(report.flatMap((r) => r.sites.map((s) => s.target)));
console.log(`targets ${targets.size} | files ${files.size} | files edited ${edits.length} | sites ${report.reduce((n, r) => n + r.sites.length, 0)}`);
console.log('by kind:', JSON.stringify(byKind), `| targets with a site deleted: ${touched.size}`);

if (process.argv.includes('--restore')) {
  let n = 0;
  for (const file of files) {
    const full = path.join(HARNESS, file);
    if (fs.existsSync(full + '.w47x1bak')) { fs.writeFileSync(full, fs.readFileSync(full + '.w47x1bak')); n += 1; }
  }
  console.log(`restored ${n} files`);
} else if (APPLY) {
  for (const e of edits) {
    if (!fs.existsSync(e.full + '.w47x1bak')) fs.writeFileSync(e.full + '.w47x1bak', e.text);
    fs.writeFileSync(e.full, e.updated);
  }
  fs.writeFileSync('.audit/w47-strip-ts2307.json', JSON.stringify({ byKind, report, untouched: [...targets.values()].filter((s) => !touched.has(s)) }, null, 1) + '\n');
  console.log(`applied to ${edits.length} files`);
} else {
  for (const r of report.slice(0, 20)) console.log(`  ${r.file}: ${r.sites.map((s) => s.kind + ' ' + s.target).join(', ')}`);
}
