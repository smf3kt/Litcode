// W45-35 records: the plugin-state registry, the indexes and the audit trail. Identity, the chain
// verifier's report, both sweeps and the packaged smoke are read from their own outputs, so the
// record cannot carry a number the tree did not produce.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 338, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 132, `validation ${identity.validation.files}`);
expect(identity.build.files === 236, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
expect(verifier.passed === true, 'the chain verifier did not pass');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const mine = verifier.files.filter((file) => file.product.includes('plugin-chain-registry'));
expect(mine.length === 2, `the two registry copies are registered (${mine.length})`);
const copied = `${mine.map((file) => `${file.product} ${file.blocks} blocks / ${file.units} units`).join(', ')}`;

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^\\u2139 ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const second = summary('/tmp/w45-35-sweep2.txt');
if (!Number.isInteger(second.tests) || second.failed !== 0) throw new Error('the second sweep has no clean summary');
const first = summary('/tmp/w45-35-sweep.txt');
const flakeNames = [...new Set([...first.text.matchAll(/^✖ (.+?) \(\d/gm)].map((m) => m[1]))];
const flake = first.failed === 1 && flakeNames.length === 1
  ? `the first sweep at the same --test-concurrency=4 failed once in "${flakeNames[0]}" (an integration fixture that timed out); that file passes alone and the re-run of the full sweep is clean`
  : `the first sweep reported ${first.failed} failing fixtures: ${flakeNames.join("; ") || "none named"}`;
const full = `${second.tests} tests / ${second.passed} pass / ${second.failed} fail on the frozen tree`;

const smokeReport = read('/tmp/w45-35-smoke.txt').split('\n')
  .filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; ` +
  `upstreamRequests ${smokeReport.upstreamRequests}`;

const evidence = {
  schema: 'W45RegistryStateEvidence.v1',
  package: 'W45-35 — the plugin-state registry: the state literal, its store factories and the accessor every ported body reads',
  date: '2026-10-16',
  question: 'Every ported chain body reaches the plugin registry through `it()`, and this product answered with a hand-written literal of ten fields whose stores started as `null` and had to be bound before anything could read them. The source builds one registry per host from its own factory (`s()`), and `pluginState: Zco()` / `toastClock: edo()` / `panes: gs(FDn)` are fields of that literal. What does the source\'s own factory build, and what does its accessor do that a static literal cannot?',
  answer: 'The literal carries 89 fields with the source\'s own defaults, four of them the stores `gs(...)` builds (`notices`, `renderVersions`, `panes`, `hoverGroups`), three the change signals `Oe()` builds, and `pluginState`/`toastClock` the store factories below it. The registry the seam hands back is that literal, with the three containers this host already owns spread over the fresh ones; and it is built on the first `it()` call, as the source builds it inside its lazy per-host memo. Six blocks over three modules, 3,330 units, two generated copies.',
  ported: [
    { module: 'chunk-3ph567jx.js', range: [941, 1236], units: 295, names: ['Zco'], note: 'the plugin-state store: a `gs` store over the ledger Map, the reader maps, the two fold queues at `lastAt: -Infinity`, `staleListeners`, `faultRuns`, `bumps` 0 and `versionFloor` 0' },
    { module: 'chunk-3ph567jx.js', range: [1236, 1283], units: 47, names: ['edo'], note: 'the toast clock: a handle whose two fields are written with `undefined` rather than left off' },
    { module: 'chunk-3ph567jx.js', range: [1283, 3650], units: 2367, names: ['s'], note: 'the registry literal: every field the source writes, from the hook registry through the marketplaces to the raster caches' },
    { module: 'chunk-fdxhcr6b.js', range: [1094, 1196], units: 102, names: ['Ein'], note: 'the async-resource binder: `AsyncResource.bind` when `async_hooks` is reachable, otherwise the listener itself' },
    { module: 'chunk-fdxhcr6b.js', range: [1196, 1457], units: 261, names: ['Oe'], note: 'the change signal `subscribe`/`emit`/`clear`: every listener runs, then the throws are re-raised — one as itself, several as an AggregateError' },
    { module: 'chunk-tavdbgyw.js', range: [1141, 1399], units: 258, names: ['gs'], note: 'the store `getSnapshot`/`getState`/`setState`/`subscribe`: an update that returns the same value is a no-op, and the change callback runs before the subscribers' },
  ],
  copies: { product: ['src/plugin-chain-registry-source.ts', 'src/plugin-chain-registry-stores-source.ts'], seam: 'src/plugin-chain-registry-state.ts', plans: ['research/ports/W45-registry-blocks.plan.json', 'research/ports/W45-registry-stores-blocks.plan.json'], detail: copied },
  measured: [
    'The literal is 89 fields. Four are stores (`notices`, `renderVersions`, `panes`, `hoverGroups`), three are signals (`hooksLeftOutByNameChanged`, `focusSiteDraws`, `commandProducerDirsChanged`), and `panes.getState()` is the frozen empty value — the *same* frozen object in every registry, which is what lets `Ri` reset a pane store to it.',
    '`hooksRespawns` is a `Set`. This seam held it as `Promise[]`, and the ported `N5t` (src/plugin-chain-classic-raise-source.ts:39, `n.hooksRespawns.size>0 && …`) reads `.size` off it — on an array that is `undefined`, so the respawn hop could never fire. Taking the source\'s Set is the fix, and the regression drives `.size` 0 → 1 → 0.',
    '`gs`: `getSnapshot === getState`; `setState` returning the same value calls neither the change callback nor a subscriber; a new value calls the change callback first (`{newState, oldState}`) and then every subscriber; an unsubscribed listener is not called again.',
    '`Oe`: `emit` runs every listener (a throwing one does not stop the others), then re-raises — a lone throw as itself, several as an `AggregateError("Signal listener(s) threw")`; `clear()` leaves nothing to throw at.',
    '`Zco()` and `edo()` are fresh per call, and so is the literal: two registries share the frozen panes *value* and nothing else. `values.getSnapshot === values.getState` on the store too.',
  ],
  the_lazy_build: {
    finding: 'The registry must be built on first use, not at module evaluation.',
    why: '`s()` reads `FDn` out of the fold chunk (chunk-tvdq3hrk.js, copied as src/plugin-chain-notify-fold-source.ts) and `gs`/`Oe` out of the registry-stores copy, and the fold chunk imports this host seam — so a registry built while the host module is evaluating reads `FDn` before that chunk\'s body has assigned it. `gs(undefined)` then answers `getState() === undefined`.',
    how_it_surfaced: 'The first version of the seam built the literal in a module-level `const`; the new `it().panes` regression read `undefined` while the same assertion held in a probe script whose import order differed. The source has no such hazard because `class n{registry=s()}` sits inside the lazy per-host memo `q`.',
    fix: 'src/plugin-chain-host.ts builds it on the first `it()` call and keeps it, which is also how the source hands back one registry per host.',
  },
  boundary_left_open: {
    what: 'The host lookup the source wraps around the registry: `q` (chunk-4bw62nzm.js [10003,10147) 144 units, a WeakMap-keyed lazy memo), `B` (`function B(){return n()}` [76502,76526)), `n` (`function n(){return k()?.session??y}` [76526,76562)), `k` (`var k=()=>{return}` [76647,76666) — a stub in this extracted build, so the session arm never answers), `y=Wi(d6n)` and `Wi` ([76383,76488), which builds `{host: fn(), id: Mzn()??bwe(), project:{originalCwd, projectRoot, cwd}}`).',
    why: '`fn` (chunk-4bw62nzm.js [76057,76383) 326 units) constructs the whole application host — `new Ye({clock, backgroundHousekeeping, launchOptions, settingsSource, extensionsConfig, …})`. That is the application object this product does not port, so `it()` here is the product\'s own host lookup and the seam keeps one registry for the process; `q`\'s per-host keying is not needed while there is one host, and the ranges above are what a later package would port if that changes.',
    recorded_in: 'the header comment of src/plugin-chain-host.ts and this record',
  },
  behaviour_changed: [
    'src/plugin-chain-host.ts: `it()` no longer returns a hand-written literal with `pluginState`/`renderVersions`/`panes`/`toastClock` at `null`; it returns the source\'s literal, built lazily, and `hooksRespawns` is the source\'s Set.',
    'test/plugin-chain-notify-store.test.ts and test/plugin-chain-notify-fold.test.ts each asserted that releasing a binding restores `null`. They now assert what the source does: the release restores the source\'s own store, `renderVersions` reads an empty Map and `panes` the frozen empty value, and a read with nothing else bound is the empty ledger rather than a null dereference. Both updates are the point of the package, not a workaround.',
  ],
  incident: {
    what: 'The package\'s first write put the new seam at src/plugin-chain-registry.ts, which already existed as the product\'s chain catalog (`promptEditChain`, `registerChainCore`, `adoptPluginHooksModules`) and is untracked, so git had no copy.',
    recovery: 'The file was restored from its own file-history backup (~/.claude/file-history/befe7767-…/c2e78ba1dd53b5bb@v7, the newest version carrying the module\'s last edits) with .audit/w45-35-restore.mjs, which replays the transcript\'s write and edit calls and stops on the first mismatch.',
    verification: 'npm run build regenerated dist/plugin-chain-registry.js byte-identical to the pre-clobber build kept at .audit/w45-35-dist-registry-before.js — cmp over both files reports no difference.',
    aftermath: 'The new seam lives at src/plugin-chain-registry-state.ts, and the catalog file is unchanged from the build the smoke and the sweep passed against.',
  },
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'src/plugin-chain-registry-source.ts and src/plugin-chain-registry-stores-source.ts: unresolved 0',
    chain_verifier: chain,
    regressions: 'test/plugin-chain-registry-state.test.ts 7/7; the eleven related suites (store, write, fold, clock, stack, verbs, loader, hooks-module, chain, relay) together 81/81',
    flake,
    full,
    compiled: 'all nine dist drivers exit 0; the shared driver prints W45RegistryStateCompiled.v1 against dist (the 89-field literal, the fresh store and clock, the Set the respawn gate reads, the no-op write, and the signal that delivers before it throws)',
    smoke,
  },
  next_package: [
    'the plugin label sanitiser `Mde` (chunk-qq2mgstr.js [16350,16512)) and the display-text sanitiser under it — first-order dependencies measured (`O` [10264,10453), `ke` [9810,9854), `g3` [10024,10184), `aN` [10576,10594), `Ar`/`Qe` chunk-ax7r0qj7.js [3529,3561)/[3224,3289), `Zs` chunk-bf3z2ftn.js [5614,5645) whose `kt` [5645,5792) is next, `jo` chunk-yn0pfn70.js [9072,9254), `ae` [892,935) and its `z` [863,892), `ct` [8443,8612), `$8` chunk-pa2d6xdm.js [720,744), plus `ne`/`WMt`/`x` already ported), and the measured frontier of `Mde` itself is 4 unported of 8 free names; only `ne`/`WMt`/`x` of the whole family are already ported today',
    'the bar component that calls the clock tick (`JFe`, chunk-24k7d6mw.js [479204,…)): the store it ticks, the refs and the unmount cleanup',
    'the reader/mount lifecycle around the folds: `Tb`, `Gf`, `OH`, `Kf`, `xur` and the `Cb` stale-listener registration',
    'the rest of the `$` table beyond the three ui floors, entry by entry',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
    'the registry fields the source\'s literal carries but no ported body reads yet (the hook registry, the marketplaces, the command-producer memos): port each with the body that owns it, since `s()` already installs every field',
  ],
};
write('research/ports/W45-registry-state-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

// CURRENT: the W45-35 row above the W45-33 one.
const current = read('research/CURRENT.md');
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-35 **搬注册表本体**（6 段 3,330 单位，3 个模块，2 个生成副本）：chunk-3ph567jx.js 的 \`Zco\` [941,1236) 插件状态仓库、\`edo\` [1236,1283) toast 时钟、\`s\` [1283,3650) 注册表字面量（**89 个字段**，含四个 \`gs(...)\` 仓库与三个 \`Oe()\` 信号），chunk-fdxhcr6b.js 的 \`Ein\` [1094,1196) 与 \`Oe\` [1196,1457)，chunk-tavdbgyw.js 的 \`gs\` [1141,1399)。**行为变更**：\`it()\` 不再手工写十个字段并让 \`pluginState\`/\`renderVersions\`/\`panes\`/\`toastClock\` 停在 \`null\`，而是返回源自己字面量（本机已持有的三个容器覆写其上）。**修掉一个沉默缺陷**：\`hooksRespawns\` 源里是 \`Set\`，本 seam 曾用数组，而已搬的 \`N5t\`（classic 抬升副本第 39 行）读 \`.size\`——数组上恒为 \`undefined\`，重生跳板根本不会触发；回归驱动 \`.size\` 0→1→0。**懒建是必需的**（一并记入证据）：\`s()\` 读 fold 块的 \`FDn\`，而 fold 块又反向 import 本 seam，模块初始化期构建会读到尚未赋值的 \`FDn\`（\`getState()\` 得 \`undefined\`）——源正是在 \`q\` 的惰性 per-host 备忘里 \`class n{registry=s()}\`；本 seam 改为首次 \`it()\` 时构建。**边界如实留开**：宿主查找 \`q\`/\`B\`/\`n\`/\`Wi\` 连到 \`fn()\` 构造整个应用宿主（\`new Ye({clock,…})\`），不在本产品范围，区间全部记入证据。**并记一次事故与恢复**：首版写入误覆盖了既有未跟踪的 \`src/plugin-chain-registry.ts\`（链目录），由文件历史备份 \`c2e78ba1dd53b5bb@v7\` 恢复，并用重建 \`dist/plugin-chain-registry.js\` 与覆盖前构建逐字节相同来验证。验收：check/build/notices、两份副本扫描 \`unresolved 0\`、**${chain}**、聚焦 7/7 与相关 81/81、全量 **${full}**（首次同并发全量有 1 处集成用例超时抖动，单独跑与复跑均过，如实记录）、九个编译驱动（新增 \`W45RegistryStateCompiled.v1\`）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [注册表证据](ports/W45-registry-state-evidence.json)、[toast 动词证据](ports/W45-notify-verbs-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('C-12 row not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the registry.
const features = read('research/FEATURES.md');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('interactive row not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = rowText.slice(0, lastPipe).replace(/\s+$/, '') +
  '. W45-35 installed the source\'s own plugin-state registry: 89 fields with the source\'s defaults, four stores and three change signals, a real plugin-state store and toast clock instead of `null` fields, and the `hooksRespawns` Set the respawn gate reads `.size` on — built lazily on the first `it()`, the way the source builds it per host' +
  ' |';
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = read('research/coding-standard.md');
const standardAt = standard.indexOf('2026-10-16 W45-33 toast 动词');
if (standardAt < 0) throw new Error('coding-standard W45-33 line not found');
const standardEntry = `2026-10-16 W45-35 插件状态注册表：S-1至S-7已对照。S-1（先读源）：6 段逐字搬运（3,330 单位，2 个生成副本，链校验器 ${chain} 覆盖），字面量与两个工厂全部取自源体；未搬的宿主查找连区间（\`q\`/\`B\`/\`n\`/\`k\`/\`y\`/\`Wi\`/\`fn\`）写入证据与 CURRENT，理由写进 seam 头注释（\`fn\` 构造整个应用宿主）。S-2（不留半包）：注册表、两个仓库工厂、两个信号助手、\`it()\` 懒建、\`hooksRespawns\` 修为 Set 全部由回归钉住。S-3：新回归 7/7（89 字段与四个仓库三个信号、两份注册表只共享冻结 panes、仓库默认与折叠队列、时钟两字段、绑定的往返、同值不写、信号先送达后抛出）。S-4（可复跑校验）：记录脚本自读身份（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）、自行运行链校验器并解析、两次全量与打包报告从各自输出解析；首次全量的单点抖动如实记录而未掩盖。S-7：\`Mde\` 消毒器家族（一阶依赖与二阶层均连区间）与其余队列项写入下一包；**事故如实记录**——首版写入覆盖既有未跟踪文件，恢复方式与逐字节验证一并写入证据。验收：check/build/notices、扫描 unresolved 0、${chain}、全量 ${full}、九个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-35 paragraph above the W45-33 one.
const status = read('research/STATUS.md');
const statusAt = status.indexOf("W45-33: the toast module's remaining verbs.");
if (statusAt < 0) throw new Error('STATUS W45-33 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-35: the plugin-state registry. Six blocks (3,330 units) over three modules put the source's own registry in place of this product's hand-written ten-field stand-in: \\\`Zco\\\` the plugin-state store, \\\`edo\\\` the toast clock, \\\`s\\\` the 89-field literal, \\\`gs\\\` the store and \\\`Oe\\\` the change signal under them, \\\`Ein\\\` the async-resource binder. The registry now always carries a real store, real panes and a real clock, and its \\\`hooksRespawns\\\` is the source's Set — an array there had left the ported respawn gate reading \\\`.size\\\` as undefined. It is built on the first \\\`it()\\\` call, because \\\`s()\\\` reads constants out of chunks that import this seam back; the eager version answered \\\`getState() === undefined\\\` for panes, which the new regression caught. The host lookup the source wraps around it (\\\`q\\\`/\\\`B\\\`/\\\`Wi\\\` into the application host) stays open with its ranges recorded. Evidence: \\\`research/ports/W45-registry-state-evidence.json\\\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-35 section.
const runner = read('research/ports/W45-chain-runner.md');
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-35 ported the plugin-state registry (2026-10-16)

Every ported body reaches the plugin registry through \\\`it()\\\`. This product answered with a
hand-written literal of ten fields whose stores started at \\\`null\\\`; the source builds one registry per
host from its own factory. This package takes the factory: \\\`s()\\\` (2,367 units, 89 fields), the two
stores it installs (\\\`Zco\\\`, \\\`edo\\\`), and the three helpers underneath (\\\`gs\\\`, \\\`Oe\\\`, \\\`Ein\\\`) — six
blocks, 3,330 units, two generated copies, verified against their ledgers by the chain verifier.

Two things the port turned up. The source's \\\`hooksRespawns\\\` is a \\\`Set\\\`, and this seam had modelled it
as \\\`Promise[]\\\`; the ported \\\`N5t\\\` gates the respawn hop on \\\`.size\\\`, which is \\\`undefined\\\` on an array,
so the hop could never fire. And the registry has to be built lazily: \\\`s()\\\` reads \\\`FDn\\\` out of the fold
chunk, and the fold chunk imports this seam back, so an eagerly built registry reads \\\`FDn\\\` before that
chunk's body has assigned it — \\\`panes.getState()\\\` came back \\\`undefined\\\` until the seam moved the build
to the first \\\`it()\\\` call, which is where the source builds it too. The host lookup the source wraps
around the registry (\\\`q\\\`\\\`s memo, \\\`B\\\`/\\\`Wi\\\`\\\`s application host) stays open, with its ranges in the record.

The first write of this package landed on the path of the product's chain catalog, which already
existed and was untracked. It was restored from its file-history backup and verified by rebuilding
\\\`dist/plugin-chain-registry.js\\\` byte-identical to the build made before the overwrite; the new seam
lives at \\\`src/plugin-chain-registry-state.ts\\\`. Both the recovery and the verification are in the
package record.

Verified: check/build/notices, both copies \\\`unresolved 0\\\`, ${chain}, 7/7 new regressions, the eleven
related suites 81/81, full ${full} (the first sweep at the same concurrency failed once in an
integration fixture that passes alone and in the re-run), nine compiled drivers (the shared driver now
also prints \\\`W45RegistryStateCompiled.v1\\\`), and the packaged smoke (${smoke}). Identity \\\`${short}…\\\`
(read from scripts/identity.mjs by the record script itself, which asserts the file counts).

Next: the label sanitiser \\\`Mde\\\` and the display-text sanitiser under it (frontier measured), the bar
component \\\`JFe\\\`, the reader/mount lifecycle, and the rest of the \\\`$\\\` table.
`);

const rows = [
  ['2026-10-16T12:14:00Z', 'package', 'W45-35 搬注册表本体（6 段 3,330 单位；it() 改为源字面量 + 懒建）',
    '手工十字段替身换成源工厂；hooksRespawns 修为 Set（已搬 N5t 读 .size），懒建避 FDn 未赋值',
    'chunk-3ph567jx.js [941,1236) Zco、[1236,1283) edo、[1283,3650) s；chunk-fdxhcr6b.js [1094,1196) Ein、[1196,1457) Oe；chunk-tavdbgyw.js [1141,1399) gs',
    `89 字段与四仓库三信号实测；panes 冻结值跨实例同一；回归 test/plugin-chain-registry-state.test.ts 7/7；两处旧断言按源行为改为「释放后回到源自己的仓库」`],
  ['2026-10-16T12:31:00Z', 'incident', 'W45-35 首版写入覆盖既有未跟踪文件 src/plugin-chain-registry.ts，已从文件历史恢复并逐字节验证',
    '链目录（promptEditChain/adoptPluginHooksModules）与本包新 seam 同名，新 seam 改名为 plugin-chain-registry-state.ts',
    '备份 c2e78ba1dd53b5bb@v7 恢复；.audit/w45-35-restore.mjs 重放 transcript 的写入与编辑；重建 dist/plugin-chain-registry.js 与覆盖前构建 cmp 无差异',
    '恢复后 check/build/全量/打包冒烟全部通过'],
  ['2026-10-16T12:46:00Z', 'verification', 'W45-35 验收：两份副本扫描 unresolved 0、35 计划一致、全量与打包冒烟（记录脚本自读身份、链校验器与输出）',
    '注册表搬运',
    `check/build/notices；扫描 unresolved 0；${chain}；聚焦 7/7 与相关 81/81；全量 ${full}；九个编译驱动 exit 0（新增输出 W45RegistryStateCompiled.v1）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）；首次全量单点抖动：${flake}`],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md');
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-35 acceptance (2026-08-16 → 2026-10-16)

- [x] **The source's factory replaces the stand-in.** \`it()\` returns the 89-field literal with a real store, clock and panes, not the ten hand-written fields that started at \`null\`.
- [x] **A silent divergence is fixed and driven.** \`hooksRespawns\` is the source's Set, because the ported \`N5t\` reads \`.size\`; the regression drives 0 → 1 → 0.
- [x] **The lazy build is measured, not assumed.** The eager version answered \`getState() === undefined\` for panes; the record says why (the fold chunk imports this seam back) and where the source puts the build.
- [x] **The host lookup stays a recorded boundary.** \`q\`/\`B\`/\`n\`/\`k\`/\`y\`/\`Wi\`/\`fn\` are named with their ranges and the reason they are out of scope.
- [x] **The two stale expectations were updated for the source's behaviour**, with the reason written in both the tests and the record.
- [x] **The clobbered file was recovered and proven identical** by rebuilding and comparing with the pre-overwrite build.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\` twice, ${chain}, 7/7 new regressions, eleven related suites 81/81, full ${full}, nine compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', full, '| smoke:', smoke);
