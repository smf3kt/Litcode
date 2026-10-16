// Write the W45-70 record from the artifacts themselves: the `$` call dispatcher — the gate a plugin's
// call passes, the withholding and scan rules it is held to, the spelling and argument copy it is
// refused under, and the raise/stamp/run chain it ends in — with the name lists and predicates they read.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 444, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 166, `validation ${identity.validation.files}`);
expect(identity.build.files === 307, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 70) throw new Error('the chain verifier did not pass 70 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const registry = read('scripts/verify-chain-copies.mjs');
for (const entry of ["['W45-call-dispatch', 'plugin-chain-call-dispatch-source']",
  "['W45-leaf-walkers', 'plugin-chain-leaf-walkers-source']"]) {
  if (!registry.includes(entry)) throw new Error(`the verifier does not register ${entry}`);
}
const at = (needle) => {
  const file = verifier.files.find((entry) => entry.product.includes(needle));
  if (!file) throw new Error(`the verifier does not carry ${needle}`);
  return file;
};
const dispatchCopy = at('plugin-chain-call-dispatch-source');
if (dispatchCopy.blocks !== 21 || dispatchCopy.units !== 4182) throw new Error(`the dispatch copy is ${JSON.stringify(dispatchCopy)}`);
if (dispatchCopy.sha256 !== 'a46c62cdff8ce6e13684d7f6437e14a42cba915ed1f3b144327438984d383f88') {
  throw new Error('the dispatch copy is not the one this package measured');
}
// The one artifact outside the package this tick touched: the runner copy gained the override-dispatcher
// getter as an export (`swr`), because the dispatcher reads it and the copy's export list had filtered it
// out. The copy is re-measured here so a later package cannot widen it again unnoticed.
const runnerCopy = at('plugin-chain-source');
if (runnerCopy.blocks !== 73 || runnerCopy.units !== 26233) throw new Error(`the runner copy is ${JSON.stringify(runnerCopy)}`);
if (runnerCopy.sha256 !== '420f6ddbd05a3f38f917edd7619cd842525eba25bbd6abd4f7144388d71f2f51') {
  throw new Error('the runner copy is not the widened one this package measured');
}
const runnerPlan = JSON.parse(read('research/ports/W45-chain-runner-blocks.plan.json'));
if (!runnerPlan.exports.includes('swr')) throw new Error('the runner plan no longer exports the override-dispatcher getter');
if (runnerPlan.exports.length !== 78) throw new Error(`the runner plan holds ${runnerPlan.exports.length} exports`);

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

const blocks = [
  ['chunk-sfn1dbxq.js', 1837694, 1837732, 38], ['chunk-sfn1dbxq.js', 1837732, 1838166, 434],
  ['chunk-sfn1dbxq.js', 1838166, 1838257, 91], ['chunk-sfn1dbxq.js', 1838257, 1838526, 269],
  ['chunk-sfn1dbxq.js', 1838526, 1838826, 300], ['chunk-sfn1dbxq.js', 1838826, 1839344, 518],
  ['chunk-sfn1dbxq.js', 1844394, 1844768, 374], ['chunk-sfn1dbxq.js', 2345040, 2345175, 135],
  ['chunk-sfn1dbxq.js', 2355306, 2355414, 108], ['chunk-sfn1dbxq.js', 2355414, 2355576, 162],
  ['chunk-sfn1dbxq.js', 2355576, 2356082, 506], ['chunk-sfn1dbxq.js', 2356082, 2356850, 768],
  ['chunk-m4qpskd4.js', 47535, 47564, 29], ['chunk-m4qpskd4.js', 51989, 52018, 29],
  ['chunk-m4qpskd4.js', 52018, 52046, 28], ['chunk-m4qpskd4.js', 52046, 52107, 61],
  ['chunk-m4qpskd4.js', 52107, 52160, 53], ['chunk-m4qpskd4.js', 52160, 52204, 44],
  ['chunk-m4qpskd4.js', 52373, 52425, 52], ['chunk-nyce03br.js', 159794, 159880, 86],
  ['chunk-nyce03br.js', 160097, 160194, 97],
];
const dispatchLedger = checkCopy('the dispatch copy', 'src/plugin-chain-call-dispatch-source.ts', blocks, 23);
const dispatchText = read('src/plugin-chain-call-dispatch-source.ts');
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
const names = namesIn(dispatchText);
const declared = (name) => names.declaredNames.has(name);
const ownNames = ['R3', 'HGt', 'UGt', 'jGt', 'kme', 'Sme', 'nzt', 'H2e', 'kJt', 'Xqo', 'Qqo', 'G2e',
  'tho', 'Xt', 'tEs', 'Kt', 'nUn', 'Yo', 'ylt', 'rho', 'oRe', 'Hp', 'iIt'];
for (const name of ownNames) if (!declared(name)) throw new Error(`the dispatch copy does not carry ${name}`);
if (names.exportedNames.size !== ownNames.length) throw new Error('the dispatch copy exports a different count');
for (const name of ownNames) if (!names.exportedNames.has(name)) throw new Error(`the dispatch copy does not export ${name}`);
// The helpers the dispatcher reads are imports, never declarations here.
const dispatchImports = {
  './plugin-chain-host.js': ['t', 'Z$n'],
  './plugin-chain-source.js': ['Aws', 'He', 'L', 'swr'],
  './plugin-chain-classic-source.js': ['Q$n'],
  './plugin-chain-loader-source.js': ['D5t'],
  './plugin-chain-clock-env-source.js': ['xme'],
  './plugin-chain-ui-source.js': ['CK', 'uMe'],
  './plugin-chain-host-call-source.js': ['Cme', 'Hze', 'TDe'],
};
const importedTotal = Object.values(dispatchImports).flat();
for (const [source, list] of Object.entries(dispatchImports)) {
  // The bundle declares some names in separate statements, so one source may be imported from twice.
  const lines = [...dispatchText.matchAll(new RegExp(`import \\{ ([^}]*) \\} from '\\./${source.slice(2)}'`, 'g'))];
  if (lines.length === 0) throw new Error(`the dispatch copy does not import from ${source}`);
  const imported = lines.flatMap((line) => line[1].split(',').map((name) => name.trim()));
  for (const name of list) {
    if (!imported.includes(name)) throw new Error(`the dispatch copy does not import ${name} from ${source}`);
    if (declared(name)) throw new Error(`the dispatch copy declares ${name} instead of importing it`);
  }
}
if (names.importedNames.size !== importedTotal.length) throw new Error('the dispatch copy imports a different count');
const exportedBy = {
  'src/plugin-chain-host.ts': ['t', 'Z$n'],
  'src/plugin-chain-source.ts': ['Aws', 'He', 'L', 'swr'],
  'src/plugin-chain-classic-source.ts': ['Q$n'],
  'src/plugin-chain-loader-source.ts': ['D5t'],
  'src/plugin-chain-clock-env-source.ts': ['xme'],
  'src/plugin-chain-ui-source.ts': ['CK', 'uMe'],
  'src/plugin-chain-host-call-source.ts': ['Cme', 'Hze', 'TDe'],
};
// A copied name can carry a regex metacharacter (`Z$n` does), so the name is escaped before it is
// interpolated into a pattern.
const rx = (name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const [path, list] of Object.entries(exportedBy)) {
  const text = read(path);
  for (const name of list) {
    const exported = new RegExp(`export (?:function|const|let|var|class) ${rx(name)}\\b|export \\{ [^}]*\\b${rx(name)}\\b`).test(text);
    if (!exported) throw new Error(`${path} no longer exports ${name}, which this package imports`);
  }
}
// The two names two other copies both declare, and the measurement that says which one this module means:
// the runner copy's `Xt` is a budget reader and the relay copy's `Yo` compares two texts, while this copy's
// are the two environment names and the plain-or-JSON name writer.
if (!/function Xt\(e,t,o\)\{/.test(read('src/plugin-chain-source.ts'))) {
  throw new Error('the runner copy no longer declares the budget reader named Xt');
}
if (!/export \{ [^}]*\bXt\b[^}]* \};/.test(read('src/plugin-chain-source.ts'))) {
  throw new Error('the runner copy no longer exports Xt');
}
if (!/Yo=\(e,n\)=>e\.text===n\.text&&/.test(read('src/plugin-chain-relay-source.ts'))) {
  throw new Error('the relay copy no longer declares the text comparison named Yo');
}
if (!dispatchText.includes('var Xt=["env.get","env.set"];')) throw new Error('the dispatch copy lost its own Xt');
if (!dispatchText.includes('var Yo=(e)=>/^[\\w$@-]+$/.test(e)?e:JSON.stringify(e);')) {
  throw new Error('the dispatch copy lost its own Yo');
}
const closure = execFileSync(process.execPath, ['.audit/w45-49-closure.mjs', 'chunk-sfn1dbxq.js', 'G2e', 'Sme', 'kme', 'nzt', 'Qqo'], { encoding: 'utf8' });
if (!/16 statements, 4853 units/.test(closure)) throw new Error('the dispatcher closure is no longer 16 statements / 4,853 units');
if (!/swr <- swr of .*chunk-nyce03br\.js/.test(closure)) throw new Error('the closure no longer reads the override getter out of another chunk');
const overlap = execFileSync(process.execPath, ['.audit/w45-57-overlap.mjs', 'chunk-sfn1dbxq.js', 'G2e', 'Sme', 'kme', 'nzt', 'Qqo'], { encoding: 'utf8' });
for (const line of ['covered 16 statements / 4853 units; fresh 0 statements / 0 units',
  'covered by plugin-chain-call-dispatch-source-blocks.json: 12',
  'covered by plugin-chain-host-call-source-blocks.json: 2',
  'covered by plugin-chain-ui-source-blocks.json: 1',
  'covered by plugin-chain-clock-env-source-blocks.json: 1']) {
  if (!overlap.includes(line)) throw new Error(`the overlap tool no longer reports: ${line}`);
}

const scan = read('.audit/w45-70-scan.txt');
if ((scan.match(/unresolved 0/g) ?? []).length !== 1) throw new Error('the scanned copy did not scan clean');
if (!scan.includes('imports ./plugin-chain-host.js, ./plugin-chain-source.js, ./plugin-chain-classic-source.js, ./plugin-chain-loader-source.js, ./plugin-chain-clock-env-source.js, ./plugin-chain-ui-source.js, ./plugin-chain-host-call-source.js')) {
  throw new Error('the dispatch scan does not name its seven imports');
}

// The seam: every body quoted verbatim (no body holds a line break), every range cited, every wrapper
// calling its own body.
const seam = read('src/plugin-chain-call-dispatch.ts');
const elided = [];
let verbatim = 0;
for (const [module, start, end] of blocks) {
  const slice = read(`extracted-v2/modules/${module}`).slice(start, end);
  const lines = slice.split('\n');
  const multi = lines.length > 1;
  const head = multi ? lines[0] : slice.slice(0, 60);
  const tail = multi ? lines[lines.length - 1] : slice.slice(-60);
  if (!multi && seam.includes(slice)) {
    verbatim++;
    continue;
  }
  elided.push([module, start, end].join(' '));
  if (!seam.includes(head) || !seam.includes(tail)) {
    throw new Error(`the seam does not quote the head and tail of ${module} [${start},${end})`);
  }
  if (!seam.includes('\u2026')) throw new Error(`the seam marks no elision for ${module} [${start},${end})`);
}
if (verbatim !== 21) throw new Error(`the seam quotes ${verbatim} bodies verbatim, not 21: ${elided.join('; ')}`);
if (elided.length !== 0) throw new Error(`the seam elides ${elided.length} bodies: ${elided.join('; ')}`);
for (const [module, start, end, units] of blocks) {
  const range = `[${start},${end}) ${units}`;
  if (!seam.includes(range)) throw new Error(`the seam does not cite ${range} (${module})`);
}
for (const name of ['ENV_CALLS', 'STATE_CALLS', 'DROPPED_CALLS', 'dispatchCall', 'admittedCall',
  'scanAllowsCall', 'scanAllowsEnv', 'scanAllowsState', 'withheldBy', 'crashedHolder', 'withheldSentence',
  'droppedCallNotice', 'callSpelling', 'copyCallArgs', 'firstSegment', 'removedByPlugin', 'plainOrJsonName',
  'stateReference', 'isClockCall', 'isDroppableCall', 'isStateCall', 'isEnvCall', 'isFunnelCall',
  'SOURCE_BODIES']) {
  if (!seam.includes(name)) throw new Error(`the seam does not carry ${name}`);
}
for (const call of ['return G2e(chain, call) as Promise<unknown>;', 'return Sme({ state }, gate);', 'return kme(scan, name);',
  'return nzt(scan, op, args);', 'return Qqo(scan, op, args);', 'return jGt(state, caller, first);',
  'return UGt(state, plugin, first);', 'return HGt(state, withheld);', 'H2e(plugin, name, problem);',
  'return kJt(op, args);', 'return Xqo(args) as T;', 'return R3(name);', 'return rho(name, plugin);',
  'return Yo(name);', 'return ylt(reference);', 'return oRe(name);', 'return iIt(name);',
  'return nUn(name);', 'return tEs(name);', 'return tho(name);']) {
  if (!seam.includes(call)) throw new Error(`a wrapper does not call the copied body: ${call}`);
}
if (!seam.includes('G2e, H2e, HGt, Hp, iIt, jGt, kJt, Kt, kme, nUn, nzt, oRe, Qqo, R3, rho, Sme, tEs, tho, UGt, Xqo, Xt, ylt, Yo,')) {
  throw new Error('the seam does not publish every copied body');
}
const registryState = read('src/plugin-chain-registry-state.ts');
for (const name of ['PluginCallRef', 'PluginCallScan', 'PluginCallKnownArgs', 'PluginCallHolder',
  'PluginCallState', 'PluginCallCaller', 'PluginCallOp', 'PluginCallChain']) {
  if (!registryState.includes(`export interface ${name}`)) throw new Error(`the registry state does not carry ${name}`);
}
const suite = read('test/plugin-chain-call-dispatch.test.ts');
for (const name of ['ENV_CALLS', 'STATE_CALLS', 'DROPPED_CALLS', 'dispatchCall', 'admittedCall',
  'scanAllowsCall', 'scanAllowsEnv', 'scanAllowsState', 'withheldBy', 'crashedHolder', 'withheldSentence',
  'droppedCallNotice', 'callSpelling', 'copyCallArgs', 'firstSegment', 'removedByPlugin', 'plainOrJsonName',
  'stateReference', 'isClockCall', 'isDroppableCall', 'isStateCall', 'isEnvCall', 'isFunnelCall']) {
  if (!suite.includes(name)) throw new Error(`the suite does not exercise ${name}`);
}
if (suite.includes('plugin-chain-call-dispatch-source.js')) throw new Error('the suite reaches past the seam to a copy');

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-70-full.txt');
if (full.failed !== 0 || full.tests !== 1747) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const suiteSweep = summary('.audit/w45-70-suite.txt');
if (suiteSweep.failed !== 0 || suiteSweep.tests !== 29) throw new Error('the new dispatcher suite is not 29/29');
const family = summary('.audit/w45-70-family.txt');
if (family.failed !== 0 || family.tests !== 471) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const seamSweep = summary('.audit/w45-70-seams.txt');
if (seamSweep.failed !== 0 || seamSweep.tests !== 76) throw new Error('the call-path seam sweep is not clean');
const span = JSON.parse(read('.audit/w45-70-span.txt'));
if (span.total !== 0) throw new Error(`the span scan found ${span.total}`);
const notices = JSON.parse(read('.audit/w45-70-notices.txt').split('\n').filter((line) => line.startsWith('{')).at(-1));
if (notices.sha256 !== '384c78801194aedea80331383ccd93708c2dfa46bc746003dc112c930b73d13c') {
  throw new Error('the dependency-notice digest moved');
}
const smokeReport = read('.audit/w45-70-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 315) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
let allMarkers = 0;
for (const name of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${name}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers += out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).length;
}
const sharedMarkers = read('.audit/w45-70-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-70-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45CallDispatchCompiled.v1')) throw new Error('the shared driver did not print the W45-70 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45CallDispatchCompiled.v1 (${sharedMarkers.length} markers, ${allMarkers} across every driver: it reads the two environment names and the two state names, the gate's refusal for a module that is not loaded, the withheld sentence, the two scan rules with their refusals, the plain-or-JSON name writer, the reference spelling and the raise/stamp/run order off the built output)`;

const evidence = {
  schema: 'W45CallDispatchEvidence.v1',
  package: 'W45-70 — the `$` call dispatcher and the rules it enforces',
  date: '2026-10-16',
  question: 'A plugin calls `$.ui.log(...)` — what does the host do with that call before anything runs, what is the plugin told when the call is refused, and in what order do the call table\'s own steps happen?',
  answer: 'One function and the rules under it. `G2e` is the dispatcher: it reads the call table\'s entry for the name, copies the arguments when the call carries a reference (so a hook cannot reach the object the plugin still holds), then runs the gate and the two scan rules, then the entry\'s own check and — for a call whose refusal is a dropped call rather than a thrown one — the notice that leaves the text beside the record the pane reads, and only then the entry\'s `raise`, its `stamp` and its `run`. Three roads leave it: an event the value-event catalog holds goes through the funnel with the call table\'s entry as its floor, an `interface.call` for a two-segment name goes through the funnel with its own bottom (the call table\'s entry wrapped so the floor\'s answer becomes the call\'s one argument), and everything else runs straight into the entry. The gate (`Sme`) is the four rules a call passes: the caller\'s hooks module must be loaded and its scan must list this call, the call must not be withheld, and no hooks module behind the call may be unadmitted — the one exemption being a clock call, because a plugin that is not yet admitted can still ask the time. Every refusal is the plugin\'s own error (`p: $.ui.log refused: …`), except the withheld one, which is the host\'s sentence naming the module that withheld the call and is logged once per plugin and first segment. The two scan rules are what a declared module is held to: `nzt` for `env.get`/`env.set`, where the variable the call names must be in the scan\'s reads (that name for a read, writes for a write), and `Qqo` for `state.get`/`state.set`, where the `{plugin, key}` the call passes must be a reference the scan lists — each with its own sentence for a call that carries no name or reference at all. What withholds a call is the holder order in `jGt`: a holder staged for the engine being created right now, then one staged before it, then the live withheld set, and last another hooks module that crashed while withholding the same first segment (`UGt`). The spelling a call is refused under (`kJt`) is its own name except for `interface.call`, which is named by the name and method it passes, which is why the dispatcher\'s gate sees `$.srv.m` rather than `$.interface.call`.',
  ported: dispatchLedger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  planExtensions: [
    {
      plan: 'research/ports/W45-call-dispatch-blocks.plan.json',
      what: 'a new plan, twenty-one blocks and twenty-three exports across three modules',
      blocks: '0 → 21 blocks, 4,182 units, 23 statements',
      why: 'the dispatcher is twelve statements of the plugin chunk, the two scan rules and the withholding rules six more, and the name lists and predicates five statements of two other chunks, all whole statements rather than fragments; two of the blocks hold two statements each because the bundle declares the list and its predicate together (`Kt` with `nUn`, `Hp` with `iIt`)',
    },
    {
      plan: 'research/ports/W45-chain-runner-blocks.plan.json',
      what: 'the runner copy widened by one export: `swr`, the override-dispatcher getter',
      blocks: '77 → 78 exports, 73 blocks and 26,233 units unchanged',
      why: 'the dispatcher asks `swr()` whether an override dispatcher is installed before it runs a call, and the runner copy\'s export list had filtered the getter out; nothing else about that copy moved, and the record re-measures its digest (420f6ddb…) so a later package cannot widen it again unnoticed',
    },
  ],
  boundary: 'No new host boundary. Every rule reads helpers the product already carries: the log and the two-segment name predicate from the host seam, the overridden-answer chain and the override getter from the runner copy, the value-event catalog from the classic copy, the withholding labels from the loader copy, the clock-call argument reader from the clock copy, the plugin label and the dropped-call record from the ui copy, and the funnel with its two tables from the host-call copy — fourteen names over seven copies. The one edit outside the package is the runner copy\'s export list gaining `swr`.',
  measured: [
    'The gate refuses with the plugin\'s own words: a plugin whose hooks module is not loaded is answered `no hooks module of that name is loaded, so there is no scan to allow it (host rule)`, and a module that declared other calls but not this one is told what it did declare (`the scan lists $.ui.toast, $.ui.status`), or that it declared none.',
    'The clock exemption covers the unadmitted gate and only that gate: measured, the same call from an unadmitted environment passes with `isClock` true and is refused with `a hooks module behind the call is not admitted (plugin.register runs once the set is built)` when it is false, while the scan rule still fires first for a clock call the module never declared.',
    'The withheld sentence is the host\'s, not the plugin\'s, and it is told once: measured, the returned sentence is `$.ui.log: removed by plugin `p0``, and the second call on the same first segment returns the same sentence without adding a second key to the refusal log.',
    'The holder order is measured in that order: a staged holder answers before the staged-before holder, both before the live withheld set, and a crashed module that withheld the same first segment answers last (`other` for `p`, nothing for the holder itself, nothing for a first segment it does not hold).',
    'A staged holder is only offered to a call from an engine being created: measured, a staged holder refuses when `building` names the caller\'s environment and does not when it names another.',
    'The environment rule reads the list that matches the direction: `env.get` is held to the scan\'s reads and `env.set` to its writes, measured with one scan whose reads hold `HOME` and writes hold `PATH` (each call refused by the other list), and a first argument that is not an object with a string name is refused before the list is consulted (`it carries no variable name a $.env.get("<name>") call passes`).',
    'The state rule names the reference it refused and lists what the scan holds: measured, `its hooks module does not refer to p.other in a $.state.get({ plugin, key }) call (host rule; the scan lists reads of p.k)`, with a non-object argument refused as `it carries no reference …`, and both rules answering nothing for a call they do not cover.',
    'A name is written as itself when it is plain and as JSON otherwise, and the same rule is what the state rule names a reference by: measured, `plain` against `"a b"`, and `p.k` against `"a b".k`.',
    'The argument copy is a copy: measured, a state call hands its hook a new object with the same value and leaves the object the plugin still holds untouched, a non-object argument is passed through as it is, and a call that carries no reference is not copied at all.',
    'The order inside a call is measured as raise, then stamp, then run — for a plain call, for a state call whose arguments were copied, and for a catalog call on the funnel road alike — and the caller the table sees carries the known args the gate answered.',
    'A refused call runs none of the three: measured, a call refused by the table\'s own check throws `p: test.op: nope (host check)` with an empty step order, and a droppable call refuses the same way (`p: ui.log: nope (host check)`).',
    '`interface.call` is spelled by the name and method it passes: measured, `srv.m` when the module declared it (the call goes through the funnel into the call table) and the module\'s own refusal naming `$.srv.m` when it did not; a name with no method spells `srv.undefined`, which is why the road is only taken for a two-segment name.',
    'A table entry with no call of its own cannot answer: measured, `h.run is not a function` — the check, the raise and the stamp are optional, the call is not.',
    'The call path has nothing left uncovered in its own chunk: measured, the dispatcher\'s closure is 16 statements and 4,853 units — 12 of them copied by this package, 2 by the host-call copy, 1 by the ui copy and 1 by the clock copy — with 0 fresh statements, and 23 names read out of other chunks.',
  ],
  regressions: `the new dispatcher suite ${suiteSweep.passed}/${suiteSweep.tests} inside the ten call-path seam files (${seamSweep.passed}/${seamSweep.tests}: the host-call seam, the classic copy and its two suites, the loader, the clock, the stream call, the override sites and the leaf walkers); ${familyLine}`,
  full: fullLine,
  compiled: driverLine,
  smoke,
  next_package: [
    'the React layer `Tc(jo, { key: `raster:${plugin}:${key}`, … })` in chunk-kjfwbh4w.js — 115 statements / 34,411 units and ~130 imports, so it has to be partitioned before it is taken',
    'the remaining `$` table entries, each measured before it is taken: `ui.scroll`, `ui.focus`, `ui.copy` (blocked on the clipboard encoder `Sv`), `fs.ancestors` (the walker `mzt` is 85 statements / 15,533 units)',
    'the settings read path behind `y9e` — 590 statements / 327,047 units; the managed-settings gate `CT` and `Tp`; Q-086\'s 15 registry-reading cores and their 34 sites; the notification provider `a4n`',
  ],
};
write('research/ports/W45-call-dispatch-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);

const marks = {
  current: 'W45-70 **收口',
  features: '; W45-70 closes the `$` call dispatcher',
  standard: '2026-10-16 W45-70 ',
  status: 'W45-70:',
  runner: '## W45-70 ported the `$` call dispatcher',
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
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-70 **收口 \`$\` 调用派发器与它执行的规则**（插件调 \`$.ui.log(...)\` 之后，宿主在**任何东西运行之前**做什么、被拒时插件听到什么、调用表自己的三步以什么顺序发生）：**21 段 4,182 单位 / 23 语句**（chunk-sfn1dbxq.js [2356082,2356850) 768u **\`G2e\` 派发器**、[1838826,1839344) 518u **\`Sme\` 门禁**、[1838526,1838826) 300u \`kme\` 扫描规则、[1844394,1844768) 374u \`nzt\` env 规则、[2355576,2356082) 506u \`Qqo\` state 规则、[1838257,1838526) 269u \`jGt\` 扣留者次序、[1838166,1838257) 91u \`UGt\` 崩溃扣留者、[1837732,1838166) 434u \`HGt\` 扣留句 + 每段只报一次、[1837694,1837732) 38u \`R3\` 首段、[2345040,2345175) 135u \`H2e\` 掉线调用记录、[2355306,2355414) 108u \`kJt\` 拒绝拼写、[2355414,2355576) 162u \`Xqo\` 参数复制；chunk-m4qpskd4.js [51989,52018) 29u \`Xt\` env 名单、[52018,52046) 28u \`tEs\`、[52046,52107) 61u \`Kt\`/\`nUn\` state 名单、[52107,52160) 53u \`Yo\` 名字写法、[52160,52204) 44u \`ylt\` 引用写法、[52373,52425) 52u \`rho\` 被移除句、[47535,47564) 29u \`tho\` 漏斗判定；chunk-nyce03br.js [159794,159880) 86u \`oRe\` 四个时钟调用、[160097,160194) 97u \`Hp\`/\`iIt\` 五个掉线调用）。**语义（源文实测）**：**门禁四条**=钩子模块已载入且扫描点名该调用 → 未被扣留 → 调用背后没有未准入模块（**唯一豁免是时钟调用**，"未准入也能问时间"）；**拒绝一律是插件自己的话**（\`p: $.ui.log refused: …\`），**只有扣留句是宿主的**（\`$.ui.log: removed by plugin \`p0\`\`）且**每插件+首段只报一次**；**两条扫描规则**：\`env.get/set\` 认名单方向（读认 reads、写认 writes），\`state.get/set\` 认 \`{plugin,key}\` 引用且**拒绝时点名它要的引用并列出扫描持有的**；**扣留者次序**=在建引擎的 staged → stagedBefore → 活的 withheld 集合 → 崩溃但同段扣留过的模块；**拒绝拼写**：\`interface.call\` 按它传的 name+method 拼（故门禁看到 \`$.srv.m\`），其余按调用名；**\`G2e\` 内部次序**=参数复制（仅带引用的调用）→ 门禁 → 两条扫描 → 调用表 check（掉线调用同时落 \`H2e\` 记录）→ \`raise\` → \`stamp\` → \`run\`；**三条出口**：命中值事件目录者走漏斗（以调用表项为底）、两段名 \`interface.call\` 走漏斗自有底部、其余直入调用表项。**关键取舍**：新宿主边界 0（14 名 / 7 个副本按名导入）；**包外唯一改动**=runner 副本扩导出 1 名（\`swr\` 覆写派发器 getter，77→78 名，段数与单位不变，摘要 \`420f6ddb…\` 已在记录中重测防止再被悄悄加宽）；**两处同名不同语句实测**：runner 副本的 \`Xt\` 是预算读取器、relay 副本的 \`Yo\` 是文本比较——本包的两个是 env 名单与名字写法，故**复制而非导入**。**验收**：check/build/notices（摘要未变）、副本 \`unresolved 0\`、span \`total 0\`、**${chain}**、账本逐段回源 + acorn（23 语句、完整、无重叠/无切半/无重复）+ **21 处正文逐字引用（无一行含真换行，故零省略）** + 21 处区间 + 23 名自有/23 名导出/14 名被导入双向核对 + 两处同名撞车双向断言 + 调用路径十套回归 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45CallDispatchCompiled.v1\`，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [调用派发器证据](ports/W45-call-dispatch-evidence.json)、[叶表与遍历器证据](ports/W45-leaf-walkers-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
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
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-70 closes the \`$\` call dispatcher: ` +
  'the gate every plugin call passes (its hooks module is loaded and declares the call, the call is not withheld, ' +
  'nothing behind it is unadmitted, and a clock call is exempt from the last), the two scan rules over what the ' +
  'module declared (the environment variable it names, the state reference it passes), the holder order a call is ' +
  'withheld by, the spelling and the argument copy a call is refused under, and the raise, stamp and run steps the ' +
  'call table takes in that order. |';
write('research/FEATURES.md', lines.join('\n'));

const standardText = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standardText.indexOf('2026-10-16 W45-69 ');
if (standardAt < 0) throw new Error('coding-standard W45-69 line not found');
const standardEntry = `2026-10-16 W45-70 \`$\` 调用派发器：S-1至S-7已对照。S-1（先读源）：**先量后切**——五颗种子 \`G2e\`/\`Sme\`/\`kme\`/\`nzt\`/\`Qqo\` 的闭包实测后只切**派发器 + 门禁 + 四条规则 + 名单与谓词**（21 段 4,182u / 23 语句），14 个帮手按名从 7 个既有副本导入；**两处同名不同语句先量后取**：runner 副本的 \`Xt\` 是预算读取器（\`function Xt(e,t,o)\`）、relay 副本的 \`Yo\` 是文本比较（\`e.text===n.text&&…\`），本包要的是 env 名单 \`["env.get","env.set"]\` 与名字写法，故**复制而非导入**（按名导入会静默换函数）。S-2（不留半包）：新宿主边界 0；**包外仅一处**——runner 副本扩导出 \`swr\`（77→78 名，段数/单位不变），已在记录中重测其摘要 \`420f6ddb…\` 并在 \`planExtensions\` 写明理由。S-3（先测后断言）：\`.audit/w45-70-probe.ts\` 先跑再写 29 条用例；**实测出四处非显然行为**——① 时钟豁免**只管未准入那一条**，扫描规则仍先发（\`clock.now\` 未声明时照样被拒）；② \`interface.call\` 的拼写是 name+method（无 method 时是 \`srv.undefined\`），故"两段名"是这条路的前提；③ 扣留句**不是插件自己的话**而是宿主句，且**每插件+首段只报一次**；④ 调用表项 \`check/raise/stamp\` 皆可选而 \`run\` 必需（无 \`run\` 时答 \`h.run is not a function\`）。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器（70 计划）、自跑全部编译驱动；断言副本 \`unresolved 0\`、span \`total 0\`、notices 摘要未变；acorn 逐段回源（23 语句、完整、无重叠/无切半/无重复）+ 21 处正文逐字 + 21 处区间 + 23 名自有/23 名导出/14 名被导入 + 两条同名撞车双向断言 + runner 副本摘要复测。S-5/S-6：seam 给 20 个按名包装、3 个名单常量与 \`SOURCE_BODIES\`，测试只经 seam。S-7：React \`Tc(jo,…)\`（需先分区）、其余 \`$\` 表项、\`y9e\` 读路径、\`CT\`/\`Tp\`/Q-086/\`a4n\` 写入 next_package。**\`$\` 表一侧的调用路径（门禁 + 规则 + 派发次序）至此入产品。**验收：check/build/notices、副本 unresolved 0、${chain}、账本与正文自证、调用路径十套 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standardText.slice(0, standardAt) + standardEntry + standardText.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAnchor = 'W45-69: the leaf table and the walkers that read it';
const statusAt = status.indexOf(statusAnchor);
if (statusAt < 0) throw new Error('STATUS W45-69 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = 'W45-70: the `$` call dispatcher. A plugin\'s `$.<name>(...)` call now has its own road in ' +
  'the product: the dispatcher reads the call table\'s entry, copies the arguments when the call carries a ' +
  'reference (so a hook cannot reach the object the plugin still holds), and runs the gate the call table\'s own ' +
  'steps sit behind. The gate is four rules — the caller\'s hooks module must be loaded and must have declared ' +
  'the call, the call must not be withheld, no hooks module behind it may be unadmitted, and a clock call is exempt ' +
  'from the last, because a plugin that is not yet admitted can still ask the time. The refusal a plugin hears is ' +
  'its own mistake in its own name (`p: $.ui.log refused: …`) except when the call was withheld, where the host ' +
  'says which module removed it and says so once per first segment. Two scan rules hold a declared module to what ' +
  'it declared: the environment variable an `env.get`/`env.set` call names must be in the scan\'s reads or writes, ' +
  'and the `{plugin, key}` a `state.get`/`state.set` call passes must be a reference the scan lists. Past the gate ' +
  'the call table does three things in a measured order — `raise`, then `stamp`, then the call itself — and an ' +
  'event the value-event catalog holds goes through the funnel instead, with a two-segment `interface.call` taking ' +
  'the funnel\'s own road. The package is 21 blocks and 4,182 units over three modules, it adds no host boundary ' +
  '(14 names imported from seven copies that already carry them), and it changes exactly one artifact outside ' +
  'itself: the runner copy\'s export list gained the override-dispatcher getter `swr`. Two names two other copies ' +
  'also declare (`Xt`, `Yo`) were decided by reading both bodies rather than by the name: this module means the ' +
  'environment name list and the plain-or-JSON name writer, so both are copied rather than imported. Evidence: ' +
  '`research/ports/W45-call-dispatch-evidence.json`, and\n[工作包](ports/W45-chain-runner.md).\n\n';
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-70 ported the \`$\` call dispatcher (2026-10-16)

The call path has a front door now. A plugin's \`$.<name>(...)\` call is the dispatcher's business before it is
the call table's: twenty-one blocks, 4,182 units, twenty-three statements over three modules, no host boundary
added, and one artifact outside the package touched.

\`G2e\` reads the call table's entry, copies the arguments when the call carries a reference — so a hook cannot
reach the object the plugin still holds — and hands the call to the gate. The gate is four rules. The caller's
hooks module must be loaded and must have declared the call in its scan; the call must not be withheld; and no
hooks module behind the call may be unadmitted, with a clock call exempt from that last rule, because a plugin
that is not yet admitted can still ask the time. Every refusal is the plugin's own mistake in its own name,
except the withheld one, which is the host's sentence naming the module that removed the call, logged once per
plugin and first segment. Two scan rules hold a declared module to what it declared: \`nzt\` for the environment,
where the variable an \`env.get\` or \`env.set\` call names must be in the scan's reads or writes by direction, and
\`Qqo\` for the state, where the \`{plugin, key}\` reference a \`state.get\` or \`state.set\` call passes must be one
the scan lists. Both refuse a call that carries no name or reference at all with a sentence of their own.

Past the gate the call table takes three steps, and the probe measured their order — \`raise\`, then \`stamp\`,
then the call. An event the value-event catalog holds goes through the funnel instead, with the call table's
entry as its floor; a two-segment \`interface.call\` takes the funnel's own road, its bottom wrapped so the
floor's answer becomes the call's one argument. That is why the spelling a call is refused under matters: an
interface call is named by the name and method it passes (\`srv.m\`, which the gate sees), everything else by the
name it was called with. A call whose refusal is a dropped call rather than a thrown one leaves the sentence
beside the record the pane reads, so the pane can say a call was dropped while the plugin is told the same thing.

Two names decided by reading rather than by the name. The runner copy declares \`Xt\` as a budget reader and the
relay copy declares \`Yo\` as a text comparison; this module's are the two environment call names and the
plain-or-JSON name writer, so both statements are copied rather than imported — importing by name alone would
have silently substituted a different function for each. The one change outside the package is the runner copy's
export list gaining \`swr\`, the override-dispatcher getter the dispatcher asks before it runs a call; the record
re-measures that copy's digest so a later package cannot widen it again unnoticed.

Verified: check/build/notices, the scanned copy \`unresolved 0\`, span scan \`total 0\`, ${chain}, the ledger
re-read from its modules and matched against the copy with acorn (23 statements, whole and contiguous, no cut,
no repetition — two blocks hold two statements each because the bundle declares a list and its predicate
together), all twenty-one bodies quoted verbatim with twenty-one ranges cited, the twenty-three names the copy
owns and the twenty-three it exports counted and checked one by one, the fourteen imported names asserted absent
as declarations and present in the export lists that own them, both same-name traps asserted against the bodies
the other copies actually declare, and the runner copy's widened digest re-measured. Its suite
${suiteSweep.passed}/${suiteSweep.tests} alone and ${seamSweep.passed}/${seamSweep.tests} across the ten call-path
seam files, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers (the shared driver now also prints
\`W45CallDispatchCompiled.v1\`, ${sharedMarkers.length} markers in the shared run and ${allMarkers} across every
driver), and the packaged smoke (${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs by the record
script itself).

Next: the React layer \`Tc(jo, …)\` (partitioned first — 115 statements, 34,411 units), the remaining \`$\` table
entries, and the settings read path behind \`y9e\`.
`);

const rows = [
  ['2026-10-17T13:52:00Z', 'package', 'W45-70 收口 $ 调用派发器与它执行的规则（21 段 4,182 单位 / 23 语句）',
    'dispatchCall/admittedCall/scanAllowsCall/scanAllowsEnv/scanAllowsState/withheldBy/crashedHolder/withheldSentence/droppedCallNotice/callSpelling/copyCallArgs/firstSegment/removedByPlugin/plainOrJsonName/stateReference/isClockCall/isDroppableCall/isStateCall/isEnvCall/isFunnelCall 成为产品面，ENV_CALLS/STATE_CALLS/DROPPED_CALLS/SOURCE_BODIES；注册表新增 PluginCallRef/PluginCallScan/PluginCallKnownArgs/PluginCallHolder/PluginCallState/PluginCallCaller/PluginCallOp/PluginCallChain；新宿主边界 0；包外仅 runner 副本扩导出 swr',
    'chunk-sfn1dbxq.js [2356082,2356850) 768u G2e + [1838826,1839344) 518u Sme + [1838526,1838826) 300u kme + [1844394,1844768) 374u nzt + [2355576,2356082) 506u Qqo + [1838257,1838526) 269u jGt + [1838166,1838257) 91u UGt + [1837732,1838166) 434u HGt + [1837694,1837732) 38u R3 + [2345040,2345175) 135u H2e + [2355306,2355414) 108u kJt + [2355414,2355576) 162u Xqo；chunk-m4qpskd4.js [51989,52018) 29u Xt + [52018,52046) 28u tEs + [52046,52107) 61u Kt/nUn + [52107,52160) 53u Yo + [52160,52204) 44u ylt + [52373,52425) 52u rho + [47535,47564) 29u tho；chunk-nyce03br.js [159794,159880) 86u oRe + [160097,160194) 97u Hp/iIt',
    '两轮实测（.audit/w45-70-probe.ts + test/plugin-chain-call-dispatch.test.ts + .audit/w45-24-compiled.mjs）：门禁四条与插件自有拒绝句、时钟豁免只管未准入一条、扣留句为宿主句且每插件+首段只报一次、holder 次序 staged>stagedBefore>withheld>crashed、env/state 两条规则按方向与引用、参数复制为新对象且不动插件原对象、raise>stamp>run 三条路一致、被拒时零步执行、interface.call 按 name+method 拼写、无 run 的表项答 h.run is not a function；29/29 通过'],
  ['2026-10-17T13:55:00Z', 'decision', 'W45-70 队列实测：派发器闭包只切派发器与规则本身，21 段',
    '五颗种子 G2e/Sme/kme/nzt/Qqo 的闭包逐个查证：日志与两段名谓词在 host seam、覆写链在 runner 副本、值事件目录在 classic 副本、扣留标签在 loader 副本、时钟取值在 clock 副本、插件标签与掉线记录在 ui 副本、漏斗与两张表在 host-call 副本',
    '故只搬派发器 + 门禁 + 两条扫描规则 + 扣留规则 + 名单与谓词（21 段 4,182u），14 名按名导入；包外唯一改动是 runner 副本扩导出 swr（77→78 名，段数/单位不变），已写进 planExtensions 并在记录中重测其摘要',
    `${chain}；派发副本 21 段 4,182u sha a46c62cd…`],
  ['2026-10-17T13:58:00Z', 'finding', 'W45-70 实测：两处同名不同语句（runner 的 Xt、relay 的 Yo）',
    'runner 副本：function Xt(e,t,o){…}（预算读取器，且在其导出列表中）；relay 副本：Yo=(e,n)=>e.text===n.text&&e.cursor===n.cursor&&…（文本比较）；本包要的是 var Xt=["env.get","env.set"] 与 var Yo=(e)=>/^[\\w$@-]+$/.test(e)?e:JSON.stringify(e)',
    '按名导入会静默换函数，故两条语句一律复制而非导入；记录脚本对四处正文逐一断言（另两处是两副本各自的声明仍在）',
    '.audit/w45-70-probe.txt 的 tEs/nUn/plainOrJsonName 用例 + test/plugin-chain-call-dispatch.test.ts 的名单与名字写法用例钉住'],
  ['2026-10-17T14:01:00Z', 'finding', 'W45-70 `$` 表一侧的调用路径（门禁 + 规则 + 派发次序）已入产品',
    'W45-70 派发器 G2e 与其门禁 Sme/扫描规则 kme+nzt+Qqo/扣留规则 jGt+UGt+HGt/拼写 kJt/参数复制 Xqo/掉线记录 H2e/漏斗判定 tho/四个时钟 oRe/五个掉线调用 Hp 全部在产品内',
    'next_package 三项：React Tc(jo,…) 需先分区（115 语句 / 34,411 单位）、其余 $ 表项（ui.scroll/ui.focus/ui.copy 卡在剪贴板编码器 Sv、fs.ancestors 的 mzt 85 语句）、y9e 读路径与 CT/Tp/Q-086/a4n',
    'source-undeclared-scan 副本 unresolved 0；链校验器 70 计划通过'],
  ['2026-10-17T14:04:00Z', 'verification', `W45-70 验收：副本 unresolved 0、span total 0、账本逐段回源 + acorn + 21 处正文逐字 + 两处同名撞车双向断言 + runner 副本摘要复测、${chain}、调用路径十套 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 编译驱动与打包冒烟`,
    '调用路径收口；下一包取 React 层 Tc(jo,…)（先分区）或其余 $ 表项',
    `check/build/notices（摘要未变）；副本 unresolved 0；span total 0；${chain}；21 段逐段回源比长度与内容 + acorn（23 语句、完整、无重叠/无切半/无重复）+ 21 处正文逐字 + 21 处区间 + 23 名自有/23 名导出/14 名被导入 + Xt/Yo 四处正文断言 + runner 副本 73 段/26,233 单位/sha 420f6ddb… 复测；registry-state 八类型；调用路径十套 ${seamSweep.passed}/${seamSweep.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 编译驱动 exit 0（共享驱动输出 W45CallDispatchCompiled.v1，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-70 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-70 acceptance (2026-10-16)

- [x] **The measurement priced the cut before it was taken.** The dispatcher's closure reaches the log, the overridden-answer chain, the catalog, the withholding labels, the clock reader, the plugin label and the funnel, all of which the product already carries, so the package takes the dispatcher, the gate, the five refusal rules, the two scan rules and the name lists they read — 21 blocks, 4,182 units, 23 statements — and imports the rest by name.
- [x] **Two same-name traps were decided by reading both bodies, not by the name.** The runner copy's \`Xt\` is a budget reader and the relay copy's \`Yo\` compares two texts; this module's are the environment name list and the plain-or-JSON name writer, so both statements are copied and the record asserts all four bodies where they are.
- [x] **The one edit outside the package is recorded and guarded.** The runner copy's export list gained \`swr\` (77 → 78 names, same 73 blocks and 26,233 units); the record re-measures that copy's digest and the plan's export list so a later package cannot widen it again unnoticed.
- [x] **Every behaviour was measured before it was asserted,** including four reading alone would have got wrong: the clock exemption covers the unadmitted gate and not the scan rule, an interface call is spelled by the name and method it passes (\`srv.undefined\` without one), the withheld sentence is the host's and is told once per first segment, and a table entry needs its call while the check, the raise and the stamp are optional.
- [x] **The refusal sentences are asserted as text.** Every rule's sentence — the plugin's own for the five it owns, the host's for the withheld call, and each scan rule's — is compared with the literal the source composes, so a reworded refusal fails here rather than reaching a plugin.
- [x] **All twenty-one bodies are quoted verbatim** (no copied body holds a line break, so no elision is needed), with all twenty-one ranges cited and every wrapper asserted to call its own copied body.
- [x] **Sweep.** check/build/notices, the copy \`unresolved 0\`, span scan \`total 0\`, ${chain}, the ledger with acorn, the seam's twenty-one quotes and ranges, the four same-name bodies, the new suite ${suiteSweep.passed}/${suiteSweep.tests}, the call-path seam sweep ${seamSweep.passed}/${seamSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
const written = {
  'research/CURRENT.md': 'W45-70 **收口',
  'research/STATUS.md': '\nW45-70:',
  'research/coding-standard.md': '\n2026-10-16 W45-70 ',
  'research/ports/W45-chain-runner.md': '\n## W45-70 ported',
  '.audit/w45-runtime.todo.md': '\n## W45-70 acceptance',
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
