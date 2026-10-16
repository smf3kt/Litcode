// W45-26 records: the ui.toast floor, the admission policy behind it, the indexes and the audit
// trail. Anchored inserts assert their target first.
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = {
  sha256: '2c10821559e15eadca4f9dc08eaec02d57a90e94deb7c3b32b08abef7a67f13c',
  inputs: { sha256: 'ace46bf12a0dbd824ab994f609430ce232941bee999251b98a7091e3a76ec7cf', files: 310 },
  validation: { sha256: '5e5ff698eea3c05a34e0a96dd32fd88af77158c109f7d1cdd192a20021e29a5f', files: 124 },
  build: { sha256: '808666643b8a89f343e9741550e3049961d469741330a04f3496f8de5c8b9f38', files: 217 },
};

const evidence = {
  schema: 'W45ToastFloorEvidence.v1',
  package: 'W45-26 — the `$.ui.toast` floor and the admission policy the entry sits on',
  date: '2026-10-15',
  question: 'The `$` table lists `ui.toast` with `run:lJt("ui.toast",Kxo)`. What does the floor write, what does its `check` refuse, and which bodies decide whether an arriving plugin toast waits, gives way or cuts the running one short?',
  answer: 'The floor is the same gate as `ui.status`, around `session.toast(plugin, BDe(text), timeoutMs)`, and its `check` refuses a text that is not a string and a `timeoutMs` outside whole numbers 1..60000. The admission policy is a set of pure bodies beside it in the same module: `sI`/`gLs` name and read the `plugin-toast-<id>:<plugin>` key, `DWt`/`ACn` pick the waiting toast that gives way once a plugin holds 50, `hLs` returns the decision, `sLs` splits a queue, `mLs` reports a give-way, and `AQo` notes a spelling once.',
  entry: {
    module: 'chunk-sfn1dbxq.js',
    range: [2351998, 2352180],
    units: 182,
    text: '"ui.toast":{check:(n)=>{let r=n?.timeoutMs!==void 0&&!yro(n.timeoutMs,F2e);return LVe(n?.text)??(r?`timeoutMs is a whole number of ms, 1 to ${F2e}`:void 0)},run:lJt("ui.toast",Kxo)},',
    note: 'the entry sits immediately before the W45-24 pair, so its span is its own: [2351998,2352180), where [2352180,2352478) begins',
  },
  ported: [
    { module: 'chunk-sfn1dbxq.js', range: [1691234, 1691480], units: 246, names: ['sI', 'sLs'], note: 'the plugin a toast key names, and a queue split into its current toast, its waiting ones and whether the bar is hidden' },
    { module: 'chunk-sfn1dbxq.js', range: [1695123, 1695224], units: 101, names: ['ACn', 'DWt'], note: 'the 50 waiting toasts one plugin may hold, and which of them gives way at that count' },
    { module: 'chunk-sfn1dbxq.js', range: [1695323, 1696041], units: 718, names: ['AQo', 'fLs', 'Sqt', 'mLs', 'gLs', 'hLs'], note: 'the once-per-plugin notice, the priority and default timeout, the give-way report, the key builder and the admission decision' },
    { module: 'chunk-sfn1dbxq.js', range: [1696157, 1696266], units: 109, names: ['Kxo'], note: 'the floor: the gate around `session.toast(plugin, BDe(text), timeoutMs)`' },
    { module: 'chunk-tvdq3hrk.js', range: [10862, 10939], units: 77, names: ['yro'], note: 'the whole-number-in-range check the entry validates `timeoutMs` with' },
    { module: 'chunk-sfn1dbxq.js', range: [2343390, 2343404], units: 14, names: ['F2e'], note: '60000, the bound the entry names in its refusal' },
  ],
  why_these_ranges: [
    '`uMe` (already carried by W45-24) sits inside the policy run at [1695224,1695323), so the run is taken as two blocks ([1695123,1695224) and [1695323,1696041)) and nothing is copied twice.',
    '`sI` and `sLs` are adjacent declarations (the key reader and the queue split), so one range carries both.',
    '`hLs` closes the policy run directly at `LWt` (the W45-24 block at [1696041,1696157)), so its block ends on the source\'s own boundary.',
  ],
  measured: [
    'An unbound session drops the write: `$.ui.toast (fixture-toast): no session bound; dropped: hello`, and the session is never reached.',
    'A bound session receives `toast(plugin, text, timeoutMs)` — `undefined` for the timeout a plugin did not ask for — and the log line is `$.ui.toast (<plugin>): <text>` with the same remote-limit truncation the write gets.',
    "The entry's `check` refuses a non-string text (`takes a string text`) and any present `timeoutMs` that is not a whole number from 1 to 60000, including 0, 60001 and 1.5; 1 and 60000 pass, and an absent timeoutMs is not a value to check.",
    'A toast key is `plugin-toast-<id>:<plugin>` and only such a key names a plugin (`app-note` and `undefined` do not).',
    'The admission decision: an empty bar admits at once; another plugin running makes the arriving toast wait; this plugin\'s own running toast is cut short by the arriving one and its key reported as the give-way; a bar that is held admits nothing and gives way only at the 50th waiting toast of that plugin (`ACn`), the oldest of them.',
    '`splitToastQueue` keeps each waiting toast\'s own timeout and applies the default (4000) only where none was set.',
    'A give-way writes `$.ui.toast (<plugin>): <key> gave way, cut short|unseen`; the unseen notice is a transcript line and `CK` sends it only while a plugin source is installed, once per plugin and spelling — a second give-way for the same plugin logs but is not noticed again, and no key at all is not a give-way.',
    '`noteToastOnce` runs its callback the first time a spelling is seen for a plugin and environment and skips it afterwards.',
  ],
  integration_site: {
    where: 'chunk-24k7d6mw.js [179559,179700) — the host\'s toast method',
    shape: 'when the host stacks toasts, `EEe({plugin,text,timeoutMs})` takes it on the stacked path (which notices `toast stacked` once per plugin); otherwise the method computes `hLs({...store.notifications, isHeld}, plugin)`, builds the key with `gLs(plugin, id)`, reports the give-way with `mLs({key,plugin,isCutShort: iLs(...)})` and calls `this.requireHost().addNotification({key, kind:"event", text, priority:fLs, waitsItsTurn})`.',
  },
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'src/plugin-chain-toast-source.ts: unresolved 0',
    chain_verifier: 'passed true, 26 plans',
    regressions: 'test/plugin-chain-toast.test.ts 4/4; ui + toast + runtime together 29/29',
    full: '1334/1334',
    compiled: 'all fifteen dist drivers exit 0; .audit/w45-24-compiled.mjs extended to dist\'s toast floor and prints W45ToastFloorCompiled.v1',
    smoke: 'scripts/smoke-package.mjs passed, upstreamRequests 0, 225 files',
  },
  limitations: [
    'The notification bar itself is not ported: its store, its zod schema (`TWt`) and its React clock driver `TK` (chunk-24k7d6mw.js [478823,…)) are the host surface\'s own. The seam re-exports the admission policy so a surface decides exactly as the source does; the bar\'s ledger family (`Ope`, `SEt`, `xYr`, `aLs`, `cLs`, `dLs`, `uLs`, `pLs`, `u1e`, `iLs`, `Fpe`, `EWt`, `RWt`, `CWt`, `AWt`, `PWt`, `MWt`, `IWt`, `OWt`, `lLs`, `a3` in chunk-sfn1dbxq.js [1691480,1695123)) stays with it.',
    'The give-way notice needs a plugin source installed to be noticed at all: `CK` returns early while `aCe()` is false, which is why the regression installs a module before asserting the transcript line.',
    `The entry is an arrow in the seam, not a copied block: a table fragment is not a top-level statement the generator can emit (the same reason the W45-24 entries are arrows).`,
  ],
  next_package: [
    'the notification bar: the host toast method (chunk-24k7d6mw.js [179559,179700)) with the stacked path and `addNotification`, its store and zod schema, and the `TK` clock driver at [478823,…)',
    'the rest of the `$` table beyond the three ui floors, entry by entry',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
  ],
};
write('research/ports/W45-toast-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

// CURRENT: the W45-26 row above the W45-25 one.
const current = read('research/CURRENT.md');
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-15最新**：W45-26 **搬完 \`$\` 表的 \`ui.toast\` 条目及其准入策略**（表项自身区间 chunk-sfn1dbxq.js [2351998,2352180) 182 单位，逐字作箭头落在 \`src/plugin-chain-ui.ts\`）。地板 \`Kxo\` 与 \`ui.status\` 同门：\`Vyt\` 门控下的 \`session.toast(plugin, BDe(text), timeoutMs)\`；\`check\` 拒非字符串文本与「非 1..60000 整数」的 \`timeoutMs\`（0/60001/1.5 拒，1 与 60000 过，缺省不校验）。准入策略 6 段 1,265 单位落 \`src/plugin-chain-toast-source.ts\`（\`sI\`/\`sLs\`、\`ACn\`/\`DWt\`、\`AQo\`/\`fLs\`/\`Sqt\`/\`mLs\`/\`gLs\`/\`hLs\`、\`Kxo\`、\`yro\`、\`F2e\`），扫描 \`unresolved 0\`。**实测**：空栏即刻显示；别的插件在跑则等待；自家在跑则被新 toast 截短并回报其键；\`isHeld\` 时不放行，该插件第 50 条等待中者让位（\`ACn\`，最旧一条）；键形 \`plugin-toast-<id>:<plugin>\`；让位写 \`$.ui.toast (<plugin>): <key> gave way, cut short|unseen\`，unseen 通知走 transcript 且**仅当已装插件源**（\`CK\` 的 \`aCe()\` 门），每插件每拼写一次。**宿主集成点**记录在案：chunk-24k7d6mw.js [179559,179700) 的 toast 方法（\`hLs\`→\`gLs\`→\`mLs\`→\`addNotification({priority:fLs, waitsItsTurn})\`），通知栏本体（store + zod + \`TK\` 时钟驱动）留给下一包。验收：check/build/notices、扫描 0、26 计划一致、聚焦 4/4 与相关 29/29、全量 **1334/1334**、十五个编译驱动（\`.audit/w45-24-compiled.mjs\` 扩到 dist 的 toast，输出 \`W45ToastFloorCompiled.v1\`）、打包冒烟 0 上游请求（225 文件）；身份 \`2c108215…\`。 | [toast 证据](ports/W45-toast-evidence.json)、[ui 证据](ports/W45-ui-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('C-12 row not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the toast floor.
const features = read('research/FEATURES.md');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('interactive row not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = rowText.slice(0, lastPipe).replace(/\s+$/, '') +
  '. W45-26 added the `$.ui.toast` floor and the toast admission policy: the floor writes `session.toast(plugin, text, timeoutMs)` behind the same session gate, its check bounds `timeoutMs` to whole milliseconds 1..60000, and the policy decides which waiting toast gives way at 50 per plugin' +
  ' |';
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = read('research/coding-standard.md');
const standardAt = standard.indexOf('2026-10-15 W45-25 ');
if (standardAt < 0) throw new Error('coding-standard W45-25 line not found');
const standardEntry = `2026-10-15 W45-26 ui.toast 条目与准入策略：S-1至S-7已对照。S-1（先读源）：表项先取其自身区间 [2351998,2352180)（W45-24 的 [2352180,2352478) 紧邻其后，两段不重叠），策略体先逐段读出边界——\`uMe\` 落在策略串中间（W45-24 已搬），故整串取两块而不重复搬同一体；\`sI\`+\`sLs\` 相邻、\`hLs\` 以 \`LWt\` 为界。S-3（不留半包）：地板与策略都在回归里驱动——门控丢弃/写入、\`BDe\` 截断、\`check\` 两类拒绝与边界值、键形与解析、五种准入判定（空栏/他人在跑/自家被截短/isHeld 未满 50/满 50）、队列切分、让位日志与「每插件每拼写一次」通知（含 \`aCe()\` 门：无插件源则只留日志行）。S-7：通知栏本体（store、zod schema、React 时钟驱动 \`TK\`）无源码可搬入本包范围，已记录为下一包，并在 seam 注释中写明宿主集成点 chunk-24k7d6mw.js [179559,179700)。验收：check/build/notices、扫描 unresolved 0、26 计划一致、全量 1334/1334、十五个编译驱动、打包冒烟 0 上游请求。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-26 paragraph above the W45-25 one.
const status = read('research/STATUS.md');
const statusAt = status.indexOf('W45-25: the custom-theme loader');
if (statusAt < 0) throw new Error('STATUS W45-25 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-26: the \\\`$\\\` table's \\\`ui.toast\\\` floor and the admission policy behind it. The floor is \\\`Kxo\\\` — the same \\\`Vyt\\\` gate as \\\`ui.status\\\`, around \\\`session.toast(plugin, BDe(text), timeoutMs)\\\` — and its \\\`check\\\` bounds a present \\\`timeoutMs\\\` to whole milliseconds 1..60000. Six blocks (1,265 units) carry the policy: key naming \\\`sI\\\`/\\\`gLs\\\`, the 50-per-plugin cap \\\`ACn\\\`/\\\`DWt\\\`, the decision \\\`hLs\\\`, the queue split \\\`sLs\\\`, the give-way report \\\`mLs\\\` and the once-per-spelling notice \\\`AQo\\\`, plus \\\`yro\\\`/\\\`F2e\\\`/\\\`fLs\\\`/\\\`Sqt\\\`. The bar itself (store, zod schema, the \\\`TK\\\` clock driver) is the host surface's and is recorded as the next package with its integration site. Evidence: \\\`research/ports/W45-toast-evidence.json\\\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-26 section.
const runner = read('research/ports/W45-chain-runner.md');
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-26 ported the ui.toast floor and its admission policy (2026-10-15)

\`ui.toast\` is the third entry this port carries. Its own span is chunk-sfn1dbxq.js [2351998,2352180)
182 units, immediately before the W45-24 pair, and it is an arrow in \`src/plugin-chain-ui.ts\` for the
same reason: a table fragment is not a statement the generator emits. The floor \`Kxo\` runs the shared
gate around \`session.toast(plugin, BDe(text), timeoutMs)\`, and \`lJt\` adds the cut notice after it, so a
plugin's toast is written and then measured against the terminal's own text limit.

The policy behind it is six blocks (1,265 units) in \`src/plugin-chain-toast-source.ts\`: \`sI\`/\`gLs\`
name and read the \`plugin-toast-<id>:<plugin>\` key, \`ACn\`/\`DWt\` cap a plugin at 50 waiting toasts and
pick the one that gives way, \`hLs\` returns \`{isWaiting, givesWay, isCutShort}\`, \`sLs\` splits a queue,
\`mLs\` reports a give-way and \`AQo\` notes a spelling once, with \`yro\`/\`F2e\`/\`fLs\`/\`Sqt\` beside them.
The seam re-exports each under the name a surface reads it by, so a bar that owns a queue decides
exactly as the source does, and the host's own integration site (\`chunk-24k7d6mw.js\` [179559,179700),
ending in \`addNotification({priority:fLs, waitsItsTurn})\`) is recorded where the next package starts.

Measured, not asserted from reading: an unbound session drops the write; a bound one gets the text and
the timeout the plugin asked for; the check refuses a non-string text and a \`timeoutMs\` outside 1..60000
while accepting both bounds; the decision admits an empty bar at once, makes a toast wait behind another
plugin, cuts this plugin's own short, and gives way only at the 50th waiting toast of that plugin under a
held bar; the give-way report is logged always and noticed once per plugin and spelling, and only while a
plugin source is installed. Verified: check/build/notices, 26 byte-identical plans, the new copy
\`unresolved 0\`, 4/4 new regressions, ui + toast + runtime 29/29, full 1334/1334, fifteen compiled drivers
(the W45-24 driver extended to dist's toast floor), and the packaged smoke with zero upstream requests.
Identity \`2c108215…\`.
`);

const rows = [
  ['2026-10-16T06:20:00Z', 'package', 'W45-26 搬完 ui.toast 条目与准入策略（Kxo 地板 + hLs/DWt/gLs/mLs/AQo/sI/sLs）',
    '$ 表的第三个 ui 条目；表项自身区间 [2351998,2352180) 182 单位，与 W45-24 的 [2352180,2352478) 相邻不重叠',
    '策略 6 段 1,265 单位：chunk-sfn1dbxq.js [1691234,1691480) sI+sLs、[1695123,1695224) ACn+DWt、[1695323,1696041) AQo/fLs/Sqt/mLs/gLs/hLs、[1696157,1696266) Kxo、chunk-tvdq3hrk.js [10862,10939) yro、chunk-sfn1dbxq.js [2343390,2343404) F2e',
    'seam 增 ui.toast 表项与 toast 会话面，准入策略按表面读名 re-export；回归 test/plugin-chain-toast.test.ts 4/4；通知栏本体记为下一包并记下宿主集成点 [179559,179700)'],
  ['2026-10-16T06:34:00Z', 'verification', 'W45-26 验收：扫描 unresolved 0、1334/1334、打包 0 上游请求',
    'ui.toast 地板与准入策略搬运',
    'check/build/notices；扫描 unresolved 0；verify-chain-copies passed true（26 plans）；聚焦 4/4 与相关 29/29；全量 1334/1334；十五个编译驱动 exit 0（w45-24-compiled 扩到 dist toast，输出 W45ToastFloorCompiled.v1）；smoke-package（225 files, upstreamRequests 0）',
    '身份 2c108215…（inputs ace46bf1 / 310，validation 5e5ff698 / 124，build 80866664 / 217）'],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md');
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-26 acceptance (2026-10-15)

- [x] **The entry is its own range.** [2351998,2352180) 182 units, taken verbatim into the seam as an arrow; it abuts the W45-24 pair without overlapping it.
- [x] **No body copied twice.** \`uMe\` sits inside the policy run and is already carried, so the run is two blocks; \`hLs\` ends on the source's own boundary at \`LWt\`.
- [x] **The floor and the policy are both driven.** 4/4 regressions: drop line, write, truncation, both refusals and the accepted bounds, key naming, five admission decisions, the queue split, the give-way log and its once-per-plugin notice behind the \`aCe()\` gate.
- [x] **The scope boundary is recorded.** The notification bar (store, zod schema, \`TK\` clock driver) stays with the host, with its integration site (chunk-24k7d6mw.js [179559,179700)) named for the next package.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\`, 26 byte-identical plans, 4/4 new regressions, full 1334/1334, fifteen compiled drivers, packaged smoke with zero upstream requests.
`);
console.log('records written');
