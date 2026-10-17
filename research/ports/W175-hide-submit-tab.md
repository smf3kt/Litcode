# W175 单题隐藏提交页（C-11 `hideSubmitTab`）

日期：2026-10-18。范围：恢复源码中 `hwe` 的 `hideSubmitTab` 派生、`Ab` 的提交页抑制与 `f3` 答案处理器的即时提交；产品按同一数据模型落地。无新增复制块。

## 来源身份

| 模块 | sha256 |
| --- | --- |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` |

| 名称 | 范围 | 正文 SHA-256 | 语义 |
| --- | --- | --- | --- |
| `qr` | `[1170529,1170566)` | `ed19eff3…` | `qr=je.length===1&&!je[0]?.multiSelect` |
| `Va` | `[1173330,1173350)` | `00b04b99…` | `let Va=je.length===1`，答案处理器随即 `!Gs&&Va&&fs` 直接调用最终提交 |
| `bl` | `[1174081,1174118)` | `003ae08d…` | `bl=qr?(je?.length||1)-1:je?.length||0`，下一 tab 界为 0 |
| `Ab` | `[1143017,1145502)` | W42 已记录 | `hideSubmitTab` 为真时无 Submit 标签与元素，`Mo=T.length===1&&he` 抑制箭头 |
| `hwe` | `[1168121,1177646)` | W42 已记录 | `Dr?f3:zr?b3:null`；单题非多选时 `zr` 不可达，回看页不出现 |

## 行为

- 单题且 `multiSelect` 为假时，`qr` 为真：提交 tab 隐藏；下一 tab 界 `bl=0`，Right 不进入回看页。
- 答案处理器在 `!Gs`（答案不是数组，即非多选）且 `Va`（仅一题）时，立即以 `{...答案, [key]: value}` 调用最终提交，不再走逐步推进。
- 多选单题与多题流程保持原步骤/回看行为。

## 宿主适配

- 产品问答流以 `groups` 数据建模（W42）。规则由数据直接派生：`groups.length===1 && !group.multiple` 等价 `qr`；`advanceDialog` 记录答案后按 `dialog.finish({selected:[],groups:[answer]})` 立即结算，结算形状与回看页提交一致。
- `handleReviewAction` 的 Right 分支对同一条件直接返回，等价 `bl=0` 时 `tabs:next` 不动作。
- 不新增 `TerminalPromptRequest.hideSubmitTab` 字段：来源由 `hwe` 从问题数组派生，而非请求参数。

## 测试

`test/tui.test.ts` 新增 1 例：单题按 Right 不进入回看，选择后立即结算且绘制中无 `Review your answers`。既有回看取消用例改为多选单题（`multiple:true`，空格选 A 后 Enter 进入回看再 Esc 取消），保持回看取消路径覆盖。

## 门禁与身份

聚焦 47/47；全量 2585/2585；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；身份 `304b061ed78f34e67027e01f5a02ff65ac128b15822155a8c22cf1f9bed3b8e2`（inputs 684 / validation 230 / build 470）。
