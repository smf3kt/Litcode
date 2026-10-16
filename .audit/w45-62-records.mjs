// Write the W45-62 record from the artifacts themselves: the two raster leaf problems, the string and
// size and stamp checks they share, the plan extension the runner copy needed for `y$`, and the seam
// and typing that hold them.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 416, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 157, `validation ${identity.validation.files}`);
expect(identity.build.files === 288, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 61) throw new Error('the chain verifier did not pass 61 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const registry = read('scripts/verify-chain-copies.mjs');
if (!registry.includes("['W45-raster-sites', 'plugin-chain-raster-sites-source']")) throw new Error('the new plan is not registered');
const at = (needle) => {
  const file = verifier.files.find((entry) => entry.product.includes(needle));
  if (!file) throw new Error(`the verifier does not carry ${needle}`);
  return file;
};
const sitesCopy = at('raster-sites');
if (sitesCopy.blocks !== 8 || sitesCopy.units !== 1980) throw new Error(`the sites copy is ${JSON.stringify(sitesCopy)}`);
if (sitesCopy.sha256 !== 'b087ca650c286acb144574a55c6ef509eabdd18ebf354f34fc30e50f819991a0') {
  throw new Error('the sites copy is not the one this package measured');
}
const runnerCopy = at('plugin-chain-source.ts');
if (runnerCopy.blocks !== 73 || runnerCopy.units !== 26233) throw new Error('the runner copy changed size');
if (runnerCopy.sha256 !== 'da53546364e6cbedcb10f44133b565f8b780b4fc364ff25d4b3da01ca0cfc20c') {
  throw new Error('the runner copy is not the one this package exported y$ from');
}
const runnerPlan = JSON.parse(read('research/ports/W45-chain-runner-blocks.plan.json'));
if (!runnerPlan.exports.includes('y$')) throw new Error('the runner plan no longer exports y$');
for (const [needle, blocks, units] of [['raster-cells', 11, 1209], ['ui-blit', 7, 7852], ['raster-mount', 2, 541], ['raster-surface', 10, 4374]]) {
  const copy = at(needle);
  if (copy.blocks !== blocks || copy.units !== units) throw new Error(`the ${needle} copy changed size`);
}

const ledger = JSON.parse(read('src/plugin-chain-raster-sites-source-blocks.json'));
const expectedBlocks = [
  [233219, 233330, 111],
  [233808, 233864, 56],
  [235650, 235982, 332],
  [237337, 237485, 148],
  [242738, 242804, 66],
  [245596, 246293, 697],
  [247200, 247312, 112],
  [257143, 257601, 458],
];
if (ledger.blocks.length !== 8) throw new Error(`the sites ledger holds ${ledger.blocks.length} blocks`);
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 1980) throw new Error(`the sites ledger holds ${units} units`);
if (ledger.missing.length !== 0) throw new Error('the sites ledger reports missing names');
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
const statements = tree.body.map((node) => ({ start: node.start, end: node.end }));
const copyText = read('src/plugin-chain-raster-sites-source.ts');
const claimed = new Map();
let copiedStatements = 0;
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
  copiedStatements += inside.length;
  const key = block.range.join(',');
  if (claimed.has(key)) throw new Error(`${key} is copied twice`);
  claimed.set(key, true);
}
if (copiedStatements !== 14) throw new Error(`the eight blocks hold ${copiedStatements} statements, not 14`);

// What the copy reaches is imported from the three copies that already carry it, never declared here.
const importedNames = {
  './plugin-chain-source.js': ['L', 'ne', 'y$'],
  './plugin-chain-ui-blit-source.js': ['Mss', 'QT', 'fur'],
  './plugin-chain-raster-cells-source.js': ['Kbr', 'Xto', 'tF'],
};
const escape = (name) => name.replace('$', '\\$');
for (const [source, names] of Object.entries(importedNames)) {
  const line = new RegExp(`import \\{ ([^}]*) \\} from '\\./${source.slice(2)}'`).exec(copyText);
  if (!line) throw new Error(`the copy does not import from ${source}`);
  const imported = line[1].split(',').map((name) => name.trim());
  for (const name of names) {
    if (!imported.includes(name)) throw new Error(`the copy does not import ${name} from ${source}`);
    if (new RegExp(`(?:^|\\n)(?:function|var|let|const) ${escape(name)}\\b`).test(copyText)) {
      throw new Error(`the copy declares ${name} itself instead of importing it`);
    }
  }
}
// `$ne`, the one closure name that is neither copied here nor in those three, is already owned by the
// fs-boundaries seam and imported from it by the blit copy — so this package names it and does not
// carry it a second time. The copy may mention it in the plan's own header; what it must not do is
// declare or import it.
if (/(?:^|\n)(?:function|var|let|const) \$ne\b/.test(copyText)) throw new Error('the copy declares the location policy');
for (const [, list] of copyText.matchAll(/import \{ ([^}]*) \} from/g)) {
  if (list.split(',').map((name) => name.trim()).includes('$ne')) throw new Error('the copy imports the location policy');
}
const boundaries = read('src/plugin-chain-fs-boundaries.ts');
if (!/(?:^|\n)export (?:function|const) \$ne\b/.test(boundaries)) throw new Error('the location policy is not owned by the fs-boundaries seam');
const blit = read('src/plugin-chain-ui-blit-source.ts');
if (!/import \{ \$ne \} from '\.\/plugin-chain-fs-boundaries\.js';/.test(blit)) {
  throw new Error('the blit copy no longer imports the location policy from its owning seam');
}

// The three plans still export what this copy imports, and the runner plan grew by one name.
const importedFrom = {
  'W45-chain-runner-blocks.plan.json': ['L', 'ne', 'y$'],
  'W45-ui-blit-blocks.plan.json': ['Mss', 'QT', 'fur'],
  'W45-raster-cells-blocks.plan.json': ['Kbr', 'Xto', 'tF'],
};
for (const [plan, names] of Object.entries(importedFrom)) {
  const exports = JSON.parse(read(`research/ports/${plan}`)).exports;
  for (const name of names) {
    if (!exports.includes(name)) throw new Error(`${plan} no longer exports ${name}, which this package imports`);
  }
}

// The seam: every body quoted verbatim, every range cited, and the names a site check calls.
const seam = read('src/plugin-chain-raster-sites.ts');
for (const [start, end] of expectedBlocks.map(([start, end]) => [start, end])) {
  if (!seam.includes(module3.slice(start, end))) throw new Error(`the seam header does not quote [${start},${end}) verbatim`);
}
for (const range of ['[233219,233330) 111', '[233808,233864) 56', '[235650,235982) 332', '[237337,237485) 148',
  '[242738,242804) 66', '[245596,246293) 697', '[247200,247312) 112', '[257143,257601) 458']) {
  if (!seam.includes(range)) throw new Error(`the seam header does not cite ${range}`);
}
for (const name of ['KEY_LABEL_LIMIT', 'STRING_LIMIT', 'IMAGE_COLUMNS', 'IMAGE_ROWS', 'RASTER_SITE_FIELDS',
  'labelOf', 'allowedKeys', 'isChainStamped', 'checkString', 'checkLabel', 'firstFieldProblem',
  'imageSizeProblem', 'pickRasterProps', 'rasterLeafProblem', 'imageLeafProblem']) {
  if (!seam.includes(name)) throw new Error(`the seam does not export ${name}`);
}
if (!seam.includes("export { $_, Bto, H_, IL, Jto, QAe, RAt, XPn, ace, EVe, Gto, our, tL, xye };")) {
  throw new Error('the seam does not re-export the copied bodies under their source names');
}
if (!seam.includes('export const KEY_LABEL_LIMIT = our;') || !seam.includes('export const IMAGE_COLUMNS = H_;')) {
  throw new Error('the seam hard-codes a constant the copy carries instead of deriving it');
}
if (!/var our=40;/.test(seam) || !/var RAt=1e4;/.test(seam) || !/var H_=255;/.test(seam)) {
  throw new Error('the seam does not quote the source\'s own numbers');
}
const registryState = read('src/plugin-chain-registry-state.ts');
for (const name of ['LeafProblem', 'RasterLeafInput', 'ImageLeafInput']) {
  if (!registryState.includes(name)) throw new Error(`the registry state does not carry ${name}`);
}
const suite = read('test/plugin-chain-raster-sites.test.ts');
for (const name of ['rasterLeafProblem', 'imageLeafProblem', 'pickRasterProps', 'labelOf', 'imageSizeProblem']) {
  if (!suite.includes(name)) throw new Error(`the suite does not exercise ${name}`);
}
if (suite.includes('plugin-chain-raster-sites-source.js')) throw new Error('the suite reaches past the seam to the copy');

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-62-tests.txt');
if (full.failed !== 0 || full.tests !== 1612) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-62-family.txt');
if (family.failed !== 0 || family.tests !== 336) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const rasterSweep = summary('.audit/w45-62-raster.txt');
if (rasterSweep.failed !== 0 || rasterSweep.tests !== 42) throw new Error('the raster sweeps are not clean');
const sitesOnly = summary('.audit/w45-62-raster.txt');
const scanSweep = read('.audit/w45-62-scan.txt');
if ((scanSweep.match(/unresolved 0/g) ?? []).length !== 2) throw new Error('the two scanned copies did not scan clean');
const span = JSON.parse(read('.audit/w45-62-span.txt'));
if (span.total !== 0) throw new Error(`the span scan found ${span.total}`);
const notices = JSON.parse(read('.audit/w45-62-notices.txt').split('\n').filter((line) => line.startsWith('{')).at(-1));
if (notices.sha256 !== '384c78801194aedea80331383ccd93708c2dfa46bc746003dc112c930b73d13c') {
  throw new Error('the dependency-notice digest moved');
}
const smokeReport = read('.audit/w45-62-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 296) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
let allMarkers = 0;
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers += out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).length;
}
const sharedMarkers = read('.audit/w45-62-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-62-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45RasterSitesCompiled.v1')) throw new Error('the shared driver did not print the W45-62 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45RasterSitesCompiled.v1 (${sharedMarkers.length} markers, ${allMarkers} across every driver: it reads the source's own bounds, cuts and scrubs a label, drives the string check past its cap and over the pattern's membership, sweeps a field list in order, checks an Image size at its limit, picks props, and admits and then refuses both leaves)`;

const evidence = {
  schema: 'W45RasterSitesEvidence.v1',
  package: 'W45-62 — the raster leaf problems',
  date: '2026-10-16',
  question: 'What admits a Raster or an Image site — what does each of them check, in what order, and what sentence does it refuse with?',
  answer: 'A leaf problem is a sentence about the leaf, or nothing at all. The two raster ones share the shape rather than a function. `Jto` (the Raster) sends its props through `Gto` against `Xto` — `["key","columns","rows","cells"]` — so a key that is a non-empty string and nothing else; a stray field is refused there with one sentence, which is why a Raster never names the field it did not want. Then no children, then the key sweep `XPn(["key"])`, the default size check `tF` (512 by 256, the mount W45-60 carried), the cell decode `fur(cells, columns, rows)` whose own `.problem` is the message, and the stamp last. `Bto` (the Image) destructures its five known props and names the leftover it found — "a press goes on an enclosing Button" — then answers the alt and key type sentences bare, before it builds a label, and only from the alt check onward prefixes the message with `Image "<key>"`. Its size is checked against 255 by 255 (`tL`), its source against `Mss`, and its stamp last, like the Raster. Both share `IL`, which scrubs what `y$` matches and cuts a key to 40 with an ellipsis, and the string check `xye` — capped at 10,000 — beside `ace`, the same check an alt goes through, which is not capped.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  planExtensions: [
    {
      plan: 'research/ports/W45-raster-sites-blocks.plan.json',
      what: 'a new plan, eight blocks and fourteen exports',
      blocks: '0 → 8 blocks, 1,980 units',
      why: 'the two leaves are sixteen hundred units apart from their own helpers, so the closure is eight runs of one module rather than one',
    },
    {
      plan: 'research/ports/W45-chain-runner-blocks.plan.json',
      what: 'the runner copy grew one export, `y$`',
      blocks: '73 blocks, 26,233 units — the same blocks, one more name',
      why: '`IL` scrubs a key with the pattern `y$` holds, and the copy carried the declaration without exporting it; the alternative would be a host hook for a body the product already owns',
    },
  ],
  boundary: 'No new boundary and no new host hook. Everything the two leaves reach is imported from copies already carried: `L`, `ne` and `y$` from the chain-runner copy, `Mss` the ImageSource shape, `QT` the pattern its own test is built from, and `fur` the cell decoder from the W45-58 blit copy, and `Kbr` with the mount `tF` and its field list `Xto` from W45-60. The one closure name that is in none of them, `$ne`, is the location policy the fs-boundaries seam already owns and the blit copy already imports from there, so it is named and not carried again — asserted, with a check that this copy does not hold it.',
  measured: [
    'A label is cut only past 40: `IL` answers a 40-character key unchanged, a 41-character one as its first 40 plus `...`, and replaces what the scrubber matches with a question mark. The scrubber is `y$` (the line scrub), so a tab, a newline and an escape all become `?` in a message — even where the field check beside it admits the value.',
    'The string check `xye` admits a value that is not there, refuses a non-string with `<field> must be a string`, admits a string of exactly 10,000 characters and refuses 10,001 with `<field> longer than 10000 characters`. `ace` is the same check with no length at all, and is what an alt goes through.',
    'The control test is the pattern and not the sentence it answers with. Measured: an escape, a NUL, a DEL, a lone high surrogate and a lone low surrogate are all refused as "holds a control character", while a tab, a newline, a paired surrogate (an emoji), U+FFFD and U+FFFC are admitted. So the message overstates what the pattern covers, and the port keeps the pattern.',
    'The field sweep answers the first problem in list order, so two bad fields report the first one listed.',
    'An Image size is checked against 255 by 255: 255/255 is admitted and 256, 0 and 1.5 are all refused with the columns sentence, because the value falls out of the shared `Kbr` check before rows is looked at.',
    'A missing size is refused, so an Image always has to state its columns and rows — a source and an alt alone are not enough.',
    'The Raster picker answers a *copy* (`{...e, key}`) and only for an object with a non-empty string key whose every other own key is allowed; a stray field, an empty key and a non-object all answer nothing.',
    'The Raster refuses in this order: the picker\'s sentence, then children, then the key sweep, then the size against 512 by 256, then the decoder, then the stamp. A stray field therefore never produces a field-level sentence, which is the picker doing its job.',
    'The Image refuses in this order: the props sentence, then children, then a leftover prop *named by name*, then the alt type, then the key type, then the alt check, the key check, the size, the source and the stamp. The four before the alt check answer bare sentences — the message has no key in it — and everything from the alt check onward is prefixed with the site\'s own key.',
    'A leaf is stamped only by a `plugin` that is a non-empty string, and the stamp is last in both leaves, so it is a well-formed leaf that reaches it.',
    'The decoder the Raster\'s cells go through is stricter than a length: measured against a 1x1 frame, a cell whose code point is above the Basic Multilingual Plane and one that holds a control are both refused with the decoder\'s own sentences, so an admitted Raster in a test has to carry a real printable code point.',
  ],
  regressions: `the new leaf-problem suite 17/17 and the three raster suites together (${rasterSweep.passed}/${rasterSweep.tests}); ${familyLine}`,
  full: fullLine,
  compiled: driverLine,
  smoke,
  next_package: [
    'the rest of the site tree: the other leaf problems beside these two (`Zto` Select, `eno` Svg, `Zto`\'s option check `Qto`, `sno` Link, and the markdown/code/input ones), the depth walker that reads them (`ano`, `ono`, `rno`), and the leaf table `tno` that maps a site type to its problem — the whole component table, which is why it is a package of its own rather than a tail of this one',
    'the React layer: `Tc(jo, { key: `raster:${plugin}:${key}`, ... })` in chunk-kjfwbh4w.js is where a mounted raster is drawn, and it becomes a seam over the bodies now ported, as W45-38 did for the bar',
    'the remaining `$` table entries, each measured the same way first: `ui.scroll` (`O5n` 194u + `L5n` 808u + `mVe` 54u + `Nye` 39u), `ui.focus` (`fzo` 202u + `Szo` 532u + `mVe`), `ui.copy` (`wGo`/`uzo`/`dzo`, blocked on the clipboard encoder `Sv`), `state.get`/`state.set` (`Pur`/`Our`, `Iur`/`$ss`/`Hur`), `fs.ancestors` (`kNs` 492u)',
    'the plugin-facing `$` dispatcher `G2e` (chunk-sfn1dbxq.js [2356082,…)), the path that applies `raise` then `stamp` then `run`',
    'the settings read path behind `y9e` — measured at 590 statements / 327,047 units, of which 318,262 are fresh, so it is a subsystem to walk in pieces; the managed-settings gate `CT` (chunk-4bw62nzm.js) and `Tp` (chunk-wtch2p0g.js, 263u); Q-086\'s 15 registry-reading cores and their 34 sites; the notification provider `a4n`',
  ],
};
write('research/ports/W45-raster-sites-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-62 **补',
  features: '; W45-62 ports the raster leaf problems',
  standard: '2026-10-16 W45-62 ',
  status: 'W45-62:',
  runner: '## W45-62 ported the raster leaf problems',
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
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-62 **补"栅格叶问题"**（Raster / Image 两个站点被准入时检查什么、按什么顺序、拿什么句子拒绝）：**8 段 1,980 单位 / 14 语句**（chunk-n3ykh62m.js [233219,233330) 111u \`our\`/\`IL\`/\`RAt\`；[233808,233864) 56u \`QAe\`；[235650,235982) 332u \`EVe\`/\`xye\`/\`XPn\`；[237337,237485) 148u \`ace\`；[242738,242804) 66u \`H_\`/\`$_\`/\`tL\`；[245596,246293) 697u **\`Bto\`**；[247200,247312) 112u \`Gto\`；[257143,257601) 458u **\`Jto\`**）。**语义（源文实测）**：叶问题就是一个句子或什么都没有。**Raster** 走 \`Gto\` 对 \`Xto\`（\`["key","columns","rows","cells"]\`）挑 props——键必须非空字符串且**没有别的字段**，多一个字段由**挑选器**用一句话拒绝（所以 Raster 从不点名那个字段）；然后无 children、键扫描 \`XPn(["key"])\`、默认尺寸 \`tF\`（512×256，W45-60 那道挂载）、格子解码 \`fur\` 的 \`.problem\` 就是句子、**盖章最后**。**Image** 解构五个已知字段并**点名**多出来的那个（"a press goes on an enclosing Button"），alt 与 key 的类型句**不带前缀**（此时标签还没建），**从 alt 检查起**才带 \`Image "<key>"\` 前缀；尺寸按 255×255（\`tL\`）、来源按 \`Mss\`、盖章同样最后。两者共用 \`IL\`（按 \`y$\` 擦洗后截到 40 加省略号）与字符串检查 \`xye\`（上限 10,000）及其无上限姊妹 \`ace\`（alt 走它）。**关键取舍**：① 全部依赖取已搬运副本（chain-runner 的 \`L\`/\`ne\`/\`y$\`、blit 的 \`Mss\`/\`QT\`/\`fur\`、cells 的 \`Kbr\`/\`Xto\`/\`tF\`），本副本**不自声明**这九个名；② 唯一既不在副本也不在这三处的 \`$ne\`（位置策略）**已由 fs-boundaries seam 拥有**、blit 副本已从那里 import——故**点名而不重搬**，并断言本副本不含它；③ 计划扩展一处：runner 计划**加导出 \`y$\`**（\`IL\` 要它做擦洗），执行体已在该副本内，绑成宿主钩子会是无据改写。**实测纠偏三处**：① \`QT\` 的"控制字符"**言过其实**——ESC/NUL/DEL/孤立代理项被拒，而**制表符、换行、成对代理项（emoji）、U+FFFD/FFFC 都被放行**，搬的是模式不是那句话；② Image 的 alt/key **类型句不带键前缀**（我按"整条消息都带前缀"写错一版），只有从 alt 检查起才带；③ "props 里的 children"与"叶自己的 children"是两句不同的话——前者被当作**多余字段点名**。注册表类型新增 \`LeafProblem\`/\`RasterLeafInput\`/\`ImageLeafInput\`。验收：check/build/notices（摘要未变）、两副本 \`unresolved 0\`、span \`total 0\`（294 文件）、**${chain}**、账本 8 段逐段回源 + acorn（14 语句、完整、无重叠/无切半/无重复）+ 八段正文逐字入 seam + 九个被导入名的"不自声明"与"\`$ne\` 不重搬"双向断言 + runner 计划含 \`y$\` + 三处计划仍导出被导入名、新回归 ${sitesOnly.passed}/${sitesOnly.tests}（三套栅格 ${rasterSweep.passed}/${rasterSweep.tests}）、家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45RasterSitesCompiled.v1\`，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [叶问题证据](ports/W45-raster-sites-evidence.json)、[表面引擎证据](ports/W45-raster-surface-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
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
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-62 ports the raster leaf problems: ` +
  'the two checks a Raster or an Image site is admitted by, in the order the source runs them, with the label scrub and ' +
  'truncation a message names a site by, the capped string check and its uncapped sibling, the size limits each leaf is ' +
  'measured against, the props picker a Raster goes through, and the field-naming refusal an Image answers instead. |';
write('research/FEATURES.md', lines.join('\n'));

const standardText = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standardText.indexOf('2026-10-16 W45-61 ');
if (standardAt < 0) throw new Error('coding-standard W45-61 line not found');
const standardEntry = `2026-10-16 W45-62 栅格叶问题：S-1至S-7已对照。S-1（先读源）：先量闭包与覆盖——\`Bto Jto\` 得 51 语句 / 7,308 单位，其中 36 语句 / 5,101 单位已被 W45-58/W45-60 账本覆盖，**新 15 语句 / 2,207 单位**；**但覆盖判据只看账本**，逐名回产品核验发现其中 \`$ne\` 已由 \`src/plugin-chain-fs-boundaries.ts\` 拥有、blit 副本已从那里 import——**故真新只 14 语句 / 1,980 单位 / 8 段**，\`$ne\` 点名不重搬（记录脚本双向断言）。**逐字读过再动手**：\`IL\` 的 \`y$\` 替换与 40 截断、\`xye\` 与 \`ace\` 的差别（上限 10,000 有无）、\`XPn\` 的 \`map\`+\`find\` 取首、\`tL\` 复用 \`Kbr\`、\`Gto\` 的 \`{...e,key}\` 复制与 \`QAe\` 合取、\`Jto\` 的四段 \`??\` 链、\`Bto\` 的解构与 \`Object.keys(T)\` 点名。S-2（不留半包）：新边界零、新宿主钩子零；**计划扩展一处**——runner 计划加导出 \`y$\`（执行体已在该副本，绑钩子会是无据改写），其余九名全部 import 并断言"本副本不自声明"；站点树的其余叶问题、深度遍历器与 \`tno\` 表按实测坐标写进 next_package（整张组件表自成一包）。S-3（先测后断言）：\`.audit/w45-62-probe{,b..h}.ts\` 八轮先跑再写 17 条断言；**三处按实测纠偏**——① \`QT\` 的"控制字符"言过其实，实测 ESC/NUL/DEL/孤立代理项被拒而制表符/换行/成对代理项/U+FFFD/FFFC 放行，断言改为**逐值列成员**；② Image 的 alt/key 类型句**不带键前缀**（首版我按"整条消息带前缀"写错，实测 \`Image alt must be a string\` 无键），改为"前四句裸、从 alt 检查起带前缀"；③ 长键截断只在**进入标签构建的**失败上可见，\`alt:1\` 永远走裸句——改用一个进入标签的失败（尺寸）来验截断。另实测出 \`Mss\` 的 PNG 检查**要读到 IHDR 的宽高**（仅签名/仅名字/长度+名字/名字+13 字节全部报 "has no IHDR header"），故测试的合法 Image 用真实 1×1 IHDR。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器（61 计划）与 ${drivers.length} 个编译驱动并解析输出，断言两副本 \`unresolved 0\`、span \`total 0\`（294 文件）与 notices 摘要未变；acorn（8 段逐段回源、14 语句、完整语句、无重叠/无切半/无重复）+ 八正文逐字入 seam + 八处区间与两个"由副本推导"的常量 + 三处计划仍导出被导入名 + runner 计划含 \`y$\` + \`$ne\` 归属与不重搬。S-5/S-6：seam 加 11 个按名包装、5 个具名常量（3 个由副本推导）、按源名再导出 14 个正文；测试只经 seam；无死导出。S-7：站点树其余部分、React 层 \`Tc(jo,…)\`、其余 \`$\` 表项、\`G2e\`、\`y9e\` 读路径写入 next_package。验收：check/build/notices、两副本 unresolved 0、${chain}、账本与正文自证、回归 ${sitesOnly.passed}/${sitesOnly.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standardText.slice(0, standardAt) + standardEntry + standardText.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAnchor = 'W45-61: the raster surface engine';
const statusAt = status.indexOf(statusAnchor);
if (statusAt < 0) throw new Error('STATUS W45-61 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = 'W45-62: the raster leaf problems. A leaf problem is a sentence about a leaf or nothing at all, and the two ' +
  'raster ones share the shape rather than a function. The Raster sends its props through a picker — a key that is a non-empty ' +
  'string and nothing else — so a stray field is refused there, in one sentence, and the field is never named; then no children, ' +
  'the key sweep, the default size check of 512 by 256, the cell decoder whose own problem is the message, and the stamp last. ' +
  'The Image destructures its five known props and *names* the leftover it found, because a press belongs on an enclosing Button, ' +
  'then answers the alt and key type sentences bare — the label does not exist yet — and from the alt check onward prefixes the ' +
  'message with its own key. Both share the label, which scrubs what the line pattern matches and cuts a key to 40 with an ' +
  'ellipsis, and the string check capped at 10,000 beside the uncapped one an alt goes through. Eight blocks, 1,980 units, 14 ' +
  'statements. The measurement corrected three first drafts: the control test admits a tab, a newline, a paired surrogate and the ' +
  'replacement characters while refusing an escape, a NUL, a DEL and a lone surrogate, so the message overstates what the pattern ' +
  'covers and the port keeps the pattern; an Image\'s alt and key type sentences carry no key at all; and a leftover prop inside ' +
  'the props is a different sentence from the leaf\'s own children. Evidence: ' +
  '`research/ports/W45-raster-sites-evidence.json`, and\n[工作包](ports/W45-chain-runner.md).\n\n';
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-62 ported the raster leaf problems (2026-10-16)

The raster surface is now readable from the site tree. W45-58 ported what \`$.ui.blit\` paints through, W45-59 what fills the
registries, W45-60 what a frame is painted with, W45-61 the engine that turns a frame into escapes, and here the two checks a
Raster or an Image site is *admitted* by — the leaf half of the problem table the tree walker reads as
\`tno[type](leaf) ?? ano(leaf, depth) ?? lur(...)\`.

Eight blocks, 1,980 units, 14 statements of chunk-n3ykh62m.js. The first thing the work turned up is that the overlap scan is
not the whole story: it reported fifteen fresh statements, but one of them, \`$ne\` the location policy, is already owned by
\`src/plugin-chain-fs-boundaries.ts\` and imported from there by the blit copy, so it is named and not carried a second time —
the record asserts the ownership *and* that this copy does not hold it.

What the two leaves share is the shape of a problem, not a function. Both build a sentence out of a label and the first check
that objected, both run their checks in the same order with the stamp last, and both name the site through \`IL\`, which
replaces whatever the line pattern matches with a question mark and cuts the key to 40 with an ellipsis. Where they differ is
the source's own and is kept. A Raster's props go through a picker, so a stray field is refused with one sentence and the
field is never named; an Image destructures its five known props and *names the leftover key it found*, because a press goes on
an enclosing Button and the message says so. A Raster's cells go through the decoder and the decoder's own \`.problem\` is the
message; an Image's source goes through the image-source shape, which answers the sentence itself. And an Image always has to
state its columns and rows, because a missing size is refused before anything else is looked at.

Three measurements corrected first drafts. The control test is the *pattern* and not the sentence it answers with: an escape, a
NUL, a DEL and a lone surrogate are refused, while a tab, a newline, a paired surrogate (an emoji), U+FFFD and U+FFFC are all
admitted — so the message says "control character" about a set that is really escapes, lone surrogates and placeholders, and
the port keeps the pattern. An Image's alt and key **type** sentences carry no key at all, because they are answered before the
label is built, and only the checks from the alt check onward are prefixed. And a leftover prop inside the props is a different
sentence from the leaf's own children, which is a distinction the props destructuring makes.

One plan extension. The runner copy carried \`y$\`, the line scrub \`IL\` builds its replacement from, without exporting it. The
body was already in that copy, so the plan grew one export rather than binding a host hook for something the product owns —
the same call W45-60 made for \`h$\`. Everything else the leaves reach comes from copies already carried: \`L\`, \`ne\` and \`y$\`
from the runner, the image-source shape, the control pattern and the cell decoder from the blit copy, and the size check with
the mount and its field list from W45-60.

Verified: check/build/notices, both scanned copies \`unresolved 0\`, span scan \`total 0\` over 294 documents, ${chain}, all eight
blocks re-read from their module and matched against the copy with acorn (14 statements, whole and contiguous, no cut, no
repetition), the eight bodies quoted verbatim in the seam with their ranges, the nine imported names asserted absent as
declarations with \`$ne\`'s ownership asserted both ways, the runner plan asserted to export \`y$\`, the three source plans
asserted to still export what is imported from them, the registry-state typing for the leaf problem and its two inputs, the
suites ${sitesOnly.passed}/${sitesOnly.tests} (the three raster suites ${rasterSweep.passed}/${rasterSweep.tests}), ${familyLine}, full ${fullLine},
${drivers.length} compiled drivers (the shared driver now also prints \`W45RasterSitesCompiled.v1\`, ${sharedMarkers.length} markers in
the shared run and ${allMarkers} across every driver), and the packaged smoke (${smoke}). Identity \`${short}…\` (read from
scripts/identity.mjs by the record script itself).

Next: the rest of the site tree, which is a package of its own — the other leaf problems (Select with its option check, Svg,
Link, and the input/code/markdown ones), the depth walker that reads them, and the \`tno\` table that maps a site type to its
problem. Then the React layer (\`Tc(jo, …)\` in chunk-kjfwbh4w.js), the remaining \`$\` table entries, the dispatcher \`G2e\`, and
the settings read path behind \`y9e\` (590 statements / 327,047 units, 318,262 of them fresh).
`);

const rows = [
  ['2026-10-17T10:35:00Z', 'package', 'W45-62 补栅格叶问题（Raster/Image 站点准入：8 段 1,980 单位 / 14 语句）',
    'rasterLeafProblem/imageLeafProblem/pickRasterProps/allowedKeys/isChainStamped/checkString/checkLabel/firstFieldProblem/imageSizeProblem/labelOf 成为产品面，5 个具名常量（KEY_LABEL_LIMIT/STRING_LIMIT/IMAGE_COLUMNS/IMAGE_ROWS/RASTER_SITE_FIELDS）；注册表类型新增 LeafProblem/RasterLeafInput/ImageLeafInput；runner 计划加导出 y$',
    'chunk-n3ykh62m.js [233219,233330) 111u + [233808,233864) 56u + [235650,235982) 332u + [237337,237485) 148u + [242738,242804) 66u + [245596,246293) 697u + [247200,247312) 112u + [257143,257601) 458u',
    `八轮实测（.audit/w45-62-probe{,b..h}.ts 与 test/plugin-chain-raster-sites.test.ts + .audit/w45-24-compiled.mjs）：IL 的 40 截断与 y$ 擦洗、xye 的 10000 上限与 ace 的无上限、QT 的逐值成员（ESC/NUL/DEL/孤立代理项拒；制表符/换行/成对代理项/U+FFFD/FFFC 放行）、XPn 的列表序、tL 的 255 上限、Gto 的挑选取副本、Jto 的四段 ?? 链与顺序、Bto 的点名多余字段与"前四句裸、之后带键前缀"、Mss 要读到 IHDR 宽高；17/17 通过`],
  ['2026-10-17T10:39:00Z', 'finding', 'W45-62 覆盖判据的边界：账本覆盖不等于产品已拥有',
    '重叠扫描报 15 条新语句，但其中 $ne（位置策略）已由 src/plugin-chain-fs-boundaries.ts 拥有、blit 副本已从那里 import——账本判据看不到 seam 模块，若照搬会重复搬运一个产品已有的执行体',
    '逐名回产品核验后把 $ne 降为"点名不重搬"，真新收窄为 14 语句 / 1,980 单位 / 8 段；记录脚本双向断言（fs-boundaries 里有 export $ne，本副本不含 $ne）',
    `chain ${chain}；sites 副本 8 段 1,980 单位 sha b087ca65…`],
  ['2026-10-17T10:43:00Z', 'finding', 'W45-62 三处实测纠偏：QT 的成员、Image 的前缀、两种 children',
    '① QT 的"控制字符"言过其实——实测 ESC/NUL/DEL/孤立代理项被拒，而制表符/换行/成对代理项(emoji)/U+FFFD/FFFC 全部放行；② Image 的 alt/key 类型句不带键前缀（首版按"整条消息带前缀"写错），实测 Image alt must be a string 无键，只有从 alt 检查起才带；③ props 里的 children 被当作"多余字段点名"，与叶自己的 children（"Image takes no children"）是两句不同的话',
    '三条按实测改写；另发现长键截断只在进入标签构建的失败上可见（alt:1 永远走裸句），改用一个进入标签的失败来验截断；Mss 的 PNG 检查要读到 IHDR 的宽高，测试的合法 Image 改用真实 1×1 IHDR',
    '回归 17/17；三套栅格 42/42；共享驱动 36 标记 exit 0'],
  ['2026-10-17T10:46:00Z', 'decision', 'W45-62 计划扩展一处：runner 计划加导出 y$',
    'IL 要用 y$ 做擦洗，而 y$ 的执行体已在 chain-runner 副本内（chunk-nyce03br.js 112643 起）但未导出；绑成宿主钩子会是无据改写，违反"源文可得则搬运"',
    'research/ports/W45-chain-runner-blocks.plan.json 的 exports 追加 y$ 并重新生成（73 段 / 26,233 单位不变，仅多一个导出名）；记录脚本断言 planning 含 y$ 且 runner 副本 sha 为本包实测值',
    `runner 副本 sha 由 58c01b12… 变为 da535463…；chain ${chain}`],
  ['2026-10-17T10:50:00Z', 'verification', `W45-62 验收：两副本 unresolved 0、span total 0（294 文件）、账本 8 段逐段回源 + acorn + 八正文逐字入 seam + 九个被导入名不自声明 + $ne 双向归属断言 + runner 计划含 y$、${chain}、回归 ${sitesOnly.passed}/${sitesOnly.tests}（三套栅格 ${rasterSweep.passed}/${rasterSweep.tests}）、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '栅格链自 W45-58 至 W45-62 全线闭环：读注册表 → 填注册表 → 帧编码与准入 → 表面引擎与转义 → 站点准入；下一包转站点树其余叶问题与 tno 表，或 React 层 Tc(jo,…)',
    `check/build/notices；两副本 unresolved 0；span total 0（294 文件）；${chain}；8 段逐段回源比长度与内容 + acorn（14 语句、完整、无重叠/无切半/无重复）+ 无重复断言；八段正文逐字入 seam + 八处区间 + 两个"由副本推导"常量；九个被导入名的"不自声明"断言与 $ne 的"fs-boundaries 有 / 本副本无"双向断言；runner 计划 db 含 y$ 断言；三处计划仍导出被导入名；注册表三类型判据；回归 ${sitesOnly.passed}/${sitesOnly.tests}；三套栅格 ${rasterSweep.passed}/${rasterSweep.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45RasterSitesCompiled.v1，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-62 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-62 acceptance (2026-10-16)

- [x] **The queue picked the package.** W45-61's record named the site components as next with measured coordinates, and the closure scan measured the two raster leaves at 2,207 units before a line was copied.
- [x] **The closure scan was checked against the product, not just the ledgers.** One of the fifteen "fresh" statements, the location policy \`$ne\`, is already owned by the fs-boundaries seam and imported from there by the blit copy, so it was named instead of carried a second time — and the record asserts the ownership both ways.
- [x] **Both leaves came across with the checks they share.** The picker and the props sentence a Raster answers with, the leftover-key naming an Image answers with instead, the label scrub and truncation, the capped string check and its uncapped sibling, the two size limits, and the stamp both leaves end on.
- [x] **Obtainable source was copied, not bound.** The runner copy already held the line scrub the label builds its replacement from, so the plan grew one export rather than binding a host hook; every other name comes from a copy already carried, asserted not to be declared here.
- [x] **Nothing was invented.** The rest of the site tree, the walker, the leaf table, the React layer and the remaining table entries are recorded as the next package with measured coordinates.
- [x] **Everything measured before it was asserted,** and three first drafts were corrected by the measurement: the control test admits more than its sentence claims, an Image's alt and key type sentences carry no key, and a leftover prop is a different sentence from the leaf's own children.
- [x] **Sweep.** check/build/notices, both copies \`unresolved 0\`, span scan \`total 0\` over 294 documents, ${chain}, the sites ledger with acorn, the eight bodies quoted in the seam, the nine imported names asserted absent, the runner plan asserted to export \`y$\`, the suites ${sitesOnly.passed}/${sitesOnly.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
// The state this record leaves behind, read back from disk: one entry per document, and no
// backslash-escaped code span anywhere.
const written = {
  'research/CURRENT.md': 'W45-62 **补',
  'research/STATUS.md': '\nW45-62:',
  'research/coding-standard.md': '\n2026-10-16 W45-62 ',
  'research/ports/W45-chain-runner.md': '\n## W45-62 ported',
  '.audit/w45-runtime.todo.md': '\n## W45-62 acceptance',
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
