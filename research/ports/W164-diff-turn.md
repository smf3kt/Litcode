# W164 逐回合 diff 历史（C-2 diff 第四片）

日期：2026-10-18。范围：diff 对话框的 turn 来源——复制 **7 块 1,271 UTF-16 单位**（chunk-twzxjzbk.js），并把 memo hook `ne`（1,431u）适配为增量累加器。前置：[W163](W163-git-diff-data.md) 数据 hook；后续对话框组件 `si`（`DiffDialog`）仍待接线。

## 来源身份

| 项 | 值 |
| --- | --- |
| 模块 | `chunk-twzxjzbk.js` sha256 `84e9dd9e0d193d0d9e64cfdf3534a0f0c2f2b42cee51236346b5eef34b7dd35b`（29,006 单位） |
| 坐标 | 零基 UTF-16 半开区间 |

| 名称 | 范围 | 单位 | 语义 |
| --- | --- | --- | --- |
| `Rt` | `[17903,18122)` | 219 | 识别带 filePath 且含 structuredPatch 或 create content 的 diff 工具结果 |
| `St` | `[18122,18194)` | 72 | 识别 `create`/`update` 结果类型 |
| `Mt` | `[18194,18338)` | 144 | 统计 hunk 内 `+`/`-` 行 |
| `Ct` | `[18338,18487)` | 149 | 用户提示 30 字预览，超出取前 29 加省略号 |
| `we` | `[18487,18642)` | 155 | 由文件行回填 turn 统计 |
| `ri` | `[22140,22184)` | 44 | 完成 turn → `{type:"turn",turn}` 来源项 |
| `Ie` | `[22184,22672)` | 488 | turn 文件/hunk → 对话框 diff 数据形状 |

同模块阅读并适配、未复制：`ne` `[18642,20073)`（1,431u）消息 → 完成 turn 列表。

## 行为

- `Rt`：结果对象带字符串 `filePath`，且 `structuredPatch` 为非空数组，或 `type==="create"` 且 `content` 为字符串。
- turn 边界：`user` 消息既无 `toolUseResult`、首条内容也不是 `tool_result`、且非 `isMeta` → 结算前一 turn（有文件才入列）并开新 turn；`isMeta` 或工具结果消息不新开。
- diff 结果折叠：首次见到路径建立文件行；`create` 且 patch 为空且类型为 create/update 时，把 content 按换行拆成单 hunk（`oldStart=0/oldLines=0/newStart=1/newLines=行长`，每行加 `+`）；否则追加 patch 并用 `Mt` 累计增删；`create` 始终置 `isNewFile`。
- 返回：已完成 turn 加当前有文件的 turn，整体 `reverse()`（最新在前）；消息数小于上次处理位置时重置状态。
- `Ie`：文件按路径排序，补 `isBinary/isLargeFile/isTruncated=false` 与 `isNewFile`；hunk 以路径建 Map；stats 取 `filesChanged/linesAdded/linesRemoved`；`source` 固定工作树、`baseMode:"auto"`、`loading:false`。

## 复用与改写记录

- **复用**：无跨包依赖（7 个复制函数自足，扫描 unresolved 0）。
- **改写（已记录）**：`ne` 是 React memo/ref hook（`R`/`Z`），本运行时改为 `TurnDiffAccumulator` 增量类，保留上次处理下标、turn 计数、收缩重置、结算与 `reverse()` 顺序；同一开放 turn 对象在完成后原样复用。
- **延后**：`DiffDialog` 组件 `si` [22671,26536)、文件列表/详情渲染 `K`/`oe`/`le`、键绑定与滚动。

## 测试

`test/diff-turn.test.ts` 9 例：预览 30/31 字与非 user 输入；结果/类型识别；`+`/`-` 计数；update+create 两回合折叠与统计；增量只走新消息且复用同一 turn 对象；消息收缩重置；meta/纯 tool_result 不开 turn；`Ie` 形状/排序/统计/来源；`we` 重算统计。

## 门禁与身份

聚焦 9/9；全量 2489/2489；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；未声明扫描 declared 13 / unresolved 0；身份 `163ac4f3a04365d7b612fcbd4f5d16a44c0d46d0debba72ca51245b005510d39`（inputs 628 / validation 220 / build 433）。
