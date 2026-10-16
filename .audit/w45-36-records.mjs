// Write the W45-36 package record from the artifacts themselves: the identity, the chain verifier,
// the three ledgers, the full sweep, the packaged smoke and the compiled drivers are all read or
// run here, so the record cannot drift from what was verified.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 345, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 133, `validation ${identity.validation.files}`);
expect(identity.build.files === 240, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 38) throw new Error('the chain verifier did not pass 38 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const products = ['plugin-chain-text-clamp-source', 'plugin-chain-normalize-source', 'plugin-chain-label-text-source'];
const bare = (file) => file.product.replace(/^src\//, '').replace(/\.ts$/, '');
const mine = verifier.files.filter((file) => products.includes(bare(file)));
if (mine.length !== products.length) throw new Error('a W45-36 copy is missing from the verifier');
const copied = mine.map((file) => `${file.product} ${file.blocks} blocks / ${file.units} units`).join(', ');
const blocks = mine.reduce((total, file) => total + file.blocks, 0);
const units = mine.reduce((total, file) => total + file.units, 0);

/** The ported list, read back out of the ledgers the generator wrote. */
const ledger = (product) => JSON.parse(read(`src/${product}-blocks.json`));
const ported = products.flatMap((product) => ledger(product).blocks.map((block) => ({
  module: block.module,
  range: block.range,
  units: block.units,
  bodySha256: block.bodySha256,
  note: block.note,
})));
if (ported.length !== blocks) throw new Error('a ledger block is missing from the record');

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^\\u2139 ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const first = summary('.audit/w45-36-full.txt');
const second = fs.existsSync('/tmp/w45-36-sweep2.txt') ? summary('/tmp/w45-36-sweep2.txt') : null;
const clean = second ?? first;
if (!Number.isInteger(clean.tests) || clean.failed !== 0) throw new Error('no clean full-sweep summary');
const flakeNames = [...new Set([...first.text.matchAll(/^✖ (.+?) \(\d/gm)].map((m) => m[1]))];
const flake = first.failed === 0
  ? 'the full sweep was clean on its first run at --test-concurrency=4'
  : `the first sweep at the same --test-concurrency=4 failed ${first.failed} of ${first.tests} in ${flakeNames.length} fixture(s) (${flakeNames.join('; ')}); the re-run of the full sweep is ${second ? `${second.tests}/${second.passed}` : 'missing'}`;
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
if (!driverMarkers.includes('W45LabelTextCompiled.v1')) throw new Error('the shared driver did not print the W45-36 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45LabelTextCompiled.v1 (${driverMarkers.length} markers in all: it drives the push path to a stacked label, the 24-column clamp, the refusal cases and the escape fold against dist)`;

const evidence = {
  schema: 'W45LabelTextEvidence.v1',
  package: 'W45-36 — the plugin label sanitiser: the code-point rules, the mark budget, the grapheme-budget preview and the clamp the label is drawn through',
  date: '2026-10-16',
  question: 'The host toast stack draws every plugin under a label it resolves through `Mde`, and W45-32 left `Mde` unported because every name in its one-line body was free and the closure walker of that package was unsound — so the push path threw instead of stacking. What is the pipeline under `Mde`, and how much of it is display policy this product already owns?',
  answer: 'The pipeline is `Mde` → `O` → `Y` → `Zs` → `kt` → `Epe`/`Lr`: a code-point predicate chain that turns every invisible a plugin id can carry into U+FFFD, a combining-mark budget, a trim, a fold that drops the variation selectors and replaces the controls, and a grapheme-budget preview with a 24-column first-line clamp. Forty-five blocks over five modules, 4,579 units, three generated copies. One block stays open: the tab and ESC-sequence expander, which the label path can reach only through a tab.',
  ported,
  copies: {
    product: products.map((product) => `src/${product}.ts`),
    seam: 'src/plugin-chain-text-ansi.ts',
    plans: products.map((product) => `research/ports/${product.replace('plugin-chain-', 'W45-').replace('-source', '')}-blocks.plan.json`),
    detail: copied,
  },
  boundary_left_open: {
    what: 'The tab and ESC-sequence pass: `mCo` (chunk-bf3z2ftn.js [2557,2960) 403 units), `ht` ([3099,3269) 170 units) and `yt` ([3269,3463) 194 units) are declared as throwing stubs in src/plugin-chain-text-ansi.ts, with `mt` ([3463,3508) 45 units) and the ESC state machine `twe` (chunk-yn0pfn70.js [3260,3602), which drives `L` in the same chunk) behind them.',
    why: 'The tab expansion lives inside the source\'s ESC tokenizer rather than beside it — `mCo` skips its fast path for a line holding a tab and tokenizes it — so no smaller boundary exists. This product already owns an ESC tokenizer and slicer (`tokenizeAnsi`/`sliceAnsi` in src/tui-render-host.ts, which its own `Bun.stringWidth` is built on), and whether the label path should run the source\'s tokenizer or that one is a real decision with a budget of its own.',
    reachable_only_by_a_tab: 'Measured in .audit/w45-36-probe.mts: `Epe` runs after the fold in `kt`, and that fold already replaces every control but the tab and the line feed, so no ESC-class byte survives to `gGn` and `gCo` answers false for whatever the sanitiser hands down. `Mde("\\u001b[31mred")` is `"\\uFFFD[31mred"` — the source\'s own fold output — and `Mde("a\\tb")` is the one input that fails loudly.',
    recorded_in: 'the header comment of src/plugin-chain-text-ansi.ts and this record',
  },
  behaviour_changed: [
    'src/plugin-chain-plugin-label.ts: the throwing stub is replaced by a typed re-export of the copied `Mde`, so `Nle` (and `pluginLabel`) resolves real labels. Its importer, src/plugin-chain-notify-stack-source.ts, keeps its own import line verbatim.',
    'The host toast push path (`wee`/`EEe`) is live for the first time: the regression and the compiled driver now assert the stacked entry — `{owner: "engine", plugin: "engine", text: "hi", phase: "shown"}` and `leavesAt - shownAt === 4000` — where they previously asserted the boundary throw.',
    'src/plugin-chain-notify-stack.ts: `bindToastClock(null)` now hands the registry a fresh factory clock instead of `null`. The copied `wee` reads `TC().pausedAt` on every push and the source\'s registry never carries a null clock, so unbinding used to leave a state the source cannot reach — reachable from the product\'s own API and hit by this package\'s first push assertion.',
  ],
  measured: [
    '`Mde("engine")` is `"engine"`, `Mde("  padded  ")` keeps its spaces (the cap does not trim) and `pluginLabel("engine")` is `"engine"`.',
    'The invisible code points become U+FFFD: `a\\u200b` → `a\\uFFFD`, `\\u2800` → `\\uFFFD`, `\\u2028\\u2029` → two replacement characters, `\\u200d` alone → `\\uFFFD`.',
    'The zero-width joiner survives between emoji: the family emoji comes back unchanged, and `\\u{1F600}\\uFE0F` comes back without the variation selector, because the source\'s own context rule keeps the selector and the fold then drops it.',
    'A combining-mark run past the budget (eight) collapses to one replacement character: `Mde("\\u0301".repeat(9))` is null (the collapse leaves nothing visible) and a 40×`x\\u0301` label measures 47 characters.',
    'A label is its first line, clamped to 24 columns: `Mde("a\\nb")` is `"a…"`, `Mde("word ".repeat(12))` is `"word word word word wor…"`, and a 300-character word is `23 × "a" + "…"`.',
    'Nothing visible, or already elided, is refused: `""`, `"   "` (the visibility test trims what it measures), nine bare marks, `"end…"`, and every non-string answer null.',
    'The preview keeps a settled line and collapses one that is not: `Lr("one\\n\\ntwo")` is unchanged, a line that already ends in `… [+N graphemes]` is passed through, and `Lr("x".repeat(4097))` comes back 4,081 characters long.',
    'The clamp primitives answer as the bodies read: `ct("abcdef", 4)` is `"abc…"`, `ct("ab", 1)` is `"…"`, `jo("a b c", 3, true)` is `"a …"`, `jo("a\\nb", 9, true)` is `"a…"`, `Ar("a\\nb")` is `"a"`, `Qe("a/b", "/")` is `"a"` and `$8` is the identity.',
    'The width seam is the product\'s own: the copied `ae` calls `Bun.stringWidth`, which src/tui-render-host.ts owns as `cellWidth` over its tokenizer, so the copied `z = {ambiguousIsNarrow: true}` is inert against an implementation that already documents the narrow-ambiguous Bun semantics. What Bun\'s own `stringWidth` answers for the code points this pass reaches could not be measured (no Bun on this host), and the label path cannot observe the difference: every `ae` call in it reads post-fold text.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'all three copies: unresolved 0',
    chain_verifier: chain,
    regressions: 'test/plugin-chain-label-text.test.ts 12/12; the whole chain family (test/plugin-chain-*.test.ts) 113/113',
    flake,
    full,
    compiled: driverLine,
    smoke,
  },
  next_package: [
    'The tab and ESC-sequence expander as its own package — `mCo` [2557,2960), `ht` [3099,3269), `yt` [3269,3463), `mt` [3463,3508) and `twe` with its `L` state machine — decided against the product\'s own `tokenizeAnsi`/`sliceAnsi`, so a label carrying a tab stops failing',
    'the bar component that calls the clock tick (`JFe`, chunk-24k7d6mw.js [479204,…)): the store it ticks, the refs and the unmount cleanup',
    'the reader/mount lifecycle around the folds: `Tb`, `Gf`, `OH`, `Kf`, `xur` and the `Cb` stale-listener registration',
    'the rest of the `$` table beyond the three ui floors, entry by entry',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
    'the registry fields the source\'s literal carries but no ported body reads yet (the hook registry, the marketplaces, the command-producer memos)',
  ],
};
write('research/ports/W45-label-text-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

// CURRENT: the W45-36 row above the W45-35 one.
const current = read('research/CURRENT.md');
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-36 **搬插件标签消毒器并打通宿主压栈路径**（${blocks} 段 ${units} 单位，五个模块，三个生成副本 + 一个边界 seam）：\`Mde\` [16350,16512) 本体与其下整条显示文本管线——码点规则 \`O\` [10264,10453)（变体选择符／ZWJ／蒙古选择符只在各自上下文存活）与谓词链 \`on\`/\`an\`/\`L\`/\`dn\` [8024,8299)/[8503,8706)、可见性 \`R\`/\`Ae\`/\`g3\`、组合符预算 \`fn\`/\`hn\`/\`hmo\`/\`xg\` [9299,9571)、修剪与首末字素 \`mn\`/\`V\`/\`ke\` [9602,9854)、上限 \`aN=256\`；折叠 \`kt\`/\`Zs\` [5614,5792)（控制符、代理对、阿拉伯数字符号→U+FFFD，变体选择符直接丢）与**字素预算预览** \`Lr\` [4920,5531) 及其宽度机器 \`_t\`/\`bt\`/\`Ir\`/\`wt\`/\`Cr\`/\`vr\`/\`Pt\` [3728,4885)；截断与宽度 \`ne\`/\`Ar\`/\`jo\`/\`ct\`/\`Qe\`/\`$8\`/\`ae\`/\`ra\`/\`z\`。**行为变更**：\`plugin-chain-plugin-label.ts\` 由抛错桩改为转发副本，\`pluginLabel('engine')\` 返回 \`"engine"\`，宿主 toast 压栈（\`wee\`/\`EEe\`）**首次真正可用**——回归与编译驱动都改为断言真标签与栈条目 \`{owner:'engine',plugin:'engine',text:'hi',phase:'shown'}\`。**实测**：不可见码点成 U+FFFD（\`a\\u200b\`→\`a\\uFFFD\`、\`\\u2028\\u2029\`→两个替换符、孤立 \`\\u200d\`→替换符）、九连组合符→拒绝、ZWJ 只在 emoji 间存活（\`👩👩👧\` 原样、\`😀️\`→\`😀\`）、首行 24 列（\`word \`×12 → \`word word word word wor…\`）、\`end…\`/纯空白/纯标记→\`null\`、\`Lr('x'×4097)\`→4081 字符、\`ct\`/\`jo\`/\`Ar\`/\`Qe\` 真值表。**顺带修掉一个沉默缺陷**：\`bindToastClock(null)\` 曾把注册表时钟置 \`null\`，而已搬 \`wee\` 逐字读 \`TC().pausedAt\`（源里时钟由 \`edo()\` 建、永不为 \`null\`）——现解绑即回落到工厂时钟并改正该 seam 的过时注释。**边界如实留开**：标签路径唯一可达的是 \`Epe\` 的 tab 分支 → \`mCo\` [2557,2960)，其后 \`ht\`/\`yt\`/\`mt\` 与 \`twe\`（驱动 \`L\` 状态机）未搬；ESC 类字节在 \`kt\` 折叠时已变 U+FFFD（\`Mde('\\u001b[31mred')\`=\`'\\uFFFD[31mred'\`），故实际只有含 tab 的标签抛错；本产品已有自己的 \`tokenizeAnsi\`/\`sliceAnsi\`，是否复用留作独立包的决策。验收：check/build/notices、三份副本扫描 \`unresolved 0\`、**${chain}**、聚焦 12/12 与相关 113/113、全量 **${full}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45LabelTextCompiled.v1\`，共 ${driverMarkers.length} 个标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [标签证据](ports/W45-label-text-evidence.json)、[注册表证据](ports/W45-registry-state-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('the C-12 row was not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the label sanitiser.
const features = read('research/FEATURES.md');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('the interactive feature row was not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-36 adds the plugin label sanitiser (the code-point rules, the mark budget, the grapheme-budget preview and the 24-column clamp), so a plugin's label resolves and the host toast stacks under it. |`;
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = read('research/coding-standard.md');
const standardAt = standard.indexOf('2026-10-16 W45-35 插件状态注册表');
if (standardAt < 0) throw new Error('coding-standard W45-35 line not found');
const standardEntry = `2026-10-16 W45-36 插件标签消毒器：S-1至S-7已对照。S-1（先读源）：${blocks} 段逐字搬运（${units} 单位，五个模块，三个生成副本，链校验器 ${chain} 覆盖），\`Mde\` 及其整条管线均取自源体，区间与逐段摘要写入三份计划与证据；未搬的 tab/ESC 通道连区间（\`mCo\`/\`ht\`/\`yt\`/\`mt\`/\`twe\`）写入 seam 头注释与证据，理由（tab 展开在 ESC 分词器内部，且本产品已有自有分词器，复用与否是独立决策）写明而非猜测；宽度原语的差异（\`z\` 对本产品 \`Bun.stringWidth\` 无效、Bun 自身取值在本机无法测量）如实记为不可测而非推断。S-2（不留半包）：\`Mde\`、五条拒绝路径、折叠、预览、截断与宽度原语全部由回归钉住；**顺带修掉一个沉默缺陷**——\`bindToastClock(null)\` 造成的 null 时钟（已搬 \`wee\` 逐字读 \`TC().pausedAt\`，源里永不为 null），修法与理由写入证据与注释。S-3：新回归 12/12，覆盖消毒、拒绝、替换符、ZWJ 上下文、组合符预算、首行 24 列、截断真值表、折叠、预览、可见性与边界抛出。S-4（可复跑校验）：记录脚本自读身份（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）、自跑链校验器/打包冒烟/${drivers.length} 个编译驱动并解析输出，三份副本的 \`ported\` 列表直接从生成器的 ledger 读回。S-7：tab/ESC 通道、栏组件 \`JFe\`、readers/mount 生命周期与其余队列项写入下一包。验收：check/build/notices、扫描 unresolved 0、${chain}、全量 ${full}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-36 paragraph above the W45-35 one.
const status = read('research/STATUS.md');
const statusAt = status.indexOf('W45-35: the plugin-state registry.');
if (statusAt < 0) throw new Error('STATUS W45-35 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-36: the plugin label sanitiser. Forty-five blocks (${units} units) over five modules close the boundary W45-32 left: \\\`Mde\\\` and the whole display pipeline under it — the code-point predicate chain that turns every invisible a plugin id can carry into U+FFFD, the eight-mark budget, the trim, the fold that drops the variation selectors and replaces the controls, and the grapheme-budget preview with its 24-column first-line clamp. The label path is live: \\\`pluginLabel('engine')\\\` is \\\`engine\\\` and the host toast stacks under it, where the push used to throw. The one block still missing is the tab and ESC-sequence expander, and the label path can reach it only through a tab, because the fold above it has already replaced every ESC-class byte. The port also fixed a silent defect it uncovered: \\\`bindToastClock(null)\\\` handed the registry a null clock that the copied push reads on every call, so unbinding now restores the factory's handle. Evidence: \\\`research/ports/W45-label-text-evidence.json\\\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-36 section.
const runner = read('research/ports/W45-chain-runner.md');
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-36 ported the plugin label sanitiser (2026-10-16)

The host toast stack draws every plugin under a label it resolves through \\\`Mde\\\`, and W45-32 left that
one-line body unported because every name in it was free. This package takes the whole pipeline:
${blocks} blocks, ${units} units, five modules, three generated copies — the predicate chain
(\\\`on\\\`/\\\`an\\\`/\\\`L\\\`/\\\`dn\\\`), the sanitiser \\\`O\\\` with its variation-selector, joiner and Mongolian-selector
rules, the visibility tests, the eight-mark budget, the trim, the fold \\\`kt\\\`/\\\`Zs\\\`, the grapheme-budget
preview \\\`Lr\\\` with the width machinery under it, and the truncations \\\`ct\\\`/\\\`jo\\\`/\\\`Ar\\\`/\\\`Qe\\\`/\\\`$8\\\` over the
product's own \\\`Bun.stringWidth\\\` seam.

The label path is live now: \\\`pluginLabel('engine')\\\` is \\\`engine\\\`, and the host toast stacks under the
sanitised label — the regression and the compiled driver assert the stacked entry where they used to
assert the boundary throw. What is still open is the tab and ESC-sequence expander, and under the
label path only a tab can reach it, because the fold above it replaces every ESC-class byte first;
\\\`Mde('\\u001b[31mred')\\\` is \\\`'\\uFFFD[31mred'\\\`, which is the source's own output, and \\\`Mde('a\\\\tb')\\\` is the
input that fails loudly. That pass is a package of its own, because this product already owns a
tokenizer and slicer to reconcile it with.

One silent defect fell out of unblocking the push path: \\\`bindToastClock(null)\\\` left the registry
carrying a null clock, and the copied \\\`wee\\\` reads \\\`TC().pausedAt\\\` on every push — the source's registry
builds that clock with \\\`edo()\\\` and never leaves it unset. Unbinding now hands the registry a fresh
factory handle, and the seam's stale comment about the field was corrected with it.

Verified: check/build/notices, all three copies \\\`unresolved 0\\\`, ${chain}, 12/12 new regressions, the
whole chain family 113/113, full ${full} (${flake}), ${drivers.length} compiled drivers (the shared driver
now also prints \\\`W45LabelTextCompiled.v1\\\`), and the packaged smoke (${smoke}). Identity \\\`${short}…\\\`
(read from scripts/identity.mjs by the record script itself, which asserts the file counts).

Next: the tab and ESC-sequence expander as its own package, the bar component \\\`JFe\\\`, the reader/mount
lifecycle, and the rest of the \\\`$\\\` table.
`);

/** The copied ranges, per module, read from the ledgers rather than retyped. */
const rangeList = [...ported.reduce((byModule, block) => {
  const list = byModule.get(block.module) ?? [];
  list.push(`[${block.range[0]},${block.range[1]})`);
  byModule.set(block.module, list);
  return byModule;
}, new Map())].map(([module, ranges]) => `${module} ${ranges.join('/')}`).join('；');

const rows = [
  ['2026-10-16T13:20:00Z', 'package', `W45-36 搬插件标签消毒器（${blocks} 段 ${units} 单位，五个模块，三个副本 + 边界 seam）`,
    'Mde 及其下整条显示文本管线逐字搬运；plugin-chain-plugin-label.ts 由抛错桩改为转发副本，宿主 toast 压栈路径首次可用',
    rangeList,
    `实测：不可见码点→U+FFFD、九连组合符→拒绝、ZWJ 只在 emoji 间存活、首行 24 列截断、end…/纯空白→null、Lr('x'×4097)→4081；聚焦 test/plugin-chain-label-text.test.ts 12/12；驱动新增 W45LabelTextCompiled.v1（压栈条目 + 边界）`],
  ['2026-10-16T13:34:00Z', 'finding', 'W45-36 打通压栈路径时暴露并修掉 bindToastClock(null) 的 null 时钟（已搬 wee 逐字读 TC().pausedAt）',
    '源里注册表时钟由 edo() 建、永不为 null；本 seam 的 null 解绑是源不可达状态，从产品 API 可触发',
    'src/plugin-chain-notify-stack.ts bindToastClock 改为 handle ?? createToastClock()，并改正该 seam 关于注册表时钟字段的过时注释；test/plugin-chain-notify-stack.test.ts 的压栈断言先 bindToastClock({}) 再断言栈条目',
    'chain 家族 113/113 与编译驱动全过；缺陷与修法写入证据 behaviour_changed'],
  ['2026-10-16T13:48:00Z', 'verification', `W45-36 验收：三份副本扫描 unresolved 0、${chain}、全量、${drivers.length} 个编译驱动与打包冒烟（记录脚本自读身份、自跑校验器/冒烟/驱动）`,
    '标签消毒器搬运',
    `check/build/notices；扫描 unresolved 0；${chain}；聚焦 12/12 与相关 113/113；全量 ${full}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45LabelTextCompiled.v1，共 ${driverMarkers.length} 个标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）；全量首发情形：${flake}`],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md');
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-36 acceptance (2026-10-16)

- [x] **The boundary W45-32 left is closed, body by body.** ${blocks} blocks (${units} units) over five modules are copied verbatim and verified against their ledgers (${chain}), including the preview and width machinery W45-32 could not see.
- [x] **The label path is live, and the push path with it.** \`pluginLabel('engine')\` is \`engine\`; the host toast stacks an entry under the sanitised label in both the regression and the compiled driver.
- [x] **The expectations that said "not ported" now say what the source does.** test/plugin-chain-notify-stack.test.ts and the shared driver assert the real label and the stacked entry; the reason is written in both.
- [x] **The one remaining block is named, measured and narrow.** \`mCo\`/\`ht\`/\`yt\`/\`mt\`/\`twe\` are stubs with their ranges in src/plugin-chain-text-ansi.ts, and the record shows only a tab can reach them from the label path.
- [x] **The width difference is recorded, not papered over.** The copied \`z\` is inert against this product's \`Bun.stringWidth\`, Bun's own values for those code points could not be measured here, and the label path cannot observe the difference.
- [x] **A silent defect uncovered by the port was fixed with its reason.** \`bindToastClock(null)\` no longer leaves the registry with a null clock the copied push would read.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\` three times, ${chain}, 12/12 new regressions, chain family 113/113, full ${full}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', full, '| smoke:', smoke);
