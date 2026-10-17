// W45-81 record: the Select site component, the option window and the site-focus reader. Writes the
// package section, the CURRENT row, the STATUS and FEATURES tails, the coding-standard entry, the
// runtime trail and the acceptance list. Every anchor is asserted unique before any write.
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
## W45-81 ported the Select site component and the site-focus reader (2026-10-17)

The interactive elements start with the Select. Nine blocks are copied verbatim (1,360 units) from
chunk-kjfwbh4w.js into \`plugin-chain-select-field-source.ts\`: the four contexts \`ldn\`/\`pdn\`/\`fdn\`/
\`gdn\`, the click adapter \`udn\`, the focus reader \`xe\`, the visible-option count \`ht\`, the window
\`S3n\` and the component \`sr\`.

\`sr\` is pure over its contexts. It draws the label, the picked option — from \`gdn.pickedOf(plugin,
element)\`, falling back to the drawn \`value\`, and "none" when neither names one — and the ▾/▴ marker,
then the visible window \`S3n\` from \`gdn.open\` when that names this plugin and handle: eight rows
(\`ht\`) with the first index keeping the highlight in view, each row \`  <label>\` (or its value), the
highlighted one inverse, and a \`  … N more\` row when options are cut. \`xe\` answers the focus flag
only when \`fdn\` names this plugin and handle, binds the \`pdn\` ref only then, and always wraps the
\`ldn\` handler through \`udn\`: a hyperlink goes to the terminal, and the handler runs unless the event
is a window activation or a dropped stray.

What was measured (probe log \`.audit/w45-81-probe.txt\`): \`S3n\` answers the five window shapes —
empty, shorter than the window, ten at 0/5 (eight visible, two hidden, nine rows), ten at 9 (first 2,
eight visible, no hidden row); \`udn\` runs a plain click, allows a hyperlink default and still runs,
skips a window activation and a stray, and allows the default even on a window activation; \`xe\`
without providers answers false/undefined/undefined, with a matching \`fdn\` answers focus, the ref and
a click that hands \`{plugin,handle}\` to \`ldn\`, and a different handle loses the focus and ref but
keeps the click; \`sr\` closed draws one header row (\`Pick: \`, \`none\`, \` ▾\`), a picked label draws
the label and a bare option its value, an open Select draws \` ▴\` plus the option rows, ten options at
highlight 0 draw \`L0\`…\`L7\` and \`… 2 more\`, at highlight 9 draw \`L2\`…\`L9\`, and an \`open\` naming
another press leaves it closed.

Verified: tsc 0, the copy scans \`unresolved 0\` (34 declared), notices 0, 12 new tests, the chain
family 656/656, full 1,932/1,932, and the recovered-source index at 65 chunks / 1,610 statements /
294,284 units (2.7%). Identity \`e367fd4d…\`.

Next: the Button with its hover group and action keys, then the Input field, the Client host, and last
the site-tree walker \`je\` with the terminal glue.

`);

rep('research/CURRENT.md',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-80 ',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-81 **Select 站点组件 + 站点焦点读取（交互元素第一件）**：**9 段 1,360 单位**（四个上下文 `ldn`/`pdn`/`fdn`/`gdn`、点击适配器 `udn`、焦点读取 `xe`、可见选项数 `ht`=8、窗口 `S3n`、组件 `sr`）。**实测**：`S3n` 五种窗口（空/不足/十项高亮 0 与 5 → 8 可见 2 隐藏 9 行/高亮 9 → first 2 无隐藏行）；`udn` 普通点击执行、链接 `allowDefault` 后仍执行、窗口激活与 stray 不执行、窗口激活仍放行链接；`xe` 无 provider 为 false/undefined/undefined，匹配 `fdn` 时给焦点/ref/点击（`{plugin,handle}` 交给 `ldn`），异 handle 失焦点与 ref 但保留点击；`sr` 关闭态一行（`Pick: `/`none`/` ▾`）、选中给 label 或 value、打开态 ` ▴`+选项行、十项高亮 0 画 `L0…L7`+`… 2 more`、高亮 9 画 `L2…L9`、异 press 的 open 保持关闭。tsc 0；未声明扫描 unresolved 0；新套件 12/12；链家族 656/656；全量 1,932/1,932；索引 65 chunk/294,284 单位（2.7%）；身份 `e367fd4d…`。 | [Select 证据](ports/W45-select-field-evidence.json)、[工作包](ports/W45-chain-runner.md) |\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-80 ',
);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W45-81: the interactive elements begin with the Select — a pure function of the select-fields context that draws the picked value, the open highlight and an eight-row window with a hidden-count row, and a site-focus reader gated on the exact press. Nine source blocks, 1,360 units. 12/12 new tests, 656/656 chain family, 1,932/1,932 full; tsc 0; index 65 chunks / 294,284 units. [W45 record](ports/W45-chain-runner.md).
`);

rep('research/FEATURES.md',
  'W45-80 completes the nine leaf types with the Markdown leaf, which presses a link the drawing declared after the selection settles and cancels when a selection appears. |',
  'W45-80 completes the nine leaf types with the Markdown leaf, which presses a link the drawing declared after the selection settles and cancels when a selection appears; W45-81 begins the interactive elements with the Select site, which draws its picked value and an eight-row window from the select-fields context and gates focus on the exact press. |',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W45-81 Select 站点组件：S-1至S-7已对照。S-1（先读源）：量出 9 段/1,360 单位，逐段读 \`sr\`/\`S3n\`/\`xe\`/\`udn\` 正文，确认 \`Ae\`/\`Xe\`/\`s\`/\`n\` 均已承载。S-2（不臆造）：\`sr\` 只读 \`gdn\` 的 \`pickedOf\`/\`open\`，未添加本地状态；\`udn\` 的窗口/ stray / 链接判定按源正文保留。S-3（宿主边界）：四个上下文作为复制块导出，宿主只需以 \`contexts\` 挂载。S-4（可测）：12 条用例先经 \`.audit/w45-81-probe.ts\` 实测再断言。S-5/S-6：窗口与组件同依赖闭包一次收齐；jsx 工厂用 \`Xe as e/r\`，children 在 props。S-7（记录）：证据 JSON 记录 9 段区间与摘要、分区进度。验证：tsc 0、未声明扫描 34 unresolved 0、notices 0、新套件 12/12、链家族 656/656、全量 1,932/1,932、索引 65 chunk/294,284 单位、身份 e367fd4d…。
`);

const tsv = read('.audit/w45-runtime.tsv');
const rows = [
  ['2026-10-17T19:40:00Z', 'package', 'W45-81 Select 站点组件 + 站点焦点读取（9 段 1,360 单位）',
    'ht/S3n/gdn/fdn/pdn/ldn/udn/xe/sr 成为产品面；plugin-chain-select-field-source.ts 生成副本；新 plugin-chain-select-field.ts 公共 seam',
    'chunk-kjfwbh4w.js 9 段 1,360u',
    '12/12 新套件；链家族 656/656；全量 1,932/1,932；1 文件 unresolved 0'],
  ['2026-10-17T19:43:00Z', 'decision', 'W45-81 组件保持纯函数，焦点按精确 press 门控',
    '① sr 的 picked 与 open 全部来自 gdn，不引入本地状态；② xe 仅在 fdn 命中 plugin+handle 时给 focus/ref，点击始终存在；③ udn 对窗口激活/stray/链接的判定按源保留',
    '测试断言按五种窗口、四条 udn 路径、两组焦点与六种渲染书写',
    '.audit/w45-81-probe.txt + test/plugin-chain-select-field.test.ts'],
  ['2026-10-17T19:46:00Z', 'finding', 'W45-81 实测 Select 渲染与焦点行为',
    '① S3n 五窗口；② udn 普通/链接/窗口/stray；③ xe 无 provider 与命中/未命中；④ 关闭态一行；⑤ 选中 label/value；⑥ 打开态选项行；⑦ 十项窗口与隐藏行；⑧ 异 press open 保持关闭',
    '八条由 .audit/w45-81-probe.ts 实测后写入证据与测试',
    '.audit/w45-81-probe.txt + test/plugin-chain-select-field.test.ts'],
  ['2026-10-17T19:50:00Z', 'verification', 'W45-81 验收：scan unresolved 0、tsc 0、notices 0、12/12、656/656、1,932/1,932、索引 65 chunk/294,284 单位、身份 e367fd4d…',
    '下一步 Button + hover 组 + action keys，随后 Input field、Client host、je/终端胶水',
    'source-undeclared-scan declared 34，unresolved 0；新套件 12/12；链家族 656/656；全量 1,932/1,932；索引 65 chunks / 1,610 语句 / 294,284 单位（2.7%）'],
];
const added = rows.filter(([stamp]) => !tsv.includes(stamp)).map((row) => row.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md').replace(/\n+$/, '\n');
write('.audit/w45-runtime.todo.md', todo + `
## W45-81 acceptance (2026-10-17)

- [x] **The Select is ported.** The component, the eight-row window, the focus reader, the click adapter and the four contexts are copied.
- [x] **The component is pure.** Picked value and open highlight come from the context; nothing is cached locally.
- [x] **Focus is gated on the exact press.** \`fdn\` naming another handle loses the focus flag and the ref, while the click stays.
- [x] **The window keeps the highlight visible.** The first index moves with the highlight and the hidden-count row appears only when options are cut.
- [x] **Sweep.** tsc 0, copy \`declared 34 / unresolved 0\`, notices 0, new suite 12/12, chain family 656/656, full 1,932/1,932, index 65 chunks / 294,284 units, identity \`e367fd4d…\`.
`);

const marks = {
  'research/CURRENT.md': 'W45-81 **Select 站点组件',
  'research/STATUS.md': '\nW45-81:',
  'research/coding-standard.md': '\n2026-10-17 W45-81 ',
  'research/ports/W45-chain-runner.md': '\n## W45-81 ported',
  'research/FEATURES.md': 'W45-81 begins the interactive elements',
  '.audit/w45-runtime.todo.md': '\n## W45-81 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
