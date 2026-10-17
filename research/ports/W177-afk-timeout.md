# W177 问答对话框的 AFK 自动继续（C-11 afk timeout）

日期：2026-10-18。范围：恢复源码 `Zbe`、`ywe`、`hwe` 门控、`sl` 超时处理器与 `P3` 部分答案；接入产品分组问答对话框。无新增复制块。

## 来源身份

| 模块 | sha256 |
| --- | --- |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` |
| `chunk-4bw62nzm.js` | `1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713` |
| `chunk-14rnebpd.js` | `d1ba8228f324b01eb984c0a09eed1095d0bb0e6ace7c295b0c0fdb03a17be810` |
| `chunk-x0dc37w9.js` | `0b4db31ad035eb234d6943552606135e83405b719e32a114283cadad4e957d92` |
| `chunk-yvnhkg35.js` | `ce3689687897e987959f19ab07f98d79e5c925a8b15620dce02d29ba4943348d` |
| `chunk-phz47asr.js` | `3d37bfa1a457f1e45fa115ea9002376a2549517043763e9cdb0d29e09e8d967d` |

| 名称 | 范围 | 正文 SHA-256 | 语义 |
| --- | --- | --- | --- |
| `Zbe` | `[1163297,1163934)` | `549d445f220eeef1089eced0463f2620abb29960f1de4d009c675291670a6f20` | 超时/倒计时状态：环境覆盖、聚焦基线、每秒 tick、一次触发 |
| `ywe` | `[1177646,1178182)` | `1728bdf1a56ac5a89092753f5847efc2ff7f306e00afdd01705f62a7f298ca05` | 右对齐一行 `auto-continue in Ns · any key to stay`，仅 `showCountdown` 时渲染 |
| `Pi` 门控 | `[1174715,1174796)` | `5e565a660c3f2c28ce831894f4dd6e9c1fbe73a300febb643d0a775d6512c52d` | `!dr&&!hasExternalRacer&&!Nt()&&(we!==null||env!==void 0)` |
| `sl` | `[1175051,1175817)` | `bf73d369725cfa63e7bc27103981cea7a91eaf2ef67c23f67dcd5b41f89b7e2c` | 超时回调：单次守卫、`P3` 结算、`afk_timeout` 记录 |
| `P3` | `[1178668,1179279)` | `b5f21dd71a361d78ca0945199dac63c16fd7d51b29955a85aab43fe2405f6ffa` | `answersToSubmit` 原样作为 `answers`，只含已作答条目 |
| `XZe` | `[1165013,1165119)` | `bf05ceab7c3a438ca066341c304263d9db462814f83535a92077e8831697d081` | 设置值到毫秒：`60s|5m|10m`，`never`/`undefined` 为 `null` |
| `qco=V8e,$co=20000` | `[1163279,1163296)` | `92a5c7de512c18ccd6f43cd567762e8d90f6430cf416902a8869b494431ef48b` | 默认 60000 ms、倒计时窗口 20000 ms |
| `var V8e=60000;` | chunk-4bw `[85608,85622)` | `de9954933fc985a709cbc6f2f45e292a3d5208427ad1982bdd2898bec9ccda46` | 默认超时值 |
| `Kdt` | chunk-x0 `[109538,109592)` | `c7d60d6222ddf7f8d4499fee3594394c13d44f3488ed4710954edc0e5ba358c4` | `askUserQuestionTimeout` 设置读取 |
| `efo` | chunk-14 `[216274,216316)` | `cc097c60fbed62e1d32fb148315bcea6dd6ed486e6de490bd365450db957d477` | `{"60s":60000,"5m":300000,"10m":600000}` |
| `d` | chunk-phz `[1169,1474)` | `3b97a010897e9dcd9e61e618b76ee99d3e3bd3098aedf823b3f6e57f3f1f10e5` | `M.int()` 解析：非有限值视为未设置 |

## 行为

- 启用：源码仅在宿主超时非 `null` 或 `CLAUDE_AFK_TIMEOUT_MS` 存在时启动；`null` 且无环境值为关闭。环境值优先于宿主值；`CLAUDE_AFK_COUNTDOWN_MS` 默认 20000 并与超时取较小值。
- 计时：`elapsed = now - max(lastInteraction, base)`；每个 1 秒 tick，终端聚焦（`GPe()===true`）时 `base=now`，失焦或未知（源 `GPe()` 为 `undefined`）时继续累计。窗口内 `remaining=ceil((T-elapsed)/1000)`，窗口外保持 `ceil(T/1000)`；`remaining*1000<=countdown` 时显示倒计时。
- 触发：`elapsed>=T` 时一次性触发，只有已作答的分组条目进入答案（源 `answersToSubmit` 原样传递）；未作答题目由产品宿主按既有约定补成空答案。
- 交互：任意按键刷新 `lastInteraction`，下一 tick 回到完整超时；源码异步构建后的“触发后是否又被交互/聚焦”检查在本同步宿主中退化为清理计时器。
- 显示：文本与来源逐字一致，作为问题正文之后的独立一行；源码为 inactive/dim，产品帧行不含逐行样式。

## 宿主适配

- `TerminalPromptRequest` 新增宿主字段 `afkTimeoutMs?: number|null`；模型输入同名键仍按 `host_field` 拒绝，与来源“宿主属性而非工具参数”一致。
- 产品没有 `askUserQuestionTimeout` 设置界面，本包只接环境变量与宿主字段；`Kdt`/`efo` 的 60s/5m/10m/never 映射未移植。
- 来源的 `isScreenReader`（`dr=nt()`）与 `hasExternalRacer` 在本运行时不存在，按假处理（W129/W174/W176 同一约定）。
- 倒计时显示时占用一行动画内容（`rows-4-afkRows`），光标行相应上移一行；窄屏不再截断左侧提示。
- 计时器在 `prompt` 建立分组对话框时启动，`finish`/`close` 清理；仅分组问答启用，主题选择与单题非分组请求不启用。

## 测试

`test/tui.test.ts` 新增 3 例：

1. 设置门控与环境覆盖：未设置关闭、`null` 关闭、环境启用、非法环境值忽略、倒计时窗口钳制、边界 39999/40000/60000 ms。
2. mock timer 下失焦 40 秒显示 `auto-continue in 20s · any key to stay`；按键后下一 tick 隐藏；再次失焦并满 60 秒后以已作答的 `First` 部分答案结算。
3. 聚焦状态下 120 秒不触发、不显示；失焦 60 秒后以空分组结算。

## 门禁与身份

聚焦：`test/tui.test.ts` 50/50；`test/interaction-tools.test.ts` 33/33。全量 2589/2589。`npx tsc --noEmit`、`npm run build`、`npm run notices` 均 exit 0。身份 `10311b2b972d2ad8a9eaee68b9b78f1d82c39fa044b38ee1d0069e6fe7e0ed86`（inputs 685 / validation 230 / build 471）。

## 剩余

- `askUserQuestionTimeout` 的本地设置界面与 60s/5m/10m/never 预设未移植。
- 屏幕阅读器与 external racer 门控在本运行时无对应状态。
- 题目级 notes 由 [W178](W178-question-notes.md) 移植；chat-about-design、external-editor/image-paste 与完整 React 渲染器仍属 W43 剩余项。
