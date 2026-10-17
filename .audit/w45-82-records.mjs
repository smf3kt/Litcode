// W45-82 record: the Input field site, the terminal-size hook and the two host contexts. Writes the
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
## W45-82 ported the Input field site (2026-10-17)

The second interactive element is the Input field. Six blocks are copied verbatim (992 units) into
\`plugin-chain-input-field-source.ts\`: the minimum field width \`Gt\` (12), the input-fields context
\`cdn\`, the site-columns context \`ddn\`, the terminal-size hook \`ke\` with its context \`Zm\` (from
chunk-tz1x0g31.js and chunk-z7whhrje.js) and the component \`Vt\`.

\`Vt\` is a view over host state. It reads the site focus through \`xe\` (the same reader the Select
uses), the field value from \`cdn.textOf(plugin, element)\` falling back to the drawn \`value\` and
then "", and the terminal columns from \`ke\` unless a mounted \`ddn\` number replaces them. The cursor
offset lives in \`y(g.length)\`; while the field holds focus the effect raises it to
\`Number.MAX_SAFE_INTEGER\` so the editor keeps the caret at the end. Focused — which requires both
\`cdn\` and the exact press in \`fdn\` — it draws the bold label, the host text editor \`wr\` with the
value, an \`onChange\` that calls \`cdn.edit({plugin,handle,element}, value)\`, the placeholder, the
width \`max(Gt, columns - width(label) - width(hint))\`, the clamped caret and the editor flags, and
the dim \` ⏎ <submitLabel|submit>\` hint. Unfocused it draws the value dim, the placeholder when empty,
and no editor or hint.

The host seam is \`plugin-chain-input-field-host.ts\`: \`wr\` is the shell's text-editor token. Its
source body (chunk-s7977spq.js [7424,11062), 3,638 units) closes over the key decoder, the
offset/history machines, the paste pipeline, the highlight and theme mapping and its renderer, a
subsystem outside the site layer; the site draws it with one fixed prop set, the same way \`Box\` and
\`Text\` are tokens.

What was measured (probe log \`.audit/w45-82-probe.txt\`): \`Gt\` is 12; \`ke\` throws
"useTerminalSize must be used within an Ink App component" without a provider and answers the mounted
size; an unfocused field draws the label, the dim value (placeholder when empty, "" without one) and
no editor or hint; focus without \`cdn\` stays unfocused; a focused field draws the bold label,
\`TextEditor{value:"fromhost",columns:25,cursorOffset:8,focus:true,showCursor:true,multiline:false,
disableEscapeDoublePress:true}\` at \`ddn\` 40 and the \` ⏎ submit\` hint, and \`onChange("next")\` calls
\`edit({plugin:"p",handle:1,element:"i1"},"next")\`; host text wins over the drawn value; the width is
\`max(12, columns - width(label) - width(hint))\` — 12 at \`ddn\` 10 with label "L", 25 at 40 with
label "Name", 68 from the 80-column terminal — and the \` ⏎ go\` label replaces the default hint.

Verified: tsc 0, the copy scans \`unresolved 0\` (33 declared), notices 0, 11 new tests, the chain
family 667/667, full 1,943/1,943, and the recovered-source index at 67 chunks / 1,616 statements /
295,276 units (2.7%). Identity \`5d48dc6d…\`.

Next: the Button with its hover group and action keys, the Client host, and last the site-tree
walker \`je\` with the terminal glue.

`);

rep('research/CURRENT.md',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-81 ',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-82 **Input 字段站点（第二个交互元素）**：**6 段 992 单位**（最小宽度 `Gt`=12、输入上下文 `cdn`、站点列上下文 `ddn`、终端尺寸钩子 `ke` 与上下文 `Zm`、组件 `Vt`）。**宿主边界** `plugin-chain-input-field-host.ts`：文本编辑器 `wr` 是外壳组件令牌（源正文 3,638 单位，闭包含按键解码/偏移历史/粘贴/高亮与渲染器），站点按固定 prop 集绘制。**实测**：`Gt` 12；`ke` 无 provider 抛源句、有 provider 答尺寸；未聚焦画 label + 暗色值（空则 placeholder，无则 `""`）、无编辑器无提示；仅 `fdn` 无 `cdn` 仍保持未聚焦；聚焦需 `cdn`+精确 press，画粗体 label、`TextEditor{value:"fromhost",columns:25,cursorOffset:8,focus:true,showCursor:true,multiline:false,disableEscapeDoublePress:true}`（`ddn` 40）与 ` ⏎ submit`，`onChange("next")` 调 `edit({plugin:"p",handle:1,element:"i1"},"next")`；宿主文本优先于 value；宽度按 `max(12, 列数-label-hint)`（`ddn` 10+label"L"→12、40+label"Name"→25、终端 80→68）；`submitLabel:"go"` 画 ` ⏎ go`。tsc 0；未声明扫描 unresolved 0；新套件 11/11；链家族 667/667；全量 1,943/1,943；索引 67 chunk/295,276 单位（2.7%）；身份 `5d48dc6d…`。 | [Input 证据](ports/W45-input-field-evidence.json)、[工作包](ports/W45-chain-runner.md) |\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-81 ',
);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W45-82: the second interactive element is the Input field — a view over the input host's text that draws a bold label, the host editor with a caret kept at the end, and the submit hint while focused, and the dim value otherwise. The editor is a host component token; the terminal-size hook keeps the source's provider requirement. Six source blocks, 992 units. 11/11 new tests, 667/667 chain family, 1,943/1,943 full; tsc 0; index 67 chunks / 295,276 units. [W45 record](ports/W45-chain-runner.md).
`);

rep('research/FEATURES.md',
  'gates focus on the exact press. |',
  'gates focus on the exact press; W45-82 adds the Input field site, which reads and edits its value through the input-fields context, keeps the caret at the end while focused and reserves the label and submit hint in its width. |',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W45-82 Input 字段站点：S-1至S-7已对照。S-1（先读源）：量出 6 段/992 单位，逐段读 \`Vt\`/\`ke\`/\`Zm\` 正文，确认 \`y\`/\`P\`/\`Ae\`/\`Xe\`/\`s\`/\`n\`/\`ae\`/\`xe\` 均已承载。S-2（不臆造）：值的来源顺序（\`cdn.textOf\`→\`value\`→""）、聚焦门（\`cdn\` 非空且精确 press）、光标上界与宽度下界全部按源正文保留，未加本地状态。S-3（宿主边界）：\`wr\` 文本编辑器作为外壳组件令牌，固定 prop 集与源一致；\`ke\`/\`Zm\` 小正文直接复制。S-4（可测）：11 条用例先经 \`.audit/w45-82-probe.ts\` 实测再断言。S-5/S-6：依赖闭包一次收齐；jsx 工厂用 \`Xe as e/r\`，children 在 props。S-7（记录）：证据 JSON 记录 6 段区间与摘要、宿主边界理由与分区进度。验证：tsc 0、未声明扫描 33 unresolved 0、notices 0、新套件 11/11、链家族 667/667、全量 1,943/1,943、索引 67 chunk/295,276 单位、身份 5d48dc6d…。
`);

const tsv = read('.audit/w45-runtime.tsv');
const rows = [
  ['2026-10-17T20:05:00Z', 'package', 'W45-82 Input 字段站点（6 段 992 单位）',
    'Gt/cdn/ddn/ke/Zm/Vt 成为产品面；plugin-chain-input-field-source.ts 生成副本；新 plugin-chain-input-field.ts 公共 seam、plugin-chain-input-field-host.ts 宿主令牌',
    'chunk-kjfwbh4w.js 3 段 + chunk-tz1x0g31.js 1 段 + chunk-z7whhrje.js 1 段 + Vt 818u 共 992u',
    '11/11 新套件；链家族 667/667；全量 1,943/1,943；1 文件 unresolved 0'],
  ['2026-10-17T20:08:00Z', 'decision', 'W45-82 编辑器作为宿主令牌，值与焦点全部来自上下文',
    '① wr 的闭包是外壳编辑子系统（按键/历史/粘贴/高亮/渲染），按 Box/Text 同法给固定 prop 集；② 值顺序 textOf→value→""，编辑回写 cdn.edit；③ 聚焦同时要求 cdn 与 fdn 精确命中，宽度预留 label/hint 且不低于 12',
    '测试断言按未聚焦/聚焦/宽度/回退四组书写',
    '.audit/w45-82-probe.txt + test/plugin-chain-input-field.test.ts'],
  ['2026-10-17T20:11:00Z', 'finding', 'W45-82 实测 Input 渲染与光标/宽度行为',
    '① Gt 12；② ke 无 provider 抛源句、有 provider 答尺寸；③ 未聚焦 label+暗值/placeholder/空串；④ 仅 fdn 无 cdn 不聚焦；⑤ 聚焦 TextEditor prop 集与光标 8；⑥ onChange 回写 site 对象；⑦ 宿主文本优先；⑧ 宽度 12/25/终端列；⑨ submitLabel 替换提示',
    '九条由 .audit/w45-82-probe.ts 实测后写入证据与测试',
    '.audit/w45-82-probe.txt + test/plugin-chain-input-field.test.ts'],
  ['2026-10-17T20:15:00Z', 'verification', 'W45-82 验收：scan unresolved 0、tsc 0、notices 0、11/11、667/667、1,943/1,943、索引 67 chunk/295,276 单位、身份 5d48dc6d…',
    '下一步 Button + hover 组 + action keys，随后 Client host、je/终端胶水',
    'source-undeclared-scan declared 33，unresolved 0；新套件 11/11；链家族 667/667；全量 1,943/1,943；索引 67 chunks / 1,616 语句 / 295,276 单位（2.7%）'],
];
const added = rows.filter(([stamp]) => !tsv.includes(stamp)).map((row) => row.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md').replace(/\n+$/, '\n');
write('.audit/w45-runtime.todo.md', todo + `
## W45-82 acceptance (2026-10-17)

- [x] **The Input field is ported.** The component, the minimum width, the two contexts and the terminal-size hook are copied.
- [x] **Value and focus are host state.** The value comes from \`cdn.textOf\`, edits go back through \`cdn.edit\`, and focus needs both \`cdn\` and the exact press in \`fdn\`.
- [x] **The caret stays at the end.** The focused effect raises the stored offset to \`Number.MAX_SAFE_INTEGER\`; the drawn offset is clamped to the value length.
- [x] **The width reserves the chrome.** \`max(12, columns - width(label) - width(hint))\`, with a mounted \`ddn\` number replacing the terminal width.
- [x] **The editor is a host token.** \`wr\` is drawn with one fixed prop set; its 3,638-unit shell subsystem stays outside the site layer.
- [x] **Sweep.** tsc 0, copy \`declared 33 / unresolved 0\`, notices 0, new suite 11/11, chain family 667/667, full 1,943/1,943, index 67 chunks / 295,276 units, identity \`5d48dc6d…\`.
`);

const marks = {
  'research/CURRENT.md': 'W45-82 **Input 字段站点',
  'research/STATUS.md': '\nW45-82:',
  'research/coding-standard.md': '\n2026-10-17 W45-82 ',
  'research/ports/W45-chain-runner.md': '\n## W45-82 ported',
  'research/FEATURES.md': 'W45-82 adds the Input field site',
  '.audit/w45-runtime.todo.md': '\n## W45-82 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
