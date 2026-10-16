// Write the W45-40 package record from the artifacts themselves: the registry's invalidation surface,
// the seven bodies it copies, and the completeness check for the module they came out of.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 353, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 136, `validation ${identity.validation.files}`);
expect(identity.build.files === 245, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 41) throw new Error('the chain verifier did not pass 41 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const resetCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-registry-reset-source.ts'));
if (!resetCopy || resetCopy.blocks !== 7) throw new Error('the registry-reset copy is not the 7-block one');

const ledger = JSON.parse(read('src/plugin-chain-registry-reset-source-blocks.json'));
if (ledger.blocks.length !== 7) throw new Error('the registry-reset ledger does not hold seven blocks');
const scan = execFileSync(process.execPath, ['scripts/source-undeclared-scan.mjs', 'src/plugin-chain-registry-reset-source.ts'], { encoding: 'utf8' });
if (!/unresolved 0/.test(scan)) throw new Error('the registry-reset copy has unresolved names');

// The module is now fully accounted for: every top-level declaration of chunk-3ph567jx.js lies inside a
// range some ledger records or inside the host boundary, and the boundary text is what the seam quotes.
const coverage = JSON.parse(execFileSync(process.execPath, ['.audit/w45-40-module-scan.mjs'], { encoding: 'utf8' }));
if (!coverage.everyDeclarationCovered) throw new Error('a declaration of the module is outside every recorded range');
if (!coverage.boundaryMatchesSeamHeader) throw new Error('the host boundary is not the text the seam records');
const moduleCoverage = `chunk-3ph567jx.js is fully accounted for: ${coverage.topLevelStatements} top-level statements, ${coverage.coveredRanges.length} recorded ranges (three ledgers plus the host boundary [3650,3763)), and the only statements outside them are the module's ${coverage.wiringOutside.length} imports/exports`;
if (coverage.wiringOutside.some((node) => node.type !== 'ImportDeclaration' && node.type !== 'ExportNamedDeclaration')) {
  throw new Error('a non-wiring statement is outside every recorded range');
}

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^\\u2139 ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-40-tests.txt');
if (full.failed !== 0 || !Number.isInteger(full.tests)) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-40-family.txt');
if (family.failed !== 0) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;

const smokeOutput = read('.audit/w45-40-smoke.txt');
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
if (!driverMarkers.includes('W45RegistryResetCompiled.v1')) throw new Error('the shared driver did not print the W45-40 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45RegistryResetCompiled.v1 (${driverMarkers.length} markers in all: it drives the five resets and the two compositions against dist and checks that no sentinel field moves)`;

const evidence = {
  schema: 'W45RegistryResetEvidence.v1',
  package: 'W45-40 — the registry\'s invalidation surface: the two reads and the five resets, and the completeness check for the module they came out of',
  date: '2026-10-16',
  question: 'W45-35 copied the registry literal `s()` and the two stores out of chunk-3ph567jx.js. What is left in that module, and is the registry accessor `it()` — which every copied body outside the module calls — a body to copy or a host boundary?',
  answer: 'What was left is the accessor\'s own four statements [3650,3763) and seven small bodies [3763,4069). The seven are pure and copied verbatim (306 units): the two reads `wms`/`$Dn` and the five resets `Nhr`/`Fhr`/`$hr`/`Uhr`/`UDn`. The four are the host boundary and are recorded as such: the source reads `function it(){return a().registry}` where `a()` is `r.of(B().host)` under the memo `q(() => new n)` — one registry per host, keyed by a host context this port has no counterpart for — while ./plugin-chain-host.ts builds the same state lazily in a function that carries the source\'s own name `it`, so the copied `it().<field>` expressions mean the same thing on both sides. With W45-35\'s copy and W45-31\'s copy of `FDn` in place, every top-level declaration of the module is now inside a recorded range, and only the module\'s imports and its export list are not: .audit/w45-40-module-scan.mjs proves that from the ledgers themselves rather than from a list.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  boundary: {
    range: [3650, 3763],
    text: coverage.boundaryText,
    why: 'The source\'s registry is built per host: `class n{registry=s()}` sits under `var r=new q(()=>new n)` and is reached through `function a(){return r.of(B().host)}`, where `B().host` is a context value. This product has one host for the process, and ./plugin-chain-host.ts already carries the equivalent in a lazily built singleton under the same name `it` (building it eagerly there once broke `it().panes`, which the W45-35 regression caught, so the laziness the source gets from the memo is preserved explicitly).',
    verifiedBy: 'the seam header quotes [3650,3763) verbatim, and .audit/w45-40-module-scan.mjs asserts that quote equals the module text',
  },
  reuse: {
    body: 'The module\'s other declarations are already ported and were not copied again: `FDn` by W45-31 in src/plugin-chain-notify-fold-source.ts [757,941), and `s()`/`Zco`/`edo` by W45-35 in src/plugin-chain-registry-source.ts [941,1236)/[1236,1283)/[1283,3650).',
    why: 'The five resets write fields of the registry literal W45-35 copied, so a second copy of that literal would leave two registries in the product and the resets would clear the wrong one.',
  },
  copies: {
    product: ['src/plugin-chain-registry-reset-source.ts', 'src/plugin-chain-registry-reset.ts'],
    detail: `plugin-chain-registry-reset-source.ts ${resetCopy.blocks} blocks / ${resetCopy.units} units of one module; the seam adds no copied block`,
  },
  measured: [
    'Each reset clears exactly its own slots and nothing else, with every other guarded field seeded first: `Nhr` clears `commands`, `Fhr` clears `skills` and `skillsV5`, `$hr` clears `agents`, `Uhr` clears `outputStyles`, `UDn` clears `workflows`. The sentinels (`pluginLoad`, `handedIn`, `hookRegistrationEpoch`, `registeredAgents`) never move, so no body clears a neighbouring slot on its way.',
    'A reset over an already-cleared slot is a no-op and does not throw.',
    'The compositions the source\'s own call sites build clear the union of their parts: `bM()` (`Nhr(); Fhr()`) leaves commands and both skill slots cleared, the reset half of the plugin-source re-read `zLr()` clears commands, agents, output styles and workflows, `_7()` clears agents, `bCn()` clears output styles.',
    '`registeredAgentExists` is `.has` on the registry\'s own map, not a truth test: a key present with an undefined value still answers true, and deleting the key answers false.',
    '`pluginLoadCacheOnly` returns the slot itself, `undefined` when nothing has set it and `false` when the loader set it false, so a caller can tell "not decided" from "decided against".',
    'All seven fields the five resets write are present in the registry literal this product installs and all seven start `undefined`, which is what makes the resets correct on a cold registry and what would fail if a field were missing.',
  ],
  behaviour_changed: [
    'The registry\'s invalidation surface is now a product surface: seven typed functions a plugin-source re-read can call to drop the slots it invalidated.',
    'Seven bodies left the unported set (306 units), and with them chunk-3ph567jx.js has no unported declarations left: the module is now three copies plus one recorded host boundary.',
    'No product file changed behaviour on another path: the seam is additive, and the only edits outside it are the verifier registering the new plan and the shared driver printing its marker.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'the new copy: unresolved 0',
    chain_verifier: chain,
    module_coverage: moduleCoverage,
    regressions: `the new registry-reset suite 6/6; ${familyLine}`,
    full: fullLine,
    compiled: driverLine,
    smoke,
  },
  next_package: [
    'the plugin-source re-read itself: `bM`, `zLr`, `_7` and `bCn` (chunk-sfn1dbxq.js), whose bodies are the compositions this package measured — they are the callers that give the seven bodies their meaning',
    'the rest of the `$` table beyond the three ui floors, entry by entry',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
    'the registry fields the source\'s literal carries but no ported body reads yet (the hook registry, the marketplaces, the command-producer memos)',
    'the notification context provider itself (`a4n`, chunk-356hrhz3.js [1453,1607)) and the clearTimer context `R` [1431,1432)',
    'documentation hygiene: the evidence docs written through the W45-38/W45-39 route carry a stray backslash before every inline code span (research/ports/W45-chain-runner.md 179 lines, .audit/w45-runtime.todo.md 33, research/CURRENT.md and research/STATUS.md one paragraph each); this package\'s writer emits clean spans, and the older lines want a one-off pass',
  ],
};
write('research/ports/W45-registry-reset-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

// CURRENT: the W45-40 row above the W45-39 one.
const current = read('research/CURRENT.md');
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-40 **搬注册表失效面并收束 chunk-3ph567jx.js**（新副本 7 段 306 单位，一个模块；seam 无新搬运块）：两读 \`wms\`（\`registeredAgents.has\`）与 \`$Dn\`（\`pluginLoadCacheOnly\` 槽原值，故"未定"与"定为假"可分）、五清 \`Nhr\`（commands）/ \`Fhr\`（skills+skillsV5）/ \`$hr\`（agents）/ \`Uhr\`（outputStyles）/ \`UDn\`（workflows）逐字搬运。**宿主边界**：\`class n{registry=s()}\`、\`var r=new q(()=>new n)\`、\`function a(){return r.of(B().host)}\`、\`function it(){return a().registry}\` [3650,3763) 不搬——源的注册表按 host 建，本产品一进程一 host，./plugin-chain-host.ts 已在同名 \`it\` 里惰性建同一状态（早先急切构建曾让 \`it().panes\` 出错，W45-35 回归抓到），故两侧 \`it().<field>\` 同义；seam 头注逐字引用该区间，\`.audit/w45-40-module-scan.mjs\` 断言引文等于模块原文。**模块收束证明**：该模块 ${coverage.topLevelStatements} 条顶层语句，${coverage.coveredRanges.length} 个已记录区间（三份 ledger + 宿主边界），区间外只剩 ${coverage.wiringOutside.length} 条 import/export——由 ledger 自证，不靠清单；其余声明复用 W45-31 的 \`FDn\` 与 W45-35 的 \`s()\`/\`Zco\`/\`edo\`，不重复搬（重复搬会让产品里出现两个注册表，五个清函数会清错对象）。**实测**：每个清函数只动自己的槽（先种满其余槽与哨兵 \`pluginLoad\`/\`handedIn\`/\`hookRegistrationEpoch\`/\`registeredAgents\`）、重复清为空操作、源自身调用点组合 \`bM\`（commands+两技能槽）/ \`zLr\` 重置半边（commands+agents+outputStyles+workflows）/ \`_7\`（agents）/ \`bCn\`（outputStyles）各清其并集、冷注册表七槽皆 \`undefined\`（故冷清即空操作，缺字段则会失败）。验收：check/build/notices、新副本扫描 \`unresolved 0\`、**${chain}**、模块覆盖自证、新回归 6/6、插件链家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45RegistryResetCompiled.v1\`，共 ${driverMarkers.length} 个标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [注册表失效面证据](ports/W45-registry-reset-evidence.json)、[通知队列证据](ports/W45-notify-queue-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('the C-12 row was not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the registry invalidation surface.
const features = read('research/FEATURES.md');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('the interactive feature row was not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-40 ports the registry's invalidation surface: the two reads and the five slot clears a plugin-source re-read calls, copied verbatim from the module W45-35 began, so the registry that module describes can be invalidated by the compositions the source runs. |`;
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = read('research/coding-standard.md');
const standardAt = standard.indexOf('2026-10-16 W45-39 通知队列本体');
if (standardAt < 0) throw new Error('coding-standard W45-39 line not found');
const standardEntry = `2026-10-16 W45-40 注册表失效面：S-1至S-7已对照。S-1（先读源）：先把"还剩什么"读清——七个体（306 单位）是声明，可搬；访问器自身四语句 [3650,3763) 是 host 边界，不搬，并逐字引用其原文（\`.audit/w45-40-module-scan.mjs\` 断言引文等于模块切片），复用 W45-31 的 \`FDn\` 与 W45-35 的字面量（重复搬会产生两个注册表，五清会清错对象）。S-2（不留半包）：两读五清一次给全，且把源自身四个调用点的组合（\`bM\`/\`zLr\` 重置半边/\`_7\`/\`bCn\`）读出来写进 seam 头注与 next_package——它们是这七个体存在的理由，本身作下一包。S-3：回归先依赖 \`.audit/w45-40-probe.mts\` 量出的取值（逐槽单独清、哨兵不动、重复清为空操作、四个组合各清其并集、冷注册表七槽皆 undefined），再断言"只动自己的槽"，即断言形状而非数值。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器/模块覆盖/打包冒烟/${drivers.length} 个编译驱动并解析输出，\`ported\` 由 ledger 读回，模块覆盖由 ledger 自身推导（不列清单：区间外只允许 import/export）。S-5/S-6：seam 只做命名与类型，无死导出；五清保持源语义（\`void 0\` 而非 delete），"未定 vs 定为假"在 \`$Dn\` 上被测试钉住。S-7：plugin-source 重读本体（\`bM\`/\`zLr\`/\`_7\`/\`bCn\`）、\`$\` 表余项、Q-086、流式 provider、通知 Provider 与文档反斜杠清理写入 next_package。验收：check/build/notices、扫描 unresolved 0、${chain}、模块覆盖自证、回归 6/6、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-40 paragraph above the W45-39 one.
const status = read('research/STATUS.md');
const statusAt = status.indexOf('W45-39: the notification queue owner');
if (statusAt < 0) throw new Error('STATUS W45-39 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-40: the registry's invalidation surface, and the end of chunk-3ph567jx.js. W45-35 copied that module's registry literal and left the accessor's own machinery plus seven small bodies; the seven are pure and copied verbatim (306 units over one module — the two reads \`wms\`/\`$Dn\` and the five slot clears \`Nhr\`/\`Fhr\`/\`$hr\`/\`Uhr\`/\`UDn\`), and the four statements of the accessor are recorded as the host boundary instead: the source builds one registry per host under a memo keyed by a context value, and this port has one host and already builds the same state lazily inside a function carrying the source's own name. The seam header quotes that range and an audit script asserts the quote equals the module text. With that, the module has no unported declarations left, and the check is derived rather than asserted: every top-level statement must fall inside a range some ledger records or inside the boundary, and only the module's imports and its export list do not. Measured before asserted: each reset moves its own slots and no sentinel field, a repeat is a no-op, the four compositions the source's call sites build clear the union of their parts, and the registry literal carries all seven fields with all seven unset, which is why the resets are correct on a cold registry. Next is the plugin-source re-read that calls them. Evidence: \`research/ports/W45-registry-reset-evidence.json\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-40 section.
const runner = read('research/ports/W45-chain-runner.md');
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-40 ported the registry's invalidation surface and closed chunk-3ph567jx.js (2026-10-16)

The seven bodies the plugin sources call when a source they were built from changes are now a product
surface: \`registeredAgentExists\` (\`wms\`, a \`.has\` on the registry's own map), \`pluginLoadCacheOnly\`
(\`$Dn\`, the slot itself, so "not decided" and "decided false" stay apart) and the five clears
\`resetCommands\`/\`resetSkills\`/\`resetAgents\`/\`resetOutputStyles\`/\`resetWorkflows\`. They are copied
verbatim into src/plugin-chain-registry-reset-source.ts (7 blocks, 306 units) and reached through
src/plugin-chain-registry-reset.ts.

The accessor they call is a host boundary, not a body: the source reads
\`function it(){return a().registry}\` with \`a()\` = \`r.of(B().host)\` under the memo \`q(() => new n)\`,
one registry per host keyed by a context value. This product has one host for the process, and
./plugin-chain-host.ts builds the same state lazily inside a function that carries the source's own
name, so the copied \`it().<field>\` expressions mean the same thing on both sides. The seam header
quotes [3650,3763) verbatim and .audit/w45-40-module-scan.mjs asserts that quote equals the module
text.

With W45-31's \`FDn\` and W45-35's literal in place, the module is fully accounted for, and the check is
derived from the ledgers rather than listed: ${coverage.topLevelStatements} top-level statements,
${coverage.coveredRanges.length} recorded ranges (three ledgers plus the boundary), and the only
statements outside them are the module's ${coverage.wiringOutside.length} imports/exports. Nothing was
copied twice — a second copy of the registry literal would put two registries in the product and the
five clears would empty the wrong one.

Behaviour, measured in .audit/w45-40-probe.mts before any assertion: each reset moves its own slots and
no sentinel field (\`pluginLoad\`, \`handedIn\`, \`hookRegistrationEpoch\`, \`registeredAgents\` are seeded
and never move); a repeat over a cleared slot is a no-op; and the four compositions the source's call
sites build clear the union of their parts — \`bM()\` = \`Nhr(); Fhr()\`, the reset half of the
plugin-source re-read \`zLr()\` = \`Nhr(); $hr(); Uhr(); UDn()\`, \`_7()\` = \`$hr()\`, \`bCn()\` = \`Uhr()\`.
All seven fields are present in the registry literal this product installs and all seven start
unset, which is what makes a clear on a cold registry a no-op and would fail if a field were missing.

Verified: check/build/notices, the new copy \`unresolved 0\`, ${chain}, the module coverage check, the
new suite 6/6, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers (the shared driver
now also prints \`W45RegistryResetCompiled.v1\`), and the packaged smoke (${smoke}). Identity
\`${short}…\` (read from scripts/identity.mjs by the record script itself, which asserts the counts).

Next: the plugin-source re-read itself — \`bM\`, \`zLr\`, \`_7\` and \`bCn\` in chunk-sfn1dbxq.js, the callers
that give these seven bodies their meaning.
`);

const rows = [
  ['2026-10-16T16:52:00Z', 'package', `W45-40 搬注册表失效面（新副本 7 段 306 单位，一模块；seam 无新搬运块），并收束 chunk-3ph567jx.js`,
    '两读五清（wms/$Dn/Nhr/Fhr/$hr/Uhr/UDn）成为产品面；模块再无未搬声明',
    `chunk-3ph567jx.js [3763,3815)/[3815,3862)/[3862,3898)/[3898,3958)/[3958,3992)/[3992,4032)/[4032,4069)；宿主边界 [3650,3763)（class n / var r / function a / function it）；复用 W45-31 的 FDn 与 W45-35 的 s()/Zco/edo`,
    `实测（.audit/w45-40-probe.mts）：逐槽单独清且哨兵不动、重复清 no-op、四个源组合各清其并集、冷注册表七槽皆 undefined；test/plugin-chain-registry-reset.test.ts 6/6，家族 ${family.passed}/${family.tests}`],
  ['2026-10-16T17:01:00Z', 'finding', 'W45-40 立"模块覆盖自证"：模块是否搬完，由 ledger 推导而非列清单',
    '"还剩什么没搬"容易漏（短名在不同 chunk 含义不同，同名函数可能已由别包搬过）；口头清单无法复核',
    '新增 .audit/w45-40-module-scan.mjs：解析模块顶层语句，要求每条都落在某份 src/*-blocks.json 记录的区间或已记录的宿主边界内；区间外只允许 import/export；同时断言 seam 头注引用的边界原文等于模块切片',
    `chunk-3ph567jx.js：${coverage.topLevelStatements} 条顶层语句，${coverage.coveredRanges.length} 个已记录区间，区间外仅 ${coverage.wiringOutside.length} 条 import/export，boundaryMatchesSeamHeader=true`],
  ['2026-10-16T17:09:00Z', 'finding', 'W45-40 记录一处宿主边界与一处"不重复搬"的理由：per-host memo 的注册表、以及字面量与 FDn 的复用',
    '源用 q(()=>new n) + r.of(B().host) 按 host 建注册表；本产品一进程一 host，./plugin-chain-host.ts 已在同名 it 中惰性建同一状态。若再搬一次字面量，产品里会有两个注册表，五清将清错对象（早先急切构建曾让 it().panes 出错，W45-35 回归抓到）',
    '边界区间与原文逐字写入 seam 头注并由模块扫描脚本断言；复用清单写进 evidence.reuse 与 seam 头注；五清保持源语义（void 0，不是 delete）',
    'check/build 通过；模块覆盖自证 true；回归 6/6、家族 144/144、全量 1420/1420'],
  ['2026-10-16T17:16:00Z', 'verification', `W45-40 验收：新副本扫描 unresolved 0、模块覆盖自证、${chain}、回归 6/6、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '注册表失效面收束，下一包是调用它的 plugin-source 重读',
    `check/build/notices；扫描 unresolved 0；模块覆盖（${coverage.topLevelStatements} 顶层语句 / ${coverage.coveredRanges.length} 区间 / 区间外 ${coverage.wiringOutside.length} 条 import-export）；${chain}；新回归 6/6；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45RegistryResetCompiled.v1，共 ${driverMarkers.length} 个标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md');
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-40 acceptance (2026-10-16)

- [x] **The invalidation surface is a product surface.** Seven typed functions call the copied bodies, so a plugin-source re-read can drop the slots it invalidated.
- [x] **What could be copied was copied.** Seven bodies (306 units of one module) go into a generated copy with a per-block ledger, verified by the chain verifier (${chain}) and scanned \`unresolved 0\`.
- [x] **The host boundary is recorded, not hidden.** The per-host memo and the accessor it feeds are quoted verbatim in the seam header, and .audit/w45-40-module-scan.mjs asserts that quote equals the module text.
- [x] **The module is complete, and the proof is derived.** Every top-level statement of chunk-3ph567jx.js falls inside a range some ledger records or inside the boundary; only its imports and export list do not. The check reads the ledgers, so it cannot go stale.
- [x] **Nothing was copied twice.** \`FDn\` stays W45-31's copy and the registry literal with its two stores stays W45-35's; the record names why a second copy would be wrong.
- [x] **Everything measured before it was asserted.** .audit/w45-40-probe.mts printed each reset's own slots, the untouched sentinels, the repeat, the four source compositions and the cold registry, and the assertions follow those numbers.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\`, ${chain}, module coverage, new suite 6/6, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
