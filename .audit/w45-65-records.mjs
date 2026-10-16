// Write the W45-65 record from the artifacts themselves: the last three site leaves whose dependencies
// are all inside the product, the six copies they draw on, and the queue's own measurement of what is
// left behind the Button.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 425, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 160, `validation ${identity.validation.files}`);
expect(identity.build.files === 294, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 64) throw new Error('the chain verifier did not pass 64 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const registry = read('scripts/verify-chain-copies.mjs');
if (!registry.includes("['W45-client-markdown-link', 'plugin-chain-leaves-source']")) throw new Error('the new plan is not registered');
const at = (needle) => {
  const file = verifier.files.find((entry) => entry.product.includes(needle));
  if (!file) throw new Error(`the verifier does not carry ${needle}`);
  return file;
};
const leavesCopy = at('plugin-chain-leaves-source');
if (leavesCopy.blocks !== 3 || leavesCopy.units !== 2785) throw new Error(`the leaves copy is ${JSON.stringify(leavesCopy)}`);
if (leavesCopy.sha256 !== 'ffb55614297dda76f97f5769446551405f7f736c9b99ec4b8287fdf4b25c4818') {
  throw new Error('the leaves copy is not the one this package measured');
}
const runnerCopy = at('plugin-chain-source.ts');
if (runnerCopy.blocks !== 73 || runnerCopy.units !== 26233) throw new Error('the runner copy changed size');
for (const [needle, blocks, units] of [['style-props', 17, 3794], ['site-leaves', 8, 3557], ['raster-sites', 8, 1980], ['host-call', 11, 2155], ['ui-blit', 7, 7852]]) {
  const copy = at(needle);
  if (copy.blocks !== blocks || copy.units !== units) throw new Error(`the ${needle} copy changed size`);
}

const ledger = JSON.parse(read('src/plugin-chain-leaves-source-blocks.json'));
const expectedBlocks = [
  [235982, 236808, 826],
  [247312, 248693, 1381],
  [260226, 260804, 578],
];
if (ledger.blocks.length !== 3) throw new Error(`the leaves ledger holds ${ledger.blocks.length} blocks`);
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 2785) throw new Error(`the leaves ledger holds ${units} units`);
if (ledger.missing.length !== 0) throw new Error('the leaves ledger reports missing names');
for (const [start, end, count] of expectedBlocks) {
  const block = ledger.blocks.find((b) => b.range[0] === start);
  if (!block || block.module !== 'chunk-n3ykh62m.js' || block.range[1] !== end || block.units !== count) {
    throw new Error(`[${start},${end}) is not in the ledger as ${count} units of chunk-n3ykh62m.js`);
  }
}

// Every block is re-read from its module, compared with the copy, and checked against acorn: a
// contiguous run of whole top-level statements, no statement cut, no two overlapping.
const moduleText = read('extracted-v2/modules/chunk-n3ykh62m.js');
let tree;
try { tree = acorn.parse(moduleText, { ecmaVersion: 'latest', sourceType: 'module' }); }
catch { tree = acorn.parse(moduleText, { ecmaVersion: 'latest', sourceType: 'script' }); }
const statements = tree.body.map((node) => ({ start: node.start, end: node.end, node }));
const copyText = read('src/plugin-chain-leaves-source.ts');
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
    throw new Error(`${JSON.stringify(block.range)} cuts a statement in half`);
  }
  for (const node of inside) copied.add(node.start);
  const key = block.range.join(',');
  if (claimed.has(key)) throw new Error(`${key} is copied twice`);
  claimed.set(key, true);
}
if (copied.size !== 7) throw new Error(`the three blocks hold ${copied.size} statements, not 7`);
// The runs are whole: nothing inside a span was left out, and the neighbours on either side are not here.
const declared = (name) => new RegExp(`(?:function|var|let|const)\\s+${name}\\b`).test(copyText);
for (const name of ['Lrt', 'pur', 'zto', 'Vto', 'Nrt', 'sno', 'Mto']) {
  if (!declared(name)) throw new Error(`the copy does not carry ${name} whole`);
}
for (const name of ['XPn', 'QPn', 'Gto', 'tb', 'nb', 'ono', 'eIn', 'Hto', 'tno']) {
  if (declared(name)) throw new Error(`${name} was taken after all, and it is not part of this package`);
}

// What the copy reaches is imported from the copies that already carry it, never declared here.
const importedNames = {
  './plugin-chain-source.js': ['L'],
  './plugin-chain-style-props-source.js': ['cN', 'cQt', 'sQt'],
  './plugin-chain-ui-blit-source.js': ['QT'],
  './plugin-chain-raster-sites-source.js': ['ace', 'EVe', 'IL', 'QAe', 'XPn'],
  './plugin-chain-site-leaves-source.js': ['wVe', 'xAt', 'ZAe'],
  './plugin-chain-host-call-source.js': ['hf'],
};
const exportedBy = {
  'src/plugin-chain-source.ts': ['L'],
  'src/plugin-chain-style-props-source.ts': ['cN', 'cQt', 'sQt'],
  'src/plugin-chain-ui-blit-source.ts': ['QT'],
  'src/plugin-chain-raster-sites-source.ts': ['ace', 'EVe', 'IL', 'QAe', 'XPn'],
  'src/plugin-chain-site-leaves-source.ts': ['wVe', 'xAt', 'ZAe'],
  'src/plugin-chain-host-call-source.ts': ['hf'],
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
// Every imported name is really exported by the copy it comes from.
for (const [path, names] of Object.entries(exportedBy)) {
  const line = /export \{ ([^}]*) \};/.exec(read(path));
  if (!line) throw new Error(`${path} has no export list`);
  const exported = line[1].split(',').map((name) => name.trim());
  for (const name of names) {
    if (!exported.includes(name)) throw new Error(`${path} no longer exports ${name}, which this package imports`);
  }
}
// The runner's own export line also has to carry what the seam reads from it.
const runnerPlan = JSON.parse(read('research/ports/W45-chain-runner-blocks.plan.json'));
for (const name of ['L', 'ne', 'x', 'y$']) {
  if (!runnerPlan.exports.includes(name)) throw new Error(`the runner plan no longer exports ${name}`);
}
// The Link's encoder needs the surrogate repair the host-call copy carried: the same module, one block over.
const hostLedger = JSON.parse(read('src/plugin-chain-host-call-source-blocks.json'));
const hfBlock = hostLedger.blocks.find((block) => block.module === 'chunk-ax7r0qj7.js' && block.range[0] === 2243);
if (!hfBlock || !hfBlock.note.includes('hf')) throw new Error('the host-call copy no longer carries hf at [2243,2353)');
// The `ne` helper the Markdown's closure reached is the runner copy's own statement, so this package
// imports nothing for it — measured, and asserted so it is not copied a second time.
const runnerLedger = JSON.parse(read('src/plugin-chain-source-blocks.json'));
const neBlock = runnerLedger.blocks.find((block) => block.module === 'chunk-ax7r0qj7.js' && block.range[0] === 1128);
if (!neBlock) throw new Error('the runner copy no longer carries ne at [1128,1272)');

// The seam: every body quoted verbatim, every range cited, and the names a site check calls.
const seam = read('src/plugin-chain-leaves.ts');
for (const [start, end] of expectedBlocks.map(([start, end]) => [start, end])) {
  if (!seam.includes(moduleText.slice(start, end))) throw new Error(`the seam header does not quote [${start},${end}) verbatim`);
}
for (const range of ['[235982,236808) 826', '[247312,248693) 1,381', '[260226,260804) 578']) {
  if (!seam.includes(range)) throw new Error(`the seam header does not cite ${range}`);
}
for (const name of ['LINK_HREF_LIMIT', 'PRESSABLE_LINK_LIMIT', 'clientLeafProblem', 'pressableLinksProblem',
  'encodeHref', 'markdownLeafProblem', 'linkLeafProblem']) {
  if (!seam.includes(name)) throw new Error(`the seam does not carry ${name}`);
}
if (!seam.includes('export { Lrt, Mto, Nrt, pur, sno, Vto, zto };')) {
  throw new Error('the seam does not re-export the copied bodies under their source names');
}
if (!seam.includes('export const LINK_HREF_LIMIT = Lrt;') || !seam.includes('export const PRESSABLE_LINK_LIMIT = pur;')) {
  throw new Error('the seam hard-codes a constant the copy carries instead of deriving it');
}
if (!/var Lrt=2048;var pur=256;/.test(seam)) throw new Error('the seam does not quote the source\'s own numbers');
const registryState = read('src/plugin-chain-registry-state.ts');
if (!registryState.includes('ClientLeafInput')) throw new Error('the registry state does not carry ClientLeafInput');
const suite = read('test/plugin-chain-leaves.test.ts');
for (const name of ['clientLeafProblem', 'markdownLeafProblem', 'linkLeafProblem', 'pressableLinksProblem',
  'encodeHref', 'LINK_HREF_LIMIT', 'PRESSABLE_LINK_LIMIT']) {
  if (!suite.includes(name)) throw new Error(`the suite does not exercise ${name}`);
}
if (suite.includes('plugin-chain-leaves-source.js')) throw new Error('the suite reaches past the seam to the copy');

// The lockfile driver block: the displaced holder's window was widened, with the reason written beside it.
const driver = read('.audit/w45-24-compiled.mjs');
if (!driver.includes('const staleHolder = await acquirePluginStoreLock(staleFile, { stale: 120_000, update: 60_000 });')) {
  throw new Error('the lockfile block no longer widens the displaced holder\'s window');
}
if (!driver.includes('.audit/w45-65-lockprobe2.mjs')) throw new Error('the lockfile block does not cite the probe that measured it');
if (!fs.existsSync('.audit/w45-65-lockprobe2.mjs')) throw new Error('the lockfile probe is gone');

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-65-tests.txt');
if (full.failed !== 0 || full.tests !== 1670) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-65-family.txt');
if (family.failed !== 0 || family.tests !== 394) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const siteSweep = summary('.audit/w45-65-site.txt');
if (siteSweep.failed !== 0 || siteSweep.tests !== 75) throw new Error('the site sweeps are not clean');
const scanSweep = read('.audit/w45-65-scan.txt');
if ((scanSweep.match(/unresolved 0/g) ?? []).length !== 2) throw new Error('the two scanned copies did not scan clean');
const span = JSON.parse(read('.audit/w45-65-span.txt'));
if (span.total !== 0) throw new Error(`the span scan found ${span.total}`);
const notices = JSON.parse(read('.audit/w45-65-notices.txt').split('\n').filter((line) => line.startsWith('{')).at(-1));
if (notices.sha256 !== '384c78801194aedea80331383ccd93708c2dfa46bc746003dc112c930b73d13c') {
  throw new Error('the dependency-notice digest moved');
}
const smokeReport = read('.audit/w45-65-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 302) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
let allMarkers = 0;
for (const name of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${name}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers += out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).length;
}
const sharedMarkers = read('.audit/w45-65-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-65-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45ClientMarkdownLinkCompiled.v1')) throw new Error('the shared driver did not print the W45-65 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45ClientMarkdownLinkCompiled.v1 (${sharedMarkers.length} markers, ${allMarkers} across every driver: it stamps a client and refuses one that is not stamped, drives the prop bag through the value budget, measures an accented href by its encoded length, encodes a lone surrogate, and reads the Markdown's press and link pairing from both sides)`;

const evidence = {
  schema: 'W45ClientMarkdownLinkEvidence.v1',
  package: 'W45-65 — the Client, the Markdown and the Link',
  date: '2026-10-16',
  question: 'The three site leaves whose dependencies the last two packages closed: what do they check, and what does the site table look like once they are in?',
  answer: 'The Client is the leaf whose whole check set belongs to other packages: the key and module are named by the first-field problem, the prop bag goes through the value budget of W45-64, the three numbers go through that copy\'s prop rules, and the stamp is the raster leaves\' own predicate — a client is stamped when it carries a plugin name and nothing else is asked of it. The Markdown is the one leaf that names its own site through a variable: every sentence after the key is prefixed with `Markdown` alone when the leaf has no key and with `Markdown "<key>"` when it has one, the key scrubbed through the label scrubber in the prefix and in its own sentence, while the props sentence and the children sentence carry no key at all. Its pressable-link list is a check of its own: at most 256 hrefs, each a non-empty string of at most 2,048 characters with no control character, and it measures an href as written rather than encoded — the one place it differs from the Link\'s own check, which measures both. The Link\'s href check is guarded by the non-blank-string predicate, so an href that is not a string is not refused there at all; a plain href of 2,048 characters fits and 2,049 does not, and an accented href of 1,024 characters does not either, because the second measurement is the encoded length. What is left of the site table is the Button alone, and its dependency was measured this tick at 430 statements and 127,575 units across sixteen modules with file-system, os and crypto edges — a subsystem to walk in pieces rather than a package.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  planExtensions: [
    {
      plan: 'research/ports/W45-client-markdown-link-blocks.plan.json',
      what: 'a new plan, three blocks and seven exports',
      blocks: '0 → 3 blocks, 2,785 units',
      why: 'the three remaining leaves and the two constants they are measured against are three runs of chunk-n3ykh62m.js, and every one of the fourteen names they reach is already carried by one of six copies',
    },
  ],
  boundary: 'No new boundary and no new host hook. Fourteen names are imported from six copies already in the product — the chain runner, the W45-64 style-prop copy, the W45-58 blit copy, the W45-62 leaf-problem copy, the W45-63 site-leaf copy and the W45-42 host-call copy — and the copy is asserted to declare none of them. The Link is the leaf this package was waiting on: W45-63 held it back for a URI helper, and W45-64 found that helper already carried by the host-call copy, so the last thing standing between the site table and its Button was nothing at all.',
  measured: [
    'A stamp is a plugin name and nothing else. `EVe` asks only that the record is an object with a non-empty string `plugin`, so `{ plugin: "p" }` is stamped — unlike a press, which is the same predicate plus a whole-number handle.',
    'A Client checks its props shape, then the two keys, then the prop bag, then the three numbers, then the stamp, then children — measured, so a bad width is reported even when a child is there and a sound prop bag falls through to the children sentence.',
    'A size that is neither a number nor a string answers the Client\'s own sentence (`width must be a number or a string`) while a string answers the prop rules of its name (`height must be a number or a percentage`).',
    'The prop bag is described by the value walker, and the site prefixes the walker\'s sentence: a `props: { a: undefined }` answers `Client "k" props holds undefined (an array hole, a missing value)`.',
    'A Link does not refuse an href that is not an address: the whole href check is guarded by the non-blank-string predicate, so `{ href: 1 }`, `{ href: "" }` and `{ href: [] }` are all admitted — a blank href is not an address to measure rather than a mistake to name.',
    'A Link measures its href twice: as written and percent-encoded. Measured: 2,048 plain characters fit and 2,049 do not, and 1,024 accented characters do not fit either, because the encoded form is three bytes per character.',
    'The href encoder percent-encodes everything outside the range that *starts at a space and ends at the tilde*, so a space and a `~` are left alone, a newline is `%0A`, delete is `%7F`, and a lone surrogate is repaired to U+FFFD before it is encoded — `%EF%BF%BD` rather than a malformed escape.',
    'A pressable-link list measures as written and does not encode: measured, 1,024 accented characters pass there while the same href is refused by the Link\'s own check. It also answers sentences with no site in them, which the Markdown prefixes, and it names a shape rather than a problem (`pressableLinks holds a number, not an href`, and an empty string is reported by its type rather than its emptiness).',
    'A Markdown names its own site only once it has a key, and three of its sentences carry no key even then: the props sentence, the children sentence and the two halves of the press-and-links pairing say `Markdown` alone.',
    'A press needs a key whatever else the leaf carries: a Markdown with links and a press but no key answers `answers its links (onLinkPress) but has no key, its address`, not the links-without-a-press sentence.',
    'The key is refused by the hover-scope key check rather than by a sentence of the leaf\'s own, and it is scrubbed into the message, so a non-string key reads `Markdown key "1" is not a usable address`.',
    'A missing text is not a props problem: `{ key: "k" }` answers `Markdown text must be a string`, because the props are a sound bag that happens to hold no text.',
    'The `ne` helper the Markdown\'s closure reached — the UTF-16-safe truncation and its two fallbacks — is already carried by the chain-runner copy at chunk-ax7r0qj7.js [1128,1272), so this package imports nothing for it and the record asserts the runner copy still carries it.',
    'The site table now holds one unported leaf. The Button needs `dcs`/`acs`, and measuring them transitively — the reason the queue item could not be taken as written — gives 430 statements and 127,575 units across sixteen modules, dominated by the config module (238 statements / 62,210 units) and a buffered file-system module (96 / 41,282), with `fs/promises`, `os`, `fs`, `path` and `crypto` edges.',
    'A pre-existing flake in the lockfile regression block turned out to be the library\'s own design: it keeps its locks in one process-global map keyed by path, so a takeover overwrites the slot and the displaced holder\'s refresh timer can no longer be cleared. That orphan fires later, finds the path gone and calls `onCompromised`, which the source\'s default throws — reproduced in isolation before the window was widened, so the driver tests what it means to test rather than whether the machine was fast enough.',
  ],
  regressions: `the new leaves suite 20/20 and the four related suites together (${siteSweep.passed}/${siteSweep.tests}); ${familyLine}`,
  full: fullLine,
  compiled: driverLine,
  smoke,
  next_package: [
    'the Button `Hto` (1,612 units) and the version subsystem it needs: `dcs`/`acs` measured at 430 statements / 127,575 units over sixteen modules, so it is walked in pieces like the settings read path — the two functions themselves are 33 and 190 units, and the three names they import (`O` 2,716 units with a class of its own, `nA` 23 units, `Yho` 51 units) are the first cut',
    'the leaf table `tno` and the depth walker that reads it (`ano`, `ono`, `rno` and the twelve helpers they share, 18 statements / 3,506 units) — it maps nine types to their leaves, so it can come once the Button is ported',
    'the React layer: `Tc(jo, { key: `raster:${plugin}:${key}`, ... })` in chunk-kjfwbh4w.js is where a mounted raster is drawn, and it becomes a seam over the bodies now ported, as W45-38 did for the bar',
    'the remaining `$` table entries, each measured the same way first: `ui.scroll` (`O5n` 194u + `L5n` 808u + `mVe` 54u + `Nye` 39u), `ui.focus` (`fzo` 202u + `Szo` 532u + `mVe`), `ui.copy` (`wGo`/`uzo`/`dzo`, blocked on the clipboard encoder `Sv`), `state.get`/`state.set` (`Pur`/`Our`, `Iur`/`$ss`/`Hur`), `fs.ancestors` (`kNs` 492u)',
    'the plugin-facing `$` dispatcher `G2e` (chunk-sfn1dbxq.js [2356082,…)), the path that applies `raise` then `stamp` then `run`',
    'the settings read path behind `y9e` — measured at 590 statements / 327,047 units, of which 318,262 are fresh, so it is a subsystem to walk in pieces; the managed-settings gate `CT` (chunk-4bw62nzm.js) and `Tp` (chunk-wtch2p0g.js, 263u); Q-086\'s 15 registry-reading cores and their 34 sites; the notification provider `a4n`',
  ],
};
write('research/ports/W45-client-markdown-link-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-65 **补',
  features: '; W45-65 ports the Client, the Markdown and the Link',
  standard: '2026-10-16 W45-65 ',
  status: 'W45-65:',
  runner: '## W45-65 ported the Client, the Markdown and the Link',
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
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-65 **补站点表最后三叶**（Client / Markdown / Link——依赖已在产品内，故 W45-63 的 held-out 全部闭合）：**3 段 2,785 单位 / 7 语句**（chunk-n3ykh62m.js [235982,236808) 826u **\`Mto\` Client**；[247312,248693) 1,381u \`Lrt\`=2048+\`pur\`=256+\`zto\` 可点链接表+\`Vto\` **Markdown**；[260226,260804) 578u \`Nrt\` href 编码+\`sno\` **Link**）。**语义（源文实测）**：**Client** 全部判定来自他包——键由 \`XPn\` 点名、prop 包走 **S45-64 取值预算**（\`Client "k" props holds undefined (...)\`）、width/height/flexGrow 走同副本道具规则（非数字非字符串答**自己的** \`must be a number or a string\`，字符串再走 \`must be a number or a percentage\`）、stamp 用栅格叶的 \`EVe\`（**只要 plugin 名**，不要求 handle），序为 props→键→包→三个尺寸→stamp→children。**Markdown** 是唯一用变量命名站点的叶：有键则 \`Markdown "<key>"\`（键经 \`IL\` 擦洗，非字符串键也擦成 \`"1"\`），无键则裸 \`Markdown\`；**props 句、children 句、press 与 links 的两半句都不带键**；\`pressableLinks\` 自成一检（≤256 条、每条非空串 ≤2048、无控制字符，**只量书写长度不量编码**——与 Link 相反）；**有 press 就必须有 key**（否则答 answers its links…no key）；缺 text **不是** props 问题（答 \`Markdown text must be a string\`）。**Link** 的 href 检查被非空串谓词**整体守门**：\`{href:1}\`/\`{href:""}\`/\`{href:[]}\` **一律通过**；2048 平文过、2049 拒；1024 个带音标字符**也拒**（第二次量的是**编码后**长度）；\`Nrt\` 把 \` -~\` 之外逐字 percent-encode（**空格与 \`~\` 在内**，\\n→%0A、DEL→%7F），**孤立代理先修成 U+FFFD** 再编码（\`%EF%BF%BD\`）。**关键取舍**：14 个依赖名取自**六个**已搬运副本（runner / style-props / ui-blit / raster-sites / site-leaves / host-call），本副本不自声明任何一个；\`ne\`（UTF-16 安全截断）**实测已在 runner 副本 [1128,1272)**，故不重复搬；同模块邻居 \`XPn\`/\`QPn\`/\`Gto\`/\`tb\`/\`nb\`/\`ono\`/\`eIn\` 与 \`Hto\`/\`tno\` 以断言排除。注册表类型新增 \`ClientLeafInput\`。**队列实测更正**：Button 所需 \`dcs\`/\`acs\` 传递闭包为 **430 语句 / 127,575 单位 / 16 模块**（含 \`fs/promises\`、\`os\`、\`fs\`、\`path\`、\`crypto\` 宿主边），非"一包可搬"；站点表现仅余 Button 一叶。**另修既有 flaky**：lockfile 回归块的重叠持有者窗口按实测原因加宽（库以**进程级按路径 map** 存锁，接管会覆写槽位，被顶替者的刷新计时器无法清除，随后 ENOENT→\`onCompromised\`→源码默认抛出；先隔离复现再改窗口，非产品改动）。验收：check/build/notices（摘要未变）、两副本 \`unresolved 0\`、span \`total 0\`、**${chain}**、账本 3 段逐段回源 + acorn（7 语句、完整、无重叠/无切半/无重复）+ 三段正文逐字入 seam + 三处区间与两个"由副本推导"常量 + 14 个被导入名的"不自声明"与其"确在彼处（六份副本导出行逐一核对）" + 邻居与未搬名排除 + \`ne\`/\`hf\` 回源 + 驱动块引用实证探针、新回归 ${siteSweep.passed}/${siteSweep.tests}（四套相关）、家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45ClientMarkdownLinkCompiled.v1\`，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [三叶证据](ports/W45-client-markdown-link-evidence.json)、[道具校验证据](ports/W45-style-props-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
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
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-65 ports the Client, the Markdown and the Link: ` +
  'the last three site leaves whose dependencies are all carried, the stamp and value-budget checks a Client is admitted by, ' +
  'the pressable-link list with its own limits and the href encoder that repairs lone surrogates, and the press-and-links ' +
  'pairing a Markdown reads from either side. |';
write('research/FEATURES.md', lines.join('\n'));

const standardText = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standardText.indexOf('2026-10-16 W45-64 ');
if (standardAt < 0) throw new Error('coding-standard W45-64 line not found');
const standardEntry = `2026-10-16 W45-65 站点表最后三叶（Client/Markdown/Link）：S-1至S-7已对照。S-1（先读源）：按 W45-63/64 队列先量三叶闭包——\`Mto\` 6 语句 1,226 单位、\`sno\`+\`Nrt\` 4 语句 639 单位、\`Vto\`+\`zto\` 11 语句 2,151 单位，**逐句读过后**发现覆盖的 11 语句全属 raster-sites(8)/site-leaves(3) 两副本，故实名 **7 语句 / 2,785 单位**；**逐字读过再动手**：\`Mto\` 的六级序（props→键→包→尺寸→stamp→children）与"非数字非字符串"那句、\`zto\` 的形状句与只量书写长度、\`Vto\` 的 \`P\` 前缀变量与三处不带键的句子、\`sno\` 被 \`ZAe\` 整体守门的 href、\`Nrt\` 的 \`[^ -~]\` 与 \`hf\` 修正。S-2（不留半包）：新边界零、新宿主钩子零；**同模块邻居 \`XPn\`/\`QPn\`/\`Gto\`/\`tb\`/\`nb\`/\`ono\`/\`eIn\` 与 \`Hto\`/\`tno\` 双向断言不在副本内**；**队列更正**：实测 Button 的 \`dcs\`/\`acs\` 传递闭包 430 语句 / 127,575 单位 / 16 模块（含 fs/os/path/crypto 宿主边），改写为"按块走"的下一包。S-3（先测后断言）：\`.audit/w45-65-probe{,b,c}.ts\` 先跑再写 20 条断言；**实测出六处非显然行为**——① stamp 只要 plugin 名（\`{plugin:'p'}\` 通过）；② Link 的 href 检查被非空串守门，非串 href **一律通过**；③ 编码范围含空格与 \`~\`（\\n→%0A、DEL→%7F）；④ \`zto\` 只量书写长度（1024 个带音标字符通过）而 Link 量编码长度（同串被拒）；⑤ 缺 text 答 text 句而非 props 句；⑥ **有 press 必须有 key**（带 links 也一样）。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器（64 计划）与 ${drivers.length} 个编译驱动并解析输出，断言两副本 \`unresolved 0\`、span \`total 0\` 与 notices 摘要未变；acorn（3 段逐段回源、7 语句、完整语句、无重叠/无切半/无重复）+ 三正文逐字入 seam + 三处区间 + 两个"由副本推导"常量 + 14 个被导入名的"不自声明" + **六份副本导出行逐一核对** + 邻居排除 + \`ne\`/\`hf\` 回源 + 驱动块引用实证探针。S-5/S-6：seam 加 5 个按名包装、2 个具名常量（由副本推导）、按源名再导出 7 个正文；测试只经 seam。S-7：Button+版本子系统、\`tno\` 表与深度遍历器、React 层 \`Tc(jo,…)\`、其余 \`$\` 表项、\`G2e\`、\`y9e\` 读路径写入 next_package。**附带修既有 flaky**：lockfile 回归块被顶替持有者的刷新计时器（库为进程级按路径 map，接管覆写槽位致其无法清除）会在运行末抛 ECOMPROMISED，先以 \`.audit/w45-65-lockprobe2.mjs\` 隔离复现（plain 通过 / 仅接管崩溃 / 两者皆放也崩溃），再把该持有者窗口加宽到运行之外——**测的是语义而非机器速度**，未改产品。验收：check/build/notices、两副本 unresolved 0、${chain}、账本与正文自证、回归 ${siteSweep.passed}/${siteSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standardText.slice(0, standardAt) + standardEntry + standardText.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAnchor = 'W45-64: the style-prop validators';
const statusAt = status.indexOf(statusAnchor);
if (statusAt < 0) throw new Error('STATUS W45-64 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = 'W45-65: the Client, the Markdown and the Link. The three site leaves W45-63 measured and held out are now in, and with ' +
  'them the site table holds one unported leaf. Every one of the fourteen names they reach comes from a copy already carried — six of them, ' +
  'from the chain runner through the host-call copy that turned out to hold the Link\'s URI helper — so the package is three blocks and ' +
  '2,785 units of pure leaf. The Client is checked entirely by other packages: the first-field problem names its keys, the W45-64 value ' +
  'budget describes its prop bag, that copy\'s prop rules measure its three numbers, and the raster leaves\' own predicate stamps it — a ' +
  'stamp being a plugin name and nothing else. The Markdown is the one leaf that names its own site through a variable, prefixing with ' +
  '`Markdown "<key>"` when it has a key and `Markdown` alone when it has not, and leaving three of its sentences unprefixed even then: ' +
  'the props, the children, and both halves of the pairing between a press and the links it answers — a press needs a key whatever else the ' +
  'leaf carries. Its pressable-link list is a check of its own, and it measures an href as written where the Link measures it twice, ' +
  'as written and percent-encoded: a plain href of 2,048 characters fits and 2,049 does not, and an accented href of 1,024 does not either. ' +
  'The Link\'s own href check is guarded by the non-blank-string predicate, so an href that is not a string at all is not refused there, and ' +
  'its encoder percent-encodes everything outside the range that starts at a space and ends at the tilde, repairing a lone surrogate to ' +
  'U+FFFD before encoding it. The queue was corrected by measurement rather than restated: the Button\'s version subsystem is 430 statements ' +
  'and 127,575 units over sixteen modules with file-system, os, path and crypto edges, so it is walked in pieces. Two findings came out of ' +
  'the run itself — the `ne` helper the Markdown\'s closure reached is the runner copy\'s own statement, so nothing was copied twice, and a ' +
  'pre-existing flake in the lockfile regression block was reproduced in isolation and shown to be the library\'s per-path lock map ' +
  'orphaning a displaced holder\'s timer, which the source\'s own default then throws. Evidence: ' +
  '`research/ports/W45-client-markdown-link-evidence.json`, and\n[工作包](ports/W45-chain-runner.md).\n\n';
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-65 ported the Client, the Markdown and the Link (2026-10-16)

The three leaves W45-63 measured and held out are in, and they came in cheap: three blocks, 2,785 units, seven statements, with every one of
the fourteen names they reach imported from a copy already carried. Six copies supply them — the chain runner, the W45-64 style-prop copy,
the blit copy, the leaf-problem copy, the site-leaf copy and the host-call copy — and the copy declares none of them itself. The Link was
the reason W45-63 held the group back, and W45-64 had already found its URI helper carried, so what stood between the site table and its
Button was nothing at all.

The Client is the leaf whose checks belong to other packages: the first-field problem names its keys, the value budget describes its prop
bag, that copy's prop rules measure its three numbers, and the raster leaves' own predicate stamps it. The order is the answer — props
shape, keys, bag, sizes, stamp, children — and it was measured, so a bad width is reported even when a child is there. A size that is
neither a number nor a string answers the Client's own sentence; a string goes on to the prop rules of its name. And a stamp is a plugin
name and nothing else: the predicate asks for no handle, unlike the press check one package over.

The Markdown is the one leaf here that names its own site through a variable — \`Markdown "<key>"\` when it has a key and \`Markdown\` alone
when it has not — and the exception is worth stating: the props sentence, the children sentence and both halves of the press-and-links
pairing carry no key even when the leaf has one. A missing text is not a props problem (the props are a sound bag with no text in them),
and a press needs a key whatever else the leaf carries, so a Markdown with links and a press but no key answers that it answers its links
without an address.

The pressable-link list is a check of its own, with its own limits and its own habit of naming a shape rather than a problem: a number is
\`holds a number, not an href\`, and an empty string is reported by its type rather than its emptiness. The one place it differs from the
Link is the measurement: it measures an href as written, while the Link measures it as written *and* percent-encoded, so 1,024 accented
characters pass there and fail here. The Link's own href check is guarded by the non-blank-string predicate, which means an href that is
not a string at all is not refused at all — a blank href is not an address to measure rather than a mistake to name. Its encoder
percent-encodes everything outside the range that starts at a space and ends at the tilde, and repairs a lone surrogate to U+FFFD first,
which is why a lone high surrogate encodes as \`%EF%BF%BD\` rather than as a malformed escape.

Two things came out of the run itself, and both are recorded as measured. The \`ne\` helper the Markdown's closure reached — the UTF-16-safe
truncation with its two fallbacks — is the runner copy's own statement at chunk-ax7r0qj7.js [1128,1272), so nothing was copied twice. And a
pre-existing flake in the lockfile regression block turned out to be the library's design: it keeps its locks in one process-global map
keyed by path, so a takeover overwrites the slot and a displaced holder's refresh timer can no longer be cleared; the orphan fires later,
finds the path gone and calls \`onCompromised\`, which the source's own default throws. It was reproduced in isolation (.audit/w45-65-lockprobe2.mjs:
a plain acquire and release is clean, a takeover without releasing the holder dies, a takeover with both releases dies too) before the
block's displaced-holder window was widened past the end of the run. That is a harness fix with a measurement behind it, not a product change.

Verified: check/build/notices, both scanned copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, all three blocks re-read from their
module and matched against the copy with acorn (7 statements, whole and contiguous, no cut, no repetition), the three bodies quoted verbatim
in the seam with their ranges, the fourteen imported names asserted absent as declarations and present in the six export lists that own them,
the neighbours and the two unported leaves asserted absent as copies, the \`ne\` and \`hf\` blocks re-read from the copies that carry them, the
registry-state typing for the client input, the suites ${siteSweep.passed}/${siteSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled
drivers (the shared driver now also prints \`W45ClientMarkdownLinkCompiled.v1\`, ${sharedMarkers.length} markers in the shared run and ${allMarkers} across
every driver), and the packaged smoke (${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: the Button and the version subsystem behind it — measured at 430 statements and 127,575 units over sixteen modules, so it is walked in
pieces starting from \`dcs\`/\`acs\` themselves (33 and 190 units) and the three names they import. Then the leaf table \`tno\` with the depth
walker that reads it, the React layer \`Tc(jo, …)\`, the remaining \`$\` table entries, the dispatcher \`G2e\`, and the settings read path
behind \`y9e\`.
`);

const rows = [
  ['2026-10-17T11:52:00Z', 'package', 'W45-65 补站点表最后三叶（Client/Markdown/Link：3 段 2,785 单位 / 7 语句）',
    'clientLeafProblem/markdownLeafProblem/linkLeafProblem/pressableLinksProblem/encodeHref 成为产品面，2 个具名常量（LINK_HREF_LIMIT/PRESSABLE_LINK_LIMIT）；注册表类型新增 ClientLeafInput；14 个依赖名取自六个已搬运副本',
    'chunk-n3ykh62m.js [235982,236808) 826u + [247312,248693) 1,381u + [260226,260804) 578u',
    `两轮实测（.audit/w45-65-probe{,b,c}.ts 与 test/plugin-chain-leaves.test.ts + .audit/w45-24-compiled.mjs）：stamp 只要 plugin 名、Link 的非串 href 一律通过、编码范围含空格与 ~、zto 只量书写长度而 Link 量编码长度、缺 text 答 text 句、有 press 必须有 key；20/20 通过`],
  ['2026-10-17T11:56:00Z', 'decision', 'W45-65 收官站点表：held-out 三叶一次搬完，余下只有 Button',
    'W45-63 因依赖把 Client/Markdown/Link 留下；W45-64 补上 cN/cQt/sQt 并实测 hf 已在 host-call 副本，故三叶的全部依赖闭合，本包只取 7 语句',
    '新边界零、新宿主钩子零；ne（UTF-16 安全截断）实测已在 runner 副本 [1128,1272)，不重复搬；同模块邻居与 Hto/tno 以断言排除',
    `chain ${chain}；leaves 副本 3 段 2,785 单位 sha ffb55614…`],
  ['2026-10-17T12:00:00Z', 'finding', 'W45-65 队列实测更正：Button 的版本子系统 430 语句 / 127,575 单位 / 16 模块',
    'dcs/acs 自身只 33+190 单位，但其三个导入（O 2,716 含一个 2,293 单位的类、nA 23、Yho 51）继续拉出 chunk-4bw62nzm（238 语句 / 62,210）与 chunk-gyf58rwf（96 / 41,282），宿主边含 fs/promises、os、fs、path、crypto',
    '下一包改写为"按块走"子系统：先从 dcs/acs 本身与 O/nA/Yho 三个名字切第一刀；tno 表仍须排在 Button 之后',
    '.audit/w45-65-recon.mjs 输出 total 430 statements / 127575 units across 16 modules'],
  ['2026-10-17T12:04:00Z', 'finding', 'W45-65 隔离复现并修复既有 flaky：lockfile 回归块的重叠持有者计时器',
    '库以进程级按路径 map 存锁（A[u]），接管覆写槽位后 release 只清得了接管者的计时器，被顶替者的孤儿计时器 1 秒后 stat 已删路径→ENOENT→onCompromised→源码默认抛出；探针显示：plain（取放）通过、仅接管（不放 holder）崩溃、两者皆放也崩溃',
    '判定为源码既定策略（被顶替即致命）而非产品缺陷：不改产品，只把该持有者窗口加宽到运行之外并写明原因，驱动块引用 .audit/w45-65-lockprobe2.mjs；三连跑 exit 0',
    'driver 39 标记 exit 0 ×3；w45-65-lockprobe{,2}.mjs 留作证据'],
  ['2026-10-17T12:08:00Z', 'verification', `W45-65 验收：两副本 unresolved 0、span total 0、账本 3 段逐段回源 + acorn + 三正文逐字入 seam + 14 个被导入名"不自声明"且"确在彼处"（六份导出行逐一核对）+ 邻居/未搬名排除 + ne/hf 回源、${chain}、回归 ${siteSweep.passed}/${siteSweep.tests}（四套相关）、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '站点表九型叶已八叶在产品内（Raster/Image/Code/Input/Select/Svg/Client/Markdown/Link），仅余 Button；下一包取版本子系统第一刀',
    `check/build/notices；两副本 unresolved 0；span total 0；${chain}；3 段逐段回源比长度与内容 + acorn（7 语句、完整、无重叠/无切半/无重复）+ 无重复断言；三段正文逐字入 seam + 三处区间 + 两个"由副本推导"常量；14 个被导入名的"不自声明"与六份副本导出行的逐一核对；邻居与 Hto/tno 排除；ne/hf 回源；注册表 ClientLeafInput 判据；回归 ${siteSweep.passed}/${siteSweep.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45ClientMarkdownLinkCompiled.v1，共享 ${sharedMarkers.length} 标记、全驱动 ${allMarkers}）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-65 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-65 acceptance (2026-10-16)

- [x] **The queue picked the package, and the measurement cut it.** W45-63 held three leaves back for their dependencies; W45-64 closed those dependencies, so this package is the three leaves and nothing else — 7 fresh statements out of the 18 their closure touches.
- [x] **Every dependency is imported, never re-copied.** Fourteen names from six copies, with the copy asserted not to declare any of them and each of the six export lists read back to prove it still exports what is imported.
- [x] **A name already carried is not copied twice.** The \`ne\` helper the Markdown's closure reached is the runner copy's own statement, which the record asserts before moving on.
- [x] **Nothing left out can be half-taken.** The neighbours of every run and the two still-unported leaves are asserted absent as copies.
- [x] **Every behaviour was measured before it was asserted,** including six reading alone would have got wrong: a stamp needs no handle, a Link does not refuse an href that is not a string, the encoder's range includes a space, the list check does not encode while the Link does, a missing text is not a props problem, and a press needs a key.
- [x] **A pre-existing flake was diagnosed, not retried away.** The lockfile block's orphaned timer was reproduced in isolation, shown to be the source's own compromise policy, and the block's window was widened with the reason beside it.
- [x] **Sweep.** check/build/notices, both copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, the leaves ledger with acorn, the three bodies quoted in the seam, the fourteen imported names asserted absent, the suites ${siteSweep.passed}/${siteSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers (three consecutive clean runs), packaged smoke (${smoke}).
`);
// The state this record leaves behind, read back from disk: one entry per document, and no
// backslash-escaped code span anywhere.
const written = {
  'research/CURRENT.md': 'W45-65 **补',
  'research/STATUS.md': '\nW45-65:',
  'research/coding-standard.md': '\n2026-10-16 W45-65 ',
  'research/ports/W45-chain-runner.md': '\n## W45-65 ported',
  '.audit/w45-runtime.todo.md': '\n## W45-65 acceptance',
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
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
