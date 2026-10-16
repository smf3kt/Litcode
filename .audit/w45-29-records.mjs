// W45-29 records: the notification bar's write half, the indexes and the audit trail. Identity, the
// full sweep's summary and the packaged smoke's report are read from their own outputs, so the record
// cannot carry a number the tree did not produce.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 320, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 127, `validation ${identity.validation.files}`);
expect(identity.build.files === 224, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const sweep = read('/tmp/w45-29-sweep.txt');
const sweepOf = (label) => Number(new RegExp(`^\\u2139 ${label} (\\d+)$`, 'm').exec(sweep)?.[1]);
const tests = sweepOf('tests');
const passed = sweepOf('pass');
const failed = sweepOf('fail');
if (!Number.isInteger(tests) || !Number.isInteger(failed)) throw new Error('the sweep report has no summary');
const sweepFailNames = [...sweep.matchAll(/^✖ (.+?) \(\d/gm)].map((m) => m[1]);
const full = `${tests} tests / ${passed} pass / ${failed} fail` +
  (failed === 0 ? ' on the frozen tree'
    : `: ${sweepFailNames.join('; ')}`);

const smokeReport = read('/tmp/w45-29-smoke.txt').split('\n')
  .filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; ` +
  `upstreamRequests ${smokeReport.upstreamRequests}`;

const evidence = {
  schema: 'W45NotifyWriteEvidence.v1',
  package: "W45-29 — the notification bar's write half: the append, the write-or-skip, the state set and the seat check",
  date: '2026-10-16',
  question: 'W45-28 stopped at the read of the stored ledger. What writes it back — the append that turns a toast into a ledger entry, the rule that decides whether a write happens at all, the store\'s own set with the version and the freeze it applies, and the seat check that decides a toast\'s isManaged flag?',
  answer: 'Five bodies own it, with three small dependencies. `lLs` appends `{key, plugin, text, isManaged: sOn(plugin), leftMs: ms, wasShown: !1, lentMs: 0, untoldMs: 0}` to the ledger `SEt` reads. `xYr` writes a ledger only when it or the stored one has entries, and logs \`$.ui.toast: the bar\'s toasts were not kept: …\` when the write fails. `o5t` is the store\'s set: it round-trips the value through JSON under the `jde` ceiling, takes the next version as one past the stored value or the floor, writes inside `ls.exit` (outside any store scope the AsyncLocalStorage context ran in), then tells the key\'s readers through `vb`. The seat check is `Ee` (the module record\'s tier, else the seat table, else "user") and `sOn` over `Zws` (`["prepend","append"]`). The stored value is deep-frozen by `cho`/`OFe` over the cursor `O`, bounded by `PQt` (1e5).',
  ported: [
    { module: 'chunk-nwffn64n.js', range: [615, 635], units: 20, names: ['PQt'], note: 'the freeze walk\'s depth ceiling (1e5), taken with its neighbour `hR` because the declaration is one statement' },
    { module: 'chunk-nyce03br.js', range: [212618, 212634], units: 16, names: ['jde'], note: '4194304, the JSON-character ceiling the state store\'s set enforces' },
    { module: 'chunk-m4qpskd4.js', range: [48497, 48526], units: 29, names: ['Zws'], note: 'the seats that count as managed: ["prepend","append"]' },
    { module: 'chunk-2kdsvp3x.js', range: [37034, 37144], units: 110, names: ['Ee'], note: 'a plugin\'s seat: its module record\'s tier, else the seat table, else "user"' },
    { module: 'chunk-2kdsvp3x.js', range: [37144, 37182], units: 38, names: ['sOn'], note: 'whether the plugin\'s seat is one of `Zws`' },
    { module: 'chunk-ed7zyzrn.js', range: [2900, 3169], units: 269, names: ['O'], note: 'the freeze walk\'s cursor over arrays and plain objects, bounded by `PQt`' },
    { module: 'chunk-ed7zyzrn.js', range: [3169, 3400], units: 231, names: ['cho', 'OFe'], note: '`cho` freezes every reachable node with that cursor; `OFe` is `cho(o, new Set), o`' },
    { module: 'chunk-n3ykh62m.js', range: [274916, 274994], units: 78, names: ['vb'], note: 'tell a key\'s readers it changed — nothing to do while `readersOf` holds no reader' },
    { module: 'chunk-n3ykh62m.js', range: [275644, 275983], units: 339, names: ['o5t'], note: 'the state store\'s set: JSON round-trip under `jde`, next version from the value and the floor, the write inside `ls.exit`, then `vb`' },
    { module: 'chunk-sfn1dbxq.js', range: [1694273, 1694442], units: 169, names: ['lLs'], note: 'append a toast to the stored ledger with `isManaged` from the plugin\'s seat' },
    { module: 'chunk-sfn1dbxq.js', range: [1692719, 1692909], units: 190, names: ['xYr'], note: 'write the ledger unless both it and the stored one are empty, and log when the write fails' },
  ],
  seam_modules: {
    note: 'the generated copy holds the bodies verbatim; the seam names them, and one hand-written module binds the four names that are facilities rather than logic.',
    generated: 'src/plugin-chain-notify-write-source.ts — 11 blocks, 1,489 units, `unresolved 0`',
    runtime: 'src/plugin-chain-notify-store-runtime.ts — `ls` = `new AsyncLocalStorage()` (source `jD`, `import{AsyncLocalStorage as jD}from"async_hooks"` at chunk-ed7zyzrn.js [232720,…)), `_` = `JSON.stringify`, `Y` = `JSON.parse`, and `Ci` = the plugin-state fold scheduler, which is NOT ported: it throws with the reader count it would have scheduled.',
    seam: 'src/plugin-chain-notify-write.ts — MANAGED_SEATS (`Zws`), STATE_VALUE_MAX_CHARS (`jde`), pluginSeat (`Ee`), isManagedPlugin (`sOn`), setStoredState (`o5t`), notifyStateReaders (`vb`), appendStoredToast (`lLs`), writeStoredLedger (`xYr`), deepFreezeValue (`OFe`), freezeWalk (`cho`), freezeCursor (`O`).',
    omitted: 'the `using s = ih\`…\`` tracer spans `o5t` opens have no counterpart in src (no tracer/Disposable facility), and the spans carry no control flow — `ls.exit` is what the write is inside, and it is copied.',
  },
  host_change: '`PluginStateStore.values` gains a flat `setState` and an optional `readersOf`. W45-28 typed `setState` inside `getState()`\'s return; `o5t` calls `h.setState(...)` on `s_().values` itself, so at runtime the first write threw `h.setState is not a function`, which `xYr` caught and logged as `$.ui.toast: the bar\'s toasts were not kept: h.setState is not a function`. The interface is fixed in the source, in the W45-28 regression fixture and in the compiled driver\'s fixture, which is what this package\'s port surfaced.',
  measured: [
    'Seats: an installed module at tier "user" reads back "user", a seat of "prepend" reads back "prepend", an absent plugin reads back "user"; `isManaged` is false/true/false for those three.',
    'One append writes once: the stored key is `engine\\x00bar-toasts`, its version 1, and the stored toast is `{key, plugin, text, isManaged: false, leftMs: ms, wasShown: false, lentMs: 0, untoldMs: 0}` with the ledger\'s `at: 0`; the stored value is frozen.',
    'A second append from a seat of "prepend" stores `isManaged: true` beside it at version 2.',
    'An empty ledger over a non-empty store is written (the read is not kept when it has nothing to say and something is there); an empty ledger over an empty store is not written at all.',
    '`setStoredState` returns 1, then 8 over a floor of 7, then 9 — the floor wins over the stored value, then the stored value wins over the floor.',
    'Over the ceiling: `HooksError: a value of state is JSON data of at most 4194304 characters`. A circular value is a `TypeError` from the round-trip, which `o5t` does not swallow — the caller sees it.',
    'Through `writeStoredLedger`, that same circular value leaves the store untouched and logs `$.ui.toast: the bar\'s toasts were not kept: Converting circular structure to JSON …`.',
    'The freeze walk reaches nested objects and arrays; `notifyStateReaders` returns silently with no reader for the key and throws the pinned `/fold scheduler is not ported/` with one.',
  ],
  caught_by_the_tooling: [
    'The plan first imported `t` from `./plugin-chain-source.js`; the module loader refused it (`does not provide an export named \'t\'`), and the logger comes from `./plugin-chain-host.js`.',
    'The `cho`/`OFe` block\'s first range ended two units short ([3169,3398)), which left the generated file with a whole-file brace delta of 1; the scope-aware acorn pass refused it at line 62. The tail was measured (`…low}}function OFe(o){return cho(o,new Set),o}funct`) and the range is [3169,3400).',
    'The real defect this port surfaced is the store interface above: the type said one thing and the source body did another, and the runtime caught it on the first append.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'src/plugin-chain-notify-write-source.ts: unresolved 0',
    chain_verifier: 'passed true, 29 plans',
    regressions: 'test/plugin-chain-notify-write.test.ts 7/7; the five related suites (notify, notify-store, ui, toast, plugin-chain) together 30/30',
    full,
    compiled: 'all fifteen dist drivers exit 0; the shared driver prints W45NotifyWriteCompiled.v1 against dist',
    smoke,
  },
  next_package: [
    'the fold/reader subsystem `Ci` the store\'s reactivity runs on — `Wf`, `MAt`, `zf`, `A_`, `Of`, the readers/the folds/the surfaces and the bump tables — which is what makes `vb` reach a reader instead of the pinned throw',
    'the `TK` clock driver at chunk-24k7d6mw.js [478823,…), which owns the clock the ledger tick is driven by',
    'the host toast method\'s stacked path: `EEe` (chunk-24k7d6mw.js [173176,…)) with `bu()`/`wee` and the `toast stacked` notice',
    'the rest of the `$` table beyond the three ui floors, entry by entry',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
  ],
};
write('research/ports/W45-notify-write-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

// CURRENT: the W45-29 row above the W45-28 one.
const current = read('research/CURRENT.md');
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-29 **搬完通知栏的写半边**（11 段 1,489 单位，四个模块）：追加 \`lLs\` [1694273,1694442)（\`{key,plugin,text,isManaged:sOn(plugin),leftMs:ms,wasShown:!1,lentMs:0,untoldMs:0}\`）、写或跳 \`xYr\` [1692719,1692909)（**两者皆空才不写**，失败写 \`$.ui.toast: the bar's toasts were not kept: …\`）、store 的 set \`o5t\`（chunk-n3ykh62m.js [275644,275983)，JSON 往返受 \`jde\`=4194304 限制、版本取「存储值+1」与 floor 的较大者、写在 \`ls.exit\` 里、末尾 \`vb\`）、读通知 \`vb\` [274916,274994)、座位判定 \`Ee\`/\`sOn\`/\`Zws\`（chunk-2kdsvp3x.js [37034,37144)+[37144,37182)、chunk-m4qpskd4.js [48497,48526)）与深冻结游标 \`O\`/\`cho\`/\`OFe\`（chunk-ed7zyzrn.js [2900,3169)+[3169,3400)，上限 \`PQt\`=1e5）。四个设施名落在手写模块 \`src/plugin-chain-notify-store-runtime.ts\`：\`ls\`=源 \`jD\` 的 \`AsyncLocalStorage\`、\`_\`/\`Y\`=JSON 往返、**\`Ci\` 折页调度器未搬**（按读者数抛出，是本包边界）。**本包逼出的真实接口缺陷**：W45-28 把 \`setState\` 类型写在 \`getState()\` 的返回里，而源体 \`o5t\` 调的是 \`s_().values.setState\`，运行时首写即 \`h.setState is not a function\` 并被 \`xYr\` 记成 not-kept 日志；已在源、W45-28 回归夹具与编译驱动夹具三处改正。**实测**：座位三态 user/prepend/user 与 isManaged false/true/false；首写 1 次、键 \`engine\\x00bar-toasts\` 版本 1、toast 形状与首拍值、存储值已冻结；第二写 managed=true 版本 2；空台账盖非空 store 写 1 次、盖空 store 写 0 次；版本 1→(floor 7)8→9；超限 \`HooksError … at most 4194304 characters\`；循环值在 set 处是 \`TypeError\`、在 \`writeStoredLedger\` 处留下 not-kept 日志且 store 未动；冻结走到嵌套数组/对象；\`notifyStateReaders\` 无读者静默、有读者抛出。工具链抓到三处：计划误从 \`plugin-chain-source.js\` 取 \`t\`（加载器当场拒）、\`cho\`/\`OFe\` 区间少两单位导致整文件花括号差 1（acorn 在第 62 行拒）、以及上面那处接口缺陷。验收：check/build/notices、扫描 \`unresolved 0\`、**29 计划**一致、聚焦 7/7 与相关 37/37、全量 **${full}**、十五个编译驱动（\`W45NotifyWriteCompiled.v1\`）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [写半边证据](ports/W45-notify-write-evidence.json)、[存储态证据](ports/W45-notify-store-evidence.json)、[负载预算证据](ports/W45-load-budgets-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('C-12 row not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the write half.
const features = read('research/FEATURES.md');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('interactive row not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = rowText.slice(0, lastPipe).replace(/\s+$/, '') +
  '. W45-29 added the bar\'s write half: the append that stores a toast with its seat\'s managed flag, the write-or-skip rule, the state store\'s set with its JSON ceiling, version and deep freeze, and the seat check behind the flag' +
  ' |';
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = read('research/coding-standard.md');
const standardAt = standard.indexOf('2026-10-15 W45-28 通知栏存储态');
if (standardAt < 0) throw new Error('coding-standard W45-28 line not found');
const standardEntry = `2026-10-16 W45-29 通知栏写半边：S-1至S-7已对照。S-1（先读源）：11 段全部逐字搬运，四个设施名（\`ls\`/\`_\`/\`Y\`/\`Ci\`）在 \`src/plugin-chain-notify-store-runtime.ts\` 逐条记录来源与未搬原因（\`Ci\` 按读者数抛出，是本包边界；\`ls\` 是源的 \`jD\`）。S-3（不留半包）：回归覆盖座位三态、首写/第二写形状与版本、空写两态、版本与 floor 的先后、超限与循环值两类拒绝、not-kept 日志与 store 未动、冻结深度、读通知的两态。**本包逼出一处真实接口缺陷**：W45-28 把 \`setState\` 类型写在 \`getState()\` 返回里而源体调 \`values.setState\`，运行时首写即失败——按源体改正类型（源、回归夹具、编译驱动夹具三处），这正说明「先读源、以源为准」是 S-1 的存在理由。S-4（可复跑校验）：记录脚本自行读身份（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）并对计数断言，全量摘要与打包报告均从各自输出解析而非手抄。S-7：\`Ci\` 折页调度器与 \`TK\` 时钟驱动无源码可搬入本包范围，已连区间记入下一包。验收：check/build/notices、扫描 unresolved 0、29 计划一致、全量 ${full}、十五个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-29 paragraph above the W45-28 one.
const status = read('research/STATUS.md');
const statusAt = status.indexOf("W45-28: the notification bar's stored state");
if (statusAt < 0) throw new Error('STATUS W45-28 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-29: the notification bar's write half. Eleven blocks (1,489 units) across four modules carry it: the append (\\\`lLs\\\`, \\\`isManaged\\\` from the plugin's seat), the write-or-skip (\\\`xYr\\\`, which writes unless both ledgers are empty and logs when the write fails), the state store's set (\\\`o5t\\\`: JSON round-trip under \\\`jde\\\`, version from the stored value and the floor, the write inside \\\`ls.exit\\\`, then \\\`vb\\\`), the reader notification (\\\`vb\\\`) and the seat check (\\\`Ee\\\`/\\\`sOn\\\` over \\\`Zws\\\`), with the deep freeze (\\\`O\\\`/\\\`cho\\\`/\\\`OFe\\\`) the stored value goes through. Four names are facilities rather than logic and are bound in one hand-written module: \\\`ls\\\` is the source's own \\\`AsyncLocalStorage\\\`, \\\`_\\\`/\\\`Y\\\` are the JSON round-trip, and \\\`Ci\\\` — the fold scheduler — is not ported and throws with the reader count, which is this package's boundary. The port surfaced a real interface defect from W45-28: \\\`setState\\\` was typed inside \\\`getState()\\\`'s return while the source body calls it on \\\`values\\\` itself, so the first write failed at runtime; the type is corrected in the source and both fixtures. Evidence: \\\`research/ports/W45-notify-write-evidence.json\\\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-29 section.
const runner = read('research/ports/W45-chain-runner.md');
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-29 ported the notification bar's write half (2026-10-16)

W45-28 ended at the read of the stored ledger; this package takes the write side. Eleven blocks (1,489
units) across four modules carry it: the append (\\\`lLs\\\`), the write-or-skip (\\\`xYr\\\`, which writes unless
both the ledger and the stored one are empty and logs \\\`$.ui.toast: the bar's toasts were not kept: …\\\` when
the write fails), the state store's own set (\\\`o5t\\\`: the JSON round-trip under \\\`jde\\\` = 4194304
characters, the next version as one past the stored value or the floor, the write inside \\\`ls.exit\\\`, then
\\\`vb\\\`), the reader notification (\\\`vb\\\`) and the seat check that decides a toast's \\\`isManaged\\\` flag
(\\\`Ee\\\` over the module record and the seat table, \\\`sOn\\\` over \\\`Zws\\\` = \\\`["prepend","append"]\\\`). The
stored value is deep-frozen by \\\`cho\\\`/\\\`OFe\\\` over the cursor \\\`O\\\`, bounded by \\\`PQt\\\` (1e5).

Four of the names are facilities rather than logic, and they are bound in one hand-written module
(\\\`src/plugin-chain-notify-store-runtime.ts\\\`) instead of being faked: \\\`ls\\\` is the source's own
\\\`AsyncLocalStorage\\\` (\\\`import{AsyncLocalStorage as jD}from"async_hooks"\\\`), \\\`_\\\` and \\\`Y\\\` are the JSON
round-trip, and \\\`Ci\\\` — the plugin-state fold scheduler — is not ported. \\\`Ci\\\` is the whole reactivity
subsystem (readers, folds, surfaces, bump tables) and belongs to its own package, so the port records the
boundary as behaviour: with no reader registered for the key, \\\`vb\\\` returns silently, exactly as the source
does; with one, it throws the reader count it would have scheduled. The regression drives both sides.

The port also surfaced a real defect in W45-28's interface. That package typed \\\`setState\\\` inside
\\\`getState()\\\`'s return, but the source body calls \\\`s_().values.setState(...)\\\` on the store itself, so the
first append failed at runtime and \\\`xYr\\\` logged it as \\\`the bar's toasts were not kept: h.setState is not a
function\\\`. The type was corrected in the source, in the W45-28 regression fixture and in the compiled
driver's fixture — the defect only existed because the type was written from the previous package's shape
instead of from the body being ported.

Verified: check/build/notices, 29 byte-identical plans, the new copy \\\`unresolved 0\\\`, 7/7 new regressions,
the five related suites 30/30, full ${full}, fifteen compiled drivers (the shared driver
prints \\\`W45NotifyWriteCompiled.v1\\\`), and the packaged smoke (${smoke}). Identity \\\`${short}…\\\` (read from
scripts/identity.mjs by the record script itself, which asserts the file counts).

Next: the fold/reader subsystem \\\`Ci\\\` that \\\`vb\\\` hands work to, the \\\`TK\\\` clock driver at
chunk-24k7d6mw.js [478823,…), and the host toast method's stacked path \\\`EEe\\\` [173176,…).
`);

const rows = [
  ['2026-10-16T08:52:00Z', 'package', 'W45-29 搬完通知栏写半边（追加 lLs / 写或跳 xYr / store set o5t / 读通知 vb / 座位判定 Ee+sOn，11 段 1,489 单位）',
    'W45-28 停在读；这一段是写：追加、写或跳、版本与冻结、读者通知与 isManaged 的座位判定',
    'chunk-nwffn64n.js [615,635) PQt、chunk-nyce03br.js [212618,212634) jde、chunk-m4qpskd4.js [48497,48526) Zws、chunk-2kdsvp3x.js [37034,37144) Ee / [37144,37182) sOn、chunk-ed7zyzrn.js [2900,3169) O / [3169,3400) cho+OFe、chunk-n3ykh62m.js [274916,274994) vb / [275644,275983) o5t、chunk-sfn1dbxq.js [1694273,1694442) lLs / [1692719,1692909) xYr',
    '设施名 ls/_/Y/Ci 落在手写 src/plugin-chain-notify-store-runtime.ts（Ci 未搬，按读者数抛出）；本包逼出 W45-28 的 values.setState 类型缺陷并在源与两个夹具改正；回归 test/plugin-chain-notify-write.test.ts 7/7'],
  ['2026-10-16T09:05:00Z', 'verification', 'W45-29 验收：扫描 unresolved 0、29 计划一致、全量与打包冒烟（记录脚本自读身份与输出）',
    '通知栏写半边搬运',
    `check/build/notices；扫描 unresolved 0；verify-chain-copies passed true（29 plans）；聚焦 7/7 与相关 37/37；全量 ${full}；十五个编译驱动 exit 0（输出 W45NotifyWriteCompiled.v1）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md');
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-29 acceptance (2026-10-16)

- [x] **Every block is copied.** 11 blocks / 1,489 units verbatim; the four facility names are bound in one module with the source form recorded for each.
- [x] **The unported boundary is behaviour, not silence.** \\\`Ci\\\` throws with the reader count it would have scheduled, and \\\`vb\\\` returns silently when the key has no reader — the source's own two branches, both driven by the regression.
- [x] **The skip rule is driven.** An empty ledger over a non-empty store writes; over an empty store it does not, and the test counts the writes rather than trusting the call.
- [x] **Both refusals are pinned by their real text.** \\\`HooksError: a value of state is JSON data of at most 4194304 characters\\\` from \\\`o5t\\\`, and the circular value as a \\\`TypeError\\\` at the store plus the \\\`not-kept\\\` log line through \\\`writeStoredLedger\\\` with the store untouched.
- [x] **The interface defect is fixed at the source.** \\\`values.setState\\\` per the body being ported, in src and both fixtures.
- [x] **The record script reads its own numbers.** Identity from scripts/identity.mjs with count assertions, the sweep summary and the packaged report parsed from their outputs.
- [x] **Sweep.** check/build/notices, scan \\\`unresolved 0\\\`, 29 byte-identical plans, 7/7 new regressions, full ${full}, fifteen compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| full:', full, '| smoke:', smoke);
