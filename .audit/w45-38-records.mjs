// Write the W45-38 package record from the artifacts themselves: the bar's mount layer, the two
// bodies it copies, and the four already-ported bodies it reuses.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 347, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 134, `validation ${identity.validation.files}`);
expect(identity.build.files === 241, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 39) throw new Error('the chain verifier did not pass 39 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const barMount = verifier.files.find((file) => file.product.endsWith('plugin-chain-bar-mount-source.ts'));
if (!barMount || barMount.blocks !== 2) throw new Error('the bar-mount copy is not the 2-block one');

/** The two copied bodies, read back out of the ledger the generator wrote. */
const ledger = JSON.parse(read('src/plugin-chain-bar-mount-source-blocks.json'));
if (ledger.blocks.length !== 2) throw new Error('the bar-mount ledger does not hold two blocks');
const scan = execFileSync(process.execPath, ['scripts/source-undeclared-scan.mjs', 'src/plugin-chain-bar-mount-source.ts'], { encoding: 'utf8' });
if (!/unresolved 0/.test(scan)) throw new Error('the bar-mount copy has unresolved names');
/** The copy scanner parses minified JS, so it does not apply to the hand-written seam: that file's
 *  gates are `npm run check` and its regression. */
const seamScan = 'not applicable — src/plugin-chain-bar-mount.ts is the hand-written seam, not a copied file; it is covered by `npm run check` and test/plugin-chain-bar-mount.test.ts';

/** The four bodies this package reuses, each asserted where it already lives as a copied declaration. */
const reused = [
  ['TK', 'src/plugin-chain-notify-clock-source.ts', 'function TK(h)', 'the tick the mount runs (W45-31)'],
  ['Cj', 'src/plugin-chain-notify-clock-source.ts', 'function Cj(o)', 'the hidden test the second selector is (W45-31)'],
  ['SEt', 'src/plugin-chain-notify-store-source.ts', 'function SEt(e=s_().values.getState())', 'the stored-ledger read behind `storedToastKeys` (W45-28)'],
  ['RYr', 'src/plugin-chain-notify-source.ts', 'RYr', 'the empty frozen ledger `createBarClockDriver` starts from (W45-28)'],
].map(([name, file, needle, why]) => {
  if (!read(file).includes(needle)) throw new Error(`${name} is not declared in ${file}`);
  return { name, already_copied_in: file, why };
});

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^\\u2139 ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const first = summary('.audit/w45-38-full.txt');
const second = fs.existsSync('/tmp/w45-38-sweep2.txt') ? summary('/tmp/w45-38-sweep2.txt') : null;
const clean = second ?? first;
if (!Number.isInteger(clean.tests) || clean.failed !== 0) throw new Error('no clean full-sweep summary');
const flakeNames = [...new Set([...first.text.matchAll(/^✖ (.+?) \(\d/gm)].map((m) => m[1]))];
const flake = first.failed === 0
  ? 'the full sweep was clean on its first run at --test-concurrency=4'
  : `the first sweep at the same --test-concurrency=4 failed ${first.failed} of ${first.tests} in ${flakeNames.length} fixture(s) (${flakeNames.join('; ')}); the re-run is ${second ? `${second.tests}/${second.passed}` : 'missing'}`;
const full = `${clean.tests} tests / ${clean.passed} pass / ${clean.failed} fail on the frozen tree`;

const smokeOutput = execFileSync(process.execPath, ['scripts/smoke-package.mjs'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const smokeReport = smokeOutput.split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const driverMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  driverMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
if (!driverMarkers.includes('W45BarMountCompiled.v1')) throw new Error('the shared driver did not print the W45-38 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45BarMountCompiled.v1 (${driverMarkers.length} markers in all: it mounts the effect against dist, re-runs it over the driver's ledger, reads the pane hold and the pane state)`;

const probe = read('.audit/w45-38-probe.mts') && execFileSync('npx', ['tsx', '.audit/w45-38-probe.mts'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const probeLine = (needle) => probe.split('\n').find((line) => line.startsWith(needle)) ?? '';
for (const needle of ['after mount armed', 're-run cancelled', 'pane hold shown holds', 'hold raised flag']) {
  if (!probeLine(needle)) throw new Error(`the probe did not print ${needle}`);
}

const evidence = {
  schema: 'W45BarMountEvidence.v1',
  package: 'W45-38 — the bar\'s mount layer: the effect the bar component mounts over the clock tick, its dependency array, and the pane hold',
  date: '2026-10-16',
  question: 'W45-31 ported the tick `TK` and W45-28 the ledger it reads and writes, but nothing in the product mounted it: the effect lives in the bar component `JFe`, which reads a clock context, a store hook and two refs and re-runs on a five-member dependency array. What of that is body, what is the host\'s, and is anything left to copy?',
  answer: 'The effect body is one line — `TK({clock, store, pending, last})` and `() => M.current?.()` on cleanup — and everything it needs is already ported: `TK` and the hidden test `Cj` (W45-31), `SEt`/`RYr` (W45-28). Two bodies were still uncopied and are now copied verbatim: `YAt` and `gro` (chunk-tvdq3hrk.js [7622,7723), 2 blocks, 101 units), the show-the-shown-pane read the pane hold selects with. The rest is the host\'s: the React subscription (`on` = the clock context, `kr` = the store handle, `V` = a selector over it, `Re` = useSyncExternalStoreWithSelector, `P` = useEffect, `R` = useRef) and the queue drain `processQueue`, which belongs to the notification context `vo` (chunk-356hrhz3.js [1735,5205), 3,470 units — it owns `addNotification` and `removeNotification` too and is the next package on the queue). The seam therefore keeps each body\'s logic and takes the host layers as parameters: the two selectors\' joined keys, React\'s `Object.is` comparison as a function, the driver\'s two refs, and `XFe`\'s raise/clear-and-drain pair.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  reused: {
    bodies: reused,
    why: 'Copying `TK`, `Cj`, `SEt` or `RYr` a second time would put two ticks, two ledger readers or two empty ledgers in the product. This package declares none of them: it imports the seams that already wrap them (./plugin-chain-notify-clock.ts, ./plugin-chain-notify.ts) and the store copy, and the record script asserts each declaration where it already lives.',
    measured: [
      'src/plugin-chain-notify-clock-source.ts declares `function TK(h)` and `function Cj(o)`',
      'src/plugin-chain-notify-store-source.ts declares `function SEt(e=s_().values.getState())`',
      'src/plugin-chain-notify-source.ts declares the frozen `RYr`',
    ],
  },
  copies: {
    product: ['src/plugin-chain-bar-mount-source.ts', 'src/plugin-chain-bar-mount.ts'],
    detail: `plugin-chain-bar-mount-source.ts ${barMount.blocks} blocks / ${barMount.units} units; the seam adds no copied block`,
    seam: 'src/plugin-chain-bar-mount.ts re-exports none of the copied bodies as new behaviour: `readPaneHold` is `gro` with a named state type, and the three tick-side functions are the source\'s own expressions (the two selectors, the refs, the effect and its cleanup).',
  },
  measured: [
    'The two keys are the joined keys the source joins: `barNotificationKeys` is `"a b c"` for a current and a two-deep queue, `" a"` when the current slot is empty (the empty string `join` gives `undefined`) and `""` when the bar has nothing.',
    '`storedToastKeys` reads the same entry `readStoredLedger` does: after two appends it is `"plugin-toast-1:fixture-p plugin-toast-2:fixture-p"`, and the regression asserts it equals the ledger reader\'s own key list.',
    'The effect runs on mount and again only when one of the five members changes: `barClockDriverChanged(null, deps)` is true, the same five values are false, and each of a new clock, a new store, different notification keys, a different hidden flag and different stored keys is true — `Object.is` per member, which is React\'s own comparison.',
    `Mounting ticks once and writes the ledger: the probe prints \`${probeLine('after mount armed')}\`, and \`readStoredLedger()\` equals the driver\'s ledger. The cleanup is \`() => M.current?.()\`: cancelling after the mount gives \`[1500]\`, and the mounted bar had cancelled nothing before it.`,
    `A dependency change re-runs the effect with the same driver, so the ledger carries across: the probe prints \`${probeLine('re-run cancelled')}\` for the re-run, because the source never clears the ref — the canceller the cleanup ran is called again by the next tick, and \`clearTimeout\` on it is a no-op.`,
    'The pane read is the shown pane only while its placements hold toasts: `{placements: 2, open: [{id: "a", holdToasts: true}], shownId: "a"}` is true, no placements is false, a *different* pane holding is false, and a `shownId` nothing is open under is false.',
    `The hold is raised on the way in and cleared, then drained, on the way out: a bar with no hold writes nothing and drains nothing; a raised hold sets \`paneHoldsToasts\` (and \`isBarHidden\` then answers true, which is \`he\` in the dependency array, so the clock effect re-runs); the release clears the flag first and calls the drain once. An updater handed a state that already carries the flag returns that same object, as the source\'s \`L\` does.`,
    `The probe prints \`${probeLine('hold raised flag')}\` and \`${probeLine('pane hold shown holds')}\` for the two above.`,
  ],
  behaviour_changed: [
    'The bar\'s mount layer is now a product surface: `createBarClockDriver` + `mountBarClockDriver` give a host the effect `JFe` mounts, `barClockDriverChanged` gives it React\'s re-run decision, and `holdPaneToasts` gives it `XFe`\'s raise/clear-and-drain pair, so a host with no React can drive the ported tick the way the source drives it.',
    'Two bodies left the unported set and are copied verbatim: `YAt` and `gro`, the shown-pane read behind the hold. Nothing about the tick itself was rewritten.',
    'No product file changed behaviour on another path: the seam is additive, and the only edit outside it is the verifier registering the new plan and the shared driver printing its marker.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'the new copy: unresolved 0',
    seam_scan: seamScan.trim().split('\n').at(-1),
    chain_verifier: chain,
    copy: `plugin-chain-bar-mount-source.ts ${barMount.blocks} blocks / ${barMount.units} units, chunk-tvdq3hrk.js, registered in scripts/verify-chain-copies.mjs`,
    regressions: 'the new mount suite 9/9; the whole chain family (test/plugin-chain-*.test.ts) 124/124',
    flake,
    full,
    compiled: driverLine,
    smoke,
  },
  next_package: [
    'the notification queue owner `vo` (chunk-356hrhz3.js [1735,5205), 3,470 units): `processQueue`, `addNotification` with its timeout and fold handling, `removeNotification` and the mount count — the host boundary this package hands the drain to',
    'the reader/mount lifecycle around the folds: `Tb`, `Gf`, `OH`, `Kf`, `xur` and the `Cb` stale-listener registration',
    'the rest of the `$` table beyond the three ui floors, entry by entry',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
    'the registry fields the source\'s literal carries but no ported body reads yet (the hook registry, the marketplaces, the command-producer memos)',
  ],
};
write('research/ports/W45-bar-mount-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

// CURRENT: the W45-38 row above the W45-37 one.
const current = read('research/CURRENT.md');
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-38 **搬栏位挂载层，把已搬运的时钟滴答接上宿主**（新副本 2 段 101 单位；seam 不含新搬运块）：源里挂载它的是栏组件 \`JFe\`（chunk-24k7d6mw.js [479208,479514)）与面板保持 \`XFe\`（[479518,479736)），两者都是 React hook，本产品没有 React，故 seam 保留各自本体的逻辑、把宿主层作为参数：\`h=on()\` 时钟上下文、\`T=kr()\` 仓库句柄、\`M=R(void 0)\`/\`L=R(RYr)\` 两个 ref、\`ee=V(...)\` 通知键、\`he=V(Cj)\` 隐藏标志、\`we=Re(s_().values, SEt(...))\` 存储账本键，效果体只有一行 \`P(()=>(TK({clock:h,store:T,pending:M,last:L}),()=>M.current?.()),[h,T,ee,he,we])\`。**先核实是否搬运**：\`TK\`/\`Cj\`（W45-31）、\`SEt\`/\`RYr\`（W45-28）**早已搬过**，本包一个都不重复搬，只新增仍未搬的 \`YAt\` [7622,7670) 与 \`gro\` [7670,7723)——选定"正在显示的面板"并判断其 placements 是否保持 toast；记录脚本逐条断言四处声明仍在各自副本里。**实测**：\`barNotificationKeys\`=\`'a b c'\`/\`' a'\`（空槽位给 \`join\` 的空串）/\`''\`、\`storedToastKeys\` 与 \`readStoredLedger\` 同键序、依赖比较逐成员 \`Object.is\`（挂载恒真、五值相同为假、任一变化为真）、挂载即滴答一次并写入账本（cleanup 即 \`M.current?.()\`）、依赖变化复用同一 driver 故账本延续（源从不置空 ref，故同一 canceller 会被再调一次，\`clearTimeout\` 幂等）、面板读取只在"显示中的面板且 placements>0 且 holdToasts"为真、保持的进入/退出（无保持不写不排、退出先清标志再调用 drain 一次、已置位时更新器返回同一对象）。**宿主边界**：React 订阅本身与队列排空 \`processQueue\`——它属通知上下文 \`vo\`（chunk-356hrhz3.js [1735,5205) 3,470 单位，尚含 \`addNotification\`/\`removeNotification\`），已列为下一包。验收：check/build/notices、新副本扫描 \`unresolved 0\`、**${chain}**、新回归 9/9、插件链家族 124/124、全量 **${full}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45BarMountCompiled.v1\`，共 ${driverMarkers.length} 个标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [挂载层证据](ports/W45-bar-mount-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('the C-12 row was not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the mount layer.
const features = read('research/FEATURES.md');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('the interactive feature row was not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-38 mounts the ported clock tick the way the source's bar component does (the driver's two refs, the effect and its cleanup, the five-member dependency array as an Object.is comparison) and takes the pane hold's read and raise/release pair from the source, reusing the tick and the ledger reader instead of copying them again. |`;
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = read('research/coding-standard.md');
const standardAt = standard.indexOf('2026-10-16 W45-37 tab/ESC 展开器');
if (standardAt < 0) throw new Error('coding-standard W45-37 line not found');
const standardEntry = `2026-10-16 W45-38 栏位挂载层：S-1至S-7已对照。S-1（先读源）：先核实哪些本体**已搬**——\`TK\`/\`Cj\`（W45-31）与 \`SEt\`/\`RYr\`（W45-28）已在副本中，本包不重复搬；仍缺的 \`YAt\`/\`gro\` 逐字搬运（2 段 101 单位，chunk-tvdq3hrk.js [7622,7723)），链校验器 ${chain} 覆盖，记录脚本另断言四处已搬声明仍在各自文件（\`function TK(h)\`、\`function Cj(o)\`、\`function SEt(e=s_().values.getState())\`、\`RYr\`）。S-2（不留半包）：栏挂载的整条效果链一次说完——两个选择器、两个 ref、效果体与 cleanup、依赖比较、面板保持的进入与退出；宿主边界（React 订阅与 \`processQueue\`）连同其所属上下文 \`vo\` 的区间与单位数写进头注与下一包，不留下"看起来能用"的替代实现。S-3：新回归 9/9 覆盖两个键、\`Object.is\` 逐成员比较、挂载滴答与 cleanup 的取消、依赖变化后账本延续、面板读取四例、保持的进入/退出与更新器同对象语义；断言前先在 \`.audit/w45-38-probe.mts\` 量出全部取值。S-4（可复跑校验）：记录脚本自读身份（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）、自跑扫描/链校验器/打包冒烟/${drivers.length} 个编译驱动与探针并解析输出，\`ported\` 列表直接由 ledger 读回。S-5/S-6：新增 seam 与副本各自只做一件事（前者给宿主可调用的挂载契约，后者只放两个被搬的本体），无死代码；\`plugin-chain-bar-mount-source.ts\` 未使用的导出会被校验器与 \`unresolved 0\` 扫描一并覆盖。S-7：栈上余项（\`vo\` 队列本体、readers/mount 生命周期、\`$\` 表余项、Q-086）写入证据 \`next_package\`。验收：check/build/notices、扫描 unresolved 0、${chain}、新回归 9/9、家族 124/124、全量 ${full}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-38 paragraph above the W45-37 one.
const status = read('research/STATUS.md');
const statusAt = status.indexOf('W45-37: the tab and ESC-sequence expander');
if (statusAt < 0) throw new Error('STATUS W45-37 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-38: the bar's mount layer, the effect that puts the ported tick on a host. The source mounts it from the bar component \\\`JFe\\\`, which reads a clock context, a store handle, makes two refs and re-runs on \\\`[h, T, ee, he, we]\\\`; this product has no React, so src/plugin-chain-bar-mount.ts keeps the body's logic and takes the host layers as parameters — the two selectors' joined keys, React's per-member \\\`Object.is\\\` comparison, the driver's two refs, and \\\`XFe\\\`'s raise/clear-and-drain pair for the pane hold. Nothing was copied twice: \\\`TK\\\`/\\\`Cj\\\` (W45-31) and \\\`SEt\\\`/\\\`RYr\\\` (W45-28) are already ported and the record script asserts each declaration where it lives; the two bodies still missing — \\\`YAt\\\` and \\\`gro\\\`, the shown-pane read the hold selects with — are copied verbatim (2 blocks, 101 units). Measured before asserted: the keys join as the source joins them, mounting ticks once and hands back \\\`M.current?.()\\\`, a dependency change re-runs the effect over the same driver so the ledger carries across, and the hold writes nothing when no pane holds, clears before it drains, and keeps the same state object when the flag is already up. The queue drain itself (\\\`processQueue\\\`, from the notification context \\\`vo\\\`, 3,470 units) is the next package. Evidence: \\\`research/ports/W45-bar-mount-evidence.json\\\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-38 section.
const runner = read('research/ports/W45-chain-runner.md');
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-38 mounted the clock tick on a host (2026-10-16)

W45-31 ported the tick and W45-28 the ledger it reads, but nothing mounted either: the effect lives in
the bar component \\\`JFe\\\` (chunk-24k7d6mw.js [479208,479514)), which reads a clock context, a store
handle, makes two refs (\\\`M = R(void 0)\\\`, \\\`L = R(RYr)\\\`) and re-runs on the five-member array
\\\`[h, T, ee, he, we]\\\` — the joined notification keys, \\\`Cj(state)\\\` and the joined stored-ledger keys.
Its body is one line: \\\`TK({clock, store, pending, last})\\\` with \\\`() => M.current?.()\\\` on cleanup. The
sibling \\\`XFe\\\` [479518,479736) holds the pane: \\\`Re(Ri(), gro)\\\` selects whether the shown pane's
placements hold toasts, and the effect raises \\\`paneHoldsToasts\\\` while they do and, on release, clears
it and drains the queue.

This product has no React, so src/plugin-chain-bar-mount.ts keeps each body's logic and takes the host
layers as parameters: \\\`createBarClockDriver\\\` is the two refs, \\\`mountBarClockDriver\\\` is the effect and
its cleanup, \\\`barClockDriverChanged\\\` is React's \\\`Object.is\\\` comparison of the five members,
\\\`barNotificationKeys\\\`/\\\`storedToastKeys\\\` are the two selectors (the second through the ported
\\\`SEt\\\`), and \\\`readPaneHold\\\`/\\\`holdPaneToasts\\\` are the pane read and the raise/release pair.

Nothing was copied twice. \\\`TK\\\` and \\\`Cj\\\` were already in
src/plugin-chain-notify-clock-source.ts (W45-31) and \\\`SEt\\\`/\\\`RYr\\\` in the ledger copies (W45-28); the
record script asserts each declaration where it lives. The two bodies still missing — \\\`YAt\\\` and
\\\`gro\\\`, the shown-pane read behind the hold — are copied verbatim into
src/plugin-chain-bar-mount-source.ts (chunk-tvdq3hrk.js [7622,7723), 2 blocks, 101 units).

Measured before asserted, in .audit/w45-38-probe.mts: the two keys join exactly as the source joins
them (\\\`'a b c'\\\`, \\\`' a'\\\` for an empty current slot, \\\`''\\\` for an empty bar); mounting ticks once,
writes the ledger and arms the delay, and the cleanup cancels it; a dependency change re-runs the
effect over the same driver, so the ledger ages rather than restarts — and because the source never
clears the ref, the canceller the cleanup ran is called again by the next tick, which
\\\`clearTimeout\\\` makes a no-op; the pane read is true only for the shown pane with placements and
\\\`holdToasts\\\`; the hold writes nothing when no pane holds, and on release clears the flag before it
drains.

The queue drain is the host boundary: \\\`processQueue\\\` comes from the notification context \\\`vo\\\`
(chunk-356hrhz3.js [1735,5205), 3,470 units), which also owns \\\`addNotification\\\` and
\\\`removeNotification\\\` and is the next package.

Verified: check/build/notices, the new copy \\\`unresolved 0\\\`, ${chain}, the new suite 9/9, the chain
family 124/124, full ${full} (${flake}), ${drivers.length} compiled drivers (the shared driver now also
prints \\\`W45BarMountCompiled.v1\\\`), and the packaged smoke (${smoke}). Identity \\\`${short}…\\\` (read from
scripts/identity.mjs by the record script itself, which asserts the counts).
`);

const rows = [
  ['2026-10-16T15:20:00Z', 'package', `W45-38 搬栏位挂载层（新副本 2 段 101 单位：YAt/gro；seam 无新搬运块），把已搬运的 TK 接上宿主`,
    '栏组件的效果可在无 React 的宿主上驱动：driver 两个 ref + 挂载/cleanup + 依赖比较 + 两个选择器 + 面板保持的进入/退出',
    'chunk-tvdq3hrk.js YAt [7622,7670)、gro [7670,7723)；复用 plugin-chain-notify-clock-source.ts 的 TK/Cj 与 notify-store-source.ts 的 SEt、notify-source.ts 的 RYr（记录脚本逐条断言声明仍在）',
    `实测（.audit/w45-38-probe.mts）：barNotificationKeys 'a b c'/' a'/''、storedToastKeys 与 readStoredLedger 同键序、依赖逐成员 Object.is、挂载即滴答并写账本且 cleanup 取消、依赖变化复用 driver 使账本延续、面板读取四例、保持进入/退出（退出先清后 drain 且已置位时返回同一对象）；test/plugin-chain-bar-mount.test.ts 9/9，家族 124/124`],
  ['2026-10-16T15:26:00Z', 'finding', 'W45-38 记录一处测试侧陷阱：node:assert 的比较函数是断言签名，与字面量 [] 比较会把数组窄化为 never[]',
    'test 里 `assert.deepEqual(bar.updaters, [])` 让其后同一作用域的 `bar.updaters[i]()` 报 TS2349 "Type never has no call signatures"，而运行期完全正常',
    '改用 `assert.equal(bar.updaters.length, 0)` 并在该行注明原因（断言签名会把 actual 窄化为 expected 的类型）',
    'npm run check 通过；探针与全量扫描不受影响'],
  ['2026-10-16T15:32:00Z', 'verification', `W45-38 验收：新副本扫描 unresolved 0、${chain}、新回归 9/9、家族 124/124、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '栏位挂载层收束，只剩宿主边界（React 订阅与 processQueue）',
    `check/build/notices；扫描 unresolved 0；${chain}；新回归 9/9；test/plugin-chain-*.test.ts 124/124；全量 ${full}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45BarMountCompiled.v1，共 ${driverMarkers.length} 个标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）；全量首发：${flake}`],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md');
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-38 acceptance (2026-10-16)

- [x] **The tick is mounted the way the source mounts it.** A host with no React gets the driver's two refs, the effect and its cleanup, and React's five-member comparison as \`barClockDriverChanged\`, all read off \`JFe\`.
- [x] **Nothing was copied twice.** \`TK\`/\`Cj\` (W45-31) and \`SEt\`/\`RYr\` (W45-28) are reused, and the record script asserts each declaration where it lives rather than trusting the claim.
- [x] **The two bodies still missing are copied verbatim.** \`YAt\` and \`gro\` (2 blocks, 101 units) go into a generated copy with a per-block ledger, verified by the chain verifier (${chain}) and scanned \`unresolved 0\`.
- [x] **The pane hold is the source's own logic.** The read is the shown pane with placements and \`holdToasts\`; the raise keeps the same state object when the flag is up; the release clears before it drains; no hold writes nothing and drains nothing.
- [x] **Everything measured before it was asserted.** .audit/w45-38-probe.mts printed the keys, the arming and cancelling, the re-run over a kept ledger, the pane cases and both hold transitions; the assertions follow those numbers.
- [x] **The host boundary is named, not hidden.** The React subscription and \`processQueue\` (with the context \`vo\` it lives in, its range and its unit count) are recorded in the seam's header and in \`next_package\`.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\`, ${chain}, new suite 9/9, chain family 124/124, full ${full}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', full, '| smoke:', smoke);
