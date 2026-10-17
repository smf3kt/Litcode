// W46-03 record: the recovered frame becomes the ScopedPicker frame. Writes the port section, the
// STATUS/FEATURES/coding-standard tails, the CURRENT C-2a row, and the runtime trail.
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const rep = (path, old, next) => {
  const text = read(path);
  const count = text.split(old).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} of ${JSON.stringify(old.slice(0, 70))}`);
  write(path, text.replace(old, next));
};

write('research/ports/W46-scope-picker.md', read('research/ports/W46-scope-picker.md').replace(/\n+$/, '\n') + `
## W46-03 made the recovered frame the ScopedPicker frame (2026-10-17)

The W46-02 frame was mounted only in the test-facing \`ScopePicker\`; the class both terminal hosts
actually use is \`ScopedPicker\`. It now renders the same \`gLt\`/\`Vse\` element through its
persistent document tree and projects the rows twice: \`frame()\` pads plain text for the tests and
\`styled()\` returns the ANSI cells the TUI and line painters draw. The frame owns \`{focus,window}\`.

The document tree has no focus manager, so the frame's only key handler, which rides on its search
field (\`rS\` receives \`props.onKeyDown\` = \`zr\`), is captured at the host seam. \`dispatchFrameKey\`
replays the frame's own key events, so movement stays the source's: up is focus+1 under
\`direction:"up"\`, down is focus-1, ctrl+p/n match, and pageup/pagedown move by
\`Bo = max(DBe, min(TBe, rows - MBe)) = max(2, min(8, rows - 10))\`. \`onFocus\` reports the focused row
back and the picker mirrors it into its cursor, so the drawn marker, the picker selection and the
accepted row are one state; \`move\` and \`page\` clamp rather than wrap.

A query or scope change changes the host element key (\`scope\\0query\`), which remounts the host
component, the host-tree equivalent of the source query handler resetting \`{focus:0,window:0}\`.
The scan mutates its row array in place while the frame memo compares \`items\` by identity, so each
render passes a fresh slice; without it the frame kept a stale empty window.

Host key mappings in \`src/tui.ts\` and \`src/terminal.ts\` follow the source mapping, including raw
\`\\x1b[5~\`/\`\\x1b[6~\` paging. The preview height fits the frame budget so a ten-row projection keeps
the hint row.

Verified: \`test/tui-scope-picker-frame-scoped.test.ts\` 5/5, \`test/picker-entry.test.ts\` 2/2 in
both modes, chain family 767/767, full 2,078/2,078, build 0, tsc 0, both generated copies
unresolved 0, notices 0, index 75 chunks / 323,525 units, identity \`e8177e84…\`.
\`scripts/smoke-input-history.mjs --search-chain\` passes in TUI and \`--line\` modes; its walk
targets the focused row, because a visible row in the frame window is not necessarily the focus.
`);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W46-03: the recovered frame becomes the ScopedPicker frame used by both terminal hosts. The frame owns focus and window; the host captures its search-field key handler so the picker drives the source movement (up is focus+1 under direction up), onFocus mirrors the focus into the picker cursor, and a query/scope change remounts the host component as the source reset. A fresh item slice per render keeps the identity-based frame memo in step with the in-place scan. 5/5 new tests, picker entry 2/2, full 2,078/2,078; tsc 0; both smokes pass; identity \`e8177e84…\`. [W46 record](ports/W46-scope-picker.md).
`);

rep('research/FEATURES.md',
  'in the scoped picker, with the document-tree host seams and the compact hint row.',
  'in the scoped picker, with the document-tree host seams and the compact hint row; W46-03 makes it the ScopedPicker frame in both terminal hosts, with the frame owning focus and window, a captured search-field handler driving the source movement, and onFocus keeping the picker cursor in step.',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W46-03 恢复帧成为 ScopedPicker 帧：S-1至S-7已对照。S-1（先读源）：沿用 W46-01/W46-02 已核验帧体，逐项对照 gLt 的按键映射（direction up：up→focus+1、down→focus-1、pageup/pagedown→±Bo）、查询重置与 onFocus 效应。S-2（不臆造）：帧体未改；宿主键捕获、每次渲染的新 items 切片与 scope\\0query 重挂载键是文档树适配，理由已记录。S-3（宿主边界）：dispatchFrameKey 与搜索钩子为显式接缝；帧仍自持 focus/window。S-4（可测）：新增 5 条 ScopedPicker 帧用例，picker-entry 断言改随真帧，smoke 走焦点而非可见性。S-5/S-6：复用既有帧与渲染器，无新增依赖。S-7（记录）：证据 JSON 记录集成改动与验证。验证：tsc 0、两份生成副本 unresolved 0、notices 0、新套件 5/5、picker-entry 2/2、链 767/767、全量 2,078/2,078、两模式 smoke 通过、身份 e8177e84…。
`);

rep('research/CURRENT.md',
  '身份 `6e8c48df…`。 | W44 / C-2 |',
  '身份 `e8177e84…`。 W46-03：恢复帧成为 `ScopedPicker` 的帧（TUI 与行模式共用），帧自持焦点/窗口，搜索字段捕获的按键处理驱动移动、`onFocus` 回写游标，查询变化经宿主键重挂载等价于源重置；`--search-chain` 两模式通过。 | W46 / C-2 |',
);

const tsv = [
  ['2026-10-18T01:20:00Z', 'package', 'W46-03 恢复帧成为 ScopedPicker 帧（TUI 与行模式共用）',
    'tui-scope-picker.ts 渲染真帧并投影文本/ANSI；source 提升 props 构建器；host 捕获搜索字段按键处理；tui.ts/terminal.ts 按源 direction-up 映射；picker-entry 与新增 frame-scoped 用例；smoke walkTo 改为走焦点',
    '复用 W46-01/W46-02 已核验 6 段 8,409 单位，无新复制段',
    '5/5 新用例；picker-entry 2/2；链 767/767；全量 2,078/2,078；两模式 smoke 通过'],
  ['2026-10-18T01:23:00Z', 'decision', 'W46-03 文档树无焦点管理器：捕获帧的搜索字段按键处理',
    '① 帧唯一按键处理挂在搜索字段，宿主在渲染时捕获并通过 dispatchFrameKey 重放帧自己的键事件；② onFocus 把焦点行回写选择器游标，绘制与选择同一状态；③ scope\\0query 作为宿主键，查询变化重挂载等价源重置；④ 每次渲染传新 items 切片以驱动按身份比较的帧 memo；⑤ 移动与分页按源钳制而非回绕',
    '测试按布局/焦点同步/查询重置/钳制分页/空态/接受分组',
    '.audit/w46-03-probe.ts + test/tui-scope-picker-frame-scoped.test.ts'],
  ['2026-10-18T01:26:00Z', 'finding', 'W46-03 实测帧焦点、窗口与真实 CLI 行为',
    '① 方向 up 底锚 4 行窗口、>> 焦点、提示行；② pageup/pagedown 按可见数移动并钳制；③ 重挂载恢复首行焦点；④ 40x10 真 CLI 两行窗口与 ^ 标记；⑤ 可见不等于焦点，smoke 改为走焦点后 tab 接受粘贴行并重基载荷；⑥ 两模式 search-chain exit 0',
    '六条由 .audit/w46-03-probe.txt 与 smoke 输出实测后写入证据与测试',
    '.audit/w46-03-probe.txt + .audit/w46-03-smoke-chain.txt'],
  ['2026-10-18T01:29:00Z', 'verification', 'W46-03 验收：tsc 0、两份副本 unresolved 0、notices 0、5/5、2/2、767/767、2,078/2,078、两模式 smoke、身份 e8177e84…',
    'C-2a 帧已在两个宿主生效；按键路由仍由 picker 持有',
    'source-undeclared-scan declared 105 与 145，unresolved 0；build 0；TUI 与 --line smoke exit 0；索引 75 chunks / 323,525 单位（3.0%）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w46-runtime.tsv', read('.audit/w46-runtime.tsv').replace(/\n?$/, '\n') + tsv + '\n');

write('.audit/w46-runtime.todo.md', read('.audit/w46-runtime.todo.md').replace(/\n+$/, '\n') + `

## W46-03 acceptance (2026-10-17)

- [x] **The frame is the ScopedPicker frame.** The class both terminal hosts use renders the recovered \`gLt\`/\`Vse\` element through the persistent document tree.
- [x] **The frame owns focus and window.** Host movement dispatches the frame's own keys; \`onFocus\` mirrors the focused row into the picker cursor, and movement clamps instead of wrapping.
- [x] **The source reset is preserved.** Scope and query changes remount the host component; a fresh item slice per render keeps the identity-based memo in step with the scan.
- [x] **Both projections work.** \`frame()\` pads plain text and \`styled()\` returns ANSI cells; the TUI keeps the hint row in the footer and line mode draws the same rows.
- [x] **The real CLI walks the focus.** \`--search-chain\` accepts the folded paste row with tab, rebases a new paste onto it, and passes in TUI and \`--line\` modes.
- [x] **Sweep.** tsc 0, both generated copies unresolved 0, notices 0, 5/5 new, picker entry 2/2, chain 767/767, full 2,078/2,078, build 0, identity \`e8177e84…\`.
`);

const marks = {
  'research/STATUS.md': '\nW46-03:',
  'research/coding-standard.md': '\n2026-10-17 W46-03 ',
  'research/FEATURES.md': 'W46-03 makes it the ScopedPicker frame',
  '.audit/w46-runtime.todo.md': '\n## W46-03 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
