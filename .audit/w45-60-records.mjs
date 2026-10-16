// Write the W45-60 record from the artifacts themselves: the raster cell encoder and the admission
// bucket — the eleven blocks, the constants the engine's neighbours are deliberately not, the one
// foreign body (`Kbr`), and the seam and registry typing that carry them.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 410, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 155, `validation ${identity.validation.files}`);
expect(identity.build.files === 284, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 59) throw new Error('the chain verifier did not pass 59 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const registry = read('scripts/verify-chain-copies.mjs');
if (!registry.includes("['W45-raster-cells', 'plugin-chain-raster-cells-source']")) throw new Error('the new plan is not registered');
const cellsCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-raster-cells-source.ts'));
if (!cellsCopy || cellsCopy.blocks !== 11 || cellsCopy.units !== 1209) {
  throw new Error(`the cells copy is ${JSON.stringify(cellsCopy)}, not the 11-block 1,209-unit one`);
}
if (cellsCopy.sha256 !== '2d384cf423b8c9a6478aee8b5df8af9b2706b3141f2773d1af3e796793fd4211') {
  throw new Error('the cells copy is not the one this package measured');
}
const blitCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-ui-blit-source.ts'));
if (!blitCopy || blitCopy.blocks !== 7 || blitCopy.units !== 7852) throw new Error('the blit copy changed size');
const mountCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-raster-mount-source.ts'));
if (!mountCopy || mountCopy.blocks !== 2 || mountCopy.units !== 541) throw new Error('the mount copy changed size');
const runnerCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-source.ts'));
if (!runnerCopy || runnerCopy.blocks !== 73 || runnerCopy.units !== 26233) throw new Error('the chain-runner copy changed size');
if (runnerCopy.sha256 !== '58c01b12f6b607e55a7568d11afb4120588721aa5d9637f979bb0ca42d0c7eff') {
  throw new Error('the chain-runner copy is not the one this package imports through');
}

const ledger = JSON.parse(read('src/plugin-chain-raster-cells-source-blocks.json'));
const expectedBlocks = [
  ['chunk-n3ykh62m.js', 248693, 248705, 12],
  ['chunk-n3ykh62m.js', 248715, 248812, 97],
  ['chunk-n3ykh62m.js', 252131, 252200, 69],
  ['chunk-n3ykh62m.js', 252243, 252256, 13],
  ['chunk-n3ykh62m.js', 252455, 252481, 26],
  ['chunk-n3ykh62m.js', 252898, 253057, 159],
  ['chunk-n3ykh62m.js', 253816, 253943, 127],
  ['chunk-n3ykh62m.js', 253969, 254367, 398],
  ['chunk-n3ykh62m.js', 256690, 256712, 22],
  ['chunk-n3ykh62m.js', 257058, 257143, 85],
  ['chunk-nyce03br.js', 87140, 87341, 201],
];
if (ledger.blocks.length !== 11) throw new Error(`the cells ledger holds ${ledger.blocks.length} blocks`);
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 1209) throw new Error(`the cells ledger holds ${units} units`);
if (ledger.missing.length !== 0) throw new Error('the cells ledger reports missing names');
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
const copyText = read('src/plugin-chain-raster-cells-source.ts');
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

// The engine's neighbours are the point of the exclusions: they sit inside these runs and are not
// copied, so the copy must not declare them.
const module3 = sources.get('chunk-n3ykh62m.js');
const declaredName = (moduleText, node) => {
  const slice = moduleText.slice(node.start, node.start + 200);
  const match = /^(?:var|let|const|function)\s+([A-Za-z_$][\w$]*)/.exec(slice);
  return match?.[1];
};
const named = new Map(statements.get('chunk-n3ykh62m.js')
  .map((node) => [declaredName(module3, node), node])
  .filter(([name]) => name !== undefined));
for (const neighbour of ['nb', 'fc', 'Ff', 'pc', 'Sc', 'gb', 'hb']) {
  if (new RegExp(`(function|var|let|const)\\s+${neighbour}\\b`).test(copyText)) {
    throw new Error(`the cells copy declares ${neighbour}, a constant of the engine that follows`);
  }
  const node = named.get(neighbour);
  if (!node) throw new Error(`${neighbour} is no longer a statement of the module`);
  const body = module3.slice(node.start, node.end);
  if (copyText.includes(body)) throw new Error(`${neighbour} was copied after all`);
}
// The one foreign body, and the single free name it needs.
const kbr = sources.get('chunk-nyce03br.js').slice(87140, 87341);
if (!copyText.includes(kbr)) throw new Error('`Kbr` is not in the copy verbatim');
if (!kbr.startsWith('function Kbr(e,t,o){if(!(h$(e)&&e>=1&&e<=o.columns))')
  || !kbr.endsWith('return h$(t)&&t>=1&&t<=o.rows?void 0:`rows must be a whole number from 1 to ${o.rows}`}')) {
  throw new Error('the size check is not the measured `Kbr`');
}
const hDollar = sources.get('chunk-nyce03br.js').slice(38157, 38216);
if (hDollar !== 'var h$=(e)=>typeof e==="number"&&Number.isInteger(e)&&e>=0;') throw new Error('the `h$` body moved in its module');
if (copyText.includes('var h$=')) throw new Error('the cells copy declares `h$` instead of importing it');
if (!copyText.includes("import { Ge, h$ } from './plugin-chain-source.js';")) throw new Error('the cells copy does not import the chain-runner bodies');
// `Ge` is an identity in this build — the source's own body, not a stub this product wrote.
const geBody = read('extracted-v2/modules/chunk-ae84tp6z.js').slice(5355, 5381);
if (geBody !== 'function Ge(t,e){return t}') throw new Error('the memoizer is no longer the identity body this package measured');
if (!registry.includes("['W45-chain-runner', 'plugin-chain-source']")) throw new Error('the chain-runner plan is not registered');
if (!read('src/plugin-chain-source.ts').includes(geBody)) throw new Error('the chain-runner copy no longer carries `Ge`');
if (!read('research/ports/W45-chain-runner-blocks.plan.json').includes('"h$"')) {
  throw new Error('the chain-runner plan no longer exports `h$`, which `Kbr` needs');
}
// The bodies the run reads, quoted from the module at the measured boundaries.
for (const [start, end, head] of [
  [253828, 253866, 'var fb=()=>({tokens:bc,refilledAt:0});'],
  [253866, 253943, 'var mb=Ge(()=>it().rasterAdmission??=fb(),()=>{it().rasterAdmission=void 0});'],
  [254123, 254367, 'function $f(e,n,r){let{redShift:s,greenShift:h,channelMax:y}=Gn;'],
  [257058, 257102, 'var tF=(e,n)=>Kbr(e,n,{columns:bb,rows:wb});'],
]) {
  const body = module3.slice(start, end);
  if (!body.startsWith(head)) throw new Error(`[${start},${end}) is not the measured body`);
  if (!copyText.includes(body)) throw new Error(`[${start},${end}) is not in the copy verbatim`);
}
if (module3.slice(253980, 254123) !== 'function Sb(e,n,r){e.tokens=Math.min(bc,e.tokens+Math.max(0,n-e.refilledAt)*yb/tb),e.refilledAt=n;let s=e.tokens-r>=1;return e.tokens-=s?1:0,s}') {
  throw new Error('the refill is not the measured `Sb`');
}

// The seam: the bodies quoted in its header with their ranges, the names a surface calls, and the
// registry row it types against.
const seam = read('src/plugin-chain-raster-cells.ts');
for (const body of [module3.slice(248693, 248705), module3.slice(253828, 253943), module3.slice(253980, 254367), module3.slice(257058, 257143), kbr]) {
  if (!seam.includes(body)) throw new Error('the seam header does not quote one of the copied bodies');
}
for (const range of ['[248693,248812) 109 units', '[252131,252200) 69', '[252898,253057) 159', '[253816,253943) 127 units and [253969,254367) 398', '[256690,256712) 22 and [257058,257143) 85', '[87140,87341) 201 units']) {
  if (!seam.includes(range)) throw new Error(`the seam header does not cite ${range}`);
}
for (const name of ['freshRasterAdmission', 'rasterAdmission', 'admitRasterFrame', 'encodeCell', 'foregroundHalf', 'backgroundHalf', 'validateRasterSize', 'validateDefaultRasterSize', 'CELL_WORDS', 'CHANNEL_LAYOUT', 'DEFAULT_CHANNEL', 'COLOUR_HALVES', 'RASTER_ADMISSION_CAPACITY', 'RASTER_TOKENS_PER_SECOND', 'RASTER_REFILL_MS', 'DEFAULT_RASTER_COLUMNS', 'DEFAULT_RASTER_ROWS', 'SITE_MOUNT_FIELDS']) {
  if (!seam.includes(name)) throw new Error(`the seam does not export ${name}`);
}
if (!seam.includes("export { $f, Kbr, Lr, Sb, Xto, bb, bc, dc, fb, gn, Gn, mc, mb, tF, tb, wb, yb, ys } from './plugin-chain-raster-cells-source.js';")) {
  throw new Error('the seam does not re-export the copied bodies under their source names');
}
const registryState = read('src/plugin-chain-registry-state.ts');
for (const name of ['RasterAdmission', 'rasterAdmission']) {
  if (!registryState.includes(name)) throw new Error(`the registry state does not carry ${name}`);
}
if (!registryState.includes('rasterAdmission?: RasterAdmission;')) throw new Error('the admission row is not optional, as the source\'s `void 0` is');
const suite = read('test/plugin-chain-raster-cells.test.ts');
for (const name of ['admitRasterFrame', 'encodeCell', 'validateDefaultRasterSize', 'freshRasterAdmission']) {
  if (!suite.includes(name)) throw new Error(`the suite does not exercise ${name}`);
}
if (suite.includes('plugin-chain-raster-cells-source.js') && !suite.includes('mb } from')) {
  throw new Error('the suite reaches past the seam to the copy');
}

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-60-tests.txt');
if (full.failed !== 0 || full.tests !== 1581) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-60-family.txt');
if (family.failed !== 0 || family.tests !== 305) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const cellsSweep = summary('.audit/w45-60-raster-cells.txt');
if (cellsSweep.failed !== 0 || cellsSweep.tests !== 11) throw new Error('the cells sweep is not clean');
const scanSweep = read('.audit/w45-60-scan.txt');
if ((scanSweep.match(/unresolved 0/g) ?? []).length !== 2) throw new Error('the two scanned copies did not scan clean');
const span = JSON.parse(read('.audit/w45-60-span.txt'));
if (span.total !== 0) throw new Error(`the span scan found ${span.total}`);
const notices = JSON.parse(read('.audit/w45-60-notices.txt').split('\n').filter((line) => line.startsWith('{')).at(-1));
if (notices.sha256 !== '384c78801194aedea80331383ccd93708c2dfa46bc746003dc112c930b73d13c') {
  throw new Error('the dependency-notice digest moved');
}
const smokeReport = read('.audit/w45-60-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 292) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const allMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
const sharedMarkers = read('.audit/w45-60-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-60-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45RasterCellsCompiled.v1')) throw new Error('the shared driver did not print the W45-60 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45RasterCellsCompiled.v1 (${sharedMarkers.length} markers, ${allMarkers.length} across every driver: it reads the admission row out of the registry, admits frames against a clock — the one token a frame costs, the cost as a reserve, the refusal that spends nothing and the refill — encodes both packed halves into a cell, and drives the size check's two sentences)`;

const evidence = {
  schema: 'W45RasterCellsEvidence.v1',
  package: 'W45-60 — the raster cell encoder and the admission bucket',
  date: '2026-10-16',
  question: 'What turns a frame into cells, and what admits it — the pieces a surface paints through between the registries W45-59 fills and the engine that drives them?',
  answer: 'A cell is eight words (`gn`, chunk-n3ykh62m.js [252898,253057) 159 units): a flag and three channels for the foreground at 0..3, then the same four for the background at 4..7, written by `$f` ([254123,254367) 244 units) from one packed colour pair — `mc` takes the low half as the foreground and `dc` the high half as the background over `Lr`, and each channel is the four bits at its shift (`Gn`: green at 4, red at 8, max 15). A channel equal to the sentinel `ys` (32768) is written as the default flag 1 with its channels cleared. A frame is admitted by `Sb` ([253980,254123) 143 units), which refills a row against a clock — `Math.min(bc, tokens + max(0, now - refilledAt) * yb / tb)`, that is 160 tokens a second over a 1000 ms base, capped at the 4096-token capacity, and never backwards — records the clock, then admits the frame only when `tokens - cost >= 1` and spends exactly ONE token; the cost is a reserve that must be left behind, not a price, and a refused frame spends nothing. The row lives in the host registry as `rasterAdmission`, built on the first read by `mb` ([253866,253943) 77 units) through `fb` ([253828,253866) 38 units, `{tokens: bc, refilledAt: 0}`). A site checks its key and size with `tF` ([257058,257102) 44 units), which calls `Kbr` (chunk-nyce03br.js [87140,87341) 201 units) against the default 512 by 256, and `Kbr` answers `columns must be a whole number from 1 to N` or the same for `rows`, checking columns first.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  planExtensions: [
    {
      plan: 'research/ports/W45-raster-cells-blocks.plan.json',
      what: 'a new plan, eleven blocks and eighteen exports',
      blocks: '0 → 11 blocks, 1,209 units',
      why: 'the encoder and the bucket are two runs of chunk-n3ykh62m.js, the validating mount a third, and the size check one statement of the chain-runner module; the constants each one closes over sit in their own small runs (the layout is 3,319 units away from the mount writers, so one block per run rather than one span)',
    },
  ],
  boundary: 'No new boundary and no new host hook. `Ge` and `h$` come from the chain-runner copy, which carries both: `Ge` is that copy\'s own body at chunk-ae84tp6z.js [5355,5381) 26 units — an identity in this build, so `mb` is the factory it was handed and the invalidator beside it is dropped by the source itself, which is why the accessor has no reset — and `h$` (chunk-nyce03br.js [38157,38216) 59 units, `var h$=(e)=>typeof e==="number"&&Number.isInteger(e)&&e>=0;`) is a body that copy has carried since W45-58 exported it, which is exactly what `Kbr` needs. `it` is the host copy. The row is typed by ./plugin-chain-registry-state.ts as an optional `RasterAdmission`, matching the source literal\'s `rasterAdmission: void 0`.',
  measured: [
    'A fresh row is `{tokens: 4096, refilledAt: 0}`; `rasterAdmission()` writes it into `it().rasterAdmission` on the first read and answers that same object on every later read; clearing the field makes the next read build a new one.',
    'The accessor carries no reset: `mb.reset` is undefined and `mb` has no own keys, because `Ge(t, e)` returns `t` — the invalidator is dropped by the source, not by this port.',
    'One admitted frame costs exactly one token however large the cost argument is: with a full row, cost 0, cost 1024 and cost 4095 each admit and leave 4095. The cost is a reserve: a frame is admitted only when `tokens - cost >= 1`.',
    'A refused frame spends nothing: a full row asked for cost 4096 answers false and keeps 4096 tokens; an empty row asked for cost 0 answers false and keeps 0.',
    'The refill is proportional and capped: half a second at 10 tokens admits (10 + 80 = 90, less the one spent, leaving 89); a second from empty adds exactly 160 and then refuses a reserve of 160, leaving 160; a hundred seconds from empty still holds 4096 (the capacity) and refuses a reserve of 4096; a clock that went backwards adds nothing but is still recorded, so the row\'s clock moves back.',
    'The encoder writes the foreground from the low half and the background from the high half: `0x1234 | (0xabcd << 16)` becomes `[0, 2, 3, 4, 0, 11, 12, 13]` — the four bits at each shift, neither side a default — and the halves read back as 0x1234 and 0xabcd.',
    'The sentinel marks the field it is passed as, and only that field: the whole pair set to 32768 marks the foreground default (word 0 becomes 1, its channels 0) while the background default word stays 0, because `dc(32768)` is 0; a background default needs the sentinel in the high half. A cell is written at `index * 8`, leaving its neighbours untouched.',
    'The size check answers by field: a whole number in `1..limit` passes, and 0, limit+1, a fraction and `NaN` all fail; when both fields are bad the columns sentence is the answer, because columns is checked first. A numeric string fails.',
    'The default size is the source\'s own 512 by 256, and `tF` takes no other: the seam\'s `validateDefaultRasterSize` passes `{columns: bb, rows: wb}` rather than a limit argument.',
    'What the engine that follows needs is deliberately not copied: `nb` (64), `fc`, `Ff`, `pc`, `Sc` (1024), `gb` (1024) and `hb` (131072) all sit inside or beside these runs and are asserted absent from the copy — `gb` and `hb` are the costs `gNs` passes to `Sb`, so they belong to that engine, and `Sc`/`hb` are its slot limits.',
  ],
  regressions: `the new encoder suite ${cellsSweep.passed}/${cellsSweep.tests}; ${familyLine}`,
  full: fullLine,
  compiled: driverLine,
  smoke,
  next_package: [
    'the surface engine that drives all of this, measured while writing this package: `gNs` (chunk-n3ykh62m.js [254367,256143) 1,776 units — `function gNs(e=Date.now,n=mb())`), its slot and alias bookkeeping, and the two bodies beside it, `_b` ([256143,256382) 239 units) and `Lss` ([256382,256690) 308 units, which calls `r.beginPaint(...)`), with `db` ([253451,253816) 365 units) and the constants they own (`nb`, `fc`, `Ff`, `pc`, `Sc`, `gb`, `hb`, `ub`); its closure measured 31 statements / 4,211 units and reaches `fl` in chunk-yn0pfn70.js',
    'the site components that call all of it: `tF` is called at chunk-n3ykh62m.js 257441, just past this package\'s last block, and the Raster/Image site components are `Tc(jo, …)` in chunk-kjfwbh4w.js — the React layer becomes a seam over these bodies, as W45-38 did for the bar',
    'the remaining `$` table entries, each measured the same way first: `ui.scroll` (`O5n` 194u + `L5n` 808u + `mVe` 54u + `Nye` 39u), `ui.focus` (`fzo` 202u + `Szo` 532u + `mVe`), `ui.copy` (`wGo`/`uzo`/`dzo`, blocked on the clipboard encoder `Sv`), `state.get`/`state.set` (`Pur`/`Our`, `Iur`/`$ss`/`Hur`), `fs.ancestors` (`kNs` 492u)',
    'the plugin-facing `$` dispatcher `G2e` (chunk-sfn1dbxq.js [2356082,…)), the path that applies `raise` then `stamp` then `run`',
    'the settings read path behind `y9e` — measured at 590 statements / 327,047 units, of which 318,262 are fresh, so it is a subsystem to walk in pieces; the managed-settings gate `CT` (chunk-4bw62nzm.js) and `Tp` (chunk-wtch2p0g.js, 263u); Q-086\'s 15 registry-reading cores and their 34 sites; the notification provider `a4n`',
  ],
};
write('research/ports/W45-raster-cells-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-60 **补',
  features: "; W45-60 ports the raster cell encoder",
  standard: '2026-10-16 W45-60 ',
  status: 'W45-60:',
  runner: '## W45-60 ported the raster cell encoder and the admission bucket',
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
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-60 **补光栅格子编码与准入桶**（表面把一帧变成格子、以及谁放行这一帧）：**11 段 1,209 单位**——chunk-n3ykh62m.js 十段（[248693,248705) 12u \`tb\`；[248715,248812) 97u 半字 \`Lr\`/\`dc\`；[252131,252200) 69u 通道 \`Gn\`；[252243,252256) 13u 哨兵 \`ys\`；[252455,252481) 26u \`mc\`；[252898,253057) 159u 格字布局 \`gn\`；[253816,253943) 127u 桶 \`bc\`/\`fb\`/\`mb\`；[253969,254367) 398u 补充器 \`Sb\` 与编码器 \`$f\`；[256690,256712) 22u 默认尺寸 \`bb\`/\`wb\`；[257058,257143) 85u 校验挂载 \`tF\`/\`Xto\`）+ chunk-nyce03br.js [87140,87341) 201u（\`Kbr\` 尺寸检验）。**语义（源文实测）**：一格是**八个字**（前景"默认位+三通道"0..3、背景同构 4..7），\`$f\` 从**一个打包色对**写入——低半是前景（\`mc\`）、高半是背景（\`dc\`，走 \`Lr\`），每通道取各自移位的四位（\`Gn\`：绿 4、红 8、满 15）；通道等于哨兵 \`ys\`(32768) 时写"默认位 1 + 通道清零"。**准入**：\`Sb\` 按钟补充 \`min(bc, tokens + max(0, now-refilledAt)*yb/tb)\`（**每秒 160 个**、基数 1000ms、上限 4096、时钟倒退不补），记下时钟，仅当 \`tokens-cost>=1\` 放行，且**只扣一个令牌**——**cost 是"必须留住的余量"而不是价格**，被拒的帧不扣。行存在宿主注册表 \`rasterAdmission\`，\`mb\` 首次读取经 \`fb\` 建 \`{tokens:bc,refilledAt:0}\`。**两处非显然、按实测断言**：① 上述"余量非价格"；② \`ys\` 传整对时**只标记前景**默认（\`dc(32768)=0\`），背景默认需把哨兵放高半。**关键取舍**：\`Ge\`/\`h$\` 取 chain-runner 副本——\`Ge\` 是该副本自己的正文（chunk-ae84tp6z.js [5355,5381) 26u，**本 build 里是恒等** \`function Ge(t,e){return t}\`），故 \`mb\` 就是它接到的工厂、旁边的失效器**由源自己丢弃**（记录断言 \`mb.reset===undefined\` 且 \`mb\` 无自有键）；\`h$\` [38157,38216) 59u（\`var h$=(e)=>typeof e==="number"&&Number.isInteger(e)&&e>=0;\`）正是 \`Kbr\` 唯一自由名。**引擎的邻常量不搬并断言缺席**：\`nb\`(64)/\`fc\`/\`Ff\`/\`pc\`/\`Sc\`(1024)/\`gb\`(1024)/\`hb\`(131072) 就夹在这些段之间，属 \`gNs\`。注册表类型新增可选 \`RasterAdmission\`（对应源字面量 \`rasterAdmission:void 0\`）。验收：check/build/notices（摘要未变）、两副本 \`unresolved 0\`、span \`total 0\`、**${chain}**、cells 账本 11 段逐段回源 + acorn（完整语句、无重叠、无切半、无重复）+ **七个邻常量"段在模块中、正文不在副本"双向断言** + \`Kbr\`/\`h$\`/\`Ge\` 回源与"副本不自声明"断言 + 四个正文与坐标引用逐字、新回归 ${cellsSweep.passed}/${cellsSweep.tests}、家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45RasterCellsCompiled.v1\`，共享 ${sharedMarkers.length} 标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [格子编码证据](ports/W45-raster-cells-evidence.json)、[挂载侧证据](ports/W45-raster-mount-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
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
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-60 ports the raster cell encoder and the ` +
  'admission bucket a surface paints its frames through: the eight-word cell layout, the packed colour pair the foreground and ' +
  'background come from, the token row that refills against a clock and admits a frame by leaving a reserve behind, the ' +
  'registry row it lives in, and the whole-number size check a validating mount runs against the default 512 by 256. |';
write('research/FEATURES.md', lines.join('\n'));

const standardText = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standardText.indexOf('2026-10-16 W45-59');
if (standardAt < 0) throw new Error('coding-standard W45-59 line not found');
const standardEntry = `2026-10-16 W45-60 光栅格子编码与准入桶：S-1至S-7已对照。S-1（先读源）：先量闭包——\`fb mb Sb $f\` 得 6 段/293u（\`$f\` 不在其中，它自成闭包 7 段/608u），\`tF Xto\` 得 4 段/107u，\`Kbr\` 单段 201u；**十一个正文逐字读过再动手**（\`mb\` 的 \`??=\`、\`Sb\` 的 \`Math.min(bc,…)\` 与 \`e.tokens-=s?1:0\`、\`$f\` 的 \`b(w,R)\` 双层写入、\`Kbr\` 的两句文案）。**关键取舍**：① \`Ge\` 经回源确认是 chain-runner 副本**自己的正文**（chunk-ae84tp6z.js [5355,5381) 26u，sha 19b806bd…，本 build 里 \`function Ge(t,e){return t}\` 恒等），故 \`mb\` 的失效器**由源自己丢弃**——不是本产品的改写，记录断言 \`mb.reset===undefined\`；② \`h$\`（\`Kbr\` 唯一自由名）该副本早已是 \`var h$=(e)=>typeof e==="number"&&Number.isInteger(e)&&e>=0;\`，W45-58 已把它加进导出表，故直接 import；③ **引擎的七个邻常量**（\`nb\`/\`fc\`/\`Ff\`/\`pc\`/\`Sc\`/\`gb\`/\`hb\`）夹在这些段之间，**不搬**——记录脚本双向断言"它们在模块里仍是语句"且"其正文不在副本中"，块因此拆成十段而非一整跨。S-2（不留半包）：新边界零、新宿主钩子零；引擎 \`gNs\`(1,776u)/\`_b\`/\`Lss\`/\`db\` 与站点组件按实测坐标写进 next_package。S-3（先测后断言）：\`.audit/w45-60-probe.ts\` 先跑再写 11 条断言；**两处非显然性质由实测得出并被断言**——① \`Sb\` 的 cost 是**余量**不是价格（cost 0/1024/4095 都只扣一个令牌，cost 等于 tokens 则拒），首版按"价格"直觉会写错；② \`ys\` 传整对只标记**前景**默认（\`dc(32768)=0\`），背景默认需哨兵在高半。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器（59 计划）与 ${drivers.length} 个编译驱动并解析输出，断言两副本 \`unresolved 0\`、span \`total 0\` 与 notices 摘要未变；acorn（完整语句、无重叠、无切半、无重复）+ 十一正文回源 + \`Kbr\`/\`h$\`/\`Ge\` 三处回源 + "副本不自声明 \`h$\`/邻常量" 断言 + 坐标引用逐字 + 注册表可选类型判据。S-5/S-6：seam 加八个按名包装（\`freshRasterAdmission\`/\`rasterAdmission\`/\`admitRasterFrame\`/\`encodeCell\`/\`foregroundHalf\`/\`backgroundHalf\`/\`validateRasterSize\`/\`validateDefaultRasterSize\`）、十个常量具名、并按源名再导出十八个正文；测试只经 seam（唯一例外是\`mb\`：为断言"无 reset"而直接读该绑定，已在记录中写明）。S-7：引擎、站点组件、其余 \`$\` 表项、\`G2e\`、\`y9e\` 读路径写入 next_package。验收：check/build/notices、两副本 unresolved 0、${chain}、账本与正文自证、回归 ${cellsSweep.passed}/${cellsSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standardText.slice(0, standardAt) + standardEntry + standardText.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf('W45-59: the mount side of the raster surface');
if (statusAt < 0) throw new Error('STATUS W45-59 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = 'W45-60: the raster cell encoder and the admission bucket — what a surface paints a frame with, and what admits it. ' +
  'Eleven blocks, 1,209 units, ten of them runs of chunk-n3ykh62m.js and the last `Kbr`, the whole-number size check, in the ' +
  'chain-runner module. A cell is eight words: a flag and three channels for the foreground, then the same four for the background, ' +
  'written by `$f` from one packed pair whose low half is the foreground (`mc`) and whose high half is the background (`dc`), with ' +
  'the sentinel `ys` marking the side it is passed as. A frame is admitted by `Sb`, which refills the row against a clock (160 ' +
  'tokens a second over a 1000 ms base, capped at 4096, never backwards), records the clock, and admits only when `tokens - cost >= 1` ' +
  '— spending exactly one token however large the cost is, so the cost is a reserve to be left behind rather than a price, and a ' +
  'refused frame spends nothing. The row lives in the host registry as `rasterAdmission`, built on the first read by `mb`; the ' +
  'source hands the memoizer an invalidator, but `Ge` is `function Ge(t,e){return t}` — the chain-runner copy\'s own body, an ' +
  'identity in this build — so that invalidator is dropped by the source itself and the accessor has no reset. `tF` checks a key and ' +
  'size against the default 512 by 256 through `Kbr`, whose only free name is `h$`, a body the chain-runner copy already carries and ' +
  'W45-58 exported. The engine\'s own neighbours — `nb`, `fc`, `Ff`, `pc`, `Sc`, `gb`, `hb` — sit inside these runs and are ' +
  'deliberately not copied; the record asserts both that they are still statements of the module and that their bodies are absent ' +
  'from the copy. Evidence: `research/ports/W45-raster-cells-evidence.json`, and\n[工作包](ports/W45-chain-runner.md).\n\n';
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-60 ported the raster cell encoder and the admission bucket (2026-10-16)

W45-58 ported what reads the registries and W45-59 what fills them. This package ports what a surface paints a frame *with*, and
what admits the frame: eleven blocks, 1,209 units.

A cell is eight words (\`gn\`, [252898,253057) 159 units): a default flag and three channels for the foreground at 0..3, then the
same four for the background at 4..7. \`$f\` ([254123,254367) 244 units) writes one from a single packed colour pair — \`mc\` takes
the low half as the foreground, \`dc\` the high half as the background, over \`Lr\` — and each channel is the four bits at its shift
(\`Gn\`: green at 4, red at 8, maximum 15). A channel equal to the sentinel \`ys\` (32768) is written as the default flag with its
channels cleared, and it marks only the field it is passed as: the whole pair set to the sentinel marks the foreground, because
\`dc(32768)\` is 0, so a background default needs it in the high half.

A frame is admitted by \`Sb\` ([253980,254123) 143 units), which refills the row against a clock and spends one token:
\`tokens = min(4096, tokens + max(0, now - refilledAt) * 160 / 1000)\`, the clock recorded, then \`tokens - cost >= 1\` decides and
\`tokens -= spent ? 1 : 0\`. The cost is therefore a reserve the row must keep, not a price: with a full row, cost 0, cost 1024 and
cost 4095 each admit and each leave 4095, while a cost equal to the tokens is refused and a refused frame spends nothing. That
distinction is the one a reader is most likely to get backwards, and the suite asserts it field by field. The row itself is \`fb\`'s
\`{tokens: 4096, refilledAt: 0}\`, held in the host registry as \`rasterAdmission\` and built on the first read by \`mb\`
([253866,253943) 77 units) through \`it().rasterAdmission ??= fb()\`.

\`mb\` is worth reading twice. The source writes \`Ge(() => it().rasterAdmission ??= fb(), () => { it().rasterAdmission = void 0 })\`,
which reads as a memoized row with an invalidator — but \`Ge\` is \`function Ge(t,e){return t}\` (chunk-ae84tp6z.js [5355,5381) 26
units, a body the chain-runner copy already carries), an identity in this build, so the binding *is* the factory and the
invalidator is dropped by the source itself. There is no reset through the accessor; a caller that wants the row gone clears the
registry field. The suite asserts that, rather than assuming the memoizer the call reads like.

The last two blocks are the validating mount: \`bb\`/\`wb\` the default 512 by 256, \`tF\` ([257058,257102) 44 units) which passes those
as the limit, and \`Xto\`, the field list a mount admits. Its check \`Kbr\` is the one foreign body (chunk-nyce03br.js [87140,87341)
201 units), and it needs exactly one free name, \`h$\` — a body that copy has carried since W45-58 exported it, so nothing here
reaches a new boundary.

What was *not* copied matters as much. \`nb\` (64), \`fc\`, \`Ff\`, \`pc\`, \`Sc\` (1024), \`gb\` (1024) and \`hb\` (131072) sit inside or
immediately beside these runs and belong to the engine that follows — \`gb\` and \`hb\` are the costs \`gNs\` passes to \`Sb\`, and
\`Sc\`/\`hb\` its slot limits — so the plan takes ten small blocks rather than one span, and the record asserts both that each is
still a statement of the module and that its body is absent from the copy.

Verified: check/build/notices, both scanned copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, all eleven blocks re-read from
their modules and matched against the copy with acorn (whole statements, contiguous, no cut, no repetition), the seven excluded
neighbours asserted absent, \`Kbr\`, \`h$\` and \`Ge\` re-read from their modules with the copy asserted not to declare them, the
bodies and their ranges quoted verbatim in the seam header, the new suite ${cellsSweep.passed}/${cellsSweep.tests}, ${familyLine},
full ${fullLine}, ${drivers.length} compiled drivers (the shared driver now also prints \`W45RasterCellsCompiled.v1\`), and the packaged smoke
(${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: the surface engine that drives all of this — \`gNs\` at chunk-n3ykh62m.js [254367,256143) 1,776 units (\`function gNs(e=Date.now,n=mb())\`)
with \`_b\` ([256143,256382) 239 units) and \`Lss\` ([256382,256690) 308 units, which calls \`r.beginPaint(...)\`), plus \`db\`
([253451,253816) 365 units) and the constants they own; its closure measured 31 statements / 4,211 units and reaches \`fl\` in
chunk-yn0pfn70.js. Then the site components that call these bodies (\`tF\` is called at 257441, and the Raster/Image sites are
\`Tc(jo, …)\` in chunk-kjfwbh4w.js — the React layer becomes a seam, as W45-38 did for the bar), the remaining \`$\` table entries
(\`ui.scroll\`, \`ui.focus\`, \`ui.copy\`, \`state.get\`/\`state.set\`, \`fs.ancestors\`) and the dispatcher \`G2e\`. The settings read path
behind \`y9e\` stays the measured subsystem: 590 statements / 327,047 units, 318,262 of them fresh.
`);

const rows = [
  ['2026-10-17T09:04:00Z', 'package', 'W45-60 补光栅格子编码与准入桶（一帧怎么写成一个格子、谁放行这一帧：11 段 1,209 单位 = n3ykh62m 十段 1,008u + nyce03br 的 Kbr 201u）',
    'freshRasterAdmission/rasterAdmission/admitRasterFrame/encodeCell/foregroundHalf/backgroundHalf/validateRasterSize/validateDefaultRasterSize 成为产品面，十个常量具名（CELL_WORDS/CHANNEL_LAYOUT/DEFAULT_CHANNEL/COLOUR_HALVES/RASTER_ADMISSION_CAPACITY/RASTER_TOKENS_PER_SECOND/RASTER_REFILL_MS/DEFAULT_RASTER_COLUMNS/DEFAULT_RASTER_ROWS/SITE_MOUNT_FIELDS）；注册表类型新增可选 RasterAdmission',
    'chunk-n3ykh62m.js [248693,248705) 12u + [248715,248812) 97u + [252131,252200) 69u + [252243,252256) 13u + [252455,252481) 26u + [252898,253057) 159u + [253816,253943) 127u + [253969,254367) 398u + [256690,256712) 22u + [257058,257143) 85u；chunk-nyce03br.js [87140,87341) 201u',
    `实测（.audit/w45-60-probe.ts 与 test/plugin-chain-raster-cells.test.ts + .audit/w45-24-compiled.mjs）：十一个常量、八字格布局、行首读即建且恒同、无 reset、扣一个令牌、cost 为余量非价格、拒帧不扣、补充按比例/封顶/时钟倒退不补、编码两半与哨兵只标一侧、按字段报错且列先于行；11/11 通过`],
  ['2026-10-17T09:09:00Z', 'finding', 'W45-60 两处非显然性质（按实测断言，不按直觉写）',
    '① Sb 的 cost 是"必须留住的余量"而非价格：\`tokens-cost>=1\` 决定放行，放行后一律只扣 1 个令牌（cost 0/1024/4095 在满行上结果相同），cost 等于 tokens 则拒；② ys 传整对只标记前景默认（dc(32768)=0），背景默认必须把哨兵放高半',
    '两条都写进测试（"the cost is a reserve that must be left behind, not a price" 与 "the default sentinel marks the side it is passed as"）并写进证据 measured 第 3/7 条',
    '回归 11/11；编译驱动同断言（dist）'],
  ['2026-10-17T09:13:00Z', 'decision', 'W45-60 取舍：Ge 是副本自己的恒等正文、h$ 早已导出、引擎的七个邻常量不搬并双向断言',
    '① Ge 经回源确认为 chunk-ae84tp6z.js [5355,5381) 26u（sha 19b806bd…）且本 build 为 \`function Ge(t,e){return t}\`，故 mb 的失效器由源自己丢弃——不是本产品的改写；② Kbr 唯一自由名 h$ 是 chain-runner 副本 [38157,38216) 59u 且 W45-58 已导出；③ nb/fc/Ff/pc/Sc/gb/hb 夹在这些段之间但属 gNs',
    '计划取十个小段而非一整跨；记录脚本新增双向断言"七个邻常量在模块里仍是语句"且"其正文不在副本中"，并断言 mb.reset===undefined、mb 无自有键',
    `chain ${chain}；cells 副本 11 段 1,209 单位 sha 2d384cf4…`],
  ['2026-10-17T09:17:00Z', 'verification', `W45-60 验收：两副本 unresolved 0、span total 0、cells 账本 11 段逐段回源 + acorn（无重叠/无切半/无重复）+ 七个邻常量双向断言 + Kbr/h$/Ge 回源与"副本不自声明"、${chain}、回归 ${cellsSweep.passed}/${cellsSweep.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '光栅面闭环：格子（$f）、准入（Sb/mb）、校验挂载（tF/Kbr）就位，下一包转引擎 gNs(1,776u)/_b/Lss/db 与站点组件 Tc(jo,…)',
    `check/build/notices；两副本 unresolved 0；span total 0；${chain}；cells 账本 11 段逐段回源比长度与内容 + acorn + 无重复断言；七个邻常量双向；Kbr/h$/Ge 回源；seam 判据（八个包装 + 十个常量 + 按源名再导出 18 个）；注册表可选类型判据；回归 11/11；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45RasterCellsCompiled.v1，共享 ${sharedMarkers.length} 标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-60 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-60 acceptance (2026-10-16)

- [x] **The queue picked the package.** W45-59's record named the encoder family as the next package with measured coordinates; this package ported exactly those bodies plus the one check they depend on.
- [x] **The whole chain came across.** Eleven blocks, 1,209 units: the cell layout and the encoder, the bucket and its row, the validating mount, and the size check — with the engine's own neighbouring constants left out and asserted absent both ways.
- [x] **Obtainable source was copied, not bound.** \`Ge\` and \`h$\` come from the chain-runner copy, which carries both, and the copy is asserted not to declare them; \`Ge\` being an identity is the source's own body, re-read from its module rather than assumed.
- [x] **Nothing was invented.** The engine (\`gNs\`, \`_b\`, \`Lss\`, \`db\`) and the site components are recorded as the next package with measured coordinates instead of being guessed at.
- [x] **Everything measured before it was asserted,** and two non-obvious properties fell out of the measurement and are asserted as such: the admission cost is a reserve rather than a price, and the default sentinel marks only the side it is passed as.
- [x] **The exclusions are checked in both directions.** Each of the seven neighbouring constants is asserted to still be a statement of its module and to have its body absent from the copy, so a later reader can see exactly where the boundary was drawn.
- [x] **Sweep.** check/build/notices, both copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, the cells ledger with acorn, the foreign-body and identity-body checks, new suite ${cellsSweep.passed}/${cellsSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
// The state this record leaves behind, read back from disk: one entry per document, and no
// backslash-escaped code span anywhere.
const written = {
  'research/CURRENT.md': 'W45-60 **补',
  'research/STATUS.md': '\nW45-60:',
  'research/coding-standard.md': '\n2026-10-16 W45-60 ',
  'research/ports/W45-chain-runner.md': '\n## W45-60 ported',
  '.audit/w45-runtime.todo.md': '\n## W45-60 acceptance',
};
for (const [path, mark] of Object.entries(written)) {
  const text = read(path);
  const found = text.split(mark).length - 1;
  if (found !== 1) throw new Error(`${path} holds ${found} entries for ${JSON.stringify(mark)}`);
  if ((text.match(/\\`/g) ?? []).length !== 0) throw new Error(`${path} carries a backslash-escaped code span`);
}
const standardLines = read('research/coding-standard.md').split('\n').filter((line) => line.startsWith('2026-'));
if (new Set(standardLines).size !== standardLines.length) throw new Error('the coding standard repeats a one-line entry');
const stamps = read('.audit/w45-runtime.tsv').split('\n').filter((line) => line.startsWith('2026-10-17T09:')).map((line) => line.split('\t')[0]);
if (new Set(stamps).size !== stamps.length) throw new Error('the runtime trail repeats a timestamp');
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
