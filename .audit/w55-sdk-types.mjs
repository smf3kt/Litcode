// Regenerate the SDK types from the schemas they are generated from.
//
// `entrypoints/sdk/coreTypes.ts` says so itself: "Types are generated from Zod schemas in
// coreSchemas.ts. To modify types: 1. Edit Zod schemas in coreSchemas.ts 2. Run:
// bun scripts/generate-sdk-types.ts". The dump has coreSchemas.ts (56 KB, 135 schemas) but not the
// generator, and the generated half of coreTypes.ts is gone — which is why 74 importers report
// `Module 'agentSdkTypes.js' has no exported member 'HookEvent'` and the like.
//
// The schema is the source of truth, so the type is its infer, written the way the other recovered
// type modules in this tree already write it: through a type query, so the module still emits
// nothing and the schema stays a runtime-only dependency.
//
//   node .audit/w55-sdk-types.mjs            report only
//   node .audit/w55-sdk-types.mjs --apply    rewrite coreTypes.ts
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('/tmp/w47-tools/node_modules/typescript');
const BASE = '/Users/mant1ssa/Projects/cc-base-2188';
const APPLY = process.argv.includes('--apply');

const read = (rel) => fs.readFileSync(path.join(BASE, rel), 'utf8');

// Each list of schemas is the source of truth for the types generated beside it.
const PAIRS = [
  ['entrypoints/sdk/coreSchemas.ts', 'entrypoints/sdk/coreTypes.ts'],
  ['entrypoints/sdk/controlSchemas.ts', 'entrypoints/sdk/controlTypes.ts'],
];

const readSchemas = (rel) => {
  const sf = ts.createSourceFile(rel, read(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const schemaNames = [];
  const constArrays = [];
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    if ((st.declarationList.flags & ts.NodeFlags.Const) === 0) continue;
    if (!st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name)) continue;
      if (/Schema$/.test(d.name.text)) schemaNames.push(d.name.text);
      else if (d.initializer && ts.isAsExpression(d.initializer)) constArrays.push(d.name.text);
    }
  }
  return { schemaNames, constArrays };
};

// Every name an importer asked for and did not find, from the compiler's own report.
const wanted = new Set();
const log = process.argv.slice(2).find((a) => a.endsWith('.txt'));
if (log) {
  for (const line of fs.readFileSync(log, 'utf8').split('\n')) {
    const m = line.match(/error TS(?:2305|2724): Module ('[^']*'(?:\+)?) has no exported member(?: named)? '([^']+)'/);
    if (m && /agentSdkTypes|sdk\/coreTypes|sdk\/runtimeTypes|sdk\/controlTypes/.test(m[1])) wanted.add(m[2]);
  }
}
console.log(`importers asked for ${wanted.size} names that are missing`);

for (const [schemasFile, target] of PAIRS) {
  const { schemaNames, constArrays } = readSchemas(schemasFile);
  const declared = new Set(schemaNames.map((s) => s.slice(0, -'Schema'.length)));
  const missing = [...wanted].filter(
    (w) => !declared.has(w) && !constArrays.includes(w) && !constArrays.includes(w.toUpperCase() + 'S'),
  );
  console.log(`\n${schemasFile}: ${schemaNames.length} schemas, ${constArrays.length} const arrays`);
  if (missing.length) console.log(`  importers want ${missing.length} names no schema covers: ${missing.sort().join(' ')}`);

  const from = `./${path.basename(schemasFile).replace(/\.ts$/, '.js')}`;
  const block = [
    '',
    '// ----------------------------------------------------------------------------',
    `// Generated from the Zod schemas in ${path.basename(schemasFile)}. The schema is the`,
    '// source of truth; each type below is its infer, taken through a type query so',
    '// that this module still emits nothing and the schema stays a runtime-only',
    '// dependency.',
    '//',
    '//   bun scripts/generate-sdk-types.ts',
    '// ----------------------------------------------------------------------------',
    '',
    '',
  ];

  const text = read(target);
  const existing = new Set();
  const tf = ts.createSourceFile(target, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const st of tf.statements) {
    if (ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st)) existing.add(st.name.text);
  }
  const clashes = schemaNames.map((s) => s.slice(0, -'Schema'.length)).filter((n) => existing.has(n));
  const fresh = schemaNames.length - clashes.length;
  // A name the file already declares is left as it is: it was written by hand from the same schema
  // and rewriting it would only move the text.
  const emit = schemaNames.filter((s) => !clashes.includes(s.slice(0, -'Schema'.length)));
  block.splice(
    8,
    0,
    ...emit.map(
      (s) => `export type ${s.slice(0, -'Schema'.length)} = z.infer<ReturnType<typeof import('${from}').${s}>>`,
    ),
  );
  console.log(`  ${target} already declares ${existing.size} names (${clashes.length} would clash); ${fresh} to add`);

  if (!APPLY) continue;

  let out = text.replace(/\s*$/, '\n');
  if (!/^import type \{ z \} from 'zod\/v4'$/m.test(out)) out = `import type { z } from 'zod/v4'\n` + out;
  out += block.join('\n');
  const bad = ts.createSourceFile(target, out, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS).parseDiagnostics ?? [];
  if (bad.length) {
    console.log(`  REFUSED: ${bad.length} parse diagnostics`);
    continue;
  }
  fs.copyFileSync(path.join(BASE, target), path.join(BASE, `${target}.w55bak`));
  fs.writeFileSync(path.join(BASE, target), out);
  console.log(`  wrote ${target} (+${fresh} generated types; backup at *.w55bak)`);
}

if (!APPLY) console.log('\ndry run; pass --apply to write');
