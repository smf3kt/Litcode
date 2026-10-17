// W76-01 record: recovered preview display sanitation.
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

const note = `# W76 — preview display sanitation

## Source position

\`Yb(e,n)\` (chunk-qq2mgstr.js, UTF-16 [14883,15431)) is the display split for a
preview. Its string branch:

1. \`if (!pn(i, n?.maxUnits)) return {kind:"withheld", marker}\` — \`pn\`
   [8907,8946) is \`ne(e, N6) === e\`, with \`N6 = 2000\` (offset 8811);
2. \`r = n?.softWrap ? MIs(i) : i\`, then
   \`s = (n?.scrub === "key" ? Pe(r) : pc(r)).replace(/\\t/g, " ")\`;
3. \`if (rPe.test(c)) withheld\`, then \`if (xg(s) !== s) withheld\`;
4. full text \`$8(s)\`, gutter flag \`RS(s)\`.

\`pc\` [8706,8741) is \`Zs(Ce(e, cn))\`; \`Ce\` [8414,8503) iterates code points and
replaces where \`cn\` [8375,8414) holds (\`L\` [8178,8299) and not \`ln\`
[8080,8178)). \`Zs\` is the already-copied \`kt\` [5645,5792) from
chunk-bf3z2ftn.js: variation selectors dropped, controls/\`Rt\`/surrogates
replaced by U+FFFD, the tab/ESC pass \`Epe\` expands tabs to the next eight-column
stop, then \`Lr\` applies the grapheme preview. \`rPe\` is declared in the same
module [3856,3916); \`xg\` [9362,9571) collapses a mark run longer than eight to
one U+FFFD, and \`nD\` [15431,15484) with \`Ee\` [15517,15549) is the admission
form of the same check.

## Port

\`src/preview-sanitize.ts\` now owns the shared bodies: \`previewSanitized\`
(\`pc\`), \`previewRewritten\` (\`Ee\`), \`previewUnstableInput\` (\`nD\`) and
\`previewUnstableText\` (the display check after tab replacement). The W74 helpers
in \`interaction-tools.ts\` delegate to it, so admission and display share one
copy.

\`questionPreviewText\` now follows the recovered string branch:

- absent input returns \`undefined\` (host contract);
- the 2000-code-unit cut uses the copied \`ne\`, so any cut returns the withheld
  text;
- the preview is sanitised through \`pc\`, tabs become one space;
- replacement-only text returns \`undefined\` (the host's own plain-text filter,
  kept from W43);
- a truncation marker or a mark run \`xg\` would rewrite returns the withheld
  text;
- otherwise the sanitised text is displayed.

## Adaptation

The host has no soft-wrap option, no key scrub and no structured payload branch,
so those source branches are not reachable here; the source \`RS\` gutter flag is
a renderer concern and is not needed by the plain-text host. CRLF now follows the
source pass: \`\\r\` becomes U+FFFD while \`\\n\` is kept.

## Verification

\`terminal\` 28/28 with one new case: BEL becomes U+FFFD instead of withholding,
a tab expands to the tab stop, ZWSP becomes U+FFFD while ZWNJ survives, CRLF
becomes U+FFFD plus newline, replacement-only text is empty, and a truncation
marker, a nine-mark run and a 2001-unit preview are withheld.
\`interaction-tools\` 32/32 unchanged. tsc 0; build 0; full 2,104/2,104; chain
767/767; notices 0; source index unchanged; identity \`27613f94…\`.
`;
write('research/ports/W76-preview-display-sanitation.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W76-01 ports the recovered preview display sanitation. \`questionPreviewText\`
now runs the source string branch: the 2000-unit cut gate, \`pc\` control folding
through \`Ce\`/\`cn\`/\`Zs\`, tab expansion to the eight-column stop, then the
truncation-marker and \`xg\` mark-run checks that withhold. Control characters
become U+FFFD instead of withholding the preview, and the W74 admission helpers
move to a shared \`preview-sanitize\` module. One new case, terminal 28/28,
interaction-tools 32/32, tsc 0, full 2,104/2,104, chain 767/767, identity
\`27613f94…\`. [W76 record](ports/W76-preview-display-sanitation.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W76-01 预览显示消毒：S-1（先读源）：读取 chunk-qq2mgstr.js 的 Yb [14883,15431)、pn [8907,8946)、Pe [8773,8807)、pc [8706,8741)、ln [8080,8178)、cn [8375,8414)、Ce [8414,8503)、xg [9362,9571)、nD [15431,15484)、N6=2000（偏移 8811），以及 chunk-bf3z2ftn.js 的 Zs=kt [5645,5792)、rPe [3856,3916)（UTF-16）。S-2（不臆造）：2000 单位截断门控、pc 折叠、制表位展开、截断标记与 xg 标记串改写即 withheld 均按源；空文本过滤为宿主既有约定。S-3（边界）：宿主无 softWrap/key scrub/结构化负载分支，对应源分支不可达；RS 属渲染器，不移植。S-4（可测）：terminal 新用例覆盖 BEL→U+FFFD、制表位、ZWSP/ZWNJ、CRLF、纯替换字符、截断标记、9 个组合标记与 2001 单位。S-5/S-6：新增共享模块 preview-sanitize.ts，W74 助手改为委托，无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：terminal 28/28、interaction-tools 32/32、tsc 0、build 0、全量 2,104/2,104、链 767/767、身份 27613f94…。
`);

replaceOnce('research/FEATURES.md',
  'Plain formatter bindings, complete sanitation, notes/annotations, preview-specific gating and the full renderer remain differences',
  'W76 ports the recovered preview sanitise pass (pc/Zs control folding, tab expansion, the 2000-unit cut, truncation-marker and mark-run withholding); plain formatter bindings, notes/annotations, preview-specific gating and the full renderer remain differences');

replaceAll('research/CURRENT.md',
  '；完整渲染器与格式化宿主仍有差异，按S-7先核验来源再继续',
  '；W76完成预览显示消毒移植（Yb/pc/Zs：控制字符折叠U+FFFD、制表位展开、2000单位截断门控、截断标记与标记串改写即withheld）；完整渲染器与格式化宿主仍有差异，按S-7先核验来源再继续', 3);

const tsv = [
  ['2026-10-17T18:10:00Z', 'package', 'W76-01 预览显示消毒',
    'Yb [14883,15431) 字符串分支、pn [8907,8946)、N6=2000、pc [8706,8741)、Ce/cn/ln、xg [9362,9571)、Zs=kt、rPe；共享 preview-sanitize.ts',
    '宿主无 softWrap/key scrub/结构化分支；RS 属渲染器；空文本过滤沿用宿主约定',
    'terminal 28/28；interaction-tools 32/32；tsc 0；build 0；全量 2,104/2,104；链 767/767'],
  ['2026-10-17T18:12:00Z', 'decision', 'W76-01 控制字符折叠而非整体 withhold',
    '① 源 pc/Zs 将控制字符替换为 U+FFFD；② 仅截断标记、超 2000 单位与 xg 改写才 withheld；③ W74 助手改为委托共享模块；④ CRLF 按源变为 U+FFFD+换行',
    '残余：完整渲染器、格式化宿主',
    '.audit/w76-01-full.txt'],
  ['2026-10-17T18:15:00Z', 'verification', 'W76-01 验收：terminal 28/28、interaction-tools 32/32、tsc 0、build 0、2,104/2,104、767/767',
    'BEL→U+FFFD；制表位展开；ZWSP→U+FFFD、ZWNJ 保留；CRLF；纯替换字符为空；截断标记/9 标记串/2001 单位 withheld',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 27613f94…（inputs a34aa147…、validation f3a05aaa…、build 454c7611…）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w76-runtime.tsv', tsv + '\n');

write('.audit/w76-runtime.todo.md', `# W76 runtime trail

## W76-01 acceptance (2026-10-17)

- [x] **Source read.** \`Yb\`, \`pn\`, \`N6\`, \`Pe\`, \`pc\`, \`ln\`/\`cn\`/\`Ce\`, \`xg\`,
  \`Zs\`/\`kt\` and \`rPe\` measured in UTF-16 code units.
- [x] **Port.** The source string branch: 2000-unit cut, \`pc\` sanitise, tab to one
  space, truncation-marker and mark-run withholding.
- [x] **Shared module.** \`preview-sanitize.ts\` owns \`pc\`/\`nD\`; W74 delegates.
- [x] **Gates.** terminal 28/28, interaction-tools 32/32, tsc 0, build 0, full
  2,104/2,104, chain 767/767, notices 0, source index unchanged, identity
  \`27613f94…\`.
- [ ] Remaining C-11: full renderer and formatting host.
`);

const evidence = {
  schema: 'W76PreviewDisplaySanitationEvidence.v1',
  package: 'W76-01 — preview display sanitation',
  date: '2026-10-17',
  question: 'Does the terminal preview host follow the recovered display string branch, including pn, pc, tab replacement and the marker/mark-run withholding checks?',
  answer: 'Yes: questionPreviewText applies the 2000-unit cut gate with the copied ne, sanitises through pc (Ce/cn + Zs), replaces tabs with one space, and withholds on rPe or xg rewrite; the W74 admission helpers now delegate to the shared preview-sanitize module.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-qq2mgstr.js',
    unit: 'UTF-16 code units',
    display: { symbol: 'Yb', range: [14883, 15431] },
    cutGate: { symbol: 'pn', range: [8907, 8946], limit: { symbol: 'N6', position: 8811, value: 2000 } },
    keyScrub: { symbol: 'Pe', range: [8773, 8807], used: false },
    sanitize: { symbol: 'pc', range: [8706, 8741] },
    ignore: { symbol: 'ln', range: [8080, 8178] },
    replacePredicate: { symbol: 'cn', range: [8375, 8414] },
    replacer: { symbol: 'Ce', range: [8414, 8503] },
    markerCollapse: { symbol: 'xg', range: [9362, 9571] },
    admissionCheck: { symbol: 'nD', range: [15431, 15484] },
    rewriteCheck: { symbol: 'Ee', range: [15517, 15549] },
    normalize: { module: 'extracted-v2/modules/chunk-bf3z2ftn.js', symbol: 'Zs/kt', range: [5645, 5792] },
    markerPattern: { module: 'extracted-v2/modules/chunk-bf3z2ftn.js', symbol: 'rPe', range: [3856, 3916] },
  },
  behavior: {
    cut: 'ne(preview, 2000) !== preview -> withheld',
    sanitize: 'Zs(Ce(preview, cn)) then /\t/g -> one space',
    empty: 'replacement-only text -> undefined (host plain-text filter)',
    withhold: 'rPe.test(text) || xg(text) !== text',
    effects: 'BEL -> U+FFFD; tab -> spaces to the eight-column stop; ZWSP -> U+FFFD; ZWNJ preserved; CRLF -> U+FFFD + newline',
  },
  changes: [
    { file: 'src/preview-sanitize.ts', change: 'shared pc/nD/display check port', sha256: sha(read('src/preview-sanitize.ts')) },
    { file: 'src/terminal.ts', change: 'questionPreviewText follows the recovered string branch', sha256: sha(read('src/terminal.ts')) },
    { file: 'src/interaction-tools.ts', change: 'W74 helpers delegate to the shared module', sha256: sha(read('src/interaction-tools.ts')) },
    { file: 'test/terminal.test.ts', change: 'one sanitise case', sha256: sha(read('test/terminal.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-11 rows record display sanitation', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Interactive terminal row records display sanitation', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W76-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W76-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    terminal: '28/28',
    interactionTools: '32/32',
    build: 'exit 0',
    full: '2,104/2,104',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '27613f94512349b224ad7d49b1f36fe9e361b5a527b2078c78862f66c4971e61',
  },
  residuals: [
    'The full renderer and formatting host remain C-11 work.',
    'Soft-wrap, key scrub, structured payload and the RS gutter flag are not reachable in this host.',
    'The empty-text filter is the host contract, not a source branch.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-11 continues with the full renderer and formatting host.',
};
write('research/ports/W76-preview-display-sanitation-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW76-01 ports the recovered preview display sanitation',
  'research/coding-standard.md': '\n2026-10-17 W76-01 ',
  'research/FEATURES.md': 'W76 ports the recovered preview sanitise pass',
  'research/ports/W76-preview-display-sanitation.md': '# W76 — preview display sanitation',
  '.audit/w76-runtime.todo.md': '\n## W76-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
