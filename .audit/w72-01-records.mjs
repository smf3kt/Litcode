// W72-01 record: recovered card answer admission.
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

const note = `# W72 — card answer admission

## Source position

\`chunk-ktr9sak2.js\` (UTF-16 code units):

| Symbol | Range | Contents |
| --- | --- | --- |
| \`qht\` | [1397,1484) | comma-join; parts holding \`", "\` or a quote are JSON-quoted |
| limits | ~2011 | \`M=8192\`, \`te=8192\`, \`ne=32768\`, \`oe=2000\`, \`ie=2000\`; \`gH=50000\` (chunk-phm7wwmz.js) gives \`se=48000\` |
| \`V\` | [2142,2202) | try \`le\`, catch -\> \`{kind:"refused", rule:"threw"}\` |
| \`le\` | [2202,4005) | shown-field integrity, answers, annotations, response, followUp, size caps |
| \`ce\` | [4005,4482) | question map by text: multiSelect, option count, preview set; extended = every question has a string kind |
| \`de\` | [4482,4720) | an answer may omit \`kind: "choice"\` where the shown question carries it |
| \`pe\` | [4720,4845) | preview admission |

## Port

\`admitCardAnswer(shown, answer)\` returns \`{kind:"admitted", input}\` or
\`{kind:"refused", rule}\`, with the source's rule names:

- the answer must be a plain object (\`not_an_object\`);
- \`afkTimeoutMs\` is a host-only field (\`host_field\`); \`answers\`, \`annotations\`,
  \`response\` and \`followUp\` may not already exist on the shown input
  (\`changed_shown_field\`); any other key must exist on the shown input
  (\`unknown_field\`) and be unchanged, with the recovered \`de\` allowance for a
  \`kind: "choice"\` omitted from the returned questions when no title was shown;
- answers are keyed by question text; a string is capped at 8192, a multiSelect
  array at optionCount+1 entries each capped at 8192, and arrays join through the
  recovered \`qht\` (JSON-quoted when a part contains \`", "\` or a quote);
- annotations are strict \`{preview?, notes?}\` per known question; a preview must
  exactly equal one the question showed (the first \`pe\` arm) and notes are capped
  at 8192;
- \`response\` is a string capped at 8192; \`followUp\` is a boolean accepted only
  when every shown question carries a string kind;
- key lengths are added to the preview budget and the totals must stay within
  32768 text units and 48000 combined units (\`ne\`, \`se\`).

The admitted input spreads the shown request and adds the admitted maps, matching
\`c={...e}\`.

## Deliberate omissions

- No product host emits card answers yet, so the default \`ask_user_question\`
  contract is unchanged; the validator is exported for a card host adapter.
- \`pe\`'s normalized-equivalent arm (shown preview ≤ 2000 units after \`Gat\`,
  with no \`nD\` condition) depends on renderer helpers and stays with the
  renderer port.
- \`xHe\` compares after a transform (\`Y(_(e))\`); this port compares plain JSON
  structurally, and the transform's normalization is not applied.
- \`oe\`, \`ie\` and the \`oe\` reserve are recorded in the source table; only the
  caps that the admitted paths use are enforced.

## Verification

\`interaction-tools\` 29/29 with one new case covering: admitted card with answers,
annotations, response and followUp; multiSelect joining and \`", "\` quoting;
host-only, unknown and changed fields; single-choice array refusal; unknown
answer keys; a preview the question did not show; followUp on a non-extended card;
the omitted-\`kind\` allowance and the reverse (adding kind) refusal; a non-object
answer; and the total-size refusal. tsc 0; build 0; full 2,100/2,100; chain
767/767; notices 0; source index unchanged; identity \`21433e88…\`.
`;
write('research/ports/W72-card-admission.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W72-01 ports the recovered card answer admission as \`admitCardAnswer(shown,
answer)\`. Shown-field integrity, the host-only \`afkTimeoutMs\`, answers keyed by
question text with 8192-unit entries and \`qht\` joining, strict annotations with an
exact shown-preview match and 8192-unit notes, \`response\`, extended-only
\`followUp\`, and the 32768/48000 size caps all follow \`V\`/\`le\`/\`ce\`/\`de\`/\`qht\`.
The normalized preview arm and \`xHe\`'s transform remain unported with reasons, and
no product host emits cards yet, so the default ask contract is unchanged. One new
case, interaction-tools 29/29, tsc 0, full 2,100/2,100, chain 767/767, identity
\`21433e88…\`. [W72 record](ports/W72-card-admission.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W72-01 卡片答案准入：S-1（先读源）：读取 chunk-ktr9sak2.js 的 qht [1397,1484)、V [2142,2202)、le [2202,4005)、ce [4005,4482)、de [4482,4720)、pe [4720,4845) 与常量 M/te/ne/oe/ie 及 chunk-phm7wwmz.js 的 gH=50000（UTF-16）。S-2（不臆造）：规则名、答案键控、8192 上限、qht 的 JSON 引用、严格注释字段、exact 展示预览、followUp 仅扩展、32768/48000 上限均按源；未移植的归一化预览分支与 xHe 变换明确记录。S-3（边界）：默认 ask 合同不变；无产品宿主发卡片，函数导出给卡片宿主适配器。S-4（可测）：一条综合用例覆盖准入、拒绝规则与容量上限。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：interaction-tools 29/29、tsc 0、build 0、全量 2,100/2,100、链 767/767、身份 21433e88…。
`);

replaceOnce('research/FEATURES.md',
  'multi-question review and richer approval contracts differ',
  'W72 ports the recovered card answer admission as an exported validator (shown-field integrity, answers/annotations/response/followUp bounds, 32768/48000 caps); multi-question review and richer approval contracts differ');

const rowOld = '| C-11 | 计划与问答交互 | W39已接入模态问答/计划/权限与取消恢复，W42完成多题按序推进与回看页（含未答警示、左右切题、提交/取消），W43完成模型schema→回调→聚焦预览→回看→答案结果及行模式链，原样搬运JavaScript布局核心、Markdown词法器与格式化正文，86文件离线安装宽屏/窄屏/行模式验收通过；W69完成preview门控本地移植（Ae片段规则：需含标记、禁整文档、禁script/style，宿主声明html时逐选项在分发前校验，三条消息原样；宿主launchOptions由previewFormat选项承载）；W70完成扩展问题类型移植（kind=choice/text/number，me()逐类字段规则与原文消息、number的min<max与defaultValue范围、kind缺省填choice、问题文本全调用唯一；宿主extendedQuestionsEnabled由extendedQuestions选项承载）；W71完成答案注释移植（J形状：preview/notes，notes上限8192，未知字段拒绝，preview须精确等于已展示预览；归一化等价分支保留给渲染器）；完整渲染器、格式化宿主和注释归一化仍有差异，按S-7先核验来源再继续 | Question/plan/findings interactions；[W39](ports/W39-tui-dialogs.md)、[W42](ports/W42-tui-groups.md)、[W43](ports/W43-tui-preview.md) |';
const rowNew = '| C-11 | 计划与问答交互 | W39已接入模态问答/计划/权限与取消恢复，W42完成多题按序推进与回看页（含未答警示、左右切题、提交/取消），W43完成模型schema→回调→聚焦预览→回看→答案结果及行模式链，原样搬运JavaScript布局核心、Markdown词法器与格式化正文，86文件离线安装宽屏/窄屏/行模式验收通过；W69完成preview门控本地移植（Ae片段规则：需含标记、禁整文档、禁script/style，宿主声明html时逐选项在分发前校验，三条消息原样；宿主launchOptions由previewFormat选项承载）；W70完成扩展问题类型移植（kind=choice/text/number，me()逐类字段规则与原文消息、number的min<max与defaultValue范围、kind缺省填choice、问题文本全调用唯一；宿主extendedQuestionsEnabled由extendedQuestions选项承载）；W71完成答案注释移植（J形状：preview/notes，notes上限8192，未知字段拒绝，preview须精确等于已展示预览；归一化等价分支保留给渲染器）；W72完成卡片答案准入移植（V/le/ce/de/qht：展示字段完整性、answers按问题文本键控与8192上限、注释严格字段与exact预览、response、仅扩展followUp、32768/48000上限；已导出，待卡片宿主接入）；完整渲染器、格式化宿主、注释归一化与卡片宿主接入仍有差异，按S-7先核验来源再继续 | Question/plan/findings interactions；[W39](ports/W39-tui-dialogs.md)、[W42](ports/W42-tui-groups.md)、[W43](ports/W43-tui-preview.md) |';
const current = read('research/CURRENT.md');
if (current.split(rowOld).length - 1 !== 3) throw new Error('CURRENT C-11 row count changed');
write('research/CURRENT.md', current.split(rowOld).join(rowNew));

const tsv = [
  ['2026-10-17T15:10:00Z', 'package', 'W72-01 卡片答案准入',
    'qht [1397,1484)、V [2142,2202)、le [2202,4005)、ce [4005,4482)、de [4482,4720)、pe [4720,4845)；gH=50000；导出 admitCardAnswer',
    '规则名/键控/上限/引用/严格注释/exact预览/仅扩展followUp 全按源；归一化预览与 xHe 变换未移植（记录）',
    'interaction-tools 29/29；tsc 0；build 0；全量 2,100/2,100；链 767/767'],
  ['2026-10-17T15:12:00Z', 'decision', 'W72-01 导出校验器而不改默认 ask 合同',
    '① 无产品宿主发卡片答案；② 默认 questionIndex/selected/other 合同保持不变；③ 卡片宿主可用同一校验器；④ 未移植分支与理由逐条记录',
    '残余：卡片宿主接入、完整渲染器、格式化宿主',
    '.audit/w72-01-full.txt'],
  ['2026-10-17T15:15:00Z', 'verification', 'W72-01 验收：interaction-tools 29/29、tsc 0、build 0、2,100/2,100、767/767',
    '准入+注释+response+followUp；多选联接与引用；host/unknown/changed 字段；单选择数组拒绝；未知答案键；未展示预览；非扩展followUp；kind省略允许/添加拒绝；非对象；总容量',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 21433e88…（inputs 1d893042…、build d12b4e87…）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w72-runtime.tsv', tsv + '\n');

write('.audit/w72-runtime.todo.md', `# W72 runtime trail

## W72-01 acceptance (2026-10-17)

- [x] **Source read.** \`qht\`, \`V\`, \`le\`, \`ce\`, \`de\`, \`pe\` and the limit
  constants measured in UTF-16 code units.
- [x] **Rules ported.** Shown-field integrity, host-only field, answer keying and
  joining, strict annotations, response, extended-only followUp and size caps.
- [x] **Default contract unchanged.** The validator is exported for a card host;
  \`ask_user_question\` keeps its indexed answer contract.
- [x] **Gates.** interaction-tools 29/29, tsc 0, build 0, full 2,100/2,100, chain
  767/767, notices 0, source index unchanged, identity \`21433e88…\`.
- [ ] Remaining C-11: card host wiring, full renderer, formatting host.
`);

const evidence = {
  schema: 'W72CardAdmissionEvidence.v1',
  package: 'W72-01 — recovered card answer admission',
  date: '2026-10-17',
  question: 'Does the product carry the recovered card answer admission contract, including shown-field integrity and all answer/annotation bounds?',
  answer: 'Yes: admitCardAnswer ports V/le/ce/de/qht rule for rule and is exported for card hosts; the normalized preview arm and xHe transform remain unported with reasons, and the default ask contract is unchanged until a card host is wired.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-ktr9sak2.js',
    unit: 'UTF-16 code units',
    join: { symbol: 'qht', range: [1397, 1484] },
    limits: { position: 2011, values: { M: 8192, te: 8192, ne: 32768, oe: 2000, ie: 2000 }, gH: { module: 'extracted-v2/modules/chunk-phm7wwmz.js', position: 1308, value: 50000 } },
    wrapper: { symbol: 'V', range: [2142, 2202] },
    admission: { symbol: 'le', range: [2202, 4005] },
    questionMap: { symbol: 'ce', range: [4005, 4482] },
    kindAllowance: { symbol: 'de', range: [4482, 4720] },
    previewAdmission: { symbol: 'pe', range: [4720, 4845] },
  },
  behavior: {
    export: 'admitCardAnswer(shown, answer): admitted input or refused rule',
    rules: ['not_an_object', 'host_field', 'changed_shown_field', 'unknown_field', 'answers', 'annotations', 'response', 'follow_up', 'too_large'],
    answers: 'question-text keys; string or multiSelect array; 8192 per entry; qht join with JSON quoting',
    annotations: 'strict preview/notes per known question; exact shown preview; notes 8192',
    response: 'string up to 8192',
    followUp: 'boolean only when every shown question has a string kind',
    size: 'text <= 32768 and text + preview <= 48000',
    kindAllowance: 'answer may omit kind:"choice" where shown carries it, and only then',
  },
  changes: [
    { file: 'src/interaction-tools.ts', change: 'card admission port and export', sha256: sha(read('src/interaction-tools.ts')) },
    { file: 'test/interaction-tools.test.ts', change: 'one card admission case', sha256: sha(read('test/interaction-tools.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-11 rows record card admission', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Question/plan/findings row records card admission', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W72-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W72-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    interactionTools: '29/29',
    build: 'exit 0',
    full: '2,100/2,100',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '21433e8881be0b52f6dab79d7fae89c1d4d04e29fa980a1d032dbc8ba42b2336',
  },
  residuals: [
    'No product host emits card answers yet; the default ask contract is unchanged.',
    'The normalized-equivalent preview arm depends on renderer helpers and stays with the renderer port.',
    'xHe compares after a transform; this port compares plain JSON structurally.',
    'The full renderer and formatting host remain C-11 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-11 continues with card host wiring, the full renderer and the formatting host.',
};
write('research/ports/W72-card-admission-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW72-01 ports the recovered card answer admission',
  'research/coding-standard.md': '\n2026-10-17 W72-01 ',
  'research/FEATURES.md': 'W72 ports the recovered card answer admission',
  'research/ports/W72-card-admission.md': '# W72 — card answer admission',
  '.audit/w72-runtime.todo.md': '\n## W72-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
