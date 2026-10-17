# W160 输入区工作流关键字开关（C-2）

日期：2026-10-18。范围：composer 的 alt+w 工作流关键字开关——捕获闭包 `jl`、输入订阅 `ul`（chunk-24k7d6mw.js，493 UTF-16 单位），以及可用性门 `dg`/`$uo` 与触发门 `C7t`（chunk-c5zwk83v.js，529 单位）。键入 `ultracode` 的高亮正文 `Art`/`Qp` 此前已逐字复制，本包只接通开关与其宿主链。

## 来源身份

| 项 | 值 |
| --- | --- |
| 模块 | `chunk-24k7d6mw.js` sha256 `1d064454…`；`chunk-c5zwk83v.js` sha256 `6959b4be…` |
| 坐标 | 零基 UTF-16 半开区间 |

| 名称 | 模块 | 范围 | 单位 | 正文 SHA-256 |
| --- | --- | --- | --- | --- |
| `jl`（alt+w 回调） | 24k7d6mw | `[827947,828285)` | 338 | `18aede5c…` |
| `ul`（输入订阅） | 24k7d6mw | `[822206,822361)` | 155 | `c985676a…` |
| `dg` | c5zwk83v | `[2239,2275)` | 36 | `7941a836…` |
| `$uo` | c5zwk83v | `[2275,2697)` | 422 | `8645cff9…` |
| `C7t` | c5zwk83v | `[2849,2920)` | 71 | `e4a47cc8…` |

## 行为

- 回调：`Art(value)` 为空直接返回；否则翻转该草稿的 `Zi`，设置时发 `tengu_workflow_keyword_dismissed` 并以键 `workflow-keyword-ignored`、`priority:"immediate"`、`timeoutMs:5000` 显示 `Ultracode keyword ignored for this prompt · alt+w to undo`；取消时发 `tengu_workflow_keyword_restored` 并按键移除通知。
- 订阅：记录当前 value，值变化时若 `Zi` 为真且 `Art(value)` 为空，则清 `Zi` 并移除 `workflow-keyword-ignored`。
- 门：`dg()` 即 `$uo()` 无不可用原因；`$uo` 依次检查托管设置、组织策略、计划可用性、`CLAUDE_CODE_DISABLE_WORKFLOWS` 与 `enableWorkflows`。高亮侧门为 `dg() && C7t() && !Zi`；`C7t()` 为 `settings.workflowKeywordTriggerEnabled ?? true`。
- 绑定：`us("chat:workflowKeywordToggle","Chat","alt+w")`；回调挂在 Chat 上下文。

## 复用与改写记录

- **复用**：`Art`/`Qp`/`IE`（chunk-n3ykh62m.js `[453609,454576)`，既有逐字副本）与 `composerHighlights` 的 `workflowKeyword` 门；切换只翻转已有门，不改高亮正文。
- **改写（已记录）**：`dg()`/`$uo()` 的托管设置、组织策略、计划可用性与布尔同一性 `CLAUDE_CODE_WORKFLOWS` 检查在本运行时没有对应面（环境变量为字符串），`workflowsAvailable()` 保留非空 `CLAUDE_CODE_DISABLE_WORKFLOWS` 禁用与 `enableWorkflows` 默认开启。
- **改写（已记录）**：来源的按键通知队列同时有 `workflow-keyword-active`（30 秒）与 `workflow-keyword-ignored`（5 秒）。本终端只有一行状态行，且关键字高亮已表达 active 状态，故只显示 dismissal 通知，文案与 5000ms 超时按来源。
- **改写（已记录）**：来源把 `us(...)` 解析出的按键标签插入通知；本产品 TUI 绑定表固定，使用来源 fallback 文案 `alt+w`。

## 接线

`workflowKeywordTriggerEnabled`/`enableWorkflows` 严格布尔 schema → `parseSettings` → `config` 合并 → 会话配置 → `bindConfigWatch`/reload → `TerminalSurface.setWorkflowKeywordSettings`。TUI 在 `chat:workflowKeywordToggle` 上翻转 per-draft dismissal，5000ms 计时器清理，关闭时清除；`inputLayout` 把门结果传给 `composerHighlights`。

## 测试

`test/tui.test.ts` 新增 2 例：alt+w 在无关键字时不动作、有关键字时显示通知、再按恢复、删除关键字后自动恢复门；两个门分别关闭时不动作。`test/input-decorations.test.ts` 新增 1 例覆盖 `workflowsAvailable` 的默认、显式关闭与开关。`test/runtime.test.ts` 覆盖两个设置的解析、缺省与严格类型错误。

## 门禁与身份

聚焦 82/82；全量 2450/2450；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；身份 `b2c11915fe65b7a60b1614a7227cfdf2ff4869a28ff37cde988312d84e215d96`（inputs 616 / validation 216 / build 425）。
