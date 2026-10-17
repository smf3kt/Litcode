// W46-01 record: the scope-picker frame, the host seam it reads and the hook-seam correction.
// Writes the CURRENT segment, the STATUS and FEATURES tails, the coding-standard entry, the runtime
// trail and the acceptance list. Every anchor is asserted unique before any write.
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const rep = (path, old, next) => {
  const text = read(path);
  const count = text.split(old).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} of ${JSON.stringify(old.slice(0, 70))}`);
  write(path, text.replace(old, next));
};

rep('research/CURRENT.md',
  '属来源行为非缺陷。 | W44 / C-2 |',
  '属来源行为非缺陷。**W46-01（2026-10-17）**：按 S-7 搬运帧本体——`FLt`+常量 `TBe/MBe/DBe` [605350,605389)、`gLt` [605389,611517)、`Vse` [611517,613200)、`pHe` [613200,613266)（chunk-24k7d6mw.js），`ad` [200495,200579)（chunk-06azbynj.js），`fo` [757,1166)（chunk-x90vmw14.js），共 6 段 8,409 单位，落在 `tui-scope-picker-frame-source.ts`。语义：帧以单一状态持焦点与窗口，可见数 `max(2,min(visibleCount,rows-10-(matchLabel?1:0)))`；上下键/ctrl+p/n 移焦一格，pageup/pagedown 移一屏，return 选中，tab 走页签动作或回退选中，其余按键交搜索钩子；查询变化上报并重置焦点/窗口/hover，items 变化夹取，resetKey 清零；preview 按位置右置或下置，终端 <120 列时 enter 提示取动作首词；提示行为 dim Text 包 inline row。`Vse` 画空态块或可见行（焦点、declareCursor、按方向翻转的滚动标记、误触守卫、hover 与离开重置）。`tui-scope-picker-frame-host.ts` 提供宿主接缝：`ke`、`Qc`/`nt` 上下文、可注入的 `_y`、`aS` 300ms 守卫与视觉 token `z/Se/es/rS/_C`。**接缝修正**：`plugin-chain-react-hooks.ts` 的 `y` 现支持 React 函数式更新（源帧用 `Vo(state=>...)`，旧实现把函数本身当状态，导致移动后状态读到 undefined），新增用例钉住该语义。实测：`.audit/w46-01-probe.txt` 量出布局、焦点/窗口、滚轮、查询编辑、行标记与误触守卫；tsc 0；未声明扫描 declared 145/unresolved 0；notices 0；新套件 25/25；链家族 767/767；全量 2,068/2,068；索引 75 chunk/323,525 单位（3.0%）；身份 `ea5a3a68…`。下一式：把该帧挂进产品选择器（C-2a 集成）并复跑 picker-entry 两模式。 | W44 / C-2 |',
);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W46-01: the recovered scope-picker frame and row list are ported verbatim (6 blocks, 8,409 units): the focus/window state, the keyboard and wheel movement, the search hook handoff, the preview layout and hint row, and the row list with its markers, stray-click guard and hover. The terminal size, focus and cursor contexts, the search hook and the visual primitives stay host seams. The shared state setter now implements React's functional updater, which the frame requires. 25/25 new tests, 767/767 chain family, 2,068/2,068 full; tsc 0; index 75 chunks / 323,525 units. Next: mount the frame in the product picker. [W46 record](ports/W46-scope-picker.md).
`);

rep('research/FEATURES.md',
  'the deduplicated render-failure note.',
  'the deduplicated render-failure note; W46-01 adds the recovered scope-picker frame: the focus/window state with its keyboard and wheel movement, the search hook handoff, the preview and hint layout, the row list with its scroll markers and stray-click guard, and the functional-update state setter.',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W46-01 分作用域选择器帧：S-1至S-7已对照。S-1（先读源）：量出 6 段/8,409 单位，逐段读 「gLt」/「Vse」/「pHe」/「ad」/「fo」 与常量、空 reset；边界符号（ke/Zm 已入产品）。S-2（不臆造）：可见数公式、焦点/窗口迁移、按键与滚轮分支、preview 与提示行、行标记与误触守卫均按源正文保留；宿主接缝仅补契约，未改帧语义。S-3（宿主边界）：搜索钩子 _y 可注入，Qc/nt 上下文、aS 守卫与视觉 token 为显式接缝。S-4（可测）：25 条用例先经 .audit/w46-01-probe.ts 实测再断言。S-5/S-6：整段一次收齐，复用既有 hook/终端 size seam，无新增依赖。S-7（记录）：证据 JSON 记录 6 段区间、宿主边界与接缝修正。验证：tsc 0、未声明扫描 declared 145/unresolved 0、notices 0、新套件 25/25、链家族 767/767、全量 2,068/2,068、索引 75 chunk/323,525 单位、身份 ea5a3a68…。
`);

const tsv = [
  ['2026-10-18T00:30:00Z', 'package', 'W46-01 分作用域选择器帧（6 段 8,409 单位）',
    'gLt/Vse/pHe/ad/fo 与 FLt、TBe/MBe/DBe 成为产品面；tui-scope-picker-frame-source.ts 生成副本；新 tui-scope-picker-frame-host.ts 宿主接缝（ke/Qc/nt/_y/aS/视觉 token）与新 tui-scope-picker-frame.ts 公共 seam',
    'chunk-24k7d6mw.js 4 段 + chunk-06azbynj.js 1 段 + chunk-x90vmw14.js 1 段共 8,409u',
    '25/25 新套件；链家族 767/767；全量 2,068/2,068；1 文件 declared 145/unresolved 0'],
  ['2026-10-18T00:33:00Z', 'decision', 'W46-01 帧逐字复制，搜索与上下文留宿主',
    '① gLt/Vse 的状态、迁移、按键、滚轮、布局与行标记逐字保留；② 搜索输入 _y 可注入，默认实现覆盖编辑键与粘贴；③ Qc/nt 为宿主上下文，视觉 token z/Se/es/rS/_C 由渲染器解析；④ 帧的 preview 位置与窄终端提示折叠按源分支；⑤ 下一式接入产品选择器',
    '测试按限制与标签、布局、移动、搜索、行列表、hook 接缝分组',
    '.audit/w46-01-probe.txt + test/tui-scope-picker-frame.test.ts'],
  ['2026-10-18T00:36:00Z', 'finding', 'W46-01 实测帧布局、迁移与误触守卫，并修正 hook 接缝',
    '① 布局与高度 9；② 焦点 0→1→2→3、pageup 回 0、pagedown 至 8/window 1；③ return 选 k8、tab 报 k9；④ 滚轮窗口 ±1 且 stop；⑤ 查询编辑与重置；⑥ 行标记与 up 翻转；⑦ 300ms 守卫丢弃首击；⑧ `y` 函数式更新',
    '八条由 .audit/w46-01-probe.ts 实测后写入证据与测试；`y` 的修正由帧的状态读取失败暴露',
    '.audit/w46-01-probe.txt + test/tui-scope-picker-frame.test.ts'],
  ['2026-10-18T00:39:00Z', 'verification', 'W46-01 验收：declared 145/unresolved 0、tsc 0、notices 0、25/25、767/767、2,068/2,068、索引 75 chunk/323,525 单位、身份 ea5a3a68…',
    '下一式 C-2a 集成：产品选择器改用 gLt 并复跑 picker-entry 两模式',
    'source-undeclared-scan declared 145，unresolved 0；新套件 25/25；链家族 767/767；全量 2,068/2,068；索引 75 chunks / 1,743 语句 / 323,525 单位（3.0%）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w46-runtime.tsv', tsv + '\n');

write('.audit/w46-runtime.todo.md', `# W46 runtime acceptance

## W46-01 acceptance (2026-10-17)

- [x] **The frame layout is the source layout.** Title, search, windowed rows, match label, preview by position, and the hint row with the narrow-terminal chord collapse.
- [x] **The focus and window move by the source rules.** Up/down and ctrl+p/n by one, pageup/pagedown by the visible count, return selects, tab runs its action or selects.
- [x] **The wheel moves the window and stops the event.** The sign flips with the direction; a zero delta does nothing.
- [x] **The search hook edits and resets.** Typing, backspace, delete, left/home/end and paste edit the query; a query change reports it and resets focus, window and hover.
- [x] **The row list owns no state.** Empty state, focus, declare-cursor, direction markers, the 300ms stray-click guard, hover and mouse-leave.
- [x] **Sweep.** tsc 0, copy \`declared 145 / unresolved 0\`, notices 0, new suite 25/25, chain family 767/767, full 2,068/2,068, index 75 chunks / 323,525 units, identity \`ea5a3a68…\`.
`);

const marks = {
  'research/CURRENT.md': 'W46-01（2026-10-17）',
  'research/STATUS.md': '\nW46-01:',
  'research/coding-standard.md': '\n2026-10-17 W46-01 ',
  'research/FEATURES.md': 'W46-01 adds the recovered scope-picker frame',
  '.audit/w46-runtime.todo.md': '\n## W46-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
