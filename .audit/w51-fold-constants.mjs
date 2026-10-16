// Fold the build constants the bundler inlined into the source text.
//
// `if ("external" === 'ant') return true;` is not a type error, it is a comparison between two
// literals: the bundler substituted USER_TYPE and then left the test in place. The same happens to
// NODE_ENV. TypeScript calls these TS2367 and is right to, but nothing about the *types* is wrong —
// the expression simply has one value. So the honest reconstruction is the constant fold the
// bundler would have done: keep the branch that survives, drop the one that cannot run.
//
// Folding just the comparison is not enough. `...(false && { a: b.c })` still carries dead code that
// then fails on its own terms — a false operand cannot be spread, and the object inside is still
// checked. So the fold continues through the logical chain the comparison sits in, and removes a
// spread whose operand it has proved false.
//
//   node .audit/w51-fold-constants.mjs <tsc-log>            report only
//   node .audit/w51-fold-constants.mjs <tsc-log> --apply    rewrite
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('/tmp/w47-tools/node_modules/typescript');
const BASE = '/Users/mant1ssa/Projects/cc-base-2188';
const log = process.argv[2];
const APPLY = process.argv.includes('--apply');

const sites = new Map();
for (const line of fs.readFileSync(log, 'utf8').split('\n')) {
  const m = line.match(/^([^\s(]+)\((\d+),(\d+)\): error TS2367:/);
  if (!m) continue;
  const file = path.resolve(BASE, m[1]);
  if (!sites.has(file)) sites.set(file, []);
  sites.get(file).push({ line: +m[2], col: +m[3] });
}

const kind = (f) => (f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const parse = (file, text) =>
  ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind(file));

// The smallest binary comparison covering a position, with both operands string literals.
const comparisonAt = (sf, pos) => {
  for (let n = ts.getTokenAtPosition(sf, pos); n; n = n.parent) {
    if (ts.isBinaryExpression(n) &&
        (n.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
         n.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken) &&
        ts.isStringLiteral(n.left) && ts.isStringLiteral(n.right)) {
      return n;
    }
  }
  return null;
};

const comparisonValue = (n) =>
  (n.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
    ? n.left.text === n.right.text
    : n.left.text !== n.right.text);

const isLiteralComparison = (n) =>
  ts.isBinaryExpression(n) &&
  (n.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
   n.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken) &&
  ts.isStringLiteral(n.left) && ts.isStringLiteral(n.right);

// Reading a name or a property cannot change anything, so a discarded operand made only of those
// can go. A call, an assignment or an await can, so it stays.
const isPure = (n) => {
  if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) || n.kind === ts.SyntaxKind.TrueKeyword ||
      n.kind === ts.SyntaxKind.FalseKeyword || n.kind === ts.SyntaxKind.NullKeyword) return true;
  if (ts.isPropertyAccessExpression(n)) return isPure(n.expression);
  if (ts.isElementAccessExpression(n)) return isPure(n.expression) && (!n.argumentExpression || isPure(n.argumentExpression));
  if (ts.isParenthesizedExpression(n)) return isPure(n.expression);
  if (ts.isPrefixUnaryExpression(n)) return isPure(n.operand);
  if (ts.isBinaryExpression(n)) return isPure(n.left) && isPure(n.right);
  return false;
};

// Fold a whole boolean chain, not one comparison, because the chains are written as pairs:
// `if ("production" === 'test' || "production" === 'development')` has a foldable comparison on each
// side and only folds once both are known.
//
// The returned `text` is an expression for the same chain. When `constant` is null it is the chain
// itself, rewritten where a child folded away, so a chain that cannot become a literal can still
// lose the comparisons inside it. Every rewrite keeps the exact value, except under `truthOnly`,
// where the chain is a condition and only its truthiness is observable.
const foldChain = (sf, node, truthOnly) => {
  const text = node.getText(sf);
  // The comparison is between two string literals, so it *is* its value; keeping the original text
  // here would leave the comparison in place and the error with it.
  if (isLiteralComparison(node)) {
    const value = comparisonValue(node);
    return { constant: value, text: String(value), op: 'cmp' };
  }

  const isAnd = ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken;
  const isOr = ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken;
  if (!isAnd && !isOr) return { constant: null, text, op: null };

  const op = isAnd ? '&&' : '||';
  // `||` under `&&` needs its parentheses back: `(a || b) && c` is not `a || b && c`.
  const wrap = (part) => (isAnd && part.op === '||' ? `(${part.text})` : part.text);
  const rejoin = (l, r) => ({ constant: null, text: `${wrap(l)} ${op} ${wrap(r)}`, op });

  const left = foldChain(sf, node.left, truthOnly);
  if (left.constant !== null) {
    // Short-circuit: `false && x` is false and never evaluates x; `true || x` is true likewise.
    if (left.constant === !isAnd) return { constant: left.constant, text: String(left.constant), op: null };
    // Otherwise the left is a literal that cannot decide the chain, and `true && x` / `false || x`
    // are x exactly.
    return foldChain(sf, node.right, truthOnly);
  }

  const right = foldChain(sf, node.right, truthOnly);
  if (right.constant === null) return rejoin(left, right);

  // `x && false` and `x || true` decide the chain, but only after evaluating x, and a falsy x is
  // its own value rather than false — `null && false` is null. Dropping x costs that value and its
  // evaluation, so it is free only when x had nothing to do and only where the chain is a test.
  if (right.constant === !isAnd) {
    if (!truthOnly) return rejoin(left, right);
    return isPure(node.left)
      ? { constant: right.constant, text: String(right.constant), op: null }
      : rejoin(left, right);
  }
  // `x && true` and `x || false` are x only when x is already falsy; in a condition the truthiness
  // comes out the same either way.
  return truthOnly ? { constant: null, text: left.text, op: left.op } : rejoin(left, right);
};

// The outermost boolean chain the comparison belongs to.
const chainRoot = (node) => {
  let n = node;
  while (ts.isBinaryExpression(n.parent) &&
         (n.parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          n.parent.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
    n = n.parent;
  }
  return n;
};

const report = [];
const edits = new Map();
const skips = [];
let sfForLines = null;
const where = (off) => ts.getLineAndCharacterOfPosition(sfForLines, off).line + 1;

for (const [file, list] of sites) {
  const text = fs.readFileSync(file, 'utf8');
  const sf = parse(file, text);
  sfForLines = sf;
  const thisFile = [];
  for (const site of list) {
    const pos = ts.getPositionOfLineAndCharacter(sf, site.line - 1, site.col - 1);
    const cmp = comparisonAt(sf, pos);
    if (!cmp) { skips.push(`${path.relative(BASE, file)}:${site.line} no literal comparison at that column`); continue; }
    const target = chainRoot(cmp);
    // `...("x" === 'ant' && {...})` wraps the chain in parentheses, so the construct that decides
    // what the fold should become sits one or more levels above the chain itself.
    let outer = target;
    while (ts.isParenthesizedExpression(outer.parent)) outer = outer.parent;
    const parent = outer.parent;
    // Where the chain is a test rather than a value, replacing it with one that has the same
    // truthiness is exact, and that is what lets a chain holding a non-constant operand fold.
    const asCondition =
      (ts.isIfStatement(parent) && parent.expression === outer) ||
      (ts.isConditionalExpression(parent) && parent.condition === outer) ||
      (ts.isWhileStatement(parent) && parent.expression === outer) ||
      (ts.isDoStatement(parent) && parent.expression === outer) ||
      (ts.isPrefixUnaryExpression(parent) && parent.operator === ts.SyntaxKind.ExclamationToken);

    const original = target.getText(sf);
    const folded = foldChain(sf, target, asCondition);
    if (folded.constant === null && folded.text === original) {
      skips.push(`${path.relative(BASE, file)}:${site.line} nothing in this chain folds`);
      continue;
    }

    let start = target.getStart(sf);
    let end = target.getEnd();
    let replacement = folded.text;
    let what = 'expression';

    // Spreading a proven-false operand contributes nothing, and `...false` is not legal at all.
    // An object literal spreads a SpreadAssignment; an array or a call spreads a SpreadElement.
    if (folded.constant !== null && (ts.isSpreadElement(parent) || ts.isSpreadAssignment(parent))) {
      const list_ = parent.parent;
      const kids = ts.isObjectLiteralExpression(list_)
        ? list_.properties
        : ts.isArrayLiteralExpression(list_) ? list_.elements : null;
      const i = kids ? kids.indexOf(parent) : -1;
      if (i >= 0 && i + 1 < kids.length) { start = parent.getStart(sf); end = kids[i + 1].getStart(sf); }
      else if (i > 0) { start = kids[i - 1].getEnd(); end = parent.getEnd(); }
      else { skips.push(`${path.relative(BASE, file)}:${site.line} lone spread would need the literal rewritten`); continue; }
      replacement = '';
      what = 'spread';
    } else if (folded.constant !== null && ts.isIfStatement(parent) && parent.expression === outer) {
      what = 'if';
      start = parent.getStart(sf);
      end = parent.getEnd();
      const taken = folded.constant ? parent.thenStatement : parent.elseStatement;
      replacement = taken ? taken.getText(sf) : '{}';
      // `if (a) if (b) x(); else y();` would re-bind the else if the inner if disappears.
      const gp = parent.parent;
      if (ts.isIfStatement(gp) && gp.elseStatement === parent && !ts.isBlock(gp.thenStatement)) {
        skips.push(`${path.relative(BASE, file)}:${site.line} dangling-else would re-bind`);
        continue;
      }
    } else if (folded.constant !== null && ts.isConditionalExpression(parent) && parent.condition === outer) {
      what = 'ternary';
      start = parent.getStart(sf);
      end = parent.getEnd();
      replacement = `(${(folded.constant ? parent.whenTrue : parent.whenFalse).getText(sf)})`;
    }

    thisFile.push({ start, end, replacement, what });
  }
  // Two comparisons in one chain resolve to the same fold; that is one edit, not a conflict.
  const seen = new Set();
  const unique = thisFile.filter((e) => {
    const k = `${e.start}:${e.end}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // A fold nested inside another is dropped, not the other way round: an enclosing if or ternary
  // takes its surviving branch verbatim from the text as it stands, so the nested fold would be
  // overwritten whatever it said. What it leaves behind is still a constant comparison, and the
  // next pass — this tool reading the next compiler log — folds it then.
  unique.sort((a, b) => a.start - b.start);
  const kept = [];
  let cursor = -1;
  for (const e of unique) {
    if (e.start < cursor) {
      const outer = kept[kept.length - 1];
      skips.push(`${path.relative(BASE, file)}: ${e.what} on line ${where(e.start)} sits inside the ${outer.what} on line ${where(outer.start)}`);
      continue;
    }
    kept.push(e);
    cursor = e.end;
  }
  // Later sites first so earlier offsets stay valid.
  kept.sort((a, b) => b.start - a.start);
  edits.set(file, { text, list: kept });
  const counts = {};
  for (const e of kept) counts[e.what] = (counts[e.what] || 0) + 1;
  report.push(`${path.relative(BASE, file).padEnd(58)} ${String(thisFile.length).padStart(3)}  ${JSON.stringify(counts)}`);
}

const all = [...edits.values()].flatMap((e) => e.list);
const totals = {};
for (const e of all) totals[e.what] = (totals[e.what] || 0) + 1;
console.log(report.join('\n'));
console.log(`\nsites: ${all.length}  ${JSON.stringify(totals)}`);
if (skips.length) console.log(`\nskipped ${skips.length}:\n  ${skips.join('\n  ')}`);

if (!APPLY) {
  console.log('\ndry run; pass --apply to write');
  process.exit(0);
}

let written = 0;
for (const [file, e] of edits) {
  let out = e.text;
  for (const ed of e.list) out = out.slice(0, ed.start) + ed.replacement + out.slice(ed.end);
  // A fold that does not parse is a bug in this tool, not a fact about the tree.
  const bad = parse(file, out).parseDiagnostics ?? [];
  if (bad.length) {
    console.log(`REFUSED ${path.relative(BASE, file)}: ${bad.length} parse diagnostics after fold`);
    continue;
  }
  fs.copyFileSync(file, `${file}.w51bak`);
  fs.writeFileSync(file, out);
  written++;
}
console.log(`\nrewrote ${written}/${edits.size} files (backups at *.w51bak)`);
