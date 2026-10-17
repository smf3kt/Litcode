// W70-01 record: the recovered extended question kinds are ported.
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

const note = `# W70 — extended question kinds

## Source position

The recovered AskUserQuestion surface in \`chunk-ktr9sak2.js\` (UTF-16 code units):

| Symbol | Range | Contents |
| --- | --- | --- |
| \`X\` | [5090,5660) | base option: label, description, preview |
| \`Y\` | [5660,5811) | extended option: description optional |
| \`B\` | [5827,7001) | base question: header required, options 2-4, multiSelect default false |
| \`G\` | [7068,8434) | extended question: kind, description, options default [], placeholder, min, max, step, defaultValue, unit |
| \`me\` | [8434,9556) | per-kind superRefine |
| \`J\` | [9560,9925) | per-answer annotations (preview, notes) |
| \`Q.check\` | [9925,10217) | question texts unique, option labels unique per question |
| \`be\` | [11256,…) | extended input schema: optional title plus \`me()\` questions |
| \`K\` | [12694,12893) | host card input: kind defaults to \`"choice"\` |

\`me()\` rules, with messages copied verbatim:

1. \`placeholder\` only on \`text\`; \`min\`/\`max\`/\`step\`/\`defaultValue\`/\`unit\` only on \`number\` —
   \`<field> applies only to "<kind>" questions.\`
2. choice: fewer than 2 options — \`A choice question needs 2-4 options; use kind "text" for an
   open-ended question.\`
3. text/number with options — \`A "<kind>" question takes no options; remove them or omit kind to
   ask a choice question.\`
4. text/number with multiSelect — \`multiSelect applies only to choice questions, not "<kind>".\`
5. number without numeric min < max — \`A number question needs numeric min and max with min <
   max.\`
6. number defaultValue outside min..max — \`defaultValue must lie within min..max.\`

## Port

\`src/interaction-tools.ts\` adds \`extendedQuestions?: boolean\`, the product counterpart of the
host \`extendedQuestionsEnabled\` launch option that gates \`Awe()\` in the source:

- the request type gains \`title\` and per-question \`kind\`, \`description\`, \`placeholder\`, \`min\`,
  \`max\`, \`step\`, \`defaultValue\`, \`unit\`;
- \`extendedQuestionShape\` ports \`me()\` in the source's check order with its messages; options
  default to \`[]\`, multiSelect defaults to false, and the advertised input schema switches with
  the option;
- before dispatch, \`kind ?? "choice"\` is written into every question, as \`K\` does;
- \`uniqueQuestionTexts\` ports \`Q.check\`'s question-text uniqueness in both modes;
- a custom schema issue now keeps its message in the thrown error, so the recovered messages reach
  the caller instead of being reduced to a path and code.

## Deliberate omissions and adaptations

- The host launch-options store is replaced by the explicit \`extendedQuestions\` option, as with
  W69's preview format.
- The answer contract stays the product's \`questionIndex/selected/other\`; the source's newer card
  answer map, per-answer annotations (\`J\`) and the emitted answer JSON are not ported. Number
  range is a host-control property in the source too; it validates no numeric answer text.
- Extended options keep a required \`description\` because the product host renders it; \`Y\` makes
  it optional.
- The source's \`title\`, \`description\`, \`placeholder\` and \`unit\` are unbounded strings; the
  product's overall payload budget still bounds the request.

## Verification

\`interaction-tools\` 27/27 with four new cases (kind defaulting and field forwarding; every rule
message in source order; extended fields and title rejected unless enabled; duplicate question
texts rejected). tsc 0; build 0; full 2,098/2,098; chain 767/767; notices 0; source index
unchanged; identity \`054cdd94…\`.
`;
write('research/ports/W70-extended-questions.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W70-01 ports the recovered extended question kinds. Behind \`extendedQuestions\` (the product
counterpart of the host \`extendedQuestionsEnabled\` launch option), questions accept \`kind:
"choice" | "text" | "number"\` with the recovered per-kind field rules and messages (\`me\`,
UTF-16 [8434,9556)), number min/max and defaultValue bounds, optional title, and \`kind\` defaulted
to \`"choice"\` before dispatch (\`K\` [12694,12893)); \`Q.check\`'s unique-question-text rule applies
in both modes, and custom schema messages now reach the caller. Four new cases, interaction-tools
27/27, tsc 0, full 2,098/2,098, chain 767/767, identity \`054cdd94…\`. [W70 record](ports/W70-extended-questions.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W70-01 扩展问题类型：S-1（先读源）：逐段读取 chunk-ktr9sak2.js 的 X/Y/B/G/me/J/Q.check/be/K（UTF-16 区间见记录）。S-2（不臆造）：me() 的六类规则与消息按源顺序原样移植；kind 缺省填 choice 依 K；问题文本唯一依 Q.check。S-3（边界）：宿主 launchOptions 由 extendedQuestions 选项承载；答案合同保持产品 questionIndex/selected/other，J 注释与卡片答案映射不移植；扩展选项仍要求 description（Y 为可选，记录为适配）；title/description 等无源上限但受整体负载预算约束。S-4（可测）：四条新用例覆盖缺省 kind 与字段转发、全部规则消息、未开启时的拒绝、重复问题文本；自定义 schema 消息现随错误返回。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：interaction-tools 27/27、tsc 0、build 0、全量 2,098/2,098、链 767/767、身份 054cdd94…。
`);

replaceOnce('research/FEATURES.md',
  'multi-question review and richer approval contracts differ',
  'W70 ports the recovered extended question kinds (text and number with per-kind field rules and their messages, number min/max and defaultValue bounds, kind defaulting to choice) plus the unique-question-text check; multi-question review and richer approval contracts differ');

const rowOld = '| C-11 | 计划与问答交互 | W39已接入模态问答/计划/权限与取消恢复，W42完成多题按序推进与回看页（含未答警示、左右切题、提交/取消），W43完成模型schema→回调→聚焦预览→回看→答案结果及行模式链，原样搬运JavaScript布局核心、Markdown词法器与格式化正文，86文件离线安装宽屏/窄屏/行模式验收通过；W69完成preview门控本地移植（Ae片段规则：需含标记、禁整文档、禁script/style，宿主声明html时逐选项在分发前校验，三条消息原样；宿主launchOptions由previewFormat选项承载）；完整渲染器、格式化宿主和notes/annotations仍有差异，按S-7先核验来源再继续 | Question/plan/findings interactions；[W39](ports/W39-tui-dialogs.md)、[W42](ports/W42-tui-groups.md)、[W43](ports/W43-tui-preview.md) |';
const rowNew = '| C-11 | 计划与问答交互 | W39已接入模态问答/计划/权限与取消恢复，W42完成多题按序推进与回看页（含未答警示、左右切题、提交/取消），W43完成模型schema→回调→聚焦预览→回看→答案结果及行模式链，原样搬运JavaScript布局核心、Markdown词法器与格式化正文，86文件离线安装宽屏/窄屏/行模式验收通过；W69完成preview门控本地移植（Ae片段规则：需含标记、禁整文档、禁script/style，宿主声明html时逐选项在分发前校验，三条消息原样；宿主launchOptions由previewFormat选项承载）；W70完成扩展问题类型移植（kind=choice/text/number，me()逐类字段规则与原文消息、number的min<max与defaultValue范围、kind缺省填choice、问题文本全调用唯一；宿主extendedQuestionsEnabled由extendedQuestions选项承载）；完整渲染器、格式化宿主和notes/annotations仍有差异，按S-7先核验来源再继续 | Question/plan/findings interactions；[W39](ports/W39-tui-dialogs.md)、[W42](ports/W42-tui-groups.md)、[W43](ports/W43-tui-preview.md) |';
const current = read('research/CURRENT.md');
if (current.split(rowOld).length - 1 !== 3) throw new Error('CURRENT C-11 row count changed');
write('research/CURRENT.md', current.split(rowOld).join(rowNew));

const tsv = [
  ['2026-10-17T14:10:00Z', 'package', 'W70-01 扩展问题类型 schema',
    'G/me [7068,9556) 逐类字段规则与消息；X/Y 选项、B 基础问题、Q.check 唯一性、be 输入 schema、K kind 缺省；产品以 extendedQuestions 选项承载',
    'choice/text/number 全规则移植；答案合同、J 注释、卡片映射不移植（记录）',
    'interaction-tools 27/27；tsc 0；build 0；全量 2,098/2,098；链 767/767'],
  ['2026-10-17T14:12:00Z', 'decision', 'W70-01 以显式 extendedQuestions 选项承载宿主开关',
    '① 无 launchOptions 存储；② 默认关闭保持现有严格 schema 与 TUI 行为；③ 自定义 schema 消息随错误返回，源消息可观察；④ 扩展选项保留必填 description 以适配产品宿主渲染',
    '残余：完整渲染器、格式化宿主、notes/annotations、卡片答案合同',
    '.audit/w70-01-full.txt'],
  ['2026-10-17T14:15:00Z', 'verification', 'W70-01 验收：interaction-tools 27/27、tsc 0、build 0、2,098/2,098、767/767',
    'kind 缺省与字段转发；六类规则消息；未开启时 title/kind 被拒；重复问题文本被拒',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 054cdd94…（inputs 2687f006…、build e5b2e0f8…）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w70-runtime.tsv', tsv + '\n');

write('.audit/w70-runtime.todo.md', `# W70 runtime trail

## W70-01 acceptance (2026-10-17)

- [x] **Source read.** \`G\`/\`me\` [7068,9556), \`Q.check\` [9925,10217), \`be\` [11256,…) and
  \`K\` [12694,12893) measured in UTF-16 code units.
- [x] **Rules ported.** All six per-kind checks with the source messages, options/multiSelect
  defaults, and \`kind ?? "choice"\` before dispatch.
- [x] **Uniqueness ported.** \`Q.check\`'s unique-question-text rule applies in both modes.
- [x] **Errors observable.** Custom schema messages now reach the caller.
- [x] **Gates.** interaction-tools 27/27, tsc 0, build 0, full 2,098/2,098, chain 767/767,
  notices 0, source index unchanged, identity \`054cdd94…\`.
- [ ] Remaining C-11: full renderer, formatting host, notes/annotations, card answer contract.
`);

const evidence = {
  schema: 'W70ExtendedQuestionsEvidence.v1',
  package: 'W70-01 — recovered extended question kinds',
  date: '2026-10-17',
  question: 'Does the product enforce the recovered extended question kinds and their per-kind rules, with the source messages, behind the extended-questions host switch?',
  answer: 'Yes: extendedQuestions selects the extended schema, which ports me() rules and messages in source order, defaults options/multiSelect, fills kind=choice before dispatch and enforces Q.check uniqueness in both modes.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-ktr9sak2.js',
    unit: 'UTF-16 code units',
    baseOption: { symbol: 'X', range: [5090, 5660] },
    extendedOption: { symbol: 'Y', range: [5660, 5811] },
    baseQuestion: { symbol: 'B', range: [5827, 7001] },
    extendedQuestion: { symbol: 'G', range: [7068, 8434] },
    refine: { symbol: 'me', range: [8434, 9556] },
    annotations: { symbol: 'J', range: [9560, 9925], ported: false },
    uniqueness: { symbol: 'Q.check', range: [9925, 10217] },
    extendedSchema: { symbol: 'be', start: 11256 },
    kindDefault: { symbol: 'K', range: [12694, 12893] },
  },
  messages: [
    '<field> applies only to "<kind>" questions.',
    'A choice question needs 2-4 options; use kind "text" for an open-ended question.',
    'A "<kind>" question takes no options; remove them or omit kind to ask a choice question.',
    'multiSelect applies only to choice questions, not "<kind>".',
    'A number question needs numeric min and max with min < max.',
    'defaultValue must lie within min..max.',
    'Question texts must be unique, option labels must be unique within each question',
  ],
  behavior: {
    option: 'InteractionToolOptions.extendedQuestions mirrors host extendedQuestionsEnabled',
    kinds: ['choice', 'text', 'number'],
    defaults: 'options [], multiSelect false, kind filled to choice before dispatch',
    fieldRules: 'placeholder text-only; min/max/step/defaultValue/unit number-only; number requires min < max; defaultValue within range',
    uniqueness: 'question texts unique across a call; option labels unique per question',
    errors: 'custom schema issues keep their message in the thrown tool error',
  },
  changes: [
    { file: 'src/interaction-tools.ts', change: 'extended option, extended schema, kind defaulting, uniqueness, error messages', sha256: sha(read('src/interaction-tools.ts')) },
    { file: 'test/interaction-tools.test.ts', change: 'four extended-question cases; two fixtures use distinct question texts', sha256: sha(read('test/interaction-tools.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-11 rows record extended kinds', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Question/plan/findings row records the extended kinds', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W70-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W70-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    interactionTools: '27/27',
    build: 'exit 0',
    full: '2,098/2,098',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '054cdd946b8e145c2062bdaf76bde4dd753f44b4315fd114382b2dbb05e64492',
  },
  residuals: [
    'The host launch-options store is replaced by the explicit extendedQuestions option.',
    'The answer contract remains questionIndex/selected/other; the source card answer map, annotations (J) and followUp are not ported.',
    'Extended options keep a required description although Y makes it optional.',
    'Number range is a host-control property; the source validates no numeric answer text either.',
    'The full renderer, formatting host and notes/annotations remain C-11 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-11 continues with the full renderer, formatting host and notes/annotations.',
};
write('research/ports/W70-extended-questions-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW70-01 ports the recovered extended question kinds',
  'research/coding-standard.md': '\n2026-10-17 W70-01 ',
  'research/FEATURES.md': 'W70 ports the recovered extended question kinds',
  'research/ports/W70-extended-questions.md': '# W70 — extended question kinds',
  '.audit/w70-runtime.todo.md': '\n## W70-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
