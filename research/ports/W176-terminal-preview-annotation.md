# W176 终端答案的单选预览注释（C-11 preview gating）

日期：2026-10-18。范围：恢复源码 `zet` 与 `P3` 的答案注释构造，接入产品终端问答回调；无新增复制块。

## 来源身份

| 模块 | sha256 |
| --- | --- |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` |

| 名称 | 范围 | 语义 |
| --- | --- | --- |
| `zet` | `[1180104,1180182)` | `!h.multiSelect && h.options.some(T=>T.preview!==void 0)` |
| `P3` | `[1178668,1179279)` | 逐题构造答案与 `annotations`；`He=!h.isScreenReader&&zet(Me)` [1178792)、选中项 `preview.kind==="full"` 取其 markdown [1178922)、仅在有 preview 或 notes 时写入 [1178979) |
| `ywe`/`Zbe` | `[1177646,1178182)` / `[1163297,1163934)` | AFK 倒计时组件，本包未接入 |

## 行为

- 只有单选（`multiSelect` 为假）且该题任一选项带 preview 时，答案才可携带预览注释。
- 注释取所选选项自身的完整 preview；选中无 preview 的选项、多选、或题目没有任何 preview 时不产生注释。
- 源码在屏幕阅读器模式下抑制注释；本运行时无屏幕阅读器状态，按假处理（与 W129/W174 同一宿主约定）。

## 宿主适配

- 产品终端问答回调在 `src/interactive.ts` 的两条路径（分组多题与逐题）都调用 `terminalAnswerAnnotation`，把结果放入答案的 `annotations.preview`；`validAnswer` 既有的准入检查要求 preview 必须精确等于该题展示过的 preview。
- `P3` 的 `notes` 来自题目级 `textInputValue`；产品对话框没有独立的 notes 输入，`other` 文本是答案而非注释，故本包只接 preview；题目级 notes 后由 [W178](W178-question-notes.md) 移植。
- AFK 超时（`ywe`/`Zbe`/`P3` 的 `afkTimeoutMs`）不属于本包。

## 测试

`test/interaction-tools.test.ts` 新增 1 例：单选带 preview 且选中该选项时得 `{preview}`；选中无 preview 选项、多选、题目无 preview 时为 `undefined`；带该注释的答案经 `ask_user_question` 往返保持原样。

## 门禁与身份

聚焦 80/80（interaction-tools + tui）；全量 2586/2586；`tsc --noEmit`、`npm run build`、`npm run notices` 均 exit 0；身份 `04faee71547d8bbe7b87eb80a4a7e47a6cf1558ec82ee3b3504137b0bab55bef`（inputs 684 / validation 230 / build 470）。
