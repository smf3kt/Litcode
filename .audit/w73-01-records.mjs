// W73-01 record: the card host contract is wired into ask_user_question.
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

function replaceOnce(path, from, to) {
  const text = read(path);
  if (text.split(from).length - 1 !== 1) throw new Error(`${path}: expected one occurrence of ${JSON.stringify(from)}`);
  write(path, text.replace(from, to));
}

const note = `# W73 — card host wiring

## Source position

The recovered tool's \`create()\` body (chunk-ktr9sak2.js, UTF-16) calls the host card
and validates its answer before the result is emitted:

- \`validateInput\` [16528,16776) checks preview format before dispatch;
- the host answer path admits through \`V\`/\`le\` [2142,4005) — the contract ported
  in W72 — with \`qht\` [1397,1484), \`ce\` [4005,4482), \`de\` [4482,4720) and \`pe\`
  [4720,4845);
- \`V\` returns \`{kind:"refused", rule}\` or \`{kind:"admitted", input}\`; the tool
  result is built from the admitted input.

## Port

\`ask_user_question\` now accepts both host contracts:

- default: \`ask\` returns \`{answers:[{questionIndex, selected, other?, annotations?}]}\`
  and \`validAnswer\` checks it, as before;
- \`cardAnswers: true\`: \`askCard\` returns the shown input plus \`answers\`,
  \`annotations\`, \`response\` and \`followUp\`; the returned object is passed through
  \`admitCardAnswer\` against the structured clone of the shown request, and a
  refusal throws \`ask_user_question: card answer refused (<rule>)\`. The admitted
  object is returned as the tool result.

Callbacks resolve from the factory first, then from \`context.interaction\`, as the
existing ask/plan/report callbacks do. A missing \`askCard\` in card mode fails
before dispatch with \`host askCard callback is missing\`.

## Adaptation

The source host is the original client, which owns the card UI and sends the answer
object. This runtime has no such client, so the host is an explicit \`askCard\`
callback and the mode is opt-in. The default indexed contract stays the default,
because the product TUI, runtime and tests consume it; the card path is available
to a host adapter that wants the source shape.

## Verification

\`interaction-tools\` 30/30 with one new case: a valid card is admitted and returned
with the joined answers and response; a card with an unknown field is refused with
the source rule; card mode without \`askCard\` fails; a context-level \`askCard\`
answers. tsc 0; build 0; full 2,101/2,101; chain 767/767; notices 0; source index
unchanged; identity \`ef8f4ab4…\`.
`;
write('research/ports/W73-card-host.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W73-01 wires the recovered card host into \`ask_user_question\`. With
\`cardAnswers: true\`, an \`askCard\` callback returns the shown input plus answers,
annotations, response and followUp; the object is admitted through
\`admitCardAnswer\` (W72's \`V\`/\`le\` port) before it becomes the tool result, and a
refusal surfaces the source rule. The default indexed ask contract is unchanged;
the source client host is represented by the explicit callback. One new case,
interaction-tools 30/30, tsc 0, full 2,101/2,101, chain 767/767, identity
\`ef8f4ab4…\`. [W73 record](ports/W73-card-host.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W73-01 卡片宿主接入：S-1（先读源）：create() 的 validateInput [16528,16776) 先校验预览格式，宿主答案经 V/le [2142,4005) 准入后才生成结果（W72 已移植）。S-2（不臆造）：不改变默认 ask 合同；cardAnswers 模式下返回对象必须通过 admitCardAnswer，拒绝规则原样上报。S-3（边界）：源宿主为原客户端，本运行时以显式 askCard 回调替代；回调先取工厂再取 context.interaction。S-4（可测）：新用例覆盖有效卡片、未知字段拒绝、缺少回调与 context 级回调。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：interaction-tools 30/30、tsc 0、build 0、全量 2,101/2,101、链 767/767、身份 ef8f4ab4…。
`);

replaceOnce('research/FEATURES.md',
  'W72 ports the recovered card answer admission as an exported validator (shown-field integrity, answers/annotations/response/followUp bounds, 32768/48000 caps); multi-question review and richer approval contracts differ',
  'W72 ports the recovered card answer admission (shown-field integrity, answers/annotations/response/followUp bounds, 32768/48000 caps) and W73 wires it to an opt-in card host callback (cardAnswers + askCard, admitted before it is returned, while the indexed ask contract stays the default); multi-question review and richer approval contracts differ');

const rowOld = '| C-11 | 计划与问答交互 | W39已接入模态问答/计划/权限与取消恢复，W42完成多题按序推进与回看页（含未答警示、左右切题、提交/取消），W43完成模型schema→回调→聚焦预览→回看→答案结果及行模式链，原样搬运JavaScript布局核心、Markdown词法器与格式化正文，86文件离线安装宽屏/窄屏/行模式验收通过；W69完成preview门控本地移植（Ae片段规则：需含标记、禁整文档、禁script/style，宿主声明html时逐选项在分发前校验，三条消息原样；宿主launchOptions由previewFormat选项承载）；W70完成扩展问题类型移植（kind=choice/text/number，me()逐类字段规则与原文消息、number的min<max与defaultValue范围、kind缺省填choice、问题文本全调用唯一；宿主extendedQuestionsEnabled由extendedQuestions选项承载）；W71完成答案注释移植（J形状：preview/notes，notes上限8192，未知字段拒绝，preview须精确等于已展示预览；归一化等价分支保留给渲染器）；W72完成卡片答案准入移植（V/le/ce/de/qht：展示字段完整性、answers按问题文本键控与8192上限、注释严格字段与exact预览、response、仅扩展followUp、32768/48000上限；已导出，待卡片宿主接入）；完整渲染器、格式化宿主、注释归一化与卡片宿主接入仍有差异，按S-7先核验来源再继续 | Question/plan/findings interactions；[W39](ports/W39-tui-dialogs.md)、[W42](ports/W42-tui-groups.md)、[W43](ports/W43-tui-preview.md) |';
const rowNew = '| C-11 | 计划与问答交互 | W39已接入模态问答/计划/权限与取消恢复，W42完成多题按序推进与回看页（含未答警示、左右切题、提交/取消），W43完成模型schema→回调→聚焦预览→回看→答案结果及行模式链，原样搬运JavaScript布局核心、Markdown词法器与格式化正文，86文件离线安装宽屏/窄屏/行模式验收通过；W69完成preview门控本地移植（Ae片段规则：需含标记、禁整文档、禁script/style，宿主声明html时逐选项在分发前校验，三条消息原样；宿主launchOptions由previewFormat选项承载）；W70完成扩展问题类型移植（kind=choice/text/number，me()逐类字段规则与原文消息、number的min<max与defaultValue范围、kind缺省填choice、问题文本全调用唯一；宿主extendedQuestionsEnabled由extendedQuestions选项承载）；W71完成答案注释移植（J形状：preview/notes，notes上限8192，未知字段拒绝，preview须精确等于已展示预览；归一化等价分支保留给渲染器）；W72完成卡片答案准入移植（V/le/ce/de/qht：展示字段完整性、answers按问题文本键控与8192上限、注释严格字段与exact预览、response、仅扩展followUp、32768/48000上限）；W73完成卡片宿主接入（cardAnswers+askCard回调，返回对象经准入后成为工具结果，拒绝按源规则上报；默认索引合同不变）；完整渲染器、格式化宿主与注释归一化仍有差异，按S-7先核验来源再继续 | Question/plan/findings interactions；[W39](ports/W39-tui-dialogs.md)、[W42](ports/W42-tui-groups.md)、[W43](ports/W43-tui-preview.md) |';
const current = read('research/CURRENT.md');
if (current.split(rowOld).length - 1 !== 3) throw new Error('CURRENT C-11 row count changed');
write('research/CURRENT.md', current.split(rowOld).join(rowNew));

const tsv = [
  ['2026-10-17T15:40:00Z', 'package', 'W73-01 卡片宿主接入',
    'cardAnswers 模式：askCard 返回展示输入+answers/annotations/response/followUp，经 admitCardAnswer（W72 V/le 移植）后作为工具结果；默认索引合同不变',
    '源客户端宿主由显式 askCard 回调替代；拒绝按源 rule 上报',
    'interaction-tools 30/30；tsc 0；build 0；全量 2,101/2,101；链 767/767'],
  ['2026-10-17T15:42:00Z', 'decision', 'W73-01 卡片模式保持 opt-in',
    '① 产品 TUI/runtime/测试消费索引合同；② askCard 先取工厂再取 context.interaction；③ 缺少回调在分发前失败；④ 拒绝消息含源 rule 名',
    '残余：完整渲染器、格式化宿主、注释归一化',
    '.audit/w73-01-full.txt'],
  ['2026-10-17T15:45:00Z', 'verification', 'W73-01 验收：interaction-tools 30/30、tsc 0、build 0、2,101/2,101、767/767',
    '有效卡片准入并返回联接答案与 response；未知字段拒绝；缺少 askCard 报错；context 级回调生效',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity ef8f4ab4…（inputs 413f08d7…、build 396f5550…）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w73-runtime.tsv', tsv + '\n');

write('.audit/w73-runtime.todo.md', `# W73 runtime trail

## W73-01 acceptance (2026-10-17)

- [x] **Source path read.** \`create()\` validates preview format before dispatch and
  admits the host answer through \`V\`/\`le\` before building the result.
- [x] **Card host wired.** \`cardAnswers: true\` plus an \`askCard\` callback; the
  returned object is admitted and becomes the tool result.
- [x] **Default unchanged.** The indexed \`ask\` contract stays the default; the
  source client is represented by the explicit callback.
- [x] **Gates.** interaction-tools 30/30, tsc 0, build 0, full 2,101/2,101, chain
  767/767, notices 0, source index unchanged, identity \`ef8f4ab4…\`.
- [ ] Remaining C-11: full renderer, formatting host, annotation normalization.
`);

const evidence = {
  schema: 'W73CardHostEvidence.v1',
  package: 'W73-01 — card host wiring',
  date: '2026-10-17',
  question: 'Can a card host use the recovered answer contract through ask_user_question, with the answer admitted before it is returned?',
  answer: 'Yes: cardAnswers selects an askCard callback whose returned object is admitted by admitCardAnswer and returned; a refusal surfaces the source rule, and the default indexed ask contract is unchanged.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-ktr9sak2.js',
    unit: 'UTF-16 code units',
    validateInput: [16528, 16776],
    admission: { symbol: 'V', range: [2142, 2202] },
    contract: { symbol: 'le', range: [2202, 4005] },
  },
  behavior: {
    option: 'InteractionToolOptions.cardAnswers',
    callback: 'InteractionCallbacks.askCard (factory, then context.interaction)',
    admission: 'admitCardAnswer against the structured clone of the shown request',
    refusal: 'ask_user_question: card answer refused (<rule>)',
    output: 'the admitted input object',
    default: 'indexed questionIndex/selected/other contract unchanged',
  },
  changes: [
    { file: 'src/interaction-tools.ts', change: 'askCard callback, cardAnswers option and execution branch', sha256: sha(read('src/interaction-tools.ts')) },
    { file: 'test/interaction-tools.test.ts', change: 'one card host case', sha256: sha(read('test/interaction-tools.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-11 rows record card host wiring', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Question/plan/findings row records card host wiring', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W73-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W73-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    interactionTools: '30/30',
    build: 'exit 0',
    full: '2,101/2,101',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'ef8f4ab408cba1590ed191ff2c269b975c9893f892dcdb02a1dbe66ae82f3bac',
  },
  residuals: [
    'The original client card UI is not ported; the host is an explicit callback.',
    'Normalized-equivalent previews and xHe transforms remain unported.',
    'The full renderer and formatting host remain C-11 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-11 continues with the full renderer, formatting host and annotation normalization.',
};
write('research/ports/W73-card-host-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW73-01 wires the recovered card host',
  'research/coding-standard.md': '\n2026-10-17 W73-01 ',
  'research/FEATURES.md': 'W72 ports the recovered card answer admission',
  'research/ports/W73-card-host.md': '# W73 — card host wiring',
  '.audit/w73-runtime.todo.md': '\n## W73-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
