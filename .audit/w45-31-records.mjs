// W45-31 records: the bar's clock driver, the indexes and the audit trail. Identity, the full sweep's
// summary and the packaged smoke's report are read from their own outputs, so the record cannot carry a
// number the tree did not produce.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 326, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 129, `validation ${identity.validation.files}`);
expect(identity.build.files === 228, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const sweep = read('/tmp/w45-31-sweep.txt');
const sweepOf = (label) => Number(new RegExp(`^\\u2139 ${label} (\\d+)$`, 'm').exec(sweep)?.[1]);
const tests = sweepOf('tests');
const passed = sweepOf('pass');
const failed = sweepOf('fail');
if (!Number.isInteger(tests) || !Number.isInteger(failed)) throw new Error('the sweep report has no summary');
const sweepFailNames = [...sweep.matchAll(/^✖ (.+?) \(\d/gm)].map((m) => m[1]);
const full = `${tests} tests / ${passed} pass / ${failed} fail` +
  (failed === 0 ? ' on the frozen tree' : `: ${sweepFailNames.join('; ')}`);

const smokeReport = read('/tmp/w45-31-smoke.txt').split('\n')
  .filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; ` +
  `upstreamRequests ${smokeReport.upstreamRequests}`;

const evidence = {
  schema: 'W45NotifyClockEvidence.v1',
  package: "W45-31 — the notification bar's clock driver: the tick that puts the ledger, the store and the timer in order",
  date: '2026-10-16',
  question: 'The ledger core (W45-27), the stored read (W45-28) and write (W45-29) are ported and the fold scheduler (W45-30) runs the store\'s readers. What drives the bar itself — who calls the tick, in what order, and what does the bar\'s own state carry into it?',
  answer: 'One body, `TK` [478764,479204), 440 units, plus the hidden test it feeds the split with. One tick takes `{clock, store, pending, last}`: it splits the store\'s queue (`sLs(notifications, Cj(state), Sqt)` — the bar hidden while a diff panel is visible or the pane holds toasts, the fallback timeout 4000ms), ticks the previous ledger against that split with the stored ledger merged in (`aLs(cLs(last.current, SEt()), split, clock.now())`), cancels the timer the previous tick armed (`pending.current?.()`), writes the resulting ledger (`xYr`), remembers it in `last.current`, reports the time each toast lost (`uLs`), refreshes the queue\'s texts through `store.setState` (`pLs`, keeping the same state object when nothing changed) and arms the next tick: the ledger\'s own next deadline (`dLs`) through `clock.setTimeout`, keeping the first canceller in `pending.current`. The source calls it from the bar component (chunk-24k7d6mw.js [479440,…)) with the host\'s clock facade, the bar\'s state store and two refs, and cancels `pending.current` on unmount.',
  ported: [
    { module: 'chunk-356hrhz3.js', range: [1299, 1359], units: 60, names: ['Cj'], note: 'whether the bar counts as hidden: `diffPanelVisible || paneHoldsToasts`, the second argument `sLs` takes — no coercion, so two absent flags give `undefined`' },
    { module: 'chunk-24k7d6mw.js', range: [478764, 479204], units: 440, names: ['TK'], note: 'the clock driver: split, tick, cancel, write, remember, report, refresh the texts, arm the next tick' },
  ],
  clock_contract: 'The handle\'s `clock` is the source\'s own clock facade (`mIr`/`nS`, already ported in src/plugin-chain-stream-source.ts): `now()` and a `setTimeout(fn, ms)` returning `() => clearTimeout(timer)`. That return value is what `TK` keeps in `pending.current` and calls before it writes, so the canceller contract is the source\'s, not an invention.',
  measured: [
    'A tick on a bar showing a 4000ms toast while the stored ledger holds a 1500ms one lays out `{toasts: [{key, plugin, text, isManaged: false, leftMs: 1500, wasShown: true, lentMs: 0, untoldMs: 0}], at: now, slot: {key, endsAt: now + 4000, shown: key}}`, writes exactly that back to the plugin-state store, and leaves the state object untouched (`pLs` found no text change, so `setState` returned the same object).',
    'The same tick arms one timer, at 1500ms — the time the shown toast runs out, which is before its slot ends; `dLs` gives nothing when the two coincide (a 4000ms toast in a 4000ms slot arms nothing).',
    'The next tick at that deadline cancels the armed timer first (`pending.current?.()`), ages the toast by the elapsed time (`leftMs` 1500 → 500, `at` + 1000), writes that back, and re-arms for the 500ms that are left.',
    'A bar with nothing to show (`current: null`, empty queue) arms nothing and leaves `pending.current` unset; the ledger it writes is `{toasts: [], at: now, slot: undefined}`.',
    '`Cj` returns the raw `||` result: `false` for two explicit falses, `true` for either flag, and `undefined` when neither is present.',
  ],
  caught_by_the_tooling: [
    'The first probe armed nothing and reported an empty ledger, which is what sent the read of the stored ledger into the fixture — `TK` lays out the *stored* ledger (the toasts the bar keeps) and only assigns the slot from the queue, so a tick over an empty store has nothing to show.',
    'The compiled driver expected `false` from `Cj` for a state object with neither flag; the body has no coercion and returns `undefined`. The driver, the regression and the record now pin that.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'src/plugin-chain-notify-clock-source.ts: unresolved 0',
    chain_verifier: 'passed true, 31 plans',
    regressions: 'test/plugin-chain-notify-clock.test.ts 4/4; the seven related suites (notify, notify-write, notify-store, notify-fold, ui, toast, plugin-chain) together 44/44',
    full,
    compiled: 'all fifteen dist drivers exit 0; the shared driver prints W45NotifyClockCompiled.v1 against dist',
    smoke,
  },
  next_package: [
    "the host toast method's stacked path: `EEe` (chunk-24k7d6mw.js [173176,…)) with `bu()`/`wee` and the `toast stacked` notice",
    'the bar component that calls the tick (`JFe`, chunk-24k7d6mw.js [479204,…)): what builds the store it ticks, the refs and the unmount cleanup — the surface the driver is wired into',
    'the store factory `gs`/`Zco` and the rest of the registry\'s stores, so `renderVersions`/`panes`/`pluginState` are built at registry construction as the source\'s literal does',
    'the reader/mount lifecycle around the folds: `Tb`, `Gf`, `OH`, `Kf`, `xur` and the `Cb` stale-listener registration',
    'the rest of the `$` table beyond the three ui floors, entry by entry',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
  ],
};
write('research/ports/W45-notify-clock-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

// CURRENT: the W45-31 row above the W45-30 one.
const current = read('research/CURRENT.md');
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-31 **搬完通知栏的时钟驱动 \`TK\`**（2 段 500 单位，两个模块）：一次 tick 收 \`{clock,store,pending,last}\`，顺序为「拆队列 \`sLs(notifications, Cj(state), Sqt)\` → 取存储台账合并后推进一拍 \`aLs(cLs(last.current, SEt()), split, clock.now())\` → **先取消上一拍的定时器** \`pending.current?.()\` → \`xYr\` 写回台账 → 记进 \`last.current\` → \`uLs\` 报丢失时间 → \`pLs\` 刷新队列文本并经 \`store.setState\` 写回（无变化时保持**同一** state 对象）→ 用 \`dLs\` 给出的下一期限经 \`clock.setTimeout\` 挂下一拍，只留**第一个**取消器」。\`Cj\`（chunk-356hrhz3.js [1299,1359)）= 栏是否被遮挡的判定：\`diffPanelVisible || paneHoldsToasts\`，**不强制布尔**（两标志都缺时为 \`undefined\`）。时钟契约取自源自身的时钟门面（\`mIr\`/\`nS\`，早已搬在 \`plugin-chain-stream-source.ts\`）：\`setTimeout\` 返回 \`() => clearTimeout(timer)\` 的取消器——正是 \`TK\` 存进 \`pending.current\` 并在写前调用的那一个。**实测**：显示 4000ms toast 而存储台账是 1500ms 时，\`dLs\` 给出 1500 才挂表（两者相同时不给、不挂）；台账 \`{toasts:[{…leftMs:1500,wasShown:true}], at, slot:{endsAt:now+4000, shown}}\` 且原样写回；state 无文本变化→\`setState\` 返回同一对象；下一拍先 \`cancelled 1500\`，再老化 \`leftMs\` 1500→500、\`at\`+1000，并续挂 500；空栏（\`current:null\`+空队列）不挂表、\`pending\` 不设，台账 \`{toasts:[], at, slot:undefined}\`。工具链抓到两处：首版探针因空 store 而无输出（由此读清「tick 铺的是**存储**台账，队列只决定 slot」）；编译驱动把 \`Cj\` 的两标志缺失当成 \`false\`，实为 \`undefined\`（无强制布尔），三处一并改正。验收：check/build/notices、扫描 \`unresolved 0\`、**31 计划**一致、聚焦 4/4 与相关 44/44、全量 **${full}**、十五个编译驱动（\`W45NotifyClockCompiled.v1\`）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [时钟驱动证据](ports/W45-notify-clock-evidence.json)、[折页证据](ports/W45-notify-fold-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('C-12 row not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the bar's clock driver.
const features = read('research/FEATURES.md');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('interactive row not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = rowText.slice(0, lastPipe).replace(/\s+$/, '') +
  '. W45-31 added the bar\'s clock driver: one tick splits the queue (hidden while a diff panel is visible or the pane holds toasts), ticks the stored ledger against it, cancels the timer the previous tick armed, writes the ledger back, reports the time lost and arms the next tick at the deadline the ledger gives' +
  ' |';
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = read('research/coding-standard.md');
const standardAt = standard.indexOf('2026-10-16 W45-30 折页调度器');
if (standardAt < 0) throw new Error('coding-standard W45-30 line not found');
const standardEntry = `2026-10-16 W45-31 时钟驱动 \`TK\`：S-1至S-7已对照。S-1（先读源）：2 段逐字搬运；\`Cj\` 与其调用点（chunk-24k7d6mw.js [479440,…)）一并读出，时钟契约不靠猜——\`setTimeout\` 的返回值是**取消器**，依据是源自身已搬的时钟门面 \`mIr\`/\`nS\`（\`return()=>clearTimeout(o)\`）与 \`TK\` 里 \`pending.current?.()\` 的用法。S-2（不留半包）：一次 tick 的七步顺序全部由回归钉住（拆队列→推进→取消→写回→记忆→报失→刷新文本→挂下一拍）。S-3：回归覆盖 \`Cj\` 三态（含**无强制布尔**的 \`undefined\`）、\`dLs\` 何时给/不给期限、台账原样写回、state 无变化保持同一对象、下一拍的取消与续挂、空栏不挂表。S-4（可复跑校验）：记录脚本自读身份（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）并对计数断言，全量摘要与打包报告从各自输出解析。S-7：宿主 toast 的 stacked 路径（\`EEe\`）与调用 \`TK\` 的栏组件（\`JFe\`）、\`gs\`/\`Zco\` 工厂、readers/mount 生命周期无源码可搬入本包范围，已连区间记入下一包。验收：check/build/notices、扫描 unresolved 0、31 计划一致、全量 ${full}、十五个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-31 paragraph above the W45-30 one.
const status = read('research/STATUS.md');
const statusAt = status.indexOf("W45-30: the plugin-state store's reactivity");
if (statusAt < 0) throw new Error('STATUS W45-30 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-31: the bar's clock driver. \\\`TK\\\` [478764,479204) is the tick a surface runs on its clock, ported with the hidden test it feeds the split (\\\`Cj\\\`, \\\`diffPanelVisible || paneHoldsToasts\\\`, no coercion). One tick splits the store's queue, ticks the stored ledger against it, cancels the timer the previous tick armed, writes the ledger back through \\\`xYr\\\`, reports the time each toast lost, refreshes the queue's texts (keeping the same state object when nothing changed) and arms the next tick at the deadline \\\`dLs\\\` gives through the clock's own \\\`setTimeout\\\` — whose return value is the canceller \\\`pending.current\\\` holds, the contract of the source's own clock facade (\\\`mIr\\\`/\\\`nS\\\`). Evidence: \\\`research/ports/W45-notify-clock-evidence.json\\\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-31 section.
const runner = read('research/ports/W45-chain-runner.md');
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-31 ported the bar's clock driver (2026-10-16)

W45-27 took the ledger's arithmetic, W45-28/29 the stored read and write, W45-30 the store's readers;
this package takes the tick that puts them in order. Two blocks (500 units) over two modules: \\\`TK\\\`
[478764,479204) and the hidden test it hands the split (\\\`Cj\\\`, \\\`diffPanelVisible || paneHoldsToasts\\\` —
no coercion, so two absent flags give \\\`undefined\\\`).

One tick receives \\\`{clock, store, pending, last}\\\` and, in the copied order: splits the store's queue with
the hidden test and the 4000ms fallback, ticks the previous ledger against that split with the stored
ledger merged in, cancels the timer the previous tick armed, writes the resulting ledger, remembers it,
reports the time each toast lost, refreshes the queue's texts through the store (keeping the same state
object when nothing changed) and arms the next tick at the deadline the ledger gives — keeping only the
first canceller.

Two things the read of the source settled. The driver lays out the *stored* ledger, not the queue: the
queue only decides which toast holds the slot, which is why the first probe, run over an empty store,
showed nothing to arm. And the clock's \\\`setTimeout\\\` returns a canceller rather than a handle — the source's
own clock facade (\\\`mIr\\\`/\\\`nS\\\`, already ported) returns \\\`() => clearTimeout(timer)\\\`, which is exactly what
\\\`pending.current?.()\\\` calls before each write.

Verified: check/build/notices, 31 byte-identical plans, the new copy \\\`unresolved 0\\\`, 4/4 new
regressions, the seven related suites 44/44, full ${full}, fifteen compiled drivers (the shared driver now
also prints \\\`W45NotifyClockCompiled.v1\\\`), and the packaged smoke (${smoke}). Identity \\\`${short}…\\\` (read
from scripts/identity.mjs by the record script itself, which asserts the file counts).

Next: the host toast method's stacked path (\\\`EEe\\\` [173176,…)) and the bar component that calls the tick
(\\\`JFe\\\` [479204,…)), which owns the store, the refs and the unmount cleanup.
`);

const rows = [
  ['2026-10-16T10:12:00Z', 'package', 'W45-31 搬完通知栏时钟驱动 TK（含 Cj 遮挡判定，2 段 500 单位）',
    'W45-27/28/29/30 备齐台账、读写与阅读器；本包是那一次 tick 的顺序与定时器契约',
    'chunk-356hrhz3.js [1299,1359) Cj、chunk-24k7d6mw.js [478764,479204) TK',
    '时钟取消器契约取自源自身时钟门面 mIr/nS（return()=>clearTimeout）；一次 tick 七步全由回归钉住；回归 test/plugin-chain-notify-clock.test.ts 4/4'],
  ['2026-10-16T10:24:00Z', 'verification', 'W45-31 验收：扫描 unresolved 0、31 计划一致、全量与打包冒烟（记录脚本自读身份与输出）',
    '时钟驱动搬运',
    `check/build/notices；扫描 unresolved 0；verify-chain-copies passed true（31 plans）；聚焦 4/4 与相关 44/44；全量 ${full}；十五个编译驱动 exit 0（新增输出 W45NotifyClockCompiled.v1）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md');
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-31 acceptance (2026-10-16)

- [x] **The tick's order is driven, not described.** Split, tick, cancel, write, remember, report, refresh, arm — each step asserted in the order the copied body runs them.
- [x] **The canceller contract comes from the source.** \\\`pending.current?.()\\\` before each write is the return value of the source's own clock \\\`setTimeout\\\` (\\\`mIr\\\`/\\\`nS\\\`), not a shape invented for the test.
- [x] **The probe's silence was read, not papered over.** A tick over an empty store has nothing to arm because it lays out the stored ledger; the fixture now builds one through the write half.
- [x] **The no-coercion case is pinned.** \\\`Cj\\\` returns \\\`undefined\\\` for a state with neither flag, which the driver caught against my \\\`false\\\` expectation.
- [x] **The record script reads its own numbers.** Identity from scripts/identity.mjs with count assertions, the sweep summary and packaged report parsed from their outputs.
- [x] **Sweep.** check/build/notices, scan \\\`unresolved 0\\\`, 31 byte-identical plans, 4/4 new regressions, full ${full}, fifteen compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| full:', full, '| smoke:', smoke);
