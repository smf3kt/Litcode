# W161 Git 变更清单数据层（C-2 diff 首片）

日期：2026-10-18。范围：diff 对话框的数据层——`git diff --raw --numstat` 的采集与解析、变更路径净化、重命名显示拆分，共 **16 块 3,213 UTF-16 单位**（chunk-j8hqhz0c.js 13 块 2,831u + chunk-gyf58rwf.js 109u + chunk-ax7r0qj7.js 91u + chunk-2bcyxj9q.js 182u）。对话框、hunk 模型与来源快捷键仍待后续。

## 来源身份

| 模块 | sha256 |
| --- | --- |
| `chunk-j8hqhz0c.js` | `484244ab…` |
| `chunk-gyf58rwf.js` | `7a6a0173…` |
| `chunk-ax7r0qj7.js` | `8e782f9b…` |
| `chunk-2bcyxj9q.js` | `fac54023…` |

坐标为零基 UTF-16 半开区间；逐块范围、单位与正文 SHA-256 见[证据 JSON](W161-git-diff-status-evidence.json)，另存于 `src/git-diff-status-source-blocks.json`。

| 名称 | 范围 | 单位 | 语义 |
| --- | --- | --- | --- |
| `gkt` | j8 `[25545,26152)` | 607 | 解析 `--raw --numstat`：总量、逐文件增删/二进制、状态合并 |
| `zt`/`Kt` | j8 `[26152,26496)` | 344 | 状态字母映射与 raw 行配对 |
| `re`/`xcr` | j8 `[26496,26824)` | 328 | 路径净化与 within-root 守卫 |
| `Yt`/`ee`/`Pcr`/`RAe` | j8 `[26824,28189)` | 1,365 | 重命名显示拆分、C 引号路径解码 |
| `L3t`/`Ct`/`Ccr`/`N3t` | j8 `[18883,19070)` | 187 | 隐藏字符/孤立代理检测 |
| `Mt`/`qy` | gy `[9236,9345)` | 109 | default-ignorable 字符类 |
| `Lt` | ax `[3561,3652)` | 91 | 出现次数计数 |
| `j2` | bc `[152766,152948)` | 182 | 路径段末尾空格/点归一 |

## 行为

- `parseGitDiffStats(output, limit=50, scope)`：raw 行以 `:` 开头，numstat 行含至少两个 tab；仅当两类行数相同且逐行对应时按索引合并状态。逐文件表在 `limit` 处停止，`filesCount` 与增删总量继续累计。
- `parseGitChangedPath(line, seen)`：取 raw 行最后一个空格后的字母作为状态；重命名/复制在未 `seen` 时给出 `previousPath`/`newPath`。
- `sanitizeGitDiffPath`：拒绝绝对路径、盘符、反斜杠、含 ` => `、含隐藏/控制字符、含 `..` 段的路径。
- `isGitDiffPathWithinRoot`：重命名两侧都必须相对、非绝对、无 `..` 段。
- `splitGitRenamePaths`：支持 `old => new`、`src/{old => new}/file.ts` 与 C 引号形式（八进制 UTF-8 解码）。
- `readGitDiffStats(cwd)`：以来源参数采集未暂存工作树 diff，`within-root`、无逐文件上限；非零退出返回 `null`。未跟踪文件与来源采集器一致地不出现。

## 复用与改写记录

- **复用**：无外部产品依赖；副本只导入 `node:path` 的 `isAbsolute`/`win32`，其余为块内函数与字符类。
- **改写（已记录）**：来源 `He` 的运行器 `st`、可执行查找 `Ot`、仓库环境 `$t`/`N` 与配置前缀 `Cn` 属宿主服务；`readGitDiffStats` 用 `execFile` 按来源参数（`--no-optional-locks -c diff.relative=false diff --no-color --src-prefix=a/ --dst-prefix=b/ --submodule=short --ignore-submodules=dirty --raw --numstat`）、来源 5,000ms 超时、4 MiB 输出上限与同等 Git 隔离执行；非零退出仍为 null，spawn/abort 错误保持可见。
- **改写（已记录）**：来源 `F=50` 与命令常量同处一条声明；副本只保留 `const F = 50`，供 `gkt` 默认上限使用。
- **延后**：hunk 模型（`ZQr`）、短统计 `pxn`、分支/会话 diff 源选择与对话框组件不在本片。

## 测试

`test/git-diff-status.test.ts` 10 例：raw/numstat 配对、未配对 numstat、上限、within-root、重命名 raw 行与 seen、路径拒绝、重命名拆分与 C 引号解码、within-root 守卫、隐藏字符，以及临时 Git 仓库的真实采集（含 `add -N` 新文件与未跟踪排除）和非仓库返回 null。

## 门禁与身份

聚焦 10/10；全量 2460/2460；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；未声明扫描 declared 42 / unresolved 0；身份 `8a18b3f13d3239b5fd55b3618859ed542737257a5d30069c3e98c706bd4a6d34`（inputs 619 / validation 217 / build 427）。
