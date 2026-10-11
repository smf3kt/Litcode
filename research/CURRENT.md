# 当前项目工作清单

更新：2026-10-11。执行规则见 [WORKFLOW](../WORKFLOW.md)。这是当前排程与审核处置的唯一入口；历史报告保持原记录。

## 当前结论

本地harness可运行，功能族整体为Partial。W02来源链2609项与新索引已验收，历史全项目搬运仍待审。本轮W05已完成opt-in精确URI恢复及HTTP GET重开，源码/编译版实际CLI各12请求通过；当前全量1015/1015、零失败。MCP启动降级、慢恢复、进程重启订阅持久化和stdio致命故障URI保留仍待迁移。

当前基线与内容身份见[W05恢复证据](ports/W05-recovery-evidence.json)。W01鉴权与目录基线、W02来源校验继续保留各自验收身份；历史1000/997/3、948/948及W01的1003/1003保持原版本作用域。真实Magpie管理链待验，限定搜索未定位管理端。

## 优先工作包

| 顺序 / ID | 工作包与owner | 状态 / 依赖 | 完成条件 |
| --- | --- | --- | --- |
| 1 / W01 | 网关边界与基线；并行执行agents | verified；A01、A06 | 已满足；[W01证据](ports/W01.md)，当前全量1003/1003，实际Magpie仍待验 |
| 2 / W02 | 可信源码与搬运试点；并行执行agents | verified；历史ports待审 | [W02](ports/W02.md)：独立verifier、索引摘要校验、首份准确rewrite台账及内容/构建身份已验收 |
| 3 / W03 | Magpie启动/恢复适配；执行agent，管理端owner待定位 | blocked；限定相邻项目/已装CLI搜索未定位管理端；A02 | 缺管理仓库、启动/路由变更/凭证发行API；已有Messages端点和CLI新建/恢复入口，真实管理链待验 |
| 4 / W04 | 执行与恢复完整包；执行agent | W02来源基础；原实现依赖按包收齐 | checkpoint/技能前置效果/工作流中选一条完整恢复链，保留未知效果不自动重放 |
| 5 / W05 | MCP生命周期剩余包；并行执行agents | Partial；GET/URI恢复slice verified | [恢复证据](ports/W05-recovery.md)；下一包启动降级/慢重试，完整目录变化另保留缺口 |
| 6 / W06 | 扩展与交互包；执行agent | W02、按实际使用优先 | skills/hooks来源与消费者、headless/TUI/媒体按完整子系统交付；主动设计差异先核对 |
| 7 / W07 | 编码任务验收与交付；执行agent，发布决定由用户 | W01-W03及必要运行包 | 实际代码任务与恢复证据；LiTcode命名/源码获取/可复现构建/许可证与notice齐备，再进入发布步骤 |

选择规则：从最上方ready项开始。W03缺管理端信息时继续W02/W04等独立本地工作，同时把所缺信息写在本行；没有预算时真实模型验收保持待验。W04-W06具体子系统由已定位源码、依赖成熟度和实际使用价值决定，不为旧报告的每个措辞创建任务。

## 审核问题状态

来源：[LITCODE_WORKFLOW_AUDIT](../LITCODE_WORKFLOW_AUDIT.md)。所有问题当前owner为执行agent；每次修复只更新相关行并链接精简证据。

| ID | 优先级 / 问题 | 状态 / 证据等级 | 下一步 / 关闭依据 |
| --- | --- | --- | --- |
| A01 | P1 网关header被SDK环境覆盖 | resolved / confirmed | [W01](ports/W01.md)：原生SDK污染复现，两auth的stream/count_tokens及CLI新建/恢复通过 |
| A02 | P1 Magpie管理适配未闭环 | open / reported，管理端未定位 | W03：定位接口、接启动配置与轮换恢复；loopback不能关闭此项 |
| A03 | P1 缺逐模块搬运台账 | open / confirmed，首份准确台账已建立 | [技能参数台账](ports/skill-argument-expansion.md)；历史实现逐包核对，不编造搬运比例 |
| A04 | P1 索引未校验模块摘要 | resolved / confirmed | [W02](ports/W02.md)：全部records预检摘要、坐标、生成身份；篡改中止；新索引独立核验 |
| A05 | P1 提取缺独立可复现校验入口 | resolved / confirmed | [W02](ports/W02.md)：原样本/manifest/raw/解码/落盘/index一致性实测2609项 |
| A06 | P2 三处工具总数断言漂移 | resolved / confirmed | [W01](ports/W01.md)：名称/能力核验5/5，当前全量1003/1003 |
| A07 | P2 验证缺内容/构建身份与持久绑定 | resolved / confirmed，历史记录维持原证据等级 | 共享identity入口与[W01](ports/W01-evidence.json)/[W02证据](ports/W02-evidence.json)持久绑定；历史不追填猜测 |
| A08 | P2 当前缺口与历史混杂 | open / confirmed，本轮已建CURRENT作为处置入口 | 按相关子系统逐项resolved/superseded并指向新结论；流程建立不等于全部内容已核对 |
| A09 | P2 开源交付准备 | open / reported，当前包private且入口仍personal-harness | W07：命名/源码仓库/分发/来源与notice逐项准备；本轮不初始化Git或发布 |

## 溯源和历史使用规则

- FEATURES顶部矩阵为功能族当前合同；后文的早期叙述是历史线索，必须查最新实现及STATUS续写。
- HOOKS与INTERACTIVE记录的是受限源码调查或独立适配合同；旧调查中的缺口未必仍存在。
- MONITOR的独立batching/rate策略属于主动差异，先确定迁移目标，再决定是否搬运原算法。
- 网关审核末尾关于SDK日志、重定向和SSE deadline的三项是candidate，尚未独立确认；只在W01有关联时核查。
- 原始审核报告中的源码行号属于报告时版本。检查当前文件，使用内容身份绑定后续结果。
- OAuth与自动厂商标记继续Excluded；云端产品后端继续External dependency；实际Magpie/上游容量与模型效果继续待验。

## 本轮流程交付

本轮继续并行完成W05的GET/URI恢复完整链：当前全量1015/1015、MCP138/138、check/build和源码/编译CLI各12请求通过；精确来源差异与内容身份绑定ports记录。W03管理端未定位、付费上游待验；W04与W05剩余运行恢复按依赖继续。
