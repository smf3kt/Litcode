// W45-83 record: the hover group, its store, members, overrides and the two components. Writes the
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
## W45-83 ported the hover group (2026-10-17)

The Button depends on the hover group, so it lands first. Fifteen blocks are copied verbatim (2,240
units) into \`plugin-chain-hover-source.ts\`: the store accessor \`Fe\`, the count adjuster \`mt\`, the
member handle \`_t\`, the group key \`Bt\` and its \`Dbr\` string, the override split \`ft\`, the
subscription hook \`ut\`, the color props \`Kt\`, the normalizer \`De\`, the scope context \`_e\`, the
resolver \`jt\`, the components \`$t\`/\`Ut\`, and the selector hook \`Re\` with its two helpers.

The group is a count store. \`it().hoverGroups\` is the registry's own Map store; every member
increments and decrements its \`plugin\\0scope\\0scope\` key, and a site is hot while any member is
counted in. \`_t\` holds at most one group at a time (\`enter\` while already in a group is ignored;
\`regroup\` moves it). \`jt\` gives a grouped site the group's own hot state and an ungrouped one the
enclosing \`_e\` scope; \`De\` maps the three color props through the named-color table already ported
in \`plugin-chain-decorations-source.ts\`. \`$t\` keeps its own hover state for a live scope, provides
it to the subtree and merges the hover overrides into the layout; \`Ut\` draws a Text or Box with the
resolved overrides.

The seam extends \`qt\` to the source's own shape — a context is its own \`Provider\` (\`e.Provider=e\`),
so \`$t\`'s provider element is constructed exactly as the source does; the runner still resolves
values from the render's \`contexts\` map. The store scheduler \`PU\` is a host context: with no
provider \`Re\` subscribes directly, the source's default.

What was measured (probe log \`.audit/w45-83-probe.txt\`): \`Dbr\` is \`p\\0scope\\0s\`; \`Bt\` answers
\`{plugin,scope}\` only when both exist; \`ft\` strips \`scope\`; \`De\` maps red/blue and leaves unknown
names and hex; \`mt\` adjusts and drops at zero; a member counts one group at a time and \`regroup\`
moves it; \`ut\` cold/hot, enter twice (2), unmount (1), no group false; \`jt\` cold/scope/group paths;
a hot HoverScope's Box merges layout and the mapped hover block with both handlers and
\`hoverFollowsPaint\`; HoverStyled draws Box or Text; \`Re\` selects and calls the mounted scheduler.

Verified: tsc 0, the copy scans \`unresolved 0\` (43 declared), notices 0, 10 new tests, the chain
family 677/677, full 1,953/1,953, and the recovered-source index at 68 chunks / 1,631 statements /
297,516 units (2.7%). Identity \`92f69502…\`.

Next: the Button with its action keys, the Client host, and last the site-tree walker \`je\` with the
terminal glue.

`);

rep('research/CURRENT.md',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-82 ',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-83 **悬停组（Button 的前置）**：**15 段 2,240 单位**（`Fe`/`mt`/`_t` 计数成员、`Bt`+`Dbr` 组键、`ft` 去 scope、`ut` 订阅、`Kt`/`De` 颜色归一、`_e` scope 上下文、`jt` 解析、`$t` HoverScope、`Ut` HoverStyled、`Re` 选择器与两个辅助）。**接缝调整**：`qt` 恢复源形状（context 自身即 `Provider`），`$t` 的 provider 元素与源一致；`PU` 调度器为宿主上下文（无 provider 时直连订阅，源默认）；注册表类型补 `hoverGroups`。**实测**：`Dbr` 为 `p\\0scope\\0s`；`Bt` 双值才成组；`De` 映射 red/blue、保留未知名与十六进制；`mt` 加删、`_t` 一次只在一个组且 `regroup` 迁移；`ut` 冷/热/两次进 2/卸载回 1/无组 false；`jt` 冷 scope/热 scope/热组/冷组四路；热 HoverScope 的 Box 合并 layout 与映射后的 hover、带双 handler 与 `hoverFollowsPaint`；HoverStyled 按 `isInline` 画 Box/Text；`Re` 选中并经 `paced` 订阅。tsc 0；未声明扫描 unresolved 0；新套件 10/10；链家族 677/677；全量 1,953/1,953；索引 68 chunk/297,516 单位（2.7%）；身份 `92f69502…`。 | [Hover 证据](ports/W45-hover-evidence.json)、[工作包](ports/W45-chain-runner.md) |\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-82 ',
);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W45-83: the hover group is a count store keyed by plugin and scope; members count in and out, the scope provider carries its own hover state, and the resolver maps named colors and applies the group or the enclosing scope. Fifteen source blocks, 2,240 units. The hook seam's context gained its source Provider shape. 10/10 new tests, 677/677 chain family, 1,953/1,953 full; tsc 0; index 68 chunks / 297,516 units. [W45 record](ports/W45-chain-runner.md).
`);

rep('research/FEATURES.md',
  'reserves the label and submit hint in its width. |',
  'reserves the label and submit hint in its width; W45-83 adds the hover group, a counted store keyed by plugin and scope whose members, scope provider and override resolver drive the hover styling of the interactive sites. |',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W45-83 悬停组：S-1至S-7已对照。S-1（先读源）：量出 15 段/2,240 单位，逐段读 hover 集群、\`Re\` 与 \`Dbr\` 正文，确认 \`Ckn\` 复用 decorations 副本、\`it\` 复用 host 接缝。S-2（不臆造）：存储、计数、成员单组、override 解析与 provider 形状全部按源正文保留。S-3（宿主边界）：\`PU\` 为调度器上下文，无 provider 时直连订阅（源默认）；\`qt\` 补 \`Provider\` 自指形状。S-4（可测）：10 条用例先经 \`.audit/w45-83-probe.ts\` 实测再断言（含真 store 的订阅/卸载计数）。S-5/S-6：悬停集群一次收齐，\`Tc\`/\`s\`/\`n\` 与 jsx 工厂按源区分。S-7（记录）：证据 JSON 记录 15 段区间、接缝调整与分区进度。验证：tsc 0、未声明扫描 43 unresolved 0、notices 0、新套件 10/10、链家族 677/677、全量 1,953/1,953、索引 68 chunk/297,516 单位、身份 92f69502…。
`);

const tsv = read('.audit/w45-runtime.tsv');
const rows = [
  ['2026-10-17T20:25:00Z', 'package', 'W45-83 悬停组（15 段 2,240 单位）',
    'Fe/mt/_t/Bt/ft/ut/Kt/De/_e/jt/$t/Ut/Re/Dbr/u4n/c 成为产品面；plugin-chain-hover-source.ts 生成副本；新 plugin-chain-hover.ts 公共 seam、plugin-chain-hover-host.ts 的 PU',
    'chunk-kjfwbh4w.js 12 段 + chunk-5b7mmg84.js 2 段 + chunk-p16hdq43.js 1 段共 2,240u',
    '10/10 新套件；链家族 677/677；全量 1,953/1,953；1 文件 unresolved 0'],
  ['2026-10-17T20:28:00Z', 'decision', 'W45-83 hover 组用计数存储，qt 恢复源 Provider 形状',
    '① 组热度是计数不是布尔，`_t` 一次只在一个组；② grouped 站点用组热度、ungrouped 用外层 scope；③ `PU` 无 provider 时直连（源默认）；④ `qt` 的 `Provider` 自指按源正文补齐，渲染仍从 contexts 取值',
    '测试断言按 store/成员/订阅/解析/两组件/选择器六组书写',
    '.audit/w45-83-probe.txt + test/plugin-chain-hover.test.ts'],
  ['2026-10-17T20:31:00Z', 'finding', 'W45-83 实测 hover 计数、override 与组件渲染',
    '① Dbr/Bt/ft；② De 颜色映射与保留；③ mt/成员单组/regroup；④ ut 冷热/进出/卸载；⑤ jt 四路；⑥ 热 HoverScope 合并 layout+hover；⑦ HoverStyled Box/Text；⑧ Re 选择与 paced',
    '八条由 .audit/w45-83-probe.ts 实测后写入证据与测试',
    '.audit/w45-83-probe.txt + test/plugin-chain-hover.test.ts'],
  ['2026-10-17T20:35:00Z', 'verification', 'W45-83 验收：scan unresolved 0、tsc 0、notices 0、10/10、677/677、1,953/1,953、索引 68 chunk/297,516 单位、身份 92f69502…',
    '下一步 Button + action keys，随后 Client host、je/终端胶水',
    'source-undeclared-scan declared 43，unresolved 0；新套件 10/10；链家族 677/677；全量 1,953/1,953；索引 68 chunks / 1,631 语句 / 297,516 单位（2.7%）'],
];
const added = rows.filter(([stamp]) => !tsv.includes(stamp)).map((row) => row.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md').replace(/\n+$/, '\n');
write('.audit/w45-runtime.todo.md', todo + `
## W45-83 acceptance (2026-10-17)

- [x] **The hover group is ported.** The store accessor, the count adjuster, the member handle, the key/override helpers, the scope context, the resolver, the two components and the selector hook are copied.
- [x] **The group is a count.** Members count in and out by key and a member holds one group at a time; the key is plugin and scope.
- [x] **The scope provider is the source's.** \`qt\` carries \`Provider\` pointing at the context itself, so \`$t\` builds the source element; values still come from the render's contexts.
- [x] **Overrides resolve group-then-scope.** A grouped site follows its group, an ungrouped one the enclosing scope, and every color is normalized through the named-color table.
- [x] **Sweep.** tsc 0, copy \`declared 43 / unresolved 0\`, notices 0, new suite 10/10, chain family 677/677, full 1,953/1,953, index 68 chunks / 297,516 units, identity \`92f69502…\`.
`);

const marks = {
  'research/CURRENT.md': 'W45-83 **悬停组',
  'research/STATUS.md': '\nW45-83:',
  'research/coding-standard.md': '\n2026-10-17 W45-83 ',
  'research/ports/W45-chain-runner.md': '\n## W45-83 ported',
  'research/FEATURES.md': 'W45-83 adds the hover group',
  '.audit/w45-runtime.todo.md': '\n## W45-83 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
