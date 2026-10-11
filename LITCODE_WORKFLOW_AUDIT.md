# LiTcode 工作流与 Magpie 网关审核报告

- 审核日期：2026-10-11。
- 项目目录：`/Users/mant1ssa/Projects/cc_reverse`。
- 目标：构建独立开源的 LiTcode；可恢复、可适配的源码优先搬运；由 Magpie 管理模型网关与上游路由。
- 审核方式：本地源码、研究记录、构建产物检查，现有回归测试，离线 CLI 使用，以及虚构凭证的自建 loopback 网关验证。
- 本次审核未修改产品代码、配置或测试，未读取真实凭证，未调用真实模型或真实 Magpie 网关。本文件记录本次对话已完成的审核，保存报告时未重新运行验证。
- 下述行号对应审核时的文件内容，后续修改可能使行号移动。

## 1. 结论

当前项目已完成“提取源码 → 静态索引 → 独立 harness 实现 → 本地离线验证”，具备可运行的 CLI 和统一模型网关 provider。

目标链路仍缺少两段：

1. 原模块到目标实现的逐模块搬运记录，以及可复现的完整性校验。
2. Magpie 管理端到 LiTcode 启动、配置和凭证生命周期的实际适配。

当前最优先的问题是已复现的 SDK 环境 header 覆盖网关鉴权。随后应接通 Magpie 管理适配，补齐源码搬运台账与索引校验，再按完整子系统继续迁移。开源发布准备应单独推进。

## 2. 已执行的验证

| 检查 | 结果 | 可证明的范围 |
| --- | --- | --- |
| `npm run check` | 通过 | 当前项目 TypeScript 类型检查通过 |
| 隔离目录编译及与 `dist` 逐文件比较 | 通过，无差异 | 审核时发布目录与当前源码编译结果一致 |
| `node bin/personal-harness.mjs --help` | 通过 | 编译后的 CLI 入口可以运行并显示参数 |
| `node bin/personal-harness.mjs --demo` | 通过 | 离线完成写文件、读文件和工具结果配对；3 次 fixture 模型调用 |
| demo 输出与会话目录检查 | 通过 | `hello.txt` 内容正确；1 份 JSONL journal；无残留 lock；审核创建的 demo 目录已清理 |
| `npm test` | 1000 项，997 通过、3 失败；无取消、跳过或 todo | 当前全量回归未全部通过 |
| 单独运行 `test/cli-mcp-requests.test.ts` | 5 项，2 通过、3 失败 | 三处失败可独立复现，并非仅全量并行执行时出现 |
| `npm pack --dry-run --ignore-scripts --json` | 52 个文件；0 个 `src/` 文件；0 个 LICENSE/NOTICE 文件 | 当前打包白名单与交付内容，不证明本次完成干净安装 |
| 自建 loopback 网关 header 验证 | 复现覆盖；1 次请求 | 虚构环境 header 可覆盖显式网关凭证并附加另一种鉴权头 |
| `git rev-parse --show-toplevel` | 返回非 Git 仓库 | 审核时项目目录及其父目录没有 Git 仓库 |

本次没有重新执行 `smoke:package` 的完整生产安装流程。研究文档中的历史离线安装记录与本次打包预览属于不同验证。

本次原始日志位于会话临时目录：

- `/Users/mant1ssa/.claude/jobs/637fe43e/tmp/litcode-audit-tests.log`
- `/Users/mant1ssa/.claude/jobs/637fe43e/tmp/litcode-audit-mcp-recheck.log`
- `/Users/mant1ssa/.claude/jobs/637fe43e/tmp/litcode-audit-demo.log`
- `/Users/mant1ssa/.claude/jobs/637fe43e/tmp/litcode-audit-package.json`

这些路径会随任务清理失效，本报告保留验证结果摘要。历史 948/948 等检查点不代表本次源码的全量验收结果。

## 3. 已确认的问题

### A01 · P1 · SDK 环境 header 可以覆盖 Magpie 网关鉴权

**证据：**

- [src/provider.ts:24](src/provider.ts#L24)：显式设置 `apiKey`、`authToken`、`baseURL`，但未隔离 SDK 的隐式自定义 header 来源。
- `node_modules/@anthropic-ai/sdk/src/client.ts:846-855`：读取 `ANTHROPIC_CUSTOM_HEADERS`，合并到 `defaultHeaders`。
- 同文件 `1754-1769`：先合并认证 header，再合并 `defaultHeaders`。
- [test/provider.test.ts:25](test/provider.test.ts#L25)：现有测试检查普通鉴权结果，未显式构造上述环境污染。

**复现结果：** 自建 `127.0.0.1` 网关，清除验证进程中的相关环境变量，再使用全虚构值。向 bearer 模式的 `GatewayProvider` 传入 `fixture-llm-key`，最终观察到：

```text
Authorization: Bearer fixture-custom-override
x-api-key: fixture-extra-key
x-fixture-route: fixture-route
```

**影响：** 宿主环境残留的旧 header 可以改变 LiTcode 发给网关的鉴权和路由元数据，削弱 Magpie 的管理边界。

**处理：** 明确网关允许的 header 来源，隔离 SDK 环境继承；覆盖 bearer 与 api-key 两种模式，增加一个必要的污染环境回归。仅传入空 `defaultHeaders` 对象并不足以自动阻止 SDK 合并环境 header，应按 SDK 实际合并逻辑实现和验证。

### A02 · P1 · Magpie 管理适配没有形成实际闭环

**证据：**

- [src/provider.ts:3](src/provider.ts#L3)：LiTcode 使用 Messages 协议，Magpie 负责模型转换。
- [src/cli.ts:174](src/cli.ts#L174)：模型和网关读取 `LLM_*`、项目设置与 flags。
- [src/cli.ts:346](src/cli.ts#L346)：凭证仅读取 `LLM_API_KEY`。
- 本地 `/Users/mant1ssa/Projects` 搜索未定位 Magpie 管理端源码或已实现的 LiTcode 启动适配。这个结果仅说明本次搜索没有找到，并不证明其他位置不存在。

**影响：** 当前已证明 LiTcode 可以配置为连接网关；尚未证明 Magpie 能自动配置、启动和管理 LiTcode。

**处理：** 在 Magpie 增加 LiTcode 启动适配，注入 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`、鉴权方式及必要能力设置。真实 Magpie 的模型转换、SSE、工具循环和恢复会话需要实际验收。

### A03 · P1 · source-first 缺少逐模块搬运台账

**证据：**

- [research/STATUS.md:507](research/STATUS.md#L507)：明确优先移植恢复实现、替换必要宿主接口。
- [research/FEATURES.md:35](research/FEATURES.md#L35)：台账按功能族记录独立实现状态。
- [research/STATUS.md:103](research/STATUS.md#L103)：query-loop 记录主要是静态观察与设计推断，跨 chunk 依赖仍有未知项。

**影响：** 当前直接搬运比例缺少核算依据；功能实现状态也不足以判断哪些代码已经复制、经过适配或被重新实现。

**处理：** 为每个完整子系统保留以下对应关系：

```text
原样本摘要 + 模块路径 + 模块摘要 + 源码范围/坐标类型
    → 目标文件/符号
    → copy / adapt / rewrite 及原因
    → 必须替换的宿主接口与尚未解析的依赖
    → 必要回归 + 实际 CLI 用例 + 验证版本身份
```

任务恢复所用的 workflow provenance 与源码搬运来源记录是不同概念，应分别记录。

### A04 · P1 · 索引生成未核对当前模块与 manifest 摘要

**证据：**

- [scripts/index-modules.mjs:8](scripts/index-modules.mjs#L8)：读取 manifest。
- [scripts/index-modules.mjs:20](scripts/index-modules.mjs#L20)：读取当前模块正文，未比较 `record.decodedSha256`。
- [scripts/index-modules.mjs:46](scripts/index-modules.mjs#L46)：继续将 manifest 的 `sha256` 标为索引的 `artifactSha256`。

**触发场景：** 修改已提取模块后重新生成索引，索引坐标基于修改后的文本，但仍挂着原样本身份。此项由代码路径确认，本次未修改提取文件进行实验。

**处理：** 索引生成前核验全部读取模块的摘要，错误时中止生成；索引项记录模块摘要、坐标类型和提取器身份。原始提取目录保持只读，适配代码放入产品目录。

### A05 · P1 · 提取完整性校验缺少可复现命令入口

**证据：**

- [research/STATUS.md:53](research/STATUS.md#L53)：记录历史 2609 个模块摘要、原可执行文件字节范围和解码内容核对结果。
- 当前 `scripts/` 与 `test/` 未找到对应独立完整性 verifier。
- [scripts/extract-bun.mjs:67](scripts/extract-bun.mjs#L67)：计算摘要并写出模块；未建立独立落盘后复核步骤。

**影响：** 当前来源链依赖历史文字记录，其他开发者缺少从原样本重新验收提取和索引的统一入口。

**处理：** 提供校验原样本摘要、raw 区间、编码解码结果、落盘模块、manifest 和索引一致性的命令；纳入 extract → verify → index 流程。

### A06 · P2 · 回归断言与当前工具目录发生漂移

**证据与结果：**

- [test/cli-mcp-requests.test.ts:207](test/cli-mcp-requests.test.ts#L207)
- [test/cli-mcp-requests.test.ts:220](test/cli-mcp-requests.test.ts#L220)
- [test/cli-mcp-requests.test.ts:232](test/cli-mcp-requests.test.ts#L232)

以上三处固定期待 46 个工具，实际为 47。全量与独立运行均出现 `47 !== 46`。

**处理：** 检查该用例真正依赖的工具名称、能力开关和隔离行为。若数量本身是协议合同，统一维护明确的目录基准；否则减少与具体行为无关的总数断言。

### A07 · P2 · 验证记录缺少构建身份与持久证据绑定

**证据：**

- [research/FEATURES.md:33](research/FEATURES.md#L33)：`Integrated` 定义为独立合同可调用且有离线覆盖，定义合理，但不等于原产品等价或真实部署通过。
- [scripts/smoke-package.mjs:24](scripts/smoke-package.mjs#L24)：安装后主要验证 help 和离线 demo。
- [research/STATUS.md:503](research/STATUS.md#L503)：记录临时日志随任务清理失效。

**影响：** 研究记录积累了丰富局部验证，却缺少 source-tree/tarball digest、搬运 owner 和原版案例的统一绑定。

**处理：** 以完整使用链作为里程碑，把验证结果绑定到具体源码与构建身份；保留精简、可复现的验收证据。测试数量不作为产品完成度指标。

### A08 · P2 · 当前缺口清单与历史记录混在一起

**证据：**

- [research/FEATURES.md:71](research/FEATURES.md#L71) 仍把 quote tokenization 写成缺口，后面的 75/77/79/81 行已分别记录引号、fallback、数字转义和命名参数的扩展。
- [README.md:168](README.md#L168) 的 Notification 阻挡说明，与 [research/HOOKS.md:43](research/HOOKS.md#L43)、[src/interactive.ts:285](src/interactive.ts#L285) 的当前行为不同；当前门控主要用于 TeammateIdle。

**影响：** 旧缺口保留现在时表述，后续迁移容易重复劳动或按过期说明改动实现。

**处理：** 保留历史记录，同时建立唯一当前清单，使用 `open / resolved / superseded`，明确 owner、下一步动作及证据。

### A09 · P2 · 开源 LiTcode 交付准备尚未落地

**证据：**

- [package.json:2](package.json#L2)：包名 `personal-agent-research`、`private: true`、bin 为 `personal-harness`。
- [package.json:7](package.json#L7)：打包白名单仅 bin/dist/README。
- [bin/personal-harness.mjs:1](bin/personal-harness.mjs#L1)：加载 `dist/cli.js`。
- 本次打包预览为 52 文件，0 个源码文件，0 个 LICENSE/NOTICE 文件。
- 审核时目录没有 Git 仓库。

**处理：** 统一 LiTcode 产品名和命令入口，建立源码仓库、可复现构建、许可证与必要第三方 notice。npm 分发包只带编译产物可以成立，但应另有可获取的开源源码交付。恢复样本代码的来源与可分发条件需要逐项核实，现有证据不足以给全部恢复代码统一指定许可证。

## 4. Magpie 的职责边界与集成建议

### 已具备的基础

主任务、摘要压缩、模型驱动 hooks、子代理、skill fork 和 MCP sampling 共用模型 provider。保留这一统一入口，由 Magpie 在网关内部处理上游差异。

### 当前配置生命周期

- [src/config.ts:910](src/config.ts#L910) 的 managed settings 主要约束 `allowShell`、permissions、features 和 mcpClient；model/gateway 尚未纳入同样的管理约束。
- [src/reload.ts:8](src/reload.ts#L8) 保留原模型和网关配置，`/reload` 不会随管理端地址/模型变更自动重建 provider。
- [src/cli.ts:330](src/cli.ts#L330) 恢复会话拒绝相关覆盖 flags，并继续使用会话快照。
- 凭证在进程启动时读取，长期进程持有原凭证。

### 推荐集成方式

1. LiTcode 固定连接 Magpie 的本地网关地址。
2. 使用稳定模型别名，Magpie 内部切换上游模型和渠道。
3. Magpie 启动适配器统一注入凭证、地址、模型和鉴权方式。
4. 凭证轮换时明确重启 LiTcode 的流程，并验证恢复会话仍能工作。
5. 若目标包含强制管理，再将 model/gateway 纳入 managed settings；普通个人使用可以保留显式覆盖入口。
6. 显式处理 gateway header，避免 SDK 继承宿主残留配置。

WebFetch、搜索后端、MCP HTTP 和 shell 自身的网络活动各有连接路径。模型网关管理与这些工具的网络管理应分别定义。

## 5. 源码搬运试点

### 技能参数解析与展开

原 parse/expansion 坐标已在 [research/FEATURES.md:209](research/FEATURES.md#L209) 记录，`uHe` 的相关拆解也已有研究证据。当前目标主要集中在 [src/config.ts:1174](src/config.ts#L1174) 的 `expandSkill`。

建议收齐 parser 与展开 helper 的依赖后整块适配。必要宿主接口集中在 [src/skill-runtime.ts:124](src/skill-runtime.ts#L124) 的 feature snapshot、预算、inline shell 和权限路径。完整 shell AST 依赖仍需明确记录。

### Monitor 的 batching 与 token bucket

[research/MONITOR.md:13](research/MONITOR.md#L13) 已定位原 `V_n`、`bJn`、`Yme`；后文记录 200ms batching 与 token bucket 合同。当前 `src/background.ts` 使用独立 flood guard 和队列投递。

[research/MONITOR.md:31](research/MONITOR.md#L31) 将这些差异记录为主动选择。先明确要保留独立行为还是追求兼容，再决定搬运，避免把设计选择误排成缺陷。

## 6. 建议执行顺序与验收

| 顺序 | 工作 | 验收标准 |
| --- | --- | --- |
| 1 | 网关 header 隔离 | 污染环境下，两种鉴权模式仍只发送明确配置的网关凭证与允许的头 |
| 2 | Magpie LiTcode 启动适配 | Magpie 实际启动 LiTcode，配置与凭证正确传入 |
| 3 | 搬运台账与提取校验 | 一个试点子系统具有可验证来源、依赖边界、目标实现和构建身份 |
| 4 | 当前缺口清单与必要回归 | 关闭旧缺口，修正三处工具数断言，当前验收结果可复现 |
| 5 | 完整子系统迁移 | 优先移植完整实现，仅替换必要宿主接口，每批通过实际 CLI 使用链 |
| 6 | 开源交付 | LiTcode 命名、源码仓库、许可证/notice、构建和分发入口齐备 |

关键实际验收链：

```text
Magpie 启动 LiTcode
    → 模型完成任务并调用工具
    → 文件读写与工具结果配对
    → 退出后恢复会话
    → Magpie 内部切换上游路由
    → 后续任务成功
    → 轮换网关凭证并重启
    → 恢复会话成功且会话记录不含凭证
```

真实 Magpie 验收目前为 UNVERIFIED；本次自建 loopback 证明的是本地传输与已复现的 header 行为。

## 7. 待核验候选

以下来自后续静态审查线索，尚未独立核对完整路径或复现，未计入已确认问题，也不改变上述优先级：

- SDK 继承 `ANTHROPIC_LOG` 后的日志正文与 stdout 行为。
- HTTP 307/308 重定向时请求正文和鉴权头的跨 origin 处理。
- SSE 收到响应头后，流读取是否具有完整任务 deadline。

## 8. 报告状态

本报告汇总已完成审核和验证，没有宣称问题已修复。产品代码、配置、测试及原研究文档保持原样。后续修复应逐项补充对应版本、实测结果与当前状态。
