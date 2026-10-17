# W162 统一 diff hunk 与短统计（C-2 diff 第二片）

日期：2026-10-18。范围：diff 数据层的 hunk 解析与采集——`ZQr`、`pxn` 共 **2 块 1,438 UTF-16 单位**（chunk-j8hqhz0c.js），加宿主侧 `Tns` 语义适配。上一片 [W161](W161-git-diff-status.md) 已接通文件清单。

## 来源身份

| 项 | 值 |
| --- | --- |
| 模块 | `chunk-j8hqhz0c.js` sha256 `484244ab…` |
| 坐标 | 零基 UTF-16 半开区间 |

| 名称 | 范围 | 单位 | 正文 SHA-256 | 语义 |
| --- | --- | --- | --- | --- |
| `ZQr` | `[28189,29373)` | 1,184 | `dd10cc02…` | 统一 diff → 逐文件 hunk |
| `pxn` | `[32005,32259)` | 254 | `b8cc9854…` | `--shortstat` 总量 |
| `Tns` | `[24607,25087)` | 480 | `5fc11d7a…` | 采集语义（宿主适配，未复制） |

常量：`F=50`（文件上限，与 W161 共用）、`Tcr=1e6`（超大段）、`F3t=400`（每 hunk 行上限）、`L=500`（shortstat 跳过阈值）。

## 行为

- 头部 `a/x b/x` 直接取共享路径；否则匹配引号或非引号两侧，路径取新侧并用 W161 的 `RAe` 解码 C 引号 UTF-8。
- 段长超过 1,000,000 单位记入 `skippedLarge` 而不解析；解析与超大文件合计到 50 即停止。
- `@@ -old[,n] +new[,m] @@` 生成坐标，`n`/`m` 缺省为 1；首个 hunk 之前的 `index`/`---`/`+++`/`new file`/`deleted file`/mode/`Binary files` 行忽略。
- hunk 内只收集以 ` `/`+`/`-` 开头或空的行，保留原标记；每个 hunk 最多 400 行。
- `pxn` 匹配 `N files changed`、可选 insertions/deletions，缺失侧为 0；不匹配返回 null。
- `readGitDiffHunks(cwd, revision)`：先跑 `--shortstat`，超过 500 文件返回空结果；再以 `--no-ext-diff --no-textconv` 加 revision 采集 patch，非零退出返回 null；`--cached` 时删除仍有未暂存改动的路径，与 W161 的 `readGitDiffStats` 结果对齐。

## 复用与改写记录

- **复用**：`RAe`（W161 副本，现由 `git-diff-status-source.ts` 导出）、`readGitDiffStats`、`GIT_DIFF_BASE_ARGS`、`gitDiffEnvironment`。
- **改写（已记录）**：`Tns` 的 `j`/`st` 进程运行器、`Rcr` 仓库检查、`Ue` 中止检查与 `N` 环境属宿主服务；`readGitDiffHunks` 用 `execFile`、来源参数、来源 5 秒超时、4 MiB 上限与共享 Git 隔离执行，保留 shortstat 跳过与 `--cached` 清理语义。
- **延后**：diff 对话框、导航/快捷键、`uxn` 源选择与 `WKn` 数据 hook。

## 测试

`test/git-diff-hunks.test.ts` 7 例：shortstat 复数/单数/缺侧/null；合成 patch 的坐标与行标记；C 引号头解码；400 行上限；50 文件上限；超大段跳过；真实仓库采集与 `--cached` 未暂存路径剔除、非仓库返回 null。

## 门禁与身份

聚焦 7/7；全量 2467/2467；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；未声明扫描 declared 23 / unresolved 0；身份 `9d4ebe67bdc8d29ba1c032e24636cc72fe5d39ee6cfcaec44530a406cdb2f605`（inputs 622 / validation 218 / build 429）。
