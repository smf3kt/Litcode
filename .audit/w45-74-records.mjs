// W45-74 record: React layer partition 2b-i (the Image source model). Writes the package section, the
// CURRENT row, the STATUS and FEATURES tails, the one-line coding-standard entry, and the runtime
// trail. Every anchor is asserted unique before any write.
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
## W45-74 ported the Image source model, partition 2b-i of the Image slice (2026-10-17)

The Image component holds a plugin-supplied source in one of four shapes — inline png, inline rgba,
a file path, or a shared-memory name — and hands it to the transmit. This package takes the bodies
that test those shapes and convert them: \`ac\`/\`Z4t\`/\`B_\` (the png and file/shm tests and the decoded
byte size) and \`Uto\`/\`Dss\` (the shm test and the encoder). Two statements, 554 units, copied verbatim
into \`src/plugin-chain-image-model-source.ts\`; \`src/plugin-chain-image-model.ts\` re-exports them.

Most of the source layer was already carried. The validators that admit the four shapes (\`Mss\` and
its \`G_\`/\`z_\`/\`Y_\`/\`q_\`/\`F_\` helpers) and the base64 decoder \`ds\` live in the ui.blit copy from
W45-58, so only the statements the Image component calls directly are copied, and \`B_\` imports \`ds\`
from that copy instead of carrying a second decoder.

What the bodies answer, as measured (probe log \`.audit/w45-74-probe.txt\`): \`ac\` is true only for the
inline png shape, \`Z4t\` for the two reference shapes and \`Uto\` only for shm; \`B_\` answers the base64
payload's decoded byte count (four characters are three bytes) and 0 for a reference; \`Dss\` passes
an inline png through, passes an inline rgba source through with its pixel size, and for a reference
answers the medium, the name and — unless the format is png — the pixel size. A malformed source with
both \`file\` and \`shm\` encodes as shm, because the shm test is asked first. The result is exactly the
transmit shape: fed to W45-73's \`cFo\`, a reference yields the q=1 control message and an inline
source the q=2 message.

The remainder of the Image slice is 2b-ii: the component \`No\` and its resolver \`Ao\` (\`Oo\`, \`Mo\`,
\`vo\`, \`Eo\`, \`Ho\`, \`dt\`, \`Lo\`, \`tr\`, \`rr\`, \`or\`, \`xt\`, \`Ke\`), with seams for the plugin client
(\`bC\`), the internal querier (\`QO\`), terminal capability level (\`Z8n\`, \`aWo\`, \`ge\`), the file probe
(\`lPe\`) and the mount writers (\`vLs\`/\`ELs\`).

Verified: check/build/notices, the scanned copy \`declared 15, unresolved 0\`, 13 new tests over the
predicates, the size reader, the four encode forms, the shm preference and the transmit integration,
the chain family 544/544, full 1820 tests / 1820 pass / 0 fail, and the recovered-source index at
57 chunks / 1,421 statements / 248,924 units (2.4%). Identity \`88e22d52…\`.

Next: partition 2b-ii, the Image component \`No\` and resolver \`Ao\` with the client, querier,
terminal-capability, file-probe and mount-writer seams they read.

`);

rep('research/CURRENT.md',
  '| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-73',
  '| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-74 **Image 分区 2b-i 落地**（图像源模型）：2 段 554 单位（`ac`/`Z4t`/`B_` 与 `Uto`/`Dss`），逐字复制到 `plugin-chain-image-model-source.ts`，`plugin-chain-image-model.ts` 再导出；`B_` 从 W45-58 的 ui.blit 复制件导入 `ds`，形状校验 `Mss` 及 `G_`/`z_`/`Y_`/`q_`/`F_` 亦已由该副本承载，未重复搬运。**实测**：`ac` 仅内联 png；`Z4t` 为 file/shm 两形；`Uto` 仅 shm；`B_` 按 base64 解码字节数（4 字符=3 字节）、引用形为 0；`Dss` 对内联 png 原样传递、对内联 rgba 带像素尺寸、对 file/shm 给 medium+name，且非 png 才带 width/height；同时含 file 与 shm 的畸形源按 shm 编码；编码结果直接喂给 W45-73 的 `cFo` 得到 q=1 或 q=2 消息。tsc 0；新套件 13/13；链家族 544/544；全量 1820/1820；索引 57 chunk/1,421 语句/248,924 单位（2.4%）；身份 `88e22d52…`。 | [图像源证据](ports/W45-image-source-evidence.json)、[工作包](ports/W45-chain-runner.md) |\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-73',
);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W45-74: React layer partition 2b-i — the Image source model. Two source blocks, 554 units: \`ac\`/\`Z4t\`/\`B_\` tell the inline png and reference shapes and read the decoded byte size, and \`Uto\`/\`Dss\` tell the shm shape and encode each source into the transmit shape \`cFo\` reads (a reference becomes a q=1 message, an inline source a q=2 one). The validators and the byte decoder were already carried by the ui.blit copy. 13/13 new, 544/544 chain family, 1820/1820 full; tsc 0; index 57 chunks / 248,924 units. [W45 record](ports/W45-chain-runner.md).
`);

rep('research/FEATURES.md',
  'the Image component and its source/decode bodies are the remainder of that slice. |',
  'the Image component and its source/decode bodies are the remainder of that slice; W45-74 carries that source model: the png and file/shm predicates, the decoded-size reader and the encoder that turns each source shape into what the transmit sends. |',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W45-74 React 层 Image 分区 2b-i（图像源模型）：S-1至S-7已对照。S-1（先读源）：先量出本片 2 段/554 单位，再读 \`ac\`/\`Z4t\`/\`B_\`/\`Uto\`/\`Dss\` 与既有 \`Mss\` 校验链正文；确认大部分源模型已由 W45-58 的 ui.blit 复制件承载，只补组件直接调用的两条语句。S-2（不臆造）：未复制已有校验函数，\`B_\` 以导入 \`ds\` 的方式复用同一解码器；畸形双引用源的 shm 优先行为照实记录。S-3（宿主边界）：本包无源码级宿主函数，新增依赖仅既有 ui.blit 复制件的 \`ds\`。S-4（可测）：13 条用例先经 \`.audit/w45-74-probe.ts\` 实测再断言，覆盖三谓词、解码尺寸、四种编码形、shm 优先与 \`cFo\` 集成。S-7（记录）：证据 JSON 记录 2 段区间与摘要、2b-ii 余项。验证：tsc 0、未声明扫描 unresolved 0、notices 0、新套件 13/13、链家族 544/544、全量 1820/1820、索引 57 chunk/248,924 单位、身份 88e22d52…。
`);

const tsv = read('.audit/w45-runtime.tsv');
const rows = [
  ['2026-10-17T17:00:00Z', 'package', 'W45-74 React 层 Image 分区 2b-i：图像源模型（2 段 554 单位）',
    'ac/Z4t/B_/Uto/Dss 成为产品面；新 plugin-chain-image-model.ts 再导出；导入既有 ui.blit 副本的 ds；13 条测试',
    'chunk-n3ykh62m.js [242804,242947) ac/Z4t/B_ + [245185,245596) Uto/Dss；Mss 及 G_/z_/Y_/q_/F_ 已由 W45-58 ui.blit 复制件承载',
    '13/13 新套件；链家族 544/544；全量 1820/1820；B_ 4 字符=3 字节；双引用源按 shm 编码'],
  ['2026-10-17T17:02:00Z', 'finding', 'W45-74 实测两处源模型行为',
    '① B_ 对 file/shm 引用返回 0，对内联源返回 base64 解码字节数（4096 字符=3072 字节）；② 同时含 file 与 shm 的畸形源在 Dss 中按 shm 编码并取 shm 名',
    '两条由 .audit/w45-74-probe.ts 实测后写入证据与测试；Dss 输出直接与 cFo 的 q=1/q=2 消息对接验证',
    '.audit/w45-74-probe.txt + test/plugin-chain-image-model.test.ts'],
  ['2026-10-17T17:04:00Z', 'verification', 'W45-74 验收：scan unresolved 0、tsc 0、notices 0、13/13、544/544、1820/1820、索引 57 chunk/248,924 单位、身份 88e22d52…',
    'Image 分区 2b-i 收口；下一包 2b-ii 取 No/Ao 与客户端/查询器/终端能力/挂载 seam',
    'source-undeclared-scan declared 15 / unresolved 0；新套件 13/13；链家族 544/544；全量 1820/1820；索引 57 chunks / 1,421 语句 / 248,924 单位（2.4%）'],
];
const added = rows.filter(([stamp]) => !tsv.includes(stamp)).map((row) => row.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md').replace(/\n+$/, '\n');
write('.audit/w45-runtime.todo.md', todo + `
## W45-74 acceptance (2026-10-17)

- [x] **The Image slice's source model was separated from its component.** 2b-i is the shape and encode layer; 2b-ii is \`No\`/\`Ao\` and the seams it reads.
- [x] **Nothing already carried was copied twice.** The validators and \`ds\` stay in the W45-58 ui.blit copy; this package copies only the two statements the component calls and imports \`ds\` from that copy.
- [x] **The copy is verbatim.** Two whole blocks are in the ledger with ranges and digests; the seam adds only exported names.
- [x] **Behaviour was measured before it was asserted.** The predicates, the byte count, the four encode forms, the shm preference and the transmit integration are in the probe log and in the suite.
- [x] **Sweep.** tsc 0, copy \`declared 15 / unresolved 0\`, notices 0, new suite 13/13, chain family 544/544, full 1820/1820, index 57 chunks / 248,924 units, identity \`88e22d52…\`.
`);

const marks = {
  'research/CURRENT.md': 'W45-74 **Image 分区 2b-i 落地**',
  'research/STATUS.md': '\nW45-74:',
  'research/coding-standard.md': '\n2026-10-17 W45-74 ',
  'research/ports/W45-chain-runner.md': '\n## W45-74 ported',
  'research/FEATURES.md': 'W45-74 carries that source model',
  '.audit/w45-runtime.todo.md': '\n## W45-74 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
