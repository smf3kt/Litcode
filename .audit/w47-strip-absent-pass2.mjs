// Second pass: the first pass removed the modules, and what is left is code that used them — a
// property read on what is now `null`, a named import the compiler can no longer find, a dynamic
// import nested in an object literal. Each error position names the smallest statement that has to
// go, so this pass is driven by the compiler's own list rather than by pattern guessing.
//
//   node .audit/w47-strip-absent-pass2.mjs --tsc /tmp/w47-strip2.txt [--apply]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const HARNESS = '/Users/mant1ssa/Projects/cc-base-2188';
const ts = createRequire(import.meta.url)('/tmp/w47-tools/node_modules/typescript');
const APPLY = process.argv.includes('--apply');
const LOG = process.argv[process.argv.indexOf('--tsc') + 1] ?? '/tmp/w47-strip2.txt';

const classification = JSON.parse(fs.readFileSync('.audit/w47-gap-classification.json', 'utf8'));
const fills = JSON.parse(fs.readFileSync('.audit/w47-fills.json', 'utf8'));
const record = new Map(fills.results.map((r) => [r.relative, r]));
const ported = new Set(['tools/WorkflowTool/createWorkflowCommand.ts', 'services/skillSearch/prefetch.ts']);
const absent = classification.rows.filter((r) => r.verdict === 'absent' && !ported.has(r.module));
const targets = new Set(absent.map((g) => path.resolve(HARNESS, g.module).replace(/\.tsx?$/, '')));

const wanted = [];
for (const line of fs.readFileSync(LOG, 'utf8').split('\n')) {
  const m = line.match(/^([^\s(]+)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
  if (!m) continue;
  const [, file, lineNo, col, code, message] = m;
  const spec = message.match(/Cannot find module '([^']+)'/);
  if (code === 'TS2307' && spec && spec[1].startsWith('.')) {
    const resolved = path.resolve(HARNESS, path.dirname(file), spec[1]).replace(/\.js$/, '');
    if (targets.has(resolved)) wanted.push({ file, line: Number(lineNo), col: Number(col), reason: 'missing-module' });
  } else if (code === 'TS2339' && /does not exist on type 'null'/.test(message)) {
    wanted.push({ file, line: Number(lineNo), col: Number(col), reason: 'on-null' });
  }
}

const byFile = new Map();
for (const w of wanted) {
  if (!byFile.has(w.file)) byFile.set(w.file, []);
  byFile.get(w.file).push(w);
}

const deletable = (node, ts_) => node !== undefined && (ts_.isSpreadElement(node) || ts_.isPropertyAssignment(node) || ts_.isIfStatement(node) ||
  ts_.isExpressionStatement(node) || ts_.isVariableStatement(node) || ts_.isReturnStatement(node) ||
  ts_.isElementAccessExpression(node) || ts_.isCallExpression(node) || ts_.isArrayLiteralExpression(node));

const edits = [];
const report = [];
for (const [file, sites] of byFile) {
  const full = path.join(HARNESS, file);
  const text = fs.readFileSync(full, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lineStarts = text.split('\n').reduce((acc, l, i) => (acc.push((acc[i] ?? 0) + l.length + 1), acc), [0]);

  const local = [];
  for (const site of sites) {
    const pos = (lineStarts[site.line - 1] ?? 0) + site.col - 1;
    let node = null;
    const find = (n) => {
      if (pos < n.getStart(source) || pos > n.getEnd()) return;
      node = n;
      ts.forEachChild(n, find);
    };
    find(source);
    if (node === null) continue;
    let owner = node;
    while (owner.parent && !deletable(owner.parent, ts)) owner = owner.parent;
    if (!deletable(owner.parent, ts)) continue;
    const target = owner.parent;
    // Prefer the statement over the expression: a guarded branch is meant to go whole.
    const statement = ts.isIfStatement(target) || ts.isExpressionStatement(target) || ts.isVariableStatement(target) || ts.isReturnStatement(target);
    if (!statement && site.reason === 'on-null') continue;
    let start = target.getStart(source);
    let end = target.getEnd();
    if (ts.isSpreadElement(target) || ts.isPropertyAssignment(target)) {
      const after = text.slice(end).match(/^\s*,/);
      const before = text.slice(0, start).match(/,\s*$/);
      if (after) end += after[0].length;
      else if (before) start -= before[0].length;
    } else {
      start = text.lastIndexOf('\n', start) + 1;
      if (text[end] === '\n') end += 1;
    }
    local.push({ reason: site.reason, start, end, snippet: text.slice(target.getStart(source), Math.min(target.getEnd(), target.getStart(source) + 60)).replace(/\n/g, ' ') });
  }

  const accepted = [];
  for (const edit of [...local].sort((a, b) => a.start - b.start || b.end - a.end)) {
    if (accepted.some((e) => edit.start < e.end && e.start < edit.end)) continue;
    accepted.push(edit);
  }
  if (accepted.length === 0) continue;
  accepted.sort((a, b) => b.start - a.start);
  let updated = text;
  for (const edit of accepted) updated = updated.slice(0, edit.start) + updated.slice(edit.end);
  edits.push({ file, full, text, updated, count: accepted.length });
  report.push({ file, edits: accepted.map((e) => ({ reason: e.reason, snippet: e.snippet })) });

  // A parse check before anything is written: a bad splice is a broken tree.
  const check = ts.createSourceFile(file, updated, ts.ScriptTarget.ES2022, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if ((check.parseDiagnostics ?? []).length > 0) {
    console.log(`  SKIP ${file}: ${check.parseDiagnostics.length} parse errors after the edit`);
    edits.pop(); report.pop();
  }
}

const total = edits.reduce((n, e) => n + e.count, 0);
console.log(`error sites ${wanted.length} | files ${byFile.size} | edits ${total} in ${edits.length} files`);
if (APPLY) {
  for (const e of edits) {
    if (!fs.existsSync(e.full + '.w47p2bak')) fs.writeFileSync(e.full + '.w47p2bak', e.text);
    fs.writeFileSync(e.full, e.updated);
  }
  fs.writeFileSync('.audit/w47-strip-absent-pass2.json', JSON.stringify({ total, report }, null, 1) + '\n');
  console.log(`applied to ${edits.length} files`);
} else {
  for (const e of report.slice(0, 15)) console.log(`  ${e.file}: ${e.count}  e.g. ${e.edits[0].snippet.slice(0, 70)}`);
}
