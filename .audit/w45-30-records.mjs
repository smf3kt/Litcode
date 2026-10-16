// W45-30 records: the fold scheduler and the cluster it drives, the indexes, the audit trail, and the
// closing of the item W45-29 queued. Identity, the full sweep's summary and the packaged smoke's report
// are read from their own outputs, so the record cannot carry a number the tree did not produce.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 323, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 128, `validation ${identity.validation.files}`);
expect(identity.build.files === 226, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const sweep = read('/tmp/w45-30-sweep.txt');
const sweepOf = (label) => Number(new RegExp(`^\\u2139 ${label} (\\d+)$`, 'm').exec(sweep)?.[1]);
const tests = sweepOf('tests');
const passed = sweepOf('pass');
const failed = sweepOf('fail');
if (!Number.isInteger(tests) || !Number.isInteger(failed)) throw new Error('the sweep report has no summary');
const sweepFailNames = [...sweep.matchAll(/^✖ (.+?) \(\d/gm)].map((m) => m[1]);
const full = `${tests} tests / ${passed} pass / ${failed} fail` +
  (failed === 0 ? ' on the frozen tree' : `: ${sweepFailNames.join('; ')}`);

const smokeReport = read('/tmp/w45-30-smoke.txt').split('\n')
  .filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; ` +
  `upstreamRequests ${smokeReport.upstreamRequests}`;

const evidence = {
  schema: 'W45NotifyFoldEvidence.v1',
  package: "W45-30 — the plugin-state store's reactivity: the fold scheduler Ci and the cluster it drives",
  date: '2026-10-16',
  question: "W45-29's write half ended at `vb`, which handed a changed key's readers to `Ci` — and `Ci` was not ported, so the boundary threw. What is `Ci`, what does it read and write, and what does it need to run for real?",
  answer: '`Ci` [274539,274916) is the door a plugin-state write opens on its readers. For each reader key it looks the reader up in the store\'s `readers`, and puts it in one of two folds: "live" when the reader\'s instance is a terminal PromptHint, a terminal AbovePrompt whose flag store is not `true`, or the pane the store shows — else "steady", and forced to "steady" when any of the reader\'s plugins is inside its 1000ms throttle window. Each touched fold then either runs at once or arms its own interval\'s remainder (100ms steady, 34ms live). A fold run resolves its stale keys back to readers, bumps those readers\' render versions through `vi` (one running counter per store, written under `jf(key)` = `key\\x00state` into `it().renderVersions`) and hands every reader\'s instance to the store\'s stale listeners. Twenty blocks (1,781 units) over five modules carry the whole cluster; the three bodies it needs from outside its own module are ported too (`Ge` and `bs`, the batch\'s identity marker and the one-value flag store, and `FDn`, the frozen initial panes state), so nothing in the copied text was rewritten against a guess.',
  ported: [
    { module: 'chunk-ae84tp6z.js', range: [5355, 5381], units: 26, names: ['Ge'], note: 'the batch\'s marker around a store — the identity function in the shipped bundle, so `Zl` is a plain `Map` and `Y4t` is `bs()`' },
    { module: 'chunk-c9vsmdqj.js', range: [615, 668], units: 53, names: ['bs'], note: 'the one-value flag store (`set`/`get` over a closure slot)' },
    { module: 'chunk-3ph567jx.js', range: [757, 941], units: 184, names: ['FDn'], note: 'the frozen initial panes state, the value `Ri`\'s disposer restores' },
    { module: 'chunk-tvdq3hrk.js', range: [2862, 2915], units: 53, names: ['Ri'], note: 'the panes facade `Ri()` → `it().panes`, which `Of` checks a reader\'s `requestId` against' },
    { module: 'chunk-n3ykh62m.js', range: [230179, 230215], units: 36, names: ['Y4t'], note: 'the flag store behind `Ql`' },
    { module: 'chunk-n3ykh62m.js', range: [230215, 230241], units: 26, names: ['Ql'], note: 'the AbovePrompt flag test, `!== true`' },
    { module: 'chunk-n3ykh62m.js', range: [230769, 230803], units: 34, names: ['Zl'], note: 'the throttle table' },
    { module: 'chunk-n3ykh62m.js', range: [230803, 230873], units: 70, names: ['P_', 'ec'], note: 'the 1000ms window and the stamp that applies it' },
    { module: 'chunk-n3ykh62m.js', range: [230873, 230929], units: 56, names: ['A_'], note: 'the throttle test, `n < stamp`' },
    { module: 'chunk-n3ykh62m.js', range: [230929, 230939], units: 10, names: ['nc'], note: 'the live interval, 34ms' },
    { module: 'chunk-n3ykh62m.js', range: [231041, 231248], units: 207, names: ['Of'], note: 'the pace classifier over a reader\'s instance' },
    { module: 'chunk-n3ykh62m.js', range: [271940, 271971], units: 31, names: ['OL'], note: 'the render-version facade `OL()` → `it().renderVersions`' },
    { module: 'chunk-n3ykh62m.js', range: [272717, 272729], units: 12, names: ['HAt'], note: 'the steady interval, 100ms' },
    { module: 'chunk-n3ykh62m.js', range: [272928, 272964], units: 36, names: ['Rc', 'jf'], note: 'the render-version key suffix and the key builder' },
    { module: 'chunk-n3ykh62m.js', range: [273791, 273934], units: 143, names: ['vi'], note: 'the bump: one running counter per store' },
    { module: 'chunk-n3ykh62m.js', range: [274111, 274247], units: 136, names: ['vc'], note: 'the fan-out: bump the keys, hand the instances to the stale listeners' },
    { module: 'chunk-n3ykh62m.js', range: [274247, 274483], units: 236, names: ['MAt'], note: 'run one fold: drop the timer, stamp `lastAt`, resolve the stale set, clear it, fan out' },
    { module: 'chunk-n3ykh62m.js', range: [274483, 274511], units: 28, names: ['zf'], note: 'the timer callback' },
    { module: 'chunk-n3ykh62m.js', range: [274511, 274538], units: 27, names: ['Wf'], note: 'the two intervals, `{steady: 100, live: 34}`' },
    { module: 'chunk-n3ykh62m.js', range: [274539, 274916], units: 377, names: ['Ci'], note: 'the scheduler itself' },
  ],
  boundary_closed: "W45-29 recorded `Ci` as unported and made the boundary behaviour: a key with a reader threw `the plugin-state fold scheduler is not ported`. This package replaces the stub in src/plugin-chain-notify-store-runtime.ts with the ported body, so `vb` now schedules a real fold; the W45-29 regression and the compiled driver's W45-29 block were rewritten to assert the scheduling instead of the throw.",
  host_change: 'The registry gains `renderVersions` (`gs(new Map)` in the source\'s own literal) and `panes` (`gs(FDn)`), both `null` until a surface binds a store, as with `pluginState` — this product has no `gs` store factory. `PluginStateStore` gains the fields the scheduler touches: `readers`, `folds` (`steady`/`live`, each `{stale, pending, lastAt}`), `staleListeners` and `bumps`. The seam binds both registry stores (`bindRenderVersions`/`bindPanes`) and exposes the source\'s own flag store `Y4t` as `abovePromptFlag`.',
  measured: [
    'The paces and the window: `FOLD_INTERVAL_MS` = `{steady: 100, live: 34}`, throttle 1000ms, suffix `"\\x00state"`, `renderVersionKey("k")` = `"k\\x00state"`; a stamped reader is throttled while `now < stamp` (true at the stamp, true 1ms before it, false at it).',
    'The classifier: terminal+PromptHint live; terminal+Pane live only when the visible panes store shows that `requestId`, else steady; terminal+AbovePrompt live while `Y4t.get() !== true` (default true, `set(true)` flips it, `set(void 0)` restores); remote surface or another component steady.',
    'Run-now: a reader whose fold is past its interval is marked stale and the fold runs in the same call — `lastAt` = the given time, stale set cleared, one render version written (`reader-1\\x00state` = 1), `bumps` 1, and the stale listener got exactly the reader\'s instance.',
    'Armed: with 24ms of the live interval left, the reader waits in that fold\'s stale set with `pending` set, no version written and `lastAt` unchanged; the timer callback runs the fold (stale cleared, `pending` dropped, `lastAt` = the timer\'s time, version written, listener called).',
    'Throttle: a live-pace reader whose plugin is inside the window folds **steady**, and the live fold is untouched.',
    'The bump is one running counter per store: two calls over three keys give `x`/`y` = 1 and `z` = 2, and the counter is the store\'s `bumps`.',
    'No reader for the key: nothing at all — no fold touched, no version written.',
    '`INITIAL_PANES_STATE` is the frozen eight-field object (`open`/`unplaced`/`asked`/`shownId`/`focusedId`/`focusRequest`/`placements`/`closing`).',
  ],
  caught_by_the_tooling: [
    'The first probe read the fixture\'s `readers` map by *state key* instead of by reader id, so `Ci` found no reader and nothing folded — a fixture error the empty output made visible rather than a silent pass.',
    'The seam first exported a fresh `bs()` as the AbovePrompt flag; `Ql` reads the source\'s own `Y4t`, so `set(true)` changed nothing. Reading `Ql`\'s own line (`Y4t.get() !== true`) fixed the export to the source\'s store.',
    'The fold test ran a fold with no render-version store bound and threw in `vi` — the source would do the same, and binding a store in the fixture is what the test needed.',
    'The compiled driver\'s armed assertion expected version 1 where the store\'s running counter gives 2, which is the counter\'s own semantics; the expectation and its comment were corrected.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'src/plugin-chain-notify-fold-source.ts: unresolved 0',
    chain_verifier: 'passed true, 30 plans',
    regressions: 'test/plugin-chain-notify-fold.test.ts 7/7; the six related suites (notify, notify-write, notify-store, ui, toast, plugin-chain) together 37/37',
    full,
    compiled: 'all fifteen dist drivers exit 0; the shared driver prints W45NotifyFoldCompiled.v1 against dist',
    smoke,
  },
  next_package: [
    'the `TK` clock driver at chunk-24k7d6mw.js [478823,…), which owns the clock the ledger tick is driven by',
    "the host toast method's stacked path: `EEe` (chunk-24k7d6mw.js [173176,…)) with `bu()`/`wee` and the `toast stacked` notice",
    'the store factory `gs`/`Zco` and the rest of the registry\'s stores, so `renderVersions`/`panes`/`pluginState` are built at registry construction as the source\'s literal does',
    'the reader/mount lifecycle around the folds: `Tb`, `Gf`, `OH`, `Kf`, `xur` and the `Cb` stale-listener registration, which is what puts readers into `readers`/`readersOf` to begin with',
    'the rest of the `$` table beyond the three ui floors, entry by entry',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
  ],
};
write('research/ports/W45-notify-fold-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

// W45-29's queued item is this package: rewrite that entry so the record does not point at closed work.
const writeEvidencePath = 'research/ports/W45-notify-write-evidence.json';
const writeEvidence = JSON.parse(read(writeEvidencePath));
const queued = writeEvidence.next_package[0];
if (!queued.startsWith('the fold/reader subsystem')) throw new Error('W45-29 next_package[0] is not the fold scheduler item');
writeEvidence.next_package[0] = 'CLOSED as W45-30 (2026-10-16): the fold scheduler `Ci` and the cluster it drives are ported (20 blocks, 1,781 units) and the stub this package left in src/plugin-chain-notify-store-runtime.ts is replaced by the real body, so `vb` schedules a fold; see research/ports/W45-notify-fold-evidence.json';
write(writeEvidencePath, JSON.stringify(writeEvidence, null, 1) + '\n');

// CURRENT: the W45-30 row above the W45-29 one.
const current = read('research/CURRENT.md');
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-30 **搬完插件态存储的响应式**：折页调度器 \`Ci\` 与其驱动簇（20 段 1,781 单位，五个模块）。\`Ci\` [274539,274916)：每个读者键查到 \`readers\` 里的读者后，投进 \`folds.steady\`/\`folds.live\` 之一——**live** 条件是其实例为 terminal+PromptHint、terminal+AbovePrompt 且标志库非 \`true\`、或 panes 正在显示的 \`requestId\`；其插件落在 1000ms 节流窗内则**强制 steady**；随后每个被动到的折页要么立刻跑、要么按各自区间余量（steady 100ms / live 34ms）挂表。折页跑= 把 stale 键解析回读者 → \`vi\` 把读者版本号写进 \`it().renderVersions\`（键 \`jf(key)\`=\`key\\x00state\`，计数器是 store 自己的 \`bumps\`，每 store 一条递增）→ 把每个读者的 instance 交给 \`staleListeners\`。簇内一并逐字搬运：\`Ge\`（bundle 里的恒等标记，故 \`Zl\` 就是普通 Map）、\`bs\`（单值标志库）、\`FDn\`（冻结的初始 panes 态）、\`Ri\`（\`() → it().panes\`）、\`Y4t\`/\`Ql\`、\`Zl\`/\`P_\`/\`ec\`/\`A_\`、\`nc\`/\`HAt\`/\`Wf\`、\`Of\`、\`OL\`、\`Rc\`/\`jf\`、\`vi\`/\`vc\`/\`MAt\`/\`zf\`。**边界收束**：W45-29 记下的「\`Ci\` 未搬、按读者数抛出」桩已由真体替换（\`plugin-chain-notify-store-runtime.ts\` 改为 re-export），W45-29 回归与编译驱动同步改为断言真实调度。宿主：登记表新增 \`renderVersions\`/\`panes\`（源字面量 \`gs(new Map)\`/\`gs(FDn)\`，本产品无 store 工厂故为 \`null\` + seam 绑定），\`PluginStateStore\` 补 \`readers\`/\`folds\`/\`staleListeners\`/\`bumps\`。**实测**：区间/窗口/键形；分类表（含 Pane 只在 shownId 命中时 live、\`set(true)\` 把 AbovePrompt 摘出 live）；到点即跑与挂表两条路径（挂表时 stale 保留、无版本写入、\`lastAt\` 不动）；节流把 live 读者压回 steady 且 live 折页不动；bump 计数器；无读者时全静默；\`INITIAL_PANES_STATE\` 八字段。工具链抓到四处：探针把 \`readers\` 按状态键而非读者 id 取（无输出暴露）、seam 起初导出第二个 \`bs()\` 而非源自己的 \`Y4t\`、折页测试未绑定 renderVersions 而在 \`vi\` 抛出、驱动把 armed 版本次写成 1 而运行计数器给 2。验收：check/build/notices、扫描 \`unresolved 0\`、**30 计划**一致、聚焦 7/7 与相关 37/37、全量 **${full}**、十五个编译驱动（\`W45NotifyFoldCompiled.v1\`）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [折页证据](ports/W45-notify-fold-evidence.json)、[写半边证据](ports/W45-notify-write-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('C-12 row not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the store's reactivity.
const features = read('research/FEATURES.md');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('interactive row not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = rowText.slice(0, lastPipe).replace(/\s+$/, '') +
  '. W45-30 added the plugin-state store\'s reactivity: the fold scheduler that marks a changed key\'s readers stale in their pace\'s queue (live 34ms / steady 100ms, throttled to steady for a second after a reader\'s plugin was bumped), runs or arms each touched fold, writes the readers\' render versions and hands their instances to the store\'s stale listeners' +
  ' |';
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = read('research/coding-standard.md');
const standardAt = standard.indexOf('2026-10-16 W45-29 通知栏写半边');
if (standardAt < 0) throw new Error('coding-standard W45-29 line not found');
const standardEntry = `2026-10-16 W45-30 折页调度器：S-1至S-7已对照。S-1（先读源）：20 段全部逐字搬运，五个模块；簇内依赖一并搬运而非猜测（\`Ge\` 读到自己就是恒等函数后才敢用，\`bs\`/\`FDn\`/\`Ri\` 各有源行）。**关键读源结论**：\`Ci\` 的入参是**读者 id**（\`s_().readers\` 的键），不是状态键——探针按状态键取读者时全静默，正是这一条被读出来才纠正。S-2（不留半包）：上一包把未搬部分做成「按读者数抛出」的显式边界，本包按该边界收束并把两处断言（回归 + 编译驱动）改成真实调度，未留悬空的桩。S-3：回归覆盖区间/窗口/键形、分类表、到点即跑与挂表、节流改道、bump 计数器、无读者静默、两个登记表存储的绑定与还原。S-4（可复跑校验）：记录脚本自读身份（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）与全量/打包报告，并把上一包 \`next_package\` 的该项改写为已收束。S-7：\`TK\` 时钟驱动、宿主 toast stacked 路径、\`gs\`/\`Zco\` store 工厂与 readers/mount 生命周期（\`Tb\`/\`Gf\`/\`OH\`/\`Kf\`/\`xur\`）无源码可搬入本包范围，已连区间记入下一包。验收：check/build/notices、扫描 unresolved 0、30 计划一致、全量 ${full}、十五个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-30 paragraph above the W45-29 one.
const status = read('research/STATUS.md');
const statusAt = status.indexOf("W45-29: the notification bar's write half");
if (statusAt < 0) throw new Error('STATUS W45-29 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-30: the plugin-state store's reactivity. The fold scheduler \\\`Ci\\\` and the cluster it drives are ported (20 blocks, 1,781 units over five modules): the two paces and their intervals (live 34ms, steady 100ms), the 1000ms throttle that forces a reader back to steady, the classifier that reads a reader's pace from its instance, the one-shot fold run, the stale/reader fan-out and the render-version bump. \\\`Ci\\\` is what \\\`vb\\\` calls, so W45-29's explicit "not ported" boundary is closed: the stub in \\\`plugin-chain-notify-store-runtime.ts\\\` is replaced by the real body and both places that asserted the throw now assert the scheduling. The registry gains \\\`renderVersions\\\` and \\\`panes\\\` (the source's own \\\`gs(...)\\\` literal, bound by the seam here since this product has no store factory) and the plugin-state store gains the fields the scheduler touches. Evidence: \\\`research/ports/W45-notify-fold-evidence.json\\\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-30 section.
const runner = read('research/ports/W45-chain-runner.md');
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-30 ported the fold scheduler and closed W45-29's boundary (2026-10-16)

W45-29 ended at \\\`vb\\\`, which handed a changed key's readers to \\\`Ci\\\` and marked that hand-off as unported
behaviour: a key with a reader threw \\\`the plugin-state fold scheduler is not ported\\\`. This package ports
\\\`Ci\\\` and the cluster it drives, twenty blocks (1,781 units) over five modules, and replaces that stub
with the real body, so a plugin-state write now schedules a fold.

The scheduler's contract, as the copied bodies have it: for each reader it is given, look it up in the
store's \\\`readers\\\` and mark it stale in one of two pace queues — live when the reader's instance is a
terminal PromptHint, a terminal AbovePrompt while the flag store does not hold \\\`true\\\`, or the pane the
panes store shows; steady otherwise, and forced to steady while any of the reader's plugins is inside its
1000ms throttle window. Each touched queue then either runs at once or arms its interval's remainder
(100ms steady, 34ms live). A run resolves the stale keys back to readers, bumps their render versions
(one running counter per store, written under \\\`key\\\\x00state\\\` into the registry's \\\`renderVersions\\\`) and
hands every reader's instance to the store's stale listeners.

Three of the bodies the cluster needs live outside its own module and are ported too, rather than
guessed: \\\`Ge\\\` is the batch's marker around a store and is the identity function in the shipped bundle
(so the throttle table is a plain \\\`Map\\\` and the flag store is a bare \\\`bs()\\\`), \\\`bs\\\` is that one-value
flag store, and \\\`FDn\\\` is the frozen initial panes state. One read of the source changed the seam: the
scheduler's argument is a list of **reader ids**, not state keys — the first probe passed state keys and
folded nothing, which is how the mistake surfaced.

Verified: check/build/notices, 30 byte-identical plans, the new copy \\\`unresolved 0\\\`, 7/7 new
regressions, the six related suites 37/37, full ${full}, fifteen compiled drivers (the shared driver now
also prints \\\`W45NotifyFoldCompiled.v1\\\`), and the packaged smoke (${smoke}). Identity \\\`${short}…\\\` (read
from scripts/identity.mjs by the record script itself, which asserts the file counts).

Next: the \\\`TK\\\` clock driver [478823,…), the host toast method's stacked path \\\`EEe\\\` [173176,…), and the
reader/mount lifecycle (\\\`Tb\\\`/\\\`Gf\\\`/\\\`OH\\\`/\\\`Kf\\\`/\\\`xur\\\` with \\\`Cb\\\`) that puts readers into the store to
begin with.
`);

const rows = [
  ['2026-10-16T09:34:00Z', 'package', 'W45-30 搬完插件态存储的响应式（折页调度器 Ci + 驱动簇，20 段 1,781 单位，五个模块）',
    'W45-29 把 Ci 记为未搬边界；本包搬完 Ci 与其驱动簇并把边界收束（stub → 真体）',
    'chunk-ae84tp6z.js [5355,5381) Ge、chunk-c9vsmdqj.js [615,668) bs、chunk-3ph567jx.js [757,941) FDn、chunk-tvdq3hrk.js [2862,2915) Ri、chunk-n3ykh62m.js [230179,230215) Y4t / [230215,230241) Ql / [230769,230803) Zl / [230803,230873) P_+ec / [230873,230929) A_ / [230929,230939) nc / [231041,231248) Of / [271940,271971) OL / [272717,272729) HAt / [272928,272964) Rc+jf / [273791,273934) vi / [274111,274247) vc / [274247,274483) MAt / [274483,274511) zf / [274511,274538) Wf / [274539,274916) Ci',
    '宿主加 renderVersions/panes 与 PluginStateStore 的 readers/folds/staleListeners/bumps；seam src/plugin-chain-notify-fold.ts；回归 test/plugin-chain-notify-fold.test.ts 7/7；W45-29 的抛出断言与编译驱动同步改为真实调度'],
  ['2026-10-16T09:47:00Z', 'verification', 'W45-30 验收：扫描 unresolved 0、30 计划一致、全量与打包冒烟（记录脚本自读身份与输出）',
    '折页调度器搬运',
    `check/build/notices；扫描 unresolved 0；verify-chain-copies passed true（30 plans）；聚焦 7/7 与相关 37/37；全量 ${full}；十五个编译驱动 exit 0（新增输出 W45NotifyFoldCompiled.v1）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md');
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-30 acceptance (2026-10-16)

- [x] **The scheduler's argument was read, not assumed.** A reader id, not a state key; the probe's silence on the first attempt is what surfaced it.
- [x] **Every block is copied.** 20 blocks / 1,781 units verbatim; the three bodies from other modules (\\\`Ge\\\`, \\\`bs\\\`, \\\`FDn\\\`) are ported rather than guessed, and \\\`Ge\\\` was read before it was relied on.
- [x] **The boundary W45-29 left is closed, not widened.** The stub became the real body, and both assertions that pinned the throw now pin the scheduling.
- [x] **Both paths of a fold are driven.** Run-now (stale cleared, version written, listener called, \\\`lastAt\\\` stamped) and armed (stale kept, \\\`pending\\\` set, nothing written until the timer callback).
- [x] **The throttle's effect is asserted, not just its window.** A live-pace reader with a throttled plugin folds steady and the live fold is untouched.
- [x] **The record script reads its own numbers and closes the queued item.** Identity from scripts/identity.mjs with count assertions, the sweep summary and packaged report parsed from their outputs, and W45-29's \\\`next_package[0]\\\` rewritten to point at this package.
- [x] **Sweep.** check/build/notices, scan \\\`unresolved 0\\\`, 30 byte-identical plans, 7/7 new regressions, full ${full}, fifteen compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| full:', full, '| smoke:', smoke);
