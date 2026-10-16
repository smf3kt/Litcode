// Write the W45-56 record from the artifacts themselves: the local settings store, its thirteen
// copied blocks, and the policy pin the walk is gated on.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 402, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 151, `validation ${identity.validation.files}`);
expect(identity.build.files === 279, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 56) throw new Error('the chain verifier did not pass 56 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const copy = verifier.files.find((file) => file.product.endsWith('plugin-chain-local-store-source.ts'));
if (!copy || copy.blocks !== 13 || copy.units !== 6401) throw new Error('the store copy is not the 13-block, 6,401-unit one');
const internalsCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-lodash-internals-source.ts'));
if (!internalsCopy || internalsCopy.blocks !== 153 || internalsCopy.units !== 11297) {
  throw new Error('the lodash-internals copy gained a block beyond the one export the store reads');
}
const memoizeCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-lodash-memoize-source.ts'));
if (!memoizeCopy || memoizeCopy.blocks !== 20 || memoizeCopy.units !== 1231) {
  throw new Error('the lodash-memoize copy changed');
}
const probesCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-local-store-probes-source.ts'));
if (!probesCopy || probesCopy.blocks !== 1 || probesCopy.units !== 549) {
  throw new Error('the probe cache copy changed');
}

const ledger = JSON.parse(read('src/plugin-chain-local-store-source-blocks.json'));
if (ledger.blocks.length !== 13) throw new Error('the store ledger does not hold thirteen blocks');
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 6401) throw new Error(`the ledger holds ${units} units`);
const storeBlocks = ledger.blocks.filter((block) => block.module === 'chunk-4bw62nzm.js');
const pinBlocks = ledger.blocks.filter((block) => block.module === 'chunk-k1419ccf.js');
if (storeBlocks.length !== 10 || pinBlocks.length !== 3) throw new Error('the store copy is no longer ten statements plus the pin trio');
if (storeBlocks.reduce((sum, block) => sum + block.units, 0) !== 6269) throw new Error('the store module no longer contributes 6,269 units');
if (pinBlocks.reduce((sum, block) => sum + block.units, 0) !== 132) throw new Error('the pin no longer contributes 132 units');
const internalsLedger = JSON.parse(read('src/plugin-chain-lodash-internals-source-blocks.json'));
if (internalsLedger.blocks.length !== 153) throw new Error('the lodash-internals ledger is not the 153-block one');
if (internalsLedger.blocks.reduce((sum, block) => sum + block.units, 0) !== 11297) throw new Error('the lodash-internals units moved');
for (const [file, count] of [['src/plugin-chain-local-store-source.ts', 13],
  ['src/plugin-chain-lodash-internals-source.ts', 153],
  ['src/plugin-chain-settings-source-source.ts', 37],
  ['src/plugin-chain-local-store-probes-source.ts', 1],
  ['src/plugin-chain-registry-stores-source.ts', 3]]) {
  const scan = execFileSync(process.execPath, ['scripts/source-undeclared-scan.mjs', file], { encoding: 'utf8' });
  if (!/unresolved 0/.test(scan)) throw new Error(`${file} has unresolved names`);
  const file3 = JSON.parse(read(file.replace(/\.ts$/, '-blocks.json')));
  if (file3.blocks.length !== count) throw new Error(`${file} ledger is not the ${count}-block one`);
}

// The plans this package touched: the store plan is new, the lodash-internals plan gained one export
// (`M`, the equality the source diff compares with — its statement was already copied).
const storePlan = JSON.parse(read('research/ports/W45-local-store-blocks.plan.json'));
if (storePlan.exports.join(',') !== 'Ixr,F8e,q,oe,re,XMt,Et,Gr,Nr,Vn,j,nHs') throw new Error('the store plan exports changed');
if (storePlan.blocks.length !== 13) throw new Error('the store plan is not the thirteen-block one');
for (const line of ["import { dirname as Dt, basename as Vr } from 'path';", "import { M } from './plugin-chain-lodash-internals-source.js';",
  "import { Ht } from './plugin-chain-local-store-probes-source.js';", "import { Oe } from './plugin-chain-registry-stores-source.js';"]) {
  if (!storePlan.imports.includes(line)) throw new Error(`the store plan lost its ${line}`);
}
const internalsPlan = JSON.parse(read('research/ports/W45-lodash-internals-source-blocks.plan.json'));
if (internalsPlan.exports.length !== 26 || internalsPlan.exports.at(-1) !== 'M') {
  throw new Error('the lodash-internals plan did not gain exactly the `M` export');
}
if (internalsPlan.blocks.length !== 153) throw new Error('the lodash-internals plan is not the 153-block one');

// Every block is re-read from its module, compared with the ledger, searched for in the copy, and
// checked against acorn: each one has to be a whole top-level statement, and no two may overlap.
const sources = new Map();
const statements = new Map();
for (const module of new Set(ledger.blocks.map((block) => block.module))) {
  const text = read(`extracted-v2/modules/${module}`);
  let tree;
  try { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' }); }
  catch { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script' }); }
  sources.set(module, text);
  statements.set(module, tree.body.map((node) => ({ start: node.start, end: node.end })));
}
const copyText = read('src/plugin-chain-local-store-source.ts');
const seen = new Set();
for (const block of ledger.blocks) {
  const [start, end] = block.range;
  if (end - start !== block.units) throw new Error(`${block.range} is not ${block.units} units`);
  const body = sources.get(block.module).slice(start, end);
  const all = statements.get(block.module);
  if (!all.some((node) => node.start === start && node.end === end)) {
    throw new Error(`${block.module} ${JSON.stringify(block.range)} is not one whole top-level statement`);
  }
  if (all.some((node) => (node.start < start && node.end > start) || (node.start < end && node.end > end))) {
    throw new Error(`${block.module} ${JSON.stringify(block.range)} cuts a statement in half`);
  }
  if (seen.has(`${block.module}:${start}`)) throw new Error(`${block.module} ${start} is copied twice`);
  seen.add(`${block.module}:${start}`);
  if (!copyText.includes(body)) throw new Error(`${block.note.slice(0, 40)} is no longer in the copy`);
}
const sorted = ledger.blocks.filter((block) => block.module === 'chunk-4bw62nzm.js')
  .map((block) => block.range).sort((a, b) => a[0] - b[0]);
for (let index = 1; index < sorted.length; index++) {
  if (sorted[index][0] < sorted[index - 1][1]) throw new Error(`${sorted[index]} overlaps ${sorted[index - 1]}`);
}
// Statement order is load-bearing for the pin: `var t;` has no initializer, so `j()` and `nHs` must
// follow it, and the class order matters the same way — `q` before `Ixr`, `oe` before the store.
const order = ledger.blocks.map((block) => block.range[0]);
const before = (a, b, what) => { if (!(order.indexOf(a) < order.indexOf(b))) throw new Error(`the copy lost the source order: ${what}`); };
before(1148, 1154, 'the pin state comes before the flag reader');
before(1154, 1181, 'the flag reader comes before the setter');
before(10003, 16862, 'the per-host cache class comes before the store built from it');
before(10256, 12107, 'the walk cache comes before the store that owns one');
before(10514, 12107, 'the repository tier comes before the store that owns one');

// The bodies this record names, located by the text they start with, with the unit counts it states.
const bodyOf = (module, needle, units) => {
  const source = sources.get(module);
  const block = ledger.blocks.find((entry) => entry.module === module && source.slice(...entry.range).startsWith(needle));
  if (!block) throw new Error(`${needle} is not copied`);
  if (block.units !== units) throw new Error(`${needle} is ${block.units} units, not ${units}`);
  return source.slice(...block.range);
};
if (bodyOf('chunk-4bw62nzm.js', 'function Nr(e,t){', 31) !== 'function Nr(e,t){return M(e,t)}') {
  throw new Error('the equality pass-through changed');
}
if (bodyOf('chunk-4bw62nzm.js', 'var Vn=Nr;', 10) !== 'var Vn=Nr;') throw new Error('the equality alias changed');
if (bodyOf('chunk-4bw62nzm.js', 'class q{', 144) !== 'class q{#e;#t=new WeakMap;constructor(e){this.#e=e}'
  + 'of(e){let t=this.#t.get(e);if(t!==void 0)return t;let o=this.#e();return this.#t.set(e,o),o}}') {
  throw new Error('the per-host instance cache changed');
}
const walk = bodyOf('chunk-4bw62nzm.js', 'class oe{', 258);
for (const fragment of ['walked=new Map', 'folderIsLink=new Map', 'managedMcp=null', 'clearWalk(){this.walked.clear(),this.folderIsLink.clear()}',
  'noteWalked(e,t){', 'all(){']) {
  if (!walk.includes(fragment)) throw new Error(`the walk cache lost ${fragment}`);
}
const tier = bodyOf('chunk-4bw62nzm.js', 'class re{', 1253);
for (const fragment of ['holders=0', 'tiers', 'baseline=void 0', 'linger(e,t){', 'isHeld(){return this.holders>0}']) {
  if (!tier.includes(fragment)) throw new Error(`the repository tier lost ${fragment}`);
}
if (bodyOf('chunk-4bw62nzm.js', 'function XMt(e){', 66) !== 'function XMt(e){return e!==null&&Object.keys(e).length===0?null:e}') {
  throw new Error('the empty-settings normalize changed');
}
if (bodyOf('chunk-4bw62nzm.js', 'function Et(e){', 127) !== 'function Et(e){return{...e,settings:XMt(e.settings),unfiltered:XMt(e.unfiltered),'
  + '...e.legacy!==void 0&&{legacy:XMt(e.legacy)}}}') {
  throw new Error('the source snapshot changed');
}
if (bodyOf('chunk-4bw62nzm.js', 'function Gr(e,t){', 147) !== 'function Gr(e,t){return[...e.keys(),...[...t.keys()].filter((o)=>!e.has(o))]'
  + '.filter((o)=>{let r=e.get(o),i=t.get(o);return!Vn(r&&Et(r),i&&Et(i))})}') {
  throw new Error('the changed-source diff changed');
}
const store = bodyOf('chunk-4bw62nzm.js', 'class F8e{', 4206);
for (const fragment of ['mergedSettings=null', 'perSource=new Map', 'parsedFiles=new Map', 'managedDocumentLinks=new oe',
  'folderListings=new Map', 'managedFileReads=new Map', 'primedFiles=new Set', 'policyWalks=0', 'walkedFolders=new Map',
  'policy={}', 'lastPolicyEnvComposition=null', 'isLoadingFromDisk=!1', 'autoModeUntrustedSourceWarned=!1', 'changed=Oe()',
  'internalWrites=new Map', 'enabledSources', 'inlineFlagParse', 'repoTierFreeze=new re', 'pluginBase', 'epoch=0',
  'systemSpaceServingLogged=!1', 'systemAttestationContradicted=!1', 'invalidated=Oe()', 'pluginBaseLoaded=!1',
  'localStoreProbes=new Ht', 'retained=new Map', 'retainedListings=new Map', 'setPluginBase(e){', 'clearPluginBase(){',
  'invalidateAll(e){', 'invalidatePolicyLayer(){', 'onInvalidate(e){', 'seedParsedFile(e,t,o,r){', 'walkReadDiffers(e,t){',
  'unseedParsedFile(e,t,o){', 'dropDerivedCaches(e){', 'primedFolderListing(e){', 'folderListingForPolicyWalk(e){',
  'noteWalkListing(e,t){', 'get policyWalkCount(){', 'policyInstallVerdict(e,t,o){', 'folderInstallVerdict(e,t,o){',
  'seedFolderListing(e,t,o){', 'walkReadManagedFileIn(e,t){', 'walkRead(e){', 'hasParsedDropInOutside(e,t){',
  'clearFolderListing(e,t){', 'retainLayer(e,t){', 'dropRetainedLayer(e){', 'retainFolderListing(e,t){']) {
  if (!store.includes(fragment)) throw new Error(`the local settings store lost ${fragment}`);
}
// The verdict ladder, read out of the copied body: the threshold is only read past the walk check,
// which is why an unpinned store can only answer install or raced.
if (!store.includes('if(r===void 0||Vn(r,t))return"install";if(!this.primedFiles.has(e))return"raced";'
  + 'if(this.policyWalks===0)return"install";return this.policyWalks>o?"raced":"deferred"')) {
  throw new Error('the policy verdict ladder changed');
}
if (!store.includes('if(!this.walkedFolders.has(e))return this.hasParsedDropInOutside(e,t)?"raced":"install";')) {
  throw new Error('the folder verdict lost its unwalked arm');
}
if (!store.includes('if(!j())return;this.policyWalks++;')) throw new Error('the walk is no longer gated on the pin');
if (!store.includes('primedFolderListing(e){return j()?this.folderListings.get(e):void 0}')) {
  throw new Error('the listing read is no longer gated on the pin');
}
if (bodyOf('chunk-4bw62nzm.js', 'var Ixr=new q(', 27) !== 'var Ixr=new q(()=>new F8e);') {
  throw new Error('the store binding changed');
}
// The pin: the state it reads, the flag reader, and the write-once setter.
if (bodyOf('chunk-k1419ccf.js', 'var t;', 6) !== 'var t;') throw new Error('the pin state changed');
if (bodyOf('chunk-k1419ccf.js', 'function j(){', 27) !== 'function j(){return t===!0}') throw new Error('the pin reader changed');
if (bodyOf('chunk-k1419ccf.js', 'function nHs(n){', 99) !== 'function nHs(n){let e=n===!0;if(t===void 0)return t=e,"pinned";'
  + 'return t===e?"unchanged":"conflict"}') {
  throw new Error('the pin setter changed');
}
// The lodash internals export this package added: the statement was already in the copy.
if (!read('src/plugin-chain-lodash-internals-source.ts').includes('\nvar M=Ft;')) {
  throw new Error('the lodash-internals copy no longer declares the equality the diff compares with');
}
// The seam: the store it now answers with, the pin surface, and the reach it does not invent.
const seam = read('src/plugin-chain-local-store.ts');
for (const fragment of ['export function localStore(host: object): F8e {', 'return Ixr.of(host) as F8e;',
  'export function ji(): LocalStoreHandle {', 'return bound ?? localStore(hostKey);', 'export function bindLocalStore(',
  'export function bindLocalStoreHost(', 'export function isPolicyPinned(): boolean {', 'export function setPolicyPin(',
  "export function normalizeEmptySettings(", 'export function wrapSourceSnapshot(', 'export function changedSourceKeys(',
  'export { F8e, Ht };']) {
  if (!seam.includes(fragment)) throw new Error(`the store seam lost ${fragment}`);
}
if (!seam.includes('so the pin is **write-once per process**')) throw new Error('the seam no longer names the write-once pin');
if (!seam.includes('so an entry without `unfiltered` throws')) throw new Error('the seam no longer names the measured TypeError');
const sourceSeam = read('src/plugin-chain-settings-source.ts');
if (!sourceSeam.includes("export { bindLocalStore, bindLocalStoreHost, localStore, type LocalStoreHandle } from './plugin-chain-local-store.js';")) {
  throw new Error('the settings-source seam no longer re-exports the store handle it substitutes');
}
if (!sourceSeam.includes('export function localSettingsPath(')) throw new Error('the settings-source seam lost the local path');

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-56-tests.txt');
if (full.failed !== 0 || full.tests !== 1541) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-56-family.txt');
if (family.failed !== 0 || family.tests !== 265) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const seamSweep = summary('.audit/w45-56-seam.txt');
if (seamSweep.failed !== 0 || seamSweep.tests !== 8) throw new Error('the store sweep is not clean');
const scanSweep = read('.audit/w45-56-scan.txt');
if ((scanSweep.match(/unresolved 0/g) ?? []).length !== 5) throw new Error('the five copies did not all scan clean');
const span = JSON.parse(read('.audit/w45-56-span.txt'));
if (span.total !== 0) throw new Error(`the span scan found ${span.total}`);
const notices = JSON.parse(read('.audit/w45-56-notices.txt').split('\n').filter((line) => line.startsWith('{')).at(-1));
if (notices.sha256 !== '384c78801194aedea80331383ccd93708c2dfa46bc746003dc112c930b73d13c') {
  throw new Error('the dependency-notice digest moved');
}

const smokeReport = read('.audit/w45-56-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 287) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const allMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
const sharedMarkers = read('.audit/w45-56-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-56-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45LocalStoreCompiled.v1')) throw new Error('the shared driver did not print the W45-56 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45LocalStoreCompiled.v1 (${sharedMarkers.length} markers in the shared driver, ${allMarkers.length} across every driver: it reads the store the settings path mutates — the empty-settings normalize, the source snapshot, the changed-source diff, one store per host with the probe cache the ownership gate reads, the install/deferred/raced verdict ladder, the retain closure — then pins the policy flag and re-reads the verdicts and the walk counter through the pinned arms, because the pin is write-once per process)`;

const evidence = {
  schema: 'W45LocalStoreEvidence.v1',
  package: 'W45-56 — the local settings store',
  date: '2026-10-16',
  question: 'What is the store every settings read mutates, and what does it answer before and after a policy walk?',
  answer: '`Ixr` is `new q(() => new F8e)` — one store per host, remembered in a `WeakMap` — and `F8e` is the store: `mergedSettings` (null until a read fills it), `perSource`, the `parsedFiles` map with its `primedFiles` companion, the managed-read and listing caches, `repoTierFreeze`, `isLoadingFromDisk`, `pluginBase`, the `epoch`, `localStoreProbes=new Ht`, `changed`/`invalidated` emitters, and the methods that load, seed, invalidate and diff them. The settings diff compares `Et(entry)` — `settings` and `unfiltered` each passed through `XMt`, which answers null for a null or empty object, and `legacy` only when the entry carries one — and `Gr` answers the keys of both maps whose wrapped snapshots are not `M`-equal, target keys first. The install verdict is a ladder: an unparsed or equal file installs; a changed file that is not primed has raced; a changed primed file with no walk yet installs; past a walk it is `deferred` while the walk count is within the threshold and `raced` above it. Both the walk counter and the listing read are gated on `j()` — the policy pin — and `nHs` sets that pin write-once: the first call answers `pinned`, a repeat `unchanged`, and a disagreement `conflict` while leaving the flag alone.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  planExtensions: [
    {
      plan: 'research/ports/W45-lodash-internals-source-blocks.plan.json',
      what: 'the `M` export — the equality the source snapshot and the changed-source diff compare with (no block: `var M=Ft;` was already inside a copied range)',
      blocks: '153 blocks, 11,297 units, unchanged; exports 25 → 26',
    },
  ],
  boundary: 'No new boundary, and one existing boundary was retired. The store closes over exactly what the product already carries: `M` and the equality stack behind it from ./plugin-chain-lodash-internals-source.js, `Ht` from ./plugin-chain-local-store-probes-source.js, `Oe` from ./plugin-chain-registry-stores-source.js, and `dirname`/`basename` from `path`. `Ht` is the probe cache W45-54 copied on its own, so it is imported rather than copied twice. The handle W45-54 introduced as a seam is now the real store: `LocalStoreHandle` used to stand in for the one field the settings-source bodies read, and `ji()` now answers `Ixr.of(host)` for a bound host, so that package\'s default is the source\'s own instance instead of an approximation. `ji()` is called with no arguments by the copied read bodies, and the source reaches its store through `B().host`; the seam keeps the no-argument shape with one module-level host key and lets a caller that owns the real host object bind it.',
  measured: [
    'One store per host, and `ji()` answers it: the same host key always answers the same instance, a different key builds its own, and the narrower handle a test binds still wins while it is bound.',
    'A fresh store\'s fields, measured: `mergedSettings` null, `isLoadingFromDisk` false, `epoch` 0, `pluginBase` undefined, `pluginBaseLoaded` false, `lastPolicyEnvComposition` null, `retained`/`retainedListings` empty, `repoTierFreeze.holders` 0 with `tiers` undefined, `localStoreProbes` an `Ht`, `changed`/`invalidated` emitter objects, and `enabledSources` undefined — the source declares that field and never initializes it.',
    '`XMt` answers null for a null or empty object and keeps anything else; `Et` normalizes both `settings` and `unfiltered` and adds `legacy` only when the entry carries one.',
    '`Et` has the source\'s own limit, asserted rather than smoothed over: an entry without `unfiltered` throws `TypeError: Cannot convert undefined or null to object`, because both fields go through `Object.keys`. The store\'s own entries always carry both.',
    '`Gr` answers the changed keys target-first (`[\'project\', \'gone\', \'added\']` for two maps that share `user` and `project`), and a key on one side only differs by construction.',
    '`seedParsedFile`, `unseedParsedFile`, `seedFolderListing` and `clearFolderListing` all compare the epoch they are handed with the store\'s, so a stale caller is a no-op: measured `false` from both seeds, `undefined` from the unseed, and a `clearFolderListing` that also refuses while the folder has been walked.',
    '`invalidateAll` bumps the epoch and drops every cache: `mergedSettings` back to null, `perSource`, `parsedFiles`, `folderListings` and `walkedFolders` empty, `policyWalkCount` 0.',
    'The retain closures back the identity of the entry they installed: an earlier closure run over a newer layer leaves the newer one alone (`{parsed: {a: 2}}`), and `retainFolderListing` returns the same shape of undo.',
    'The verdict ladder, measured in order: unparsed install, equal install, changed-but-unprimed `raced`, changed-and-primed with no walk `install`, and past a walk `deferred` within the threshold and `raced` above it — so a negative threshold cannot race on its own, because the walk check comes first.',
    'The folder verdict measured: an unwalked folder with a parsed drop-in the listing does not mention is `raced`, with the drop-in listed `install`, and with no drop-in `install`; a walked folder whose listing equals the walk is `install`, otherwise the threshold decides.',
    'The pin is write-once per process: `j()` false before anything pins, `"pinned"` on the first call, `"unchanged"` on a repeat, `"conflict"` on a disagreement — and the flag stays set, so the pin cannot be undone. Measured through the gate: with the pin off, `folderListingForPolicyWalk` returns early and counts nothing and `primedFolderListing` answers `undefined` even for a seeded listing; with it pinned, the walk counter moves, the listing cache answers, and the verdicts reach their deferred and raced arms. `noteWalkListing` records a walked folder without counting a walk.',
  ],
  regressions: `the new store suite ${seamSweep.passed}/${seamSweep.tests}; ${familyLine}`,
  full: fullLine,
  compiled: driverLine,
  smoke,
  next_package: [
    'the settings *read* path behind `y9e` (`Qnn` + `$t`, 325,824 units) and the all-sources merge `bTr` (335,278 units): both now sit on ported pieces — the file each source reads, the merge each result is folded with, and the store each mutation lands in — so the read path is the next unit that can come across whole',
    'the managed-settings gate `CT`/`Tp` (61,983 units) that `fe` consults before a read, which would let `settings.read` drop its bound hook',
    'registering the `store.*`, `settings.read` and remaining `ui.*` cores in the product\'s chain catalog once the product has a `$` surface to call them from',
    '`http.fetch` (`VQt`) once the request runner `dNo` is ported; `ui.copy` (`wGo`/`uzo`/`dzo`) once the clipboard encoder `Sv` is ported, with the `stamp` field modelled; `ui.blit`/`ui.scroll`/`ui.focus`/`ui.notify`; `fs.ancestors` (`mzt`/`kNs`) and `state.get`/`state.set` (`Jf`/`KD`)',
    'Q-086\'s 15 registry-reading cores and their 34 sites',
    'the notification provider `a4n`, and the config/home layer behind `be`',
  ],
};
write('research/ports/W45-local-store-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-56 **搬本地设置存储',
  features: '; W45-56 ports the local settings store',
  standard: '2026-10-16 W45-56 本地设置存储',
  status: 'W45-56: the local settings store.',
  runner: '## W45-56 ported the local settings store',
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
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-56 **搬本地设置存储**（每次设置读取都在改的那份 store，以及它在 policy 走查前后各自答什么）：**13 段 6,401 单位**——chunk-4bw62nzm.js 10 段 6,269u（\`Nr\` [9915,9946) 31u、\`Vn\` [9946,9956) 10u、\`q\` 每宿主实例缓存 [10003,10147) 144u、\`oe\` 走查缓存 [10256,10514) 258u、\`re\` 仓库层级 [10514,11767) 1253u、\`XMt\` [11767,11833) 66u、\`Et\` 源快照 [11833,11960) 127u、\`Gr\` 变更源 diff [11960,12107) 147u、\`F8e\` 存储本体 [12107,16313) 4206u、\`Ixr\` [16862,16889) 27u）+ chunk-k1419ccf.js 3 段 132u（\`var t;\` [1148,1154) 6u、\`j\` [1154,1181) 27u、\`nHs\` pin 设置器 [1181,1280) 99u）。**语义（源文实测）**：\`Ixr=new q(()=>new F8e)\` → **一宿主一 store**（WeakMap）；\`Et\` 把 \`settings\`/\`unfiltered\` 各过 \`XMt\`（null 或空对象→null，其余原样）且仅在条目带 \`legacy\` 时补它；\`Gr\` 答两 map 中快照不相等（\`M\` 相等）的键，**目标键在前**；安装判决是阶梯——未解析/相等→\`install\`、已变更但未 primed→\`raced\`、已变更已 primed 且尚无走查→\`install\`、走查之后 \`policyWalks>阈值 ? raced : deferred\`；\`policyInstallVerdict\`/\`folderInstallVerdict\` 的**阈值只在走查检查之后才读**（故未 pin 时只可能出现 install/raced）；走查计数与 listing 读取都被 \`j()\` 门控；\`nHs\` 是**写一次**的 pin（首次 \`pinned\`、同值 \`unchanged\`、异值 \`conflict\` 且不动标志）。**边界退掉一个**：W45-54 的 \`LocalStoreHandle\` 只是"读到的那一个字段"的替身，本包让 \`ji()\` 直接答 \`Ixr.of(host)\`（绑定宿主即跟随 \`B().host\`，无参数时用一个模块级宿主键 = 进程一份 store），settings 源层那句再导出随之改成真实 store。**另收一处**：lodash 内部副本**只加 1 个导出 \`M\`**（\`var M=Ft;\` 本就在已搬区间里，无新块）。验收：check/build/notices（摘要未变）、五副本扫描 \`unresolved 0\`、span 扫描 \`total 0\`、**${chain}**、账本 13 段逐段回源比长度与内容 + acorn 断言（完整顶层语句、无重叠、无重复）+ **顺序断言 5 条**（\`var t;\`→\`j\`→\`nHs\`、\`q\`→\`Ixr\`、\`oe\`/\`re\`→\`F8e\`）、关键正文逐字比对（\`Nr\`/\`Vn\`/\`q\`/\`oe\`/\`re\`/\`XMt\`/\`Et\`/\`Gr\`、\`F8e\` 的 27 个字段与 20+ 方法、判决阶梯原文、pin 三件套）、seam 12 处导出与两处"如实标注"、新回归 ${seamSweep.passed}/${seamSweep.tests}、插件链家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45LocalStoreCompiled.v1\`，共享 ${sharedMarkers.length} 标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 **实测纠偏两处**：首版以为"负阈值必然 raced"（实测走查检查在前，未走查时仍 install）、以为 \`primedFolderListing\` 需要走查后才可读（实测它只被 pin 门控）。 | [本地设置存储证据](ports/W45-local-store-evidence.json)、[settings 合并层证据](ports/W45-settings-merge-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('the C-12 row was not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

const features = read('research/FEATURES.md').replace(new RegExp(`${marks.features.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^|]*`), '');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('the interactive feature row was not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-56 ports the local settings store: ` +
  '`Ixr` (one instance per host), the store with its merged settings, per-source map, parsed-file and listing ' +
  'caches, repository tier and probe cache, the source snapshot and changed-source diff every settings read is ' +
  'built from, the install/deferred/raced verdict ladder, and the write-once policy pin the walk is gated on. |';
write('research/FEATURES.md', lines.join('\n'));

const standard = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standard.indexOf('2026-10-16 W45-55 settings 合并层');
if (standardAt < 0) throw new Error('coding-standard W45-55 line not found');
const standardEntry = `2026-10-16 W45-56 本地设置存储：S-1至S-7已对照。S-1（先读源）：W45-55 的证据把"合并"闭环后，下一个能整段搬走的单元就是它落进去的那份 store；量 \`Ixr\` 的闭包得 98 段 13,825 单位，其中 **88 段 7,556 单位是 lodash 比较栈**（已在 \`plugin-chain-lodash-internals-source.ts\` 里），故只搬 **10 段 6,269 单位 + pin 三件套 132 单位**，其余 import；**关键正文逐字读过再动手**（\`Et\` 的 \`XMt(settings)/XMt(unfiltered)\`、\`Gr\` 的 \`[...e.keys(),...[...t.keys()].filter(o=>!e.has(o))]\`、\`policyInstallVerdict\` 的四行阶梯、\`folderListingForPolicyWalk\` 里 \`if(!j())return;this.policyWalks++\`、\`nHs\` 的 \`if(t===void 0)return t=e,"pinned"\`）。S-2（不留半包）：无新边界——闭包内自由名全落在已搬副本上（\`M\`/lodash 内部、\`Ht\`、\`Oe\`、\`path\` 的 \`dirname\`/\`basename\`），且**退掉一个旧边界**：W45-54 的 \`LocalStoreHandle\` 是"只读到 localStoreProbes 一个字段"的替身，本包让 \`ji()\` 答真实 store（\`Ixr.of(host)\`），settings 源层的再导出同步改掉，\`plugin-chain-settings-source.test.ts\` 8/8 不动。S-3（先测后断言）：\`.audit/w45-56-probe.ts\` 与 \`.audit/w45-56-probe2.ts\` 先跑再写断言；**两处按实测纠偏**——① 首版断言"负阈值必然 raced"，实测**阈值在走查检查之后才读**（\`if(this.policyWalks===0)return"install"\`），未走查时仍是 install；② 首版以为 \`primedFolderListing\` 需走查后才可读，实测它**只被 pin 门控**（\`return j()?this.folderListings.get(e):void 0\`）；另测出 \`Et\` 缺 \`unfiltered\` 时抛源自己的 \`TypeError\`（如实断言而非抹平）、\`noteWalkListing\` 记走查但不计数、\`enabledSources\` 声明未初始化。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器/打包冒烟/${drivers.length} 个编译驱动并解析输出，并断言 span 扫描 \`total 0\`、notices 摘要未变；acorn（完整顶层语句、无重叠、无重复）+ 5 条源顺序断言 + 23 处关键正文逐字比对 + 五副本 \`unresolved 0\`。S-5/S-6：seam 只做命名与类型收窄（\`localStore\`/\`ji\`/\`bindLocalStore\`/\`bindLocalStoreHost\`/\`isPolicyPinned\`/\`setPolicyPin\` + 三个 diff 助手 + \`export { F8e, Ht }\`），无死导出；\`localStore\` 的 \`host\` 参数与 \`bindLocalStoreHost\` 都不是发明分支，而是 \`Ixr\`/\`WeakMap\` 与源里 \`B().host\` 的等价投影。S-7：\`y9e\`/\`Qnn\`/\`$t\`/\`bTr\`、\`CT\`/\`Tp\`、\`$\` 表面注册、\`http.fetch\`、\`ui.copy\`、\`ui.blit\`/\`scroll\`/\`focus\`/\`notify\`、\`fs.ancestors\`、\`state.*\`、Q-086 写入 next_package。验收：check/build/notices、五副本扫描 unresolved 0、${chain}、账本与正文自证、回归 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf('W45-55: the settings merge layer.');
if (statusAt < 0) throw new Error('STATUS W45-55 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = 'W45-56: the local settings store. Every settings read mutates one store per host — `Ixr` is ' +
  '`new q(() => new F8e)`, the factory class remembered in a `WeakMap` — and this package carries it: ' +
  '`mergedSettings`, `perSource`, the `parsedFiles` map with its `primedFiles` companion, the managed-read and ' +
  'listing caches, `repoTierFreeze`, `isLoadingFromDisk`, `pluginBase`, the `epoch`, `localStoreProbes=new Ht`, and ' +
  'the methods that load, seed, invalidate and diff them. 13 whole top-level statements, 6,401 units: ten from ' +
  'chunk-4bw62nzm.js and the policy pin with its state and setter from chunk-k1419ccf.js. The closure is 98 ' +
  'statements, but 88 of them (7,556 units) are the lodash comparison stack the product already carries, so the ' +
  'store imports them rather than copying them a second time — the only change on that side is one export, `M`. No ' +
  'new boundary, and one retired: the handle W45-54 introduced as a seam stood in for the single field the ' +
  'settings-source bodies read, and `ji()` now answers the real store, so that package\'s default is the source\'s ' +
  'own instance. Two measurements corrected the first draft: the install verdict reads its threshold only *past* ' +
  'the walk check, so an unpinned store cannot answer `raced` on a threshold alone, and `primedFolderListing` is ' +
  'gated on the pin rather than on a prior walk. The pin itself is write-once per process — `pinned`, then ' +
  '`unchanged`, then `conflict` with the flag left alone — which is why the suite and the compiled driver both ' +
  'assert it last. Evidence: `research/ports/W45-local-store-evidence.json`, and\n' +
  '[工作包](ports/W45-chain-runner.md).\n\n';
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-56 ported the local settings store (2026-10-16)

Every settings read mutates one store per host. \`Ixr\` is \`new q(() => new F8e)\` — the factory class remembers one
instance per host key in a \`WeakMap\` — and \`F8e\` is the store: the merged settings, the per-source map the read
fills, the parsed-file map with its primed companion, the managed-read and listing caches, the repository tier, the
probe cache the ownership gate reads, the epoch, and the methods that load, seed, invalidate and diff them. The
settings diff compares \`Et(entry)\` — \`settings\` and \`unfiltered\` each passed through \`XMt\`, which answers null
for a null or empty object, and \`legacy\` only when the entry carries one — and \`Gr\` answers the keys of both maps
whose wrapped snapshots are not equal, target keys first. The install verdict is a ladder: unparsed or equal
installs; changed and unprimed has raced; changed and primed with no walk yet installs; past a walk, \`deferred\`
within the threshold and \`raced\` above it.

13 whole top-level statements, 6,401 units: ten from chunk-4bw62nzm.js, and the policy pin — its state, the flag
reader \`j\`, and the setter \`nHs\` — from chunk-k1419ccf.js. The closure that seeded the package is 98 statements,
13,825 units, but 88 of them (7,556 units) are the lodash comparison stack the product already carries, so they are
imported rather than copied twice: the store copy is what no other copy holds. The only change on the other side is
one export, \`M\`, whose statement was already inside a copied range.

No new boundary, and one retired. \`LocalStoreHandle\` was the seam W45-54 introduced when the only field the
settings-source bodies read was \`localStoreProbes\`; \`ji()\` now answers \`Ixr.of(host)\` for a bound host, so that
package's default is the source's own instance rather than a stand-in — and its eight tests pass unchanged against
the real store. The source reaches its store through \`B().host\`; the seam keeps the no-argument shape the copied
bodies call with one module-level host key, which is one store for the process, and lets a caller that owns the real
host object bind it.

Measured before asserted, and two measurements corrected the first draft. The install verdict reads its threshold
only *past* the walk check, so a negative threshold cannot race on its own — with no walk counted the answer is
still \`install\`, and with the pin off the walk counter cannot move at all, which is why an unpinned store has only
the install and raced arms. And \`primedFolderListing\` is gated on the pin rather than on a prior walk: it answers
the newest seeded listing, and \`noteWalkListing\` records a walked folder without counting a walk. Also measured:
\`Et\` throws the source's own \`TypeError\` when an entry carries \`settings\` but no \`unfiltered\`, which the suite
asserts rather than smooths over; the retain closures back the identity of the entry they installed, so an older
undo leaves a newer layer alone; \`invalidateAll\` bumps the epoch and empties every cache; the seed, unseed and
clear methods are no-ops on a stale epoch, and \`clearFolderListing\` also refuses a walked folder; and the pin is
write-once per process — \`pinned\`, then \`unchanged\`, then \`conflict\` with the flag left set — so the suite and
the compiled driver both assert it last.

Verified: check/build/notices, all five touched copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, the store
ledger re-read block by block with acorn and five order assertions (the pin's state before its reader before its
setter, the factory class before the store it builds, the walk cache and the repository tier before the store that
owns one), body comparisons for every named statement including the verdict ladder and the pin trio, the seam's
twelve exports, the new suite ${seamSweep.passed}/${seamSweep.tests}, ${familyLine}, full ${fullLine},
${drivers.length} compiled drivers (the shared driver now also prints \`W45LocalStoreCompiled.v1\`), and the packaged smoke
(${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: the settings *read* path behind \`y9e\` (\`Qnn\` + \`$t\`, 325,824 units) and the all-sources merge \`bTr\`
(335,278 units) now sit on three ported pieces — the file each source reads, the merge each result is folded with,
and the store each mutation lands in — so the read path is the next unit that can come across whole; then the
managed-settings gate \`CT\`/\`Tp\` (61,983 units).
`);

const rows = [
  ['2026-10-17T05:20:00Z', 'package', 'W45-56 搬本地设置存储（一宿主一 store；13 段 6,401 单位 = chunk-4bw62nzm.js 10 段 6,269u + pin 三件套 132u）',
    'Ixr/F8e/q 成为产品面：ji() 直接答真实 store（退掉 W45-54 的 LocalStoreHandle 替身），并暴露 Et/XMt/Gr 源快照与变更 diff、j/nHs write-once pin；settings 源层的再导出同步改掉',
    'chunk-4bw62nzm.js 10 段（Nr [9915,9946) 31u、Vn [9946,9956) 10u、q [10003,10147) 144u、oe [10256,10514) 258u、re [10514,11767) 1253u、XMt [11767,11833) 66u、Et [11833,11960) 127u、Gr [11960,12107) 147u、F8e [12107,16313) 4206u、Ixr [16862,16889) 27u）+ chunk-k1419ccf.js 3 段（var t; [1148,1154) 6u、j [1154,1181) 27u、nHs [1181,1280) 99u）；闭包 98 段 13,825u 中 88 段 7,556u 为已搬 lodash 比较栈 → import，lodash 内部计划仅 +1 导出 M（153 段 11,297u 不变）',
    `实测（.audit/w45-56-probe.ts、.audit/w45-56-probe2.ts 与 test/plugin-chain-local-store.test.ts + .audit/w45-24-compiled.mjs）：一宿主一 store、新 store 字段默认值、XMt/Et 语义（含缺 unfiltered 抛 TypeError）、Gr 键序、判决阶梯、folder 判决三分支、epoch 守卫、retain 闭包身份、pin 写一次与它门控的走查/listing；8/8 通过`],
  ['2026-10-17T05:23:00Z', 'finding', 'W45-56 实测纠偏：阈值在走查检查之后才读、primedFolderListing 只被 pin 门控',
    '首版断言 ① "负阈值必然 raced"（实测 policyInstallVerdict 先 \`if(this.policyWalks===0)return"install"\`，未走查时负阈值仍 install）、② \`primedFolderListing\` 需先走查才可读（实测 \`return j()?this.folderListings.get(e):void 0\`，只被 pin 门控）',
    '两处断言按实测改写：阈值断言移到已走查的 pinned 段，listing 断言改为"pin 关→undefined、pin 开→答最新 seed 的 listing"',
    '回归 8/8 通过；证据 measured 两条记录该行为'],
  ['2026-10-17T05:25:00Z', 'boundary', 'W45-56 退掉一个旧边界：LocalStoreHandle 替身 → ji() 答真实 store',
    'W45-54 只读到 localStoreProbes 一个字段，故留了 LocalStoreHandle 这一替身与 bindLocalStore 测试缝；本包把 store 搬齐后，ji() 直接答 Ixr.of(host)（默认一个模块级宿主键 = 进程一份 store，bindLocalStoreHost 绑定真实宿主对象，等价于源里 B().host）',
    'settings 源层的再导出行改为 bindLocalStore/bindLocalStoreHost/localStore/type LocalStoreHandle，bindLocalStore 保留为测试缝；plugin-chain-settings-source.test.ts 8/8 不需修改即通过',
    'npm run check 干净；settings 源层 8/8；新 store 回归 8/8'],
  ['2026-10-17T05:28:00Z', 'verification', `W45-56 验收：五副本 unresolved 0、span total 0、账本 13 段逐段回源 + acorn 完整性 + 5 条顺序断言 + 23 处正文逐字、${chain}、回归 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    'settings 子系统"读—合并—落库"三块里"落库"闭环，下一包转 y9e 的读路径',
    `check/build/notices；五副本 unresolved 0；span 扫描 total 0；${chain}；账本 13 段逐段回源比长度与内容 + acorn 断言（完整顶层语句、无重叠、无重复）+ 顺序断言（t→j→nHs、q→Ixr、oe/re→F8e）；Nr/Vn/q/oe/re/XMt/Et/Gr 逐字、F8e 的字段与方法清单、判决阶梯原文、pin 三件套逐字、M 导出回源；seam 12 处导出 + 写一次 pin 与实测 TypeError 的注释；回归 8/8；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45LocalStoreCompiled.v1，共享 ${sharedMarkers.length} 标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-56 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-56 acceptance (2026-10-16)

- [x] **The dependency chain picked the package.** W45-55's record named the local store's remaining fields; the merge layer folds into \`e.store.pluginBase\` and \`Qnn\` reads through \`ji()\`, so the store was the unit that could come across whole.
- [x] **The whole closure came across.** 13 whole top-level statements, 6,401 units; the 88 statements the closure shares with an existing copy are imported, not copied twice; chain verifier (${chain}) and \`unresolved 0\` on all five touched copies.
- [x] **Obtainable source was copied, not bound.** The store, its instance cache, the walk cache, the repository tier and the diff helpers came across as text; the read path behind them (\`y9e\`/\`Qnn\`/\`bTr\`) stays named as unported.
- [x] **A retired boundary is recorded as one.** \`LocalStoreHandle\` was a stand-in for a single field; \`ji()\` now answers the real store and the settings-source seam re-exports follow, with that package's suite re-run unchanged.
- [x] **Everything measured before it was asserted.** The verdict ladder and where the threshold is read, the pin gating the walk counter and the listing read, the stale-epoch no-ops, the retain-closure identity, \`Et\`'s own \`TypeError\`, \`enabledSources\` never initialized, and the write-once pin — with two first-draft assertions corrected by the probes.
- [x] **Sweep.** check/build/notices, five copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, the store ledger with acorn, order and body checks, new suite ${seamSweep.passed}/${seamSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
