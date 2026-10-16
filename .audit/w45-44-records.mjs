// Write the W45-44 package record from the artifacts themselves: the seven session entries, the
// nine copied bodies behind them, the drawing registry, and the four entries this package left.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 362, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 139, `validation ${identity.validation.files}`);
expect(identity.build.files === 251, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 44) throw new Error('the chain verifier did not pass 44 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const sessionCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-session-source.ts'));
if (!sessionCopy || sessionCopy.blocks !== 9) throw new Error('the session copy is not the 9-block one');

const ledger = JSON.parse(read('src/plugin-chain-session-source-blocks.json'));
if (ledger.blocks.length !== 9) throw new Error('the session ledger does not hold nine blocks');
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
const scan = execFileSync(process.execPath, ['scripts/source-undeclared-scan.mjs', 'src/plugin-chain-session-source.ts'], { encoding: 'utf8' });
if (!/unresolved 0/.test(scan)) throw new Error('the session copy has unresolved names');

// The entries are named from the module, not from memory: each of the seven is looked up in the
// table's own text, and so are the four the package leaves for later.
const sfn = read('extracted-v2/modules/chunk-sfn1dbxq.js');
const entries = {
  'session.cwd': '"session.cwd":{run:(n,r)=>Bpe(r.plugin,r.cwd).then((s)=>s.cwd)}',
  'session.root': '"session.root":{run:(n,r)=>Bpe(r.plugin).then((s)=>s.root)}',
  'session.model': '"session.model":{run:(n,r)=>Bpe(r.plugin).then((s)=>s.model)}',
  'session.turns': '"session.turns":{run:(n,r)=>WAo(r.plugin)}',
  'session.id': '"session.id":{run:(n,r)=>Bpe(r.plugin).then((s)=>s.id)}',
  'session.surface': '"session.surface":{run:(n,r)=>uMo(r.plugin)}',
  'session.surfaces': '"session.surfaces":{run:(n,r)=>cMo(r.plugin)}',
};
for (const [name, text] of Object.entries(entries)) {
  if (!sfn.includes(text)) throw new Error(`the table entry ${name} is not the text this record names`);
}
const left = {
  'session.messages': '"session.messages":{check:vNs,run:(n,r)=>PAo(n??{},r.plugin)}',
  'session.repo': '"session.repo":{run:(n,r)=>MAo(r.cwd)}',
  'session.authorize': '"session.authorize":oJt',
  'session.compact': '"session.compact":{check:(n,r)=>{',
};
for (const [name, text] of Object.entries(left)) {
  if (!sfn.includes(text)) throw new Error(`the entry ${name} is not the text this record leaves out`);
}
// Comments may name them — the seam says which entries wait — and the host's event catalog lists
// every `$` name the source knows, so what is checked is that nothing *binds* one: the built table's
// keys are exactly the seven, and no other line in src carries the name as a table key.
const codeOf = (text) => text.split('\n')
  .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
const { sessionCallTable } = await import('../dist/plugin-chain-session.js');
const built = Object.keys(sessionCallTable()).sort();
const expected = Object.keys(entries).sort();
if (built.join(',') !== expected.join(',')) {
  throw new Error(`the built table binds ${built.join(',')} rather than the seven this package took`);
}
const carriers = fs.readdirSync('src').filter((name) => name.endsWith('.ts'))
  .flatMap((name) => codeOf(read(`src/${name}`)).split('\n')
    .filter((line) => Object.keys(left).some((entry) => line.includes(`'${entry}':`)))
    .map((line) => `${name}: ${line.trim().slice(0, 60)}`));
if (carriers.length) {
  throw new Error(`an entry this package leaves out is bound in the product after all (${carriers.join(', ')})`);
}
const leftOut = 'the four entries this package leaves are named from the table and asserted unbound: `session.messages` (`PAo`, 387 units, the conversation store), `session.repo` (`MAo`, the git work tree), `session.authorize` (`oJt` = `rAo(plugin)`) and `session.compact` (the turn machinery)';

// The host boundary's four bodies are quoted verbatim in the seam header, and each range is checked
// against the chunk it came from, so the header cannot drift from the source it claims to bind.
const host = read('src/plugin-chain-host.ts');
const hostHome = {
  'chunk-4bw62nzm.js [76686,76729)': 'function K(){return h()?.sessionId??n().id}',
  'chunk-qr9z1wer.js  [2355,2405)': 'function se(){try{return Aon()}catch{return Ee()}}',
  'chunk-4bw62nzm.js [79590,79649)': 'function Ee(){return h()?.originalCwd??So(n()).originalCwd}',
  'chunk-bk5ct2gw.js [357377,357451)': 'function tt(){let e=Ah();if(e!==void 0&&e!==null)return Dt(e);return Zl()}',
};
for (const [where, body] of Object.entries(hostHome)) {
  if (!host.includes(where)) throw new Error(`the seam header does not name ${where}`);
  if (!host.includes(body)) throw new Error(`the seam header does not quote ${body}`);
  const [chunk, range] = where.split(/\s+/);
  const [from, to] = range.slice(1, -1).split(',').map(Number);
  const text = read(`extracted-v2/modules/${chunk}`);
  if (text.slice(from, to) !== body) throw new Error(`the quoted body is not ${chunk} ${range}`);
}
const boundary = 'the four process fallbacks (`K`, `se`, `Ee`, `tt`) are a host boundary: their source bodies reach the session record, the process config and the ambient cwd store, and the seam header quotes all four verbatim with the chunk and range each came from — the record re-reads those ranges and fails if a quoted body is not the module slice';

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-44-tests.txt');
if (full.failed !== 0 || full.tests !== 1443) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-44-family.txt');
if (family.failed !== 0 || family.tests !== 167) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const seam = summary('.audit/w45-44-seam.txt');
if (seam.failed !== 0 || seam.tests !== 7) throw new Error('the session seam sweep is not clean');

const smokeReport = read('.audit/w45-44-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const allMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
// The list is the shared driver's own markers: it is regenerated from the run rather than counted by
// hand, so a marker that stops printing fails here instead of quietly shrinking the sweep.
const sharedMarkers = read('.audit/w45-44-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-44-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45SessionFloorCompiled.v1')) throw new Error('the shared driver did not print the W45-44 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45SessionFloorCompiled.v1 (${sharedMarkers.length} markers in the shared driver, ${allMarkers.length} across every driver: it drives the seven entries against dist, binds and unbinds the process identity, attaches and detaches a drawing client, and checks that a passthrough handler still reaches the floor)`;

const evidence = {
  schema: 'W45SessionFloorEvidence.v1',
  package: 'W45-44 — the `$` table\'s session read floor: the seven entries a plugin reads its process\'s session through, and the drawing-surface registry two of them stand on',
  date: '2026-10-16',
  question: 'W45-43 left the `$` table beyond the three ui floors as the next sliceable item, "entry by entry". Reading the table whole — 62 entries, every one with its span — which of them can be taken as one package, and which fan out into their own subsystems?',
  answer: 'Seven can, and they are the ones that read the session this process bound: `session.cwd`, `session.root`, `session.model`, `session.id` (all four through `Bpe`), `session.turns` (`WAo`), `session.surface` and `session.surfaces` (`uMo`/`cMo` over `Xte`). Nine bodies back them, 1,601 units from three modules, and none of the nine needed a callee this port does not have: `bI` is W45-24\'s binding, `t` the host log, `Ge` and `D` the copied chain source, `Oe` W45-35\'s sources-change signal, and the drawing registry `ie`/`gE` is self-contained (a map of clients, the ones that missed a frame, and that signal). The four entries with more behind them are named from the table and recorded rather than started: `session.messages` (`PAo`, 387 units, the conversation store), `session.repo` (`MAo`, the git work tree), `session.authorize` (`oJt`) and `session.compact` (the turn machinery).',
  entries: Object.entries(entries).map(([name, text]) => ({ name, text })),
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  boundary,
  leftOut,
  measured: [
    'With no session bound the floor answers from the process and says so: `$.session (plugin): no session bound; id, cwd and model answered from the process`, `$.session.turns (plugin): no session bound; 0`, `$.session.surface (plugin): no drawing session bound; null` and `$.session.surfaces (plugin): nothing attached draws; []` are the four lines the four bodies write, each read back out of the bound chain log.',
    'Only `model` asks the bound session first; `id`, `cwd` and `root` come from the process even when a session is bound, which is what `Bpe`\'s body says and what the identity test binds (`bound-model` next to `pid-1` and `/proc/cwd`).',
    'A caller\'s own `cwd` wins over the process cwd: `Bpe(r.plugin, r.cwd)`, driven through `raiseSessionCall` with a caller carrying one.',
    '`session.turns` counts a person\'s turns and drops exactly three kinds: tool-result content (`T9n`), `isMeta` and `isVirtual`, plus every non-user message — six messages in, two counted.',
    '`Xte` puts `"terminal"` first only when the bound session draws to a terminal, and reads the rest from the drawing registry: with a `sidebar` client attached the list is `["terminal","sidebar"]`, and with nothing attached it is `[]`.',
    'The drawing registry\'s own semantics, all four measured: a fresh `attach` is `true` and a re-attach is `false` while merging viewport fields (`{width:10}` then `{height:4}` reads back as both); `detach` reports the client id on the sources-change signal, answers the dropped client, and answers `undefined` for an id that was not attached; `missed`/`heard`/`isSilent` track one flag per client; and `surfaces()` dedupes by name.',
    'A handler in the chain answers first and a passthrough handler reaches the floor — the value-event path is W45-20\'s `Hze`, so the entries behave as table floors rather than as the only implementation.',
    '`F` counts truthy predicate answers rather than filtering them: `[1,2,3,4]` with an `even` predicate is 2, and an empty list is 0.',
  ],
  behaviour_changed: [
    'A plugin can now read the process\'s session identity and its drawing surfaces through the `$` names the source gives them, including the exact log lines the source writes when nothing is bound.',
    'The drawing-surface registry is product surface: attach/detach/list/surfaces/hasSurface/onDetach/missed/heard/isSilent, with a detach reported on the same sources-change signal W45-35 ported.',
    '1,601 units left the unported set. The four session entries with subsystems behind them are named from the table and asserted unbound, so binding one later fails this record\'s own check.',
    'No product file changed behaviour on another path: plugin-chain-host.ts gained a four-value process-identity binding whose defaults are this process\'s cwd, and the only other edits are the verifier registering the new plan and the shared driver printing its marker.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'the new copy: unresolved 0',
    chain_verifier: chain,
    entries_check: 'the record re-reads all seven entry texts and the four left out in the table itself, and asserts no product file binds a left-out name in code',
    boundary_check: 'the record re-reads the four quoted fallback bodies from their chunks and compares each against its stated range',
    regressions: `the new session suite ${seam.passed}/${seam.tests}; ${familyLine}`,
    full: fullLine,
    compiled: driverLine,
    smoke,
  },
  next_package: [
    'the `$` table beyond this floor, entry by entry: `session.messages` (`PAo` + its `vNs` check), `session.repo` (`MAo` and the git work tree it reads), `session.authorize` (`oJt` = `rAo(plugin)`)',
    'the `state.get`/`state.set` pair (`Pur`/`Our`, `Iur`/`$ss`/`Hur`) and the `clock.now`/`clock.sleep` pair (`cDo`, `vme`, `VQt`) — the small entries left in the same table',
    'the `fs.*` and `store.*` families in the same table (`hzt`/`_zt`/`gzt`/`XAt`, `xNs`/`ppr`/`JAt`)',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'the notification context provider `a4n` (chunk-356hrhz3.js [1453,1607)) and the clearTimer context `R` [1431,1432)',
    'the registry fields the source\'s literal carries but no ported body reads yet (the hook registry, the marketplaces, the command-producer memos)',
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
    'the helpers/config store behind `BEo` and the load pipeline behind `zLr`/`sc`: both are subsystems in their own right, not packages (W45-43 recon)',
  ],
};
write('research/ports/W45-session-floor-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-44 **搬 `$` 表会话读取 floor',
  features: '; W45-44 binds the `$` session read floor',
  standard: '2026-10-16 W45-44 会话读取 floor',
  status: 'W45-44: the `$` session read floor.',
  runner: '## W45-44 ported the `$` session read floor',
};
const stripBlock = (text, mark, { toEnd = false, paragraph = false } = {}) => {
  const at = text.indexOf(mark);
  if (at < 0) return text;
  const start = text.lastIndexOf('\n', at) + 1;
  if (toEnd) return text.slice(0, start);
  const end = paragraph ? text.indexOf('\n\n', at) : text.indexOf('\n', at);
  return text.slice(0, start) + text.slice(end < 0 ? text.length : end + 1);
};

// CURRENT: the W45-44 row above the W45-43 one.
const current = stripBlock(read('research/CURRENT.md'), marks.current);
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-44 **搬 \`$\` 表会话读取 floor（七条目）**（新副本 9 段 1,601 单位，三模块；seam 无新搬运块）：\`session.cwd\`/\`root\`/\`model\`/\`id\`（皆经 \`Bpe\`）、\`session.turns\`（\`WAo\`）、\`session.surface\`/\`session.surfaces\`（\`uMo\`/\`cMo\` 读 \`Xte\`），七条表项文本逐字落在 seam 内；九段被搬运体为 \`F\`（谓词计数）、\`T9n\`（内容是否工具结果）、\`ie\`+\`gE\`（绘图会话注册表：既存客户端、错帧标记、\`Oe\` 变化信号）、\`Bpe\`、\`WAo\`、\`Xte\`、\`uMo\`、\`cMo\`。**零新依赖**：\`bI\` 取自 W45-24 绑定、\`t\` 取自宿主、\`Ge\`/\`D\` 取自已搬链源、\`Oe\` 取自 W45-35 信号；四个过程回落 \`K\`/\`se\`/\`Ee\`/\`tt\` 作 **host 边界**（其源体分别读到会话记录、进程配置、ambient cwd 存储与命令模型，产品尚无对应面），seam 头注逐字引用四体并标注 chunk+区间，记录脚本重读区间比对。**实测**（先量后断）：无会话时四行日志逐条读回；仅 \`model\` 先问会话，\`id\`/\`cwd\`/\`root\` 即便有会话也来自进程；调用方自带 \`cwd\` 覆盖进程值；\`session.turns\` 六进二出（工具结果/\`isMeta\`/\`isVirtual\`/非 user 全排除）；\`Xte\` 仅在会话自身 surface 为 terminal 时把 \`"terminal"\` 置首，其余读注册表；注册表自身语义四条（新 attach 为真、重 attach 合并 viewport 且为假、detach 经变化信号上报并返回被摘客户端、missed/heard/isSilent 单标记、surfaces 去重）。**同表余项明确留待并断言未绑**：\`session.messages\`（\`PAo\` 387 单位，会话存储）、\`session.repo\`（\`MAo\`，git 工作树）、\`session.authorize\`（\`oJt\`）、\`session.compact\`（回合机制）——记录脚本重读表内四项文本并断言产品代码中无同名绑定。验收：check/build/notices、新副本扫描 \`unresolved 0\`、**${chain}**、七条目与四项留待自证、边界区间自证、新回归 ${seam.passed}/${seam.tests}、插件链家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45SessionFloorCompiled.v1\`，共 ${sharedMarkers.length} 个标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [会话读取证据](ports/W45-session-floor-evidence.json)、[失效调用证据](ports/W45-invalidate-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('the C-12 row was not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the session floor.
const features = read('research/FEATURES.md').replace(new RegExp(`${marks.features.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^|]*`), '');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('the interactive feature row was not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-44 binds the \`$\` table's session read floor: seven entries that answer a plugin's questions about its own process (id, cwd, root, model, user turns, drawing surfaces) from the bound session or from the process itself, with the four log lines the source writes when nothing is bound. |`;
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standard.indexOf('2026-10-16 W45-43 文档伪影与队列重判');
if (standardAt < 0) throw new Error('coding-standard W45-43 line not found');
const standardEntry = `2026-10-16 W45-44 会话读取 floor：S-1至S-7已对照。S-1（先读源）：先把 62 条表项逐条扫出区间与所涉名字（\`.audit/w45-44-table-scan.mjs\`，结构扫描而非目测），再按"被调者是否已在产品内"逐条判定——七条可搬、四条留待并写明各自子系统，未凭名字猜测；四条过程回落先读出源体（\`K\`/\`se\`/\`Ee\`/\`tt\`）与其四层被调（\`h()\`/\`n()\`/\`So\`/\`Aon()\`/\`Ah()\`/\`Zl()\`/\`Dt()\`），确认产品无对应面后才作 host 边界，头注逐字引用并把 chunk+区间写进注释。S-2（不留半包）：九段一次给全 + 七个表项包装 + 注册表九个操作包装；留待四项写入 seam 头注、\`leftOut\` 与 next_package 首条。S-3：回归先依赖探针量出的取值（四行日志、仅 model 问会话、caller cwd 覆盖、六进二出、terminal 置首与注册表语义四条、谓词计数），断言集合/字面值而非布尔；留待四项用"产品代码中无同名绑定"的断言钉住，产品一旦绑定即失败。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器/打包冒烟/${drivers.length} 个编译驱动并解析输出，\`ported\` 由 ledger 读回，条目文本与边界区间各自回读源文比对。S-5/S-6：seam 只做命名与类型（\`Bpe\` 因 \`@ts-nocheck\` 副本参数必填而按源用法收窄一次，其余不包装）；无死导出，不重复搬 \`bI\`/\`t\`/\`Ge\`/\`D\`/\`Oe\`。S-7：同表余项（\`session.messages\`/\`repo\`/\`authorize\`/\`compact\`、\`state.*\`、\`clock.*\`、\`fs.*\`/\`store.*\`）、Q-086、通知 Provider、helpers/config store 与装载管线写入 next_package。验收：check/build/notices、扫描 unresolved 0、${chain}、条目与留待自证、边界自证、回归 ${seam.passed}/${seam.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-44 paragraph above the W45-43 one.
const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf('W45-43: the documentation artifact');
if (statusAt < 0) throw new Error('STATUS W45-43 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-44: the \`$\` session read floor. W45-43 left the table beyond the ui floors as the next sliceable item, so this package started by scanning all 62 entries structurally — span and names for each — and then asked of every one whether its callees are already in the product. Seven are: \`session.cwd\`, \`session.root\`, \`session.model\` and \`session.id\` through \`Bpe\`, \`session.turns\` through \`WAo\`, and \`session.surface\`/\`session.surfaces\` through \`uMo\`/\`cMo\` over \`Xte\`. Nine bodies, 1,601 units from three modules, none of which needed a callee this port lacks — the drawing registry behind the surface reads is self-contained, and it reports a detach on the same sources-change signal W45-35 ported. The four process fallbacks (\`K\`, \`se\`, \`Ee\`, \`tt\`) are a host boundary: their bodies reach the session record, the process config, the ambient cwd store and the model a command asked for, and this port has none of those surfaces, so the seam header quotes all four verbatim with chunk and range, and the record re-reads each range and fails if a quoted body is not the module slice. Measured before asserted: the four no-session log lines read back out of the chain log; only \`model\` asks the bound session first while id, cwd and root come from the process; a caller's own cwd wins; six messages in, two turns out; \`"terminal"\` leads the surface list only for a terminal session; and the registry's own attach-merge, detach report, silence marks and dedupe. The four entries with subsystems behind them — \`session.messages\` (\`PAo\`, the conversation store), \`session.repo\` (\`MAo\`, the git work tree), \`session.authorize\` and \`session.compact\` — are named from the table and asserted unbound in product code, so binding one later fails this record's check. Evidence: \`research/ports/W45-session-floor-evidence.json\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-44 section.
const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-44 ported the \`$\` session read floor (2026-10-16)

Seven entries of the \`$\` table now answer a plugin's questions about its own process, copied
verbatim into src/plugin-chain-session-source.ts (9 blocks, 1,601 units of three modules) behind
src/plugin-chain-session.ts: \`session.cwd\`, \`session.root\`, \`session.model\` and \`session.id\` through
\`Bpe\`; \`session.turns\` through \`WAo\`; and \`session.surface\`/\`session.surfaces\` through \`uMo\`/\`cMo\` over
\`Xte\`. The table's own entry spans are 63, 59, 61, 42, 55, 44 and 45 units (chunk-sfn1dbxq.js
[2347677,2347961) and [2348063,2348153)) and their text sits in the seam as the arrows above.

Nothing new had to be ported for them. \`bI\` is W45-24's bound-session slot, \`t\` the host's chain log,
\`Ge\` and \`D\` the copied chain source, and \`Oe\` W45-35's sources-change signal, which the drawing
registry emits a detach on. The registry itself (\`ie\` [2085,2727) and its instance \`gE\` [2727,2792) in
chunk-tvdq3hrk.js) is copied whole, and its nine operations are product surface: attach, detach, list,
surfaces, hasSurface, onDetach, missed, heard, isSilent.

The four process fallbacks are the package's one boundary. \`K\`, \`se\`, \`Ee\` and \`tt\` read the session
record, the process config, the ambient cwd store and the model a command asked for — none of which
this port carries yet — so plugin-chain-host.ts binds them as one record with this process's cwd as
the default, and the seam header quotes all four bodies with their chunk and range. The record script
re-reads each quoted range from the module and compares it with the header, so the boundary cannot
drift from the source it claims to bind.

What the source says, read back out of the ported bodies: with no session bound the floor answers from
the process and logs one of four lines (\`$.session (plugin): no session bound; id, cwd and model
answered from the process\`, \`$.session.turns … 0\`, \`$.session.surface … null\`,
\`$.session.surfaces … []\`); only \`model\` asks the bound session first; a caller's own \`cwd\` wins;
\`session.turns\` drops tool results, meta, virtual and non-user messages; and \`"terminal"\` leads the
surface list only when the bound session draws to one.

The four entries this package leaves are named from the table and asserted unbound in product code:
\`session.messages\` (\`PAo\`, 387 units, the conversation store), \`session.repo\` (\`MAo\`, the git work
tree), \`session.authorize\` (\`oJt\` = \`rAo(plugin)\`) and \`session.compact\` (the turn machinery). Binding
one later fails the record's own check, which is how the gap stays visible.

Verified: check/build/notices, the new copy \`unresolved 0\`, ${chain}, the entry and boundary checks,
the new suite ${seam.passed}/${seam.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers
(the shared driver now also prints \`W45SessionFloorCompiled.v1\`), and the packaged smoke (${smoke}).
Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself, which asserts the
counts).

Next: the same table, entry by entry — \`session.messages\`, \`session.repo\` and the \`state.*\`,
\`clock.*\`, \`fs.*\` and \`store.*\` families.
`);

const rows = [
  ['2026-10-16T20:05:00Z', 'package', 'W45-44 搬 `$` 表会话读取 floor 七条目（新副本 9 段 1,601 单位，三模块；seam 无新搬运块）',
    'session.cwd/root/model/id/turns/surface/surfaces 成为产品面；零新依赖（bI/t/Ge/D/Oe 全部复用）；四条同表条目留待并断言未绑',
    'chunk-sfn1dbxq.js [2347677,2347740) cwd、[2347741,2347800) root、[2347801,2347862) model、[2347863,2347905) turns、[2347906,2347961) id、[2348063,2348107) surface、[2348108,2348153) surfaces；体 Bpe [1698766,1698968)、WAo [1703496,1703695)、Xte [450195,450316)、uMo [1820356,1820482)、cMo [1820482,1820600)、T9n [492112,492181)、chunk-tvdq3hrk.js ie [2085,2727)/gE [2727,2792)、chunk-3qabb19b.js F [673,732)',
    `实测（test/plugin-chain-session.test.ts + .audit/w45-24-compiled.mjs）：四行无会话日志逐条读回、仅 model 先问会话、caller cwd 覆盖、六进二出、terminal 置首、注册表四条语义；7/7 通过`],
  ['2026-10-16T20:14:00Z', 'finding', 'W45-44 把四条过程回落（K/se/Ee/tt）记为 host 边界，并把四段源体连同区间钉进 seam 头注',
    'K=n().id/h()?.sessionId、Ee=So(n()).originalCwd、se=Aon()（ambient cwd 存储）、tt=Ah()/Zl()（命令模型/默认模型 id）——四层被调各在未搬 chunk，产品无对应面；"返回空"会替源决定插件看到的 id/cwd/root/model',
    'seam 头注逐字引用四段源体并标 chunk+区间；plugin-chain-host.ts 以一条记录绑定（默认取本进程 cwd）；记录脚本重读每段区间并与头注比对，源体或区间不符即失败',
    '边界自证通过（4/4 区间比对一致）；check/build 通过；回归 7/7、家族 167/167、全量 1443/1443'],
  ['2026-10-16T20:22:00Z', 'finding', 'W45-44 用结构扫描列出全部 62 条表项（区间+所涉名字），逐条判定"被调者是否已在产品内"',
    '表项是 `"name":{…}` 片段而非语句，无法整块搬运；逐个名字靠记忆判定会误判（压缩短名跨 chunk 碰撞，如 `Xs`/`T9n`）',
    '.audit/w45-44-table-scan.mjs 做括号/引号深度的结构扫描给出 62 条区间与名字（首版因条目以逗号开头而漏配 key，已修）；.audit/w45-44-cross.mjs 经各 chunk 的导出表反查本地名再取体，避免同名不同体',
    '扫描输出 62 条（含 ui.toast/ui.status/ui.log 三条已搬运）；跨 chunk 解析 K/se/Ee/tt/F/gE/ie 各自本地名与区间'],
  ['2026-10-16T20:31:00Z', 'verification', `W45-44 验收：新副本扫描 unresolved 0、七条目与四项留待自证、边界区间自证、${chain}、回归 ${seam.passed}/${seam.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '会话读取 floor 收束，下一包仍是同表逐条目（session.messages/session.repo、state.*/clock.*/fs.*/store.* 家族）',
    `check/build/notices；扫描 unresolved 0；${chain}；条目文本与留待四项回读源文 + 产品代码无同名绑定；边界四段区间比对；新回归 ${seam.passed}/${seam.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45SessionFloorCompiled.v1，共 ${sharedMarkers.length} 个标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-44 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-44 acceptance (2026-10-16)

- [x] **The table was read before any entry was taken.** All 62 entries scanned structurally for span and names, then judged one by one on whether their callees are already in the product — not from memory of what minified names usually mean.
- [x] **Seven entries are product surface.** Each with its own wrapper and its own verbatim arrow, so a plugin reads id, cwd, root, model, user turns and drawing surfaces through the \`$\` names the source gives them.
- [x] **Nine bodies copied whole.** 1,601 units from three modules, per-block ledger, chain verifier (${chain}) and \`unresolved 0\`.
- [x] **Nothing new was ported to make them work.** \`bI\`, \`t\`, \`Ge\`, \`D\` and \`Oe\` are each named as reused rather than copied a second time.
- [x] **The one boundary is quoted, not paraphrased.** The four process fallbacks have their source bodies, chunks and ranges in the seam header, and the record re-reads every range and compares it with the header.
- [x] **No behaviour was invented for the fallbacks.** A stub answering empty for id/cwd/root/model would decide for the source what a plugin sees; the seam says so where a reader meets the gap, and the defaults are this process's own cwd.
- [x] **The four entries left behind are pinned.** Their table texts are re-read from the module and no product file may bind their names in code, so binding one later fails the record's own check.
- [x] **Everything measured before it was asserted.** The four no-session log lines, \"only model asks the session\", the caller's cwd, six messages in and two turns out, the terminal-first surface list, and the registry's attach-merge/detach-report/silence marks.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\`, ${chain}, entry and boundary checks, new suite ${seam.passed}/${seam.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
