// W45-76 record: React layer partition 2b-ii — the Image component and the close of the Image slice.
// Writes the package section, the CURRENT row, the STATUS and FEATURES tails, the one-line
// coding-standard entry, and the runtime trail. Every anchor is asserted unique before any write.
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
## W45-76 ported the Image component, partition 2b-ii, closing the Image slice (2026-10-17)

The Image site component asks the terminal to draw a plugin image. Nine blocks are copied verbatim
(4,944 units): the probe query \`uFo\` and the error-code reader \`E\`; the alt decision \`Eo\`; the probe
constants, \`Lo\`/\`tr\`/\`rr\`/\`dt\`, the transmit builder \`or\`, the refusal log \`Po\`/\`Ho\` and the tracker
\`xt\`; the id-width table \`Ke\`; the mount registration \`Mo\`; the file-answer subscription \`Oo\`; the
resolver \`Ao\`; and the component \`No\`. The seam (\`src/plugin-chain-image-component.ts\`) re-exports
them; the host boundary is \`src/plugin-chain-image-host.ts\`.

The resolver allocates an id on mount, transmits on the first render and on a source or size change,
skips a resend of the same file/shm reference, and registers a callback through the image mount
writer (\`ELs\`/\`vLs\`, carried since W45-59) whose answer is the alt element or undefined. The
component renders that answer as a Box holding one \`ink-raw-ansi\` element, or the alt text when the
resolver answers undefined. The file-read probe writes a 4-byte probe image to a temp path, asks
through \`uFo\`, and settles the W45-75 store; six transient filesystem errors leave it inconclusive.

The host seam serves what the source reaches through the bundle: \`LT\`/\`Z8n\`/\`aWo\`/\`$1t\` over the
copied capability and probe stores, the client and querier contexts (null by default, which the
source already treats as absent), the colour level \`ge\` and the temp path builder \`lPe\`. The client
and querier contracts are read from the source's calls, and the fixture that implements them lives
with the tests.

The component forced two additions to the W45-72 hook seam. \`y\` now accepts the source's three
initializer forms (\`y(fn)\`, \`y(value)\`, \`y()\`), and \`runComponent\` re-renders after a state setter,
the way React does: the resolver's id only exists after its mount effect, so the component's first
render sees none. Effects also run the previous cleanup when their dependencies change, so the
re-render does not leave a second mount registration behind. The eleven W45-72 tests still pass.

What was measured (probe log \`.audit/w45-76-probe.txt\`): the five alt reasons in order; the refusal
log's 5 s per-key window; the id width at colour levels 0/1/2/3 and without kitty graphics; the three
probe outcomes (answered OK, flushed no reply, dropped); the probe request \`uFo(9, temp)\` with the id
allocated at width 24 and the temp file removed; the inline component's single \`resend: true\`
transmit and \`lFo(id, columns, rows)\` alt; the id freed on unmount; and the cannot-read-files answer
the file source registers.

Verified: check/build/notices, the scanned copy \`declared 81, unresolved 0\`, 15 new tests over the
alt decision, the refusal log, the transmit builder, the id width, the mount registration, the three
probe outcomes and the component renders, the chain family 568/568, full 1844 tests / 1844 pass /
0 fail, and the recovered-source index at 58 chunks / 1,441 statements / 255,604 units (2.5%).
Identity \`7b53418e…\`.

The Image slice is closed: W45-73 the wire layer, W45-74 the source model, W45-75 the capability and
probe stores, W45-76 the component and resolver. Next is partition 3, the leaf components (\`lt\`
Code, \`Xt\` Markdown, the text/link group), then the interactive elements, the Client host, and last
the site-tree walker \`je\` with the terminal glue.

`);

rep('research/CURRENT.md',
  '| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-75',
  '| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-76 **React 层 Image 分区 2b-ii 落地，Image 片收口**（Image 站点组件与解析器）：9 段 4,944 单位（`Eo` 697、探测常量与 `Lo`/`tr`/`rr`/`dt`/`or`/`Po`/`Ho`/`xt` 1,742、`Ke` 212、`Mo` 186、`Oo` 200、`Ao` 1,410、`No` 323、`uFo` 75、`E` 99），逐字复制到 `plugin-chain-image-component-source.ts`；宿主角 `plugin-chain-image-host.ts` 以 W45-75 存储承接 `LT`/`Z8n`/`aWo`/`$1t`，并提供 `bC`/`QO` 夹具上下文、`ge` 与 `lPe`。**hook seam 扩展**：`y` 支持源的三类初始化（函数/值/空），`runComponent` 在 setState 后重渲染（解析器 id 只在挂载 effect 后存在），effect 依赖变化先跑旧 cleanup（避免重复注册）。**实测**：`Eo` 五种 alt 原因按序；`Ho` 5 秒同键同消息去重；`vo` 0/1 级 undefined、2 级 8 位、3 级 24 位、无 kittyGraphics 时 undefined；`dt` 三种结局（OK/已刷新无回复/查询被丢仍 unasked）；探测请求为 `uFo(9,temp)`、宽度 24、临时文件已删；内联源单次 `resend:true` 并绘 `lFo(id,列,行)`，卸载 free id；文件源在不可读终端返回 cannot-read 文案。tsc 0；新套件 15/15；链家族 568/568；全量 1844/1844；索引 58 chunk/1,441 语句/255,604 单位（2.5%）；身份 `7b53418e…`。 | [Image 组件证据](ports/W45-image-component-evidence.json)、[工作包](ports/W45-chain-runner.md) |\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-75',
);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W45-76: React layer partition 2b-ii — the Image component and resolver, closing the Image slice. Nine source blocks, 4,944 units: the resolver allocates an id, transmits through the wire layer, skips a resend of the same reference, and registers the alt answer through the image mount writer; the component draws the raw-ansi alt or the text when the resolver answers undefined. The host seam serves the capability/probe accessors, the client and querier contexts, the colour level and the temp path builder. The hook runner gained the source's second effect hook, useCallback, all three state initializer forms, re-render after a state setter, and cleanup on a dependency change. 15/15 new, 568/568 chain family, 1844/1844 full; tsc 0; index 58 chunks / 255,604 units. [W45 record](ports/W45-chain-runner.md).
`);

rep('research/FEATURES.md',
  'a one-shot file-read probe and the terminal capability table with its defaults, settled readings and pending guesses. |',
  'a one-shot file-read probe and the terminal capability table with its defaults, settled readings and pending guesses; W45-76 closes the Image slice: the resolver allocates an id, transmits the source, skips a resend of the same reference and registers the alt answer through the image mount writer, and the component draws the raw-ansi alt or the alt text. |',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W45-76 React 层 Image 分区 2b-ii（Image 组件与解析器，Image 片收口）：S-1至S-7已对照。S-1（先读源）：先量出 9 段/4,944 单位并逐段读 \`Ao\`/\`No\`/\`Eo\`/探测链正文，确认 \`ELs\`/\`vLs\`、\`er\`/\`y$\`、\`t\`、\`Ds\` 等依赖均已承载或可导入。S-2（不臆造）：客户端/查询器契约从源码调用点读出（allocate/free/transmit/isBackedUp、send/flush），以夹具承接；能力包装 \`LT\`/\`Z8n\`/\`aWo\`/\`$1t\` 只作既有存储的访问器，环境猜测 \`d()\` 未自造。S-3（宿主边界）：新边界为 \`plugin-chain-image-host.ts\`（客户端、查询器、色级、临时路径）。S-4（可测）：15 条用例先经 \`.audit/w45-76-probe.ts\` 实测再断言，覆盖五种 alt 原因、去重日志、id 宽度、三种探测结局、组件渲染与卸载。S-5/S-6：hook runner 按 React 语义扩展（三类初始化、setState 重渲染、依赖变化先跑 cleanup），W45-72 的 11 条测试保持通过。S-7（记录）：证据 JSON 记录 9 段区间与摘要、Image 片四包收口表。验证：tsc 0、未声明扫描 unresolved 0、notices 0、新套件 15/15、链家族 568/568、全量 1844/1844、索引 58 chunk/255,604 单位、身份 7b53418e…。
`);

const tsv = read('.audit/w45-runtime.tsv');
const rows = [
  ['2026-10-17T17:40:00Z', 'package', 'W45-76 React 层 Image 分区 2b-ii：Image 组件与解析器（9 段 4,944 单位）',
    'Eo/Lo/tr/rr/dt/or/Ho/vo/Mo/Oo/Ao/No 等成为产品面；新 plugin-chain-image-component.ts 再导出；新 plugin-chain-image-host.ts 宿主边界；hook seam 增加 P/le 与重渲染；15 条测试',
    'chunk-886tf6ja.js [4814,4913) E + chunk-fzk4rpqy.js [7397,7472) uFo + chunk-kjfwbh4w.js [30935,31632) Eo + [31686,33428) 探测链 + [33432,33644) Ke + [33648,33834) Mo + [33838,34038) Oo + [34038,35448) Ao + [35448,35771) No',
    '15/15 新套件；链家族 568/568；全量 1844/1844；Image 片四包收口；W45-72 hook 测试 11/11 保持'],
  ['2026-10-17T17:42:00Z', 'decision', 'W45-76 hook runner 按 React 语义扩展而非在组件内绕行',
    '解析器 id 只在挂载 effect 后存在，单次渲染的 runner 会让 No 永远画 alt；同时 effect 依赖变化必须跑旧 cleanup，否则重渲染会留下重复挂载注册',
    'runComponent 增加 setState 后重渲染（上限 50 次）与依赖变化先跑旧 cleanup；y 支持源的三类初始化；新增 P/le；未改源正文',
    'src/plugin-chain-react-hooks.ts + W45-72 回归 11/11'],
  ['2026-10-17T17:44:00Z', 'finding', 'W45-76 实测四处组件行为',
    '① Eo 五种原因按序返回且内联源在不可读终端仍可绘；② Ho 5 秒内同键同消息去重、换消息立即记录；③ dt 三种结局（OK/false no reply/unasked dropped）；④ 文件源在不可读终端由挂载回调返回 cannot-read 文案',
    '四条由 .audit/w45-76-probe.ts 实测后写入证据与测试；客户端与查询器为夹具契约',
    '.audit/w45-76-probe.txt + test/plugin-chain-image-component.test.ts'],
  ['2026-10-17T17:46:00Z', 'verification', 'W45-76 验收：scan unresolved 0、tsc 0、notices 0、15/15、568/568、1844/1844、索引 58 chunk/255,604 单位、身份 7b53418e…',
    'Image 片（W45-73..76）收口；下一包取叶子组件（lt/Xt/text/link）',
    'source-undeclared-scan declared 81 / unresolved 0；新套件 15/15；链家族 568/568；全量 1844/1844；索引 58 chunks / 1,441 语句 / 255,604 单位（2.5%）'],
];
const added = rows.filter(([stamp]) => !tsv.includes(stamp)).map((row) => row.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md').replace(/\n+$/, '\n');
write('.audit/w45-runtime.todo.md', todo + `
## W45-76 acceptance (2026-10-17)

- [x] **The Image slice is closed in four bounded packages.** Wire layer (W45-73), source model (W45-74), capability and probe stores (W45-75), component and resolver (W45-76); the evidence records the four.
- [x] **The bodies are copied whole.** Nine blocks with ranges and digests; the only hand-written product code is the host boundary and the hook-runner extension it required.
- [x] **The host boundary is named and minimal.** \`LT\`/\`Z8n\`/\`aWo\`/\`$1t\` read the W45-75 stores; \`bC\`/\`QO\` are fixture contexts that default to null, the source's own absent value; \`ge\` and \`lPe\` are the colour level and temp path.
- [x] **The hook runner follows the React semantics the source relies on.** All three state initializer forms, re-render after a state setter, and cleanup on a dependency change; W45-72's 11 tests still pass.
- [x] **Behaviour was measured before it was asserted.** Five alt reasons, the refusal window, the id widths, the three probe outcomes, the single transmit, the temp-file removal and the cannot-read answer are in the probe log and in the suite.
- [x] **Sweep.** tsc 0, copy \`declared 81 / unresolved 0\`, notices 0, new suite 15/15, chain family 568/568, full 1844/1844, index 58 chunks / 255,604 units, identity \`7b53418e…\`.
`);

const marks = {
  'research/CURRENT.md': 'W45-76 **React 层 Image 分区 2b-ii 落地',
  'research/STATUS.md': '\nW45-76:',
  'research/coding-standard.md': '\n2026-10-17 W45-76 ',
  'research/ports/W45-chain-runner.md': '\n## W45-76 ported',
  'research/FEATURES.md': 'W45-76 closes the Image slice',
  '.audit/w45-runtime.todo.md': '\n## W45-76 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
