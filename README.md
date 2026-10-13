# LiTcode

这是个人 coding harness：优先移植已有源码中的有用实现，集中替换宿主依赖并接入自己的运行层。按完整子系统迁移，进度和行为差异记录在 `research/FEATURES.md`。模型路由和协议转换交给 Magpie，本项目使用 Messages 协议作为网关接口。

模型 ID、网关地址、认证方式与能力字段均可配置。产品名称、提示词和输出保持中立；上游响应按原样传递。凭证默认使用 `LLM_API_KEY`，未设置时继承本机已配置客户端的网关设置（见安装一节），默认上下文为1M、压缩阈值为512k，工具文本结果最多24,000 UTF-8字节。

开发遵循 [标准工作流](WORKFLOW.md)：报告定位、来源核验、copy/adapt优先、完整子系统接入、实际CLI验收和版本证据绑定。[当前工作清单](research/CURRENT.md) 管理优先级与审核问题状态；历史报告保留溯源，开工先从当前清单选择ready工作包。

当前版本支持文件/Notebook/媒体、会话恢复与分支、摘要压缩、配置与技能执行、任务依赖、MCP stdio/HTTP、本地后台代理与消息、声明式 Workflow、LSP、WebFetch、memory、checkpoint、Git worktree、后台 Shell、Monitor、cron 和动态唤醒。连续迁移已接入 Workflow 持久恢复、任务双向投影、插件组件、MCP form/订阅/logging、剪贴板、主worktree、规则/快捷键重载、有限会话picker/lineage、skill类型路由与编译包。Hook接线见HOOKS。工具目录随能力开关、后端和旧会话快照变化，按工具名称与行为验收。当前基线和审核状态见`research/CURRENT.md`；948/948为历史记录，尚未完成全部产品迁移。

## 安装

全局安装后，直接输入 `litcode` 即进入当前目录的交互会话：

```sh
npm run build
npm install -g .          # 或 npm link，开发时改动即时生效
litcode                   # 在终端里等价于 litcode --interactive
```

凭证与模型默认**跟踪本机已配置客户端**：`LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL` 未设置时，依次从客户端自身的配置文件（默认`~/.claude/settings.json`，可用`CLAUDE_CONFIG_DIR`或`LLM_INHERIT_DIR`指定；也读进程环境）取其`ANTHROPIC_BASE_URL`、`ANTHROPIC_MODEL`与`ANTHROPIC_AUTH_TOKEN`/`ANTHROPIC_API_KEY`。因此通常无需导出任何变量：

```sh
litcode                   # 网关、凭证与模型都来自已配置的客户端
```

本机没有任何可跟踪的配置时，或要显式指定时：

```sh
export LLM_API_KEY=...
export LLM_MODEL=MODEL
litcode
```

三条规则：**显式优先**——本 harness 的 flag、`LLM_*` 变量与其自身`settings.json`始终压过继承值；**网关匹配**——借来的凭证只用于该客户端自己声明的那个端点，`--base-url`改成别的端点时不会被送出；**只报来源**——启动时在 stderr 打印一行`gateway: inherited …`，只写变量名与文件路径，不写任何值，凭证也不入会话。`--no-inherit-gateway`或`LLM_INHERIT_GATEWAY=false`可整体关闭；`--resume`按其固定端点重新取凭证，不受当前环境覆盖。

`litcode` 不带参数时按终端决定行为：在终端中打开交互会话（等同 `--interactive`），管道或无终端时打印用法并以 0 退出（`litcode --help`、`litcode --version` 同样如此）。`--demo`、`--continue`、`--resume`、`--list-sessions` 以及 `--mcp-elicitation`/`--watch-config` 不会被当作空调用。`litcode-magpie` 与旧名 `personal-harness` 一并安装。

## 运行

开发与打包实测为macOS、Node.js v26.10.0；package engines声明Node>=22，其他Node/平台尚未实测。文件与Shell按POSIX实现，Windows尚未验证。ripgrep提供搜索，文件列表缺少ripgrep时有fallback。

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run agent -- --demo
```

`--demo` 使用本地脚本化 provider，在临时目录完成写文件、读文件和工具结果配对，不请求模型。演示目录和 JSONL 日志保留，其路径显示在终端。

编译后运行无需tsx开发运行时：

```sh
npm run build
node bin/litcode.mjs --help
node bin/litcode.mjs --demo
node bin/litcode.mjs --workspace /absolute/path/to/project --interactive
node bin/litcode.mjs            # 终端中的空调用即上面的交互会话
```

本地打包安装示例（npm缓存需已有生产依赖供离线安装）：

```sh
PACKAGE_TMP=$(mktemp -d)
npm run build
npm pack --ignore-scripts --pack-destination "$PACKAGE_TMP"
npm install --prefix "$PACKAGE_TMP/install" --offline --omit=dev --ignore-scripts \
  "$PACKAGE_TMP/litcode-0.1.0.tgz"
"$PACKAGE_TMP/install/node_modules/.bin/litcode" --help
"$PACKAGE_TMP/install/node_modules/.bin/litcode" --demo
```

`bin/litcode.mjs`导入distCLI；旧`personal-harness`命令保留兼容。构建仅编译src，运行包包含bin/dist/README和依赖notice，排除提取样本、研究目录及会话数据。项目按MIT发布（见`LICENSE`，公开仓库为github.com/smf3kt/litcode）；`package.json`保留private:true，仅用于防止误发npm。`npm run smoke:package`验证离线生产安装、两个命令help一致、demo及锁清理。

来源与构建身份检查：

```sh
npm run verify:extraction -- /absolute/path/to/sample extracted-v2
npm run index:modules -- extracted-v2 research-module-index-v4.json
npm run verify:extraction -- /absolute/path/to/sample extracted-v2 research-module-index-v4.json
npm run identity -- --output /absolute/path/to/new-identity.json
```

输入样本和提取目录只读；索引、identity及可选`--output`验证报告使用新文件路径。校验覆盖原始字节、解码、落盘摘要和索引记录，静态解析失败单独保留。旧索引保持历史记录，后续来源以本轮验证接受的新索引为准。身份脚本绑定src/bin/scripts、package与lock/tsconfig、test及dist，排除凭证与会话。

网关鉴权按`LLM_AUTH`和`LLM_API_KEY`显式配置，未显式配置时可用继承凭证并按其来源变量推断`bearer`/`api-key`，隔离SDK继承的自定义header，保留Messages协议默认头。新会话、恢复换凭证、bearer/api-key均有实际loopback验收；真实Magpie管理端验收单独记录。

MCP恢复：
MCP恢复可在工作区`.harness/settings.json`显式开启，并固定到会话：

```json
{ "features": { "mcpSubscriptions": true, "mcpNotificationStream": true, "mcpRecovery": true, "mcpPersistence": true } }
```

成功确认的精确URI在手工或HTTP自动替换连接时先向候选连接恢复，再提交新generation；恢复失败保留旧连接。GET通知流遇到EOF、传输失败或idle deadline后在同一session内最多重开5次，间隔1/2/4/8/8秒；关闭会清理计时器。资源正文仍由显式读取工具获取，缺失通知维持缺失。旧会话缺少此开关时沿用原合同，HTTP既有自动快恢复保持。

实际CLI验收入口：`npm run smoke:mcp-recovery-cli -- --compiled`和`npm run smoke:mcp-startup-cli -- --compiled`（先构建）。开启mcpRecovery还启用临时HTTP启动失败降级及五次快恢复后的八轮慢恢复，健康服务保持；来源与有限差异见[启动记录](research/ports/W05-startup.md)。同时开启mcpPersistence、mcpRecovery和mcpSubscriptions后，精确URI的subscribe/unsubscribe确认写入当前会话journal；恢复使用固定server配置摘要，并在任务开始前恢复仍有效的订阅。新会话、fork、clear和配置分支使用独立连接与空订阅记录。省略/false保留连接内恢复合同。journal提交失败会明确报告远端已确认、持久化失败，并阻断当前绑定的修改与重连；fsync失败可能已经写入日志字节，重启前须核对journal，禁止把内存状态当成持久成功。实际跨进程验收：`npm run smoke:mcp-persistence-cli -- --compiled --sigkill`；合同与证据见[持久化记录](research/ports/W05-persistence.md)。

通过环境变量配置 Magpie：
```sh
export LLM_API_KEY='[YOUR_GATEWAY_KEY]'
export LLM_BASE_URL='http://127.0.0.1:3425'
export LLM_MODEL='[YOUR_MAGPIE_MODEL_ID]'
npm run agent -- --workspace /absolute/path/to/project "检查测试失败的原因并修复"
```

模型 ID 也可通过 `--model` 指定，地址可用 `--base-url` 覆盖。模型由用户显式选择，不设置厂商专属默认值。

安装后可用`litcode-magpie`检查模型与凭证引用，源码目录对应`node bin/litcode-magpie.mjs`：

```sh
litcode-magpie --check --model deepseek/deepseek-flash
litcode-magpie --model MODEL --start-app /Applications/magpie.app -- --workspace PROJECT --interactive
```

`--start-app`只在连接被拒绝时启动应用，默认仅检查现有服务；`--start-command JSON_ARGV`可用于自有网关命令，退出时回收该命令。启动等待默认15秒，可用`--startup-timeout-ms`设置100..120000毫秒。恢复会话从journal读取固定模型与地址；路由与凭证保持。真实任务会使用所配置上游，调用预算另行约定。

| 配置 | CLI 参数 | 默认/行为 |
| --- | --- | --- |
| `LLM_API_KEY` | 环境变量 | 网关凭证；不写入会话配置。未设置时按端点匹配继承已配置客户端的凭证（`--no-inherit-gateway`关闭） |
| `LLM_BASE_URL` | `--base-url` | `http://127.0.0.1:3425`，由 SDK 拼接 `/v1/messages` |
| `LLM_MODEL` | `--model` | 必填网关模型 ID，原样传递 |
| `LLM_EFFORT` | `--effort` | 可选 low/medium/high/xhigh/max，发送 output_config.effort；默认省略 |
| `LLM_AUTH` | `--auth` | `bearer`；可选 `api-key` 使用 x-api-key header |
| `LLM_TOKEN_COUNTING` | `--token-counting` | `estimate`；可选 `api` 请求 `/v1/messages/count_tokens` |
| `LLM_THINKING` | `--thinking` / `--no-thinking` | false；开启后发送 adaptive thinking |
| `LLM_PROMPT_CACHE` | `--prompt-cache` | false；开启 ephemeral cache 字段 |
| `LLM_EAGER_TOOL_INPUT` | `--eager-tool-input` | false；开启 eager_input_streaming 字段 |

布尔环境变量接受 true/false 或 1/0。CLI 参数优先于环境变量。按网关和目标模型支持程度开启能力字段；默认不发送这些可选字段。使用 API token counting 前需确认网关提供该接口。

本地 estimate 模式以请求内容的 UTF-8 字节长度加固定余量作为保守输入预算，没有使用真实模型 tokenizer，可能提前压缩，也不代表计费 token。API 模式才返回服务端计数。

固定的 `@anthropic-ai/sdk 0.133.0` 仅负责网关 Messages 的流式传输和解析；模型转换由 Magpie 实现。SDK 的 vendor key/base URL 环境变量不会覆盖显式传入的 harness 配置。真实执行会请求所配置网关，包括任务响应、摘要及可选 token counting；本项目目前没有进行付费模型验证。

本地源码交付：

```sh
npm run notices:check
npm run source:bundle -- /absolute/path/to/new-litcode-source
```

源码目录包含src、锁定依赖、构建配置、scripts、test和notice，附逐文件摘要manifest。进入交付目录执行`npm ci --ignore-scripts`、`npm run check`、`npm run build`即可重建；本地缓存齐备时可增加`--offline`。源码包排除原始样本、提取目录、研究索引及私人运行数据。缺失的上游license文本在`research/ports/dependency-notices.json`明确列出，当前交付保持private。


Shell 工具需要显式开启：

```sh
npm run agent -- --workspace /absolute/path/to/project --allow-shell "运行测试并修复失败"
```

`--allow-shell` 允许命令按当前 OS 用户权限执行。命令的 cwd 为工作区，这个设置本身不构成 OS sandbox。环境变量会继承到命令子进程。

## 会话与恢复

Session lineage 的独立 `branch` journal 元数据记录直接父UUID、workspace、原event-index boundary及fork/rewind/reload/configuration/relocation reason，保持在model messages之外；新分支省略复制旧branch，祖父关系仍留在父日志。旧日志兼容，`/sessions`显示parent并可按父UUID搜索。History-only `/rewind 0`创建空历史分支，文件保持原状。独立22/22（1640.564ms）、TypeScript及实际expect PTY/CLI通过fork、rewind0、parent搜索，8次自有SSE请求；日志`/private/tmp/cc-reverse-session-lineage-tests.log`、`/private/tmp/cc-reverse-session-lineage-check.log`、`/private/tmp/cc-reverse-session-lineage-cli.log`，与此前22项检查分开。

每次新任务会输出 session UUID。日志位于 `WORKSPACE/.agent/UUID.jsonl`，新目录 mode 为 `0700`，新日志为 `0600`；日志保存提示词、工具参数、结果及完整模型响应，并未加密或自动脱敏。

继续已经结束的会话并追加任务：

```sh
npm run agent -- --workspace /absolute/path/to/project --resume UUID "继续处理下一项"
```

继续一次因进程或 provider 故障而中断的任务：

```sh
npm run agent -- --workspace /absolute/path/to/project --resume UUID --continue
```

若异常退出留下锁，可追加 `--recover-lock`；只有探测确认记录的进程已退出才会清理锁。存活进程的锁保留。

恢复会复用已经持久化的工具结果。对已启动但缺少结果的工具，返回“效果未知”的错误结果；对未启动的排队调用，返回“已跳过”的错误结果。恢复阶段不会自动重放这些操作，模型需先检查当前工作区再决定下一步。

会话固定 model、system、工具 schema、网关地址/能力与运行配置。`--resume` 使用保存值，忽略当前环境中的非密钥配置；凭证从 `LLM_API_KEY` 获取，未设置时按保存的端点继承，可以轮换。`/model ID`、`/plan`、`/permissions MODE` 将已完成历史复制到新配置的新 UUID 会话。早期没有 gateway 字段的日志可用于离线审计，当前 CLI 提示创建新会话。

## 配置、交互与扩展

Rules目录现有界递归加载Markdown至depth3（root为0），遍历entries共用2048上限，按路径排序，realpath去重跳过循环；超过深度或目录symlink逃出root时报配置错误，既有文件alias合同保持。`--watch-config`的rules模式同样递归至depth3，沿用64handles/2048entries，目录rename刷新观察集，可发现新建`.harness/rules/nested/rule.md`再更新；已加载imports仍精确监听。最终70/70（8965.706875ms）与TypeScript通过，实际CLI/expectPTY9次自有SSE请求验证nestedRuleDiscovery及既有watch/picker/lineage断言。日志`/private/tmp/cc-reverse-nested-rules-tests.log`、`/private/tmp/cc-reverse-nested-rules-check.log`、`/private/tmp/cc-reverse-nested-rules-cli.log`；此前8请求仍为各自历史检查点，更深递归/未加载imports/插件正文watch保持缺口。

新会话按 defaults → `~/.harness/settings.json` → 项目 `.harness/settings.json` → `.harness/settings.local.json` → `--settings FILE` → 已设置的 `LLM_*` 环境变量 → CLI flags 合并。`--user-dir DIR` 可指定独立用户目录；恢复会话使用原快照。

`/mcp-reconnect SERVER` 使用固定配置替换单个连接，保留当前会话、其他server及后台资源；模型也可调用 `mcp_reconnect` 工具，沿用常规权限与工具日志。新连接完成握手和目录校验后才提交，失败保留旧连接。`/mcp` 展示状态、generation、尝试次数和重连错误。HTTP session过期或连续3次transport错误触发最多5次自动拨号，间隔为立即、1/2/4/8秒；认证与协议错误结束重试，stdio崩溃使用显式恢复。调用效果始终只执行一次，重连后的日志/订阅队列从空开始。发布schema保持固定，发生变化时旧工具报错；启用动态目录后可重新发现，或使用整体重连接入新的发布schema。

不带名称的 `/mcp-reconnect` 保留整体重建入口：成功刷新工具schema并分支新会话，失败保留旧runtime。整体切换结束旧owner后台资源；修改磁盘配置使用 `/reload`。当前mcpRecovery开启启动降级、慢重试和已确认URI重建；跨进程URI持久化另由mcpPersistence显式开启；事件重放与完整原版refetch/park策略仍保留差异。旧14/4请求记录维持各自版本作用域。

`--managed-settings FILE` 指定独立的本地策略JSON，只接受 `allowShell`、`permissions`、`features`、`mcpClient`。已写出的字段最终覆盖项目设置与CLI：`permissions` 整体替换（数组不拼接），feature/MCP布尔值按字段覆盖，其余字段沿用普通配置。策略与文件路径保存到会话；`/permissions`、`/plan` 在策略指定permissions时保持原值。`--watch-config` 观察外部策略文件，完整重载成功后创建新会话快照；错误或缺失文件保留旧runtime。恢复直接使用已存策略，策略源随后删除也可打开；恢复时新增 `--managed-settings` 参数会报错。它是自有harness配置合同，尚无OS级managed配置发现、远端策略签名或凭证管理。

配置监听也包含已验证的installed plugin目录和显式 `pluginDirs` 内容：沿目录最多3层，仍受64个watch/2048项共享预算约束；代码/JSON/Markdown字节变化只排队重载，安装digest校验照常执行。修改installed skill时旧runtime保留，恢复原字节后重载通过；源码与编译CLI均以0次模型/网络请求验证。条件规则中未激活的已固定import也在精确路径监听列表；按需访问的深层目录/新import发现仍待完善。

工具访问深层文件时，动态读取的指令和import路径也追加到当前interactive精确监听集合；最多2048个去重路径，共享64个watch上限。相同workspace重载/分支继续监听，workspace切换清空；路径集合仅在进程内保存，恢复后重新访问再发现。源码CLI/真实PTY验证访问深层文件、修改import、回合后重载和再次读取新内容，增强流程13次本地SSE请求。尚未访问的目录、新建指令文件及子代理独立访问路径仍待发现；这项是按需监听合同。

例如策略文件可为 `{"allowShell":false,"permissions":{"mode":"default","allow":[],"deny":["write_file","run_command"]},"features":{"subagents":false},"mcpClient":{"sampling":false}}`。`npm run smoke:managed-cli` 使用本地SSE验证项目/CLI冲突、真实写入拦截、权限命令固定、外部监听、错误重载及固定恢复；3次模型请求，编译入口同样通过。

项目指令读取祖先目录的 `HARNESS.md`、`AGENTS.md` 及工作区 `.harness/rules/*.md`，支持跳过 Markdown 代码/注释的递归文件 imports。指令、技能、启动 memory 和 agent 定义原始文件共用 8 MiB 总预算，每个文本最多 2 MiB；通过文件描述符限量读取。YAML `paths`/`pathglob` 条件规则固定到会话，按相关文件工具目标加载；首次遇到规则的修改调用先返回规则上下文，供模型重新评估。Skills 按项目 → 用户 → 验证后的已安装插件 → 显式 `pluginDirs` 本地目录选同名项，支持有界 YAML、`$ARGUMENTS`、`$1`–`$9`、model、context fork、background、allowed-tools、hook overlay 和显式启用的内联 shell。同步与后台 `context: fork` 技能均可继承当前父会话的已配对前缀，省略 thinking/redacted_thinking，并在子日志中记录 `fork_seed` 回合边界；有界检查仍保留。仅有 grants 或 hooks 也会启动独立子会话；effort 支持 low/medium/high/xhigh/max 并进入配置请求。原版完整 inline/fork 语义、动态发现和 auto-memory 策略仍有差距。

Agent 定义从项目 `.harness/agents/*.md`、用户 `~/.harness/agents/*.md` 和显式开启的已安装插件 agents 目录加载，项目、用户、插件按此顺序选同名项。YAML 支持 name、description、mode、tools、model（含 inherit）、effort、maxTurns 和 isolation: worktree；正文及目录固定到会话，恢复时复用快照。默认启用 `features.agentTypes`，`agent.subagent_type` 可选 general、explore、fork 或目录名称。

本地插件管理通过 `"plugins": { "enabled": true }` 显式开启。`plugin_install` 接收包含 `plugin.json` 的本地目录，复制为 `.harness/plugins/` 中的静态包；`plugin_list` 返回 digest，update/remove 必须提交 `expected_digest` 并通过内容检查。Manifest 使用 name、version、可选 description、skills/agents 相对目录、hooks/mcpServers 相对 JSON 文件。组件 JSON 分别使用 `{ "hooks": {...} }` 与 `{ "mcpServers": {...} }` 包装，每份最多 512 KiB。MCP server 使用 `plugin/server` 命名空间，显式配置按完整 server 覆盖；plugin hooks 排在显式配置层前。发现仅校验数据，连接服务器及执行 hooks 由后续 runtime 负责。安装变化在新会话或 `/reload` 后生效，恢复沿用快照。复制上限、锁和回滚检查保留；marketplace、下载、发布和原版完整组件语义仍为 Partial。

示例 `.harness/settings.json`：

```json
{
  "model": "[MAGPIE_MODEL_ID]",
  "allowShell": true,
  "autoMemory": true,
  "dynamicInstructions": true,
  "permissions": { "mode": "default", "allow": [], "deny": [] },
  "features": { "tasks": true, "taskProjections": true, "subagents": true, "agentMessaging": true, "agentTypes": true, "interaction": true, "notebooks": true, "background": true, "scheduler": true, "media": true, "memory": true, "checkpoints": true, "worktrees": true, "workflow": true, "workflowPersistence": true, "mcpSubscriptions": false },
  "hooks": { "PreToolUse": [{ "matcher": "write_file|edit_file", "command": "[HOOK_COMMAND]", "timeout": 10 }] },
  "mcpServers": { "local": { "command": "[MCP_EXECUTABLE]", "args": [] } }
}
```

Hooks 的 event 列表支持旧平铺定义与 `{ "matcher": "...", "hooks": [...] }` 非递归分组混用，保持配置顺序；组 matcher 与内部 matcher 同时满足才执行。整个配置的条目数与展开定义数均最多 1024。command、HTTP、async command、prompt 和 agent 定义均可设置 `once:true`；消费键保持定义位置与内容身份，owner 的 `HookLifecycle` 在首个副作用前同步写入 `hook_once` journal。相同 Session 的 Agent 包装共享状态，resume 还原消费键，新会话/fork 使用新状态；已消费且中断的 hook 按已尝试处理。Skill hook overlay 在 shell 扩展、子日志与 hook 效果前校验合并后的总量，并预检分组 command。Prompt hook 使用一次无工具模型评估；agent hook 使用有界本地只读工具循环，最多八次模型调用、每批最多 32 个工具调用，保留输入权限与上下文预算检查。工具结果先持久化再运行成功/失败 hook，变换输出单独持久化；完整配对后运行 batch hook。Stop/SubagentStop 反馈在 `maxTurns` 内继续，`continue:false` 结束回合；TaskCompleted/WorktreeCreate 在副作用前门控。SessionEnd 整体限时 2 秒。33 个接受事件并非全部已有调用入口，完整接线和原版差异见 `research/HOOKS.md`。

新CLI会话另有 `stopHookBlockCap`（settings中0..1024，默认8）：连续允许8次Stop/SubagentStop延续，第9次阻止结束时返回 `stop_hook_limit`，headless退出码2。0关闭此上限，仍受maxTurns约束；旧日志缺省字段保留旧行为。延续计数随hook结果ID落盘，恢复同一决定不会重复计数，工具回合重置，compaction保留。源码与编译CLI分别验证默认8、自定义2和关闭上限，共15次本地SSE请求；原样本环境变量和结束原因命名未照搬。

权限支持 default、plan、acceptEdits、ask、bypass，工具名 allow/deny/ask globs 及输入 path/command 规则。deny 优先，plan 限制 read-only；acceptEdits 自动放行编辑，对其他可变工具询问。交互终端提供 Allow once；one-shot 使用显式规则或 PermissionRequest hook，修改后的输入再次检查。已配置 hook/MCP/LSP 进程按当前用户权限运行并继承环境。持久 MCP 配置保存 HTTP header 环境变量名称，stdio `env` 值字段不纳入会话。OAuth 按用户要求排除。

MCP client 能力由可选配置 `"mcpClient": { "roots": true, "sampling": true, "elicitation": true }` 或 CLI `--mcp-roots` / `--mcp-sampling` / `--mcp-elicitation` 显式开启；默认字段省略，恢复使用固定快照并禁止追加这些配置参数。Roots 返回规范工作区的 `file:` URI。Sampling 使用固定 model/共享 provider 预算，输入低于 compactAt、maxTokens 限于配置值，文本输出限于 min(maxOutputBytes, 64 KiB)；server 内容作为任务数据，主会话 system/history/tools 均省略。可信程序可用 `RuntimeOptions.mcpClientRequests(config)` 提供回调，隔离及 relocation 重新绑定。每个 host factory 最多 16 个实际阶段，取消返回后占槽至底层结束。`--mcp-elicitation` 要求 `--interactive`：活动用户回合显示 form schema，接收 JSON 对象、`:decline` 或 `:cancel`，最多三次校验尝试；startup、idle 事件、headless 及没有活动表单回调时返回 cancel。Elicitation/ElicitationResult hooks 已接线，URL elicitation 与 OAuth 保持排除。

标准MCP task可开启 `"features": { "mcpStandardTasks": true }`：新连接提出2025-11-25协议，只有协商到该版本且server声明tasks.requests.tools.call、工具execution.taskSupport为required/optional时才发送task增强调用。forbidden/缺省保持普通调用，required但未启用或缺capability在效果前报错。创建返回task wrapper，tasks/get校验状态/id/时间/ttl，终态及input_required通过tasks/result获得关联原工具结果；POST结果流可使用已有roots/form回调，关联metadata仅接受本连接活跃任务，任务结束取消未完成关联回调。默认1000毫秒、轮询夹在250–30000毫秒，最多5次连续失败，整个驱动仍限requestTimeoutMs；server声明cancel时独立5秒best-effort取消。旧协议与resultType扩展由各自开关保留。当前是前台requestor；同时开启`features.mcpNotificationStream`时，GET流按POST合同派发任意客户端请求：带关联metadata的roots/form走活跃任务所有权校验，未关联请求走同一能力门控，未配置的方法回-32601，答案经有界POST返回；承载过请求的流不再自动重开；同时开启`mcpRecovery`时GET流以最后事件id续传（last-event-id），server的SSE retry值优先于本地退避表，重放去重属server职责。服务端任务接收端经恢复源码核对无来源基础（mcp serve仅tools.listChanged）、列表/后台持久重挂、进度UI保留缺口。同时开启`mcpPersistence`与`mcpRecovery`时，标准HTTP任务创建句柄和有界结果写入当前会话日志；`mcp_task_recover`空参数列本地记录，传`server/taskId`显式取回或读取缓存，始终不重发原工具调用。恢复使用新HTTP session和当前环境凭证，远端过期/未知保留未决；取消恢复只结束等待。进程中断先用`--recover-lock --continue`收齐回合，再明确请求恢复。每会话最多128任务，结果最多24000 UTF-8字节；开启`features.mcpRecovery`后，失败的stdio子进程在下一次工具调用或catalog请求时重拨一个新进程（每次调用一次、无后台定时器、不重放已失败调用，重拨后仍复验固定工具元数据），未开启则保持原失败即断开语义，需显式`/mcp-reconnect`。验收：`npm run smoke:mcp-stdio-redial`（源码开/关恢复与编译恢复三模式）。动态目录在`tools/list_changed`到达时立即后台重取受影响server：与显式刷新同队列串行、按server合并（一次在途加至多一次跟进）、失败留脏交给下次调用而不后台重试、无定时器且随连接关闭中止，验收：`npm run smoke:mcp-list-changed-cli`（源码与编译）。下一轮自动重dial调度（恢复端默认关闭且依赖连接表行计数）与`subscriptions/listen`停驻重取（本运行时无该流）按[剩余项处置](research/ports/remaining-dispositions.md)判定为被现有常开有界恢复与替换后重取取代，不再作为待办。验收：`npm run smoke:mcp-tasks -- --standard --get --durable --compiled`；[持久任务记录](research/ports/W05-durable-tasks.md)；[标准任务记录](research/ports/W05-standard-tasks.md)。

MCP前台任务扩展可显式开启 `"features": { "mcpTasks": true }`。它处理工具返回的`resultType:"task"`，通过tasks/get轮询并以tasks/update回答roots/form请求，终态内联工具结果沿用既有输出预算、权限和journal配对。轮询250–30000毫秒、默认2000，连续失败最多5次，每任务最多16个输入key；update重试复用已收集答案。整体驱动使用requestTimeoutMs（默认30秒）和连接生命周期，取消以独立5秒信号best-effort发送tasks/cancel。HTTP任务请求携带Mcp-Name；stdio使用taskId参数。固定会话恢复保留开关并复用已完成工具结果；未知效果不自动重放。省略/false保持旧合同。此为resultType/tasks-update扩展，标准tasks/result、后台任务持久重挂及自动重放另保留缺口。验收：`npm run smoke:mcp-tasks -- --compiled`；[搬运记录](research/ports/W05-tasks.md)。

图片采样可在设置中开启 `"mcpClient": { "sampling": true, "samplingImages": true }`。samplingImages省略/false时保持文本合同；managed设置可覆盖此值，恢复使用固定快照。接收单块PNG/JPEG/GIF/WebP的规范base64，校验MIME与容器头/尺寸，整个采样请求仍限32KiB；原始字节通过Messages native image传输，server角色/systemPrompt作为引用任务数据，主会话历史、工具与凭证省略。共享调用/token预算、取消和文本结果上限保持；额外设置`samplingArrays:true`接收非空文本/图片block数组；samplingImages仍独立门控图片。每请求最多128块、总JSON限32KiB，保留各消息角色和block顺序，用1-based附件索引映射native图片。省略/false保持单块输入，managed和resume固定快照同样适用。数组验收：`npm run smoke:mcp-sampling-images -- --arrays --compiled`，见[数组记录](research/ports/W05-sampling-arrays.md)。音频采样在同一设置中加 `"samplingAudio": true` 开启：每段≤16 KiB、最多4段 wav/ogg/flac/webm/m4a/aac/mp3，声明 MIME 必须与签名识别出的容器一致（`;` 参数允许），字节写入私有附件目录并只回传 `[Audio from SERVER] Binary content (MIME, SIZE) saved to PATH` 文本引用，音频不进入 native block，存储不可用时降级为文本。音频验收：`npm run smoke:mcp-sampling-audio -- --compiled`，见[音频记录](research/ports/W05-sampling-audio.md)。采样块与消息还可携带惰性 `annotations`（audience 仅 user/assistant、priority 0–1、带偏移的 ISO lastModified）与 `_meta`（JSON 对象）：这些字段在 transport 校验后由 host 重建引用任务数据时剥离，不进入模型请求或会话日志；`tools`/`toolChoice` 与 tool_use/tool_result 块按恢复结果类型（仅 text/image/audio）在形状校验处拒绝。元数据验收：`npm run smoke:mcp-sampling-metadata -- --compiled`，见[元数据记录](research/ports/W05-sampling-blocks.md)。图片输出、resize与完整像素解码仍待扩展。验收：`npm run smoke:mcp-sampling-images -- --compiled`；[来源与证据](research/ports/W05-sampling-images.md)。

`features.mcpSubscriptions`默认false，显式开启且server声明resources.subscribe:true才提供subscribe/unsubscribe/notifications。Poll消耗本连接URI队列并报告丢弃，读取仍显式；32URI、128条/32KiB队列、4096字节URI。Stdio接推送；HTTP默认活跃POST SSE，额外mcpNotificationStream开关才启用ownedGET（见后文）。mcpRecovery开启连接替换恢复，mcpPersistence进一步开启会话journal恢复；省略事件重放与自动refetch。

```sh
npm run agent -- --workspace /absolute/path/to/project --interactive
npm run agent -- --workspace /absolute/path/to/project --list-sessions
```

交互命令：`/help`、`/status`、`/context`、`/usage`（`/cost` 别名）、`/effort LEVEL`、`/sessions [QUERY]`、`/rename TITLE`、`/agents`、`/mcp`、`/skills`、`/NAME args`、`/continue`、`/compact`、`/fork`、`/rewind N`、`/cwd DIR`、`/worktree NAME`、`/worktree-exit`、`/model ID`、`/plan`、`/permissions MODE`、`/clear`、`/exit`。`/sessions` 按 title/model/UUID 搜索，`/rename` 持久写入当前 session title；`/agents` 和 `/mcp` 展示固定目录与 adapter 限制。`/context` 检查预算；`/usage` 汇总响应/摘要 usage，不换算金额。配置切换及 `/fork` 创建新 UUID；`/rewind N` 只分支历史，联合文件恢复见下文。TTY 支持多行/grapheme 编辑、历史检索、有界 paste、回合取消和终端恢复，流式输入使用 readline。完整产品 TUI 与部分命令仍待迁移；当前新入口的验证单独记录，历史 759/879 基线保留。

Hook JSON 可返回 `terminalSequence`：最多4096 UTF-8字节，接受 BEL 及 OSC 0/1/2/9/99/777 的完整串联序列，清理 payload 控制字符并统一使用 ST 结束；OSC9 的数字子命令仅接受有界进度格式。整个字段校验失败就忽略，每个 hook 结果最多128条/32KiB，超额记录诊断。交互 TTY 直接写入独立终端通道，保持草稿；`suppressOutput` 只影响文本显示。同步结果保存于 `hook_result`；异步完成在已完成回合边界单独保存 `hook_terminal` 后投递，并从模型通知文本中移除序列字段。恢复日志不会重放。管道和 one-shot JSON 没有终端输出通道。输出端按 `TMUX`/`STY` 转义ESC并加透传包装，二者同时存在时选择tmux；日志保留规范化OSC，真实复用器解码效果尚待实测。PreCompact保留既有原始上下文规则。实际 `npm run smoke:hook-terminal-cli` 通过真实 Expect PTY启动/提交/退出、异步边界、错误字段丢弃、恢复与JSON输出，3次自有SSE请求；`--tmux`/`--screen` 验证可控环境下的输出字节，各3次请求。此前2次请求属于同步检查点。相关验证见 research/STATUS.md。

子代理终端转发现已接入：registry启动/恢复、旧式子代理、前台fork skill和后台skill共享回调。同步/异步子hook先保存子日志，再进入父owner的独立终端队列；最多50条/64KiB序列化字节，整条丢弃并记录计数，资源释放后旧回调失效。父交互回合边界先保存 `hook_terminal` 后输出，终端事件自身不触发模型回合。`node scripts/smoke-hook-terminal-cli.mjs --children` 已验证四条实际PTY路径、子父日志、管道恢复和headless JSON，13次本地SSE请求；增加 `--compiled` 可验证编译入口。当前仍待验证真实复用器解码及崩溃窗口内的显示交付。

`PostCompact` 的 `additionalContext` 与 `systemMessage` 现在共用 `suppressOutput`、控制字符清洗和 `maxOutputBytes` 显示预算，预算包括前缀、截断标记和换行。原始内容保留在 hook 日志中，压缩后的模型历史保持摘要；独立 `terminalSequence` 仍按既有通道投递。实际 `node scripts/smoke-hook-terminal-cli.mjs --post-compact` 与增加 `--compiled` 的流程分别通过9次自有本地请求，覆盖显示、隐藏、小预算、UTF-8完整性及日志/历史边界。

`Notification` 与 `TeammateIdle` 的附加文本也接入同一显示消费者：每次 hook 的上下文和系统消息合用预算，隐藏后仍保留日志，控制字符清洗后输出。空闲 hook 的 blocked/stopRequested 仍阻挡对应通知模型回合，显示文本保持模型历史之外。实际 `node scripts/smoke-hook-terminal-cli.mjs --event-display` 可验证子代理启动、消息续跑、空闲订阅及三种显示模式；增加 `--compiled` 使用编译入口。

压缩完成的 command hook 也可直接输出普通文本：成功且完整的非 JSON stdout 去掉首尾空白后保存为显示上下文，沿用清洗和预算。结构化 JSON 继续按既有字段解释。显示内容保留于日志，后续模型请求使用已提交摘要；失败、超时和超长输出继续沿用诊断合同。

该能力也已在当前编译入口验证：`node scripts/smoke-hook-terminal-cli.mjs --compiled` 通过相同流程。最新 `npm run smoke:package` 验证52文件包的临时离线安装、帮助和demo，包含新增hook-terminal.js；此前51文件记录属于GET及早期打包检查点。当前包依旧private，仅本地验证。

`/worktree NAME` 在已完成回合边界创建或进入当前工作区已登记且验证 ownership 的 checkout，重建 runtime 并迁移会话至新 UUID；`/worktree-exit` 默认返回并保留 checkout 和 branch。`/worktree-exit --remove` 先返回、释放旧runtime/日志锁，再将 checkout 的 `.agent` 移至原工作区 `.agent/worktree-history/NAME-UUID`，检查并移除owned checkout/branch。脏文件或未合并提交需要显式 `--discard-changes`；移除失败后当前会话已在原工作区，checkout仍存在时恢复原日志目录。归档扫描最多16层/10000项，发现锁即保留；历史归档不自动列入会话选择器。返回路径随会话保存。活动 worktree 内先退出再使用 `/cwd` 或进入另一 worktree；该入口未接 tmux，普通 `worktree_create` 仍仅创建目录。实际源码/编译CLI验证默认保留、显式移除、脏文件保留/日志恢复和显式丢弃，模型调用0；跨进程新增锁竞态与断电后的归档事务恢复仍待完善。

`ask_user_question`、`submit_plan` 与 `report_findings` 默认注册且标为 readOnly。交互循环提供实际选项/Other 文本、完整 Markdown 计划确认和带文件/行号/severity 的 findings 回调；队列、响应、取消与超时均有上限。提交计划返回 approved 布尔值，权限模式保持原值；权限切换仍由 `/plan` 或 `/permissions` 完成。headless 模式缺少 ask/plan 回调时返回明确且配对的工具错误，findings 仍返回经过验证的 JSON。

用户附件输入已接通，路径相对于当前 workspace；交互路径可加引号或使用反斜杠转义空格。每次提交一个 PNG/JPEG/GIF/WebP 或 PDF，沿用 10 MiB 文件限制和最多 20 页的 PDF 选择。图片/PDF 原生块随提示一起写入会话，恢复时使用日志中的字节，源文件随后删除也可继续讨论。`features.media: false` 关闭附件输入。

自动记忆可通过 `--auto-memory` 或 `"autoMemory": true` 开启，配置随会话固定。模型在正常回合中使用现有 memory 工具维护长期偏好、项目决定和难以从代码恢复的事实；策略要求写前检查目录/相关正文、按 SHA 更新、合并重复事实，省略临时进度和凭据。这是模型驱动的记忆策略，事实筛选质量取决于所配置模型。没有额外的记忆提取调用。每条新任务读取当前工作区的记忆目录与短正文，总量最多 16,000 UTF-8 字节；权限 ask/deny 跳过对应自动读取，写入仍经过常规工具权限和 hooks。`features.memory: false` 关闭读入和自动记忆策略。旧会话保持原配置。

新会话默认开启 `dynamicInstructions`：访问 `src/deep/file.ts` 时沿路径加载 `src/AGENTS.md`、`src/deep/HARNESS.md` 等指令及有界 Markdown imports；不会遍历无关子目录。每次最多 64 KiB，指令变更在后续路径访问时重新读取；首次写入先返回指令上下文，由模型重新判断并重试。跨工作区和保留目录的 imports 报错。可用 `"dynamicInstructions": false` 保持仅启动快照。

交互命令 `/reload` 在已完成回合边界重新读取本地指令、skills、agent catalogs、hooks、MCP/LSP、插件、功能开关、记忆策略与用户/项目 keybindings，重建 runtime 并切换到新 UUID 会话。模型、gateway、调用预算、窗口和输出上限保留；修改这些字段仍用对应命令或新启动参数。配置或快捷键校验错误时保留当前会话/runtime。新 system 前缀下剥离历史 signed thinking，原日志不变。TerminalKeyDecoder 原子校验替换 bindings，保留 pending paste、草稿及历史；删除覆盖文件后重载恢复默认键。Managed policy 仍待接入。

可选 `--watch-config` 要求 `--interactive`，也可设置 `"watchConfig": true`；默认省略，恢复沿用快照。本地 fs.watch 最多64 handles、2048 entries及2048输入路径、skill深度3、250ms debounce。除项目/用户 settings、keybindings、catalog、显式 settings 和插件 index，还精确监听 loadProjectConfig 读到的 instruction/conditionalRule/import 路径，可覆盖祖先/嵌套文件；保留路径约束，跳过运行数据。变更仅标记 dirty，完成回合后排队 `/reload`，中断回合先继续；切换/relocation 重绑当前 keys，退出关闭。实际 CLI/macOS expect 真PTY已验证热改键、草稿保留、错误配置后旧 runtime 可用，以及 model 切换/title 继承（8次自有SSE请求）。完整递归发现、未加载的动态 import 与插件正文 watcher 仍有差距。

文件与会话联合 rewind 已接入交互命令，默认使用显式 checkpoint；也可开启主会话自动快照：

```text
/checkpoint before_change
# Run coding tasks, then preview the checkpoint associated with completed turn N:
/rewind N --files
# Copy the exact Apply command printed by the preview:
/rewind N --files --apply TOKEN
```

`/checkpoint NAME` 保存当前文件状态并关联当前已完成回合；尚无回合时关联 N=0。预览列出恢复/删除的普通文件和保留的目录/symlink 变更，只有完整预览符合输出预算才给出 apply token。应用时重新校验文件、历史和 checkpoint 摘要；预览后的变更会使 token 失效。关闭旧会话的后台资源后恢复文件，并提交新 UUID 会话；原日志保持完整。新日志提交报错时回滚文件并删除未提交分支。原 `/rewind N` 仍只分支会话。
进程中断后的文件恢复可显式执行`/checkpoint-recover`。恢复仅处理持久事务中能证明归属的文件状态；遇到外部改动保留事务和文件，等待核对。已完整提交的新分支保留；未知工作流效果须显式选择`retry_interrupted:true`才会重试，完成任务继续复用。


恢复沿用 checkpoint 限制：2 MiB/文件、32 MiB 总量、2000 entries，排除 `.agent`、`.git`、`node_modules` 和 `.harness-worktrees`。新增普通文件会按预览删除；目录/symlink 保留，恢复缺失文件时可重建父目录。该入口覆盖运行中的失败回滚，进程强杀/断电后的跨文件与日志事务自动恢复仍待实现。`features.checkpoints: false` 关闭这两个新入口。

在项目 settings 中设置 `"automaticCheckpoints": true`，主会话会在新任务提示之前及完成回合后保存文件快照，随后可直接使用 `/rewind N --files`。默认关闭；旧日志缺省保持原行为。已有手动或自动关联的边界会跳过，恢复同一日志保持去重。子代理与未完成工具回合跳过自动捕获，每会话最多128个自动关联，沿用上述文件/总量限制。捕获报错通过 status 显示并保留任务结果；取消结束跳过最终快照。工作区全局保留策略、对象GC及捕获与日志关联之间的崩溃恢复仍待实现。

```sh
# One-shot task
npm run agent -- --workspace /absolute/path/to/project --attach "screenshots/error screen.png" "Explain this error"
npm run agent -- --workspace /absolute/path/to/project --attach docs/report.pdf --pages 2-4 "Summarize these pages"
```

交互模式输入：

```text
/attach "screenshots/error screen.png" 解释截图中的报错
/attach docs/report.pdf --pages 2-4 总结这些页
```

提示 hooks 处理文本，媒体读取使用当前回合的取消信号。附件加入前先检查完整请求预算；需要压缩时只摘要此前已完成历史，然后重新检查。过大的新附件在写入消息前报错，保持后续输入可用。默认 estimate 将 base64 的序列化字节计入保守预算，因此实际允许的附件往往低于 10 MiB；网关具备 token counting 时可选择 `--token-counting api`。当前保留图片原始字节并执行恢复来源的 API 图片上限：base64 载荷不得超过 5242880 字节（原始 3932160 字节，即该上限的 3/4），超出时在生成消息前报错并给出两个字节数与手动缩小建议；头部尺寸超过 2000x2000 的图片不拒绝，而是保留原字节并在摘要与 metadata 中标注 `exceedsDownscaleTarget`（该 2000px 值是恢复客户端通过缩放满足的多图约束，API 单图允许更大尺寸）。恢复客户端的缩放/重压缩依赖 Bun.Image 编解码器，本运行时没有可移植对应实现（限定搜索无结果记录在案），因此不做 resize/reencode。验收：`npm run smoke:media`。

交互 `/paste-image 解释截图中的报错` 显式读取 PNG：macOS 使用 osascript PNGf，Linux 使用 Wayland wl-paste 或 X11 xclip；Windows 图片剪贴板待迁移。读取最多 10 MiB、5 秒，临时文件存入 `.harness/attachments`（目录 0700、文件 0600），store 最多 128 个文件/64 MiB；回合结束清理仍为同一文件的附件，journal 已保存媒体字节。验证使用自有 PNGf provider 和实际 CLI/本地网关 fixture，真实用户剪贴板读取次数为 0。

后台任务和定时器按 session UUID 隔离。交互模式在当前回合完成后处理通知和到期提示，事件中的斜杠文本作为模型提示处理。`/clear`、`/fork`、退出和进程取消会清理旧会话任务与定时器；这是独立实现的生命周期选择，与原版部分保留后台状态的行为不同。一次性 CLI 结束时也会关闭后台任务，因此持续监控和定时任务应在交互模式中使用。旧日志缺少新 feature 字段时保留原工具池。

本批新增本地命令：`/tasks` 按 task_list 权限显示依赖/ready，`/workflows` 按 workflow_get 权限列出当前 owner 的运行和持久 snapshot，`/cron` 按只读 cron_list 权限显示当前 session 的有界调度列表，`/diff NAME [OFFSET]` 按 checkpoint_diff 权限显示每页最多50项文件差异。它们保持本地检查，省略模型调用和新 tool schema。增强scheduler实际CLI验证cronInspection，仍6次自有SSE请求（`/private/tmp/cc-reverse-scheduler-cli.log`）。

`/resume [UUID|QUERY]` 在完成回合后打开目标原配置/runtime并沿用UUID。UUID直接打开；无参或query按title/model/id/parentUUID筛选其他会话，单匹配自动打开，多匹配最多20项，编号或`:cancel`复用终端owner。完整selectionPrompt的header/choices/footer合计受maxOutputBytes限制，超限要求缩小query，保持完整列表。网关不同需重启CLI `--resume UUID`；未完成目标用`/continue`。完整prompt预算修正后实际expect PTY及TypeScript通过，8次自有SSE请求（`/private/tmp/cc-reverse-session-picker-cli.log`、`/private/tmp/cc-reverse-session-picker-check.log`）；完整原版TUI仍有差距。配置切换/reload/relocation剥离复制thinking/redacted，checkpoint重新索引，title按边界继承，原日志保留。

新增 hook transports：`type: script` 是同步 shell command；`type: callback` 仅解析可信 `RuntimeOptions.hookCallbacks` 命名函数，设置文件不导入 JavaScript；`type: mcp_tool` 要求可用的 readOnly namespaced tool 与输入权限 allow，直接调用而避免递归 hooks。Prompt/agent/callback/MCP resolver 每个实际 HookLifecycle 最多16阶段，超时后占槽至底层结束。Notification 在回合间观察，TeammateIdle 仅显式本地 idle 订阅且可门控通知回合，DirectoryAdded 观察 cwd/worktree relocation；forms 的事件接线见上文及 HOOKS.md。

后续 hook 显示已接入：hook_result 保存 systemMessages/suppressOutput，恢复可读取；控制符清理后的status共享maxOutputBytes，含生成前缀/截断标签/通常CLI换行，极小预算隐藏显示，外部可信consumer额外包装另计。suppressOutput保留context并隐藏显示，SessionEnd/Notification/TeammateIdle沿用门控，startup写stderr。最终独立37/37（1394.564375ms）及TypeScript通过，增强plugin实际CLI验证suppression/journal/可见SessionEnd，0模型/网络调用。日志`/private/tmp/cc-reverse-hook-display-tests.log`、`/private/tmp/cc-reverse-hook-display-check.log`、`/private/tmp/cc-reverse-hook-display-cli.log`；terminalSequence与完整消费者仍有差距。

可信callback已传播到registry child启动/邮箱续跑、legacy子代理和user/model foreground skill，background skill走registry；子会话独立HookLifecycle/once与async清理保持原合同，函数仅由可信host提供，JSON不导入代码。独立50/50（1989.057833ms）、最终TypeScript及public runtime boundary smoke通过child/mailbox/foreground/background/ownership/locks，4次自有脚本provider调用、三个独立once callback；这是runtime boundary实测，并非CLI。日志`/private/tmp/cc-reverse-child-callback-tests.log`、`/private/tmp/cc-reverse-child-callback-check.log`、`/private/tmp/cc-reverse-child-callback-smoke.log`；未请求付费模型。

Skill可用frontmatter `context: fork` 与 `agent: TYPE`（名称最多128字符）路由builtin general/explore或固定custom类型。类型body/model/effort/maxTurns与scope进入子执行；skill显式model/effort覆盖类型，inherit沿父设置，工具取type∩parent∩skill grants，maxTurns受父上限。未知type在效果前报错；type isolation经registry创建owned worktree，foreground/background沿现有接口，回合配对/once/清理合同保留。例如在review skill正文前配置这两个字段即可由对应类型执行`/review`。最终68/68（3226.551625ms）与TypeScript通过，实际CLI三次foreground/background/worktree invocation共6次自有SSE请求，验证body/model/high effort/read_file/tool交集和checkout/lock清理，临时Git HEAD保持原值。日志`/private/tmp/cc-reverse-skill-agent-tests.log`、`/private/tmp/cc-reverse-skill-agent-check.log`、`/private/tmp/cc-reverse-skill-agent-cli.log`；完整原版inline/type alias仍有差距。

技能参数支持原始 `$ARGUMENTS`、零基 `$ARGUMENTS[n]` 及原有一基 `$1`–`$9`。例如 `/review alpha beta` 中 `$ARGUMENTS[0]` 为 `alpha`，`$ARGUMENTS[1]` 为 `beta`。缺失索引保留完整 token，缺失 `$1`–`$9` 位置仍为空；参数文本仅替换一次，其中的 `$1` 保持字面量。默认按空白分词，引号保持普通字符。可设置 `"features": { "skillQuotedArguments": true }`，启用单双引号分组、相邻片段拼接、空引号和转义处理；例如 `"alpha beta" gamma` 的索引0为 `alpha beta`。未闭合引号或末尾转义回退原空白拆分，原始 `$ARGUMENTS` 始终保留输入文本；解析器只处理文本，参数中的变量/命令表达式保持字面量。开关固定入会话并支持 reload/managed 覆盖；完整原版 shell AST 行为仍有差距。主会话、foreground/background/worktree skill、内联命令和模型调用 `skill` 共用这些规则。

可显式设置 `"features": { "skillInlineCommands": true }`，执行技能原始正文中的 `!` 后接反引号命令，以及围栏 ```` ```! ```` 代码块；两者都在参数替换前从原始正文提取，按出现顺序逐条预检后执行，原始片段被命令输出替换，块内已有的行内标记不再二次执行，命令文本先做去空格与 CRLF 归一。无需额外 `shell`/`command` frontmatter，默认使用 `/bin/sh`。验收：`npm run smoke:skill-fenced-cli`（源码与编译）。此开关默认省略/false，旧会话保持正文原样；设置固定入会话并支持 reload/managed 覆盖。命令仍要求 `allowShell` 和当前权限/grants；先校验整组命令再执行，沿用30秒默认期限、120秒最大期限和 maxOutputBytes。参数替换及命令输出中的新指令标记保持字面量，用户 slash 与模型 `skill` 共用入口。已有 shell/command 元数据继续使用既有显式执行行为。

自动快照重试使用会话 UUID 加随机后缀命名，捕获成功但日志关联失败时，下一次会重新捕获当前文件状态；遗留快照保持原字节，避免把较早文件状态误关联到新边界。孤立快照清理和跨文件/日志事务恢复仍待实现。

`"features": { "skillArgumentFallback": true }` 可保留未被正文使用的参数：原始正文没有成功替换参数占位符且 args 非空时，在末尾追加 `ARGUMENTS: 原始参数`。缺失索引保持原 token；已有成功替换就跳过追加。默认关闭并固定到会话，支持 reload/managed 覆盖。内联命令执行时仅追加到最终模型指令，Shell 命令字符串保持原展开结果。

`"features": { "skillExtendedArguments": true }` 显式切换数字占位符为零基索引：`$0` 是首个参数、`$1` 是第二个参数，支持 `$12` 等多位形式，缺失位置保留原 token。单个反斜杠转义的 `\$ARGUMENTS`、`\$1` 会移除该转义并保留字面量；参数内容仍只替换一次。开关默认关闭，旧会话的一基 `$1`–`$9` 保持原行为。可与引号分词及参数兜底组合使用；命名参数和完整原版 shell AST 仍待迁移。

技能 frontmatter 可声明 `arguments: [target, branch]` 或 `arguments: target branch`；正文 `$target`、`$branch` 按声明顺序对应位置参数。最多128个唯一 ASCII 标识符，每个最多128字符，允许字母/下划线开头及字母/数字/下划线/连字符。名称最长优先匹配，后续字母/数字/下划线或 `[` 阻止部分替换；`\$target` 保留字面量，缺失命名位置替换为空。名称进入会话快照，模型加载、子执行和内联命令共用规则，旧快照缺少名称时保持原行为。

技能可声明 `aliases: [quick, team:review]` 或空白分隔字符串，最多32个唯一名称，每个最多128字符。用户 slash 和模型 `skill` 先查精确名称，再查唯一别名；冲突会报错并要求完整技能名。slash 已支持 `/team:review:quick 参数` 这种多段命名空间，目录及 `/skills` 展示已固定别名；内置交互命令仍优先。插件技能名称仍按当前配置加载，自动插件命名空间生成另待迁移。

`"features": { "pluginSkillNamespaces": true }` 为经过 digest 验证的已安装插件技能添加 `PLUGIN:NAME` 前缀，原短名称作为别名。两个插件的同名技能可分别调用；项目/用户的精确短名称优先，多个插件共享短名时要求使用完整名称。默认关闭，旧会话目录保持原名称；显式 pluginDirs 沿用原本地目录规则。名称、正文和别名固定进会话，reload 才读取新目录；managed feature 覆盖在加载前生效。

自定义 agent YAML 可声明 `aliases: [quick-reviewer]` 或空白分隔字符串，最多32个唯一名称，每个最多128字符，名称规则与类型名一致。`agent:` 技能路由和模型 `subagent_type` 先找精确类型名，再找唯一别名，歧义报错；fork/explore/general 保留为内置名称。别名固定在会话类型目录中，并显示于模型目录及 `/agents`。这是独立本地类型别名合同，远端 peer 名称和完整原版命名行为仍有差距。

同工作区的子代理及 fork 技能按需读取指令文件后，路径也会转发到父 owner 的监听集合。路径队列去重，最多2048条/64KiB、单路径4096字节；完成边界只更新 watcher，路径事件自身保持零模型调用。释放旧 owner 后忽略晚到路径，异工作区 worktree 路径跳过，headless 不建立 watcher。目录表仍为进程内状态，新建但未访问的深层指令和跨进程恢复另待迁移。

按需发现的监听路径现在保存为独立 `instruction_watch` JSONL 事件，写入成功后才加入 watcher；事件保持工作区身份、绝对路径、2048条及64KiB序列化路径预算。恢复同一会话或同工作区 reload/fork/配置分支时重建目录，文件内容仍在实际访问时读取；路径元数据保持模型历史之外。工作区切换只载入匹配记录，旧日志缺省保持原行为。异工作区子代理路径、新建未访问文件和全目录覆盖仍有差距。

已登记的工作区指令/import 父目录现在额外过滤监听 `HARNESS.md` 和 `AGENTS.md` 的新建、替换或编辑；普通相邻文件仍忽略，避免结果文件触发重载。沿用64 watchers/2048 entries预算，保持目录深度和 symlink 边界。进程恢复后的路径目录同样具备此行为；完全未登记目录的发现另待实现。

首次访问合法目录中的文件时，即使该目录尚无指令文件，也会登记已走过祖先目录的 `HARNESS.md`/`AGENTS.md` 候选。随后创建指令即可触发完成边界重载；主代理与同工作区子代理共用持久路径登记。候选仅作为监听元数据，实际存在的文件内容才进入上下文。沿用保留目录排除、realpath confinement、深度与路径/watch预算；尚未访问的目录和隔离 worktree 子代理仍有差距。源码版及编译版实际 watcher/PTY/恢复流程分别通过43次自有本地 SSE 请求，离线包验证通过52个文件、上游请求0。

## 工具

| 工具 | 行为 |
| --- | --- |
| `read_file` | 从指定的 1-based 行开始读取，最多 2,000 行，限制输出 |
| `list_files` | 列出相对路径，支持 glob 和结果数量上限 |
| `search` | ripgrep literal/regex 搜索，限制结果和输出 |
| `write_file` | 默认要求目标不存在；显式 overwrite 可覆盖；临时文件、fsync、rename |
| `edit_file` | 默认要求唯一文本匹配；可显式 replace_all；替换文本按字面量插入 |
| `run_command` | 显式开启后运行 `/bin/sh -c`，超时最多 120 秒，合并 stdout/stderr 并保留输出尾部 |
| `notebook_read` / `notebook_edit` | nbformat 4 单元读取、插入、替换、删除；8 MiB 上限，代码编辑清空旧执行结果，原子写入 |
| `task_create/get/list/update` | `.agent/tasks.json` UUID/DAG；get/list 隐去内部 metadata、过滤已完成 blocker；taskProjections 增加 blocks/ready 和 update addBlocks/removeBlocks 原子边操作 |
| `skill` | 加载快照正文或执行 fork/background 技能、工具 grants、hook overlay 与内联 shell |
| `agent` | 独立子日志、general/explore/YAML 类型、subagent_type: fork、model/effort 选择、命名、前台/后台和可选 worktree 隔离；fork 继承父 model/effort |
| `list_agents` / `send_message` / `get_agent` / `stop_agent` | owner 内代理目录、串行邮箱、完成后恢复原日志、等待与取消 |
| `workflow_run` / `workflow_get` | 有界声明式 DAG、并发/失败跳过、后台状态；workflowPersistence 增加同 owner 的 resume_from/显式 retry_interrupted |
| `read_media` | 原生 image/document blocks，10 MiB 输入，图片需在 5 MiB base64 API 上限内，至多 20 个选定 PDF 页 |
| `web_fetch` / 可选 `web_search` | 有界 HTTP(S) 获取和 HTML/文本处理；搜索使用显式配置后端，已通过 759 项基线验证 |
| `lsp` | 显式配置的 stdio 服务器，懒初始化、诊断、定义/引用/hover/symbols/call hierarchy |
| `memory_list/read/write/delete` | `.harness/memory` 本地文档与 digest 冲突检查 |
| `plugin_list/install/update/remove` | plugins.enabled 显式开启后注册；目录复制/digest 检查；新会话或 reload 发现 skills/agents/hooks/MCP 组件 |
| `ask_user_question` / `submit_plan` / `report_findings` | 默认交互工具；只读回调、选项/Other、完整计划确认与类型化 findings；计划确认保持权限模式 |
| `checkpoint_create/list/diff/restore` | 有界文件快照、digest 确认、默认 dry-run、失败回滚；会话历史独立 |
| `worktree_create/list/remove` | Git checkout/分支 ownership 检查；创建本身保持当前 cwd |
| `run_background` | 后台 Shell，默认 120 秒，最长 30 分钟；读取有界 stdout/stderr 尾部 |
| `monitor` | Shell stdout 行通知或 WebSocket 消息通知；stderr 单独保留；默认 300 秒，最长 30 分钟 |
| `get_background_task` / `task_stop` / `read_notifications` | 获取状态/输出、取消进程组、读取通知队列 |
| `cron_create/delete/list` | 本地时区五字段 cron，最多 50 项，一次性自动删除，循环任务七天到期 |
| `schedule_wakeup` | 独立动态唤醒槽，60–3600 秒，重新安排替换旧槽，stop 清空 |
| `mcp__SERVER__TOOL` | 已配置 stdio/HTTP MCP 工具，固定 schema、取消、输出上限 |
| `mcp_tool_search/call` / `mcp_refresh` | 可选动态 catalog；deferred 模式发布稳定 discovery/call 工具并返回远端 schema |
| MCP resources/prompts catalog | 按 capability 提供 list/templates/read 和 prompts list/get；订阅另由 mcpSubscriptions 显式开启 |

Monitor 可选 `command` 或 `ws`，二者互斥。例如：

```json
{
  "ws": { "url": "ws://127.0.0.1:9000/events", "protocols": ["events.v1"] },
  "description": "本地构建事件",
  "timeout_ms": 300000
}
```

WebSocket 模式接收文本消息，每条消息作为一个事件保留其中换行；二进制只报告字节数。连接失败和关闭码通过通知与作业状态显示；取消、超时和会话清理会关闭连接。它共用会话作业限额，不依赖 `allowShell`；Shell 模式仍需开启该配置。旧会话恢复时保留原有 command-only schema。与原版的静态行为差异见 `research/MONITOR.md`。

后台作业默认最多 16 个并发、保留 100 个已结束作业；通知有数量/字节限额和丢弃计数。调度与代理目录保持进程内状态。子代理共享工作区和 task store；worktree isolation 创建独立 runtime、父工作区子日志及可续跑 lease，stop/失败/淘汰/父关闭清理，dirty/unmerged checkout 保留并报告 cleanup_error。主会话 worktree 入口见上文，tmux 与跨进程 peers 仍有差距。MCP stdio 保持 2024-11-05 handshake（form 为显式扩展），HTTP 协商 2025-03-26/2025-06-18。开启 `mcpNotificationStream` 后，GET 流上的任意客户端请求按 POST 合同派发（能力门控、关联任务所有权、取消与有界回复），未配置的方法回 -32601；承载过请求的流不再自动重开，仅通知的流保持有限重开预算。回调有独立取消/期限、32 KiB 输入、1 MiB 结果/frame、每连接 16 个实际活跃槽，超时后占槽至结束，close 忽略晚到结果；JavaScript 回调依赖协作取消。MCP tasks、重连与 sampling 扩展仍为 Partial，OAuth 为 Excluded。

后续调度新增可选 `"features": { "schedulerJitter": true }`，设置存在时才固定入新会话，旧字段省略或false维持精确时间。自主 SHA-256(jobUUID:nominal) 算法使 recurring 延后至多 min(下一间隔10%,15分钟)；one-shot名义分钟为00/30时最多提前90秒且晚于创建基准，其他one-shot/wakeup精确。独立52/52回归及TypeScript通过，日志`/private/tmp/cc-reverse-scheduler-tests.log`和`/private/tmp/cc-reverse-scheduler-check.log`。最终`npm run smoke:scheduler-cli`通过固定开关、真实cron工具、scheduled回合、recurring上限、取消/锁清理，6次自有SSE请求（`/private/tmp/cc-reverse-scheduler-cli.log`）。调度保持进程内，自主算法未建立原版等价，持久恢复待实现。

`features.workflowPersistence` 和 `features.taskProjections` 在新 CLI 会话默认 true，旧会话缺少字段保持原 schema。Workflow snapshot 位于 `.agent/workflows/SESSION_UUID/RUN_UUID.json`，最多 128 runs、每份 2 MiB，含完整 DAG/settings digest 和有界 summary。`workflow_run` 提交相同完整定义并带 `resume_from` 时创建新 run，复用 completed summaries，failed/cancelled/skipped 重新执行；崩溃遗留 running 效果未知，检查 child session 后显式设置 `retry_interrupted: true`。活跃 owner lock 保留；恢复 guard 崩溃需核对 PID 后显式处理 `owner.lock.recovery`。持久化失败中止调度并报告错误，容量满需显式归档；原版脚本 Workflow、子进程重挂和效果回滚仍待实现。

文件工具只接受相对路径，解析现有祖先的 symlink，检查工作区边界，并排除 `.agent` 及其 symlink 别名。搜索/列表包含隐藏文件，遵循 ripgrep 的其他忽略规则。这些检查针对正常文件系统状态；并发路径替换和硬链接别名没有经过敌对场景验证。

工具批次按顺序执行，保证同批次依赖与写操作顺序。Agent.result 将最终工具结果的文本总量统一限制在 maxOutputBytes（默认 24,000 UTF-8 字节）内，截断标记也计入预算，自定义工具和 post-hook 替换均经过该检查。文本截断保留完整 UTF-8 前缀；超长 JSON 在预算充足时返回 truncated、originalBytes 与显式 preview，极小预算使用有效 JSON fallback（1–2 字节为 0），不保证每个 fallback 都含截断标签。原生 image/document 块沿用媒体工具的独立输入/页数限制，不占用该文本预算。模型 stop reason 为 `max_tokens` 或其他非 `tool_use` 状态时，携带的工具调用会配错误结果，保持消息协议完整。

Shell 在取消、超时及父 Shell 退出时清理所在进程组。自行创建独立 session/process group 的后代不在这个清理保证中。Shell 的非零退出、超时、取消通过输出状态报告；当前不会单独转成 `tool_result.is_error`。

后续 MCP logging 显式开启 `features.mcpLogging: true`，默认省略/false；server声明logging才注册 `mcp_logging_set_level` 与只读 `mcp_logging_notifications`。八个level、每连接128条/32KiB队列、单条16KiB、metadata4KiB、logger1KiB、JSON深度16/2048nodes；poll显式消耗队列，丢弃数明确。实际stdio推送及HTTP CLI3次自有请求通过；HTTP仅活跃POST SSE，无GET/重连/重放/持久化/自动动作，close清空。独立2/2（366.575417ms）、affected82/82（4962.689625ms）与TypeScript通过，各计数分开；日志`/private/tmp/cc-reverse-mcp-logging-tests.log`、`/private/tmp/cc-reverse-mcp-logging-affected.log`、`/private/tmp/cc-reverse-mcp-logging-stdio.log`、`/private/tmp/cc-reverse-mcp-logging-cli.log`、`/private/tmp/cc-reverse-mcp-logging-check.log`。

可选HTTP通知流 `features.mcpNotificationStream: true` 默认省略/false，旧快照POST-only。初始化后异步启动同URL GET SSE（不等headers），沿用session/protocol/auth及redirect限制；header/read idle为requestTimeoutMs默认30秒，handshake有界，增量parser保持frame/line/chunk限制，close取消并最多等1秒。404/405 unavailable、204/EOF ended，失败仍可POST，无自动retry/reconnect/replay。默认只处理id-less logging/resources/toolsdirty/cancel通知，带id request/response忽略。标准task模式协商到2025-11-25后，带关联metadata的roots/form请求进入既有owner处理器，答案POST返回；取消通知与输入并行读取。相关验收：`npm run smoke:mcp-tasks -- --standard --get --compiled`。`/mcp`在显式开启且HTTP存在时显示`notificationStreams`状态快照。最终CLI3次自有请求通过GET/idle/close/inspection/pin/locks，POST日志false（`/private/tmp/cc-reverse-mcp-stream-status-cli.log`），TypeScript通过（`/private/tmp/cc-reverse-mcp-stream-status-check.log`）。公开`npm run smoke:mcp-notification`通过一次GET的idleLogs/resources/concurrentPOST/reader关闭（`/private/tmp/cc-reverse-mcp-stream-public.log`）。Worker报告2/2和相关48/48为inline结果，耗时未知、无持久日志，各计数独立。前文无GET描述属于默认/历史合同。

2026-10-11 GET状态接线后的`npm run build` exit0（`/private/tmp/cc-reverse-mcp-stream-build.log`）；compiled bin实际CLI3次自有请求通过compiledCLI/streamInspection/GETidle/close/locks（`/private/tmp/cc-reverse-mcp-stream-compiled-cli.log`）。当前GET源码的`npm run smoke:package`重跑exit0（`/private/tmp/cc-reverse-mcp-stream-package.log`），51文件、临时离线production安装、installed help/demo、tsx缺席、研究数据排除、上游请求0均验证；private/未publish/未globalinstall和macOSNode26范围保持不变。前述logging独立批次的POST-only结果属于当时检查点，当前显式GET开关合同见上文。

## 上下文配置

应用默认值：

| 配置 | 默认 |
| --- | ---: |
| `contextTokens` | 1,000,000 |
| `compactAt` | 512,000 |
| `maxTokens` | 16,384 |
| `maxTurns` | 30 |
| `maxOutputBytes` | 24,000 |

这些是独立应用配置，与运行本项目开发的宿主配置分别管理。部署的真实窗口需单独核实；服务端小于此值时需调低配置。

父流程确认宿主配置文件的 context/window 均为 1,000,000，自动压缩百分比为 52.2449。按已记录的源码公式，在实际解析窗口为 1M 且输出上限为 128k 时对应 512,000 阈值；当前宿主进程是否重载这些设置仍待验证，重启后恢复会话可确保启动时读取新配置。模型目录可能限制实际窗口。此宿主百分比与独立应用的直接 `compactAt=512000` 设置分别记录，详见 `research/STATUS.md`。

可显式设置会话预算：

```sh
npm run agent -- --workspace /absolute/path/to/project \
  --context-tokens 1000000 --compact-at 512000 "任务"
```

配置值不会扩展服务端模型实际窗口。每轮调用前使用 token counting；达到或超过 `compactAt` 时生成摘要，再以摘要开始新的消息历史。原 JSONL 全部保留，旧 thinking/signature 不会带入新的摘要前缀。摘要后迅速再次达到阈值会触发断路器。

`maxTurns` 限制任务循环轮数，摘要请求另外产生模型调用；终端的 `model calls` 计数目前只包含任务循环调用。首次输入超过配置阈值会报错；极接近实际服务端上限的摘要请求尚无专门降级策略。

## 样本提取与索引

```sh
npm run extract -- /absolute/path/to/SAMPLE /absolute/path/to/NEW_DIRECTORY
node scripts/index-modules.mjs /absolute/path/to/EXTRACTION /absolute/path/to/NEW_INDEX.json
```

输出目录和索引文件需尚不存在。脚本位于 `scripts/`，恢复内容只作为数据读取，不执行。

当前有效数据：

- `extracted-v2/manifest.json`：2,609 个记录、原始文件偏移和 SHA-256。
- `extracted-v2/modules/`：按图的 encoding 解码/保留的内容。
- `research-module-index-v3.json`：2,366 个文本模块的静态索引，0 parse failures，3 个 JS 后缀二进制资源单独分类。
- 原生布局证据与样本身份：见 `research/STATUS.md`。
- `research/STATUS.md`：样本身份、研究结论、迁移机制、未完成项及验证状态。

旧 `extracted/` 和旧索引作为历史产物保留。早期提取错误影响了三个二进制 JS 后缀资源和 16 个 UTF-16 文档资源；后续研究使用 `extracted-v2/`。三个二进制资源尚未解释其 loader 格式，不作为可读源码解析。

索引的 `start/end` 是 UTF-16 字符索引，end exclusive；`bytes` 是 UTF-8 文本长度。字符坐标不能直接加到原生文件偏移上。

## 验证范围与下一步

当前组合源码最终`npm run check`通过（exit0，`/private/tmp/cc-reverse-migration-current-check.log`）；后续文档编辑仅涉及本README及FEATURES/STATUS/HOOKS，未改变已验证源码。以下全量基线与连续专项按各自检查点记录，保持独立计数。

离线测试覆盖消息配对、thinking/signature 保存、取消、截断、路径约束、日志锁、故障恢复、摘要断路器，以及 CLI 演示/恢复。Node 26 与固定 tsx 版本组合产生 `DEP0205` deprecation warning，当前检查和测试仍通过。

2026-10-11 本轮 hooks/MCP 最终全量：948/948 项离线测试通过，零失败、零取消、零跳过，耗时 29,344.12325 ms；日志为 `/private/tmp/cc-reverse-hooks-mcp-final-tests.log`。标准 npm test 使用 `--test-concurrency=4` 并保留 `--test-timeout=20000`，限制并行 fixture 数量而保持原期限。TypeScript 检查 exit 0（`/private/tmp/cc-reverse-hooks-mcp-final-check.log`）；CLI help 与离线 demo 均 exit 0，demo 三次脚本化调用、write/read 配对与 end_turn（`/private/tmp/cc-reverse-hooks-mcp-help.log`、`/private/tmp/cc-reverse-hooks-mcp-demo.log`）。先前 879/879 基线（20,931.425375 ms，`/private/tmp/cc-reverse-full-merged-final.log`）与首轮 944 项超时结果保留为历史证据，详见 `research/STATUS.md`。

后续附件迁移以实际 CLI 操作为主：`npm run smoke:media` 启动真实 CLI 进程和自有本地 Messages SSE 网关，验证单次图片输入、删除源文件后的恢复、交互 PDF 第 2 页、错误后继续任务及退出释放锁。检查通过，共 3 次网关请求；这验证本地传输与会话行为，真实模型视觉理解仍待实测。仅新增 3 个必要回归，与现有交互检查合计 9/9 通过，TypeScript 通过；日志为 `/private/tmp/cc-reverse-media-cli-smoke.log`、`/private/tmp/cc-reverse-media-tests.log`、`/private/tmp/cc-reverse-media-check.log`。此次未重跑全量，948 项结果属于附件迁移前基线。

联合 rewind 验证：`npm run smoke:rewind` 驱动实际 CLI 建 checkpoint、两回合写文件、拒绝过期预览、重新预览并恢复文件与历史、继续任务及释放锁。自有本地 SSE 网关共 5 次请求，操作链通过。仅新增 3 个回归，连同现有 checkpoint/interactive 检查 26/26 通过，TypeScript 通过；日志 `/private/tmp/cc-reverse-rewind-cli-smoke.log`、`/private/tmp/cc-reverse-rewind-tests.log`、`/private/tmp/cc-reverse-rewind-check.log`。全量基线未重跑。

记忆/重载批次：`npm run smoke:memory-reload` 驱动实际 CLI 完成 memory 写入、下回合读取、A-B-A 内容变更刷新、指令/skills/工具池重载、子目录写入前指令与损坏配置后继续使用。自有本地 SSE 网关 10 次请求通过。删除设置项后重载恢复默认值，显式 CLI 覆盖仍保留。只新增 4 个关键回归；相关既有 CLI/交互/附件/rewind 检查一起 19/19 通过，TypeScript 通过。日志 `/private/tmp/cc-reverse-memory-reload-cli.log`、`/private/tmp/cc-reverse-memory-reload-tests.log`、`/private/tmp/cc-reverse-memory-reload-check.log`。模型自主筛选记忆和真实上游表现仍待实测。

此前 879 项全量包含 agent 类型、父上下文 fork、worktree 隔离、同步/后台 skill fork、插件管理和实际交互回调，以及两项清理审计修复：registry 活跃与已完成子代理的 get(wait)/stop 等待共享 environmentClosing，独立子代理保留成功结果并附 checkout cleanup_error。专项记录为 registry/subagents 45/45、实际 Git isolation 10/10、skills 26/26；这些回归均已纳入该基线。

输出与边界验证包含 tool-output 8 项、custom/post-hook JSON journal/resume 2 项、511999/512000 阈值 2 项及外部日志存储 17 项；存储测试已在默认 `test/` 目录。当前输入达到 compactAt（默认 512000）时触发压缩，511999 时保持未压缩。最终文本结果以 24,000 字节默认上限检查，UTF-8 前缀和有效 JSON preview/fallback 行为均有回归覆盖；原生媒体维持独立限制。

759/759 是此前已通过基线（`/private/tmp/cc-reverse-full-final.log`，约 17.75 秒）；837 项的 835 通过、1 失败、1 取消是 fork seed-boundary 修复前记录，后续修复与新增测试已纳入 879 项最终结果。CLI fixture 使用本地 HTTP/SSE/WebSocket 和脚本响应，真实 Magpie/上游模型与实际窗口仍待验证。

连续迁移最终验证：TypeScript `npm run check` exit 0（`/private/tmp/cc-reverse-continuous-final-check.log`）；watcher/terminal 40/40（8294.026917ms，`/private/tmp/cc-reverse-config-watch-tests.log`），session 22/22（1488.547583ms，`/private/tmp/cc-reverse-session-transition-tests.log`），各零失败/取消/跳过。此前连续定向156/156（6853.133083ms，`/private/tmp/cc-reverse-continuous-focused.log`）属于较早检查点；计数相交，保持独立。Workflow恢复、插件组件、MCP表单/stdio订阅、剪贴板、task投影、真实Git worktree、记忆/rewind及watcher/expect真PTY实际CLI均通过自有fixture。最终watcher CLI为8请求，日志`/private/tmp/cc-reverse-config-watch-cli.log`；各操作与日志见 STATUS。未重跑全量，948/948仍为历史基线。

继续保留 Partial 的项目包括完整 TUI/headless I/O、完整 hook 生命周期/原版输出语义、skill/agent/脚本 Workflow 合同、marketplace/发布/完整插件语义、模型自主 auto-memory、rewind 全局快照保留与崩溃恢复、MCP tasks/自动重连/sampling 扩展、图片 resize 与 Windows 剪贴板。主会话自动快照和显式整体 MCP 重连已有独立入口；显式 checkpoint 联合 rewind 的历史 CLI 验证保留。远端/cloud peers、artifacts/design/connectors/projects/files/push/runners 依赖真实后端；OAuth 和自动厂商署名/推广/水印为 Excluded。完整清单见 `research/FEATURES.md`，尚未证明全部运行时行为等价。
