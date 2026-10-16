// Delete the `feature('X')` arms the compiler can no longer resolve.
//
// Stage 1 removed the `feature('X') ? require('S') : null` declarations that pointed at modules this
// build does not contain. What is left is every *use* of the name those declarations bound, and each
// use sits inside a `feature('X')` guard — the guard is the feature's only home. Because
// `feature()` returns false for every flag in this harness (shims/bun-bundle.ts), removing a guarded
// region does not change what the harness does:
//
//   * `if (feature('X')) { A }`            -> the whole statement goes (or its `else` if it has one)
//   * `if (feature('X') && cond) { A }`    -> same: the condition cannot be true
//   * `feature('X') ? A : B`               -> becomes `B`
//
// Only regions whose guard is a `feature(...)` call are touched, and only where the compiler itself
// reports the name as unresolved — the error list drives the pass, the guard proves the deletion.
//
//   node .audit/w56-feature-guards.mjs --tsc /tmp/w56d.txt [--apply]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const HARNESS = '/Users/mant1ssa/Projects/cc-base-2188';
const ts = createRequire(import.meta.url)('/tmp/w47-tools/node_modules/typescript');
const APPLY = process.argv.includes('--apply');
const LOG = process.argv[process.argv.indexOf('--tsc') + 1] ?? '/tmp/w56d.txt';

const wanted = [];
for (const line of fs.readFileSync(LOG, 'utf8').split('\n')) {
  const m = line.match(/^([^\s(]+)\((\d+),(\d+)\): error (TS2304|TS2552): (.*)$/);
  if (!m) continue;
  const name = m[5].match(/Cannot find name '([^']+)'/)?.[1];
  if (name) wanted.push({ file: m[1], line: Number(m[2]), col: Number(m[3]), name });
}

const byFile = new Map();
for (const w of wanted) {
  if (!byFile.has(w.file)) byFile.set(w.file, []);
  byFile.get(w.file).push(w);
}

// A `feature(...)` call, possibly under a `!`, and whether it is negated.
const featureFlag = (node, source) => {
  if (node === undefined) return null;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
    const inner = featureFlag(node.operand, source);
    return inner ? { flag: inner.flag, negated: !inner.negated } : null;
  }
  if (ts.isParenthesizedExpression(node)) return featureFlag(node.expression, source);
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'feature') {
    const arg = node.arguments[0];
    if (arg && ts.isStringLiteral(arg)) return { flag: arg.text, negated: false };
  }
  return null;
};

// The feature a guard is about, if the test is built from one.
const guardOf = (test, source) => {
  const direct = featureFlag(test, source);
  if (direct) return direct;
  if (ts.isBinaryExpression(test)) {
    const left = guardOf(test.left, source);
    if (left) return left;
    return guardOf(test.right, source);
  }
  return null;
};

const edits = [];
const manual = [];

for (const [file, sites] of byFile) {
  const full = path.join(HARNESS, file);
  const text = fs.readFileSync(full, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lineStarts = [];
  for (let i = 0, at = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push((at = i + 1));
  lineStarts.unshift(0);

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

    // Climb to the nearest guarded region this position sits in.
    let cursor = node;
    let done = null;
    while (cursor.parent) {
      const parent = cursor.parent;
      if (ts.isIfStatement(parent) && parent.expression.getStart(source) <= node.getStart(source)) {
        const guard = guardOf(parent.expression, source);
        if (guard) {
          done = { kind: 'if', node: parent, guard, keepThen: guard.negated };
          break;
        }
      }
      if (ts.isConditionalExpression(parent)) {
        const guard = guardOf(parent.condition, source);
        if (guard) {
          done = { kind: 'ternary', node: parent, guard, keepThen: guard.negated };
          break;
        }
      }
      cursor = parent;
    }
    if (!done) {
      manual.push(`${file}:${site.line} ${site.name} (no feature guard in scope)`);
      continue;
    }
    if (done.kind === 'if') {
      // `if (feature('X') && …)` can never be true, so keep only the `else` branch, if any.
      const kept = done.keepThen ? done.node.thenStatement : done.node.elseStatement;
      let start = done.node.getStart(source);
      // `else if (feature('X')) { … }` is an IfStatement that is the else of another one. Deleting it
      // alone leaves the outer `if`'s closing brace behind, so the `else` keyword goes with it.
      const outer = done.node.parent;
      if (!kept && outer && ts.isIfStatement(outer) && outer.elseStatement === done.node) {
        const elseKeyword = outer.getChildren(source).find((c) => c.kind === ts.SyntaxKind.ElseKeyword);
        if (elseKeyword) start = elseKeyword.getStart(source);
      }
      local.push({
        start,
        end: done.node.getEnd(),
        replace: kept ? kept.getText(source).replace(/^\{\s*|\s*\}$/g, '') : '',
        flag: done.guard.flag,
        name: site.name,
      });
    } else {
      const kept = done.keepThen ? done.node.whenTrue : done.node.whenFalse;
      local.push({
        start: done.node.getStart(source),
        end: done.node.getEnd(),
        replace: kept.getText(source),
        flag: done.guard.flag,
        name: site.name,
      });
    }
  }

  // Overlap: an inner region is contained in an outer one, and the outer replacement covers it.
  const kept = [];
  for (const e of [...local].sort((a, b) => a.start - b.start || b.end - a.end)) {
    if (kept.some((k) => e.start >= k.start && e.end <= k.end)) continue;
    kept.push(e);
  }
  if (!kept.length) continue;

  let updated = text;
  for (const e of [...kept].sort((a, b) => b.start - a.start)) {
    updated = updated.slice(0, e.start) + e.replace + updated.slice(e.end);
  }
  const check = ts.createSourceFile(file, updated, ts.ScriptTarget.ES2022, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if ((check.parseDiagnostics ?? []).length > 0) {
    console.log(`  SKIP ${file}: ${check.parseDiagnostics.length} parse errors after ${kept.length} edits`);
    for (const d of check.parseDiagnostics.slice(0, 2)) {
      const at = updated.slice(0, d.start).split('\n').length;
      console.log(`    line ${at}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
      console.log(`    ctx: ${JSON.stringify(updated.split('\n').slice(Math.max(0, at - 4), at + 1).join('\n'))}`);
    }
    continue;
  }
  edits.push({ file, full, text, updated, count: kept.length, flags: [...new Set(kept.map((k) => k.flag))] });
}

console.log(`${wanted.length} unresolved names | ${edits.length} files | ${edits.reduce((n, e) => n + e.count, 0)} regions`);
for (const e of edits) console.log(`  ${e.file}: ${e.count}  [${e.flags.join(' ')}]`);
if (manual.length) {
  console.log(`\nno guard in scope: ${manual.length}`);
  for (const m of manual) console.log(`  ${m}`);
}

if (APPLY) {
  for (const e of edits) {
    if (!fs.existsSync(e.full + '.w56bak')) fs.writeFileSync(e.full + '.w56bak', e.text);
    fs.writeFileSync(e.full, e.updated);
  }
  console.log(`\napplied to ${edits.length} files`);
} else {
  console.log('\ndry run; pass --apply to write');
}
