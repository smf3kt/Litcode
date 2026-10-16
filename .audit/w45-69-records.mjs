// Write the W45-69 record from the artifacts themselves: the leaf table and the walkers that read it —
// the table that names the nine checks the site packages ported, the height a leaf takes, the text it
// contributes, the duplicate-key check — with the unified-diff parser the Code leaf's height needs and
// the four one-statement helpers under them.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 441, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 165, `validation ${identity.validation.files}`);
expect(identity.build.files === 305, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 69) throw new Error('the chain verifier did not pass 69 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const registry = read('scripts/verify-chain-copies.mjs');
for (const entry of ["['W45-leaf-walkers', 'plugin-chain-leaf-walkers-source']",
  "['W45-keybinding-rows', 'plugin-chain-keys-rows-source']"]) {
  if (!registry.includes(entry)) throw new Error(`the verifier does not register ${entry}`);
}
const at = (needle) => {
  const file = verifier.files.find((entry) => entry.product.includes(needle));
  if (!file) throw new Error(`the verifier does not carry ${needle}`);
  return file;
};
const walkersCopy = at('plugin-chain-leaf-walkers-source');
if (walkersCopy.blocks !== 15 || walkersCopy.units !== 4183) throw new Error(`the walker copy is ${JSON.stringify(walkersCopy)}`);
if (walkersCopy.sha256 !== '9158191165d3b81c77ee6b95bf3110bc76c9f332ce002bb1597ec0380bcd12ac') {
  throw new Error('the walker copy is not the one this package measured');
}
// The copies the nine checks are read out of are the ones the site packages measured; a package that
// moved under this one would make the table name a different body.
for (const [needle, blocks, units] of [
  ['plugin-chain-site-leaves-source', 8, 3557], ['plugin-chain-raster-sites-source', 8, 1980],
  ['plugin-chain-leaves-source', 3, 2785], ['plugin-chain-button-source', 1, 1612],
]) {
  const copy = at(needle);
  if (copy.blocks !== blocks || copy.units !== units) throw new Error(`${needle} changed size: ${JSON.stringify(copy)}`);
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

const walkersLedger = checkCopy('the walker copy', 'src/plugin-chain-leaf-walkers-source.ts', [
  ['chunk-n3ykh62m.js', 236820, 237297, 477], ['chunk-n3ykh62m.js', 237297, 237337, 40],
  ['chunk-n3ykh62m.js', 238357, 238438, 81], ['chunk-n3ykh62m.js', 238917, 239033, 116],
  ['chunk-n3ykh62m.js', 259180, 259284, 104], ['chunk-n3ykh62m.js', 259284, 259432, 148],
  ['chunk-n3ykh62m.js', 259432, 259514, 82], ['chunk-n3ykh62m.js', 259514, 259714, 200],
  ['chunk-n3ykh62m.js', 259714, 260226, 512], ['chunk-n3ykh62m.js', 262308, 262627, 319],
  ['chunk-34bv7wfw.js', 9299, 11040, 1741], ['chunk-f606a53w.js', 7703, 7802, 99],
  ['chunk-kcwp0ct0.js', 17539, 17627, 88], ['chunk-ax7r0qj7.js', 3561, 3652, 91],
  ['chunk-nyce03br.js', 5956, 6041, 85],
], 20);
const walkersText = read('src/plugin-chain-leaf-walkers-source.ts');
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
const walkersNames = namesIn(walkersText);
const declared = (names, name) => names.declaredNames.has(name);
const ownNames = ['tno', 'ono', 'rno', 'Q4t', 'ano', 'IAt', 'nno', 'tso', 'Dto', 'vVe', 'J4t', 'HN', 'Lt', 'Int', 'lQt', 'kFe'];
for (const name of ownNames) {
  if (!declared(walkersNames, name)) throw new Error(`the walker copy does not carry ${name}`);
}
if (walkersNames.exportedNames.size !== ownNames.length) throw new Error('the walker copy exports a different count');
for (const name of ownNames) if (!walkersNames.exportedNames.has(name)) throw new Error(`the walker copy does not export ${name}`);
// The two constants share their statement with four the copy does not use, because the bundle declares
// them together: the statement is copied whole and the export list names only the two this module reads.
for (const name of ['Ybr', 'B3e', 'ESe', 'AFe']) {
  if (!declared(walkersNames, name)) throw new Error(`the walker copy lost the statement's ${name}`);
  if (walkersNames.exportedNames.has(name)) throw new Error(`the walker copy exports ${name}, which nothing reads`);
}
// The leaf checks and the string helpers are imports, never declarations here: they are read out of the
// copies that already carry them, which is the point of the table being one statement.
const walkersImports = {
  './plugin-chain-source.js': ['L', 'l'],
  './plugin-chain-text-clamp-source.js': ['ae'],
  './plugin-chain-normalize-source.js': ['Epe'],
  './plugin-chain-site-leaves-source.js': ['eno', 'jto', 'Lto', 'PAt', 'Zto'],
  './plugin-chain-raster-sites-source.js': ['Bto', 'Jto'],
  './plugin-chain-leaves-source.js': ['Mto', 'Vto'],
  './plugin-chain-button-source.js': ['Hto'],
};
const importedTotal = Object.values(walkersImports).flat();
for (const [source, names] of Object.entries(walkersImports)) {
  const line = new RegExp(`import \\{ ([^}]*) \\} from '\\./${source.slice(2)}'`).exec(walkersText);
  if (!line) throw new Error(`the walker copy does not import from ${source}`);
  const imported = line[1].split(',').map((name) => name.trim());
  for (const name of names) {
    if (!imported.includes(name)) throw new Error(`the walker copy does not import ${name} from ${source}`);
    if (declared(walkersNames, name)) throw new Error(`the walker copy declares ${name} instead of importing it`);
  }
}
if (walkersNames.importedNames.size !== importedTotal.length) throw new Error('the walker copy imports a different count');
const exportedBy = {
  'src/plugin-chain-source.ts': ['L', 'l'],
  'src/plugin-chain-text-clamp-source.ts': ['ae'],
  'src/plugin-chain-normalize-source.ts': ['Epe'],
  'src/plugin-chain-site-leaves-source.ts': ['eno', 'jto', 'Lto', 'PAt', 'Zto'],
  'src/plugin-chain-raster-sites-source.ts': ['Bto', 'Jto'],
  'src/plugin-chain-leaves-source.ts': ['Mto', 'Vto'],
  'src/plugin-chain-button-source.ts': ['Hto'],
};
for (const [path, names] of Object.entries(exportedBy)) {
  const text = read(path);
  for (const name of names) {
    const exported = new RegExp(`export (?:function|const|let|var|class) ${name}\\b|export \\{ [^}]*\\b${name}\\b`).test(text);
    if (!exported) throw new Error(`${path} no longer exports ${name}, which this package imports`);
  }
}
// The one name two copies both declare, and the measurement that says which one this walker means: the
// runner copy's `ae` is a plugin-state predicate, the text-clamp copy's is the width helper `nno` counts
// with, and the closure below names the second as coming out of chunk-yn0pfn70.js.
if (!/var ae=\(e\)=>e\.isCore===!0\|\|e\.isManaged===!0;|export \{ [^}]*\bae\b[^}]* \};/.test(read('src/plugin-chain-source.ts'))) {
  throw new Error('the runner copy no longer declares the plugin-state predicate named ae');
}
if (!read('src/plugin-chain-text-clamp-source.ts').includes('function ae(e){return Bun.stringWidth(e,z)}')) {
  throw new Error('the text-clamp copy no longer carries the width helper this package imports as ae');
}
const closure = execFileSync(process.execPath, ['.audit/w45-49-closure.mjs', 'chunk-n3ykh62m.js', 'ano', 'ono', 'rno', 'tno'], { encoding: 'utf8' });
if (!/81 statements, 16715 units/.test(closure)) throw new Error('the walker closure is no longer 81 statements / 16,715 units');
if (!/ae <- ae of .*chunk-yn0pfn70\.js/.test(closure)) throw new Error('the closure no longer reads its width helper out of the text-clamp chunk');

const scan = read('.audit/w45-69-scan.txt');
if ((scan.match(/unresolved 0/g) ?? []).length !== 2) throw new Error('the two scanned copies did not scan clean');
if (!scan.includes('imports ./plugin-chain-source.js, ./plugin-chain-text-clamp-source.js, ./plugin-chain-normalize-source.js, ./plugin-chain-site-leaves-source.js, ./plugin-chain-raster-sites-source.js, ./plugin-chain-leaves-source.js, ./plugin-chain-button-source.js')) {
  throw new Error('the walker scan does not name its seven imports');
}

// The seam: every body quoted (the three that hold a line break quoted head and tail), every range
// cited, and the names a caller reads.
const walkersSeam = read('src/plugin-chain-leaf-walkers.ts');
const elided = [];
let verbatim = 0;
for (const [module, start, end] of [
  ['chunk-n3ykh62m.js', 236820, 237297], ['chunk-n3ykh62m.js', 237297, 237337],
  ['chunk-n3ykh62m.js', 238357, 238438], ['chunk-n3ykh62m.js', 238917, 239033],
  ['chunk-n3ykh62m.js', 259180, 259284], ['chunk-n3ykh62m.js', 259284, 259432],
  ['chunk-n3ykh62m.js', 259432, 259514], ['chunk-n3ykh62m.js', 259514, 259714],
  ['chunk-n3ykh62m.js', 259714, 260226], ['chunk-n3ykh62m.js', 262308, 262627],
  ['chunk-34bv7wfw.js', 9299, 11040], ['chunk-f606a53w.js', 7703, 7802],
  ['chunk-kcwp0ct0.js', 17539, 17627], ['chunk-ax7r0qj7.js', 3561, 3652],
  ['chunk-nyce03br.js', 5956, 6041],
]) {
  const slice = read(`extracted-v2/modules/${module}`).slice(start, end);
  const lines = slice.split('\n');
  const multi = lines.length > 1;
  const head = multi ? lines[0] : slice.slice(0, 60);
  const tail = multi ? lines[lines.length - 1] : slice.slice(-60);
  if (!multi && walkersSeam.includes(slice)) {
    verbatim++;
    continue;
  }
  elided.push([module, start, end].join(' '));
  if (!walkersSeam.includes(head) || !walkersSeam.includes(tail)) {
    throw new Error(`the walker seam does not quote the head and tail of ${module} [${start},${end})`);
  }
  if (!walkersSeam.includes('\u2026')) throw new Error(`the walker seam marks no elision for ${module} [${start},${end})`);
  if (multi && walkersSeam.includes(`${head}\n`) && walkersSeam.includes(`\n${tail}`)) {
    throw new Error(`the walker seam quotes ${module} [${start},${end}) across its line break instead of eliding it`);
  }
}
if (verbatim !== 12) throw new Error(`the seam quotes ${verbatim} bodies verbatim, not 12: ${elided.join('; ')}`);
if (elided.length !== 3) throw new Error(`the seam elides ${elided.length} bodies, not 3: ${elided.join('; ')}`);
for (const range of [
  '[236820,237297) 477', '[237297,237337) 40', '[238357,238438) 81', '[238917,239033) 116',
  '[259180,259284) 104', '[259284,259432) 148', '[259432,259514) 82', '[259514,259714) 200',
  '[259714,260226) 512', '[262308,262627) 319', '[9299,11040) 1,741', '[7703,7802) 99',
  '[17539,17627) 88', '[3561,3652) 91', '[5956,6041) 85',
]) {
  if (!walkersSeam.includes(range)) throw new Error(`the walker seam does not cite ${range}`);
}
for (const name of ['LEAF_TABLE', 'LEAF_LINE_CAP', 'LEAF_WRAP_WIDTH', 'leafHeight', 'leafText',
  'flattenLeafText', 'duplicateLeafKey', 'emittedLines', 'textWidthWithin', 'diffHunks', 'diffReadFor',
  'parseUnifiedDiff', 'sanitizeLeafText', 'expandLeadingTabs', 'countOccurrences', 'hunkGutterWidth',
  'SOURCE_BODIES']) {
  if (!walkersSeam.includes(name)) throw new Error(`the walker seam does not carry ${name}`);
}
for (const call of ['return ono(leaf);', 'return rno(leaf);', 'return Q4t(children);',
  'return ano(leaf, seen);', 'return IAt(text, width);', 'return nno(text, budget);',
  'return readDiff(text);', 'return tso(text);', 'return J4t(text);', 'return HN(text);',
  'return Int(hunk);']) {
  if (!walkersSeam.includes(call)) throw new Error(`a wrapper does not call the copied body: ${call}`);
}
if (!walkersSeam.includes('export const LEAF_TABLE = tno as LeafTable;')) throw new Error('the seam does not publish the table');
if (!walkersSeam.includes('const readDiff = Dto as (text: string) => DiffRead;')) throw new Error('the seam does not pin the reader\'s two arms');
const registryState = read('src/plugin-chain-registry-state.ts');
for (const name of ['LeafLike', 'LeafTable', 'DiffHunk', 'DiffRead']) {
  if (!registryState.includes(`export interface ${name}`) && !registryState.includes(`export type ${name}`)) {
    throw new Error(`the registry state does not carry ${name}`);
  }
}
const suite = read('test/plugin-chain-leaf-walkers.test.ts');
for (const name of ['LEAF_TABLE', 'leafText', 'flattenLeafText', 'leafHeight', 'duplicateLeafKey',
  'diffHunks', 'parseUnifiedDiff', 'diffReadFor', 'sanitizeLeafText', 'expandLeadingTabs',
  'textWidthWithin', 'emittedLines', 'countOccurrences', 'hunkGutterWidth', 'LEAF_LINE_CAP',
  'LEAF_WRAP_WIDTH', 'SOURCE_BODIES']) {
  if (!suite.includes(name)) throw new Error(`the suite does not exercise ${name}`);
}
if (suite.includes('plugin-chain-leaf-walkers-source.js')) throw new Error('the suite reaches past the seam to a copy');

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-69-full.txt');
if (full.failed !== 0 || full.tests !== 1718) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const suiteSweep = summary('.audit/w45-69-suite.txt');
if (suiteSweep.failed !== 0 || suiteSweep.tests !== 13) throw new Error('the new walker suite is not 13/13');
const family = summary('.audit/w45-69-family.txt');
if (family.failed !== 0 || family.tests !== 442) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const siteSweep = summary('.audit/w45-69-site.txt');
if (siteSweep.failed !== 0 || siteSweep.tests !== 136) throw new Error('the site-table sweeps are not clean');
const span = JSON.parse(read('.audit/w45-69-span.txt'));
if (span.total !== 0) throw new Error(`the span scan found ${span.total}`);
const notices = JSON.parse(read('.audit/w45-69-notices.txt').split('\n').filter((line) => line.startsWith('{')).at(-1));
if (notices.sha256 !== '384c78801194aedea80331383ccd93708c2dfa46bc746003dc112c930b73d13c') {
  throw new Error('the dependency-notice digest moved');
}
const smokeReport = read('.audit/w45-69-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 313) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
let allMarkers = 0;
for (const name of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${name}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers += out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).length;
}
const sharedMarkers = read('.audit/w45-69-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-69-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45LeafWalkersCompiled.v1')) throw new Error('the shared driver did not print the W45-69 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45LeafWalkersCompiled.v1 (${sharedMarkers.length} markers, ${allMarkers} across every driver: it reads the nine-type table and its refusals, the text and the height a leaf contributes, the diff reader the Code leaf's height needs, the duplicate-key sentence and the four helpers under them off the built output)`;

const evidence = {
  schema: 'W45LeafWalkersEvidence.v1',
  package: 'W45-69 — the leaf table and the walkers that read it',
  date: '2026-10-16',
  question: 'The nine leaf checks were ported one at a time; what names them, what walks the tree with them, and what does the tallest walker need that no package before it carried?',
  answer: 'One table, three walkers, a diff parser and four one-statement helpers. `tno` is the dispatch: the nine leaf types, each mapped to the check that refuses a bad leaf, every value a body another package already ported, so the table is what turns a leaf of unknown type into its own check and nothing else. `rno` is the text a leaf contributes — a Svg its alt, a Button its children joined (and its children win over its label when it has both), a Button or an Input its label, and every other type nothing at all — with the one case reading alone would get wrong: an Input without a label contributes the empty string, not nothing, because the two are different inputs to the height below. `ono` is that height: a Raster or an Image its own row count, a Markdown its line count, everything else one line plus the wrapped text it contributes, and a Code leaf the only one that needs parsing — its own line count answers while it is under the twelve-line cap, and past it the diff it holds decides, through the hunks it adds, the gutter the line numbers take when the source starts at a known line, and whether the answer is the truncation. `ano` is the duplicate check: only the six types that carry a key are looked at, only when the props really are an object and the key really is a string, and the set is keyed by type and key together, so the same key under two types is not a duplicate. The parser behind the Code leaf (`tso`) is the largest body in the package and the reader over it (`Dto`) is what the walker calls: the reader drops the parser\'s no-newline marker lines, checks each header to be `@@ -a,b +c,d @@` with all four numbers safe integers inside a billion lines, and answers a refusal value rather than throwing. Nothing under those bodies is copied: the nine checks, the two string helpers and the error describer are read by name out of the copies that already carry them (14 names over seven copies), and the package adds no host boundary. One measurement decided an import: two copies declare `ae`, and the closure names the width helper out of the text-clamp chunk rather than the runner copy\'s plugin-state predicate, so the import was written against the closure, not the name.',
  ported: walkersLedger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  planExtensions: [
    {
      plan: 'research/ports/W45-leaf-walkers-blocks.plan.json',
      what: 'a new plan, fifteen blocks and sixteen exports across five modules',
      blocks: '0 → 15 blocks, 4,183 units, 20 statements',
      why: 'the table and the three walkers are ten statements of the leaf chunk; the diff parser they reach for past the cap is one 1,741-unit statement of another chunk, and the four helpers are one statement each of three more, all of them whole statements rather than fragments',
    },
  ],
  boundary: 'No new host boundary. Every leaf check the table names and every helper the walkers call is imported by name from a copy that already carries it — the nine checks from the four site-table copies, the width helper from the text-clamp copy, the error describer from the normalize copy, and the two string helpers from the runner copy — so this package changes no other package\'s artifact and adds no bindings to the host seam.',
  measured: [
    'The table names all nine types and each is the check its own package ported: measured through the table, an empty-props leaf of every type is refused with the sentence that package\'s suite already asserts, one by one.',
    'A leaf\'s text is its own: measured, a Svg contributes its alt, a Button without children its label, a Button with children the children joined rather than the label, an Input its label, and every other type nothing at all.',
    'An Input without a label contributes the empty string rather than nothing: measured, `[""]` against `[]` for the other types, and the two are different inputs to the height walker.',
    'The children under a leaf are flattened depth first, and a child that is neither a string nor an object throws rather than answering: measured, `Cannot use \'in\' operator to search for \'children\' in 1`.',
    'A Raster and an Image answer their own row count, a Markdown its line count, and everything else one line plus its wrapped text: measured, 7 rows, 3 lines and 1 line respectively.',
    'A Code leaf\'s height is the only one that parses: measured on one diff, 9 lines as a diff against 9 as a source (the parser is never reached without the format), 8 when the end is truncated, and 9 with a start line that widens the gutter.',
    'The duplicate check is keyed by type and key together: measured, the same key under two types is admitted, a leaf with no key is never a duplicate, and a key that is not a string is not looked at.',
    'The reader drops the parser\'s marker lines and refuses by value: measured, the parser keeps `\\ No newline at end of file` in its hunk and the reader\'s hunk does not carry it, text with no header at all answers `no @@ hunk header found`, a header that is not a header names the hunk that failed, and the parser\'s own count-mismatch throw comes out of the reader as a refusal with the parser\'s wording.',
    'The width helper is counted, not guessed: measured, a tab contributes a stop\'s worth of width and the reading stops past the budget rather than at it (a budget of 2 over `ab\\tcd\\nef` answers 4).',
    'Two copies declare `ae`: the runner copy\'s is a plugin-state predicate and the text-clamp copy\'s is `Bun.stringWidth`\'s wrapper. The closure reports the walker\'s `ae` as coming out of the text-clamp chunk, so the import is written against the closure — measured before the import was written, because the first probe answered 0 for a width that is 6.',
    'Walking the walkers\' dependency graph naively is 81 statements and 16,715 units, 29 imported names among them; the product already carries the nine checks, the helpers and the parser, so the package adds the table and the walkers rather than the closure.',
  ],
  regressions: `the new walker suite ${suiteSweep.passed}/${suiteSweep.tests} inside the nine site-table, leaf and keybinding files (${siteSweep.passed}/${siteSweep.tests}); ${familyLine}`,
  full: fullLine,
  compiled: driverLine,
  smoke,
  next_package: [
    'the React layer: `Tc(jo, { key: `raster:${plugin}:${key}`, ... })` in chunk-kjfwbh4w.js',
    'the remaining `$` table entries, each measured before it is taken: `ui.scroll`, `ui.focus`, `ui.copy` (blocked on the clipboard encoder `Sv`), `state.get`/`state.set`, `fs.ancestors`',
    'the plugin-facing `$` dispatcher `G2e` (chunk-sfn1dbxq.js [2356082,…)), which applies `raise` then `stamp` then `run`',
    'the settings read path behind `y9e` — 590 statements / 327,047 units, 318,262 of them fresh — walked in pieces; the managed-settings gate `CT` and `Tp`; Q-086\'s 15 registry-reading cores and their 34 sites; the notification provider `a4n`',
  ],
};
write('research/ports/W45-leaf-walkers-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);

const marks = {
  current: 'W45-69 **收口',
  features: '; W45-69 closes the leaf table and the walkers that read it',
  standard: '2026-10-16 W45-69 ',
  status: 'W45-69:',
  runner: '## W45-69 ported the leaf table and the walkers that read it',
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
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-69 **收口叶表与读它的三个遍历器**（W45-60..66 把九张叶检查逐个搬进产品，本包搬的是**点名它们的表**与**画树时跑的三个遍历器**——叶有多高、贡献什么文本、键是否画了两次——外加 Code 叶过 12 行后要用的 diff 解析器）：**15 段 4,183 单位 / 20 语句**（chunk-n3ykh62m.js [259180,259284) 104u **\`tno\` 叶表**、[259714,260226) 512u **\`ono\` 叶高**、[259514,259714) 200u **\`rno\` 叶文本**、[262308,262627) 319u **\`ano\` 重键检查**、[259284,259432) 148u \`nno\` 预算内宽度、[259432,259514) 82u \`IAt\` 折行行数、[236820,237297) 477u **\`Dto\` diff 读取器**、[237297,237337) 40u \`vVe\` 按格式取读取器、[238357,238438) 81u \`J4t\` 双向控制符擦洗、[238917,239033) 116u \`Q4t\` children 展平；chunk-34bv7wfw.js [9299,11040) 1,741u **\`tso\` 统一 diff 解析器**；chunk-f606a53w.js [7703,7802) 99u \`HN\` 前导制表符展开、chunk-kcwp0ct0.js [17539,17627) 88u \`Int\` 行号栏宽、chunk-ax7r0qj7.js [3561,3652) 91u \`Lt\` 计数、chunk-nyce03br.js [5956,6041) 85u 常量 \`lQt=40\`/\`kFe=12\`）。**语义（源文实测）**：**表=九型各一张检查**（空 props 的叶被自己那一句拒，九句逐条入测试）；**文本**：Svg 给 alt、Button 给 children 拼接（**有 children 时 label 让位**）、Button/Input 给 label、**无 label 的 Input 给空串而非不贡献**、其余类型不贡献；**高度**：Raster/Image 给行数、Markdown 给行数、其余 1 行 + 折行文本；**只有 Code 叶需要解析**——源行数在 \`kFe=12\` 内直接答，过界交给 \`Dto\`：hunk 数、\`startLine\` 已知时的行号栏宽（\`Int\`）、\`truncate-end\` 时只加 hunk 数（同一 diff 实测 9 / 截断 8 / startLine 100 得 9，且 format 非 diff 时**根本走不到解析器**）；\`Dto\` **丢解析器的反斜杠标记行**且**以值拒绝而非抛**（无头句、点名第几个 hunk、解析器的计数不符原话照传）；**重键检查**只认六型 + 字符串键，键与类型同串才算重复（同键异型放行）。**关键取舍**：新宿主边界 0；九张检查与帮手**全部按名从既有副本导入**（14 名 / 7 个副本，未动他人任何产物）；**一次名字撞车实测**：runner 副本也导出 \`ae\`（插件态谓词），闭包里的 \`ae\` 是 text-clamp 副本的 \`Bun.stringWidth\` 包装——先量后导，故取后者（首探按名字猜曾得 0 而真值 6）。**验收**：check/build/notices（摘要未变）、两副本 \`unresolved 0\`、span \`total 0\`、**${chain}**、账本逐段回源 + acorn（20 语句、完整、无重叠/无切半/无重复）+ 15 处正文（12 处逐字 + 3 处含真换行者首尾入 seam 并标省略）+ 15 处区间 + 16 名自有/16 名导出/14 名被导入双向核对 + 并列声明恒量 4 名不导出 + \`ae\` 撞车双向断言 + 朴素闭包复测 81 语句/16,715 单位且宽度帮手来自 chunk-yn0pfn70.js + registry-state 新增四类型、站点表九套回归 ${siteSweep.passed}/${siteSweep.tests}、家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45LeafWalkersCompiled.v1\`，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [叶表与遍历器证据](ports/W45-leaf-walkers-evidence.json)、[行读取器证据](ports/W45-keybinding-rows-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
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
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-69 closes the leaf table and the walkers that read it: ` +
  'the table that names the nine leaf checks, the height a leaf takes (a Code leaf past the twelve-line cap is ' +
  'measured through the diff it holds, by a parser of its own), the text it contributes, the depth-first flatten ' +
  'of its children, and the duplicate-key check that refuses the second leaf to take a key. |';
write('research/FEATURES.md', lines.join('\n'));

const standardText = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standardText.indexOf('2026-10-16 W45-68 ');
if (standardAt < 0) throw new Error('coding-standard W45-68 line not found');
const standardEntry = `2026-10-16 W45-69 叶表与遍历器：S-1至S-7已对照。S-1（先读源）：**先量后切**——四颗种子 \`ano\`/\`ono\`/\`rno\`/\`tno\` 的闭包实测 **81 语句 / 16,715 单位 / 29 导入**，其中九张检查与全部帮手已在四个站点表副本、宽度帮手在 text-clamp 副本、错误描述在 normalize 副本；故只切**表与遍历器本身 + Code 叶过界所需的解析器**（15 段 4,183u），其余**按名导入**。**一次名字撞车靠实测拆开**：runner 副本也导出 \`ae\`（\`e.isCore===!0||e.isManaged===!0\`），而闭包里的 \`ae\` 来自 chunk-yn0pfn70.js（\`Bun.stringWidth\` 包装）——按名字导入会静默换成另一个函数（首探因此答 0，真值 6），故导入前先跑闭包确认来源。S-2（不留半包）：**新宿主边界 0**，**未改动任何他人产物**（14 个导入名逐一回源确认仍导出）。S-3（先测后断言）：\`.audit/w45-69-probe{,b}.ts\` 先跑再写 13 条用例；**实测出五处非显然行为**——① 无 label 的 Input 贡献**空串**而不是不贡献；② Button 有 children 时**children 胜 label**；③ \`Dto\` **以值拒绝**并把解析器的计数不符原话照传（\`Added line count did not match for hunk at line 3\`）；④ \`format\` 非 diff 时**解析器从不被调用**（同文得 9 而非解析后的值）；⑤ \`nno\` 的停止**越过**预算而不是停在预算上（预算 2 答 4）。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器（69 计划）与全部编译驱动、并**再跑闭包工具**断言 81/16,715 与"宽度帮手来自 chunk-yn0pfn70.js"；断言两副本 \`unresolved 0\`、span \`total 0\`、notices 摘要未变；acorn 逐段回源（20 语句、完整、无重叠/无切半/无重复）+ 15 处正文（12 逐字 + 3 首尾）+ 15 处区间 + 16 名自有/16 名导出/14 名被导入 + 并列恒量 4 名不导出 + \`ae\` 双向断言。S-5/S-6：seam 给 13 个按名包装与 4 个常量/表导出，测试只经 seam。S-7：React \`Tc(jo,…)\`、其余 \`$\` 表项、\`G2e\`、\`y9e\` 读路径、\`CT\`/\`Tp\`/Q-086/\`a4n\` 写入 next_package。**站点表一侧（九张检查 + 表 + 遍历器）至此全数入产品。**验收：check/build/notices、两副本 unresolved 0、${chain}、账本与正文自证、站点表九套 ${siteSweep.passed}/${siteSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standardText.slice(0, standardAt) + standardEntry + standardText.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAnchor = 'W45-68: the keybinding module\'s row reader';
const statusAt = status.indexOf(statusAnchor);
if (statusAt < 0) throw new Error('STATUS W45-68 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = 'W45-69: the leaf table and the walkers that read it. The nine leaf checks were ported one at a ' +
  'time by the site-table packages; what was never carried is the table that names them and the three walkers the ' +
  'pane that draws leaves runs over a tree. The table is the dispatch: nine leaf types, each mapped to the check ' +
  'that refuses a bad one, every value a body another package already ported, so a caller holding a leaf of ' +
  'unknown type reads its own check out of the table. The walkers are what a tree costs to draw — the text a leaf ' +
  'contributes (a Svg\'s alt, a Button\'s children joined and winning over its label, an Input\'s label, the empty ' +
  'string when an Input has none), the height it takes (a Raster\'s or an Image\'s rows, a Markdown\'s lines, one ' +
  'line plus its wrapped text for everything else, and for a Code leaf past the twelve-line cap the diff it holds, ' +
  'read by a parser of its own), and the duplicate check that refuses the second leaf to take a key. The parser is ' +
  'the largest body here, and the reader over it drops the parser\'s marker lines and answers a refusal value ' +
  'rather than throwing, so a malformed diff costs the pane a sentence rather than an exception. The package is 15 ' +
  'blocks and 4,183 units over five modules, and it adds no host boundary and changes no other package\'s artifact: ' +
  'the nine checks, the two string helpers, the width helper and the error describer are read by name out of the ' +
  'copies that already carry them — 14 names over seven copies. One name two copies both declare (`ae`) was ' +
  'resolved by measurement rather than by name: the walker means the text-clamp copy\'s width helper, not the ' +
  'runner copy\'s plugin-state predicate. Evidence: ' +
  '`research/ports/W45-leaf-walkers-evidence.json`, and\n[工作包](ports/W45-chain-runner.md).\n\n';
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-69 ported the leaf table and the walkers that read it (2026-10-16)

The site-table side is complete. W45-60 to W45-66 took the nine leaf checks one at a time; this package takes
the table that names them and the three walkers the pane that draws leaves runs over a tree — fifteen blocks,
4,183 units, twenty statements over five modules, and no host boundary added.

The table is the dispatch, and it is one statement: the nine leaf types, each mapped to the check that refuses
a bad leaf. Every value is a body another package already ported, so what the table adds is the answer a caller
holding a leaf of unknown type asks for, and what it costs is nothing — it is imported around rather than
copied again. The three walkers are what a tree costs to draw. \`rno\` is the text a leaf contributes: a Svg's
alt, a Button's children joined (and its children win over its label when it has both), a Button's or an
Input's label, and nothing for the rest of the types — with the one case reading alone would have got wrong,
an Input without a label contributing the empty string rather than nothing. \`ono\` is the height that text
takes: a Raster's or an Image's rows, a Markdown's lines, one line plus the wrapped text for everything else,
and for a Code leaf the only answer that needs parsing — its own line count while it is under the twelve-line
cap, and past it the diff it holds, through the hunks it adds, the gutter its line numbers take and whether
the answer is the truncation. \`ano\` is the duplicate check, keyed by type and key together, so the same key
under two types is admitted and only the second sighting of one leaf is refused.

The parser behind the Code leaf's height is the largest body in the package and the reason it is here: the
reader over it (\`Dto\`) drops the parser's no-newline marker lines, checks each header to be \`@@ -a,b +c,d @@\`
with all four numbers safe integers inside a billion lines, and answers a refusal value rather than throwing —
so a malformed diff costs the pane a sentence, and the parser's own count-mismatch wording reaches the caller
inside that sentence. The four helpers under the walkers are one statement each: the tab expansion a width
measurement needs, the counter, the gutter width, and the two constants the cap and the wrap width are, which
the bundle declares in one statement with four others this module does not read.

One import was decided by measurement rather than by name. Two copies declare \`ae\`: the runner copy's is a
plugin-state predicate, and the text-clamp copy's is the width helper the walkers count with. The closure
reports the walker's \`ae\` as coming out of the text-clamp chunk, so the import is written against the closure;
importing by the name alone would have silently substituted a predicate for a measurement, and the first probe
answered 0 for a width that is 6. Beyond that the package reaches outside itself only to read: the nine checks,
the two string helpers, the width helper and the error describer are 14 names imported from seven copies that
already carry them, and no other package's artifact changes.

Verified: check/build/notices, both scanned copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, the ledger
re-read from its modules and matched against the copy with acorn (20 statements, whole and contiguous, no cut,
no repetition), fifteen bodies quoted in the seam — twelve verbatim and the three that hold a real line break
quoted head and tail with the elision marked — with fifteen ranges cited, the sixteen names the copy owns and
the sixteen it exports counted and checked one by one, the four constants that share the statement asserted
present but not exported, the fourteen imported names asserted absent as declarations and present in the export
lists that own them, both \`ae\` declarations asserted where the closure says they are, and the naive closure
re-measured at 81 statements / 16,715 units. Its suites ${suiteSweep.passed}/${suiteSweep.tests} alone and
${siteSweep.passed}/${siteSweep.tests} across the nine site-table, leaf and keybinding files, ${familyLine},
full ${fullLine}, ${drivers.length} compiled drivers (the shared driver now also prints
\`W45LeafWalkersCompiled.v1\`, ${sharedMarkers.length} markers in the shared run and ${allMarkers} across every
driver), and the packaged smoke (${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs by the record
script itself).

Next: the React layer \`Tc(jo, …)\`, the remaining \`$\` table entries, the dispatcher \`G2e\`, and the settings
read path behind \`y9e\`.
`);

const rows = [
  ['2026-10-17T13:22:00Z', 'package', 'W45-69 收口叶表与遍历器（15 段 4,183 单位 / 20 语句）',
    'LEAF_TABLE/leafHeight/leafText/flattenLeafText/duplicateLeafKey/emittedLines/textWidthWithin/diffHunks/diffReadFor/parseUnifiedDiff/sanitizeLeafText/expandLeadingTabs/countOccurrences/hunkGutterWidth 成为产品面，LEAF_LINE_CAP/LEAF_WRAP_WIDTH/SOURCE_BODIES；注册表新增 LeafLike/LeafTable/DiffHunk/DiffRead；新宿主边界 0，未改他人产物',
    'chunk-n3ykh62m.js [259180,259284) 104u tno + [259714,260226) 512u ono + [259514,259714) 200u rno + [262308,262627) 319u ano + [259284,259432) 148u nno + [259432,259514) 82u IAt + [236820,237297) 477u Dto + [237297,237337) 40u vVe + [238357,238438) 81u J4t + [238917,239033) 116u Q4t；chunk-34bv7wfw.js [9299,11040) 1,741u tso；chunk-f606a53w.js [7703,7802) 99u HN；chunk-kcwp0ct0.js [17539,17627) 88u Int；chunk-ax7r0qj7.js [3561,3652) 91u Lt；chunk-nyce03br.js [5956,6041) 85u lQt/kFe',
    '两轮实测（.audit/w45-69-probe{,b}.ts + test/plugin-chain-leaf-walkers.test.ts + .audit/w45-24-compiled.mjs）：九型空 props 各答自己那一句、Svg 给 alt/Button 给 children（胜 label）/无 label 的 Input 给空串、Raster 7 行 Markdown 3 行、同一 diff 得 9（截断 8、startLine 100 得 9、format 非 diff 得 9 不走解析器）、Q4t 遇非串非对象抛 in 运算符句、Dto 以值拒绝且照传解析器原话、nno 预算 2 答 4（越过而非停在预算）；13/13 通过'],
  ['2026-10-17T13:26:00Z', 'decision', 'W45-69 队列实测：叶遍历闭包 81 语句 16,715 单位，只切表与遍历器本身 15 段',
    '朴素遍历 ano/ono/rno/tno 闭包 = 81 语句/16,715 单位/29 导入；逐个查证：九张检查在四个站点表副本、宽度帮手在 text-clamp 副本、错误描述在 normalize 副本、L 与 l 在 runner 副本',
    '故只搬表/三个遍历器 + Code 叶过界所需的 tso 与四个一语句帮手（15 段 4,183u），14 个名字按名导入；未改任何他人计划或产物（对照 W45-68 的 internals 扩导出）',
    `walker 副本 15 段 4,183u sha 91581911…；${chain}`],
  ['2026-10-17T13:30:00Z', 'finding', 'W45-69 实测：两个副本都声明 ae，闭包里的那个是 text-clamp 的宽度帮手',
    'runner 副本：var ae=(e)=>e.isCore===!0||e.isManaged===!0（插件态谓词，亦在其 export 列表中）；text-clamp 副本：function ae(e){return Bun.stringWidth(e,z)}',
    '闭包输出 ae <- ae of /$bunfs/root/chunk-yn0pfn70.js 即后者；按名字导入会静默换成谓词——首探因此对宽度答 0，真值 6',
    '.audit/w45-69-probe.ts 与记录脚本的 ae 双向断言、test/plugin-chain-leaf-walkers.test.ts 的宽度用例共同钉住'],
  ['2026-10-17T13:34:00Z', 'finding', 'W45-69 站点表一侧（九张检查 + 表 + 遍历器）至此全在产品内',
    'W45-60..66 九张叶检查（Button/Client/Code/Image/Input/Markdown/Raster/Select/Svg）、W45-69 表 tno 与 ano/ono/rno 及 tso/Dto 与四个帮手',
    'next_package 五项：React Tc(jo,…)、其余 $ 表项、G2e、y9e 读路径、CT/Tp/Q-086/a4n',
    'source-undeclared-scan 两副本 unresolved 0；链校验器 69 计划通过'],
  ['2026-10-17T13:38:00Z', 'verification', `W45-69 验收：两副本 unresolved 0、span total 0、账本逐段回源 + acorn + 15 处正文（12 逐字 + 3 首尾）+ ae 撞车双向断言 + 闭包再测、${chain}、站点表九套 ${siteSweep.passed}/${siteSweep.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 编译驱动与打包冒烟`,
    '站点表一侧收口；下一包取 React 层 Tc(jo,…) 或其余 $ 表项',
    `check/build/notices（摘要未变）；两副本 unresolved 0；span total 0；${chain}；15 段逐段回源比长度与内容 + acorn（20 语句、完整、无重叠/无切半/无重复）+ 无重复断言；15 处正文（12 逐字、3 首尾并标省略）+ 15 处区间 + 16 名自有/16 名导出/14 名被导入 + 并列恒量 4 名不导出 + tso 头尾与 ae 双向断言；朴素闭包复测 81 语句/16,715 单位且宽度帮手来自 chunk-yn0pfn70.js；registry-state 四类型；站点表九套 ${siteSweep.passed}/${siteSweep.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 编译驱动 exit 0（共享驱动输出 W45LeafWalkersCompiled.v1，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-69 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-69 acceptance (2026-10-16)

- [x] **The measurement priced the cut before it was taken.** The walker closure is 81 statements, 16,715 units and 29 imported names at this chunk; the nine checks and every helper were already carried by copies in the product, so the package takes the table, the walkers, the parser they reach for and the four one-statement helpers under them, and imports the rest.
- [x] **The one name two copies declare was resolved by measurement, not by the name.** \`ae\` is a plugin-state predicate in the runner copy and the width helper in the text-clamp copy; the closure says which one the walkers mean, and the first probe proved the difference (0 against a width of 6).
- [x] **Nothing outside the package changed.** Unlike W45-68 there is no plan extension: the fourteen imported names are asserted present in the export lists that own them and absent as declarations here, so no other package's artifact moved.
- [x] **Every behaviour was measured before it was asserted,** including five reading alone would have got wrong: an Input with no label contributes the empty string, a Button's children win over its label, the diff reader refuses by value and carries the parser's own wording, a non-diff format never reaches the parser, and the width reading stops past its budget rather than at it.
- [x] **The seam quotes what it can and marks what it cannot.** Twelve bodies are quoted verbatim; the three that hold a real line break are quoted head and tail with the elision marked, and the record asserts each of the fifteen both ways rather than trusting the comment.
- [x] **The table is asserted against the bodies it names.** Each of the nine types is called through the table with an empty-props leaf and compared with the sentence its own package's suite already asserts, so a wrong mapping fails here rather than silently dispatching the wrong check.
- [x] **Sweep.** check/build/notices, both copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, the ledger with acorn, the seam's quotes and ranges, both \`ae\` declarations, the naive closure re-measured, the new suite ${suiteSweep.passed}/${suiteSweep.tests}, the site-table suites ${siteSweep.passed}/${siteSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
const written = {
  'research/CURRENT.md': 'W45-69 **收口',
  'research/STATUS.md': '\nW45-69:',
  'research/coding-standard.md': '\n2026-10-16 W45-69 ',
  'research/ports/W45-chain-runner.md': '\n## W45-69 ported',
  '.audit/w45-runtime.todo.md': '\n## W45-69 acceptance',
};
for (const [path, mark] of Object.entries(written)) {
  const text = read(path);
  const found = text.split(mark).length - 1;
  if (found !== 1) throw new Error(`${path} holds ${found} entries for ${JSON.stringify(mark)}`);
  if ((text.match(/\\\`/g) ?? []).length !== 0) throw new Error(`${path} carries a backslash-escaped code span`);
}
const standardLines = read('research/coding-standard.md').split('\n').filter((line) => line.startsWith('2026-'));
if (new Set(standardLines).size !== standardLines.length) throw new Error('the coding standard repeats a one-line entry');
const stamps = read('.audit/w45-runtime.tsv').split('\n').filter((line) => line.startsWith('2026-10-17T13:')).map((line) => line.split('\t')[0]);
if (new Set(stamps).size !== stamps.length) throw new Error('the runtime trail repeats a timestamp');
console.log('documents written; identity', identity.sha256);
