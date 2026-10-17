# W171 旋转指示器（C-2 diff 第十一片）

日期：2026-10-18。范围：`Mr` 旋转提示（符号 + 文本 + 副标题）与 `ui` 指示器本体，连同其动画时钟、可见性测量与帧集合。复制 **14 块 3,407 UTF-16 单位**。前置：[W170](W170-frame.md)。

## 来源身份

| 模块 | sha256 |
| --- | --- |
| `chunk-vew7ssxx.js` | `ce2d686ede9289202e527ee56f06d3dfec2da22ae3ae301cf4ada6c158dd8994` |
| `chunk-f7x3yeg4.js` | `130b182b2a3b0637c3894917f00b96f593b73e16913f474ed37ae37287b7240f` |
| `chunk-1r9zp6s1.js` | `444d1adce233caec24f15e8203bd02c9ae6313df62af94ff0c81ea669458936e` |
| `chunk-06azbynj.js` | `5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd` |
| `chunk-k1caxvem.js` | `0486ac30af93e1201282a5264304b0c84a83f55ba2f901a884fbff45fbe6f3a5` |
| `chunk-z9nv3z8k.js` | `80a7eda1db7332eb0f201204442b37faab0dbd9fe0157f77f24a380f2208fed6` |
| `chunk-hyshef1z.js` | `285b14e1859d23bdcd2835074dfdf24fee85ae4d31b641900bb11dc96e14e7d4` |

| 名称 | 范围 | 单位 | 正文 SHA-256 | 语义 |
| --- | --- | --- | --- | --- |
| `Mr` | `chunk-vew7ssxx.js [2002,2510)` | 508 | `5765fd3a…` | 旋转提示：符号 + 文本 + 可选副标题 |
| `ui` | `chunk-f7x3yeg4.js [26148,26747)` | 599 | `d4f107d9…` | 指示器：静态圆点或 120ms 量化的动画帧 |
| `mr` | `[20212,20266)` | 54 | `f100014b…` | 减少动效选择器 |
| `$e` | `chunk-1r9zp6s1.js [22075,22541)` | 466 | `f077bc9d…` | 节点框是否落在终端行内 |
| `N4` | `[22541,22970)` | 429 | `34b1871a…` | 可见性钩子 |
| `Io/LIe/ia` | `[22970,23354)` | 384 | `2c173c38…` | 480ms 重绘下限与动画时钟 |
| `nt` | `[19734,19763)` | 29 | `f753910d…` | 读取无障碍上下文 |
| `vie` | `chunk-06azbynj.js [174030,174177)` | 147 | `01e87dfd…` | 滚动偏移钳制 |
| `Dy/y4n` | `[184065,184136)` | 71 | `72a411cb…` | 内部无障碍上下文 |
| `u` | `chunk-k1caxvem.js [876,975)` | 99 | `a229da26…` | 终端焦点上下文 |
| `d/Qc/kie` | `[1257,1375)` | 118 | `01f7648a…` | 上下文别名与两个读取器 |
| `nI/Cje/T4n` | `[1405,1497)` | 92 | `3e986597…` | 超时助手与空订阅/读取函数 |
| `eg` | `chunk-z9nv3z8k.js [615,656)` | 41 | `b15fa736…` | 16ms 帧量子 |
| `l/p/T/d/f/y/Vdn/HIe` | `chunk-hyshef1z.js [661,1031)` | 370 | `8369e57f…` | 三组帧、其反向循环与终端相关选取 |

## 行为

- `ui`：`bg(Wo(mr))` 或 `nt()` 为真时输出 `text` 色 `●`；否则 `ia(120)` 取量化时间，`HIe()` 取当前终端帧集，帧下标 `floor(t/120) % 帧数`。两种分支的外层都是 `aria-hidden`、`height:1, width:2`、`flexWrap:"wrap"` 的框，`ref` 来自 `ia`。
- `ia`：`N4()` 得到 `[ref, {isVisible}, remeasure]`，`kie()` 读终端焦点状态；仅当挂载了 `eE` 时钟、节点可见且 `interval !== null` 时走 `clock.subscribeKeepAlive`，否则用空订阅。量子 `q = ceil(LIe(interval)/16)*16`，快照 `floor(now()/q)*q`；`interval === null` 快照恒为 0。`LIe` 在 `CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT` 为真时把小于 480 的间隔抬到 480。
- `N4`/`$e`：节点必须有 `yogaNode`，否则返回 `null`；逐级加上祖先 `getComputedTop`，减去带 `scrollTop` 的祖先滚动钳制值，与视口 `rows` 比较；测不到时 `N4` 保持上一次可见状态。
- `Mr`：行内 `[Spinner, Text(" "+message, bold?, dimColor?)]`，可选副标题作为 `column` 第二行，`dimColor` 固定为真。
- `Vdn`/`HIe`：`TERM === "xterm-ghostty"` 时分别返回 `l`/`d`，否则 `p`/`f`；`l`、`p`、`T` 为 6 帧基础集，`d`、`f`、`y` 为“正向 + 反向”的 12 帧循环。

## 复用与改写记录

- **复用**：React 缝（`w`/`b`/`Ae`/`R`/`Rt`/`le`/`en`/`qt`/`Xe`/`s`/`n`）、`Zm`（终端尺寸）、`eE`（时钟）。
- **宿主适配（已记录）**：
  - `bg`（chunk-r0g20c30.js `fc765811…`，[755,823) 68u，正文 `dac8fea5…`）在设置为真时返回真，否则查询远程 `tengu_cedar_marsh` 门；本地构建只保留设置值，`bg` 直接返回布尔化结果。
  - `Wo`（chunk-7n39kxwj.js `d61cd8ea…`，[1540,1576) 36u，正文 `d9532139…`）对应用状态套选择器；`SpinnerSettings` 是本地设置上下文，`Wo` 从其中取 `settings.prefersReducedMotion`。
  - `a` 是宿主环境对象：`TERM` 与 `CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT` 均由进程环境读取。
- **仍缺**：列表 `Tl`/`Cn`/`Po`/`Bo`/`rx`、以及 `si` 接线的 `PMr`/`Ht`/`Ffe`。

## 测试

`test/diff-dialog-spinner.test.ts` 10 例：减少动效选择器；帧量子与 480ms 重绘下限（含完整重绘标志）；三组帧与其反向循环；终端帧集选取；减少动效下输出静态圆点；无减少动效时输出量化帧（1000ms → 896ms 网格 → 第 7 帧；127ms → 第 0 帧；128ms → 第 1 帧）；空间隔与缺时钟时暂停为 0；视口外节点不可见且不可测量返回 `null`；未绑定 ref 时 remeasure 返回初始可见；消息的文本与可选副标题。

## 门禁与身份

聚焦 10/10；全量 2555/2555；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；未声明扫描 34/43/9，均 unresolved 0；身份 `358bbb791042b205370ec60ceaca38cfbc8faad7ad3a99893c9da99e65d2c783`（inputs 668 / validation 227 / build 459）。
