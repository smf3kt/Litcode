// W75-01 record: recovered shown-field comparison (xHe).
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

const note = `# W75 — shown-field comparison

## Source position

\`le\` compares every non-reserved shown field through \`xHe(t[f], e[f])\`
(chunk-ktr9sak2.js [2446,…)), where \`t\` is the answer and \`e\` the shown input.
\`de\` (chunk-ktr9sak2.js [4711,…)) ends with the same call after stripping a
\`kind: "choice"\` the answer omitted.

\`chunk-sfn1dbxq.js\` (UTF-16 code units):

| Symbol | Range | Contents |
| --- | --- | --- |
| \`xHe\` | [501668,501915) | bounds-walk the answer field, then deep-compare both JSON roundtrips |
| \`sze\` | [502534,502843) | iterative walk collecting \`values\`, \`depth\`, \`chars\` |
| \`fDe\` | [502843,503039) | count one value; key length and string length feed \`chars\`; objects queue at their level |
| \`pDe\` | [503039,503092) | \`typeof e === "object" && e !== null\` |
| bounds | 501639 | \`F8n=64\` depth, \`$8n=20000\` values, \`B8n=1048576\` characters |

The comparison is \`N8n(Y(_(e)), Y(_(n)))\`: \`_\` is \`JSON.stringify\`
(chunk-gyf58rwf.js [59764,…)), \`Y\` is \`JSON.parse\` (chunk-gyf58rwf.js
[60056,…)), and \`N8n\` is \`isDeepStrictEqual\` from \`util\`.
When the walk stops out of bounds, \`xHe\` reports a warning and returns false;
the admission rule is then \`changed_shown_field\`.

## Port

\`cardFieldUnchanged(answerValue, shownValue)\` replaces the previous plain
structural comparison:

- \`cardAnswerWithinBounds\` ports \`sze\`/\`fDe\`/\`pDe\` exactly: the walk starts at
  level 1, counts the root, adds key lengths and string lengths to the
  character budget, and queues arrays and objects; it stays within when values
  ≤ 20000, depth ≤ 64 and characters ≤ 1,048,576;
- the values are compared after a JSON roundtrip with \`isDeepStrictEqual\`, so
  key order, \`NaN\`/\`-0\` and other JSON-equivalent forms match the source;
- \`sameQuestions\` (the \`de\` allowance) uses the same comparison.

The source's out-of-bounds warning is not emitted; this runtime has no warning
channel in admission, and the refusal is the observable effect.

## Verification

\`interaction-tools\` 32/32 with one new case: a shown \`null\` field may be
returned as \`NaN\` (both JSON-serialize to \`null\`), a 64-level nested shown field
is admitted while 65 levels and a 20,000-element array are refused with
\`changed_shown_field\`. tsc 0; build 0; full 2,103/2,103; chain 767/767; notices
0; source index unchanged; identity \`b03f27a0…\`.
`;
write('research/ports/W75-card-field-comparison.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W75-01 ports the recovered shown-field comparison \`xHe\`. Every returned field
is first bounds-walked on the answer side (20,000 values, depth 64, 1,048,576
characters), then compared with the shown value after a JSON roundtrip through
\`isDeepStrictEqual\`; the \`de\` kind allowance uses the same comparison. This
replaces the previous plain structural check, so JSON-equivalent forms such as
\`NaN\` and \`null\` now match, and oversized answer fields are refused. The
source's warning is not emitted; the refusal is the effect. One new case,
interaction-tools 32/32, tsc 0, full 2,103/2,103, chain 767/767, identity
\`b03f27a0…\`. [W75 record](ports/W75-card-field-comparison.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W75-01 展示字段比较：S-1（先读源）：le 在 [2446,…) 以 xHe(t[f],e[f]) 比较（答案在前），de 在 [4711,…) 收尾同样调用；读取 chunk-sfn1dbxq.js 的 xHe [501668,501915)、sze [502534,502843)、fDe [502843,503039)、pDe [503039,503092) 与 F8n=64/$8n=20000/B8n=1048576（偏移 501639），以及 chunk-gyf58rwf.js 的 _=JSON.stringify [59764,…)、Y=JSON.parse [60056,…)、N8n=isDeepStrictEqual（UTF-16）。S-2（不臆造）：行走从层级 1 起、键长与字符串长计入字符预算、对象入队、上限 20000/64/1048576、JSON 往返后 isDeepStrictEqual 均按源。S-3（边界）：源越界告警无投递通道，本运行时以 changed_shown_field 拒绝为可观察效果；de 路径共用同一比较。S-4（可测）：新用例覆盖 NaN/null 往返相等、64 层准入、65 层与 20000 元素拒绝。S-5/S-6：新增 node:util 导入，无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：interaction-tools 32/32、tsc 0、build 0、全量 2,103/2,103、链 767/767、身份 b03f27a0…。
`);

replaceOnce('research/FEATURES.md',
  '; multi-question review and richer approval contracts differ',
  ' and W75 ports the recovered shown-field comparison (xHe: answer-side bounds walk 20000/64/1048576, JSON roundtrip, deep strict equality); multi-question review and richer approval contracts differ');

replaceAll('research/CURRENT.md',
  '；完整渲染器与格式化宿主仍有差异，按S-7先核验来源再继续',
  '；W75完成展示字段比较移植（xHe：答案侧边界遍历20000/64/1048576，JSON往返后深比较，de共用）；完整渲染器与格式化宿主仍有差异，按S-7先核验来源再继续', 3);

const tsv = [
  ['2026-10-17T17:10:00Z', 'package', 'W75-01 展示字段比较',
    'xHe [501668,501915)、sze [502534,502843)、fDe [502843,503039)、pDe [503039,503092)；F8n/$8n/B8n；_=stringify、Y=parse、N8n=isDeepStrictEqual',
    '答案侧边界遍历+JSON往返+深比较均按源；越界告警无通道，以拒绝为可观察效果',
    'interaction-tools 32/32；tsc 0；build 0；全量 2,103/2,103；链 767/767'],
  ['2026-10-17T17:12:00Z', 'decision', 'W75-01 替换既有结构比较',
    '① 每个返回字段按源调用 xHe(答案,展示)；② de 的 kind 省略路径共用；③ NaN/null 等 JSON 等价形式按源接受；④ 越界字段拒绝为 changed_shown_field',
    '残余：完整渲染器、格式化宿主',
    '.audit/w75-01-full.txt'],
  ['2026-10-17T17:15:00Z', 'verification', 'W75-01 验收：interaction-tools 32/32、tsc 0、build 0、2,103/2,103、767/767',
    'NaN/null 往返相等；64 层准入；65 层与 20000 元素拒绝',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity b03f27a0…（inputs 38845f1d…、validation 9a40d4f6…、build 070f93fc…）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w75-runtime.tsv', tsv + '\n');

write('.audit/w75-runtime.todo.md', `# W75 runtime trail

## W75-01 acceptance (2026-10-17)

- [x] **Source read.** \`xHe\`, \`sze\`, \`fDe\`, \`pDe\`, the three bounds and the
  stringify/parse/deep-equal aliases measured in UTF-16 code units.
- [x] **Port.** Answer-side bounds walk, JSON roundtrip and deep strict equality;
  \`de\` uses the same comparison.
- [x] **Effect.** JSON-equivalent forms match; out-of-bounds fields refuse with
  \`changed_shown_field\`; the source warning is not emitted.
- [x] **Gates.** interaction-tools 32/32, tsc 0, build 0, full 2,103/2,103,
  chain 767/767, notices 0, source index unchanged, identity \`b03f27a0…\`.
- [ ] Remaining C-11: full renderer and formatting host.
`);

const evidence = {
  schema: 'W75CardFieldComparisonEvidence.v1',
  package: 'W75-01 — recovered shown-field comparison',
  date: '2026-10-17',
  question: 'Does card admission compare returned fields with the recovered xHe semantics, including the answer-side bounds walk and the JSON-roundtrip deep equality?',
  answer: 'Yes: cardFieldUnchanged bounds-walks the answer field (20000 values, depth 64, 1048576 characters), then compares both JSON roundtrips with isDeepStrictEqual; the de kind allowance shares it, and an out-of-bounds field refuses with changed_shown_field.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-sfn1dbxq.js',
    unit: 'UTF-16 code units',
    xHe: [501668, 501915], sze: [502534, 502843], fDe: [502843, 503039], pDe: [503039, 503092],
    bounds: { position: 501639, values: 20000, depth: 64, chars: 1048576 },
    aliases: {
      stringify: { module: 'extracted-v2/modules/chunk-gyf58rwf.js', symbol: '_', position: 59764 },
      parse: { module: 'extracted-v2/modules/chunk-gyf58rwf.js', symbol: 'Y', position: 60056 },
      deepEqual: { module: 'node:util', symbol: 'isDeepStrictEqual', importPosition: 501599 },
    },
    callSite: { module: 'extracted-v2/modules/chunk-ktr9sak2.js', call: 'xHe(t[f], e[f])', position: 2446 },
    kindAllowance: { module: 'extracted-v2/modules/chunk-ktr9sak2.js', symbol: 'de', position: 4711 },
  },
  behavior: {
    walk: 'root at level 1; objects queue; key length and string length count as characters; values/depth/chars capped',
    comparison: 'isDeepStrictEqual(JSON.parse(JSON.stringify(answer)), JSON.parse(JSON.stringify(shown)))',
    outOfBounds: 'refused as changed_shown_field (the source warning has no channel here)',
    kindAllowance: 'same comparison after stripping a choice kind the answer omitted',
  },
  changes: [
    { file: 'src/interaction-tools.ts', change: 'cardAnswerWithinBounds/cardFieldUnchanged replace sameJson', sha256: sha(read('src/interaction-tools.ts')) },
    { file: 'test/interaction-tools.test.ts', change: 'one comparison case', sha256: sha(read('test/interaction-tools.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-11 rows record the field comparison', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Question/plan/findings row records the field comparison', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W75-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W75-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    interactionTools: '32/32',
    build: 'exit 0',
    full: '2,103/2,103',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'b03f27a0b16494d0b72a256f679b8288b21cd6e7a5a97e3764d7c40f9c5dc679',
  },
  residuals: [
    'The source out-of-bounds warning is not emitted; refusal is the effect.',
    'The full renderer and formatting host remain C-11 work.',
    'The annotation map is carried on the indexed answer rather than keyed by question text.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-11 continues with the full renderer and formatting host.',
};
write('research/ports/W75-card-field-comparison-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW75-01 ports the recovered shown-field comparison',
  'research/coding-standard.md': '\n2026-10-17 W75-01 ',
  'research/FEATURES.md': 'W75 ports the recovered shown-field comparison',
  'research/ports/W75-card-field-comparison.md': '# W75 — shown-field comparison',
  '.audit/w75-runtime.todo.md': '\n## W75-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
