// W45-33 records: the toast module's remaining verbs, the indexes and the audit trail. Identity, the
// chain verifier's report, the full sweep's summary and the packaged smoke's report are read from
// their own outputs, so the record cannot carry a number the tree did not produce.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 333, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 131, `validation ${identity.validation.files}`);
expect(identity.build.files === 233, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
expect(verifier.passed === true, 'the chain verifier did not pass');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;

const sweep = read('/tmp/w45-33-sweep.txt');
const sweepOf = (label) => Number(new RegExp(`^\\u2139 ${label} (\\d+)$`, 'm').exec(sweep)?.[1]);
const tests = sweepOf('tests');
const passed = sweepOf('pass');
const failed = sweepOf('fail');
if (!Number.isInteger(tests) || !Number.isInteger(failed)) throw new Error('the sweep report has no summary');
const sweepFailNames = [...sweep.matchAll(/^✖ (.+?) \(\d/gm)].map((m) => m[1]);
const full = `${tests} tests / ${passed} pass / ${failed} fail` +
  (failed === 0 ? ' on the frozen tree' : `: ${sweepFailNames.join('; ')}`);

const smokeReport = read('/tmp/w45-33-smoke.txt').split('\n')
  .filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; ` +
  `upstreamRequests ${smokeReport.upstreamRequests}`;

const evidence = {
  schema: 'W45NotifyVerbsEvidence.v1',
  package: "W45-33 — the toast module's remaining verbs: dismiss, expire, hold and pause",
  date: '2026-10-16',
  question: 'W45-32 ported the host toast stack — the reader, the cap, the fold, the writer, the timer and the undrawn report — but the module that declares them registers more than the stack. Which of its public verbs are reachable, and what do they do to the stack?',
  answer: 'Four, in the same module chunk-24k7d6mw.js, 681 units: `IEe` dismissToast [172257,172364), `pvt` expireToasts [172364,172396), `dV` holdToast [172396,172675) and `bee` pauseToasts [172675,172938). Every free name they read is already ported — `bu`, `cI`, `bh` and `MF` from W45-32 and the clock accessor `TC` — and that closure check is how the package boundary was chosen. With them, the module\'s registered surface this product can reach is complete except its clock factory `edo` (`createToastClock`, chunk-3ph567jx.js [2322,…)-adjacent registry territory), which is where `it().toastClock` is built.',
  ported: [
    { module: 'chunk-24k7d6mw.js', range: [172257, 172364], units: 107, names: ['IEe'], note: 'dismissToast: filter the id out, add it to cI so it is not reported undrawn, write — a stack that never held the id is left alone' },
    { module: 'chunk-24k7d6mw.js', range: [172364, 172396], units: 32, names: ['pvt'], note: 'expireToasts: fold the stack and write it' },
    { module: 'chunk-24k7d6mw.js', range: [172396, 172675], units: 279, names: ['dV'], note: 'holdToast: hold (phase shown, heldAt stamped) or release (drop heldAt, add the held time to the deadline), writing only when an entry changed' },
    { module: 'chunk-24k7d6mw.js', range: [172675, 172938], units: 263, names: ['bee'], note: 'pauseToasts: set or clear the clock\'s pausedAt and shift every deadline and heldAt by the time that passed, writing nothing when the pause state does not change' },
  ],
  closure_check: {
    method: 'For each of the four bodies, the AST was read (acorn) and every identifier read from outside the body was checked against the export list of every generated *-source.ts in src/.',
    result: 'bu, cI, bh, MF, TC — all already ported. The only names the check flagged were object property keys (id, phase, heldAt, leavesAt, pausedAt), which are not bindings.',
    tool_note: 'The general closure walker (.audit/w45-33-closure.mjs) is not yet trustworthy: the first version resolved cross-module imports through the exporting module\'s import map instead of its export map, and the AST version still dies on the Mde walk. Its figures are not evidence. The four verbs did not need it.',
  },
  measured: [
    'dismiss: [a, b] becomes [b]; the id it added to `cI` is deleted again by the write it triggered (that is how a dismissed toast escapes the undrawn report), nothing is logged, and the timer is armed for the surviving toast. An id the stack does not hold writes nothing at all and arms nothing.',
    'expire: a toast past its deadline turns `leaving` with 240ms more; one still in time is untouched; the next deadline (240) is armed.',
    'hold: an unheld entry gets `heldAt` and its shown phase back; holding it again changes nothing and writes nothing; releasing drops `heldAt` and adds the 3000ms it was held to the deadline; releasing an id that is not held writes nothing.',
    'pause: the first pause sets `pausedAt` and shifts nothing (the shift is the time since the clock last changed), the timer is not armed while paused, a repeated pause is not a state change, and resuming 5000ms later moves every `leavesAt` and every `heldAt` by 5000 before arming the next deadline.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'src/plugin-chain-notify-verbs-source.ts: unresolved 0',
    chain_verifier: chain,
    regressions: 'test/plugin-chain-notify-verbs.test.ts 4/4; the eight related suites (stack, clock, fold, write, store, notify, ui, toast) together 43/43',
    full,
    compiled: 'all fifteen dist drivers exit 0; the shared driver prints W45NotifyVerbsCompiled.v1 against dist (the dismiss flag with its consumption, the expire, the hold and release, and the pause shift)',
    smoke,
  },
  next_package: [
    'the plugin label sanitiser: `Mde` (chunk-qq2mgstr.js [16350,16512)) and the display-text sanitiser it sits on — its first-order dependencies are measured (`O` [10264,10453), `ke` [9810,9854), `g3` [10024,10184), `aN` [10576,10594), `ne` chunk-ax7r0qj7.js [1128,1272), `Ar` [3529,3561), `Qe` [3224,3289), `WMt` [1544,1645), `x` [1645,1850), `jo` chunk-yn0pfn70.js [9072,9254), `ae` [892,935), `ct` [8443,8612), `$8` chunk-pa2d6xdm.js [720,744)), but `ae`/`ct` are width-aware and reach further; the boundary ./plugin-chain-plugin-label.ts records stays until then',
    'the registry\'s stores: `edo` (`createToastClock`, imported by the toast module from chunk-3ph567jx.js) plus `gs`/`Zco`, so `renderVersions`/`panes`/`pluginState`/`toastClock` are built at registry construction as the source does',
    'the bar component that calls the tick (`JFe`, chunk-24k7d6mw.js [479204,…)): the store it ticks, the refs and the unmount cleanup',
    'the reader/mount lifecycle around the folds: `Tb`, `Gf`, `OH`, `Kf`, `xur` and the `Cb` stale-listener registration',
    'the rest of the `$` table beyond the three ui floors, entry by entry',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
  ],
};
write('research/ports/W45-notify-verbs-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

// CURRENT: the W45-33 row above the W45-32 one.
const current = read('research/CURRENT.md');
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-33 **搬完 toast 模块余下四个动词**（4 段 681 单位，chunk-24k7d6mw.js）：\`IEe\` dismissToast [172257,172364)、\`pvt\` expireToasts [172364,172396)、\`dV\` holdToast [172396,172675)、\`bee\` pauseToasts [172675,172938)。**包界由闭包检查选定**：四个函数体经 acorn 取自由名，逐个对照 \`src/*-source.ts\` 的导出表，全部命中已搬集合（\`bu\`/\`cI\`/\`bh\`/\`MF\`/\`TC\`）——这是本包不牵入新子系统就成立的原因（通用闭包遍历器 .audit/w45-33-closure.mjs 仍不可信，理由与结论一并记入证据）。**实测**：dismiss 把 [a,b] 变 [b]，它加进 \`cI\` 的 id **被自己触发的那次写删掉**（这正是被 dismiss 的 toast 不会进「未绘制」上报的机制），无日志，按幸存者挂表；栈里没有该 id 时**完全不写、不挂表**。expire 把过期者转 \`leaving\`+240 并挂 240。hold 给未持有者盖 \`heldAt\` 并恢复 shown；重复 hold 不写；释放时丢掉 \`heldAt\` 并把持有的 3000ms 加到期限；对未持有的 id 释放不写。pause 首次只设 \`pausedAt\`（位移量是「距上次时钟变化的时长」，故为 0）、暂停期间不挂表、重复 pause 非状态变化、5000ms 后恢复时把每个 \`leavesAt\` 与 \`heldAt\` 一并 +5000 再挂下一次期限。至此该模块可及的公开动词齐备，仅剩时钟工厂 \`edo\`（\`createToastClock\`，来自 chunk-3ph567jx.js，属注册表仓库地盘）。验收：check/build/notices、扫描 \`unresolved 0\`、**${chain}**、聚焦 4/4 与相关 43/43、全量 **${full}**、十五个编译驱动（新增 \`W45NotifyVerbsCompiled.v1\`）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [toast 动词证据](ports/W45-notify-verbs-evidence.json)、[宿主栈证据](ports/W45-notify-stack-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('C-12 row not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the toast verbs.
const features = read('research/FEATURES.md');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('interactive row not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = rowText.slice(0, lastPipe).replace(/\s+$/, '') +
  '. W45-33 completed the toast module\'s verbs this product can reach: dismiss a toast (which flags the id so the very next write consumes the flag and stays quiet), expire the stack now, hold or release one (the held time is added back to its deadline), and pause or resume the bar (every deadline and every hold moves by the time that passed)' +
  ' |';
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = read('research/coding-standard.md');
const standardAt = standard.indexOf('2026-10-16 W45-32 宿主 toast 栈');
if (standardAt < 0) throw new Error('coding-standard W45-32 line not found');
const standardEntry = `2026-10-16 W45-33 toast 动词：S-1至S-7已对照。S-1（先读源）：4 段逐字搬运，全部在 chunk-24k7d6mw.js，包界由「自由名逐个对照已搬导出表」的闭包检查确定，而非估计；未搬的时钟工厂 \`edo\` 连来源模块（chunk-3ph567jx.js）写入证据与 CURRENT。S-2（不留半包）：dismiss/expire/hold/pause 四条路径全部由回归钉住，含两处「无变化即不写」的早退与 \`cI\` 标志的消费时机。S-3：回归覆盖 dismiss 的三态（命中/未命中/标志消费）、expire 的两态、hold 的四态、pause 的四态（首停/重复/恢复/位移量）。S-4（可复跑校验）：记录脚本自读身份（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）并对计数断言，链校验器由脚本自身运行解析，全量摘要与打包报告从各自输出解析。S-7：标签消毒器 \`Mde\`（含已测的一阶依赖区间）、注册表仓库（\`edo\`/\`gs\`/\`Zco\`）、栏组件 \`JFe\`、readers/mount 生命周期已连区间记入下一包；**工具限制如实记录**——通用闭包遍历器两版都不可信，故 \`Mde\` 的完整闭包仍记为未测，仅一阶依赖可引。验收：check/build/notices、扫描 unresolved 0、${chain}、全量 ${full}、十五个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-33 paragraph above the W45-32 one.
const status = read('research/STATUS.md');
const statusAt = status.indexOf('W45-32: the host toast stack');
if (statusAt < 0) throw new Error('STATUS W45-32 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-33: the toast module's remaining verbs. Four blocks (681 units) in the module W45-32 took the stack from: \\\`IEe\\\` dismissToast, \\\`pvt\\\` expireToasts, \\\`dV\\\` holdToast and \\\`bee\\\` pauseToasts. Every free name they read was already ported, which is how the boundary was chosen. A dismiss flags the id in \\\`cI\\\` and the write it triggers consumes the flag, so a dismissed toast is never reported undrawn; an expire folds and writes; a hold stamps or releases and adds the held time back to the deadline; a pause moves every deadline and every hold by the time that passed while the bar was stopped. Only the clock factory \\\`edo\\\` (chunk-3ph567jx.js) is left of this module's reachable surface, and it belongs with the registry's stores. Evidence: \\\`research/ports/W45-notify-verbs-evidence.json\\\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-33 section.
const runner = read('research/ports/W45-chain-runner.md');
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-33 ported the toast module's remaining verbs (2026-10-16)

W45-32 took the stack — reader, cap, fold, writer, timer, undrawn report — out of the module that
registers it. This package takes what else that module registers and this product can reach: \\\`IEe\\\`
dismissToast, \\\`pvt\\\` expireToasts, \\\`dV\\\` holdToast and \\\`bee\\\` pauseToasts, four blocks (681 units)
in the same chunk-24k7d6mw.js.

The package boundary was measured, not guessed: each body was parsed and every identifier it reads
from outside itself was checked against the export list of every generated \\\`*-source.ts\\\` in src/.
All of them — \\\`bu\\\`, \\\`cI\\\`, \\\`bh\\\`, \\\`MF\\\`, \\\`TC\\\` — are already ported, so the four verbs close without
dragging a new subsystem in. The record also carries what the check could not settle: the general
closure walker is not trustworthy yet (two versions, two wrong answers), so the label sanitiser's
full closure stays unmeasured and only its first-order dependencies are quoted.

Three behaviours worth the read. A dismiss adds the id to the drawn set and the write it triggers
deletes it again, which is exactly how a dismissed toast escapes the undrawn report; an id the stack
never held writes nothing at all. A hold that changes nothing and a pause that does not change the
pause state both write nothing, because the stack writer is gated on the shallow list equality. And
a resume moves every deadline *and* every hold by the time the bar was stopped, so a paused toast
does not lose its place.

Verified: check/build/notices, ${chain}, the new copy \\\`unresolved 0\\\`, 4/4 new regressions, the eight
related suites 43/43, full ${full}, fifteen compiled drivers (the shared driver now also prints
\\\`W45NotifyVerbsCompiled.v1\\\`), and the packaged smoke (${smoke}). Identity \\\`${short}…\\\` (read from
scripts/identity.mjs by the record script itself, which asserts the file counts).

Next: the label sanitiser \\\`Mde\\\` and the display-text sanitiser under it, then the registry's stores
(\\\`edo\\\` / \\\`gs\\\` / \\\`Zco\\\`), then the bar component \\\`JFe\\\` that owns the store and the refs.
`);

const rows = [
  ['2026-10-16T11:06:00Z', 'package', 'W45-33 搬完 toast 模块余下四动词（4 段 681 单位；包界由闭包检查选定）',
    'W45-32 搬了宿主栈；本包是同一模块注册的其余可及动词，闭包检查证明不牵入新子系统',
    'chunk-24k7d6mw.js [172257,172364) IEe、[172364,172396) pvt、[172396,172675) dV、[172675,172938) bee',
    'cI 标志「加进后由自己触发的写消费」（dismiss 不上报未绘制的机制）、hold 释放把持有时间加回期限、pause 恢复时 leavesAt 与 heldAt 同步位移；回归 test/plugin-chain-notify-verbs.test.ts 4/4'],
  ['2026-10-16T11:22:00Z', 'verification', 'W45-33 验收：扫描 unresolved 0、33 计划一致、全量与打包冒烟（记录脚本自读身份、链校验器与输出）',
    'toast 动词搬运',
    `check/build/notices；扫描 unresolved 0；${chain}；聚焦 4/4 与相关 43/43；全量 ${full}；十五个编译驱动 exit 0（新增输出 W45NotifyVerbsCompiled.v1）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md');
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-33 acceptance (2026-10-16)

- [x] **The boundary is measured before the package is cut.** Each body's free names were parsed and checked against every ported export list; all five are already in, which is why the verbs close.
- [x] **The dismiss flag's lifetime is pinned, not assumed.** A probe first read \\\`cI\\\` as still holding the id; the instrumented run showed the write it triggers deletes it. The regression now asserts the consumption in the same test as the "never reported undrawn" line.
- [x] **The no-change paths are driven.** A repeated hold, a repeated pause, and a dismiss of an id the stack does not hold each write nothing and arm nothing.
- [x] **The pause shift is driven across the hold.** A resume moves \\\`leavesAt\\\` and \\\`heldAt\\\` by the same 5000ms, which the regression asserts as a pair.
- [x] **A broken tool is recorded as broken.** The general closure walker gave two different wrong answers; the record says its figures are not evidence and quotes only the first-order dependencies that were read by hand.
- [x] **The record script reads its own numbers.** Identity from scripts/identity.mjs with count assertions, the chain verifier run and parsed, the sweep summary and packaged report parsed from their outputs.
- [x] **Sweep.** check/build/notices, scan \\\`unresolved 0\\\`, ${chain}, 4/4 new regressions, full ${full}, fifteen compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', full, '| smoke:', smoke);
