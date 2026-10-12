# 当前项目工作清单

更新：2026-10-12。执行规则见 [WORKFLOW](../WORKFLOW.md)。这是当前排程与审核处置的唯一入口；历史报告保持原记录。

## 当前结论

本地工作包W04恢复链、W05启动/慢恢复、W06已使用技能消费者及W07本地交付已完成有限验收；功能族整体仍为Partial。当前全量1052/1052、零失败；[技能围栏shell](ports/W06-skill-inline-fenced.md)完成围栏```!块与行内标记的统一提取、顺序预检执行与块内不二次执行，并将hook `once`按恢复源核对为本运行时超集；[list_changed即时重取](ports/W05-list-changed-refetch.md)完成动态目录在通知到达时的即时后台重取、按服务器合并与失败留脏；[stdio重挂](ports/W05-stdio-redial.md)完成恢复开关下的下次使用重dial与固定元数据复验；[图片API上限](ports/W05-image-limits.md)完成base64上限落地、超target尺寸标注与resize无来源结论；[采样内容元数据](ports/W05-sampling-blocks.md)完成块/消息annotations与_meta的惰性接受、host侧剥离及工具块拒绝；[GET续传](ports/W05-get-resume.md)完成last-event-id续传与server retry优先；[GET通用请求](ports/W05-get-dispatch.md)完成GET流上任意客户端请求的POST等价派发与承载请求不再重开；[音频采样输入](ports/W05-sampling-audio.md)完成采样门控/容器校验/私有附件落盘/文本引用与固定恢复链；[持久HTTP task恢复](ports/W05-durable-tasks.md)完成句柄/有界结果落盘、SIGKILL后显式取回和缓存复用；[GET关联输入](ports/W05-get-task-inputs.md)完成关联roots/form、POST答案、取消与关闭；[标准MCP task requestor](ports/W05-standard-tasks.md)完成2025-11-25协商、tasks/get/result、关联roots/form、取消与固定恢复链；[混合采样数组](ports/W05-sampling-arrays.md)已完成transport/host/固定恢复链。[MCP前台task扩展](ports/W05-tasks.md)已按来源adapt并完成HTTP/stdio、输入、取消与恢复链。图片采样完成固定配置/managed门控/预算/原字节CLI链，见[W05图片采样](ports/W05-sampling-images.md)。跨进程MCP订阅包完成编译CLI真实SIGKILL、固定配置、fork隔离、取消/失败恢复，58文件离线安装通过，见[W05持久化](ports/W05-persistence.md)。历史全产品来源审计、完整TUI/MCP扩展与事件重放仍是功能族缺口，不以有限包验收代替。

当前身份见[技能围栏shell证据](ports/W06-skill-inline-fenced-evidence.json)，193文件源码重建108输入/81测试/55构建文件字节一致（合并身份f13a4fd7…），62文件离线安装通过；[list_changed即时重取证据](ports/W05-list-changed-refetch-evidence.json)，193文件源码重建108输入/81测试/55构建文件字节一致（合并身份04878736…），62文件离线安装通过；[stdio重挂证据](ports/W05-stdio-redial-evidence.json)，191文件源码重建55构建文件字节一致，62文件离线安装通过；[图片API上限证据](ports/W05-image-limits-evidence.json)与[采样内容元数据证据](ports/W05-sampling-blocks-evidence.json)保留原作用域。[GET续传证据](ports/W05-get-resume-evidence.json)，191文件源码重建55构建文件字节一致，62文件离线安装通过。[GET派发证据](ports/W05-get-dispatch-evidence.json)，191文件源码重建55构建文件字节一致，62文件离线安装通过。[音频采样证据](ports/W05-sampling-audio-evidence.json)，191文件源码重建55构建文件字节一致，62文件离线安装通过。[持久task证据](ports/W05-durable-tasks-evidence.json)的源码190文件/54构建/61文件安装保持原作用域。[GET关联输入证据](ports/W05-get-task-inputs-evidence.json)保留原作用域。先前[标准task证据](ports/W05-standard-tasks-evidence.json)的188文件源码重建53文件字节一致、60文件安装归档保留原作用域。[混合采样数组证据](ports/W05-sampling-arrays-evidence.json)保留原作用域。[前台task证据](ports/W05-tasks-evidence.json)保留原作用域。[图片采样证据](ports/W05-sampling-images-evidence.json)保留原作用域。[持久化证据](ports/W05-persistence-evidence.json)的源码182文件/51构建文件保持历史作用域。原17项[本地交付证据](ports/local-completion-evidence.json)、W01/W02及历史基线保持原版本作用域。Git已按用户要求初始化，main初始05d1162，工作位于work/complete-runtime-work；无remote。真实Magpie管理链待验，限定搜索未定位管理端。

## 优先工作包

| 顺序 / ID | 工作包与owner | 状态 / 依赖 | 完成条件 |
| --- | --- | --- | --- |
| 1 / W01 | 网关边界与基线；并行执行agents | verified；A01、A06 | 已满足；[W01证据](ports/W01.md)，当前全量1003/1003，实际Magpie仍待验 |
| 2 / W02 | 可信源码与搬运试点；并行执行agents | verified；历史ports待审 | [W02](ports/W02.md)：独立verifier、索引摘要校验、首份准确rewrite台账及内容/构建身份已验收 |
| 3 / W03 | Magpie启动/恢复适配；管理端owner待定位 | Partial；安装bin/command冷启动/真实任务verified | [安装验收](ports/W03-installed-launcher-evidence.json)、[启动合同](ports/W03-launcher.md)：生产安装可用/冷启动清理/恢复；[真实验收](ports/W03-live.md)两次200；app冷启、route切换/凭证轮换仍待验 |
| 4 / W04 | 执行与恢复完整包；执行agents | verified有限进程崩溃链 | [持久恢复](ports/W04-crash-recovery.md)：checkpoint8切点+实际CLI，workflow未知效果显式重试/完成复用；原算法未证明，明确rewrite |
| 5 / W05 | MCP生命周期剩余包；执行agents | verified启动/慢恢复/订阅持久化有限包，功能族Partial | [持久化](ports/W05-persistence.md)、[启动](ports/W05-startup.md)、[URI/GET](ports/W05-recovery.md)；[图片采样](ports/W05-sampling-images.md)已完成；[前台task扩展](ports/W05-tasks.md)已adapt并有限验收；[混合采样数组](ports/W05-sampling-arrays.md)已完成；[标准tasks/result](ports/W05-standard-tasks.md)前台requestor已完成；[GET关联roots/form](ports/W05-get-task-inputs.md)已完成；[持久HTTP task](ports/W05-durable-tasks.md)显式恢复已完成；[音频采样输入](ports/W05-sampling-audio.md)已完成；[GET通用请求](ports/W05-get-dispatch.md)已完成；[GET续传](ports/W05-get-resume.md)已完成；[采样内容元数据](ports/W05-sampling-blocks.md)已完成，工具块/工具声明按结果类型无来源而拒绝；[图片API上限](ports/W05-image-limits.md)已完成，resize/reencode按Bun.Image无来源结论保留；[stdio下次使用重挂](ports/W05-stdio-redial.md)已完成，恢复开关下每次调用一次新进程且不重放失败调用；[list_changed即时重取](ports/W05-list-changed-refetch.md)已完成，动态目录通知到达即后台重取、与显式刷新同队列串行并按服务器合并、失败留脏不后台重试；park/refetch与自动下一轮重dial调度（恢复源码默认关闭、依赖连接表行模型）经[剩余项处置](ports/remaining-dispositions.md)核对为被现有常开有界恢复取代；服务端任务接收端无来源基础（mcp serve仅声明tools.listChanged，未实现tasks） |
| 6 / W06 | 扩展与交互包；执行agents | verified已使用技能/Hook消费者包，功能族Partial | [消费者验收](ports/W06-skills-hooks.md)：两源码CLI各9请求+38回归；[围栏shell](ports/W06-skill-inline-fenced.md)已完成围栏```!块与行内标记的统一提取、顺序预检执行、块内不二次执行与CRLF归一，once按恢复源核对为超集（全hook生效、journal持久化、开始前认领）无需改动；原版shell AST参数切分（自带bash解析器，`SE` [4697,4822)，含10000字符上限）经[剩余项处置](ports/remaining-dispositions.md)决定不移植并保留现有quote-group契约 |
| 7 / W07 | 编码任务验收与交付；执行agent，发布决定由用户 | local verified；publication blocked | 最新private62file包含litcode-magpie、订阅持久化、混合图片/音频采样、GET续传、GET通用请求派发、标准task输入、显式持久恢复、采样内容元数据、图片API上限、stdio下次使用重挂、list_changed即时重取与技能围栏shell；本轮193文件源码位于release/litcode-source-fenced-skills、运行包位于release/fenced-skills-runtime，[技能围栏shell证据](ports/W06-skill-inline-fenced-evidence.json)，原交付（含release/list-changed-runtime、release/stdio-redial-runtime与各自源码包）保留scope；项目license/remote及来源权利尚缺 |

选择规则：从最上方ready项开始。W03缺管理端信息时继续W02/W04等独立本地工作，同时把所缺信息写在本行；没有预算时真实模型验收保持待验。W04-W06具体子系统由已定位源码、依赖成熟度和实际使用价值决定，不为旧报告的每个措辞创建任务。

## 审核问题状态

来源：[LITCODE_WORKFLOW_AUDIT](../LITCODE_WORKFLOW_AUDIT.md)。所有问题当前owner为执行agent；每次修复只更新相关行并链接精简证据。

| ID | 优先级 / 问题 | 状态 / 证据等级 | 下一步 / 关闭依据 |
| --- | --- | --- | --- |
| A01 | P1 网关header被SDK环境覆盖 | resolved / confirmed | [W01](ports/W01.md)：原生SDK污染复现，两auth的stream/count_tokens及CLI新建/恢复通过 |
| A02 | P1 Magpie管理适配未闭环 | Partial / real task+resume confirmed | W03-live真实任务已验证；管理启动、route切换、凭证发行/轮换、实际账单仍缺，保持open |
| A03 | P1 缺逐模块搬运台账 | resolved（有限）/ 全量可复现 | [逐模块台账](ports/port-ledger.md)：2365模块全部入账并绑定样本sha256，25个有ports证据/57个仅叙述提及/2283个未引用，未引用者显式列出且不计比例；生成器[port-ledger.mjs](../scripts/port-ledger.mjs)同参重复与不同输出路径两次生成摘要一致，[证据](ports/port-ledger-evidence.json)。历史实现逐包核对保留原表述 |
| A04 | P1 索引未校验模块摘要 | resolved / confirmed | [W02](ports/W02.md)：全部records预检摘要、坐标、生成身份；篡改中止；新索引独立核验 |
| A05 | P1 提取缺独立可复现校验入口 | resolved / confirmed | [W02](ports/W02.md)：原样本/manifest/raw/解码/落盘/index一致性实测2609项 |
| A06 | P2 三处工具总数断言漂移 | resolved / confirmed | [W01](ports/W01.md)：名称/能力核验5/5，当前全量1003/1003 |
| A07 | P2 验证缺内容/构建身份与持久绑定 | resolved / confirmed，历史记录维持原证据等级 | 共享identity入口与[W01](ports/W01-evidence.json)/[W02证据](ports/W02-evidence.json)持久绑定；历史不追填猜测 |
| A08 | P2 当前缺口与历史混杂 | resolved（有限）/ 处置入口与逐项结论齐备 | CURRENT为唯一排程与处置入口；[剩余项处置](ports/remaining-dispositions.md)对W05/W06尾项逐条给出superseded/无传输/不移植/无来源/量化开放五类结论并附已核验坐标，历史报告保持原记录不回填；未引用模块2283个仍为量化开放缺口（见[台账](ports/port-ledger.md)） |
| A09 | P2 开源交付准备 | partial / 本地交付verified | 命名/Git/worktree/源码重建/依赖notice已验收；项目license/remote及来源权利待定，public发布保留blocked |

## 溯源和历史使用规则

- FEATURES顶部矩阵为功能族当前合同；后文的早期叙述是历史线索，必须查最新实现及STATUS续写。
- HOOKS与INTERACTIVE记录的是受限源码调查或独立适配合同；旧调查中的缺口未必仍存在。
- MONITOR的独立batching/rate策略属于主动差异，先确定迁移目标，再决定是否搬运原算法。
- 网关审核末尾关于SDK日志、重定向和SSE deadline的三项是candidate，尚未独立确认；只在W01有关联时核查。
- 原始审核报告中的源码行号属于报告时版本。检查当前文件，使用内容身份绑定后续结果。
- OAuth与自动厂商标记继续Excluded；云端产品后端继续External dependency；实际Magpie/上游容量与模型效果继续待验。

## 本轮流程交付

W05持久HTTP task完成1040/1040全量、check/build、编译SIGKILL恢复/缓存链6本地请求；6GET全部关闭、6DELETE；61文件安装和190文件源码/54构建字节一致重建通过。新session远端任务访问仍依赖接收端保留/授权，失败保持未知、原调用不重放。自动后台调度、task接收端、stdio重挂及外部Magpie保留缺口。

W05音频采样输入完成1042/1042全量、check/build、编译CLI7本地请求与音频摘要5b517b50…；62文件安装、191文件源码/55构建字节一致重建通过，0付费调用。恢复源码对音频只做容器/MIME直传与文本引用，容器签名表、16KiB/4段上限与共享附件存储为自有实现。

W05采样内容元数据完成1047/1047全量、check/build、源码与编译CLI各3本地请求；62文件安装、191文件源码/55构建字节一致重建通过，0付费调用。恢复源码的请求块union含tool_use/tool_result、参数含tools/toolChoice，结果union仅为text/image/audio，因此工具化采样按无来源结果类型拒绝，annotations/_meta按惰性数据接受并在host侧剥离。
W05图片API上限完成1048/1048全量、check/build、真实CLI四段附件链（单张`--attach`、无源恢复、交互PDF页选、超限PNG拒绝且不发请求）；62文件安装、191文件源码/55构建字节一致重建通过，0付费调用。恢复源码的2000x2000与base64 5242880/raw 3932160上限已按边界落地，缩放与重压缩依赖运行时内置Bun.Image，限定搜索确认无可移植编解码器，故不做resize/reencode并保留超target标注。

W05 stdio下次使用重挂完成1049/1049全量、check/build、真实CLI三模式（源码恢复开/关、编译恢复开）对首调即退出的stdio fixture：开恢复为2个进程且第二次调用结果进模型，关恢复仅1个进程且模型收到disconnected错误。恢复源码在致命失败后只关闭并清缓存，下一次使用才dial新进程（sb190ksj `et`/onclose/清除缓存/`no`+`Lt`+`Rt`，连接期探测重启与本运行时单一版本不适用）。

剩余项处置完成逐条结案：下一轮重dial（常量[388228,388266)/[388259,388300)/[388374,388505)、调度器`lT`[388505,388870)）判定为被常开有界恢复取代（恢复端默认关闭且依赖连接表行模型turns/heldTurns）；parked refetch（`ka`[48170,48515)由`subscriptions/listen`重监听`w.filter`[50368,50405)驱动）判定为无该传输基础；shell AST参数切分（`SE`[4697,4822)、节点排除[4822,4882)、上限`D0=1e4`[1052,1071)）判定不移植并保留quote-group契约；`mcp serve`/服务端任务接收端判定无来源基础；完整像素解码无编解码器；未引用模块2283个（33.4MB）作为量化开放缺口保留。本包仅文档与处置，未改动产品源码/测试/构建输入，故未重跑用例。

A03 逐模块搬运台账关闭为有限resolved：新生成器对恢复样本2365个模块逐个计算解码文本大小与sha256，扫描research/全部记录得到ports证据（25）、仅叙述提及（57）与未引用（2283，33.4MB）三类，未引用者不推断搬运比例；生成过程排除台账自身的两个输出文件，两次不同输出路径的生成摘要一致（ledger fccd3329…）。本包不改动产品源码/测试/构建输入，故未重跑1052用例；check与62文件安装包通过。

W06 技能围栏shell完成1052/1052全量、check/build、真实CLI新驱动（源码与编译）对围栏```!块的执行与替换，`--fenced`另与quoted/named/fallback/extended组合通过，回归skill-inline与skill-agent通过；193文件源码/55构建字节一致重建、62文件安装、0付费调用。恢复源在替换前用两条规则提取（围栏`gVn`[434795,434965)恒扫、行内`hVn`需正文含"!`"且前置行首或空白），命令经`s5r`去空格与CRLF归一后交给工具，`xxr`[3370821,3370951)按输入schema校验、调用侧`Promise.all`[3368985,3369195)执行；本运行时保留更宽的行内匹配（如`value=!`…``也是指令，属超集）、块内标记跳过、顺序执行与既有预检。hook `once`经核对为超集：恢复端仅在技能hook注册处读取（`qe`[3893,4135)）、仅success后移除、注册表为内存Map（`Bfr`[3020,3120)）；本运行时全hook生效、journal持久化并在开始前认领，故不改动。原版shell AST参数切分（`SE`→`nde`→`DKe`，chunk-m00pavz3.js）保留缺口。

W05 list_changed即时重取完成1051/1051全量、check/build、新真实CLI双模式驱动（空闲GET流推送list_changed后，fixture在任何模型请求前观察到恰好一次额外tools/list，模型随后检索到变更后的工具并经通用调用成功），回归mcp-reconnect与notification流均通过；193文件源码/55构建字节一致重建、62文件安装、0付费调用。恢复源码在通知处理器内自行即时重取（`setNotificationHandler("notifications/tools/list_changed",…)` [118189,118268)、每服务器handler注册`Zo` [48080,48170)、客户端选项`autoRefresh:!1,debounceMs:0,onChanged` [86469,86625)，prompts/resources处理为空）；本运行时改为由已订阅onToolsChanged的动态目录执行，复用既有串行刷新队列并按服务器合并，失败留脏不后台重试，ensureFresh失败关闭保留为最后手段。post-reopen parked重取（`ka` [48170,48515)由重监听`w.filter` [50368,50405)驱动）绑定本运行时未实现的subscriptions/listen流，等价保证由替换后重取与下次使用脏取覆盖；下一轮重dial调度（rx2nah4x [388228,388266)/[388374,388505)）与外部Magpie保留缺口。
