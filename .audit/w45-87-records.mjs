// W45-87 record: the render-version and render-key layer plus the matcher-runner defect fix.
// Writes the package section, the CURRENT row, the STATUS and FEATURES tails, the coding-standard
// entry, the runtime trail and the acceptance list. Every anchor is asserted unique before any write.
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
## W45-87 ported the render-version layer (2026-10-17)

Twenty-two blocks are copied verbatim (2,667 units) into \`plugin-chain-render-keys-source.ts\`.
They are the render event name \`vA\`, the viewport key \`oIn\`, the render-key builder \`MF\`, the
props key \`mIn\`, the versioned-key reader \`$H\`, the event reader \`kVe\`, the visible-map reader
\`Tc\`, the version bump \`wc\`, the live/steady key helpers (\`kc\`, \`wH\`, \`kH\`, \`xc\`, \`Rb\`), the
drawing tests \`sur\`/\`iur\`, the on-screen range \`$ur\`, the message list \`j3e\`, the engine sentinel
\`Ioe\`, the two stores \`Omt\`/\`l9\`, the hook gates \`Frt\`/\`LAt\`/\`WPn\`/\`SVe\`/\`GPn\`, and the hash
helpers \`at\`/\`eA\`/\`hno\`/\`yno\`/\`blt\`.

A render key is \`surface\\0component\\0requestId\`. Its versioned form appends the version of the
state-suffixed key (\`jf\`) only when the store holds one. The props key is
\`columns\\0fullscreen\\0sha256(props)\`. \`kVe\` composes the event counter with the versioned request
key. \`Tc\` walks the visible map and skips the viewport key and every live or state-suffixed
duplicate, so the visible map is versioned by the steady keys alone. \`wc\` bumps one key through the
host-owned store \`it().renderVersions\`.

The package also exposed a defect in the seam's matcher module: \`l\` had resolved to an error-text
helper, so \`aUn\`/\`Slt\` passed an always-true test and every scalar matcher matched. Seven blocks
now restore the recovered runner and its alias table from chunk-ed7zyzrn.js and chunk-z6p21rxk.js:
the runner \`l\`, the server name normalization \`In\`, the tool alias table and its lookups
(\`c\`/\`Bl\`/\`gpe\`/\`_Z\`/\`qW\`), the anchored regex shape \`Twr\`, the root test \`I\`, the name expansion
\`W\`, the literal matcher \`S\`, the normalization \`K\`/\`C\`, the regex test \`F\` and \`z\`, and the
nested context \`G\`. Scalar mismatches are false again, object matchers stay partial, aliases expand
on either side and regex matchers test the value.

What was measured (probe log \`.audit/w45-87-probe.txt\`): the key shapes and digests; \`$H\` with and
without a stored version; \`Tc\` over the full map and over listed keys under both paces; \`mIn\`'s
three fields; \`wc\`'s single bump; six \`sur\`/\`iur\` cases; four \`$ur\` cases; the eight message types;
\`Ioe\`; \`Omt.defaultValue\`; \`l9.get()\`; the hook gates with two installed modules; the sha256 and
JSON-id helpers; and nine seam aliases against the source names.

What remains of partition 4 is the terminal glue that renders a site through row accounting — \`yt\`,
\`pr\`, the row helpers \`lr\`/\`mr\`/\`fr\`, \`ur\`, \`cr\`/\`dr\`, \`xr\`, \`ar\`, \`$e\`, \`hdn\`, \`TU\` and \`VH\` —
with \`dce\` and the engine render service \`che\` as the remaining host seams. That is the next
package.

Verified: tsc 0, the copy scans \`declared 55 / unresolved 0\` and \`declared 54 / unresolved 0\`,
notices 0, 25 new tests, the chain family 748/748, full 2,024/2,024, and the recovered-source index
at 74 chunks / 1,698 statements / 310,408 units (2.9%). Identity \`f1522ee4…\`.

`);

rep('research/CURRENT.md',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-86 **站点树遍历器 `je`**',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-87 **渲染版本与渲染键层**：**22 段 2,667 单位**（渲染事件 `vA`、视口键 `oIn`、渲染键 `MF`、props 键 `mIn`、版本键 `$H`、事件读取 `kVe`、可见映射 `Tc`、版本递增 `wc`、live/steady 键助手 `kc`/`wH`/`kH`/`xc`/`Rb`、绘制测试 `sur`/`iur`、屏内区间 `$ur`、消息表 `j3e`、引擎哨兵 `Ioe`、两存储 `Omt`/`l9`、钩子门 `Frt`/`LAt`/`WPn`/`SVe`/`GPn`、哈希助手 `at`/`eA`/`hno`/`yno`/`blt`）。**语义**：渲染键为 `surface\\0component\\0requestId`；版本形式仅当存储持有 `jf(key)` 版本时追加 `\\0\\0<version>`；props 键为 `columns\\0fullscreen\\0sha256(props)`；`kVe` 把事件计数与请求键版本组合；`Tc` 读可见映射时跳过视口键与全部 live/state 后缀重复项，故可见映射只由 steady 键定版；`wc` 经宿主 `it().renderVersions` 递增一个键。**同时修复接缝缺陷**：`l` 曾被解析为错误文本助手，导致 `aUn`/`Slt` 恒真、标量匹配全部通过；现以 7 段恢复 chunk-ed7zyzrn.js/chunk-z6p21rxk.js 的匹配运行器与别名表（`l`、`In`、`c`/`Bl`/`gpe`/`_Z`/`qW`、`Twr`、`I`、`W`、`S`、`K`/`C`、`F`、`z`、`G`）。标量不等为 false、对象部分匹配、别名双向展开、正则按值测试。**实测**：键形状与摘要；`$H` 有/无版本；`Tc` 全映射与列表键双 pace；`mIn` 三字段；`wc` 单键递增；六组 `sur`/`iur`；四组 `$ur`；八种消息类型；`Ioe`；`Omt.defaultValue`；`l9.get()`；两模块钩子门；sha256 与 JSON id；九个 seam 别名。tsc 0；未声明扫描 declared 55/unresolved 0 与 declared 54/unresolved 0；notices 0；新套件 25/25；链家族 748/748；全量 2,024/2,024；索引 74 chunk/310,408 单位（2.9%）；身份 `f1522ee4…`。 | [渲染键证据](ports/W45-render-keys-evidence.json)、[工作包](ports/W45-chain-runner.md) |\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-86 **站点树遍历器 `je`**',
);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W45-87: the render-version layer versions a surface by the pair (event counter, per-request version) and keeps the visible map versioned by steady keys alone. Twenty-two source blocks, 2,667 units. The package also restored the recovered matcher runner, so scalar matchers no longer pass an always-true test. 25/25 new tests, 748/748 chain family, 2,024/2,024 full; tsc 0; index 74 chunks / 310,408 units. [W45 record](ports/W45-chain-runner.md).
`);

rep('research/FEATURES.md',
  'the terminal-safe display encoder.',
  'the terminal-safe display encoder; W45-87 adds the render-version layer: the render event and viewport keys, the render/props/versioned-key builders, the visible-map version reader that skips live duplicates, the single-key bump through the host store, the drawing tests and the on-screen range, and the recovered matcher runner with its alias table.',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W45-87 渲染版本与渲染键层：S-1至S-7已对照。S-1（先读源）：量出 22 段/2,667 单位，逐段读渲染键/版本读取/绘制测试/钩子门/存储与哨兵，全部依赖（jDe/OL/jf/Rc/Of/it/at）此前已入产品，无新增依赖。S-2（不臆造）：键形状、跳过规则、绘制条件、钩子过滤与哈希助手均按源正文保留。S-3（宿主边界）：渲染版本存储是宿主所有（it().renderVersions，经 bindRenderVersions 绑定），模块登记表同样由宿主提供；复制正文只读不建。S-4（可测）：25 条用例先经 .audit/w45-87-probe.ts 实测再断言，含 5 条匹配运行器回归。S-5/S-6：整段一次收齐，复用既有 seam 与存储，无新增依赖。S-7（记录）：证据 JSON 记录 22 段区间、匹配缺陷修复与分区剩余项。验证：tsc 0、未声明扫描 declared 55/unresolved 0 与 declared 54/unresolved 0、notices 0、新套件 25/25、链家族 748/748、全量 2,024/2,024、索引 74 chunk/310,408 单位、身份 f1522ee4…。
`);

const tsv = read('.audit/w45-runtime.tsv');
const rows = [
  ['2026-10-17T23:05:00Z', 'package', 'W45-87 渲染版本与渲染键层（22 段 2,667 单位）+ 匹配运行器缺陷修复',
    'vA/oIn/MF/s_/kVe/mIn/Tc/$H/wc/kc/wH/kH/xc/Rb/sur/iur/$ur/j3e/Ioe/Omt/l9/Frt/LAt/WPn/SVe/GPn/at/eA/hno/yno/blt 成为产品面；plugin-chain-render-keys-source.ts 生成副本；新 plugin-chain-render-keys.ts 公共 seam；plugin-chain-matchers.ts 的 l 恢复为 recovered runner',
    'chunk-n3ykh62m.js 5 段 + chunk-nyce03br.js 3 段 + chunk-t175a0ke.js 1 段 + chunk-tvdq3hrk.js 1 段 + chunk-ed7zyzrn.js 1 段 + chunk-zf8k2z6n.js 1 段 + 其余 10 段共 2,667u；匹配器另 7 段',
    '25/25 新套件；链家族 748/748；全量 2,024/2,024；2 文件 declared 55/54，unresolved 0'],
  ['2026-10-17T23:09:00Z', 'decision', 'W45-87 版本由（事件计数，请求键版本）共同决定',
    '① 渲染键 surface\\0component\\0requestId，版本形式仅当存储持有 jf(key) 时追加 \\0\\0<version>；② props 键 columns\\0fullscreen\\0sha256(props)；③ Tc 读可见映射时跳过视口键与 live/state 后缀重复项，可见映射只由 steady 键定版；④ 版本存储与登记表都是宿主所有（it().renderVersions、bindRenderVersions），复制正文只读；⑤ 终端胶水（yt/pr/ur/xr/hdn/VH 及 dce/che 接缝）留作下一包',
    '测试按键、绘制测试、存储与哨兵、钩子门、哈希助手分组',
    '.audit/w45-87-probe.txt + test/plugin-chain-render-keys.test.ts'],
  ['2026-10-17T23:12:00Z', 'finding', 'W45-87 接缝把 l 解析到错误正文，aUn/Slt 恒真',
    '① 旧接缝的 l 是错误文本助手，aUn/Slt 经由它恒返回真，任何标量不匹配都通过；② 恢复 chunk-ed7zyzrn.js 的 runner 后，aUn(2,1)=false、Slt(/^x/,"y")=false，对象仍部分匹配；③ 别名经 names.table 双向展开（Agent↔Task）；④ 7 段恢复后，既有 matcher 消费者全部回到正确语义',
    '五条回归用例先经 .audit/w45-87-matcher-check.ts 实测再写断言',
    '.audit/w45-87-matcher-check.ts + test/plugin-chain-matchers.test.ts'],
  ['2026-10-17T23:15:00Z', 'verification', 'W45-87 验收：declared 55/54、unresolved 0、tsc 0、notices 0、25/25、748/748、2,024/2,024、索引 74 chunk/310,408 单位、身份 f1522ee4…',
    '下一步终端胶水与行核算（分区 4 剩余项）',
    'source-undeclared-scan declared 55/54，unresolved 0；新套件 25/25；链家族 748/748；全量 2,024/2,024；索引 74 chunks / 1,698 语句 / 310,408 单位（2.9%）'],
];
const added = rows.filter(([stamp]) => !tsv.includes(stamp)).map((row) => row.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md').replace(/\n+$/, '\n');
write('.audit/w45-runtime.todo.md', todo + `
## W45-87 acceptance (2026-10-17)

- [x] **The render key is stable and versioned.** \`MF\` builds surface/component/request; \`$H\` appends the stored version of the state-suffixed key and nothing when absent.
- [x] **The visible map is versioned by steady keys.** \`Tc\` skips the viewport key and every live or state-suffixed duplicate; \`kVe\` composes the event counter with the versioned request key.
- [x] **The drawing tests answer for the terminal glue.** \`sur\` sees a position or offset, \`iur\` draws a Box with one and recurses into Box children only, \`$ur\` reads a well-typed range.
- [x] **The stores and sentinels are exposed.** \`Omt\` starts false, \`l9\` starts empty, \`Ioe\` is the engine sentinel and \`j3e\` is the message list.
- [x] **The matcher runner is recovered.** \`l\` is the recovered runner again: scalar mismatches are false, object matchers are partial, aliases expand and regex matchers test the value.
- [x] **Sweep.** tsc 0, copies \`declared 55 / unresolved 0\` and \`declared 54 / unresolved 0\`, notices 0, new suite 25/25, chain family 748/748, full 2,024/2,024, index 74 chunks / 310,408 units, identity \`f1522ee4…\`.
`);

const marks = {
  'research/CURRENT.md': 'W45-87 **渲染版本与渲染键层',
  'research/STATUS.md': '\nW45-87:',
  'research/coding-standard.md': '\n2026-10-17 W45-87 ',
  'research/ports/W45-chain-runner.md': '\n## W45-87 ported',
  'research/FEATURES.md': 'W45-87 adds the render-version layer',
  '.audit/w45-runtime.todo.md': '\n## W45-87 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
