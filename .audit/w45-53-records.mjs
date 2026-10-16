// Write the W45-53 record from the artifacts themselves: the `$` table's `settings.read`, its four
// copied bodies, and the bounded settings-store hook the seam reads through.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 391, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 148, `validation ${identity.validation.files}`);
expect(identity.build.files === 272, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 52) throw new Error('the chain verifier did not pass 52 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const copy = verifier.files.find((file) => file.product.endsWith('plugin-chain-settings-read-source.ts'));
if (!copy || copy.blocks !== 4 || copy.units !== 449) throw new Error('the settings-read copy is not the 4-block, 449-unit one');

const ledger = JSON.parse(read('src/plugin-chain-settings-read-source-blocks.json'));
if (ledger.blocks.length !== 4) throw new Error('the settings-read ledger does not hold four blocks');
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 449) throw new Error(`the ledger holds ${units} units`);
if (new Set(ledger.blocks.map((block) => block.module)).size !== 1) throw new Error('the ledger is no longer one module');
const scan = execFileSync(process.execPath, ['scripts/source-undeclared-scan.mjs', 'src/plugin-chain-settings-read-source.ts'], { encoding: 'utf8' });
if (!/unresolved 0/.test(scan)) throw new Error('the settings-read copy has unresolved names');

// Every block is re-read from its module, compared with the ledger, searched for in the copy, and
// checked against acorn: each one has to be a whole top-level statement, and no two may overlap.
// The four ranges are explicit rather than needle-resolved: this module's top-level map cannot be
// walked reliably (the same 60k-line-chunk limitation W45-51 recorded for chunk-gyf58rwf.js).
const moduleText = read('extracted-v2/modules/chunk-sfn1dbxq.js');
let tree;
try { tree = acorn.parse(moduleText, { ecmaVersion: 'latest', sourceType: 'module' }); }
catch { tree = acorn.parse(moduleText, { ecmaVersion: 'latest', sourceType: 'script' }); }
const statements = new Set(tree.body.map((node) => `${node.start}:${node.end}`));
const copyText = read('src/plugin-chain-settings-read-source.ts');
const seen = new Set();
for (const block of ledger.blocks) {
  const [start, end] = block.range;
  if (end - start !== block.units) throw new Error(`${block.range} is not ${block.units} units`);
  const body = moduleText.slice(start, end);
  if (!statements.has(`${start}:${end}`)) throw new Error(`chunk-sfn1dbxq.js ${JSON.stringify(block.range)} is not a whole top-level statement`);
  if (seen.has(start)) throw new Error(`chunk-sfn1dbxq.js ${start} is copied twice`);
  seen.add(start);
  if (!copyText.includes(body)) throw new Error(`${block.note.slice(0, 40)} is no longer in the copy`);
}
// The four bodies this record names, located by the text they start with, with the unit counts it states.
for (const [needle, count] of [
  ['var ZH=(e)=>e===void 0?void 0:Y(_(e));', 38],
  ['var J9=Object.freeze({user:"userSettings"', 136],
  ['function hGo(e){let n=e.source;', 89],
  ['function yGo(e){return e===void 0||typeof e==="string"', 186],
]) {
  const block = ledger.blocks.find((entry) => moduleText.slice(...entry.range).startsWith(needle));
  if (!block || block.units !== count) throw new Error(`${needle} is not the ${count}-unit body this record describes`);
}
// What the bodies say, re-read from the source rather than from memory.
const bodyOf = (units) => moduleText.slice(...ledger.blocks.find((b) => b.units === units).range);
if (!bodyOf(89).includes('Promise.resolve(ZH(n===void 0?ft():fe(J9[n]))??{})')) {
  throw new Error('the body no longer reads the merged settings through ft or one source through fe');
}
if (!bodyOf(38).includes('Y(_(e))')) throw new Error('the projection no longer copies through the JSON helpers');
for (const fragment of ['Object.hasOwn(J9,e)', 'Object.keys(J9).join(", ")', 'typeof e==="string"?e:typeof e']) {
  if (!bodyOf(186).includes(fragment)) throw new Error(`the check lost ${fragment}`);
}
if (!bodyOf(136).includes('policy:"policySettings"')) throw new Error('the source map lost its fifth name');

// The entry: the seam quotes it, and the quote is the literal's own text.
const entryText = '"settings.read":{check:(n)=>yGo(n?.source),run:(n)=>hGo(n)}';
if (moduleText.slice(2354546, 2354605) !== entryText) throw new Error('the settings.read entry moved in its module');
const seam = read('src/plugin-chain-settings.ts');
if (!seam.includes(entryText)) throw new Error('the seam no longer quotes the entry');
for (const fragment of ['export function settingsReadEntry()', 'export async function raiseSettingsRead(',
  'export function checkSettingsRead(', 'export function copySettingsValue<T>(', 'export const SETTINGS_SOURCES',
  'check: (n) => checkSettingsRead(n)', 'run: (n) => readSettings(n)']) {
  if (!seam.includes(fragment)) throw new Error(`the seam lost ${fragment}`);
}
// The entry passes the argument's own `source`, not the argument: the checks that depend on that
// distinction are the ones this record measured.
if (!seam.includes('yGo((args as { source?: unknown } | undefined)?.source)')) {
  throw new Error('the check no longer reads the argument\'s source');
}

// The boundary: the seam reads through a hook, and the two bodies it quotes are the module's own text.
const settingsModule = read('extracted-v2/modules/chunk-x0dc37w9.js');
const feText = 'function fe(e){if(CT()&&Tp.has(e))return null;return y9e(e,M())}';
const ftText = 'function ft(){return yg().settings||{}}';
if (settingsModule.slice(88486, 88550) !== feText) throw new Error('fe moved in its module');
if (settingsModule.slice(96865, 96904) !== ftText) throw new Error('ft moved in its module');
const boundary = read('src/plugin-chain-settings-store.ts');
for (const fragment of [feText, ftText, 'export function bindSettingsStore(',
  'export function ft(', 'export function fe(source', 'the settings store is not bound; bindSettingsStore() installs one']) {
  if (!boundary.includes(fragment)) throw new Error(`the settings-store boundary lost ${fragment}`);
}
// The unported reach is named, not silently guessed: the seam records what `fe` needs and why it is a hook.
for (const name of ['CT', 'Tp', 'y9e', 'M()', 'yg()']) {
  if (!boundary.includes(name)) throw new Error(`the boundary no longer names the unported ${name}`);
}

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-53-tests.txt');
if (full.failed !== 0 || full.tests !== 1518) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-53-family.txt');
if (family.failed !== 0 || family.tests !== 242) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const seamSweep = summary('.audit/w45-53-seam.txt');
if (seamSweep.failed !== 0 || seamSweep.tests !== 7) throw new Error('the settings sweep is not clean');

const smokeReport = read('.audit/w45-53-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 280) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const allMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
const sharedMarkers = read('.audit/w45-53-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-53-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45SettingsReadCompiled.v1')) throw new Error('the shared driver did not print the W45-53 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45SettingsReadCompiled.v1 (${sharedMarkers.length} markers in the shared driver, ${allMarkers.length} across every driver: it answers settings.read from the dist copy — the five names, the check's two refusal shapes, the copy the caller gets, the merged answer, the file name the store is asked for, and the refusal this seam owns while the store is unbound)`;

const evidence = {
  schema: 'W45SettingsReadEvidence.v1',
  package: 'W45-53 — the `$` table\'s `settings.read`',
  date: '2026-10-16',
  question: 'What does the `$` table\'s `settings.read` reach? Which sources does it accept, what does it answer, and what does it read through?',
  answer: 'The entry is one table fragment: `check:(n)=>yGo(n?.source)`, `run:(n)=>hGo(n)`. The body reads `e.source`: absent means the merged settings (`ft()`), a name means that source\'s settings file (`fe(J9[source])`), either way projected through `ZH` — a JSON copy, not the store\'s object — and answered as a promise with `{}` for a store that has nothing. The check admits no argument, or a string naming one of `J9`\'s five keys (`user`→userSettings, `project`, `local`, `flag`, `policy`), and refuses everything else with the list and the type it got. The closure this package copied is 4 whole top-level statements, 449 units, all in chunk-sfn1dbxq.js; the entry itself is a table fragment and is ported verbatim into the seam with its span quoted. The settings store the body reads through is not this package: `ft` and `fe` are recorded verbatim in the boundary, which binds a hook in their place.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  boundary: 'src/plugin-chain-settings-store.ts binds the settings store the body reads through. Both bodies are quoted there verbatim: `fe` (chunk-x0dc37w9.js [88486,88550) 64u) — the managed-settings gate `CT()&&Tp.has(e)` answering null, otherwise `y9e(e,M())` — and `ft` ([96865,96904) 39u) — `yg().settings||{}`. Their reach is 205 statements / 66,141 units over 60+ imports, so it is the next package, not this one. The hook is the same seam shape W45-48 and W45-51 used; unlike them the source has no negative branch here to fall through to, so the refusal text (`the settings store is not bound; bindSettingsStore() installs one`) is this seam\'s own and is asserted as such. The five source names, the check, the JSON copy and the entry are the source\'s own — nothing about the entry is invented.',
  measured: [
    'The five source names are the source\'s map: `user`→`userSettings`, `project`→`projectSettings`, `local`→`localSettings`, `flag`→`flagSettings`, `policy`→`policySettings`.',
    'The check admits no argument (`undefined`), an argument with no `source`, and a bare string; it refuses a source that is neither absent nor a known name with `takes { source } naming one of user, project, local, flag, policy (got <name-or-type>)` — a string echoes itself (`got nope`), and anything else reports its type (`got number`, `got object` for both `{}` and `null`).',
    'The argument is read, not the object: the entry passes `n?.source`, so `{}` and `"user"` are admitted while `{source:"nope"}` is not.',
    'The answer is a JSON copy: `undefined` stays `undefined` and `null` stays `null`, but everything else is the value\'s round-trip through the same two helpers the store\'s parse leans on — so a property whose value is `undefined` is dropped (`{source:"bogus"}` reads back as `{}`), and the caller mutating its copy leaves the store untouched.',
    'A value the JSON helpers cannot carry is their own error, thrown synchronously because the store is read before `Promise.resolve` is built: `Converting circular structure to JSON`.',
    'With no source the merged settings come back; with a source the store is asked by file name, in that order: `["projectSettings","flagSettings"]` for `project` then `flag`. A source the store answers `null` for is `{}`, and a name the check would refuse reaches the store as `J9[name] === undefined`.',
    'The entry through the chain: with no handler the call short-circuits to the floor and answers the merged settings — the check never runs, the path W45-20 recorded. With a handler the refusal reaches the caller as `HooksError: settings.read: takes { source } naming one of user, project, local, flag, policy (got bogus) (host check)`, and the chain answers with the handler\'s own wrapper (`{value:{merged:true}}`).',
    'The body has no guard of its own — the check is what guards it, and the no-handler path skips the check — so an absent argument fails inside the body itself: `Cannot read properties of undefined (reading \'source\')`.',
    'While the settings store is unbound the refusal this seam owns is what reaches the caller, with or without a source; the check itself never needs the store.',
  ],
  behaviour_changed: [
    'The `$` table\'s `settings.read` is ported end to end: the entry\'s check and body, the five source names, the JSON copy, and the store call shape (`ft()` for the merged settings, `fe(file)` for one source) are all the source\'s own and are answerable from the product.',
    'The settings store itself is not ported: `src/plugin-chain-settings-store.ts` binds a hook where the source reads `yg().settings` and answers the managed-settings gate. A caller that never binds gets this seam\'s refusal, not a default.',
    'The `settings.read` core is not registered in the product\'s chain catalog: it reaches the chain through `raiseSettingsRead`, which this product has no `$` object to call, the same state the store and ui cores are in. Nothing raises it on its own.',
    'No product file changed behaviour on another path: the only edits outside the new copy, seam, boundary, suite and probes are the plan, the registry entry and the shared driver printing its marker.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'the new copy: unresolved 0',
    chain_verifier: chain,
    ledger_check: 'all 4 ranges are re-read from chunk-sfn1dbxq.js, compared with the ledger, searched for in the copy, and checked against acorn: every block is a whole top-level statement and none is copied twice. The ranges are explicit because this module\'s top-level map cannot be walked reliably — the same 60k-line-chunk limitation W45-51 recorded',
    boundary_check: 'the entry is asserted in the literal at its measured span [2354546,2354605) and in the seam that quotes it; the four bodies are asserted by their opening text and unit counts and re-read for the `Promise.resolve(ZH(n===void 0?ft():fe(J9[n]))??{})`, `Y(_(e))`, `Object.hasOwn(J9,e)`, `Object.keys(J9).join(", ")` and `typeof e==="string"?e:typeof e` fragments; `fe` and `ft` are asserted in chunk-x0dc37w9.js at their spans and in the boundary that quotes them, with the unported names (`CT`, `Tp`, `y9e`, `M()`, `yg()`) and the seam\'s refusal text asserted present',
    regressions: `the new settings suite ${seamSweep.passed}/${seamSweep.tests}; ${familyLine}`,
    full: fullLine,
    compiled: driverLine,
    smoke,
  },
  next_package: [
    'the settings store behind `fe`/`ft` (the `yg()` layer, the managed-settings gate `CT()&&Tp.has(e)` and the file read `y9e(e,M())`) — 205 statements / 66,141 units over 60+ imports, the largest item in the queue, and the one that would replace this package\'s bound hook with the source\'s own bodies',
    'registering the `store.*`, `settings.read` and remaining `ui.*` cores in the product\'s chain catalog once the product has a `$` surface to call them from',
    '`http.fetch` (`VQt`) once the request runner `dNo` is ported',
    '`ui.copy` (`wGo`/`uzo`/`dzo`) once the clipboard encoder `Sv` is ported, with the `stamp` field modelled',
    '`ui.blit` (`fNs`/`kFo`/`mNs`/`bFo`), `ui.scroll` (`O5n`/`L5n`), `ui.focus` (`fzo`/`Szo`), `ui.notify` (`Dzo`/`Fzo`/`Nzo`), each measured the same way first',
    '`fs.ancestors` (`mzt`/`kNs`) and `state.get`/`state.set` (`Jf`/`KD`)',
    'Q-086\'s 15 registry-reading cores and their 34 sites',
    'the notification context provider `a4n` and the clearTimer context `R`',
    'the config/home layer behind `be`: porting it would replace the store file layer\'s bound hook with the source\'s own `bl()`',
  ],
};
write('research/ports/W45-settings-read-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-53 **搬 `$` `settings.read`',
  features: "; W45-53 ports the `$` table's `settings.read`",
  standard: '2026-10-16 W45-53 settings.read',
  status: 'W45-53: the `$` table\'s `settings.read`.',
  runner: '## W45-53 ported `settings.read` over the settings store',
};
const stripBlock = (text, mark, { toEnd = false, paragraph = false } = {}) => {
  const at = text.indexOf(mark);
  if (at < 0) return text;
  const start = text.lastIndexOf('\n', at) + 1;
  if (toEnd) return text.slice(0, start);
  const end = paragraph ? text.indexOf('\n\n', at) : text.indexOf('\n', at);
  return text.slice(0, start) + text.slice(end < 0 ? text.length : end + 1);
};

const current = stripBlock(read('research/CURRENT.md'), marks.current);
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-53 **搬 \`$\` \`settings.read\`**（\`$\` 表里设置读取的唯一入口）：**4 段 449 单位**，全在 chunk-sfn1dbxq.js —— 表项本身 \`"settings.read":{check:(n)=>yGo(n?.source),run:(n)=>hGo(n)}\`（**表片段、逐字入 seam 并引用区间** [2354546,2354605) 59u）+ 四个正体 \`ZH\` [492416,492454) 38u / \`J9\` [2328610,2328746) 136u / \`hGo\` [2328746,2328835) 89u / \`yGo\` [2328835,2329021) 186u（**四段全用显式区间**：该模块 6 万行的顶层映射不可靠遍历，同 W45-51 对 chunk-gyf58rwf.js 的记录）。**链路**：\`hGo\` 读 \`e.source\` —— 无 source 取**合并设置**（\`ft()\`）、有则取该源文件（\`fe(J9[source])\`），一律经 \`ZH\`（\`undefined\` 保持 \`undefined\`，其余走 \`Y(_(e))\` 的 JSON 往返，即**调用方拿到副本、改副本不动仓储**）并包成 promise，仓储没东西则 \`{}\`；\`yGo\` 是检查——**无参数、或无 source、或字符串命中 \`J9\` 五键**（user/project/local/flag/policy → userSettings 等五文件）放行，否则 \`takes { source } naming one of user, project, local, flag, policy (got …)\`（字符串回显自身、其余报类型）。**设置仓储本身不在本包**：\`src/plugin-chain-settings-store.ts\` 把源文 \`fe\`（chunk-x0dc37w9.js [88486,88550) 64u，\`CT()&&Tp.has(e)\` 托管设置闸 + \`y9e(e,M())\`）与 \`ft\`（[96865,96904) 39u，\`yg().settings||{}\`）**逐字引用**并绑定钩子（其闭包 205 语句 / 66,141 单位、60+ import，是下一包）；与 W45-48/W45-51 不同，源在此**没有负分支**可落，故\`the settings store is not bound; bindSettingsStore() installs one\`是**本 seam 自有的拒绝文本**并如实声明。**先测后断言**（.audit/w45-53-probe.ts、-probe2.ts 与 test/plugin-chain-settings.test.ts 7 条）：五源名、检查的三类放行与三类拒绝、**读的是参数的 \`source\` 而非参数对象**（\`{}\` 与 \`"user"\` 放行、\`{source:"nope"}\` 不放行）、副本语义（\`{from:undefined}\` 读回 \`{}\` 因 JSON 往返丢 undefined）、循环引用同步抛 \`Converting circular structure to JSON\`（仓储在 \`Promise.resolve\` 之前被读）、无 source 取合并 / 有 source 按**文件名**问仓储且顺序为 \`["projectSettings","flagSettings"]\` / 仓储答 null 得 \`{}\` / 未知名以 \`undefined\` 问仓储、**链上路徑**（无 handler 短路到 floor 且**不跑检查**——W45-20 记录的路径；装 handler 后拒绝文本为 \`HooksError: settings.read: … (got bogus) (host check)\`，且链以 handler 自己的包装作答 \`{value:{merged:true}}\`）、**正体自身无守卫**（无 handler 时 \`args: undefined\` 在正体内抛 \`Cannot read properties of undefined (reading 'source')\`）、未绑定时本 seam 拒绝文本生效且检查不需要仓储。验收：check/build/notices、新副本扫描 \`unresolved 0\`、**${chain}**、账本 4 段逐段回源+内容比对+**acorn 断言"每段都是完整顶层语句、无重叠"**、表项区间 [2354546,2354605) 与 seam 引文逐字比对、四个正体按首文本与单位数定位并回源断言关键片段、\`fe\`/\`ft\` 在 chunk-x0dc37w9.js 的区间与边界引文双向断言、未搬名（\`CT\`/\`Tp\`/\`y9e\`/\`M()\`/\`yg()\`）与 seam 拒绝文本在边界中存在、新回归 ${seamSweep.passed}/${seamSweep.tests}、插件链家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45SettingsReadCompiled.v1\`，共享 ${sharedMarkers.length} 标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [settings.read 证据](ports/W45-settings-read-evidence.json)、[store 条目证据](ports/W45-store-entry-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('the C-12 row was not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

const features = read('research/FEATURES.md').replace(new RegExp(`${marks.features.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^|]*`), '');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('the interactive feature row was not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-53 ports the \`$\` table's \`settings.read\`: the five source names, the check that admits only them, the JSON copy the caller gets, and the merged-or-one-file read — over a bound settings store while that store remains unported. |`;
write('research/FEATURES.md', lines.join('\n'));

const standard = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standard.indexOf('2026-10-16 W45-52 store 条目与调度器');
if (standardAt < 0) throw new Error('coding-standard W45-52 line not found');
const standardEntry = `2026-10-16 W45-53 settings.read：S-1至S-7已对照。S-1（先读源）：由表项的表层（\`"settings.read":{check:(n)=>yGo(n?.source),run:(n)=>hGo(n)}\`，量区间 [2354546,2354605)）起手，再读 \`hGo\`/\`yGo\`/\`J9\`/\`ZH\` 四个正体，接着按 \`hGo\` 的正文找它读穿的 \`ft\`/\`fe\`，量其闭包（205 语句 / 66,141 单位）后判定为本包边界而非本包内容。S-2（不留半包）：entry+四个正体一次给全；\`ft\`/\`fe\`及其未搬到达（\`CT\`/\`Tp\`/\`y9e\`/\`M\`/\`yg\`）逐字引入 boundary 并写明，**且明确记录"源在此没有负分支、拒绝文本是本 seam 自有的"**，不把自有文本伪装成源文。S-3：\`.audit/w45-53-probe.ts\`/\`-probe2.ts\` 先实测（五源名、检查三类放行/三类拒绝、读 \`source\` 而非参数对象、副本语义与 \`{from:undefined}\` 读回 \`{}\`、循环引用**同步**抛错、按文件名问仓储的顺序、无 handler 短路不跑检查、装 handler 后的拒绝文本与 \`{value:…}\` 包装、\`args:undefined\` 在正体内抛错），再写 7 条断言；首版误把整个 args 传给 \`yGo\`（\`{}\` 被错拒、\`{source:1}\` 报 object），实测后改为传 \`args?.source\`。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器/打包冒烟/${drivers.length} 个编译驱动并解析输出；acorn 断言（完整顶层语句、无重叠、无重复）+ 表项区间与 seam 引文逐字比对 + \`fe\`/\`ft\` 源文与边界引文双向比对 + 四个正体关键片段回源比对，防记忆漂移。S-5/S-6：seam 只做命名与类型收窄（\`SETTINGS_SOURCES\`/\`copySettingsValue\`/\`checkSettingsRead\`/\`readSettings\`/entry/raise），无死导出；boundary 只暴露钩子与两个源文函数（未绑定即拒），未建模面如实记录。S-7：设置仓储本体（\`yg\`/\`CT\`/\`Tp\`/\`y9e\`/\`M\`）、\`$\` 表面注册、\`http.fetch\`、\`ui.copy\`（含 \`stamp\`）、\`ui.blit\`/\`scroll\`/\`focus\`/\`notify\`、\`fs.ancestors\`、\`state.*\`、Q-086、通知 Provider、config/home 层写入 next_package。验收：check/build/notices、扫描 unresolved 0、${chain}、账本与边界自证、回归 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf('W45-52: the store entry and its dispatcher.');
if (statusAt < 0) throw new Error('STATUS W45-52 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-53: the \`$\` table's \`settings.read\`. The entry is one table fragment — \`check:(n)=>yGo(n?.source)\`, \`run:(n)=>hGo(n)\` — and the body behind it reads \`e.source\`: absent means the merged settings through \`ft()\`, a name means that source's file through \`fe(J9[source])\`, either way projected through \`ZH\`, which is a JSON copy rather than the store's own object, and answered as a promise with \`{}\` for a store that has nothing. The check admits no argument, an argument with no source, or a string naming one of the five keys (\`user\`/\`project\`/\`local\`/\`flag\`/\`policy\`), and refuses the rest with the list and the type it got. Four whole top-level statements, 449 units, all in chunk-sfn1dbxq.js; the ranges are explicit because that module's top-level map cannot be walked reliably — the same limitation W45-51 recorded for its 60k-line chunk. The settings store the body reads through is the next package, not this one: \`fe\` and \`ft\` are quoted verbatim in src/plugin-chain-settings-store.ts and a hook stands in their place, with the unported reach (\`CT\`, \`Tp\`, \`y9e\`, \`M\`, \`yg\`) named there. Unlike W45-48 and W45-51 the source has no negative branch here, so the refusal text is this seam's own and is recorded as such rather than presented as source behaviour. Measured first, then asserted: the five names, the check's three admitted and three refused shapes, the argument's \`source\` being what is read, the copy semantics (including a property whose value is \`undefined\` disappearing from the answer), the synchronous circular-structure throw, the file name and order the store is asked in, the chain's no-handler short-circuit past the check, and the body's own unguarded failure on an absent argument. Evidence: \`research/ports/W45-settings-read-evidence.json\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-53 ported \`settings.read\` over the settings store (2026-10-16)

The \`$\` table's \`settings.read\` entry hands its whole body to \`hGo\`, which reads the argument's
\`source\`: absent means the merged settings (\`ft()\`), a name means that source's settings file
(\`fe(J9[source])\`), either way projected through \`ZH\` — \`undefined\` stays \`undefined\`, everything else
is the value's JSON round-trip, so the caller gets a copy rather than the store's own object — and
answered as a promise with \`{}\` for a store that has nothing. The check \`yGo\` admits no argument, an
argument with no source, or a string naming one of \`J9\`'s five keys, and refuses the rest with the list
and the type it got. The closure is 4 whole top-level statements, 449 units, all in chunk-sfn1dbxq.js.
The entry is a fragment of the plugin-method table's literal, so it is ported verbatim into
src/plugin-chain-settings.ts with its span quoted, the way the ui and store entries were.

Explicit ranges, not needles. chunk-sfn1dbxq.js is one of the 60k-line chunks whose top-level map
cannot be walked reliably — the limitation W45-51 recorded for chunk-gyf58rwf.js, which made the
generator's needles unresolvable there. All four blocks were measured and written as ranges.

The boundary. \`hGo\` reads through two bodies that are not this package: \`fe\`
(chunk-x0dc37w9.js [88486,88550) 64u) — the managed-settings gate \`CT()&&Tp.has(e)\` answering null,
otherwise \`y9e(e,M())\` — and \`ft\` ([96865,96904) 39u) — \`yg().settings||{}\`. Their reach is 205
statements / 66,141 units over 60+ imports, so they are quoted verbatim in
src/plugin-chain-settings-store.ts and a hook stands in their place, the way W45-48 and W45-51 bounded
their own unported layers. One difference is recorded rather than papered over: the source has no
negative branch here, so the refusal a caller sees while the store is unbound is this seam's own text,
not the source's behaviour.

Measured before asserted: the five names; the check's admitted and refused shapes with their exact
texts; the argument's \`source\` being what is read (\`{}\` and \`"user"\` pass, \`{source:"nope"}\` does not);
the copy semantics, including a property whose value is \`undefined\` dropping out of the answer; the
synchronous circular-structure throw, because the store is read before the promise is built; the store
being asked by file name in that order; the chain's no-handler short-circuit past the check (the path
W45-20 recorded) and the \`{value:…}\` wrapper a handler produces; and the body's own unguarded failure
on an absent argument.

Verified: check/build/notices, the new copy \`unresolved 0\`, ${chain}, the ledger, acorn and boundary
checks, the new suite ${seamSweep.passed}/${seamSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled
drivers (the shared driver now also prints \`W45SettingsReadCompiled.v1\`), and the packaged smoke
(${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: the settings store behind \`fe\`/\`ft\` — the largest item in the queue at 205 statements / 66,141
units over 60+ imports, and the one that would replace this package's bound hook with the source's own
bodies. Then \`http.fetch\`, \`ui.copy\` with its \`stamp\`, the remaining \`ui.*\` names, \`fs.ancestors\`,
\`state.*\`, and the config/home layer behind \`be\`.
`);

const rows = [
  ['2026-10-17T02:20:00Z', 'package', 'W45-53 搬 $ settings.read（$ 表设置读取唯一入口；4 段 449 单位 + 表片段，全在 chunk-sfn1dbxq.js）',
    'yGo 检查（五源名 user/project/local/flag/policy）+ hGo 正体（无 source 取合并 ft()、有则取 fe(J9[source])）+ ZH JSON 副本 + J9 映射成为产品面；设置仓储本体以逐字引用的钩子界定为下一包',
    'chunk-sfn1dbxq.js ZH [492416,492454) 38u、J9 [2328610,2328746) 136u、hGo [2328746,2328835) 89u、yGo [2328835,2329021) 186u；表项 [2354546,2354605) 59u 逐字入 seam；边界引 chunk-x0dc37w9.js fe [88486,88550) 64u、ft [96865,96904) 39u',
    `实测（.audit/w45-53-probe.ts、-probe2.ts 与 test/plugin-chain-settings.test.ts + .audit/w45-24-compiled.mjs）：五源名、检查三类放行/三类拒绝、读 source 而非参数对象、副本语义（undefined 属性被 JSON 往返丢掉）、循环引用同步抛错、按文件名问仓储的顺序、无 handler 短路不跑检查、装 handler 后拒绝文本与 {value:…} 包装、args:undefined 在正体内抛错；7/7 通过`],
  ['2026-10-17T02:23:00Z', 'finding', 'W45-53 实测纠偏：check 收到的是参数的 source，不是参数对象',
    '首版 seam 直接把整个 args 交给 yGo，结果 {} 被错拒、{source:1} 报成 got object —— 而表项实际写的是 check:(n)=>yGo(n?.source)',
    '改为传 (args as {source?: unknown} | undefined)?.source，并把"读的是参数的 source"写进测试与证据；{} 与 "user" 放行、{source:"nope"} 不放行三类都断言',
    '回归 7/7、家族 242/242、全量 1518/1518 通过'],
  ['2026-10-17T02:26:00Z', 'finding', 'W45-53 边界如实声明：源在此没有负分支，拒绝文本是本 seam 自有的',
    'W45-48（bl）与 W45-51（wD）都能让未绑定态落进源自身的负分支；本包的 fe/ft 没有对应分支，若照抄"源行为"就是把自有文本伪装成源文',
    'boundary 逐字引用 fe/ft 与其未搬到达（CT/Tp/y9e/M()/yg()），并把 the settings store is not bound; bindSettingsStore() installs one 明确标为本 seam 自有，测试与证据同口径',
    '回归 7/7 通过；未绑定态的拒绝文本在 seam 与测试中一致'],
  ['2026-10-17T02:30:00Z', 'verification', `W45-53 验收：新副本扫描 unresolved 0、账本 4 段逐段回源 + acorn 完整性、表项区间 [2354546,2354605) 与四个正体、fe/ft 与边界引文回源自证、${chain}、回归 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '$ 表设置读取入口闭环，下一包转设置仓储本体（205 语句 / 66,141 单位）',
    `check/build/notices；扫描 unresolved 0；${chain}；账本 4 段逐段回源比长度与内容 + acorn 断言（完整顶层语句、无重叠、无重复）；表项区间与 seam 引文逐字比对、四个正体按首文本与单位数定位并回源断言 Promise.resolve(ZH(n===void 0?ft():fe(J9[n]))??{}) 与 Object.hasOwn(J9,e) 等片段、fe/ft 在 chunk-x0dc37w9.js 的区间与边界引文双向断言、未搬名 CT/Tp/y9e/M()/yg() 与 seam 拒绝文本存在性断言；回归 ${seamSweep.passed}/${seamSweep.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45SettingsReadCompiled.v1，共享 ${sharedMarkers.length} 标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-53 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-53 acceptance (2026-10-16)

- [x] **The surface decided the package.** The \`settings.read\` entry was measured first (span and text), then the four bodies behind it, then the store it reads through.
- [x] **The whole closure came across.** 4 whole top-level statements, 449 units, one module; chain verifier (${chain}) and \`unresolved 0\`.
- [x] **Explicit ranges where the module cannot be walked.** chunk-sfn1dbxq.js is a 60k-line chunk whose top-level map is unreliable (the W45-51 limitation); all four blocks are measured ranges, not needles.
- [x] **The entry is ported where it can be verified.** A table fragment, so verbatim in the seam with its span quoted and asserted against the literal.
- [x] **The check reads what the source reads.** \`yGo\` receives the argument's \`source\`, not the argument — the first version passed the whole object and was corrected against the measurement.
- [x] **The boundary is honest about what it is.** \`fe\`/\`ft\` and their unported reach are quoted verbatim; the unbound refusal is labelled this seam's own, because the source has no negative branch here.
- [x] **Everything measured before it was asserted.** The five names, the three admitted and three refused check shapes, the copy semantics, the synchronous circular-structure throw, the file name and order the store is asked in, the no-handler short-circuit, and the body's unguarded failure.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\`, ${chain}, ledger, acorn and boundary checks, new suite ${seamSweep.passed}/${seamSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
