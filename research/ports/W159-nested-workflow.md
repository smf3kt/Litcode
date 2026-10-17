# W159 脚本内嵌套 workflow（C-8）

日期：2026-10-18。范围：chunk-hedqf2m1.js 的嵌套工作流运行器——解析 `kjr`、子上下文 `Ajr`、一层拒绝 `Cjr`、相名计数 `Tjr`、运行器 `Go`，5 块 3,635 UTF-16 单位。`workflow_run` 的 `name`/`scriptPath` 解析在 W158 已落地；本包接通脚本全局 `workflow(name | {scriptPath}, args)`。

## 来源身份

| 项 | 值 |
| --- | --- |
| 模块 | `chunk-hedqf2m1.js` sha256 `01fea1c4…` |
| 块 / 单位 | 5 块 / 3,635 UTF-16 单位 |
| 坐标 | 零基 UTF-16 半开区间 |

| 名称 | 范围 | 单位 | 语义 |
| --- | --- | --- | --- |
| `kjr` | `[28921,29977)` | 1,056 | 名称/`{scriptPath}` 解析与子脚本解析 |
| `Ajr` | `[29977,31050)` | 1,073 | 子上下文构建 |
| `Cjr` | `[31050,31247)` | 197 | 一层嵌套拒绝 |
| `Tjr` | `[31247,31360)` | 113 | 相名计数 |
| `Go` | `[31360,32556)` | 1,196 | 嵌套运行器 |

## 行为

- `workflow('name')` 走本地目录（W158）：缺失时报 `workflow('name'): no workflow with that name. Available: ...`；命中后完整解析脚本，解析错误带 `workflow('name'): ` 前缀。
- `workflow({scriptPath})` 经可读路径加载器读取；`HARNESS_WORKFLOW_NAME_ONLY` 门开启时以来源文案拒绝（本地变量名替换来源的账号变量），加载/解析错误分别带 `workflow({scriptPath: '...'}): ` 前缀。
- 其它参数抛 `TypeError: workflow() expects a workflow name (string) or {scriptPath: string}`。
- 子脚本在新建的硬化 Node vm 上下文运行：`args` 始终存在（缺失时为 `undefined`），`agent` 强制落在子相，`parallel`/`pipeline` 复用父运行实现，`log`/`console` 以 `[childName] ` 前缀汇入父日志，`phase()` 为 no-op，meta phases 不记录，`budget`/`setTimeout`/`clearTimeout` 复用父运行对象。
- 相名按 `Tjr`：`▸ child`，同名第二次为 `▸ child #2`；运行前记 `▸ running dynamic workflow child`，成功记 `▸ child done`，失败记 `▸ child failed: <message>` 并把 `<phase>: <message>` 写入 failures 后向父脚本抛出。
- 子上下文里的 `workflow()` 固定拒绝：`workflow() cannot be called from within a child workflow — nesting is limited to one level. Inline the inner script or call its agents directly.`

## 复用与改写记录

- **复用**：`compileWorkflowScript`（`qie`）、`parseWorkflowScript`（`YS`）、`loadWorkflowScriptFile`（`Chn`）、目录查找 `rjt`/`LOe`，以及既有 VM 边界、host 包装、错误投影与日志格式化。
- **改写（已记录）**：来源 `Ajr` 的 Bun 子 realm（`En.createContext` 与 `cwr`/`dwr`/`IFe` 跨 realm 助手）在本运行时不存在；子上下文改用 `createVmBoundary()`（Node vm），参数用子 realm `JSON.parse` 复制，日志/控制台/相/定时器按 `Ajr`/`Go` 语义接线。控制流与用户可见文案保持来源。
- **改写（已记录）**：`scriptPath` 名限文案中的账号变量替换为中性的 `HARNESS_WORKFLOW_NAME_ONLY`。
- **延后**：来源 `childSpawnMemo` 的跨 realm 子代理记忆未移植；本运行时以既有 agent bridge 与 journal 承担复用。

## 测试

`test/workflow-named.test.ts` 新增 2 例（该文件共 10 例）：命名子工作流带 args/log/phase 运行并验证日志前缀、相名与子相 no-op；缺失名称、非法参数、`scriptPath` 子脚本、名限门与同名第二次相名。既有 workflow 脚本测试断言同步为新的无解析器拒绝文案。

## 门禁与身份

聚焦 10/10；全量 2447/2447；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；身份 `14a9b2cc556f13746b15112188ace97273eeac9f12163db23ac2bb61d574d40b`（inputs 616 / validation 216 / build 425）。
