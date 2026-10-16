// Second pass: the first pass removed the modules, and what is left is code that used them — a
// property read on what is now `null`, a named import the compiler can no longer find, a dynamic
// import nested in an object literal. Each error position names the smallest statement that has to
// go, so this pass is driven by the compiler's own list rather than by pattern guessing.
//
// Re-pointed at the restored originals (W56): the source restore put the original imports back, so
// the same 46 absent modules are referenced again from the same guarded regions. The tool is
// unchanged from W47's second pass apart from the backup suffix, which has to be this pass's own —
// the W47 backups describe text that a source restore has since replaced.
//
//   node .audit/w56-absent-sites.mjs --tsc /tmp/w56c.txt [--apply]
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

// The classification names 46 modules, but an import site resolves against the whole tree, so a
// handful of the referrals land on siblings the classification never listed
// (`services/contextCollapse/operations.ts` beside the `index.ts` it did). A TS2307 with a relative
// specifier is itself the evidence that the target is absent, so the log is the authority and the
// classification is only cross-checked against it.
const unresolved = [];
for (const line of fs.readFileSync(LOG, 'utf8').split('\n')) {
  const m = line.match(/^([^\s(]+)\((\d+),\d+\): error TS2307: Cannot find module '(\.[^']+)'/);
  if (!m) continue;
  const resolved = path.resolve(HARNESS, path.dirname(m[1]), m[3]).replace(/\.js$/, '');
  if (!targets.has(resolved)) unresolved.push({ resolved, file: m[1], line: Number(m[2]) });
  targets.add(resolved);
}
if (unresolved.length) {
  console.log(`absent targets outside the classification: ${new Set(unresolved.map((u) => u.resolved)).size}`);
  for (const u of unresolved.slice(0, 20)) console.log(`  ${path.relative(HARNESS, u.resolved)}  <- ${u.file}:${u.line}`);
}

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
    // Prefer the whole statement: `const { f } = await import('S')` has the specifier's parent as the
    // bare call, and deleting the call alone leaves `const { f } = `. Climb to the first statement
    // ancestor, and only fall back to the expression walk when there is none (a spread, an argument).
    let target = null;
    for (let up = node; up.parent; up = up.parent) {
      if (ts.isVariableStatement(up) || ts.isExpressionStatement(up) || ts.isReturnStatement(up) || ts.isIfStatement(up)) {
        target = up;
        break;
      }
    }
    let owner = node;
    if (target === null) {
      while (owner.parent && !deletable(owner.parent, ts)) owner = owner.parent;
      if (!deletable(owner.parent, ts)) continue;
      target = owner.parent;
    }
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
    if (!fs.existsSync(e.full + '.w56bak')) fs.writeFileSync(e.full + '.w56bak', e.text);
    fs.writeFileSync(e.full, e.updated);
  }
  fs.writeFileSync('.audit/w56-absent-sites.json', JSON.stringify({ total, report }, null, 1) + '\n');
  console.log(`applied to ${edits.length} files`);
} else {
  for (const e of report.slice(0, 15)) console.log(`  ${e.file}: ${e.count}  e.g. ${e.edits[0].snippet.slice(0, 70)}`);
}
