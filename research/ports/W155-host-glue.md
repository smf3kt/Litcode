# W155 AbovePrompt 宿主胶水（C-2 第十一片）

日期：2026-10-18。范围：W151 切分的宿主胶水片——`QY`/`Mmt` 上下文 token、`sa` 活动浮层注册、`us` 键位显示文本，以及它们依赖的两个宿主绑定 `F`（帧失效）与 `vot`（回退事件）。

## 来源身份

| 项 | 值 |
| --- | --- |
| 模块 | `chunk-ejnyhzsc.js`、`chunk-pxjy4t8j.js`、`chunk-t8vb436n.js` |
| 块 / 单位 | 3 块 / 798 UTF-16 单位 |
| 坐标 | 零基 UTF-16 半开区间 |

| 名称 | 范围 | 单位 | 语义 |
| --- | --- | --- | --- |
| `QY`/`Mmt` | ejnyhzsc `[668,697)` | 29 | 两个宿主 Context token：`QY` 读取窗格测量 getter，`Mmt` 读取 owed 行回调 |
| `sa` | pxjy4t8j `[1298,1856)` | 558 | 活动浮层：激活时把名字加入 AppState 的 `activeOverlays`，卸载/停用时移除；激活效应返回 `F` 作为清理，帧失效在清理时发生（源正文如此） |
| `us` | t8vb436n `[764,975)` | 211 | 键位显示文本：服务存在时 `getDisplayText` 返回文本/`null`（空串）；缺失或未命中时返回 fallback，并在首次经 `vot` 上报原因（`action_not_found` / `no_context`） |

复用（未复制）：AppState 上下文 `sx`（`plugin-chain-app-state`，源 `chunk-7n39kxwj.js [768,810)`）、键位服务 `Lc`（press-button seam，源 `chunk-bwyexfny.js [3552,3579)`）。

## 宿主绑定（改写记录）

- `F`（`chunk-pxjy4t8j.js [774,842)` 68u）：源正文为 `function F(){return oi().get(process.stdout)?.invalidatePrevFrame()}`。产品的 `oi()` 映射表装的是终端选择读取器（`plugin-chain-markdown-host.ts`），不是渲染实例；渲染器的 `invalidate()` 在 `TuiRenderer` 上，插件链不可直达。故 `plugin-chain-above-prompt-host.ts` 提供 `bindPrevFrameInvalidator` 宿主绑定，未绑定时为源自身的“无实例”空操作。W156 接线时由终端宿主绑定到活动渲染器的 `invalidate`。
- `vot`（`chunk-6ccen3s8.js [39124,39237)` 113u）：源正文经分析派发器 `i("tengu_keybinding_fallback_used", …)` 上报，其 action/fallback 归一化链（`bn`/`hn`/`Ae`/`wn` 及已知动作集 `ZDe`）属于分析子系统，超出“只保留本地功能”的用户约束。故以 `recordKeybindingFallback` 经宿主 `featureUsed` 本地记录同名事件与原始字段；归一化链不移植，理由记录于此与证据 JSON。

## 测试

`test/plugin-chain-above-prompt-host-glue.test.ts`（5 项）：

- `useActiveOverlay` 激活时加入 `activeOverlays`、保留其余状态、卸载时移除；`F` 按源语义在清理时触发；
- 未激活或无 AppState 时不写状态、不失效帧；
- `keyDisplayText` 返回服务文本，服务对无键动作返回 `null` 时返回空串；
- 无服务时返回 fallback 并本地记录 `tengu_keybinding_fallback_used`（`reason=no_context`，action/context/fallback 原样）；
- 服务未知动作时 reason 为 `action_not_found`。

## 门禁与身份

聚焦 5/5；全量 2374/2374；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；身份 `d83b46fdc7aebe173241db044cb8fea7ec1544a06dd4c7f53f5f617e851f9047`（inputs 592 / validation 209 / build 408）。审计件：`.audit/w155-probe.plan.json` 等。

## 下一片

W157（`_Fe`/`RFe` 滚轮加速、设置 schema、滚动派发）与 W156（`NFe` 本体接线，含 `QY` 提供者与渲染器失效绑定）。
