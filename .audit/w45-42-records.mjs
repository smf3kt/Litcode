// Write the W45-42 package record from the artifacts themselves: the invalidation calls, the four
// bodies they copy, and the two family members that are still blocked.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 359, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 138, `validation ${identity.validation.files}`);
expect(identity.build.files === 249, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 43) throw new Error('the chain verifier did not pass 43 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const invalidateCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-invalidate-source.ts'));
if (!invalidateCopy || invalidateCopy.blocks !== 4) throw new Error('the invalidation copy is not the 4-block one');

const ledger = JSON.parse(read('src/plugin-chain-invalidate-source-blocks.json'));
if (ledger.blocks.length !== 4) throw new Error('the invalidation ledger does not hold four blocks');
const scan = execFileSync(process.execPath, ['scripts/source-undeclared-scan.mjs', 'src/plugin-chain-invalidate-source.ts'], { encoding: 'utf8' });
if (!/unresolved 0/.test(scan)) throw new Error('the invalidation copy has unresolved names');

// The blocked pair is named from the source, not from memory: the record reads `VT`'s callee out of the
// module and asserts the store it needs is absent from the product.
const sfn = read('extracted-v2/modules/chunk-sfn1dbxq.js');
if (!sfn.includes('function VT(){xr().invalidateCommands(),BEo()}')) throw new Error('`VT` is not the body this record names');
if (!sfn.includes('function bM(){VT(),Nhr(),Fhr(),Hz()}')) throw new Error('`bM` is not the body this record names');
const helpers = read('extracted-v2/modules/chunk-x0dc37w9.js');
if (!helpers.includes('function BEo(){return MR(M()).shadowedHelperSources}')) throw new Error('`BEo` is not the body this record names');
// Comments may name it — the seam documents the block — but no product file may *carry* it, so the
// check reads the code rather than the prose.
const codeOf = (text) => text.split('\n')
  .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
const carriers = fs.readdirSync('src').filter((name) => name.endsWith('.ts'))
  .filter((name) => codeOf(read(`src/${name}`)).includes('shadowedHelperSources'));
if (carriers.length) {
  throw new Error(`the helpers store turned up in the product after all (${carriers.join(', ')}): \`VT\` and \`bM\` are no longer blocked`);
}
const blocked = '`VT` `xr().invalidateCommands(),BEo()` [1675922,1675968) and `bM` `VT(),Nhr(),Fhr(),Hz()` [1675968,1676004) wait on `BEo` = `MR(M()).shadowedHelperSources` (chunk-x0dc37w9.js [93890,93942)), and `shadowedHelperSources` is in no product file';

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^\\u2139 ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-42-tests.txt');
if (full.failed !== 0 || !Number.isInteger(full.tests)) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-42-family.txt');
if (family.failed !== 0) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;

const smokeReport = read('.audit/w45-42-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
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
if (!driverMarkers.includes('W45InvalidateCompiled.v1')) throw new Error('the shared driver did not print the W45-42 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45InvalidateCompiled.v1 (${driverMarkers.length} markers in all: it drives all four calls against dist on both registries and checks each one twice)`;

const evidence = {
  schema: 'W45InvalidateEvidence.v1',
  package: 'W45-42 — the invalidation calls: the four bodies that drop a source kind\'s derived tables when its sources change',
  date: '2026-10-16',
  question: 'W45-41 ended by naming the invalidation family as the next package: `VT`, `bM`, `Hz`, `YCn`, `_7` and `bCn` in chunk-sfn1dbxq.js, six bodies whose callees were now all ported. Are all six copyable, or do some of them reach further than the two registries?',
  answer: 'Four are copyable and copied verbatim (281 units): `Hz` (the skill dirs and markdown files), `YCn` (the plugin registry\'s hook-registration slot), `_7` (the agent definitions with the markdown files and the agents slot) and `bCn` (the output-style dir styles with the markdown files and the styles slot). The other two are not, and the reason is read from the source rather than assumed: `VT()` is `xr().invalidateCommands(),BEo()`, and `BEo` is `MR(M()).shadowedHelperSources` in chunk-x0dc37w9.js — `M()` is the per-host config record and `shadowedHelperSources` is in no product file. Copying `VT` verbatim would need a `BEo` this product cannot supply, and supplying one that returns nothing would decide for the source what "shadowed helper sources" means, so `VT` and the `bM` that calls it are recorded as blocked rather than guessed at.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  blocked,
  reuse: {
    body: 'No callee was copied again: `$hr`/`Uhr` come from W45-40\'s copy of the plugin registry\'s clears, `it` from ./plugin-chain-host.ts and `xr` from W45-41\'s seam.',
    why: 'The two accessors are the per-process singletons the W45-40 and W45-41 packages established; a second copy of the clears would empty a second registry that nothing reads, and the point of these four bodies is that they empty the ones the product uses.',
  },
  copies: {
    product: ['src/plugin-chain-invalidate-source.ts', 'src/plugin-chain-invalidate.ts'],
    detail: `plugin-chain-invalidate-source.ts ${invalidateCopy.blocks} blocks / ${invalidateCopy.units} units of one module; the seam adds no copied block`,
  },
  measured: [
    'Each call moves its own names and no others, with every watched name seeded first: `invalidateSkillSources` drops `skillDirCommands` and `markdownFiles`; `clearHookRegistration` clears exactly `plugin.hookRegistration`; `invalidateAgentSources` drops `agentDefinitions`, `markdownFiles` and `plugin.agents`; `invalidateOutputStyleSources` drops `outputStyleDirStyles`, `markdownFiles` and `plugin.outputStyles`.',
    'A second call of each changes nothing more, so the four are idempotent on an already-cleared set.',
    'The skills call also clears the current key\'s conditional tables (`conditionalSkills`, `activatedConditionalSkillNames`) and leaves `refusedReservedNames` alone — the skill invalidation is the one that reaches into the per-source-kind state.',
    '`builtinCommandTable` survives all four: the command surface belongs to `VT`, which is blocked, so the one source table no ported call drops is the command table.',
    'The hook slot lives in the plugin registry and not in a source table: `clearHookRegistration` leaves `markdownFiles` with its entry while the three source calls drop it.',
  ],
  behaviour_changed: [
    'Four invalidation calls are now product surface: a caller can drop a source kind\'s derived tables through named wrappers instead of poking the stores.',
    '281 units left the unported set; the two remaining members of the same family are recorded with the exact callee that blocks them.',
    'No product file changed behaviour on another path: the seam is additive, and the only edits outside it are the verifier registering the new plan and the shared driver printing its marker.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'the new copy: unresolved 0',
    chain_verifier: chain,
    blocked_check: 'the record re-reads both source bodies and asserts no product file carries `shadowedHelperSources`',
    regressions: `the new invalidation suite 6/6; ${familyLine}`,
    full: fullLine,
    compiled: driverLine,
    smoke,
  },
  next_package: [
    'the helpers/config store behind `BEo`: `M()` (chunk-x0dc37w9.js [86914,87558), 644 units, the per-host config record) and `MR`, which is what unblocks `VT` and `bM`',
    '`zLr`/`sc` and the async re-read they drive (`D_`, `$5`, `L$`, `fZo`, `Uye`), which is the plugin-source reload rather than the invalidation',
    'the rest of the `$` table beyond the three ui floors, entry by entry',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
    'the registry fields the source\'s literal carries but no ported body reads yet (the hook registry, the marketplaces, the command-producer memos)',
    'the notification context provider itself (`a4n`, chunk-356hrhz3.js [1453,1607)) and the clearTimer context `R` [1431,1432)',
    'documentation hygiene: the evidence docs written through the W45-38/W45-39 route carry a stray backslash before every inline code span (research/ports/W45-chain-runner.md 179 lines, .audit/w45-runtime.todo.md 33, research/CURRENT.md and research/STATUS.md one paragraph each); the writers since then emit clean spans',
  ],
};
write('research/ports/W45-invalidate-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-42 **搬失效调用',
  features: '; W45-42 ports the invalidation calls',
  standard: '2026-10-16 W45-42 失效调用',
  status: 'W45-42: the invalidation calls.',
  runner: '## W45-42 ported the invalidation calls',
};
const stripBlock = (text, mark, { toEnd = false, paragraph = false } = {}) => {
  const at = text.indexOf(mark);
  if (at < 0) return text;
  const start = text.lastIndexOf('\n', at) + 1;
  if (toEnd) return text.slice(0, start);
  const end = paragraph ? text.indexOf('\n\n', at) : text.indexOf('\n', at);
  return text.slice(0, start) + text.slice(end < 0 ? text.length : end + 1);
};

// CURRENT: the W45-42 row above the W45-41 one.
const current = stripBlock(read('research/CURRENT.md'), marks.current);
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-42 **搬失效调用四体**（新副本 4 段 281 单位，一模块；seam 无新搬运块）：\`Hz()\`（技能目录 \`skillDirCommands\` + \`markdownFiles\`）、\`YCn()\`（插件注册表 \`hookRegistration\` 槽）、\`_7()\`（\`agentDefinitions\` + \`markdownFiles\` + 插件注册表 \`agents\` 槽）、\`bCn()\`（\`outputStyleDirStyles\` + \`markdownFiles\` + \`outputStyles\` 槽）逐字搬运；**零新依赖**：\`$hr\`/\`Uhr\` 取自 W45-40 副本、\`it\` 取自宿主、\`xr\` 取自 W45-41 seam。**同族另两体明确留待**：\`VT()\` = \`xr().invalidateCommands(),BEo()\` 与 \`bM()\` = \`VT(),Nhr(),Fhr(),Hz()\`，其 \`BEo\` = \`MR(M()).shadowedHelperSources\`（chunk-x0dc37w9.js [93890,93942)，\`M()\` 为 per-host 配置记录 [86914,87558) 644 单位）——\`shadowedHelperSources\` 在产品任何文件里都不存在，硬搬需产品无法提供的 \`BEo\`，而"返回空"等于替源决定 shadowed helper sources 的含义，故记录为阻塞而非猜测（记录脚本重读两段源文并断言产品中确无该名）。**实测**（先量后断）：四体各自只动自己的名字（种满所有被观察名后逐一比对），第二次调用皆为空操作；技能失效另清当前键的 \`conditionalSkills\`/\`activatedConditionalSkillNames\` 而保留 \`refusedReservedNames\`；\`builtinCommandTable\` 四体皆不动（命令面属被阻塞的 \`VT\`）；\`markdownFiles\` 被三个源调用清掉而 \`YCn\` 不动它（钩子槽在插件注册表而非源表）。验收：check/build/notices、新副本扫描 \`unresolved 0\`、**${chain}**、阻塞判定自证、新回归 6/6、插件链家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45InvalidateCompiled.v1\`，共 ${driverMarkers.length} 个标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [失效调用证据](ports/W45-invalidate-evidence.json)、[源注册表证据](ports/W45-sources-registry-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('the C-12 row was not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the invalidation calls.
const features = read('research/FEATURES.md').replace(new RegExp(`${marks.features.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^|]*`), '');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('the interactive feature row was not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-42 ports the invalidation calls that follow a source change: four verbatim bodies that drop a source kind's derived tables and the slots the plugin registry keeps for it, so a skills, agents or output-styles change can stale exactly what it invalidated. |`;
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standard.indexOf('2026-10-16 W45-41 源注册表');
if (standardAt < 0) throw new Error('coding-standard W45-41 line not found');
const standardEntry = `2026-10-16 W45-42 失效调用：S-1至S-7已对照。S-1（先读源）：六体里四体可搬（被调者全在），两体（\`VT\`/\`bM\`）不搬——先读出 \`VT\` 的第二个被调 \`BEo\`=\`MR(M()).shadowedHelperSources\`（chunk-x0dc37w9.js [93890,93942)），再核对产品中确无 \`shadowedHelperSources\`，故记录为阻塞并写明"返回空即替源决定语义"；记录脚本重读两段源文并断言产品里没有该名字，阻塞判定会随产品变化自动失效报警。S-2（不留半包）：四体一次给全并各带包装；被阻塞的两体与其精确被调写入 seam 头注、\`blocked\` 与 next_package 首条（helpers/config store：\`M()\` [86914,87558)）。S-3：回归先依赖 \`.audit/w45-42-probe.mts\` 量出的取值（种满所有观察名后逐一比对"只动自己的名字"、第二次为空操作、条件表被清而 \`refusedReservedNames\` 保留、\`builtinCommandTable\` 不动、\`YCn\` 不动 \`markdownFiles\`），再断言集合相等而非逐个真值，避免"改错了一个也过"。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器/打包冒烟/${drivers.length} 个编译驱动并解析输出，\`ported\` 由 ledger 读回，阻塞判定自证。S-5/S-6：seam 只做命名（四个包装各自说明其存在理由），无死导出；不重复搬 \`$hr\`/\`Uhr\`/\`it\`/\`xr\`。S-7：helpers/config store（解锁 \`VT\`/\`bM\`）、\`zLr\`/\`sc\` 与异步重读、\`$\` 表余项、Q-086、流式 provider、通知 Provider、文档反斜杠清理写入 next_package。验收：check/build/notices、扫描 unresolved 0、${chain}、阻塞判定自证、回归 6/6、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-42 paragraph above the W45-41 one.
const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf('W45-41: the source registry.');
if (statusAt < 0) throw new Error('STATUS W45-41 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-42: the invalidation calls. W45-41 named this family, and reading the six bodies showed that four stand on their own: \`Hz\` (skill dirs and markdown files), \`YCn\` (the plugin registry's hook-registration slot), \`_7\` (agent definitions with the markdown files and the agents slot) and \`bCn\` (output-style dir styles with the markdown files and the styles slot). All four are copied verbatim, 281 units, with no new callee: \`$hr\` and \`Uhr\` come from W45-40's copy, \`it\` from the host and \`xr\` from W45-41's seam. The other two are blocked and the block is read from the source rather than assumed: \`VT()\` is \`xr().invalidateCommands(),BEo()\`, and \`BEo\` is \`MR(M()).shadowedHelperSources\` in chunk-x0dc37w9.js, where \`M()\` is the per-host config record; \`shadowedHelperSources\` appears in no product file, so supplying a \`BEo\` that returns nothing would decide for the source what shadowed helper sources mean. The record re-reads both bodies and asserts the name is still absent, so the day that store is ported the record's own check fails and the pair moves back into scope. Measured before asserted, with every watched name seeded: each call moves exactly its own names and nothing else, a second call changes nothing more, the skills call also clears the current source kind's conditional tables while leaving its refused names, the command table survives all four because its invalidation is the blocked one, and the hook call leaves the markdown files alone while the three source calls drop them. Evidence: \`research/ports/W45-invalidate-evidence.json\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-42 section.
const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-42 ported the invalidation calls (2026-10-16)

Four of the six bodies W45-41 queued are now product surface, copied verbatim into
src/plugin-chain-invalidate-source.ts (4 blocks, 281 units) behind named wrappers in
src/plugin-chain-invalidate.ts: \`invalidateSkillSources\` (Hz), \`clearHookRegistration\` (YCn),
\`invalidateAgentSources\` (_7) and \`invalidateOutputStyleSources\` (bCn). Nothing new had to be ported
for them — the plugin registry's clears come from W45-40's copy, its accessor from the host, and the
source registry's accessor from W45-41's seam.

The other two wait, and the record says why in the source's own terms. \`VT()\` is
\`xr().invalidateCommands(),BEo()\`, and \`BEo\` is \`MR(M()).shadowedHelperSources\` in chunk-x0dc37w9.js,
where \`M()\` is the per-host config record (644 units). \`shadowedHelperSources\` is in no product file,
so copying \`VT\` verbatim would need a \`BEo\` that does not exist here, and a stub returning an empty
table would decide for the source what shadowed helper sources mean. \`bM()\` calls \`VT()\`, so both wait
on the helpers/config store; the record script re-reads both bodies and asserts the name is still
absent from the product, which makes the blocked verdict expire on its own.

Behaviour, measured in .audit/w45-42-probe.mts before any assertion, with every watched name seeded
first: each call moves exactly its own names and no others; a second call is a no-op; the skills call
also clears the current source kind's conditional tables and leaves its refused names; the command
table survives all four, because the command surface belongs to the blocked \`VT\`; and the hook call
leaves the markdown files alone while the three source calls drop them.

Verified: check/build/notices, the new copy \`unresolved 0\`, ${chain}, the blocked verdict's own check,
the new suite 6/6, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers (the shared
driver now also prints \`W45InvalidateCompiled.v1\`), and the packaged smoke (${smoke}). Identity
\`${short}…\` (read from scripts/identity.mjs by the record script itself, which asserts the counts).

Next: the helpers/config store behind \`BEo\` (\`M()\` and \`MR\`), which unblocks the last two members of
this family.
`);

const rows = [
  ['2026-10-16T18:36:00Z', 'package', `W45-42 搬失效调用四体（新副本 4 段 281 单位；seam 无新搬运块）`,
    'Hz/YCn/_7/bCn 成为产品面，零新依赖；同族 VT/bM 记录为阻塞',
    `chunk-sfn1dbxq.js [3393591,3393664) Hz、[2476471,2476515) YCn、[2091587,2091664) _7、[1706307,1706394) bCn；复用 $hr/Uhr（W45-40）、it（宿主）、xr（W45-41 seam）`,
    `实测（.audit/w45-42-probe.mts）：四体各只动自己的名字、第二次空操作、技能失效清条件表留 refusedReservedNames、builtinCommandTable 四体皆不动、YCn 不动 markdownFiles；test/plugin-chain-invalidate.test.ts 6/6`],
  ['2026-10-16T18:44:00Z', 'finding', 'W45-42 判定 VT/bM 阻塞并写成可过期断言：BEo 需要产品没有的 shadowedHelperSources',
    'VT 的第二被调 BEo = MR(M()).shadowedHelperSources（chunk-x0dc37w9.js [93890,93942)），M() 是 per-host 配置记录；产品 src 全树无 shadowedHelperSources；"返回空表"等于替源决定该语义',
    '不搬 VT/bM，把被调链、区间与理由写进 seam 头注、evidence.blocked 与 next_package 首条；记录脚本重读两段源文并断言产品中确无该名——该店一旦被搬，断言即失败并迫使重新评估',
    'check/build 通过；阻塞判定自证通过（源文两处匹配 + 产品无该名）；回归 6/6、家族 160/160、全量 1436/1436'],
  ['2026-10-16T18:52:00Z', 'finding', 'W45-42 记录两处"只动自己的名字"式断言与命令面的归属：命令表属被阻塞的 VT',
    '逐个真值断言会漏判"改错了一个也过"；命令面（builtinCommandTable 及四张命令 Map）由 VT 清，而 VT 被阻塞，故四体皆不应动它',
    '回归改为先种满所有被观察名再按"清空集合相等"断言；另加一条专测断言 builtinCommandTable 恒为 marker，把"命令面未被本包覆盖"钉在测试里而不是注释里',
    '回归 6/6（含该专测）；探针输出与断言集合一致'],
  ['2026-10-16T18:58:00Z', 'verification', `W45-42 验收：新副本扫描 unresolved 0、阻塞判定自证、${chain}、回归 6/6、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '失效调用收束，下一包是解锁 VT/bM 的 helpers/config store',
    `check/build/notices；扫描 unresolved 0；${chain}；阻塞判定（重读 VT/bM/BEo 三段源文 + 产品无 shadowedHelperSources）；新回归 6/6；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45InvalidateCompiled.v1，共 ${driverMarkers.length} 个标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-42 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-42 acceptance (2026-10-16)

- [x] **The copyable members are product surface.** Four wrappers, each calling one verbatim body, so a skills, agents or output-styles change can stale exactly what it invalidated.
- [x] **What could be copied was copied.** Four bodies (281 units of one module) go into a generated copy with a per-block ledger, verified by the chain verifier (${chain}) and scanned \`unresolved 0\`.
- [x] **Nothing new was ported to make them work.** \`$hr\`/\`Uhr\` are W45-40's, \`it\` is the host's, \`xr\` is W45-41's — the record names each one rather than copying a second instance.
- [x] **The blocked pair is blocked on evidence, not on mood.** The record re-reads \`VT\`, \`bM\` and \`BEo\` in the source and asserts no product file carries \`shadowedHelperSources\`, so the verdict expires by itself when that store is ported.
- [x] **No behaviour was invented for the blocked pair.** A \`BEo\` returning an empty table would decide for the source what shadowed helper sources mean; the seam says so where a reader meets the gap.
- [x] **Everything measured before it was asserted.** .audit/w45-42-probe.mts seeded every watched name and printed what each call moved, including the conditional tables, the surviving command table and the untouched markdown files under the hook call.
- [x] **The uncovered surface is pinned in a test.** The command table must stay a marker through all four calls, which is how "the command invalidation is still unported" stays visible.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\`, ${chain}, the blocked check, new suite 6/6, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
