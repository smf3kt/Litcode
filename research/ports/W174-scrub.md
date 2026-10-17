# W174 子代理输出消毒（C-8 `ups` 收口）

日期：2026-10-18。范围：`ups` 结构化输出消毒器、其控制标签/伪造/升级模式表、标签名表与括号引导模式，以及模式扫描器。复制 **40 块 44,268 UTF-16 单位**，宿主适配 6 处。C-8 记录中的「`ups` 保留键/扫描器未移植」至此关闭。

## 来源身份

| 模块 | sha256 |
| --- | --- |
| `chunk-nvcqkjfn.js` | `c4cde5c8c03097dd9fdb4cc2fe12bcca28559fd2373979c62e23906c9b7ab9f9` |
| `chunk-ts42ykgs.js` | `d8b5f9ef6550b5e71556d694a6f054baf30aaaedd82983b1c169c3b3523eed33` |
| `chunk-gsnbskq4.js` | `d3a5291c4b2208b78602b8cfe03d071dfd32c076a70bbd9cbe0276068ca300ee` |
| `chunk-phm7wwmz.js` | `40e46cb899d8e325ee27e23dca0b298833a9b246ca314a282f860e768e6baf12` |

| 名称 | 范围 | 单位 | 正文 SHA-256 | 语义 |
| --- | --- | --- | --- | --- |
| `I` | `chunk-ts42ykgs.js [723,24080)` | 23357 | `91d8642e…` | 拉丁字母混淆映射 |
| `RAr..DW` | `[24502,26432)` | 1930 | `c9f0811a…` | 不可见/组合/引号/标点类与标签分隔符表 `b` |
| `xdt` | `[26432,26473)` | 41 | `5511b39f…` | 不可见字符模式 |
| `J$e` | `[26521,26571)` | 50 | `797883fc…` | 前视填充包装 |
| `$0t` | `[26571,26605)` | 34 | `ef4ff11f…` | 填充串前视 |
| `x/eu` | `[26605,26625)` | 20 | `87d09643…` | 标签模式缓存及上限 |
| `w` | `[26625,26831)` | 206 | `e7085f58…` | 单标签缓存模式 |
| `K` | `[26831,27150)` | 319 | `9782808c…` | 标签模式构造器 |
| `M/fu` | `[27528,29579)` | 2051 | `8b0bcb6f…` | 混淆表与折叠器 |
| `XQ` | `[29579,29676)` | 97 | `b304fcd2…` | NFKC + 混淆折叠 |
| `nu` | `[29676,29728)` | 52 | `f5977706…` | NFKD + 去组合符 |
| `PAr` | `[29728,29765)` | 37 | `1030c49e…` | ASCII 小写表 |
| `RB` | `[29765,29900)` | 135 | `9530f3f8…` | 字母混淆类 |
| `EO` | `[29900,30245)` | 345 | `f36579d6…` | 标签匹配器 |
| `wxe` | `[30245,30276)` | 31 | `358db364…` | 中和（追加反斜杠） |
| `f2n` | `[30276,30318)` | 42 | `c4c8ca1d…` | channel 标签模式 |
| `Uwo` | `[30318,30528)` | 210 | `c398518e…` | source 赋值尾部 |
| `Bwo` | `[30528,30544)` | 16 | `0cbac296…` | `antml` 标签名 |
| `m2n` | `[30544,30598)` | 54 | `4628f0b1…` | model-layer 标签模式 |
| `N5e..Z` | `[33610,34257)` | 647 | `edc744e4…` | 括号类、填充、分隔符与标签名界 `Z` |
| `$u` | `[34257,34370)` | 113 | `0f80008c…` | 括号填充前视 |
| `mu..Mtn` | `[34370,34565)` | 195 | `8cc52d3c…` | 引导填充类与引导符号 |
| `RRs` | `[34565,35638)` | 1073 | `006d5206…` | 括号引导模式构造器 |
| `Kkr` | `chunk-phm7wwmz.js [31823,32868)` | 1045 | `727052ce…` | artifact 引导表 |
| `cpt..Hon` | `chunk-gsnbskq4.js [866,1032)` | 166 | `87952f94…` | artifact 内容信封标记 |
| 大声明 | `[2222,8719)` | 6497 | `fd3eb051…` | artifact 标签名与说明文本（含 `pwe`/`cpt`/`m1e`/`g1e`/`OMt`） |
| `fp..DN` | `[8719,9180)` | 461 | `36905e14…` | 命令/钩子/通知标签、任务 id 与 `w8e` |
| `mzn..A0s` | `[9436,10314)` | 878 | `2d467680…` | `PD`、`y1e` 与完整控制标签表 `d4` |
| `eTe` | `chunk-nvcqkjfn.js [4651,4764)` | 113 | `95f6989a…` | frame-prefix 伪造的模式开关 |
| `A` | `[5590,5643)` | 53 | `91a99780…` | enabled 谓词 |
| `b/oao` | `[5643,5722)` | 79 | `c229d7ba…` | 行边界与 `harness` 标记词 |
| `E` | `[5722,5908)` | 186 | `08f469d0…` | 标记前缀匹配器 |
| `C` | `[5908,6160)` | 252 | `d8356072…` | max-turns 注记匹配器 |
| `H..R` | `[6160,7707)` | 1547 | `202b3899…` | 控制标签模式表 `m`、缓存副本 `cps`、`w` 与回合标记 `R` |
| `P/F` | `[7853,8580)` | 727 | `bb074b79…` | 升级模式表与发现前缀 |
| `ups` | `[9158,9387)` | 229 | `77087047…` | 结构化输出消毒入口 |
| `p` | `[9387,9789)` | 402 | `b756bbf7…` | 递归消毒 |
| `_` | `[9789,9895)` | 106 | `1c9318fa…` | 字符串消毒 |
| `T` | `[9895,9984)` | 89 | `9339d223…` | 保留键归一化 |
| `y` | `[9984,10367)` | 383 | `f4bb6448…` | 模式应用与发现 |

## 行为

- `ups(e,{reservedKeys})`：以 `T` 归一化保留键集合；`p` 递归处理字符串、数组与对象。对象键先做保留检查（命中则 `droppedReservedKeys++` 并跳过），再做字符串消毒；消毒后的键若重复，按 `_2`、`_3` 递增去重。数组逐元素递归，其他值原样返回。
- `_`：对每个字符串运行 `y`，把该字符串的 findings 与 reportable 累加到结果。
- `y`：模式表按 `P()` 顺序执行。`flag` 只计数；`neutralize` 用 `neutralize(match)` 改写；`neutralize-silent` 改写但不进 reportable。每条匹配记录 `{category,pattern,count,reportable}`，`reportable` 为真时把 pattern 追加到报告列表。
- 控制标签表：`system-reminder`、harness 信封/信号标签、channel source 标签、marker 前缀伪造、max-turns 注记伪造、frame 前缀伪造（由 `eTe()` 开关）、artifact 引导伪造、model-layer 标签。升级模式表：settings 文件路径、`bypassPermissions`、`--dangerously-skip-permissions`、permissions allow/deny。回合标记 `Human:`/`Assistant:` 静默转义冒号。
- 调用点（`chunk-hedqf2m1.js [73056)`）：仅在 schema 模式下且 `A.structured !== void 0` 时调用 `ups(A.structured,{reservedKeys:["webFetchSavedFiles"]})`，下游使用 `J.value`。

## 复用与改写记录

- **复用**：生成文件逐字复制，导入仅连接本包三文件与宿主。`ups` 的值直接进入 `AgentDescriptor.structured_output`。
- **宿主适配（已记录）**：
  - `Bt`（`chunk-gyf58rwf.js` `7a6a0173…`，[8018,8260) 242u，正文 `a007fde6…`）分块规范化；分块携带的尾簇正是可跨块组合的部分，整串 `String.prototype.normalize` 结果相同，故 `$Z`/`D0s` 直接使用整串。
  - `po`/`V`（`chunk-ae84tp6z.js` `901937cc…`，[5058,5334) 276u，正文 `e94d6228…`）lodash memoize；本包键为 `undefined`（零参 getter）或连接字符串，`Map` 与 lodash 缓存等价。
  - `k`（`chunk-bk5ct2gw.js` `efbc2d98…`，[528733,528770) 37u，正文 `40c5f5e7…`）读取配置并带回退；本构建无远程配置，直接返回回退值。
  - `Yn`（`chunk-yvnhkg35.js` `ce368968…`，[68762,68887) 125u，正文 `24a14e49…`）是 `TPe({},null)`；`TPe` 只为给定键定义 getter，空表即无原型空对象，属性读取为 undefined。
  - `DTe`（`chunk-d2vt7d7f.js` `21ad41ec…`，声明语句 [688,1463)；值 `DTe="NOTE: this agent stopped at its "` [1044,1082)，正文 `896f2873…`）仅采用该值；同语句其余声明符不属于本包。
  - `Pbo`（`chunk-phm7wwmz.js` `40e46cb8…`，[33184,33216) 32u，正文 `c9e5a4ff…`，`function Pbo(){return re().lead}`）的 `lead` getter 为 `RRs(Kkr())`；宿主以 `bindScrubLead` 绑定同一惰性表达式，不引入 `re()`/`te` 的 page/envelope 状态。

## 测试

`test/subagent-output-scrub.test.ts` 7 例：保留键逐层删除与计数；保留匹配对大小写/分隔符/混淆字符归一；控制标签在键与值中中和并报告；升级模式只标记不改写；静默回合标记转义冒号且不报告；artifact 引导伪造由绑定的 lead 模式中和；原始值与数组透传。`test/agent-registry.test.ts` 新增 1 例：schema 模式子代理返回 `webFetchSavedFiles` 与 `<system-reminder>` 时，公开的 `structured_output` 已删除保留键并中和标签。

## 门禁与身份

聚焦 55/55（8 新增）；全量 2584/2584；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；未声明扫描 73/99/47，unresolved 0；身份 `73a647f3ed08fb87a8872760d8667cc99c1972b0df44fc56ae8a1caa00c6983e`（inputs 684 / validation 230 / build 470）。
