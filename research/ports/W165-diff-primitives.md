# W165 diff 对话框最小原语 + 闭包测量（C-2 diff 第五片）

日期：2026-10-18。范围：DiffDialog 依赖闭包中的两个自足原语——复制 **2 块 505 UTF-16 单位**（`I` 41u、`Ib` 464u）；同时完成 `si` 组件闭包的实测与切片计划（30 个外部名仍待接线）。

## 来源身份

| 模块 | sha256 |
| --- | --- |
| `chunk-ax7r0qj7.js` | `8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e` |
| `chunk-a8pz28bf.js` | `f9c6096cc6bc2515885e7c00fbd8ee4d10a5844e4375ea0923205dd4bc3b1f58` |

| 名称 | 范围 | 单位 | 正文 SHA-256 | 语义 |
| --- | --- | --- | --- | --- |
| `I` | `[798,839)` | 41 | `49db02fc…` | `count===1 ? 单数 : 复数`，复数默认 `单数+"s"` |
| `Ib` | `[1139,1603)` | 464 | `f4cba635…` | `+added`/`-removed` 统计标签；双零返回 null；颜色 `diffAddedWord`/`diffRemovedWord` |

## 产品行为

- `pluralize(count, singular, plural?)`：直接调用复制体 `I`。
- `DiffStatLabel({added,removed,bold?})`：直接调用复制体 `Ib`；仅在两侧都非零时插入分隔空格；单侧为零时该侧为 false，由渲染层丢弃。
- 复制体通过 `plugin-chain-react-surface` 的 `Xe as r`、`w`、`n`、`b` 接线；扫描 unresolved 0。

## DiffDialog 闭包测量（`si`，chunk-twzxjzbk.js [22672,28980) 6,308u）

随包复制并扫描得到 **32 个外部名**；本包解决 `I`、`Ib`，剩余 30 个及源模块/范围：

| 依赖 | 模块 | 范围 | 单位 | 用途 |
| --- | --- | --- | --- | --- |
| `Ht` | chunk-qr9z1wer.js | `[1303,1342)` | 39 | 会话/远端判定（本地恒 false 语义可复用现有 seam） |
| `Ffe` | chunk-6j27z6m4.js | `[907,958)` | 51 | 滚动视口句柄 context |
| `fo` | chunk-x90vmw14.js | `[757,1166)` | 409 | 空态/提示文本 |
| `Se` | chunk-fz2251t0.js | `[998,1269)` | 271 | 键提示行 |
| `z` | chunk-0qkpwgr4.js | `[3890,4537)` | 647 | 键位片段 |
| `pt` | chunk-nh8hd3rr.js | `[800,1044)` | 244 | 键位动作提示 |
| `Mr` | chunk-vew7ssxx.js | `[2002,2510)` | 508 | 加载/空消息 |
| `_e` | chunk-g6j4g5k0.js | `[6669,9123)` | 2,454 | 对话框框架（标题/取消/输入引导） |
| `sS` | chunk-3dnyxzpb.js | `[1686,6447)` | 4,761 | 分页对话框容器 |
| `Na` | chunk-3dnyxzpb.js | `[7321,7586)` | 265 | 页签项 |
| `Tl` | chunk-0wtqg4zf.js | `[19333,19379)` | 46 | 列表组件（依赖 `Cn`/`Po`/`Bo`） |
| `rx` | chunk-0wtqg4zf.js | `[12657,12685)` | 28 | 选中态 context |
| `Uwe` | chunk-24k7d6mw.js | `[1657226,1657289)` | 63 | 路径单行格式化（依赖 `__e`/`pn`） |
| `pBe` | chunk-24k7d6mw.js | `[1657527,1661848)` | 4,321 | 文件 diff 明细渲染 |
| `pee` | chunk-24k7d6mw.js | `[131148,131363)` | 215 | 按页/整页滚动 |
| `PMr`/`ne`/`ri`/`Ie` | — | — | — | W163/W164 已交付的本地数据层 |
| `sa`/`nn`/`ZD` | — | — | — | 既有 overlay/keybinding/focus seam |
| `e r n s w b y P Z` | — | — | — | `plugin-chain-react-surface` 既有 hook 面 |

`si` 的纯逻辑（当前/回合来源列表、列表↔明细模式、选中文件夹取与 mount 递增、10 个按键动作、标题/空态文案）与渲染无法分离；按上表切片：

1. **W166 对话框小件**：`Mr` 508u + `fo` 409u + 键提示 `z` 647u/`pt` 244u/`Se` 271u。
2. **W167 列表**：`Tl` 及其 `Cn`/`Po`/`Bo` 依赖 + `rx`。
3. **W168 框架与页签**：`_e` 2,454u + `sS` 4,761u + `Na` 265u。
4. **W169 明细**：`pBe` 4,321u + `pee` 215u + `Uwe` 63u（含格式化依赖）。
5. **W170 接线**：`si` 6,308u + 本地 `PMr` 适配 + `Ht`/`Ffe` 宿主。

## 测试

`test/diff-dialog-primitives.test.ts` 5 例：复数 0/1/2 与自定义复数；双侧统计标签的文本/颜色/加粗与分隔空格；单侧标签丢弃空侧与分隔；双零返回 null；复制体按源名可调用。

## 门禁与身份

聚焦 5/5；全量 2494/2494；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；未声明扫描 declared 16 / unresolved 0；身份 `1686f83422646498a715517b807b5077fcdd56c771ccc131aec1c2bce43f6192`（inputs 631 / validation 221 / build 435）。
