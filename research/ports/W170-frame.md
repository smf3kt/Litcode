# W170 对话框框架（C-2 diff 第十片）

日期：2026-10-18。范围：DiffDialog 的框架——标题/副标题头、取消与中断条目、标题高度测量与视口内缩、输入引导、边框与焦点作用域；外加自动键位提示的选取与格式化。复制 **10 块 11,875 UTF-16 单位**。前置：[W169](W169-tabs-view.md)。

## 来源身份

| 模块 | sha256 |
| --- | --- |
| `chunk-g6j4g5k0.js` | `84c0b6e10b5697bb4ad3df6a1502ecddcd1911b4de5387cd206b4b1f4dc20251` |
| `chunk-6ccen3s8.js` | `4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d` |
| `chunk-apky5tj5.js` | `8906093e5cfd33a801f05ec4d4410ac56b6ba5195131d9759e7103e23e8d6e6a` |
| `chunk-06azbynj.js` | `5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd` |
| `chunk-9pedrxny.js` | `fcabe4b83433a1de48b7eead9aff55c63c79666e930152fa81a7a6c19722aeb0` |
| `chunk-am9mebpw.js` | `5f299ffd418fdb1dc31123d44ad13270aa6fcbb68e0686709982292c7a1e3f14` |
| `chunk-h26phfc2.js` | `1b48814a9bfc2f0af73eeae96ec1ab540ad25e51c0f042beef0255089e86d4fd` |
| `chunk-1r9zp6s1.js` | `444d1adce233caec24f15e8203bd02c9ae6313df62af94ff0c81ea669458936e` |

| 名称 | 范围 | 单位 | 正文 SHA-256 | 语义 |
| --- | --- | --- | --- | --- |
| `Ke/fe/Oe/ie/Be/me/W` | `chunk-g6j4g5k0.js [1411,6669)` | 5,258 | `e339f5a5…` | 动作描述表、提示组件与构建器、默认取消提示 |
| `_e` | `[6669,9123)` | 2,454 | `a864ccdf…` | 对话框框架本体 |
| `Ys/zo` | `chunk-1r9zp6s1.js [28445,28549)` | 104 | `bd77aed1…` | 节点计算宽高 |
| `Boo/e0n/yn` | `chunk-6ccen3s8.js [35388,35924)` | 536 | `1e435e31…` | 动作和弦列举、最佳和弦选取、命名键排序 |
| `bdn/ov` | `chunk-apky5tj5.js [935,2776)` | 1,841 | `fc763f72…` | 作用域链上下文与焦点作用域 |
| `IU` | `chunk-06azbynj.js [135432,135508)` | 76 | `557e05a2…` | 节点包含判定 |
| `eun/ix` | `[135508,135682)` | 174 | `726b6c6b…` | 向上找携带焦点管理器的节点 |
| `Dmt/c` | `chunk-9pedrxny.js [1035,1612)` | 577 | `7b508663…` | 中断/退出条目与待定状态 |
| `iq` | `chunk-am9mebpw.js [1553,1918)` | 365 | `5e7676ce…` | 800ms 两按手势 |
| `Jw/QP/xG/es` | `chunk-h26phfc2.js [849,1339)` | 490 | `52ca5b5c…` | 边框与内边距 |

## 行为

- `_e`：标题加粗取对话框色（默认 `permission`），`titleEnd` 存在时改为 `space-between` 行、尾段 `truncate-start`；副标题暗色。头部高度初值副标题存在为 2，否则 1，提交后用标题列实测高度替换。视口内缩为 `头部高度 + 1 + (隐藏引导 ? 0 : 2)`；读取 `VS` 后把 `rows` 减去内缩，作为新的视口值向下传。
- 取消条目：`isCancelActive` 时注入 `{action:"confirm:no",run:onCancel,hint:"cancel"}`；`Dmt` 追加 `app:interrupt`/`app:exit`，两按手势在 800ms 内确认；`onCancel` 返回真值时中断手势不启动。引导区：显式 `inputGuide` 函数收到 `{pending,keyName}`；待定时显示 `Press <键名> again to exit|cancel`；无引导且取消未激活时显示静态取消提示，激活时交给 `ie` 自动提示。
- 边框 `es`：无视口时输出分隔线 + 左右各 2 内边距的列（外层上边距 1）；有视口时只输出左右各 1 内边距的列。
- `ie`：订阅焦点管理器与作用域变化，`Be` 沿边界节点或已渲染作用域链收集条目，`e0n` 在各上下文绑定中选最佳和弦（已绑定优先，其次可打印键，再次最长），`Ace(w1)` 给出动作行，`JD` 格式化动作文本，按 `order` 排序并以 ` · ` 连接；无条目返回 fallback，条目超限时显示 `+N more`。
- `ov`：把 `{scope,active,preemptive,swallowAll,entriesRef}` 注册进 `keyHandlerRegistry.decls`，用 `_` 序列化处理器依赖，`claimFocus` 时通过 `ix` 取得焦点管理器并在无焦点时把焦点移入自身，同时向 `bdn` 链追加自身条目供自动提示读取。

## 复用与改写记录

- **复用**：React 缝（`w`/`b`/`y`/`P`/`en`/`Z`/`R`/`Ae`/`le`/`s`/`n`/`Xe`/`qt`）、`VS`/`nl`（页签视口）、`Ol`（分隔线）、`Lc`/`Zy`/`u`（键位服务与应用上下文）、`Ace`/`w1`/`E1`/`pt`/`Se`/`Ke`/`V`（键位行与提示）、`JD`/`z`（和弦格式）、`ae`（文本宽度）、`ld`（列容器）、`on`/`eE`（时钟）、`us`（键位显示文本）。
- **React 缝新增**：`useId`（`cZr`，槽位稳定标识）与 `To`（`useEffectEvent`，始终调用最新渲染回调的稳定函数）。
- **宿主适配（已记录）**：
  - `g`/`f`（chunk-2hb5361r.js `fd75ff86…`，[5466,5529) 63u 正文 `7320b43f…`；[5613,5697) 84u 正文 `ecce759d…`）为 feature_ok/feature_sad 遥测；本地不保留遥测，`noteFeatureOk`/`noteFeatureSad` 为空操作。
  - `_`（chunk-gyf58rwf.js `7a6a0173…`，[59764,59848) 84u，正文 `a18934a7…`）是 Bun `ih` 模板 JSON 序列化，`stableKey` 保留 `JSON.stringify` 可观察契约。
  - `ik`（chunk-nhnx1tam.js `eee1529d…`，[661,728) 67u，正文 `1597bf97…`）读布尔环境变量，`keyboardCohesion` 同样解析该变量。
  - `bC`（chunk-1r9zp6s1.js `444d1adc…`，[23358,23383) 25u，正文 `cec7fe1c…`）是 `Ae(Zy)`；`focusExit` 读取同一上下文。
  - `Xa`（chunk-1r9zp6s1.js `444d1adc…`，[24240,24273) 33u，正文 `f2dee87c…`）返回时钟函数（`Ae(b4n) ?? Date.now`）；`now` 返回挂载的 `eE` 时钟函数，缺省回退 `Date.now`。
- **仍缺**：`Mr`（旋转指示器：`ui` + `ia`/`N4`/`HIe`/`bg`/`Wo`）、列表 `Tl`/`Cn`/`Po`/`Bo`/`rx`、以及 `si` 接线的 `PMr`/`Ht`/`Ffe`。

## 测试

`test/diff-dialog-frame.test.ts` 13 例：动作描述表与 `command:` 解析；框架标题/副标题/子项与默认色；`titleEnd` 的 space-between 与 `truncate-start`；`hideBorder` 跳过边框；边框在无视口时有分隔线与 2 格内边距、有视口时只保留 1 格内边距列；显式引导收到退出状态并替换提示；默认静态提示与 `ie` 元素参数；`hideInputGuide` 省略引导行；退出条目名称与 800ms 内二次按键确认；窗口过期不确认且取消未激活时无条目；空上下文提示构建回退；自动提示返回 fallback；复制体可寻址。

## 门禁与身份

聚焦 13/13；全量 2545/2545；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；未声明扫描 86/18/52/30/18，均 unresolved 0；身份 `45d303f4ca0deb760e2764d833a4ef3e34c9acb80fdde101036c02f3ef4e8fb7`（inputs 660 / validation 226 / build 454）。
