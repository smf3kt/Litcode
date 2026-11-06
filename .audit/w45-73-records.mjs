// W45-73 record: React layer partition 2a (the kitty image wire layer). Writes the package section, the
// CURRENT row, the STATUS and FEATURES tails, the one-line coding-standard entry, and the runtime trail.
// Every anchor is asserted unique before any write.
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
## W45-73 ported the image wire layer, partition 2a of the Image slice (2026-10-17)

The Image site component has two terminal-facing outputs: the transmit that asks the terminal to draw
a source, and the alt text drawn when it cannot. Both are built by the wire layer of chunk-fzk4rpqy.js,
and this package takes it whole: 12 blocks, 3,783 units. The source text is copied verbatim into
\`src/plugin-chain-image-wire-source.ts\`; \`src/plugin-chain-image-wire.ts\` re-exports it under the
wire layer's own name.

One name of the layer lives in another chunk. \`hxn\` is chunk-kexg5hxg.js \`var hxn=PH+"\\\\"\`, the string
terminator \`d\` appends; chunk-kexg5hxg.js is not one of this package's modules, so \`hxn\` is ported with
the source expression quoted in the copy header. The other 21 exports are whole copied blocks. The CSI
builder \`fl\` and the two constants \`CZ\`/\`PH\` come from the raster surface copy that already carries
them; the layer adds no behaviour of its own.

What the bodies do, as measured through them (probe log \`.audit/w45-73-probe.txt\`): \`cFo\` checks the id
against 4294967295 and both cell counts against the 297-entry placeholder table, requires a pixel size
for every non-png format \`before\` it looks at the medium, then branches — a file or shm name (\`k\`:
non-empty, no NUL, at most 3072 UTF-8 bytes) is sent as a \`q=1\` control message whose payload is the
name in base64 (\`v\`), while an inline payload (\`D\`: standard base64) is sent as \`q=2\`, split at 4096
characters with \`m=1\` on every chunk but the last (\`m=0\`). \`lFo\` renders the alt text: \`O\` writes the
colour (\`38;5;n\` below 256, from 256 the number read as a 24-bit colour), \`S\` takes the first n code
points of the table \`y\`, and each cell is the prefix \`N\` (U+10F286) plus the row and column
placeholders, each row terminated by \`hun\` (SGR 39) and rows joined by a newline. \`d\` frames one
message: the introducer \`G\` (ESC _ G), the body, an optional \`;payload\`, and the terminator ESC
backslash.

The remainder of the Image slice is partition 2b: the source/decode bodies (\`Z4t\`, \`Uto\`, \`Dss\`) and
the Image component itself (\`Ao\`, \`No\`), which also needs the client, settings and theme seams it
reads. The leaves, the interactive elements, the Client host, and last the site-tree walker \`je\` with
the terminal glue follow.

Verified: check/build/notices, the scanned copy \`declared 56, unresolved 0\`, 28 new tests over the
three checks, both colour forms, the alt layout, framing, the file/shm and inline transmits and the
chunk split, the chain family 531/531, full 1807 tests / 1807 pass / 0 fail, and the recovered-source
index at 57 chunks / 1,416 statements / 248,370 units (2.4%). Identity \`9c6d2d17…\`.

Next: partition 2b, the image source/decode bodies \`Z4t\`/\`Uto\`/\`Dss\` and the Image component
\`Ao\`/\`No\` with the client, settings and theme seams they read.

`);

rep('research/CURRENT.md',
  '| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-72',
  '| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-73 **React 层 Image 分区 2a 落地**（kitty 图像线层）：12 段 3,783 单位 / 1 chunk（`cFo` 565、`lFo` 131、`u` 161、`D` 159、`k` 227、`v` 52、`O` 143、`S` 58、`d` 71、`Y`/`M` 68、SGR 与名称表 427、线常量 1,721），另将 `hxn`（`PH+"\\\\"`，chunk-kexg5hxg.js）以引用原文的方式移植。**做法**：源正文逐字复制到 `plugin-chain-image-wire-source.ts`，`plugin-chain-image-wire.ts` 只做再导出；`CZ`/`PH`/`fl` 复用既有 raster surface 复制件。**实测**：`O(255)` 为 256 色、`O(256)` 起按 24 位真彩读；`k` 按 UTF-8 字节计（3072 过、3074 拒）；`cFo` 先校验像素尺寸再判断 medium（非 png 的 file/shm 也需 width/height）；medium 存在时跳过 base64 校验；payload 4096 单条、4097 拆两条（m=1→m=0）、9000 拆 4096/4096/808；未知 format 在头部写作 `undefined`（源不拒绝）。tsc 0；新套件 28/28；链家族 531/531；全量 1807/1807；索引 57 chunk/1,416 语句/248,370 单位（2.4%）；身份 `9c6d2d17…`。 | [图像线层证据](ports/W45-image-wire-evidence.json)、[工作包](ports/W45-chain-runner.md) |\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-72',
);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W45-73: React layer partition 2a — the kitty image wire layer. Twelve source blocks, 3,783 units: \`cFo\` builds the transmit (id and cell ranges, the pixel size a non-png format needs, a q=1 file/shm control message or a q=2 inline message split at 4096 with m=1 until the last chunk), \`lFo\` builds the alt text (a colour sequence, a placeholder per cell and the SGR 39 row terminator), \`O\`/S write the two colour and placeholder forms, and \`u\`/\`D\`/\`k\`/\`v\` are the three checks and the base64 helper. \`hxn\` is ported with its source expression quoted; the rest is copied. 28/28 new, 531/531 chain family, 1807/1807 full; tsc 0; index 57 chunks / 248,370 units. [W45 record](ports/W45-chain-runner.md).
`);

rep('research/FEATURES.md',
  'the interactive elements, the Client host and last the site-tree walker. |',
  'the interactive elements, the Client host and last the site-tree walker; under the Image slice the wire layer is now carried (W45-73): the transmit builds the q=1 file/shm control message and the q=2 inline message, split at 4096 with m=1 until the last chunk, and the alt text renders the colour sequence and a placeholder per cell, each row terminated by SGR 39; the Image component and its source/decode bodies are the remainder of that slice. |',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W45-73 React 层 Image 分区 2a（kitty 图像线层）：S-1至S-7已对照。S-1（先读源）：先量出本片 12 段/3,783 单位，再逐段读 \`cFo\`/\`lFo\`/三个校验函数正文；\`hxn\` 属 chunk-kexg5hxg.js，不在本包模块内，按引用原文移植并在 copy 头注释标明。S-2（不臆造）：线层只做编码，源没有的分支不添加；未知 format 实测为头部 \`undefined\`，照实记录而不新增拒绝。S-3（宿主边界）：本包无源码级宿主函数；\`CZ\`/\`PH\`/\`fl\` 复用既有 raster surface 复制件。S-4（可测）：28 条用例先经 \`.audit/w45-73-probe.ts\` 实测再断言，覆盖三种校验、两种颜色形式、alt 布局、file/shm/inline 传输与 4096/4097/9000 三段分块。S-7（记录）：证据 JSON 记录 12 段区间与摘要、\`hxn\` 的移植引用与 2b 余项。验证：tsc 0、未声明扫描 unresolved 0、notices check 0、新套件 28/28、链家族 531/531、全量 1807/1807、索引 57 chunk/248,370 单位、身份 9c6d2d17…。
`);

const tsv = read('.audit/w45-runtime.tsv');
const rows = [
  ['2026-10-17T16:40:00Z', 'package', 'W45-73 React 层 Image 分区 2a：kitty 图像线层（12 段 3,783 单位 + hxn 移植）',
    'u/D/k/v/O/S/lFo/d/Y/M/cFo 成为产品面；新 plugin-chain-image-wire.ts 再导出；28 条测试',
    'chunk-fzk4rpqy.js [918,1345) SGR 表 + [3919,5640) 线常量 + [5640,5801) u + [5801,5960) D + [5960,6187) k + [6187,6239) v + [6239,6382) O + [6382,6440) S + [6440,6571) lFo + [6571,6642) d + [6642,6710) Y/M + [6710,7275) cFo；chunk-kexg5hxg.js hxn 引用移植',
    '28/28 新套件；链家族 531/531；全量 1807/1807；O(255)/O(256) 分界；3072/3074 字节名；4096/4097/9000 分块'],
  ['2026-10-17T16:42:00Z', 'finding', 'W45-73 实测四处线层行为',
    '① cFo 先校验像素尺寸再判断 medium，非 png 的 file/shm 也需 width/height；② medium 存在时跳过 base64 校验；③ 4097 字符拆两条且首条头部以 m=1 结尾、次条 m=0,q=2；④ 未知 format 使 Y[format] 为 undefined 并写进头部',
    '四条均由 .audit/w45-73-probe.ts 实测后写入证据与测试；hxn 按引用原文移植',
    '.audit/w45-73-probe.txt + test/plugin-chain-image-wire.test.ts'],
  ['2026-10-17T16:44:00Z', 'verification', 'W45-73 验收：scan unresolved 0、tsc 0、notices 0、28/28、531/531、1807/1807、索引 57 chunk/248,370 单位、身份 9c6d2d17…',
    'Image 分区 2a 收口；下一包 2b 取 Z4t/Uto/Dss 与 Ao/No',
    'source-undeclared-scan declared 56 / unresolved 0；新套件 28/28；链家族 531/531；全量 1807/1807；索引 57 chunks / 1,416 语句 / 248,370 单位（2.4%）'],
];
const added = rows.filter(([stamp]) => !tsv.includes(stamp)).map((row) => row.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md').replace(/\n+$/, '\n');
write('.audit/w45-runtime.todo.md', todo + `
## W45-73 acceptance (2026-10-17)

- [x] **The Image slice was split before either half was taken.** The wire layer is 2a; the source/decode bodies and the component are 2b, which also needs the client, settings and theme seams it reads.
- [x] **The source bodies are copied, not re-invented.** Twelve whole blocks are in the ledger with ranges and digests; the only ported name is \`hxn\`, whose chunk is not in this package, and its source expression is quoted in the copy header.
- [x] **The host boundary adds nothing.** No source-level host function was introduced; \`CZ\`/\`PH\`/\`fl\` come from the raster surface copy that already carries them.
- [x] **Behaviour was measured before it was asserted.** The size-before-medium order, the base64 skip, the two colour forms, the UTF-8 byte cap and the three chunk splits are in the probe log and in the suite.
- [x] **Sweep.** tsc 0, copy \`declared 56 / unresolved 0\`, notices 0, new suite 28/28, chain family 531/531, full 1807/1807, index 57 chunks / 248,370 units, identity \`9c6d2d17…\`.
`);

const marks = {
  'research/CURRENT.md': 'W45-73 **React 层 Image 分区 2a 落地**',
  'research/STATUS.md': '\nW45-73:',
  'research/coding-standard.md': '\n2026-10-17 W45-73 ',
  'research/ports/W45-chain-runner.md': '\n## W45-73 ported',
  'research/FEATURES.md': '(W45-73)',
  '.audit/w45-runtime.todo.md': '\n## W45-73 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
