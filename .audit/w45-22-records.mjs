// W45-22 records: the stream-call evidence, the four indexes, the two audit trails and the recon's
// correction. Anchored inserts assert their target before writing.
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const evidence = {
  schema: 'W45StreamCallEvidence.v1',
  package: 'W45-22 — the module-to-host call path, streaming half (the `streamOps` raise)',
  date: '2026-10-15',
  question: "W45-21 measured the gap: `aGe`, the streaming twin of `Hze`. What does landing it cost, and what are its observable rules?",
  answer: '`aGe` raises a streaming plugin call: it collects the event\'s streaming handlers (`has`), waits out a loading module (`N5t`) and retries, runs the streaming stage (`iwr` over `Jx`) and relays the chunks through `tRe`. Its callers are the plugin `$` surface\'s streaming dispatcher `Iye`, which this product does not have, so the seam ships with no call site — the same shape as W45-20.',
  coordinates: {
    modules: [
      'chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da (tzt/ezt/aGe 929 — the entry)',
      'chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f (the streaming dispatch family 9,074)',
      'chunk-yjc18bey.js (the clock: mIr/nS/Q 563)',
      'chunk-2kdsvp3x.js sha256 2005e8ff7e9534510b3d7f687d6a190f21c5930f1d8e5397070e2fa018bf52d2 (et 478, _o 523, ft 19, ct/has 625 — the streaming record family)',
    ],
    entry: 'chunk-sfn1dbxq.js [1843388,1844317) — `function aGe({event, args, caller, bottom})`',
    caller: '`Iye` (chunk-sfn1dbxq.js [2356982,2357180)) — the streaming plugin-call dispatcher: `let h = e.streamOps[n]; Sme(e, {spelling: n, caller: s, isClock: !1}); let y = h.check?.(r, s); return aGe({event: n, args: r, caller: s, ...!sIt() && {bottom: h}})`',
    layout: 'three generated files, by the source\'s own module graph (chunk-sfn1dbxq.js imports `has` from chunk-2kdsvp3x.js, which imports `tRe` from chunk-nyce03br.js): src/plugin-chain-stream-source.ts (2 blocks / 9,637 units), src/plugin-chain-stream-call-source.ts (1 block / 929 units), and the streaming record family added to src/plugin-chain-records.ts (4 blocks / 1,645 units, now 56 blocks / 12,117 units)',
    plans: 'research/ports/W45-stream-blocks.plan.json, research/ports/W45-stream-call-blocks.plan.json, research/ports/W45-chain-records-blocks.plan.json (the family appended)',
  },
  measurements: [
    'The two `Q`s are different functions and cannot share a file. chunk-nyce03br.js imports `Q` (the abortable clock sleep, chunk-yjc18bey.js [1118,1503)) while chunk-2kdsvp3x.js declares its own `Q` (the per-record dispatch counter stamp, 555 units, already carried in records). A single file declaring both is impossible verbatim, and a single import would bind one of the two call sites to the wrong body — which is what fixed the file layout.',
    'The module graph decides the layering: sfn1dbxq → 2kdsvp3x → nyce03br, so the records copy imports `tRe` from the stream copy and the stream copy imports `has` from records. The two bindings are hoisted function declarations read at call time, so the cycle evaluates safely (the W45-20 TDZ case was a const read during evaluation).',
    'The short circuit is the value path\'s: no handler and a floor means `bottom.stream(args, caller)` is returned as the stream itself — the caller\'s own argument, no dispatch, and the table entry\'s `check` never runs. Measured and asserted.',
    'A native streaming provider is the module\'s own `streamLinks({event, leftOut, told, causes, hookOrigin})` (the copied `_o` reads it; a module without it is collected as a hop record `ct` instead, which opens the layer below). The product surface had no such field, so `ChainModule.streamLinks` and its pass-through in both record factories were added; `ChainModuleRecord.streamLinks` types what `_o` reads.',
    'The answer shape is the site\'s, per event: `model.complete`/`audio.speak` accept `{value}`/`{deny}`, `session.receive` accepts `{text}`/`{consumed}`. A provider answer the site refuses is *skipped* to the layer below (the copied `ip` effect), not thrown — measured, and the reason the regressions use `model.complete`.',
    'The withheld-result suffix `tzt` is a state, not a count of the provider\'s own chunks: "" when nothing below ran, " started, and a plugin withheld its result" once the floor yielded a chunk, " ran, and a plugin withheld its result" once the floor\'s stream completed. All three measured and asserted.',
    'The floor\'s `check` refusal text is the source\'s `${event}: ${text} (host check)`; the denial text is `${plugin}: $.${event}${tzt[state]}: ${deny}`; both throw the product\'s `HooksError` (`He`). There is no argument copier on this path.',
  ],
  landed: [
    'Two new generated copies (src/plugin-chain-stream-source.ts, src/plugin-chain-stream-call-source.ts) plus the streaming record family appended to the existing records copy; the seam is src/plugin-chain-stream-call.ts (`raiseStreamingHostCall` and the caller/bottom/answer contracts).',
    'ChainModule gained the source\'s own streaming-provider field: `streamLinks?: (input: ChainStreamLinksInput) => readonly ChainHandler[]`, carried into the record by both factories, so a module can provide streams instead of only answering values.',
    'The records copy exports the streaming family (`et`, `_o`, `ft`, `ct`, `has`); the runner copy gained the 24 names the streaming range references from its other ranges (`We`, `TFe`, `cs`, `Ve`, `Bo`, `rwr`, `ss`, `Ja`, `ys`, `lt`, `ae`, `gt`, `ps`, `fp`, `fs`, `ap`, `xt`, `Uo`, `Kg`, `tp`, `dEs`, `Fgo`, `Gt`, `a8`) and the classic-raise copy exports `Bde`. No body was copied twice.',
    'scripts/verify-chain-copies.mjs gained the two new plan/product pairs (24 plans, byte-identical).',
  ],
  corrections: [
    'W45-21 classified `Q` as already carried by name; the body test shows the carried `Q` is chunk-2kdsvp3x.js\'s, and the streaming range needs chunk-yjc18bey.js\'s — different bodies with the same name (the Q-089 trap, this time in the measurement rather than the copy).',
    'W45-21 proposed `_o` as a new body from chunk-nyce03br.js; the only use site is the records family\'s `has`, and the `_o` it calls is chunk-2kdsvp3x.js\'s [35875,36398).',
    '`source-undeclared-scan.mjs` reported unresolved 0 while the streaming copy still referenced `a8` undeclared: the scan counts any nested local declaration as declared, so a name that exists as a local inside one copied function hides a real gap elsewhere. The compiled driver caught it (`ReferenceError: a8 is not defined`); the fix here is the import, the scan\'s scope handling is W45-23.',
  ],
  verification: {
    identity: {
      sha256: '0b849c4f49983a3a40389abe766da11fdd377b875b937956cb6073294bfcb279',
      inputs: { sha256: '250bb6fc73ff959731bf2b9d3088b0b4d7ab12dcfb64120bca1beb24febcb294', files: 305 },
      validation: { sha256: 'c63047c6aa2a0d5239bff235622f8647e82580483cff7db014ebea6929dc753b', files: 120 },
      build: { sha256: 'ed750c7f231f24681d455aa5ed024b24255581d62fd5ad2bc2589e7ebfe77455', files: 214 },
    },
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    copy_verifier: 'passed true, 24 plans',
    undeclared_scan: 'src/plugin-chain-stream-source.ts unresolved 0; src/plugin-chain-stream-call-source.ts unresolved 0; src/plugin-chain-records.ts unresolved 0; src/plugin-chain-source.ts unresolved 0; src/plugin-chain-classic-raise-source.ts unresolved 0',
    focused: 'test/plugin-chain-stream-call.test.ts 3/3; all 14 chain test files 67/67',
    full: '1323/1323',
    compiled: 'the fourteenth dist driver .audit/w45-22-compiled.mjs prints W45StreamCallCompiled.v1 (floor short circuit, provider relay, check refusal, three withheld texts)',
    smoke: 'scripts/smoke-package.mjs passed (packaged CLI, offline install, launcher, startup), upstreamRequests 0, 222 files',
  },
  limitations: [
    'No product call site: the seam awaits the plugin `$` surface\'s streaming dispatcher (`Iye`), which this product does not have.',
    'The product loads plugin modules through the copied loader `tGe` (whose records are the source\'s own); the streaming-provider field is exercised through `installChainModule`/`setChainRecordFactory`, so a plugin *file* that provides streams is untested until a loader-shaped fixture exists.',
    'The withheld-result suffix tracks the floor, not the provider\'s chunks: a provider that yields and then denies without opening the floor reports the empty suffix.',
  ],
  next_package: [
    'W45-23: make scripts/source-undeclared-scan.mjs scope-aware (a name declared only inside one copied function must not satisfy a reference in another), with the `a8` case as its regression.',
    'the `ui.status` floor (`LWt` → `Vyt`, the session-bound plugin-status registry) and the `ui.log` floor (`Pzo`/`$2e`/`Yb` recorder); `mce` is already carried',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
  ],
};
write('research/ports/W45-stream-call-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

// The work-package record.
const runner = read('research/ports/W45-chain-runner.md');
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-22 landed the streaming half of the call path (2026-10-15)

\`aGe\` (chunk-sfn1dbxq.js [1843388,1844317)) is \`Hze\`'s streaming twin: the same \`N5t\` wait gate and
the same handler collection, but a streaming dispatch (\`iwr\` over the stage \`Jx\`), a floor that
relays a stream (\`bottom.stream(args, caller)\` plus the entry's \`check\`) and a withheld-result note
(\`tzt\`). Its callers are the plugin \`$\` surface's streaming dispatcher \`Iye\`, so like W45-20 the
product gets the seam and no call site.

What the measurements forced, all recorded in the seam and the regressions:

- **The two \`Q\`s are two functions.** chunk-nyce03br.js imports the abortable clock sleep
  (chunk-yjc18bey.js [1118,1503)); chunk-2kdsvp3x.js declares its own \`Q\`, which the streaming hop
  calls. One file may declare only one of them, so the layout follows the source's module graph:
  chunk-nyce03br.js + the clock in src/plugin-chain-stream-source.ts, the record family in
  src/plugin-chain-records.ts, the raise entry in src/plugin-chain-stream-call-source.ts.
- **A streaming provider is the module's own \`streamLinks\`.** A module without it is collected as a
  hop record and opens the layer below instead of producing chunks; the product surface had no such
  field, so \`ChainModule.streamLinks\` and its pass-through in both record factories were added.
- **A refused answer is skipped, not thrown.** The site decides the answer shape per event
  (\`model.complete\` accepts \`{value}\`/\`{deny}\`, \`session.receive\` accepts \`{text}\`/\`{consumed}\`); an
  answer the site refuses falls to the layer below with the copied \`ip\` effect.
- **The suffix is a state.** \`tzt\` says whether the *floor* ran, not how many chunks the provider
  yielded: "" / " started, and a plugin withheld its result" / " ran, and a plugin withheld its result".

Verified: check/build/notices pass, 24 copy plans regenerate byte-identically, five copies scan
0 undeclared, the new regression file is 3/3, all 14 chain test files are 67/67, full 1323/1323, the
fourteenth compiled driver prints \`W45StreamCallCompiled.v1\` against \`dist/\`, and
\`scripts/smoke-package.mjs\` passes the packaged CLI, offline install and launcher checks with zero
upstream requests. Identity \`0b849c4f…\`.
`);

// CURRENT: the package row above the W45-21 one.
const current = read('research/CURRENT.md');
const currentRow = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-15最新**：W45-22 **已落地流式一半的「模块→宿主」调用路径**（\`aGe\`，W45-20 \`Hze\` 的孪生）：\`tzt\`/\`ezt\`/\`aGe\` 929 单位 + 流式派发族 9,074 单位（chunk-nyce03br.js）+ 时钟 \`mIr\`/\`nS\`/\`Q\` 563 单位（chunk-yjc18bey.js）+ 流式记录族 \`et\`/\`_o\`/\`ft\`/\`ct\`/\`has\` 1,645 单位（chunk-2kdsvp3x.js，**并入既有 records 副本**）＝三文件 11,211 单位；缝 \`src/plugin-chain-stream-call.ts\`（\`raiseStreamingHostCall\`）。**测清并纠正 W45-21 两处**：(1) \`Q\` 是同名两函数——chunk-nyce03br.js 引的是时钟睡眠（chunk-yjc18bey.js [1118,1503)），chunk-2kdsvp3x.js 自己声明了记录用 \`Q\`（已在 records 副本），故按**源自己的模块图**分三文件（sfn1dbxq → 2kdsvp3x → nyce03br，records 引 \`tRe\`、stream 引 \`has\`，均为提升函数声明、调用期读取）；(2) \`_o\` 唯一使用点在 records 族 \`has\`，取 chunk-2kdsvp3x.js [35875,36398)。**行为实测**：无 handler 时短接返回 floor 自身流（\`check\` 不跑）；原生流提供者是模块自身的 \`streamLinks\`（\`_o\` 读它；无此字段的模块被收成 hop 记录 \`ct\`，改为打开下一层），故产品 \`ChainModule.streamLinks\` 与两处 record 工厂透传为**本包产品改动**；站点按事件定答案形状（\`model.complete\` 收 \`{value}\`/\`{deny}\`，\`session.receive\` 收 \`{text}\`/\`{consumed}\`），被拒答案**跳过到下层**（\`ip\`）而非抛出；\`tzt\` 是状态不是计数（\"\"/started/ran）；拒绝文案 \`${'`'}${'$'}{plugin}: ${'$'}.${'$'}{event}${'$'}{tzt[state]}: ${'$'}{deny}${'`'}\`、floor \`check\` 文案 \`${'`'}(host check)${'`'}\`。**工具缺陷**：\`source-undeclared-scan.mjs\` 把任意嵌套局部声明计为已声明，导致 \`a8\` 未声明却报 unresolved 0（编译驱动抓到 ReferenceError），修补列为 W45-23。验收：check/build/notices、**24 计划**逐字节一致、五副本未声明 0、聚焦 3/3、链测试 67/67、全量 **1323/1323**、第十四个编译驱动 \`W45StreamCallCompiled.v1\`、打包冒烟 0 上游请求；身份 \`0b849c4f…\`。 | [流式证据](ports/W45-stream-call-evidence.json)、[工作包](ports/W45-chain-runner.md)、[流式侦察](ports/W45-stream-recon.json) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('C-12 row not found');
write('research/CURRENT.md', current.slice(0, at) + currentRow + '\n' + current.slice(at));

// FEATURES: the Lifecycle hooks row's last cell.
const features = read('research/FEATURES.md');
const featureLine = features.split('\n').findIndex((l) => l.startsWith('| Lifecycle hooks | Partial |'));
if (featureLine < 0) throw new Error('Lifecycle hooks row not found');
const lines = features.split('\n');
const row = lines[featureLine];
const lastPipe = row.lastIndexOf('|');
if (lastPipe < 0) throw new Error('row has no trailing cell');
lines[featureLine] = row.slice(0, lastPipe).replace(/\s+$/, '') +
  ', and the streaming `streamOps` events (`session.receive`, `model.complete`, `audio.speak`) are now carried the same way (W45-22: `raiseStreamingHostCall`, the stage `Jx`/`iwr` and the record family `et`/`_o`/`ct`/`has`, with the native-provider field `ChainModule.streamLinks` added to the host surface; no product caller until the plugin `$` surface\'s streaming dispatcher exists) |';
write('research/FEATURES.md', lines.join('\n'));

// question.md: append to the Q-088 section.
const question = read('research/question.md');
const qStart = question.indexOf('### Q-088 ');
if (qStart < 0) throw new Error('Q-088 section not found');
const nextHeading = question.indexOf('\n### ', qStart + 1);
if (nextHeading < 0) throw new Error('Q-088 section end not found');
const qEntry = `
**W45-22 落地**：流式一半的「模块→宿主」调用路径已搬（\`aGe\` 929 + 流式派发族 9,074 + 时钟 563 + 流式记录族 1,645＝三文件 11,211 单位；缝 \`src/plugin-chain-stream-call.ts\`），形态与 W45-20 相同：源的每个 \`aGe\` 调用者都是插件 \`$\` 面的流式派发器 \`Iye\`（读 \`e.streamOps[n]\`），本产品无 \`$\` 面故只落缝、无调用点。本包纠正了 W45-21 的两处按名测法（\`Q\` 同名两函数、\`_o\` 的真身模块），并记下一条工具缺陷：\`source-undeclared-scan.mjs\` 将嵌套局部声明误计为已声明（\`a8\` 因此漏报），已列 W45-23。本条对值事件与流式事件各剩一层：\`ui.status\`/\`ui.log\` 的源内落地（\`LWt\`→\`Vyt\`、\`Pzo\`/\`$2e\`/\`Yb\`；\`mce\` 已搬）与 Q-086 的 15 个读注册表核心（34 处）。
`;
write('research/question.md', question.slice(0, nextHeading) + qEntry + question.slice(nextHeading));

// STATUS: the package paragraph above the W45-20 one.
const status = read('research/STATUS.md');
const statusAnchor = 'W45-20: the module-to-host call path';
const statusAt = status.indexOf(statusAnchor);
if (statusAt < 0) throw new Error('STATUS W45-20 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-22: the streaming half of the module-to-host call path is copied — chunk-sfn1dbxq.js's \`aGe\` entry (929 units) plus the streaming dispatch family (9,074), the clock (563) and the streaming record family (1,645, appended to the records copy), behind \`raiseStreamingHostCall\` in src/plugin-chain-stream-call.ts. The layout follows the source's module graph because the two \`Q\`s are different functions; a refused answer is skipped to the layer below rather than thrown; status fields, \`CHECK\`, the three withheld-result texts and the check-refusal text are asserted, and the native-provider field \`ChainModule.streamLinks\` is a product addition. Evidence: \`research/ports/W45-stream-call-evidence.json\`, and
[工作包](ports/W45-chain-runner.md#w45-22-landed-the-streaming-half-of-the-call-path-2026-10-15).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// coding-standard: the review line above the W45-20 one.
const standard = read('research/coding-standard.md');
const standardAnchor = '2026-10-15 W45-20 ';
const standardAt = standard.indexOf(standardAnchor);
if (standardAt < 0) throw new Error('coding-standard W45-20 line not found');
const standardEntry = `2026-10-15 W45-22 \`aGe\` 流式模块→宿主调用路径复查：S-1至S-7已对照。S-7 在本包两次生效：先按源自己的模块图分层（chunk-nyce03br.js → chunk-2kdsvp3x.js → chunk-sfn1dbxq.js 的依赖方向），才写出三个文件的边界——\`Q\` 同名两函数（时钟睡眠 vs 记录派发号）使「一个文件装流式族」不可能逐字成立；再按正文而非名字测 \`_o\` 的真身模块（W45-21 的按名分类在此纠错）。S-3（不留半包）体现在：产品面新增 \`ChainModule.streamLinks\` 与两处工厂透传是**源自己的原生提供者契约**（\`_o\` 读 \`record.streamLinks\`），不新增字段则缝无法被任何 fixture 触达；答案形状按事件实测（\`session.receive\` 收 \`{text}\`/\`{consumed}\`、\`model.complete\` 收 \`{value}\`/\`{deny}\`），被拒答案走 \`ip\` 跳过到下层而非抛出，三条 \`tzt\` 状态逐条断言。工具缺陷记入 W45-23：\`source-undeclared-scan.mjs\` 将嵌套局部声明计为已声明（\`a8\` 漏报，\`ReferenceError\` 由编译驱动首现）。验收：check/build/notices、24 计划逐字节一致、五副本未声明 0、聚焦 3/3、链测试 67/67、全量 1323/1323、\`W45StreamCallCompiled.v1\`、打包冒烟 0 上游请求。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// The audit trail.
const rows = [
  ['2026-10-16T03:05:00Z', 'landed', '流式 raise（`aGe`）落地：三文件 11,211 单位，缝 `raiseStreamingHostCall`',
    '`aGe` [1843388,1844317) + 流式派发族（chunk-nyce03br.js）+ 时钟 `mIr`/`nS`/`Q`（chunk-yjc18bey.js [940,1503)）+ 流式记录族 `et`/`_o`/`ft`/`ct`/`has`（并入 records 副本）',
    '按正文测名（`.audit/w45-22-attribute.mjs`/`-decl.mjs`/`-blocks.mjs`）：`Q` 同名两函数 → 按源模块图分三文件；`_o` 真身在 chunk-2kdsvp3x.js [35875,36398)；产品面加 `ChainModule.streamLinks` 与两处工厂透传',
    '记录 research/ports/W45-stream-call-evidence.json；新增 test/plugin-chain-stream-call.test.ts 3/3；`.audit/w45-22-compiled.mjs` 第十四驱动'],
  ['2026-10-16T03:12:00Z', 'verification', '全套验收：24 计划一致、1323/1323、打包 0 上游请求',
    '改动的五份副本与两份新计划',
    'check/build/notices；verify-chain-copies（passed true, 24 plans）；五副本 unresolved 0；聚焦 3/3 与链测试 67/67；全量 1323/1323；十四个编译驱动 exit 0；smoke-package（222 files, upstreamRequests 0）',
    '身份 0b849c4f…（inputs 250bb6fc / 305，validation c63047c6 / 120，build ed750c7f / 214）'],
  ['2026-10-16T03:18:00Z', 'defect', '工具缺陷：source-undeclared-scan 把嵌套局部声明计为已声明（`a8` 漏报）',
    'src/plugin-chain-stream-source.ts 引用 `a8` 但未声明，扫描报 unresolved 0，dist 驱动抛 `ReferenceError: a8 is not defined`',
    'node .audit/w45-22-compiled.mjs（首次运行）与该文件的 `var a8="engine"` 归属（src/plugin-chain-source.ts 亦声明）',
    '本包修法为补 import；扫描的 scope 语义列 W45-23'],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md');
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-22 acceptance (2026-10-15)

- [x] **Source first.** Read \`aGe\` [1843388,1844317), its caller \`Iye\` [2356982,2357180), the stage \`iwr\`/\`Jx\`, the record family \`et\`/\`_o\`/\`ct\`/\`has\` and the clock \`mIr\`/\`nS\`/\`Q\` before writing any seam or fixture.
- [x] **Measure the name, not its spelling.** \`Q\` resolved to two different bodies by module (the clock sleep and the records dispatch counter), and \`_o\` to chunk-2kdsvp3x.js rather than chunk-nyce03br.js — both corrections landed in the layout and in the recon.
- [x] **One module, one copy.** The streaming record family was appended to the records copy (the same module) instead of a new file; the runner copy gained exports rather than a second copy of its own ranges.
- [x] **Behaviour asserted, not assumed.** The floor short circuit, the provider relay, the floor's \`check\` refusal and the three withheld-result states are measured through the real chain (\`test/plugin-chain-stream-call.test.ts\`, and the dist driver for the built artifact).
- [x] **Product surface follows the source.** \`ChainModule.streamLinks\` and the two record factories now carry the native-provider field \`_o\` reads; without it no fixture could reach the streaming path.
- [x] **Sweep.** check/build/notices, 24 byte-identical plans, five copies unresolved 0, focused 3/3, chain 67/67, full 1323/1323, fourteen compiled drivers, packaged smoke with zero upstream requests.
- [x] **A defect found mid-package is recorded.** The undeclared scan's false negative (\`a8\`) is in the evidence record and named as W45-23; the package's own fix is the import.
`);
console.log('records written');
