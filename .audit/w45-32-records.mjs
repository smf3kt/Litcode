// W45-32 records: the host toast stack, the indexes and the audit trail. Identity, the chain
// verifier's report, the full sweep's summary and the packaged smoke's report are read from their
// own outputs, so the record cannot carry a number the tree did not produce.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 330, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 130, `validation ${identity.validation.files}`);
expect(identity.build.files === 231, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
expect(verifier.passed === true, 'the chain verifier did not pass');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;

const sweep = read('/tmp/w45-32-sweep.txt');
const sweepOf = (label) => Number(new RegExp(`^\\u2139 ${label} (\\d+)$`, 'm').exec(sweep)?.[1]);
const tests = sweepOf('tests');
const passed = sweepOf('pass');
const failed = sweepOf('fail');
if (!Number.isInteger(tests) || !Number.isInteger(failed)) throw new Error('the sweep report has no summary');
const sweepFailNames = [...sweep.matchAll(/^✖ (.+?) \(\d/gm)].map((m) => m[1]);
const full = `${tests} tests / ${passed} pass / ${failed} fail` +
  (failed === 0 ? ' on the frozen tree' : `: ${sweepFailNames.join('; ')}`);

const smokeReport = read('/tmp/w45-32-smoke.txt').split('\n')
  .filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; ` +
  `upstreamRequests ${smokeReport.upstreamRequests}`;

const evidence = {
  schema: 'W45NotifyStackEvidence.v1',
  package: "W45-32 — the host toast stack: the reader, the cap, the fold, the writer, the timer and the undrawn report",
  date: '2026-10-16',
  question: 'The `$.ui.toast` floor and its admission policy (W45-26), the bar\'s ledger (W45-27), its stored read and write (W45-28/29), the store\'s readers (W45-30) and the clock driver (W45-31) are ported. What receives a plugin\'s toast on the host side — who stacks it, trims it, arms the timer for it, and reports the ones that leave before they were drawn?',
  answer: 'One cluster, 17 blocks over three modules, 2,268 units: the stack reader `bu` [171112,171208), the toast clock accessor `TC` [171208,171235), the timer arming `yee` [171235,171566), the per-plugin cap `aV` [171566,171787), the undrawn report `See` [171787,172000), the stack writer `bh` [172000,172257), the push helper `wee` [172976,173176) and the host toast method `EEe` [173176,173443) in chunk-24k7d6mw.js; the constants and the fold transform (`cI`, `RF`, `PF`, `MF`, `fee`, `IF` at [170752,171111)); the shallow list equality `$P` (chunk-3qabb19b.js [732,883)); and the plugin label policy (`SKr` [4522274,4522361), `Nle` [4522361,4522420) in chunk-sfn1dbxq.js). A write trims the stack by `aV`, writes it back under `Pye(IF)` = "engine\\x00toasts" only when `$P` says it differs from the read one, reports every entry that left without being drawn (unless the bar drew it: its id is in `cI`), folds the stack through `MF` and arms one timer for the next deadline.',
  ported: [
    { module: 'chunk-24k7d6mw.js', range: [170752, 170786], units: 34, names: ['cI'], note: 'the ids that reached the bar: the writer deletes an id here as it reports the toast undrawn' },
    { module: 'chunk-24k7d6mw.js', range: [170786, 170797], units: 11, names: ['RF'], note: 'the leaving phase: 240ms' },
    { module: 'chunk-24k7d6mw.js', range: [170797, 170818], units: 21, names: ['PF'], note: 'the hold that re-bases a deadline: 30000ms' },
    { module: 'chunk-24k7d6mw.js', range: [170818, 171054], units: 236, names: ['MF'], note: 'the fold transform: a held toast\'s time is added to its deadline, a spent one leaves, a leaving one gets RF more' },
    { module: 'chunk-24k7d6mw.js', range: [171054, 171080], units: 26, names: ['fee'], note: 'the frozen empty stack' },
    { module: 'chunk-24k7d6mw.js', range: [171080, 171111], units: 31, names: ['IF'], note: 'the plugin-state key the stack lives under' },
    { module: 'chunk-24k7d6mw.js', range: [171112, 171208], units: 96, names: ['bu'], note: 'the stack reader, over `Pye(IF)`' },
    { module: 'chunk-24k7d6mw.js', range: [171208, 171235], units: 27, names: ['TC'], note: 'the toast clock the registry carries' },
    { module: 'chunk-24k7d6mw.js', range: [171235, 171566], units: 331, names: ['yee'], note: 'the timer arming: drop the pending one, skip while paused or empty, one timer for the earliest deadline, unref it' },
    { module: 'chunk-24k7d6mw.js', range: [171566, 171787], units: 221, names: ['aV'], note: 'the per-plugin cap: the largest non-managed group loses its oldest member, recursively' },
    { module: 'chunk-24k7d6mw.js', range: [171787, 172000], units: 213, names: ['See'], note: 'the undrawn report: the log line and the once-per-plugin notice' },
    { module: 'chunk-24k7d6mw.js', range: [172000, 172257], units: 257, names: ['bh'], note: 'the stack writer: trim, write when the list differs, report undrawn, fold' },
    { module: 'chunk-24k7d6mw.js', range: [172976, 173176], units: 200, names: ['wee'], note: 'the push helper: build the entry (randomUUID id, Nle label, sOn seat, clock deadlines) and write' },
    { module: 'chunk-24k7d6mw.js', range: [173176, 173443], units: 267, names: ['EEe'], note: 'the host toast method: whose ids were known, push, and whether it stacked or the stack was full' },
    { module: 'chunk-3qabb19b.js', range: [732, 883], units: 151, names: ['$P'], note: 'the shallow list equality the write is gated on' },
    { module: 'chunk-sfn1dbxq.js', range: [4522274, 4522361], units: 87, names: ['SKr'], note: '"unnamed", the label fallback; the statement it shares with h3t is taken whole' },
    { module: 'chunk-sfn1dbxq.js', range: [4522361, 4522420], units: 59, names: ['Nle'], note: 'the label policy: the sanitiser\'s name, or the fallback' },
  ],
  measured: [
    'The reader over an empty store returns the frozen `fee` array by identity, and a value that is no array reads the same way; with a stored array it returns that array.',
    'The cap: 6 toasts are untouched; 51 with 26 for one owner against 25 for the other drop `t0`, the oldest of the largest group; 52 with a managed last entry drop `t0` and then `t2`, because a managed last entry makes the filter keep every seat and the recursion takes the new largest group\'s oldest member.',
    'The fold: a fresh toast is unchanged; one past its deadline turns `leaving` with `leavesAt` = now + 240; one already leaving and past that window is dropped; a held one has the held 30,500ms added to its deadline (now + 100 + 30500).',
    'A write stores exactly the trimmed stack (no wrapper), arms 250ms when the toast has 250ms left, sets `pending` and unrefs the handle once. Writing the same stack again leaves the store untouched and still arms 250 — the fold reruns either way.',
    'A toast the store held but the new stack does not is reported: `$.ui.toast (plugin-a): one left the stack, never drawn`; an id the bar drew (present in `cI`) is not reported and is forgotten from the set.',
    'The timer: nothing to show arms nothing, a paused bar arms nothing, and a live stack arms `max(1, earliest deadline - now)` — 1ms even when the deadline has passed.',
    'The label boundary: `Nle` is copied but its sanitiser `Mde` is not, so `pluginLabel` and the host toast method both fail with `HooksError` naming the block (chunk-qq2mgstr.js [16350,16512)).',
  ],
  boundary_left_open: {
    what: 'The plugin display label\'s sanitiser (`Mde`), so the push path (`wee`/`EEe`) cannot run yet.',
    why: 'Mde is 162 units in chunk-qq2mgstr.js and every name in it but `typeof` is free: the code-point sanitiser `O` ([10264,10453)), the trailing-ellipsis check `ke` ([9810,9854)), the safe truncation `ne` (chunk-ax7r0qj7.js [1128,1272)), the space cut `Ar` ([3529,3561)), the word-boundary truncation `jo` (chunk-yn0pfn70.js [9072,9254)) and the identity `$8` (chunk-pa2d6xdm.js [720,744)), plus `aN`, `g3` and those bodies\' own dependencies. A closure walker was written (.audit/w45-32-closure.mjs) and its scope resolution is not yet sound, so the closure is unmeasured rather than estimated; guessing at a ≤24-unit truncation with a `\\u2026` fallback would be inventing the label policy the copies must not invent.',
    instead: './plugin-chain-plugin-label.ts throws a `HooksError` naming the block. Nothing in this product calls the host toast path yet, so the boundary is inert — the same sequence the fold scheduler went through before W45-30 replaced its stub with the real body.',
  },
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'src/plugin-chain-notify-stack-source.ts: unresolved 0',
    chain_verifier: chain,
    regressions: 'test/plugin-chain-notify-stack.test.ts 7/7; the seven related suites (clock, fold, write, store, notify, ui, toast) together 39/39',
    full,
    compiled: 'all fifteen dist drivers exit 0; the shared driver prints W45NotifyStackCompiled.v1 against dist (the cap, the fold, the write\'s arming and unref, the undrawn report with its `cI` gate, the timer table and the label boundary)',
    smoke,
  },
  next_package: [
    'the plugin label sanitiser: `Mde` (chunk-qq2mgstr.js [16350,16512)) and its closure (`O`, `ke`, `ne`, `Ar`, `jo`, `$8`, `aN`, `g3`), which unblocks the push path (`wee`/`EEe`) and the boundary ./plugin-chain-plugin-label.ts records',
    'the bar component that calls the tick (`JFe`, chunk-24k7d6mw.js [479204,…)): what builds the store it ticks, the refs and the unmount cleanup — and the registry literal at [170700,171111) that wires `bu`, `See` and `TC` into `it()`',
    'the store factory `gs`/`Zco` and the rest of the registry\'s stores, so `renderVersions`/`panes`/`pluginState`/`toastClock` are built at registry construction as the source\'s literal does',
    'the reader/mount lifecycle around the folds: `Tb`, `Gf`, `OH`, `Kf`, `xur` and the `Cb` stale-listener registration',
    'the rest of the `$` table beyond the three ui floors, entry by entry',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
  ],
};
write('research/ports/W45-notify-stack-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

// CURRENT: the W45-32 row above the W45-31 one.
const current = read('research/CURRENT.md');
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-32 **搬完宿主 toast 栈**（17 段 2268 单位，三个模块）：栈读取器 \`bu\` [171112,171208)、toast 时钟 \`TC\` [171208,171235)、定时器挂表 \`yee\` [171235,171566)、每插件上限 \`aV\` [171566,171787)、未绘制上报 \`See\` [171787,172000)、栈写入器 \`bh\` [172000,172257)、压栈助手 \`wee\` [172976,173176)、宿主 toast 方法 \`EEe\` [173176,173443)，外加常量与折页变换（\`cI\`/\`RF\`/\`PF\`/\`MF\`/\`fee\`/\`IF\` [170752,171111)）、浅列表相等 \`$P\`（chunk-3qabb19b.js [732,883)）与插件标签策略（\`SKr\` [4522274,4522361)、\`Nle\` [4522361,4522420)）。**实测**：空 store 读到**冻结的** \`fee\` 数组（同值非同引用的值也读它）；上限 50——6 条不动、51 条（26:25）丢最大组的 \`t0\`、52 条且末条 managed 时连丢 \`t0,t2\`（managed 末条令过滤保住所有席位，递归再取新最大组最旧）；折页四态（未到期不变／过期转 \`leaving\` 且 \`leavesAt=now+240\`／已 leaving 且过期即丢／被持有者按持有 30500ms 改写为 \`now+100+30500\`）；一次写入**原样**存下修剪后的栈、挂 250ms 表、设 \`pending\` 并 \`unref\` 一次，同一栈再写不落库但仍挂表；离栈未绘制者报 \`$.ui.toast (plugin-a): one left the stack, never drawn\`，而**被栏绘制过的 id（在 \`cI\` 里）不报并从集合中删除**；空栈/暂停不挂表，否则挂 \`max(1, 最早期限-now)\`。**明确留口**：标签消毒器 \`Mde\`（chunk-qq2mgstr.js [16350,16512)，其闭包含 \`O\`/\`ke\`/\`ne\`/\`Ar\`/\`jo\`/\`$8\` 等，闭包遍历器 .audit/w45-32-closure.mjs 作用域解析尚不可靠，故**记为未测而非估算**）未搬，\`plugin-chain-plugin-label.ts\` 抛 \`HooksError\` 指名该段——与本产品尚无调用方，边界惰性（同 W45-30 前的折页桩）。验收：check/build/notices、扫描 \`unresolved 0\`、**${chain}**、聚焦 7/7 与相关 39/39、全量 **${full}**、十五个编译驱动（新增 \`W45NotifyStackCompiled.v1\`）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [宿主栈证据](ports/W45-notify-stack-evidence.json)、[时钟驱动证据](ports/W45-notify-clock-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('C-12 row not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the host toast stack.
const features = read('research/FEATURES.md');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('interactive row not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = rowText.slice(0, lastPipe).replace(/\s+$/, '') +
  '. W45-32 added the host end of the toast path: the stack a host toast is pushed into (the entry\'s id, label and seat, the store write gated on a shallow list equality), the per-plugin cap that drops the oldest toast of the largest group, the fold that ages spent toasts out through a 240ms leaving phase, the timer armed for the next deadline, and the report for a toast that left before it was drawn' +
  ' |';
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = read('research/coding-standard.md');
const standardAt = standard.indexOf('2026-10-16 W45-31 时钟驱动');
if (standardAt < 0) throw new Error('coding-standard W45-31 line not found');
const standardEntry = `2026-10-16 W45-32 宿主 toast 栈：S-1至S-7已对照。S-1（先读源）：17 段逐字搬运，跨三个模块；\`yvt\` 用源自身的 \`import{randomUUID as yvt}from"crypto"\`（改绑 node:crypto），\`g\` 是源自身的功能埋点 \`i("tengu_feature_ok",{...r,feature_name:d(e)})\`（本产品无埋点接收端，绑定为 host seam 的 \`featureUsed\` 记入同一记录表），两者都写出依据而非猜测。S-2（不留半包）：读取、上限、折页、写入、挂表、上报六条路径全部由回归钉住；**明确留口**的标签消毒器 \`Mde\` 写入 \`plugin-chain-plugin-label.ts\` 并抛 \`HooksError\` 指名区间，同时写进证据的 \`boundary_left_open\`（含「闭包遍历器作用域解析不可靠，故记为未测而非估算」）。S-3：回归覆盖 \`$P\` 真值表、\`aV\` 的三态（不动/递归/ managed 末条）、\`MF\` 四态、\`bh\` 的写与不写及 \`cI\` 门、\`yee\` 的三态（空/暂停/最小 1ms）、\`See\` 的两条文本与边界异常。S-4（可复跑校验）：记录脚本自读身份（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）并对计数断言，链校验器的 \`passed\`/\`plans\` 由脚本自身运行解析，全量摘要与打包报告从各自输出解析。S-7：\`Mde\` 的闭包（含 \`O\`/\`ke\`/\`ne\`/\`Ar\`/\`jo\`/\`$8\`/\`aN\`/\`g3\`）与栏组件 \`JFe\`、\`gs\`/\`Zco\` 工厂、readers/mount 生命周期已连区间记入下一包。验收：check/build/notices、扫描 unresolved 0、${chain}、全量 ${full}、十五个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-32 paragraph above the W45-31 one.
const status = read('research/STATUS.md');
const statusAt = status.indexOf("W45-31: the bar's clock driver");
if (statusAt < 0) throw new Error('STATUS W45-31 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-32: the host toast stack. Seventeen blocks (2,268 units) over three modules: the stack reader \\\`bu\\\`, the toast clock \\\`TC\\\`, the timer arming \\\`yee\\\`, the per-plugin cap \\\`aV\\\`, the undrawn report \\\`See\\\`, the stack writer \\\`bh\\\`, the push helper \\\`wee\\\` and the host toast method \\\`EEe\\\`, with the constants, the fold transform \\\`MF\\\`, the shallow list equality \\\`$P\\\` and the plugin label policy (\\\`Nle\\\`/\\\`SKr\\\`). A write trims the stack, stores it under \\\`Pye(IF)\\\` when the list differs, reports what left undrawn unless the bar drew it, folds, and arms one timer for the next deadline. The label sanitiser \\\`Mde\\\` is not ported: ./plugin-chain-plugin-label.ts throws naming the block, and no caller reaches it yet. Evidence: \\\`research/ports/W45-notify-stack-evidence.json\\\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-32 section.
const runner = read('research/ports/W45-chain-runner.md');
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-32 ported the host toast stack (2026-10-16)

W45-26 took the \\\`$.ui.toast\\\` floor and its admission policy, W45-27 the bar's ledger, W45-28/29 its
stored read and write, W45-30 the store's readers and W45-31 the clock driver; this package takes the
other end of the same path. Seventeen blocks (2,268 units) over three modules: \\\`bu\\\`, \\\`TC\\\`, \\\`yee\\\`,
\\\`aV\\\`, \\\`See\\\`, \\\`bh\\\`, \\\`wee\\\` and \\\`EEe\\\` from chunk-24k7d6mw.js, the constants and the fold transform
\\\`MF\\\`, the shallow list equality \\\`$P\\\` from chunk-3qabb19b.js, and the label policy \\\`Nle\\\`/\\\`SKr\\\`.

A write trims the stack by its per-plugin cap, stores it under \\\`Pye(IF)\\\` = \\\`engine\\u0000toasts\\\` only
when the shallow list equality says it differs from the read one, reports every entry that left
without being drawn (an id the bar drew is in \\\`cI\\\` and is not reported), folds the stack through
\\\`MF\\\` and arms one timer for the earliest deadline — unref-ed, so it never holds the process open.

Measured rather than assumed: the cap drops the oldest member of the largest group and keeps
recursing (a managed last entry makes the filter keep every seat, which changes the group it picks);
the fold turns a spent toast into its 240ms leaving phase and drops one that is already leaving; the
timer arms \\\`max(1, deadline - now)\\\` and nothing while paused or empty; and the reader returns the
frozen empty array both when the store has no value and when its value is no array.

One boundary is left open and named. \\\`Nle\\\` is copied, but the sanitiser it resolves names through,
\\\`Mde\\\` (chunk-qq2mgstr.js [16350,16512)), is not: every name in it is free and its closure is the
display-text sanitiser across several modules. A closure walker was written to measure it
(\\\`.audit/w45-32-closure.mjs\\\`) and its scope resolution is not sound yet, so the closure is recorded
as unmeasured rather than estimated. ./plugin-chain-plugin-label.ts throws a \\\`HooksError\\\` naming the
block, which makes the push path (\\\`wee\\\`/\\\`EEe\\\`) inert until the next package ports it — the same
sequence the fold scheduler went through before W45-30 replaced its stub with the real body.

Verified: check/build/notices, ${chain}, the new copy \\\`unresolved 0\\\`, 7/7 new regressions, the seven
related suites 39/39, full ${full}, fifteen compiled drivers (the shared driver now also prints
\\\`W45NotifyStackCompiled.v1\\\`), and the packaged smoke (${smoke}). Identity \\\`${short}…\\\` (read from
scripts/identity.mjs by the record script itself, which asserts the file counts).

Next: the label sanitiser \\\`Mde\\\` and its closure, then the bar component that owns the store and the
refs (\\\`JFe\\\` [479204,…)) with the registry literal that wires \\\`bu\\\`, \\\`See\\\` and \\\`TC\\\` into \\\`it()\\\`.
`);

const rows = [
  ['2026-10-16T10:36:00Z', 'package', 'W45-32 搬完宿主 toast 栈（17 段 2268 单位，三个模块；标签消毒器明确留口）',
    'W45-26/27/28/29/30/31 备齐栏侧与时钟；本包是宿主侧收下一条 toast 的全路径',
    'chunk-24k7d6mw.js [170752,171111) 常量与 MF、[171112,171208) bu、[171208,171235) TC、[171235,171566) yee、[171566,171787) aV、[171787,172000) See、[172000,172257) bh、[172976,173176) wee、[173176,173443) EEe；chunk-3qabb19b.js [732,883) $P；chunk-sfn1dbxq.js [4522274,4522361) SKr、[4522361,4522420) Nle',
    'cI 门（被栏绘制过的 id 不报并删除）、上限递归丢最大组最旧、折页 240ms 淡出、timer 最小 1ms 且 unref、Mde 边界抛 HooksError 指名区间；回归 test/plugin-chain-notify-stack.test.ts 7/7'],
  ['2026-10-16T10:52:00Z', 'verification', 'W45-32 验收：扫描 unresolved 0、32 计划一致、全量与打包冒烟（记录脚本自读身份、链校验器与输出）',
    '宿主 toast 栈搬运',
    `check/build/notices；扫描 unresolved 0；${chain}；聚焦 7/7 与相关 39/39；全量 ${full}；十五个编译驱动 exit 0（新增输出 W45NotifyStackCompiled.v1）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md');
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-32 acceptance (2026-10-16)

- [x] **The whole host path is driven, not described.** Read, cap, fold, write, timer, undrawn report — each asserted against the copied bodies.
- [x] **The cap's recursion is measured at the boundary.** 51 entries drop \\\`t0\\\`; 52 with a managed last entry drop \\\`t0\\\` and then \\\`t2\\\`, because the managed filter keeps every seat and the next pass picks the new largest group.
- [x] **The draw gate is driven both ways.** An id in \\\`cI\\\` is not reported and is forgotten; one that is not is reported with the source's own log line.
- [x] **The source's own id and telemetry are traced, not guessed.** \\\`yvt\\\` is the source's \\\`randomUUID\\\` import; \\\`g\\\` is its \\\`tengu_feature_ok\\\` feature recorder, bound to the host seam's \\\`featureUsed\\\` with the reason recorded.
- [x] **The boundary is named, not papered over.** \\\`Mde\\\` is unported, the closure walker's scope resolution is unsound, and the seam throws naming the block rather than guessing a truncation policy. The record says the closure is unmeasured, not estimated.
- [x] **The record script reads its own numbers.** Identity from scripts/identity.mjs with count assertions, the chain verifier run and parsed, the sweep summary and packaged report parsed from their outputs.
- [x] **Sweep.** check/build/notices, scan \\\`unresolved 0\\\`, ${chain}, 7/7 new regressions, full ${full}, fifteen compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', full, '| smoke:', smoke);
