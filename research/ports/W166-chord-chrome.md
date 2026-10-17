# W166 键位格式化与暗色提示（C-2 diff 第六片）

日期：2026-10-18。范围：diff 对话框小件中的键位格式化闭包与暗色提示文本——复制 **2 块 4,367 UTF-16 单位**（chunk-0qkpwgr4.js 3,958u + chunk-x90vmw14.js 409u），加宿主平台适配 `BF`。前置：[W165](W165-diff-primitives.md)。

## 来源身份

| 模块 | sha256 |
| --- | --- |
| `chunk-0qkpwgr4.js` | `470fcab1f965a43d7ec6a08213a15a49218e65d7e2cc8b4bef21d8c4622335a6` |
| `chunk-x90vmw14.js` | `2c126986038d8ecb93fd6b25b601b3455f481aaa9064ea3af815dfb1fc02ee6d` |

| 名称 | 范围 | 单位 | 正文 SHA-256 | 语义 |
| --- | --- | --- | --- | --- |
| `L`/`D`/`t4n`/表/`z`/`JD`/`v`/`P` | `[904,4862)` | 3,958 | `45fa533d…` | 样式默认与合并；和弦格式化；键/修饰键表；`z` 和弦提示；`JD` 动作文案；`v` 平台；`P` 分词入口 |
| `fo` | `[757,1166)` | 409 | `b53e996f…` | 暗色空文本，可选第二行提示 |

宿主适配（未复制）：`BF` chunk-6ccen3s8.js `[34816,34980)` 164u——`O()` 已移植，仅补 `LC_TERMINAL`/`TERM_PROGRAM` 三终端判为 macOS。

## 行为

- `t4n(chords, format)`：空返回 `""`；单和弦直接格式化；多和弦在所有键均为单键时可合并箭头/修饰；否则用 `/` 连接；`P` 先 `h9` 分词再套 `{...format, platform}`。
- 样式：`default`（title/lower/`+`/`/`/空格）、`compact`（lower/lower、caretCtrl、shiftAsCase、arrowSep 空）、`symbol`（glyph、charCase upper）；`meta` 显示为 `alt`；已知键走 `B` 表（Enter/Esc/Tab/Space/方向键等），未知键按 `charCase` 处理。
- `z` 组件：格式化失败/空串返回 null；`parens` 包裹 `(chord to action)`；`terse` 用空格代替 ` to `；`bold` 走 `kd` 加粗。
- `fo`：无 hint 时单行暗色 Text；有 hint 时 column 两行。
- 公开接口：`formatChord`（`P`）、`formatChordTokens`（`t4n`）、`formatActionHint`（`JD`）、`ChordHint`（`z`）、`HintText`（`fo`）。

## 复用与改写记录

- **复用**：`w`/`e`/`r`/`s`/`n`/`b`（`plugin-chain-react-surface`）、`kd`（`tui-text.ts`）、`h9`（`plugin-chain-keys-editor.ts`）。
- **改写（已记录）**：`BF` 为宿主胶水，平台来自已移植的 `O()`，环境分支补在 `diff-dialog-chord-host.ts`。
- **仍缺**：`Mr`（依赖 `ui` 加载组件）、`pt`（依赖 `ma`/`A9t`/`E1` 键位查找）、`Se`（依赖 `bn`/`xy`/`C`/`X`）。

## 测试

`test/diff-dialog-chrome.test.ts` 7 例：默认格式化与已知键名；多和弦 `/` 分隔；symbol/compact 样式；`t4n` 直接消费 `h9` token；`JD` 三种文案；`z` 组件树与空串 null；`fo` 单行/两行结构。

## 门禁与身份

聚焦 7/7；全量 2501/2501；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；未声明扫描 declared 49 / unresolved 0；身份 `c16a1aa999d1cda24dd83dce12c49e9c854fa5c642f07c7bbaed3544adefb1b2`（inputs 635 / validation 222 / build 438）。
