// Write the W45-61 record from the artifacts themselves: the surface engine's ten blocks, the CSI
// helper it needed (ported rather than bound), the imports it takes from the three copies already
// carried, and the seam and typing that hold it.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 413, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 156, `validation ${identity.validation.files}`);
expect(identity.build.files === 286, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 60) throw new Error('the chain verifier did not pass 60 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const registry = read('scripts/verify-chain-copies.mjs');
if (!registry.includes("['W45-raster-surface', 'plugin-chain-raster-surface-source']")) throw new Error('the new plan is not registered');
const surfaceCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-raster-surface-source.ts'));
if (!surfaceCopy || surfaceCopy.blocks !== 10 || surfaceCopy.units !== 4374) {
  throw new Error(`the surface copy is ${JSON.stringify(surfaceCopy)}, not the 10-block 4,374-unit one`);
}
if (surfaceCopy.sha256 !== '7fe053e1f07ad1ca28eedd5cb69cd7c2eb0e96510f246469f17b58897b4aeec0') {
  throw new Error('the surface copy is not the one this package measured');
}
const cellsCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-raster-cells-source.ts'));
if (!cellsCopy || cellsCopy.blocks !== 11 || cellsCopy.units !== 1209) throw new Error('the cells copy changed size');
const blitCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-ui-blit-source.ts'));
if (!blitCopy || blitCopy.blocks !== 7 || blitCopy.units !== 7852) throw new Error('the blit copy changed size');
const mountCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-raster-mount-source.ts'));
if (!mountCopy || mountCopy.blocks !== 2 || mountCopy.units !== 541) throw new Error('the mount copy changed size');
const runnerCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-source.ts'));
if (!runnerCopy || runnerCopy.blocks !== 73 || runnerCopy.units !== 26233) throw new Error('the chain-runner copy changed size');
if (runnerCopy.sha256 !== '58c01b12f6b607e55a7568d11afb4120588721aa5d9637f979bb0ca42d0c7eff') {
  throw new Error('the chain-runner copy is not the one this package imports through');
}

const ledger = JSON.parse(read('src/plugin-chain-raster-surface-source-blocks.json'));
const expectedBlocks = [
  ['chunk-n3ykh62m.js', 248705, 248715, 10],
  ['chunk-n3ykh62m.js', 252200, 252243, 43],
  ['chunk-n3ykh62m.js', 252256, 252455, 199],
  ['chunk-n3ykh62m.js', 252481, 252898, 417],
  ['chunk-n3ykh62m.js', 253057, 253816, 759],
  ['chunk-n3ykh62m.js', 253943, 253969, 26],
  ['chunk-n3ykh62m.js', 254367, 256690, 2323],
  ['chunk-yn0pfn70.js', 935, 1251, 316],
  ['chunk-yn0pfn70.js', 1286, 1426, 140],
  ['chunk-yn0pfn70.js', 1602, 1743, 141],
];
if (ledger.blocks.length !== 10) throw new Error(`the surface ledger holds ${ledger.blocks.length} blocks`);
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 4374) throw new Error(`the surface ledger holds ${units} units`);
if (ledger.missing.length !== 0) throw new Error('the surface ledger reports missing names');
for (const [module, start, end, count] of expectedBlocks) {
  const block = ledger.blocks.find((b) => b.module === module && b.range[0] === start);
  if (!block || block.range[1] !== end || block.units !== count) {
    throw new Error(`${module} [${start},${end}) is not in the ledger as ${count} units`);
  }
}

// Every block is re-read from its module, compared with the copy, and checked against acorn: each is a
// contiguous run of whole top-level statements, no statement is cut, and no two overlap.
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
const copyText = read('src/plugin-chain-raster-surface-source.ts');
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
  if (all.some((node) => (node.start < start && node.end > end) || (node.start < end && node.end > end))) {
    throw new Error(`${block.range} cuts a statement in half`);
  }
  const key = `${block.module} ${block.range.join(',')}`;
  if (claimed.has(key)) throw new Error(`${key} is copied twice`);
  claimed.set(key, true);
}
const helperSpan = statements.get('chunk-yn0pfn70.js').filter((node) => node.start >= 935 && node.end <= 1743);
const copiedSpan = helperSpan.filter((node) => ledger.blocks.some((block) => node.start >= block.range[0] && node.end <= block.range[1]));
if (copiedSpan.length !== 3) throw new Error(`the CSI helper's span holds ${copiedSpan.length} copied statements, not 3`);
const skipped = helperSpan.filter((node) => !copiedSpan.includes(node));
if (skipped.length !== 4) throw new Error(`${skipped.length} statements in the CSI helper's span were left out, not 4`);
for (const node of skipped) {
  const text = sources.get('chunk-yn0pfn70.js').slice(node.start, node.end);
  if (!/^(function C\(e\)\{return e>=48&&e<=126\}|function [k b P]\(e\)\{return e>=S\.[A-Z_]+&&e<=S\.[A-Z_]+\})$/.test(text)) {
    throw new Error(`an unexpected statement was left out of the CSI helper's span: ${JSON.stringify(text)}`);
  }
}

// The engine and the CSI helper: the whole of the latter (ported, not bound), and the entry and answer
// of the former, which is too long to quote whole in the seam.
const module3 = sources.get('chunk-n3ykh62m.js');
const moduleY = sources.get('chunk-yn0pfn70.js');
const engine = module3.slice(254367, 256690);
for (const fragment of [
  'function gNs(e=Date.now,n=mb()){let r=lb(),s=(M)=>M!==void 0&&r.held.get(M.entry.key)===M.entry;',
  'return{beginPaint:(M)=>{r.paint+=1,r.frame=M,r.evaluated=0,r.lastSgr=hc(),r.isStarved=!1,r.hasCarried=!1,r.netMatched=0,r.hasStale=!1,y()},sgrOf:(M)=>(r.lastSgr=(r.held.get(M)??P(M))?.sgr??r.lastSgr,r.lastSgr),size:()=>r.held.size,standing:()=>(r.hasCarried&&r.netMatched>0||r.hasStale&&!r.isStarved)&&"progressing"||(r.isStarved?"waiting":"complete")}}',
  'function _b(e,n){let{columns:r,rows:s}=n,h=[],y=new Set;for(let b=0;b<s;b++){',
  'function Lss(e,n,r){let{columns:s,rows:h}=n,y=_b(e,n),b=Array(h),w=0;r.beginPaint(y.distinct);',
]) {
  if (!engine.includes(fragment)) throw new Error('the engine no longer carries one of the fragments the seam quotes');
}
if (!copyText.includes(engine)) throw new Error('the engine block is not in the copy verbatim');
for (const [start, end] of [[935, 1251], [1286, 1426], [1602, 1743]]) {
  if (!copyText.includes(moduleY.slice(start, end))) throw new Error(`chunk-yn0pfn70.js [${start},${end}) is not in the copy`);
}
// The helper is the source's own body, and the introducer is built from the grammar rather than written.
if (!moduleY.slice(1602, 1743).startsWith('function fl(...e){if(e.length===0)return A;')) {
  throw new Error('the CSI helper is not the measured `fl`');
}
if (!moduleY.slice(1286, 1426).startsWith('var A=PH+String.fromCharCode(CZ.CSI),')) {
  throw new Error('the introducer is not built from the grammar');
}
// The matcher walks the cell table in the encoder's own stride, so its two halves have to agree.
if (!module3.slice(253451, 253816).includes('for(let R=0;R<gn.width;R+=gn.backgroundDefault)')) {
  throw new Error('the matcher no longer walks the cell in the background stride');
}
if (!engine.includes('String.fromCharCode(e[N]??0)')) throw new Error('the row builder no longer reads a cell\'s code point');

// What the engine reaches is imported from the copies that already carry it, never declared here.
for (const carried of ['Ge', 'it', 'xo', 'gs', 'ko', 'tb', 'Lr', 'dc', 'Gn', 'ys', 'mc', 'gn', 'bc', 'fb', 'mb', 'yb', 'Sb', '$f']) {
  if (new RegExp(`(function|var|let|const)\\s+${carried.replace('$', '\\$')}\\b`).test(copyText)) {
    throw new Error(`the surface copy declares ${carried} itself instead of importing it`);
  }
}
for (const line of [
  "import { Ge } from './plugin-chain-source.js';",
  "import { it } from './plugin-chain-host.js';",
  "import { $f, Gn, Lr, Sb, bc, dc, fb, gn, mb, mc, tb, yb, ys } from './plugin-chain-raster-cells-source.js';",
  "import { gs, ko, xo } from './plugin-chain-ui-blit-source.js';",
]) {
  if (!copyText.includes(line)) throw new Error(`the surface copy is missing an import: ${line}`);
}
const importedFrom = {
  'W45-chain-runner-blocks.plan.json': ['Ge'],
  'W45-raster-cells-blocks.plan.json': ['$f', 'Gn', 'Lr', 'Sb', 'bc', 'dc', 'fb', 'gn', 'mb', 'mc', 'tb', 'yb', 'ys'],
  'W45-ui-blit-blocks.plan.json': ['gs', 'ko', 'xo'],
};
for (const [plan, names] of Object.entries(importedFrom)) {
  const exports = JSON.parse(read(`research/ports/${plan}`)).exports;
  for (const name of names) {
    if (!exports.includes(name)) throw new Error(`${plan} no longer exports ${name}, which this package imports`);
  }
}

// The seam: nine of the ten bodies quoted verbatim, the engine by fragments, every range cited, and the
// names a surface calls.
const seam = read('src/plugin-chain-raster-surface.ts');
for (const [module, start, end] of expectedBlocks.slice(0, 6).concat([expectedBlocks[9]])) {
  const body = sources.get(module).slice(start, end);
  if (!seam.includes(body)) throw new Error(`the seam header does not quote ${module} [${start},${end}) verbatim`);
}
for (const range of ['[248705,248715) 10', '[252200,252243) 43', '[252256,252455) 199', '[252481,252898) 417',
  '[253057,253816) 759', '[253943,253969) 26', '[254367,256690) 2,323', '[935,1251) 316', '[1286,1426) 140', '[1602,1743) 141']) {
  if (!seam.includes(range)) throw new Error(`the seam header does not cite ${range}`);
}
for (const name of ['CELL_STRIDE', 'SLOT_CAPACITY', 'ALIAS_LIMIT', 'ALIAS_SWEEP', 'REUSE_COST', 'EVALUATION_BUDGET',
  'SGR_CODES', 'CONTROL_CODES', 'CSI_BYTES', 'ESCAPE', 'BELL', 'PARAMETER_SEPARATOR', 'CHARSET_RESET', 'CSI',
  'PARAMETER_BYTE_RANGES', 'csi', 'channelByte', 'toPackedColour', 'packColourPair', 'sgrSide', 'sgrPair',
  'resetSgr', 'freshSurfaceState', 'staleSlots', 'nearestSlot', 'createRasterSurface', 'frameRuns', 'renderRows']) {
  if (!seam.includes(name)) throw new Error(`the seam does not export ${name}`);
}
if (!seam.includes("export { _b, _s, A, cb, CZ, db, fc, Ff, fl, gb, gNs, gc, hb, Hf, hc, lb, Lss, nG, nb, pc, PH, S, Sc, ub, xse, Y9e, fRr };")) {
  throw new Error('the seam does not re-export the copied bodies under their source names');
}
if (!seam.includes("export const REUSE_COST = gb;") || !seam.includes("export const EVALUATION_BUDGET = hb;")) {
  throw new Error('the seam hard-codes a constant the copy carries instead of deriving it');
}
const registryState = read('src/plugin-chain-registry-state.ts');
for (const name of ['RasterSurfaceEntry', 'RasterSurfaceStanding', 'RasterSurfaceState', 'RasterSurface']) {
  if (!registryState.includes(name)) throw new Error(`the registry state does not carry ${name}`);
}
const suite = read('test/plugin-chain-raster-surface.test.ts');
for (const name of ['createRasterSurface', 'renderRows', 'nearestSlot', 'staleSlots', 'csi']) {
  if (!suite.includes(name)) throw new Error(`the suite does not exercise ${name}`);
}
if (suite.includes('plugin-chain-raster-surface-source.js')) throw new Error('the suite reaches past the seam to the copy');

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-61-tests.txt');
if (full.failed !== 0 || full.tests !== 1595) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-61-family.txt');
if (family.failed !== 0 || family.tests !== 319) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const rasterSweep = summary('.audit/w45-61-raster-surface.txt');
if (rasterSweep.failed !== 0 || rasterSweep.tests !== 25) throw new Error('the raster sweeps are not clean');
const scanSweep = read('.audit/w45-61-scan.txt');
if ((scanSweep.match(/unresolved 0/g) ?? []).length !== 2) throw new Error('the two scanned copies did not scan clean');
const span = JSON.parse(read('.audit/w45-61-span.txt'));
if (span.total !== 0) throw new Error(`the span scan found ${span.total}`);
const notices = JSON.parse(read('.audit/w45-61-notices.txt').split('\n').filter((line) => line.startsWith('{')).at(-1));
if (notices.sha256 !== '384c78801194aedea80331383ccd93708c2dfa46bc746003dc112c930b73d13c') {
  throw new Error('the dependency-notice digest moved');
}
const smokeReport = read('.audit/w45-61-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 294) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const allMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
const sharedMarkers = read('.audit/w45-61-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-61-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45RasterSurfaceCompiled.v1')) throw new Error('the shared driver did not print the W45-61 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45RasterSurfaceCompiled.v1 (${sharedMarkers.length} markers, ${allMarkers.length} across every driver: it builds the CSI sequences, narrows and packs colours, reads the reset sequence, asks the matcher for the nearest slot, drives a surface through two paints and a matched colour, starves one and reads its standing, and walks the evaluation budget to the call where the paint reports it carried colours)`;

const evidence = {
  schema: 'W45RasterSurfaceEvidence.v1',
  package: 'W45-61 — the raster surface engine',
  date: '2026-10-16',
  question: 'What turns a frame of colours into the escapes a surface writes — what admits a colour, what answers for one the surface does not hold, and what does a paint report about itself?',
  answer: 'A frame is a flat array of cells, `CELL_STRIDE` (3) entries each: the code point, the foreground and the background, both colours 24-bit words. `_b` reads them into the keys a row is made of — one key per colour *change*, not per cell — where a key is `pc(fg, bg)` (chunk-n3ykh62m.js [252416,252455)), the two colours each narrowed by `Ff` to four bits a channel and packed with the foreground low. `gNs` builds a surface over `lb`\'s state: `beginPaint(frame)` bumps the paint counter, resets the four status flags and `lastSgr` to `hc()` (the both-sides reset `ESC[39mESC[49m`), then walks the frame — a key the surface already holds only has its `lastPaint` touched, while anything else takes a free slot or the stalest one from `cb`, admitted through the token row W45-60 ported with a cost of 0 for a fresh slot and `gb` (1024) for a reused one, and its cell written by `$f`. `sgrOf(key)` answers the escape: the held entry\'s, else the entry `db` matched (the slot whose cell is nearest the probe by squared channel distance, with `Lr.defaultMismatch` counted where a default flag differs, and the first slot winning a tie) recorded as an alias, else the last escape the surface emitted. `size()` is how many keys it holds and `standing()` is `progressing`, `waiting` or `complete`. `Lss` draws the frame: one line a row, an escape emitted only where the colour changes, and `String.fromCharCode(cell)` for every cell.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  planExtensions: [
    {
      plan: 'research/ports/W45-raster-surface-blocks.plan.json',
      what: 'a new plan, ten blocks and twenty-seven exports',
      blocks: '0 → 10 blocks, 4,374 units',
      why: 'the engine\'s own run is contiguous (2,323 units) but everything it closes over sits in six other runs of the same module, and the CSI helper the SGR builder writes with is three statements of a module this product had never copied from',
    },
  ],
  boundary: 'No new boundary and no new host hook. The CSI helper `fl` is **ported, not bound**: its whole closure measured 3 statements / 597 units with no imports at all, so the source body was obtainable and is copied rather than replaced with a hook. Everything else the engine reaches is imported from copies already carried and asserted not to be declared here — `xo` (3, the cell stride), `gs` (the colour grammar) and `ko` (the no-colour sentinel) from the W45-58 blit copy, the thirteen bucket/encoder names from W45-60, and `Ge` from the chain-runner copy. `REUSE_COST` and `EVALUATION_BUDGET` are derived from the copied `gb`/`hb` rather than written as literals.',
  measured: [
    'The CSI helper: `fl()` answers the bare introducer, `fl(0)` appends one value, and every argument but the last is joined with the separator while the last is appended as it stands — so `fl(38, 2, 255, 0, 0, "m")` is `ESC[38;2;255;0;0m` but `fl(1, 2, 3)` is `ESC[1;23`. That is why the SGR builder passes its final byte as a string.',
    'The colour: `Ff` narrows a 24-bit colour to four bits a channel (red becomes 3840, green 240, blue 15) and answers the no-colour sentinel as the default marker 32768; `pc` packs a foreground low and a background high; two markers pack to 0x80008000, which the signed bitwise operators read as -2147450880 — measured, and the packer carries the sign as it is.',
    'The SGR: `Hf` builds `38;2;R;G;B` or `48;2;R;G;B` from a packed colour with each channel widened back to 0..255, answers the reset code (39/49) for a default marker, and `gc` is the two sequences joined — `hc()` is therefore `ESC[39mESC[49m`, which is what a paint resets `lastSgr` to.',
    'A fresh surface: no slots, no aliases, a `Uint8Array(SLOT_CAPACITY * 8)` cell table and an eight-word probe, every counter 0, every flag false, and `lastSgr` already the reset sequence.',
    'The matcher answers the closest slot\'s index and -1 with nothing to compare. A probe differing only in the default flag from every slot ties them all at `Lr.defaultMismatch`, and the first wins because the comparison is strict. A probe whose exact cell is in the table answers that slot.',
    'The stale list is the slots whose `lastPaint` is behind the current paint, oldest first, and is empty at paint 0 — nothing has been touched yet, so nothing is behind.',
    'The engine: a paint of two colours holds two, the same two again still holds two (a held key is not admitted twice), a third makes three, and every one of those paints reports `complete`.',
    'A held colour answers its own escape. A colour the surface does not hold answers the escape of the slot the matcher chose — with only a red slot present, green answers red\'s escape and the surface still holds one — so the escape a paint reuses is the one already on the surface, not one built for the new colour.',
    'A surface with nothing placed answers the last escape it emitted, which right after `beginPaint` is the reset sequence, and its size stays 0.',
    'A starved paint reports `waiting` and places nothing: with a row of zero tokens and a clock that does not move the frame is refused by the token row W45-60 ported.',
    '`progressing` is reached at exactly the evaluation budget: `T` stops matching once `evaluated + slots > hb`, so the call that first finds `evaluated` at `hb` (131072) leaves the key unmatched, and from then on a paint that has carried colours and matched some reports it. Measured by walking `sgrOf` to the boundary: the standing flips on the 131073rd call, and nothing was placed while it was not matching.',
    'The runs: `_b` pushes a key only where the colour changes, so a row of one colour is one key and a row that changes and changes back is three keys for two distinct colours.',
    'The rows: a run of two cells takes one escape, every colour change is announced including the change back, and a two-cell one-row frame is a single line with no trailing newline.',
  ],
  regressions: `the new surface suite 14/14 and the cells suite beside it (${rasterSweep.passed}/${rasterSweep.tests} together); ${familyLine}`,
  full: fullLine,
  compiled: driverLine,
  smoke,
  next_package: [
    'the site components that mount a surface and drive it: `tF` is called at chunk-n3ykh62m.js 257441, just past this package\'s last block, and the Raster/Image site components are `Tc(jo, …)` in chunk-kjfwbh4w.js — the React layer becomes a seam over the bodies now ported, as W45-38 did for the bar',
    'the remaining `$` table entries, each measured the same way first: `ui.scroll` (`O5n` 194u + `L5n` 808u + `mVe` 54u + `Nye` 39u), `ui.focus` (`fzo` 202u + `Szo` 532u + `mVe`), `ui.copy` (`wGo`/`uzo`/`dzo`, blocked on the clipboard encoder `Sv`), `state.get`/`state.set` (`Pur`/`Our`, `Iur`/`$ss`/`Hur`), `fs.ancestors` (`kNs` 492u)',
    'the plugin-facing `$` dispatcher `G2e` (chunk-sfn1dbxq.js [2356082,…)), the path that applies `raise` then `stamp` then `run`',
    'the settings read path behind `y9e` — measured at 590 statements / 327,047 units, of which 318,262 are fresh, so it is a subsystem to walk in pieces; the managed-settings gate `CT` (chunk-4bw62nzm.js) and `Tp` (chunk-wtch2p0g.js, 263u); Q-086\'s 15 registry-reading cores and their 34 sites; the notification provider `a4n`',
  ],
};
write('research/ports/W45-raster-surface-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-61 **补',
  features: "; W45-61 ports the raster surface engine",
  standard: '2026-10-16 W45-61 ',
  status: 'W45-61:',
  runner: '## W45-61 ported the raster surface engine',
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
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-61 **补"表面引擎"**（把一帧颜色变成要写出去的转义序列：谁准入一个颜色、对一个表面没持有的颜色答什么、一次 paint 对自己报告什么）：**10 段 4,374 单位**——chunk-n3ykh62m.js 七段（[248705,248715) 10u \`nb\`；[252200,252243) 43u \`fc\`；[252256,252455) 199u \`Ff\`/\`pc\`；[252481,252898) 417u \`_s\`/\`Hf\`/\`gc\`/\`hc\`/\`Sc\`；[253057,253816) 759u \`lb\`/\`cb\`/\`ub\`/\`db\`；[253943,253969) 26u \`gb\`/\`hb\`；[254367,256690) 2,323u **引擎 \`gNs\` + \`_b\` + \`Lss\`**）+ chunk-yn0pfn70.js 三段（[935,1251) 316u 终端文法 \`xse\`/\`PH\`/\`nG\`/\`Y9e\`/\`fRr\`/\`CZ\`；[1286,1426) 140u \`A\`/\`S\`；[1602,1743) 141u **CSI 助手 \`fl\`**）。**语义（源文实测）**：一帧是扁平的格子数组、每格 \`xo\`(3) 项（码点 + 前景 + 背景，色为 24 位）；\`_b\` 读成"行由哪些颜色段组成"——**键按颜色变化产生、不是每格一个**，键 \`pc(fg,bg)\`（\`Ff\` 把 24 位压成每通道 4 位，前景在低半）。\`beginPaint\` 计数 +1、把 \`lastSgr\` 复位为 \`hc()\`（两侧复位 \`ESC[39mESC[49m\`）、清四个标志，然后走帧：**已持有的键只更新 \`lastPaint\`**，其余取空槽或 \`cb\` 给出的最旧槽，逐个经 W45-60 的令牌行走准入（**空槽花费 0、复用槽花费 \`gb\`=1024**），并写格。\`sgrOf(键)\` 答该键的转义：持有的 → 它自己的；不持有的 → \`db\` 匹配到的槽（按通道平方距离最近，默认位不同按 \`Lr.defaultMismatch\` 计，**并列取第一个**）并记为 alias；**两者皆无 → 上一次发出的转义**。\`size()\` 是持有数，\`standing()\` 报 \`progressing\`/\`waiting\`/\`complete\`。\`Lss\` 逐行画：**只在颜色变化处发转义**，每格一个 \`String.fromCharCode\`。**关键取舍**：CSI 助手 \`fl\` **搬而不绑**——其闭包实测 3 语句 / 597 单位且**零 import**，源文可得故整段搬入；其余依赖取已搬运副本（blit 副本的 \`xo\`/\`gs\`/\`ko\`、cells 副本的 13 个桶/编码名、chain-runner 的 \`Ge\`），并断言本副本**不自声明**这 18 个名；\`REUSE_COST\`/\`EVALUATION_BUDGET\` **由副本的 \`gb\`/\`hb\` 推导**而非写死字面量。**三处实测纠偏**：① \`fl(1,2,3)\` 实为 \`ESC[1;23\`（**最后一个参数原样追加、不加分隔符**——这正是 SGR 构造器把末尾字节当字符串传的原因）；② \`_b\` 的 \`keys\` 是**每段颜色一个**而非每格一个；③ 驱动里"已持有"的绿色答的是**它自己的**转义（我按上一轮"只有红槽"的探针误推）。注册表类型新增 \`RasterSurfaceEntry\`/\`RasterSurfaceStanding\`/\`RasterSurfaceState\`/\`RasterSurface\`。验收：check/build/notices（摘要未变）、两副本 \`unresolved 0\`、span \`total 0\`、**${chain}**、surface 账本 10 段逐段回源 + acorn（完整语句、无重叠、无切半、无重复）+ 引擎四个关键片段与 \`fl\` 首行回源 + "不自声明 18 个被导入名" + 四条 import 行逐字 + "\`hb\` 边界以 \`gn.backgroundDefault\` 步进"判据、新回归 ${rasterSweep.passed}/${rasterSweep.tests}、家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45RasterSurfaceCompiled.v1\`，共享 ${sharedMarkers.length} 标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [表面引擎证据](ports/W45-raster-surface-evidence.json)、[格子编码证据](ports/W45-raster-cells-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
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
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-61 ports the raster surface engine: ` +
  'the pass that admits a frame\'s colours through the token row, places them in a slot table and rewrites its cells, the ' +
  'nearest-slot matcher a colour the surface does not hold is answered from, the SGR and colour builders those escapes are ' +
  'made of, the CSI helper they are written with, and the row builder that emits an escape only where a colour changes. |';
write('research/FEATURES.md', lines.join('\n'));

const standardText = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standardText.indexOf('2026-10-16 W45-60');
if (standardAt < 0) throw new Error('coding-standard W45-60 line not found');
const standardEntry = `2026-10-16 W45-61 表面引擎：S-1至S-7已对照。S-1（先读源）：先量闭包与覆盖——\`gNs _b Lss\` 得 34 语句 / 4,767 单位，其中 **16 语句 / 990 单位已被 W45-58/W45-60 账本覆盖**（13 个桶与编码名 + \`ko\`/\`gs\`/\`xo\`），**新 18 语句 / 3,777 单位**；\`fl\` 单独量得 3 语句 / 597 单位、**零 import**。**逐字读过再动手**：\`Ff\`/\`pc\`/\`fc\` 的三处移位、\`Hf\` 的五参数列表与两句复位码、\`gc\` 的两段拼接、\`lb\` 的 14 个字段与 \`Uint8Array(Sc*gn.width)\`、\`db\` 的"按 \`gn.backgroundDefault\` 步进 + 默认位按 \`Lr.defaultMismatch\` 计 + 平方距离"、\`gNs\` 的四个闭包（\`h\`/\`y\`/\`T\`/\`P\`/\`R\`/\`w\`）与返回的四个方法、\`_b\` 的"仅颜色变化产生键"、\`Lss\` 的 \`beginPaint(y.distinct)\`。**关键取舍**：① \`fl\` **搬而不绑**——零 import 的源文可得，绑成钩子会是无据改写；② 其余依赖全部 import 并断言"本副本不自声明"18 个名；③ \`REUSE_COST\`/\`EVALUATION_BUDGET\` 由副本 \`gb\`/\`hb\` 推导，不写死。S-2（不留半包）：新边界零、新宿主钩子零；站点组件 \`Tc(jo,…)\` 与其余 \`$\` 表项按实测坐标写进 next_package。S-3（先测后断言）：\`.audit/w45-61-probe{,b,c}.ts\` 先跑再写 14 条断言；**三处按实测纠偏**——① \`fl(1,2,3)\` 实为 \`ESC[1;23\`（最后参数原样追加，我按"全部 \`;\` 连接"写错）；② \`_b\` 的 \`keys\` 每**段颜色**一个而非每格一个（首轮探针的打印被我读成两键）；③ 驱动里已持有的绿色答自己的转义，我按上一轮"只有红槽"的探针误推，改为另取一个未持有的颜色做"匹配"断言。另实测出 **\`progressing\` 的精确边界**：\`T\` 在 \`evaluated+slots>hb\` 时停止匹配，故第 131073 次调用触发，测试与驱动都走到这一步并断言。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器（60 计划）与 ${drivers.length} 个编译驱动并解析输出，断言两副本 \`unresolved 0\`、span \`total 0\` 与 notices 摘要未变；acorn（完整语句、无重叠、无切半、无重复）+ 十正文回源（九段逐字 + 引擎四片段）+ \`fl\` 首行与 \`A\` 的构造回源 + 四条 import 行逐字 + 三处计划仍导出被导入名 + \`hb\` 步进判据 + 注册表四类型判据。S-5/S-6：seam 加 15 个按名包装、14 个具名常量（其中 2 个由副本推导）、按源名再导出 27 个正文；测试只经 seam；无死导出。S-7：站点组件、其余 \`$\` 表项、\`G2e\`、\`y9e\` 读路径写入 next_package。验收：check/build/notices、两副本 unresolved 0、${chain}、账本与正文自证、回归 ${rasterSweep.passed}/${rasterSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standardText.slice(0, standardAt) + standardEntry + standardText.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf('W45-60: the raster cell encoder and the admission bucket');
if (statusAt < 0) throw new Error('STATUS W45-60 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = 'W45-61: the raster surface engine. A frame is a flat array of cells, three entries each — a code point and two ' +
  '24-bit colours — and `_b` reads it into the keys a row is made of, one key per colour *change* rather than per cell, each key a ' +
  'foreground and a background narrowed to four bits a channel and packed together. `gNs` builds a surface over `lb`\'s state: ' +
  '`beginPaint` bumps the paint counter, resets `lastSgr` to the both-sides reset `ESC[39mESC[49m`, then walks the frame — a key the ' +
  'surface already holds only has its `lastPaint` touched, while anything else takes a free slot or the stalest one, admitted through ' +
  'the token row W45-60 ported at a cost of nothing for a fresh slot and 1024 for a reused one. `sgrOf` answers a key\'s escape: the ' +
  'held entry\'s, else the entry the nearest-slot matcher chose (recorded as an alias), else the last escape the surface emitted; ' +
  '`size()` is how many keys it holds and `standing()` reports `progressing`, `waiting` or `complete`, with the measured boundary ' +
  'that the matcher stops once a paint has evaluated 131,072 slots. Ten blocks, 4,374 units: seven runs of chunk-n3ykh62m.js and the ' +
  'three statements of the CSI helper in chunk-yn0pfn70.js, which is **ported rather than bound** — its closure measured three ' +
  'statements and no imports, so the source body was obtainable. Everything else comes from copies already carried: the cell stride, ' +
  'colour grammar and no-colour sentinel from the W45-58 blit copy, the bucket and encoder from W45-60, `Ge` from the chain-runner ' +
  'copy — each asserted not to be declared here, and the two constants derived from the copy rather than written as literals. Evidence: ' +
  '`research/ports/W45-raster-surface-evidence.json`, and\n[工作包](ports/W45-chain-runner.md).\n\n';
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-61 ported the raster surface engine (2026-10-16)

This is the last piece of the raster surface: W45-58 ported what reads the registries, W45-59 what fills them, W45-60 what a frame
is painted *with*, and here the pass that takes a frame's colours, admits them, matches them against what the surface already
holds, and answers the escape that draws each one. Ten blocks, 4,374 units — seven runs of chunk-n3ykh62m.js and three statements
of chunk-yn0pfn70.js.

A frame is a flat array of cells, \`CELL_STRIDE\` (3) entries each: the code point, then the foreground and the background as 24-bit
colours. \`_b\` reads it into the keys a row is made of, and the measurement corrected a first misreading of that: a key is pushed
where the colour *changes*, not once per cell, so a row of one colour is one key and a row that changes and changes back is three
keys for two distinct colours. A key is \`pc(fg, bg)\` — each colour narrowed by \`Ff\` from its 24 bits to four bits a channel
(red becomes 0xF00) with the no-colour sentinel answering the default marker, then packed with the foreground low.

\`gNs\` builds a surface over \`lb\`'s state. \`beginPaint\` bumps the paint counter, records the frame, clears \`evaluated\` and the
four status flags, sets \`lastSgr\` back to \`hc()\` — the both-sides reset \`ESC[39mESC[49m\` — and then walks the frame: a key the
surface already holds only has its \`lastPaint\` touched, while anything else takes a free slot or the stalest one \`cb\` offers, and
every one of those is admitted through the token row W45-60 ported, at a cost of nothing for a fresh slot and \`gb\` (1024) for a
reused one, its cell written by \`$f\`. \`sgrOf\` answers a key's escape in three steps: the entry the surface holds, else the entry
\`db\` matched — the slot whose cell is nearest the probe by squared channel distance, counting \`Lr.defaultMismatch\` where a default
flag differs and taking the first slot on a tie — recorded as an alias, else the last escape the surface emitted. So a colour the
surface does not hold is drawn with the escape of the slot it matched, which is measured (green, with only a red slot present,
answers red's escape) and is the source's own behaviour rather than a fallback this port added.

\`standing()\` reports the paint's progress, and the measurement pinned its third value exactly: \`progressing\` appears on the
131073rd evaluation, because the matcher stops once \`evaluated + slots\` exceeds \`hb\` (131,072). \`waiting\` is a paint the token
row refused; \`complete\` is everything else, including a paint of colours the surface already held.

The CSI helper \`fl\` is **ported, not bound**: its closure measured three statements and no imports at all, so the source body was
obtainable and is copied. Its own behaviour corrected a second first draft — every argument but the last is joined with the
separator and the last is appended as it stands, so \`fl(38, 2, 255, 0, 0, "m")\` is the sequence one expects but \`fl(1, 2, 3)\` is
\`ESC[1;23\`. That is why the SGR builder passes its final byte as a string. Everything else the engine reaches is imported from
copies already carried — the cell stride \`xo\`, the colour grammar \`gs\` and the sentinel \`ko\` from the W45-58 blit copy, thirteen
bucket and encoder names from W45-60, \`Ge\` from the chain-runner copy — with the copy asserted not to declare any of them, and
\`REUSE_COST\`/\`EVALUATION_BUDGET\` derived from the copied \`gb\`/\`hb\` rather than written as literals.

Verified: check/build/notices, both scanned copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, all ten blocks re-read from their
modules and matched against the copy with acorn (whole statements, contiguous, no cut, no repetition), the engine's four key
fragments and \`fl\`'s first line re-read from their modules, the four import lines quoted verbatim with the eighteen imported names
asserted absent as declarations, the matcher's background-stride walk and the row builder's code-point read asserted, the two
derived constants asserted derived, the registry-state typing for the row and the surface, the suites ${rasterSweep.passed}/${rasterSweep.tests},
${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers (the shared driver now also prints \`W45RasterSurfaceCompiled.v1\`), and the
packaged smoke (${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: the site components that mount a surface and drive it — \`tF\` is called at chunk-n3ykh62m.js 257441, just past this package's
last block, and the Raster/Image sites are \`Tc(jo, …)\` in chunk-kjfwbh4w.js, where the React layer becomes a seam over the bodies
now ported (as W45-38 did for the bar). Then the remaining \`$\` table entries (\`ui.scroll\`, \`ui.focus\`, \`ui.copy\`,
\`state.get\`/\`state.set\`, \`fs.ancestors\`) and the dispatcher \`G2e\`. The settings read path behind \`y9e\` stays the measured
subsystem: 590 statements / 327,047 units, 318,262 of them fresh.
`);

const rows = [
  ['2026-10-17T10:05:00Z', 'package', 'W45-61 补表面引擎（一帧颜色 → 准入 → 槽表 → 转义序列：10 段 4,374 单位 = n3ykh62m 七段 3,777u + yn0pfn70 三段 597u）',
    'createRasterSurface/frameRuns/renderRows/freshSurfaceState/staleSlots/nearestSlot/sgrPair/sgrSide/resetSgr/packColourPair/toPackedColour/channelByte/csi 成为产品面，14 个具名常量（CELL_STRIDE/SLOT_CAPACITY/ALIAS_LIMIT/ALIAS_SWEEP/REUSE_COST/EVALUATION_BUDGET/SGR_CODES/CONTROL_CODES/CSI_BYTES/ESCAPE/BELL/PARAMETER_SEPARATOR/CHARSET_RESET/CSI/PARAMETER_BYTE_RANGES）；注册表类型新增 RasterSurfaceEntry/RasterSurfaceStanding/RasterSurfaceState/RasterSurface',
    'chunk-n3ykh62m.js [248705,248715) 10u + [252200,252243) 43u + [252256,252455) 199u + [252481,252898) 417u + [253057,253816) 759u + [253943,253969) 26u + [254367,256690) 2323u；chunk-yn0pfn70.js [935,1251) 316u + [1286,1426) 140u + [1602,1743) 141u',
    `实测（.audit/w45-61-probe{,b,c}.ts 与 test/plugin-chain-raster-surface.test.ts + .audit/w45-24-compiled.mjs）：fl 三种元数（末参原样追加）、Ff 的 4 位压缩与哨兵、pc 的 0x80008000 为负、Hf/gc/hc 的序列、lb 的 14 字段与表长、db 的最近槽与并列取首、cb 的最旧序、paint 的持有/复用/拒帧（waiting）、sgrOf 三级、progressing 的 131073 次边界、_b 每段一键、Lss 只在变色处发转义；14/14 通过`],
  ['2026-10-17T10:10:00Z', 'decision', 'W45-61 取舍：CSI 助手 fl 搬而不绑（闭包 3 语句 / 597 单位、零 import），其余 18 个名全部 import 并断言不自声明',
    'fl 的源文可得（零 import、597 单位），绑成宿主钩子会是无据改写，违反"源文可得则搬运"；引擎其余依赖（xo/gs/ko、cells 的 13 名、Ge）均在已搬运副本内',
    '新计划 import { Ge } + import { it } + cells 13 名 + blit 的 gs/ko/xo；记录脚本断言"本副本不自声明这 18 个名"、四条 import 行逐字、三处计划仍导出被导入名；REUSE_COST/EVALUATION_BUDGET 由副本 gb/hb 推导而非写死',
    `chain ${chain}；surface 副本 10 段 4,374 单位 sha 7fe053e1…`],
  ['2026-10-17T10:15:00Z', 'finding', 'W45-61 三处实测纠偏：csi 的末参、_b 的键粒度、已持有色的转义',
    '① fl(1,2,3) 实为 ESC[1;23（最后一个参数原样追加、不加分隔符；SGR 构造器正是因此把末尾字节当字符串传），我按"全部用 ; 连接"写错；② _b 的 keys 是每"段颜色"一个而非每格一个（首轮探针打印 [[986880],[986880]] 被我读成两键）；③ 驱动里已持有的绿色答它自己的转义，我按上一轮"只有红槽"的探针误推',
    '三条都改为按实测断言；第③条另取一个未持有的颜色做"匹配 → 取所匹配槽的转义"断言；另实测出 progressing 的精确边界（第 131073 次调用）并写进测试与驱动',
    '回归 14/14 + 25/25（cells 与 surface 合并运行）；驱动 35 标记 exit 0'],
  ['2026-10-17T10:19:00Z', 'fix', 'W45-61 顺带修一处类型过窄：encodeCell 的入参由 Uint32Array 放宽为 Uint8Array | Uint32Array',
    '引擎的格表是 lb 建的 Uint8Array(Sc*gn.width)（每字一个标志或四位通道），而 W45-60 的 encodeCell 只接受 Uint32Array，导致 $f 无法写进表面自己的表',
    'seam 的两处签名放宽并在注释中写明"源写入的是表面自己的格表，那是字节数组"；改动后重建、重跑驱动与三套回归（全量 1595/1595、家族 319/319、栅格 25/25）',
    '身份随之从 5b0af7d1… 变为 282f0ed6…；check 干净、编译驱动 35 标记 exit 0'],
  ['2026-10-17T10:23:00Z', 'verification', `W45-61 验收：两副本 unresolved 0、span total 0、surface 账本 10 段逐段回源 + acorn（无重叠/无切半/无重复）+ 引擎四片段与 fl 首行回源 + "不自声明 18 名" + 四条 import 逐字 + hb 步进判据、${chain}、回归 ${rasterSweep.passed}/${rasterSweep.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '光栅面全链闭环：blit 条目（W45-58）→ 挂载写入器（W45-59）→ 格子编码与准入桶（W45-60）→ 表面引擎与转义（W45-61）；下一包转站点组件 Tc(jo,…) 与其余 $ 表项',
    `check/build/notices；两副本 unresolved 0；span total 0；${chain}；surface 账本 10 段逐段回源比长度与内容 + acorn + 无重复断言；引擎四关键片段（gNs 入口与返回、_b、Lss）与 fl 首行、A 的构造回源；18 个被导入名的"不自声明"断言；四条 import 行逐字；db 的 gn.backgroundDefault 步进判据；两个常量由副本推导的断言；注册表四类型判据；回归 ${rasterSweep.passed}/${rasterSweep.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45RasterSurfaceCompiled.v1，共享 ${sharedMarkers.length} 标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-61 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-61 acceptance (2026-10-16)

- [x] **The queue picked the package.** W45-60's record named the engine as the next package with measured coordinates, and the overlap scan put it at 18 fresh statements / 3,777 units against 16 already covered by the two previous ledgers.
- [x] **The whole chain came across.** Ten blocks, 4,374 units: the engine and the row builder that drives it, the surface state and the matcher it runs on, the SGR and colour builders its escapes are made of, and the CSI helper they are written with.
- [x] **Obtainable source was copied, not bound.** The CSI helper's closure measured three statements and no imports, so it is ported; the other eighteen names come from copies already carried, asserted not to be declared here, and the two constants are derived from the copy rather than written as literals.
- [x] **Nothing was invented.** The site components and the remaining table entries are recorded as the next package with measured coordinates instead of being guessed at.
- [x] **Everything measured before it was asserted,** and three first drafts were corrected by the measurement: the CSI helper appends its last argument as it stands, the frame runs are one key per colour change rather than per cell, and a held colour answers its own escape.
- [x] **A third standing state was pinned to a number.** \`progressing\` first appears on the 131073rd evaluation, which is the evaluation budget the matcher stops at — measured by walking to it, and asserted in both the suite and the compiled driver.
- [x] **Sweep.** check/build/notices, both copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, the surface ledger with acorn, the engine fragments and the CSI helper re-read, the eighteen imported names asserted absent as declarations, new suites ${rasterSweep.passed}/${rasterSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
// The state this record leaves behind, read back from disk: one entry per document, and no
// backslash-escaped code span anywhere.
const written = {
  'research/CURRENT.md': 'W45-61 **补',
  'research/STATUS.md': '\nW45-61:',
  'research/coding-standard.md': '\n2026-10-16 W45-61 ',
  'research/ports/W45-chain-runner.md': '\n## W45-61 ported',
  '.audit/w45-runtime.todo.md': '\n## W45-61 acceptance',
};
for (const [path, mark] of Object.entries(written)) {
  const text = read(path);
  const found = text.split(mark).length - 1;
  if (found !== 1) throw new Error(`${path} holds ${found} entries for ${JSON.stringify(mark)}`);
  if ((text.match(/\\`/g) ?? []).length !== 0) throw new Error(`${path} carries a backslash-escaped code span`);
}
const standardLines = read('research/coding-standard.md').split('\n').filter((line) => line.startsWith('2026-'));
if (new Set(standardLines).size !== standardLines.length) throw new Error('the coding standard repeats a one-line entry');
const stamps = read('.audit/w45-runtime.tsv').split('\n').filter((line) => line.startsWith('2026-10-17T10:')).map((line) => line.split('\t')[0]);
if (new Set(stamps).size !== stamps.length) throw new Error('the runtime trail repeats a timestamp');
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
