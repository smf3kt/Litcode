// Delete the reference sites of the modules whose feature the shipped build no longer has.
//
//   node .audit/w47-strip-absent.mjs [--apply]
//
// Three shapes carry a reference, and each is removed at the smallest node that makes the module
// unreachable:
//   * `feature('X') ? (require('S') as typeof import('S')) : null` -> the whole conditional becomes
//     `null`, which also drops the `typeof import` type query that would keep the module required;
//   * `void import('S').then(...)` -> the expression statement goes;
//   * `import … from 'S'` -> the import declaration goes, and the compiler then names every use.
// The parse is TypeScript's own, so TSX and type syntax are handled exactly.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const HARNESS = '/tmp/cc-2188-src';
// The harness carries typescript 7, the native port, which ships no JS API. Parse with 5.7 from a
// scratch tool directory instead of adding a dependency to the product or the harness.
const require_ = createRequire(import.meta.url);
const ts = require_('/tmp/w47-tools/node_modules/typescript');
const APPLY = process.argv.includes('--apply');

const classification = JSON.parse(fs.readFileSync('.audit/w47-gap-classification.json', 'utf8'));
const fills = JSON.parse(fs.readFileSync('.audit/w47-fills.json', 'utf8'));
const record = new Map(fills.results.map((r) => [r.relative, r]));
const ported = new Set(['tools/WorkflowTool/createWorkflowCommand.ts', 'services/skillSearch/prefetch.ts']);
const absent = classification.rows.filter((r) => r.verdict === 'absent' && !ported.has(r.module));

// Match on the resolved target, never on the basename: four of these modules are named `index`,
// and a basename rule deleted every `./x/index.js` import in the tree.
const targets = new Map();
for (const gap of absent) {
  const resolved = path.resolve(HARNESS, gap.module).replace(/\.tsx?$/, '');
  targets.set(resolved, gap.module);
}
const files = new Set();
for (const gap of absent) for (const f of record.get(gap.module)?.importersList ?? []) files.add(f);

const scriptKind = (file) => (file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const edits = [];
const report = [];

for (const file of [...files].sort()) {
  const full = path.join(HARNESS, file);
  const text = fs.readFileSync(full, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, scriptKind(file));
  const local = [];

  const specifierTarget = (node) => {
    if (!ts.isStringLiteral(node) || !node.text.startsWith('.')) return null;
    const resolved = path.resolve(path.dirname(full), node.text).replace(/\.js$/, '');
    return targets.has(resolved) ? resolved : null;
  };

  const visit = (node) => {
    // `import … from 'S'`
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      const target = specifierTarget(node.moduleSpecifier);
      if (target !== null) {
        const start = text.lastIndexOf('\n', node.getStart(source)) + 1;
        const end = node.getEnd();
        local.push({ kind: 'import', stem: target, start, end: text[end] === '\n' ? end + 1 : end });
        return;
      }
    }
    // `import('S')` — either a fire-and-forget statement or inside an expression
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const target = specifierTarget(node.arguments[0]);
      if (target !== null) {
        let statement = node;
        while (statement.parent && !ts.isExpressionStatement(statement)) statement = statement.parent;
        if (ts.isExpressionStatement(statement)) {
          const start = text.lastIndexOf('\n', statement.getStart(source)) + 1;
          const end = statement.getEnd();
          local.push({ kind: 'dynamic-import', stem: target, start, end: text[end] === '\n' ? end + 1 : end });
          return;
        }
      }
    }
    // `require('S')` — take the smallest unit that removes the module: a spread or property inside
    // an object literal, the whole statement, or just the value expression (cast included, so the
    // `typeof import('S')` type query goes too). Escalating to the enclosing conditional deleted
    // its sibling properties as well, because three requires share one conditional.
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
      const target = specifierTarget(node.arguments[0]);
      if (target !== null) {
        let value = node;
        while (value.parent && (ts.isParenthesizedExpression(value.parent) || ts.isAsExpression(value.parent) || ts.isNonNullExpression(value.parent))) {
          value = value.parent;
        }
        const parent = value.parent;
        if (parent && ts.isSpreadElement(parent)) {
          let start = parent.getStart(source);
          let end = parent.getEnd();
          const after = text.slice(end).match(/^\s*,/);
          const before = text.slice(0, start).match(/,\s*$/);
          if (after) end += after[0].length;
          else if (before) start -= before[0].length;
          local.push({ kind: 'spread', stem: target, start, end });
        } else if (parent && ts.isPropertyAssignment(parent) && parent.initializer === value) {
          let start = parent.getStart(source);
          let end = parent.getEnd();
          const after = text.slice(end).match(/^\s*,/);
          const before = text.slice(0, start).match(/,\s*$/);
          if (after) end += after[0].length;
          else if (before) start -= before[0].length;
          local.push({ kind: 'property', stem: target, start, end });
        } else {
          local.push({ kind: 'gated-require', stem: target, start: value.getStart(source), end: value.getEnd(), to: 'null' });
        }
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  if (local.length === 0) continue;
  // Two requires in one expression can resolve to the same enclosing node, so keep the outermost
  // and drop anything that overlaps it: overlapping splices are what mangled the file last time.
  const accepted = [];
  for (const edit of [...local].sort((a, b) => a.start - b.start || b.end - a.end)) {
    if (accepted.some((e) => edit.start < e.end && e.start < edit.end)) continue;
    accepted.push(edit);
  }
  local.length = 0;
  local.push(...accepted);
  local.sort((a, b) => b.start - a.start);
  let updated = text;
  for (const edit of local) updated = updated.slice(0, edit.start) + (edit.to ?? '') + updated.slice(edit.end);
  edits.push({ file, full, text, updated, local });
  report.push({ file, sites: local.map((e) => ({ kind: e.kind, module: targets.get(e.stem) })) });
}

const byKind = {};
for (const e of report) for (const s of e.sites) byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
console.log(`absent modules ${absent.length} | files touched ${edits.length} | sites ${report.reduce((n, r) => n + r.sites.length, 0)}`);
console.log('by kind:', JSON.stringify(byKind));
const modulesTouched = new Set(report.flatMap((r) => r.sites.map((s) => s.module)));
console.log(`modules with at least one deleted site: ${modulesTouched.size} / ${absent.length}`);

if (process.argv.includes('--restore')) {
  let restored = 0;
  for (const file of [...files]) {
    const full = path.join(HARNESS, file);
    if (fs.existsSync(full + '.w47bak')) { fs.writeFileSync(full, fs.readFileSync(full + '.w47bak')); restored += 1; }
  }
  console.log(`restored ${restored} files from .w47bak`);
} else if (APPLY) {
  for (const e of edits) {
    if (!fs.existsSync(e.full + '.w47bak')) fs.writeFileSync(e.full + '.w47bak', e.text);
    fs.writeFileSync(e.full, e.updated);
  }
  fs.writeFileSync('.audit/w47-strip-absent.json', JSON.stringify({ byKind, report }, null, 1) + '\n');
  console.log(`applied to ${edits.length} files (originals kept as .w47bak)`);
} else {
  for (const e of report.slice(0, 12)) console.log(`  ${e.file}: ${e.sites.map((s) => s.kind).join(', ')}`);
}
