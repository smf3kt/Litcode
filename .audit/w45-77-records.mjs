// W45-77 record: React layer partition 3 — the Code leaf, the code block renderer and the diff
// renderer. Writes the package section, the CURRENT row, the STATUS and FEATURES tails, the
// one-line coding-standard entry, the runtime trail and the acceptance list. Every anchor is
// asserted unique before any write.
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const rep = (path, old, next) => {
  const text = read(path);
  const count = text.split(old).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} of ${JSON.stringify(old.slice(0, 70))}`);
  write(path, text.replace(old, next));
};

const W = 'research/ports/W45-chain-runner.md';
write(W, read(W).replace(/\n+$/, '\n') + `
## W45-77 ported the Code leaf, the code block renderer and the diff renderer (2026-10-17)

Partition 3 of the React layer starts with the Code site component. Thirty-eight blocks are copied
verbatim (24,196 units) into four modules: the leaf (\`lt\`, \`Oe\`, \`Te\`, \`et\`, \`tt\`, \`adn\`, \`rt\`,
\`st\`, 1,433 units) from chunk-kjfwbh4w.js; the code block renderer (\`Wt\`/\`Ob\`, \`B\`, \`nt\`, \`he\`,
\`j\`, \`H\`, \`K\`, \`gt\`, 4,606 units) from chunk-yfhs3yf4.js; the unified-diff renderer (\`tq\`, \`H4\`,
\`_\`, \`fe\`, \`le\`, \`ue\`, \`he\`, \`U\`, \`me\`, \`oe\`, \`X\`, \`I\`, \`ee\`, \`ie\`, \`uwe\`, \`uu\`, \`DIe\`, \`DXe\`,
\`dje\`, \`ydn\`, 7,732 units) from chunk-nnwag7zt.js, chunk-04m6g9sr.js, chunk-1r9zp6s1.js and
chunk-3qabb19b.js; and the \`diff\` package body \`Zoo\` (10,425 units) from chunk-34bv7wfw.js. The host
seam is \`src/plugin-chain-code-host.ts\`; the generated modules are
\`plugin-chain-code-source.ts\`, \`plugin-chain-code-block-source.ts\`, \`plugin-chain-code-diff-source.ts\`
and \`plugin-chain-diff-source.ts\`.

\`lt\` reads its width from a ref measured through \`Ys\` (zero until laid out) or the \`adn\` context,
defaults to 80, and renders \`tq\` for a diff or \`Ob\` for source text; \`wrap: "truncate-end"\` runs
\`et\`/\`tt\` first. \`Ob\` draws a dim \`"… from line N"\` gutter when the start line is beyond the first,
asks the render settings for syntax highlighting, and delegates each source to \`B\`, which colours
through \`nt\` or draws the plain text. \`nt\` rounds the source through the render cache and falls back
to markdown, reporting the fallback. \`H4\` draws the plain hunk through \`_\` whenever the structured
highlighter answers null; with a structured answer it draws the gutter and content columns. \`tq\`
interleaves the hunks with a left-edge \`"..."\` row through \`uwe\`.

The host seam serves what the bodies reach: \`kc\` over a no-op layout subscription, \`Ys\`, \`Tj\`,
\`nt\`, \`hr\`, \`Qdn\` and \`Kl\` read against the product contexts through \`_currentValue\` (this runner
does not install the TUI dispatcher), \`Mi\` answering false because this host draws inline, and
\`rDr\`/\`CNo\` answering null because the structured highlighters are gated in the source by
\`CLAUDE_CODE_SYNTAX_HIGHLIGHT\`, which this host does not expose — exactly the source's own answer
when the flag is unset, so the copied renderers take their non-structured path.

The renderers forced one addition to the W45-72 hook seam. The compiled site chunks create elements
through \`react/jsx-runtime\`: children travel in \`props.children\` and the third argument is the key.
The Image component's createElement bodies pass children as trailing arguments. One factory cannot
serve both, so the seam now carries \`Tc\` (createElement) and \`Xe\` (jsx/jsxs); the three renderer
plans import \`Xe as e\` and \`Xe as r\`, and \`SurfaceElement\` carries the jsx key.

What was measured (probe log \`.audit/w45-77-probe.txt\`, measurements in
\`.audit/w45-77-measure.ts\`): \`Oe("abcdefghij", 5)\` answers \`"abcd…"\`; \`tt\` at width 5 with start
line 9 answers \`"…\\n…"\`; \`lt\` source answers \`Ob\` with width 80 and no line numbers, a mounted
\`adn\` of 33 changes the width, and \`language: "ts"\` labels it \`source.ts\`; \`lt\` diff answers \`tq\`
with the parsed hunks, and \`truncate-end\` at width 4 answers \`["-…", "+…", " …"]\`; \`Ob\` on start
line 5 draws \`"… from line " 5\` first; \`B\` under \`/a.js\` draws \`nt\` with \`language: "js"\`, and a
2,005-character line is cut to 2,000 and ends with \`" … [+5 chars]"\` (2,013 characters); \`nt\` on an
unsupported language reports the markdown fallback and draws the plain text; \`tq\` over two hunks
answers \`hunk-0\`, the \`uu\` ellipsis keyed \`ellipsis-1\`, and \`hunk-1\`; \`DXe\` cuts 2,100 characters
to 2,000 with \`truncatedChars: 100\`; \`dje(37)\` answers \`" … [+37 chars]"\`; \`Zoo("abc", "abd")\`
answers the removed and the added run; \`uu\` answers \`noSelect: true\` or, at the left edge,
\`{ alignSelf: "stretch", noSelect: "from-left-edge" }\`; \`DIe\` draws one raw ANSI element whose height
is the line count and whose width is the given width, and answers null for no lines.

Verified: tsc 0, the four copies scan \`unresolved 0\` (47/88/76/55 declared), notices 0, the 24 new
tests plus 2 element-factory tests, the chain family 594/594, full 1,870/1,870, and the
recovered-source index at 62 chunks / 1,507 statements / 278,059 units (2.7%). Identity
\`0baf2436…\`.

Partition 3 continues with the text/link leaf group; \`Xt\` Markdown needs the ui.press/held-press
pipeline and waits for partition 4. Then the interactive elements, the Client host, and last the
site-tree walker \`je\` with the terminal glue.

`);

rep('research/CURRENT.md',
  '| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-76',
  '| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-77 **React 层叶子分区起步：Code 叶 + 代码块渲染器 + diff 渲染器**（插件 Code 站点怎么画源码/补丁）：**38 段 24,196 单位 / 4 模块**（chunk-kjfwbh4w.js 8 段 1,433u：`Oe`/`Te`/`et`/`tt` 截断族、`adn`/`rt` 宽度上下文、`st` 标签、`lt` Code 叶 953u；chunk-yfhs3yf4.js 8 段 4,606u：拆行 `j`、追加截断句 `H`、`B` 源行渲染、`nt` 高亮缓存、`he`、`Wt`/`Ob` 代码块、`K` 行数、`gt` 行号槽；chunk-nnwag7zt.js 等四模块 21 段 7,732u：`tq` diff 渲染、`H4` hunk、`_` 纯文布局、`fe`/`le`/`ue` 词级配对、`U`/`me` hunk 排版、`X`/`I` 主题槽与缓存、`ee` 制表符、`uwe` 分隔、`uu`/`DIe` 原始 ANSI、`DXe`/`dje`/`ydn` 长行截断；chunk-34bv7wfw.js 1 段 10,425u：`diff` 包本体 `Zoo`）。**宿主角** `plugin-chain-code-host.ts`：上下文经 `_currentValue` 读取（本 runner 不装 TUI dispatcher）、`kc` 布局订阅为 no-op、`Mi` 恒假（本宿主内联绘制）、`rDr`/`CNo` 答 null（`CLAUDE_CODE_SYNTAX_HIGHLIGHT` 门控未开放，正是源在未设标志时的答案，故走非结构化路径）。**元素工厂拆分**：编译站点走 `react/jsx-runtime`（children 在 props、第三参为 key），Image 的 createElement 体走尾参——hook seam 增 `Xe`（jsx/jsxs），三份渲染器计划改 import `Xe as e`/`Xe as r`。**实测**：`Oe("abcdefghij",5)="abcd…"`；`tt(...,5,9)="…\\n…"`；`lt` 源码 → `Ob{width:80,lineNumbers:false}`、diff → `tq{hunks,dim:false,width:80,firstLine:null}`、`truncate-end` 宽 4 → `["-…","+…"," …"]`；`Ob` startLine 5 画 `"… from line " 5`；`B` 2,005 字符行截到 2,000 并加 `" … [+5 chars]"`（共 2,013）；`nt` 不支持语言回落 markdown 并记录；`tq` 两 hunk → `hunk-0`/`ellipsis-1`/`hunk-1`；`Zoo("abc","abd")` 词级配对。tsc 0；未声明扫描 4 文件 unresolved 0；新套件 24/24 + 表面 2 条；链家族 594/594；全量 1,870/1,870；索引 62 chunk/278,059 单位（2.7%）；身份 `0baf2436…`。 | [Code 叶证据](ports/W45-code-evidence.json)、[工作包](ports/W45-chain-runner.md) |\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-76',
);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W45-77: React layer partition 3 begins — the Code leaf with the code block renderer and the unified-diff renderer. Thirty-eight source blocks, 24,196 units: the leaf measures itself, truncates by wrap mode, and renders the source through \`Ob\` or the patch through \`tq\`; the block renderer highlights through \`nt\` or draws plain text; the hunk renderer pairs removed and added lines word by word and falls back to the plain layout. The host seam answers the contexts through \`_currentValue\` and leaves the structured highlighters null, the source's own answer with the flag unset. The hook seam splits the compiler's jsx factory from createElement. 24/24 new plus 2 element-factory tests, 594/594 chain family, 1,870/1,870 full; tsc 0; index 62 chunks / 278,059 units. [W45 record](ports/W45-chain-runner.md).
`);

rep('research/FEATURES.md',
  'a one-shot file-read probe and the terminal capability table with its defaults, settled readings and pending guesses; W45-76 closes the Image slice: the resolver allocates an id, transmits the source, skips a resend of the same reference and registers the alt answer through the image mount writer, and the component draws the raw-ansi alt or the alt text. |',
  'a one-shot file-read probe and the terminal capability table with its defaults, settled readings and pending guesses; W45-76 closes the Image slice: the resolver allocates an id, transmits the source, skips a resend of the same reference and registers the alt answer through the image mount writer, and the component draws the raw-ansi alt or the alt text; W45-77 begins partition 3 with the Code leaf: it measures its own width, truncates by wrap mode, and draws either the source through the code block renderer or a patch through the unified-diff renderer, which pairs removed and added lines word by word. |',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W45-77 React 层叶子分区 3 起步（Code 叶、代码块渲染器、diff 渲染器）：S-1至S-7已对照。S-1（先读源）：先量出 38 段/24,196 单位/4 模块，逐段读 \`lt\`/\`Ob\`/\`B\`/\`nt\`/\`tq\`/\`H4\`/\`et\`/\`tt\` 正文，确认 \`ct\`/\`J4t\`/\`Int\`/\`HN\`/\`vVe\`/\`MXe\`/\`kAe\`/\`RU\`/\`Epe\`/\`ae\`/\`vu\`/\`ne\` 等依赖均已承载或可导入。S-2（不臆造）：上下文读取按产品 \`_currentValue\` 形状承接；结构化高亮器由 \`CLAUDE_CODE_SYNTAX_HIGHLIGHT\` 门控，本宿主未开放，故 \`rDr\`/\`CNo\` 答 null，即源在未设标志时的原答案；\`Mi\` 按本宿主内联绘制答假；未自造布局订阅源。S-3（宿主边界）：新边界为 \`plugin-chain-code-host.ts\`（\`kc\`/\`Ys\`/\`Mi\`/\`Tj\`/\`nt\`/\`hr\`/\`Qdn\`/\`Kl\`/\`rDr\`/\`CNo\`）。S-4（可测）：24 条用例先经 \`.audit/w45-77-probe.ts\` 与 \`.audit/w45-77-measure.ts\` 实测再断言，覆盖截断、行号槽、语言回落、hunk 分隔、词级配对与原始 ANSI。S-5/S-6：元素工厂按源的真实调用形态拆分——编译站点走 jsx/jsxs（children 在 props、第三参为 key），Image 体走 createElement 尾参，故新增 \`Xe\` 并保留 \`Tc\`；W45-76 及更早测试保持通过。S-7（记录）：证据 JSON 记录 38 段区间与摘要、4 模块摘要、分区进度。验证：tsc 0、未声明扫描 4 文件 unresolved 0、notices 0、新套件 24/24 + 表面 2 条、链家族 594/594、全量 1,870/1,870、索引 62 chunk/278,059 单位、身份 0baf2436…。
`);

const tsv = read('.audit/w45-runtime.tsv');
const rows = [
  ['2026-10-17T18:10:00Z', 'package', 'W45-77 React 层叶子分区 3 起步：Code 叶 + 代码块渲染器 + diff 渲染器（38 段 24,196 单位 / 4 模块）',
    'Oe/Te/et/tt/adn/rt/st/lt、Wt/Ob/B/nt/he/j/H/K/gt、tq/H4/_/fe/le/ue/he/U/me/oe/X/I/ee/ie/uwe/uu/DIe/DXe/dje/ydn、Zoo 成为产品面；四份生成副本；新 plugin-chain-code-host.ts 宿主边界；hook seam 增 Xe',
    'chunk-kjfwbh4w.js 8 段 1,433u + chunk-yfhs3yf4.js 8 段 4,606u + chunk-nnwag7zt.js 等四模块 21 段 7,732u + chunk-34bv7wfw.js 1 段 10,425u',
    '24/24 新套件；链家族 594/594；全量 1,870/1,870；4 文件 unresolved 0'],
  ['2026-10-17T18:12:00Z', 'decision', 'W45-77 元素工厂按编译形态拆成 Xe（jsx/jsxs）与 Tc（createElement）',
    '编译站点把 children 放 props、第三参是 key；Image 的 createElement 体把 children 放尾参。单一工厂会把 key 当文本子节点（实测 tq 的 children 出现 "hunk-0"），也会让 Ob 的 false 子节点崩在 commit',
    'hook seam 新增 Xe；三份渲染器计划改 import Xe as e / Xe as r；SurfaceElement 携带 key；Tc 语义不变',
    'src/plugin-chain-react-hooks.ts + .audit/w45-77-plan-{code,block,diff}.mjs + 表面测试 2 条'],
  ['2026-10-17T18:14:00Z', 'finding', 'W45-77 实测代码与 diff 渲染行为',
    '① lt 源码 → Ob{width:80,lineNumbers:false}，adn=33 改宽度，language 生成 source.ts；② lt diff → tq，truncate-end 宽 4 → ["-…","+…"," …"]；③ Ob startLine 5 画 "… from line " 5；④ B 2,005 字符行截到 2,000 并加 " … [+5 chars]"（共 2,013）；⑤ nt 不支持语言回落 markdown 并记录；⑥ tq 两 hunk → hunk-0/ellipsis-1/hunk-1；⑦ DXe 2,100→2,000/truncatedChars 100；⑧ Zoo("abc","abd") 词级配对',
    '八条由 .audit/w45-77-probe.ts 与 .audit/w45-77-measure.ts 实测后写入证据与测试',
    '.audit/w45-77-probe.txt + test/plugin-chain-code.test.ts'],
  ['2026-10-17T18:16:00Z', 'verification', 'W45-77 验收：4 文件 scan unresolved 0、tsc 0、notices 0、24/24、594/594、1,870/1,870、索引 62 chunk/278,059 单位、身份 0baf2436…',
    '叶子分区继续取 text/link 组；Xt Markdown 等 partition 4 的 ui.press/held-press 管线',
    'source-undeclared-scan declared 47/88/76/55，unresolved 均 0；新套件 24/24 + 表面 2 条；链家族 594/594；全量 1,870/1,870；索引 62 chunks / 1,507 语句 / 278,059 单位（2.7%）'],
];
const added = rows.filter(([stamp]) => !tsv.includes(stamp)).map((row) => row.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md').replace(/\n+$/, '\n');
write('.audit/w45-runtime.todo.md', todo + `
## W45-77 acceptance (2026-10-17)

- [x] **The leaf partition starts with the Code site component.** The leaf, the code block renderer and the diff renderer are copied whole in four modules; the \`diff\` package body is carried as its own copy so the renderer and the library never share a name.
- [x] **The host boundary is named and minimal.** \`plugin-chain-code-host.ts\` serves the hooks and context reads the bodies make; the structured highlighters answer null because the source gates them behind a flag this host does not expose, which is the source's own unset answer.
- [x] **The element seam follows the compiled call shape.** \`Xe\` serves jsx/jsxs (children in props, third argument the key) and \`Tc\` stays createElement; the renderers render their children instead of the key.
- [x] **Behaviour was measured before it was asserted.** Width resolution, both truncation paths, the gutter marker, the long-line marker, the language fallback, the hunk separator and the word-level pairing are in the probe log and in the suite.
- [x] **Sweep.** tsc 0, copies \`declared 47/88/76/55 / unresolved 0\`, notices 0, new suite 24/24 plus 2 element-factory tests, chain family 594/594, full 1,870/1,870, index 62 chunks / 278,059 units, identity \`0baf2436…\`.
`);

const marks = {
  'research/CURRENT.md': 'W45-77 **React 层叶子分区起步',
  'research/STATUS.md': '\nW45-77:',
  'research/coding-standard.md': '\n2026-10-17 W45-77 ',
  'research/ports/W45-chain-runner.md': '\n## W45-77 ported',
  'research/FEATURES.md': 'W45-77 begins partition 3',
  '.audit/w45-runtime.todo.md': '\n## W45-77 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
