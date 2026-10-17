// W45-78 record: React layer partition 4 — the held-press store and the terminal input/select
// dispatch. Writes the package section, the CURRENT row, the STATUS and FEATURES tails, the
// one-line coding-standard entry, the runtime trail and the acceptance list. Every anchor is
// asserted unique before any write.
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
## W45-78 ported the held-press store and the terminal input/select dispatch (2026-10-17)

Partition 4 of the React layer starts with the core the last leaf needs: a drawing holds one handle
per pressable element, and an input or select event runs the plugin that drew it. Fifty-two blocks
are copied verbatim (8,476 units) into two modules: the press cluster (42 blocks, 6,846 units) from
chunk-n3ykh62m.js and chunk-p16hdq43.js, and the three press-site descriptors (10 blocks, 1,630
units) from chunk-nyce03br.js. The generated modules are \`plugin-chain-press-source.ts\` and
\`plugin-chain-press-sites-source.ts\`; the seams are \`plugin-chain-press.ts\` and
\`plugin-chain-press-sites.ts\`, the latter rebuilding the site table \`zd\` with exactly the three
events the terminal dispatch reads.

\`XPt\` walks a drawing and returns one entry per pressable element (Button, Input, Select, Markdown),
reading a Select's drawn option values; \`Rto\` files those entries in the held-press store \`AK\`
under a key of plugin, component, requestId and surface, rewrites every \`press.handle\` through
\`SFs\`/\`le\`, and reuses the handle a previous drawing of the same plugin drew through \`bf\`. The
store keys presses by the hosted handle but keeps the handle the drawing held on the entry — the
value the module's press receives. Hosting a replacement drawing deletes the entries it no longer
holds and reports them as released; \`FM\`/\`BM\` release the module runners and hosted-button
bookkeeping for the handles that survive that cleanup.

The dispatch \`Xl\` finds the held entry by hosted handle, or by the full key when the handle misses,
refuses a tag that does not match the event, and runs \`aP\` over \`Yl\` — the module's own press, plus
any per-handle runner \`Hrt\` registered — with the site's \`check\` over the answer. \`x_\` builds the
input argument from the held entry, its surface, the kind and the value; \`T_\` builds the select
argument and admits only a value the drawing offered. \`UPn\`/\`jPn\` queue the dispatch per plugin
through \`kf\`/\`Cf\`, and \`ql\` runs it only when the plugin holds the element.

The copied handler forced one seam addition. \`Yl\` reads the loaded module record and calls
\`h.press(handle, argument)\`, which is the record \`tGe\` builds with \`press\` and \`releasePresses\`;
this product's in-process record factory did not carry either, so a held press would have thrown.
The record now routes \`press\` to the module's own press and answers \`releasePresses\` as a no-op (an
in-process module holds no environment handles), and \`ChainModule.press\` names the handle a drawing
held instead of a string.

What was measured (probe log \`.audit/w45-78-probe.txt\`): \`XPt\` on the fixture drawing answers five
entries in drawing order, the Select carrying \`options: ["a", "b"]\`, and a Text or an element
without a string \`props.key\` contributes nothing; \`Rto\` replaces the source handles 1,2,3,4,7 with
five distinct hosted handles below \`S_\` = 1073741824, and \`_f\` is
\`plugin\\u0000component\\u0000requestId\\u0000surface\`; a second drawing of the same plugin reuses
its hosted handle and the reused entry carries the newer requestId; \`x_\` answers
\`{element:"i1", value:"hello"}\` and the fixture press receives handle 2 (the drawn handle) with the
argument \`{plugin, element, component, requestId, surface, kind, value}\`; \`T_\` admits \`"a"\`, refuses
\`"z"\` without running anything, and the select argument has no kind; a handle miss with the full key
still dispatches, an unheld element answers undefined, and a matching-tag press for an unloaded
plugin rejects with \`ui.input: ghost, which drew g1, is not loaded\`; \`Rto(newDrawing)\` reports the
dropped handles \`[1, 3, 4]\`, \`FM(old, new)\` the same, and \`BM(new)\` reports \`[2]\`; \`m_\` numbers
handles from -1 and releases them; the three sites answer \`ui.press\`, \`ui.input\`, \`ui.select\`, and
\`ot\`/\`mn\`/\`Cn\` answer the source's own refusal messages.

The ui.press dispatch \`BPn\`/\`TIe\` is deferred to W45-79. Its link guard calls \`Rf\`/\`nur\`, which
reaches the URL normalizer \`mxn\`; that module's graph is 706 units and imports node:path/node:url,
the Windows UNC and encoded-path handling, and two more chunks, so it is its own package. W45-80
then copies \`Xt\` Markdown, the last leaf.

Verified: tsc 0, both copies scan \`unresolved 0\` (75/16 declared), notices 0, 20 new tests, the
chain family 614/614, full 1,890/1,890, and the recovered-source index at 62 chunks / 1,557
statements / 286,430 units (2.7%). Identity \`eb114e4a…\`.

`);

rep('research/CURRENT.md',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-77 ',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-78 **React 层分区 4 核心：按住式 press 存储 + 终端 input/select 派发**（插件绘制的元素如何持有句柄、输入/选择如何找到插件并执行）：**52 段 8,476 单位 / 2 模块**（chunk-n3ykh62m.js + chunk-p16hdq43.js 42 段 6,846u：runner 表 `m_`/`Hrt`、已释放判 `g_`、派发处理器 `Yl`、串行队列 `bo`、绘图键 `_f`、跨绘图复用 `bf`、句柄空间 `S_`/`__`、press 存储 `b_`/`AK`（heldPress/holdDrawing/holdersOf/forgetPresses/heldByKeyOf/hostedButtonsOf/heldPressCount）、释放 `vAt`、托管 `Rto`、输入参数 `w_`、站点队列 `kf`/`Cf` 与描述符 `Ef`/`vf`、持有判 `k_`、替换释放 `FM`/`BM`、派发 `Xl`、输入/选择入口 `x_`/`R_`/`T_`、持有门 `ql`、终端入口 `UPn`/`jPn`；绘制遍历 `_`/`I`/`ke`/`D`/`ve`/`XPt`、悬停种类 `M$n`、叶/按住判 `q`/`z`、重标 `je`/`K`/`le`/`SFs`；chunk-nyce03br.js 10 段 1,630u：表面表 `w3`/`vFe`、参数包装 `C`、共享/输入/选择校验 `ot`/`mn`/`Cn`、描述符构造 `Lt`、站点 `ya`/`da`/`ha`）。**记录接缝补齐**：`Yl` 调用载入模块记录的 `h.press(handle, argument)`（即源 `tGe` 记录的 `press`/`releasePresses`），本产品 in-process 记录工厂原先缺这两项；现 `press` 路由到模块自身 press、`releasePresses` 为 no-op，`ChainModule.press` 改收绘图句柄。**实测**：`XPt` 五条（Select 带 options）；`Rto` 把源句柄 1,2,3,4,7 换成 5 个 `<S_=1073741824` 的托管句柄，`_f=plugin\\0component\\0requestId\\0surface`；同插件二次绘图复用句柄且条目改带新 requestId；`x_` 返回 `{element:"i1",value:"hello"}`，模块 press 收到源句柄 2 与 `{plugin,element,component,requestId,surface,kind,value}`；`T_` 收 `"a"` 拒 `"z"`（不执行），选择参数无 kind；句柄失配但全键命中仍派发；未持有返回 undefined；同 tag 的未载入插件报 `ui.input: ghost, which drew g1, is not loaded`；`Rto(new)` 释放 `[1,3,4]`、`FM` 同、`BM(new)` 释放 `[2]`；`m_` 句柄从 -1 起。**范围决策**：`BPn`/`TIe`/`Ohe` 及其链接守卫 `Rf`/`nur`→URL 归一 `mxn`（706 单位，含 node:path/node:url/Windows UNC）留给 W45-79；W45-80 取 `Xt` Markdown。tsc 0；未声明扫描 2 文件 unresolved 0；新套件 20/20；链家族 614/614；全量 1,890/1,890；索引 62 chunk/286,430 单位（2.7%）；身份 `eb114e4a…`。 | [Press 证据](ports/W45-press-evidence.json)、[工作包](ports/W45-chain-runner.md) |\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-77 ',
);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W45-78: React layer partition 4 begins — the held-press store and the terminal input/select dispatch. Fifty-two source blocks, 8,476 units: a drawing's press handles are hosted under a plugin/component/request/surface key and rewritten in place, reused across drawings of the same plugin, and released when a replacement drops them; the dispatch finds the held entry by handle or full key and runs the drawing plugin's own press through \`aP\` under the site's check. The in-process module record now carries the source \`tGe\` press pair. 20/20 new tests, 614/614 chain family, 1,890/1,890 full; tsc 0; index 62 chunks / 286,430 units. [W45 record](ports/W45-chain-runner.md).
`);

rep('research/FEATURES.md',
  'W45-77 begins partition 3 with the Code leaf: it measures its own width, truncates by wrap mode, and draws either the source through the code block renderer or a patch through the unified-diff renderer, which pairs removed and added lines word by word. |',
  'W45-77 begins partition 3 with the Code leaf: it measures its own width, truncates by wrap mode, and draws either the source through the code block renderer or a patch through the unified-diff renderer, which pairs removed and added lines word by word; W45-78 begins partition 4 with the held-press store: a drawing\'s pressable elements are hosted under a plugin/component/request/surface key, their handles rewritten in place, and an input or select event runs the drawing plugin\'s press through the site\'s check. |',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W45-78 React 层分区 4 核心（按住式 press 存储 + 终端 input/select 派发）：S-1至S-7已对照。S-1（先读源）：先量出 52 段/8,476 单位/2 模块，逐段读 \`b_\`/\`Xl\`/\`Yl\`/\`Rto\`/\`XPt\`/\`SFs\` 正文，确认 \`He\`/\`aP\`/\`L\`/\`$A\`/\`P0\`/\`NDe\` 已承载或可导入。S-2（不臆造）：\`Yl\` 读模块记录的 \`press\`/\`releasePresses\`，产品记录工厂按源 \`tGe\` 记录补齐（press 路由到模块自身 press，releasePresses 为 no-op，因为 in-process 模块不持有环境句柄）；未自造派发路径。S-3（宿主边界）：新接缝为 \`plugin-chain-press.ts\`（存储/遍历/派发再导出）与 \`plugin-chain-press-sites.ts\`（三个站点 + 重建 \`zd\`）。S-4（可测）：20 条用例先经 \`.audit/w45-78-probe.ts\` 实测再断言，覆盖托管复用、按元素过滤、全键回退、选项准入、未载入插件拒绝、释放序列与站点校验文案。S-5/S-6：\`NDe\` 从 store-entry 源导出以支撑 \`bo\` 的串行队列；\`ChainModuleRecord\` 与 \`ChainEnvironmentHost\` 的 press 参数统一为绘图句柄，既有 loader 夹具保持通过。S-7（记录）：证据 JSON 记录 52 段区间与摘要、2 模块摘要、分区进度与 W45-79 拆分理由。验证：tsc 0、未声明扫描 75/16 unresolved 0、notices 0、新套件 20/20、链家族 614/614、全量 1,890/1,890、索引 62 chunk/286,430 单位、身份 eb114e4a…。
`);

const tsv = read('.audit/w45-runtime.tsv');
const rows = [
  ['2026-10-17T18:30:00Z', 'package', 'W45-78 React 层分区 4 核心：按住式 press 存储 + 终端 input/select 派发（52 段 8,476 单位 / 2 模块）',
    'm_/g_/Hrt/Yl/bo/_f/bf/S_/__/b_/AK/vAt/Rto/w_/kf/Ef/k_/FM/BM/Xl/x_/R_/vf/T_/ql/UPn/Cf/jPn、XPt 及其遍历族、w3/vFe/C/ot/mn/Cn/Lt/ya/da/ha 成为产品面；plugin-chain-press.ts 与 plugin-chain-press-sites.ts 两个接缝；记录工厂补齐 press/releasePresses；NDe 导出',
    'chunk-n3ykh62m.js + chunk-p16hdq43.js 42 段 6,846u + chunk-nyce03br.js 10 段 1,630u',
    '20/20 新套件；链家族 614/614；全量 1,890/1,890；2 文件 unresolved 0'],
  ['2026-10-17T18:32:00Z', 'decision', 'W45-78 拆出 W45-79：ui.press 派发 BPn/TIe/Ohe 与链接守卫 Rf/nur',
    'BPn 的链接守卫调用 mxn（URL 归一，706 单位）并级联 node:path/node:url、Windows UNC/编码路径与两个 chunk；与 press 存储同包会让本包失去可验收边界',
    '本包只保留存储、遍历与 input/select 派发；BPn/TIe/Ohe/Rf/nur/mxn 移入 W45-79；Xt Markdown 移入 W45-80',
    '.audit/w45-78-plan.mjs 的 exports/blocks 与 .audit/w45-78-sites-plan.mjs'],
  ['2026-10-17T18:34:00Z', 'finding', 'W45-78 实测 press 托管与派发行为',
    '① XPt 五条（Select 带 options，Text/无 key 不产出）；② Rto 换 5 个托管句柄（<1073741824），_f=plugin\\0component\\0requestId\\0surface；③ 同插件二次绘图复用句柄且条目改带新 requestId；④ x_ 返回 {element:"i1",value:"hello"}，模块 press 收源句柄 2；⑤ T_ 收 "a" 拒 "z" 不执行；⑥ 句柄失配全键命中仍派发；⑦ 同 tag 未载入插件报 "ui.input: ghost, which drew g1, is not loaded"；⑧ Rto(new) 释放 [1,3,4]、FM 同、BM(new) 释放 [2]；⑨ 站点校验文案逐条命中',
    '九条由 .audit/w45-78-probe.ts 实测后写入证据与测试',
    '.audit/w45-78-probe.txt + test/plugin-chain-press.test.ts'],
  ['2026-10-17T18:36:00Z', 'verification', 'W45-78 验收：2 文件 scan unresolved 0、tsc 0、notices 0、20/20、614/614、1,890/1,890、索引 62 chunk/286,430 单位、身份 eb114e4a…',
    '下一步 W45-79 取 BPn/TIe/Ohe/Rf/nur 与 URL 归一 mxn；随后 W45-80 取 Xt Markdown',
    'source-undeclared-scan declared 75/16，unresolved 均 0；新套件 20/20；链家族 614/614；全量 1,890/1,890；索引 62 chunks / 1,557 语句 / 286,430 单位（2.7%）'],
];
const added = rows.filter(([stamp]) => !tsv.includes(stamp)).map((row) => row.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md').replace(/\n+$/, '\n');
write('.audit/w45-runtime.todo.md', todo + `
## W45-78 acceptance (2026-10-17)

- [x] **Partition 4 starts with the held-press core.** The press cluster and the three site descriptors are copied whole; the store, the drawing passes and the input/select dispatch are the product surface.
- [x] **The module record carries the source press pair.** \`Yl\` calls the record's \`press\`/\`releasePresses\`; the in-process record now answers both, with the module's own press receiving the handle the drawing held.
- [x] **The dispatch's two misses stay distinct.** A tag mismatch answers undefined silently; a matching-tag press for an unloaded plugin reaches \`Yl\` and throws the source's message. The full-key fallback is tested.
- [x] **Behaviour was measured before it was asserted.** Hosting, handle reuse, per-element filtering, option admission, the release sequence and every site refusal message are in the probe log and the suite.
- [x] **Scope split recorded.** \`BPn\`/\`TIe\`/\`Ohe\` and the \`mxn\` URL graph move to W45-79; \`Xt\` Markdown to W45-80.
- [x] **Sweep.** tsc 0, copies \`declared 75/16 / unresolved 0\`, notices 0, new suite 20/20, chain family 614/614, full 1,890/1,890, index 62 chunks / 286,430 units, identity \`eb114e4a…\`.
`);

const marks = {
  'research/CURRENT.md': 'W45-78 **React 层分区 4 核心',
  'research/STATUS.md': '\nW45-78:',
  'research/coding-standard.md': '\n2026-10-17 W45-78 ',
  'research/ports/W45-chain-runner.md': '\n## W45-78 ported',
  'research/FEATURES.md': 'W45-78 begins partition 4',
  '.audit/w45-runtime.todo.md': '\n## W45-78 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
