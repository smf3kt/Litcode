// W45-86 record: the site-tree walker, the display href encoder, the Box-key scope check and the
// two pattern tables. Writes the package section, the CURRENT row, the STATUS and FEATURES tails,
// the coding-standard entry, the runtime trail and the acceptance list. Every anchor is asserted
// unique before any write.
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
## W45-86 ported the site-tree walker (2026-10-17)

Five blocks are copied verbatim (3,051 units) into \`plugin-chain-walker-host-source.ts\`: the walker
\`je\` from chunk-kjfwbh4w.js, the display href encoder \`Mrt\` and the Box-key scope check \`X4t\` from
chunk-n3ykh62m.js, the control-character class \`y$\` from chunk-nyce03br.js, and the bidi table
\`zDe\`/\`zpr\`/\`pot\` from chunk-t58kj6z7.js.

The walker is one recursive dispatch on \`type\`, not a component table. A string becomes a Text child.
An \`engine\` node answers \`draw(ref)\`. Every site type is constructed with the press handle the node
carries: Button maps plugin/handle/element plus the held children, Input and Select pass their own
prop sets, Code passes its props through, Markdown always carries \`press\` (undefined without one),
Client is keyed \`client:<plugin>:<key>\` with \`drawn\` equal to the whole prop bag and a rebuild that
recurses with a null draw, Svg becomes a dim Text, Image and Raster add their kind prefix to the key
only when an element key exists, and a Link draws the host link token \`Wt\` with the well-formed URL
\`Nrt(href)\` and a fallback of label, space and the dim display href \`Mrt(href)\`.

Containers split inline and block: inline types keep string children, block types walk them into
Text. A keyed Box becomes \`$t\` only when \`X4t\` admits the key — a string of 1 to 10000 characters
without control characters, seen once per parent; the first keeps \`key\` and \`isLive:true\`, a repeat
draws with \`isLive:false\` and no key, and each rejection is reported once with its exact reason. A
Box or Text carrying a hover block draws through \`Ut\` with the group \`Bt(group.plugin, hover)\`;
everything else draws \`Box\`/\`Text\` with \`De(props)\`.

What was measured (probe log \`.audit/w45-86-probe.txt\`): every node type and its exact prop map; the
Button held children; Input/Select/Code/Markdown/Client/Svg/Image/Raster shapes; the Link fallback
with and without a label; the keyed Box's layout (key removed), hover block and group; the plain Box;
the hovered Text at \`isInline:true\` and Box at false; a duplicate key's live/no-key second draw; the
inline/block string split; the four \`X4t\` messages verbatim (repeat, empty/non-string/over-long, and
the control character); \`Mrt\` on space, tab, newline, control, bidi mark and printable Unicode; and
the \`zDe\` ranges \`[[1564,1564],[8234,8238],[8294,8297]]\` with \`zpr\` as the bidi class body.

What remains of partition 4 is the terminal glue that renders a site through row accounting — \`yt\`,
\`pr\`, the row helpers \`lr\`/\`mr\`/\`fr\`, \`ur\`, \`cr\`/\`dr\`, \`xr\`, \`ar\`, \`$e\`, \`hdn\`, \`TU\` and \`VH\` —
with its row/draw accounting imports (\`dce\`, \`g4n\`, \`GPn\`, \`pIn\`, \`uIn\`, \`LAt\`, \`MF\`, \`Fss\`,
\`che\`, \`Ioe\`, \`iur\`, \`$ur\`, \`mIn\`, \`kVe\`, \`OL\`, \`oIn\`, \`j3e\`, \`Frt\`, \`l9\`, \`Omt\`). That is the next
package.

Verified: tsc 0, the copy scans \`declared 44 / unresolved 0\`, notices 0, 13 new tests, the chain
family 723/723, full 1,999/1,999, and the recovered-source index at 72 chunks / 1,666 statements /
307,819 units (2.8%). Identity \`14255a2d…\`.

`);

rep('research/CURRENT.md',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-85 **Client 宿主（插件客户端岛）**',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-86 **站点树遍历器 `je`**：**5 段 3,051 单位**（遍历器 `je`、显示用 href 编码器 `Mrt`、Box 键作用域检查 `X4t`、控制字符类 `y$`、双向文本表 `zDe`/`zpr`/`pot`）。**语义**：`je` 按 `type` 递归分派——字符串成 Text 子节点；`engine` 节点返回 `draw(ref)`；Button/Input/Select/Code/Markdown/Client/Svg/Image/Raster 各以自己的组件与 press 手柄构造（Client 键为 `client:<plugin>:<key>`、`drawn` 即整包 props、rebuild 以空 draw 递归）；Link 用 `Nrt(href)` 得 URL、`Mrt(href)` 得显示文本，画宿主链接 token `Wt`。容器区分内联与块：内联类型保留字符串子节点，块类型把字符串走成 Text；带键 Box 须经 `X4t`（1–10000 字符、无控制字符、同父唯一）才成为 `$t`，首次保留 key 且 `isLive:true`，重复者无 key 且 `isLive:false`，每类拒绝各上报一次；带 hover 的 Box/Text 经 `Ut` 画出并以 `Bt(plugin, hover)` 组作用域，其余用 `De(props)` 画 Box/Text。**宿主接缝** `plugin-chain-walker-host.ts` 只暴露链接组件 token `Wt`（由渲染器决定真链接或 fallback），与动作盒 `KH` 同一模式。**实测**：各节点精确 props；Button 的 held 子节点；Input/Select/Code/Markdown（无 press 为 undefined）；Client 键与 rebuild；Svg 变暗 Text；Image/Raster 仅在 element key 存在时加 `image:`/`raster:` 前缀；Link 有/无 label 的 fallback；带键 Box 的布局、hover 与组；普通 Box；hover Text 的 `isInline:true` 与 Box 的 false；重复键仅首次 live；内联/块字符串；`X4t` 四条消息原文；`Mrt` 的空格/制表/换行/控制/双向/可打印 Unicode；`zDe` 区间表。tsc 0；未声明扫描 declared 44/unresolved 0；notices 0；新套件 13/13；链家族 723/723；全量 1,999/1,999；索引 72 chunk/307,819 单位（2.8%）；身份 `14255a2d…`。 | [Walker 证据](ports/W45-walker-evidence.json)、[工作包](ports/W45-chain-runner.md) |\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-85 **Client 宿主（插件客户端岛）**',
);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W45-86: the walker turns one plugin tree value into surface elements, dispatching each node type to the component that draws it. A Link carries both the well-formed URL and a terminal-safe display href; a keyed Box becomes a hover scope only once per parent, with the drop and repeat reasons reported. Five source blocks, 3,051 units. 13/13 new tests, 723/723 chain family, 1,999/1,999 full; tsc 0; index 72 chunks / 307,819 units. [W45 record](ports/W45-chain-runner.md).
`);

rep('research/FEATURES.md',
  'the error boundary around the drawn tree. ',
  'the error boundary around the drawn tree; W45-86 adds the site-tree walker: the string and engine dispatch, every site node type, the link URL and display href, the Box hover scope with its duplicate-key check, the inline/block split, and the terminal-safe display encoder. ',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W45-86 站点树遍历器：S-1至S-7已对照。S-1（先读源）：量出 5 段/3,051 单位，逐段读「je」分派、「Mrt」编码、「X4t」检查与两张模式表，确认全部依赖（Zt/Vt/sr/lt/Xt/Io/No/jo/$t/Ut/Bt/De/Nrt/IL）此前已入产品。S-2（不臆造）：节点分派、props 映射、内联/块拆分、键作用域、编码器与消息原文均按源正文保留。S-3（宿主边界）：唯一宿主绑定是链接组件 token「Wt」，与动作盒「KH」同一模式；渲染器自行决定真链接或 fallback 文本。S-4（可测）：13 条用例先经 .audit/w45-86-probe.ts 实测再断言。S-5/S-6：整段一次收齐，复用既有组件 seam，无新增依赖。S-7（记录）：证据 JSON 记录 5 段区间、宿主边界、分区剩余项。验证：tsc 0、未声明扫描 declared 44/unresolved 0、notices 0、新套件 13/13、链家族 723/723、全量 1,999/1,999、索引 72 chunk/307,819 单位、身份 14255a2d…。
`);

const tsv = read('.audit/w45-runtime.tsv');
const rows = [
  ['2026-10-17T22:10:00Z', 'package', 'W45-86 站点树遍历器（5 段 3,051 单位）',
    'je/Mrt/X4t/y$/zDe/zpr/pot 成为产品面；plugin-chain-walker-host-source.ts 生成副本；新 plugin-chain-walker.ts 公共 seam、plugin-chain-walker-host.ts 的链接 token Wt',
    'chunk-kjfwbh4w.js 1 段 + chunk-n3ykh62m.js 2 段 + chunk-nyce03br.js 1 段 + chunk-t58kj6z7.js 1 段共 3,051u',
    '13/13 新套件；链家族 723/723；全量 1,999/1,999；1 文件 declared 44/unresolved 0'],
  ['2026-10-17T22:14:00Z', 'decision', 'W45-86 遍历器是单函数分派，链接走宿主 token',
    '① 每个节点类型以 press 手柄构造自己的组件，不用组件表；② Link 同时带 Nrt(href) 的 URL 与 Mrt(href) 的显示文本，fallback 为「label 空格 变暗 href」；③ 带键 Box 每父只承认一次，重复者不 live 且不带 key；④ 链接组件 Wt 是唯一宿主绑定，与 KH 同模式；⑤ 终端胶水（yt/pr/ur/xr/hdn/VH 及行核算依赖）留作下一包',
    '测试按节点类型/容器/作用域检查/编码器/别名分组',
    '.audit/w45-86-probe.txt + test/plugin-chain-walker.test.ts'],
  ['2026-10-17T22:18:00Z', 'finding', 'W45-86 实测节点映射、作用域与编码',
    '① 字符串与 engine 返回值；② Button 精确 props 与 held；③ Input/Select/Code/Markdown/Client/Svg/Image/Raster；④ Link 有/无 label；⑤ 带键 Box 的布局/hover/组与普通 Box；⑥ hover Text 的 isInline；⑦ 重复键仅首次 live；⑧ 内联/块字符串；⑨ X4t 四条消息原文；⑩ Mrt 六种输入与 zDe/zpr 表',
    '十条由 .audit/w45-86-probe.ts 实测后写入证据与测试',
    '.audit/w45-86-probe.txt + test/plugin-chain-walker.test.ts'],
  ['2026-10-17T22:22:00Z', 'verification', 'W45-86 验收：declared 44/unresolved 0、tsc 0、notices 0、13/13、723/723、1,999/1,999、索引 72 chunk/307,819 单位、身份 14255a2d…',
    '下一步终端胶水与行核算（分区 4 剩余项）',
    'source-undeclared-scan declared 44，unresolved 0；新套件 13/13；链家族 723/723；全量 1,999/1,999；索引 72 chunks / 1,666 语句 / 307,819 单位（2.8%）'],
];
const added = rows.filter(([stamp]) => !tsv.includes(stamp)).map((row) => row.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md').replace(/\n+$/, '\n');
write('.audit/w45-runtime.todo.md', todo + `
## W45-86 acceptance (2026-10-17)

- [x] **The walker is ported.** One recursive dispatch on \`type\`: strings become Text, an engine node draws itself, every site type becomes its component with the press handle it carries.
- [x] **Links have two encodings.** The URL is \`Nrt(href)\`; the display text is \`Mrt(href)\`, which percent-encodes controls and bidi marks and leaves printable text alone; the host link token \`Wt\` keeps the fallback child.
- [x] **Box keys name one scope.** The first admitted key per parent is live and keyed; a repeat or an unusable key is drawn without a scope and reported once with its exact message.
- [x] **Containers split inline and block.** Inline types keep string children, block types walk them into Text; a hovered Box or Text draws through \`Ut\` with its group.
- [x] **Sweep.** tsc 0, copy \`declared 44 / unresolved 0\`, notices 0, new suite 13/13, chain family 723/723, full 1,999/1,999, index 72 chunks / 307,819 units, identity \`14255a2d…\`.
`);

const marks = {
  'research/CURRENT.md': 'W45-86 **站点树遍历器',
  'research/STATUS.md': '\nW45-86:',
  'research/coding-standard.md': '\n2026-10-17 W45-86 ',
  'research/ports/W45-chain-runner.md': '\n## W45-86 ported',
  'research/FEATURES.md': 'W45-86 adds the site-tree walker',
  '.audit/w45-runtime.todo.md': '\n## W45-86 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
