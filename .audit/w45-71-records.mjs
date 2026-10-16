// Write the W45-71 record from the artifacts themselves: the `ui.scroll` and `ui.focus` call path — the
// two site descriptors a call of either name is held to, the two registries, the key, the ownership
// checks, the two bodies and the two entries — plus the recovered-source index this package adds.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 451, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 167, `validation ${identity.validation.files}`);
expect(identity.build.files === 311, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 72) throw new Error('the chain verifier did not pass 72 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const registry = read('scripts/verify-chain-copies.mjs');
for (const entry of ["['W45-scroll-focus', 'plugin-chain-scroll-focus-source']",
  "['W45-scroll-focus-sites', 'plugin-chain-scroll-focus-sites-source']"]) {
  if (!registry.includes(entry)) throw new Error(`the verifier does not register ${entry}`);
}
const at = (needle) => {
  const file = verifier.files.find((entry) => entry.product.includes(needle));
  if (!file) throw new Error(`the verifier does not carry ${needle}`);
  return file;
};
const entriesCopy = at('plugin-chain-scroll-focus-source');
if (entriesCopy.blocks !== 12 || entriesCopy.units !== 1055) throw new Error(`the entries copy is ${JSON.stringify(entriesCopy)}`);
if (entriesCopy.sha256 !== '885001cf3bf533290a3fab259e5a9bc1eda39374d0777665c04c29f69af8ebb7') {
  throw new Error('the entries copy is not the one this package measured');
}
const sitesCopy = at('plugin-chain-scroll-focus-sites-source');
if (sitesCopy.blocks !== 7 || sitesCopy.units !== 996) throw new Error(`the sites copy is ${JSON.stringify(sitesCopy)}`);
if (sitesCopy.sha256 !== '60df4e03c70e8d7617db16fff84f187d4ab61355e34449617693dd5edb476f0b') {
  throw new Error('the sites copy is not the one this package measured');
}

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

const entryBlocks = [
  ['chunk-sfn1dbxq.js', 475447, 475544, 97], ['chunk-sfn1dbxq.js', 475544, 475653, 109],
  ['chunk-sfn1dbxq.js', 475653, 475702, 49], ['chunk-sfn1dbxq.js', 476009, 476078, 69],
  ['chunk-sfn1dbxq.js', 476191, 476241, 50], ['chunk-sfn1dbxq.js', 476241, 476267, 26],
  ['chunk-sfn1dbxq.js', 476681, 476733, 52], ['chunk-sfn1dbxq.js', 476733, 476926, 193],
  ['chunk-sfn1dbxq.js', 479578, 479605, 27], ['chunk-sfn1dbxq.js', 479605, 479656, 51],
  ['chunk-sfn1dbxq.js', 479656, 479962, 306], ['chunk-sfn1dbxq.js', 479962, 479988, 26],
];
const siteBlocks = [
  ['chunk-nyce03br.js', 15588, 15723, 135], ['chunk-nyce03br.js', 16084, 16200, 116],
  ['chunk-nyce03br.js', 34850, 35160, 310], ['chunk-nyce03br.js', 35160, 35211, 51],
  ['chunk-nyce03br.js', 35211, 35334, 123], ['chunk-nyce03br.js', 94084, 94166, 82],
  ['chunk-nyce03br.js', 94166, 94345, 179],
];
const entriesLedger = checkCopy('the entries copy', 'src/plugin-chain-scroll-focus-source.ts', entryBlocks, 12);
const sitesLedger = checkCopy('the sites copy', 'src/plugin-chain-scroll-focus-sites-source.ts', siteBlocks, 7);

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
const checkNames = (text, ownNames) => {
  const names = namesIn(text);
  for (const name of ownNames) if (!names.declaredNames.has(name)) throw new Error(`the copy does not carry ${name}`);
  if (names.exportedNames.size !== ownNames.length) throw new Error('the copy exports a different count');
  for (const name of ownNames) if (!names.exportedNames.has(name)) throw new Error(`the copy does not export ${name}`);
  return names;
};
const entriesText = read('src/plugin-chain-scroll-focus-source.ts');
const sitesText = read('src/plugin-chain-scroll-focus-sites-source.ts');
checkNames(entriesText, ['XH', 'uyt', 'Uet', 'pyt', 'ahe', '_z', 'mse', 'PY', 'bse', 'iL', 'IY', 'vse']);
checkNames(sitesText, ['pr', 'ro', 'Vr', 'ko', 'Ci', 'Po', 'wa']);
const copiesImports = {
  'src/plugin-chain-scroll-focus-source.ts': {
    './plugin-chain-source.js': ['Ge'], './plugin-chain-host.js': ['it'], './plugin-chain-entry.js': ['Mm'],
  },
  'src/plugin-chain-scroll-focus-sites-source.ts': {
    './plugin-chain-source.js': ['C', 'h$', 'L', 'we'],
    './plugin-chain-override-sites-source.js': ['et'],
    './plugin-chain-sites-source.js': ['re'],
  },
};
for (const [path, expected] of Object.entries(copiesImports)) {
  const text = read(path);
  const names = namesIn(text);
  for (const [source, list] of Object.entries(expected)) {
    const lines = [...text.matchAll(new RegExp(`import \\{ ([^}]*) \\} from '\\./${source.slice(2)}'`, 'g'))];
    if (lines.length === 0) throw new Error(`${path} does not import from ${source}`);
    const imported = lines.flatMap((line) => line[1].split(',').map((name) => name.trim()));
    for (const name of list) {
      if (!imported.includes(name)) throw new Error(`${path} does not import ${name} from ${source}`);
      if (names.declaredNames.has(name)) throw new Error(`${path} declares ${name} instead of importing it`);
    }
  }
  const expectedCount = Object.values(expected).flat().length;
  if (names.importedNames.size !== expectedCount) throw new Error(`${path} imports a different count`);
}
const exportedBy = {
  'src/plugin-chain-source.ts': ['C', 'Ge', 'h$', 'L', 'we'],
  'src/plugin-chain-override-sites-source.ts': ['et'],
  'src/plugin-chain-sites-source.ts': ['re'],
  'src/plugin-chain-host.ts': ['it', 'zd'],
  'src/plugin-chain-entry.ts': ['Mm'],
};
// A name like `h$` has no word boundary after it, so the ends are asserted by hand: neither a word
// character nor another `$` may touch the name on either side.
const rx = (name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const [path, list] of Object.entries(exportedBy)) {
  const text = read(path);
  for (const name of list) {
    const exported = new RegExp(
      `export (?:function|const|let|var|class) ${rx(name)}(?![\\w$])|export \\{[^}]*(?<![\\w$])${rx(name)}(?![\\w$])`).test(text);
    if (!exported) throw new Error(`${path} no longer exports ${name}, which this package imports`);
  }
}

// The closures this package closes: what was measured before the cut, and what the overlap tool says now.
for (const [seeds, module, wanted, fresh] of [
  [['PY', 'IY'], 'chunk-sfn1dbxq.js', 'covered 10 statements / 1002 units; fresh 0 statements / 0 units', null],
  [['wa', 'Ci'], 'chunk-nyce03br.js', 'covered 18 statements / 1928 units; fresh 0 statements / 0 units', null],
]) {
  const out = execFileSync(process.execPath, ['.audit/w45-57-overlap.mjs', module, ...seeds], { encoding: 'utf8' });
  if (!out.includes(wanted)) throw new Error(`the ${seeds.join('/')} closure is no longer: ${wanted}`);
}
const entryClosure = execFileSync(process.execPath, ['.audit/w45-49-closure.mjs', 'chunk-sfn1dbxq.js', 'PY', 'IY'], { encoding: 'utf8' });
if (!/10 statements, 1002 units/.test(entryClosure)) throw new Error('the entry closure is no longer 10 statements / 1,002 units');
if (!/Ge <- Ge of .*chunk-ae84tp6z\.js/.test(entryClosure)) throw new Error('the entry closure no longer reads the store wrapper out of another chunk');
const siteClosure = execFileSync(process.execPath, ['.audit/w45-49-closure.mjs', 'chunk-nyce03br.js', 'wa', 'Ci'], { encoding: 'utf8' });
if (!/18 statements, 1928 units/.test(siteClosure)) throw new Error('the site closure is no longer 18 statements / 1,928 units');
if (!/L <- L of .*chunk-6q0v3ahc\.js/.test(siteClosure)) throw new Error('the site closure no longer reads the object test out of another chunk');

const scan = read('.audit/w45-71-scan.txt');
if ((scan.match(/unresolved 0/g) ?? []).length !== 2) throw new Error('the two scanned copies did not scan clean');

// The seams: every body quoted verbatim, every range cited, every wrapper calling its own body.
const quoteCheck = (seamPath, blocks, expected) => {
  const seam = read(seamPath);
  const elided = [];
  let verbatim = 0;
  for (const [module, start, end] of blocks) {
    const slice = read(`extracted-v2/modules/${module}`).slice(start, end);
    if (!slice.includes('\n') && seam.includes(slice)) { verbatim++; continue; }
    elided.push([module, start, end].join(' '));
    const lines = slice.split('\n');
    if (!seam.includes(lines[0]) || !seam.includes(lines[lines.length - 1])) {
      throw new Error(`the seam does not quote the head and tail of ${module} [${start},${end})`);
    }
  }
  if (verbatim !== expected) throw new Error(`${seamPath} quotes ${verbatim} bodies verbatim, not ${expected}: ${elided.join('; ')}`);
  if (elided.length !== 0) throw new Error(`${seamPath} elides ${elided.length} bodies: ${elided.join('; ')}`);
  for (const [module, start, end, units] of blocks) {
    const range = `[${start},${end}) ${units}`;
    if (!seam.includes(range)) throw new Error(`${seamPath} does not cite ${range} (${module})`);
  }
  return seam;
};
const entriesSeam = quoteCheck('src/plugin-chain-scroll-focus.ts', entryBlocks, 12);
const sitesSeam = quoteCheck('src/plugin-chain-scroll-focus-sites.ts', siteBlocks, 7);
for (const name of ['SCROLL_ENTRY', 'FOCUS_ENTRY', 'scrollSites', 'focusSites', 'siteKey', 'scrollSiteFor',
  'focusSiteFor', 'scrollCall', 'focusCall', 'scrollCallIsForeign', 'focusCallIsForwarded',
  'otherHolderHasKeyboard', 'SOURCE_BODIES']) {
  if (!entriesSeam.includes(name)) throw new Error(`the entries seam does not carry ${name}`);
}
for (const name of ['FOCUS_SITE', 'SCROLL_SITE', 'FOCUS_CALL_ARGUMENTS', 'SCROLL_CALL_ARGUMENTS',
  'siteAnswerCheck', 'elementCheck', 'buildSite', 'registerChainSite', 'SOURCE_BODIES']) {
  if (!sitesSeam.includes(name)) throw new Error(`the sites seam does not carry ${name}`);
}
for (const call of ['return ahe() as Map<string, PluginScrollSite>;', 'return Uet() as Map<string, PluginFocusSite>;',
  'return _z(component, requestId);', 'return mse(call) as PluginScrollSite | undefined;',
  'return iL(call) as PluginFocusSite | undefined;', 'return PY(call) as { deny?: string };',
  'return IY(call) as { deny?: string };', 'return pyt(site, origin);', 'return uyt(site, call);',
  'return XH(site, origin);']) {
  if (!entriesSeam.includes(call)) throw new Error(`an entries wrapper does not call the copied body: ${call}`);
}
for (const call of ['return pr(answer, args, fromBelow);', 'return Vr(next, previous);', 'return ro(spec);',
  "registerChainSite('ui.focus', Ci as never);", "registerChainSite('ui.scroll', wa as never);"]) {
  if (!sitesSeam.includes(call)) throw new Error(`the sites seam does not carry: ${call}`);
}
if (!entriesSeam.includes("import './plugin-chain-scroll-focus-sites.js';")) {
  throw new Error('the entries seam does not register the sites before the entries are built');
}
// The order the two halves evaluate in is part of the behaviour, so the seam imports the sites' module
// above the copy, and the product's registry imports it above the chain copies.
const seamOrder = entriesSeam.indexOf("import './plugin-chain-scroll-focus-sites.js';");
const seamCopy = entriesSeam.indexOf("from './plugin-chain-scroll-focus-source.js';");
if (seamOrder < 0 || seamCopy < 0 || seamOrder > seamCopy) throw new Error('the entries seam imports the sites after the copy');
const productRegistry = read('src/plugin-chain-registry.ts');
if (!productRegistry.includes("import './plugin-chain-scroll-focus-sites.js';")) {
  throw new Error('the product registry does not import the two sites');
}
if (!productRegistry.includes("registerChainCore('ui.scroll', SCROLL_ENTRY.core as ChainHandler);") ||
    !productRegistry.includes("registerChainCore('ui.focus', FOCUS_ENTRY.core as ChainHandler);")) {
  throw new Error('the product registry does not register the two cores');
}
const registryState = read('src/plugin-chain-registry-state.ts');
for (const name of ['PluginScrollSite', 'PluginFocusSite']) {
  if (!registryState.includes(`export interface ${name}`)) throw new Error(`the registry state does not carry ${name}`);
}
// The site table grew by exactly these two, and the three suites that count it say why.
const siteCounts = [
  'test/plugin-chain-classic.test.ts', 'test/plugin-chain-override-sites.test.ts', 'test/plugin-chain-classic-sites.test.ts',
];
for (const path of siteCounts) {
  const text = read(path);
  if (!/Object\.keys\(\$be\(\)\)\.length, 113/.test(text)) throw new Error(`${path} does not count the two new sites`);
  if (!/W45-71|ui\.scroll/.test(text)) throw new Error(`${path} does not say where the two come from`);
}
const suite = read('test/plugin-chain-scroll-focus.test.ts');
for (const name of ['SCROLL_ENTRY', 'FOCUS_ENTRY', 'scrollSites', 'focusSites', 'siteKey', 'scrollSiteFor',
  'focusSiteFor', 'scrollCall', 'focusCall', 'scrollCallIsForeign', 'focusCallIsForwarded',
  'otherHolderHasKeyboard', 'FOCUS_SITE', 'SCROLL_SITE', 'FOCUS_CALL_ARGUMENTS', 'SCROLL_CALL_ARGUMENTS',
  'siteAnswerCheck', 'elementCheck']) {
  if (!suite.includes(name)) throw new Error(`the suite does not exercise ${name}`);
}
if (suite.includes('plugin-chain-scroll-focus-source.js') || suite.includes('plugin-chain-scroll-focus-sites-source.js')) {
  throw new Error('the suite reaches past a seam to a copy');
}

// The recovered-source index: the bundle's own layout as the port measures it, and the proof that the
// covered statements reassemble to what the module holds.
const indexReport = JSON.parse(execFileSync(process.execPath, ['scripts/source-index.mjs', '.audit/w45-71-index.json'], { encoding: 'utf8' })
  .split('\n').filter((line) => line.trim() !== '').at(-1) ? read('.audit/w45-71-index.json') : '{}');
if (indexReport.schema !== 'W45SourceIndex.v1') throw new Error('the source index was not written');
const totals = indexReport.totals;
if (totals.chunks !== 54 || totals.portedStatements !== 1394 || totals.portedUnits !== 243108) {
  throw new Error(`the source index totals moved: ${JSON.stringify(totals)}`);
}
if (totals.bundleModules !== 2609) throw new Error(`the bundle carries ${totals.bundleModules} modules`);
const indexed = new Map(indexReport.chunks.map((chunk) => [chunk.module, chunk]));
for (const [module, start, end] of [...entryBlocks, ...siteBlocks]) {
  const chunk = indexed.get(module);
  if (!chunk) throw new Error(`${module} is missing from the index`);
  if (!chunk.ported.some((statement) => statement.range[0] === start && statement.range[1] === end)) {
    throw new Error(`the index does not carry ${module} [${start},${end})`);
  }
}
// Reassembly: the index digests each chunk's covered statements in the source's own order, so a chunk
// can be rebuilt from the copies and compared with the module it came out of.
for (const module of ['chunk-sfn1dbxq.js', 'chunk-nyce03br.js']) {
  const text = read(`extracted-v2/modules/${module}`);
  const chunk = indexed.get(module);
  const digest = crypto.createHash('sha256')
    .update(chunk.ported.map((s) => text.slice(s.range[0], s.range[1])).join('\u0000')).digest('hex');
  if (digest !== chunk.portedSha256) throw new Error(`${module} does not reassemble to the digest the index holds`);
  const copies = new Set(chunk.ported.map((s) => s.product));
  if (copies.size < 2) throw new Error(`${module} is carried by ${copies.size} copies`);
}

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-71-full.txt');
if (full.failed !== 0 || full.tests !== 1768) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const suiteSweep = summary('.audit/w45-71-suite.txt');
if (suiteSweep.failed !== 0 || suiteSweep.tests !== 21) throw new Error('the new suite is not 21/21');
const family = summary('.audit/w45-71-family.txt');
if (family.failed !== 0 || family.tests !== 492) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const seamSweep = summary('.audit/w45-71-seams.txt');
if (seamSweep.failed !== 0 || seamSweep.tests !== 94) throw new Error('the call-path seam sweep is not clean');
const span = JSON.parse(read('.audit/w45-71-span.txt'));
if (span.total !== 0) throw new Error(`the span scan found ${span.total}`);
const notices = JSON.parse(read('.audit/w45-71-notices.txt').split('\n').filter((line) => line.startsWith('{')).at(-1));
if (notices.sha256 !== '384c78801194aedea80331383ccd93708c2dfa46bc746003dc112c930b73d13c') {
  throw new Error('the dependency-notice digest moved');
}
const smokeReport = read('.audit/w45-71-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 319) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
let allMarkers = 0;
for (const name of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${name}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers += out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).length;
}
const sharedMarkers = read('.audit/w45-71-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-71-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45ScrollFocusCompiled.v1')) throw new Error('the shared driver did not print the W45-71 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45ScrollFocusCompiled.v1 (${sharedMarkers.length} markers, ${allMarkers} across every driver: it reads the two registries, the key, both ownership checks, the two commit roads, both descriptor argument checks and the answer check off the built output, with the sites registered by the product registry)`;

const evidence = {
  schema: 'W45ScrollFocusEvidence.v1',
  package: 'W45-71 — the `ui.scroll` and `ui.focus` call path, and the recovered-source index',
  date: '2026-10-16',
  question: 'A plugin asks a site to scroll or to take the keyboard. What is the call held to before it reaches the site, what may the site refuse with, and how much of the recovered application does the product carry so far?',
  answer: 'Two call entries and the two site descriptors behind them. The entries are the `$` call table\'s, built by `Mm` from the host seam\'s site table: `bse` (ui.scroll) whose core is `PY`, and `vse` (ui.focus) whose core is `IY`. A call reaches a site through a registry the UI side fills — `ahe()` for scroll sites, `Uet()` for focus sites, both `it()`\'s own maps, filed under the key `component:requestId` (`_z`, which escapes nothing, so a component containing a colon cannot be told from a longer key). `PY` refuses a call for a site that is not there (`no such site`), one whose site another plugin owns (`not this plugin\'s site`, through `pyt`: only a plugin caller is refused, and only when the site has an owner), and otherwise answers the site\'s own `commit(offset, origin)` — `{}` when the window moved, and `the window moved meanwhile` when it did not. `IY` refuses the same first case, then a **forwarded** call (`uyt`: a plugin that is not the site\'s owner forwarding another plugin\'s call — the same plugin touching the site on its own behalf passes), then a site that does not hold the keyboard (`that site does not hold the keyboard`), then another plugin\'s element holding it (`another plugin\'s element holds the keyboard`, through `XH`), and otherwise passes the site\'s `commit(call)` sentence through as the refusal. The two descriptors are what a call of either name must carry before any of that: `wa` (ui.scroll) checks the offset is a whole row number 0 or more and that a rewrite did not change the call\'s envelope, `Ci` (ui.focus) checks the element against the previous envelope (`Vr`: an element where the move named none is one of the engine\'s stops, none where it named one is a rewrite naming another) and the envelope itself (`re`), and both share `pr`, which refuses a `deny` that is not a non-empty string — so a silent refusal cannot read as success. The descriptors are registered into the site table by their own module, which the entries\' seam imports above its bodies because `Mm` reads `zd[name]` while the entries are built; the product\'s registry imports that module above the chain copies and registers the two cores. This package also adds the recovered-source index: every chunk the product draws from, the statements it carries out of it and the statements still missing, with a digest of the covered statements in the source\'s own order so a chunk can be reassembled from the copies and compared with the module it came from.',
  ported: [...entriesLedger.blocks, ...sitesLedger.blocks].map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  planExtensions: [
    {
      plan: 'research/ports/W45-scroll-focus-blocks.plan.json',
      what: 'a new plan, twelve blocks and twelve exports in one chunk (the entries half)',
      blocks: '0 → 12 blocks, 1,055 units, 12 statements',
      why: 'the two entries and their registries, the key, the two ownership checks and the two bodies are twelve whole statements of the plugin chunk; the store wrapper and the registry getter come from copies that already carry them',
    },
    {
      plan: 'research/ports/W45-scroll-focus-sites-blocks.plan.json',
      what: 'a new plan, seven blocks and seven exports in another chunk (the descriptors half)',
      blocks: '0 → 7 blocks, 996 units, 7 statements',
      why: 'the two descriptors cannot live in the same file as the entries: `Mm` pairs an entry with `zd[name]` while the entries\' copy is evaluated, so the descriptors have to be registered first, and a file that both declared the descriptors and imported the registration would be a cycle. The shared check, the site builder, the element check and the envelope builder (`et`, `we`, `C`, `re`) come from copies that already carry them; the two descriptors and the four statements they are made of are fresh.',
    },
  ],
  boundary: 'No new host boundary. The package reads the entry builder from the entry seam, the store wrapper and the three string helpers from the runner copy, the site builder and the description helper from the override-sites copy, the envelope check from the sites copy, and the site table from the host seam — twelve names over five copies. It changes outside its own files exactly where the product had to be wired: the registry imports the descriptors\' module and registers the two cores, and three existing suites that count the site table now count 113 and say why.',
  measured: [
    'The key a site is filed under is the component and the request id joined by a colon with nothing escaped: measured, `button:r1`, `a:b:c` for a request id that contains a colon, and `:` for two empty strings — so a component containing a colon is a key that cannot be told from a longer one.',
    'The two registries are the registry state\'s own maps, read through a store wrapper that is an identity in this build: measured, `ahe()` and `Uet()` are `it().scrollSites` and `it().focusSites` by identity, and a key no site is filed under answers nothing.',
    'The scroll call\'s three refusals and its success are measured: no such site; `not this plugin\'s site` when the caller is a plugin and the site has an owner that is not it; nothing at all when the site has no owner or the caller is the editor; and `the window moved meanwhile` when the site\'s own commit says the window moved.',
    'The focus call refuses a forwarded call rather than a call: measured, a plugin forwarding another plugin\'s call for a site another plugin owns is refused (`not this plugin\'s site`), while the same plugin calling on its own behalf passes, and an editor origin is never refused by that check.',
    'The focus call reads the keyboard twice and in this order: whether the site holds it at all (`that site does not hold the keyboard`), then whether another plugin\'s element holds it right now (`another plugin\'s element holds the keyboard`) — and a holder that is the caller\'s own plugin passes.',
    'A site\'s own refusal is passed through as the refusal, and a call that succeeds answers `{}` rather than nothing: measured through both entries\' `core.run`, which answers exactly what the body answers.',
    'The element check reads both directions and refuses anything that is not a non-empty string: measured, `an element where the move named none (one of the engine\'s stops)`, `no element where the move named one (a rewrite names another)`, and `an element that is not a non-empty string` for a number or an empty string.',
    'The shared answer check refuses a silent refusal: measured, an answer with no `deny` passes, one with a non-empty `deny` passes, and one with an empty `deny` is refused as `a deny that is not a non-empty string`; a scroll site is handed an answer that is not an object at all and refuses it as `something that is not a result object`.',
    'The scroll offset is checked and not restored: measured, an offset of 1.5 or −1 is refused as `an offset that is not a whole row number (0 or more)`, the offset is absent from the seven names the site restores, and a stray key in the call is not refused.',
    'The envelope check compares the new call with the previous one and names the first changed key: measured, `a changed plugin (the envelope is the engine\'s; a rewrite keeps component, requestId, plugin, origin)`. It throws when there is no previous envelope (`Cannot read properties of undefined (reading \'component\')`), which is measured rather than assumed.',
    'Both halves of the path are now complete in the product: measured by the overlap tool, the entries\' closure is 10 statements / 1,002 units and the descriptors\' is 18 statements / 1,928 units, with 0 fresh statements in either — every statement either half reaches for is carried by some copy.',
    'The two descriptors are in the host seam\'s table under their event names: measured through the built product, `zd[\'ui.scroll\']` and `zd[\'ui.focus\']` are the descriptors this package ported, and the entries\' `site` is that same object — the pair `Mm` builds.',
    'The site table is 113 entries: measured, the three suites that count it see 111 + these two, which is why each of them now names W45-71 where it states the number.',
    'The recovered-source index measures the port against the bundle\'s own layout rather than the package layout: 54 chunks drawn from, 1,394 of their 28,540 statements and 243,108 of their 10,315,424 bytes covered, out of 2,609 modules in the bundle; the covered statements of each chunk digest in the source\'s own order, and the two chunks this package touches reassemble to the digest the index holds.',
  ],
  regressions: `the new suite ${suiteSweep.passed}/${suiteSweep.tests} inside the ten call-path seam files (${seamSweep.passed}/${seamSweep.tests}) and the three site-count suites updated for the two new registrations; ${familyLine}`,
  full: fullLine,
  compiled: driverLine,
  smoke,
  caveat: 'The first full-suite run of this package had one failure: `migration-integration.test.ts` timed out at 4.2 s inside a fixture waiting on an observable condition while the whole file set ran in parallel. The same file passes alone in 2.5 s (17/17) and the second full run was clean, so the failure is timing under load rather than a behaviour this package changed; it is recorded here rather than smoothed over.',
  next_package: [
    'the React layer `Tc(jo, { key: `raster:${plugin}:${key}`, … })` in chunk-kjfwbh4w.js — 115 statements / 34,411 units and ~130 imports, so it has to be partitioned before it is taken',
    'the remaining `$` table entries, each measured before it is taken: `ui.copy` (blocked on the clipboard encoder `Sv`), `fs.ancestors` (the walker `mzt` is 85 statements / 15,533 units)',
    'the settings read path behind `y9e` — 590 statements / 327,047 units; the managed-settings gate `CT` and `Tp`; Q-086\'s 15 registry-reading cores and their 34 sites; the notification provider `a4n`',
  ],
};
write('research/ports/W45-scroll-focus-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);

const marks = {
  current: 'W45-71 **收口',
  features: '; W45-71 closes the `$` table\'s `ui.scroll` and `ui.focus` path',
  standard: '2026-10-16 W45-71 ',
  status: 'W45-71:',
  runner: '## W45-71 ported the `ui.scroll` and `ui.focus` call path',
};
const stripBlock = (text, mark, { toEnd = false, paragraph = false } = {}) => {
  const at = text.indexOf(mark);
  if (at < 0) return text;
  const start = text.lastIndexOf('\n', at) + 1;
  if (toEnd) return text.slice(0, start);
  const end = paragraph ? text.indexOf('\n\n', at) : text.indexOf('\n', at);
  if (end < 0) return text.slice(0, start);
  // A paragraph entry ends with the blank line that separates it from the next one, so both newlines
  // go: leaving one behind would add a blank line every time this script runs.
  return text.slice(0, start) + text.slice(paragraph ? end + 2 : end + 1);
};

const current = read('research/CURRENT.md');
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-71 **收口 \`ui.scroll\`/\`ui.focus\` 调用路径（含两个站点描述符）并新增"复原源码索引"**（插件让某个站点滚动、或让某个站点拿键盘：调用到达站点前被什么量、站点能拿什么拒绝）：**19 段 2,051 单位 / 19 语句 / 两个副本**（chunk-sfn1dbxq.js 12 段 1,055u：\`PY\` ui.scroll 193u、\`IY\` ui.focus 306u、\`ahe\`/\`Uet\` 两张站点注册表 50u/49u、\`_z\` \`component:requestId\` 键 26u、\`mse\`/\`iL\` 两次查找 52u/51u、\`pyt\` 滚动归属检查 69u、\`uyt\` **转发调用**检查 109u、\`XH\` 键盘持有者检查 97u、\`bse\`/\`vse\` 两个入口 27u/26u；chunk-nyce03br.js 7 段 996u：\`wa\` ui.scroll 站点 179u、\`Ci\` ui.focus 站点 123u、\`ro\` 站点构造器 116u、\`pr\` 共享应答检查 135u、\`Vr\` 元素检查 310u、\`ko\`/\`Po\` 信封名表 51u/82u）。**语义（源文实测）**：键**不转义**（\`a:b:c\` 说明带冒号的 component 与更长的键无法区分）；\`PY\` 三拒（无此站点 → 他人的站点 → 站点自己的 commit：成功 \`{}\`、窗口已动 \`the window moved meanwhile\`）；\`IY\` 四拒（**只拒"转发"调用**——同插件自用可通过 → 站点未持键盘 → **别的插件元素正持有键盘** → 站点自己的句子原样传出）；两个描述符在调用到站前先量：\`wa\` **offset 必须是 0 以上整数行号**且**不参与还原**（\`Po\` 七名里没有 offset，实测杂键不拒）、\`Ci\` 先量元素（少给/多给/非串三句）再量信封（\`a changed plugin (the envelope is the engine's; a rewrite keeps component, requestId, plugin, origin)\`），两者共享 \`pr\`：**空 deny 被拒**（\`a deny that is not a non-empty string\`，静默拒绝不能读成成功）、非对象应答 \`something that is not a result object\`。**关键取舍**：新宿主边界 0；**描述符必须与入口分包**——\`Mm\` 在入口副本求值时读 \`zd[name]\`，故描述符副本先注册、入口 seam 在副本之上 import 站点模块；产品注册表 import 该模块并 \`registerChainCore\` 两条（\`ui.scroll\`/\`ui.focus\`）；站点表 111 → **113**，三个既有计数套件同步并写明来源。**新增产物**：\`scripts/source-index.mjs\` + \`research/ports/W45-source-index.json\`——**按 bundle 自身布局**统计（而非按包布局）：已触 54 个 chunk / 28,540 语句中 1,394 条 / 10,315,424 单位中 243,108 单位（2.4%），bundle 共 2,609 模块；每 chunk 覆盖语句**按源码原序**给出摘要，可把副本重新拼回原模块比对（本包两个 chunk 均已复算一致）。**验收**：check/build/notices（摘要未变）、两副本 \`unresolved 0\`、span \`total 0\`、**${chain}**、账本逐段回源 + acorn（12+7 语句、完整、无重叠/无切半/无重复）+ 19 处正文逐字 + 19 处区间 + 12/12 与 7/7 名导入导出双向核对 + 两处闭包 fresh 0 复测 + seam import 次序断言 + 注册表 wiring 断言 + 索引总量与两 chunk 复算断言、调用路径十套 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量 **${fullLine}**（一次并行负载下 \`migration-integration\` 超时，单跑 17/17、复跑全绿，已如实记录）、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45ScrollFocusCompiled.v1\`，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [滚动/聚焦证据](ports/W45-scroll-focus-evidence.json)、[复原源码索引](ports/W45-source-index.json)、[调用派发器证据](ports/W45-call-dispatch-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
// The C-12 block is a log, one row per package, newest first: this package's row replaces itself on a
// re-run and is inserted above the block otherwise. Replacing the first C-12 row outright would drop
// the package below it.
const currentRows = current.split('\n');
const ownRow = currentRows.findIndex((line) => line.startsWith(anchor) && line.includes('W45-71 **收口'));
if (ownRow >= 0) currentRows[ownRow] = row;
else {
  const anchorLine = currentRows.findIndex((line) => line.startsWith(anchor));
  if (anchorLine < 0) throw new Error('the C-12 row was not found');
  currentRows.splice(anchorLine, 0, row);
}
write('research/CURRENT.md', currentRows.join('\n'));

const features = read('research/FEATURES.md').replace(new RegExp(`${marks.features.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^|]*`), '');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('the interactive feature row was not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-71 closes the \`$\` table's \`ui.scroll\` and \`ui.focus\` ` +
  'path: the two site descriptors a call of either name is held to (a whole-row offset that is never restored; an element ' +
  'that may not appear where the move named none, nor vanish where it named one; an envelope a rewrite may not change; and ' +
  'a refusal that has to be a non-empty string), the two registries the UI side files sites in, the ownership and keyboard ' +
  'holder checks each call makes, and the commit road whose refusal is the site\'s own sentence. |';
write('research/FEATURES.md', lines.join('\n'));

const standardText = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standardText.indexOf('2026-10-16 W45-70 ');
if (standardAt < 0) throw new Error('coding-standard W45-70 line not found');
const standardEntry = `2026-10-16 W45-71 ui.scroll/ui.focus 调用路径 + 复原源码索引：S-1至S-7已对照。S-1（先读源）：**先量闭包再切**——入口闭包 10 语句/1,002 单位、站点描述符闭包 18 语句/1,928 单位；逐个查证后发现**描述符是这条链的必经部分**（\`Mm\` 建入口时要 \`zd[name]\`），故本包同时搬描述符侧（7 段 996u）。S-2（不留半包）：新宿主边界 0；**包外改动三处且都已记录**——① \`plugin-chain-registry.ts\` import 站点模块并注册两条 core；② 站点表 111→113，三个计数套件同步并在断言消息里写明来源；③ 新增 \`scripts/source-index.mjs\` 与索引产物。S-3（先测后断言）：\`.audit/w45-71-probe.ts\` 先跑再写 21 条用例；**实测出五处非显然行为**——① 键不做转义（\`a:b:c\`）；② \`IY\` 只拒**转发**调用，同插件自用放行；③ 滚动 offset **被检查但不被还原**（\`Po\` 无 offset，杂键不拒）；④ 空 \`deny\` 被拒而"非对象应答"另有句子（\`something that is not a result object\`）；⑤ 无前次信封时信封检查**抛错**（\`Cannot read properties of undefined (reading 'component')\`）——一并入记录。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器（72 计划）、自跑全部编译驱动、自跑索引脚本并复算两个 chunk 的 \`portedSha256\`；断言两副本 \`unresolved 0\`、span \`total 0\`、notices 摘要未变；acorn 逐段回源（12+7 语句）+ 19 处正文逐字 + 19 处区间 + 名称双向核对 + 两闭包 fresh 0 + seam import 次序 + 注册表 wiring。S-5/S-6：两个 seam（入口 12 包装 + 站点 7 描述符与注册），测试只经 seam。S-7：React \`Tc(jo,…)\` 需先分区、其余 \`$\` 表项（\`ui.copy\` 卡 \`Sv\`、\`fs.ancestors\` 的 \`mzt\` 85 语句）、\`y9e\` 读路径、\`CT\`/\`Tp\`/Q-086/\`a4n\` 写入 next_package。**\`$\` 表一侧的滚动/聚焦路径至此入产品。**验收：check/build/notices、两副本 unresolved 0、${chain}、账本与正文自证、闭包 fresh 0、索引复算、调用路径十套 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standardText.slice(0, standardAt) + standardEntry + standardText.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAnchor = 'W45-70: the `$` call dispatcher';
const statusAt = status.indexOf(statusAnchor);
if (statusAt < 0) throw new Error('STATUS W45-70 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = 'W45-71: the `ui.scroll` and `ui.focus` call path, and the recovered-source index. A plugin that asks a ' +
  'site to scroll or to take the keyboard now has the whole road in the product: the two site descriptors the call is held ' +
  'to before it reaches the site (a whole-row offset that is checked and never restored; an element that may not appear ' +
  'where the move named none nor vanish where it named one; an envelope a rewrite may not change; and an answer whose ' +
  'refusal must be a non-empty string, so a silent refusal cannot read as success), the two registries the UI side files ' +
  'sites in under `component:requestId`, the ownership checks (a plugin may not touch a site another plugin owns, and a ' +
  'plugin forwarding another\'s call is refused where the same plugin calling on its own behalf is not), the keyboard ' +
  'holder checks, and the commit road whose refusal is the site\'s own sentence. The descriptors are their own module ' +
  'because the order they evaluate in is part of the behaviour: `Mm` pairs an entry with the site table entry while the ' +
  'entries are built, so the product\'s registry imports the descriptors first and registers both cores. The package is 19 ' +
  'blocks and 2,051 units over two chunks and two copies, adds no host boundary, and changes outside itself only where the ' +
  'product had to be wired — the registry, and three suites that count the site table, which is 113 now and says why. It ' +
  'also adds the recovered-source index (`scripts/source-index.mjs`, `research/ports/W45-source-index.json`): every chunk ' +
  'the product draws from, the statements it carries and the statements still missing, measured against the bundle\'s own ' +
  'layout rather than the package layout, with a digest of the covered statements in the source\'s order so a chunk can be ' +
  'reassembled from the copies and compared with the module it came out of. Evidence: ' +
  '`research/ports/W45-scroll-focus-evidence.json`, and\n[工作包](ports/W45-chain-runner.md).\n\n';
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
// Collapse the blank line run before the heading: the toEnd strip keeps whatever separated the previous
// section, and adding one more newline per run would grow the file.
write('research/ports/W45-chain-runner.md', runner.replace(/\n+$/, '\n') + `
## W45-71 ported the \`ui.scroll\` and \`ui.focus\` call path (2026-10-16)

Two \`$\` call entries and the two site descriptors behind them: nineteen blocks, 2,051 units, nineteen
statements over two chunks and two copies, no host boundary added.

An entry is the site table's descriptor paired with a core handler by the entry seam's \`Mm\`, so
\`bse\` (ui.scroll) carries \`wa\` and \`PY\`, and \`vse\` (ui.focus) carries \`Ci\` and \`IY\`. A call
reaches a site through a registry the UI side fills — \`it().scrollSites\` and \`it().focusSites\`, filed
under \`component:requestId\` with nothing escaped, so a component containing a colon cannot be told from
a longer key. \`PY\` refuses a call for a site that is not there, then one whose site another plugin owns,
then answers the site's own \`commit(offset, origin)\`: \`{}\` when the window moved and the site's
sentence when it did not. \`IY\` refuses the same first case, then a **forwarded** call — a plugin
carrying another plugin's call for a site it does not own, where the same plugin calling on its own
behalf passes — then a site that does not hold the keyboard, then another plugin's element holding it,
and last passes the site's own commit sentence through as the refusal.

The descriptors are what a call must carry before any of that. \`wa\` checks the offset is a whole row
number 0 or more and then that a rewrite did not change the call's envelope; the offset is checked and
never restored, which is measured rather than assumed (it is absent from the seven names the descriptor
restores, and a stray key is not refused). \`Ci\` checks the element against the previous envelope in
both directions — an element where the move named none is one of the engine's stops, none where it named
one is a rewrite naming another — and then the envelope itself, naming the first key a rewrite changed.
Both share \`pr\`: a refusal has to be a non-empty string, so a silent refusal cannot read as success,
and an answer that is not an object at all is refused with its own sentence.

The descriptors are their own module because the order they evaluate in is part of the behaviour:
\`Mm\` reads \`zd[name]\` while the entries' copy is evaluated, so the entries' seam imports the
descriptors' module above its bodies, and the product's registry imports it above the chain copies and
registers the two cores. The site table is 113 entries now, and the three suites that count it say where
the two came from.

This package also adds the recovered-source index: every chunk the product draws from, the statements it
carries out of it and the statements still missing, measured against the bundle's own layout rather than
the package layout. Fifty-four chunks are drawn from so far — 1,394 of their 28,540 statements and
243,108 of their 10,315,424 bytes, out of 2,609 modules in the bundle — and each chunk's covered
statements digest in the source's own order, so a chunk can be reassembled from the copies and compared
with the module it came out of. The record re-runs the index and recomputes the digest for the two
chunks this package touches.

Verified: check/build/notices, both scanned copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, both
ledgers re-read from their modules and matched against the copies with acorn (12 and 7 statements, whole
and contiguous, no cut, no repetition), all nineteen bodies quoted verbatim with nineteen ranges cited,
the names both copies own and export counted and checked one by one, the twelve imported names asserted
absent as declarations and present in the export lists that own them, both closures re-measured with no
fresh statement left, the seam's import order asserted (the descriptors' module above the entries' copy),
the registry wiring asserted, and the index's totals and reassembly digests recomputed. Its suite
${suiteSweep.passed}/${suiteSweep.tests} alone and ${seamSweep.passed}/${seamSweep.tests} across the ten
call-path seam files, ${familyLine}, full ${fullLine} (one parallel-load run had a timing-sensitive
integration fixture time out; it passes alone and the re-run was clean), ${drivers.length} compiled
drivers (the shared driver now also prints \`W45ScrollFocusCompiled.v1\`, ${sharedMarkers.length} markers
in the shared run and ${allMarkers} across every driver), and the packaged smoke (${smoke}). Identity
\`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: the React layer \`Tc(jo, …)\` (partitioned first — 115 statements, 34,411 units), the remaining
\`$\` table entries, and the settings read path behind \`y9e\`.
`);

const rows = [
  ['2026-10-17T14:20:00Z', 'package', 'W45-71 收口 ui.scroll/ui.focus 调用路径（19 段 2,051 单位 / 19 语句 / 两副本）+ 复原源码索引',
    'SCROLL_ENTRY/FOCUS_ENTRY/scrollCall/focusCall/scrollSites/focusSites/siteKey/scrollSiteFor/focusSiteFor/scrollCallIsForeign/focusCallIsForwarded/otherHolderHasKeyboard 与 FOCUS_SITE/SCROLL_SITE/siteAnswerCheck/elementCheck/buildSite 成为产品面；注册表新增 PluginScrollSite/PluginFocusSite；产品注册表 import 站点模块并注册 ui.scroll/ui.focus 两条 core；站点表 111→113；新宿主边界 0',
    'chunk-sfn1dbxq.js [475447,475544) 97u XH + [475544,475653) 109u uyt + [475653,475702) 49u Uet + [476009,476078) 69u pyt + [476191,476241) 50u ahe + [476241,476267) 26u _z + [476681,476733) 52u mse + [476733,476926) 193u PY + [479578,479605) 27u bse + [479605,479656) 51u iL + [479656,479962) 306u IY + [479962,479988) 26u vse；chunk-nyce03br.js [15588,15723) 135u pr + [16084,16200) 116u ro + [34850,35160) 310u Vr + [35160,35211) 51u ko + [35211,35334) 123u Ci + [94084,94166) 82u Po + [94166,94345) 179u wa',
    '两轮实测（.audit/w45-71-probe.ts + test/plugin-chain-scroll-focus.test.ts + .audit/w45-24-compiled.mjs）：键不转义、IY 只拒转发调用、滚动 offset 被检查不被还原、空 deny 与非对象应答各一句、无前次信封时抛错、两个入口 core.run 与本体同答、zd[ui.scroll]/zd[ui.focus] 为真实描述符；21/21 通过'],
  ['2026-10-17T14:24:00Z', 'decision', 'W45-71 队列实测：描述符与入口必须分包，站点模块先于入口求值',
    '入口闭包 10 语句/1,002 单位（fresh 0 于本包前为 fresh 10）；描述符闭包 18 语句/1,928 单位（前为 fresh 7）；Mm 建入口时读 zd[name]，故描述符必须先注册',
    '故拆两个计划/两个副本：plugin-chain-scroll-focus-sites-{source,}.ts（7 段 996u + 注册）与 plugin-chain-scroll-focus-{source,}.ts（12 段 1,055u），入口 seam 在副本之上 import 站点模块；同文件会导致循环求值且站点为 undefined',
    `${chain}；入口副本 sha 885001cf…、站点副本 sha 60df4e03…`],
  ['2026-10-17T14:27:00Z', 'finding', 'W45-71 实测：五处非显然行为',
    '① 键 `${component}:${requestId}` 不转义（a:b:c）；② IY 的 uyt 只拒"转发"调用（同插件自用放行）；③ wa 的 offset 不在还原名单里（Po 七名无 offset），检查但不还原、杂键不拒；④ 空 deny 被 pr 拒为 a deny that is not a non-empty string，非对象应答另答 something that is not a result object；⑤ Ci.checkArgument 在 prev 为 undefined 时抛 Cannot read properties of undefined',
    '五条全部先测后写；①③④入测试与驱动，②⑤入测试并在记录中如实标注（⑤是源码行为，不修）',
    '.audit/w45-71-probe.txt 对应行 + test/plugin-chain-scroll-focus.test.ts 的五个用例'],
  ['2026-10-17T14:30:00Z', 'finding', 'W45-71 新增复原源码索引：按 bundle 自身布局统计覆盖',
    'scripts/source-index.mjs + research/ports/W45-source-index.json：54 个已触 chunk / 28,540 语句中 1,394 条 / 10,315,424 单位中 243,108 单位（2.4%），bundle 2,609 模块；每 chunk 的覆盖语句按源码原序给 sha256，可复算',
    'index 的 recorded product 字段指向承载该语句的副本文件，故"包布局"与"源码布局"两种视角可互查；本包两个 chunk 的 portedSha256 已在记录中复算一致',
    'usage: node scripts/source-index.mjs [out.json]'],
  ['2026-10-17T14:33:00Z', 'verification', `W45-71 验收：两副本 unresolved 0、span total 0、账本逐段回源 + acorn + 19 处正文逐字 + 两闭包 fresh 0 + seam 次序与注册表 wiring 断言 + 索引复算、${chain}、调用路径十套 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 编译驱动与打包冒烟`,
    '滚动/聚焦路径收口；下一包取 React 层 Tc(jo,…)（先分区）或其余 $ 表项',
    `check/build/notices（摘要未变）；两副本 unresolved 0；span total 0；${chain}；12+7 段逐段回源 + acorn（19 语句、完整、无重叠/无切半/无重复）+ 19 处正文逐字 + 19 处区间 + 名称双向核对 + 入口/描述符闭包 fresh 0 + seam import 次序（站点模块在副本之上）+ registry import 与两条 registerChainCore + 三处站点计数 113 断言 + 索引总量 54/1394/243108 与两 chunk portedSha256 复算；调用路径十套 ${seamSweep.passed}/${seamSweep.tests}；${familyLine}；全量 ${fullLine}（一次并行负载下 migration-integration 超时、单跑 17/17、复跑全绿，已记录）；${drivers.length} 编译驱动 exit 0（共享驱动输出 W45ScrollFocusCompiled.v1，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-71 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n+$/, '\n') + `
## W45-71 acceptance (2026-10-16)

- [x] **The measurement priced the cut before it was taken.** The entries' closure is 10 statements / 1,002 units and the descriptors' is 18 statements / 1,928 units; the descriptors turned out to be on the path (the entry builder reads the site table), so both halves were taken, and both closures are now covered with nothing fresh.
- [x] **The two halves are separate copies because the order they evaluate in is behaviour.** \`Mm\` reads \`zd[name]\` while the entries' copy is evaluated, so the descriptors' module registers first; putting them in one file would be a cycle and would pair each entry with no site.
- [x] **Five non-obvious behaviours were measured before they were asserted,** including two that are not fixed: the offset is checked and not restored, and the envelope check throws when there is no previous envelope.
- [x] **The one place the product had to be wired is asserted, not assumed.** The registry imports the descriptors' module and registers both cores, and this is checked in the record script against the file itself.
- [x] **The site table moved by exactly two, and the suites that count it say why.** Three existing suites now assert 113 and name W45-71 in the assertion message rather than being silently loosened.
- [x] **The recovered-source index measures the port against the bundle's own layout.** Every chunk the product draws from, what it carries and what is missing, with the covered statements digested in the source's own order so a chunk reassembles from the copies; the record recomputes the digest for both chunks this package touches.
- [x] **One failing run is recorded rather than smoothed over.** The first parallel full-suite run had \`migration-integration.test.ts\` time out; it passes alone (17/17, 2.5 s) and the re-run was clean, so it is written into the evidence as a timing artefact under load.
- [x] **Sweep.** check/build/notices, both copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, both ledgers with acorn, both seams' quotes and ranges, both closures, the import order and the registry wiring, the three site counts, the index totals and digests, the new suite ${suiteSweep.passed}/${suiteSweep.tests}, the call-path seam sweep ${seamSweep.passed}/${seamSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
const written = {
  'research/CURRENT.md': 'W45-71 **收口',
  'research/STATUS.md': '\nW45-71:',
  'research/coding-standard.md': '\n2026-10-16 W45-71 ',
  'research/ports/W45-chain-runner.md': '\n## W45-71 ported',
  '.audit/w45-runtime.todo.md': '\n## W45-71 acceptance',
};
for (const [path, mark] of Object.entries(written)) {
  const text = read(path);
  const found = text.split(mark).length - 1;
  if (found !== 1) throw new Error(`${path} holds ${found} entries for ${JSON.stringify(mark)}`);
  if ((text.match(/\\\`/g) ?? []).length !== 0) throw new Error(`${path} carries a backslash-escaped code span`);
}
const standardLines = read('research/coding-standard.md').split('\n').filter((line) => line.startsWith('2026-'));
if (new Set(standardLines).size !== standardLines.length) throw new Error('the coding standard repeats a one-line entry');
const stamps = read('.audit/w45-runtime.tsv').split('\n').filter((line) => line.startsWith('2026-10-17T14:')).map((line) => line.split('\t')[0]);
if (new Set(stamps).size !== stamps.length) throw new Error('the runtime trail repeats a timestamp');
console.log('documents written; identity', identity.sha256);
