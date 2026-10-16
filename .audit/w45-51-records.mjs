// Write the W45-51 record from the artifacts themselves: the store's read and carry layer, its twenty
// copied blocks across five modules, and the platform-id hook it bounds.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 384, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 146, `validation ${identity.validation.files}`);
expect(identity.build.files === 267, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 50) throw new Error('the chain verifier did not pass 50 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const copy = verifier.files.find((file) => file.product.endsWith('plugin-chain-store-carry-source.ts'));
if (!copy || copy.blocks !== 20 || copy.units !== 2133) throw new Error('the store-carry copy is not the 20-block, 2,133-unit one');

const ledger = JSON.parse(read('src/plugin-chain-store-carry-source-blocks.json'));
if (ledger.blocks.length !== 20) throw new Error('the store-carry ledger does not hold twenty blocks');
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 2133) throw new Error(`the ledger holds ${units} units`);
const scan = execFileSync(process.execPath, ['scripts/source-undeclared-scan.mjs', 'src/plugin-chain-store-carry-source.ts'], { encoding: 'utf8' });
if (!/unresolved 0/.test(scan)) throw new Error('the store-carry copy has unresolved names');

// Every block is re-read from its module, compared with the ledger, searched for in the copy, and
// checked against acorn: each one has to be a whole top-level statement, and no two may overlap.
const sources = new Map();
for (const module of new Set(ledger.blocks.map((block) => block.module))) {
  const text = read(`extracted-v2/modules/${module}`);
  let tree;
  try { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' }); }
  catch { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script' }); }
  sources.set(module, { text, statements: new Set(tree.body.map((node) => `${node.start}:${node.end}`)) });
}
const copyText = read('src/plugin-chain-store-carry-source.ts');
const seen = new Set();
for (const block of ledger.blocks) {
  const [start, end] = block.range;
  if (end - start !== block.units) throw new Error(`${block.range} is not ${block.units} units`);
  const body = sources.get(block.module).text.slice(start, end);
  if (!sources.get(block.module).statements.has(`${start}:${end}`)) {
    throw new Error(`${block.module} ${JSON.stringify(block.range)} is not a whole top-level statement`);
  }
  if (seen.has(`${block.module}:${start}`)) throw new Error(`${block.module} ${start} is copied twice`);
  seen.add(`${block.module}:${start}`);
  if (!copyText.includes(body)) throw new Error(`${block.note.slice(0, 40)} is no longer in the copy`);
}
// The four bodies this record names, located by the text they start with, with the unit counts it
// states. `mR` is the one synchronous member of the four: the carry awaits the promise the reduce over
// its array builds, not the array itself.
const store = sources.get('chunk-tvdq3hrk.js').text;
const table = sources.get('chunk-nrk8z90j.js').text;
const lead = [
  ['async function ye(', store, 117],
  ['async function he(', store, 563],
  ['async function vt(', store, 165],
  ['function mR(', table, 88],
];
for (const [needle, text, count] of lead) {
  const block = ledger.blocks.find((entry) => text.slice(...entry.range).startsWith(needle));
  if (!block || block.units !== count) throw new Error(`${needle} is not the ${count}-unit body this record describes`);
}
if (!ledger.blocks.some((block) => block.module === 'chunk-nrk8z90j.js' && table.slice(...block.range).startsWith('function mR('))) {
  throw new Error('mR is no longer copied from the id table module');
}
// The store's own call site: `Se.read` is what consumes the read, and the throw it wraps a failure in
// is the next package's, not this one's.
if (!/async read\(e\)\{let r=S\(e\),n;try\{n=await vt\(e,r\)\}catch\(s\)\{throw new He\(/.test(store)) {
  throw new Error('the store no longer reads through vt with a wrapped failure');
}
if (ledger.blocks.some((block) => store.slice(...block.range).includes('Se={'))) {
  throw new Error('the closure now carries the store entry itself, so this record is stale');
}
// The id table the candidates are looked up in, and the parse and shape tests the carry leans on.
if (!copyText.includes('["tips","cc-plugin-tips"]')) throw new Error('the candidate table lost its tips entry');
for (const fragment of ['function W(n){return E(n)==="ENOENT"}', 'function L(n){return typeof n==="object"&&n!==null&&!Array.isArray(n)}']) {
  if (!copyText.includes(fragment)) throw new Error(`the copy lost ${fragment}`);
}
if (!copyText.includes('using r=ih`JSON.parse(${Pe(e)})`')) throw new Error('the parse no longer holds its disposable');
// The bound hook: the source quote in the boundary module is the module's own text, and the hook's
// unbound answer is the negative branch the tests exercise.
const boundaries = read('src/plugin-chain-store-carry-boundaries.ts');
const platform = read('extracted-v2/modules/chunk-3cynezh1.js');
const wDText = 'function wD(e){return Object.hasOwn(xo,e)}';
if (platform.slice(124407, 124449) !== wDText) throw new Error('the platform-id test moved in its module');
if (!boundaries.includes(wDText)) throw new Error('the boundary module no longer quotes the platform-id test');
if (!boundaries.includes('platformIdTable === undefined ? false : platformIdTable(id)')) {
  throw new Error('the unbound hook no longer answers its own negative branch');
}
const seam = read('src/plugin-chain-store-carry.ts');
if (!seam.includes("import { ye, he, vt, mR } from './plugin-chain-store-carry-source.js';")) {
  throw new Error('the seam no longer takes the four bodies from the copy');
}

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-51-tests.txt');
if (full.failed !== 0 || full.tests !== 1500) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-51-family.txt');
if (family.failed !== 0 || family.tests !== 224) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const seamSweep = summary('.audit/w45-51-seam.txt');
if (seamSweep.failed !== 0 || seamSweep.tests !== 9) throw new Error('the store-carry sweep is not clean');

const smokeReport = read('.audit/w45-51-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 275) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const allMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
const sharedMarkers = read('.audit/w45-51-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-51-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45StoreCarryCompiled.v1')) throw new Error('the shared driver did not print the W45-51 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45StoreCarryCompiled.v1 (${sharedMarkers.length} markers in the shared driver, ${allMarkers.length} across every driver: it bounds the candidate list against the plugin's built-in twin, carries a missing store from that twin, leaves no staged carry file, reports a concurrent carry at debug and a failed one at warn)`;

const evidence = {
  schema: 'W45StoreCarryEvidence.v1',
  package: 'W45-51 — the `$` store\'s read and carry layer',
  date: '2026-10-16',
  question: 'The store\'s `Se.read` calls `vt(id, S(id))`. What is `vt`, what does it do when the store file is not there, and where does the content come from?',
  answer: 'It is the store\'s read with a carry behind it: a missing store file is carried from the built-in twin of the same plugin (`cc-plugin-tips@builtin` from `tips@builtin`, through the short-name→package-id table), by writing the twin\'s text as `<file>.carry-<uuid>` and linking that into place. Text that does not parse, or parses to something other than a plain object, is refused; a link that is refused because another session carried it first is reported at debug and answers true; anything else that fails is reported at warn. The closure is 20 whole top-level statements across five chunks, 2,133 units. One name reaches a different subsystem — `wD`, the platform-id test inside the application\'s plugin table, whose closure is more than 75,000 units of the application core — so it is bounded as a hook.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  boundary: 'One hook. `wD` (chunk-3cynezh1.js [124407,124449), 42 units: `function wD(e){return Object.hasOwn(xo,e)}`) is the platform-id test `AUn` canonicalizes the id\'s second half through; `xo` is the application\'s plugin table, whose closure this record measured at more than 75,000 units across 226 statements, and it is not approximated here. The hook answers a plain yes or no, so unbound it answers false — the test\'s own negative branch, which `AUn` turns into "the id is used as it was written". That is a real answer for an id the table does not hold (measured: with the hook unbound, `cc-plugin-tips@BUILTIN` has no candidates; with a table bound, it canonicalizes and answers `tips@builtin`). `S` (the store file\'s path) comes from ./plugin-chain-store-path-source.ts, the data directory it is built under from ./plugin-chain-store-dir.ts, `E` from ./plugin-chain-fs-source.ts, and the logger and the error text helper from ./plugin-chain-host.ts and ./plugin-chain-source.ts.',
  measured: [
    'The candidate list is the plugin\'s built-in twins and nothing else: `cc-plugin-tips@builtin` → `["tips@builtin"]`; the short-name form `tips@builtin` → none; an unknown id → none; an id with no `@platform` half → none.',
    'The id\'s second half goes through the platform-id hook: unbound, `cc-plugin-tips@BUILTIN` has no candidates (the half is used as written); with a table that holds `builtin` bound, it answers `["tips@builtin"]`. Binding nothing restores the negative branch.',
    'A missing store is carried: `readStoreFile("cc-plugin-tips@builtin", S("cc-plugin-tips@builtin"))` answers the twin\'s text, the store file is really on disk afterwards, and the staged `<file>.carry-<uuid>` file is gone. A quiet carry logs nothing.',
    'A store that is there is read, not carried: with the target present, the read answers the target\'s own text even though the twin holds different content.',
    'The candidate read `ye` answers `[id, text]` — the candidate\'s own id, not the plugin\'s short name — and undefined when the candidate\'s file is missing.',
    'Content that parses to something other than a plain object (`[1,2]`, `null`, `"text"`) is refused with false, with no log, and nothing is written: the shape test returns before any write is attempted.',
    "Content that does not parse is a failed carry: false, nothing written, and one warn line `$.store (${id}): could not carry ${candidateId}'s store: ${reason}`.",
    "A store another session already carried is reported at debug and answers true: `$.store (cc-plugin-tips@builtin): tips@builtin's store was carried by another session`; the target keeps what the other session carried and the refused carry still removes its staged file.",
    'A carry the filesystem refuses (a read-only store directory) answers false through the read, logs one warn line with the EACCES reason, writes nothing and leaves no staged file; once the directory can be written again, the same read carries.',
    'The carry takes whatever the twin holds at that moment: removing the target and changing the twin makes the next read carry the new content.',
    'The store\'s own call site is `Se.read`: `let r=S(e); n=await vt(e,r)` with the failure wrapped in the store\'s own error (`throw new He(`${e}: store file ${r} is unreadable (…)`)`). `Se` itself — with `He`, the lock and the write — is the next package, and this closure deliberately stops at `vt`.',
    '`mR` is the one synchronous member of the four: it answers an array, and the carry awaits the promise its `reduce` builds. Its `toReversed()` cannot be observed ordering anything, because the shipped table maps one short name to each package id, so no id has more than one twin (recorded as a limitation, not asserted as an ordering).',
  ],
  behaviour_changed: [
    'The product can read a plugin store the way the source does: `readStoreFile` answers the file\'s text and, when the file is not there, the text of the same plugin\'s built-in twin — with the concurrent-carry and failed-carry cases reported through the host\'s own logger instead of throwing.',
    '2,133 units left the unported set, and the store family now waits only on the store entry itself: `Se` (read, write, lock) with `He`.',
    'The application-core dependency is bounded rather than faked: the platform-id hook answers its own negative branch unbound (measured both ways here and in the compiled driver), and the reach that is not ported is named in the seam.',
    'No product file changed behaviour on another path: the only edits outside the new copy, seam, boundary, suite and probes are the verifier registering the plan and the shared driver printing its marker.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'the new copy: unresolved 0',
    chain_verifier: chain,
    ledger_check: 'all 20 ranges are re-read from their five modules, compared with the ledger, searched for in the copy, and checked against acorn: every block is a whole top-level statement and none is copied twice',
    boundary_check: 'the platform-id test is asserted in its module at [124407,124449) and in the boundary module that quotes it; the hook\'s unbound answer is asserted in the boundary text; the four lead bodies are located by their opening text with the unit counts this record states; the store\'s own read site is asserted, and the store entry itself is asserted absent from the closure; the candidate table and the parse and shape tests are asserted in the copy',
    regressions: `the new store-carry suite ${seamSweep.passed}/${seamSweep.tests}; ${familyLine}`,
    full: fullLine,
    compiled: driverLine,
    smoke,
  },
  next_package: [
    'the store entry itself: `Se` (chunk-tvdq3hrk.js) with `He` — the read\'s failure wrapper, the write through the W45-50 writer under the W45-49 lock, and the four `store.*` entries with the dispatcher `JAt` and the option object `pt`; every name they reach is now in the product',
    '`settings.read` (`yGo`/`hGo`) once the settings store is ported; `http.fetch` (`VQt`) once the request runner `dNo` is',
    '`ui.copy` (`wGo`/`uzo`/`dzo`) once the clipboard encoder `Sv` and the surface catalog are ported, with the `stamp` field modelled',
    '`ui.blit` (`fNs`/`kFo`/`mNs`/`bFo`), `ui.scroll` (`O5n`/`L5n`), `ui.focus` (`fzo`/`Szo`), `ui.notify` (`Dzo`/`Fzo`/`Nzo`), each measured the same way first',
    '`fs.ancestors` (`mzt`/`kNs`) and `state.get`/`state.set` (`Jf`/`KD`)',
    'Q-086\'s 15 registry-reading cores and their 34 sites',
    'the notification context provider `a4n` and the clearTimer context `R`, and a streaming provider through the loader path',
    'the config/home layer behind `be` (configuration directory, home directory, `jsn`, the memoizer `po`): porting it would replace the store file layer\'s bound hook with the source\'s own `bl()`',
  ],
};
write('research/ports/W45-store-carry-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-51 **搬 store 读/携带层',
  features: "; W45-51 ports the store's read and carry layer",
  standard: '2026-10-16 W45-51 store 读/携带层',
  status: "W45-51: the store's read and carry layer.",
  runner: "## W45-51 ported the store's read and carry layer",
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
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-51 **搬 store 读/携带层**（store 的 \`Se.read\` 走的 \`vt\`）：**20 段 2,133 单位**、跨五模块（chunk-tvdq3hrk.js 的 \`ye\`/\`he\`/\`vt\`、chunk-nrk8z90j.js 的候选表与 \`mR\`/\`R\`/\`h\`/\`AUn\`/\`_r\`、chunk-mven2c2x.js 的 \`xQt\`、chunk-886tf6ja.js 的 \`W\`、chunk-6q0v3ahc.js 的 \`L\`、chunk-gyf58rwf.js 的解析助手 \`Y\`/\`Pe\`）。**语义（源文实测）**：读文件；**文件不在时"携带"**——从同一插件的内置孪生（\`cc-plugin-tips@builtin\` ← \`tips@builtin\`，经短名→包名表反查）取内容，写成 \`<file>.carry-<uuid>\`（\`wx\` 独占）后 **link 入位**（link 因非 EEXIST 失败则 \`copyFile\` COPYFILE_EXCL 兜底），最后必删携带文件。**先测后断言**（.audit/w45-51-probe.ts、-probe2.ts 与 test/plugin-chain-store-carry.test.ts）：候选只来自内置孪生（短名/未知 id/无 \`@\` 后缀 → 无候选）；**平台 id 钩子两分支都实测**（未绑定 → \`@BUILTIN\` 不规范化故无候选；绑定知晓 \`builtin\` 的表 → \`["tips@builtin"]\`）；缺文件时读得孪生内容且落盘、暂存文件消失、安静携带无日志；文件已在则读自身不携带；\`ye\` 回 \`[候选自身 id, 文本]\`；**解析成非普通对象（数组/null/字符串）→ false 且无日志、不写**；**解析不了 → false + 一条 warn**（\`$.store (id): could not carry 候选id's store: …\`）；**并发携带（link EEXIST）→ true + debug**（\`… was carried by another session\`），目标保留先到内容、暂存仍删；**只读目录 EACCES → false + 一条 warn、不写不留**，恢复权限后同调用即携带成功；携带取的是"当下"孪生内容。**一处诚实限制**：\`mR\` 的 \`toReversed()\` 无法观测出排序效果（出厂表里包名与短名一对一，故任何 id 至多一个孪生）。**边界**：\`wD\`（\`function wD(e){return Object.hasOwn(xo,e)}\`，chunk-3cynezh1.js [124407,124449) 42u）指向应用插件表，闭包 >75,000 单位 → 记为可绑定钩子，未绑定时答自身否定分支（真答案而非猜测），源文引用与两分支均由记录脚本回源。复用既有副本 \`S\`（W45-48）、\`E\`（W45-46）。store 侧调用点 \`Se.read\`（\`n=await vt(e,r)\`，失败包 \`He\`）据此确定下一包。验收：check/build/notices、新副本扫描 \`unresolved 0\`、**${chain}**、账本 20 段逐段回源+内容比对+**acorn 断言"每段都是完整顶层语句、无重叠"**、边界与四处主体、调用点、候选表、解析/形状测试回源断言、新回归 ${seamSweep.passed}/${seamSweep.tests}、插件链家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45StoreCarryCompiled.v1\`，共享 ${sharedMarkers.length} 标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [携带层证据](ports/W45-store-carry-evidence.json)、[原子写证据](ports/W45-atomic-evidence.json)、[锁文件库证据](ports/W45-lockfile-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
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
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-51 ports the store's read and carry layer: a store file that is not there is carried from the same plugin's built-in twin, staged beside it and linked into place, with a concurrent carry reported at debug and a failed one at warn. |`;
write('research/FEATURES.md', lines.join('\n'));

const standard = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standard.indexOf('2026-10-16 W45-50 原子写');
if (standardAt < 0) throw new Error('coding-standard W45-50 line not found');
const standardEntry = `2026-10-16 W45-51 store 读/携带层：S-1至S-7已对照。S-1（先读源）：由 store 的真实调用点 \`Se.read\`（\`let r=S(e);n=await vt(e,r)\`）起手，**先通读 \`vt\`/\`he\`/\`ye\`/\`mR\` 全体**（候选来源、\`wx\` 暂存、link 入位与 copyFile 兜底、EEXIST 与其它失败的两种日志、finally 删暂存、解析与形状两道门）再定 seam。S-2（不留半包）：20 段一次给全（含解析助手 \`Y\`/\`Pe\` 与两个测试 \`W\`/\`L\`），并把"未绑定钩子答否定分支""\`toReversed()\` 在本表不可观测"两条如实写入 seam 与证据，而非伪称已覆盖。S-3：\`.audit/w45-51-probe.ts\`/\`-probe2.ts\` 先实测（候选四态与钩子两分支、携带落盘与暂存清理、非对象/解析失败/并发/只读目录四条失败路径、\`ye\` 回候选自身 id），再写 9 条断言；三处首版断言把日志里的"候选 id"误写成"短名"（\`diff@builtin's store\` 而非 \`diff's store\`），由断言当场抓住并改为实测文本。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器/打包冒烟/${drivers.length} 个编译驱动并解析输出；acorn 断言（完整顶层语句、无重叠、无重复）与"store 条目本身不在闭包内"的反向断言一并加入，防止把 \`Se\` 误纳入或漏段。S-5/S-6：seam 只做命名与类型收窄（\`mR\` 如实为同步返回数组），复用既有 \`S\`/\`E\` 副本，无死导出。S-7：store 条目 \`Se\` 与 \`He\`、四条目与锁包装、\`settings.read\`、\`http.fetch\`、\`ui.copy\`（含 \`stamp\`）、\`ui.blit\`/\`scroll\`/\`focus\`/\`notify\`、\`fs.ancestors\`、\`state.*\`、Q-086、通知 Provider、config/home 层写入 next_package。验收：check/build/notices、扫描 unresolved 0、${chain}、账本与边界自证、回归 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf('W45-50: the atomic file writer.');
if (statusAt < 0) throw new Error('STATUS W45-50 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-51: the store's read and carry layer. The store's \`Se.read\` calls \`vt(id, S(id))\`, so this package took the read with the carry behind it: 20 whole top-level statements, 2,133 units, across five chunks. When the store file is not there, its content is carried from the same plugin's built-in twin — \`cc-plugin-tips@builtin\` from \`tips@builtin\`, found through the short-name to package-id table — by writing the text as \`<file>.carry-<uuid>\`, linking that into place and removing it again. Text that parses to something other than a plain object is refused silently; a link refused because another session carried the store first is reported at debug and answers true; anything else that fails is reported at warn. Every branch was measured first, including both answers of the one hook this package bounds: \`wD\`, the platform-id test inside the application's plugin table, whose closure is more than 75,000 units of the application core — unbound it answers the test's own negative branch, so an uppercase platform half is used as written. Two honest limitations are in the record: that hook's absence, and that \`mR\`'s \`toReversed()\` cannot be observed ordering anything because the shipped table maps one short name to each package id. The store entry itself (\`Se\` with \`He\`, the lock and the write) is the next package. Evidence: \`research/ports/W45-store-carry-evidence.json\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-51 ported the store's read and carry layer (2026-10-16)

The store's \`Se.read\` calls \`vt(id, S(id))\`. \`vt\` reads the file; when the file is not there it asks
\`he\` to carry the content from the same plugin's built-in twin (\`cc-plugin-tips@builtin\` from
\`tips@builtin\`, looked up through the short-name to package-id table) and reads again. The carry writes
the twin's text as \`<file>.carry-<uuid>\` with an exclusive create, links that file into the store's
place, falls back to \`copyFile\` with COPYFILE_EXCL when the link is refused for any reason other than
the target already existing, and removes the staged file on every path. Content that does not parse, or
parses to something other than a plain object, is refused; a link refused with EEXIST is a concurrent
carry and is logged at debug; anything else that fails is logged at warn.

The closure is 20 whole top-level statements — the store's own three bodies, the id table's map and its
five lookups, one id constant, the ENOENT test, the plain-object test, and the parse helper with its
disposable guard — 2,133 units across five chunks.

One name reaches a different subsystem: \`wD\`, the platform-id test \`AUn\` canonicalizes the id's second
half through, is a free name inside a table whose closure this record measured at more than 75,000 units
of the application core. It is bounded in src/plugin-chain-store-carry-boundaries.ts, quoting the
source's own body with its chunk and range. Unbound, the hook answers the test's own negative branch, so
the half is used as it was written — a real answer for an id that table does not hold, and measured both
ways here and in the compiled driver.

Measured before asserted: the candidate list in all four of its shapes; both answers of the platform-id
hook; the carry landing on disk with its staged file removed and no log; a store that is present being
read rather than carried; \`ye\` answering the candidate's own id; the three refused shapes (\`[1,2]\`,
\`null\`, \`"text"\`) refused silently; unparseable content and a read-only directory each producing one
warn line and nothing written; the concurrent carry's debug line with the earlier content left alone; and
the carry taking whatever the twin holds at that moment.

One limitation is recorded rather than papered over: \`mR\`'s \`toReversed()\` cannot be observed ordering
anything, because the shipped table maps exactly one short name to each package id.

Verified: check/build/notices, the new copy \`unresolved 0\`, ${chain}, the ledger, acorn and boundary
checks (including that the store entry itself is still outside this closure), the new suite
${seamSweep.passed}/${seamSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers (the shared
driver now also prints \`W45StoreCarryCompiled.v1\`), and the packaged smoke (${smoke}).
Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: the store entry itself — \`Se\` with \`He\`, the write through the W45-50 writer under the W45-49
lock, and the four \`store.*\` entries with the dispatcher \`JAt\` and the option object \`pt\` — and then
\`settings.read\`, \`http.fetch\`, \`ui.copy\` with its \`stamp\` field, and the remaining \`ui.*\` names.
`);

const rows = [
  ['2026-10-17T01:30:00Z', 'package', 'W45-51 搬 store 读/携带层（store 的 Se.read 走的 vt；20 段 2,133 单位，跨五模块）',
    'vt/he/ye/mR 与候选表、解析助手成为产品面：文件不在时从同插件内置孪生携带（wx 暂存 + link 入位 + copyFile 兜底 + 必删暂存），并发携带 debug、失败 warn，非普通对象静默拒绝',
    'chunk-tvdq3hrk.js ye [16724,16841) 117u、he [16841,17404) 563u、vt [17444,17609) 165u；chunk-nrk8z90j.js A/I [8301,8728)、m [8728,8742)、g [8769,8820)、_d/CQt/hu/ha/Pi [8941,9017)、R [9399,9493)、mR [9765,9853) 88u、h [9853,9907)、AUn [9907,9962)、_r [12751,12806)；chunk-mven2c2x.js uRe/xQt [615,667)；chunk-886tf6ja.js W [7507,7544)；chunk-6q0v3ahc.js L [615,685)；chunk-gyf58rwf.js Xs [59700,59730)、Qs [59730,59754)、ih [59754,59764)、Y [60056,60154)、Pe [60348,60401)',
    `实测（.audit/w45-51-probe.ts、-probe2.ts 与 test/plugin-chain-store-carry.test.ts + .audit/w45-24-compiled.mjs）：候选四态、钩子两分支、携带落盘与暂存清理、文件已在则读自身、ye 回候选自身 id、非对象静默拒绝、解析失败 warn、并发携带 debug 且保留先到内容、只读目录 EACCES warn 且恢复后成功；9/9 通过`],
  ['2026-10-17T01:34:00Z', 'finding', 'W45-51 边界：wD 指向应用插件表（闭包 >75,000 单位），记可绑定钩子并实测两分支',
    'AUn 用 wD 把 id 的 @后半段 规范化；xo 为应用插件表，其闭包 226 段 >75k 单位，不属于本包子系统，也不做近似',
    'seam 引用源文 \`function wD(e){return Object.hasOwn(xo,e)}\`（chunk-3cynezh1.js [124407,124449) 42u）；未绑定答自身否定分支（\`@BUILTIN\` 不规范化 → 无候选），绑定知晓 \`builtin\` 的表后 → \`["tips@builtin"]\`；记录脚本回源两处引用',
    '回归 9/9、家族 224/224、全量 1500/1500 通过；共享驱动 25 标记全出（新增 W45StoreCarryCompiled.v1）'],
  ['2026-10-17T01:37:00Z', 'finding', 'W45-51 诚实限制：mR 的 toReversed() 在本表不可观测',
    '出厂短名→包名表对每个包名只有一个短名，故 mR 的候选数组长度至多 1，排序无从体现',
    '证据与 runner 明写该限制，测试不断言排序，只断言候选集合与顺序无关的结果',
    '链校验器 50 plans 通过（本包 20 段 / 2,133 单位）；扫描 unresolved 0'],
  ['2026-10-17T01:40:00Z', 'verification', `W45-51 验收：新副本扫描 unresolved 0、账本 20 段逐段回源 + acorn 完整性、边界与 store 调用点回源自证、${chain}、回归 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '携带层收束，下一包转 store 条目本身（Se 与 He、四条 store.* 与锁包装）',
    `check/build/notices；扫描 unresolved 0；${chain}；账本 20 段逐段回源比长度与内容 + acorn 断言（完整顶层语句、无重叠、无重复）；wD 源文两处、钩子未绑定分支、四处主体单位数、store 调用点 Se.read、候选表与解析/形状测试回源断言；回归 ${seamSweep.passed}/${seamSweep.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45StoreCarryCompiled.v1，共享 ${sharedMarkers.length} 标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-51 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-51 acceptance (2026-10-16)

- [x] **The store's own call decided the surface.** \`Se.read\` calls \`vt(id, S(id))\`, and the store entry itself stays outside this closure (asserted by the record script).
- [x] **The whole closure came across.** 20 whole top-level statements, 2,133 units, five chunks; chain verifier (${chain}) and \`unresolved 0\`.
- [x] **Everything measured before it was asserted.** Candidate shapes, both answers of the platform-id hook, the carry landing and its cleanup, the three refused shapes, the two warn paths, the debug path, and the carry taking the twin's current content.
- [x] **The bound hook is a real answer, not a guess.** \`wD\`'s unbound branch is the test's own negative branch, exercised both ways here and in the compiled driver, with the source body quoted and the 75,000-unit reach named.
- [x] **The unobservable ordering is recorded.** \`mR\`'s \`toReversed()\` cannot be seen ordering anything with the shipped table; the tests assert the candidate set, not an order.
- [x] **Earlier copies reused.** \`S\` (W45-48) and \`E\` (W45-46) imported rather than copied again.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\`, ${chain}, ledger, acorn and boundary checks, new suite ${seamSweep.passed}/${seamSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
