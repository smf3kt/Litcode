# W163 diff 数据 hook 与文件视图（C-2 diff 第三片）

日期：2026-10-18。范围：diff 数据 hook 的存储与派生——复制 **2 块 341 UTF-16 单位**（chunk-xmvfy87k.js），并适配 `K`/`Wcn`/`WKn` 的采集、预热与轮询语义。前置片：[W161](W161-git-diff-status.md) 文件清单、[W162](W162-git-diff-hunks.md) hunk 采集。

## 来源身份

| 项 | 值 |
| --- | --- |
| 模块 | `chunk-xmvfy87k.js` sha256 `fabe23b454accb5fcb9390965e13cd815400518e90b86cb9550d55aae113ade0`（9,843 单位） |
| 坐标 | 零基 UTF-16 半开区间 |

| 名称 | 范围 | 单位 | 正文 SHA-256 | 语义 |
| --- | --- | --- | --- | --- |
| 常量 `j`/`jKn`/`de`/`I` | `[1818,1883)` | 65 | `f17d7739…` | 400 行截断线、150ms 防抖、2000ms 预热 TTL、空 hunk 值 |
| `z` | `[2290,2566)` | 276 | `f782bdb8…` | 预热存储：`set`/`take`，TTL 与 baseMode 守卫 |

同模块阅读并在宿主侧适配、未复制：`K` `[1883,2290)`（407u）采集 stats+hunks；`Wcn` `[2589,2736)`（147u）预热存储；`WKn` `[2736,3956)`（1,220u）轮询与视图派生。依赖：`mkt` chunk-j8hqhz0c.js `[24503,24523)`（20u）选择 revision；`Tns` 同文件 `[24607,25087)` 已由 W162 适配。

## 行为

- `diffRevision`：`noCommits` → `--cached`；`source.kind === "branch"` → `baseRef`（缺省 `HEAD`）；否则 `HEAD`。
- `collectGitDiff`：先取工作树 stats；零文件直接给空 hunk；否则按 revision 取 hunk。abort 后不返回结果；采集失败或异常返回 null（来源 `K` 的 catch）。
- 预热存储：条目带 baseMode、refreshKey、round（数据条目）与 at；`take` 在超过 2000ms 时清除，baseMode 不符时保留，匹配时消费并返回。
- `primeGitDiff`（来源 `Wcn`）：采集完成且未 abort 才写入；采集失败写入 null 条目，仍算该 key 已加载。
- `buildGitDiffData`（来源 `WKn` 派生）：逐文件行按路径 `localeCompare` 排序；`skippedLarge` → `isLargeFile`；非大文件、非二进制且增删合计 > 400 → `isTruncated`；透传 `isUntracked`/`preSession`；无条目时返回空工作树视图，`loading = enabled && loading`。
- `GitDiffDataController`：挂载时 `take` 一次预热（其 refreshKey 等于当前 key 时抑制首次采集）；后续每次运行先清理旧定时器并 abort 旧采集，已有数据或 refreshKey 非零时延迟 150ms；hunk 采集失败且 revision 未变时保留旧 hunk；关闭时中止在途采集。

## 复用与改写记录

- **复用**：W161 `readGitDiffStats`、W162 `readGitDiffHunks`、`GitDiffHunks` 类型。
- **改写（已记录）**：来源 `WKn` 是 React 风格 hook（`y`/`P`/`R`/`Z`/`TCo`），本运行时改为可实例化控制器，保留 effect 依赖、预热抑制、防抖、abort、hunk 回退与视图派生；`onChange` 为宿主通知回调。
- **改写（已记录）**：来源 `K` 经 `uxn` 选择 session/branch-point/工作树源；本运行时只持有工作树视图，`baseMode` 被接受并记录但不改变数据源。来源日志（`f`/`g`/`c`）无宿主对应面，错误收敛为 null。
- **延后**：diff 对话框、导航/快捷键、`uxn` 源选择、`Tns` 的 session 快照与分支基点。

## 测试

`test/git-diff-data.test.ts` 13 例：revision 三态；空视图与 disabled；行排序/大文件/截断/二进制/未跟踪；预热 TTL 与 baseMode 保留；过期清理；预热写入与 abort；null 预热；首次采集视图与回调；同 key 预热抑制采集；150ms 防抖；hunk 回退；旧采集丢弃与关闭 abort；非仓库默认采集 null。

## 门禁与身份

聚焦 13/13；全量 2480/2480；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；未声明扫描 declared 9 / unresolved 0；身份 `7d53b94a67040bd49c692b393f895102e85e8ce09379951be7b45e7fec2c625c`（inputs 625 / validation 219 / build 431）。
