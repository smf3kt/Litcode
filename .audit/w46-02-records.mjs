// W46-02 record: the TUI-bound frame and the picker mount. Writes the STATUS and FEATURES tails,
// the coding-standard entry, the runtime trail and the acceptance list; CURRENT was extended in the
// same package record. Anchors are asserted unique before any write.
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const rep = (path, old, next) => {
  const text = read(path);
  const count = text.split(old).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} of ${JSON.stringify(old.slice(0, 70))}`);
  write(path, text.replace(old, next));
};

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W46-02: the W46-01 frame is generated again against the product TUI runtime and mounted by the scoped picker. The document renderer supplies hooks and Box/Text; the host adds the memo cache, terminal size, focus and cursor contexts, the injected search hook, the stray-click guard and interaction-free visual primitives. The replacement frame is gone, so pick()/frame() render the recovered layout, including the compact hint row at 40 columns. 5/5 new tests, scope-picker 2/2, full 2,073/2,073; tsc 0; identity \`6e8c48df…\`. [W46 record](ports/W46-scope-picker.md).
`);

rep('research/FEATURES.md',
  'the functional-update state setter.',
  'the functional-update state setter; W46-02 binds the same frame to the product TUI runtime and mounts it in the scoped picker, with the document-tree host seams and the compact hint row.',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W46-02 选择器帧接入产品 TUI：S-1至S-7已对照。S-1（先读源）：复用 W46-01 已核验的 6 段/8,409 单位，逐项对照 pickerFrameProps 与 Kse 消费方 props。S-2（不臆造）：帧体逐字再生成，仅换模块绑定；预览高度按行预算收缩与紧凑提示标签是宿主可视层适配，已记录理由。S-3（宿主边界）：s/n/w/b/ke/Qc/nt/_y/aS 与视觉原语为显式接缝；文档树无 FocusManager，故交互 props 在宿主元素处剥离、按键仍由 picker 路由。S-4（可测）：新增 5 条 TUI 帧用例，既有 scope-picker 2 条转为真帧渲染后仍过。S-5/S-6：一次生成、复用既有运行时与渲染器，无新增依赖。S-7（记录）：证据 JSON 记录二次生成、宿主边界与集成改动。验证：tsc 0、两份生成副本 unresolved 0、notices 0、新套件 5/5、scope-picker 2/2、链 767/767、全量 2,073/2,073、身份 6e8c48df…。
`);

const tsv = [
  ['2026-10-18T01:00:00Z', 'package', 'W46-02 选择器帧接入产品 TUI（同 6 段 8,409 单位二次生成）',
    'tui-scope-picker-frame-tui-source.ts 生成副本；新 tui-scope-picker-frame-tui-host.ts 宿主接缝（s/n/w/b/ke/Qc/nt/_y/aS/视觉原语）；tui-scope-picker-source.ts 删除替代帧并改用真帧；ScopePicker.frameElement 注入尺寸与搜索状态',
    'chunk-24k7d6mw.js 4 段 + chunk-06azbynj.js 1 段 + chunk-x90vmw14.js 1 段共 8,409u',
    '5/5 新套件；scope-picker 2/2；链 767/767；全量 2,073/2,073；两份副本 unresolved 0'],
  ['2026-10-18T01:03:00Z', 'decision', 'W46-02 文档树无 FocusManager，交互 props 在宿主层剥离',
    '① 文档渲染器的根无 focusManager，onMouseLeave/onWheel/onClick 会触发守卫异常，故宿主 s/n 包装剥离交互 props；② 按键仍由 picker 路由，帧只负责绘制；③ 搜索钩子每次渲染前注入 picker 查询与光标；④ 预览高度 min(8,rows-5) 以保留提示行；⑤ 提示标签紧凑化以适配 40 列',
    '测试按布局、行序、空态、注入查询、十行投影分组',
    '.audit/w46-02-probe.ts + test/tui-scope-picker-frame-tui.test.ts'],
  ['2026-10-18T01:06:00Z', 'finding', 'W46-02 实测真帧渲染、行序与提示裁剪',
    '① 60x12 标题/两行/焦点标记/提示行；② direction down 行序；③ 空态文本；④ 注入查询行；⑤ 40x10 提示行保留；⑥ FocusManager 修复前后',
    '六条由 .audit/w46-02-probe.ts 与 scope-picker 测试实测后写入证据与测试',
    '.audit/w46-02-probe.txt + test/tui-scope-picker-frame-tui.test.ts'],
  ['2026-10-18T01:09:00Z', 'verification', 'W46-02 验收：tsc 0、两份副本 unresolved 0、notices 0、5/5、scope-picker 2/2、767/767、2,073/2,073、身份 6e8c48df…',
    'C-2a 帧已挂载；按键路由仍由 picker 持有',
    'source-undeclared-scan declared 145 与 98，unresolved 0；新套件 5/5；scope-picker 2/2；链 767/767；全量 2,073/2,073；索引 75 chunks / 323,525 单位（3.0%）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w46-runtime.tsv', read('.audit/w46-runtime.tsv').replace(/\n?$/, '\n') + tsv + '\n');

write('.audit/w46-runtime.todo.md', read('.audit/w46-runtime.todo.md').replace(/\n+$/, '\n') + `

## W46-02 acceptance (2026-10-17)

- [x] **The frame renders inside the product document tree.** The same six blocks are generated against the TUI runtime; the picker's \`pick()\`/\`frame()\` shows title, rows, focus marker, search and hints.
- [x] **The host seams are explicit.** Memo cache, terminal size, focus and cursor contexts, injected search hook, stray-click guard and interaction-free visual primitives.
- [x] **The replacement frame is gone.** \`pickerFrameProps\` calls the recovered frame with the consumer props; the draft query seeds it.
- [x] **The narrow projection fits.** Compact hint labels and a budget-shaped preview keep \`Ctrl+S scope\` visible at 40x10.
- [x] **Sweep.** tsc 0, both copies unresolved 0, notices 0, 5/5 new, scope-picker 2/2, chain 767/767, full 2,073/2,073, identity \`6e8c48df…\`.
`);

const marks = {
  'research/STATUS.md': '\nW46-02:',
  'research/coding-standard.md': '\n2026-10-17 W46-02 ',
  'research/FEATURES.md': 'W46-02 binds the same frame',
  '.audit/w46-runtime.todo.md': '\n## W46-02 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
