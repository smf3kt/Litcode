// W45-24 records: the ui.status/ui.log floors, the registry fix they exposed, the indexes and the
// audit trail. Anchored inserts assert their target first.
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const evidence = {
  schema: 'W45UiFloorEvidence.v1',
  package: 'W45-24 — the `$` table\'s ui.status and ui.log floors, and the registry identity they exposed',
  date: '2026-10-15',
  question: 'The chain raises value events through `Hze`, and the table entry for the name is the floor. What are the ui.status and ui.log entries, and what do they need from the host?',
  answer: 'Both floors are small and fully recoverable. `Vyt` gates every ui write on a session bound in `DT`; `LWt` writes a status line through it and clears it when the plugin passes no text; `ui.log` routes by `to` to the product\'s transcript sink (`mce`) or to the debug log (`Pzo`), and notices a text longer than `N6` (2000) once per plugin through `$2e` → `Yb` → `CK` → `zz`. Driving them exposed a host defect: `it()` returned a fresh object per call, so `mce` and `GCn` wrote the ui.log sink onto a throwaway.',
  ported: {
    copy: 'src/plugin-chain-ui-source.ts',
    plan: 'research/ports/W45-ui-blocks.plan.json',
    blocks: 14,
    units: 1490,
    modules: ['chunk-sfn1dbxq.js', 'chunk-tvdq3hrk.js', 'chunk-n3ykh62m.js', 'chunk-qq2mgstr.js'],
    names: ['Vyt', 'uMe', 'LWt', 'Pzo', 'GCn', 'Izo', 'kye', 'Yb', '$2e', 'lJt', 'LVe', 'HM', 'CK', 'N6'],
  },
  entries: {
    source: 'chunk-sfn1dbxq.js [2352180,2352478) 298 units — the ui.status and ui.log entries of the plugin-method table `Iqo(state)` (its literal opens at [2346570)',
    why_not_a_block: 'The generator emits every block as a top-level statement; `"ui.status":{…},"ui.log":{…}` is a table fragment. The two entries are ported verbatim as arrows in src/plugin-chain-ui.ts with the range cited.',
    verbatim: [
      '"ui.status":{check:(n)=>n?.text===void 0?void 0:LVe(n.text),run:lJt("ui.status",(n,r)=>LWt(n.text,r))}',
      '"ui.log":{check:(n)=>LVe(n?.text)??Izo(n?.to),run:(n,r)=>{let s=n.to==="debug";return s?Pzo(r.plugin,n.text):mce(r.plugin,n.text),$2e(r.plugin,"ui.log",s?void 0:n.text),Promise.resolve(void 0)}}',
    ],
  },
  measured: [
    'No session bound: nothing is written and the gate logs `$.ui.status (fixture-ui): no session bound; dropped: hello`.',
    'Bound: the session\'s `status(plugin, text)` is called with the text truncated at 10000 with an ellipsis; with no text at all it is called with `undefined` and the line says `(cleared)`.',
    'The transcript route logs `[plugin] $.ui.log: text` and hands the same text to the subscriber `GCn` binds; the debug route logs `[plugin] $.ui.log (to debug): text` and reaches no subscriber.',
    'A text over 2000 characters on the transcript route writes the notice `fixture-ui: $.ui.log: a text (2001 characters) is drawn up to its first 2000 on the terminal, its first 10000 on a remote surface` and then `[fixture-ui] $.ui.log: <that text>`; a second long text from the same plugin writes the first line only (the `HM` key is `cut <plugin>#<environment> ui.log a text`); the debug route passes `void 0` where the text would be, so it never notices.',
    'The notice is gated by `aCe()`: it stays silent while no plugin is installed, and fires once a module is (non-TTY: `Ero()` falls to `Epr`, which keeps everything outside the disabled set).',
    'Lines written while no subscriber was bound wait in `pendingUiLog` and arrive at the next subscriber with the `again` state.',
    '`check` runs only through the dispatch: with a handler that opens the floor, `ui.log` refuses `{text:1}` with `ui.log: takes a string text (host check)`, `{text:"ok",to:"bogus"}` with `ui.log: to is "transcript" or "debug" (got "bogus") (host check)`, and `ui.status` refuses `{text:1}` the same way; with no handler `Hze` short-circuits to `run` and the checks are not consulted.',
    'A handler that answers keeps the floor out: `ui.status` returns the handler\'s value and the session sees nothing.',
  ],
  host_fix: {
    defect: '`it()` returned a fresh object literal per call, so the registry fields the ui.log route writes (`mce` queues into `pendingUiLog`, `GCn` binds `uiLogSink`) were written onto a throwaway object and lost. `GCn` threw `TypeError: r is not iterable` on the first call.',
    source: 'chunk-3ph567jx.js: `it` is [3729,3763) 34 units (`function it(){return a().registry}`) and the registry literal carries `uiLogSink:null,pendingUiLog:[]` at [2322,2354) 32 units beside its other fields. The source hands back the same registry object every call, which is what lets one call bind and the next read.',
    fix: 'src/plugin-chain-host.ts builds one registry object with the two fields added and returns it; the four earlier fields are unchanged.',
    classification: 'S-7 — a carried body was reading a surface whose identity the port had dropped; the fix restores the source\'s own shape rather than adding a side channel.',
  },
  found_elsewhere: {
    theme_copy: 'The scope-aware scan (W45-23) reports four free names in src/tui-custom-theme-source.ts (`gt` line 20, `Fe`/`Wi`/`Yf` line 21), an untracked copy imported by src/tui-custom-themes.ts with no plan or block ledger. Not this package\'s file, and no test drives those lines; recorded as Q-093 and set as the next package.',
  },
  verification: {
    identity: {
      sha256: 'fead754135a821e2454e746e87833893e547bbb66ac905428a1c45f49e73b813',
      inputs: { sha256: '1382d80be804231177db4026984476a10c1fc9fc05d37dde05af7e88694675fc', files: 305 },
      validation: { sha256: 'c3b3bf208ac42e82d5467987e6a68ef97387ac92078c8f10f4f4472f07097850', files: 121 },
      build: { sha256: '4833ef1ed392ffe30a853cc171691bff41fcd6a1bb4624bd278ef632570d0fcc', files: 214 },
    },
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    copy_verifier: 'passed true, 25 plans, byte-identical',
    scan_new_copy: 'src/plugin-chain-ui-source.ts: unresolved 0',
    regressions: 'test/plugin-chain-ui.test.ts 3/3; chain files together 72/72',
    full: '1328/1328',
    compiled: 'all fifteen dist drivers exit 0 (W45UiFloorCompiled.v1)',
    smoke: 'scripts/smoke-package.mjs passed, upstreamRequests 0, 224 files',
  },
  limitations: [
    'Only two table entries are bound. `ui.toast` (`Kxo`, 109 units, and the toast queue `DWt`/`sI`/`ACn`/`mLs`/`hLs`) and the rest of the table come with the packages that own their state.',
    'The session slot is bound only in tests and by this package\'s own `bindPluginSession`; nothing in the running product binds one yet, so a plugin\'s `$.ui.status` in a live session still finds no session until the wiring package lands.',
    'No `$` dispatcher exists in the product yet (W45-20\'s finding), so `raiseUiCall` is the raiser a dispatcher will call rather than a path a plugin reaches today.',
  ],
  next_package: [
    'src/tui-custom-theme-source.ts: the four free names `gt`/`Fe`/`Wi`/`Yf` and the register/plan its copy needs (Q-093)',
    'the `ui.toast` entry and the toast queue (`Kxo`, `DWt`, `sI`, `ACn`, `mLs`, `hLs`, `gLs`)',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
  ],
};
write('research/ports/W45-ui-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

// CURRENT: the W45-24 row above the W45-23 one.
const current = read('research/CURRENT.md');
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-15最新**：W45-24 **落地 \`$\` 调用表的 ui.status / ui.log 两个 floor，并修掉它们逼出来的宿主缺陷**。搬运 14 块 1,490 单位（chunk-sfn1dbxq.js 的 \`Vyt\` 会话门、\`LWt\` 状态写入、\`Pzo\`/\`GCn\`/\`Izo\`/\`kye\`/\`Yb\`/\`$2e\`/\`lJt\`/\`uMe\`，chunk-tvdq3hrk.js 的 \`LVe\`，chunk-n3ykh62m.js 的 \`HM\`/\`CK\`，chunk-qq2mgstr.js 的 \`N6\`）；两个表项本身是表字面量片段（\`"ui.status":{…},"ui.log":{…}\`，chunk-sfn1dbxq.js [2352180,2352478) 298 单位），生成器只发顶层语句，故按原样以箭头形式移入缝 \`src/plugin-chain-ui.ts\` 并标注范围。**实测行为**：无会话时 \`$.ui.status (p): no session bound; dropped: …\` 且不写；有会话时写 \`status(plugin, text|undefined)\`（文本在 10000 处截断加省略号，空文本即 \`(cleared)\`）；\`ui.log\` 按 \`to\` 分流 transcript（\`mce\`，同文本进 \`GCn\` 订阅者）与 debug（\`Pzo\`，不进订阅者）；超 2000 字符在 transcript 路给出一次性通知（键 \`cut <plugin>#<env> ui.log a text\`，debug 路传 \`void 0\` 故无通知），通知由 \`aCe()\` 闸门（无插件时静默）；未订阅时的行在 \`pendingUiLog\` 等待并以 \`again\` 状态补齐；两条 \`check\` 只在有 handler 打开 floor 时生效（\`takes a string text\`、\`to is "transcript" or "debug" (got …)\`）。**宿主缺陷（Q-092）**：\`it()\` 每次返回新对象字面量，导致 \`mce\`/\`GCn\` 把 \`uiLogSink\`/\`pendingUiLog\` 写在一次性对象上（\`GCn\` 直接 \`TypeError: r is not iterable\`）——按 chunk-3ph567jx.js 的原形（\`it\` [3729,3763)、注册表字段 [2322,2354)）改为返回**同一个**注册表对象。**顺带发现（Q-093，下一包）**：作用域感知扫描在 \`src/tui-custom-theme-source.ts\`（未跟踪、无计划/台账）报出 4 个自由名 \`gt\`/\`Fe\`/\`Wi\`/\`Yf\`。验收：check/build/notices、**25 计划**逐字节一致、新副本未声明 0、聚焦 3/3、链测试 72/72、全量 **1328/1328**、第十五个编译驱动 \`W45UiFloorCompiled.v1\`、打包冒烟 0 上游请求；身份 \`fead7541…\`（本包未改输入集，与 W45-23 同）。 | [ui 证据](ports/W45-ui-evidence.json)、[扫描证据](ports/W45-scan-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('C-12 row not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the Lifecycle hooks cell gains the ui floors.
const features = read('research/FEATURES.md');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Lifecycle hooks | Partial |'));
if (featureLine < 0) throw new Error('Lifecycle hooks row not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = rowText.slice(0, lastPipe).replace(/\s+$/, '') +
  ', and the `$` table\'s ui.status and ui.log floors are now ported with their writers (W45-24): a status write through the session gate, the two `ui.log` routes, the once-per-plugin length notice, and the registry identity the route needed fixing (`it()` returned a fresh object, so the sink it binds was lost) |';
write('research/FEATURES.md', lines.join('\n'));

// question.md: Q-092 (fixed) and Q-093 (open).
const question = read('research/question.md');
const q = `
### Q-092 \`it()\` 每次返回新对象，写进注册表的 ui.log 订阅者被丢掉（W45-24）

\`GCn\`（ui.log 的订阅入口，chunk-sfn1dbxq.js [2338505,2338661)）在第一次调用即抛 \`TypeError: r is not iterable\`：它读 \`it().pendingUiLog\` 并把 \`uiLogSink\` 写在 \`it()\` 的返回对象上，而产品的 \`it()\` 每次调用都新建一个字面量（只含 \`loadedModules\`/\`moduleSeats\`/\`hooksRespawns\`/\`registeredAgents\`），写入即丢。源里 \`it\` 是 \`function it(){return a().registry}\`（chunk-3ph567jx.js [3729,3763)），注册表字面量在 [2322,2354) 处带 \`uiLogSink:null,pendingUiLog:[]\`，**同一个对象**被反复返回——一次调用绑定、下一次调用读取，正是这个身份让它成立。

处置：\`src/plugin-chain-host.ts\` 改为构建一个注册表对象并返回它，补上 \`uiLogSink\`/\`pendingUiLog\` 两个字段；四个既有字段不变。回归 \`test/plugin-chain-ui.test.ts\` 覆盖订阅（\`GCn\` 冲刷 \`pendingUiLog\` 且带 \`again\` 状态、解绑只清自己的 sink）。分类 S-7。
`;
const q93 = `
### Q-093 \`src/tui-custom-theme-source.ts\` 有 4 个未声明引用（作用域感知扫描发现，未跟踪文件）

作用域感知扫描（W45-23 改造后）在该文件报 \`unresolved 4\`：\`gt\`（第 20 行）、\`Fe\`/\`Wi\`/\`Yf\`（第 21 行，\`P\` 内的 \`await Wi(...)\` 等）。该文件未跟踪、无 \`-blocks.json\` 台账、也不在 \`scripts/verify-chain-copies.mjs\` 的计划表里，但被 \`src/tui-custom-themes.ts\` 导入，因此是运行期会抛的真实缺口（无测试驱动到这些行）。既有搬运纪律：先按使用方自己的 import map 认名（Q-089），从声明模块补块或扩导出，然后把这一对登记进校验器。

处置：立案，列为下一包（W45-25）。分类 S-7。
`;
write('research/question.md', question.replace(/\n?$/, '\n') + q + q93);

// STATUS: the W45-24 paragraph above the W45-23 one.
const status = read('research/STATUS.md');
const statusAt = status.indexOf('W45-23: the copy-gap scan');
if (statusAt < 0) throw new Error('STATUS W45-23 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-24: the \`$\` call table's ui.status and ui.log floors are ported (src/plugin-chain-ui-source.ts, 14 blocks / 1,490 units, plus the two table entries taken verbatim as arrows with their range cited), and the host registry they exposed is fixed. \`Vyt\` gates every ui write on a session bound in \`DT\`, \`LWt\` writes or clears the status line, \`ui.log\` routes to the transcript sink or the debug log and notices an over-long text once per plugin, and the two \`check\` refusals only reach a caller through a handler that opens the floor. Driving it found that \`it()\` returned a fresh object per call, so the sink \`mce\`/\`GCn\` write was lost (Q-092, fixed against chunk-3ph567jx.js's own shape). The scan also reported four free names in src/tui-custom-theme-source.ts, an untracked copy with no plan (Q-093, next package). Evidence: \`research/ports/W45-ui-evidence.json\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// coding-standard: the dated review line above the W45-23 one.
const standard = read('research/coding-standard.md');
const standardAt = standard.indexOf('2026-10-15 W45-23 ');
if (standardAt < 0) throw new Error('coding-standard W45-23 line not found');
const standardEntry = `2026-10-15 W45-24 \`$\` 调用表 ui.status / ui.log floor 复查：S-1至S-7已对照。S-1（先读源）：两个表项是 \`Iqo(state)\` 字面量里的片段，生成器只发顶层语句，故按原文以箭头移入缝并标注 [2352180,2352478)，行为逐条实测（无会话丢弃文案、清空为 \`(cleared)\`、\`to\` 两路、2000 上限的一次性通知、\`aCe()\` 闸门、\`check\` 只在有 handler 打开 floor 时生效）。S-7 在本包第二次指向宿主：\`it()\` 原来每次新建字面量，而 \`GCn\`/\`mce\` 把 \`uiLogSink\`/\`pendingUiLog\` 写在返回值上——按源形（\`it\` [3729,3763) + 注册表字段 [2322,2354)）改为稳定对象，而不是另加旁路。新副本首扫即 \`unresolved 0\`（W45-23 的作用域规则在此生效），并把扫描新发现的 \`src/tui-custom-theme-source.ts\` 四名自由引用立案为 Q-093。验收：check/build/notices、25 计划逐字节一致、聚焦 3/3、链测试 72/72、全量 1328/1328、十五个编译驱动、打包冒烟 0 上游请求。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// runner.md: the package section.
const runner = read('research/ports/W45-chain-runner.md');
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-24 ported the ui.status and ui.log floors (2026-10-15)

The plugin-method table \`Iqo(state)\` (chunk-sfn1dbxq.js, literal opened at [2346570)) holds one entry
per \`$\` name. Two of them are this package: \`ui.status\` and \`ui.log\`, taken verbatim
([2352180,2352478) 298 units) as arrows in \`src/plugin-chain-ui.ts\`, since a table fragment is not a
top-level statement the generator can emit. Their bodies are copied (14 blocks / 1,490 units in
\`src/plugin-chain-ui-source.ts\`): \`Vyt\` (the session gate), \`LWt\` (the status writer), \`Pzo\`/\`GCn\`/
\`Izo\` (the ui.log routes and its check), \`kye\`/\`Yb\`/\`$2e\` (the length notice), \`lJt\` (the shared run
adapter), \`uMe\`, \`LVe\`, \`HM\`, \`CK\`, \`N6\`.

What the port produced, measured: an unbound session drops the write with \`no session bound; dropped:
…\`, a bound one receives \`status(plugin, text)\` (truncated at 10000, \`undefined\` clears it), the
transcript route logs and notifies its subscriber while the debug route only logs, an over-long text
notices once per plugin, and the two \`check\` refusals surface as \`(host check)\` only through a handler
that opens the floor.

Driving it exposed the host: \`it()\` handed back a fresh object every call, so the \`uiLogSink\`/\`pendingUiLog\`
fields \`mce\` and \`GCn\` write were lost (and \`GCn\` threw outright). The fix restores the source's own
shape — one registry object that carries both fields beside the four earlier ones. The now scope-aware
scan also reported four free names in \`src/tui-custom-theme-source.ts\`, an untracked copy with no plan;
that is Q-093 and the next package. Verified: check/build/notices, 25 byte-identical plans, the new copy
\`unresolved 0\`, 3/3 new regressions, chain files 72/72, full 1328/1328, fifteen compiled drivers, and the
packaged smoke with zero upstream requests.
`);

const rows = [
  ['2026-10-16T04:40:00Z', 'package', 'W45-24 落地 `$` 表 ui.status / ui.log 两个 floor（14 块 1,490 单位 + 两个表项按原文移入缝）',
    '两个 ui 事件此前无 floor：`Hze` 有 raise 无表项，产品里 `ui.log` 只有 `mce` 的旁路',
    '按模块图搬 `Vyt`/`LWt`/`Pzo`/`GCn`/`Izo`/`kye`/`Yb`/`$2e`/`lJt`/`uMe`/`LVe`/`HM`/`CK`/`N6`；表项 [2352180,2352478) 以箭头形式移入 `src/plugin-chain-ui.ts`；`raiseUiCall` 走 `Hze` 的 bottom',
    '实测八条行为（丢弃文案、清空、10000 截断、两路 ui.log、通知与去重、`aCe()` 闸门、pending 冲刷、两条 check）；记录 research/ports/W45-ui-evidence.json'],
  ['2026-10-16T04:52:00Z', 'defect', 'Q-092：`it()` 每次返回新对象，写进注册表的 ui.log 订阅者被丢掉（`GCn` TypeError）→ 按源形改为稳定注册表',
    '`GCn` 读 `it().pendingUiLog` 并把 `uiLogSink` 写在 `it()` 的返回对象上；产品 `it()` 是每次新建字面量，写入即丢',
    'chunk-3ph567jx.js `it` [3729,3763) + 注册表字段 [2322,2354)；`src/plugin-chain-host.ts` 改为一对象并补两个字段',
    '回归 test/plugin-chain-ui.test.ts（订阅、`again` 冲刷、解绑只清自己的 sink）；立案 Q-092'],
  ['2026-10-16T05:00:00Z', 'finding', 'Q-093：`src/tui-custom-theme-source.ts` 4 个未声明引用（作用域感知扫描新发现，未跟踪、无计划）',
    '`gt`（20 行）、`Fe`/`Wi`/`Yf`（21 行）；被 `src/tui-custom-themes.ts` 导入，运行期会抛，无测试覆盖',
    '列入下一包 W45-25：按使用方 import map 认名后补块/扩导出，并把这一对登记进 verify-chain-copies',
    '立案 Q-093'],
  ['2026-10-16T05:08:00Z', 'verification', 'W45-24 验收：25 计划一致、新副本未声明 0、1328/1328、打包 0 上游请求',
    'ui floor 的搬运与注册表修复',
    'check/build/notices；verify-chain-copies passed true（25 plans）；新副本 unresolved 0；聚焦 3/3 与链测试 72/72；全量 1328/1328；十五个编译驱动 exit 0（W45UiFloorCompiled.v1）；smoke-package（224 files, upstreamRequests 0）',
    '身份 fead7541…（inputs 1382d80b / 305，validation c3b3bf20 / 121，build 4833ef1e / 214）'],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md');
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-24 acceptance (2026-10-15)

- [x] **Read the source first.** The two entries live inside the table literal \`Iqo(state)\`; their bodies, the writers they call and each helper's own body were read at exact ranges before anything was ported.
- [x] **Copy, then adapt.** 14 blocks / 1,490 units byte-identical (the verifier's 25th plan); the only hand-written text is the seam's object literal, whose two arrows are the source's own characters with the range cited.
- [x] **Every behaviour measured, not assumed.** Drop line, cleared state, the 10000 truncation, both ui.log routes, the notice text and its key, the \`aCe()\` gate, the pending flush, and the \`host check\` refusals — each with the text the run produced.
- [x] **The host surface the copies need exists.** \`GCn\` binds a sink and \`mce\` reads it, which forced \`it()\` to be the source's own stable registry (Q-092).
- [x] **The scan is clean on the new copy.** \`unresolved 0\` on the first run, and the sweep's one other finding is filed as Q-093 rather than patched blindly.
- [x] **Sweep.** check/build/notices, 25 byte-identical plans, 3/3 focused regressions, chain 72/72, full 1328/1328, fifteen compiled drivers, packaged smoke with zero upstream requests.
`);
console.log('records written');
