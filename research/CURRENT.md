# 当前项目工作清单

更新：2026-10-12。执行规则见 [WORKFLOW](../WORKFLOW.md)。这是当前排程与审核处置的唯一入口；历史报告保持原记录。

## 当前结论

本地工作包W04恢复链、W05启动/慢恢复、W06已使用技能消费者及W07本地交付已完成有限验收；功能族整体仍为Partial。当前全量1027/1027、零失败；跨进程MCP订阅包完成编译CLI真实SIGKILL、固定配置、fork隔离、取消/失败恢复，58文件离线安装通过，见[W05持久化](ports/W05-persistence.md)。历史全产品来源审计、完整TUI/MCP扩展与事件重放仍是功能族缺口，不以有限包验收代替。

当前身份与17项验证记录见[本地交付证据](ports/local-completion-evidence.json)。W01/W02及历史基线保持原版本作用域。Git已按用户要求初始化，main初始05d1162，工作位于work/complete-runtime-work；无remote。真实Magpie管理链待验，限定搜索未定位管理端。

## 优先工作包

| 顺序 / ID | 工作包与owner | 状态 / 依赖 | 完成条件 |
| --- | --- | --- | --- |
| 1 / W01 | 网关边界与基线；并行执行agents | verified；A01、A06 | 已满足；[W01证据](ports/W01.md)，当前全量1003/1003，实际Magpie仍待验 |
| 2 / W02 | 可信源码与搬运试点；并行执行agents | verified；历史ports待审 | [W02](ports/W02.md)：独立verifier、索引摘要校验、首份准确rewrite台账及内容/构建身份已验收 |
| 3 / W03 | Magpie启动/恢复适配；管理端owner待定位 | Partial；安装bin/command冷启动/真实任务verified | [安装验收](ports/W03-installed-launcher-evidence.json)、[启动合同](ports/W03-launcher.md)：生产安装可用/冷启动清理/恢复；[真实验收](ports/W03-live.md)两次200；app冷启、route切换/凭证轮换仍待验 |
| 4 / W04 | 执行与恢复完整包；执行agents | verified有限进程崩溃链 | [持久恢复](ports/W04-crash-recovery.md)：checkpoint8切点+实际CLI，workflow未知效果显式重试/完成复用；原算法未证明，明确rewrite |
| 5 / W05 | MCP生命周期剩余包；执行agents | verified启动/慢恢复/订阅持久化有限包，功能族Partial | [持久化](ports/W05-persistence.md)、[启动](ports/W05-startup.md)、[URI/GET](ports/W05-recovery.md)；MCP tasks/media、park/refetch及事件重放保留缺口 |
| 6 / W06 | 扩展与交互包；执行agents | verified已使用技能/Hook消费者包，功能族Partial | [消费者验收](ports/W06-skills-hooks.md)：两源码CLI各9请求+38回归；原shellAST/once完整来源仍待审 |
| 7 / W07 | 编码任务验收与交付；执行agent，发布决定由用户 | local verified；publication blocked | 最新private58file包含litcode-magpie和订阅持久化；本轮源码/运行包位于release/persistence-runtime与release/litcode-source-persistence，[持久化证据](ports/W05-persistence-evidence.json)，原交付保留scope；项目license/remote及来源权利尚缺 |

选择规则：从最上方ready项开始。W03缺管理端信息时继续W02/W04等独立本地工作，同时把所缺信息写在本行；没有预算时真实模型验收保持待验。W04-W06具体子系统由已定位源码、依赖成熟度和实际使用价值决定，不为旧报告的每个措辞创建任务。

## 审核问题状态

来源：[LITCODE_WORKFLOW_AUDIT](../LITCODE_WORKFLOW_AUDIT.md)。所有问题当前owner为执行agent；每次修复只更新相关行并链接精简证据。

| ID | 优先级 / 问题 | 状态 / 证据等级 | 下一步 / 关闭依据 |
| --- | --- | --- | --- |
| A01 | P1 网关header被SDK环境覆盖 | resolved / confirmed | [W01](ports/W01.md)：原生SDK污染复现，两auth的stream/count_tokens及CLI新建/恢复通过 |
| A02 | P1 Magpie管理适配未闭环 | Partial / real task+resume confirmed | W03-live真实任务已验证；管理启动、route切换、凭证发行/轮换、实际账单仍缺，保持open |
| A03 | P1 缺逐模块搬运台账 | open / confirmed，首份准确台账已建立 | [技能参数台账](ports/skill-argument-expansion.md)；历史实现逐包核对，不编造搬运比例 |
| A04 | P1 索引未校验模块摘要 | resolved / confirmed | [W02](ports/W02.md)：全部records预检摘要、坐标、生成身份；篡改中止；新索引独立核验 |
| A05 | P1 提取缺独立可复现校验入口 | resolved / confirmed | [W02](ports/W02.md)：原样本/manifest/raw/解码/落盘/index一致性实测2609项 |
| A06 | P2 三处工具总数断言漂移 | resolved / confirmed | [W01](ports/W01.md)：名称/能力核验5/5，当前全量1003/1003 |
| A07 | P2 验证缺内容/构建身份与持久绑定 | resolved / confirmed，历史记录维持原证据等级 | 共享identity入口与[W01](ports/W01-evidence.json)/[W02证据](ports/W02-evidence.json)持久绑定；历史不追填猜测 |
| A08 | P2 当前缺口与历史混杂 | open / confirmed，本轮已建CURRENT作为处置入口 | 按相关子系统逐项resolved/superseded并指向新结论；流程建立不等于全部内容已核对 |
| A09 | P2 开源交付准备 | partial / 本地交付verified | 命名/Git/worktree/源码重建/依赖notice已验收；项目license/remote及来源权利待定，public发布保留blocked |

## 溯源和历史使用规则

- FEATURES顶部矩阵为功能族当前合同；后文的早期叙述是历史线索，必须查最新实现及STATUS续写。
- HOOKS与INTERACTIVE记录的是受限源码调查或独立适配合同；旧调查中的缺口未必仍存在。
- MONITOR的独立batching/rate策略属于主动差异，先确定迁移目标，再决定是否搬运原算法。
- 网关审核末尾关于SDK日志、重定向和SSE deadline的三项是candidate，尚未独立确认；只在W01有关联时核查。
- 原始审核报告中的源码行号属于报告时版本。检查当前文件，使用内容身份绑定后续结果。
- OAuth与自动厂商标记继续Excluded；云端产品后端继续External dependency；实际Magpie/上游容量与模型效果继续待验。

## 本轮流程交付

W05持久化已完成1027/1027全量、check/build、编译CLI真实SIGKILL及58文件private安装；收齐源码重建与身份后提交work/complete-runtime-work。下一独立本地包按已定位来源核对MCP剩余扩展；外部Magpie与项目license/remote保留待验。
