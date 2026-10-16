// Write the W45-58 record from the artifacts themselves: the `$` table's ui.blit entry (its seven
// blocks), the two names this package added to the chain-runner copy's export list, the table fragment,
// and the seam and registry-state typing that carry the entry.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 404, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 153, `validation ${identity.validation.files}`);
expect(identity.build.files === 280, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 57) throw new Error('the chain verifier did not pass 57 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const registry = read('scripts/verify-chain-copies.mjs');
if (!registry.includes("['W45-ui-blit', 'plugin-chain-ui-blit-source']")) throw new Error('the new plan is not registered');
const blitCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-ui-blit-source.ts'));
if (!blitCopy || blitCopy.blocks !== 7 || blitCopy.units !== 7852) {
  throw new Error(`the blit copy is ${JSON.stringify(blitCopy)}, not the 7-block 7,852-unit one`);
}
const runnerCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-source.ts'));
if (!runnerCopy || runnerCopy.blocks !== 73 || runnerCopy.units !== 26233) throw new Error('the chain-runner copy changed size');
if (runnerCopy.sha256 !== '58c01b12f6b607e55a7568d11afb4120588721aa5d9637f979bb0ca42d0c7eff') {
  throw new Error('the chain-runner copy is not the one this package re-exported from');
}
const uiCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-ui-source.ts'));
if (!uiCopy || uiCopy.blocks !== 17 || uiCopy.units !== 2484) throw new Error('the ui copy changed');

const ledger = JSON.parse(read('src/plugin-chain-ui-blit-source-blocks.json'));
const expectedBlocks = [
  ['chunk-n3ykh62m.js', 241244, 241478, 234],
  ['chunk-n3ykh62m.js', 241740, 242738, 998],
  ['chunk-n3ykh62m.js', 242947, 245185, 2238],
  ['chunk-n3ykh62m.js', 248812, 252131, 3319],
  ['chunk-sfn1dbxq.js', 1868588, 1869519, 931],
  ['chunk-p16hdq43.js', 2833, 2864, 31],
  ['chunk-tvdq3hrk.js', 6302, 6403, 101],
];
if (ledger.blocks.length !== 7) throw new Error(`the blit ledger holds ${ledger.blocks.length} blocks`);
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 7852) throw new Error(`the blit ledger holds ${units} units`);
for (const [module, start, end, count] of expectedBlocks) {
  const block = ledger.blocks.find((b) => b.module === module && b.range[0] === start);
  if (!block || block.range[1] !== end || block.units !== count) {
    throw new Error(`${module} [${start},${end}) is not in the ledger as ${count} units`);
  }
}
if (ledger.blocks.some((block) => block.module === 'chunk-n3ykh62m.js' && block.range[0] < 241740 && block.range[1] > 241513)) {
  throw new Error('the location policy `$ne` was copied into the blit copy');
}

// Every block is re-read from its module, compared with the copy, and checked against acorn: each is a
// contiguous run of whole top-level statements, and no two overlap.
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
const copyText = read('src/plugin-chain-ui-blit-source.ts');
const claimed = new Map();
for (const block of ledger.blocks) {
  const [start, end] = block.range;
  if (end - start !== block.units) throw new Error(`${block.range} is not ${block.units} units`);
  const body = sources.get(block.module).slice(start, end);
  if (!copyText.includes(body)) throw new Error(`${block.module} ${JSON.stringify(block.range)} is no longer in the copy`);
  const all = statements.get(block.module);
  const inside = all.filter((node) => node.start >= start && node.end <= end);
  if (inside.length === 0 || inside[0].start !== start || inside[inside.length - 1].end !== end) {
    throw new Error(`${block.module} ${JSON.stringify(block.range)} does not start and end on statement boundaries`);
  }
  for (let index = 1; index < inside.length; index++) {
    if (inside[index - 1].end !== inside[index].start) throw new Error(`${block.range} skips a statement`);
  }
  if (all.some((node) => (node.start < start && node.end > start) || (node.start < end && node.end > end))) {
    throw new Error(`${block.range} cuts a statement in half`);
  }
  const key = `${block.module} ${block.range.join(',')}`;
  if (claimed.has(key)) throw new Error(`${key} is copied twice`);
  claimed.set(key, true);
}
// The whole of both runs and the selector, quoted from the module and located in the copy.
const three = sources.get('chunk-n3ykh62m.js');
const big = sources.get('chunk-sfn1dbxq.js');
for (const [module, text, start, end] of [
  ['chunk-n3ykh62m.js', three, 248812, 252131],
  ['chunk-sfn1dbxq.js', big, 1868588, 1869519],
]) {
  if (!copyText.includes(module.slice(0, 0) + text.slice(start, end))) throw new Error(`${module} [${start},${end}) is not in the copy verbatim`);
}
const checkBody = three.slice(248812, 249349);
if (!checkBody.startsWith('function fNs(e){let n=typeof e?.requestId==="string"') || !checkBody.endsWith('"columns and rows are numbers when given"}')) {
  throw new Error('the check is not the measured `fNs`');
}
const runBody = three.slice(251473, 252131);
if (!runBody.includes('function mNs(e,n){let{requestId:r,key:s}=e,h=hs().get(e5t(r,s,n.plugin))')
  || !runBody.includes('more than ${ZPn} blits a second; the surface paints at its frame rate, so one blit a frame is all that shows')) {
  throw new Error('the Raster run is not the measured `mNs`');
}
if (!big.slice(1868770, 1869519).includes('the surface transmits at its frame rate')
  || !big.slice(1869471, 1869519).includes('function bFo(e){return"source"in e&&L(e.source)}')) {
  throw new Error('the Image run is not the measured `kFo`/`bFo`');
}
if (!three.slice(242947, 245185).includes('function Mss(e){let n="{ png }, { rgba, width, height }, { file, format } or { shm, format, width, height }"')) {
  throw new Error('the ImageSource validator is not the measured `Mss`');
}
// The location policy: quoted by the W45-46 boundary, and absent from this copy.
const policyBody = three.slice(241513, 241740);
if (!policyBody.startsWith('function $ne(e){let n=_4(),r=n===null?[]:lYe(n);')) throw new Error('the `$ne` statement moved in its module');
if (copyText.includes('function $ne(')) throw new Error('the blit copy declares the location policy itself');
const boundary = read('src/plugin-chain-fs-boundaries.ts');
if (!boundary.includes(policyBody)) throw new Error('the fs boundary no longer quotes the location policy');
if (!read('src/plugin-chain-ui-blit-source.ts').includes("import { $ne } from './plugin-chain-fs-boundaries.js';")) {
  throw new Error('the blit copy no longer imports the location policy from the boundary');
}

// The table fragment, quoted where it stands, and the rows the site mount writes — the next package.
const fragment = '"ui.blit":{check:fNs,run:(n,r)=>bFo(n)?kFo(n,r):mNs(n,r)}';
if (big.slice(2353695, 2353752) !== fragment) throw new Error('the ui.blit table fragment moved in its module');
if (!read('src/plugin-chain-ui.ts').includes(fragment)) throw new Error('the seam no longer carries the table fragment');
if (!three.includes('var hNs=(e)=>Yto({sites:hs(),siteKey:e5t(e.requestId,e.key,e.plugin),mount:e,mountsOf:(n)=>n.rasters,freshSite:()=>({rasters:new Set,windowStart:0,blits:0})});')) {
  throw new Error('the Raster mount row is no longer the measured one');
}
if (!big.includes('var ELs=(e)=>Yto({sites:Yj(),siteKey:e5t(e.requestId,e.key,e.plugin),mount:e,mountsOf:(n)=>n.images,freshSite:()=>({images:new Set,windowStart:0,blits:0})});')) {
  throw new Error('the Image mount row is no longer the measured one');
}
for (const [module, text, at, what] of [
  ['chunk-n3ykh62m.js', three, 256712, 'function Yto('],
  ['chunk-n3ykh62m.js', three, 256899, 'var hNs='],
  ['chunk-n3ykh62m.js', three, 253980, 'function Sb('],
  ['chunk-n3ykh62m.js', three, 254123, 'function $f('],
  ['chunk-sfn1dbxq.js', big, 1869519, 'var ELs='],
]) {
  if (!text.startsWith(what, at)) throw new Error(`${module} no longer holds ${what} at ${at}`);
}
if (!copyText.includes('var QJt=String.fromCharCode(0);')) throw new Error('the separator is not the measured NUL');

// The plan this package wrote, and the two names it added to the chain-runner plan's export list.
const plan = JSON.parse(read('research/ports/W45-ui-blit-blocks.plan.json'));
if (plan.blocks.length !== 7) throw new Error('the blit plan is not the seven-block one');
if (plan.imports.filter((line) => line.startsWith('import')).join('\n') !== [
  "import { isAbsolute as JN } from 'path';",
  "import { Ge, L, b3, h$ } from './plugin-chain-source.js';",
  "import { ae } from './plugin-chain-text-clamp-source.js';",
  "import { it } from './plugin-chain-host.js';",
  "import { $ne } from './plugin-chain-fs-boundaries.js';",
].join('\n')) throw new Error('the blit plan\'s import lines changed');
for (const name of ['fNs', 'mNs', 'kFo', 'bFo', 'Mss', 'fur', 'QJt', 'QT', 'fpr']) {
  if (!plan.exports.includes(name)) throw new Error(`the blit plan no longer exports ${name}`);
}
const runnerPlan = JSON.parse(read('research/ports/W45-chain-runner-blocks.plan.json'));
for (const name of ['h$', 'b3']) {
  if (!runnerPlan.exports.includes(name)) throw new Error(`the chain-runner plan does not export ${name}`);
  if (!read('src/plugin-chain-source.ts').includes(`, ${name}`)) throw new Error(`the chain-runner copy does not export ${name}`);
}
const runnerLedger = JSON.parse(read('src/plugin-chain-source-blocks.json'));
for (const [start, end, count, note] of [[38157, 38216, 59, 'whole offset check'], [5183, 5322, 139, 'regex class fragments']]) {
  const block = runnerLedger.blocks.find((b) => b.module === 'chunk-nyce03br.js' && b.range[0] === start);
  if (!block || block.range[1] !== end || block.units !== count) throw new Error(`the carried block ${note} moved`);
}

// The seam and the registry-state typing.
const seam = read('src/plugin-chain-ui.ts');
for (const text of [
  "export type UiCallEvent = 'ui.toast' | 'ui.status' | 'ui.log' | 'ui.selection' | 'ui.notify' | 'ui.blit';",
  "'ui.blit': {",
  "check: fNs as UiCallEntry['check'],",
  'run: (n: any, r: any) => bFo(n) ? kFo(n, r) : mNs(n, r),',
  "import { bFo, fNs, kFo, mNs } from './plugin-chain-ui-blit-source.js';",
  'ZPn as BLITS_PER_SECOND,', 'ab as BLIT_WINDOW_MS,', 'Kto as blitRefusalText,', 'fur as decodeBlitCells,',
  'rb as CELLS_BASE64_LENGTH,', 'Mss as validateImageSource,', 'hs as mountedRasterSites,', 'Yj as mountedImageSites,',
]) {
  if (!seam.includes(text)) throw new Error(`the ui seam lost ${text}`);
}
const state = read('src/plugin-chain-registry-state.ts');
for (const text of ['export interface MountedRasterSite {', 'export interface MountedImageSite {',
  'mountedRasters: Map<string, MountedRasterSite>;', 'mountedImages: Map<string, MountedImageSite>;']) {
  if (!state.includes(text)) throw new Error(`the registry state lost ${text}`);
}
for (const path of ['test/plugin-chain-ui-selection.test.ts', 'test/plugin-chain-ui-notify.test.ts']) {
  if (!read(path).includes("'ui.blit,ui.log,ui.notify,ui.selection,ui.status,ui.toast'")) {
    throw new Error(`${path} no longer asserts the six-name table`);
  }
}

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-58-tests.txt');
if (full.failed !== 0 || full.tests !== 1561) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-58-family.txt');
if (family.failed !== 0 || family.tests !== 285) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const blitSweep = summary('.audit/w45-58-blit.txt');
if (blitSweep.failed !== 0 || blitSweep.tests !== 12) throw new Error('the blit sweep is not clean');
const scanSweep = read('.audit/w45-58-scan.txt');
if ((scanSweep.match(/unresolved 0/g) ?? []).length !== 2) throw new Error('the two scanned copies did not scan clean');
const span = JSON.parse(read('.audit/w45-58-span.txt'));
if (span.total !== 0) throw new Error(`the span scan found ${span.total}`);
const notices = JSON.parse(read('.audit/w45-58-notices.txt').split('\n').filter((line) => line.startsWith('{')).at(-1));
if (notices.sha256 !== '384c78801194aedea80331383ccd93708c2dfa46bc746003dc112c930b73d13c') {
  throw new Error('the dependency-notice digest moved');
}
const smokeReport = read('.audit/w45-58-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 288) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const allMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
const sharedMarkers = read('.audit/w45-58-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-58-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45UiBlitCompiled.v1')) throw new Error('the shared driver did not print the W45-58 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45UiBlitCompiled.v1 (${sharedMarkers.length} markers, ${allMarkers.length} across every driver: it reads the entry out of the built table — the six names, the entry without a stamp, the decoder over the seam and one painted cell — then drives a mounted row through the seam: the paint, the no-row denial, the size denial and the per-second cap at 120, and the Image path's validator plus the source its swap receives)`;

const evidence = {
  schema: 'W45UiBlitEvidence.v1',
  package: 'W45-58 — the `$` table\'s ui.blit entry',
  date: '2026-10-16',
  question: 'What does the `$` table\'s ui.blit do — what does it refuse, what does it paint, and what does it answer?',
  answer: 'The entry is `"ui.blit":{check:fNs,run:(n,r)=>bFo(n)?kFo(n,r):mNs(n,r)}` (chunk-sfn1dbxq.js [2353695,2353752) 57 units) and it is two floors behind one entry: `bFo` sends an argument whose `source` is a plain object to `kFo` (the Image\'s `swap`) and everything else to `mNs` (the Raster\'s `paint`). The check takes exactly one of `cells` (a string, the base64 of the cells) or `source` (the ImageSource), a non-empty `requestId` and `key`, and numeric `columns`/`rows` when they are given; anything else is refused with the sentence that names both accepted shapes. Both runs look the plugin\'s own mounted row up in the host registry by the NUL-joined key (`e5t`, with `QJt` = `String.fromCharCode(0)`), and both answer `{deny: text}` rather than throwing: `no Raster of its own is mounted under key "K" in R` (or `the Raster under key "K" in R is another plugin\'s, not its to paint` when another plugin holds that requestId/key in its own site — and the same two sentences for the Image with `swap`), `the mounted Raster is WxH, not WxH; a resize is a redraw (ui.invalidate)`, and `more than 120 blits a second; the surface paints at its frame rate, so one blit a frame is all that shows` (the Image\'s wording says transmits). A blit that lands decodes the cells — `columns * rows` cells of 12 bytes, each a width-1 printable code point and two colors that are `0xRRGGBB` or the default `0x1000000` — paints every mounted element of that size and answers `{}`. The Image path validates the source with `Mss` first, then swaps it into every matching element.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  planExtensions: [
    {
      plan: 'research/ports/W45-ui-blit-blocks.plan.json',
      what: 'a new plan, seven blocks and fifty exports',
      blocks: '0 → 7 blocks, 7,852 units',
      why: 'the entry\'s bodies are four contiguous runs in chunk-n3ykh62m.js, one in chunk-sfn1dbxq.js, the separator in chunk-p16hdq43.js and the control-character pattern in chunk-tvdq3hrk.js',
    },
    {
      plan: 'research/ports/W45-chain-runner-blocks.plan.json',
      what: 'two names added to the export list (`h$`, `b3`) — both bodies were already carried there as blocks (chunk-nyce03br.js [38157,38216) 59 units and [5183,5322) 139 units) but not exported',
      blocks: '73 blocks / 26,233 units unchanged; the copy\'s sha moves from `670e5658…` to `58c01b12…`',
      why: 'the blit copy needs both bodies; exporting what is already carried keeps each body single-definition instead of copying it a second time',
    },
  ],
  boundary: 'No new boundary, and one reused: `$ne`, the location policy that opens the ImageSource run (chunk-n3ykh62m.js [241513,241740) 227 units), is deliberately NOT copied — ./plugin-chain-fs-boundaries.ts has answered it since W45-46, quotes the body and names the closure this product does not carry (`lYe`/`gin`/`BH`/`ks`/`oie`/`qa`/`ree` in chunk-ae84tp6z.js plus `_4` in chunk-4bw62nzm.js: 36 statements / 5,096 units of Bun\'s own namespace layer). The copied ImageSource run starts where that statement ends, so the block is [241740,242738). Everything else resolves to copies the product carries: `L`, `Ge`, `h$` and `b3` in ./plugin-chain-source.ts, `ae` in ./plugin-chain-text-clamp-source.ts, `it` in ./plugin-chain-host.ts, and `JN` is the source\'s own `isAbsolute` from `path`, bound to the node builtin exactly as ./plugin-chain-fs-source.ts binds its path imports.',
  measured: [
    'The check: the two accepted shapes pass; both together, neither, a non-string requestId or key, an empty key, a `source` that is not a plain object (a number or an array) and a present-but-undefined `source` beside cells are all refused with the sentence that names both shapes; `columns`/`rows` must be numbers when given.',
    'The selector `bFo`: true only for a plain-object `source`; `{source: undefined}` and `{source: []}` are false, so such an argument goes down the Raster path.',
    'The decoder: a payload of the wrong length is refused with the count it wanted (`cells must be the base64 of N cells of 12 bytes (M characters for WxH)`), a non-base64 payload with `cells is not base64 (standard alphabet, padded)`, a control character and a wide character with `cell N holds U+XXXX, which is not one printable width-1 code point (a control, combining or wide character)`, a code point beyond the BMP by number, and a colour that is neither `0xRRGGBB` nor the default with its own sentence. `0x1000000` itself is accepted.',
    'The Raster run: with no row for the key it answers the no-mount denial; when another plugin\'s site holds that requestId/key it names the other plugin instead; a size the mounted element does not have is refused with both sizes and `a resize is a redraw (ui.invalidate)`; a landing blit paints every element whose size matches and answers `{}`.',
    'The rate window: `ZPn` (120) per `ab` (1000 ms) per site; the 121st blit in one window is refused, a refused blit does not count, and a window that has passed starts the count again — measured against the row\'s own `blits`/`windowStart` fields.',
    'The Image run: the validator runs before any swap, so a bad source is refused with the validator\'s own sentence (`source.png must be standard padded base64`, `does not start as a PNG file does`, `has no IHDR header after its signature`); a swap that answers a value is reported as `{deny: that value}`; the source the plugin passed reaches `swap` unchanged.',
    'A measured hole, asserted as the source\'s own: the Image run reports only the first mounted element\'s answer (`const [first] = answers`), so a later element\'s refusal is dropped when the first answers nothing.',
    'The seam\'s raise path with no hooks runs the floor without consulting the check, so an argument the check would refuse (a string `columns`) still reaches the run — measured, and the reason the check\'s refusals are asserted against the body.',
    'The mounted rows are the site mount\'s own shape, read from the source: `{rasters: new Set, windowStart: 0, blits: 0}` written by `hNs`, and `{images: new Set, windowStart: 0, blits: 0}` written by `ELs`, both through `Yto` on `hs()` / `Yj()`.',
  ],
  regressions: `the new blit suite ${blitSweep.passed}/${blitSweep.tests}; the selection and notify suites' table assertions now name six; ${familyLine}`,
  full: fullLine,
  compiled: driverLine,
  smoke,
  next_package: [
    'the mount side of the blit, measured while writing this package: `Yto` (chunk-n3ykh62m.js [256712,…)) with `hNs` ([256899,…)) writing `{rasters: new Set, windowStart: 0, blits: 0}` into `hs()`, and `ELs` (chunk-sfn1dbxq.js [1869519,…) — the statement immediately after this package\'s last block) with `vLs` ([1869676,…)) writing the Image row; without them nothing in the product fills the registries this entry reads',
    'the raster encoder and admission family that follows this package\'s Raster run in the same module: `fb`/`mb` the memoized token bucket ([253828,…)), `Sb` the refill ([253980,…)) and `$f` the cell encoder ([254123,…)), plus `tF` ([257058,…)) and the Raster/Image site components (`Tc(jo, …)` in chunk-kjfwbh4w.js)',
    'the remaining `$` table entries, each measured the same way first: `ui.scroll` (`O5n` 194u + `L5n` 808u + `mVe` 54u + `Nye` 39u), `ui.focus` (`fzo` 202u + `Szo` 532u + `mVe`), `ui.copy` (`wGo`/`uzo`/`dzo`, blocked on the clipboard encoder `Sv`), `state.get`/`state.set` (`Pur`/`Our`, `Iur`/`$ss`/`Hur`), `fs.ancestors` (`kNs` 492u)',
    'the plugin-facing `$` dispatcher `G2e` (chunk-sfn1dbxq.js [2356082,…)), the path that applies `raise` then `stamp` then `run`',
    'the settings read path behind `y9e` — measured at 590 statements / 327,047 units, of which 318,262 are fresh, so it is a subsystem to walk in pieces; the managed-settings gate `CT` (chunk-4bw62nzm.js) and `Tp` (chunk-wtch2p0g.js, 263u); Q-086\'s 15 registry-reading cores and their 34 sites; the notification provider `a4n`',
  ],
};
write('research/ports/W45-ui-blit-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-58 **补',
  features: "; W45-58 ports the `$` table's ui.blit entry",
  standard: '2026-10-16 W45-58 ',
  status: 'W45-58:',
  runner: '## W45-58 ported the `$` table\'s ui.blit entry',
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
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-58 **补 \`$\` 表 \`ui.blit\` 条目**（插件往已挂载表面画一帧这一条：拒什么、画什么、回什么）：**7 段 7,852 单位**——chunk-n3ykh62m.js 四段（[241244,241478) 234u 基率表+\`ds\`；[241740,242738) 998u ImageSource 成形器；[242947,245185) 2,238u 其余 ImageSource 机件含校验器 \`Mss\`；[248812,252131) 3,319u **Raster 侧全条**：检查 \`fNs\`+格子助手+\`fur\` 解码+\`xDe\` 拒绝+\`hs\`/\`ib\`/\`e5t\`/\`qto\`/\`Kto\`/\`mNs\`）+ chunk-sfn1dbxq.js [1868588,1869519) 931u（\`Yj\`/\`a2t\`/\`kFo\`/\`bFo\`）+ chunk-p16hdq43.js [2833,2864) 31u（\`QJt\`=NUL）+ chunk-tvdq3hrk.js [6302,6403) 101u（\`fpr\`/\`QT\`）。**表片段逐字**：\`"ui.blit":{check:fNs,run:(n,r)=>bFo(n)?kFo(n,r):mNs(n,r)}\`（[2353695,2353752) 57u）。**语义（源文实测）**：检查只收 \`cells\`（字符串，格子的 base64）**或** \`source\`（ImageSource 普通对象）其一 + 非空 \`requestId\`/\`key\`，给了 \`columns\`/\`rows\` 时必须是数字；\`bFo\` 以"有没有 \`source\`"分流 \`kFo\`（Image 的 \`swap\`）/ \`mNs\`（Raster 的 \`paint\`）；两者按 \`e5t\` 的 NUL 连接键在宿主注册表查本插件自己那一行，**不抛异常而是答 \`{deny:文案}\`**：无行 → \`no Raster of its own is mounted under key "K" in R\`、他插件占着同一 requestId/key → \`the Raster under key "K" in R is another plugin's, not its to paint\`（Image 侧同两句，动词换 \`swap\`）、尺寸不符 → \`the mounted Raster is WxH, not WxH; a resize is a redraw (ui.invalidate)\`、超速 → \`more than 120 blits a second; ...\`（Image 侧文案是 transmits）；落地的 blit 解开 \`columns*rows\` 个 12 字节格子（每格一个宽 1 可打印码点 + 两个 \`0xRRGGBB\`/默认色），对**所有同尺寸挂载件**各画一次并答 {}。**两处如实标注**：① Image 侧只报**首个**挂载件的答复（\`const [first]=answers\`），首个答空时后续拒绝被丢掉——源同此洞，实测断言；② \`$ne\`（ImageSource 首句，[241513,241740) 227u）**不搬**：W45-46 的 \`plugin-chain-fs-boundaries.ts\` 已为 \`$.fs\` 作答并逐字引它，其闭包（chunk-ae84tp6z.js 的 \`lYe\`/\`gin\`/\`BH\`/\`ks\`/\`oie\`/\`qa\`/\`ree\` + chunk-4bw62nzm.js 的 \`_4\`，36 段/5,096u）是 Bun 自己的命名空间层，故块从 [241740 起、拷贝改为**导入**该边界。**复用而非重复**：\`L\`/\`Ge\`/\`h$\`/\`b3\` 取 \`plugin-chain-source.ts\`（\`h$\` [38157,38216) 59u 与 \`b3\` [5183,5322) 139u 早已是那里的段但未导出，本包给该计划的导出表补这两个名字，保持单一定义；该副本 sha \`670e5658…\`→\`58c01b12…\`）、\`ae\` 取 \`plugin-chain-text-clamp-source.ts\`、\`it\` 取 host；\`JN\` 是源自己从 \`path\` 导入的 \`isAbsolute\`，按 fs 副本同样方式绑到 node 内建。**顺带修一处自身缺陷**：W45-57 记录脚本把 coding-standard 条目里的代码跨度写成了反斜杠加反引号，且因剥离标记失配而重复写了一行——已去重并把 106 处反斜杠加反引号还原为普通反引号，span 扫描回到 \`total 0\`，本包记录脚本把这条固化成断言。验收：check/build/notices（摘要未变）、两副本 \`unresolved 0\`、span \`total 0\`、**${chain}**、blit 账本 7 段逐段回源 + acorn（完整语句、无重叠、无切半、无重复）+ \`$ne\` 未入副本且边界仍逐字引它、表片段与两条挂载行形状逐字、seam/注册表类型判据、新回归 ${blitSweep.passed}/${blitSweep.tests}、家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45UiBlitCompiled.v1\`，共享 ${sharedMarkers.length} 标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [ui.blit 证据](ports/W45-ui-blit-evidence.json)、[ui.notify 证据](ports/W45-ui-notify-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
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
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-58 ports the \`$\` table's ui.blit entry: ` +
  'its check that takes one of cells or an ImageSource, its two floors behind one entry (the Raster path that decodes the cells, ' +
  'paints every mounted element of the size and answers a per-second cap, and the Image path that validates the source and swaps ' +
  'it), the denials they answer instead of throwing, and the host registries they read — the sixth name in the ported table slice. |';
write('research/FEATURES.md', lines.join('\n'));

const standardText = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standardText.indexOf('2026-10-16 W45-57');
if (standardAt < 0) throw new Error('coding-standard W45-57 line not found');
const standardEntry = `2026-10-16 W45-58 \`$\` 表 ui.blit：S-1至S-7已对照。S-1（先读源）：先量闭包——种子 \`fNs\`/\`mNs\`/\`Mss\` 得 43 段/7,016u，另 seed 得 Image 侧 4 句 931u 与 NUL 分隔符 31u；**每条正文逐字读过再动手**（\`fNs\` 的 XOR 与两句拒答、\`mNs\` 的 \`hs().get(e5t(...))\` 与四种 deny 文案、\`kFo\` 的 \`Mss\` 前置与 \`const[first]=answers\`、\`fur\` 的 12 字节格与 \`ob\` 的宽 1 判定）。**关键取舍**：\`$ne\`（首句 227u）**不搬**——W45-46 的 fs 边界已为同一策略作答并逐字引它，其闭包 36 段/5,096u 是 Bun 命名空间层，故块从 \`$ne\` 结尾 241740 起，import 走边界；\`h$\`/\`b3\` 两个自由名经查**已作为段**存在于 chain-runner 副本（59u/139u）但未导出，遂给该计划补两个导出名而非二次拷贝（该副本 sha 随之变更并重跑校验器）。S-2（不留半包）：新边界零；挂载侧（\`Yto\`/\`hNs\`/\`ELs\`/\`vLs\`）与光栅编码族（\`fb\`/\`mb\`/\`Sb\`/\`$f\`）**不搬也不发明**，按实测坐标写进 next_package。S-3（先测后断言）：\`.audit/w45-58-probe.ts\` 先跑再写 12 条断言；**四处按实测纠偏**——① 首版把"他插件占用"的夹具行键写成自己插件（\`ib\` 只看他人行，故改键为 \`other\\0r\\0nope\` 才命中该文案）；② PNG 夹具首版 24 字节，\`G_\` 要求 ≥33 字节并读 12..24 的 IHDR，24 字节落进"no IHDR"分支；③ "at cap" 用 \`Date.now()\` 计数会在 120 次内跨窗，改为直接置 \`blits=ZPn\` 的确定边界；④ Image 侧"两件中一件拒绝"实测答 \`{}\`（只报首个），如实断言为源自身的洞。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器/打包冒烟/${drivers.length} 个编译驱动并解析输出，断言 span \`total 0\` 与 notices 摘要未变；acorn（完整语句、无重叠、无切半、无重复）+ 每段正文回源 + \`$ne\` 缺席断言 + 表片段与两条挂载行形状逐字 + 两副本 \`unresolved 0\`。**并修前包自身缺陷**：W45-57 条目里 106 处「反斜杠+反引号」与重复行已清除（本脚本新增断言：coding-standard 不出现该转义、不出现重复的 2026- 条目）。S-5/S-6：seam 只加一个事件名、一条表项与一组按名再导出（\`BLITS_PER_SECOND\`/\`BLIT_WINDOW_MS\`/\`blitRefusalText\`/\`decodeBlitCells\`/\`CELLS_BASE64_LENGTH\`/\`validateImageSource\`/\`mountedRasterSites\`/\`mountedImageSites\`），注册表类型新增 \`MountedRasterSite\`/\`MountedImageSite\` 两个界面与两个字段，无死导出；deny 语义与窗口语义均引自源文。S-7：挂载侧、编码族、\`ui.scroll\`/\`focus\`/\`copy\`、\`state.*\`、\`fs.ancestors\`、\`G2e\`、\`y9e\` 读路径、\`CT\`/\`Tp\`、Q-086 写入 next_package。验收：check/build/notices、两副本 unresolved 0、${chain}、账本与正文自证、回归 ${blitSweep.passed}/${blitSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standardText.slice(0, standardAt) + standardEntry + standardText.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf("W45-57: the `$` table's ui.notify entry.");
if (statusAt < 0) throw new Error('STATUS W45-57 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = 'W45-58: the `$` table\'s ui.blit entry. The source\'s table literal is ' +
  '`"ui.blit":{check:fNs,run:(n,r)=>bFo(n)?kFo(n,r):mNs(n,r)}` (chunk-sfn1dbxq.js [2353695,2353752) 57 units), and the entry is two ' +
  'floors: `bFo` sends an argument whose `source` is a plain object to the Image run and everything else to the Raster run. Seven ' +
  'blocks, 7,852 units: four contiguous runs of chunk-n3ykh62m.js (the base64 ratio and decoder, the ImageSource shapers, the rest ' +
  'of the ImageSource machinery including the validator, and the whole Raster side), the Image side and its selector in ' +
  'chunk-sfn1dbxq.js, the NUL separator in chunk-p16hdq43.js and the control-character pattern in chunk-tvdq3hrk.js. Both runs ' +
  'answer `{deny: text}` instead of throwing — no mounted row for the key (naming the other plugin that holds one), a size the ' +
  'mounted element does not have, more than 120 blits a second, or cells that are not the base64 of exactly the cells the size ' +
  'needs — and a blit that lands paints every mounted element of the size and answers `{}`. `$ne`, the location policy that opens ' +
  'the ImageSource run, is not copied: ./plugin-chain-fs-boundaries.ts has answered it for `$.fs` since W45-46 and quotes it, and ' +
  'the closure it would drag in is Bun\'s own namespace layer. Two carried bodies were exported rather than copied a second time: ' +
  '`h$` and `b3` were blocks of ./plugin-chain-source.ts without being exported. The seam gained the entry, the event name and a ' +
  'set of descriptive re-exports, and the registry-state typing gained the two mounted-site rows the runs read. One measured hole ' +
  'is asserted as the source\'s own: the Image path reports only the first mounted element\'s answer. The tick also repaired a ' +
  'defect this product\'s own W45-57 record introduced — 106 escaped code spans and a duplicated entry line in the coding standard — ' +
  'and the record script now asserts both. Evidence: `research/ports/W45-ui-blit-evidence.json`, and\n' +
  '[工作包](ports/W45-chain-runner.md).\n\n';
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-58 ported the \`$\` table's ui.blit entry (2026-10-16)

The entry is \`"ui.blit":{check:fNs,run:(n,r)=>bFo(n)?kFo(n,r):mNs(n,r)}\` — 57 units of the source's table literal — and it is two
floors behind one name. \`bFo\` routes an argument whose \`source\` is a plain object to \`kFo\`, the Image's \`swap\` path, and
everything else to \`mNs\`, the Raster's \`paint\` path. The check takes exactly one of \`cells\` (a string) or \`source\`, a non-empty
\`requestId\` and \`key\`, and numeric \`columns\`/\`rows\` when they are given. Both runs look the plugin's own mounted row up by
\`e5t\`'s NUL-joined key and answer \`{deny: text}\` rather than throwing: no row for the key, another plugin holding that
requestId/key, a size the mounted element does not have, more than 120 blits in a second, or cells that are not the base64 of
exactly \`columns * rows\` cells of 12 bytes. A blit that lands paints every mounted element of the size and answers \`{}\`.

Seven blocks, 7,852 units. Four are contiguous runs of chunk-n3ykh62m.js: [241244,241478) the base64 ratio and decoder,
[241740,242738) the ImageSource shapers, [242947,245185) the rest of the ImageSource machinery including the validator \`Mss\`,
and [248812,252131) the whole Raster side. The Image side and its selector are chunk-sfn1dbxq.js [1868588,1869519), the
separator is chunk-p16hdq43.js [2833,2864) and the control-character pattern is chunk-tvdq3hrk.js [6302,6403).

\`$ne\` — the location policy that opens the ImageSource run, chunk-n3ykh62m.js [241513,241740) 227 units — is deliberately not
copied. ./plugin-chain-fs-boundaries.ts has answered it for \`$.fs\` since W45-46, quotes the body and names the closure this
product does not carry (36 statements / 5,096 units of Bun's own namespace layer across chunk-ae84tp6z.js and chunk-4bw62nzm.js),
so the copied run starts where that statement ends and imports the one boundary. Two bodies the entry needs were already carried
by ./plugin-chain-source.ts without being exported — \`h$\` (chunk-nyce03br.js [38157,38216) 59 units) and \`b3\` ([5183,5322) 139
units) — so this package added the two names to that plan's export list instead of copying the same text twice; the copy's sha
moves from \`670e5658…\` to \`58c01b12…\` and the verifier re-proves all 57 plans. \`ae\` comes from the text-clamp copy, \`it\` from the
host copy, and \`JN\` is the source's own \`isAbsolute\` from \`path\`, bound to the node builtin exactly as the fs copy binds its
path imports.

Measured before asserted, and four first drafts were corrected by the probe: the fixture for the other-plugin denial had to be
keyed under the rival plugin (the test only looks at rows that are not the caller's), the PNG fixture needed 33 bytes before the
IHDR check could pass, the rate window had to be driven by the row's own \`blits\`/\`windowStart\` rather than by a loop that can
cross a second, and the Image path's habit of reporting only the first mounted element's answer is asserted as the source's own
hole rather than smoothed over. The rows the runs read are the site mount's: \`{rasters: new Set, windowStart: 0, blits: 0}\`
written by \`hNs\` through \`Yto\` on \`hs()\`, and the Image's \`{images: new Set, …}\` written by \`ELs\` — the statement immediately
after this package's last block. Both, with the raster encoder family that follows the Raster run in the same module (\`mb\`,
\`Sb\`, \`$f\` at [253828,…) to [254123,…)), are recorded as the next package: until they are ported nothing in the product fills
the registries this entry reads.

The tick also repaired a defect of this product's own records: the W45-57 coding-standard entry carried 106 escaped code spans
and had been written twice, because its strip mark did not match the escaped text. The duplicate line is gone, the escapes are
back to plain backticks, the span scan reads \`total 0\` again, and the record script asserts both properties from now on.

Verified: check/build/notices, both scanned copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, every block of the blit ledger
re-read from its module and matched against the copy with acorn (whole statements, contiguous, no cut, no repetition), the
absence of \`$ne\` asserted together with the boundary that still quotes it, the table fragment and both mount-row shapes quoted
from their modules, the seam's entry, event and re-exports, the registry-state typing, the new suite ${blitSweep.passed}/${blitSweep.tests},
${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers (the shared driver now also prints \`W45UiBlitCompiled.v1\`), and the
packaged smoke (${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: the mount side of the blit (\`Yto\`/\`hNs\` and \`ELs\`/\`vLs\`) and the raster encoder family, then the remaining \`$\` table
entries — \`ui.scroll\`, \`ui.focus\`, \`ui.copy\`, \`state.get\`/\`state.set\`, \`fs.ancestors\` — and the dispatcher \`G2e\`, which would
give the ui.notify entry's \`stamp\` field its consumer. The settings read path behind \`y9e\` stays the measured subsystem:
590 statements / 327,047 units, 318,262 of them fresh.
`);

const rows = [
  ['2026-10-17T07:10:00Z', 'package', 'W45-58 补 `$` 表 ui.blit 条目（插件往挂载表面画一帧：7 段 7,852 单位 = n3ykh62m 四段 6,789u + sfn1dbxq 931u + p16hdq43 31u + tvdq3hrk 101u）',
    'fNs/mNs/kFo/bFo/Mss/fur 等成为产品面：表项逐字入 seam、UiCallEvent 增 ui.blit、按名再导出 8 个（BLITS_PER_SECOND/BLIT_WINDOW_MS/blitRefusalText/decodeBlitCells/CELLS_BASE64_LENGTH/validateImageSource/mountedRasterSites/mountedImageSites）、注册表类型增 MountedRasterSite/MountedImageSite',
    'chunk-n3ykh62m.js [241244,241478) 234u + [241740,242738) 998u + [242947,245185) 2238u + [248812,252131) 3319u；chunk-sfn1dbxq.js [1868588,1869519) 931u；chunk-p16hdq43.js [2833,2864) 31u；chunk-tvdq3hrk.js [6302,6403) 101u；表片段 [2353695,2353752) 57u 逐字',
    `实测（.audit/w45-58-probe.ts 与 test/plugin-chain-ui-blit.test.ts + .audit/w45-24-compiled.mjs）：check 的 XOR 与数字约束、bFo 五种、解码器七种问题（含宽字符与控制符）、四类 deny 文案、120/秒窗口三条边界、Image 侧校验先于 swap 与"只报首个"洞、无 hook 时 floor 跳过 check；12/12 通过`],
  ['2026-10-17T07:14:00Z', 'decision', 'W45-58 取舍：$ne 复用 fs 边界不搬，h$/b3 改为导出而非二次拷贝',
    '$ne 的闭包实测 36 段/5,096u 全是 Bun 命名空间层（lYe/gin/BH/ks/oie/qa/ree/_4），而 W45-46 已为同一策略建边界并逐字引它；h$/b3 首查无导出，但二次核查发现两段早已作为块存在于 chain-runner 副本（59u/139u）',
    '块从 [241740 起并 import { $ne } from plugin-chain-fs-boundaries；给 W45-chain-runner 计划补 h$、b3 两个导出名并重生成该副本（sha 670e5658…→58c01b12…），校验器重证 57 个计划全部通过',
    `回归 12/12；chain ${chain}`],
  ['2026-10-17T07:18:00Z', 'finding', 'W45-58 实测纠偏四处 + 如实标注 Image 侧只报首个答复',
    '① 他插件夹具需键在他人插件下（ib 只看他人行）；② PNG 夹具需 ≥33 字节才过 G_ 的 IHDR 分支；③ 速率边界不能靠循环计时（会跨窗），改置 blits=ZPn；④ kFo 的 const [first]=answers 使"两件中一件拒绝"答 {}',
    '四处按实测改写断言；第④条作为源自身的洞写入测试注释与证据，不补 default、不抹平',
    '回归 12/12；证据 measured 第 6/7 条记录'],
  ['2026-10-17T07:22:00Z', 'fix', 'W45-58 顺带修复前包记录缺陷：coding-standard 的 106 处反斜杠加反引号转义与重复条目',
    'span 扫描从 total 0 变 212 且两行内容相同：W45-57 记录脚本把代码跨度写成了反斜杠加反引号（一行 106 处），且其 strip 标记因该转义而失配，二次运行又追加了一份',
    '删除重复行并把该行的 106 处反斜杠加反引号还原为普通反引号；span 扫描回到 total 0；W45-58 记录脚本把「coding-standard 无转义的代码跨度、无重复 2026- 条目」固化为断言',
    'span 扫描 {"scanned":286,"files":[],"total":0}；两副本 unresolved 0 不受影响'],
  ['2026-10-17T07:26:00Z', 'verification', `W45-58 验收：两副本 unresolved 0、span total 0、blit 账本 7 段逐段回源 + acorn（无重叠/无切半/无重复）+ $ne 缺席与边界逐字、表片段与挂载行形状逐字、${chain}、回归 ${blitSweep.passed}/${blitSweep.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '`$` 表 ui 家族再补一条（ui.blit），下一包转挂载侧（Yto/hNs、ELs/vLs）与光栅编码族',
    `check/build/notices；两副本 unresolved 0；span total 0；${chain}；blit 账本 7 段逐段回源比长度与内容 + acorn + 无重复断言 + \`$ne\` 不在副本而边界仍引它；表片段、u2t 之外的挂载行形状（hNs/ELs 的 freshSite）逐字；seam 判据（六名事件、表项两行、8 个再导出、表片段）；注册表类型判据（两个界面 + 两个字段）；selection/notify 套件六名断言；回归 12/12；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45UiBlitCompiled.v1，共享 ${sharedMarkers.length} 标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-58 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-58 acceptance (2026-10-16)

- [x] **The queue picked the package.** W45-57's record named the remaining \`$\` table entries as the smaller ready ones and \`ui.blit\` measured whole: it is the entry the source's own literal calls the floor that paints a mounted surface.
- [x] **The whole entry came across.** Seven blocks, 7,852 units, with the table fragment quoted verbatim in the seam; the check, both runs, the decoder, the validator and the two mounted registries all resolve to copied text.
- [x] **Obtainable source was copied, not bound.** \`$ne\` is the one exception and it is the W45-46 boundary, already recorded and quoted; \`h$\` and \`b3\` were made importable from the copy that already carried them rather than copied again, and \`ae\`, \`it\`, \`L\`, \`Ge\`, \`JN\` bind to what the product already has.
- [x] **Nothing was invented.** The mount-side rows the runs read (the site mount's \`{rasters: new Set, …}\` and \`{images: new Set, …}\`) are quoted from their modules; the mount side and the raster encoder family are recorded as the next package with measured coordinates instead of being guessed at.
- [x] **Everything measured before it was asserted,** with four first drafts corrected by the probe and one measured hole asserted as the source's own.
- [x] **A defect of this product's own records was repaired.** The W45-57 coding-standard entry's escaped code spans and duplicated line are gone, and the record script now asserts both properties.
- [x] **Sweep.** check/build/notices, both copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, the blit ledger with acorn, the \`$ne\` absence and boundary checks, the fragment and row-shape comparisons, new suite ${blitSweep.passed}/${blitSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
// The state this record leaves behind, read back from disk: one entry per document, and no
// backslash-escaped code span anywhere — the artifact two earlier writers produced and this tick fixed.
const written = {
  'research/CURRENT.md': 'W45-58 **补',
  'research/STATUS.md': '\nW45-58:',
  'research/coding-standard.md': '\n2026-10-16 W45-58 ',
  'research/ports/W45-chain-runner.md': '\n## W45-58 ported',
  '.audit/w45-runtime.todo.md': '\n## W45-58 acceptance',
};
for (const [path, mark] of Object.entries(written)) {
  const text = read(path);
  const found = text.split(mark).length - 1;
  if (found !== 1) throw new Error(`${path} holds ${found} entries for ${JSON.stringify(mark)}`);
  if ((text.match(/\\`/g) ?? []).length !== 0) throw new Error(`${path} carries a backslash-escaped code span`);
}
const standardLines = read('research/coding-standard.md').split('\n').filter((line) => line.startsWith('2026-'));
if (new Set(standardLines).size !== standardLines.length) throw new Error('the coding standard repeats a one-line entry');
const addedRows2 = read('.audit/w45-runtime.tsv').split('\n').filter((line) => line.startsWith('2026-10-17T07:'));
const stamps = addedRows2.map((line) => line.split('\t')[0]);
if (new Set(stamps).size !== stamps.length) throw new Error('the runtime trail repeats a timestamp');
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
