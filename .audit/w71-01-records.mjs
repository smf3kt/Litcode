// W71-01 record: per-answer annotations (notes / shown preview).
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

const note = `# W71 — per-answer annotations

## Source position

\`chunk-ktr9sak2.js\` (UTF-16 code units):

| Symbol | Range | Contents |
| --- | --- | --- |
| constants | ~2011 | \`M=8192\`, \`te=8192\`, \`ne=32768\`, \`oe=2000\`, \`ie=2000\` |
| \`V\` | [2142,2202) | admission wrapper: try \`le\`, catch -\> refused "threw" |
| \`le\` | [2202,4005) | shown-field integrity, answers, annotations, response, followUp, size caps |
| \`pe\` | [4720,…) | preview admission: exact shown-preview match, else normalized form within 2000 |
| \`J\` | [9560,9925) | annotation shape: per-question \`{preview?, notes?}\`, keyed by question text |

\`le\` handles annotations as follows: the map must be an object; every key must be a
question text from the call; each value must be an object whose only fields are \`preview\` and
\`notes\`; \`preview\` must be a string admitted by \`pe\`; \`notes\` must be a string of at most 8192
code units. Unknown annotation fields refuse the whole card.

## Port

The product answer contract now carries \`annotations?: { preview?, notes? }\` on each
\`QuestionAnswer\`:

- the shape is strict (unknown fields refused) and \`notes\` is capped at 8192, the source \`te\`;
- \`preview\` must exactly equal a preview the question showed (the first \`pe\` arm:
  \`e.previews.has(t)\`);
- the source keys annotations by question text; the product answers are indexed by
  \`questionIndex\`, so the annotation travels with its answer instead.

## Deliberate omissions

- \`pe\`'s second arm — a normalized-equivalent preview of at most 2000 code units with no
  control characters or width mismatch — depends on rendering normalization helpers
  (\`Gat\`/\`nD\`/\`pc\`/\`ZSo\`) that belong to the renderer port; exact shown-preview matching is
  ported and never admits a preview the question did not show.
- The card answer map, \`response\`, \`followUp\`, \`afkTimeoutMs\` and shown-field integrity checks
  remain part of the separate card contract.
- The product still enforces its own answer rules (one answer per question, selections match the
  choices) before annotations are checked.

## Verification

\`interaction-tools\` 28/28 with one new case (shown preview plus notes round-trip; a preview the
question did not show is refused; unknown annotation fields and notes over 8192 are rejected;
empty notes are preserved). tsc 0; build 0; full 2,099/2,099; chain 767/767; notices 0; source
index unchanged; identity \`3ed12d16…\`.
`;
write('research/ports/W71-answer-annotations.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W71-01 ports per-answer annotations. A host answer may now carry \`annotations: {preview?,
notes?}\`: notes are capped at 8192 (source \`te\`), unknown fields are refused, and a preview must
exactly match one the question showed (the first \`pe\` arm). The source's normalized-equivalent
preview arm depends on renderer helpers and stays with the renderer port; the source keys
annotations by question text while the product carries them on the indexed answer. One new case,
interaction-tools 28/28, tsc 0, full 2,099/2,099, chain 767/767, identity \`3ed12d16…\`.
[W71 record](ports/W71-answer-annotations.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W71-01 答案注释：S-1（先读源）：读取 chunk-ktr9sak2.js 的 V [2142,2202)、le [2202,4005)、pe 起始 4720、J [9560,9925) 与常量 M/te/ne/oe/ie（UTF-16）。S-2（不臆造）：notes 上限 8192、未知字段拒绝、preview 必须等于该问题展示过的预览（pe 第一支）均按源；不以近似匹配替代未移植的归一化分支。S-3（边界）：卡片答案映射/response/followUp/afkTimeoutMs 不移植；注释随 questionIndex 承载（源按问题文本键）。S-4（可测）：新用例覆盖展示预览+notes 往返、未展示预览拒绝、未知字段与超长 notes 拒绝、空 notes 保留。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：interaction-tools 28/28、tsc 0、build 0、全量 2,099/2,099、链 767/767、身份 3ed12d16…。
`);

replaceOnce('research/FEATURES.md',
  'plus the unique-question-text check; multi-question review and richer approval contracts differ',
  'plus the unique-question-text check and per-answer annotations (exact shown-preview match and notes bounded at 8192); multi-question review and richer approval contracts differ');

const rowOld = '| C-11 | 计划与问答交互 | W39已接入模态问答/计划/权限与取消恢复，W42完成多题按序推进与回看页（含未答警示、左右切题、提交/取消），W43完成模型schema→回调→聚焦预览→回看→答案结果及行模式链，原样搬运JavaScript布局核心、Markdown词法器与格式化正文，86文件离线安装宽屏/窄屏/行模式验收通过；W69完成preview门控本地移植（Ae片段规则：需含标记、禁整文档、禁script/style，宿主声明html时逐选项在分发前校验，三条消息原样；宿主launchOptions由previewFormat选项承载）；W70完成扩展问题类型移植（kind=choice/text/number，me()逐类字段规则与原文消息、number的min<max与defaultValue范围、kind缺省填choice、问题文本全调用唯一；宿主extendedQuestionsEnabled由extendedQuestions选项承载）；完整渲染器、格式化宿主和notes/annotations仍有差异，按S-7先核验来源再继续 | Question/plan/findings interactions；[W39](ports/W39-tui-dialogs.md)、[W42](ports/W42-tui-groups.md)、[W43](ports/W43-tui-preview.md) |';
const rowNew = '| C-11 | 计划与问答交互 | W39已接入模态问答/计划/权限与取消恢复，W42完成多题按序推进与回看页（含未答警示、左右切题、提交/取消），W43完成模型schema→回调→聚焦预览→回看→答案结果及行模式链，原样搬运JavaScript布局核心、Markdown词法器与格式化正文，86文件离线安装宽屏/窄屏/行模式验收通过；W69完成preview门控本地移植（Ae片段规则：需含标记、禁整文档、禁script/style，宿主声明html时逐选项在分发前校验，三条消息原样；宿主launchOptions由previewFormat选项承载）；W70完成扩展问题类型移植（kind=choice/text/number，me()逐类字段规则与原文消息、number的min<max与defaultValue范围、kind缺省填choice、问题文本全调用唯一；宿主extendedQuestionsEnabled由extendedQuestions选项承载）；W71完成答案注释移植（J形状：preview/notes，notes上限8192，未知字段拒绝，preview须精确等于已展示预览；归一化等价分支保留给渲染器）；完整渲染器、格式化宿主和注释归一化仍有差异，按S-7先核验来源再继续 | Question/plan/findings interactions；[W39](ports/W39-tui-dialogs.md)、[W42](ports/W42-tui-groups.md)、[W43](ports/W43-tui-preview.md) |';
const current = read('research/CURRENT.md');
if (current.split(rowOld).length - 1 !== 3) throw new Error('CURRENT C-11 row count changed');
write('research/CURRENT.md', current.split(rowOld).join(rowNew));

const tsv = [
  ['2026-10-17T14:40:00Z', 'package', 'W71-01 答案注释',
    'V [2142,2202)、le [2202,4005)、pe 4720、J [9560,9925)：notes≤8192、未知字段拒绝、preview 精确等于展示预览；产品作为 QuestionAnswer.annotations',
    '归一化等价预览分支（Gat/nD/pc/ZSo）保留给渲染器；卡片映射不移植',
    'interaction-tools 28/28；tsc 0；build 0；全量 2,099/2,099；链 767/767'],
  ['2026-10-17T14:42:00Z', 'decision', 'W71-01 注释随 questionIndex 承载',
    '① 源按问题文本键，产品答案按索引；② 仅接受精确展示预览，不做近似匹配；③ 空 notes 合法（源只检查类型与长度）；④ 未知注释字段整体拒绝',
    '残余：完整渲染器、格式化宿主、卡片答案合同',
    '.audit/w71-01-full.txt'],
  ['2026-10-17T14:45:00Z', 'verification', 'W71-01 验收：interaction-tools 28/28、tsc 0、build 0、2,099/2,099、767/767',
    '展示预览+notes 往返；未展示预览拒绝；未知字段与超长 notes 拒绝；空 notes 保留',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 3ed12d16…（inputs 6c4d63e4…、build 65fddcaf…）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w71-runtime.tsv', tsv + '\n');

write('.audit/w71-runtime.todo.md', `# W71 runtime trail

## W71-01 acceptance (2026-10-17)

- [x] **Source read.** \`V\`, \`le\`, \`pe\` and \`J\` measured; notes cap 8192 and exact shown-preview
  admission taken from \`le\`/\`pe\`.
- [x] **Port.** \`QuestionAnswer.annotations\` with strict fields, 8192-note cap and exact
  shown-preview match; carried on the indexed answer.
- [x] **Omission recorded.** The normalized-equivalent preview arm depends on renderer helpers and
  stays with the renderer port.
- [x] **Gates.** interaction-tools 28/28, tsc 0, build 0, full 2,099/2,099, chain 767/767,
  notices 0, source index unchanged, identity \`3ed12d16…\`.
- [ ] Remaining C-11: full renderer, formatting host, card answer contract.
`);

const evidence = {
  schema: 'W71AnswerAnnotationsEvidence.v1',
  package: 'W71-01 — per-answer annotations',
  date: '2026-10-17',
  question: 'Does the product admit the recovered per-answer annotations (shown preview and notes) on host answers?',
  answer: 'Yes: a host answer may carry strict annotations with notes capped at 8192 and a preview that exactly matches one the question showed; the normalized-equivalence arm and the card mapping remain unported with the recorded reason.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-ktr9sak2.js',
    unit: 'UTF-16 code units',
    constants: { position: 2011, values: { M: 8192, te: 8192, ne: 32768, oe: 2000, ie: 2000 } },
    admissionWrapper: { symbol: 'V', range: [2142, 2202] },
    admission: { symbol: 'le', range: [2202, 4005] },
    previewAdmission: { symbol: 'pe', start: 4720 },
    annotationShape: { symbol: 'J', range: [9560, 9925] },
  },
  behavior: {
    shape: 'annotations?: {preview?: string, notes?: string}, strict fields',
    notes: 'string of at most 8192 code units; empty allowed',
    preview: 'must exactly equal a preview the question showed (pe first arm)',
    keying: 'source keys by question text; product carries annotations on the indexed answer',
    unknownFields: 'refused by the strict annotation shape',
  },
  changes: [
    { file: 'src/interaction-tools.ts', change: 'annotation limit, answer shape, provenance check', sha256: sha(read('src/interaction-tools.ts')) },
    { file: 'test/interaction-tools.test.ts', change: 'one annotation case', sha256: sha(read('test/interaction-tools.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-11 rows record annotations', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Question/plan/findings row records annotations', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W71-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W71-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    interactionTools: '28/28',
    build: 'exit 0',
    full: '2,099/2,099',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '3ed12d167902f08e1ff50ae503c285ec87af133517e96ce1088c0b975ff8a01c',
  },
  residuals: [
    'The normalized-equivalent preview arm (Gat/nD/pc/ZSo, 2000-unit cap) stays with the renderer port.',
    'The card answer map, response, followUp, afkTimeoutMs and shown-field integrity checks are not ported.',
    'Annotations are carried on the indexed answer instead of the source question-text map.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-11 continues with the full renderer, formatting host and card answer contract.',
};
write('research/ports/W71-answer-annotations-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW71-01 ports per-answer annotations',
  'research/coding-standard.md': '\n2026-10-17 W71-01 ',
  'research/FEATURES.md': 'per-answer annotations (exact shown-preview match',
  'research/ports/W71-answer-annotations.md': '# W71 — per-answer annotations',
  '.audit/w71-runtime.todo.md': '\n## W71-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
