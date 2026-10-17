// W45-80 record: the Markdown leaf — the last of the nine leaf types. Writes the package section,
// the CURRENT row, the STATUS and FEATURES tails, the coding-standard entry, the runtime trail and
// the acceptance list. Every anchor is asserted unique before any write.
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
## W45-80 ported the Markdown leaf (2026-10-17)

The last of the nine leaf types. Five blocks are copied verbatim (1,747 units) into one module,
\`plugin-chain-markdown-source.ts\`: the component \`Xt\` and the scheme set \`mdn\` from
chunk-kjfwbh4w.js [24313,25250), the two click timings \`vje\`/\`tun\` from chunk-06azbynj.js
[135682,135731), and the clock hook \`on\` plus the selection accessor \`wC\` from
chunk-1r9zp6s1.js [17969,18071) and [26659,27318). The renderer \`Ya\` is not copied again: this
product already carries the identical recovered body in \`tui-markdown-components.ts\` (provenance
research/ports/W44-visual-copies.json), so the leaf imports that copy.

The component reads three host bindings through \`plugin-chain-markdown-host.ts\`: the clock context
\`eE\` (\`var eE=qt(null)\` in chunk-k1caxvem.js), the selection context \`Gfe\` (chunk-z7whhrje.js,
read only for hook order), and \`oi()\`, the per-host map of terminal selection instances
(chunk-kexg5hxg.js). The map starts empty, so \`wC\` takes its own no-instance branch and answers the
fixed no-selection object; a caller may bind a reader under \`process.stdout\` for the instance branch.

What the leaf does: it draws the text through \`Ya\` with \`{https, http, file}\` kept as schemes, and
when the drawing holds a press it wraps the answer in a Box with the plugin, the key and a click
handler. That handler stops the terminal's activation only when the click carries a hyperlink that
is not ctrl/alt-modified and that \`nur\` matches against the drawing's \`pressableLinks\`; anything
else is left to the terminal. It then subscribes to the selection, schedules a 500 ms timer, and
presses through \`TIe\` with \`{href}\` when the timer lands — unless a selection appeared, which
unsubscribes, cancels the timer and presses nothing. A click within 300 ms of the drawing, or a
window activation, is dropped as a stray.

What was measured (probe log \`.audit/w45-80-probe.txt\`): \`mdn\` holds the three schemes and the
timings are 300 and 500; \`on\` throws the source sentence without a provider and answers the mounted
clock with one; \`wC\` answers the fixed object with no instance and delegates every reader with one
bound, and the map empties on unbind; the plain render answers the \`Ya\` element with
\`stripPromptTags:false\` and the scheme set, the keyed render adds a column Box, and the press render
adds \`elementPlugin\` and \`onClick\`; clicks with no link, ctrl, alt or an undeclared link call
\`allowDefault\` and schedule nothing; a window activation and a click inside the window call
\`dropAsStray\`; a declared link 500 ms after the drawing stops propagation, subscribes once, queues
one 500 ms timer, and the timer runs the module press with the drawn handle and the argument carrying
\`link:{href}\`; a selection during the wait unsubscribes and cancels (press 0), and a second click
cancels the first timer the same way.

Verified: tsc 0, the copy scans \`unresolved 0\` (37 declared), notices 0, 14 new tests, the chain
family 644/644, full 1,920/1,920, and the recovered-source index at 65 chunks / 1,601 statements /
292,924 units (2.7%). Identity \`da9ff72e…\`.

All nine leaf types are ported. The Client host and the site-tree walker \`je\` with the terminal glue
remain in partition 4; after that the C packages.

`);

rep('research/CURRENT.md',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-79 ',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-80 **Markdown 叶子（九类叶子收齐）**（markdown 文本如何把一次链接点击变成 ui.press、选择如何取消它）：**5 段 1,747 单位**（`vje`/`tun` 双击窗口与延迟 300/500、`mdn` 三种可按下 scheme、`Xt` 组件、`on` 时钟钩子、`wC` 选择访问器）。**渲染器复用**：`Ya` 已在 `tui-markdown-components.ts`（同源 chunk-kjfwbh4w，W44 恢复），不再重复拷贝。**宿主边界** `plugin-chain-markdown-host.ts`：时钟上下文 `eE`、选择上下文 `Gfe`、实例映射 `oi` 与 bind/unbind、系统时钟。**实测**：无 provider 时 `on` 抛源句；`wC` 无实例答固定 no-selection 对象、绑定后逐项委托、解绑清空；普通渲染为 `Ya` 元素（`stripPromptTags:false` + scheme 集），带 key 包 column Box，带 press 再带 `elementPlugin` 与 `onClick`；无链接/ctrl/alt/未声明链接触发 `allowDefault` 不排程；窗口激活与 300ms 内点击 `dropAsStray`；声明链接在绘图 500ms 后 → `stopImmediatePropagation`、订阅一次、排 500ms 定时器，到点以绘图句柄派发并带 `link:{href}`；等待期间出现选择 → 退订 + 取消定时器、press 0；再次点击同样取消前一定时器。tsc 0；未声明扫描 unresolved 0；新套件 14/14；链家族 644/644；全量 1,920/1,920；索引 65 chunk/292,924 单位（2.7%）；身份 `da9ff72e…`。 | [Markdown 证据](ports/W45-markdown-evidence.json)、[工作包](ports/W45-chain-runner.md) |\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-79 ',
);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W45-80: the Markdown leaf closes the nine leaf types — it draws text through the already-carried markdown renderer, and a click over a link the drawing declared pressable stops the terminal, waits 500 ms with a live selection subscription, and presses through the terminal entry; a selection appearing during the wait cancels both. Five source blocks, 1,747 units, one host seam for the clock context, the selection context and the instance map. 14/14 new tests, 644/644 chain family, 1,920/1,920 full; tsc 0; index 65 chunks / 292,924 units. [W45 record](ports/W45-chain-runner.md).
`);

rep('research/FEATURES.md',
  'W45-79 closes the pipeline with the ui.press dispatch, which finds the held press by handle, normalizes a Markdown link through the path-safety graph before accepting it, and starts the module press from the terminal without waiting. |',
  'W45-79 closes the pipeline with the ui.press dispatch, which finds the held press by handle, normalizes a Markdown link through the path-safety graph before accepting it, and starts the module press from the terminal without waiting; W45-80 completes the nine leaf types with the Markdown leaf, which presses a link the drawing declared after the selection settles and cancels when a selection appears. |',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W45-80 Markdown 叶子：S-1至S-7已对照。S-1（先读源）：量出 5 段/1,747 单位，逐段读 \`Xt\`/\`on\`/\`wC\` 正文，确认 \`nur\`/\`TIe\`/\`Ya\`/\`Tc\`/钩子均已承载。S-2（不臆造）：\`eE\` 源为 \`qt(null)\`、\`Gfe\` 只作钩子次序读取、\`oi\` 无宿主实例 —— 三者作为宿主边界写入 \`plugin-chain-markdown-host.ts\`；\`wC\` 的无实例分支即源自己的固定对象，\`Xt\` 的 300/500ms 判定与选择取消均按源正文保留。S-3（宿主边界）：新边界为 \`plugin-chain-markdown-host.ts\`（\`eE\`/\`Gfe\`/\`oi\`/\`bindTerminalSelection\`/\`systemMarkdownClock\`）。S-4（可测）：14 条用例先经 \`.audit/w45-80-probe.ts\` 实测再断言。S-5/S-6：渲染器 \`Ya\` 复用 \`tui-markdown-components.ts\` 中同源恢复副本（W44 证据），不重复拷贝；两处 click 定时器常量按依赖闭包单独取段。S-7（记录）：证据 JSON 记录 5 段区间与摘要、分区叶子完成状态。验证：tsc 0、未声明扫描 unresolved 0、notices 0、新套件 14/14、链家族 644/644、全量 1,920/1,920、索引 65 chunk/292,924 单位、身份 da9ff72e…。
`);

const tsv = read('.audit/w45-runtime.tsv');
const rows = [
  ['2026-10-17T19:10:00Z', 'package', 'W45-80 Markdown 叶子：九类叶子收齐（5 段 1,747 单位 / 1 模块 + 1 宿主 seam）',
    'vje/tun、mdn、Xt、on、wC 成为产品面；plugin-chain-markdown-source.ts 生成副本；新 plugin-chain-markdown-host.ts 宿主边界；渲染器 Ya 复用 tui-markdown-components.ts 同源副本；新 plugin-chain-markdown.ts 公共 seam',
    'chunk-06azbynj.js 1 段 49u + chunk-kjfwbh4w.js 2 段 937u + chunk-1r9zp6s1.js 2 段 761u',
    '14/14 新套件；链家族 644/644；全量 1,920/1,920；1 文件 unresolved 0'],
  ['2026-10-17T19:13:00Z', 'decision', 'W45-80 不重复拷贝渲染器，宿主边界承接三个自由名',
    '① Ya 与 tui-markdown-components.ts 为同一段 chunk-kjfwbh4w 正文（W44 恢复），leaf 直接导入；② eE/Gfe/oi 是源在共享模块作用域读到的宿主对象，产品写入 markdown-host：eE=qt(null)、Gfe 仅钩子次序、oi 默认为空 Map；③ 无实例时 wC 走源自身的固定 no-selection 分支',
    '测试断言按无实例与绑定实例两分支书写；未给 oi 预置实例、未改 Xt 的 300/500ms 与取消逻辑',
    '.audit/w45-80-probe.txt + test/plugin-chain-markdown.test.ts + src/plugin-chain-markdown-host.ts'],
  ['2026-10-17T19:16:00Z', 'finding', 'W45-80 实测 Markdown 点击与渲染行为',
    '① mdn 三 scheme、vje 300、tun 500；② on 无 provider 抛源句、有 provider 返回挂载时钟；③ wC 无实例固定对象、绑定后委托、解绑清空；④ 三种渲染形态；⑤ 无链接/ctrl/alt/未声明链接 allowDefault；⑥ 窗口激活与 300ms 内 dropAsStray；⑦ 500ms 后 stopImmediatePropagation + 订阅 + 定时器 + 到点派发（带 link）；⑧ 选择出现取消（退订 + 取消定时器 + press 0），再次点击同样取消',
    '八条由 .audit/w45-80-probe.ts 实测后写入证据与测试',
    '.audit/w45-80-probe.txt + test/plugin-chain-markdown.test.ts'],
  ['2026-10-17T19:20:00Z', 'verification', 'W45-80 验收：scan unresolved 0、tsc 0、notices 0、14/14、644/644、1,920/1,920、索引 65 chunk/292,924 单位、身份 da9ff72e…',
    '下一步分区 4 剩余 Client host 与站点树遍历 je/终端胶水；随后 C 区各包',
    'source-undeclared-scan declared 37，unresolved 0；新套件 14/14；链家族 644/644；全量 1,920/1,920；索引 65 chunks / 1,601 语句 / 292,924 单位（2.7%）'],
];
const added = rows.filter(([stamp]) => !tsv.includes(stamp)).map((row) => row.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md').replace(/\n+$/, '\n');
write('.audit/w45-runtime.todo.md', todo + `
## W45-80 acceptance (2026-10-17)

- [x] **The nine leaf types are complete.** The Markdown leaf is copied; the other eight were ported by earlier packages.
- [x] **The renderer is reused, not duplicated.** \`Ya\` comes from the already-carried \`tui-markdown-components.ts\` copy of the same recovered body.
- [x] **The host boundary is named.** \`plugin-chain-markdown-host.ts\` carries the clock context, the selection context and the instance map.
- [x] **The click guard is pinned.** Undeclared links, no link, ctrl/alt, window activation and the 300 ms window all leave the click to the terminal.
- [x] **The press is delayed and cancellable.** A declared link presses after 500 ms; a selection or a second click cancels it.
- [x] **Sweep.** tsc 0, copy \`declared 37 / unresolved 0\`, notices 0, new suite 14/14, chain family 644/644, full 1,920/1,920, index 65 chunks / 292,924 units, identity \`da9ff72e…\`.
`);

const marks = {
  'research/CURRENT.md': 'W45-80 **Markdown 叶子',
  'research/STATUS.md': '\nW45-80:',
  'research/coding-standard.md': '\n2026-10-17 W45-80 ',
  'research/ports/W45-chain-runner.md': '\n## W45-80 ported',
  'research/FEATURES.md': 'W45-80 completes the nine leaf types',
  '.audit/w45-runtime.todo.md': '\n## W45-80 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
