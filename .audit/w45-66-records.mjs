// Write the W45-66 record from the artifacts themselves: the Button, the last leaf of the site table,
// and the keybinding tables its two action checks read.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 431, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 162, `validation ${identity.validation.files}`);
expect(identity.build.files === 298, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 66) throw new Error('the chain verifier did not pass 66 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const registry = read('scripts/verify-chain-copies.mjs');
for (const entry of ["['W45-keybindings', 'plugin-chain-keys-source']", "['W45-button', 'plugin-chain-button-source']"]) {
  if (!registry.includes(entry)) throw new Error(`the verifier does not register ${entry}`);
}
const at = (needle) => {
  const file = verifier.files.find((entry) => entry.product.includes(needle));
  if (!file) throw new Error(`the verifier does not carry ${needle}`);
  return file;
};
const keysCopy = at('plugin-chain-keys-source');
if (keysCopy.blocks !== 12 || keysCopy.units !== 14286) throw new Error(`the keys copy is ${JSON.stringify(keysCopy)}`);
if (keysCopy.sha256 !== '577192b351c096b66f80e7f953ffcf0e64b63c2b02655836d460fc7660b32338') {
  throw new Error('the keys copy is not the one this package measured');
}
const buttonCopy = at('plugin-chain-button-source');
if (buttonCopy.blocks !== 1 || buttonCopy.units !== 1612) throw new Error(`the button copy is ${JSON.stringify(buttonCopy)}`);
if (buttonCopy.sha256 !== 'a66360a85733877236ea838e1edbcec79b230a598cfe1d033d8ab4ecad381a9e') {
  throw new Error('the button copy is not the one this package measured');
}
const leavesCopy = at('plugin-chain-leaves-source');
if (leavesCopy.blocks !== 3 || leavesCopy.units !== 2785) throw new Error('the leaves copy changed size');
for (const [needle, blocks, units] of [['style-props', 17, 3794], ['site-leaves', 8, 3557], ['raster-sites', 8, 1980], ['ui-blit', 7, 7852]]) {
  const copy = at(needle);
  if (copy.blocks !== blocks || copy.units !== units) throw new Error(`the ${needle} copy changed size`);
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
  const wantUnits = expected.reduce((sum, [, , count]) => sum + count, 0);
  if (units !== wantUnits) throw new Error(`${name} holds ${units} units, not ${wantUnits}`);
  const copyText = read(productPath);
  const claimed = new Set();
  let count = 0;
  for (const [start, end, count_] of expected) {
    const block = ledger.blocks.find((b) => b.range[0] === start);
    if (!block || block.range[1] !== end || block.units !== count_) throw new Error(`${name}: [${start},${end}) is not in the ledger as ${count_} units`);
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

const keysLedger = checkCopy('the keys copy', 'src/plugin-chain-keys-source.ts', [
  [1764, 8839, 7075], [11563, 16491, 4928], [16491, 16534, 43], [16534, 16567, 33], [17524, 18783, 1259],
  [18864, 18952, 88], [18952, 19125, 173], [19125, 19541, 416], [19541, 19548, 7], [19548, 19738, 190],
  [1245, 1268, 23], [342203, 342254, 51],
], 12);
const buttonLedger = checkCopy('the button copy', 'src/plugin-chain-button-source.ts', [[234038, 235650, 1612]], 1);
const keysText = read('src/plugin-chain-keys-source.ts');
const buttonText = read('src/plugin-chain-button-source.ts');
// The runs are whole, and the neighbours on either side of them are not here: the key parser, the two
// other membership checks, the schema builders and the reserved-key list builder all belong to the
// binding editor rather than to a Button.
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
const keysNames = namesIn(keysText);
const buttonNames = namesIn(buttonText);
const declared = (names, name) => names.declaredNames.has(name);
for (const name of ['Hto']) if (!declared(buttonNames, name)) throw new Error(`the button copy does not carry ${name}`);
for (const name of ['dcs', 'acs', 'pqe', 'Ye', 'Ge', 'ee', 'pe', 'w1', 'ZDe', 'ccs', 'QDe', 'QOn', 'Noo', 'Foo', 'nA', 'Yho']) {
  if (!declared(keysNames, name)) throw new Error(`the keys copy does not carry ${name}`);
}
for (const name of ['mJ', 'lcs', 'F', 'ze', 'Bn', 'fe', 'He']) {
  if (declared(keysNames, name)) throw new Error(`${name} was taken after all, and it is not part of this package`);
}
for (const name of ['TAt', 'QAe', 'wVe', 'L', 'cN', 'QT']) {
  if (declared(buttonNames, name)) throw new Error(`the button copy declares ${name} instead of importing it`);
}
// What each copy reaches is imported from the copy that already carries it, never declared here.
const keysImports = [/import \{ O \} from '\.\/plugin-chain-fs-boundaries\.js';/];
if (!keysImports.every((pattern) => pattern.test(keysText))) throw new Error('the keys copy does not import the platform probe');
if (declared(keysNames, 'O')) throw new Error('the keys copy declares the platform probe instead of importing it');
if (!keysNames.importedNames.has('O')) throw new Error('the keys copy does not take the platform probe as an import');
if (keysNames.importedNames.size !== 1) throw new Error('the keys copy imports more than the platform probe');
const buttonImports = {
  './plugin-chain-source.js': ['L'],
  './plugin-chain-style-props-source.js': ['cN'],
  './plugin-chain-ui-blit-source.js': ['QT'],
  './plugin-chain-raster-sites-source.js': ['QAe'],
  './plugin-chain-site-leaves-source.js': ['TAt', 'wVe'],
  './plugin-chain-keys-source.js': ['acs', 'dcs'],
};
for (const [source, names] of Object.entries(buttonImports)) {
  const line = new RegExp(`import \\{ ([^}]*) \\} from '\\./${source.slice(2)}'`).exec(buttonText);
  if (!line) throw new Error(`the button copy does not import from ${source}`);
  const imported = line[1].split(',').map((name) => name.trim());
  for (const name of names) {
    if (!imported.includes(name)) throw new Error(`the button copy does not import ${name} from ${source}`);
  }
}
const exportedBy = {
  'src/plugin-chain-source.ts': ['L'],
  'src/plugin-chain-style-props-source.ts': ['cN'],
  'src/plugin-chain-ui-blit-source.ts': ['QT'],
  'src/plugin-chain-raster-sites-source.ts': ['QAe'],
  'src/plugin-chain-site-leaves-source.ts': ['TAt', 'wVe'],
  'src/plugin-chain-keys-source.ts': ['acs', 'dcs'],
  'src/plugin-chain-fs-boundaries.ts': ['O'],
};
for (const [path, names] of Object.entries(exportedBy)) {
  const text = read(path);
  for (const name of names) {
    const exported = new RegExp(`export (?:function|const|let|var|class) ${name}\\b|export \\{ [^}]*\\b${name}\\b`).test(text);
    if (!exported) throw new Error(`${path} no longer exports ${name}, which this package imports`);
  }
}
// The keybinding module's two action checks are the one place the Button leaves the site table: the
// platform, the version comparison and the platform-detection probe are all in the copy, and the only
// name the copy does not own is the runtime global `Yho` reaches.
const scan = read('.audit/w45-66-scan.txt');
if ((scan.match(/unresolved 0/g) ?? []).length !== 2) throw new Error('the two scanned copies did not scan clean');
if (!scan.includes('imports ./plugin-chain-fs-boundaries.js')) throw new Error('the keys scan does not name its one import');
const scanner = read('scripts/source-undeclared-scan.mjs');
if (!/^\s*'Bun',\s*$/m.test(scanner)) throw new Error('the scanner does not know the runtime global the copied body reaches');
if (!scanner.includes('Bun.semver.satisfies')) throw new Error('the scanner does not say why it knows it');
const windowsSuite = read('test/plugin-chain-button-windows.test.ts');
if (!windowsSuite.includes('Bun.semver.satisfies')) throw new Error('the Windows suite does not name the reach it binds');
if (!windowsSuite.includes("bindHostPlatform(() => 'windows')")) throw new Error('the Windows suite does not bind the platform');

// The seams: every body quoted verbatim, every range cited, and the names a caller reads.
const keysSeam = read('src/plugin-chain-keys.ts');
for (const [module, start, end] of [
  ['chunk-6ccen3s8.js', 1764, 2600], ['chunk-6ccen3s8.js', 8250, 8839],
  ['chunk-6ccen3s8.js', 11563, 11860], ['chunk-6ccen3s8.js', 16100, 16491],
  ['chunk-6ccen3s8.js', 16491, 16567], ['chunk-6ccen3s8.js', 17524, 18120],
  ['chunk-6ccen3s8.js', 18250, 18783], ['chunk-6ccen3s8.js', 18864, 18952],
  ['chunk-6ccen3s8.js', 18952, 19541], ['chunk-6ccen3s8.js', 19541, 19738],
  ['chunk-yvnhkg35.js', 1245, 1268], ['chunk-bk5ct2gw.js', 342203, 342254],
]) {
  const slice = read(`extracted-v2/modules/${module}`).slice(start, end).replace(/\n/g, ' ');
  if (!keysSeam.includes(slice)) throw new Error(`the keys seam does not quote ${module} [${start},${end}) verbatim`);
}
for (const range of ['[1764,8839) 7,075', '[11563,16491) 4,928', '[16491,16567) 76', '[17524,18783) 1,259',
  '[18952,19541) 589', '[19541,19738) 197', '[1245,1268) 23', '[342203,342254) 51']) {
  if (!keysSeam.includes(range)) throw new Error(`the keys seam does not cite ${range}`);
}
for (const name of ['KEY_PLATFORM', 'KEY_PASTE_KEY', 'KEY_TOGGLE_KEY', 'ACTION_NAMES', 'KNOWN_ACTIONS',
  'DEFAULT_BINDINGS', 'RESERVED_KEYS', 'KEY_ALIASES', 'knownAction', 'engineOnlyAction', 'normalizeKey',
  'normalizeKeyParts', 'KEY_PLATFORM_IS_WINDOWS', 'KEY_PLATFORM_USES_TOGGLE', 'SOURCE_BODIES']) {
  if (!keysSeam.includes(name)) throw new Error(`the keys seam does not carry ${name}`);
}
if (!keysSeam.includes('export const KEY_PLATFORM = L;')) throw new Error('the seam does not derive the platform from the copy');
if (!keysSeam.includes('return dcs(name);') || !keysSeam.includes('return acs(name);')) {
  throw new Error('the seam does not call the copied checks');
}
const buttonSeam = read('src/plugin-chain-button.ts');
const htoBody = read('extracted-v2/modules/chunk-n3ykh62m.js').slice(234038, 235650);
if (!buttonSeam.includes(htoBody)) throw new Error('the button seam does not quote the Button verbatim');
if (!buttonSeam.includes('[234038,235650) 1,612')) throw new Error('the button seam does not cite the Button range');
if (!buttonSeam.includes('export function buttonLeafProblem')) throw new Error('the button seam has no wrapper');
if (!buttonSeam.includes('return Hto(')) throw new Error('the button wrapper does not call the copied body');
const registryState = read('src/plugin-chain-registry-state.ts');
if (!registryState.includes('ButtonLeafInput')) throw new Error('the registry state does not carry ButtonLeafInput');
const suite = read('test/plugin-chain-button.test.ts');
for (const name of ['knownAction', 'engineOnlyAction', 'normalizeKey', 'normalizeKeyParts', 'buttonLeafProblem',
  'RESERVED_KEYS', 'DEFAULT_BINDINGS', 'KEY_ALIASES']) {
  if (!suite.includes(name)) throw new Error(`the suite does not exercise ${name}`);
}
for (const copy of ['plugin-chain-keys-source.js', 'plugin-chain-button-source.js']) {
  if (suite.includes(copy)) throw new Error('the suite reaches past the seam to a copy');
}

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-66-tests.txt');
if (full.failed !== 0 || full.tests !== 1683) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-66-family.txt');
if (family.failed !== 0 || family.tests !== 407) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const siteSweep = summary('.audit/w45-66-site.txt');
if (siteSweep.failed !== 0 || siteSweep.tests !== 88) throw new Error('the site-table sweeps are not clean');
const span = JSON.parse(read('.audit/w45-66-span.txt'));
if (span.total !== 0) throw new Error(`the span scan found ${span.total}`);
const notices = JSON.parse(read('.audit/w45-66-notices.txt').split('\n').filter((line) => line.startsWith('{')).at(-1));
if (notices.sha256 !== '384c78801194aedea80331383ccd93708c2dfa46bc746003dc112c930b73d13c') {
  throw new Error('the dependency-notice digest moved');
}
const smokeReport = read('.audit/w45-66-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 306) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
let allMarkers = 0;
for (const name of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${name}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers += out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).length;
}
const sharedMarkers = read('.audit/w45-66-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-66-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45ButtonKeysCompiled.v1')) throw new Error('the shared driver did not print the W45-66 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45ButtonKeysCompiled.v1 (${sharedMarkers.length} markers, ${allMarkers} across every driver: it reads the platform the defaults were computed for, the 174 action names, the 27 contexts and the seven reserved keys, folds a key, and drives the Button through both action refusals)`;

const evidence = {
  schema: 'W45ButtonKeysEvidence.v1',
  package: 'W45-66 — the Button and the keybinding tables',
  date: '2026-10-16',
  question: 'The last leaf of the site table, and the two membership checks it alone reads: what are they measured against, and what is left of the site table once they are in?',
  answer: 'The Button is the ninth and last site leaf, and it is the only one whose check reaches outside the site table: an action is refused twice, once when the engine does not know the name and once when the engine holds it alone. Both answers come from the keybinding module — the first a set of 174 action names, the second a set built from the reserved keys crossed with the default bindings, which on this host holds exactly two actions, `app:interrupt` and `app:exit`, the two the Button\'s own refusal sentence names. A Button differs from its siblings in one more way that only reading shows: it must be held by a plugin to be admitted at all, because the press check it runs last is the shared predicate and that predicate refuses an absent press, where the Link\'s href check is guarded and admits one. The site table is now complete: nine leaves, all in the product. What was left in the keybinding module is the binding editor — the key parser, the two other membership checks, the schema builders and the platform-dependent reserved-key list — and none of it is reachable from a Button.',
  ported: [...keysLedger.blocks, ...buttonLedger.blocks].map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  planExtensions: [
    {
      plan: 'research/ports/W45-keybindings-blocks.plan.json',
      what: 'a new plan, twelve blocks and twenty-one exports across three modules',
      blocks: '0 → 12 blocks, 14,286 units',
      why: 'the tables a Button action is measured against are two statements of data, two membership checks, a key normaliser with its alias table, and three small helpers the platform header reads; the header itself is the same statement as the default binding sets, so the 7,075 units of that one statement come with them',
    },
    {
      plan: 'research/ports/W45-button-blocks.plan.json',
      what: 'a new plan, one block and one export',
      blocks: '0 → 1 block, 1,612 units',
      why: 'the Button is one statement, and its closure\'s other three statements were already carried by the site-leaf and raster leaf-problem copies — so it is a copy of one and an import of six names',
    },
  ],
  boundary: 'One new host boundary, and it is inherited rather than written here: the copied platform header reads the platform through `O`, which W45-46 already bound in ./plugin-chain-fs-boundaries.ts, so the keys copy imports it rather than porting a second copy of the probe. The other reach is the runtime global `Yho` calls — `Bun.semver.satisfies` — which the recovered application has and this Node product does not; the copied body keeps it verbatim, the scanner now knows the name the way it knows `process`, and the Windows suite installs it as a declared fixture to prove the copied header calls through to it.',
  measured: [
    'A Button must be held by a plugin: measured, `{ key, label }` alone answers `Button "k" is not held by a plugin of this chain`, because the press check it runs is the same predicate that refuses an absent press — which is how it differs from the Link, whose href check is guarded and admits one.',
    'A stamp and a press are not the same predicate twice over: a Client is stamped by a plugin name alone, while a press must carry a whole-number handle.',
    'The engine holds exactly two actions alone, and they are the two the Button names: crossing the seven reserved keys with the 27 default binding sets gives `app:interrupt` and `app:exit`. Five of the reserved keys (`ctrl+m`, `ctrl+[`, `ctrl+i`, `ctrl+h`, `capslock`) are bound to no action at all, so the set is built from the bindings rather than from the reserved list.',
    'An action the engine does not know is quoted back rather than described: a string arrives as `"app:nope"` because the source serialises it, and anything else arrives as `a number`, `null`, `an object` through the value describer.',
    'The two action refusals are different sentences with different evidence — one names the action list, the other names the keys (`ctrl+c, ctrl+d`) — and both were measured.',
    'A hotkey is one digit or one lowercase letter, checked before the action: measured, `{ action: "app:interrupt", hotkey: "A" }` answers the hotkey sentence, not the engine-only one.',
    'The option checks run in the order the source destructures them — plain, dimColor, variant, role, autoFocus — measured: a bad plain beats a bad autoFocus, a bad variant beats an unknown action, and a bad dimColor beats it too.',
    'The label is checked before the press: a label with a control character is refused even when no press is there to refuse next.',
    'Children are the one field that is shaped rather than refused: an array is admitted, and a string is answered as `children is a string` last of all.',
    'The key normaliser folds the four spellings of alt and the five of meta, sorts the modifiers, and resolves a lone key through a ten-entry alias table — so `Ctrl+Shift+B`, `shift+ctrl+b` and `meta+up`/`alt+up`/`opt+up` are each one key.',
    'The two normalisers are not the same function: `pqe` names the space key as a word (`" "` → `"space"`) and keeps the space inside a chord, while `Ye` alone answers an empty string for a lone space — measured.',
    'The platform header is decided once, at import, and this host takes the branch that does not compare a version: measured, `Le` short-circuits to true on darwin, so `Yho` is never called; the Windows suite binds the platform to the source\'s own word for it and proves the header then asks `Bun.semver.satisfies` for `1.4.3` against `>=1.2.23` first, because the probe beside it answers true.',
    'The site table is complete: nine leaves — Raster, Image, Code, Input, Select, Svg, Client, Markdown, Link and the Button — all in the product, with the Button the last one in.',
    'Two MCP suites are timing-flaky under the full sweep: measured twice, `test/mcp-notification-stream.test.ts` failed one assertion on a frame count and `test/mcp-subscriptions.test.ts` timed out an `initialize` at 300 ms; both pass on their own, neither file is touched by this package, and the failure is recorded rather than retried away.',
  ],
  regressions: `the new Button suite 12/12 and the Windows fixture beside it 1/1, and the six site-table suites together (${siteSweep.passed}/${siteSweep.tests}); ${familyLine}`,
  full: fullLine,
  compiled: driverLine,
  smoke,
  next_package: [
    'the rest of the keybinding module — the binding editor: the key parser `mJ` [8839,9463), the two further membership checks `lcs` [11530,11563) and `F` [16567,16624) (the second adds the `command:` prefix), the schema builders `ze`/`Bn` [16624,17524), and `fe` [18783,18864), which builds the reserved-key list for the platform it runs on',
    'the leaf table `tno` and the depth walker that reads it (`ano`, `ono`, `rno` with the twelve helpers they share, 18 statements / 3,506 units)',
    'the React layer: `Tc(jo, { key: `raster:${plugin}:${key}`, ... })` in chunk-kjfwbh4w.js',
    'the remaining `$` table entries, each measured before it is taken: `ui.scroll`, `ui.focus`, `ui.copy` (blocked on the clipboard encoder `Sv`), `state.get`/`state.set`, `fs.ancestors`',
    'the plugin-facing `$` dispatcher `G2e` (chunk-sfn1dbxq.js [2356082,…)), which applies `raise` then `stamp` then `run`',
    'the settings read path behind `y9e` — 590 statements / 327,047 units, 318,262 of them fresh — walked in pieces; the managed-settings gate `CT` and `Tp`; Q-086\'s 15 registry-reading cores and their 34 sites; the notification provider `a4n`',
  ],
};
write('research/ports/W45-button-keys-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);

const marks = {
  current: 'W45-66 **收口',
  features: '; W45-66 completes the site table',
  standard: '2026-10-16 W45-66 ',
  status: 'W45-66:',
  runner: '## W45-66 ported the Button and the keybinding tables',
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
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-66 **收口站点表：Button（最后一叶）+ 键盘动作表**（W45-65 队列实测更正后按块走的第一刀，也是站点表九叶的收尾）：**13 段 15,898 单位 / 13 语句**（chunk-n3ykh62m.js [234038,235650) 1,612u **\`Hto\` Button**；chunk-6ccen3s8.js 10 段 14,212u = 默认绑定表 \`w1\`+平台头 7,075u、174 个动作名 \`ZDe\`+上下文说明 4,928u、\`QOn\`/\`pe\` 76u、**\`dcs\` 33u**、保留键表 \`QDe\` 1,259u、\`pqe\` 88u、别名表 \`Ge\` 173u、**\`Ye\` 416u**、\`ee\` 7u、**\`acs\` 190u**；chunk-yvnhkg35.js \`nA\` 23u；chunk-bk5ct2gw.js \`Yho\` 51u）。**语义（源文实测）**：**Button 必须被插件持有**——\`{key,label}\` 单独答 \`is not held by a plugin of this chain\`（\`wVe\` 拒空 press，与其兄弟 Link 的 href 被守门不同）；**两处动作拒绝**：engine 不认识→\`action "app:nope" is not one of the engine's keybinding actions (app:cycleDiffBase, app:diffFileListDown)\`（字符串用 \`JSON.stringify\` 引回，其它用 \`cN\` 描述），engine 独占→\`action "app:interrupt" is the engine's alone: its key cannot be rebound (ctrl+c, ctrl+d)\`；**独占动作恰两个**（\`app:interrupt\`/\`app:exit\`）——七个保留键里只有两个在默认绑定中出现，故集合由**绑定**而非保留表得来；**检查序**（源文 destructure 序）：props 形→键→plain→dimColor→variant→role→autoFocus→hotkey→action→label→press→children，实测可证（坏 plain 压坏 autoFocus、坏 variant 压未知 action、坏 dimColor 压未知 action、坏 hotkey 压 engine-only、坏 label 压 press 缺失）；children 是唯一"只判形"的字段（数组通过）。**键规范化**：\`Ye\` 折叠 alt 四写/meta 五写、排序修饰键、经 10 条别名表解析单键（\`Ctrl+Shift+B\`≡\`shift+ctrl+b\`，\`meta+up\`/\`opt+up\`≡\`alt+up\`），\`pqe\` 另把空格命名为 \`space\` 且保留 chord 内空格，而 \`Ye\` 单独对空格答空串。**平台头**：import 期一次决定（\`L=O()\` 走 **W45-46 fs 边界**，本包只 import 不重搬），darwin 下 \`Le\` 短路为真故 \`Yho\` 从不被调用；Windows 分支由 \`test/plugin-chain-button-windows.test.ts\` 绑平台 + 装 \`Bun\` 夹具证得（先问 \`1.4.3 >=1.2.23\`，因 \`nA()\` 恒真）。**关键取舍**：新宿主钩子 0；\`Yho\` 的 \`Bun.semver.satisfies\` 是运行期全局（源码跑在 Bun），按源文逐字保留，扫描器补认该全局并写明原因；同模块邻居 \`mJ\`（按键解析）/ \`lcs\`/\`F\`（另两处成员检查）/ \`ze\`/\`Bn\`（schema）/ \`fe\`（平台相关保留键表）/ \`He\` 全部以断言排除=留给绑定编辑器。注册表类型新增 \`ButtonLeafInput\`。**站点表九叶（Raster/Image/Code/Input/Select/Svg/Client/Markdown/Link/**Button**）全数入产品**。验收：check/build/notices（摘要未变）、两副本 \`unresolved 0\`、span \`total 0\`、**${chain}**、两账本逐段回源 + acorn（13 语句、完整、无重叠/无切半/无重复）+ 12 处正文逐字入 seam + 6 处区间 + 平台常量由副本推导 + 7 个未搬邻居排除 + 6 个被导入名"不自声明"且"确在彼处" + \`Bun\` 全局与 Windows 夹具自证、站点表六套回归 ${siteSweep.passed}/${siteSweep.tests}、家族 ${family.passed}/${family.tests}、全量 **${fullLine}**（首跑两条 MCP 计时抖动，空载复跑全绿，两文件与本包无关）、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45ButtonKeysCompiled.v1\`，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [Button+键盘表证据](ports/W45-button-keys-evidence.json)、[三叶证据](ports/W45-client-markdown-link-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
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
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-66 completes the site table: ` +
  'the Button, its props picker and its two action refusals, the keybinding tables behind them — the 174 action ' +
  'names, the 27 default binding contexts and the seven reserved keys — the key normaliser with its alias table, ' +
  'and the press check that makes a Button different from every other leaf of the table. |';
write('research/FEATURES.md', lines.join('\n'));

const standardText = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standardText.indexOf('2026-10-16 W45-65 ');
if (standardAt < 0) throw new Error('coding-standard W45-65 line not found');
const standardEntry = `2026-10-16 W45-66 站点表收口（Button + 键盘动作表）：S-1至S-7已对照。S-1（先读源）：**先量后切**——\`Hto\` 闭包 4 语句 1,921u 中 3 语句（\`TAt\`/\`QAe\`/\`wVe\`）已被 site-leaves/raster-sites 副本覆盖，实名 1 语句 1,612u；\`dcs\`/\`acs\` 闭包 10 语句 14,212u **逐句读过**：\`dcs(e){return pe.has(e)}\` 对 \`ZDe\`（174 动作名）取集合，\`acs\` 用 \`QDe\`（7 保留键）+ \`w1\`（27 上下文默认绑定）交叉出"引擎独占"集合，\`Ye\`/\`Ge\` 是键规范化与别名表，7,075u 那段是**平台头+默认绑定表同一语句**（\`L=O()\`、\`Ie\`、\`Me\`、\`Le\`/\`le\`、\`w1\`），故整段随表入包。S-2（不留半包）：**新宿主钩子 0**——平台探针 \`O\` 复用 W45-46 已绑的 fs 边界（\`import { O }\`），\`nA\`/\`Yho\` 随包逐字搬；同模块邻居 \`mJ\`/\`lcs\`/\`F\`/\`ze\`/\`Bn\`/\`fe\`/\`He\` 双向断言不在副本内（=绑定编辑器，写入 next_package）。S-3（先测后断言）：\`.audit/w45-66-probe.ts\` 先跑再写 13 条用例；**实测出五处非显然行为**——① **Button 必须被插件持有**（\`wVe\` 拒空 press，同族 Link 的 href 却被守门放行）；② **独占动作恰 2 个**（7 保留键中仅 2 个出现在默认绑定里，集合由**绑定**得来）；③ 未知动作**引回**（字符串 \`JSON.stringify\`、其它 \`cN\` 描述），与独占动作的句子不同；④ 选项序为 plain→dimColor→variant→role→autoFocus，且 hotkey 先于 action；⑤ \`pqe\` 认空格为词、\`Ye\` 单独对空格答空串（两个规范化器不同）。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器（66 计划）与 15 个编译驱动，断言两副本 \`unresolved 0\`、span \`total 0\`、notices 摘要未变；acorn 逐段回源（13 语句、完整、无重叠/无切半/无重复）+ 12 处正文逐字入 seam + 6 处区间 + 平台常量由副本推导 + 7 邻居排除 + 被导入名"不自声明/确在彼处" + \`Bun\` 全局与 Windows 夹具自证。S-5/S-6：keys seam 给 5 个按名包装（\`knownAction\`/\`engineOnlyAction\`/\`normalizeKey\`/\`normalizeKeyParts\`）与 7 个按名常量、button seam 给 \`buttonLeafProblem\`；测试只经 seam。S-7：绑定编辑器（\`mJ\`/\`lcs\`/\`F\`/\`ze\`/\`Bn\`/\`fe\`）、\`tno\` 叶表与深度遍历器、React \`Tc(jo,…)\`、其余 \`$\` 表项、\`G2e\`、\`y9e\` 读路径写入 next_package。**工具改动一处**：\`scripts/source-undeclared-scan.mjs\` 的全局表补认 \`Bun\`（源码运行期全局，与 \`process\` 同类），并写明唯一使用者 \`Yho\`+\`Bun.semver.satisfies\`。验收：check/build/notices、两副本 unresolved 0、${chain}、账本与正文自证、站点表六套 ${siteSweep.passed}/${siteSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。**站点表九叶至此全数入产品。**\n`;
write('research/coding-standard.md', standardText.slice(0, standardAt) + standardEntry + standardText.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAnchor = 'W45-65: the Client, the Markdown and the Link';
const statusAt = status.indexOf(statusAnchor);
if (statusAt < 0) throw new Error('STATUS W45-65 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = 'W45-66: the Button, and the keybinding tables it reads. The site table is complete — nine leaves, all of ' +
  'them in the product — and the Button came in last because it is the only leaf whose check reaches outside the table. An ' +
  'action is refused twice: once when the engine does not know the name, quoted back with its serializer, and once when the ' +
  'engine holds it alone, with the reason the reserved-key table carries. Both answers come from the keybinding module, whose ' +
  'ten statements are the defaults per context, the 174 action names, the seven reserved keys, the key normaliser with its ' +
  'alias table, and the two membership checks — `dcs(e){return pe.has(e)}` and the `acs` that crosses the reserved keys with ' +
  'the default bindings and finds exactly two actions, the two the Button\'s own sentence names. Reading the source turned up ' +
  'the difference that matters most for callers: a Button must be held by a plugin at all, because the press check it runs ' +
  'last is the shared predicate and that predicate refuses an absent press, where the Link\'s href check is guarded and ' +
  'admits one. The package is 13 blocks and 15,898 units over four modules, and it adds no host hook of its own: the ' +
  'platform header reads the platform through `O`, the boundary W45-46 already bound, and the only other reach is the ' +
  'runtime global the version comparison uses, which the copied body keeps verbatim, the scanner now knows by name, and ' +
  'the Windows suite installs as a fixture to prove the copied header calls through to it. Evidence: ' +
  '`research/ports/W45-button-keys-evidence.json`, and\n[工作包](ports/W45-chain-runner.md).\n\n';
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-66 ported the Button and the keybinding tables (2026-10-16)

The site table is complete. Nine leaves — Raster, Image, Code, Input, Select, Svg, Client, Markdown, Link and the Button —
are all in the product, and the Button came in last because it is the only one whose check reaches outside the table. An
action is refused twice: once when the engine does not know the name, quoted back with its serializer, and once when the
engine holds it alone with the reason the reserved-key table carries. Both answers live in the keybinding module, and the
ten statements it takes to answer them are the defaults per context, the 174 action names, the seven reserved keys, the
key normaliser with its alias table, and the two membership checks.

The module's first statement is a lesson in reading before cutting. It looks like a header and it is: the platform the
defaults were computed for, whether that platform is Windows, the paste binding it uses, and the toggle binding the
version gate decides. But it is also the defaults table itself — one statement, 7,075 units — so the whole thing comes
with the two checks that read it. Nothing here adds a host hook: the platform comes from \`O\`, which W45-46 already bound
in the fs boundary, so the copy imports it, and the version comparison is a runtime global the copied body keeps
verbatim. The scanner now knows that global the way it knows \`process\`, and the second suite in this package binds the
platform to the source's own word for Windows and installs the global as a fixture, which proves the header asks
\`satisfies("1.4.3", ">=1.2.23")\` first — because the probe beside it answers true — and then derives its toggle key from
the answer.

What reading turned up, measured rather than assumed: a Button must be held by a plugin to be admitted at all, because
the press check it runs last is the shared predicate, and that predicate refuses an absent press where the Link's href
check is guarded and admits one. The engine holds exactly two actions alone — \`app:interrupt\` and \`app:exit\`, the two
the Button's own sentence names — and five of the seven reserved keys are bound to nothing at all, so the set is built
from the bindings rather than from the reserved list. The option checks run in the order the source destructures them,
and two pairs of them are provably ordered: a bad plain beats a bad autoFocus, and a bad hotkey beats an engine-only
action. The two normalisers differ in a way easy to miss: \`pqe\` names the space key as a word and keeps the space inside
a chord, while \`Ye\` alone answers an empty string for a lone space.

Verified: check/build/notices, both scanned copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, both ledgers re-read
from their modules and matched against the copies with acorn (13 statements, whole and contiguous, no cut, no repetition),
twelve body slices quoted verbatim in the keys seam with their ranges, the platform constants derived from the copy rather
than restated, the neighbourhood left out asserted absent (the key parser, the two further membership checks, the schema
builders and the platform-dependent reserved-key list — the binding editor), the imported names asserted absent as
declarations and present in the export lists that own them, the suites ${siteSweep.passed}/${siteSweep.tests} across the six
site-table files, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers (the shared driver now also prints
\`W45ButtonKeysCompiled.v1\`, ${sharedMarkers.length} markers in the shared run and ${allMarkers} across every driver), and the packaged
smoke (${smoke}). The full sweep's first run showed two MCP timing failures while other work ran beside it — a frame count
and a 300 ms \`initialize\` timeout — and the re-run on an idle machine is clean; neither file is touched by this package.
Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: the binding editor the keybinding module still holds (\`mJ\` the key parser, \`lcs\` and \`F\` the further membership
checks, \`ze\`/\`Bn\` the schema builders, \`fe\` the platform-dependent reserved-key list); then the leaf table \`tno\` with the
depth walker that reads it, the React layer \`Tc(jo, …)\`, the remaining \`$\` table entries, the dispatcher \`G2e\`, and the
settings read path behind \`y9e\`.
`);

const rows = [
  ['2026-10-17T12:20:00Z', 'package', 'W45-66 收口站点表：Button（最后一叶）+ 键盘动作表（13 段 15,898 单位 / 13 语句）',
    'buttonLeafProblem/knownAction/engineOnlyAction/normalizeKey/normalizeKeyParts 成为产品面，7 个按名常量（KEY_PLATFORM/KEY_PASTE_KEY/KEY_TOGGLE_KEY/ACTION_NAMES/KNOWN_ACTIONS/DEFAULT_BINDINGS/RESERVED_KEYS/KEY_ALIASES）；注册表类型新增 ButtonLeafInput；新宿主钩子 0（平台探针复用 W45-46 fs 边界）',
    'chunk-n3ykh62m.js [234038,235650) 1,612u + chunk-6ccen3s8.js 10 段 14,212u + chunk-yvnhkg35.js [1245,1268) 23u + chunk-bk5ct2gw.js [342203,342254) 51u',
    '两轮实测（.audit/w45-66-probe.ts + test/plugin-chain-button{#,-windows}.test.ts + .audit/w45-24-compiled.mjs）：Button 必须被插件持有、独占动作恰 2 个、未知动作被引回/独占动作报键、选项序 plain→dimColor→variant→role→autoFocus 且 hotkey 先于 action、pqe 与 Ye 对空格不同；13/13 通过'],
  ['2026-10-17T12:24:00Z', 'decision', 'W45-66 站点表九叶全数入产品，余下只有绑定编辑器',
    'W45-65 的队列实测把 Button 依赖写成"按块走"；本包切出的第一刀即整叶+其两张表，且 Hto 闭包的 3 语句已在他包，故只搬 1 语句 1,612u',
    '同模块邻居 mJ/lcs/F/ze/Bn/fe/He 以断言排除=绑定编辑器（写入 next_package）；nA/Yho 随包逐字搬；Bun 全局由扫描器补认并写明原因',
    `chain ${chain}；keys 副本 12 段 14,286u sha 577192b3…，button 副本 1 段 1,612u sha a66360a8…`],
  ['2026-10-17T12:28:00Z', 'finding', 'W45-66 平台头与版本门实测：darwin 短路、Windows 分支由夹具证得',
    'L=O()（W45-46 fs 边界）→ Ie/Me/Le/le；darwin 下 Le 短路为真故 Yho 从不被调用；Windows 下先问 Yho("1.4.3",">=1.2.23")（nA() 恒真）再问 process.versions.node',
    'Yho=Bun.semver.satisfies 是运行期全局，按源文逐字保留；source-undeclared-scan 的全局表补 Bun 并注明唯一使用点；test/plugin-chain-button-windows.test.ts 绑平台+装全局证"调用穿透到宿主"',
    '.audit/w45-66-probe.ts 输出 KEY_PLATFORM=darwin/KEY_PASTE_KEY=ctrl+v/KEY_TOGGLE_KEY=shift+tab；Windows 用例断言 asked=[["1.4.3",">=1.2.23"]]'],
  ['2026-10-17T12:32:00Z', 'finding', 'W45-66 全量首跑两条 MCP 计时抖动，空载复跑全绿',
    'mcp-notification-stream 一处帧计数断言 2!==1、mcp-subscriptions 的 initialize 在 300ms 超时；两文件与本包改动（plugin-chain-keys/button/registry-state/scripts/test）无交集',
    '判定为满负载下的计时抖动：站点表六套 88/88、家族 407/407 均绿；空载重跑全量 1683/1683 fail 0',
    '.audit/w45-66-tests.txt 复跑 1683 tests / 1683 pass / 0 fail；首跑记录保留在 tick 报告中'],
  ['2026-10-17T12:36:00Z', 'verification', `W45-66 验收：两副本 unresolved 0、span total 0、两账本逐段回源 + acorn + 12 处正文逐字入 seam + 邻居排除 + 被导入名双向核对 + Bun/Windows 夹具自证、${chain}、站点表六套 ${siteSweep.passed}/${siteSweep.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 编译驱动与打包冒烟`,
    '站点表九叶（Raster/Image/Code/Input/Select/Svg/Client/Markdown/Link/Button）全数在产品内；下一包取绑定编辑器（mJ/lcs/F/ze/Bn/fe）',
    `check/build/notices；两副本 unresolved 0；span total 0；${chain}；13 段逐段回源比长度与内容 + acorn（13 语句、完整、无重叠/无切半/无重复）+ 无重复断言；12 处正文逐字入 seam + 6 处区间 + 平台常量由副本推导；7 个邻居排除；被导入名"不自声明"与六份副本导出行的逐一核对；Bun 全局与 Windows 夹具；注册表 ButtonLeafInput 判据；站点表六套 ${siteSweep.passed}/${siteSweep.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 编译驱动 exit 0（共享驱动输出 W45ButtonKeysCompiled.v1，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-66 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-66 acceptance (2026-10-16)

- [x] **The measurement picked the cut.** The Button's closure is four statements, three of which another copy already carries, so the leaf is one block; the two checks it reads are one module's worth of tables and normalisers.
- [x] **Read before cutting.** The keybinding module's first statement is a header and a table at once — the platform, its two derived keys and the 27 default binding sets — which is why the 7,075 units come with the two checks rather than beside them.
- [x] **Nothing was invented at a boundary.** The platform probe is W45-46's, imported; the runtime global the version gate uses is kept verbatim, named by the scanner, and bound by a fixture that proves the copied header calls through to it.
- [x] **Every behaviour was measured before it was asserted,** including five reading alone would have got wrong: a Button must be held by a plugin, only two actions are engine-only, an unknown action is quoted back while an engine-only one is named with its key, the option order is provable in two pairs, and the two normalisers differ on a space.
- [x] **The neighbourhood is asserted absent.** The key parser, the two further membership checks, the schema builders and the platform-dependent reserved-key list are the binding editor, and they are named as the next package rather than quietly left half-taken.
- [x] **A load-induced flake was re-measured, not retried away.** The full sweep's two MCP timing failures were reproduced as timing (both files untouched here, family and site sweeps clean) and the idle re-run is 1683/1683.
- [x] **Sweep.** check/build/notices, both copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, both ledgers with acorn, the seams' verbatim quotes and derived constants, the site-table suites ${siteSweep.passed}/${siteSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
const written = {
  'research/CURRENT.md': 'W45-66 **收口',
  'research/STATUS.md': '\nW45-66:',
  'research/coding-standard.md': '\n2026-10-16 W45-66 ',
  'research/ports/W45-chain-runner.md': '\n## W45-66 ported',
  '.audit/w45-runtime.todo.md': '\n## W45-66 acceptance',
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
