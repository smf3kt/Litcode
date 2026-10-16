// Write the W45-64 record from the artifacts themselves: the style-prop validators a plugin's props are
// measured against, the value budget the describer walks them with, and the two statements inside the
// package's own span that are deliberately not taken.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 422, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 159, `validation ${identity.validation.files}`);
expect(identity.build.files === 292, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 63) throw new Error('the chain verifier did not pass 63 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const registry = read('scripts/verify-chain-copies.mjs');
if (!registry.includes("['W45-style-props', 'plugin-chain-style-props-source']")) throw new Error('the new plan is not registered');
const at = (needle) => {
  const file = verifier.files.find((entry) => entry.product.includes(needle));
  if (!file) throw new Error(`the verifier does not carry ${needle}`);
  return file;
};
const propsCopy = at('style-props');
if (propsCopy.blocks !== 17 || propsCopy.units !== 3794) throw new Error(`the style-props copy is ${JSON.stringify(propsCopy)}`);
if (propsCopy.sha256 !== '059cdb6ab06e7054656c149771519e388e7e239d4c1d5b2586a91c4e6be749cc') {
  throw new Error('the style-props copy is not the one this package measured');
}
const runnerCopy = at('plugin-chain-source.ts');
if (runnerCopy.blocks !== 73 || runnerCopy.units !== 26233) throw new Error('the runner copy changed size');
const hostCallCopy = at('host-call');
if (hostCallCopy.blocks !== 11 || hostCallCopy.units !== 2155) throw new Error(`the host-call copy is ${JSON.stringify(hostCallCopy)}`);
for (const [needle, blocks, units] of [['site-leaves', 8, 3557], ['raster-sites', 8, 1980], ['raster-surface', 10, 4374]]) {
  const copy = at(needle);
  if (copy.blocks !== blocks || copy.units !== units) throw new Error(`the ${needle} copy changed size`);
}

const ledger = JSON.parse(read('src/plugin-chain-style-props-source-blocks.json'));
const expectedBlocks = [
  [2097, 2198, 101],
  [2208, 2288, 80],
  [2523, 2815, 292],
  [2815, 3407, 592],
  [4004, 4075, 71],
  [4140, 4987, 847],
  [5978, 5990, 12],
  [6016, 6041, 25],
  [6041, 6172, 131],
  [6340, 6358, 18],
  [6358, 6591, 233],
  [87341, 87483, 142],
  [87483, 87576, 93],
  [87576, 87714, 138],
  [87714, 87871, 157],
  [87871, 88707, 836],
  [88772, 88798, 26],
];
if (ledger.blocks.length !== 17) throw new Error(`the style-props ledger holds ${ledger.blocks.length} blocks`);
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 3794) throw new Error(`the style-props ledger holds ${units} units`);
if (ledger.missing.length !== 0) throw new Error('the style-props ledger reports missing names');
for (const [start, end, count] of expectedBlocks) {
  const block = ledger.blocks.find((b) => b.range[0] === start);
  if (!block || block.module !== 'chunk-nyce03br.js' || block.range[1] !== end || block.units !== count) {
    throw new Error(`[${start},${end}) is not in the ledger as ${count} units of chunk-nyce03br.js`);
  }
}

// Every block is re-read from its module, compared with the copy, and checked against acorn: a
// contiguous run of whole top-level statements, no statement cut, no two overlapping.
const moduleText = read('extracted-v2/modules/chunk-nyce03br.js');
let tree;
try { tree = acorn.parse(moduleText, { ecmaVersion: 'latest', sourceType: 'module' }); }
catch { tree = acorn.parse(moduleText, { ecmaVersion: 'latest', sourceType: 'script' }); }
const statements = tree.body.map((node) => ({ start: node.start, end: node.end, node }));
const copyText = read('src/plugin-chain-style-props-source.ts');
const claimed = new Map();
const copied = new Set();
for (const block of ledger.blocks) {
  const [start, end] = block.range;
  if (end - start !== block.units) throw new Error(`${block.range} is not ${block.units} units`);
  const body = moduleText.slice(start, end);
  if (!copyText.includes(body)) throw new Error(`${JSON.stringify(block.range)} is no longer in the copy`);
  const inside = statements.filter((node) => node.start >= start && node.end <= end);
  if (inside.length === 0 || inside[0].start !== start || inside[inside.length - 1].end !== end) {
    throw new Error(`${JSON.stringify(block.range)} does not start and end on statement boundaries`);
  }
  for (let index = 1; index < inside.length; index++) {
    if (inside[index - 1].end !== inside[index].start) throw new Error(`${block.range} skips a statement`);
  }
  if (statements.some((node) => (node.start < start && node.end > end) || (node.start < end && node.end > end))) {
    throw new Error(`${block.range} cuts a statement in half`);
  }
  for (const node of inside) copied.add(node.start);
  const key = block.range.join(',');
  if (claimed.has(key)) throw new Error(`${key} is copied twice`);
  claimed.set(key, true);
}
if (copied.size !== 24) throw new Error(`the seventeen blocks hold ${copied.size} statements, not 24`);

// The two statements of the same module that sit inside this package's span and are referenced by
// nothing in it. They are held out by assertion, so a later package cannot half-take one.
for (const [name, text] of [['Ago', 'var Ago=2;'], ['B3e', 'var B3e="AskUserQuestion";']]) {
  if (!moduleText.includes(text)) throw new Error(`the module no longer carries ${name}`);
  if (copyText.includes(text)) throw new Error(`${name} was taken after all, and the plan split the span around it`);
  if (new RegExp(`(?:^|\\n)(?:function|var) ${name}\\b`).test(copyText)) {
    throw new Error(`${name} was taken after all, under another spelling`);
  }
}
// The bodies are here whole: the table, the validator and every name they read.
for (const [name, statement] of [
  ['Ubr', 'var Ubr=new Set(["dimColor","bold","italic","underline","strikethrough","inverse","borderDimColor"]);'],
  ['rQt', 'var rQt=new Set(PFs);var Cgo=new Set(["color","backgroundColor","borderColor"]);'],
  ['oQt', 'var slt=1e4;var oQt=new Set(["width","height","minWidth","minHeight"]);'],
  ['Vs', 'var Vs=4294967295;'],
  ['Ybr', 'var Ybr=1e5;'],
  ['ESe/AFe', 'var ESe=32;var AFe=20000;'],
  ['Ro', 'var F$n=Ybr;var Xbr=ESe;var Jbr=AFe;var Ro=()=>({nodes:0,chars:0,path:new Set,done:new Map});'],
  ['cN', 'function cN(e){if(e===null)return"null";let t=typeof e==="object";return Array.isArray(e)?"an array":t?"an object":`a ${typeof e}`}'],
  ['cQt', 'var cQt=(e)=>Dt(e,0,Ro());'],
]) {
  if (!copyText.includes(statement)) throw new Error(`the copy does not carry ${name} whole`);
}

// What the copy reaches is imported from the copies that already carry it, never declared here.
const importedNames = {
  './plugin-chain-source.js': ['He'],
  './tui-border.js': ['PFs'],
};
for (const [source, names] of Object.entries(importedNames)) {
  const line = new RegExp(`import \\{ ([^}]*) \\} from '\\./${source.slice(2)}'`).exec(copyText);
  if (!line) throw new Error(`the copy does not import from ${source}`);
  const imported = line[1].split(',').map((name) => name.trim());
  for (const name of names) {
    if (!imported.includes(name)) throw new Error(`the copy does not import ${name} from ${source}`);
    if (new RegExp(`(?:^|\\n)(?:function|var|let|const) ${name.replace('$', '\\$')}\\b`).test(copyText)) {
      throw new Error(`the copy declares ${name} itself instead of importing it`);
    }
  }
}
// ...and both are really there: the error class in the runner's own export list, the border table in
// the tui copy, and the table itself read back to its source.
const runnerPlan = JSON.parse(read('research/ports/W45-chain-runner-blocks.plan.json'));
if (!runnerPlan.exports.includes('He')) throw new Error('the runner plan no longer exports He, which B throws');
const tuiBorder = read('src/tui-border.ts');
if (!/var PFs=Object\.keys\(o\)\.filter\(\(t\)=>K\$n\(t\)!==void 0\);/.test(tuiBorder)) {
  throw new Error('the tui border copy no longer declares PFs the way the source does');
}
if (!tuiBorder.includes('export { K$n, PFs };')) throw new Error('the tui border copy no longer exports PFs');
if (!copyText.includes('var rQt=new Set(PFs);')) throw new Error('the copy no longer builds the border set from PFs');

// The queue's own correction, measured: the `hf` the Link's `Nrt` reaches is the one the host-call
// copy already carries, imported by the site module from that same chunk.
const hostLedger = JSON.parse(read('src/plugin-chain-host-call-source-blocks.json'));
const hfBlock = hostLedger.blocks.find((block) => block.module === 'chunk-ax7r0qj7.js' && block.range[0] === 2243);
if (!hfBlock || !hfBlock.note.includes('hf')) throw new Error('the host-call copy no longer carries hf at [2243,2353)');
const hostText = read('src/plugin-chain-host-call-source.ts');
if (!hostText.includes('function hf(t){if(g)return g(t);return t.replace(a,"\\uFFFD")}')) {
  throw new Error('the host-call copy no longer carries the hf body');
}
if (!read('extracted-v2/modules/chunk-n3ykh62m.js').includes('import{gl,I,Hs,ne,Wl,hf,Qe,Ar,Lt,_c,dU,ep}from"/$bunfs/root/chunk-ax7r0qj7.js"')) {
  throw new Error('the site module no longer imports hf from the host-call module');
}

// The seam: every body quoted verbatim, every range cited, and the names a site check calls.
const seam = read('src/plugin-chain-style-props.ts');
for (const [start, end] of expectedBlocks.map(([start, end]) => [start, end])) {
  if (!seam.includes(moduleText.slice(start, end))) throw new Error(`the seam header does not quote [${start},${end}) verbatim`);
}
for (const range of ['[2097,2198) 101', '[2208,2288) 80', '[2523,2815) 292', '[2815,3407) 592', '[4004,4075) 71',
  '[4140,4987) 847', '[5978,5990) 12', '[6016,6041) 25', '[6041,6172) 131', '[6340,6358) 18', '[6358,6591) 233',
  '[87341,87483) 142', '[87483,87576) 93', '[87576,87714) 138', '[87714,87871) 157', '[87871,88707) 836',
  '[88772,88798) 26']) {
  if (!seam.includes(range)) throw new Error(`the seam header does not cite ${range}`);
}
for (const name of ['TEXT_STYLE_PROPS', 'BORDER_PROPS', 'COLOR_PROPS', 'SPACING_PROPS', 'SIDE_PROPS', 'SIZE_PROPS',
  'PROP_RULES', 'NUMBER_TOLERANCE', 'VALUE_CHAR_LIMIT', 'VALUE_DEPTH_LIMIT', 'VALUE_NODE_LIMIT', 'MAX_LIST_LENGTH',
  'propProblem', 'shortDescription', 'listLength', 'freshWalkBudget', 'valueEntries', 'budgetProblem', 'scalarCost',
  'walkProblem', 'valueProblem']) {
  if (!seam.includes(name)) throw new Error(`the seam does not carry ${name}`);
}
if (!seam.includes('export {\n  AFe, B, Cgo, cN, cQt, ca, Dt, ESe, F$n, fa, Jbr, olt, oQt, Rgo, rQt, Ro, slt, sQt, Ubr, un, Vs, Xbr, xgo, Ybr,\n};')) {
  throw new Error('the seam does not re-export the copied bodies under their source names');
}
if (!seam.includes('export const NUMBER_TOLERANCE = slt;') || !seam.includes('export const MAX_LIST_LENGTH = Vs;')
  || !seam.includes('export const VALUE_DEPTH_LIMIT = ESe;')) {
  throw new Error('the seam hard-codes a constant the copy carries instead of deriving it');
}
if (!/var slt=1e4;/.test(seam) || !/var Vs=4294967295;/.test(seam) || !/var ESe=32;var AFe=20000;/.test(seam)) {
  throw new Error('the seam does not quote the source\'s own numbers');
}
const registryState = read('src/plugin-chain-registry-state.ts');
for (const name of ['WalkBudget', 'LeafProblem']) {
  if (!registryState.includes(name)) throw new Error(`the registry state does not carry ${name}`);
}
const suite = read('test/plugin-chain-style-props.test.ts');
for (const name of ['propProblem', 'shortDescription', 'listLength', 'valueProblem', 'walkProblem', 'budgetProblem',
  'scalarCost', 'freshWalkBudget', 'valueEntries', 'PROP_RULES']) {
  if (!suite.includes(name)) throw new Error(`the suite does not exercise ${name}`);
}
if (suite.includes('plugin-chain-style-props-source.js')) throw new Error('the suite reaches past the seam to the copy');

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-64-tests.txt');
if (full.failed !== 0 || full.tests !== 1650) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-64-family.txt');
if (family.failed !== 0 || family.tests !== 374) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const siteSweep = summary('.audit/w45-64-site.txt');
if (siteSweep.failed !== 0 || siteSweep.tests !== 55) throw new Error('the site sweeps are not clean');
const scanSweep = read('.audit/w45-64-scan.txt');
if ((scanSweep.match(/unresolved 0/g) ?? []).length !== 2) throw new Error('the two scanned copies did not scan clean');
const span = JSON.parse(read('.audit/w45-64-span.txt'));
if (span.total !== 0) throw new Error(`the span scan found ${span.total}`);
const notices = JSON.parse(read('.audit/w45-64-notices.txt').split('\n').filter((line) => line.startsWith('{')).at(-1));
if (notices.sha256 !== '384c78801194aedea80331383ccd93708c2dfa46bc746003dc112c930b73d13c') {
  throw new Error('the dependency-notice digest moved');
}
const smokeReport = read('.audit/w45-64-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 300) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
let allMarkers = 0;
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers += out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).length;
}
const sharedMarkers = read('.audit/w45-64-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-64-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45StylePropsCompiled.v1')) throw new Error('the shared driver did not print the W45-64 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45StylePropsCompiled.v1 (${sharedMarkers.length} markers, ${allMarkers} across every driver: it reads the source's own limits, walks the ten enum props and the six name sets, refuses a length no list has, and drives the describer through a hole, a function, a cycle, a class instance, a NaN, a repeat and both budgets)`;

const evidence = {
  schema: 'W45StylePropsEvidence.v1',
  package: 'W45-64 — the style-prop validators and the value budget',
  date: '2026-10-16',
  question: 'What are a plugin\'s props measured against, how is a value that failed described back, and how much of that subsystem can be carried without the leaves that call it?',
  answer: 'Two halves of one answer. A prop name is looked up in six sets and one table, in a fixed order: the ten enum props first (`must be one of <the whole list>`), then the four sizes (a finite number from 0 to 10,000, or a string of one to three digits and a percent), then the nineteen spacing names (`a finite number within 10000`, negative allowed because it is the magnitude that counts), then the four sides (an *integer* within the same bound, in character cells — the one numeric rule that refuses a fraction), then the three colour names (a character class of 1 to 40 characters rather than a list, so a theme key, a name and a hex are the same rule), then the seven text styles (`a boolean`), and anything else answers `has no value rule` — including props this chain knows elsewhere. A value that failed is then described by a walk with a budget: three bounds (100,000 characters, 32 deep, 20,000 values), a scalar cost (`5` for a boolean or `null`, its length plus two quotes for a string, its own digits for a number), a cycle path and a map of values already walked, and an order of checks that is the whole behaviour — depth first, then the budget, then a value already seen, then a number that is not finite (before it is counted, since `NaN` would otherwise cost three characters), then a scalar, `undefined`, a non-object, a cycle, and an object whose prototype chain is deeper than one plain level. The one body here that refuses rather than describes is the list-length guard, which throws the chain\'s own error when a claimed length cannot be a length at all.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  planExtensions: [
    {
      plan: 'research/ports/W45-style-props-blocks.plan.json',
      what: 'a new plan, seventeen blocks and twenty-four exports',
      blocks: '0 → 17 blocks, 3,794 units',
      why: 'the validators, the six name sets, the bounds and the walker are seventeen runs of chunk-nyce03br.js, and both names they reach — the error class and the border table — were already carried by an earlier copy',
    },
  ],
  boundary: 'No new boundary and no new host hook. Two names are imported from copies already carried: `He`, the error the list-length guard throws, from the chain-runner copy, and `PFs`, the border prop table, from the W44 tui border copy — `new Set(PFs)` is the Set the validator consults and the Set the `borderStyle` entry *is*, so the border names are one table read twice rather than a list written out a third time. Two statements of the same module sit inside this package\'s span and are referenced by nothing in it; the plan splits the span around them and the record asserts the copy carries neither.',
  measured: [
    'A prop name with no style rule answers `has no value rule`, and that includes props this chain knows elsewhere: `key`, `options` and `autoFocus` get the same sentence as gibberish. The validator answers a *reason*, never a site name — the caller prefixes both the site and the prop.',
    'The rule order is the behaviour. A name in the enum table is answered with the whole list joined by commas, even when the value is not a string at all; only then are numbers, spacing, sides, colours and styles tried, so a name that is in two sets would be answered by the earlier one.',
    'A size and a spacing are measured differently. A size is `0 ≤ v ≤ 10000` (a negative is out of range, and a fraction is admitted), while a spacing is `|v| ≤ 10000` — measured: `gap: -1` is admitted and `width: -1` is refused. A side is the strictest of the three: an integer within the same magnitude, so `top: 1.5` is refused where `gap: 1.5` is admitted.',
    'A colour is a character class rather than a list, `[#a-zA-Z0-9_().,% -]{1,40}`, so `rgb(1,2,3)` is admitted, forty characters fit and forty-one do not, and a control character is refused. A theme key, a name and a hex are the same rule.',
    'A percentage is one to three digits: `50%`, `100%` and `0%` are admitted, `1000%` is not, and a bare `50` as text is refused — measured, the four size props share that one sentence, `must be a number or a percentage`.',
    'The list-length guard coerces before it refuses. Measured: a `length` of `"12"` is 12, `1.5` is 1, a negative is 0 and `NaN` is 0 — only two things cannot be a length at all and throw, a bigint and a symbol (named in the message) and anything above 4,294,967,295. The bound itself is a length, so the message can carry a number rather than a type.',
    'The short shape is the phrase `a <what it is>` written out unconditionally: measured, `null` is `null`, an array is `an array` and an object is `an object`, but `undefined` is `a undefined` and a function is `a function`.',
    'A scalar costs its own text: a boolean and `null` are 5 (`false`, `null`), a string its length plus two quotes, a number the length of its text — so `12345` costs 5 and `1e5` costs 6. Anything else answers nothing, which is the walker\'s signal to open the value instead.',
    'A number that is not finite is named before it is counted: `NaN`, `Infinity` and `-Infinity` answer `holds NaN`, `holds Infinity` and `holds -Infinity`, and a nested one is still named rather than skipped, because the finite check runs before the scalar cost that would have charged its three characters.',
    'A value already walked is not a cycle. Measured: a value that appears twice inside one object is admitted and charged its stored cost a second time, while a value that is its own ancestor answers `holds a cycle`; two calls that share one budget are charged twice, so one walk is one budget (`valueProblem` builds its own inside the call).',
    'An object is required to be plain: a value whose prototype chain is deeper than one level answers `holds an object that is not plain (a class instance)` — measured on a `Date` and a `Map` — while a null prototype is plain and admitted.',
    'The bounds are exact and the container counts. Measured: a bare string of 99,998 characters plus its two quotes is exactly 100,000 and admitted, 99,999 is refused; an array of 19,999 values plus the array itself is exactly 20,000 and admitted, 20,000 is refused; a value nested 32 deep is admitted and 33 answers `nests deeper than 32` — and depth is checked first, so a deep value answers depth rather than its shape.',
    'The value budget is the dependency the W45-63 record named as held out: the error formatter behind the Client and Markdown, measured there at exactly these 24 statements and 3,794 units. The Client `Mto` is therefore unblocked, and the Link turns out not to need `hf` at all — the site module imports it from the host-call module, whose copy has carried it since W45-42.',
  ],
  regressions: `the new style-prop suite 22/22 and the three related suites together (${siteSweep.passed}/${siteSweep.tests}); ${familyLine}`,
  full: fullLine,
  compiled: driverLine,
  smoke,
  next_package: [
    'the version table behind the Button (`dcs`/`acs`, 10 statements / 14,212 units) — with the formatter now carried, it is the last dependency of `Hto` (1,612 units)',
    'the leaf table `tno` and the depth walker that reads it (`ano`, `ono`, `rno` and the twelve helpers they share, 18 statements / 3,506 units) — it maps nine types to their leaves, two of them Button and Client, so it can come once the Client is reachable and the Button is ported',
    'the leaves of the same table once their dependencies land: Markdown `Vto` (915 units) still needs `zto` (441 units), and Link `sno` (512 units) needs `Nrt` (66 units) — the `hf` it reaches is already carried by the host-call copy at chunk-ax7r0qj7.js [2243,2353), so that part of the queue is closed rather than pending',
    'the React layer: `Tc(jo, { key: `raster:${plugin}:${key}`, ... })` in chunk-kjfwbh4w.js is where a mounted raster is drawn, and it becomes a seam over the bodies now ported, as W45-38 did for the bar',
    'the remaining `$` table entries, each measured the same way first: `ui.scroll` (`O5n` 194u + `L5n` 808u + `mVe` 54u + `Nye` 39u), `ui.focus` (`fzo` 202u + `Szo` 532u + `mVe`), `ui.copy` (`wGo`/`uzo`/`dzo`, blocked on the clipboard encoder `Sv`), `state.get`/`state.set` (`Pur`/`Our`, `Iur`/`$ss`/`Hur`), `fs.ancestors` (`kNs` 492u)',
    'the plugin-facing `$` dispatcher `G2e` (chunk-sfn1dbxq.js [2356082,…)), the path that applies `raise` then `stamp` then `run`',
    'the settings read path behind `y9e` — measured at 590 statements / 327,047 units, of which 318,262 are fresh, so it is a subsystem to walk in pieces; the managed-settings gate `CT` (chunk-4bw62nzm.js) and `Tp` (chunk-wtch2p0g.js, 263u); Q-086\'s 15 registry-reading cores and their 34 sites; the notification provider `a4n`',
  ],
};
write('research/ports/W45-style-props-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-64 **补',
  features: '; W45-64 ports the style-prop validators',
  standard: '2026-10-16 W45-64 ',
  status: 'W45-64:',
  runner: '## W45-64 ported the style props',
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
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-64 **补"道具名校验 + 取值预算"**（插件 props 被什么量、失败的值怎么回述——即 W45-63 队列里点名的"错误格式化器"本体）：**17 段 3,794 单位 / 24 语句**（chunk-nyce03br.js [2097,2198) 101u \`Ubr\` 文本样式名；[2208,2288) 80u \`rQt=new Set(PFs)\`+\`Cgo\`；[2523,2815) 292u \`Rgo\` 19 个 flex/间距名+\`olt\` 四个边；[2815,3407) 592u **\`xgo\` 十键规则表**；[4004,4075) 71u \`slt\`=1e4+\`oQt\`；[4140,4987) 847u **\`sQt\` 校验器**；[5978,5990) 12u \`Ybr\`=1e5；[6016,6041) 25u \`ESe\`=32/\`AFe\`=20000；[6041,6172) 131u \`cN\`；[6340,6358) 18u \`Vs\`=4294967295；[6358,6591) 233u \`B\` 长度守卫；[87341,87483) 142u \`fa\`；[87483,87576) 93u \`F$n\`/\`Xbr\`/\`Jbr\`/\`Ro\` 预算；[87576,87714) 138u \`ca\`；[87714,87871) 157u \`un\`；[87871,88707) 836u **\`Dt\` 走查器**；[88772,88798) 26u \`cQt\` 入口）。**语义（源文实测）**：查名顺序即行为——十键枚举表（\`must be one of <整表 join>\`，值非字符串也照答表句）→ 四个尺寸（\`0..10000\` 有限数，或 1..3 位数字+% ）→ 19 个间距名（**绝对值** \`|v|<=10000\`，负号合法）→ 四个边（**整数**，同界，"character cells"）→ 三个颜色名（**字符类** \`[#a-zA-Z0-9_().,% -]{1,40}\` 而非列表，故主题键/名字/hex 同一句）→ 七个文本样式（boolean）→ 其余一律 \`has no value rule\`（**含 \`key\`/\`options\`/\`autoFocus\` 这类本链别处认识的道具名**）。失败值由带预算的走查回述：三界 100000 字符 / 32 层 / 20000 值，标量代价 \`un\`（boolean 与 null 为 5、字符串 len+2、数字取自身字面长度），\`path\` 捉环 + \`done\` 记已走代价，**检查序即行为**：深度最先 → 预算 → 已见值 → 非有限数（**在计数之前**，否则 NaN 的 3 字符先被扣）→ 标量 → \`undefined\`（数组空洞语义）→ 非对象 → 环 → **原型链深于一层**（类实例/Map）。唯一"拒绝而非描述"的是长度守卫 \`B\`：抛链自身的 \`He\`。**关键取舍**：全部依赖取已搬运副本——\`He\`（runner 副本）与 \`PFs\`（W44 tui 边框副本，\`new Set(PFs)\` 与 \`xgo.borderStyle\` 是同一个 Set）；本副本不自声明这两个名；同模块内落在包区间里的 \`Ago\`(2) 与 \`B3e\`("AskUserQuestion") **被显式排除**（无人引用）并以断言"不在副本内"防半搬。注册表类型新增 \`WalkBudget\`。**队列更正**：Link 的 \`Nrt\` 需要的 \`hf\` 实为 chunk-n3ykh62m.js 从 chunk-ax7r0qj7.js 导入的那一个，**W45-42 的 host-call 副本已带**（[2243,2353)），故该依赖项关闭。验收：check/build/notices（摘要未变）、两副本 \`unresolved 0\`、span \`total 0\`、**${chain}**、账本 17 段逐段回源 + acorn（24 语句、完整、无重叠/无切半/无重复）+ 十七段正文逐字入 seam + 十七处区间与四个"由副本推导"常量 + 两个被导入名的"不自声明"与三处"确在彼处"（runner 计划仍导出 \`He\`、tui 副本仍按源文声明并导出 \`PFs\`、副本仍以 \`PFs\` 建集）+ \`Ago\`/\`B3e\` 双向"不在副本内" + \`hf\` 三处回源（host-call 账本/正文/site 模块导入行）、新回归 ${siteSweep.passed}/${siteSweep.tests}（三套相关）、家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45StylePropsCompiled.v1\`，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [道具校验证据](ports/W45-style-props-evidence.json)、[站点叶证据](ports/W45-site-leaves-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
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
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-64 ports the style-prop validators: ` +
  'what a plugin\'s prop is measured against, the six name sets and the ten-prop rule table in the order they are ' +
  'consulted, the size, spacing, side and colour rules with the sentences they refuse with, the list-length guard ' +
  'that throws rather than describes, and the value budget and walker that describe a prop value that failed. |';
write('research/FEATURES.md', lines.join('\n'));

const standardText = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standardText.indexOf('2026-10-16 W45-63 ');
if (standardAt < 0) throw new Error('coding-standard W45-63 line not found');
const standardEntry = `2026-10-16 W45-64 道具名校验 + 取值预算：S-1至S-7已对照。S-1（先读源）：按 W45-63 队列取"错误格式化器"——先把 \`cN cQt sQt xgo Ubr rQt Cgo Rgo olt oQt slt Ybr ESe AFe Vs B fa F$n Xbr Jbr Ro ca un Dt\` 整包量得 **17 段 3,794 单位 / 24 语句**，与 W45-63 记录里点名的 held-out 尺寸（24 语句 / 3,794 单位）**逐字对齐**，故本包就是那条队列项本身。**逐字读过再动手**：\`sQt\` 的六级查名顺序与每级各自的比较符（\`Math.abs\` 只出现在间距与边、\`>=0\` 只出现在尺寸、\`Number.isInteger\` 只在边）、\`un\` 的 switch 与 \`?? 2\`、\`Dt\` 的检查序（深度→\`ca\`→done→非有限数→\`un\`→undefined→非对象→环→原型链）、\`fa\` 的数组键长 1 与对象键长 len+4、\`B\` 的强制转换（\`Math.trunc(Number(t))||0\` 后 \`Math.max(...,0)\`）。S-2（不留半包）：新边界零、新宿主钩子零；**同模块落在包区间内的两句主动排除**（\`Ago\`=2、\`B3e\`="AskUserQuestion"，均无人引用），写进 next_package 并以断言"不在副本内"防半搬；**队列更正**：实测 \`Nrt\` 的 \`hf\` 来自 \`chunk-n3ykh62m.js\` 对 \`chunk-ax7r0qj7.js\` 的导入行，而后者正文自 W45-42 起已在 host-call 副本内，故 Link 项部分关闭。S-3（先测后断言）：\`.audit/w45-64-probe{,b,c,d,e,f}.ts\` 先跑再写 22 条断言；**实测出六处非显然行为**——① 尺寸与间距的界不同（\`width:-1\` 拒、\`gap:-1\` 过，边还要整数故 \`top:1.5\` 拒）；② 颜色是字符类（\`rgb(1,2,3)\` 过、40 字符过 41 拒）；③ \`B\` 把 \`"12"\`→12、\`1.5\`→1、负与 NaN→0，只对 bigint/symbol 与 >4294967295 抛；④ \`cN(undefined)\` 为 \`a undefined\`；⑤ 非有限数**在计数之前**被点名（嵌套的 NaN 也答 \`holds NaN\` 而非被扣 3 字符）；⑥ 共享 budget 的两次走查**各扣一次**（\`done\` 存的是代价），故 \`valueProblem\` 必须每次自建预算。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器（63 计划）与 ${drivers.length} 个编译驱动并解析输出，断言两副本 \`unresolved 0\`、span \`total 0\` 与 notices 摘要未变；acorn（17 段逐段回源、24 语句、完整语句、无重叠/无切半/无重复）+ 十七正文逐字入 seam + 十七处区间 + 四个"由副本推导"常量 + 两个被导入名的"不自声明" + 三处"确在彼处"（runner 计划仍导出 \`He\`、tui 副本的 \`PFs\` 声明与导出行、副本仍 \`new Set(PFs)\`）+ \`Ago\`/\`B3e\` 双向断言 + \`hf\` 三处回源。S-5/S-6：seam 加 12 个按名包装/具名常量（常量全部由副本推导）、按源名再导出 24 个正文；测试只经 seam；无死导出。S-7：版本表（Button 的最后依赖）、\`tno\` 表与深度遍历器、Markdown 的 \`zto\`、Link 的 \`Nrt\`、React 层 \`Tc(jo,…)\`、其余 \`$\` 表项、\`G2e\`、\`y9e\` 读路径写入 next_package。验收：check/build/notices、两副本 unresolved 0、${chain}、账本与正文自证、回归 ${siteSweep.passed}/${siteSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standardText.slice(0, standardAt) + standardEntry + standardText.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAnchor = 'W45-63: the site leaves';
const statusAt = status.indexOf(statusAnchor);
if (statusAt < 0) throw new Error('STATUS W45-63 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = 'W45-64: the style-prop validators and the value budget. The dependency W45-63 named as held out — the error ' +
  'formatter behind the Client and the Markdown — is now carried whole: measured at exactly the 24 statements and 3,794 units that ' +
  'record predicted, across seventeen runs of chunk-nyce03br.js. A prop name is looked up in a fixed order — the ten-prop enum table, ' +
  'then the four sizes, the nineteen spacing names, the four sides, the three colours and the seven text styles — and anything else ' +
  'answers `has no value rule`, including props this chain knows elsewhere. The three numeric rules differ in ways reading them ' +
  'together hides: a size is `0 ≤ v ≤ 10000`, a spacing is a magnitude (`|v| ≤ 10000`, so a negative is admitted where a negative ' +
  'size is not), and a side must be a whole number of cells. A colour is a character class rather than a list, so a theme key, a name ' +
  'and a hex are one rule. A prop value that failed is described by a walk with a budget of 100,000 characters, 32 levels and 20,000 ' +
  'values, and the order of its checks is the behaviour: depth first, then the budget, then a value already seen, then a number that ' +
  'is not finite — before it is counted, since `NaN` would otherwise cost three characters — then a scalar, `undefined`, a ' +
  'non-object, a cycle, and an object whose prototype chain is deeper than one plain level. A value already walked is not a cycle; it ' +
  'is charged its stored cost again, which is why one call builds one budget. The list-length guard is the one body here that throws ' +
  'rather than describes. Two names are imported and never re-copied: the error class from the runner copy and the border table from ' +
  'the W44 tui copy, where `new Set(PFs)` is the Set `borderStyle` itself is. Two statements inside the package\'s own span are ' +
  'referenced by nothing and are asserted absent. The queue is corrected as measured: the Link\'s URI helper is already carried by the ' +
  'host-call copy, so only the version table behind the Button and the leaves behind their own helpers remain. Evidence: ' +
  '`research/ports/W45-style-props-evidence.json`, and\n[工作包](ports/W45-chain-runner.md).\n\n';
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-64 ported the style props (2026-10-16)

The dependency W45-63 measured and held out is now carried whole, and it measured the same on the way in: 24 statements and 3,794
units, exactly what that record named as the error formatter behind the Client and the Markdown. Two things live in it. A plugin's
prop name is looked up in six sets and one table, in a fixed order, and a prop value that failed is described back to the author by a
walk with a budget.

The rule order is the behaviour. The ten enum props answer with the whole list joined by commas — even when the value is not a string
at all — and only then are the sizes, the spacing names, the sides, the colours and the text styles tried. Anything else answers
\`has no value rule\`, which includes props this chain knows perfectly well elsewhere: \`key\`, \`options\` and \`autoFocus\` are not
style props, so they get the same sentence as gibberish. The validator answers a reason and never a name; the caller prefixes the site
and the prop.

The three numeric rules differ in ways that reading them side by side hides, so they were measured. A size is \`0 ≤ v ≤ 10000\`, and a
fraction is fine. A spacing is a *magnitude*: \`|v| ≤ 10000\`, so \`gap: -1\` is admitted where \`width: -1\` is refused. A side is the
strictest of the three, an integer within the same bound, because it names character cells — \`top: 1.5\` is refused. A colour is a
character class rather than a list, \`[#a-zA-Z0-9_().,% -]{1,40}\`, so a theme key, a name and a hex are one rule and
\`rgb(1,2,3)\` is admitted. A percentage is one to three digits, so \`100%\` fits and \`1000%\` does not.

A value that failed is walked against a budget: 100,000 characters, 32 levels, 20,000 values, with a scalar cost of five for a boolean
or \`null\`, a string's length plus two quotes, and a number's own digits. The order of the walker's checks is the whole answer. Depth
is first, so a deep value answers depth rather than its shape. Then the budget, then a value already walked, then a number that is not
finite — *before* it is counted, because \`NaN\` would otherwise cost three characters and be skipped. Then a scalar, \`undefined\`
(which the sentence explains as an array hole), a non-object, a cycle, and an object whose prototype chain is deeper than one plain
level, which is how a class instance and a \`Map\` are described. A value seen twice is not a cycle: it is charged its stored cost
again, which is why one call builds one budget, and why a caller that hands its own budget back in is charged twice.

Two names are imported rather than copied. \`He\` is the error the list-length guard throws — the one body here that refuses instead
of describing, and the one that coerces before it does: \`"12"\` is 12, \`1.5\` is 1, a negative and a \`NaN\` are both zero, and only
a bigint, a symbol or anything above 4,294,967,295 throws. \`PFs\` is the border table from the W44 tui copy: \`new Set(PFs)\` is the
Set the validator consults and the Set the \`borderStyle\` entry *is*, so the border names are one table read twice rather than a list
written out a third time. Two statements inside the package's own span — \`Ago\` and \`B3e\` — are referenced by nothing in it, so the
plan splits the span around them and the record asserts the copy carries neither.

The queue is corrected as measured. The Link's URI helper \`hf\` is not a new dependency: the site module imports it from
\`chunk-ax7r0qj7.js\`, whose copy has carried it since W45-42, so that item closes. What is left behind the leaves is the version table
the Button needs (10 statements / 14,212 units) and the renderer the Markdown needs (\`zto\`, 441 units).

Verified: check/build/notices, both scanned copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, all seventeen blocks re-read from
their module and matched against the copy with acorn (24 statements, whole and contiguous, no cut, no repetition), the seventeen bodies
quoted verbatim in the seam with their ranges, the two imported names asserted absent as declarations and present in the copies that own
them, the two statements inside the span asserted absent as copies, the \`hf\` claim re-read from three artifacts, the registry-state
typing for the walk budget, the suites ${siteSweep.passed}/${siteSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers (the
shared driver now also prints \`W45StylePropsCompiled.v1\`, ${sharedMarkers.length} markers in the shared run and ${allMarkers} across every
driver), and the packaged smoke (${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: the version table behind the Button, then the leaf table \`tno\` with the depth walker that reads it (18 statements / 3,506 units),
then the Markdown's renderer and the Link's URI helper package, the React layer \`Tc(jo, …)\`, the remaining \`$\` table entries, the
dispatcher \`G2e\`, and the settings read path behind \`y9e\`.
`);

const rows = [
  ['2026-10-17T11:25:00Z', 'package', 'W45-64 补道具名校验 + 取值预算（17 段 3,794 单位 / 24 语句，即 W45-63 队列点名的"错误格式化器"）',
    'propProblem/shortDescription/listLength/freshWalkBudget/valueEntries/budgetProblem/scalarCost/walkProblem/valueProblem 成为产品面，12 个具名常量（TEXT_STYLE_PROPS/BORDER_PROPS/COLOR_PROPS/SPACING_PROPS/SIDE_PROPS/SIZE_PROPS/PROP_RULES/NUMBER_TOLERANCE/VALUE_CHAR_LIMIT/VALUE_DEPTH_LIMIT/VALUE_NODE_LIMIT/MAX_LIST_LENGTH）；注册表类型新增 WalkBudget',
    'chunk-nyce03br.js [2097,2198) 101u + [2208,2288) 80u + [2523,2815) 292u + [2815,3407) 592u + [4004,4075) 71u + [4140,4987) 847u + [5978,5990) 12u + [6016,6041) 25u + [6041,6172) 131u + [6340,6358) 18u + [6358,6591) 233u + [87341,87483) 142u + [87483,87576) 93u + [87576,87714) 138u + [87714,87871) 157u + [87871,88707) 836u + [88772,88798) 26u',
    `两轮实测（.audit/w45-64-probe{,b,c,d,e,f}.ts 与 test/plugin-chain-style-props.test.ts + .audit/w45-24-compiled.mjs）：尺寸 0..10000 与间距 |v|<=10000 的界不同、边须整数、颜色为字符类、百分比 1..3 位、B 的强转与三种抛、cN(undefined)="a undefined"、非有限数在计数之前被点名、共享预算两次各扣一次；22/22 通过`],
  ['2026-10-17T11:29:00Z', 'decision', 'W45-64 按 W45-63 的队列直接取"错误格式化器"整包，尺寸逐字对齐',
    '把候选名整包量得 17 段 3,794 单位 / 24 语句，与 W45-63 记录写下的 held-out 尺寸（24 语句 / 3,794 单位）一致，故不再切分；两个依赖（He 与 PFs）都已在产品内',
    '新边界零、新宿主钩子零；同模块落在区间内的 Ago/B3e 主动排除并断言不在副本内；xgo.borderStyle 与 rQt 是同一个 Set（\`new Set(PFs)\` 只读一次表）',
    `chain ${chain}；style-props 副本 17 段 3,794 单位 sha 059cdb6a…`],
  ['2026-10-17T11:33:00Z', 'finding', 'W45-64 六处非显然行为由实测确定',
    '① 尺寸与间距的界不同（width:-1 拒、gap:-1 过），边还要整数（top:1.5 拒）；② 颜色是字符类（rgb(1,2,3)、40 字符过，41 字符拒）；③ B 把 "12"→12、1.5→1、负与 NaN→0，只对 bigint/symbol/>4294967295 抛；④ cN(undefined) 为 a undefined；⑤ 非有限数在计数之前被点名（嵌套 NaN 也答 holds NaN）；⑥ 共享预算的两次走查各扣一次（done 存的是代价），故 valueProblem 必每次自建预算',
    '六条都按实测写进断言与编译驱动；另实测出 32 层/33 层、99998/99999 字符、19999/20000 值三处边界的精确位置',
    '回归 22/22；三套相关 55/55；共享驱动 38 标记 exit 0'],
  ['2026-10-17T11:37:00Z', 'finding', 'W45-64 队列更正：Link 的 hf 已在产品内，Client 因本包解锁',
    'Nrt 的 hf 不是新依赖——site 模块的导入行 \`import{…,hf,…}from"/$bunfs/root/chunk-ax7r0qj7.js"\` 指向的正文自 W45-42 起已在 host-call 副本 [2243,2353)；而 cN/cQt 正是 Client \`Mto\` 所缺',
    'next_package 改写：剩版本表（Button 最后依赖）与 zto（Markdown）、Nrt（Link）；记录脚本对 hf 做三处回源断言（host-call 账本、正文、site 模块导入行）',
    'link 项部分关闭；Client 可达；tno 表仍须排在 Button/Client 之后'],
  ['2026-10-17T11:41:00Z', 'verification', `W45-64 验收：两副本 unresolved 0、span total 0、账本 17 段逐段回源 + acorn + 十七正文逐字入 seam + 两个被导入名不自声明且确在彼处 + Ago/B3e "不在副本内" + hf 三处回源、${chain}、回归 ${siteSweep.passed}/${siteSweep.tests}（三套相关）、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '道具名到取值的完整校验链在产品内；下一步取版本表（Button 的最后依赖），随后 tno 表与深度遍历器',
    `check/build/notices；两副本 unresolved 0；span total 0；${chain}；17 段逐段回源比长度与内容 + acorn（24 语句、完整、无重叠/无切半/无重复）+ 无重复断言；十七段正文逐字入 seam + 十七处区间 + 四个"由副本推导"常量；两个被导入名的"不自声明"断言与三处"确在彼处"；Ago/B3e 双向断言；hf 三处回源；注册表 WalkBudget 判据；回归 ${siteSweep.passed}/${siteSweep.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45StylePropsCompiled.v1，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-64 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-64 acceptance (2026-10-16)

- [x] **The queue picked the package, and it measured what the queue predicted.** W45-63 named the error formatter as held out at 24 statements and 3,794 units; this package is exactly that, seventeen runs of chunk-nyce03br.js.
- [x] **Every dependency is imported, never re-copied.** The error class from the runner copy and the border table from the W44 tui copy, with the copy asserted not to declare either and the owners asserted to still carry them.
- [x] **Nothing left out of the span can be half-taken.** The two statements inside the package's own span are referenced by nothing, so the plan splits around them and the record asserts the copy carries neither.
- [x] **Every rule was measured before it was asserted,** including six behaviours reading alone would have got wrong: the size and spacing bounds differ, a side must be whole, a colour is a character class, the length guard coerces before it throws, an absent value is described as \`a undefined\`, and a non-finite number is named before it is counted.
- [x] **The queue was corrected by measurement rather than restated.** The Link's URI helper is already carried by the host-call copy, and the check is re-read from three artifacts.
- [x] **Sweep.** check/build/notices, both copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, the style-props ledger with acorn, the seventeen bodies quoted in the seam, the two imported names asserted absent, the suites ${siteSweep.passed}/${siteSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
// The state this record leaves behind, read back from disk: one entry per document, and no
// backslash-escaped code span anywhere.
const written = {
  'research/CURRENT.md': 'W45-64 **补',
  'research/STATUS.md': '\nW45-64:',
  'research/coding-standard.md': '\n2026-10-16 W45-64 ',
  'research/ports/W45-chain-runner.md': '\n## W45-64 ported',
  '.audit/w45-runtime.todo.md': '\n## W45-64 acceptance',
};
for (const [path, mark] of Object.entries(written)) {
  const text = read(path);
  const found = text.split(mark).length - 1;
  if (found !== 1) throw new Error(`${path} holds ${found} entries for ${JSON.stringify(mark)}`);
  if ((text.match(/\\\`/g) ?? []).length !== 0) throw new Error(`${path} carries a backslash-escaped code span`);
}
const standardLines = read('research/coding-standard.md').split('\n').filter((line) => line.startsWith('2026-'));
if (new Set(standardLines).size !== standardLines.length) throw new Error('the coding standard repeats a one-line entry');
const stamps = read('.audit/w45-runtime.tsv').split('\n').filter((line) => line.startsWith('2026-10-17T11:')).map((line) => line.split('\t')[0]);
if (new Set(stamps).size !== stamps.length) throw new Error('the runtime trail repeats a timestamp');
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
