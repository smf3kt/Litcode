// W45-75 record: the terminal capability and image-file probe stores. Writes the package section, the
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
## W45-75 ported the terminal capability and image-file probe stores (2026-10-17)

The Image component asks the terminal two questions — whether it draws kitty graphics, and whether it
reads files on this machine — and must not ask either twice. Both answers are kept in two state
machines of chunk-mvsmkx6d.js, and this package takes them whole: one block, 1,835 units, copied
verbatim into \`src/plugin-chain-terminal-capabilities-source.ts\`. The only external body is the signal
emitter \`Oe()\`, which the registry-stores copy already carries; the seam aliases the four copied names
to \`ImageFileProbe\`, \`CapabilityReadings\`, \`DEFAULT_CAPABILITIES\` and \`CAPABILITY_NAMES\`.

The file probe (\`i\`) starts \`unasked\`; \`begin\` moves it to \`asking\` once; \`unask\` returns an asking
probe to unasked; \`answer\` settles it once and emits the value; \`onSettle\` calls back at once when
settled and otherwise subscribes. The capability store (\`o\`) is built from per-capability readings —
\`settled\` at a value, or \`pending\` at a guess — and answers \`now\` with the settled value or the
default (never the guess), settles a pending capability once, records a yes, lists what is still
pending, and on \`deadline\` settles every pending capability at its guess with \`, no answer\` appended
to its source. The defaults (\`s\`) assume kitty keyboard on and everything else off.

What was measured (probe log \`.audit/w45-75-probe.txt\`): the probe's one-shot transitions and the
listener order; \`now\` returning the default for a pending capability (\`synchronizedOutput\` false
although its guess was true); \`answer\` refusing to change a settled capability; \`confirmed\` recording
only true answers; and \`deadline\` appending \`, no answer\` while leaving the value at the guess.

The environment guesses (\`d()\`) and the host wrappers that build these stores are not part of the
package; the stores are tested from explicit readings. Next is 2b-ii: the Image component \`No\` and
resolver \`Ao\` over these stores, with seams for the plugin client (\`bC\`), the internal querier
(\`QO\`), the capability wrappers (\`LT\`/\`Z8n\`/\`aWo\`/\`$1t\`), the file path helper (\`lPe\`), the probe
query (\`uFo\`), the source key (\`er\`) and the mount writers (\`vLs\`/\`ELs\`).

Verified: check/build/notices, the scanned copy \`declared 10, unresolved 0\`, 9 new tests over both
state machines, the chain family 553/553, full 1829 tests / 1829 pass / 0 fail, and the
recovered-source index at 58 chunks / 1,424 statements / 250,759 units (2.4%). Identity \`4b7f1d22…\`.

Next: partition 2b-ii, the Image component \`No\` and resolver \`Ao\` over these stores.

`);

rep('research/CURRENT.md',
  '| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-74',
  '| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-75 **终端能力与图像文件探测存储落地**：chunk-mvsmkx6d.js 1 段 1,835 单位（`i` 图像文件探测、`s`/`Q8n` 能力默认值与名称、`o` 能力读数），逐字复制到 `plugin-chain-terminal-capabilities-source.ts`，seam 以 `ImageFileProbe`/`CapabilityReadings`/`DEFAULT_CAPABILITIES`/`CAPABILITY_NAMES` 再导出；唯一外部正文为既有 registry-stores 复制件的 `Oe`。**实测**：文件探测 `unasked→asking→settled` 单次状态机，`unask` 仅回退 asking，重复 `answer` 返回 false，`onSettle` 已定则立即回调；能力表 `now` 对 pending 项返回默认值而非猜测值（`synchronizedOutput` 猜测 true 仍返回 false），`answer` 对已定项不改动，`confirmed` 只记 true，`deadline` 以猜测值结算并在 source 追加 `, no answer`。tsc 0；新套件 9/9；链家族 553/553；全量 1829/1829；索引 58 chunk/1,424 语句/250,759 单位（2.4%）；身份 `4b7f1d22…`。 | [能力存储证据](ports/W45-terminal-capabilities-evidence.json)、[工作包](ports/W45-chain-runner.md) |\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-74',
);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W45-75: the terminal capability and image-file probe stores. One source block, 1,835 units: \`ImageFileProbe\` is the one-shot file-read probe (unasked, asking, settled, with an immediate or subscribed listener) and \`CapabilityReadings\` is the capability table (settled readings, pending guesses, the default fallback for \`now\`, one answer, a deadline that settles pending capabilities at their guess). \`DEFAULT_CAPABILITIES\` and \`CAPABILITY_NAMES\` carry the six capabilities. 9/9 new, 553/553 chain family, 1829/1829 full; tsc 0; index 58 chunks / 250,759 units. [W45 record](ports/W45-chain-runner.md).
`);

rep('research/FEATURES.md',
  'the decoded-size reader and the encoder that turns each source shape into what the transmit sends. |',
  'the decoded-size reader and the encoder that turns each source shape into what the transmit sends; W45-75 adds the two stores the Image resolver reads: a one-shot file-read probe and the terminal capability table with its defaults, settled readings and pending guesses. |',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W45-75 终端能力与图像文件探测存储：S-1至S-7已对照。S-1（先读源）：量出 chunk-mvsmkx6d.js 1 段/1,835 单位并读两个状态机正文；确认其唯一外部正文 \`Oe\` 已由 registry-stores 复制件承载。S-2（不臆造）：环境猜测 \`d()\` 与宿主包装 \`DT\`/\`LT\`/\`Z8n\`/\`aWo\`/\`$1t\` 不属本包，未以自造值替代，测试从显式读数构造。S-3（宿主边界）：本包无源码级宿主函数，仅导入既有 \`Oe\`。S-4（可测）：9 条用例先经 \`.audit/w45-75-probe.ts\` 实测再断言，覆盖探测单向状态机、监听时序、能力构造、now 默认值、answer/confirmed、pending 与 deadline。S-7（记录）：证据 JSON 记录 1 段区间与摘要、后续 2b-ii seam 清单。验证：tsc 0、未声明扫描 unresolved 0、notices 0、新套件 9/9、链家族 553/553、全量 1829/1829、索引 58 chunk/250,759 单位、身份 4b7f1d22…。
`);

const tsv = read('.audit/w45-runtime.tsv');
const rows = [
  ['2026-10-17T17:20:00Z', 'package', 'W45-75 终端能力与图像文件探测存储（1 段 1,835 单位）',
    'ImageFileProbe/CapabilityReadings/DEFAULT_CAPABILITIES/CAPABILITY_NAMES 成为产品面；新 plugin-chain-terminal-capabilities.ts 以语义名再导出；9 条测试',
    'chunk-mvsmkx6d.js [947,2782) class i + s/Q8n + class o；Oe 由既有 registry-stores 复制件提供',
    '9/9 新套件；链家族 553/553；全量 1829/1829；探测单向状态机与能力 deadline 行为实测'],
  ['2026-10-17T17:22:00Z', 'finding', 'W45-75 实测两处状态机行为',
    '① `now` 对 pending 能力返回默认值而非 likely 猜测值；② `deadline` 以猜测值结算 pending 并在 source 追加 `, no answer`；③ `confirmed` 只记录 true 答案',
    '三条由 .audit/w45-75-probe.ts 实测后写入证据与测试；环境猜测 d() 未纳入本包',
    '.audit/w45-75-probe.txt + test/plugin-chain-terminal-capabilities.test.ts'],
  ['2026-10-17T17:24:00Z', 'verification', 'W45-75 验收：scan unresolved 0、tsc 0、notices 0、9/9、553/553、1829/1829、索引 58 chunk/250,759 单位、身份 4b7f1d22…',
    '能力存储收口；下一包 2b-ii 取 No/Ao 与客户端/查询器/包装/挂载 seam',
    'source-undeclared-scan declared 10 / unresolved 0；新套件 9/9；链家族 553/553；全量 1829/1829；索引 58 chunks / 1,424 语句 / 250,759 单位（2.4%）'],
];
const added = rows.filter(([stamp]) => !tsv.includes(stamp)).map((row) => row.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md').replace(/\n+$/, '\n');
write('.audit/w45-runtime.todo.md', todo + `
## W45-75 acceptance (2026-10-17)

- [x] **The two stores are copied whole.** One contiguous block holds class \`i\`, the defaults \`s\`, the names \`Q8n\` and class \`o\`; nothing was reassembled.
- [x] **The only external body is already carried.** \`Oe()\` comes from the registry-stores copy; the environment guesses and host wrappers are left to 2b-ii rather than invented here.
- [x] **Behaviour was measured before it was asserted.** The one-shot probe transitions, the immediate-vs-subscribed listener, the default fallback for \`now\`, the settled-answer refusal and the deadline source suffix are in the probe log and in the suite.
- [x] **Sweep.** tsc 0, copy \`declared 10 / unresolved 0\`, notices 0, new suite 9/9, chain family 553/553, full 1829/1829, index 58 chunks / 250,759 units, identity \`4b7f1d22…\`.
`);

const marks = {
  'research/CURRENT.md': 'W45-75 **终端能力与图像文件探测存储落地**',
  'research/STATUS.md': '\nW45-75:',
  'research/coding-standard.md': '\n2026-10-17 W45-75 ',
  'research/ports/W45-chain-runner.md': '\n## W45-75 ported',
  'research/FEATURES.md': 'W45-75 adds the two stores',
  '.audit/w45-runtime.todo.md': '\n## W45-75 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
