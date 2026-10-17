// W45-88 record: the terminal glue, the host seams it reads and the local helpers. Writes the
// package section, the CURRENT row, the STATUS and FEATURES tails, the coding-standard entry, the
// runtime trail and the acceptance list. Every anchor is asserted unique before any write.
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const rep = (path, old, next) => {
  const text = read(path);
  const count = text.split(old).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} of ${JSON.stringify(old.slice(0, 70))}`);
  write(path, text.replace(old, next));
};

const W = 'research/ports/W45-chain-runner.md';
write(W, read(W).replace(/\n+$/, '\n') + `
## W45-88 ported the terminal glue (2026-10-17)

Eight blocks are copied verbatim (4,823 units) into \`plugin-chain-terminal-glue-source.ts\`: the
glue itself from chunk-kjfwbh4w.js, the site input matcher \`uo\`, the render-descriptor WeakMap
\`bVe\`/\`CAt\`, the settled-list reader \`Vss\`/\`Lur\`, the module filter \`pIn\`, and the render-failure
notes \`cIn\`/\`dIn\`/\`mno\`/\`uIn\` with their dedupe (\`cce\`/\`HM\`/\`s5t\`/\`sIn\`/\`CK\`/\`Iye\`) from
chunk-n3ykh62m.js.

A site becomes one surface node. \`yt\` walks the tree under a plugin context built from component
and request id, and the draw callback receives the input the drawn descriptor names (\`uo\`). \`pr\`
keeps a Pane bare and wraps every other component in the error boundary \`XD\`: the fallback redraws
the engine sentinel tree, and a caught throw notes the site, files one failure note and calls
\`onThrown\`. \`ur\` resolves the on-screen input only while fullscreen and hooked, attaching the
asked range and keeping the held rows as the fallback. \`xr\` reads the settled answer for the
current render version, subscribes to the engine render service while hooked, holds the mount
counter \`Fss\`, and maps a rejected answer to the sentinel through \`onThrown\`. \`hdn\` composes the
Box with the drawn site ref, the render event and component, the held-row height and the overflow
decision, and \`TU\` is its node. The row helpers keep the held rows stable across off-screen draws:
a changed draw or filled content clears them, turning off stores the last rows, and the first empty
content restores them.

The failure note is deduplicated by component and teller, and its module list is the plugins that
contributed to the settled site, or every candidate when none is recorded.

Host boundary: the engine render client \`che\`, the settled-evaluation cache \`dce\`, the frame row
accounting \`g4n\`, the mount counter \`Fss\` and the terminal mode \`Mi\` are host seams, because the
engine that answers a render and owns the frame graph is outside this product. \`src/plugin-chain-terminal-host.ts\`
mirrors the source contracts the glue reads, keeps the engine injectable, and adapts the host
render-version store for the selector hook (\`OL\`). \`dce.uiRender\` delegates evaluation to the
injected service instead of copying the engine pipeline \`gno\`, whose dependency closure is the next
subsystem, not this package.

What was measured (probe log \`.audit/w45-88-probe.txt\`): the render key and its digest; the row
helper transitions; the fullscreen on-screen input; the settled render with and without a cached
answer; the terminal input merge; the context element; the Pane bypass and the boundary wrapper;
the fallback Box and the hooked boundary node; the first-run ref; \`uo\`/\`CAt\`/\`pIn\`; the mount
release; the failure text and the dedupe check; and the public aliases.

Partition 4 (the plugin chain runner) is complete through its terminal glue. The next ready item
is C-1 (Magpie startup and recovery); A-1 remains a user action.

Verified: tsc 0, the copy scan \`declared 101 / unresolved 0\`, notices 0, 19 new tests, the chain
family 767/767, full 2,043/2,043, and the recovered-source index at 74 chunks / 1,736 statements /
315,116 units (2.9%). Identity \`76b9199c…\`.

`);

rep('research/CURRENT.md',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-87 **渲染版本与渲染键层**',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-88 **终端胶水（站点→终端表面节点）**：**8 段 4,823 单位**（`yt`/`pr`/`ir`/`ar`/`lr`/`mr`/`fr`/`ur`/`cr`/`dr`/`xr`/`$e`/`hdn`/`TU`/`VH`，加上 `uo`、`bVe`/`CAt`、`Vss`/`Lur`、`pIn` 与失败注记 `cIn`/`dIn`/`mno`/`uIn`/`cce`/`HM`/`s5t`/`sIn`/`CK`/`Iye`）。**语义**：`yt` 在「component+requestId」插件上下文中遍历站点树，draw 回调收到被绘描述符命名的 input（`uo`）；`pr` 对 Pane 不包边界，其余组件包进 `XD`，fallback 重画引擎哨兵树，捕获异常时记录站点、发一条失败注记并回调 `onThrown`；`ur` 仅在 fullscreen 且已挂钩时解析 on-screen input，附加 `onScreen` 并以 held rows 兜底；`xr` 按当前渲染版本读已结算答案，挂钩时订阅引擎渲染服务、持 `Fss` 挂载计数，失败答案经 `onThrown` 映射为哨兵；`hdn` 组装带站点 ref、渲染事件/组件、行高与 overflow 的 Box，`TU` 即其 node；行助手在离屏绘制间保持 held rows——绘制变化或内容填满即清空，关闭时存最后行数，首个空内容恢复。失败注记按 component+teller 去重，模块表取已结算站点的贡献插件，无记录时退化为全部候选。**宿主边界**：引擎渲染客户端 `che`、结算缓存 `dce`、帧行核算 `g4n`、挂载计数 `Fss`、终端模式 `Mi` 归宿主；`plugin-chain-terminal-host.ts` 镜像胶水读取的源契约并可注入引擎，同时为选择器钩子适配宿主渲染版本存储（`OL`）；`dce.uiRender` 把求值委托给注入服务，不复制引擎管线 `gno`（其依赖闭包是下一子系统）。**实测**：渲染键与摘要；行助手迁移；fullscreen on-screen input；有无缓存答案的结算渲染；终端 input 合并；上下文元素；Pane 绕过与边界包装；fallback Box 与挂钩边界节点；首次运行 ref；`uo`/`CAt`/`pIn`；挂载释放；失败文本与去重；公共别名。tsc 0；未声明扫描 declared 101/unresolved 0；notices 0；新套件 19/19；链家族 767/767；全量 2,043/2,043；索引 74 chunk/315,116 单位（2.9%）；身份 `76b9199c…`。分区 4（插件链执行器）至此完成；下一项 C-1（Magpie 启动与恢复），A-1 仍待用户动作。 | [终端胶水证据](ports/W45-terminal-glue-evidence.json)、[工作包](ports/W45-chain-runner.md) |\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-87 **渲染版本与渲染键层**',
);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W45-88: the terminal glue turns one site into a surface node through the render version and held rows. The tree is walked under the plugin context, wrapped in the error boundary unless it is a Pane, and drawn from the settled answer only while a hook matches; the failure note is deduplicated and names the contributing plugins. Eight source blocks, 4,823 units; the engine render service, settled cache, row frames, mount counter and terminal mode stay host seams. 19/19 new tests, 767/767 chain family, 2,043/2,043 full; tsc 0; index 74 chunks / 315,116 units. Partition 4 complete. [W45 record](ports/W45-chain-runner.md).
`);

rep('research/FEATURES.md',
  'and the recovered matcher runner with its alias table.',
  'and the recovered matcher runner with its alias table; W45-88 adds the terminal glue: the site walk under the plugin context, the Pane bypass and error boundary, the on-screen input and held rows, the settled render with its mount counter, the surface node, and the deduplicated render-failure note.',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W45-88 终端胶水：S-1至S-7已对照。S-1（先读源）：量出 8 段/4,823 单位，逐段读 「yt」/「pr」/「ur」/「xr」/「hdn」 与行助手、站点 input 匹配、渲染描述符表、模块过滤与失败注记；边界符号（XD/i5t/t/y$/aCe/zz）此前已入产品。S-2（不臆造）：节点组装、边界绕过、行迁移、失败去重与消息文本均按源正文保留；引擎求值管线 gno 属宿主边界，未伪造。S-3（宿主边界）：che/dce/g4n/Fss/Mi 与 OL 适配为显式宿主接缝，引擎可注入；复制正文只读契约。S-4（可测）：19 条用例先经 .audit/w45-88-probe.ts 实测再断言。S-5/S-6：整段一次收齐，复用既有 seam 与存储，无新增依赖。S-7（记录）：证据 JSON 记录 8 段区间、宿主边界与分区完成。验证：tsc 0、未声明扫描 declared 101/unresolved 0、notices 0、新套件 19/19、链家族 767/767、全量 2,043/2,043、索引 74 chunk/315,116 单位、身份 76b9199c…。
`);

const tsv = read('.audit/w45-runtime.tsv');
const rows = [
  ['2026-10-17T23:55:00Z', 'package', 'W45-88 终端胶水（8 段 4,823 单位）',
    'yt/pr/ir/ar/lr/mr/fr/ur/cr/dr/xr/$e/hdn/TU/VH 与 uo/bVe/CAt/Vss/Lur/pIn/cIn/dIn/mno/uIn/cce/HM/s5t/sIn/CK/Iye 成为产品面；plugin-chain-terminal-glue-source.ts 生成副本；新 plugin-chain-terminal-host.ts 宿主接缝（che/dce/g4n/Fss/Mi/OL 适配）与新 plugin-chain-terminal.ts 公共 seam',
    'chunk-kjfwbh4w.js 2 段 + chunk-n3ykh62m.js 6 段共 4,823u',
    '19/19 新套件；链家族 767/767；全量 2,043/2,043；1 文件 declared 101/unresolved 0'],
  ['2026-10-18T00:00:00Z', 'decision', 'W45-88 引擎渲染与帧核算留在宿主，胶水逐字复制',
    '① 引擎渲染客户端 che、结算缓存 dce、帧行核算 g4n、挂载计数 Fss、终端模式 Mi 是宿主接缝，引擎可注入；② dce.uiRender 委托注入服务，不复制 gno 管线（其依赖闭包是下一子系统）；③ 站点→表面节点是单节点路径：hdn 决定行高/版本/已绘答案，仅在挂钩时把树交给遍历器；④ 失败注记按 component+teller 去重并命名贡献插件；⑤ 分区 4 至此完成，下一项 C-1',
    '测试按行助手、on-screen input、结算渲染、树与边界、表面节点、本地助手分组',
    '.audit/w45-88-probe.txt + test/plugin-chain-terminal.test.ts'],
  ['2026-10-18T00:03:00Z', 'finding', 'W45-88 实测行迁移、边界绕过与结算答案',
    '① 渲染键 C\\0r\\080\\0false\\0<sha256({})>；② lr/mr/fr 的行迁移；③ fullscreen ur 的 site/input/rows；④ xr 有无缓存答案；⑤ VH 合并；⑥ yt 上下文元素；⑦ Pane 绕过与 XD 包装；⑧ fallback Box 与挂钩边界节点；⑨ ar/uo/CAt/pIn/Fss；⑩ 失败文本与去重；⑪ 公共别名',
    '十一条由 .audit/w45-88-probe.ts 实测后写入证据与测试',
    '.audit/w45-88-probe.txt + test/plugin-chain-terminal.test.ts'],
  ['2026-10-18T00:06:00Z', 'verification', 'W45-88 验收：declared 101/unresolved 0、tsc 0、notices 0、19/19、767/767、2,043/2,043、索引 74 chunk/315,116 单位、身份 76b9199c…；分区 4 完成',
    '下一项 C-1（Magpie 启动与恢复）；A-1 待用户',
    'source-undeclared-scan declared 101，unresolved 0；新套件 19/19；链家族 767/767；全量 2,043/2,043；索引 74 chunks / 1,736 语句 / 315,116 单位（2.9%）'],
];
const added = rows.filter(([stamp]) => !tsv.includes(stamp)).map((row) => row.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md').replace(/\n+$/, '\n');
write('.audit/w45-runtime.todo.md', todo + `
## W45-88 acceptance (2026-10-17)

- [x] **One site becomes one surface node.** \`hdn\` carries the drawn site ref, the render event and component, the held-row height and the overflow decision; \`TU\` is its node.
- [x] **The tree is walked under the plugin context.** \`yt\` builds the context element from component and request id and hands the draw callback the descriptor input.
- [x] **The boundary wraps everything but a Pane.** The fallback redraws the sentinel tree; a caught throw notes the site and files one failure note.
- [x] **The settled answer is versioned.** \`xr\` reads the cached answer for the current version, subscribes while hooked and holds the mount counter.
- [x] **The held rows survive off-screen draws.** The row helpers clear, store and restore the last measured height by the source rules.
- [x] **Sweep.** tsc 0, copy \`declared 101 / unresolved 0\`, notices 0, new suite 19/19, chain family 767/767, full 2,043/2,043, index 74 chunks / 315,116 units, identity \`76b9199c…\`.
`);

const marks = {
  'research/CURRENT.md': 'W45-88 **终端胶水',
  'research/STATUS.md': '\nW45-88:',
  'research/coding-standard.md': '\n2026-10-17 W45-88 ',
  'research/ports/W45-chain-runner.md': '\n## W45-88 ported',
  'research/FEATURES.md': 'W45-88 adds the terminal glue',
  '.audit/w45-runtime.todo.md': '\n## W45-88 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
