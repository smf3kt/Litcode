// Reattach the props type the decompiler cut off.
//
// The dump writes every component as `function StatsContent(t0) { const { allTimePromise, onClose }
// = t0; ... }` and leaves the annotation as a separate `type StatsContentProps = { ... }` above it.
// The type is in the file; only the link between them is missing, and without it `t0` is an
// implicit any, which is how 149 errors end up reading `Property 'x' does not exist on type
// 'unknown'` — an `any` argument to a generic gives the type parameter no candidates, and
// TypeScript falls back to `unknown`.
//
// This only ever adds `: <Name>Props` to a parameter that has no annotation at all, and only when a
// type of that exact name exists in the same file. Nothing is invented.
//
//   node .audit/w52-props-types.mjs             census
//   node .audit/w52-props-types.mjs --apply     rewrite
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('/tmp/w47-tools/node_modules/typescript');
const BASE = '/Users/mant1ssa/Projects/cc-base-2188';
const APPLY = process.argv.includes('--apply');
const SKIP = new Set(['node_modules', 'recovered', '.git', 'dist']);

const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.endsWith('.bak') || /\.w\d+bak$/.test(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
};
walk(BASE);

const kind = (f) => (f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const rows = [];
const edits = new Map();

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind(file));

  // Every object type in the file, keyed by the set of property names it declares. The
  // decompiler renamed some of the props types (`CopyPicker` reads its props from
  // `type PickerProps`), so the name cannot be the only handle; the destructured keys can.
  const byKeys = new Map();
  const types = new Set();
  const memberNames = (node) => {
    const members = ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type) ? node.type.members
      : ts.isInterfaceDeclaration(node) ? node.members : null;
    if (!members) return null;
    const names = [];
    for (const m of members) {
      if (!ts.isPropertySignature(m) || !m.name) return null;
      if (!ts.isIdentifier(m.name) && !ts.isStringLiteral(m.name)) return null;
      names.push(m.name.text);
    }
    return names;
  };
  for (const st of sf.statements) {
    if (!ts.isTypeAliasDeclaration(st) && !ts.isInterfaceDeclaration(st)) continue;
    // A generic props type cannot be reattached: the type arguments were stripped along with the
    // annotation, and `SelectProps` without its argument is a different type.
    if (st.typeParameters?.length) continue;
    types.add(st.name.text);
    const names = memberNames(st);
    if (!names || !names.length) continue;
    const k = [...names].sort().join(',');
    if (!byKeys.has(k)) byKeys.set(k, []);
    byKeys.get(k).push(st.name.text);
  }
  if (!types.size) continue;

  const thisFile = [];
  for (const st of sf.statements) {
    let name = null;
    let params = null;
    let body = null;
    if (ts.isFunctionDeclaration(st) && st.name && st.parameters.length) {
      name = st.name.text;
      params = st.parameters;
      body = st.body;
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        const init = d.initializer;
        if (!init || !ts.isIdentifier(d.name)) continue;
        if ((ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && init.parameters.length) {
          name = d.name.text;
          params = init.parameters;
          body = ts.isBlock(init.body) ? init.body : null;
        }
      }
    }
    // A component takes exactly one argument; anything else is not this shape.
    if (!name || !params || params.length !== 1 || !body) continue;
    const p = params[0];
    if (!ts.isIdentifier(p.name) || p.type) continue;
    // The parameter must actually be destructured, which is what makes it props.
    let keys = null;
    for (const s of body.statements) {
      if (!ts.isVariableStatement(s)) continue;
      for (const d of s.declarationList.declarations) {
        if (!d.initializer || !ts.isIdentifier(d.initializer) || d.initializer.text !== p.name.text) continue;
        if (!ts.isObjectBindingPattern(d.name)) continue;
        keys = d.name.elements.map((el) => (el.propertyName ?? el.name).text);
      }
    }
    if (!keys || !keys.length) continue;

    // The type has to be declared above the function it describes, and to be referenced nowhere
    // else: a type already in use belongs to something else.
    const above = (n) => {
      const decl = sf.statements.find(
        (st) => (ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st)) && st.name.text === n,
      );
      return decl && decl.getStart() < st.getStart();
    };
    const used = (n) => {
      let hits = 0;
      const visit = (node) => {
        if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName) && node.typeName.text === n) hits++;
        ts.forEachChild(node, visit);
      };
      visit(sf);
      return hits;
    };
    const named = [`${name}Props`, `I${name}Props`, `${name}PropsType`].filter((c) => types.has(c) && above(c));
    const keyed = (byKeys.get([...keys].sort().join(',')) ?? []).filter((c) => above(c) && !used(c));
    // A name match is decisive; otherwise the file must contain exactly one type whose members are
    // exactly the destructured keys, and that type must be the only one that fits.
    const candidate = named[0] ?? (keyed.length === 1 ? keyed[0] : undefined);
    if (candidate) thisFile.push({ pos: p.getEnd(), name: candidate, fn: name, how: named[0] ? 'name' : 'keys' });
    else rows.push(`${path.relative(BASE, file)}: ${name}(${p.name.text}) destructures [${keys.join(', ')}]; ${keyed.length} types fit`);
  }
  if (thisFile.length) edits.set(file, { text, list: thisFile });
}

let sites = 0;
for (const [file, e] of edits) {
  sites += e.list.length;
  for (const ed of e.list) {
    void file;
    void ed;
  }
}
const howCount = {};
const samples = [];
for (const [file, e] of edits) {
  for (const ed of e.list) {
    howCount[ed.how] = (howCount[ed.how] || 0) + 1;
    if (ed.how === 'keys' && samples.length < 10) samples.push(`${path.relative(BASE, file)}: ${ed.fn}(t0: ${ed.name})`);
  }
}
console.log(`components with an unannotated props parameter and a matching type: ${sites} in ${edits.size} files`);
console.log(`  matched by name: ${howCount.name ?? 0}, by key set: ${howCount.keys ?? 0}`);
for (const s of samples) console.log(`    keys  ${s}`);
console.log(`unmatched: ${rows.length}`);
for (const r of rows.slice(0, 15)) console.log(`  ${r}`);
if (rows.length > 15) console.log(`  ... ${rows.length - 15} more`);

if (!APPLY) {
  console.log('\ndry run; pass --apply to write');
  process.exit(0);
}

let written = 0;
let added = 0;
for (const [file, e] of edits) {
  let out = e.text;
  // Later sites first so earlier offsets stay valid.
  const list = [...e.list].sort((a, b) => b.pos - a.pos);
  for (const ed of list) out = out.slice(0, ed.pos) + `: ${ed.name}` + out.slice(ed.pos);
  const bad = ts.createSourceFile(file, out, ts.ScriptTarget.Latest, true, kind(file)).parseDiagnostics ?? [];
  if (bad.length) {
    console.log(`REFUSED ${path.relative(BASE, file)}: ${bad.length} parse diagnostics`);
    continue;
  }
  fs.copyFileSync(file, `${file}.w52bak`);
  fs.writeFileSync(file, out);
  written++;
  added += list.length;
}
console.log(`\nannotated ${added} parameters in ${written}/${edits.size} files (backups at *.w52bak)`);
