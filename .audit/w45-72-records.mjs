// W45-72 record: React layer partition 1 (the Raster site component and its surface hook). Writes the
// package section, the CURRENT row, the STATUS and FEATURES tails, the one-line coding-standard entry,
// and the runtime trail. The four documents are asserted unique before any write.
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

## W45-72 ported partition 1 of the React layer (2026-10-17)

The React layer is partitioned before it is taken, and this package takes the first slice: the Raster
site component and the surface hook that binds a mounted raster to the node it paints through. Ten
source blocks, 1,479 units, two chunks; the host layer is a seam, because this build has no React.

The source's site components are React functions. The source bodies are obtainable, so they are
copied verbatim and the host layer is the seam, the way W45-38 took the bar. \`jo\` renders a Box with
one \`ink-raw-ansi\` child, sized to the frame, and calls \`Ko\` for the ref. \`Ko\` makes the paint
scheduler \`Fo\`, registers the mount through \`hNs\` with \`Wo({plugin, requestId, key}, {columns, rows},
paint)\`, repaints on a frame change through \`nr\`, and on unmount unregisters and cancels. \`Fo\` paints
the first frame at once and coalesces the rest within \`eg\` (16 ms); \`nr\` schedules only while the
surface is not complete — 16 ms progressing, \`Bo\` (250 ms) waiting. \`_o\` writes a painted frame into
the node's \`rawText\` and marks the node and its ancestors dirty through the two ink helpers.

The seam is two modules, split so there is no import cycle. \`./plugin-chain-react-hooks.ts\` carries
\`qt\` (the context token), \`Tc\` (element creation), \`s\`/\`n\` (Box/Text tokens), \`y\`/\`Z\`/\`R\`/\`en\`/\`Ae\`,
the component runner and commit, and the two node helpers. The source copy imports it; the surface
module re-exports both. \`runComponent\` renders once, commits the element tree (which is what binds a
\`ref\` to its node), then runs the queued effects; \`unmount\` runs their cleanups in reverse. The two
ink helpers are ported, not copied: they are declarators inside one large \`var\` statement in
chunk-06azbynj.js, so no statement range holds them alone. Their source text is quoted above each.

The rest of the layer is partitioned in the evidence: the Image component with its source/decode
bodies (\`No\`, \`Ao\`, \`lFo\`); the leaf components (Code, Markdown, text and links); the Input/Select/
Button and hover group; the Client host; and last the site-tree walker \`je\` with the terminal glue,
taken only when every component it names is carried.

Verified: check/build/notices, the scanned copy \`unresolved 0\`, span scan \`total 0\`, passed true,
eleven new tests (element tree, mount key and unmount, the detached fallback, the paint path, paint
coalescing, the scheduler and its cancel, the two \`nr\` delays, \`Wo\`, ref binding after commit), the
chain family 503/503, full 1779 tests / 1779 pass / 0 fail on the frozen tree, and the recovered-source
index at 56 chunks / 1,404 statements / 244,587 units (2.4%). Identity \`571df984…\`.

Next: partition 2, the Image site component and the image source/decode bodies (\`No\`, \`Ao\`, \`lFo\`).

`);

rep('research/CURRENT.md',
  '| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-71',
  `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-72 **React 层第一分区落地**（Raster 站点组件 + 表面 hook）：10 段 1,479 单位 / 2 chunk（\`jo\` 348、\`Ko\` 382、\`Fo\` 432、\`_o\` 98、\`nr\` 95、\`Wo\` 38、\`Bo\` 11、\`ee\` 16、\`Ce\` 18、\`eg\` 41），另将 \`tI\`/\`ZFt\`（185+96 单位）以引用原文的方式移植进 hook seam。**分层**：React 层按组件族分六区，先取表面组件；其余为 Image（\`No\`/\`Ao\`/\`lFo\`）、叶子组件、Input/Select/Button/hover、Client、最后 \`je\` 与终端胶水。**做法**：源正文逐字复制到 \`plugin-chain-react-surface-source.ts\`；宿主层 \`plugin-chain-react-hooks.ts\` 提供 \`qt\`/\`Tc\`/\`s\`/\`n\`/\`y\`/\`Z\`/\`R\`/\`en\`/\`Ae\` 与提交后跑 effect 的 \`runComponent\`；表面模块只做再导出，避免循环。**实测**：\`jo\` 渲染 Box→ink-raw-ansi、挂载键 \`plugin\\0requestId\\0key\`、卸载注销、无焦点上下文回落 \`detached\`、首帧立即绘制并置 dirty/yoga/根 onRender、第二帧按 16ms 合并、\`nr\` progressing 16ms/waiting 250ms、complete 不调度。tsc 0；新套件 11/11；链家族 503/503；全量 1779/1779；索引 56 chunk/1,404 语句/244,587 单位（2.4%）；身份 \`571df984…\`。 | [React 表面证据](ports/W45-react-surface-evidence.json)、[工作包](ports/W45-chain-runner.md) |
| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-71`,
);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W45-72: the React layer partition 1 — the Raster site component and its surface hook. Ten source blocks, 1,479 units: \`jo\` renders the Box and its \`ink-raw-ansi\` child, \`Ko\` registers the mount and drives the paint scheduler, \`Fo\` coalesces paints at the 16 ms frame, \`_o\` writes the frame into the node and marks it dirty, and \`nr\` schedules only while the surface is not complete (250 ms waiting). The host seam provides the React hooks, element creation, the component runner and the two ported ink helpers; the rest of the layer is partitioned into five later slices. 11/11 new, 503/503 chain family, 1779/1779 full; tsc 0; index 56 chunks / 244,587 units. [W45 record](ports/W45-chain-runner.md).
`);

rep('research/FEATURES.md',
  "whose refusal is the site's own sentence. |",
  "whose refusal is the site's own sentence.; W45-72 opens the React layer, partitioned first: the Raster site component renders its Box and raw-ansi child, the surface hook registers the mount under plugin/requestId/key, the paint scheduler coalesces a frame and the dirty helpers write it into the node; the host seam supplies the React hooks, element creation and the component runner, and the rest of the layer is partitioned into the Image component, the leaves, the interactive elements, the Client host and last the site-tree walker. |",
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W45-72 React 层第一分区（Raster 组件 + 表面 hook）：S-1至S-7已对照。S-1（先读源）：先按组件族分区并量出本片 10 段/1,479 单位，再读 \`jo\`/\`Ko\`/调度器正文；\`tI\`/\`ZFt\` 无法按语句边界复制（同一 \`var\` 声明串），以引用原文的方式移植并在 seam 注释中标明。S-2（不臆造）：React 不随产品搬运，hook 语义由 seam 承接；未把 \`No\`/\`Ao\` 的 Image 路径提前塞进本包。S-3（宿主边界）：新边界为 hook seam 本身（0 个源码级宿主函数），源正文只通过既有 \`gNs\`/\`Lss\`/\`hNs\`/各 hook 名接入。S-4（可测）：11 条用例先经 \`.audit/w45-72-probe.ts\` 实测再断言，覆盖绘制、合并、取消、\`nr\` 两档与卸载。S-7（记录）：证据 JSON 记录分区表、10 段区间与摘要、两处移植正文的引用。验证：tsc 0、未声明扫描 unresolved 0、notices check 0、新套件 11/11、链家族 503/503、全量 1779/1779、索引 56 chunk/244,587 单位、身份 571df984…。
`);

const tsv = read('.audit/w45-runtime.tsv');
const rows = [
  ['2026-10-17T16:10:00Z', 'package', 'W45-72 React 层分区 1：Raster 站点组件 + 表面 hook（10 段 1,479 单位 + tI/ZFt 281 单位移植）',
    'jo/Ko/Fo/Wo/_o/Bo/nr/eg/ee/Ce 成为产品面；新 plugin-chain-react-hooks.ts（hook seam + runComponent + tI/ZFt）；新 plugin-chain-react-surface.ts 再导出；11 条测试',
    'chunk-kjfwbh4w.js [25725,25741) ee + [30201,30219) Ce + [35779,36211) Fo + [36211,36249) Wo + [36249,36347) _o + [36347,36358) Bo + [36358,36453) nr + [36453,36835) Ko + [36835,37183) jo；chunk-z9nv3z8k.js [615,656) eg；chunk-06azbynj.js tI [173047,173232) / ZFt [173232,173328) 引用移植',
    '11/11 新套件；链家族 503/503；全量 1779/1779；第 1 帧立即绘制、第 2 帧 16ms 合并、cancel 丢弃、waiting 250ms'],
  ['2026-10-17T16:12:00Z', 'decision', 'W45-72 React 层按组件族分六区，先取表面组件',
    '整层 242 语句 / 45,881 单位且约 130 个导入，不可一次取；分区：表面（本包）、Image（No/Ao/lFo）、叶子（Code/Markdown/Link）、交互元素（Input/Select/Button/hover）、Client、je 与终端胶水',
    '分区写入证据 JSON 的 partition 表，后续包按序取；je 最后取，避免以占位替代未搬组件',
    'research/ports/W45-react-surface-evidence.json'],
  ['2026-10-17T16:14:00Z', 'finding', 'W45-72 实测三处行为',
    '① 首次 paint 立即执行（Fo 的 i=-1/0），第二帧按 16ms 延迟；② standing=complete 时 nr 不调度；③ _o 在 rawText 未变时不置 dirty、不 markDirty、不 onRender',
    '三条均由 .audit/w45-72-probe.ts 实测后写入测试；tI/ZFt 为同语句内声明，按引用原文移植而非复制',
    '.audit/w45-72-probe.txt + test/plugin-chain-react-surface.test.ts'],
  ['2026-10-17T16:16:00Z', 'verification', 'W45-72 验收：copy unresolved 0、tsc 0、notices 0、11/11、503/503、1779/1779、索引 56 chunk/244,587 单位、身份 571df984…',
    'React 层第一分区收口；下一包取 Image 组件与 Ao/lFo',
    'check/build/notices；source-undeclared-scan unresolved 0；新套件 11/11；链家族 503/503；全量 1779/1779；索引 56 chunks / 1,404 语句 / 244,587 单位（2.4%）'],
];
const added = rows.filter(([stamp]) => !tsv.includes(stamp)).map((row) => row.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md').replace(/\n+$/, '\n');
write('.audit/w45-runtime.todo.md', todo + `
## W45-72 acceptance (2026-10-17)

- [x] **The layer was partitioned before any of it was taken.** The evidence records six slices and their bodies; this package takes only the first, and the walker \`je\` is deferred until every component it names is carried.
- [x] **The source bodies are copied, not re-invented.** Ten blocks, whole and contiguous, are in the ledger with ranges and digests; the seam's own two node helpers are the only ported bodies and their source text is quoted.
- [x] **The host boundary is the React layer itself.** No source-level host function was added; the hook names the bodies call are served by the seam, and the raster side reuses the already-carried \`gNs\`/\`Lss\`/\`hNs\`/\`fur\`.
- [x] **The import graph has no cycle.** The source copy imports the hooks module; the surface module re-exports both; this was forced by the first draft, where the copy imported the re-exporting module and would have hit an uninitialized \`qt\`.
- [x] **Behaviour was measured before it was asserted.** The immediate first paint, the 16 ms coalescing, the \`complete\` no-schedule rule and the unchanged-\`rawText\` no-op are in the probe log and in the suite.
- [x] **Sweep.** tsc 0, copy \`unresolved 0\`, notices 0, new suite 11/11, chain family 503/503, full 1779/1779, index 56 chunks / 244,587 units, identity \`571df984…\`.
`);

const marks = {
  'research/CURRENT.md': 'W45-72 **React 层第一分区落地**',
  'research/STATUS.md': '\nW45-72:',
  'research/coding-standard.md': '\n2026-10-17 W45-72 ',
  'research/ports/W45-chain-runner.md': '\n## W45-72 ported',
  '.audit/w45-runtime.todo.md': '\n## W45-72 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
