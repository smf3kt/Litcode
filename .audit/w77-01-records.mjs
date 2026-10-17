// W77-01 record: recovered question-map tolerance and own-property reads.
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

function replaceAll(path, from, to, expected) {
  const text = read(path);
  const count = text.split(from).length - 1;
  if (count !== expected) throw new Error(`${path}: expected ${expected} occurrences of ${JSON.stringify(from)}, found ${count}`);
  write(path, text.split(from).join(to));
}

const note = `# W77 — question-map tolerance

## Source position

\`ce(e)\` (chunk-ktr9sak2.js, UTF-16 [4005,4482)) builds the shown-question map:

- a non-array \`e\` returns an empty map with \`extended: false\`;
- a non-plain question clears \`extended\`;
- a non-string \`kind\` clears \`extended\`, a non-string \`question\` skips the entry;
- \`multiSelect\`, \`options\` and each option's \`preview\` are read through
  \`I(e,t)\` [4988,5042), which returns an own field or \`undefined\`;
- duplicates collapse through \`Map.set\`.

\`le\` obtains the list with \`I(e,"questions")\`, so an absent list is the same
empty-map case rather than an exception.

## Port

\`admitCardAnswer\` now calls \`cardQuestionMap(own(shownRecord, 'questions'))\`
instead of iterating \`shown.questions\` directly:

- \`own\` ports \`I\` and is used for every shown-question read (\`kind\`,
  \`question\`, \`options\`, \`multiSelect\`, \`preview\`);
- a non-array or absent list yields an empty map and \`extended: false\`;
- non-plain questions and non-string kinds clear \`extended\`; a non-string
  question text skips the entry, matching the source order.

This makes an empty shown object admissible with an empty answer, and keeps
answer keys unknown against the empty map, exactly as \`V\`/\`le\` does.

## Verification

\`interaction-tools\` 32/32 with three added assertions: \`{}\` shown and \`{}\`
answer is admitted; \`{questions: 5}\` shown is admitted unchanged; an answer key
against the empty map refuses as \`answers\`. tsc 0; build 0; full 2,104/2,104;
chain 767/767; notices 0; source index unchanged; identity \`13f00168…\`.
`;
write('research/ports/W77-question-map.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W77-01 ports the recovered question-map tolerance. \`cardQuestionMap\` follows
\`ce\`: an absent or non-array shown list yields an empty map with \`extended:
false\`, non-plain questions and non-string kinds clear \`extended\`, and every
shown-question field is read through the recovered own-property helper \`I\`.
An empty shown object with an empty answer is therefore admitted, and answer
keys against an empty map refuse as \`answers\`. Three assertions added,
interaction-tools 32/32, tsc 0, full 2,104/2,104, chain 767/767, identity
\`13f00168…\`. [W77 record](ports/W77-question-map.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W77-01 问题映射容错：S-1（先读源）：读取 chunk-ktr9sak2.js 的 ce [4005,4482) 与 I [4988,5042)（UTF-16），le 以 I(e,"questions") 取列表。S-2（不臆造）：非数组/缺省→空映射且 extended=false；非纯对象问题与非字符串 kind 清 extended；非字符串文本跳过；重复文本经 Map 覆盖；字段一律经 own（I）读取。S-3（边界）：不影响答案/注释/容量规则；空映射使空展示对象可准入，未知答案键按源拒绝。S-4（可测）：新增三条断言（空对象准入、非数组 questions 准入、空映射答案键拒绝）。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：interaction-tools 32/32、tsc 0、build 0、全量 2,104/2,104、链 767/767、身份 13f00168…。
`);

replaceOnce('research/FEATURES.md',
  '; multi-question review and richer approval contracts differ',
  ' and W77 ports the recovered question-map tolerance (own-property reads; an absent or non-array shown list yields an empty map); multi-question review and richer approval contracts differ');

replaceAll('research/CURRENT.md',
  '；完整渲染器与格式化宿主仍有差异，按S-7先核验来源再继续',
  '；W77完成问题映射容错移植（ce/I：缺省或非数组questions→空映射、extended=false，字段按自有属性读取）；完整渲染器与格式化宿主仍有差异，按S-7先核验来源再继续', 3);

const tsv = [
  ['2026-10-17T19:10:00Z', 'package', 'W77-01 问题映射容错',
    'ce [4005,4482) 与 I [4988,5042)；le 经 I(e,"questions") 取列表；cardQuestionMap/own 移植',
    '缺省/非数组→空映射 extended=false；字段自有属性读取；空展示对象+空答案可准入',
    'interaction-tools 32/32；tsc 0；build 0；全量 2,104/2,104；链 767/767'],
  ['2026-10-17T19:12:00Z', 'decision', 'W77-01 容错不改变准入规则',
    '① 只替换问题映射构建；② 空映射下答案键按源拒绝；③ 非纯对象/非字符串 kind 的 extended 处理按源顺序；④ 重复问题文本 Map 覆盖',
    '残余：完整渲染器、格式化宿主',
    '.audit/w77-01-full.txt'],
  ['2026-10-17T19:15:00Z', 'verification', 'W77-01 验收：interaction-tools 32/32、tsc 0、build 0、2,104/2,104、767/767',
    '空对象准入；questions:5 准入；空映射答案键拒绝',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 13f00168…（inputs 71e2696c…、validation 4a58d6a6…、build 54cbf4ba…）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w77-runtime.tsv', tsv + '\n');

write('.audit/w77-runtime.todo.md', `# W77 runtime trail

## W77-01 acceptance (2026-10-17)

- [x] **Source read.** \`ce\` and \`I\` measured in UTF-16 code units.
- [x] **Port.** \`cardQuestionMap\` and \`own\` replace the direct question loop.
- [x] **Tolerance.** Absent/non-array lists yield an empty map; empty shown plus
  empty answer is admitted; unknown answer keys still refuse.
- [x] **Gates.** interaction-tools 32/32, tsc 0, build 0, full 2,104/2,104,
  chain 767/767, notices 0, source index unchanged, identity \`13f00168…\`.
- [ ] Remaining C-11: full renderer and formatting host.
`);

const evidence = {
  schema: 'W77QuestionMapEvidence.v1',
  package: 'W77-01 — question-map tolerance',
  date: '2026-10-17',
  question: 'Does admitCardAnswer build the shown-question map exactly as the recovered ce/I do, including tolerant non-array handling and own-property reads?',
  answer: 'Yes: cardQuestionMap ports ce (empty map for a non-array, extended clearing, duplicate collapse) and own ports I; an absent list is the empty-map case, and empty shown/answer objects are admitted while unknown answer keys refuse.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-ktr9sak2.js',
    unit: 'UTF-16 code units',
    questionMap: { symbol: 'ce', range: [4005, 4482] },
    ownRead: { symbol: 'I', range: [4988, 5042] },
    callSite: 'le obtains the list with I(e, "questions")',
  },
  behavior: {
    nonArray: 'empty map, extended false',
    nonPlain: 'extended false',
    nonStringKind: 'extended false',
    nonStringText: 'entry skipped',
    fields: 'kind/question/options/multiSelect/preview read as own properties only',
    duplicates: 'Map.set collapses by question text',
  },
  changes: [
    { file: 'src/interaction-tools.ts', change: 'own and cardQuestionMap replace the direct loop', sha256: sha(read('src/interaction-tools.ts')) },
    { file: 'test/interaction-tools.test.ts', change: 'three tolerance assertions', sha256: sha(read('test/interaction-tools.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-11 rows record question-map tolerance', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Question/plan/findings row records question-map tolerance', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W77-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W77-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    interactionTools: '32/32',
    build: 'exit 0',
    full: '2,104/2,104',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '13f001682b2fa78f69b949bda4c0d6c5d1a750b8d817d2ee0caf8a2ee120547e',
  },
  residuals: [
    'The full renderer and formatting host remain C-11 work.',
    'Annotations stay carried on the indexed answer in the default contract.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-11 continues with the full renderer and formatting host.',
};
write('research/ports/W77-question-map-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW77-01 ports the recovered question-map tolerance',
  'research/coding-standard.md': '\n2026-10-17 W77-01 ',
  'research/FEATURES.md': 'W77 ports the recovered question-map tolerance',
  'research/ports/W77-question-map.md': '# W77 — question-map tolerance',
  '.audit/w77-runtime.todo.md': '\n## W77-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
