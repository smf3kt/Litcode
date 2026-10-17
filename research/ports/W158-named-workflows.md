# W158 命名工作流（C-8）

日期：2026-10-18。范围：`chunk-9r54k71g.js` 的命名工作流发现、合并与查找，加它直接调用的缓存、失效、解析检查、errno、存储分页、文件上限、普通文件读取与 CRLF 归一化助手（9 块，8,076 UTF-16 单位）。`workflow_run` 的 `name` 输入按来源 `Rr` 解析并接入本目录；脚本内的嵌套 `workflow(name)` 运行器在 chunk-hedqf2m1.js，另立包。

## 来源身份

| 项 | 值 |
| --- | --- |
| 模块 | `chunk-9r54k71g.js` sha256 `25493ddf…` 及 7 个助手模块 |
| 块 / 单位 | 9 块 / 8,076 UTF-16 单位 |
| 坐标 | 零基 UTF-16 半开区间 |

| 名称 | 模块 | 范围 | 单位 |
| --- | --- | --- | --- |
| 发现、合并、查找主体 | chunk-9r54k71g.js | `[1448,8633)` | 7,185 |
| `pQ`/`fQ` | chunk-qm4226vk.js | `[3319,3438)` | 119 |
| `UDn` | chunk-3ph567jx.js | `[4032,4069)` | 37 |
| `lzo` | chunk-rk6tjv7j.js | `[4573,4614)` | 41 |
| `xs` | chunk-886tf6ja.js | `[7299,7391)` | 92 |
| `Yf`/`Wi` | chunk-wdffj3z9.js | `[615,1006)` | 391 |
| `wE` | chunk-2bcyxj9q.js | `[149852,149878)` | 26 |
| `Yk` | chunk-64ag51qf.js | `[1282,1420)` | 138 |
| `Vce` | chunk-2bcyxj9q.js | `[150665,150712)` | 47 |

## 行为

- `_`/`v` 读取插件工作流目录：仅 `.js`，符号链接与普通文件均尝试，`$pe` 按真实路径去重，`Yk` 拒绝非普通文件与超过 524,288 字节者；失败按来源文案记日志并跳过。
- `b` 先读用户 `<userDir>/workflows`（`cn("userSettings")` 可用时），再读 `a7` 返回的项目目录；项目目录从最外层向最内层迭代，内层最后写入；每项先过 `W` 解析守卫，再做 `S` 去重。
- `D` 对每个目录读 `.js`；`.mjs`/`.cjs`/`.ts` 只计近失配；读取失败、超限、meta 非法分别计数并记录；`Vce` 归一 CRLF 后以 `YS(...,{validateBody:false})` 只解析 meta。
- `L` 是存储后端分支；本地不传 storage，故不可达。`Wi` 的页上限 `Yf`=10,000 随之保留但只服务该分支。
- `M`：当 `br("workflows")` 或 `GJe()`（`HARNESS_WORKFLOW_NAME_ONLY`）为真时只返回 bundled；否则合并 bundled（`ojt`）、plugin（`P` 加载、`S` 去重、`O` 守卫）、用户/项目（先用户后项目）三层，名称集合去重后输出 bundled 未遮蔽项、未遮蔽的 plugin 项、用户/项目项。
- `LOe` 以 `${RUn()}:${GJe()}:${fQ(workspace)}` 缓存 promise；`rjt` 精确匹配名称；`yXn` 同时清空该缓存与 `it().workflows`。
- `workflow_run`：`scriptPath` 分支优先（给 script 时不再读文件，与来源一致）；否则 `name` 分支解析目录，显式 `script` 覆盖命名脚本，缺失时抛 `Workflow "name" not found. Available: ...`；最后才是裸 `script`。

## 宿主绑定与改写记录

- **本地宿主**：`ie` 用 `fs.promises` 实现 readdir/stat/readFile/readFileBytes（读取上限按传入值截断）；`a7` 从工作区向上读到 home（不含 home），收集存在的 `<dir>/.harness/workflows`；`be` 默认 `defaultUserDir()`，`kyt` 拼 `workflows`。
- **宿主输入**：插件列表（`Xs`）、bundled 列表（`ojt`）、bundled-only 门（`br`）、日志器（`t`/`g`/`m`/`f`）与 userDir/缓存键前缀（`cn`/`RUn`）都可配置；默认插件与 bundled 为空，日志静默。
- **账号层替换**：来源 `cn` 决定账号设置命名空间是否可读；本地恒为可读，用户分支直接读文件系统。`RUn` 的账号级缓存作用域以常量 `local` 代替。`a` 的恢复属性名保留（复制正文读取它），值改读中性环境变量 `HARNESS_WORKFLOW_NAME_ONLY`。
- **`YS` 扩展**：`parseWorkflowScript` 增加来源 `{validateBody:false}` 快路径——先按 `^export const meta =` 定位花括号字面量，跳过注释与引号，单独解析该表达式并走既有 `pureLiteral`/`metaValue`；失败才回退完整解析。`lzo` 仍用完整解析。
- **未改写**合并、优先级、缓存、页上限、CRLF 与解析守卫正文。

## 测试

`test/workflow-named.test.ts` 8 例：用户/外层/内层三级合并且内层覆盖；坏项目覆盖被解析守卫拒绝并保留用户副本；坏 body 仍可被 meta-only 发现（同时验证有/无 `validateBody` 的差异）；超限文件与 `.ts` 近失配被跳过；每工作区 promise 缓存与 `clearNamedWorkflowCache` 失效；精确名称查找；bundled-only 收窄；`workflow_run` 按名执行、缺失列出可用名、显式 `script` 覆盖命名脚本。

## 门禁与身份

聚焦 8/8；全量 2445/2445；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；依赖扫描 blocks 9 / missing 0 / units 8,076 / declared 65 / unresolved 0；身份 `d68c7b23f9dab35e7afe9f4e4b28567ec174677b2d2a003d2b55d490c40d1c50`（inputs 616 / validation 216 / build 425）。
