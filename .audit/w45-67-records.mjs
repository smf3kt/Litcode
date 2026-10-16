// Write the W45-67 record from the artifacts themselves: the keybinding editor — the key parser, the chord
// splitter, the legacy action names and the check that reads them, the context list and its check, the
// action-or-command check, the reserved keys for this platform, and the two schemas a keybindings file is
// read through with the runtime checks that ask them — plus the schema-name boundary it needs.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 435, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 163, `validation ${identity.validation.files}`);
expect(identity.build.files === 301, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 67) throw new Error('the chain verifier did not pass 67 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const registry = read('scripts/verify-chain-copies.mjs');
for (const entry of ["['W45-keybinding-editor', 'plugin-chain-keys-editor-source']",
  "['W45-keybindings', 'plugin-chain-keys-source']"]) {
  if (!registry.includes(entry)) throw new Error(`the verifier does not register ${entry}`);
}
const at = (needle) => {
  const file = verifier.files.find((entry) => entry.product.includes(needle));
  if (!file) throw new Error(`the verifier does not carry ${needle}`);
  return file;
};
const editorCopy = at('plugin-chain-keys-editor-source');
if (editorCopy.blocks !== 15 || editorCopy.units !== 3091) throw new Error(`the editor copy is ${JSON.stringify(editorCopy)}`);
if (editorCopy.sha256 !== '704f842768790e5a7500fe23deed92c78149466c439badf1975b11bcfe5cb559') {
  throw new Error('the editor copy is not the one this package measured');
}
const keysCopy = at('plugin-chain-keys-source');
if (keysCopy.blocks !== 12 || keysCopy.units !== 14286) throw new Error('the keys copy changed size');
if (keysCopy.sha256 !== '577192b351c096b66f80e7f953ffcf0e64b63c2b02655836d460fc7660b32338') {
  throw new Error('the keys copy is not the one W45-66 measured');
}
const buttonCopy = at('plugin-chain-button-source');
if (buttonCopy.blocks !== 1 || buttonCopy.units !== 1612) throw new Error('the button copy changed size');
if (buttonCopy.sha256 !== 'a66360a85733877236ea838e1edbcec79b230a598cfe1d033d8ab4ecad381a9e') {
  throw new Error('the button copy is not the one W45-66 measured');
}

// Each ledger's blocks are re-read from its module, compared with the copy, and checked with acorn: a
// contiguous run of whole top-level statements, no statement cut, no two overlapping.
const statementCache = new Map();
const statementsOf = (module) => {
  if (!statementCache.has(module)) {
    const text = read(`extracted-v2/modules/${module}`);
    let tree;
    try { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' }); }
    catch { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script' }); }
    statementCache.set(module, { text, body: tree.body });
  }
  return statementCache.get(module);
};
const checkCopy = (name, productPath, expected, statements) => {
  const ledger = JSON.parse(read(productPath.replace(/\.ts$/, '-blocks.json')));
  if (ledger.blocks.length !== expected.length) throw new Error(`${name} holds ${ledger.blocks.length} blocks`);
  if (ledger.missing.length !== 0) throw new Error(`${name} reports missing names`);
  const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
  const wantUnits = expected.reduce((sum, [, , , count]) => sum + count, 0);
  if (units !== wantUnits) throw new Error(`${name} holds ${units} units, not ${wantUnits}`);
  const copyText = read(productPath);
  const claimed = new Set();
  let count = 0;
  for (const [module, start, end, count_] of expected) {
    const block = ledger.blocks.find((b) => b.module === module && b.range[0] === start);
    if (!block || block.range[1] !== end || block.units !== count_) {
      throw new Error(`${name}: ${module} [${start},${end}) is not in the ledger as ${count_} units`);
    }
    const { text, body } = statementsOf(block.module);
    const slice = text.slice(start, end);
    if (!copyText.includes(slice)) throw new Error(`${name}: [${block.range}] is no longer in the copy`);
    const inside = body.filter((node) => node.start >= start && node.end <= end);
    if (inside.length === 0 || inside[0].start !== start || inside[inside.length - 1].end !== end) {
      throw new Error(`${name}: [${block.range}] does not start and end on statement boundaries`);
    }
    for (let index = 1; index < inside.length; index++) {
      if (inside[index - 1].end !== inside[index].start) throw new Error(`${name}: [${block.range}] skips a statement`);
    }
    if (body.some((node) => (node.start < start && node.end > end) || (node.start < end && node.end > end))) {
      throw new Error(`${name}: [${block.range}] cuts a statement in half`);
    }
    for (const node of inside) {
      if (claimed.has(node.start)) throw new Error(`${name}: the statement at ${node.start} is copied twice`);
      claimed.add(node.start);
    }
    count += inside.length;
  }
  if (count !== statements) throw new Error(`${name} holds ${count} statements, not ${statements}`);
  return ledger;
};

const editorLedger = checkCopy('the editor copy', 'src/plugin-chain-keys-editor-source.ts', [
  ['chunk-fdwn5gdv.js', 615, 918, 303], ['chunk-fdwn5gdv.js', 918, 932, 14], ['chunk-fdwn5gdv.js', 932, 965, 33],
  ['chunk-6ccen3s8.js', 8839, 9463, 624], ['chunk-6ccen3s8.js', 9463, 9546, 83],
  ['chunk-6ccen3s8.js', 10621, 10997, 376], ['chunk-6ccen3s8.js', 10997, 11037, 40],
  ['chunk-6ccen3s8.js', 11145, 11530, 385], ['chunk-6ccen3s8.js', 11530, 11563, 33],
  ['chunk-6ccen3s8.js', 16567, 16624, 57], ['chunk-6ccen3s8.js', 16624, 17524, 900],
  ['chunk-6ccen3s8.js', 18783, 18864, 81], ['chunk-6ccen3s8.js', 19738, 19801, 63],
  ['chunk-6ccen3s8.js', 19801, 19849, 48], ['chunk-6ccen3s8.js', 19849, 19900, 51],
], 15);
const editorText = read('src/plugin-chain-keys-editor-source.ts');
const namesIn = (source) => {
  const tree = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const declaredNames = new Set();
  const importedNames = new Set();
  const exportedNames = new Set();
  for (const node of tree.body) {
    if (node.type === 'VariableDeclaration') {
      for (const declarator of node.declarations) if (declarator.id.type === 'Identifier') declaredNames.add(declarator.id.name);
    } else if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id) {
      declaredNames.add(node.id.name);
    } else if (node.type === 'ImportDeclaration') {
      for (const specifier of node.specifiers) importedNames.add(specifier.local.name);
    } else if (node.type === 'ExportNamedDeclaration') {
      for (const specifier of node.specifiers) exportedNames.add(specifier.exported.name);
    }
  }
  return { declaredNames, importedNames, exportedNames };
};
const editorNames = namesIn(editorText);
const declared = (names, name) => names.declaredNames.has(name);
const own = ['i', 'RTr', 'p', 'mJ', 'h9', 'Z', 'Re', 'Q', 'v9t', 'We', 'lcs', 'F', 'ze', 'Bn', 'fe', 'He', 'Ve', 'T'];
for (const name of own) if (!declared(editorNames, name)) throw new Error(`the editor copy does not carry ${name}`);
if (editorNames.exportedNames.size !== own.length) throw new Error('the editor copy exports a different count');
for (const name of own) if (!editorNames.exportedNames.has(name)) throw new Error(`the editor copy does not export ${name}`);
// What the copy reaches is imported from the copy that already carries it, never declared here.
const editorImports = {
  './plugin-chain-fs-boundaries.js': ['O'],
  './plugin-chain-keys-source.js': ['Foo', 'Noo', 'pe', 'QDe', 'ZDe'],
  './plugin-chain-schema-aliases.js': ['A', 'Bm', 'o', 'u', 'U', 'ue', 'Ue'],
};
const importedTotal = Object.values(editorImports).flat();
for (const [source, names] of Object.entries(editorImports)) {
  const line = new RegExp(`import \\{ ([^}]*) \\} from '\\./${source.slice(2)}'`).exec(editorText);
  if (!line) throw new Error(`the editor copy does not import from ${source}`);
  const imported = line[1].split(',').map((name) => name.trim());
  for (const name of names) {
    if (!imported.includes(name)) throw new Error(`the editor copy does not import ${name} from ${source}`);
    if (declared(editorNames, name)) throw new Error(`the editor copy declares ${name} instead of importing it`);
  }
}
if (editorNames.importedNames.size !== importedTotal.length) throw new Error('the editor copy imports a different count');
const exportedBy = {
  'src/plugin-chain-fs-boundaries.ts': ['O'],
  'src/plugin-chain-keys-source.ts': ['Foo', 'Noo', 'pe', 'QDe', 'ZDe'],
  'src/plugin-chain-schema-aliases.ts': ['A', 'Bm', 'o', 'u', 'U', 'ue', 'Ue'],
};
for (const [path, names] of Object.entries(exportedBy)) {
  const text = read(path);
  for (const name of names) {
    const exported = new RegExp(`export (?:function|const|let|var|class) ${name}\\b|export \\{ [^}]*\\b${name}\\b`).test(text);
    if (!exported) throw new Error(`${path} no longer exports ${name}, which this package imports`);
  }
}
// The neighbours the package left where they are: the row reader and the mapper that rewrites legacy
// names, which is the one body left in the module that needs a lodash helper this chunk does not declare.
const editorModule = read('extracted-v2/modules/chunk-6ccen3s8.js');
for (const [start, end, name] of [[10481, 10621, 'Ace'], [11037, 11145, 'ge']]) {
  const slice = editorModule.slice(start, end);
  if (!slice.startsWith(`function ${name}(`)) throw new Error(`the deferred body at [${start},${end}) is not ${name}`);
  if (editorText.includes(slice)) throw new Error(`${name} was taken after all, and it is not part of this package`);
}
for (const name of ['Ace', 'ge', 'oo']) {
  if (declared(editorNames, name)) throw new Error(`the editor copy declares ${name}, which this package did not take`);
}
if (new RegExp('function oo\\(').test(editorModule)) throw new Error('this chunk declares its own map-values after all');
if (!/function ge\(e\)\{return e\.map\(\(r\)=>\(\{context:r\.context,bindings:oo\(/.test(editorModule)) {
  throw new Error('the deferred mapper no longer reaches the lodash helper this record names');
}

const scan = read('.audit/w45-67-scan.txt');
if ((scan.match(/unresolved 0/g) ?? []).length !== 2) throw new Error('the two scanned copies did not scan clean');
if (!scan.includes('imports ./plugin-chain-fs-boundaries.js, ./plugin-chain-keys-source.js, ./plugin-chain-schema-aliases.js')) {
  throw new Error('the editor scan does not name its three imports');
}

// The seams: every body quoted verbatim, every range cited, and the names a caller reads.
const editorSeam = read('src/plugin-chain-keys-editor.ts');
for (const [module, start, end] of [
  ['chunk-6ccen3s8.js', 8839, 9463], ['chunk-6ccen3s8.js', 9463, 9546],
  ['chunk-6ccen3s8.js', 10621, 10997], ['chunk-6ccen3s8.js', 10997, 11037],
  ['chunk-6ccen3s8.js', 11145, 11530], ['chunk-6ccen3s8.js', 11530, 11563],
  ['chunk-6ccen3s8.js', 16567, 16624], ['chunk-6ccen3s8.js', 16624, 17524],
  ['chunk-6ccen3s8.js', 18783, 18864], ['chunk-6ccen3s8.js', 19738, 19801],
  ['chunk-6ccen3s8.js', 19801, 19849], ['chunk-6ccen3s8.js', 19849, 19900],
  ['chunk-fdwn5gdv.js', 615, 918], ['chunk-fdwn5gdv.js', 918, 932], ['chunk-fdwn5gdv.js', 932, 965],
]) {
  const slice = read(`extracted-v2/modules/${module}`).slice(start, end).replace(/\n/g, ' ');
  if (!editorSeam.includes(slice)) throw new Error(`the editor seam does not quote ${module} [${start},${end}) verbatim`);
}
for (const range of ['[8839,9463) 624', '[9463,9546) 83', '[10621,10997) 376', '[10997,11037) 40',
  '[11145,11530) 385', '[11530,11563) 33', '[16567,16624) 57', '[16624,17524) 900', '[18783,18864) 81',
  '[19738,19801) 63', '[19801,19900) 99', '[615,965) 350']) {
  if (!editorSeam.includes(range)) throw new Error(`the editor seam does not cite ${range}`);
}
for (const name of ['KEY_CONTEXTS', 'KEY_CONTEXT_SET', 'LEGACY_ACTION_NAMES', 'LEGACY_ACTION_READ_AS',
  'parseKeyBinding', 'splitChord', 'isLegacyAction', 'isKnownContext', 'isActionOrCommand',
  'reservedKeysForPlatform', 'keyBindingBlockSchema', 'keyBindingsFileSchema', 'runtimeKeyBindingBlockSchema',
  'blockPassesRuntimeSchema', 'documentPassesRuntimeSchema', 'SCHEMA_REGISTRY', 'LAZY', 'SOURCE_BODIES']) {
  if (!editorSeam.includes(name)) throw new Error(`the editor seam does not carry ${name}`);
}
if (!editorSeam.includes('return mJ(key);') || !editorSeam.includes('return h9(chord);')) {
  throw new Error('the editor seam does not call the copied parser and splitter');
}
if (!editorSeam.includes('return Ve(block);') || !editorSeam.includes('return T(value);')) {
  throw new Error('the editor seam does not call the copied runtime checks');
}
const exportLine = /export \{ ([^}]*) \};/.exec(editorSeam);
if (!exportLine) throw new Error('the editor seam re-exports nothing');
const seamExports = exportLine[1].split(',').map((name) => name.trim()).sort();
if (seamExports.join(',') !== [...own].sort().join(',')) throw new Error('the editor seam does not re-export the copy whole');
for (const name of ['Ace', 'ge', 'oo']) if (editorSeam.includes(`export { ${name}`)) throw new Error(`the editor seam exports ${name}`);

// The second host boundary: the seven schema names the copied bodies reach the bundled zod by.
const aliases = read('src/plugin-chain-schema-aliases.ts');
for (const [name, target] of [['u', 'z.object'], ['U', 'z.enum'], ['o', 'z.string'], ['ue', 'z.record'],
  ['Ue', 'z.union'], ['Bm', 'z.null'], ['A', 'z.array']]) {
  if (!aliases.includes(`export const ${name} = ${target};`)) throw new Error(`the alias seam does not bind ${name} to ${target}`);
}
for (const name of ['SCHEMA_LIBRARY', 'SCHEMA_ALIASES', "from 'zod'"]) {
  if (!aliases.includes(name)) throw new Error(`the alias seam does not carry ${name}`);
}
const suite = read('test/plugin-chain-keys-editor.test.ts');
for (const name of ['parseKeyBinding', 'splitChord', 'isLegacyAction', 'isKnownContext', 'isActionOrCommand',
  'reservedKeysForPlatform', 'keyBindingBlockSchema', 'keyBindingsFileSchema', 'runtimeKeyBindingBlockSchema',
  'blockPassesRuntimeSchema', 'documentPassesRuntimeSchema', 'SCHEMA_REGISTRY', 'LAZY', 'KEY_CONTEXTS']) {
  if (!suite.includes(name)) throw new Error(`the suite does not exercise ${name}`);
}
if (suite.includes('plugin-chain-keys-editor-source.js')) throw new Error('the suite reaches past the seam to a copy');

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-67-tests.txt');
if (full.failed !== 0 || full.tests !== 1697) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-67-family.txt');
if (family.failed !== 0 || family.tests !== 421) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const siteSweep = summary('.audit/w45-67-site.txt');
if (siteSweep.failed !== 0 || siteSweep.tests !== 102) throw new Error('the site-table sweeps are not clean');
const span = JSON.parse(read('.audit/w45-67-span.txt'));
if (span.total !== 0) throw new Error(`the span scan found ${span.total}`);
const notices = JSON.parse(read('.audit/w45-67-notices.txt').split('\n').filter((line) => line.startsWith('{')).at(-1));
if (notices.sha256 !== '384c78801194aedea80331383ccd93708c2dfa46bc746003dc112c930b73d13c') {
  throw new Error('the dependency-notice digest moved');
}
const smokeReport = read('.audit/w45-67-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 309) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
let allMarkers = 0;
for (const name of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${name}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers += out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).length;
}
const sharedMarkers = read('.audit/w45-67-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-67-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45KeybindingEditorCompiled.v1')) throw new Error('the shared driver did not print the W45-67 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45KeybindingEditorCompiled.v1 (${sharedMarkers.length} markers, ${allMarkers} across every driver: it parses a key and keeps meta apart from alt, splits a chord, reads the legacy names, holds a block to the runtime schema and reads the reserved keys for this platform)`;

const evidence = {
  schema: 'W45KeybindingEditorEvidence.v1',
  package: 'W45-67 — the keybinding editor',
  date: '2026-10-16',
  question: 'What is left of the keybinding module once the tables a Button reads are in, and what does a keybindings file actually get checked against when it is read and again when it is used?',
  answer: 'The module is now complete but for its row reader. W45-66 took the tables a Button is measured against; this package takes the editor: the parser that turns a key string into the record a binding is stored as, the splitter that turns a chord into the keys it is made of, the six legacy action names with the check that reads them, the 29 contexts with theirs, the action-or-command check, the reserved keys for the platform the build runs on, and the two schemas a keybindings file is described by — the file schema that checks the values, and the weaker runtime schema that holds the shapes afterwards, with the two checks that ask it. Two things only reading shows. First, the parser and the comparison normaliser W45-66 ported are not the same function and are not meant to be: `Ye` folds `meta` into `alt` so two spellings of one key compare equal, while `mJ` keeps `meta` and `super` apart because that is the shape a binding is stored as. Second, the runtime check is genuinely weaker than the file schema, and that is measured rather than assumed: a context outside the 29 and an action outside the 174 both pass it, because the values were checked once when the file was read. The one boundary this package adds is a second one of the same kind as the fs boundary W45-46 bound: the copied bodies build their two schemas through seven names that reach the application\'s bundled zod, and src/plugin-chain-schema-aliases.ts binds those seven to the library this product already depends on, with each name read off the call site that uses it.',
  ported: editorLedger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  planExtensions: [
    {
      plan: 'research/ports/W45-keybinding-editor-blocks.plan.json',
      what: 'a new plan, fifteen blocks and eighteen exports across two modules',
      blocks: '0 → 15 blocks, 3,091 units, 15 statements',
      why: 'the editor is the second half of the keybinding module: three statements of a lazy registry in chunk-fdwn5gdv.js and twelve in chunk-6ccen3s8.js, whose neighbours in the same module are the tables W45-66 already took and the row reader this package leaves',
    },
  ],
  boundary: 'One new host boundary: the copied bodies build their schemas through seven names — `u`, `U`, `o`, `ue`, `Ue`, `Bm`, `A` — that reach the application\'s bundled zod, which this Node product does not have. src/plugin-chain-schema-aliases.ts binds them to the zod this product already depends on, one name per call site (`u({…})` with `.describe()` off it is an object schema, `U(v9t)` an enum, `o()` a string with `regex`/`optional`/`nullable`, `ue(o(), o().nullable())` a two-argument record, `Ue([…])` a union, `Bm()` null, `A(ze())` an array), and the mapping is observable rather than nominal because the suite writes a keybindings document through both schemas and asserts what they accept and refuse.',
  measured: [
    'The parser is not the comparison normaliser, and this is where they part: measured, `Ye` (W45-66) answers `alt+x` for `meta+x` while `mJ` keeps `meta` true and `alt` false, because a binding is stored as flags and compared as a string.',
    'The parser splits on `+` alone, so a chord keeps its space inside a key: measured, `parseKeyBinding("ctrl+x b").key` is `"x b"`, and `"ctrl+"` is an empty key with `ctrl` set.',
    'The four short aliases and the four arrow glyphs resolve before anything else: `esc`→`escape`, `return`→`enter`, `del`→`delete`, `space`→`" "`, and the four arrows to `up`/`down`/`left`/`right`; a word that is not in that list is itself.',
    'The chord splitter answers the exact single space first: measured, `splitChord(" ")` is the space key, while `"  "` trims to nothing and gives one empty key — and `""` gives the same, so a chord is never no keys.',
    'Chords are separated by whitespace rather than by character: measured, `"gg"` is one key, `"g g"` and `"\\tg\\ng "` are two.',
    'The two membership checks differ in how they treat a value that is not a string: `Q` compares against a list and answers false, while `F` tests a prefix and throws — measured, `isActionOrCommand(1)` raises `e.startsWith is not a function` and `isLegacyAction(1)` answers false.',
    'The context list is not the default binding list: the file may name 29 contexts including `MessageSelector` and `DiffPanel`, which the defaults no longer bind, and the schema and the check are both built from that same list.',
    'One of the six legacy names maps onto an action that also has its own name: measured, `messageSelector:select` and `diff:viewDetails` both read as `select:accept`.',
    'The reserved keys are read per call, not captured: measured, the same call answers 9 keys on this host and 16 when the platform is bound to the source\'s own word for macOS, because only the macOS branch pushes the seven `cmd` keys.',
    'The runtime schema is weaker than the file schema by measurement, not by intention: a context outside the list, an action outside the 174, a legacy name and `null` all pass it, and only the shapes are held (`context` required, `bindings` required, the action a string or `null`).',
    'The runtime checks ask it rather than parsing the document: measured, `documentPassesRuntimeSchema([])` is true because every block of none passes, a document of one unknown context is true, and a single bad block in a list of two is false.',
    'The lazy registry builds once and remembers: measured, a builder filed through `p` runs a single time across repeated calls, `builtCount()` counts builds rather than calls, and asking the runtime check does not build a second schema.',
    'The row reader and its mapper are the only bodies left in the module. `Ace` [10481,10621) flattens blocks into rows and `ge` [11037,11145) rewrites the legacy names through lodash `mapValues`, which this chunk does not declare — `oo=` appears once in the module and it is a state store named `$oo`, not the helper — so the mapper is deferred with the reader rather than half-taken.',
    'The seven schema names are bound, not copied: measured through both schemas in the suite, the file schema refuses an unknown context, an unknown action and a non-array `bindings`, while the runtime schema admits a legacy name, a `command:` binding and `null`.',
  ],
  regressions: `the new editor suite 14/14 inside the eight site-table and leaf files (${siteSweep.passed}/${siteSweep.tests}); ${familyLine}`,
  full: fullLine,
  compiled: driverLine,
  smoke,
  next_package: [
    'the row reader `Ace` [10481,10621) 140 units and the legacy-rewriting mapper `ge` [11037,11145) 108 units, which reach lodash `mapValues` under this chunk\'s name `oo` — the helper is not declared in the chunk, and the map-values copy this product already carries came from a different chunk, so the package that takes the reader decides how the two are bound',
    'the leaf table `tno` and the depth walker that reads it (`ano`, `ono`, `rno` with the twelve helpers they share, 18 statements / 3,506 units)',
    'the React layer: `Tc(jo, { key: `raster:${plugin}:${key}`, ... })` in chunk-kjfwbh4w.js',
    'the remaining `$` table entries, each measured before it is taken: `ui.scroll`, `ui.focus`, `ui.copy` (blocked on the clipboard encoder `Sv`), `state.get`/`state.set`, `fs.ancestors`',
    'the plugin-facing `$` dispatcher `G2e` (chunk-sfn1dbxq.js [2356082,…)), which applies `raise` then `stamp` then `run`',
    'the settings read path behind `y9e` — 590 statements / 327,047 units, 318,262 of them fresh — walked in pieces; the managed-settings gate `CT` and `Tp`; Q-086\'s 15 registry-reading cores and their 34 sites; the notification provider `a4n`',
  ],
};
write('research/ports/W45-keybinding-editor-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);

const marks = {
  current: 'W45-67 **补完',
  features: '; W45-67 completes the keybinding module',
  standard: '2026-10-16 W45-67 ',
  status: 'W45-67:',
  runner: '## W45-67 ported the keybinding editor',
};
const stripBlock = (text, mark, { toEnd = false, paragraph = false } = {}) => {
  const at = text.indexOf(mark);
  if (at < 0) return text;
  const start = text.lastIndexOf('\n', at) + 1;
  if (toEnd) return text.slice(0, start);
  const end = paragraph ? text.indexOf('\n\n', at) : text.indexOf('\n', at);
  return text.slice(0, start) + text.slice(end < 0 ? text.length : end + 1);
};

const current = stripBlock(read('research/CURRENT.md'), marks.current);
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-67 **补完绑定编辑器（键盘模块收口）**（W45-66 站点表九叶收尾后的下一包，也是该模块除行读取器外的全部）：**15 段 3,091 单位 / 15 语句**（chunk-6ccen3s8.js 12 段 2,741u = 按键解析器 \`mJ\` 624u、**chord 切分 \`h9\` 83u**、六个旧动作名 \`Z\`+换名表 \`Re\` 376u、**旧名判定 \`Q\` 40u**、29 个上下文 \`v9t\`+集合 \`We\` 385u、上下文判定 \`lcs\` 33u、动作-or-命令判定 \`F\` 57u、文件 schema \`ze\`/\`Bn\` 900u、平台保留键 \`fe\` 81u、运行时 schema \`He\` 63u、**\`Ve\` 48u**、**\`T\` 51u**；chunk-fdwn5gdv.js 3 段 350u = 惰性注册表类 \`i\` 303u、实例 \`RTr\` 14u、取值器 \`p\` 33u）。**语义（源文实测）**：**解析器与比较规范化器不是同一个函数**——\`Ye\`（W45-66）把 \`meta\` 折进 \`alt\` 以便两种拼写比得出相等，\`mJ\` 却把 \`meta\`/\`super\` 分开保留，因为绑定存的是**标志记录**（\`{key,ctrl,alt,shift,meta,super}\`）；\`mJ\` 只按 \`+\` 切分，故 chord 内的空格保留在键里（\`ctrl+x b\` 的键是 \`x b\`）；四个短别名与四个箭头字形先解析（esc/return/del/space/↑↓←→）。**chord 切分 \`h9\` 只特判"恰好一个空格"**：\`" "\`→空格键，而 \`"  "\`/\`""\` 修剪后得**一个空键**（chord 从不为 0 键）；分隔符是空白类而非字符（\`"gg"\` 一键、\`"g g"\` 与 \`"\\tg\\ng "\` 两键）。**两处成员检查对非字符串不同**：\`Q\` 比较列表答 false，\`F\` 试前缀**抛错**（\`isActionOrCommand(1)\` 抛 \`e.startsWith is not a function\`）。**两套 schema 强度可分且已实测**：文件 schema 拒未知上下文/未知动作/非数组 bindings；**运行时 schema 更弱**——未知上下文、未知动作、旧名、\`null\` 全过，只守形（\`context\` 与 \`bindings\` 必填、动作是 string|null）；\`documentPassesRuntimeSchema([])\` 为 **true**（"无块之每块皆过"），一块坏则 false。**上下文表与默认绑定表不是同一张**（29 上下文含 \`MessageSelector\`/\`DiffPanel\`，默认绑定已不再绑它们）。**保留键按次读取**：同一次调用本机 9 键、绑源码 macOS 词后 16 键（7 个 \`cmd\` 键只在 macOS 分支推入）。**惰性注册表**：\`p\` 登记的构造器只跑一次并被记住，\`builtCount()\` 计构造而非调用，问运行时检查不会多构造一个 schema。**关键取舍**：新宿主边界 1 处=**schema 名边界** \`src/plugin-chain-schema-aliases.ts\`（把 \`u\`/\`U\`/\`o\`/\`ue\`/\`Ue\`/\`Bm\`/\`A\` 七个名按**源码调用点**逐个绑到本产品已有 zod：\`u({…}).describe()\`→object、\`U(v9t)\`→enum、\`o()\`+\`regex/optional/nullable\`→string、\`ue(o(),o().nullable())\`→两参 record、\`Ue([…])\`→union、\`Bm()\`→null、\`A(ze())\`→array；映射**可观测**：套件用两套 schema 实写一份 keybindings 文档并断言其收/拒）；同模块邻居 \`Ace\` [10481,10621) 140u 与 \`ge\` [11037,11145) 108u（行读取器 + 旧名改写器）**以断言排除并不入包**——\`ge\` 需要 lodash \`mapValues\`，该 chunk 未声明 \`oo\`（模块内唯一 \`oo=\` 是名为 \`$oo\` 的 state store），写入 next_package。**验收**：check/build/notices（摘要未变）、两副本 \`unresolved 0\`、span \`total 0\`、**${chain}**、账本逐段回源 + acorn（15 语句、完整、无重叠/无切半/无重复）+ **15 处正文逐字入 seam** + 12 处区间 + 18 名自有/18 名再导出 + 13 名被导入"不自声明且确在彼处" + 延迟体 \`Ace\`/\`ge\`/\`oo\` 三向排除 + 别名边界七名逐名绑定、站点表八套回归 ${siteSweep.passed}/${siteSweep.tests}、家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45KeybindingEditorCompiled.v1\`，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [绑定编辑器证据](ports/W45-keybinding-editor-evidence.json)、[Button+键盘表证据](ports/W45-button-keys-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at2 = current.indexOf(anchor);
if (at2 < 0) throw new Error('the C-12 row was not found');
write('research/CURRENT.md', current.slice(0, at2) + row + '\n' + current.slice(at2));

const features = read('research/FEATURES.md').replace(new RegExp(`${marks.features.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^|]*`), '');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('the interactive feature row was not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-67 completes the keybinding module: ` +
  'the key parser and the chord splitter, the six legacy action names with the check that reads them, the 29 ' +
  'binding contexts and theirs, the action-or-command check, the reserved keys for the platform the build runs ' +
  'on, and the two schemas a keybindings file is read through — the file schema that checks the values and the ' +
  'weaker runtime schema that holds the shapes afterwards — with the seven schema names bound to this product\'s ' +
  'own zod. |';
write('research/FEATURES.md', lines.join('\n'));

const standardText = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standardText.indexOf('2026-10-16 W45-66 ');
if (standardAt < 0) throw new Error('coding-standard W45-66 line not found');
const standardEntry = `2026-10-16 W45-67 绑定编辑器（键盘模块收口）：S-1至S-7已对照。S-1（先读源）：**先量后切**——\`mJ\` 闭包只有自身一语句 624u（\`lcs\`/\`F\`/\`ze\`/\`Bn\`/\`fe\`/\`He\` 各自独立成语句，逐个量过再切）；\`ze\`/\`Bn\` 那条 900u 是**一个 var 语句两个 schema**，故整条入包；\`i\`/\`RTr\`/\`p\` 三语句 350u 在另一个 chunk（\`chunk-fdwn5gdv.js\`）且被 \`as const\` 无涉，直接按区间搬。S-2（不留半包）：**新宿主边界 1 处**——源码两套 schema 走**自带 zod 的 7 个别名**（\`u\`/\`U\`/\`o\`/\`ue\`/\`Ue\`/\`Bm\`/\`A\`），本产品已有 zod，故新建 \`src/plugin-chain-schema-aliases.ts\` **按调用点逐个**绑定（含 \`describe/regex/optional/nullable\` 的用法证据），不重搬一份 zod；同模块剩余 \`Ace\`/\`ge\` 双向断言**不在副本内**（\`ge\` 依赖 lodash \`mapValues\`=\`oo\`，该 chunk 未声明该名，写入 next_package）。S-3（先测后断言）：\`.audit/w45-67-probe.ts\` + \`.audit/w45-67-probe-b.ts\` 先跑再写 14 条用例；**实测出四处非显然行为**——① **解析器与规范化器不同**（\`mJ\` 保留 meta/super 分开、\`Ye\` 折叠 meta 进 alt）；② **chord 特判只认恰好一个空格**（\`"  "\`/\`""\` 得一个空键而非 0 键）；③ **两处成员检查非字符串行为不同**（\`Q\` 答 false、\`F\` 抛 \`startsWith\`）；④ **运行时 schema 确实更弱**（未知上下文/动作/旧名/null 全过；\`T([])\` 为 true）。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器（67 计划）与 15 个编译驱动，断言两副本 \`unresolved 0\`、span \`total 0\`、notices 摘要未变；acorn 逐段回源（15 语句、完整、无重叠/无切半/无重复）+ 15 处正文逐字入 seam + 12 处区间 + 18 名自有与 18 名再导出逐一核对 + 13 个被导入名"不自声明/确在彼处" + 延迟体三向排除（源码有、副本无、seam 不导出）+ 别名边界七名逐名绑定向断言。S-5/S-6：editor seam 给 9 个按名包装（\`parseKeyBinding\`/\`splitChord\`/\`isLegacyAction\`/\`isKnownContext\`/\`isActionOrCommand\`/\`reservedKeysForPlatform\`/\`keyBindingBlockSchema\`/\`keyBindingsFileSchema\`/\`runtimeKeyBindingBlockSchema\`/\`blockPassesRuntimeSchema\`/\`documentPassesRuntimeSchema\`）与 6 个按名常量；测试只经 seam。S-7：行读取器 \`Ace\`/\`ge\`（+lodash \`oo\` 绑定决策）、\`tno\` 叶表与深度遍历器、React \`Tc(jo,…)\`、其余 \`$\` 表项、\`G2e\`、\`y9e\` 读路径写入 next_package。验收：check/build/notices、两副本 unresolved 0、${chain}、账本与正文自证、站点表八套 ${siteSweep.passed}/${siteSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。**键盘模块至此除行读取器外全数入产品。**\n`;
write('research/coding-standard.md', standardText.slice(0, standardAt) + standardEntry + standardText.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAnchor = 'W45-66: the Button, and the keybinding tables';
const statusAt = status.indexOf(statusAnchor);
if (statusAt < 0) throw new Error('STATUS W45-66 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = 'W45-67: the keybinding editor. The module is now complete but for its row reader: W45-66 took the ' +
  'tables a Button is measured against and this package takes the check a keybindings file is read through — the key ' +
  'parser, the chord splitter, the six legacy action names and the check that reads them, the 29 contexts and theirs, ' +
  'the action-or-command check, the reserved keys for the platform the build runs on, and the two schemas with the ' +
  'runtime checks that ask them. Two differences are worth the reading they took. The parser is not the comparison ' +
  'normaliser one package over: `Ye` folds `meta` into `alt` so two spellings of one key compare equal, while `mJ` ' +
  'keeps `meta` and `super` apart because a binding is stored as flags. And the runtime schema is genuinely weaker ' +
  'than the file schema — a context outside the 29, an action outside the 174 and a legacy name all pass it — because ' +
  'the values were checked once, when the file was read; the two checks that ask it answer `true` for an empty ' +
  'document and `false` for one bad block in two. The package is 15 blocks and 3,091 units over two modules, and it ' +
  'adds one boundary of the same kind as the fs boundary W45-46 bound: the seven names the copied bodies reach their ' +
  'bundled zod by are bound to the zod this product already depends on, each one read off the call site that uses it ' +
  'and made observable by a suite that writes a keybindings document through both schemas. Evidence: ' +
  '`research/ports/W45-keybinding-editor-evidence.json`, and\n[工作包](ports/W45-chain-runner.md).\n\n';
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-67 ported the keybinding editor (2026-10-16)

The keybinding module is complete but for its row reader. W45-66 took the tables a Button is measured against; this
package takes the editor — what a keybindings file is checked against when it is read, and again when it is used. The
key parser and the chord splitter, the six legacy action names with the check that reads them, the 29 contexts with
theirs, the action-or-command check, the reserved keys for the platform the build runs on, and the two schemas with the
runtime checks that ask them: fifteen blocks, 3,091 units, fifteen statements over two modules.

The parser turned out not to be the function one package over, and that is the first thing reading bought. \`Ye\`, the
normaliser W45-66 ported, folds \`meta\` into \`alt\` so that \`meta+up\` and \`opt+up\` compare equal. \`mJ\` keeps
\`meta\` and \`super\` apart, because what it answers is not a name to compare but the record a binding is stored as —
the key plus five flags. It splits on \`+\` alone, so a chord keeps its space inside a key, and the four short aliases
and the four arrow glyphs resolve before anything else. The chord splitter beside it answers the exact single space
first, which is why two spaces and an empty chord both come back as one empty key rather than no keys at all.

The second thing reading bought is the shape of the check. The file schema checks the values: a context from the 29, an
action the engine knows, one of the six legacy names, a \`command:\` pattern or \`null\` to unbind. The runtime schema
holds the shapes only, and it is weaker by measurement rather than by intention — an unknown context, an unknown action
and a legacy name all pass it — because the values were checked once, when the file was read. The two checks that ask it
are correspondingly plain: one block against the schema, and a document as an array whose every block passes, which
answers \`true\` for an empty array and \`false\` for one bad block in two.

The one boundary this package adds is a second one of the kind W45-46 bound. The copied bodies build their schemas
through seven names that reach the application's bundled zod — \`u\`, \`U\`, \`o\`, \`ue\`, \`Ue\`, \`Bm\`, \`A\` — and
this product already depends on zod, so src/plugin-chain-schema-aliases.ts binds those names to it, one name per call
site: an object schema with \`describe\` hanging off it, an enum from an array of literals, a string with \`regex\` and
\`optional\`, a two-argument record, a union, null, and an array of a schema. The mapping is observable rather than
nominal, because the suite writes a keybindings document through both schemas and asserts what each accepts and refuses.

The row reader is what is left, and it is left deliberately. \`Ace\` flattens blocks into rows and \`ge\` rewrites the
legacy names as it goes, through lodash \`mapValues\` under this chunk's name \`oo\` — and this chunk does not declare
that helper: the one \`oo=\` in it is a state store called \`$oo\`. The map-values copy the product carries came from a
different chunk, so the package that takes the reader decides how the two are bound. Both bodies are asserted absent
here, in the source, in the copy and in the seam.

Verified: check/build/notices, both scanned copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, the ledger re-read from
its modules and matched against the copy with acorn (15 statements, whole and contiguous, no cut, no repetition), fifteen
body slices quoted verbatim in the seam with twelve ranges cited, the eighteen names the copy owns and re-exports counted
and checked one by one, the thirteen imported names asserted absent as declarations and present in the export lists that
own them, the deferred bodies excluded three ways, and the alias boundary's seven bindings asserted one at a time. The
suites ${siteSweep.passed}/${siteSweep.tests} across the eight site-table and leaf files, ${familyLine}, full ${fullLine},
${drivers.length} compiled drivers (the shared driver now also prints \`W45KeybindingEditorCompiled.v1\`,
${sharedMarkers.length} markers in the shared run and ${allMarkers} across every driver), and the packaged smoke (${smoke}).
Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: the row reader with its mapper and the lodash binding it needs; then the leaf table \`tno\` with the depth walker
that reads it, the React layer \`Tc(jo, …)\`, the remaining \`$\` table entries, the dispatcher \`G2e\`, and the settings
read path behind \`y9e\`.
`);

const rows = [
  ['2026-10-17T12:40:00Z', 'package', 'W45-67 补完绑定编辑器（键盘模块收口）（15 段 3,091 单位 / 15 语句）',
    'parseKeyBinding/splitChord/isLegacyAction/isKnownContext/isActionOrCommand/reservedKeysForPlatform/keyBindingBlockSchema/keyBindingsFileSchema/runtimeKeyBindingBlockSchema/blockPassesRuntimeSchema/documentPassesRuntimeSchema 成为产品面，6 个按名常量（KEY_CONTEXTS/KEY_CONTEXT_SET/LEGACY_ACTION_NAMES/LEGACY_ACTION_READ_AS/SCHEMA_REGISTRY/LAZY）；新宿主边界 1 处=src/plugin-chain-schema-aliases.ts（7 个 schema 名按调用点绑到本产品 zod）',
    'chunk-6ccen3s8.js 12 段 2,741u（mJ 624u / h9 83u / Z+Re 376u / Q 40u / v9t+We 385u / lcs 33u / F 57u / ze+Bn 900u / fe 81u / He 63u / Ve 48u / T 51u）+ chunk-fdwn5gdv.js 3 段 350u（i 303u / RTr 14u / p 33u）',
    '两轮实测（.audit/w45-67-probe.ts + .audit/w45-67-probe-b.ts + test/plugin-chain-keys-editor.test.ts + .audit/w45-24-compiled.mjs）：解析器保留 meta/super 而比较规范化器折叠、只按 + 切分、chord 特判只认恰好一个空格、两处成员检查对非字符串行为不同、运行时 schema 确实更弱（T([]) 为 true）；14/14 通过'],
  ['2026-10-17T12:44:00Z', 'decision', 'W45-67 新宿主边界：7 个 schema 名绑到本产品 zod，按调用点逐个读',
    '源码两套 schema 走自带 zod 的别名 u/U/o/ue/Ue/Bm/A；本产品已依赖 zod，故新建 seam 逐名绑定（u({…}).describe()/U(v9t)/o()+regex+optional+nullable/ue(o(),o().nullable())/Ue([…])/Bm()/A(ze())）',
    '不重搬 zod；映射可观测——套件用两套 schema 实写 keybindings 文档并断言其收/拒（含旧名与 command: 形式）',
    `editor 副本 15 段 3,091u sha 704f8427…；${chain}`],
  ['2026-10-17T12:48:00Z', 'finding', 'W45-67 队列实测：行读取器 Ace/ge 依赖的 lodash mapValues 该 chunk 未声明',
    'Ace [10481,10621) 140u 展开行、ge [11037,11145) 108u 经 oo(mapValues) 改写旧名；模块内唯一 oo= 是 $oo=Fe.state("keybindings")（state store），无 function oo(',
    '故本包把两者**三向排除**（源码在、副本无、seam 不导出）并写入 next_package：产品已带的 map-values 副本来自另一 chunk，绑定决策留给取读取器的包',
    'rg 实测：chunk-6ccen3s8.js 无 function oo(；Ace/ge 切片与源码逐字比对'],
  ['2026-10-17T12:52:00Z', 'finding', 'W45-67 计划从 11 段扩到 15 段：h9/Q/Ve/T 四个邻居一并入包',
    'h9 [9463,9546) 83u=chord 切分、Q [10997,11037) 40u=旧名判定、Ve [19801,19849) 48u=单块过运行时 schema、T [19849,19900) 51u=文档过校验；四者都被包内其它体直接调用',
    '复跑 copy-module-regions 得 15 段 3,091u（未变 15 语句、unresolved 0），链校验器 67 计划通过，站点组由 99 补到 102',
    `editor 副本 sha 704f8427…（11 段版本 fdaf2dfd… 作废）；${chain}`],
  ['2026-10-17T12:56:00Z', 'verification', `W45-67 验收：两副本 unresolved 0、span total 0、账本逐段回源 + acorn + 15 处正文逐字入 seam + 延迟体三向排除 + 被导入名双向核对 + 别名边界七名逐名断言、${chain}、站点表八套 ${siteSweep.passed}/${siteSweep.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 编译驱动与打包冒烟`,
    '键盘模块至此除行读取器（Ace/ge + lodash oo 绑定）外全数在产品内；下一包取行读取器或 tno 叶表+深度遍历器',
    `check/build/notices（摘要未变）；两副本 unresolved 0；span total 0；${chain}；15 段逐段回源比长度与内容 + acorn（15 语句、完整、无重叠/无切半/无重复）+ 无重复断言；15 处正文逐字入 seam + 12 处区间 + 18 名自有/18 名再导出 + 13 名被导入；延迟体 Ace/ge/oo 三向排除；别名边界 u/U/o/ue/Ue/Bm/A 与 SCHEMA_LIBRARY/SCHEMA_ALIASES 逐项断言；站点表八套 ${siteSweep.passed}/${siteSweep.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 编译驱动 exit 0（共享驱动输出 W45KeybindingEditorCompiled.v1，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-67 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-67 acceptance (2026-10-16)

- [x] **The measurement picked the cut, twice.** The module's eleven statements the queue named went in first; the four neighbours that read them — the chord splitter, the legacy-name check and the two runtime checks — were measured, found to be called by the bodies already in, and the plan was widened from 11 blocks to 15 before anything was written.
- [x] **The parser and the normaliser are not the same function, and that is asserted.** \`mJ\` keeps \`meta\` and \`super\` apart because a binding is stored as flags; \`Ye\` folds them because a key is compared as a string. Both are in the product and the suite pins the difference.
- [x] **The weaker schema was measured, not assumed.** An unknown context, an unknown action and a legacy name all pass the runtime schema; \`documentPassesRuntimeSchema([])\` is true and one bad block in two is false. A paragraph that had described the schema from reading alone was rewritten after the probe contradicted it.
- [x] **One boundary, and it is declared rather than improvised.** The seven schema names are bound to the zod this product already depends on, one name per call site, and the mapping is observable because the suite writes a keybindings document through both schemas.
- [x] **The deferred body is excluded three ways.** The row reader and its mapper are present in the source, absent from the copy and not exported by the seam — and the record names why: \`ge\` needs lodash \`mapValues\`, which this chunk does not declare.
- [x] **Sweep.** check/build/notices, both copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, the ledger with acorn, the seam's verbatim quotes, ranges and re-exports, the site-table suites ${siteSweep.passed}/${siteSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
const written = {
  'research/CURRENT.md': 'W45-67 **补完',
  'research/STATUS.md': '\nW45-67:',
  'research/coding-standard.md': '\n2026-10-16 W45-67 ',
  'research/ports/W45-chain-runner.md': '\n## W45-67 ported',
  '.audit/w45-runtime.todo.md': '\n## W45-67 acceptance',
};
for (const [path, mark] of Object.entries(written)) {
  const text = read(path);
  const found = text.split(mark).length - 1;
  if (found !== 1) throw new Error(`${path} holds ${found} entries for ${JSON.stringify(mark)}`);
  if ((text.match(/\\\`/g) ?? []).length !== 0) throw new Error(`${path} carries a backslash-escaped code span`);
}
const standardLines = read('research/coding-standard.md').split('\n').filter((line) => line.startsWith('2026-'));
if (new Set(standardLines).size !== standardLines.length) throw new Error('the coding standard repeats a one-line entry');
const stamps = read('.audit/w45-runtime.tsv').split('\n').filter((line) => line.startsWith('2026-10-17T12:')).map((line) => line.split('\t')[0]);
if (new Set(stamps).size !== stamps.length) throw new Error('the runtime trail repeats a timestamp');
console.log('documents written; identity', identity.sha256);
