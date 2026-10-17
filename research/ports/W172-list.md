# W172 列表（C-2 diff 第十二片）

日期：2026-10-18。范围：`Tl` 列表本体（`Cn`）、`Eo`/`Qe` 两种布局、`NXe` 测量容器、`fn` 导航状态、`Po`/`Bo` 行与标题、`rx` 选中读取、无障碍 `ZY`/`En` 及其滚动、悬停、符号依赖。复制 **59 块 31,687 UTF-16 单位**，跨 10 个模块。前置：[W171](W171-spinner.md)。

## 来源身份

| 模块 | sha256 |
| --- | --- |
| `chunk-0wtqg4zf.js` | `37fffc2f615ac9aaf5d92ff2cacd3d96cb7191880b1115f02b8f3353eb85a50f` |
| `chunk-yygmb66g.js` | `93220b26616034b337ff622aa95b4125688626cc0a1a883c473f2703565d60b0` |
| `chunk-1r9zp6s1.js` | `444d1adce233caec24f15e8203bd02c9ae6313df62af94ff0c81ea669458936e` |
| `chunk-06azbynj.js` | `5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd` |
| `chunk-3cynezh1.js` | `c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3` |
| `chunk-ejnyhzsc.js` | `24697cf467fb57202c5ec305d52e767e0f6693a85e3b36ba1f0bb4dbc279e8d4` |
| `chunk-t4khkhyw.js` | `37829ab1bd60fefe517f94567d39ccadcba5b65c566cf6691977d2b08ed7d2b0` |
| `chunk-vk5xdr3b.js` | `41a191e7ff311950074f2af3ba6031946387ab37cef42172cd892ab63550352f` |
| `chunk-ax7r0qj7.js` | `8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e` |
| `chunk-pxjy4t8j.js` | `523505a6cb4614eda623cc9249eeab5a0e5f398f789ac555e5c997dc1d24eef7` |

全部 59 个块的范围、单位数与正文 SHA-256 见 `W172-list-evidence.json`。主要块：

| 名称 | 范围 | 单位 | 正文 SHA-256 | 语义 |
| --- | --- | --- | --- | --- |
| `pe` | `chunk-0wtqg4zf.js [1787,2920)` | 1133 | `7899d0fe…` | 可按压/重复控件及其按压、重复与悬停助手 |
| `NXe` | `[3522,3878)` | 356 | `07c1ba65…` | 测量列表盒与行的容器 |
| `Ye` | `[4027,6359)` | 2332 | `fd971803…` | 滚动条列：轨道拖动、箭头与建议色 |
| `fn` | `[9547,12509)` | 2962 | `b4ff5e12…` | 列表导航：光标、窗口、标题、翻页、边界、滚轮与滚动条绑定 |
| `Cn` | `[12685,14057)` | 1372 | `1bcca700…` | 列表本体：无障碍分支或按 `visibleCount` 分派 |
| `Eo` | `[14057,15880)` | 1823 | `869eda1d…` | 可见数布局：测量滚动的固定开销、视口行、最小/最大窗口与溢出提示 |
| `Qe` | `[15880,18925)` | 3045 | `523c4d70…` | 窗口化列表体：行、标题、溢出提示、滚动盒与逐行选中上下文 |
| `Po` | `[18925,19035)` | 110 | `4f825709…` | 列表行包装 |
| `Bo` | `[19035,19145)` | 110 | `2fc4f625…` | 列表标题包装 |
| `Tl` | `[19333,19379)` | 46 | `eae6ae43…` | 列表本体并挂上 `Item`/`Heading` |
| `_C` | `chunk-yygmb66g.js [3085,5388)` | 2303 | `ec2bb6d9…` | 可点击行：焦点/选中样式、光标声明、滚动标记与悬停 |
| `ei` | `[5388,6284)` | 896 | `19dc0d90…` | 行内容：标签、描述、滚动标记与悬停样式 |
| `ZY` | `[9153,13712)` | 4559 | `648c03d3…` | 无障碍选择：数字与方向导航、选项、标签渲染与播报 |
| `En` | `[20093,21300)` | 1207 | `be1ac6c9…` | 无障碍选择的一行选项 |

## 行为

- `Cn`：无障碍上下文 `nt()` 为真且提供 `onSelect` 时走可访问分支——按 `Me` 把标题分组、过滤出可选行、空列表输出 `emptyMessage`，否则以 `ZY` 渲染选择器并吞掉禁用行的回车/空格；其余情况 `visibleCount === undefined` 走 `Eo`，否则把该值交给 `Qe`。
- `Eo`：用 `kc` 测量列表盒相对滚动内容的高度作为固定开销，`ns` 读终端行数；行预算为终端行数减容器保留（`nq`）或测量预算，低值钳到 `$e`；`maxVisibleCount` 再取小；预算为 1 时溢出提示为 `none`，小于 `$e` 时为 `glyph`，否则按 `overflowHint` 的 `count` 规则调整，最后以该预算渲染 `Qe`。
- `Qe`：按 `Co` 汇总每个子项占用的行数；溢出提示为 `count` 且总行数超出时预留两行给上下提示。`fn` 得到行数、窗口、标题行、行高、行 key、边界与回调，返回光标、窗口、`spareLines`、滚动条绑定与 `bind`。首行渲染前执行 `$h(ref, !disabled)`。空列表输出 `emptyMessage`。窗口内的标题渲染为不可选 `_C`（`styled:false`），可选行包在 `Mo.Provider` 中并以 `height`/`overflow:hidden` 裁剪；`rowClick:"move"` 只移动光标，默认点击选中；禁用行由 `onDisabledRowClick` 处理。`scrollBar` 关闭时直接铺开行与提示，开启时放进 `Sdn` 滚动盒并在 `glyph` 模式使用带箭头的滚动条。
- `fn`：光标初始为 `defaultFocusIndex` 钳制后的值；方向、翻页、首尾、滚轮与滚动条拖动都经过同一窗口计算；`wrap` 在边界回绕，`clamp` 停在边界；`declineHomeEnd` 拒绝 Home/End；标题行不占光标。
- `Po`/`Bo`：分别把子节点包进片段；`Bo` 额外用 `w` 记忆化并标记自身为标题供 `Me` 识别。
- `rx`：读取 `Mo` 上下文，默认 `false`，供行内容决定选中样式。

## 复用与改写记录

- **复用**：React 缝（`Xe`/`w`/`b`/`y`/`P`/`R`/`Ae`/`Z`/`Rt`/`le`/`en`/`To`/`qt`/`s`/`n`/`N`/`Children`/`isValidElement`/`fragment`）、代码宿主（`nt`/`kc`/`Ys`）、标签页（`nl`/`ns`/`aS`）、输入字段（`ke`）、Markdown（`on`）、按压控件（`Zy`/`Lc`）、键位上下文（`nn`）、键行（`oo`）、框架作用域（`IU`）、TUI 原语（`ld`）、符号（`te`）、截断（`ae`）、颜色（`ge`）、应用状态（`sx`）、文件边界（`O`）、上一帧失效（`F`）。
- **宿主适配（已记录）**：
  - `Wo`（chunk-7n39kxwj.js `d61cd8ea…`，[1540,1576) 36u，正文 `d9532139…`）对应用状态套选择器；绑定本构建的 `sx`。
  - `Mct`（chunk-mrf41zrh.js `e800c49b…`，[4416,4462) 46u，正文 `d267c486…`）询问宿主的箭头导航开关；本构建的选择器本身以方向键导航，本地答案为真。
  - `$h`（chunk-f37m98yh.js `207b107a…`，[21892,22233) 341u，正文 `4be627f6…`）在启用时聚焦 ref 节点并把焦点保持在内部。源运行时由 FocusManagerProvider 在宿主节点上盖 `focusManager`；钩子运行器提交的元素没有该提供者，`ix` 会抛出，因此正文先走 `ix`，失败时退回挂载的应用上下文（`Zy`，默认管理器为 `null`），与源内同类焦点读取器一致。
- **仍缺**：`si` 接线的 `PMr`/`Ht`/`Ffe`；C-5 提供者/密钥策略；C-6 其余消费者；C-9 marketplace/冲突；C-11 格式化差异；C-12 其余 plugin-chain 工作。

## 测试

`test/diff-dialog-list.test.ts` 10 例：`Item`/`Heading` 静态、`Tl` 分派到 `Qe`、窗口化行渲染（三行文本）、空列表消息、行/标题片段包装、测量容器提供上下文、选中读取器随上下文、导航初始光标与窗口（`cursor`/`isCursor`/`windowStart`/`windowEnd`/`bind`）、零行时光标钳制、标题不进入可选行（两行 `_C`，首行 `styled:false`）。标题元素在独立组件运行中构造，因为 `Bo` 使用 `w` 钩子。

## 门禁与身份

聚焦 10/10；全量 2565/2565；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0（已知缺文本 5 项）；未声明扫描 254，unresolved 0；身份 `997d61f885bac709aeb3af35762ee15927dc1c5fe63e545796f7ebef58d85916`（inputs 672 / validation 228 / build 462）。
