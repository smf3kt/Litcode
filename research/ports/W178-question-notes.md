# W178 问答预览题的 notes 输入与答案注释（C-11 notes）

日期：2026-10-18。范围：恢复源码 `a3` 的 notes 输入、`P3` 的 notes 注释与 `cBt` 仅注释答案标记；接入产品分组问答对话框。无新增复制块。

## 来源身份

| 模块 | sha256 |
| --- | --- |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` |
| `chunk-ktr9sak2.js` | `485ac7186fe7255d928c3985b94b2e97d5f12674f228026e9f68e1f9deb67755` |

| 名称 | 范围 | 正文 SHA-256 | 语义 |
| --- | --- | --- | --- |
| `a3` | `[1145502,1153542)` | `e5fe50b93b7228735d17e40b4712f14759a99ca6366a3ae30800282aff5e45cf` | 单选预览题组件：选项列、预览框、notes 行与键位 |
| `zet` | `[1180104,1180182)` | `1666681dad47d5d944d49736413ca84ffb20d3c1303825e9ffd05566c092d01c` | `!multiSelect && options.some(preview!==void 0)` |
| notes 键 | `[1148697,1148729)` | `a848825df265fe654fb7fa9a946fbcc6d39416e8ba1d57a54193f38e553052b4` | 普通 `n`（无 ctrl/meta）打开 notes 输入 |
| notes 提交 | `[1147686,1147789)` | `e817fb3274bd66c69a03893570adca13dbcf8df60cd15b88dc97da5210a445a2` | `if(Bo.trim()&&ko)kn(go);else if(On)He(co,On);else if(Bo.trim())He(co,cBt)` |
| notes 渲染 | `[1150986,1151296)` | `cf1eb83ec77d0b52606d94e5696b68e985bbf57daa8060585bdced3d8ac9ffb6` | `Add notes on this design…` 输入；否则 dim/italic `press n to add notes` |
| `P3` notes 读取 | `[1178828,1178853)` | `39a69a638e28911794e6e7c9d8675321b415b9b41a713fb6c2d08eb193a723fc` | `L[Me.key]?.textInputValue`，仅 `zet` 题目 |
| `P3` notes 写入 | `[1179032,1179061)` | `883fb939efbc13e74d9c69f488590eb11145c88bdd9cdd13751cb0e1fc40e8cf` | trim 后写入 `annotations[key].notes` |
| `cBt` | chunk-ktr9sak2 `[12444,12467)` | `339118a9bca6bdc56d90447936c5b74d2c19a546b41f1eb91b55deae16fa4e66` | `"(notes only)"` |
| 题目状态 | `[1162199,1162240)` | `7f78b34668163d483c7d80e6fa7add28d06afd975746d9cdcd933dca0b966758` | `textInputValue` 与答案分开保存 |

## 行为

- notes 只出现在单选且题目任一选项带 preview 的题目（`zet`），多选或无 preview 题目没有 notes 行。
- 选项列表上按 `n` 进入 notes 输入；编辑时 Esc 退出并保留文本，Enter 保存并尝试取答案。
- Enter 的取答案顺序与来源一致：本步移动过选项焦点则取当前选项；否则取该题已存的答案；否则仅有 notes 时以 `"(notes only)"` 作为答案；三者皆无则只退出输入。
- notes 文本按题保存，切题/回看后保留；取选项答案时 notes 一并进入该题答案。
- 注释构造：`zet` 题目下，所选选项带完整 preview 时附 `annotations.preview`；notes 非空时附 trim 后的 `annotations.notes`；二者可同时存在，仅有 notes 也可生成注释。
- 屏幕阅读器抑制在本运行时无对应状态，按假处理（与 W129/W174/W176 同一约定）。

## 宿主适配

- notes 输入复用对话框底部答案行显示（来源在题目正文内联）；正文仍渲染 `Notes:` 行与 `press n to add notes`/文本。
- 产品在“Other”行聚焦时把 `n` 当普通字符输入；来源的单选预览组件没有 Other 行，notes 键只在选项焦点上生效。
- 仅有 notes 时产品以 `other: "(notes only)"` 承载来源答案字符串，因为宿主答案准入要求单选恰好一个选择（选项或 Other）。
- notes 上限 8192 字符，对齐恢复的 `J` 注释上限；来源输入组件本身未在此路径设硬上限。
- 回看页不显示 notes，与来源回看组件一致；clarify 反馈中的 `User notes:` 文本未接入。

## 测试

- `test/interaction-tools.test.ts` 新增 1 例：notes 与 preview 的门控、trim、空 notes、多选/无 preview 拒绝，以及带 `{preview,notes}` 注释的工具往返。
- `test/tui.test.ts` 新增 2 例：仅 notes 的单题以 `(notes only)` 立即结算；两题流程中 notes 在 Esc 后保留、取选项时随答案进入回看，且多选题目没有 notes 行。

## 门禁与身份

聚焦 tui + interaction-tools 86/86；全量 2592/2592。`npx tsc --noEmit`、`npm run build`、`npm run notices` 均 exit 0。身份 `e9c3612a…`（inputs 685 / validation 230 / build 471）。

## 剩余

- clarify 反馈（`Qet`/`nmo` 的 `User notes:`）与“chat about this design”入口已由 [W179](W179-question-clarification.md) 接通。
- external-editor/image-paste 与完整 React 渲染器仍属 W43 剩余项。
