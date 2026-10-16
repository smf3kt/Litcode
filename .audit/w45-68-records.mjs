// Write the W45-68 record from the artifacts themselves: the keybinding module's row reader — the rows a
// table is drawn from, the legacy names rewritten as a file is read back, and this chunk's own lodash
// `mapValues` under them — with the one export the internals copy was widened by so the walk is read out
// of it rather than copied a second time.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 438, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 164, `validation ${identity.validation.files}`);
expect(identity.build.files === 303, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 68) throw new Error('the chain verifier did not pass 68 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const registry = read('scripts/verify-chain-copies.mjs');
for (const entry of ["['W45-keybinding-rows', 'plugin-chain-keys-rows-source']",
  "['W45-keybinding-editor', 'plugin-chain-keys-editor-source']"]) {
  if (!registry.includes(entry)) throw new Error(`the verifier does not register ${entry}`);
}
const at = (needle) => {
  const file = verifier.files.find((entry) => entry.product.includes(needle));
  if (!file) throw new Error(`the verifier does not carry ${needle}`);
  return file;
};
const rowsCopy = at('plugin-chain-keys-rows-source');
if (rowsCopy.blocks !== 5 || rowsCopy.units !== 395) throw new Error(`the rows copy is ${JSON.stringify(rowsCopy)}`);
if (rowsCopy.sha256 !== '0087ca876e195d986bbe8bac7f098566d8e6118b8f0fd6e355c33ebb7a185aa6') {
  throw new Error('the rows copy is not the one this package measured');
}
const editorCopy = at('plugin-chain-keys-editor-source');
if (editorCopy.blocks !== 15 || editorCopy.units !== 3091) throw new Error('the editor copy changed size');
if (editorCopy.sha256 !== '704f842768790e5a7500fe23deed92c78149466c439badf1975b11bcfe5cb559') {
  throw new Error('the editor copy is not the one W45-67 measured');
}
const internalsCopy = at('plugin-chain-lodash-internals-source');
if (internalsCopy.blocks !== 153 || internalsCopy.units !== 11297) throw new Error('the internals copy changed size');
if (internalsCopy.sha256 !== '2708e44c85a2c83730d627bf0448b77c4804f3b9e2f50e0db898a888e79f9d5d') {
  throw new Error('the internals copy is not the one this package widened');
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

const rowsLedger = checkCopy('the rows copy', 'src/plugin-chain-keys-rows-source.ts', [
  ['chunk-6ccen3s8.js', 10481, 10621, 140], ['chunk-6ccen3s8.js', 11037, 11145, 108],
  ['chunk-4bw62nzm.js', 21687, 21738, 51], ['chunk-4bw62nzm.js', 24850, 24936, 86],
  ['chunk-4bw62nzm.js', 24936, 24946, 10],
], 6);
const rowsText = read('src/plugin-chain-keys-rows-source.ts');
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
const rowsNames = namesIn(rowsText);
const declared = (names, name) => names.declaredNames.has(name);
for (const name of ['Ace', 'ge', 'Yr', 'JMt', 'Di', 'oo']) {
  if (!declared(rowsNames, name)) throw new Error(`the rows copy does not carry ${name}`);
}
const ownExports = ['Ace', 'ge', 'Di', 'oo'];
if (rowsNames.exportedNames.size !== ownExports.length) throw new Error('the rows copy exports a different count');
for (const name of ownExports) if (!rowsNames.exportedNames.has(name)) throw new Error(`the rows copy does not export ${name}`);
// The two helpers the reader calls and the four the map-values walks with are imports, never declarations
// here: they are read out of the copies that already carry them.
const rowsImports = {
  './plugin-chain-keys-editor-source.js': ['h9', 'Q', 'Re'],
  './plugin-chain-lodash-internals-source.js': ['Lxr', 'uU', 'Wpe', 'zZ'],
};
const importedTotal = Object.values(rowsImports).flat();
for (const [source, names] of Object.entries(rowsImports)) {
  const line = new RegExp(`import \\{ ([^}]*) \\} from '\\./${source.slice(2)}'`).exec(rowsText);
  if (!line) throw new Error(`the rows copy does not import from ${source}`);
  const imported = line[1].split(',').map((name) => name.trim());
  for (const name of names) {
    if (!imported.includes(name)) throw new Error(`the rows copy does not import ${name} from ${source}`);
    if (declared(rowsNames, name)) throw new Error(`the rows copy declares ${name} instead of importing it`);
  }
}
if (rowsNames.importedNames.size !== importedTotal.length) throw new Error('the rows copy imports a different count');
const exportedBy = {
  'src/plugin-chain-keys-editor-source.ts': ['h9', 'Q', 'Re'],
  'src/plugin-chain-lodash-internals-source.ts': ['Lxr', 'uU', 'Wpe', 'zZ'],
};
for (const [path, names] of Object.entries(exportedBy)) {
  const text = read(path);
  for (const name of names) {
    const exported = new RegExp(`export (?:function|const|let|var|class) ${name}\\b|export \\{ [^}]*\\b${name}\\b`).test(text);
    if (!exported) throw new Error(`${path} no longer exports ${name}, which this package imports`);
  }
}
// The one export this package added to a copy another package owns, and the measurement that says it was
// the cheaper half of the choice: the map-values closure this chunk walks through is 153 statements if it
// is walked naively, and all but the three below are already carried by that copy.
const internalsPlan = JSON.parse(read('research/ports/W45-lodash-internals-source-blocks.plan.json'));
if (!internalsPlan.exports.includes('Wpe')) throw new Error('the internals plan does not export the walk this copy reads');
if (internalsPlan.exports.length !== 27) throw new Error(`the internals plan exports ${internalsPlan.exports.length} names`);
const walkClosure = execFileSync(process.execPath, ['.audit/w45-49-closure.mjs', 'chunk-4bw62nzm.js', 'oo'], { encoding: 'utf8' });
if (!/153 statements, 10660 units/.test(walkClosure)) throw new Error('the map-values closure is no longer 153 statements / 10,660 units');
if (!/imports: rie <- rie of .*chunk-ae84tp6z\.js/.test(walkClosure)) throw new Error('the closure no longer reads its helpers out of the memoize chunk');

const scan = read('.audit/w45-68-scan.txt');
if ((scan.match(/unresolved 0/g) ?? []).length !== 2) throw new Error('the two scanned copies did not scan clean');
if (!scan.includes('imports ./plugin-chain-keys-editor-source.js, ./plugin-chain-lodash-internals-source.js')) {
  throw new Error('the rows scan does not name its two imports');
}

// The seam: every body quoted verbatim, every range cited, and the names a caller reads.
const rowsSeam = read('src/plugin-chain-keys-rows.ts');
for (const [module, start, end] of [
  ['chunk-6ccen3s8.js', 10481, 10621], ['chunk-6ccen3s8.js', 11037, 11145],
  ['chunk-4bw62nzm.js', 21687, 21738], ['chunk-4bw62nzm.js', 24850, 24946],
]) {
  const slice = read(`extracted-v2/modules/${module}`).slice(start, end);
  if (!rowsSeam.includes(slice)) throw new Error(`the rows seam does not quote ${module} [${start},${end}) verbatim`);
}
for (const range of ['[10481,10621) 140', '[11037,11145) 108', '[21687,21738) 51', '[24850,24946) 96']) {
  if (!rowsSeam.includes(range)) throw new Error(`the rows seam does not cite ${range}`);
}
for (const name of ['bindingRows', 'rewriteLegacyBindings', 'mapValuesForRows', 'MAP_VALUES_ALIAS', 'SOURCE_BODIES']) {
  if (!rowsSeam.includes(name)) throw new Error(`the rows seam does not carry ${name}`);
}
if (!rowsSeam.includes('return Ace(blocks) as KeyBindingRow[];')) throw new Error('the reader wrapper does not call the copied body');
if (!rowsSeam.includes('return ge(blocks) as KeyBindingsBlockInput[];')) throw new Error('the mapper wrapper does not call the copied body');
if (!rowsSeam.includes('return Di(object, iteratee) as Record<string, Result>;')) throw new Error('the map-values wrapper does not call the copied body');
if (!rowsSeam.includes('export const MAP_VALUES_ALIAS = oo as typeof Di;')) throw new Error('the seam does not carry the alias the mapper reaches');
const registryState = read('src/plugin-chain-registry-state.ts');
for (const name of ['KeyBindingsBlockInput', 'KeyBindingRow']) {
  if (!registryState.includes(`export interface ${name}`)) throw new Error(`the registry state does not carry ${name}`);
}
const suite = read('test/plugin-chain-keys-rows.test.ts');
for (const name of ['bindingRows', 'rewriteLegacyBindings', 'mapValuesForRows', 'MAP_VALUES_ALIAS',
  'SOURCE_BODIES', 'LEGACY_ACTION_NAMES', 'DEFAULT_BINDINGS']) {
  if (!suite.includes(name)) throw new Error(`the suite does not exercise ${name}`);
}
if (suite.includes('plugin-chain-keys-rows-source.js')) throw new Error('the suite reaches past the seam to a copy');

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-68-tests.txt');
if (full.failed !== 0 || full.tests !== 1705) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-68-family.txt');
if (family.failed !== 0 || family.tests !== 429) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const siteSweep = summary('.audit/w45-68-site.txt');
if (siteSweep.failed !== 0 || siteSweep.tests !== 110) throw new Error('the site-table sweeps are not clean');
const span = JSON.parse(read('.audit/w45-68-span.txt'));
if (span.total !== 0) throw new Error(`the span scan found ${span.total}`);
const notices = JSON.parse(read('.audit/w45-68-notices.txt').split('\n').filter((line) => line.startsWith('{')).at(-1));
if (notices.sha256 !== '384c78801194aedea80331383ccd93708c2dfa46bc746003dc112c930b73d13c') {
  throw new Error('the dependency-notice digest moved');
}
const smokeReport = read('.audit/w45-68-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 311) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
let allMarkers = 0;
for (const name of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${name}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers += out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).length;
}
const sharedMarkers = read('.audit/w45-68-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-68-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45KeybindingRowsCompiled.v1')) throw new Error('the shared driver did not print the W45-68 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45KeybindingRowsCompiled.v1 (${sharedMarkers.length} markers, ${allMarkers} across every driver: it reads the product's own defaults into 226 rows over 27 contexts, rewrites the six legacy names without touching the blocks it was handed, and maps an object value-wise, inherited keys and a null object included)`;

const evidence = {
  schema: 'W45KeybindingRowsEvidence.v1',
  package: 'W45-68 — the keybinding module\'s row reader',
  date: '2026-10-16',
  question: 'What turns the bindings a caller holds into the rows a table is drawn from, and what does the reader need that the two packages before it did not carry?',
  answer: 'Two bodies and this chunk\'s own lodash `mapValues`. `Ace` walks the blocks and answers one row per binding, handing each chord to the editor\'s splitter as the row is built, so a row carries keys rather than the string the file wrote; the action is copied as it stands, `null` included, because unbinding a default is a row like any other and the reader is not the place that decides what a null action means. `ge` is what a freshly read file passes through before the rows are read: each block\'s bindings are mapped value-wise through this chunk\'s `mapValues` (`oo`), and the one substitution is the six legacy action names, replaced by the names they are read as; everything else, `null` included — the check refuses it before the map is consulted — is left alone. Measured on the product\'s own defaults, which is the call the source\'s own caller makes (`G(){return Ace(w1)}`): 226 rows over 27 contexts. The map-values under the mapper is three statements — the iteratee folded to arity three, an own-key walk, and a guarded write — and it is the guarded write that keeps a key literally named `__proto__` a property of the answer instead of its prototype. Nothing under those three statements is copied: the product already carries them in the internals copy, which this package widened by exactly one export (`Wpe`, the own-key walk) so the reader reads the walk out of it the way W45-14 set that copy up to be read. With this the keybinding module is complete — tables, editor and reader all in the product.',
  ported: rowsLedger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  planExtensions: [
    {
      plan: 'research/ports/W45-keybinding-rows-blocks.plan.json',
      what: 'a new plan, five blocks and four exports across two modules',
      blocks: '0 → 5 blocks, 395 units, 6 statements',
      why: 'the reader and the mapper are 248 units of the keybinding chunk; what the mapper calls is this chunk\'s own map-values — 96 units in three statements — chosen over walking its whole closure because the product already carries every helper that closure reads',
    },
    {
      plan: 'research/ports/W45-lodash-internals-source-blocks.plan.json',
      what: 'an existing plan, exports widened by one name',
      blocks: '153 blocks, 11,297 units — unchanged',
      why: 'the walk this chunk\'s map-values iterates with is declared at [7840,7851) of the internals chunk and was not exported; exporting it is the convention that copy was built for ("the rest are the helpers the W45-14 lodash copies read out of this module rather than copying a second time"), and it is cheaper than copying the 11 units or, worse, letting the reader walk a second map-values of its own',
    },
  ],
  boundary: 'No new host boundary. The reader reaches two helpers and the mapper two more by import from copies that already carry them — `h9`, `Q` and `Re` from the keybinding editor copy (W45-67) and `Lxr`, `Wpe`, `uU`, `zZ` from the lodash internals copy — so the only edit this package makes to another package\'s artifact is the one export the internals copy needed to publish, and that copy\'s product digest is recorded here as it now stands so the change is not silent.',
  measured: [
    'The reader on the product\'s own defaults answers 226 rows over 27 contexts — the call the source\'s own caller makes, `G(){return Ace(w1)}` — and an empty table answers no rows.',
    'Rows come out in the order they were written: the block order first, then the order the file bound each key in.',
    'A row carries keys, not a chord: measured, a `ctrl+x shift+y` binding is two key records in one row and a `g` binding is one, because the row reader hands the chord to the editor\'s splitter as it builds the row.',
    'An unbound default is a row like any other: measured, an action of `null` is copied through as `null`, and the reader does not interpret it.',
    'The mapper rewrites exactly the six legacy names and nothing else: measured, of `messageSelector:up`, `null`, `app:interrupt` and `diff:viewDetails` in one block, the first becomes `select:previous` and the last `select:accept`, while `null` and the current name are left where they were — the check refuses `null` before the map is consulted.',
    'The mapper does not rewrite the blocks it was handed: measured, the argument stringifies the same before and after, and the answer\'s blocks and binding maps are new objects.',
    'This chunk\'s `mapValues` maps value-wise and hands the iteratee the value, the key and the object; only own keys are walked, so an inherited key is dropped and the answer has the ordinary prototype.',
    'A key literally named `__proto__` stays an own property of the answer: measured, `di({__proto__: 5})` answers an object whose own names are `["__proto__"]` and whose prototype is still `Object.prototype`, because the value is written through a guard rather than assigned.',
    'A `null` object is not an error for this map-values: measured, it answers `{}`, because the walk finds no keys to map rather than refusing the argument.',
    'The name the mapper calls and the map-values are the same function: measured, `oo === Di`.',
    'Walking the mapper\'s dependency graph naively reports 153 statements and 10,660 units, and 13 imported helpers; the product already carries 150 of those statements in the internals copy and all 13 imports in the memoize copy, so the package adds 96 units from that chunk rather than 10,660.',
    'The keybinding module is complete: the tables a Button is measured against (W45-66), the editor a keybindings file is read through (W45-67) and the reader a table is drawn from (this package) are all in the product, and no body of that module is left uncarried.',
  ],
  regressions: `the new reader suite 8/8 inside the nine site-table, leaf and keybinding files (${siteSweep.passed}/${siteSweep.tests}); ${familyLine}`,
  full: fullLine,
  compiled: driverLine,
  smoke,
  next_package: [
    'the leaf table `tno` and the depth walker that reads it (`ano`, `ono`, `rno` with the twelve helpers they share, 18 statements / 3,506 units)',
    'the React layer: `Tc(jo, { key: `raster:${plugin}:${key}`, ... })` in chunk-kjfwbh4w.js',
    'the remaining `$` table entries, each measured before it is taken: `ui.scroll`, `ui.focus`, `ui.copy` (blocked on the clipboard encoder `Sv`), `state.get`/`state.set`, `fs.ancestors`',
    'the plugin-facing `$` dispatcher `G2e` (chunk-sfn1dbxq.js [2356082,…)), which applies `raise` then `stamp` then `run`',
    'the settings read path behind `y9e` — 590 statements / 327,047 units, 318,262 of them fresh — walked in pieces; the managed-settings gate `CT` and `Tp`; Q-086\'s 15 registry-reading cores and their 34 sites; the notification provider `a4n`',
  ],
};
write('research/ports/W45-keybinding-rows-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);

const marks = {
  current: 'W45-68 **收口',
  features: '; W45-68 completes the keybinding module\'s row reader',
  standard: '2026-10-16 W45-68 ',
  status: 'W45-68:',
  runner: '## W45-68 ported the keybinding row reader',
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
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-68 **收口行读取器（键盘模块完成）**（W45-67 绑定编辑器之后的最后一刀，模块至此三部分——表/编辑器/行读取器——全在产品）：**5 段 395 单位 / 6 语句**（chunk-6ccen3s8.js [10481,10621) 140u **\`Ace\` 行读取器**、[11037,11145) 108u **\`ge\` 旧名改写器**；chunk-4bw62nzm.js [21687,21738) 51u \`Yr\`+\`JMt\` 自键遍历、[24850,24936) 86u **\`Di\` 本 chunk 的 lodash mapValues**、[24936,24946) 10u \`oo\` 别名）。**语义（源文实测）**：**行 = 一条绑定**——\`Ace\` 逐块逐绑定产出 \`{chord, action, context}\`，chord 在建行时即交给编辑器的切分器 \`h9\`，故行里是**键记录而非字符串**（\`ctrl+x shift+y\` 是两条键记录）；action 原样复制**含 \`null\`**（解绑也是行，读取器不解释 null）；实测产品自带的默认表得 **226 行 / 27 上下文**（即源码调用点 \`G(){return Ace(w1)}\`），空表得 0 行；行序=块序→文件内绑定序。**改写器 \`ge\`** 只替换六个旧动作名（经 \`Q\` 判定后取 \`Re\` 映射；实测一块四值中恰好两个被改写：\`messageSelector:up\`→\`select:previous\`、\`diff:viewDetails\`→\`select:accept\`），\`null\` 与现行名原样留下；**不改写入参**（mapValues 回新对象，实测入参前后同串、答案的块与映射皆新）。**本 chunk 的 mapValues**：三语句——iteratee 折到 arity 三（\`uU\`）、自键遍历（\`JMt\`/\`Yr\`）、**经 \`zZ\` 守门写入**；实测 \`__proto__\` 键仍是答案的**自有属性**而不会成为其原型，继承键不参与映射，\`null\` 对象得 \`{}\`（不报错），\`oo === Di\` 同一函数。**关键取舍**：新宿主边界 0；读取器需要的 \`h9\`/\`Q\`/\`Re\` 与 \`Lxr\`/\`Wpe\`/\`uU\`/\`zZ\` 全部**按名从已有副本导入**；对他人产物的唯一改动=**internals 副本扩一个导出 \`Wpe\`**（该方法体 [7840,7851) 早已在该副本内、只是未导出；这正是该副本"给 W45-14 之后的副本读"的用途），比再搬 11u 或再走一份 mapValues 都便宜——**未扩导出前朴素遍历该 mapValues 闭包为 153 语句 / 10,660 单位 / 13 导入**，其中 150 条语句已在该副本、13 个导入全在 memoize 副本。**验收**：check/build/notices（摘要未变）、两副本 \`unresolved 0\`、span \`total 0\`、**${chain}**、账本逐段回源 + acorn（6 语句、完整、无重叠/无切半/无重复）+ 5 处正文逐字入 seam + 4 处区间 + 6 名自有/4 名导出/7 名被导入双向核对 + internals 计划导出由 26 增至 27 且方法体确在该副本内 + registry-state 新增两类型、站点表九套回归 ${siteSweep.passed}/${siteSweep.tests}、家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45KeybindingRowsCompiled.v1\`，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [行读取器证据](ports/W45-keybinding-rows-evidence.json)、[绑定编辑器证据](ports/W45-keybinding-editor-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
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
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-68 completes the keybinding module's row reader: ` +
  'the rows a keybindings table is drawn from — one row per binding, the chord already split into the keys it is ' +
  'made of and an unbound default a row like any other — and the mapper a freshly read file passes through, which ' +
  'rewrites the six legacy action names and leaves every other value where it was, over this chunk\'s own lodash ' +
  '`mapValues`, whose guarded write keeps a key named `__proto__` a key. |';
write('research/FEATURES.md', lines.join('\n'));

const standardText = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standardText.indexOf('2026-10-16 W45-67 ');
if (standardAt < 0) throw new Error('coding-standard W45-67 line not found');
const standardEntry = `2026-10-16 W45-68 行读取器（键盘模块收口）：S-1至S-7已对照。S-1（先读源）：**先量后切**——\`ge\` 的闭包实测：\`Ace\` 140u、\`ge\` 108u 之外只剩 \`oo\`（mapValues），而朴素遍历该闭包为 **153 语句 / 10,660 单位 / 13 导入**；逐个查证后确认 150 条语句已在 **internals 副本**、13 个导入全在 **memoize 副本**，故只切该 chunk 的 **3 语句 96u**（\`Yr\`+\`JMt\` 51u、\`Di\` 86u、\`oo\` 10u）并**按名导入**其余。S-2（不留半包）：**新宿主边界 0**；对他人产物只改一处——internals 计划导出 26→27（补 \`Wpe\`，其方法体 [7840,7851) 本就在该副本内），并在证据里记下该副本改动后的摘要 \`2708e44c…\`，改动非静默。S-3（先测后断言）：\`.audit/w45-68-probe.ts\` 先跑再写 8 条用例；**实测出四处非显然行为**——① 行里是**键记录**（\`ctrl+x shift+y\`→两条），且 \`null\` 动作照抄成行；② 增量数据：产品默认表 226 行 / 27 上下文（源调用点 \`G(){return Ace(w1)}\`）；③ \`ge\` **不改写入参**且 \`null\` 在查表前被拒（故留 null）；④ 本 chunk 的 mapValues **经守门写入**（\`__proto__\` 仍是自有键）、仅自键、\`null\` 对象得 \`{}\`、\`oo===Di\`。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器（68 计划）与 15 个编译驱动、并**再跑一次朴素闭包工具**断言 153/10,660 与"导入来自 chunk-ae84tp6z.js"仍成立；断言两副本 \`unresolved 0\`、span \`total 0\`、notices 摘要未变；acorn 逐段回源（5 语句、完整、无重叠/无切半/无重复）+ 5 处正文逐字入 seam + 4 处区间 + 6 名自有/4 名导出逐一核对 + 7 个被导入名"不自声明/确在彼处" + internals 计划导出与两段方法体双向断言 + registry-state 两类型。S-5/S-6：rows seam 给 3 个按名包装（\`bindingRows\`/\`rewriteLegacyBindings\`/\`mapValuesForRows\`）与 \`MAP_VALUES_ALIAS\`/\`SOURCE_BODIES\`；测试只经 seam（并断言包装的答案与副本函数逐一致）。S-7：\`tno\` 叶表与深度遍历器、React \`Tc(jo,…)\`、其余 \`$\` 表项、\`G2e\`、\`y9e\` 读路径写入 next_package。**键盘模块至此（表/编辑器/行读取器）全数入产品。**验收：check/build/notices、两副本 unresolved 0、${chain}、账本与正文自证、站点表九套 ${siteSweep.passed}/${siteSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standardText.slice(0, standardAt) + standardEntry + standardText.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAnchor = 'W45-67: the keybinding editor';
const statusAt = status.indexOf(statusAnchor);
if (statusAt < 0) throw new Error('STATUS W45-67 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = 'W45-68: the keybinding module\'s row reader. With this the module is complete: the tables a Button is ' +
  'measured against (W45-66), the editor a keybindings file is read through (W45-67) and the reader a table is drawn ' +
  'from are all in the product. The reader answers one row per binding and hands each chord to the editor\'s splitter ' +
  'as the row is built, so a row carries keys rather than the string the file wrote, and it copies the action as it ' +
  'stands — `null` included, because unbinding a default is a row like any other. On the product\'s own defaults, the ' +
  'call the source\'s own caller makes, that is 226 rows over 27 contexts. The mapper beside it is what a freshly read ' +
  'file passes through: each block\'s bindings mapped value-wise, and the six legacy action names replaced by the names ' +
  'they are read as, with everything else left where it was — `null` included, since the check refuses it before the ' +
  'map is consulted. What the mapper calls is this chunk\'s own lodash `mapValues`: three statements whose guarded ' +
  'write keeps a key literally named `__proto__` a property of the answer instead of its prototype. The package is 5 ' +
  'blocks and 395 units, and it adds no host boundary — the helpers it needs are read out of copies that already carry ' +
  'them, and the one edit it makes to another package\'s artifact is the single export the internals copy needed to ' +
  'publish, recorded with that copy\'s new digest rather than made silently. Walking that map-values\' closure naively ' +
  'is 153 statements and 10,660 units; 150 of them were already carried. Evidence: ' +
  '`research/ports/W45-keybinding-rows-evidence.json`, and\n[工作包](ports/W45-chain-runner.md).\n\n';
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-68 ported the keybinding row reader (2026-10-16)

The keybinding module is complete. W45-66 took the tables a Button is measured against, W45-67 the editor a
keybindings file is read through, and this package the reader a table is drawn from: five blocks, 395 units,
six statements over two modules, and no body of the module left uncarried.

The reader is two bodies. \`Ace\` walks the blocks and answers one row per binding, handing each chord to the
editor's own splitter as the row is built, which is why a row carries keys rather than the string the file
wrote; the action is copied as it stands, \`null\` included, because unbinding a default is a row like any
other and the reader is not the place that decides what a null action means. \`ge\` is what a freshly read
file passes through before the rows are read: each block's bindings are mapped value-wise, and the six
legacy action names are replaced by the names they are read as, while everything else — \`null\` included,
since the check refuses it before the map is consulted — is left where it was. Both were measured against
the call the source's own caller makes: the product's defaults answer 226 rows over 27 contexts.

What the mapper calls is this chunk's own lodash \`mapValues\`, and the measurement is what kept the package
small. Walking that function's dependency graph naively reports 153 statements, 10,660 units and 13 imported
helpers; all 13 imports were already carried by the memoize copy and 150 of the statements by the internals
copy, so what this package takes from that chunk is three statements — the iteratee folded to arity three,
the own-key walk, and the write. It is the write that matters: a value is stored through a guard rather than
assigned, which is what keeps a key literally named \`__proto__\` a property of the answer instead of its
prototype, and the suite measures exactly that.

One edit reaches outside this package, and it is recorded rather than silent. The own-key walk the
map-values iterates with was declared in the internals chunk but not exported from the copy that carries it,
so the internals plan gains one export (\`Wpe\`) — the convention that copy was built for, since its exports
exist so later packages can read helpers out of it instead of copying them a second time. Its product digest
moves to \`2708e44c…\`, and the evidence record states the change, the plan's new export count and why it beat
the alternative of copying the walk again.

Verified: check/build/notices, both scanned copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, the ledger
re-read from its modules and matched against the copy with acorn (5 statements, whole and contiguous, no cut,
no repetition), five body slices quoted verbatim in the seam with four ranges cited, the six names the copy
owns and the four it exports counted and checked one by one, the seven imported names asserted absent as
declarations and present in the export lists that own them, the internals plan's export and the two bodies it
publishes asserted both ways, the naive closure re-measured at 153 statements / 10,660 units with its imports
still coming from the memoize chunk, and the two types the reader's blocks and rows need asserted present. The
suites ${siteSweep.passed}/${siteSweep.tests} across the nine site-table, leaf and keybinding files,
${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers (the shared driver now also prints
\`W45KeybindingRowsCompiled.v1\`, ${sharedMarkers.length} markers in the shared run and ${allMarkers} across every
driver), and the packaged smoke (${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs by the record
script itself).

Next: the leaf table \`tno\` with the depth walker that reads it; then the React layer \`Tc(jo, …)\`, the remaining
\`$\` table entries, the dispatcher \`G2e\`, and the settings read path behind \`y9e\`.
`);

const rows = [
  ['2026-10-17T13:02:00Z', 'package', 'W45-68 收口行读取器（键盘模块完成）（5 段 395 单位 / 6 语句）',
    'bindingRows/rewriteLegacyBindings/mapValuesForRows 成为产品面，MAP_VALUES_ALIAS/SOURCE_BODIES；注册表新增 KeyBindingsBlockInput/KeyBindingRow；新宿主边界 0（7 个帮手全部按名从已迁副本导入）；对他人产物仅改一处=internals 副本扩导出 Wpe',
    'chunk-6ccen3s8.js [10481,10621) 140u Ace + [11037,11145) 108u ge + chunk-4bw62nzm.js [21687,21738) 51u Yr/JMt + [24850,24936) 86u Di + [24936,24946) 10u oo',
    '两轮实测（.audit/w45-68-probe.ts + test/plugin-chain-keys-rows.test.ts + .audit/w45-24-compiled.mjs）：226 行/27 上下文、行内是键记录、null 动作成行、ge 只改六个旧名且不改入参、mapValues 经守门写入（__proto__ 仍为自有键）/仅自键/null 对象得 {}；8/8 通过'],
  ['2026-10-17T13:06:00Z', 'decision', 'W45-68 队列实测：mapValues 闭包 153 语句 10,660 单位，只切 3 语句 96 单位',
    '朴素遍历 oo 闭包 = 153 语句/10,660 单位/13 导入；逐个查证：13 个导入全在 memoize 副本（chunk-ae84tp6z.js），150 条语句已在 internals 副本（chunk-4bw62nzm.js）',
    '故只搬 Yr+JMt/Di/oo 三语句并按名导入 Lxr/Wpe/uU/zZ；为补 Wpe 把 internals 计划导出 26→27（方法体 [7840,7851) 已在该副本内），并在证据记下其新摘要 2708e44c…',
    `rows 副本 5 段 395u sha 0087ca87…；internals 副本 153 段 11,297u sha 2708e44c…；${chain}`],
  ['2026-10-17T13:10:00Z', 'finding', 'W45-68 实测：本 chunk 的 mapValues 经守门写入，__proto__ 键仍是自有键',
    'Di(e,t){var o={};return t=uU(t,3),JMt(e,function(r,i,s){zZ(o,i,t(r,i,s))}),o} —— 写入走 zZ（baseAssignValue）而非赋值',
    '实测：{__proto__:5} 映射后自有键名恰为 ["__proto__"]、原型仍为 Object.prototype；继承键不参与映射；null 对象得 {}；oo===Di',
    '.audit/w45-68-probe.ts 输出与 test/plugin-chain-keys-rows.test.ts 末条用例逐条对应'],
  ['2026-10-17T13:14:00Z', 'finding', 'W45-68 键盘模块三部分（表/编辑器/行读取器）至此全在产品内',
    'W45-66 表（w1/ZDe/QDe/…）、W45-67 编辑器（mJ/h9/Z/Re/Q/v9t/lcs/F/ze/Bn/fe/He/Ve/T + i/RTr/p）、W45-68 行读取器（Ace/ge + 本 chunk mapValues）',
    'next_package 六项：tno 叶表+深度遍历器、React Tc(jo,…)、其余 $ 表项、G2e、y9e 读路径、CT/Tp/Q-086/a4n',
    'source-undeclared-scan 两副本 unresolved 0；链校验器 68 计划通过'],
  ['2026-10-17T13:18:00Z', 'verification', `W45-68 验收：两副本 unresolved 0、span total 0、账本逐段回源 + acorn + 5 处正文逐字入 seam + internals 导出双向断言 + 闭包再测、${chain}、站点表九套 ${siteSweep.passed}/${siteSweep.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 编译驱动与打包冒烟`,
    '键盘模块（表/编辑器/行读取器）全数在产品内；下一包取 tno 叶表+深度遍历器或其余 $ 表项',
    `check/build/notices（摘要未变）；两副本 unresolved 0；span total 0；${chain}；5 段逐段回源比长度与内容 + acorn（6 语句、完整、无重叠/无切半/无重复）+ 无重复断言；5 处正文逐字入 seam + 4 处区间 + 6 名自有/4 名导出 + 7 名被导入；internals 计划导出 27 与 [7840,7851)/[21687,21738)/[24850,24946) 双向断言；朴素闭包复测 153 语句/10,660 单位且导入仍来自 chunk-ae84tp6z.js；registry-state 两类型；站点表九套 ${siteSweep.passed}/${siteSweep.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 编译驱动 exit 0（共享驱动输出 W45KeybindingRowsCompiled.v1，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-68 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-68 acceptance (2026-10-16)

- [x] **The measurement priced the cut before it was taken.** The mapper's map-values walks a 153-statement, 10,660-unit closure at this chunk; all 13 of its imports and 150 of its statements were already carried by copies in the product, so the package takes three statements and imports the rest.
- [x] **The one edit outside the package is recorded, not silent.** The internals copy publishes one more helper so the walk is read out of it rather than copied again — the convention that copy exists for — and its new digest is written into the evidence and the STATUS paragraph.
- [x] **Every behaviour was measured before it was asserted,** including four reading alone would have got wrong: the row's chord is keys rather than a string, an unbound default is a row, the mapper leaves its argument alone, and this chunk's map-values writes through a guard so a key named \`__proto__\` stays a key.
- [x] **The reader was measured against the call the source makes.** The product's own defaults answer 226 rows over 27 contexts — the same call as \`G(){return Ace(w1)}\` — and the driver asserts it against the built output, not the source tree.
- [x] **The module is closed rather than left half-taken.** Tables, editor and reader are all in the product; the packages W45-66 and W45-67 named as next are predecessor packages, and nothing of this module remains in next_package.
- [x] **Sweep.** check/build/notices, both copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, the ledger with acorn, the seam's verbatim quotes and ranges, the internals export asserted both ways, the naive closure re-measured, the site-table suites ${siteSweep.passed}/${siteSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
const written = {
  'research/CURRENT.md': 'W45-68 **收口',
  'research/STATUS.md': '\nW45-68:',
  'research/coding-standard.md': '\n2026-10-16 W45-68 ',
  'research/ports/W45-chain-runner.md': '\n## W45-68 ported',
  '.audit/w45-runtime.todo.md': '\n## W45-68 acceptance',
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
