// W45-79 record: React layer partition 4 — the ui.press dispatch and the link normalizer. Writes
// the package section, the CURRENT row, the STATUS and FEATURES tails, the one-line
// coding-standard entry, the runtime trail and the acceptance list. Every anchor is asserted
// unique before any write.
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
## W45-79 ported the ui.press dispatch and the link normalizer (2026-10-17)

Partition 4's press pipeline closes with the dispatch. Forty blocks are copied verbatim (4,897
units) into two modules: the dispatch (7 blocks, 1,269 units — \`Rf\`, \`nur\`, \`E_\`, \`Tf\`, \`BPn\` from
chunk-n3ykh62m.js, \`TIe\` from chunk-kjfwbh4w.js, \`Ohe\` from chunk-sfn1dbxq.js) and the link
normalizer (33 blocks, 3,628 units — \`mxn\`/\`An\`/\`IF\` from chunk-j8hqhz0c.js, the UNC and posix
path-safety bodies from chunk-ae84tp6z.js, the traversal and percent-decoding checks from
chunk-d1ctn2b7.js, \`uG\` from chunk-ax7r0qj7.js). The generated modules are
\`plugin-chain-press-dispatch-source.ts\` and \`plugin-chain-press-url-source.ts\`; the only host
boundary is \`plugin-chain-press-url-host.ts\`, which binds node's path/url modules and answers
\`se()\` with the process cwd — the source's own fallback when no session cwd is installed.

\`BPn\` finds the held press by plugin, handle and optional element, names a Button when the
dispatch carries no link and a Markdown press otherwise, and refuses a Markdown press whose href
does not normalize to one of the drawing's \`pressableLinks\`. The argument \`E_\` carries plugin,
element, component, requestId, surface and the link, and runs through \`aP\` with the module press
\`Yl\` under the ui.press site \`Tf\`. \`TIe\` starts that dispatch without waiting and hands the promise
to \`Ohe\`, which logs a rejection and answers undefined.

The normalizer forced two distinctions worth recording. \`BPn\` has no full-key fallback: a handle
the store does not hold logs the miss and runs nothing, where \`Xl\` falls back to
\`heldByKeyOf\`. And \`mxn\` resolves a local path against the cwd before the traversal checks, so a
dot-dot path collapses to its target instead of being refused — \`/tmp/../etc/passwd\` becomes
\`file:///etc/passwd\`, while the encoded and UNC shapes \`Cot\`/\`Yoo\` flag are the ones the posix
parser reports.

What was measured (probe log \`.audit/w45-79-probe.txt\`): \`Rf\` keeps a web href, prefixes a bare
host with \`http://\`, leaves a relative or UNC href raw, and turns \`/tmp/a b\` into
\`file:///tmp/a%20b\`; \`mxn\` keeps \`?q=1#f\`, strips a localhost file host, answers \`file:///\` for
\`/\` and the input for an empty string; both dot-dot forms collapse before the URL is built;
\`Cot\`/\`Yoo\` answer false for the plain relative dot-dot; \`nur\` accepts a trailing-slash and a
space/escape difference, refuses two different hosts; \`BPn\` runs a Button with the drawn handle and
the argument, answers \`{element:"b1"}\`, logs the exact missing-key and bad-link sentences, refuses
a Markdown press dispatched as a Button, and rejects for an unloaded plugin; \`TIe\` answers
undefined immediately, lands the press after it, and logs the unloaded rejection at error level
through \`Ohe\`; \`Ohe\` passes a resolved value through and turns a rejection into a log line.

Verified: tsc 0, both copies scan \`unresolved 0\` (52/29 declared), notices 0, 16 new tests, the
chain family 630/630, full 1,906/1,906, and the recovered-source index at 64 chunks / 1,596
statements / 291,177 units (2.8%). Identity \`485a5dd1…\`.

W45-80 copies \`Xt\` Markdown, the last leaf; it reads the drawn text, dims by context and turns a
Markdown link into a \`TIe\` press. After it the partition leaves are done, and the Client host and
last the site-tree walker \`je\` with the terminal glue remain.

`);

rep('research/CURRENT.md',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-78 ',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-79 **React 层分区 4 收口：ui.press 派发 + 链接归一**（按住式 press 如何变成一次 ui.press 派发、链接如何比较）：**40 段 4,897 单位 / 2 模块**（派发模块 7 段 1,269u：`Rf` 链接归一、`nur` 可按下链接判定、`E_` 派发参数、`Tf` ui.press 站点、`BPn` 派发本体、`TIe` pressFromTerminal、`Ohe` 静默结算；URL 模块 33 段 3,628u：`mxn`/`An`/`IF`、UNC 与扩展长度路径 `Bn`/`zN`/`zt`/`Xt`/`lA`、posix 危险解析 `tl`/`QPe`/`qa`/`GS`/`qO`/`Mt`/`C`/`YR`/`Lt`/`_m`/`fa`/`qP`/`aw`、遍历与百分号解码 `Cot`/`Yoo`/`vfr`/`Xoo`/`s`/`Koo`/`l`、模式 `u`/`i`/`f`/`c`/`uG`、解析缓存 `Bt`/`Gt`/`I`/`k`）。**宿主边界** `plugin-chain-press-url-host.ts`：绑定 node path/url，`se()` 答进程 cwd（即源在未装 session cwd 时的回退）。**实测**：`Rf` 保留 web href、裸主机补 `http://`、相对/UNC 原样、`/tmp/a b`→`file:///tmp/a%20b`；`mxn` 保留 `?q=1#f`、去 localhost、空串原样；dot-dot 先 resolve 后检查，故 `/tmp/../etc/passwd`→`file:///etc/passwd`（不拒绝）；`Cot`/`Yoo` 对普通相对 dot-dot 答 false；`nur` 接受尾斜杠与空格/转义差异，拒绝不同主机；`BPn` 用绘图句柄执行模块 press 并答 `{element:"b1"}`，缺键/坏链/未载入的日志文案逐条命中，且**无全键回退**（与 `Xl` 不同）；`TIe` 立即返回 undefined、稍后落地，未载入经 `Ohe` 记 error；`Ohe` 放行 resolve、把 reject 记为 error 日志。tsc 0；未声明扫描 2 文件 unresolved 0；新套件 16/16；链家族 630/630；全量 1,906/1,906；索引 64 chunk/291,177 单位（2.8%）；身份 `485a5dd1…`。 | [Press 派发证据](ports/W45-press-dispatch-evidence.json)、[工作包](ports/W45-chain-runner.md) |\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-78 ',
);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W45-79: the ui.press path closes — the dispatch finds the held press by plugin, handle and optional element, refuses a Markdown link the drawing did not declare after normalizing it through the path-safety graph, builds the argument and runs the module press; the terminal entry starts it without waiting and the settle wrapper logs a rejection. Forty source blocks, 4,897 units; the only host boundary binds node's path/url modules and answers the cwd fallback. 16/16 new tests, 630/630 chain family, 1,906/1,906 full; tsc 0; index 64 chunks / 291,177 units. [W45 record](ports/W45-chain-runner.md).
`);

rep('research/FEATURES.md',
  'W45-78 begins partition 4 with the held-press store: a drawing\'s pressable elements are hosted under a plugin/component/request/surface key, their handles rewritten in place, and an input or select event runs the drawing plugin\'s press through the site\'s check. |',
  'W45-78 begins partition 4 with the held-press store: a drawing\'s pressable elements are hosted under a plugin/component/request/surface key, their handles rewritten in place, and an input or select event runs the drawing plugin\'s press through the site\'s check; W45-79 closes the pipeline with the ui.press dispatch, which finds the held press by handle, normalizes a Markdown link through the path-safety graph before accepting it, and starts the module press from the terminal without waiting. |',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W45-79 ui.press 派发与链接归一：S-1至S-7已对照。S-1（先读源）：先量出 40 段/4,897 单位/2 模块，逐段读 \`BPn\`/\`Rf\`/\`nur\`/\`mxn\`/\`IF\`/\`Cot\`/\`Yoo\` 正文，确认 \`AK\`/\`Yl\`/\`zd\`/\`aP\`/\`P0\`/\`l\`/\`t\` 均已承载。S-2（不臆造）：\`se()\` 是唯一宿主边界，源读 session store cwd 后回退运行期 cwd，本产品无 session store，故答进程 cwd（即源的回退答案）；\`BPn\` 无全键回退、\`mxn\` 先 resolve 再查遍历，均按实测行为记录，未做“更合理”的改写。S-3（宿主边界）：新边界为 \`plugin-chain-press-url-host.ts\`（\`et\`/\`tt\`/\`nt\`/\`a\`/\`Rn\`/\`se\`）。S-4（可测）：16 条用例先经 \`.audit/w45-79-probe.ts\` 实测再断言，覆盖归一/遍历/链接准入/派发日志/TIe 异步/结算。S-5/S-6：URL 图按依赖闭包一次收齐（33 段），派发模块仅导入 \`mxn\`；\`l\` 名称冲突通过分模块隔离，未改源名。S-7（记录）：证据 JSON 记录 40 段区间与摘要、2 模块摘要、分区进度。验证：tsc 0、未声明扫描 52/29 unresolved 0、notices 0、新套件 16/16、链家族 630/630、全量 1,906/1,906、索引 64 chunk/291,177 单位、身份 485a5dd1…。
`);

const tsv = read('.audit/w45-runtime.tsv');
const rows = [
  ['2026-10-17T18:50:00Z', 'package', 'W45-79 React 层分区 4 收口：ui.press 派发 + 链接归一（40 段 4,897 单位 / 2 模块）',
    'Rf/nur/E_/Tf/BPn/TIe/Ohe、mxn/An/IF 及 UNC/posix/遍历/百分号图成为产品面；plugin-chain-press-dispatch-source.ts 与 plugin-chain-press-url-source.ts 两份生成副本；新 plugin-chain-press-url-host.ts 宿主边界',
    'chunk-n3ykh62m.js+kjfwbh4w.js+sfn1dbxq.js 7 段 1,269u + chunk-j8hqhz0c.js+ae84tp6z.js+d1ctn2b7.js+ax7r0qj7.js 33 段 3,628u',
    '16/16 新套件；链家族 630/630；全量 1,906/1,906；2 文件 unresolved 0'],
  ['2026-10-17T18:52:00Z', 'decision', 'W45-79 把 BPn 与 Xl 的查找差异、mxn 的解析次序按源固化',
    '① BPn 只按 handle 查 heldPress，无全键回退（Xl 才有）；② mxn 先 nt(se(),i) 再跑 IF/Cot/Yoo，dot-dot 会先折叠，故不解拒绝；③ se 读 session store 后回退运行期 cwd，本产品无 session store',
    '测试断言按上述实测行为书写；未给 BPn 补回退、未把 dot-dot 改成拒绝；se() 在 url-host 明确注释为源的回退答案',
    '.audit/w45-79-probe.txt + test/plugin-chain-press-dispatch.test.ts + src/plugin-chain-press-url-host.ts'],
  ['2026-10-17T18:54:00Z', 'finding', 'W45-79 实测 ui.press 归一与派发行为',
    '① Rf 四类 href 与 file URL；② mxn 保留 query/fragment、去 localhost、dot-dot 折叠；③ Cot/Yoo 对普通相对 dot-dot 为 false；④ nur 尾斜杠/空格转义等价、异主机拒绝；⑤ BPn 缺键/坏链/未载入文案逐条命中；⑥ BPn 无全键回退；⑦ TIe 异步落地、Ohe 记 error；⑧ Ohe 放行 resolve',
    '八条由 .audit/w45-79-probe.ts 实测后写入证据与测试',
    '.audit/w45-79-probe.txt + test/plugin-chain-press-dispatch.test.ts'],
  ['2026-10-17T18:56:00Z', 'verification', 'W45-79 验收：2 文件 scan unresolved 0、tsc 0、notices 0、16/16、630/630、1,906/1,906、索引 64 chunk/291,177 单位、身份 485a5dd1…',
    '下一步 W45-80 取 Xt Markdown 最后一片叶子；随后 Client host 与站点树遍历 je/终端胶水',
    'source-undeclared-scan declared 52/29，unresolved 均 0；新套件 16/16；链家族 630/630；全量 1,906/1,906；索引 64 chunks / 1,596 语句 / 291,177 单位（2.8%）'],
];
const added = rows.filter(([stamp]) => !tsv.includes(stamp)).map((row) => row.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md').replace(/\n+$/, '\n');
write('.audit/w45-runtime.todo.md', todo + `
## W45-79 acceptance (2026-10-17)

- [x] **The press pipeline closes.** The dispatch, its terminal entry, the settle wrapper and the whole link-normalizer graph are copied; the store from W45-78 supplies the held press.
- [x] **The cwd boundary is named.** \`plugin-chain-press-url-host.ts\` binds node path/url and answers \`se()\` with the process cwd, the source's own fallback without a session store.
- [x] **The dispatch's differences from the input dispatch are pinned.** \`BPn\` has no full-key fallback, refuses a Markdown press dispatched as a Button, and logs the exact miss sentences.
- [x] **The normalizer's order is pinned.** A dot-dot local path collapses before the traversal checks; \`Cot\`/\`Yoo\` do not flag the plain relative form.
- [x] **The terminal entry is asynchronous.** \`TIe\` answers undefined; the press lands after it and \`Ohe\` logs a rejection at error level.
- [x] **Sweep.** tsc 0, copies \`declared 52/29 / unresolved 0\`, notices 0, new suite 16/16, chain family 630/630, full 1,906/1,906, index 64 chunks / 291,177 units, identity \`485a5dd1…\`.
`);

const marks = {
  'research/CURRENT.md': 'W45-79 **React 层分区 4 收口',
  'research/STATUS.md': '\nW45-79:',
  'research/coding-standard.md': '\n2026-10-17 W45-79 ',
  'research/ports/W45-chain-runner.md': '\n## W45-79 ported',
  'research/FEATURES.md': 'W45-79 closes the pipeline',
  '.audit/w45-runtime.todo.md': '\n## W45-79 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
