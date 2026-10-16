// Write the W45-57 record from the artifacts themselves: the `$` table's ui.notify entry, the two
// blocks the ui copy grew, and the `stamp` field the seam now models.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 402, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 152, `validation ${identity.validation.files}`);
expect(identity.build.files === 279, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 56) throw new Error('the chain verifier did not pass 56 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const uiCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-ui-source.ts'));
if (!uiCopy || uiCopy.blocks !== 17 || uiCopy.units !== 2484) throw new Error('the ui copy is not the 17-block, 2,484-unit one');
const storeCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-local-store-source.ts'));
if (!storeCopy || storeCopy.blocks !== 13 || storeCopy.units !== 6401) throw new Error('the local-store copy changed');

const ledger = JSON.parse(read('src/plugin-chain-ui-source-blocks.json'));
if (ledger.blocks.length !== 17) throw new Error('the ui ledger does not hold seventeen blocks');
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 2484) throw new Error(`the ui ledger holds ${units} units`);
const notifyBlock = ledger.blocks.find((block) => block.module === 'chunk-sfn1dbxq.js' && block.range[0] === 2338792);
if (!notifyBlock || notifyBlock.units !== 871) throw new Error('the ui.notify block is not the 871-unit one');
const flagBlock = ledger.blocks.find((block) => block.module === 'chunk-r2vtj1kh.js');
if (!flagBlock || flagBlock.range.join(',') !== '150398,150468' || flagBlock.units !== 70) {
  throw new Error('the committed-flag block is not the 70-unit one');
}
for (const [file, count] of [['src/plugin-chain-ui-source.ts', 17], ['src/plugin-chain-source.ts', 73]]) {
  const scan = execFileSync(process.execPath, ['scripts/source-undeclared-scan.mjs', file], { encoding: 'utf8' });
  if (!/unresolved 0/.test(scan)) throw new Error(`${file} has unresolved names`);
}
const sourceLedger = JSON.parse(read('src/plugin-chain-source-blocks.json'));
if (sourceLedger.blocks.length !== 73) throw new Error(`the source ledger holds ${sourceLedger.blocks.length} blocks, not 73`);
if (!sourceLedger.blocks.some((block) => block.module === 'chunk-kd3dbbtb.js' && block.range.join(',') === '661,807')) {
  throw new Error('the source copy no longer holds the error class the notify floor throws');
}

// The plan this package extended: the ui plan grew by the two blocks and six exports, and its import
// line now carries the error class.
const uiPlan = JSON.parse(read('research/ports/W45-ui-blocks.plan.json'));
if (uiPlan.blocks.length !== 17) throw new Error('the ui plan is not the seventeen-block one');
if (uiPlan.exports.join(',') !== 'Vyt,LWt,Pzo,GCn,Izo,kye,Yb,$2e,lJt,uMe,LVe,HM,CK,N6,u2t,Dzo,qQt,Nzo,Fzo,wn,Ia') {
  throw new Error('the ui plan exports changed');
}
if (!uiPlan.imports.some((line) => line === "import { Ge, He } from './plugin-chain-source.js';")) {
  throw new Error('the ui plan lost the error-class import');
}

// Every block is re-read from its module, compared with the ledger, and checked against acorn: each is
// a whole top-level statement or a contiguous run of them, and no two may overlap.
const sources = new Map();
const statements = new Map();
for (const module of new Set(ledger.blocks.map((block) => block.module))) {
  const text = read(`extracted-v2/modules/${module}`);
  let tree;
  try { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' }); }
  catch { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script' }); }
  sources.set(module, text);
  statements.set(module, tree.body.map((node) => ({ start: node.start, end: node.end })));
}
const copyText = read('src/plugin-chain-ui-source.ts');
for (const block of [notifyBlock, flagBlock]) {
  const [start, end] = block.range;
  if (end - start !== block.units) throw new Error(`${block.range} is not ${block.units} units`);
  const body = sources.get(block.module).slice(start, end);
  const all = statements.get(block.module);
  const inside = all.filter((node) => node.start >= start && node.end <= end);
  if (inside.length === 0 || inside[0].start !== start || inside[inside.length - 1].end !== end) {
    throw new Error(`${block.module} ${JSON.stringify(block.range)} does not start and end on statement boundaries`);
  }
  for (let index = 1; index < inside.length; index++) {
    if (inside[index - 1].end !== inside[index].start) throw new Error(`${block.range} skips a statement`);
  }
  if (all.some((node) => (node.start < start && node.end > start) || (node.start < end && node.end > end))) {
    throw new Error(`${block.range} cuts a statement in half`);
  }
  if (!copyText.includes(body)) throw new Error(`${block.note.slice(0, 40)} is no longer in the copy`);
}
// Statement order inside the flag block is load-bearing: `var Ia=new Na` runs after the class it
// instantiates, and `wn` reads that singleton.
const flagBody = sources.get('chunk-r2vtj1kh.js').slice(...flagBlock.range);
if (!flagBody.startsWith('class Na{committed=!1}var Ia=new Na;function wn(){return Ia.committed}')) {
  throw new Error('the committed-flag block lost its source order');
}
const notifyBody = sources.get('chunk-sfn1dbxq.js').slice(...notifyBlock.range);
if (notifyBody !== 'function Dzo(e){let n=e?.title,r=n===void 0||typeof n==="string";return LVe(e?.text)??'
  + '(r?void 0:"title is a string, when given")}function qQt(e,n){switch(e){case"no_surface":return{isSent:!1,reason:"no-surface"};'
  + 'case"iterm2":case"iterm2_with_bell":case"kitty":case"ghostty":case"terminal_bell":return{isSent:!0,channel:e};'
  + 'case"disabled":return{isSent:!1,reason:"disabled"};case"none":case"no_method_available":return{isSent:!1,reason:"no-channel"};'
  + 'case"error":throw new He(`${n}: $.ui.notify: the channel\'s write failed`)}}'
  + 'async function Nzo(e,n){let r=wn(),s=qQt(r?"no_surface":await bI()?.notify?.({message:e.text,title:e.title||n.plugin,'
  + 'notificationType:"plugin_notification"},n.origin)??"no_surface",n.plugin);return t(`$.ui.notify (${n.plugin}): '
  + '${e.text.length} chars: `+(s.isSent?`sent by ${s.channel}`:s.reason)),s}var Fzo=(e,n)=>({...e,title:e.title||n.plugin});') {
  throw new Error('the ui.notify block changed');
}
// The source's own table fragment, quoted where it stands, and the dispatcher that reads `stamp`.
const chunk = sources.get('chunk-sfn1dbxq.js');
const fragment = '"ui.notify":{check:Dzo,stamp:Fzo,run:Nzo}';
if (chunk.slice(2353653, 2353694) !== fragment) throw new Error('the table fragment moved in its module');
if (!chunk.includes('let ke=h.raise?.(V),Se=ke?Aws(ke,b):b,Re=h.stamp?h.stamp(Se,V):Se;')) {
  throw new Error('the stamp-reading dispatcher changed');
}
if (!read('src/plugin-chain-ui.ts').includes(fragment)) throw new Error('the seam no longer carries the table fragment');
if (!read('src/plugin-chain-ui.ts').includes('`G2e`')) {
  throw new Error('the seam no longer names the dispatcher it does not port');
}
// The seam: the event it added, the stamp field, the entry and the session surface.
const seam = read('src/plugin-chain-ui.ts');
for (const text of ["export type UiCallEvent = 'ui.toast' | 'ui.status' | 'ui.log' | 'ui.selection' | 'ui.notify';",
  'export type UiCallEntry = HostCallBottom & {', 'stamp?: (args: any, caller: HostCallCaller) => unknown;',
  'notify?: (request: { message: string; title: string; notificationType: \'plugin_notification\' }, origin: unknown) => unknown;',
  'check: Dzo as UiCallEntry[\'check\'],', 'stamp: Fzo as UiCallEntry[\'stamp\'],', 'run: Nzo as UiCallEntry[\'run\'],']) {
  if (!seam.includes(text)) throw new Error(`the ui seam lost ${text}`);
}
if (!seam.includes('never reads it,')) throw new Error('the seam no longer records what the hookless path does with the stamp');
const selectionTest = read('test/plugin-chain-ui-selection.test.ts');
if (!selectionTest.includes("'ui.log,ui.notify,ui.selection,ui.status,ui.toast'")) {
  throw new Error('the selection suite no longer asserts the five-name table');
}

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-57-tests.txt');
if (full.failed !== 0 || full.tests !== 1549) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-57-family.txt');
if (family.failed !== 0 || family.tests !== 273) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const seamSweep = summary('.audit/w45-57-seam.txt');
if (seamSweep.failed !== 0 || seamSweep.tests !== 8) throw new Error('the notify sweep is not clean');
const scanSweep = read('.audit/w45-57-scan.txt');
if ((scanSweep.match(/unresolved 0/g) ?? []).length !== 2) throw new Error('the two scanned copies did not scan clean');
const span = JSON.parse(read('.audit/w45-57-span.txt'));
if (span.total !== 0) throw new Error(`the span scan found ${span.total}`);
const notices = JSON.parse(read('.audit/w45-57-notices.txt').split('\n').filter((line) => line.startsWith('{')).at(-1));
if (notices.sha256 !== '384c78801194aedea80331383ccd93708c2dfa46bc746003dc112c930b73d13c') {
  throw new Error('the dependency-notice digest moved');
}
const smokeReport = read('.audit/w45-57-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 287) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const allMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
const sharedMarkers = read('.audit/w45-57-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-57-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45UiNotifyCompiled.v1')) throw new Error('the shared driver did not print the W45-57 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45UiNotifyCompiled.v1 (${sharedMarkers.length} markers in the shared driver, ${allMarkers.length} across every driver: it reads the entry out of the built table — the check's two refusals, the stamp that fills an absent title with the plugin name, the run over the sent, disabled and error channels off the dist copy — then sets the committed flag and proves the floor answers no-surface without asking the session, and resets it)`;

const evidence = {
  schema: 'W45UiNotifyEvidence.v1',
  package: 'W45-57 — the `$` table\'s ui.notify entry',
  date: '2026-10-16',
  question: 'What does the `$` table\'s ui.notify do — what does it refuse, what does it send, and what does it answer?',
  answer: 'The entry is `"ui.notify":{check:Dzo,stamp:Fzo,run:Nzo}` (chunk-sfn1dbxq.js [2353653,2353694) 41 units). The check reads the text through `LVe` (`takes a string text` for anything but a string, `undefined` for one) and, when the title is present, refuses a non-string with `title is a string, when given`. The stamp fills an absent title with the plugin name — `{...e, title:e.title||n.plugin}` — and the run reads it again itself, so the title reaches the session either way. The run first reads `wn()`, the committed flag: once the surface is committed it answers `{isSent:false, reason:\'no-surface\'}` without asking the session at all. Otherwise it calls the session\'s `notify?.(...)` with `{message, title, notificationType:\'plugin_notification\'}` and the caller\'s origin, and maps the channel it answers with through `qQt`: the five send channels (`iterm2`, `iterm2_with_bell`, `kitty`, `ghostty`, `terminal_bell`) answer `{isSent:true, channel}`, `disabled` answers `{isSent:false, reason:\'disabled\'}`, `none` and `no_method_available` answer `{isSent:false, reason:\'no-channel\'}`, and `error` throws the source\'s own error class with `\${plugin}: $.ui.notify: the channel\'s write failed`. An absent session, and a session that answers nothing, are both `no_surface` — the `?? \'no_surface\'` fallback. Every path then logs one line through `t`: `$.ui.notify (${plugin}): ${chars} chars: sent by ${channel}` or the reason.',
  ported: [notifyBlock, flagBlock].map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  planExtensions: [
    {
      plan: 'research/ports/W45-ui-blocks.plan.json',
      what: 'two blocks and six exports (`Dzo`, `qQt`, `Nzo`, `Fzo`, `wn`, `Ia`), plus the error class `He` on the copy\'s import line',
      blocks: '15 → 17 blocks, units 1,543 → 2,484 (the ui copy, W45-24/47\'s)',
      why: 'the entry\'s three bodies are contiguous in the source chunk and the committed flag they read is three contiguous statements in another module, so the whole entry is five statements; `LVe`, `bI` and `t` were already in the copy',
    },
  ],
  boundary: 'No new boundary: the four bodies resolve to copies the product carries — `LVe` (the text check) is in the same copy, `bI` (the bound session handle) is imported from ./plugin-chain-loader-source.js, `t` (the log line) from ./plugin-chain-host.js, and `He` (the error `qQt` throws) from ./plugin-chain-source.ts, where chunk-kd3dbbtb.js [661,807) has been copied since W45-2x. The seam now models the `stamp` field the source\'s entries may carry and records what reads it: `G2e` (chunk-sfn1dbxq.js [2356082,…)), the plugin-facing `$` dispatcher, applies `h.raise?.(caller)` then `h.stamp?.(raised, caller)` before `run` — so a check sees the raw argument and a run the stamped one. `G2e` is not ported; `Hze`, the hooks-then-floor path `raiseUiCall` mirrors, never reads the field, which is asserted rather than assumed: with no hooks registered the floor runs without its check, and a bad title still reaches the run.',
  measured: [
    'The check: `{text:"hi"}` admitted, a string title admitted, `title:undefined` admitted, a non-string title refused with `title is a string, when given`, a missing or non-string text refused with `takes a string text` (the same text for no argument at all).',
    'The stamp: an absent or empty title becomes the plugin name, a present one is kept, and the argument\'s other keys survive.',
    'The run\'s channels, measured one at a time: five send channels answer `{isSent:true, channel}`, `disabled` answers the disabled reason, `none` and `no_method_available` answer `no-channel`, and `error` throws the error class whose `name` is `HooksError` and whose constructor is `He`.',
    'An absent session and a session that answers `undefined` are both `{isSent:false, reason:"no-surface"}` — the source\'s `?? "no_surface"` fallback.',
    'The request the session receives is `{message, title, notificationType:"plugin_notification"}` with the caller\'s origin, and the title is filled by the run itself, so the stamp is not what makes the title correct.',
    'The committed gate: `wn()` false in a fresh process; with the flag committed the floor answers `no-surface` and the session is never called — measured with a counting session — and uncommitting restores the send path.',
    '`qQt`\'s switch has no default, so a channel name it does not know answers `undefined` and the log line then throws `TypeError`. The source has the same hole; it is asserted rather than smoothed over, and the six names it does know are the ones enumerated here.',
    'The seam\'s raise path with no hooks registered runs the floor without consulting the check — measured, and the reason the check\'s own refusals are asserted against the body rather than through `raiseUiCall`.',
  ],
  regressions: `the new notify suite ${seamSweep.passed}/${seamSweep.tests}; the selection suite's table assertion now names five; ${familyLine}`,
  full: fullLine,
  compiled: driverLine,
  smoke,
  next_package: [
    'the settings *read* path behind `y9e` (`Qnn` + `$t`): measured now — 590 statements / 327,047 units in chunk-3cynezh1.js, of which 79 (8,785 units) are already carried by the merge and source copies, so 511 statements / 318,262 units are fresh and it is a multi-package subsystem, not one unit',
    'the remaining `$` table entries beside this one, each measured the same way first: `ui.blit` (`fNs`/`mNs` 23 statements / 3,349 units in chunk-n3ykh62m.js, plus `kFo` 701u and `bFo` 48u in the big chunk), `ui.scroll` (`L5n` 808u), `ui.focus` (`fzo` 202u + `Szo` 532u), `ui.copy` (`wGo`/`uzo`/`dzo`), `state.get`/`state.set` (`Pur`/`Our`, `Iur`/`$ss`/`Hur`), `fs.ancestors` (`kNs` 492u)',
    'the plugin-facing `$` dispatcher `G2e` (chunk-sfn1dbxq.js [2356082,…)) — the path that applies `raise` then `stamp` then `run`, which would give this package\'s `stamp` field its consumer',
    'the managed-settings gate `CT` (chunk-4bw62nzm.js) and `Tp` (chunk-wtch2p0g.js, 1 statement / 263 units) that `fe` consults before a read, which would let `settings.read` drop its bound hook',
    'registering the `store.*`, `settings.read` and remaining `ui.*` cores in the product\'s chain catalog once the product has a `$` surface to call them from',
    '`http.fetch` (`VQt`) once the request runner `dNo` is ported; Q-086\'s 15 registry-reading cores and their 34 sites; the notification provider `a4n`; the config/home layer behind `be`',
  ],
};
write('research/ports/W45-ui-notify-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-57 **补 `$` 表 ui.notify',
  features: '; W45-57 ports the `$` table\'s ui.notify entry',
  standard: '2026-10-16 W45-57 $ 表 ui.notify',
  status: 'W45-57: the `$` table\'s ui.notify entry.',
  runner: '## W45-57 ported the `$` table\'s ui.notify entry',
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
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-57 **补 \`$\` 表 \`ui.notify\` 条目**（插件发终端通知这一条：拒什么、发什么、回什么）：**2 段 941 单位**——chunk-sfn1dbxq.js [2338792,2339663) 871u（\`Dzo\` 检查 129u + \`qQt\` 通道映射 394u + \`Nzo\` 执行 300u + \`Fzo\` stamp 48u，四者在该块内**连续**）+ chunk-r2vtj1kh.js [150398,150468) 70u（\`class Na\` + \`var Ia=new Na\` + \`wn()\` 已提交标志）。**表片段逐字**：\`"ui.notify":{check:Dzo,stamp:Fzo,run:Nzo}\`（源 literal [2353653,2353694) 41u）。**语义（源文实测）**：检查只读 text（非字符串→\`takes a string text\`；缺 text 同文）与"给了 title 时"（非字符串→\`title is a string, when given\`）；stamp 把缺省/空 title 填成插件名（\`{...e,title:e.title||n.plugin}\`）；执行先读 \`wn()\` **已提交标志**——已提交则直接 \`{isSent:false,reason:'no-surface'}\` 且**根本不问 session**；否则 \`notify?.({message,title,notificationType:'plugin_notification'},origin)\`，通道映射 \`qQt\`：五个发送通道→\`{isSent:true,channel}\`、\`disabled\`→\`disabled\`、\`none\`/\`no_method_available\`→\`no-channel\`、\`error\`→**抛源自己的错误类**（\`name\` 为 \`HooksError\`、构造器 \`He\`，文案 \`\${plugin}: $.ui.notify: the channel's write failed\`）；无 session 与 session 答 undefined 都走 \`?? 'no_surface'\`；每条路径都经 \`t\` 记一行。**两处如实标注**：① \`qQt\` 的 switch **无 default**，未知通道串→\`undefined\`→日志行读 \`.isSent\` 抛 \`TypeError\`（源同此洞，实测断言而非抹平）；② \`stamp\` 字段的消费者是**插件面派发器 \`G2e\`**（chunk-sfn1dbxq.js [2356082,…)，\`h.raise?.(V)\`→\`h.stamp?.(Se,V)\`→\`run\`，故 check 见原始入参、run 见盖章后入参），本包**不搬 \`G2e\`**；seam 镜像的 \`Hze\` 根本不读 \`stamp\`，实测"无 hook 时 floor 跳过 check"（坏 title 仍到 run）。**边界**：无新边界——\`LVe\` 同副本、\`bI\` 来自 loader 副本、\`t\` 来自 host、\`He\` 自 W45-2x 就在 \`plugin-chain-source.ts\`（chunk-kd3dbbtb.js [661,807)）；ui 副本 15→17 段、1,543→2,484u，ui 计划导出 15→21。验收：check/build/notices（摘要未变）、两副本 \`unresolved 0\`、span 扫描 \`total 0\`、**${chain}**、ui 账本 17 段逐段回源 + acorn（完整语句、无重叠、无切半）+ 顺序断言（\`class Na\`→\`var Ia\`→\`wn\`）、正文逐字（\`Dzo\`/\`qQt\`/\`Nzo\`/\`Fzo\`、表片段、\`G2e\` 的 stamp 行）、seam 判据、新回归 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45UiNotifyCompiled.v1\`，共享 ${sharedMarkers.length} 标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [ui.notify 证据](ports/W45-ui-notify-evidence.json)、[本地设置存储证据](ports/W45-local-store-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
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
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-57 ports the \`$\` table's ui.notify entry: ` +
  'its check, its stamp that fills an absent title with the plugin name, and its floor that reads the committed flag before ' +
  'it asks the session, maps the channel the session answers with (including the error class a failed write throws), and logs ' +
  'one line per attempt — the fifth name in the ported table slice. |';
write('research/FEATURES.md', lines.join('\n'));

const standard = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standard.indexOf('2026-10-16 W45-56 本地设置存储');
if (standardAt < 0) throw new Error('coding-standard W45-56 line not found');
const standardEntry = `2026-10-16 W45-57 \\\`$\\\` 表 ui.notify：S-1至S-7已对照。S-1（先读源）：W45-53 的证据把 \\\`ui.notify\\\` 列为待办后，先量闭包——种子 \\\`Dzo\\\`/\\\`Nzo\\\`/\\\`Fzo\\\` 得 **7 段 1,120 单位**（其中 \\\`rht\\\`/\\\`DT\\\`/\\\`bI\\\` 194+37+18u 早在 loader 副本里），**关键正文逐字读过再动手**（\\\`Dzo\\\` 的 \\\`LVe(e?.text)??(r?void 0:"title is a string, when given")\\\`、\\\`qQt\\\` 的六分支 switch 与 \\\`throw new He(...)\\\`、\\\`Nzo\\\` 的 \\\`wn()\\\` 门与 \\\`?? "no_surface"\\\` 回退、\\\`Fzo\\\` 的 \\\`title:e.title||n.plugin\\\`）；另查 \\\`pnpm\\\` 之外的依赖闭包：\\\`LVe\\\` 62u 在 tvdq3hrk、\\\`wn\\\` 三句 70u 在 r2vtj1kh、\\\`He\\\` 146u 自 W45-2x 已在 source 副本。S-2（不留半包）：无新边界（四个自由名全落在已搬副本上）；\\\`stamp\\\` 字段的消费者 \\\`G2e\\\` 与 \\\`ui.copy\\\` 的 \\\`uzo\\\` 一样**不搬也不发明**，seam 只记录它与 \\\`Hze\\\` 的区别（后者不读 stamp），并把"无 hook 时 floor 跳过 check"作为实测行为断言。S-3（先测后断言）：\\\`.audit/w45-57-probe.ts\\\` 先跑，再写 8 条断言；**两处按实测纠偏**——① 首版把错误类的 \\\`name\\\` 写成 \\\`He\\\`，实测 \\\`name\\\` 是 \\\`HooksError\\\`（构造器才是 \\\`He\\\`）；② 首版以为 \\\`raiseUiCall\\\` 会先过 check，实测无 hook 时 \\\`Hze\\\` 直接跑 floor（坏 title 仍到达 run），故 check 的拒答改为对正文断言。另测出 \\\`qQt\\\` switch **无 default**：未知通道名→\\\`undefined\\\`→日志行抛 \\\`TypeError\\\`（源同此洞，如实断言）。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器/打包冒烟/${drivers.length} 个编译驱动并解析输出，并断言 span 扫描 \\\`total 0\\\`、notices 摘要未变；acorn（完整语句、无重叠、无切半）+ 顺序断言 + 正文与表片段逐字 + 两副本 \\\`unresolved 0\\\`。S-5/S-6：seam 只加一个事件名、一个可选字段 \\\`stamp\\\`、一个可选 session 面 \\\`notify\\\` 与一条表项，无死导出；\\\`stamp\\\` 的语义（raised→stamped→run）引自源文而非推测。S-7：\\\`y9e\\\` 读路径（实测 590 段/327,047u，已覆盖 79 段/8,785u，**余 318,262u 是子系统**）、\\\`ui.blit\\\`/\\\`scroll\\\`/\\\`focus\\\`/\\\`copy\\\`、\\\`state.*\\\`、\\\`fs.ancestors\\\`、\\\`G2e\\\`、\\\`CT\\\`/\\\`Tp\\\`、\\\`$\\\` 表面注册、Q-086 写入 next_package。验收：check/build/notices、两副本扫描 unresolved 0、${chain}、账本与正文自证、回归 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf('W45-56: the local settings store.');
if (statusAt < 0) throw new Error('STATUS W45-56 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = 'W45-57: the `$` table\'s ui.notify entry. The source\'s table literal is `"ui.notify":{check:Dzo,stamp:Fzo,run:Nzo}` ' +
  '(chunk-sfn1dbxq.js [2353653,2353694) 41 units) and all three bodies are now ported: `Dzo` reads the text through `LVe` and, ' +
  'when a title is present, insists it is a string; `Fzo` fills an absent title with the plugin name; `Nzo` reads the committed ' +
  'flag `wn()` first — once the surface is committed it answers `no-surface` without asking the session — then calls the ' +
  'session\'s `notify` and maps the channel it answers with: five send channels answer `{isSent, channel}`, `disabled` and ' +
  '`none`/`no_method_available` answer their reasons, and `error` throws the source\'s own error class. Two statements in ' +
  'chunk-r2vtj1kh.js carry the flag. No new boundary: `LVe` is in the same copy, `bI` and `t` come from copies the ui seam ' +
  'already imports, and `He` has been in ./plugin-chain-source.ts since W45-2x. This package also models the `stamp` field the ' +
  'seam had only recorded: the plugin-facing dispatcher `G2e` applies `raise` then `stamp` then `run`, so a check sees the raw ' +
  'argument and a run the stamped one, while `Hze` — the path `raiseUiCall` mirrors — never reads it, which the suite asserts ' +
  'rather than assumes. Two measurements corrected the draft: the error class a failed write throws reports its `name` as ' +
  '`HooksError` (its constructor is `He`), and the raise path with no hooks runs the floor without consulting the check. A ' +
  'third is asserted as the source\'s own hole: `qQt`\'s switch has no default, so a channel name it does not know answers ' +
  '`undefined` and the log line then throws a `TypeError`. Evidence: `research/ports/W45-ui-notify-evidence.json`, and\n' +
  '[工作包](ports/W45-chain-runner.md).\n\n';
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-57 ported the \`$\` table's ui.notify entry (2026-10-16)

The entry is \`"ui.notify":{check:Dzo,stamp:Fzo,run:Nzo}\` — 41 units of the source's table literal — and all three bodies came
across in two blocks: the four contiguous statements at chunk-sfn1dbxq.js [2338792,2339663) (871 units) and the committed
flag's three statements at chunk-r2vtj1kh.js [150398,150468) (70 units). The check reads the text through \`LVe\` (\`takes a
string text\` for anything that is not one) and, when a title is present, refuses a non-string with \`title is a string, when
given\`. The stamp fills an absent or empty title with the plugin name. The run reads \`wn()\` first: once the surface is
committed it answers \`{isSent:false, reason:'no-surface'}\` without asking the session at all. Otherwise it calls the session's
\`notify\` with \`{message, title, notificationType:'plugin_notification'}\` and the caller's origin, then maps the channel
through \`qQt\` — five send channels answer \`{isSent:true, channel}\`, \`disabled\` and \`none\`/\`no_method_available\` answer their
reasons, and \`error\` throws the source's own error class — and logs one line per attempt.

No new boundary. \`LVe\` was already in the same copy, \`bI\` comes from the loader copy, \`t\` from the host copy, and \`He\` from
./plugin-chain-source.ts, where chunk-kd3dbbtb.js [661,807) has been copied since W45-2x. The ui copy grew 15 → 17 blocks and
1,543 → 2,484 units, and the plan's exports 15 → 21.

This package also models what the seam had only recorded: the \`stamp\` field. Its consumer is \`G2e\`
(chunk-sfn1dbxq.js [2356082,…)), the plugin-facing \`$\` dispatcher, which applies \`h.raise?.(caller)\` then
\`h.stamp?.(raised, caller)\` before \`run\` — so a check sees the raw argument and a run the stamped one. \`G2e\` is not ported;
\`Hze\`, the hooks-then-floor path \`raiseUiCall\` mirrors, never reads the field, and the suite asserts that difference rather
than assuming it: with no hooks registered the floor runs without its check, so a bad title still reaches the run. The
neighbouring \`ui.copy\` entry's stamp has no ported body yet.

Measured before asserted, and two measurements corrected the draft. The error class a failed write throws reports its \`name\`
as \`HooksError\` — its constructor is \`He\` — and the check is only consulted when hooks are registered ahead of the floor. A
third measurement is the source's own hole, asserted as such: \`qQt\`'s switch has no default, so a channel name it does not
know answers \`undefined\` and the log line built after it throws a \`TypeError\`. The committed gate is measured with a counting
session: committed, the session is never called, and uncommitting restores the send path.

Verified: check/build/notices, both scanned copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, the ui ledger re-read block
by block with acorn and an order assertion on the flag block, body comparisons for the four statements and the table fragment,
the seam's new event, stamp field, entry and session surface, the new suite ${seamSweep.passed}/${seamSweep.tests} (the selection
suite's table assertion now names five), ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers (the shared driver now
also prints \`W45UiNotifyCompiled.v1\`), and the packaged smoke (${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs
by the record script itself).

Next: the remaining \`$\` table entries, each measured the same way first — \`ui.blit\` (\`fNs\`/\`mNs\` 23 statements / 3,349 units
plus \`kFo\` 701u and \`bFo\` 48u in the big chunk), \`ui.scroll\`, \`ui.focus\`, \`ui.copy\`, \`state.get\`/\`state.set\`, \`fs.ancestors\` —
and the dispatcher \`G2e\`, which would give this package's \`stamp\` field its consumer. The settings read path behind \`y9e\` is
now measured: 590 statements / 327,047 units, 79 of them already carried, so 318,262 fresh units — a subsystem to walk in
pieces rather than one package.
`);

const rows = [
  ['2026-10-17T06:20:00Z', 'package', 'W45-57 补 `$` 表 ui.notify 条目（插件终端通知：2 段 941 单位 = sfn1dbxq 871u 四句连续 + r2vtj1kh 70u 已提交标志）',
    'Dzo/qQt/Nzo/Fzo/wn/Ia 成为产品面：表项 {check,stamp,run} 逐字入 seam，UiCallEvent 增 ui.notify、UiCallEntry 首次带 stamp、PluginUiSession 增 notify；ui 副本 15→17 段、1,543→2,484u',
    'chunk-sfn1dbxq.js [2338792,2339663) 871u（Dzo 129u + qQt 394u + Nzo 300u + Fzo 48u）+ chunk-r2vtj1kh.js [150398,150468) 70u（class Na + var Ia=new Na + wn）；表片段 [2353653,2353694) 41u 逐字；LVe/bI/t/He 全在既有副本',
    `实测（.audit/w45-57-probe.ts 与 test/plugin-chain-ui-notify.test.ts + .audit/w45-24-compiled.mjs）：检查两条拒答与三条放行、stamp 三种、六类通道答案与 error 抛 HeHooksError、无 session/undefined 的 no-surface、已提交门（session 计数为 0）、未知通道的 TypeError 洞、无 hook 时 floor 跳过 check；8/8 通过`],
  ['2026-10-17T06:23:00Z', 'finding', 'W45-57 实测纠偏：错误类 name 是 HooksError、无 hook 时 check 被跳过',
    '首版断言 ① 抛出的错误 name 为 He（实测 name 是 HooksError，构造器才是 He）、② raiseUiCall 会先过 check（实测无 hook 时 Hze 直接 `return YPn(b,()=>s.run(n,r))`，坏 title 仍到 run）',
    '两处按实测改写：name 断言改为 HooksError + constructor.name He；check 的拒答改为直接对 Dzo 正文断言，raise 路径单独断言"无 hook 跑 floor"',
    '回归 8/8；selection 套件表名断言同步改为五个名字'],
  ['2026-10-17T06:25:00Z', 'finding', 'W45-57 如实标注源自身的洞：qQt switch 无 default → 未知通道抛 TypeError',
    'qQt 的 switch 只列 no_surface / 五个发送通道 / disabled / none / no_method_available / error，没有 default；session 若答未知串（实测 "weird"），qQt 返回 undefined，Nzo 的日志行接着读 s.isSent 抛 TypeError',
    '在 seam 与测试中如实记录并断言 TypeError（不抹平、不补 default——源没有），并把"它知道的六个名字"写进证据',
    '回归 8/8 通过；证据 measured 第三条记录'],
  ['2026-10-17T06:28:00Z', 'verification', `W45-57 验收：两副本 unresolved 0、span total 0、ui 账本 17 段逐段回源 + acorn + 顺序断言 + 表片段与正文逐字、${chain}、回归 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '`$` 表 ui 家族再补一条，下一包继续 ui.* 其余条目或 G2e 派发器',
    `check/build/notices；两副本 unresolved 0；span 扫描 total 0；${chain}；ui 账本 17 段逐段回源比长度与内容 + acorn（完整语句、无重叠、无切半）+ 顺序断言（class Na→var Ia→wn）；Dzo/qQt/Nzo/Fzo 与表片段逐字、G2e 的 stamp 行存在断言；seam 判据（事件名、stamp 字段、表项三行、notify 面、不搬 G2e 的说明）；selection 套件五名断言；回归 8/8；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45UiNotifyCompiled.v1，共享 ${sharedMarkers.length} 标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-57 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-57 acceptance (2026-10-16)

- [x] **The queue picked the package.** W45-53 recorded \`fe\`/\`ft\`'s reach as the next package and named the ui entries as the smaller ready ones; \`ui.notify\` measured smallest and whole, so it went first — and the settings read path was measured this tick as well (590 statements / 327,047 units, 318,262 fresh), which is why it is a subsystem rather than a package.
- [x] **The whole entry came across.** Two blocks, 941 units: the four contiguous statements of the floor and the three statements of the committed flag, with the table fragment quoted verbatim in the seam.
- [x] **Obtainable source was copied, not bound.** \`Dzo\`, \`qQt\`, \`Nzo\`, \`Fzo\` and the flag came across as text; \`LVe\`, \`bI\`, \`t\` and \`He\` resolve to copies the product already carries; the dispatcher \`G2e\` stays named as unported.
- [x] **A recorded field became a modelled one.** The seam's note that \`stamp\` was recorded rather than modelled is replaced by the field itself, its consumer and the measured difference between the two dispatch paths.
- [x] **Everything measured before it was asserted.** The check's two refusals, the stamp's three cases, the six channel answers plus the thrown error class, the \`no_surface\` fallback both ways, the committed gate with a counting session, and the unknown-channel hole — with two first-draft assertions corrected by the probe.
- [x] **Sweep.** check/build/notices, both copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, the ui ledger with acorn, order and body checks, new suite ${seamSweep.passed}/${seamSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
