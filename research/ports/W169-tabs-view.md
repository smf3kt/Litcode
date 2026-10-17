# W169 对话框页签条（C-2 diff 第九片）

日期：2026-10-18。范围：DiffDialog 的页签条——页签上下文、标题/页签行、当前页签加粗反色、选中页签内容，外加滚动词盒 `OT` 与它发布给调用方的命令句柄；同时补齐焦点读取、视口上下文、滚动提交/裁剪与迟滞点击判定。复制 **20 块 11,747 UTF-16 单位**。前置：[W168](W168-detail-view.md)。

## 来源身份

| 模块 | sha256 |
| --- | --- |
| `chunk-3dnyxzpb.js` | `edad32e3e3c52e48115ffcd78457c8bd5b74de1fe220e32065ad21c474a29da4` |
| `chunk-6j27z6m4.js` | `37bdceea8915ebd9bf3bca43c31d259d637d89bcdcac9086ccb6d91e5eaa6aef` |
| `chunk-06azbynj.js` | `5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd` |
| `chunk-1r9zp6s1.js` | `444d1adce233caec24f15e8203bd02c9ae6313df62af94ff0c81ea669458936e` |
| `chunk-3c5vzz43.js` | `347697a0ed5b1cac607d2b1f64804c5dbd13087c6d6742a53237ab21947ca54c` |
| `chunk-70nf72b4.js` | `fcace513f43a275080517d548c036c517b26349b41bf31c17d26c92361bbdaac` |
| `chunk-6x3scwgf.js` | `db830997e9e573f4e51e1bc73ab09b1f550928c0078ce2803e609951b593cac6` |

| 名称 | 范围 | 单位 | 正文 SHA-256 | 语义 |
| --- | --- | --- | --- | --- |
| `sS` 闭包 | `chunk-3dnyxzpb.js [1324,6447)` | 5,123 | `74aa4bdf…` | 上下文 `g`、键/宽度助手与页签条本体 |
| `je` | `[6447,7321)` | 874 | `82e47ce7…` | 单个页签头：当前项反色加粗，悬停时换加边标签 |
| `Na` | `[7321,7586)` | 265 | `d22a89e5…` | 仅选中页签渲染内容 |
| `te` | `[7909,8083)` | 174 | `81802c97…` | 计数是否为正，及增减对 |
| `VS/nl/ns/Ffe/KXe` | `chunk-6j27z6m4.js [717,1009)` | 292 | `70709c50…` | 视口上下文与滚动视口/词盒读取 |
| `IU` | `chunk-06azbynj.js [135432,135508)` | 76 | `557e05a2…` | 节点包含判定 |
| `nLr` | `[173441,173541)` | 100 | `6cda8ce8…` | 在根节点上标记滚动提交起点 |
| `vie` | `[174030,174177)` | 147 | `01e87dfd…` | 把滚动偏移夹到内容高度 |
| `S4n` | `[224832,224857)` | 25 | `1c12874e…` | 光标位置上下文 |
| `Zw` | `chunk-1r9zp6s1.js [19906,20151)` | 245 | `bee121e0…` | 把聚焦节点的光标位置报给悬停上下文 |
| `Ze` / `Lo` | `[23676,23694)` / `[24066,24084)` | 18 / 18 | `678ad829…` / `7ff56b30…` | 空订阅 |
| `_Ee` | `[23694,24062)` | 368 | `98cfe945…` | 读焦点管理器、活动元素与方向移动 |
| `eX` | `[24084,24236)` | 152 | `5122a3df…` | 活动元素是否位于给定 ref 内 |
| `Ys`/`zo` | `[28445,28549)` | 104 | `bd77aed1…` | 节点计算宽高 |
| `Xw` | `chunk-3c5vzz43.js [753,1088)` | 335 | `b4315237…` | 带边距的反色标签 |
| `l` | `chunk-70nf72b4.js [903,957)` | 54 | `fe9ccc95…` | 窗口激活或落在挂载迟滞窗口内 |
| `aS` | `[957,1312)` | 355 | `b547211e…` | 迟滞点击判定与丢弃上报 |
| `c` | `[1391,1422)` | 31 | `dc2f497e…` | `now-mount < vje`（`vje=300`） |
| `Se/K/OT` | `chunk-6x3scwgf.js [965,3956)` | 2,991 | `2f352499…` | 滚动词盒与命令句柄 |

## 行为

- `sS`：页签键为 `props.id ?? props.title`，标签为 `props.title`。受控 `selectedTab` 优先，未知键回退首项；否则 `defaultTab` 定位，仍无则 0。宽度取 `ke().columns`，`useFullWidth` 时内容宽为整列，否则由标题加各页签宽度占用后在行尾补空格。
- 头部行仅在未 `hidden` 时渲染：标题（加粗、取 `color`）、逐页签 `je`、补白；行带 `tabIndex`、`autoFocus`（首帧后清空 ref）、聚焦/失焦切换 `headerFocused`，左右/`tab` 键循环切换并在 `navFromContent` 时把上下键交给内容区。`tabs:next`/`tabs:previous` 经 `nn` 注册，只有在页签带、未 `hidden`、未禁用导航、且没有其它优化订阅者时才激活。
- 视口：读取 `Ae(VS)`、`Ffe()`、`KXe()`；头部实测高度 `Te`（至少 1）与 banner 高度 `xe` 相加得内容起始行 `ie`；`M(ie)` 认领词盒，卸载时 `M(null)`。视口已挂接（`O?.attach`）时内容区放进 `OT`，高度 `rows-ie`，`stableHeight` 决定 `height` 还是 `maxHeight`；未挂接时是普通列，按 `contentHeight` 设置高度或隐藏溢出。
- 上下文 `g.Provider` 提供 `{selectedTab,width,headerFocused,focusHeader,blurHeader,registerOptIn,registerNavigationOwner}`。
- `je`：点击先过 `aS()`；`isCurrent && headerFocused` 时把 `{line:0,column:1,active}` 交给 `Zw` 报告光标。只有 颜色 + 当前 + 聚焦 + `ge.level!==0` 时改用 `Xw` 的加边反色标签，否则普通文本 `inverse/bold=isCurrent`、`underline=悬停且有点击`。
- `Na`：`selectedTab !== (id ?? title)` 时返回 null；否则按上下文宽度渲染，视口存在时 `flexShrink 0`。
- `te`：状态从 0 起，返回 `[d>0, 增减对]`；两个计数器分别用于导航归属与禁用判定。
- `aS`：挂载时取时钟，返回判定器；`isWindowActivation` 或 `now-mount<300` 时按原因上报、`dropAsStray()` 并返回 true。
- `OT`（`Se`/`K`）：发布句柄 `scrollTo`/`scrollToElement`/`scrollBy`/`scrollToBottom`/`getScrollTop`/`getPendingDelta`/`getScrollHeight`/`getFreshScrollHeight`/`getViewportHeight`/`getViewportTop`/`isSticky`/`subscribe`/`setClampBounds`/`getDomElement`；提交回调经 `Qxr` 记滚动活动、`tI` 标脏、`nLr` 打时间戳，并用微任务合并 `ZFt` 重绘。渲染为 `ink-box`（`overflowX/Y: scroll`）包一列。

## 复用与改写记录

- **复用**：`Xe`/`s`/`n`/`w`/`b`/`y`/`R`/`Rt`/`Ae`/`en`/`Z`/`hh`/`le`/`qt`/`tI`/`ZFt`（React 缝）、`Zy`（焦点上下文）、`ke`（终端列数）、`ae`（文本宽度）、`ld`（列容器）、`ge`（颜色级别）、`on`/`vje`（时钟与 300ms 迟滞常量）、`nn`（键位注册）、`t`（本地日志）。
- **React 缝**：新增 `useImperativeHandle`（chunk-kexg5hxg.js `p.H.useImperativeHandle`）；依赖变化时重发句柄，卸载时对象 ref 置 `null`、函数 ref 以 `null` 回调。提交节点的 `yogaNode` 补 `getComputedWidth`/`getComputedHeight`，无布局时为 0。
- **宿主适配（已记录）**：
  - `Qxr`（chunk-4bw62nzm.js sha256 `1a878867…`，[85882,85935) 53u，正文 `dffbcd71…`）标记账号在线状态的滚动活动；产品只保留本地功能，`markScrollActivity` 为空操作。
  - `S`（chunk-76anb6yt.js sha256 `ff777b38…`，[638,664) 26u，正文 `65a65776…`）映射丢弃原因；只有被丢弃的事件记录读取它，`analyticsReason` 原样返回。
  - `i`（chunk-4nygtnjw.js sha256 `c89ccc5e…`，[1290,1407) 117u，正文 `7f2df95e…`）是产品不保留的事件汇，`analyticsEvent` 为空操作。
- **仍缺**：`Mr`（旋转指示器动画子系统）、对话框框架 `_e`、列表 `Tl`/`Cn`/`Po`/`Bo`/`rx`、以及 `si` 接线的 `PMr`/`Ffe`。

## 测试

`test/diff-dialog-tabs.test.ts` 11 例：键/宽度/前进后退助手；标题与逐子项页签头、首项选中；受控选中优先且未知键回退；`hidden` 省略标题与页签行但保留内容；banner 位于内容区上方；内容仅在自己的页签下渲染并取上下文宽度；当前页签反色加粗、焦点悬停时输出加边标签；词盒以滚动 ink-box 渲染并向 ref 发布句柄、卸载清空 ref；计数从零开始；迟滞判定在挂载窗口内丢弃、窗口外放行、窗口激活恒丢弃。

## 门禁与身份

聚焦 11/11；全量 2532/2532；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；未声明扫描 declared 189 / unresolved 0；身份 `f12ed8ca097ae109b602b7f7b4aadb79a585d9d87108a1a1b196f88dfddff84d`（inputs 648 / validation 225 / build 447）。
