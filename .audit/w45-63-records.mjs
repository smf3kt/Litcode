// Write the W45-63 record from the artifacts themselves: the four site leaves whose checks need nothing
// but what is already carried, the predicates and limits they share, and the three leaves of the same
// table deliberately left out with the reason measured.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 419, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 158, `validation ${identity.validation.files}`);
expect(identity.build.files === 290, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 62) throw new Error('the chain verifier did not pass 62 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const registry = read('scripts/verify-chain-copies.mjs');
if (!registry.includes("['W45-site-leaves', 'plugin-chain-site-leaves-source']")) throw new Error('the new plan is not registered');
const at = (needle) => {
  const file = verifier.files.find((entry) => entry.product.includes(needle));
  if (!file) throw new Error(`the verifier does not carry ${needle}`);
  return file;
};
const leavesCopy = at('site-leaves');
if (leavesCopy.blocks !== 8 || leavesCopy.units !== 3557) throw new Error(`the leaves copy is ${JSON.stringify(leavesCopy)}`);
if (leavesCopy.sha256 !== '85389c8b259c74a2faf6fb05da476a3e7e30b1e16ffad3856e48a0c0bec7a446') {
  throw new Error('the leaves copy is not the one this package measured');
}
const runnerCopy = at('plugin-chain-source.ts');
if (runnerCopy.blocks !== 73 || runnerCopy.units !== 26233) throw new Error('the runner copy changed size');
const runnerPlan = JSON.parse(read('research/ports/W45-chain-runner-blocks.plan.json'));
if (!runnerPlan.exports.includes('y$')) throw new Error('the runner plan no longer exports y$');
for (const [needle, blocks, units] of [['raster-sites', 8, 1980], ['raster-cells', 11, 1209], ['ui-blit', 7, 7852], ['raster-mount', 2, 541], ['raster-surface', 10, 4374]]) {
  const copy = at(needle);
  if (copy.blocks !== blocks || copy.units !== units) throw new Error(`the ${needle} copy changed size`);
}

const ledger = JSON.parse(read('src/plugin-chain-site-leaves-source-blocks.json'));
const expectedBlocks = [
  [233140, 233219, 79],
  [233330, 233611, 281],
  [233864, 234038, 174],
  [236808, 236820, 12],
  [237485, 238267, 782],
  [246293, 246804, 511],
  [246992, 247131, 139],
  [257601, 259180, 1579],
];
if (ledger.blocks.length !== 8) throw new Error(`the leaves ledger holds ${ledger.blocks.length} blocks`);
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 3557) throw new Error(`the leaves ledger holds ${units} units`);
if (ledger.missing.length !== 0) throw new Error('the leaves ledger reports missing names');
for (const [start, end, count] of expectedBlocks) {
  const block = ledger.blocks.find((b) => b.range[0] === start);
  if (!block || block.module !== 'chunk-n3ykh62m.js' || block.range[1] !== end || block.units !== count) {
    throw new Error(`[${start},${end}) is not in the ledger as ${count} units of chunk-n3ykh62m.js`);
  }
}

// Every block is re-read from its module, compared with the copy, and checked against acorn: a
// contiguous run of whole top-level statements, no statement cut, no two overlapping.
const module3 = read('extracted-v2/modules/chunk-n3ykh62m.js');
let tree;
try { tree = acorn.parse(module3, { ecmaVersion: 'latest', sourceType: 'module' }); }
catch { tree = acorn.parse(module3, { ecmaVersion: 'latest', sourceType: 'script' }); }
const statements = tree.body.map((node) => ({ start: node.start, end: node.end, node }));
const copyText = read('src/plugin-chain-site-leaves-source.ts');
const claimed = new Map();
const copied = new Set();
for (const block of ledger.blocks) {
  const [start, end] = block.range;
  if (end - start !== block.units) throw new Error(`${block.range} is not ${block.units} units`);
  const body = module3.slice(start, end);
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
if (copied.size !== 15) throw new Error(`the eight blocks hold ${copied.size} statements, not 15`);

// The three leaves of the same table this package deliberately did not take, and what they would have
// dragged in: the version table `dcs`/`acs` (10 statements / 14,212 units) and the error formatter
// `cN`/`cQt`/`sQt` (24 statements / 3,794 units), plus `hf` (2 statements / 454 units) behind `Nrt`.
// They are held out by asserting the copies do not carry them, so a later package cannot half-take one.
for (const name of ['Hto', 'Mto', 'Vto', 'Nrt', 'tno', 'sno', 'zto']) {
  if (new RegExp(`(?:^|\\n)(?:function|var) ${name}\\b`).test(copyText)) {
    throw new Error(`${name} was taken after all, and it drags a subsystem this package did not measure`);
  }
}
for (const name of ['dcs', 'acs', 'cN', 'cQt', 'sQt', 'hf']) {
  if (new RegExp(`(?:^|\\n)(?:function|var) ${name}\\b`).test(copyText)) {
    throw new Error(`${name} was taken after all, which is the drag this package held out`);
  }
}
// The leaves that are here are here whole: the four leaf problems and the predicates they share.
for (const [name, statement] of [['TAt', 'function TAt(e){return e===void 0||e===!0?void 0:"autoFocus is true or absent"}'],
  ['wVe', 'function wVe(e){return L(e)&&typeof e.plugin==="string"&&e.plugin!==""&&typeof e.handle==="number"&&Number.isInteger(e.handle)?void 0:"is not held by a plugin of this chain"}'],
  ['ZAe', 'var ZAe=(e)=>typeof e==="string"&&e.trim()!=="";'],
  ['uur', 'var uur=(e)=>e===void 0||typeof e==="number"&&Number.isFinite(e)&&e>0&&e<=JPn;']]) {
  if (!copyText.includes(statement)) throw new Error(`the copy does not carry ${name} whole`);
}

// What the copy reaches is imported from the copies that already carry it, never declared here.
const importedNames = {
  './plugin-chain-source.js': ['L'],
  './plugin-chain-ui-blit-source.js': ['QT'],
  './plugin-chain-raster-sites-source.js': ['ace', 'IL', 'QAe', 'RAt', 'xye'],
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
const importedFrom = {
  'W45-chain-runner-blocks.plan.json': ['L'],
  'W45-ui-blit-blocks.plan.json': ['QT'],
  'W45-raster-sites-blocks.plan.json': ['ace', 'IL', 'QAe', 'RAt', 'xye'],
};
for (const [plan, names] of Object.entries(importedFrom)) {
  const exports = JSON.parse(read(`research/ports/${plan}`)).exports;
  for (const name of names) {
    if (!exports.includes(name)) throw new Error(`${plan} no longer exports ${name}, which this package imports`);
  }
}

// The seam: every body quoted verbatim, every range cited, and the names a site check calls.
const seam = read('src/plugin-chain-site-leaves.ts');
for (const [start, end] of expectedBlocks.map(([start, end]) => [start, end])) {
  if (!seam.includes(module3.slice(start, end))) throw new Error(`the seam header does not quote [${start},${end}) verbatim`);
}
for (const range of ['[233140,233219) 79', '[233330,233611) 281', '[233864,234038) 174', '[236808,236820) 12',
  '[237485,238267) 782', '[246293,246804) 511', '[246992,247131) 139', '[257601,259180) 1,579']) {
  if (!seam.includes(range)) throw new Error(`the seam header does not cite ${range}`);
}
for (const name of ['CODE_MAX_START_LINE', 'SVG_PIXEL_LIMIT', 'SVG_SOURCE_LIMIT', 'SELECT_MAX_OPTIONS',
  'INPUT_FIELDS', 'checkAutoFocus', 'checkHoverKey', 'checkPress', 'isNonBlankString', 'isPixelSide',
  'optionProblem', 'codeLeafProblem', 'inputLeafProblem', 'selectLeafProblem', 'svgLeafProblem']) {
  if (!seam.includes(name)) throw new Error(`the seam does not export ${name}`);
}
if (!seam.includes('export { cur, eno, gur, JPn, jto, Lto, mur, PAt, Qto, TAt, uur, wVe, xAt, ZAe, Zto };')) {
  throw new Error('the seam does not re-export the copied bodies under their source names');
}
if (!seam.includes('export const CODE_MAX_START_LINE = PAt;') || !seam.includes('export const SELECT_MAX_OPTIONS = mur;')) {
  throw new Error('the seam hard-codes a constant the copy carries instead of deriving it');
}
if (!/var PAt=1e9;/.test(seam) || !/var JPn=4096;/.test(seam) || !/var mur=64;/.test(seam)) {
  throw new Error('the seam does not quote the source\'s own numbers');
}
const registryState = read('src/plugin-chain-registry-state.ts');
for (const name of ['LeafInput', 'PressableLeafInput', 'LeafProblem']) {
  if (!registryState.includes(name)) throw new Error(`the registry state does not carry ${name}`);
}
const suite = read('test/plugin-chain-site-leaves.test.ts');
for (const name of ['codeLeafProblem', 'inputLeafProblem', 'selectLeafProblem', 'svgLeafProblem', 'optionProblem', 'checkPress']) {
  if (!suite.includes(name)) throw new Error(`the suite does not exercise ${name}`);
}
if (suite.includes('plugin-chain-site-leaves-source.js')) throw new Error('the suite reaches past the seam to the copy');

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-63-tests.txt');
if (full.failed !== 0 || full.tests !== 1628) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-63-family.txt');
if (family.failed !== 0 || family.tests !== 352) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const siteSweep = summary('.audit/w45-63-site.txt');
if (siteSweep.failed !== 0 || siteSweep.tests !== 58) throw new Error('the site sweeps are not clean');
const scanSweep = read('.audit/w45-63-scan.txt');
if ((scanSweep.match(/unresolved 0/g) ?? []).length !== 2) throw new Error('the two scanned copies did not scan clean');
const span = JSON.parse(read('.audit/w45-63-span.txt'));
if (span.total !== 0) throw new Error(`the span scan found ${span.total}`);
const notices = JSON.parse(read('.audit/w45-63-notices.txt').split('\n').filter((line) => line.startsWith('{')).at(-1));
if (notices.sha256 !== '384c78801194aedea80331383ccd93708c2dfa46bc746003dc112c930b73d13c') {
  throw new Error('the dependency-notice digest moved');
}
const smokeReport = read('.audit/w45-63-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 298) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
let allMarkers = 0;
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers += out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).length;
}
const sharedMarkers = read('.audit/w45-63-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-63-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45SiteLeavesCompiled.v1')) throw new Error('the shared driver did not print the W45-63 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45SiteLeavesCompiled.v1 (${sharedMarkers.length} markers, ${allMarkers} across every driver: it reads the source's own limits, checks an autoFocus that is false, a hover key with an escape in it, a fractional pixel side and a press without a whole handle, threads one Set through two options, and drives all four leaves to a refusal and to admission)`;

const evidence = {
  schema: 'W45SiteLeavesEvidence.v1',
  package: 'W45-63 — the site leaves',
  date: '2026-10-16',
  question: 'What do the other leaves of the site tree check, and how much of the tree can be carried without the subsystems beside it?',
  answer: 'Four more leaf problems, each with the shape W45-62 measured — a sentence about the leaf or nothing — and each answering in its own order. Code destructures its known props and *names* the leftover, checks source by the label check and language and path by the capped string check, then startLine as a positive safe integer within a billion, then format and wrap as enums, prefixing almost every sentence with `Code`. Input sweeps its own key list with an `every` and never names a field, checks its four fields in list order, then autoFocus, then the press, and its children only after all of that, so `Input "<key>" takes no children` is the one sentence with no field in it. Select checks its key list the same way, then label and value, then the options — between one and 64 of them, each through `Qto`, which is threaded one Set so a repeated value is caught on its second sighting — then autoFocus, the press and children. Svg names its leftover like the Image does, then the source, the alt, the two sides together and isInteractive. What they share is small: autoFocus is exactly `true` or absent, a press needs a plugin name and a whole-number handle, a pixel side may be a fraction, and a hover-scope key that is wrong is dropped rather than refused.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  planExtensions: [
    {
      plan: 'research/ports/W45-site-leaves-blocks.plan.json',
      what: 'a new plan, eight blocks and fifteen exports',
      blocks: '0 → 8 blocks, 3,557 units',
      why: 'the four leaves and their shared predicates are eight runs of chunk-n3ykh62m.js, and every name they reach was already carried by an earlier copy',
    },
  ],
  boundary: 'No new boundary and no new host hook. Everything the four leaves reach is imported from copies already carried: `L` from the chain-runner copy, the control pattern `QT` from the W45-58 blit copy, and the label, length and string checks `IL`, `RAt`, `QAe`, `ace`, `xye` from the W45-62 leaf-problem copy. The three leaves of the same table this package did not take are held out by assertion rather than by intent — the copy is checked not to carry them or the helpers that would come with them, so a later package cannot half-take one.',
  measured: [
    'autoFocus is `true` or absent. Measured: `undefined` and `true` are admitted, `false` and `1` both answer `autoFocus is true or absent` — a false is answered rather than treated as the default.',
    'A hover-scope key that is wrong is *dropped*, not refused, and the two sentences say so in different shapes: a key that is not a string of 1 to 10,000 answers `Box key "<k>" is not ...`, while a key with a control character answers `Box "<k>" key holds ...`. Both scrub the key and both cut it at 40 with an ellipsis, and the label stringifies whatever it was given, so `7` appears as `"7"`.',
    'A press needs both a plugin name and a `handle` that is a whole number: a fractional handle is refused, and so is a press that is not there at all — which means a leaf handed no press is refused by this check, and an admitted Input or Select in a test must be handed one.',
    'A pixel side may be a fraction. Measured: 1.5 is admitted, and so is an absent side (the default is left in place); 0, a negative and a non-number are refused, and 4097 is refused against the 4096 bound.',
    'The option check threads one Set through the list: the first sighting records the value and answers nothing, the second answers `is listed twice; values are unique`. A value with an escape in it answers `option "<value>" value holds a control character` with the value *as it stands* — an option is not scrubbed the way a site label is.',
    'A Code block whose props carry a `children` key answers `Code prop "children" is not allowed`, while `children` on the leaf answers `Code takes no children` — the same distinction the Image makes, and here the prop sweep runs before any field.',
    'A Code startLine is a positive safe integer: 0 and 1.5 answer `must be a positive integer`, a billion and one answers `is at most 1000000000`, and a billion itself is admitted.',
    'An Input with a stray prop answers the props sentence and the field is never named, because the sweep is an `every` over its own list — the Raster names nothing either, but for the opposite reason (a picker answers one sentence), and the Code and Svg name the field.',
    'An Input checks the press before its children and its fields before the press, so a bad label beats `takes no children`.',
    'A Select with no options, none at all or 65 of them answers the same sentence, `options must be 1 to 64 entries`.',
    'An option that is not an option — a number, a string, an object with a stray key — answers `options are { value: string, label?: string }` prefixed by the Select, so the reader sees `Select "k" options are ...` and not the option sentence the shape carries.',
    'An Svg checks both sides with one sentence, `width and height are pixels, at most 4096`, so a problem with the height is reported as if either side could be wrong; `isInteractive` is checked after them and must be a boolean when given.',
    'The source length limits are the leaf\'s own: an Svg source is refused past 131,072 characters while a Code source is not capped at all, because Code\'s source goes through the label check and only its language and path go through the capped one.',
  ],
  regressions: `the new site-leaf suite 16/16 and the four site suites together (${siteSweep.passed}/${siteSweep.tests}); ${familyLine}`,
  full: fullLine,
  compiled: driverLine,
  smoke,
  next_package: [
    'the three leaves of the same table this package measured and held out, with the subsystem each drags: `Hto` (Button, 1,612 units) needs `dcs`/`acs` (10 statements / 14,212 units, the version table) and `cN` (the error formatter, whose closure is 24 statements / 3,794 units), `Mto` (Client, 826 units) needs `cQt`/`sQt` of the same formatter, `Vto` (Markdown, 915 units) needs `zto` (441 units) and so also `cN`, and `sno` (Link, 512 units) needs `Nrt` (66 units) and behind it `hf` (2 statements / 454 units) — a package per dependency, since each is a subsystem rather than a leaf',
    'the leaf table `tno` and the depth walker that reads it (`ano`, `ono`, `rno`, and the twelve helpers they share, measured at 18 statements / 3,506 units) — the table cannot come before Button and Client, because it maps those two of its nine types to their leaves',
    'the React layer: `Tc(jo, { key: `raster:${plugin}:${key}`, ... })` in chunk-kjfwbh4w.js is where a mounted raster is drawn, and it becomes a seam over the bodies now ported, as W45-38 did for the bar',
    'the remaining `$` table entries, each measured the same way first: `ui.scroll` (`O5n` 194u + `L5n` 808u + `mVe` 54u + `Nye` 39u), `ui.focus` (`fzo` 202u + `Szo` 532u + `mVe`), `ui.copy` (`wGo`/`uzo`/`dzo`, blocked on the clipboard encoder `Sv`), `state.get`/`state.set` (`Pur`/`Our`, `Iur`/`$ss`/`Hur`), `fs.ancestors` (`kNs` 492u)',
    'the plugin-facing `$` dispatcher `G2e` (chunk-sfn1dbxq.js [2356082,…)), the path that applies `raise` then `stamp` then `run`',
    'the settings read path behind `y9e` — measured at 590 statements / 327,047 units, of which 318,262 are fresh, so it is a subsystem to walk in pieces; the managed-settings gate `CT` (chunk-4bw62nzm.js) and `Tp` (chunk-wtch2p0g.js, 263u); Q-086\'s 15 registry-reading cores and their 34 sites; the notification provider `a4n`',
  ],
};
write('research/ports/W45-site-leaves-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-63 **补',
  features: '; W45-63 ports the site leaves',
  standard: '2026-10-16 W45-63 ',
  status: 'W45-63:',
  runner: '## W45-63 ported the site leaves',
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
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-63 **补"站点叶问题"第二组**（不需要外部子系统的四个叶：Code / Input / Select / Svg，及其共享判定）：**8 段 3,557 单位 / 15 语句**（chunk-n3ykh62m.js [233140,233219) 79u \`TAt\`；[233330,233611) 281u \`xAt\`；[233864,234038) 174u \`wVe\`；[236808,236820) 12u \`PAt\`；[237485,238267) 782u **\`Lto\` Code**；[246293,246804) 511u \`cur\`+\`jto\` **Input**；[246992,247131) 139u \`ZAe\`/\`JPn\`/\`uur\`；[257601,259180) 1,579u \`mur\`+\`Qto\`+\`Zto\` **Select**+\`gur\`+\`eno\` **Svg**）。**语义（源文实测）**：**Code** 解构已知字段并**点名**多余的那个，source 走 \`ace\`、language/path 走 \`xye\`，startLine 为 1..1e9 的正安全整数，format/wrap 为枚举，句子几乎全带 \`Code\` 前缀。**Input** 用 \`every\` 扫自己的键表（**从不点名**哪个键），四个字段按表序、然后 autoFocus、然后 press，**children 最后**，故 \`Input "<key>" takes no children\` 是唯一不含字段名的句子。**Select** 同样扫键表，然后 label/value，然后 options（1..64 个，逐个过 \`Qto\`，**一个 Set 贯穿**故重复值在第二次出现时被捉），然后 autoFocus/press/children。**Svg** 像 Image 一样点名多余字段，然后 source/alt/两侧尺寸（一句共同句）/isInteractive。**共享判定很小**：autoFocus 必须**恰为 \`true\` 或缺省**（\`false\` 也答句子）；press 要 plugin 名 + 整数 handle（无 press 一律被拒）；像素边**可以是小数**；hover 键错了是**丢弃**而非拒绝。**关键取舍**：全部依赖取已搬运副本（runner 的 \`L\`、blit 的 \`QT\`、W45-62 叶问题副本的 \`IL\`/\`RAt\`/\`QAe\`/\`ace\`/\`xye\`），本副本**不自声明**这七个名；同表另三个叶（Button/Client/Markdown/Link）与 \`tno\` 表**实测后主动留下**（分别拖入版本表 \`dcs\`/\`acs\` 10 语句 / 14,212 单位、错误格式化器 \`cN\`/\`cQt\`/\`sQt\` 24 语句 / 3,794 单位、\`hf\` 2 语句 / 454 单位），并以**断言**（本副本不含这些名及其携带者）防止后续半搬。注册表类型新增 \`LeafInput\`/\`PressableLeafInput\`。验收：check/build/notices（摘要未变）、两副本 \`unresolved 0\`、span \`total 0\`、**${chain}**、账本 8 段逐段回源 + acorn（15 语句、完整、无重叠/无切半/无重复）+ 八段正文逐字入 seam + 七处区间与三个"由副本推导"常量 + 七个被导入名的"不自声明"与"未搬的七个名不在副本内"双向断言 + 三处计划仍导出被导入名、新回归 ${siteSweep.passed}/${siteSweep.tests}（四套站点 ${siteSweep.passed}/${siteSweep.tests}）、家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45SiteLeavesCompiled.v1\`，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [站点叶证据](ports/W45-site-leaves-evidence.json)、[栅格叶证据](ports/W45-raster-sites-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
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
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-63 ports the site leaves: ` +
  'the Code, Input, Select and Svg checks a site is admitted by, each in its own order and each with the sentence it ' +
  'refuses with, the option check a Select threads one Set through, the autoFocus and press predicates three leaves ' +
  'share, the pixel and length limits they are measured against, and the four fields an Input admits. |';
write('research/FEATURES.md', lines.join('\n'));

const standardText = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standardText.indexOf('2026-10-16 W45-62 ');
if (standardAt < 0) throw new Error('coding-standard W45-62 line not found');
const standardEntry = `2026-10-16 W45-63 站点叶问题（第二组）：S-1至S-7已对照。S-1（先读源）：先量整棵站点树——\`tno ano ono rno nno IAt Hto Mto Lto jto Vto Zto Qto eno sno eIn Sur wur ino tIn\` 得 91 语句 / 18,812 单位、**新 41 语句 / 11,731 单位**，偏大一包；按"依赖是否已在产品内"切，用**逐语句自由名扫描**（\`.audit/w45-63-free.mjs\` 与逐句 grep）找出四个不拖外部子系统的叶，收窄为 **8 段 3,557 单位 / 15 语句**。**逐字读过再动手**：\`Lto\` 的 \`ace\`/\`xye\` 分工与三段数值/枚举、\`jto\` 的 \`every\` 键扫与 children 在最后、\`Qto\` 的 Set 贯穿与"形状句不带值"、\`Zto\` 的 \`??\` 链把 \`Qto\` 句子套在自己的名字后、\`eno\` 的常见字段名与两侧共用一句。S-2（不留半包）：新边界零、新宿主钩子零；**把同表另三个叶与 \`tno\` 表实测后主动留下**（Button 拖入版本表 14,212 单位、Client/Markdown 拖入错误格式化器 3,794 单位、Link 拖入 \`hf\` 454 单位），写进 next_package 并**以断言防止半搬**（本副本不含 \`Hto\`/\`Mto\`/\`Vto\`/\`Nrt\`/\`tno\`/\`sno\`/\`zto\` 与 \`dcs\`/\`acs\`/\`cN\`/\`cQt\`/\`sQt\`/\`hf\`）。S-3（先测后断言）：\`.audit/w45-63-probe{,b}.ts\` 先跑再写 16 条断言；**实测出五处非显然行为**——① autoFocus 的 \`false\` **也答句子**（不是"默认"而是"错"）；② 像素边**允许小数**（1.5 通过），缺省也通过；③ hover 键错了是**丢弃**且两句话形状不同（\`Box key "<k>" is not\` vs \`Box "<k>" key holds\`）；④ \`wVe\` 对**没有 press** 的叶一律拒绝，故输入类叶必须被递一个 press；⑤ options 的**形状句不带值**（\`Select "k" options are {...}\`）。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器（62 计划）与 ${drivers.length} 个编译驱动并解析输出，断言两副本 \`unresolved 0\`、span \`total 0\` 与 notices 摘要未变；acorn（8 段逐段回源、15 语句、完整语句、无重叠/无切半/无重复）+ 八正文逐字入 seam + 七处区间 + 三个"由副本推导"常量 + 七个被导入名的"不自声明" + 七个未搬名的"不在副本内" + 三处计划仍导出被导入名 + 四个叶整段在副本内（\`TAt\`/\`wVe\`/\`ZAe\`/\`uur\` 逐字）。S-5/S-6：seam 加 11 个按名包装、5 个具名常量（全部由副本推导）、按源名再导出 15 个正文；测试只经 seam；无死导出（测量后**删掉了不被任何语句引用的 \`Lrt\`/\`pur\`**）。S-7：同表另三叶与 \`tno\`、深度遍历器、React 层 \`Tc(jo,…)\`、其余 \`$\` 表项、\`G2e\`、\`y9e\` 读路径写入 next_package。验收：check/build/notices、两副本 unresolved 0、${chain}、账本与正文自证、回归 ${siteSweep.passed}/${siteSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standardText.slice(0, standardAt) + standardEntry + standardText.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAnchor = 'W45-62: the raster leaf problems';
const statusAt = status.indexOf(statusAnchor);
if (statusAt < 0) throw new Error('STATUS W45-62 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = 'W45-63: the site leaves. Four more of the site tree\'s leaf problems, each with the shape W45-62 measured and each ' +
  'answering in its own order. Code names the leftover prop and checks its fields through the label and capped-string checks, then a ' +
  'start line within a billion and two enums. Input sweeps its own key list with an `every` and never names a field, checks its four ' +
  'fields in list order, then autoFocus, then the press, and its children only after all of that. Select checks the same key list, then ' +
  'label and value, then between one and 64 options — each through an option check threaded one Set, so a repeated value is caught on ' +
  'its second sighting — then autoFocus, the press and children. Svg names its leftover like the Image does and measures both sides ' +
  'with one sentence. The shared predicates are small and were measured rather than assumed: autoFocus must be exactly `true` or ' +
  'absent and a `false` is answered; a press needs a plugin name and a whole-number handle, so a leaf handed none is refused; a pixel ' +
  'side may be a fraction; and a hover-scope key that is wrong is dropped rather than refused, with two differently shaped sentences ' +
  'saying so. Eight blocks, 3,557 units, 15 statements, every dependency imported from a copy already carried. Three leaves of the same ' +
  'table were measured and deliberately held out — the Button and the Client drag a version table and an error formatter in with them, ' +
  'and Markdown and Link drag the formatter and a URI helper — and the record asserts the copy does not carry them or their helpers, so ' +
  'none of them can be half-taken later. Evidence: `research/ports/W45-site-leaves-evidence.json`, and\n[工作包](ports/W45-chain-runner.md).\n\n';
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-63 ported the site leaves (2026-10-16)

Four more leaves of the site tree, chosen by what they *don't* need. The whole table measured 41 fresh statements and 11,731 units,
which is a package and a half; the question that cut it was whether a leaf's checks reach anything outside the module, and four of
them do not. Code, Input, Select with its option check, and Svg came across at eight blocks, 3,557 units and 15 statements, with
every name they reach imported from a copy already carried — \`L\` from the runner, the control pattern from the blit copy, and the
label, length and string checks from the W45-62 leaf-problem copy.

Each leaf answers in its own order and the orders are the source's own. Code destructures its known props and *names* the leftover,
then source by the label check with language and path by the capped one, then a start line within a billion and two enums. Input
sweeps its own key list and never names a field, checks its four fields in list order, then autoFocus, then the press, and its
children only after all of that — so \`Input "<key>" takes no children\` is the one sentence with no field name in it. Select checks
the same key list, then label and value, then between one and 64 options, each through an option check that is threaded a single Set
so a repeated value is caught on its second sighting. Svg names its leftover the way the Image does, and measures both sides with
one sentence, so a problem with the height is reported as if either could be wrong.

The shared predicates are small, and measuring them was worth more than reading them. autoFocus must be exactly \`true\` or absent,
and a \`false\` is *answered* rather than taken as the default. A press needs a plugin name and a \`handle\` that is a whole number,
which means a leaf handed no press at all is refused by that check — so an admitted Input or Select in a test has to be handed one.
A pixel side may be a *fraction*: the check wants a finite positive number within the bound, not a whole one. And a hover-scope key
that is wrong is dropped rather than refused, with two differently shaped sentences saying so, both scrubbing the key and both
cutting it at 40.

Three leaves of the same table were measured and deliberately left out, and the reason is the package's shape. The Button needs a
version table (10 statements, 14,212 units) and an error formatter (24 statements, 3,794 units); the Client needs two statements of
that formatter; Markdown needs a renderer that needs the formatter; and the Link needs a URI helper (454 units). Each is a
subsystem rather than a leaf, so each is its own package. The leaf table \`tno\` cannot come before the Button and the Client,
because it maps those two of its nine types to their leaves. The record asserts the copy carries none of them or their helpers, so
a later package cannot half-take one by accident.

Verified: check/build/notices, both scanned copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, all eight blocks re-read from their
module and matched against the copy with acorn (15 statements, whole and contiguous, no cut, no repetition), the eight bodies
quoted verbatim in the seam with their ranges, the seven imported names asserted absent as declarations, the seven held-out names
and their six helpers asserted absent as copies, the three source plans asserted to still export what is imported from them, the
four shared predicates asserted whole in the copy, the registry-state typing for the leaf input and its pressable form, the suites
${siteSweep.passed}/${siteSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers (the shared driver now also prints
\`W45SiteLeavesCompiled.v1\`, ${sharedMarkers.length} markers in the shared run and ${allMarkers} across every driver), and the packaged smoke
(${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: one package per held-out dependency — the version table behind the Button, the error formatter behind the Client and Markdown,
the URI helper behind the Link — and then the leaf table \`tno\` with the depth walker that reads it (measured at 18 statements /
3,506 units). Then the React layer \`Tc(jo, …)\`, the remaining \`$\` table entries, the dispatcher \`G2e\`, and the settings read path
behind \`y9e\` (590 statements / 327,047 units, 318,262 of them fresh).
`);

const rows = [
  ['2026-10-17T11:05:00Z', 'package', 'W45-63 补站点叶问题第二组（Code/Input/Select/Svg：8 段 3,557 单位 / 15 语句）',
    'codeLeafProblem/inputLeafProblem/selectLeafProblem/svgLeafProblem/optionProblem/checkAutoFocus/checkHoverKey/checkPress/isNonBlankString/isPixelSide 成为产品面，5 个具名常量（CODE_MAX_START_LINE/SVG_PIXEL_LIMIT/SVG_SOURCE_LIMIT/SELECT_MAX_OPTIONS/INPUT_FIELDS）；注册表类型新增 LeafInput/PressableLeafInput',
    'chunk-n3ykh62m.js [233140,233219) 79u + [233330,233611) 281u + [233864,234038) 174u + [236808,236820) 12u + [237485,238267) 782u + [246293,246804) 511u + [246992,247131) 139u + [257601,259180) 1,579u',
    `两轮实测（.audit/w45-63-probe{,b}.ts 与 test/plugin-chain-site-leaves.test.ts + .audit/w45-24-compiled.mjs）：autoFocus 的 false 也答句子、hover 键两句话形状不同且都擦洗、press 需整数 handle（无 press 一律拒）、像素边允许小数、options 的 Set 贯穿与形状句不带值、Code 的字段序与 \`children\` 两种含义、Input 的字段→press→children 序、Select 的 1..64 句、Svg 两侧共用一句；16/16 通过`],
  ['2026-10-17T11:09:00Z', 'decision', 'W45-63 用"依赖是否已在产品内"切包：整棵站点树 11,731 单位收窄为 3,557 单位',
    '整表 \`tno ano ono rno …\` 实测 91 语句 / 18,812 单位、新 41 语句 / 11,731 单位，偏大一包；逐语句自由名扫描（.audit/w45-63-free.mjs + 逐句 grep）显示四个叶不拖任何外部子系统，另三个叶分别拖入版本表、错误格式化器、URI 助手',
    '本包只取 8 段 15 语句；held-out 的七个名与六个助手写进 next_package，并在记录脚本里**双向断言**（本副本不含它们），防止后续半搬；\`tno\` 表因映射 Button/Client 而必须排在它们之后',
    `chain ${chain}；leaves 副本 8 段 3,557 单位 sha 85389c8b…`],
  ['2026-10-17T11:13:00Z', 'finding', 'W45-63 五处非显然行为由实测确定',
    '① autoFocus 的 \`false\` **也答** "autoFocus is true or absent"（是"错"不是"默认"）；② 像素边**允许小数**（1.5 通过），缺省也通过，0/负/非数字被拒；③ hover 键错了是**丢弃**，且两句话形状不同（\`Box key "<k>" is not\` vs \`Box "<k>" key holds\`）；④ \`wVe\` 对**没有 press** 的叶一律拒绝，故 Input/Select 的合法用例必须递一个 press；⑤ options 的**形状句不带值**，被 Select 包成 \`Select "k" options are {...}\`',
    '五条都按实测写进断言与编译驱动；另实测出 Code 的 \`source\` 走 \`ace\`（无长度上限）而 language/path 走 \`xye\`（有上限），与 Svg 的 source 有 131072 上限形成对照',
    '回归 16/16；四套站点 58/58；共享驱动 37 标记 exit 0'],
  ['2026-10-17T11:16:00Z', 'finding', 'W45-63 测量后删掉两个未被引用的常量',
    '闭包种子把 \`Lrt\`(2048) 与 \`pur\`(256) 带进来，但去掉它们重测后无任何语句引用（那是 Link 叶的 href 上限，属 held-out 的 \`sno\`）',
    '计划改为 8 段 15 导出，不留死导出；记录脚本断言导出名与副本导出行一致',
    'leaves 副本 sha 85389c8b…；check/build 干净'],
  ['2026-10-17T11:20:00Z', 'verification', `W45-63 验收：两副本 unresolved 0、span total 0、账本 8 段逐段回源 + acorn + 八正文逐字入 seam + 七个被导入名不自声明 + 七个 held-out 名与六个助手"不在副本内" + 三处计划仍导出被导入名、${chain}、回归 ${siteSweep.passed}/${siteSweep.tests}（四套站点）、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '站点树的可搬部分已过半：六个叶（Raster/Image/Code/Input/Select/Svg）在产品内，余三个叶与 tno 表按依赖各成一包；下一包取版本表或错误格式化器',
    `check/build/notices；两副本 unresolved 0；span total 0；${chain}；8 段逐段回源比长度与内容 + acorn（15 语句、完整、无重叠/无切半/无重复）+ 无重复断言；八段正文逐字入 seam + 八处区间 + 三个"由副本推导"常量；七个被导入名的"不自声明"断言与七个 held-out 名及其六个助手的"不在副本内"断言；四个共享判定整段在副本内；三处计划仍导出被导入名；注册表两类型判据；回归 ${siteSweep.passed}/${siteSweep.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45SiteLeavesCompiled.v1，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-63 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-63 acceptance (2026-10-16)

- [x] **The queue picked the package.** W45-62's record named the rest of the site tree as next, and the whole table was measured before anything was cut from it.
- [x] **The cut was made on measurement, not on taste.** The table's 11,731 fresh units were split by whether a leaf's checks reach an external subsystem; the four that do not came across, and the three that do were measured with the size of what they drag.
- [x] **Nothing held out can be half-taken later.** The record asserts the copy carries none of the three held-out leaves or the six helpers behind them.
- [x] **Every dependency is imported, never re-copied.** The runner's \`L\`, the blit copy's control pattern and the W45-62 copy's label, length and string checks, with the copy asserted not to declare any of them.
- [x] **Everything measured before it was asserted,** including five behaviours that reading alone would have got wrong: a \`false\` autoFocus is an error, a pixel side may be a fraction, a wrong hover key is dropped, a leaf with no press is refused, and an option's shape sentence carries no value.
- [x] **A dead export was removed after measuring.** Two constants the seed list brought in are referenced by nothing here, so they are not copied.
- [x] **Sweep.** check/build/notices, both copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, the leaves ledger with acorn, the eight bodies quoted in the seam, the seven imported names asserted absent, the three source plans asserted to export them, the suites ${siteSweep.passed}/${siteSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
// The state this record leaves behind, read back from disk: one entry per document, and no
// backslash-escaped code span anywhere.
const written = {
  'research/CURRENT.md': 'W45-63 **补',
  'research/STATUS.md': '\nW45-63:',
  'research/coding-standard.md': '\n2026-10-16 W45-63 ',
  'research/ports/W45-chain-runner.md': '\n## W45-63 ported',
  '.audit/w45-runtime.todo.md': '\n## W45-63 acceptance',
};
for (const [path, mark] of Object.entries(written)) {
  const text = read(path);
  const found = text.split(mark).length - 1;
  if (found !== 1) throw new Error(`${path} holds ${found} entries for ${JSON.stringify(mark)}`);
  if ((text.match(/\\`/g) ?? []).length !== 0) throw new Error(`${path} carries a backslash-escaped code span`);
}
const standardLines = read('research/coding-standard.md').split('\n').filter((line) => line.startsWith('2026-'));
if (new Set(standardLines).size !== standardLines.length) throw new Error('the coding standard repeats a one-line entry');
const stamps = read('.audit/w45-runtime.tsv').split('\n').filter((line) => line.startsWith('2026-10-17T11:')).map((line) => line.split('\t')[0]);
if (new Set(stamps).size !== stamps.length) throw new Error('the runtime trail repeats a timestamp');
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
