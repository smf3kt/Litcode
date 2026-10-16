// Write the W45-41 package record from the artifacts themselves: the skill/command/agent source
// registry, the four declarations it copies, and the coverage check for the module they came from.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 356, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 137, `validation ${identity.validation.files}`);
expect(identity.build.files === 247, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 42) throw new Error('the chain verifier did not pass 42 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const sourcesCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-sources-registry-source.ts'));
if (!sourcesCopy || sourcesCopy.blocks !== 4) throw new Error('the sources-registry copy is not the 4-block one');

const ledger = JSON.parse(read('src/plugin-chain-sources-registry-source-blocks.json'));
if (ledger.blocks.length !== 4) throw new Error('the sources-registry ledger does not hold four blocks');
const scan = execFileSync(process.execPath, ['scripts/source-undeclared-scan.mjs', 'src/plugin-chain-sources-registry-source.ts'], { encoding: 'utf8' });
if (!/unresolved 0/.test(scan)) throw new Error('the sources-registry copy has unresolved names');

// The module is fully accounted for the same way chunk-3ph567jx.js was: every top-level statement is
// inside a range a ledger records or inside the boundary, and the boundary is the text the seam quotes.
const coverage = JSON.parse(execFileSync(process.execPath,
  ['.audit/w45-40-module-scan.mjs', 'chunk-qm4226vk.js', '3438', '3497'], { encoding: 'utf8' }));
if (!coverage.everyDeclarationCovered) throw new Error('a declaration of the module is outside every recorded range');
if (coverage.wiringOutside.some((node) => node.type !== 'ImportDeclaration' && node.type !== 'ExportNamedDeclaration')) {
  throw new Error('a non-wiring statement is outside every recorded range');
}
const seam = read('src/plugin-chain-sources-registry.ts');
if (!seam.includes(coverage.boundaryText)) throw new Error('the seam does not quote the boundary it records');
if (coverage.boundaryText !== 'var a=new q(()=>new s);function xr(){return a.of(B().host)}') {
  throw new Error('the boundary is not the memo and the accessor');
}
const moduleCoverage = `chunk-qm4226vk.js is fully accounted for: ${coverage.topLevelStatements} top-level statements, ${coverage.coveredRanges.length} recorded ranges (one ledger plus the host boundary [3438,3497)), and the only statements outside them are the module's ${coverage.wiringOutside.length} imports/export list`;

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^\\u2139 ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-41-tests.txt');
if (full.failed !== 0 || !Number.isInteger(full.tests)) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-41-family.txt');
if (family.failed !== 0) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;

const smokeReport = read('.audit/w45-41-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
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
if (!driverMarkers.includes('W45SourcesRegistryCompiled.v1')) throw new Error('the shared driver did not print the W45-41 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45SourcesRegistryCompiled.v1 (${driverMarkers.length} markers in all: it drives the store's eight methods against dist on fresh stores, including the two clears that keep their neighbours)`;

const evidence = {
  schema: 'W45SourcesRegistryEvidence.v1',
  package: 'W45-41 — the skill, command and agent source registry: the store whose tables every invalidation in the plugin-source family reaches',
  date: '2026-10-16',
  question: 'W45-40 copied the plugin registry\'s five clears and named the plugin-source re-read as the next package. Reading that re-read (chunk-sfn1dbxq.js `VT`/`bM`/`Hz`/`_7`/`bCn`/`zLr`/`sc`) showed that most of what it clears is not the plugin registry at all: `xr().invalidateCommands()`, `xr().markdownFiles.clear()`, `agentDefinitions`, `outputStyleDirStyles`, `allOutputStyles`, `allWorkflows`, `invalidateSkillDirs()`. What is `xr()`, and is it one thing or many?',
  answer: 'The families share the rest of the story as well: the copied bodies that call it — `VT`, `bM`, `Hz`, `_7`, `bCn` — are the invalidation family, whose callees are the W45-40 clears plus `xr()`; they are the next package, now that `xr` exists here.',
  module: 'chunk-qm4226vk.js, 3,516 units in full: `var o="cli"`, `class s` (the store), `pQ`, `fQ`, `var a=new q(()=>new s)`, `function xr(){return a.of(B().host)}` and `export{pQ,fQ,xr}`. Four of the six declarations are copied verbatim (2,728 units, one module): `o` (module-internal, exactly as in the source, which exports only `pQ`, `fQ` and `xr`), the class, and the two helpers. The accessor and its memo are the host boundary, the same lowering W45-40 recorded for the plugin registry: the source builds one store per host under `q(() => new s)` reached through `B().host`, and this product has one host for the process, so `xr()` in the seam builds the singleton lazily under the source\'s own name.',
  what_the_store_holds: [
    'Load caches: markdownFiles, agentDefinitions, outputStyleDirStyles, allOutputStyles, routines, routineCronTasks, allWorkflows — the seven tables the plugin-source re-read drops next to the plugin registry\'s slots.',
    'Command tables: builtinCommandTable, builtinCommandNames, shippedCommandNames (the three `void 0` fields) and loadedCommands, skillToolCommands, slashCommandToolSkills, skillIndex (the four Maps invalidateCommands empties).',
    'Skill tables: bundledSkills, skillDirCommands, skillFiles (a WeakMap), bundledWorkflows, skillContentIntern, plus the per-source-kind dynamicSkillStates keyed by `dynamicSkillStateKey()` = `o` = "cli".',
    'Signals: dynamicSkillsLoaded and skillsChanged, both `Oe()` — the same signal the W45-35 registry literal carries, reused here rather than copied again.',
  ],
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  boundary: {
    range: [3438, 3497],
    text: coverage.boundaryText,
    why: 'The source reaches the store through `var a=new q(()=>new s)` and `function xr(){return a.of(B().host)}`: one store per host, keyed by a context value. This product has one host for the process, so the seam exports `xr()` building the singleton on first use, and `createSourcesRegistry()` for anything that wants its own store (the tests do).',
    verifiedBy: 'the seam header quotes [3438,3497) verbatim, and the record asserts the quoted text is in the seam and equals the module slice',
  },
  reuse: {
    body: '`Oe()` is not copied: src/plugin-chain-registry-stores-source.ts already carries it (W45-35), and the copy imports it under the source\'s own name.',
    why: 'Two signal factories would make `skillsChanged` on this store a different object from the one every ported listener subscribes to, and the store\'s two signals are read through `.emit`/`.subscribe` by other ported modules.',
  },
  copies: {
    product: ['src/plugin-chain-sources-registry-source.ts', 'src/plugin-chain-sources-registry.ts'],
    detail: `plugin-chain-sources-registry-source.ts ${sourcesCopy.blocks} blocks / ${sourcesCopy.units} units of one module; the seam adds no copied block`,
  },
  measured: [
    'The cold store is the class: eighteen named Maps empty, four arrays empty, two Sets empty, the three command tables `undefined`, the four weak containers really weak (`reservedSpellingsByLoadedResult` and `skillFiles` and `builtinPluginWiredSkills` WeakMaps, `loadedResultsMissingTrustedNames` a WeakSet — a string key throws), and both signals live (`emit` is a function).',
    'The dynamic-skill state key is `"cli"`: the class writes it as an arrow over the module constant `o`, and `refusedReservedSkillNames()` answers `[]` when no state exists for it and the state\'s `refusedReservedNames` values when one does.',
    '`invalidateCommands()` sets the three command tables back to `undefined` and empties exactly its four Maps; `markdownFiles` keeps its entry, so the command surface and the load caches are separate.',
    '`invalidateSkillDirs()` empties `skillDirCommands` and, when the current key has a state, that state\'s `conditionalSkills` and `activatedConditionalSkillNames` — the state itself stays. With no state for the key the second half is skipped and nothing throws.',
    '`clearLoadCaches()` is `invalidateCommands()` plus the eight derived tables: after it, all four command Maps, `skillDirCommands` and the seven load caches are empty.',
    '`evictDynamicSkillState("p1")` removes that state and its collision extras and deletes only the `p1:`-prefixed `skillDirCommands` entries — `p1x:one` survives, because the prefix carries the colon.',
    '`reservedSpellingsFor(loaded, build)` memoises per loaded result (one build for two calls, same array back), keyed weakly by the object; `markLoadedResultMissingTrustedNames`/`loadedResultIsMissingTrustedNames` are WeakSet membership.',
    '`pQ` builds once per key and returns the remembered entry; `fQ` maps `null` and `undefined` to `"\\u0000"` and everything else to itself.',
    '`xr()` is one store per process (`xr() === xr()`), and a store from `createSourcesRegistry()` is not it.',
  ],
  behaviour_changed: [
    'The source registry is now a product surface: one store per process, with its eight methods and the two helpers the module exports, typed in ./plugin-chain-sources-registry.ts.',
    '2,728 units left the unported set, and with them chunk-qm4226vk.js has no unported declarations left: the module is one copy plus one recorded host boundary.',
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
    regressions: `the new sources-registry suite 10/10; ${familyLine}`,
    full: fullLine,
    compiled: driverLine,
    smoke,
  },
  next_package: [
    'the invalidation family itself: `VT`, `bM`, `Hz`, `YCn`, `_7` and `bCn` (chunk-sfn1dbxq.js [1675922,1676004), [3393591,3393664), [2476471,2476515), [2091587,2091664), [1706307,1706394)) now that `xr` exists here — six bodies, ~370 units, all of whose callees are ported',
    '`zLr`/`sc` and the async re-read they drive (`D_`, `$5`, `L$`, `fZo`, `Uye`), which is the plugin-source reload rather than the invalidation',
    'the rest of the `$` table beyond the three ui floors, entry by entry',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
    'the registry fields the source\'s literal carries but no ported body reads yet (the hook registry, the marketplaces, the command-producer memos)',
    'the notification context provider itself (`a4n`, chunk-356hrhz3.js [1453,1607)) and the clearTimer context `R` [1431,1432)',
    'documentation hygiene: the evidence docs written through the W45-38/W45-39 route carry a stray backslash before every inline code span (research/ports/W45-chain-runner.md 179 lines, .audit/w45-runtime.todo.md 33, research/CURRENT.md and research/STATUS.md one paragraph each); this package\'s writer emits clean spans',
  ],
};
write('research/ports/W45-sources-registry-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

// Every writer below rewrites its own block instead of stacking a second copy: a re-run over a tree
// that already carries this package's record produces the same documents, bound to the new identity.
const marks = {
  current: 'W45-41 **搬源注册表',
  features: '; W45-41 ports the skill, command and agent source registry',
  standard: '2026-10-16 W45-41 源注册表',
  status: 'W45-41: the source registry.',
  runner: '## W45-41 ported the source registry',
};
/** Drop the previous copy of this package's block: the mark's whole line, the paragraph it starts
 *  (`paragraph`), or everything from that line to the end of the document (the runner doc). */
const stripBlock = (text, mark, { toEnd = false, paragraph = false } = {}) => {
  const at = text.indexOf(mark);
  if (at < 0) return text;
  const start = text.lastIndexOf('\n', at) + 1;
  if (toEnd) return text.slice(0, start);
  const end = paragraph ? text.indexOf('\n\n', at) : text.indexOf('\n', at);
  return text.slice(0, start) + text.slice(end < 0 ? text.length : end + 1);
};

// CURRENT: the W45-41 row above the W45-40 one.
const current = read('research/CURRENT.md');
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-41 **搬源注册表（技能/命令/代理派生表的宿主）chunk-qm4226vk.js 整个模块**（新副本 4 段 2,728 单位，一模块；seam 无新搬运块）：\`o\`（源 kind \`"cli"\`，源自身不导出，按源保持模块内私有）、\`class s\`（45 字段 + 8 方法）、\`pQ\`（按键备忘并构建）、\`fQ\`（可空键归一）；\`var a=new q(()=>new s)\`+\`function xr(){return a.of(B().host)}\` [3438,3497) 为**宿主边界**——源按 host 建店，本产品一进程一 host，seam 以源自身名字 \`xr()\` 惰性建单例，另给 \`createSourcesRegistry()\` 供隔离使用；seam 头注逐字引用该区间，模块覆盖脚本（参数化后）自证 9 条顶层语句全落区内、区外仅 2 import + 1 export。**不重复搬**：\`Oe()\` 复用 W45-35 的权威副本（两份信号工厂会让 \`skillsChanged\` 变成另一个对象）。**该店就是 W45-40 五清所指向的另一半**：装载缓存 \`markdownFiles\`/\`agentDefinitions\`/\`outputStyleDirStyles\`/\`allOutputStyles\`/\`routines\`/\`routineCronTasks\`/\`allWorkflows\`、命令表三字段（\`void 0\`）+ 四 Map、技能表（含 WeakMap \`skillFiles\`）、按源 kind 分区的 \`dynamicSkillStates\`、两个 \`Oe()\` 信号。**实测**：冷店 18 Map/4 数组/2 Set 皆空、三命令表 undefined、**四个弱容器真弱**（字符串键 TypeError）、两信号 \`emit\` 为函数、\`dynamicSkillStateKey()==="cli"\`；\`invalidateCommands\` 三表回 undefined 且只清四 Map（\`markdownFiles\` 保留 1）；\`invalidateSkillDirs\` 清 \`skillDirCommands\` 与当前键状态的 \`conditionalSkills\`/\`activatedConditionalSkillNames\`（状态本身保留），无状态不抛；\`clearLoadCaches\` = 前者 + 八张派生表；\`evictDynamicSkillState("p1")\` 只删 \`p1:\` 前缀（\`p1x:one\` 存活）、状态与碰撞额外项；\`reservedSpellingsFor\` 按对象弱键备忘（两次调用只建一次）、缺失可信名判断为 WeakSet 成员；\`pQ\` 每键只建一次、\`fQ\` 把 null/undefined 归一为 \`"\\u0000"\`；\`xr()\` 进程单例而 \`createSourcesRegistry()\` 不是它。验收：check/build/notices、新副本扫描 \`unresolved 0\`、**${chain}**、模块覆盖自证、新回归 10/10、插件链家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45SourcesRegistryCompiled.v1\`，共 ${driverMarkers.length} 个标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [源注册表证据](ports/W45-sources-registry-evidence.json)、[注册表失效面证据](ports/W45-registry-reset-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const stripped = stripBlock(current, marks.current);
const at = stripped.indexOf(anchor);
if (at < 0) throw new Error('the C-12 row was not found');
write('research/CURRENT.md', stripped.slice(0, at) + row + '\n' + stripped.slice(at));

// FEATURES: the interactive row gains the source registry.
const features = read('research/FEATURES.md').replace(new RegExp(`${marks.features.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^|]*`), '');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('the interactive feature row was not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-41 ports the skill, command and agent source registry — the store holding every derived table the plugin-source re-read invalidates — as one product module with its two helpers, so the invalidation family and the loaders around it have a single place to drop what a folder or marketplace change made stale. |`;
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standard.indexOf('2026-10-16 W45-40 注册表失效面');
if (standardAt < 0) throw new Error('coding-standard W45-40 line not found');
const standardEntry = `2026-10-16 W45-41 源注册表：S-1至S-7已对照。S-1（先读源）：先读"谁在清它"再决定搬什么——\`VT\`/\`bM\`/\`Hz\`/\`_7\`/\`bCn\`/\`zLr\`/\`sc\` 里大半清的是 \`xr()\` 的派生表而非插件注册表，于是本包搬的是 \`chunk-qm4226vk.js\` 整模块（4 段 2,728 单位），访问器按 W45-40 同一判据留作宿主边界（源按 host 建店、本产品一进程一 host）并逐字引用 [3438,3497)；\`Oe()\` 复用 W45-35 副本不重复搬（两份信号工厂会把 \`skillsChanged\` 变成另一个对象）。S-2（不留半包）：类、两助手、单例访问器与隔离工厂一次给全，8 个方法与 45 个字段逐条写入 seam 类型与 evidence（含四个 WeakMap/WeakSet 的"真弱"语义）；下一包（\`VT\`/\`bM\`/\`Hz\`/\`YCn\`/\`_7\`/\`bCn\` 六个体，其被调者现已齐备）写入 seam 与 next_package。S-3：回归先依赖 \`.audit/w45-41-probe.mts\` 量出的取值（冷店形状、四个弱容器字符串键 TypeError、两信号的 emit、命令表回 undefined 且 \`markdownFiles\` 不动、无状态时的 \`invalidateSkillDirs\` 不抛、\`p1:\` 前缀边界、弱键备忘只建一次、\`fQ\` 归一），再按"只清自己那几张表"断言。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器/模块覆盖/打包冒烟/${drivers.length} 个编译驱动并解析输出，\`ported\` 由 ledger 读回；模块覆盖脚本参数化后同时服务两个模块（默认仍是 W45-40 的 chunk-3ph567jx.js）。S-5/S-6：seam 只做命名与类型，无死导出；\`o\` 按源保持模块内私有（源自身也不导出）。S-7：失效家族、\`zLr\`/\`sc\` 与其异步重读、\`$\` 表余项、Q-086、流式 provider、通知 Provider、文档反斜杠清理写入 next_package。验收：check/build/notices、扫描 unresolved 0、${chain}、模块覆盖自证、回归 10/10、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-41 paragraph above the W45-40 one.
const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf("W45-40: the registry's invalidation surface");
if (statusAt < 0) throw new Error('STATUS W45-40 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-41: the source registry. Following W45-40's five clears to their callers showed that most of what the plugin-source re-read drops is not the plugin registry at all: \`xr().invalidateCommands()\`, \`xr().markdownFiles.clear()\`, the agent, output-style and workflow tables. \`xr()\` is chunk-qm4226vk.js, a 3,516-unit module that is one class: the store of everything derived from folders, marketplaces and builtins — seven load caches, the command tables behind three \`void 0\` fields and four Maps, the skill tables (one of them weak), a per-source-kind dynamic-skill state keyed by the module constant \`"cli"\`, and two live signals reusing the ported \`Oe()\`. Four declarations are copied verbatim (2,728 units), and the accessor with its per-host memo is the host boundary: the seam builds the singleton lazily under the source's own name and offers a factory for isolated stores. Measured before asserted: the cold store's eighteen empty Maps, four arrays, two Sets and four genuinely weak containers (a string key throws); the three command tables \`undefined\`; \`invalidateCommands\` emptying exactly its four Maps while \`markdownFiles\` keeps its entry; \`invalidateSkillDirs\` clearing the current key's conditional tables and doing nothing when the key has no state; \`clearLoadCaches\` as the command invalidation plus the eight derived tables; \`evictDynamicSkillState\` deleting only the \`p1:\` prefix so \`p1x:one\` survives; and the weak-keyed memo answering one build for two calls. Evidence: \`research/ports/W45-sources-registry-evidence.json\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-41 section.
const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-41 ported the source registry (2026-10-16)

W45-40 ended with five clears that all named the same unknown: \`xr()\`. Reading the plugin-source re-read
(\`VT\`, \`bM\`, \`Hz\`, \`_7\`, \`bCn\`, \`zLr\`, \`sc\`) showed that most of what it drops is not the plugin
registry but a second store — the derived tables for markdown files, agent definitions, output styles,
workflows, commands and skills. That store is chunk-qm4226vk.js in full: 3,516 units, one class with
forty-five fields and eight methods, two helpers, and a per-host memo.

Four declarations are copied verbatim into src/plugin-chain-sources-registry-source.ts (4 blocks, 2,728
units): \`o\` (the \`"cli"\` source kind, module-internal exactly as in the source), the class, \`pQ\` and
\`fQ\`. The accessor is the host boundary, the same lowering W45-40 recorded: the source reaches the
store through \`var a=new q(()=>new s)\` and \`function xr(){return a.of(B().host)}\`, one store per host,
and this product has one host for the process, so src/plugin-chain-sources-registry.ts exports \`xr()\`
building the singleton on first use, plus \`createSourcesRegistry()\` for isolated stores. The module is
fully accounted for: nine top-level statements, one ledger's ranges plus the boundary, the only
statements outside being its two imports and its export list. \`Oe()\` is not copied again — W45-35's
copy is the authority, because two signal factories would make \`skillsChanged\` a different object from
the one other ported listeners subscribe to.

Behaviour, measured in .audit/w45-41-probe.mts before any assertion: the cold store's eighteen Maps,
four arrays, two Sets and two signals, with the four weak containers really weak (a string key throws);
\`dynamicSkillStateKey()\` = \`"cli"\`; \`invalidateCommands\` putting the three command tables back to
\`undefined\` and emptying its four Maps while \`markdownFiles\` keeps its entry; \`invalidateSkillDirs\`
clearing the current key's conditional tables and skipping the second half when the key has no state;
\`clearLoadCaches\` as that invalidation plus the eight derived tables; \`evictDynamicSkillState("p1")\`
deleting the \`p1:\` prefix only (\`p1x:one\` survives) with the state and its collision extras;
\`reservedSpellingsFor\` memoising per loaded result by weak identity; and \`fQ\` mapping both null and
undefined to \`"\\u0000"\`.

Verified: check/build/notices, the new copy \`unresolved 0\`, ${chain}, the module coverage check, the
new suite 10/10, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers (the shared driver
now also prints \`W45SourcesRegistryCompiled.v1\`), and the packaged smoke (${smoke}). Identity
\`${short}…\` (read from scripts/identity.mjs by the record script itself, which asserts the counts).

Next: the invalidation family — \`VT\`, \`bM\`, \`Hz\`, \`YCn\`, \`_7\` and \`bCn\`, six bodies whose callees are
now all ported, with \`zLr\`/\`sc\` and the async reload behind them after that.
`);

const rows = [
  ['2026-10-16T17:44:00Z', 'package', `W45-41 搬源注册表 chunk-qm4226vk.js 整个模块（新副本 4 段 2,728 单位；seam 无新搬运块）`,
    '技能/命令/代理派生表的宿主成为产品面：8 方法 45 字段、单例访问器 xr() 与隔离工厂',
    `chunk-qm4226vk.js [710,722) o、[722,3319) class s、[3319,3406) pQ、[3406,3438) fQ；宿主边界 [3438,3497)（var a / function xr）；复用 W45-35 的 Oe`,
    `实测（.audit/w45-41-probe.mts）：冷店 18 Map/4 数组/2 Set 空、四弱容器真弱（字符串键 TypeError）、两信号 emit、键 "cli"；invalidateCommands 三表回 undefined 且 markdownFiles 保留；invalidateSkillDirs 无状态不抛；clearLoadCaches 九表全空；evict 只删 p1: 前缀（p1x:one 存活）；弱键备忘只建一次；fQ 归一 \\u0000；test/plugin-chain-sources-registry.test.ts 10/10`],
  ['2026-10-16T17:52:00Z', 'finding', 'W45-41 把 W45-40 的"下一包"改判：失效家族清的主要不是插件注册表，而是第二个店',
    'W45-40 头注把 bM/zLr/_7/bCn 记为"调用五清的组合"，读原文才见 zLr/sc/_7/bCn/Hz/VT 大多调 xr() 的派生表（markdownFiles/agentDefinitions/outputStyleDirStyles/allOutputStyles/allWorkflows/invalidateCommands/invalidateSkillDirs）',
    '先读被调者再定包：本包搬 xr() 背后的整个模块（chunk-qm4226vk.js），把六个调用体（VT/bM/Hz/YCn/_7/bCn，约 370 单位，被调者现已齐备）留作下一包，并写入 seam 与 next_package；W45-40 头注里的组合描述保留为"调用点"证据不改写',
    'seam 头注与 evidence.next_package 首条写明六个体与其区间；模块覆盖脚本参数化后同时服务两个模块'],
  ['2026-10-16T18:00:00Z', 'finding', 'W45-41 记录两处不重复搬与一处"真弱"约束：Oe() 复用、o 按源保持私有、四个弱容器不能被当 Map 用',
    '两份信号工厂会让 skillsChanged 变成另一个对象（其他已搬监听者订阅的是 W45-35 的那份）；源自身只导出 pQ/fQ/xr，o 是模块内部量；reservedSpellingsByLoadedResult/skillFiles/builtinPluginWiredSkills 是 WeakMap、loadedResultsMissingTrustedNames 是 WeakSet——初版 seam 类型与探针把它们当 Map/Set，字符串键直接 TypeError',
    'Oe 由副本从 ./plugin-chain-registry-stores-source.js 导入；o 复制但不导出；seam 接口按源逐字段定型（Weak* 原样），探针用对象键并专门断言字符串键抛错，回归同样钉住',
    'check 通过；探针 TypeError 已在断言前观察到；回归 10/10、家族 154/154、全量 1430/1430'],
  ['2026-10-16T18:08:00Z', 'verification', `W45-41 验收：新副本扫描 unresolved 0、模块覆盖自证、${chain}、回归 10/10、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '源注册表收束，下一包是调用它的失效家族六个体',
    `check/build/notices；扫描 unresolved 0；模块覆盖（${coverage.topLevelStatements} 顶层语句 / ${coverage.coveredRanges.length} 区间 / 区外 ${coverage.wiringOutside.length} 条 import-export）；${chain}；新回归 10/10；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45SourcesRegistryCompiled.v1，共 ${driverMarkers.length} 个标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-41 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-41 acceptance (2026-10-16)

- [x] **The store is a product surface.** One store per process through \`xr()\`, an isolated \`createSourcesRegistry()\`, its eight methods and the two helpers the module exports, all typed in ./plugin-chain-sources-registry.ts.
- [x] **What could be copied was copied.** Four declarations (2,728 units of one module) go into a generated copy with a per-block ledger, verified by the chain verifier (${chain}) and scanned \`unresolved 0\`.
- [x] **The host boundary is recorded, not hidden.** The per-host memo and the accessor are quoted verbatim in the seam header, and the record asserts that quote equals the module slice.
- [x] **The module is complete, and the proof is derived.** Every top-level statement of chunk-qm4226vk.js falls inside a ledger range or the boundary; only its two imports and its export list do not.
- [x] **Nothing was copied twice.** \`Oe()\` stays W45-35's copy, because two signal factories would make \`skillsChanged\` a different object from the one the ported listeners subscribe to; \`o\` stays module-internal exactly as the source has it.
- [x] **The types match the source.** Four containers are weak and the seam says so; the probe observed a string key throwing before the tests asserted it.
- [x] **Everything measured before it was asserted.** .audit/w45-41-probe.mts printed the cold shape, each method's own tables, the prefix boundary in \`evictDynamicSkillState\`, the weak-keyed memo and the helpers; the assertions follow those numbers.
- [x] **The next package is named from the source.** The six invalidation bodies whose callees are now all ported are recorded with their ranges in the seam and in \`next_package\`.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\`, ${chain}, module coverage, new suite 10/10, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
