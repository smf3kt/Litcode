// W74-01 record: normalized preview admission (pe second arm).
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

const note = `# W74 — preview normalization

## Source position

\`chunk-qq2mgstr.js\`, UTF-16 code units:

| Symbol | Range | Contents |
| --- | --- | --- |
| \`ln\` | [8080,8178) | default-ignorable code points (8204..8207, 1564, 65024..65039, 6155..6159, 10240) |
| \`L\` | [8178,8299) | per-character control/format test (\`on\`, U+2028/29, U+2800, surrogates, U+10FFEE, \`an\`) |
| \`cn\` | [8375,8414) | \`L(e,n) && !ln(n)\`: a character is replaced only when \`L\` holds and it is not default-ignorable |
| \`Ce\` | [8414,8503) | \`for (let r of e) i += n(r, r.codePointAt(0) ?? 0) ? "\\uFFFD" : r\`; iterates code points |
| \`pc\` | [8706,8741) | \`Zs(Ce(e, cn))\` |
| \`nD\` | [15431,15484) | \`n = pc(e); return rPe.test(n) || Ee(n)\` |
| \`Ee\` | [15517,15549) | \`xg(e) !== e\` |
| \`Gat\` | [16278,16350) | \`ZSo(pc(e))\`; \`ZSo\` is identity, so \`Gat = pc\` |

\`pe\` (chunk-ktr9sak2.js [4720,4845)) admits a preview when it was shown
exactly (\`e.previews.has(t)\`), or, for any shown preview \`n\`:
\`n.length <= ie && Gat(n) === t && !nD(n)\`, with \`ie = 2000\` (offset 2056).
\`rPe\` is the truncation marker pattern \`/\\u2026 \\[\\+\\d+ graphemes\\]/\`.

## Port

\`admitCardAnswer\`'s annotation preview check now uses
\`cardPreviewAdmitted(previews, preview)\`:

- an exact shown preview is admitted as before (first \`pe\` arm);
- otherwise a shown preview of at most 2000 UTF-16 units is admitted when its
  normalized form (\`Zs(Ce(value, cn))\`) equals the claimed preview and the shown
  preview is stable under \`nD\` (no truncation marker, no \`xg\` rewrite).

\`ln\`, \`cn\` and \`Ce\` are ported verbatim; \`Zs\`, \`xg\` and \`rPe\` are the copies
already exported by \`src/plugin-chain-normalize-source.ts\` and
\`src/plugin-chain-label-text-source.ts\`. \`ZSo\` is identity in this chunk, so
\`Gat\` collapses to \`pc\`.

## Verification

\`interaction-tools\` 31/31 with one new case: a control character in a shown
preview can be claimed in its normalized U+FFFD form or verbatim; a shown
preview carrying the truncation marker is refused even when normalized; a shown
preview over 2000 units is refused. tsc 0; build 0; full 2,102/2,102; chain
767/767; notices 0; source index unchanged; identity \`a96ee3cd…\`.
`;
write('research/ports/W74-preview-normalization.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W74-01 ports the recovered normalized preview arm of \`pe\`. A claimed annotation
preview may differ from the shown preview only through the source normalization
(\`Ce\` with the \`cn\` predicate, \`Zs\`, then the \`Ee\`/\`rPe\` stability test), and
only when the shown preview is at most 2000 UTF-16 units; the truncation marker
is never admitted. \`ln\`/\`cn\`/\`Ce\` are copied verbatim and \`Zs\`/\`xg\`/\`rPe\`
reuse the existing source copies. One new case, interaction-tools 31/31, tsc 0,
full 2,102/2,102, chain 767/767, identity \`a96ee3cd…\`.
[W74 record](ports/W74-preview-normalization.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W74-01 预览归一化准入：S-1（先读源）：读取 chunk-qq2mgstr.js 的 ln [8080,8178)、L [8178,8299)、cn [8375,8414)、Ce [8414,8503)、pc [8706,8741)、nD [15431,15484)、Ee [15517,15549)、Gat [16278,16350)，以及 chunk-ktr9sak2.js 的 pe [4720,4845) 与 ie=2000（UTF-16）。S-2（不臆造）：控制字符替换谓词 cn=L&&!ln、按码点迭代、Zs 归一、nD 的 rPe/xg 不稳定判定、展示预览 2000 上限均按源；Zs/xg/rPe 直接复用既有源码副本，ZSo 在该块为恒等故 Gat=pc。S-3（边界）：仅替换 pe 的第二支，精确匹配支与卡片准入规则不变。S-4（可测）：新用例覆盖控制字符归一后准入（含原样）、截断标记拒绝、超 2000 单位拒绝。S-5/S-6：无依赖变化；只在既有源副本文件追加导出 rPe。S-7（记录）：端口记录与证据 JSON。验证：interaction-tools 31/31、tsc 0、build 0、全量 2,102/2,102、链 767/767、身份 a96ee3cd…。
`);

replaceOnce('research/FEATURES.md',
  ', while the indexed ask contract stays the default); multi-question review and richer approval contracts differ',
  ', while the indexed ask contract stays the default) and W74 ports the recovered normalized preview arm (Ce/cn control-character replacement, Zs and xg stability, 2000-unit bound); multi-question review and richer approval contracts differ');

replaceAll('research/CURRENT.md',
  'preview须精确等于已展示预览；归一化等价分支保留给渲染器）',
  'preview须精确等于已展示预览）', 3);
replaceAll('research/CURRENT.md',
  '；W73完成卡片宿主接入（cardAnswers+askCard回调，返回对象经准入后成为工具结果，拒绝按源规则上报；默认索引合同不变）；完整渲染器、格式化宿主与注释归一化仍有差异，按S-7先核验来源再继续',
  '；W73完成卡片宿主接入（cardAnswers+askCard回调，返回对象经准入后成为工具结果，拒绝按源规则上报；默认索引合同不变）；W74完成注释归一化等价分支移植（ln/cn/Ce/pc/nD/Gat：控制字符替换U+FFFD、Zs/xg稳定性、展示预览≤2000单位，归一化形式方可准入）；完整渲染器与格式化宿主仍有差异，按S-7先核验来源再继续', 3);

const tsv = [
  ['2026-10-17T16:10:00Z', 'package', 'W74-01 预览归一化准入',
    'chunk-qq2mgstr.js 的 ln/L/cn/Ce/pc/nD/Ee/Gat 与 chunk-ktr9sak2.js 的 pe/ie=2000；注释预览第二支准入',
    'cn=L&&!ln、按码点、Zs 归一、rPe/xg 不稳定、2000 上限均按源；Zs/xg/rPe 复用既有副本',
    'interaction-tools 31/31；tsc 0；build 0；全量 2,102/2,102；链 767/767'],
  ['2026-10-17T16:12:00Z', 'decision', 'W74-01 仅补 pe 第二支',
    '① 精确匹配支保持先判定；② 归一化形式必须等于声明预览且展示值稳定；③ 截断标记永不准入；④ 展示预览长度按 UTF-16 单位计',
    '残余：完整渲染器、格式化宿主',
    '.audit/w74-01-full.txt'],
  ['2026-10-17T16:15:00Z', 'verification', 'W74-01 验收：interaction-tools 31/31、tsc 0、build 0、2,102/2,102、767/767',
    '控制字符归一后准入（含原样）；截断标记拒绝；超 2000 单位拒绝',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity a96ee3cd…（inputs 19854596…、validation a27ac89a…、build 0b36b04b…）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w74-runtime.tsv', tsv + '\n');

write('.audit/w74-runtime.todo.md', `# W74 runtime trail

## W74-01 acceptance (2026-10-17)

- [x] **Source read.** \`ln\`, \`L\`, \`cn\`, \`Ce\`, \`pc\`, \`nD\`, \`Ee\`, \`Gat\` and
  \`pe\` measured in UTF-16 code units; \`ie = 2000\`.
- [x] **Port.** The annotation preview check admits the normalized form of a
  stable shown preview of at most 2000 units, and the truncation marker never.
- [x] **Reuse.** \`Zs\`, \`xg\` and \`rPe\` come from the existing source copies;
  only the export list of the normalize copy changed.
- [x] **Gates.** interaction-tools 31/31, tsc 0, build 0, full 2,102/2,102,
  chain 767/767, notices 0, source index unchanged, identity \`a96ee3cd…\`.
- [ ] Remaining C-11: full renderer and formatting host.
`);

const evidence = {
  schema: 'W74PreviewNormalizationEvidence.v1',
  package: 'W74-01 — normalized preview admission',
  date: '2026-10-17',
  question: 'Does annotation admission carry the recovered normalized-equivalent preview arm, including its character predicate, stability test and 2000-unit bound?',
  answer: 'Yes: cardPreviewAdmitted admits the exact shown preview, else the normalized form of a shown preview of at most 2000 units when the shown value is stable under the rPe/xg test; ln/cn/Ce are ported verbatim and Zs/xg/rPe reuse the existing source copies.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-qq2mgstr.js',
    unit: 'UTF-16 code units',
    ln: [8080, 8178], L: [8178, 8299], cn: [8375, 8414], Ce: [8414, 8503],
    pc: [8706, 8741], nD: [15431, 15484], Ee: [15517, 15549], Gat: [16278, 16350],
    previewAdmission: { module: 'extracted-v2/modules/chunk-ktr9sak2.js', symbol: 'pe', range: [4720, 4845] },
    bound: { module: 'extracted-v2/modules/chunk-ktr9sak2.js', symbol: 'ie', position: 2056, value: 2000 },
    identity: 'ZSo is identity in chunk-qq2mgstr.js, so Gat = pc',
  },
  behavior: {
    normalization: 'Zs(Ce(value, cn)); Ce iterates code points and replaces a character when L(char, code) && !ln(code)',
    stability: 'nD(value) = rPe.test(normalized) || xg(normalized) !== normalized',
    admission: 'exact shown preview, else shown.length <= 2000 && normalized(shown) === claimed && !unstable(shown)',
    reuse: 'Zs/rPe from plugin-chain-normalize-source.ts; xg from plugin-chain-label-text-source.ts',
  },
  changes: [
    { file: 'src/interaction-tools.ts', change: 'cardPreviewNormalized/Unstable/Admitted and previewChars 2000', sha256: sha(read('src/interaction-tools.ts')) },
    { file: 'src/plugin-chain-normalize-source.ts', change: 'export list adds rPe (bodies unchanged)', sha256: sha(read('src/plugin-chain-normalize-source.ts')) },
    { file: 'test/interaction-tools.test.ts', change: 'one normalized preview case', sha256: sha(read('test/interaction-tools.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-11 rows record normalized previews', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Question/plan/findings row records normalized previews', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W74-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W74-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    interactionTools: '31/31',
    build: 'exit 0',
    full: '2,102/2,102',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'a96ee3cdff38e087013d8d239f09a7b9616e03d2644b7fc459fc38faa8e51e2b',
  },
  residuals: [
    'The full renderer and formatting host remain C-11 work.',
    'xHe compares shown and returned values through a transform; this runtime compares plain JSON structurally.',
    'The annotation map is carried on the indexed answer rather than keyed by question text.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-11 continues with the full renderer and formatting host.',
};
write('research/ports/W74-preview-normalization-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW74-01 ports the recovered normalized preview',
  'research/coding-standard.md': '\n2026-10-17 W74-01 ',
  'research/FEATURES.md': 'W74 ports the recovered normalized preview arm',
  'research/ports/W74-preview-normalization.md': '# W74 — preview normalization',
  '.audit/w74-runtime.todo.md': '\n## W74-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
