// Write the W45-37 package record from the artifacts themselves, and correct the one claim W45-36
// got wrong: its record was written after a `npm run check` that predated the new test file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.validation.files === 133, `validation ${identity.validation.files}`);
expect(identity.build.files === 239, `build ${identity.build.files}`);
expect(identity.inputs.files === 344, `inputs ${identity.inputs.files}`);
const short = identity.sha256.slice(0, 8);

// Deleting a source file does not delete its build output: the first build of this tick left
// dist/plugin-chain-text-ansi.js behind, and `files` in package.json ships dist, so the packaged
// artifact would have carried a module whose source no longer exists. The build script now prunes.
if (fs.existsSync('dist/plugin-chain-text-ansi.js')) throw new Error('the stale build output is still there');
if (!read('package.json').includes("rmSync('dist'")) throw new Error('the build script does not prune dist');

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 38) throw new Error('the chain verifier did not pass 38 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const normalize = verifier.files.find((file) => file.product.endsWith('plugin-chain-normalize-source.ts'));
if (!normalize || normalize.blocks !== 24) throw new Error('the normalize copy is not the 24-block one');

/** The expander blocks, read back out of the ledger the generator wrote. */
const ledger = JSON.parse(read('src/plugin-chain-normalize-source-blocks.json'));
const expanderRanges = [[2479, 2557], [2557, 2960], [3099, 3269], [3269, 3463], [3463, 3508]];
const expander = ledger.blocks.filter((block) => expanderRanges.some(([a, b]) => block.range[0] === a && block.range[1] === b));
if (expander.length !== expanderRanges.length) throw new Error('an expander block is missing from the ledger');
const expanderUnits = expander.reduce((total, block) => total + block.units, 0);

const tokenizer = execFileSync(process.execPath, ['.audit/w45-37-tokenizer-identity.mjs'], { encoding: 'utf8' });
if (!tokenizer.includes('"identical":true')) throw new Error('the carried tokenizer is not the source body');
const tokenizerLine = 'src/tui-ansi-tokenizer.ts carries twe [3260,3602) 342 units and L [3672,6275) 2,603 units byte-identical to chunk-yn0pfn70.js';

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^\\u2139 ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const first = summary('.audit/w45-37-full.txt');
const second = fs.existsSync('/tmp/w45-37-sweep2.txt') ? summary('/tmp/w45-37-sweep2.txt') : null;
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
if (!driverMarkers.includes('W45TabExpanderCompiled.v1')) throw new Error('the shared driver did not print the W45-37 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45TabExpanderCompiled.v1 (${driverMarkers.length} markers in all: it drives the column tracking, the C1 rewrite, the token reads and the label path through the expander against dist)`;

// The W45-36 record claimed `check: pass`, but that run predated the new test file: this tick's
// re-run found a TS7006 in it (an unannotated callback parameter) and fixed it. Correct the claim
// where it was made rather than leaving it standing.
const previous = JSON.parse(read('research/ports/W45-label-text-evidence.json'));
previous.verification.check = 'pass on the source and build as they stood when this record was written; W45-37\'s re-run of `npm run check` found one TS7006 in the test file this package added (an unannotated callback parameter in the `dn` predicate call) and fixed it — see research/ports/W45-tab-expander-evidence.json';
write('research/ports/W45-label-text-evidence.json', JSON.stringify(previous, null, 1) + '\n');

const evidence = {
  schema: 'W45TabExpanderEvidence.v1',
  package: 'W45-37 — the tab and ESC-sequence expander: the last boundary on the label path, closed by reusing the tokenizer this product already carried',
  date: '2026-10-16',
  question: 'W45-36 left the tab and ESC-sequence pass as a throwing boundary: `mCo`/`ht`/`yt`/`mt` were unported and the ESC state machine behind them was unknown, so a label carrying a tab failed loudly while every other label was real. Is that pass obtainable, and does its tokenizer have to be copied again?',
  answer: 'The pass is five blocks (816 units) in chunk-bf3z2ftn.js, and its tokenizer does not have to be copied: src/tui-ansi-tokenizer.ts already carries `twe` and the `L` state machine it drives, byte-identical to the module, ported by W44. Copying those five blocks into the normalise copy and importing `twe` closes the last boundary — the label path now throws nothing, and a plugin id carrying a tab is drawn with its tab expanded to the next eight-column stop.',
  ported: expander.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  reused: {
    tokenizer: tokenizerLine,
    why: 'Copying the same 2,945 units a second time would put two ESC machines in the product and create a second thing to keep in step. Reuse is only defensible if the carried body is the source body, so .audit/w45-37-tokenizer-identity.mjs recomputes both comparisons from the extracted module and the file and exits non-zero on any difference.',
    measured: tokenizer.trim().split('\n'),
    recorded_in: 'the import comment of research/ports/W45-normalize-blocks.plan.json, the header of test/plugin-chain-label-text.test.ts, and this record',
  },
  copies: {
    product: ['src/plugin-chain-normalize-source.ts'],
    changed_by: 'four blocks added for the expander (`mCo` [2557,2960), `ht` [3099,3269), `yt` [3269,3463), `mt` [3463,3508)); `Epe` [2479,2557) was already copied by W45-36',
    seam_removed: 'src/plugin-chain-text-ansi.ts (the three throwing stubs of W45-36) is deleted; the copy now imports `twe` from ./tui-ansi-tokenizer.js and nothing on the label path throws',
    detail: `plugin-chain-normalize-source.ts ${normalize.blocks} blocks / ${normalize.units} units`,
  },
  measured: [
    'A tab becomes the spaces up to the next eight-column stop: `Epe("a\\tb")` is `"a       b"`, and the stop is measured from the running column — `mCo(["abcdefg\\th"])` is `"abcdefg h"` (one space, not seven).',
    'The column is per line: `mCo(["a\\tb\\nc\\td"])` is `"a       b\\nc       d"`, because a line feed resets it.',
    'The pass runs only when tokenizing the text would change it: `gCo(["\\u001b[31m"])` is false (a bare escape is left alone), `gCo(["a\\u0090b"])` and `gCo(["a\\u009bb"])` are true (a C1 control and an 8-bit introducer), so `Epe("\\u001b[31mred")` is unchanged and `Epe("a\\u0090b")` is `"a\\uFFFDb"`.',
    'A sequence survives while its tab is expanded: `mCo(["\\u001b[31ma\\tb"])` is `"\\u001b[31ma       b"`.',
    'The tokenizer entry answers as its body reads: `ht("plain", true)` is one text token, `ht("\\u001b[31mred", true)` is a sequence then the text, and an unterminated tail is a sequence token.',
    'A sequence token has no text (`yt` answers `undefined`), a text token has its C1 controls replaced, and the 8-bit introducer becomes the sentinel: `yt({type:"text",value:"a\\u009bb"})` is `"a\\u0018b"`.',
    'Through the label path: `Mde("a\\tb")` is `"a       b"`, `Mde("abcdefg\\th")` is `"abcdefg h"`, `Mde("a\\tb\\nc\\td")` is `"a       b…"` (first line, elided), `Mde("\\t\\t")` is null (nothing to draw) and `Mde("x\\u001b[31my")` is `"x\\uFFFD[31my"` — the fold still eats an escape before this pass can see it.',
    '`pluginLabel` and the host toast stack follow: a plugin id carrying a tab is drawn under the expanded label, asserted in the regression and in the compiled driver.',
  ],
  build_hygiene: {
    what: 'Deleting a source file does not delete its build output: after src/plugin-chain-text-ansi.ts was removed, `npm run build` (plain `tsc -p tsconfig.build.json`) left dist/plugin-chain-text-ansi.js in place, and package.json ships `dist/`, so the packaged artifact would have carried a module whose source no longer exists.',
    fix: 'The build script now prunes its output first: `node -e "require(\'node:fs\').rmSync(\'dist\',{recursive:true,force:true})" && tsc -p tsconfig.build.json`. No tsbuildinfo exists, so nothing incremental is lost, and no script writes into dist (they only import from it), so pruning at build time is safe.',
    verified: 'The rebuild removed the stale module (build files 240 -> 239) and the packaged smoke packs one file fewer; the record script asserts both the absent file and the pruned script.',
  },
  behaviour_changed: [
    'Nothing on the label path throws any more. The three stub functions are gone with src/plugin-chain-text-ansi.ts, and both the regression and the compiled driver assert the expanded label where they asserted the boundary throw.',
    'The build prunes dist before compiling, so a deleted source can no longer ship as a stale module.',
    'A claim in the W45-36 record was wrong and is corrected where it was made: `npm run check` had not been re-run after that package added its test file, and this tick\'s re-run found one TS7006 in it (an unannotated callback parameter). The parameter is annotated and the claim in research/ports/W45-label-text-evidence.json now says what happened.',
  ],
  verification: {
    identity,
    check: 'pass (and the W45-36 test-file error it caught is fixed)',
    build: 'pass, with the output pruned first: the stale dist/plugin-chain-text-ansi.js is gone and the build file count is 240 -> 239',
    notices: 'pass',
    scan: 'all three copies: unresolved 0',
    chain_verifier: chain,
    tokenizer_identity: tokenizerLine,
    regressions: 'the two rewritten suites 21/21 (label text 12 -> 14, notify stack); the whole chain family (test/plugin-chain-*.test.ts) to be re-run in the sweep',
    flake,
    full,
    compiled: driverLine,
    smoke,
  },
  next_package: [
    'the bar component that calls the clock tick (`JFe`, chunk-24k7d6mw.js [479204,…)): the store it ticks, the refs and the unmount cleanup',
    'the reader/mount lifecycle around the folds: `Tb`, `Gf`, `OH`, `Kf`, `xur` and the `Cb` stale-listener registration',
    'the rest of the `$` table beyond the three ui floors, entry by entry',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
    'the registry fields the source\'s literal carries but no ported body reads yet (the hook registry, the marketplaces, the command-producer memos)',
  ],
};
write('research/ports/W45-tab-expander-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

// CURRENT: the W45-37 row above the W45-36 one.
const current = read('research/CURRENT.md');
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-37 **补完 tab 与 ESC 序列展开器，标签路径不再抛错**（在 W45-36 的 normalize 副本上加 ${expander.length} 段 ${expanderUnits} 单位，副本共 ${normalize.blocks} 段 ${normalize.units} 单位）：\`Epe\` [2479,2557) 入口与其后的 \`mCo\` [2557,2960) 展开器、\`ht\` [3099,3269) 分词入口、\`yt\` [3269,3463) 单 token 文本、\`mt\` [3463,3508) C1 替换逐字搬运。**复用而非重复搬运**：其驱动的 ESC 状态机本产品早已持有——\`src/tui-ansi-tokenizer.ts\` 的 \`twe\` [3260,3602) 342 单位与 \`L\` [3672,6275) 2,603 单位与 chunk-yn0pfn70.js **逐字节相同**（W44 搬运），新增 \`.audit/w45-37-tokenizer-identity.mjs\` 从模块与该文件重算两处比较并在不同即非零退出，复用因此是可测量的事实而非假设；W45-36 的三个抛错桩连同 \`src/plugin-chain-text-ansi.ts\` **删除**。**实测**：tab 展开到下一个 8 列制表位且按当前列计（\`Epe('a\\tb')\`=\`'a       b'\`、\`mCo(['abcdefg\\th'])\`=\`'abcdefg h'\`，只有一个空格）、换行重置列（\`'a       b\\nc       d'\`）、序列保留而 tab 展开（\`'\\u001b[31ma       b'\`）、只有在分词会改变文本时才动手（\`gCo(['\\u001b[31m'])\`=false、\`gCo(['a\\u0090b'])\`/\`gCo(['a\\u009bb'])\`=true，故 \`Epe('\\u001b[31mred')\` 原样而 \`Epe('a\\u0090b')\`=\`'a\\uFFFDb'\`）、\`ht\`/\`yt\`/\`mt\` 真值表；走标签路径 \`Mde('a\\tb')\`=\`'a       b'\`、\`Mde('a\\tb\\nc\\td')\`=\`'a       b…'\`、\`Mde('\\t\\t')\`=null、\`Mde('x\\u001b[31my')\`=\`'x\\uFFFD[31my'\`（折叠先吃掉 ESC），含 tab 的插件名照常压栈。**并纠正上一包的记录**：W45-36 的 \`check: pass\` 出自新增测试文件之前的运行，本包重跑 \`npm run check\` 发现该文件一处 TS7006（\`dn\` 谓词回调参数未标注），已修并把 W45-36 证据里的该字段改为如实描述。**顺带修掉一个打包缺陷**：删源文件不会删产物——本包删掉 \`plugin-chain-text-ansi.ts\` 后 \`dist/plugin-chain-text-ansi.js\` 仍在，而 \`files\` 含 \`dist/\`，该模块会被打进包；\`build\` 改为先 \`rmSync('dist')\` 再 \`tsc\`（无 tsbuildinfo、无脚本写 dist，故安全），旧产物消失（build 240→239）。验收：check/build/notices、三份副本扫描 \`unresolved 0\`、**${chain}**、两个改写套件 21/21、全量 **${full}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45TabExpanderCompiled.v1\`，共 ${driverMarkers.length} 个标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [展开器证据](ports/W45-tab-expander-evidence.json)、[标签证据](ports/W45-label-text-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('the C-12 row was not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the expander.
const features = read('research/FEATURES.md');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('the interactive feature row was not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-37 closes the label path by adding the tab and ESC-sequence expander over the ESC tokenizer this product already carried, so a plugin id carrying a tab is drawn rather than refused. |`;
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = read('research/coding-standard.md');
const standardAt = standard.indexOf('2026-10-16 W45-36 插件标签消毒器');
if (standardAt < 0) throw new Error('coding-standard W45-36 line not found');
const standardEntry = `2026-10-16 W45-37 tab/ESC 展开器：S-1至S-7已对照。S-1（先读源）：${expander.length} 段 ${expanderUnits} 单位逐字搬运（\`Epe\`/\`mCo\`/\`ht\`/\`yt\`/\`mt\`），链校验器 ${chain} 覆盖；其依赖的 \`twe\`/\`L\` **不重复搬运**，而是复用本产品 W44 已持有的同一模块体，并以 \`.audit/w45-37-tokenizer-identity.mjs\` 从提取模块与该文件重算逐字节比较（不同即非零退出）作为可复跑证据——复用有据，不是假设。S-2（不留半包）：W45-36 的三个抛错桩与 \`src/plugin-chain-text-ansi.ts\` 删除，标签路径不再有边界；两个旧断言（回归与编译驱动）按源行为改为断言展开后的标签，理由写在两处。S-3：新断言覆盖列计数、换行重置、序列保留、可达性真值表（\`gCo\` 由 \`gGn\` 短路）、\`ht\`/\`yt\`/\`mt\` 真值表与标签路径。S-4（可复跑校验）：记录脚本自读身份（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）、自跑链校验器/令牌器身份/打包冒烟/${drivers.length} 个编译驱动并解析输出；\`ported\` 列表直接从 ledger 读回；**并纠正上一包记录中一处不实的 \`check: pass\`**（其运行早于新增测试文件，本包重跑发现 TS7006 并修），改正写在 W45-36 证据里而不是抹掉。**打包缺陷一并修掉**（删源不删产物 → build 先 rmSync dist），记录脚本断言旧产物不存在与 build 脚本含 rmSync，构成可复跑证据。S-7：栏组件 \`JFe\`、readers/mount 生命周期与其余队列项写入下一包。验收：check/build/notices、扫描 unresolved 0、${chain}、两个改写套件 21/21、全量 ${full}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-37 paragraph above the W45-36 one.
const status = read('research/STATUS.md');
const statusAt = status.indexOf('W45-36: the plugin label sanitiser.');
if (statusAt < 0) throw new Error('STATUS W45-36 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-37: the tab and ESC-sequence expander, the last boundary on the label path. Five blocks (${expanderUnits} units) of chunk-bf3z2ftn.js — \\\`Epe\\\` the entry, \\\`mCo\\\` the expander, \\\`ht\\\` the tokenizer entry, \\\`yt\\\` the token reader and \\\`mt\\\` the C1 replacement — join the normalise copy, and the ESC state machine they drive is not copied at all: src/tui-ansi-tokenizer.ts already carries \\\`twe\\\` and \\\`L\\\` byte-identical to the module, and a new audit script recomputes that comparison so the reuse is measured. The three throwing stubs and their seam file are gone; a plugin id carrying a tab is now drawn at the next eight-column stop instead of refused, and the regression and the compiled driver assert the expanded label. This tick also corrected a claim its predecessor got wrong: W45-36 recorded \\\`check: pass\\\` from a run that predated its own test file, and this package's re-run found one TS7006 in it, now fixed and described where it was claimed. Evidence: \\\`research/ports/W45-tab-expander-evidence.json\\\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-37 section.
const runner = read('research/ports/W45-chain-runner.md');
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-37 closed the tab and ESC-sequence boundary (2026-10-16)

W45-36 ended with one block still missing under the label sanitiser: the tab and ESC-sequence
expander, which a label carrying a tab reached and failed on. This package copies it — \\\`Epe\\\` the
entry, \\\`mCo\\\` the expander, \\\`ht\\\` the tokenizer entry, \\\`yt\\\` the token reader and \\\`mt\\\` the C1
replacement, five blocks and ${expanderUnits} units — and does not copy the ESC machine they drive,
because this product already carries it: src/tui-ansi-tokenizer.ts holds \\\`twe\\\` [3260,3602) and
\\\`L\\\` [3672,6275) byte-identical to chunk-yn0pfn70.js. Reuse is only defensible when the carried body
is the source body, so .audit/w45-37-tokenizer-identity.mjs recomputes both comparisons from the
module and the file and exits non-zero on any difference.

The three throwing stubs and src/plugin-chain-text-ansi.ts are deleted. A tab now expands to the
next eight-column stop with the column tracked per line (\\\`Epe('a\\\\tb')\\\` is \\\`'a       b'\\\`,
\\\`mCo(['abcdefg\\\\th'])\\\` is \\\`'abcdefg h'\\\`), a bare escape is left alone while a C1 control is rewritten,
and a sequence survives its own tab being expanded. Through the label path: \\\`Mde('a\\\\tb')\\\` is the
expanded label, \\\`Mde('a\\\\tb\\\\nc\\\\td')\\\` is its first line elided, and \\\`Mde('\\\\t\\\\t')\\\` is still nothing
to draw. Both places that asserted the boundary throw now assert the expanded label, and the shared
driver prints \\\`W45TabExpanderCompiled.v1\\\` against dist.

One claim from the previous package was wrong and is corrected where it was made: W45-36 recorded
\\\`check: pass\\\` from a run that predated the test file it added. This tick re-ran \\\`npm run check\\\`,
found a TS7006 in that file (an unannotated callback parameter), fixed it, and rewrote the field in
\\\`research/ports/W45-label-text-evidence.json\\\` to say what actually happened.

Verified: check/build/notices, all three copies \\\`unresolved 0\\\`, ${chain}, the tokenizer identity check,
the two rewritten suites 21/21, full ${full} (${flake}), ${drivers.length} compiled drivers (the shared
driver now also prints \\\`W45TabExpanderCompiled.v1\\\`), and the packaged smoke (${smoke}). Identity
\\\`${short}…\\\` (read from scripts/identity.mjs by the record script itself, which asserts the counts).

Next: the bar component \\\`JFe\\\`, the reader/mount lifecycle, and the rest of the \\\`$\\\` table.
`);

const rows = [
  ['2026-10-16T14:30:00Z', 'package', `W45-37 搬 tab/ESC 展开器（${expander.length} 段 ${expanderUnits} 单位；normalize 副本 ${normalize.blocks} 段 ${normalize.units} 单位）并复用已持有的 ESC 分词器`,
    '标签路径不再抛错：删除 plugin-chain-text-ansi.ts 三个桩，含 tab 的插件名照常展开并压栈',
    `${expander.map((block) => `${block.module} [${block.range[0]},${block.range[1]})`).join('、')}；复用 src/tui-ansi-tokenizer.ts 的 twe [3260,3602)/L [3672,6275)（逐字节相同）`,
    `实测：tab→下一个 8 列制表位（'a       b'、'abcdefg h' 列计数）、换行重置列、序列保留、gCo 真值表（bare ESC false / C1 true）、ht/yt/mt 真值表；test/plugin-chain-label-text.test.ts 与 notify-stack 共 21/21；驱动新增 W45TabExpanderCompiled.v1`],
  ['2026-10-16T14:38:00Z', 'finding', 'W45-37 纠正 W45-36 记录中不实的 check: pass（其运行早于该包新增的测试文件）',
    '本包重跑 npm run check 命中 test/plugin-chain-label-text.test.ts:65 TS7006（dn 谓词回调参数未标注）',
    '为回调参数补 (character: string)；research/ports/W45-label-text-evidence.json 的 verification.check 改为如实描述，并在本包证据 behaviour_changed 里记明',
    'check 通过；全量、编译驱动与打包冒烟同时通过'],
  ['2026-10-16T14:44:00Z', 'finding', 'W45-37 发现并修掉构建不清理输出：删除源文件后 dist 仍留旧模块，而打包 files 含 dist/',
    'tsc 不删除已删源文件的产物；本包删掉 plugin-chain-text-ansi.ts 后 dist/plugin-chain-text-ansi.js 仍在，会被打进包',
    'package.json 的 build 改为先 rmSync(dist) 再 tsc（无 tsbuildinfo，且没有脚本写入 dist，只从中 import，故安全）',
    '重建后旧产物消失（build 240→239），打包冒烟少一个文件；记录脚本断言该文件不存在且 build 脚本含 rmSync'],
  ['2026-10-16T14:52:00Z', 'verification', `W45-37 验收：三份副本扫描 unresolved 0、分词器身份逐字节相同、${chain}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '标签路径边界收束',
    `check/build/notices；扫描 unresolved 0；令牌器身份（twe/L identical）通过；${chain}；两套件 21/21；全量 ${full}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45TabExpanderCompiled.v1，共 ${driverMarkers.length} 个标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）；全量首发：${flake}`],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md');
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-37 acceptance (2026-10-16)

- [x] **The last boundary on the label path is closed.** ${expander.length} blocks (${expanderUnits} units) are copied verbatim and verified against their ledger (${chain}); nothing on the path throws.
- [x] **Reuse is measured, not assumed.** \`src/tui-ansi-tokenizer.ts\` already carried \`twe\` and \`L\` byte-identical to the module; \`.audit/w45-37-tokenizer-identity.mjs\` recomputes both comparisons and fails on any difference, so no second ESC machine was copied.
- [x] **The behaviour is the source's own.** A tab expands to the next eight-column stop with the column tracked per line, a bare escape is left alone, a C1 control is rewritten, and a sequence survives its tab being expanded — each measured before it was asserted.
- [x] **The expectations that said "not ported" now assert the expanded label**, in the regression and in the compiled driver, with the reason written in both.
- [x] **A wrong claim in the previous record was corrected where it was made.** W45-36's \`check: pass\` predated its own test file; this tick found the TS7006, fixed it, and rewrote the field instead of letting it stand.
- [x] **A packaging defect found on the way was fixed, not worked around.** Deleting a source left its module in dist, which the package ships; the build now prunes its output first, the stale file is gone and the record script asserts it.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\` three times, tokenizer identity, ${chain}, two rewritten suites 21/21, full ${full}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', full, '| smoke:', smoke);
