// Write the W45-47 record from the artifacts themselves: the ui.selection entry and its body, and the
// audit of every entry the same literal still holds, measured entry by entry.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 369, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 142, `validation ${identity.validation.files}`);
expect(identity.build.files === 256, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 46) throw new Error('the chain verifier did not pass 46 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const copy = verifier.files.find((file) => file.product.endsWith('plugin-chain-ui-source.ts'));
if (!copy || copy.blocks !== 15 || copy.units !== 1543) throw new Error('the ui copy is not the 15-block, 1,543-unit one');

const ledger = JSON.parse(read('src/plugin-chain-ui-source-blocks.json'));
if (ledger.blocks.length !== 15) throw new Error('the ui ledger does not hold fifteen blocks');
const added = ledger.blocks.at(-1);
if (added.module !== 'chunk-sfn1dbxq.js' || added.range.join(',') !== '1869714,1869767' || added.units !== 53) {
  throw new Error('the added block is not u2t');
}
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 1543) throw new Error(`the ledger holds ${units} units`);
const scan = execFileSync(process.execPath, ['scripts/source-undeclared-scan.mjs', 'src/plugin-chain-ui-source.ts'], { encoding: 'utf8' });
if (!/unresolved 0/.test(scan)) throw new Error('the ui copy has unresolved names');

// The entry and its neighbours are read out of the module's own literal, with each span measured here
// rather than remembered: the key's quote to the character before the separating comma.
const sfn = read('extracted-v2/modules/chunk-sfn1dbxq.js');
const spanOf = (key) => {
  const start = sfn.indexOf(`"${key}":`);
  if (start < 0) throw new Error(`the table entry ${key} was not found`);
  let depth = 0;
  for (let i = start + 1; i < sfn.length; i++) {
    const ch = sfn[i];
    if (ch === '{' || ch === '(' || ch === '[') depth += 1;
    else if (ch === '}' || ch === ')' || ch === ']') { if (depth === 0) return [start, i]; depth -= 1; }
    else if (ch === ',' && depth === 0) return [start, i];
  }
  throw new Error(`the table entry ${key} has no end`);
};
const entry = spanOf('ui.selection');
if (entry.join(',') !== '2353525,2353549') throw new Error(`the ui.selection entry span is ${entry}`);
if (sfn.slice(entry[0], entry[1]) !== '"ui.selection":{run:u2t}') throw new Error('the ui.selection entry text moved');
const copyEntry = spanOf('ui.copy');
if (copyEntry.join(',') !== '2353613,2353652') throw new Error(`the ui.copy entry span is ${copyEntry}`);
const copyText = sfn.slice(copyEntry[0], copyEntry[1]);
if (copyText !== '"ui.copy":{check:wGo,stamp:uzo,run:dzo}') throw new Error('the ui.copy entry text moved');
const { uiCallTable } = await import('../dist/plugin-chain-ui.js');
const uiKeys = Object.keys(uiCallTable()).sort().join(',');
if (uiKeys !== 'ui.log,ui.selection,ui.status,ui.toast') throw new Error(`the built ui table binds ${uiKeys}`);
if (uiCallTable()['ui.selection'].check !== undefined) throw new Error('the selection entry grew a check');

// The audit: every entry the same literal still holds, with the module its reach leaves this product
// through. Sizes and ranges below were measured in this package's recon, per module.
const storeEntries = ['store.get', 'store.set', 'store.delete', 'store.keys'].map((key) => {
  const span = spanOf(key);
  return { key, range: span, units: span[1] - span[0], text: sfn.slice(span[0], span[1]) };
});
if (storeEntries.some((item) => !item.text.includes('JAt('))) throw new Error('the store entries no longer run JAt');
const tvdq = read('extracted-v2/modules/chunk-tvdq3hrk.js');
if (!tvdq.slice(19056, 19326).startsWith('var JAt=(e,r)=>ct(r)(()=>Ce(e,r))')) throw new Error('JAt moved');
if (tvdq.slice(15722, 15829).indexOf('function le()') !== 0) throw new Error('le moved');
const blockers = [
  '`store.*` — the four entries above are inline objects over `JAt` (chunk-tvdq3hrk.js [19056,19326) 270 units, `(e,r)=>ct(r)(()=>Ce(e,r))`), the memoized handle `ct=le()` [15829,15840) over `NDe` [15635,15722) 87 units, and the store backend `Se` beside them. That backend locks through `Wa` → `lt()` → `ft()` in chunk-c6qwr3kc.js (23,134 bytes) and replaces files atomically through `vn` (chunk-1t033v1j.js, 12,458 bytes) under the data directory `bl()` (chunk-s9zkj3fw.js), with a carry path (`he`/`ye`) over `mR`. The lockfile library, the atomic writer and the data-dir resolution are all unported, so the store family waits on them rather than being half-taken.',
  '`settings.read` — `{check:(n)=>yGo(n?.source),run:(n)=>hGo(n)}` with `yGo` 186 units and `hGo` 89 units, both copied-sized, but `hGo` reads the live settings through `ft()` and `fe(...)` in chunk-x0dc37w9.js — the settings store itself, still unported.',
  '`http.fetch` — `"http.fetch":VQt(e)`, a factory (chunk-sfn1dbxq.js, 205 units) whose run resolves the call\'s plugin identity through `wme(e,r,"http.fetch")` and hands it to the request runner `dNo`.',
  '`ui.copy` — `{check:wGo,stamp:uzo,run:dzo}`: a check (218 units), a `stamp` (81 units) that fills in the surface the caller left out, and a run (780 units) that reaches `Sv` (823 units, chunk-kexg5hxg.js) — the clipboard encoder with its tmux/screen/OSC-52 paths and its ssh/mux probes — plus `DGo` (266 units) for the non-terminal clients and `vFe` over the surface catalog. The clipboard layer is unported.',
  '`ui.blit` — `fNs` (537 units) over `kFo` (701 units, images) and `mNs` (658 units, rasters) with `bFo` (48 units): the image and raster registries behind them are unported.',
  '`fs.ancestors` — `mzt` (458 units) over the check `kNs` (492 units), walking the roots the tool context holds (`fzt`, `pzt`, `RCn`, `cLo`).',
  '`state.get`/`state.set` — the bodies reach the scope accessors `Jf`/`KD` (W45-45\'s finding), which are not in the product.',
];

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-47-tests.txt');
if (full.failed !== 0 || full.tests !== 1470) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-47-family.txt');
if (family.failed !== 0 || family.tests !== 194) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const seam = summary('.audit/w45-47-seam.txt');
if (seam.failed !== 0 || seam.tests !== 8) throw new Error('the ui sweep is not clean');

const smokeReport = read('.audit/w45-47-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 264) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const allMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
const sharedMarkers = read('.audit/w45-47-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-47-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45UiSelectionCompiled.v1')) throw new Error('the shared driver did not print the W45-47 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45UiSelectionCompiled.v1 (${sharedMarkers.length} markers in the shared driver, ${allMarkers.length} across every driver: it reads the selection the bound context holds through its own accessor and answers undefined with none bound)`;

const evidence = {
  schema: 'W45UiSelectionEvidence.v1',
  package: 'W45-47 — the `$` table\'s ui.selection entry, and the audit of every entry the same literal still holds',
  date: '2026-10-16',
  question: 'W45-46 closed the filesystem floor and queued the `store.*` family, the remaining `ui.*` entries and the two entries beside the clock keys. Which of those is ready, and what exactly blocks the rest?',
  answer: 'Only `ui.selection` is ready, and it is taken here: `"ui.selection":{run:u2t}` (24 units of table text) with its body `u2t` (53 units) — `()=>Promise.resolve(bI()?.selection?.read())`, the selection the bound loader context holds, read through that context\'s own accessor. Everything else the literal still holds is blocked on an unported subsystem, and each blocker is now measured: the store family waits on the lockfile library (`Wa` → `lt()` → `ft()`, chunk-c6qwr3kc.js 23,134 bytes) plus the atomic writer `vn` (chunk-1t033v1j.js 12,458 bytes) and the data-dir `bl()`; `settings.read` waits on the settings store (`ft()`/`fe()` in chunk-x0dc37w9.js); `http.fetch` on the request runner `dNo`; `ui.copy` on the clipboard encoder `Sv` (823 units) and the surface catalog; `ui.blit` on the image and raster registries; `fs.ancestors` on the tool-context roots; and `state.*` on the scope accessors `Jf`/`KD`.',
  entry: { name: 'ui.selection', range: entry, units: entry[1] - entry[0], text: sfn.slice(entry[0], entry[1]) },
  neighbour: { name: 'ui.copy', range: copyEntry, units: copyEntry[1] - copyEntry[0], text: copyText, field_not_modelled: 'stamp' },
  ported: [{ module: added.module, range: added.range, units: added.units, bodySha256: added.bodySha256, note: added.note }],
  blocker_audit: blockers,
  store_entries: storeEntries,
  measured: [
    'The entry has no `check`: the source gives `ui.selection` a `run` and nothing else, so an argument is never refused — with a passthrough handler installed the call still reaches the floor, and the built table\'s entry has no `check` field.',
    'The floor reads the bound context\'s own accessor: the test binds a context whose `selection.read` records the call and returns a value, and asserts the value comes back while `read` was called exactly once — the accessor is invoked, not the value taken.',
    'Nothing bound and a context without a selection both answer `undefined` rather than throwing: the source\'s `bI()?.selection?.read()` is an optional chain, and the test asserts both paths.',
    'A handler in the chain answers first, as every `$` entry does through W45-20\'s `Hze`.',
    'The literal\'s next entry carries a field this seam does not model: `ui.copy` is `{check:wGo,stamp:uzo,run:dzo}` — `uzo` fills in the surface the caller left out before the run. The span and text are asserted here so the finding cannot drift.',
    'The audit\'s spans are measured, not remembered: the record finds each `store.*` entry in the literal and measures its span, and asserts `JAt` and `le` still read as the audit describes them.',
  ],
  behaviour_changed: [
    'A plugin can read the current selection through `$.ui.selection`, answering the bound context\'s own selection or `undefined` when there is none — 24 units of table text and 53 units of body became product surface.',
    'The ui copy grew from 14 blocks to 15 (1,490 → 1,543 units) with no new imports, no new source file and no new build input: the block uses `bI`, which the copy already imported.',
    'The four remaining ui families, the store family, the settings read, the http fetch and `fs.ancestors` are recorded with a measured blocker each, so the next package starts from the blocker list rather than from a scan.',
    'One finding is recorded for the next seam that takes a `stamp` entry: the table\'s entries may carry `stamp` as well as `check` and `run`, and `ui.copy` is the first one that does.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'the ui copy: unresolved 0',
    chain_verifier: chain,
    entries_check: 'the record measures the `ui.selection` and `ui.copy` spans in the literal, asserts their exact texts, and asserts the built table binds exactly the four ui names with no check on the selection entry',
    ledger_check: 'every copied range is re-read from its module and its length compared against the ledger; the added block is asserted to be `u2t`',
    blocker_check: 'the store entries are found in the literal and their spans measured, and `JAt`/`le` are re-read from their module',
    regressions: `the ui suites (the floor suite plus the new selection suite) ${seam.passed}/${seam.tests}; ${familyLine}`,
    full: fullLine,
    compiled: driverLine,
    smoke,
  },
  next_package: [
    'the lockfile library behind the store (`lt()` → `ft()`, chunk-c6qwr3kc.js) together with the atomic writer `vn` (chunk-1t033v1j.js) and the data-dir `bl()` (chunk-s9zkj3fw.js): the three pieces the `store.*` family waits on',
    'then the `store.*` family itself: the four entries over `JAt`/`Ce`/`Se` with `le`/`NDe` and the checks `ppr`/`xNs`',
    '`settings.read` (`yGo`/`hGo`) once the settings store (`ft()`/`fe(...)` in chunk-x0dc37w9.js) is ported',
    '`http.fetch` (`VQt`) once the request runner `dNo` is ported',
    '`ui.copy` (`wGo`/`uzo`/`dzo`) once the clipboard encoder `Sv` and the surface catalog are ported — and with the `stamp` field modelled',
    '`ui.blit` (`fNs`/`kFo`/`mNs`/`bFo`) once the image and raster registries are ported',
    '`ui.scroll` (`O5n`/`L5n`), `ui.focus` (`fzo`/`Szo`), `ui.notify` (`Dzo`/`Fzo`/`Nzo`), each after its own reach is measured the same way',
    '`fs.ancestors` (`mzt`/`kNs`) and `state.get`/`state.set` (`Jf`/`KD`), as recorded earlier',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'the notification context provider `a4n` (chunk-356hrhz3.js [1453,1607)) and the clearTimer context `R` [1431,1432)',
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
    'the helpers/config store behind `BEo` and the load pipeline behind `zLr`/`sc`: subsystems in their own right, not packages (W45-43 recon)',
  ],
};
write('research/ports/W45-ui-selection-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-47 **补 `$` 表 `ui.selection`',
  features: '; W45-47 binds the `$` ui.selection floor',
  standard: '2026-10-16 W45-47 ui.selection 条目与剩余条目清点',
  status: 'W45-47: the `$` ui.selection entry, and the literal\'s remaining entry audit.',
  runner: '## W45-47 ported `$` ui.selection and audited the literal\'s remaining entries',
};
const stripBlock = (text, mark, { toEnd = false, paragraph = false } = {}) => {
  const at = text.indexOf(mark);
  if (at < 0) return text;
  const start = text.lastIndexOf('\n', at) + 1;
  if (toEnd) return text.slice(0, start);
  const end = paragraph ? text.indexOf('\n\n', at) : text.indexOf('\n', at);
  return text.slice(0, start) + text.slice(end < 0 ? text.length : end + 1);
};

// CURRENT: the W45-47 row above the W45-46 one.
const current = stripBlock(read('research/CURRENT.md'), marks.current);
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-47 **补 \`$\` 表 \`ui.selection\` 条目，并把同 literal 剩余条目逐条量清阻塞**（\`ui.selection\`：表文 24 单位 + 体 53 单位；ui 副本 14→15 段、1,490→1,543 单位，**无新 import、无新源文件、无新构建输入**——体只用副本早已 import 的 \`bI\`）。条目 \`"ui.selection":{run:u2t}\`（[2353525,2353549)）无 \`check\`，floor 即体本身 \`()=>Promise.resolve(bI()?.selection?.read())\`：有绑定上下文则调其**自有 accessor** 读选区，无上下文或上下文无 selection 则 \`undefined\`（源即可选链，不抛）。**逐条清点的阻塞（本次实测）**：\`store.*\` 四条目（内联对象，经 \`JAt=(e,r)=>ct(r)(()=>Ce(e,r))\` 270 单位 / \`ct=le()\` / \`NDe\` 87 单位 / 后端 \`Se\`）卡在**锁文件库**（\`Wa\`→\`lt()\`→\`ft()\`，chunk-c6qwr3kc.js 23,134 字节）+ **原子替换写** \`vn\`（chunk-1t033v1j.js 12,458 字节）+ 数据目录 \`bl()\`；\`settings.read\` 卡在设置存储 \`ft()\`/\`fe()\`（chunk-x0dc37w9.js）；\`http.fetch\` 卡在请求执行器 \`dNo\`；\`ui.copy\` 卡在剪贴板编码器 \`Sv\`（823 单位）与表面目录，且其条目带本 seam 尚未建模的 **\`stamp\`** 字段（\`{check:wGo,stamp:uzo,run:dzo}\`，区间与文本已在记录中自证）；\`ui.blit\` 卡在图像/栅格注册表；\`fs.ancestors\` 卡在工具上下文根；\`state.*\` 卡在作用域访问器 \`Jf\`/\`KD\`。**实测**（先量后断）：无 \`check\` 即参数永不被拒（装了 passthrough handler 仍直达 floor，且编译后表项无 \`check\` 字段）；accessor 被**调用一次**（记录调用并回值，断言调用发生）；无上下文与上下文无 selection 两条路径都回 \`undefined\`；handler 优先照旧；审计区间与 \`JAt\`/\`le\` 文本由记录脚本**现算现比**，防记忆漂移。验收：check/build/notices、ui 副本扫描 \`unresolved 0\`、**${chain}**、条目两段与邻居 \`ui.copy\` 自证、账本 15 段逐段回读（末段断言为 \`u2t\`）、阻塞回读自证、ui 双套回归 ${seam.passed}/${seam.tests}、插件链家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45UiSelectionCompiled.v1\`，共享 ${sharedMarkers.length} / 全体 ${allMarkers.length} 标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [ui.selection 证据](ports/W45-ui-selection-evidence.json)、[文件系统证据](ports/W45-fs-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('the C-12 row was not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the selection read.
const features = read('research/FEATURES.md').replace(new RegExp(`${marks.features.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^|]*`), '');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('the interactive feature row was not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-47 binds \`$\` ui.selection: a plugin reads the current selection through the bound context's own accessor, answering undefined when nothing is selected or nothing is bound. |`;
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standard.indexOf('2026-10-16 W45-46 文件系统 floor');
if (standardAt < 0) throw new Error('coding-standard W45-46 line not found');
const standardEntry = `2026-10-16 W45-47 ui.selection 条目与剩余条目清点：S-1至S-7已对照。S-1（先读源）：先逐条量同 literal 剩余条目的阻塞（一律按**读它的模块**解析同名压缩名），量出 \`ui.selection\` **无阻塞**（体只用副本已 import 的 \`bI\`），而 \`store.*\`/\`settings.read\`/\`http.fetch\`/\`ui.copy\`/\`ui.blit\`/\`fs.ancestors\`/\`state.*\` 各自卡在未搬子系统上，并把每个阻塞的模块与体量写进证据。S-2（不留半包）：本包只取就绪的 \`ui.selection\` 一条（表文 + 体），并把七条阻塞逐条写明；不半搬 store。S-3：回归先依赖实测量出的取值（无 \`check\` 即参数不拒、accessor 被调用一次、无上下文与无 selection 皆回 \`undefined\`、handler 优先），断言字面值与调用事实。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器/打包冒烟/${drivers.length} 个编译驱动并解析输出，\`ported\` 由 ledger 读回，条目与邻居区间**现算**并比文本，审计所述 \`JAt\`/\`le\` 回源复核。S-5/S-6：seam 仅加一个表项与一个可选字段（\`PluginUiSession.selection\`），无死导出；\`stamp\` 字段以发现形式记录而非凭猜建模。S-7：锁文件库+原子写+数据目录、\`store.*\`、\`settings.read\`、\`http.fetch\`、\`ui.copy\`（含 \`stamp\`）、\`ui.blit\`、\`ui.scroll\`/\`focus\`/\`notify\`、\`fs.ancestors\`、\`state.*\`、Q-086、通知 Provider、helpers/config store 与装载管线写入 next_package。验收：check/build/notices、扫描 unresolved 0、${chain}、条目与邻居自证、账本回读、阻塞回读、回归 ${seam.passed}/${seam.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-47 paragraph above the W45-46 one.
const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf("W45-46: the `$` filesystem floor.");
if (statusAt < 0) throw new Error('STATUS W45-46 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-47: \`$\` ui.selection, and the literal's remaining-entry audit. One entry was ready — \`"ui.selection":{run:u2t}\`, 24 units of table text over the copied 53-unit body \`()=>Promise.resolve(bI()?.selection?.read())\` — and it cost no new import, no new source file and no new build input, because the ui copy already imported \`bI\`. Its shape is the slice's odd one: no \`check\`, so no argument is ever refused, and the floor is the body itself. The rest of the literal is blocked, and this package measured each blocker instead of discovering it later: the store family waits on a lockfile library (chunk-c6qwr3kc.js, 23,134 bytes), an atomic writer (chunk-1t033v1j.js, 12,458 bytes) and a data directory; \`settings.read\` on the settings store; \`http.fetch\` on its request runner; \`ui.copy\` on a clipboard encoder and the surface catalog; \`ui.blit\` on the image and raster registries; \`fs.ancestors\` on the tool-context roots; \`state.*\` on the scope accessors. One finding is recorded for whoever takes \`ui.copy\`: table entries can carry \`stamp\` as well as \`check\` and \`run\`. Evidence: \`research/ports/W45-ui-selection-evidence.json\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-47 section.
const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-47 ported \`$\` ui.selection and audited the literal's remaining entries (2026-10-16)

One entry was ready and is product surface: \`"ui.selection":{run:u2t}\` (chunk-sfn1dbxq.js
[2353525,2353549), 24 units) over the copied body \`u2t\` ([1869714,1869767), 53 units) —
\`()=>Promise.resolve(bI()?.selection?.read())\`, the selection the bound loader context holds, read
through that context's own accessor. It added no import, no source file and no build input: the ui
copy already imported \`bI\`, so the copy grew from 14 blocks to 15 (1,490 → 1,543 units) and nothing
else moved.

Its shape is the one oddity in this slice: no \`check\`, so no argument is ever refused, and the
floor is the body itself rather than a wrapper. Nothing bound and a context without a selection both
answer \`undefined\` — the source's own optional chain — which the tests assert on both paths.

Everything else the literal still holds is blocked, and each blocker was measured here rather than
found later: the store family waits on a lockfile library (\`Wa\` → \`lt()\` → \`ft()\`, chunk-c6qwr3kc.js
at 23,134 bytes), the atomic writer \`vn\` (chunk-1t033v1j.js, 12,458 bytes) and the data directory
\`bl()\`; \`settings.read\` waits on the settings store; \`http.fetch\` on its request runner \`dNo\`;
\`ui.copy\` on the clipboard encoder \`Sv\` (823 units) and the surface catalog; \`ui.blit\` on the image
and raster registries; \`fs.ancestors\` on the tool-context roots; \`state.*\` on \`Jf\`/\`KD\`.

The audit also produced a finding for the next seam: table entries can carry \`stamp\` in addition to
\`check\` and \`run\` — \`"ui.copy":{check:wGo,stamp:uzo,run:dzo}\` is the first that does, and the
record measures its span and text so the finding cannot drift.

Verified: check/build/notices, the ui copy \`unresolved 0\`, ${chain}, the entry, ledger and blocker
checks, the ui suites ${seam.passed}/${seam.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled
drivers (the shared driver now also prints \`W45UiSelectionCompiled.v1\`), and the packaged smoke
(${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself, which
asserts the counts).

Next: the lockfile library with the atomic writer and the data directory — the three pieces the
\`store.*\` family waits on — then the store family itself, then the remaining \`ui.*\` entries by the
same measure-first rule.
`);

const rows = [
  ['2026-10-16T22:50:00Z', 'package', 'W45-47 补 `$` 表 ui.selection 条目（表文 24 单位 + 体 53 单位；ui 副本 14→15 段、1,490→1,543 单位，无新 import/源文件/构建输入）',
    'ui.selection 成为产品面：floor 即体本身，读绑定上下文自有 accessor 的选区，无上下文或无 selection 皆回 undefined；同 literal 剩余条目逐条清点阻塞',
    'chunk-sfn1dbxq.js [2353525,2353549) 条目 "ui.selection":{run:u2t}；体 u2t [1869714,1869767) 53 单位；邻居 "ui.copy":{check:wGo,stamp:uzo,run:dzo} [2353613,2353652) 39 单位',
    `实测（test/plugin-chain-ui-selection.test.ts + .audit/w45-24-compiled.mjs）：无 check 即参数不拒、accessor 调用一次、两条 undefined 路径、handler 优先、表键恰为四名；5/5 通过`],
  ['2026-10-16T22:56:00Z', 'finding', 'W45-47 量清同 literal 剩余条目的阻塞（按读它的模块解析同名压缩名）',
    'store.* 卡锁文件库 Wa→lt()→ft()（chunk-c6qwr3kc.js 23,134 字节）+ 原子写 vn（chunk-1t033v1j.js 12,458 字节）+ 数据目录 bl()；settings.read 卡设置存储 ft()/fe()（chunk-x0dc37w9.js）；http.fetch 卡请求执行器 dNo；ui.copy 卡剪贴板编码器 Sv（823 单位）+ 表面目录；ui.blit 卡图像/栅格注册表；fs.ancestors 卡工具上下文根；state.* 卡 Jf/KD',
    '本包只取就绪的 ui.selection；七条阻塞连同模块与体量写入 evidence.blocker_audit 与 next_package，审计区间与 JAt/le 文本由记录脚本现算现比',
    'check/build 通过；store 四条目区间现算、JAt/le 回源复核通过；阻塞清单进入下一包起手'],
  ['2026-10-16T22:59:00Z', 'finding', 'W45-47 发现表项可带 stamp 字段（本 seam 尚未建模）',
    'ui.copy 条目为 {check:wGo,stamp:uzo,run:dzo}：uzo 在 run 之前补齐调用方未给的 surface，故 dispatcher 的表项形状不止 check/run 两字段',
    '本包不凭猜建模 stamp；只在 seam 头注与记录中写明，并把该条目的区间与文本在记录脚本里自证，防漂移',
    '回归 8/8、家族 194/194、全量 1470/1470 通过；驱动 21 标记全出'],
  ['2026-10-16T23:02:00Z', 'verification', `W45-47 验收：ui 副本扫描 unresolved 0、条目与邻居自证、账本末段断言为 u2t、阻塞回读、${chain}、回归 ${seam.passed}/${seam.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    'ui.selection 收束，下一包转锁文件库 + 原子写 + 数据目录三件（store.* 前置）',
    `check/build/notices；扫描 unresolved 0；${chain}；条目两段现算区间与文本比对 + 编译后表键自证；账本 15 段逐段回源比长度；阻塞（store 四条目区间 + JAt/le 文本回源）；回归 ${seam.passed}/${seam.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45UiSelectionCompiled.v1，共享 ${sharedMarkers.length} / 全体 ${allMarkers.length} 标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-47 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-47 acceptance (2026-10-16)

- [x] **Every remaining entry was measured before one was taken.** Resolved per module, which is how \`ui.selection\` was found ready and the other seven were found blocked.
- [x] **One entry is product surface.** \`"ui.selection":{run:u2t}\` with its body, the shape of the slice that carries no \`check\`.
- [x] **The copy grew by one block and nothing else.** 14 → 15 blocks, 1,490 → 1,543 units, no new import, source file or build input; chain verifier (${chain}) and \`unresolved 0\`.
- [x] **The blockers are recorded with their reach.** The store's lockfile, atomic writer and data directory; the settings store; the fetch runner; the clipboard encoder and surface catalog; the image registries; the tool-context roots; the scope accessors.
- [x] **One finding for the next seam.** Table entries can carry \`stamp\`, and \`ui.copy\` is the first that does; its span and text are asserted so the finding cannot drift.
- [x] **Everything measured before it was asserted.** No check on the entry, the accessor called once, both \`undefined\` paths, the handler-first route, and the four bound names.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\`, ${chain}, entry/ledger/blocker checks, ui suites ${seam.passed}/${seam.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
