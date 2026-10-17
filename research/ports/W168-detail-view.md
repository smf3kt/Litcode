# W168 diff 明细视图（C-2 diff 第八片）

日期：2026-10-18。范围：DiffDialog 的单文件明细——路径清洗、分隔行、状态注记与逐 hunk 渲染，外加文本清洗闭包。复制 **8 块 11,770 UTF-16 单位**（明细源 7 块 5,890u；清洗闭包 1 块 5,880u）。前置：[W167](W167-key-hints.md)。

## 来源身份

| 模块 | sha256 |
| --- | --- |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` |
| `chunk-rwv4cv93.js` | `023846209f55eae2677fb05ee2c565c76872a820cbc13dd47ddf64934afbf6e1` |
| `chunk-1r9zp6s1.js` | `444d1adce233caec24f15e8203bd02c9ae6313df62af94ff0c81ea669458936e` |
| `chunk-3cynezh1.js` | `c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3` |
| `chunk-9f9hx2aq.js` | `cacbc870e67f6ae0cb55ceafb4448aa38a7ec671513a13d441d79600de6b2b10` |

| 名称 | 范围 | 单位 | 正文 SHA-256 | 语义 |
| --- | --- | --- | --- | --- |
| `Uwe` | `chunk-24k7d6mw.js [1657226,1657289)` | 63 | `97ee7960…` | 路径经 `__e`/`pn` 清洗后把 tab/换行折成空格 |
| `Sj` | `[1657326,1657515)` | 189 | `7991ff6a…` | `when` 为假时 null，否则暗色 `" ("`+子项+`")"` |
| `ypt` | `[1657515,1657527)` | 12 | `aad2b4b8…` | 1e6 字节读取上限 |
| `pBe` | `[1657527,1661848)` | 4,321 | `4c8536f6…` | 明细视图本体 |
| `Ol` | `chunk-rwv4cv93.js [902,2099)` | 1,197 | `3eef08fe…` | 分隔行，可选居中标题 |
| `XN` | `chunk-1r9zp6s1.js [19763,19829)` | 66 | `cf13685e…` | 读屏开启时回退，否则子项 |
| `yV` | `chunk-3cynezh1.js [66071,66113)` | 42 | `1eca7450…` | 分隔字符 `─` |
| `__e` | `chunk-9f9hx2aq.js [1025,6905)` | 5,880 | `0bafbbfc…` | 文本清洗器与脚本/字素/类别表；仅依赖 `hf` |

## 行为

- `pBe` 先取终端列数（`ke()`）与项目 cwd（`sv()`），`width ?? columns-4`。路径经 `Uwe` 清洗成单行。
- 读取条件：仅当有路径且非 binary/large/untracked/restricted、且 `!Ht()` 时，用 `resolve(cwd,filePath)` 与 1 MB 上限读文件，得到 `{firstLine: Ar(content), fileContent}`；任何失败或超限都退化为 `{firstLine:null, fileContent:undefined}`。
- 分支顺序：restricted → untracked → binary → large → 正常。restricted/untracked/binary/large 各自渲染标题与分隔行，再给来源文案；untracked 在本地模式下追加 ``Run `git add :/<path>` to see line counts.``。
- 正常分支：标题 + 可选 `(truncated)` 徽标 + 分隔行 + 逐 hunk `H4`（空 hunks 给 `fo` 的 `No diff content`）+ 截断页脚 `… diff truncated (exceeded 400 line limit)`。
- `Ol`：有标题时宽度 `width-padding`，标题占 `ae(title)+2`，`start` 左对齐最多 4 格，否则居中；左右重复字符并以空格包围标题；无标题时整行重复。`XN` 在读屏关闭时直接返回子项。
- `__e`：非打印字符按 tags/bidi/zeroWidth/selectors/other 分类计数；换行保留但计入 `removedTotal`；条件保留字符（emoji 变体、ZWJ 等）按来源上下文规则处理。

## 复用与改写记录

- **复用**：`e`/`r`/`w`/`s`/`n`/`b`（React 缝）、`Do`/`nt`（tui-base-components）、`ae`/`Ar`（文本钳制源）、`ke`（输入字段源）、`sv`（会话上下文源）、`H4`（代码 diff 源）、`fo`（W166 chrome 源）、`pn`（ANSI 清洗）、`hf`（宿主调用源）。
- **宿主适配（已记录）**：
  - `r8e`（chunk-f606a53w.js sha256 `dd0a1dc6…`，[5314,5397) 83u，正文 `f7220b7e…`）的正文是 Bun 运行时的 `ih`fs.readBoundedSync(...)`` 模板内建，宿主无法执行。`readFileBounded` 保留可观察契约：symlink 策略对应相同打开标志、regular-file 检查、8192 字节分块读与超限拒绝；`pBe` 仅传 `{maxBytes}`。
  - `Ht`（chunk-qr9z1wer.js sha256 `7c4094d8…`，[1303,1342) 39u，正文 `44668f06…`）检测远端/控制通道会话；产品只保留本地功能，`isRemoteSession` 返回 false，所有分支走本地文案。
- **仍缺**：`Mr`（旋转指示器动画子系统）、对话框框架 `_e`、页签 `sS`/`Na`、列表 `Tl`/`Cn`/`Po`/`Bo`/`rx`、以及 `si` 接线的 `PMr`/`Ffe`。

## 测试

`test/diff-dialog-detail.test.ts` 12 例：清洗器移除控制字符与 bidi 并分类计数、干净文本零移除；标题清洗折叠空白；restricted/untracked/binary/large 四分支文案与徽标存在性；large 分支不含远端文案；可读文件产出单 hunk 的 `H4`（patch/firstLine/fileContent/width/dim）；空 hunks 给 `No diff content`；截断徽标与页脚；缺失文件仍渲染 hunk 且 firstLine/fileContent 为空；分隔行重复 `─` 并居中标题；`Sj` 隐藏与暗色括号渲染。

## 门禁与身份

聚焦 12/12；全量 2521/2521；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；未声明扫描明细 declared 79 / unresolved 0、清洗 declared 70 / unresolved 0；身份 `881169c59c51bfa6b4127dea3c51a2bd483aa57b028b392e3b3beaa2383c53ae`（inputs 644 / validation 224 / build 444）。
