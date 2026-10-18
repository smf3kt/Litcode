# W173 diff 对话框接线（C-2 隔离组件验收）

日期：2026-10-18。范围：`si` 对话框本体与同模块的文件列表 `K`/`Vt`/`Et`、行 `oe`、统计格 `le`，以及滚动助手 `rMe`/`pee`。复制 **6 块 8,741 UTF-16 单位**。前置：[W172](W172-list.md)。本记录验证隔离组件合同，尚未证明真实终端挂载。全屏命令实际走右侧栏，见后续 [W180](W180-native-diff-panel.md)。

## 来源身份

| 模块 | sha256 |
| --- | --- |
| `chunk-twzxjzbk.js` | `84e9dd9e0d193d0d9e64cfdf3534a0f0c2f2b42cee51236346b5eef34b7dd35b` |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` |

| 名称 | 范围 | 单位 | 正文 SHA-256 | 语义 |
| --- | --- | --- | --- | --- |
| `Et`/`Vt`/`ve` | `chunk-twzxjzbk.js [20073,20163)` | 90 | `98c6502f…` | 边界空操作、把 `oe` 包进 `Tl.Item` 的文件行、窗口大小 7 |
| `K` | `[20163,20640)` | 477 | `d035b22a…` | 文件列表：空提示、行映射、固定可见数与导航 |
| `oe` | `[20640,21165)` | 525 | `f28d386a…` | 单个文件行：截断起始的路径与统计格 |
| `le` | `[21165,22140)` | 975 | `085bae40…` | 统计格：untracked/binary/large、增删标签与截断注记 |
| `si` | `[22672,28980)` | 6308 | `d3e08b4c…` | 对话框：来源、列表/明细模式、滚动、按键动作、标题/空态、页签与框架 |
| `rMe`/`pee` | `chunk-24k7d6mw.js [130997,131363)` | 366 | `dc8ee78b…` | 按自动滚动设置跳底，或在钳制区间内按增量滚动 |

## 行为

- `si`：来源列表为 `{type:"current"}` 加每个已完成回合 `ri(turn)`；选中当前源时数据取 `PMr(Ht())`，选中回合时取 `Ie(turn)`。文件集与 hunk 由当前源决定，选中索引跨源按 `{source,index,mount}` 保存，窗口收缩时把当前索引钳回列表末尾。`sa("diff-dialog")` 注册活动覆盖层，`ZD("DiffDialog")` 注册按键上下文；`nn` 绑定 10 个动作（关闭、上一/下一来源、返回、上一/下一文件、六种滚动）与列表模式的上一/下一文件动作。
- 明细模式：`Ffe()` 给出滚动句柄；`C(action)` 用视口高度的一半做翻页、整页用视口高度，调用 `pee` 或 `scrollTo`/`scrollToBottom`。列表模式的方向键在来源间循环。
- 标题：当前源为「Uncommitted changes」/「Branch changes」/「Staged and new files」，回合源为 `Turn N`；副标题为回合提示（带引号）、`(vs baseBranch)` 或 `(git diff HEAD)`，无提交时为 `(no commits yet)`。统计行输出「N files changed」与 `Ib` 增删标签。
- 空态：回合源为「No file changes in this turn」；通知文本优先；统计有文件但明细为零时为「Too many files to display details」；否则「No changes yet」。加载中输出 `Mr` 的「Loading diff…」。
- 正文：列表模式渲染 `K`（`defaultFocusIndex`、`resetKey` 为源索引、`onFocus` 回写索引、`onSelect` 进入明细）；明细模式渲染 `pBe`（路径、hunk、large/binary/truncated/untracked/restricted）。两者外层为 `gap:1` 的列。
- 底部提示条按模式选择左右切源、上下选择/滚动、回车查看与 `pt` 的关闭/返回提示。页签条 `sS` 在只有当前源时隐藏，标题为 `Current`/`T{index}`，明细模式禁用页签导航。
- 取消：明细模式返回列表，列表模式调用 `onDone("Diff dialog dismissed",{display:"system"})`。
- `pee`：上限为滚动高度减视口高度，目标为钳制后的当前偏移加待处理增量再加增量；到达上限走 `rMe`（自动滚动开启时 `scrollToBottom`，否则滚到上限）；顶部且允许继续时调用 `Fvn` 遥测，然后滚到钳制后的目标。

## 复用与改写记录

- **复用**：React 缝（`Xe as e`/`Xe as r`/`n`/`s`/`w`/`b`/`y`/`P`）、`z`/`fo`（chrome）、`pt`/`Se`（keyhint）、`_e`（框架）、`sS`/`Na`/`Ffe`（页签）、`pBe`/`Uwe`（明细）、`rx`/`Tl`/`sa`（列表）、`I`/`Ib`（原语）、`Mr`（指示器）、`ri`/`Ie`（回合层）、`nn`（键位）、`ZD`（焦点上下文）、`hs`（设置读取）。
- **宿主适配（已记录）**：
  - `Ht`（chunk-qr9z1wer.js `7c4094d8…`，[1303,1342) 39u，正文 `44668f06…`）判断远程/控制通道；本构建只保留本地功能，恒为 false。
  - `PMr`（chunk-xmvfy87k.js `fabe23b4…`，[5796,5868) 72u，正文 `82a6fec6…`）在 `Ht()` 为真时走远程工作区数据钩子；本地分支即 W163 的 `GitDiffDataController` 视图，经 `DiffDataContext` 由宿主绑定，notice 为 null。
  - `ne`（chunk-twzxjzbk.js [18642,20073) 1,431u，正文 `5c48c36f…`）是源 memo；W164 已适配为 `TurnDiffAccumulator`，宿主 `ne` 用整份消息列表得到与 memo 相同的完成回合列表。
  - `Fvn`（chunk-sfn1dbxq.js `4c74137e…`，[91100,91145) 45u，正文 `38218af1…`）是 `reachedScrollbackCap` 遥测计数；本构建遥测为空操作。

## 测试

`test/diff-dialog-dialog.test.ts` 11 例：组件导出与框架分派；空态当前源与空消息；加载中指示器消息；通知替换空消息；统计行「files changed」与 `Ib` 增删属性、`K` 的文件集、`oe` 路径文本、`Vt` 包装为 `Tl.Item`；一个完成回合产生 `Current`/`T1` 两个页签；单一来源隐藏页签条；`K` 空提示；`le` 的 untracked/binary/large/truncated 标记；`pee` 的增量滚动、跳底与顶部钳制（绑定轮盘设置宿主）；框架取消回调。

## 门禁与身份

聚焦 11/11；全量 2576/2576；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；未声明扫描 130，unresolved 0；身份 `ada4a1c6aa239e73ac1913adfb38f3f903e45c7e3a635b0cf668ebda6f3d5526`（inputs 676 / validation 229 / build 465）。
