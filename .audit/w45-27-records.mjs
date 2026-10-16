// W45-27 records: the notification bar's ledger core, the indexes and the audit trail. Anchored
// inserts assert their target first.
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = {
  sha256: '756c420722c62cbbeb3c8e311b2b2002e536500521b0735ea2bb66bfafc65a0d',
  inputs: { sha256: '7316570b8c7f1d020b10c5622379fefa83eab9b50fc5372c33aa85925691afeb', files: 313 },
  validation: { sha256: '80d7b3576c6a85850717b0216f7f452962bd3abd6c54202c8a86c32e85573040', files: 125 },
  build: { sha256: 'd27658c27ac62180adcdcd99237709ac656070ffdfe4c866261fec1ca2dc9cb4', files: 219 },
};

const evidence = {
  schema: 'W45NotifyLedgerEvidence.v1',
  package: 'W45-27 — the notification bar\'s ledger core (the tick, its time accounts and the merge)',
  date: '2026-10-15',
  question: 'The host\'s toast method and the bar\'s clock driver `TK` both work on a ledger. Which bodies own that ledger\'s time, what does one tick do to it, and what can be ported without the store and the zod schema?',
  answer: 'The whole time account is pure and lives in one run of chunk-sfn1dbxq.js: `aLs` is the tick, `PWt` ages the toasts by the running slot, `CWt` hands the queue\'s time out and loses what no waiting toast can hold over `a3` (50), `AWt`/`OWt`/`MWt` lay out what is kept, `RWt`/`IWt`/`RYr` are the ledger shape, `Fpe` the managed-first order, `EWt` one toast\'s lent time, `cLs` the merge with the store\'s toasts, `dLs` the next delay, `pLs`/`u1e` the text a plugin changed, `iLs` the cut-short test and `uLs` the lost-time line. 16 blocks / 2,897 units, all of it store-free; the store read/write (`SEt`, `xYr`, `lLs`), the zod schema (`TWt`) and the stored key (`Ope`) stay with the bar.',
  ported: [
    { module: 'chunk-sfn1dbxq.js', range: [1691480, 1691490], units: 10, names: ['a3'], note: 'the 50 ms of untold time a toast may hold' },
    { module: 'chunk-sfn1dbxq.js', range: [1691764, 1691998], units: 234, names: ['Fpe', 'EWt'], note: 'the managed-first order, and one toast\'s lent time' },
    { module: 'chunk-sfn1dbxq.js', range: [1691998, 1692401], units: 403, names: ['RWt', 'CWt'], note: 'the laid-out ledger, and which toasts keep their time and which are lost' },
    { module: 'chunk-sfn1dbxq.js', range: [1692401, 1692468], units: 67, names: ['RYr'], note: 'the empty frozen ledger' },
    { module: 'chunk-sfn1dbxq.js', range: [1692581, 1692719], units: 138, names: ['iLs'], note: 'whether a toast was shown to its plugin, or is the managed toast cut short' },
    { module: 'chunk-sfn1dbxq.js', range: [1692909, 1693009], units: 100, names: ['AWt'], note: 'the toasts the next ledger keeps' },
    { module: 'chunk-sfn1dbxq.js', range: [1693009, 1693411], units: 402, names: ['PWt'], note: 'one tick\'s aging: the slot\'s elapsed time lent away, and the queue\'s absentees cut to zero' },
    { module: 'chunk-sfn1dbxq.js', range: [1693411, 1693504], units: 93, names: ['MWt'], note: 'the key-to-text map of the laid-out toasts' },
    { module: 'chunk-sfn1dbxq.js', range: [1693504, 1693578], units: 74, names: ['IWt'], note: 'the running slot' },
    { module: 'chunk-sfn1dbxq.js', range: [1693578, 1693754], units: 176, names: ['OWt'], note: 'which laid-out toast each start time shows' },
    { module: 'chunk-sfn1dbxq.js', range: [1693754, 1694273], units: 519, names: ['aLs'], note: 'the tick' },
    { module: 'chunk-sfn1dbxq.js', range: [1694442, 1694593], units: 151, names: ['cLs'], note: 'the merge with the store\'s toasts' },
    { module: 'chunk-sfn1dbxq.js', range: [1694593, 1694731], units: 138, names: ['dLs'], note: 'the delay to the next tick' },
    { module: 'chunk-sfn1dbxq.js', range: [1694731, 1694871], units: 140, names: ['uLs'], note: 'the lost-time line' },
    { module: 'chunk-sfn1dbxq.js', range: [1694871, 1694966], units: 95, names: ['u1e'], note: 'an entry with the text a plugin changed' },
    { module: 'chunk-sfn1dbxq.js', range: [1694966, 1695123], units: 157, names: ['pLs'], note: 'the notification refresh, identity when nothing changed' },
  ],
  not_ported_beside_them: [
    { module: 'chunk-sfn1dbxq.js', range: [1691490, 1691527], symbol: 'Ope', why: 'the bar\'s store key, built from the manifest `a8`' },
    { module: 'chunk-sfn1dbxq.js', range: [1691527, 1691764], symbol: 'TWt', why: 'the zod schema of the stored ledger' },
    { module: 'chunk-sfn1dbxq.js', range: [1692468, 1692581], symbol: 'SEt', why: 'reads and parses the stored ledger out of the app store' },
    { module: 'chunk-sfn1dbxq.js', range: [1692719, 1692909], symbol: 'xYr', why: 'writes the ledger back to the app store' },
    { module: 'chunk-sfn1dbxq.js', range: [1694273, 1694442], symbol: 'lLs', why: 'appends a toast through SEt/xYr' },
  ],
  measured: [
    'One tick from the empty ledger with a stored 4000 ms toast: `wasShown` turns true, `slot = {key, endsAt: now+4000, shown: key}`, `texts` carries the laid-out text, `lost` is empty.',
    'The store holds what the last tick wrote (`xYr(we.ledger)`), so the next tick merges against its own ledger: at +1000 the toast has aged to 3000 and the slot stands; at +5000 the toast sits at 0 and the slot has no `shown`.',
    'With nothing stored the slot slides forward a slot at a time (`endsAt` 4000 at t=0, 8000 at t=4000) and no toast is ever shown.',
    '`nextTickDelayMs` gives the shown toast\'s own end only while it runs out before its slot does; equal, later or no slot all give `undefined`.',
    '`handOutTime` (measured triples): with 1000 ms to hand out, a 4000 ms toast keeps 1000 with its untold account settled at 0 and is reported lost with 3000; with 0 ms to hand out both toasts keep 0 and are reported lost with their full time; a toast already holding 100 ms of untold time is reported lost with 105 (its 5 ms left plus the untold).',
    '`ageOneTick` ages by the slot\'s elapsed time, not the tick\'s: a 1000 ms toast with `at:100`, `endsAt:1100`, ticked at 200, comes back at 900.',
    '`lentTime`: the shown toast gives up the elapsed time (3000 → 2000), another keeps its own (3000).',
    '`keptToasts` keeps only the keys the queue still holds; `runningSlot` is `undefined` with no current toast; `isToastCutShort` is true once a toast was shown.',
    '`refreshTexts`/`withChangedText` replace a changed text and hand the very same object back when nothing changed.',
    'The bar only ever sees plugin toasts: the split (`sLs`) drops every other key, so a non-plugin toast never reaches a tick.',
    '`reportLostTime` writes `$.ui.toast (<plugin>): <key> lost <ms> ms of its time, the notification bar having no toast time left for it`.',
  ],
  caught_by_the_tooling: [
    'The `a3` block was first planned as [1691480,1691491) — one unit too long, so it swallowed the `v` of the next `var` and the scope-aware scan reported `unresolved 1 (v)`. Corrected to [1691480,1691490).',
    'The seam first re-exported `OWT` where the source declares `OWt`; the module loader refused the import, not the type checker.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'src/plugin-chain-notify-source.ts: unresolved 0',
    chain_verifier: 'passed true, 27 plans',
    regressions: 'test/plugin-chain-notify.test.ts 3/3; ui + toast + notify together 10/10',
    full: '1337/1337',
    compiled: 'all fifteen dist drivers exit 0; .audit/w45-24-compiled.mjs extended to dist\'s ledger tick and prints W45NotifyLedgerCompiled.v1',
    smoke: 'scripts/smoke-package.mjs passed, upstreamRequests 0, 227 files',
  },
  next_package: [
    'the store half of the bar: `Ope`/`TWt`/`SEt`/`xYr`/`lLs` (chunk-sfn1dbxq.js [1691490,1695123) minus what W45-27 took) with the zod binding it needs, and the `TK` driver at chunk-24k7d6mw.js [478823,…)',
    'the host toast method\'s stacked path: `EEe` (chunk-24k7d6mw.js [173176,…)) with `bu()`/`wee` and the `toast stacked` notice',
    'the rest of the `$` table beyond the three ui floors, entry by entry',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
  ],
};
write('research/ports/W45-notify-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

// CURRENT: the W45-27 row above the W45-26 one.
const current = read('research/CURRENT.md');
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-15最新**：W45-27 **搬完通知栏的台账核心**（16 段 2,897 单位，全在 chunk-sfn1dbxq.js，全部无 store 依赖）：\`aLs\` 一拍 = \`PWt\` 按运行槽计时 + \`CWt\` 把队列时间分配出去并把超过 \`a3\`(50ms) 的「未告时间」记为 lost + \`AWt\`/\`OWt\`/\`MWt\` 铺排 + \`RWt\`/\`IWt\`/\`RYr\` 台账形状；辅以 \`Fpe\`（managed 优先）、\`EWt\`（借出时间）、\`cLs\`（与 store 的合并）、\`dLs\`（下次 tick 延迟）、\`pLs\`/\`u1e\`（插件改写的文本）、\`iLs\`（截短判定）、\`uLs\`（丢时间日志）。seam \`src/plugin-chain-notify.ts\` 提供 \`tickLedger\`（= \`aLs(cLs(prev, stored), split, now)\`，即 \`TK\` 的第一行）与各具名 re-export。**实测**：首拍 \`wasShown\` 转真、槽 \`{key, endsAt:now+4000, shown}\`；+1000 老化到 3000 且槽不动；+5000 归零且槽无 \`shown\`；无 store 台账时槽按拍滑移（4000→8000）；\`dLs\` 仅在显示中 toast 早于槽结束时给时间；\`CWt\` 三元组（1000ms 可分配 → kept 1000/untold 0、lost 3000；0ms → kept 0、lost 全额；已有未告 100ms → lost 105）；\`ageOneTick\` 按**槽已过时间**老化（1000→900）；**通知栏只见插件 toast**（\`sLs\` 丢弃非插件键）。工具链抓到的两处：\`a3\` 区间多算一单位被作用域感知扫描报 \`unresolved 1 (v)\`；seam 把 \`OWt\` 写成 \`OWT\` 被模块加载器拒。验收：check/build/notices、扫描 0、**27 计划**一致、聚焦 3/3 与相关 10/10、全量 **1337/1337**、十五个编译驱动（\`W45NotifyLedgerCompiled.v1\`）、打包冒烟 0 上游请求（227 文件）；身份 \`756c4207…\`。 | [台账核心证据](ports/W45-notify-evidence.json)、[toast 证据](ports/W45-toast-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('C-12 row not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the ledger core.
const features = read('research/FEATURES.md');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('interactive row not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = rowText.slice(0, lastPipe).replace(/\s+$/, '') +
  '. W45-27 added the notification bar\'s ledger core: the tick that ages toasts by the running slot, hands out the queue\'s time and reports what it cannot hold, with the merge, the next-tick delay and the text refresh beside it' +
  ' |';
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = read('research/coding-standard.md');
const standardAt = standard.indexOf('2026-10-15 W45-26 ');
if (standardAt < 0) throw new Error('coding-standard W45-26 line not found');
const standardEntry = `2026-10-15 W45-27 通知栏台账核心：S-1至S-7已对照。S-1（先读源）：先逐段读出 [1691480,1695123) 内每个声明体的依赖，再决定块集——store 读写（\`SEt\`/\`xYr\`/\`lLs\`）、zod schema（\`TWt\`）与存储键（\`Ope\`）明确排除并在证据里逐条列出区间与理由；\`aLs\` 的整条依赖链（PWt/CWt/Fpe/OWt/AWt/MWt/RWt/IWt）全在块集内。S-3（不留半包）：回归先量后写——每个断言值都来自探针实测（三元组、900 老化、槽滑移、\`dLs\` 边界），并在过程中发现两处必须如实记录的行为：store 是「上一拍的台账」（\`xYr(we.ledger)\` 决定了下一拍 merge 的对象），以及 \`sLs\` 只让插件 toast 进栏。S-7：zod/store 侧无源码可搬入本包范围，已作为下一包记录（含 \`TK\` 与宿主 toast 方法区间）。工具链抓到两处笔误：多算一单位的区间由作用域感知扫描报出，\`OWt\`/\`OWT\` 大小写由模块加载器拒。验收：check/build/notices、扫描 unresolved 0、27 计划一致、全量 1337/1337、十五个编译驱动、打包冒烟 0 上游请求。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-27 paragraph above the W45-26 one.
const status = read('research/STATUS.md');
const statusAt = status.indexOf('W45-26: the');
if (statusAt < 0) throw new Error('STATUS W45-26 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-27: the notification bar's ledger core. Sixteen blocks (2,897 units) of chunk-sfn1dbxq.js carry the bar's whole time account without the store: \\\`aLs\\\` is one tick — age by the running slot (\\\`PWt\\\`), hand the queue's time out and lose what no waiting toast can hold over \\\`a3\\\` (\\\`CWt\\\`), lay out what is kept (\\\`AWt\\\`/\\\`OWt\\\`/\\\`MWt\\\`) — with \\\`RWt\\\`/\\\`IWt\\\`/\\\`RYr\\\` the ledger shape, \\\`cLs\\\` the merge with the store, \\\`dLs\\\` the next delay, \\\`pLs\\\`/\\\`u1e\\\` the text a plugin changed, \\\`iLs\\\` the cut-short test and \\\`uLs\\\` the lost-time line. The store half (\\\`Ope\\\`/\\\`TWt\\\`/\\\`SEt\\\`/\\\`xYr\\\`/\\\`lLs\\\`) and the \\\`TK\\\` driver stay with the bar and are recorded with their ranges. Evidence: \\\`research/ports/W45-notify-evidence.json\\\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-27 section.
const runner = read('research/ports/W45-chain-runner.md');
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-27 ported the notification bar's ledger core (2026-10-15)

W45-26 left the bar itself with the host; this package takes the half of it that is pure. The run
[1691480,1695123) of chunk-sfn1dbxq.js holds the whole time account, and by reading each declaration's
dependencies it splits cleanly: sixteen blocks (2,897 units) are store-free, while \\\`Ope\\\` (the store key
over the manifest \\\`a8\\\`), \\\`TWt\\\` (the zod schema), \\\`SEt\\\`/\\\`xYr\\\` (the store read and write) and
\\\`lLs\\\` (the append through them) are not, and each is recorded with its range and reason.

\\\`tickLedger\\\` is the seam's one entry for the driver: \\\`aLs(cLs(previous, stored), split, now)\\\` — merge
the store's toasts into the previous ledger, then tick. Measured against the source's own sequence: a
stored 4000 ms toast turns \\\`wasShown\\\` true and takes the slot; a second later it has aged by the slot's
elapsed time while the slot stands; past its time it sits at zero and the slot has no \\\`shown\\\`; with
nothing stored the slot slides forward a slot at a time and no toast is ever shown. Two behaviours the
tests forced into the open and the record now carries: the store holds what the last tick wrote, so a tick
merges against its own ledger, and the split admits plugin toasts only.

Verified: check/build/notices, 27 byte-identical plans, the new copy \\\`unresolved 0\\\`, 3/3 new regressions,
ui + toast + notify 10/10, full 1337/1337, fifteen compiled drivers (the shared driver now prints
\\\`W45NotifyLedgerCompiled.v1\\\`), and the packaged smoke with zero upstream requests. Identity \\\`756c4207…\\\`.
`);

const rows = [
  ['2026-10-16T06:52:00Z', 'package', 'W45-27 搬完通知栏台账核心（aLs/CWt/PWt/AWt/OWt/MWT/cLs/dLs/pLs 等 16 段）',
    '通知栏的时间账全在 chunk-sfn1dbxq.js [1691480,1695123) 这一段，逐体读依赖后可切出无 store 的一半',
    '16 段 2,897 单位：a3 [1691480,1691490)、Fpe+EWt、RWt+CWt、RYr、iLs、AWt、PWt、MWt、IWt、OWt、aLs、cLs、dLs、uLs、u1e、pLs',
    'seam src/plugin-chain-notify.ts 提供 tickLedger 与具名 re-export；store 侧 Ope/TWt/SEt/xYr/lLs 逐条记录区间与理由；回归 test/plugin-chain-notify.test.ts 3/3（值全部实测）'],
  ['2026-10-16T07:06:00Z', 'verification', 'W45-27 验收：扫描 unresolved 0、1337/1337、打包 0 上游请求',
    '通知栏台账核心搬运',
    'check/build/notices；扫描 unresolved 0；verify-chain-copies passed true（27 plans）；聚焦 3/3 与相关 10/10；全量 1337/1337；十五个编译驱动 exit 0（w45-24-compiled 扩到 dist 台账拍，输出 W45NotifyLedgerCompiled.v1）；smoke-package（227 files, upstreamRequests 0）',
    '身份 756c4207…（inputs 7316570b / 313，validation 80d7b357 / 125，build d27658c2 / 219）'],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md');
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-27 acceptance (2026-10-15)

- [x] **The pure half is separated by reading, not by guessing.** Every declaration in [1691480,1695123) was read for its dependencies; the store half (\\\`Ope\\\`/\\\`TWt\\\`/\\\`SEt\\\`/\\\`xYr\\\`/\\\`lLs\\\`) is out and each is recorded with its range and reason.
- [x] **Values are measured before they are asserted.** The tick sequence, the \\\`handOutTime\\\` triples, the 900 ms aging, the slot slide and the \\\`dLs\\\` boundary all came from probes.
- [x] **Two behaviours are recorded, not smoothed over.** The store holds the last tick's ledger (so a tick merges against its own), and the split admits plugin toasts only.
- [x] **The tooling caught two slips.** A one-unit-long \\\`a3\\\` range was reported by the scope-aware scan; the \\\`OWt\\\`/\\\`OWT\\\` case error was refused by the module loader.
- [x] **Sweep.** check/build/notices, scan \\\`unresolved 0\\\`, 27 byte-identical plans, 3/3 new regressions, full 1337/1337, fifteen compiled drivers, packaged smoke with zero upstream requests.
`);
console.log('records written');
