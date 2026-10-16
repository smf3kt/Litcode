// W45-25 records: the theme loader's four undeclared references, the copy that closes them, the
// indexes and the audit trail. Anchored inserts assert their target first.
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = {
  sha256: 'bc9f8fbad10353b85da44c3120f18df070626580156144bf489a9b2b9ca480f8',
  inputs: { sha256: '3fc322a2ccb49e8d046c38769933ad54819a319d6539c0f95ba3d6601f2f0861', files: 308 },
  validation: { sha256: '1e04c832972fa2f07d8b6c1d0cdc7bf33cb495751d9195ef53e7b1c21003f966', files: 123 },
  build: { sha256: 'c879cefb9976574a02aed25ed1bbc789f572872ff3542c0252e95929f34540cc', files: 216 },
};

const evidence = {
  schema: 'W45ThemeReaderEvidence.v1',
  package: 'W45-25 — the custom-theme loader\'s reader path: four names it reached and never declared',
  date: '2026-10-15',
  closes: 'Q-093 (filed by W45-24 from the scope-aware scan)',
  question: 'src/tui-custom-theme-source.ts references `gt`, `Wi`, `Fe` and `Yf`, none of which it declares. Which bodies are they, where do they live, and does anything run those lines?',
  answer: 'They are the reader path of the theme loader: `Wi`/`Yf` page the session\'s entry list, `Fe` builds the batched read request, `gt`/`i` format the error a failed page reports. The file-system tests never reach them because `P` takes the reader path only when the loader is handed a reader (`load(reader)`), which no test did — so the four names were dead text until something called `load` with one. All four are copied verbatim from their declaring modules, found through chunk-6yqf5ttk.js\'s own import map.',
  found_by: 'scripts/source-undeclared-scan.mjs after W45-23 made it scope-aware (`gt` line 20, `Fe`/`Wi`/`Yf` line 21).',
  ported: [
    { module: 'chunk-9t9v3t5g.js', range: [1879, 2121], units: 242, names: ['gt', 'i'], note: 'the error text the theme list logs, and its cause formatter' },
    { module: 'chunk-wdffj3z9.js', range: [615, 1006], units: 391, names: ['Yf', 'Wi'], note: 'the page cap and the paging driver P runs' },
    { module: 'chunk-nv1qvpv3.js', range: [1614, 4480], units: 2866, names: ['r', 'f', 'h', 'Fe'], note: 'the namespace-key table P builds its read request with, and the two helpers it needs' },
  ],
  why_these_ranges: [
    '`Yf` (11 units) sits immediately before `Wi` in its module, so one range carries both.',
    '`Fe` is an object literal whose entries call `f` and `h`, which call `r`; all three sit immediately before `Fe`, so [1614,4480) carries the whole run rather than a partly-resolvable slice.',
    '`gt` calls `i` (`: ${i(e.cause)}`), declared immediately after it — [1879,2121) carries both.',
  ],
  measured: [
    'A paged key list read in one batch: the reader receives `{namespace:"userConfigDir",dir:"themes",relPath:["ocean.json"]}` (Fe\'s own shape) and the parsed theme reaches `commitUserThemes`.',
    'A `dir` item, a non-`.json` key and a key over 262144 bytes are each skipped where the source skips them, and the oversized one warns `[theme] /root/themes/huge.json exceeds 256KB; skipping`.',
    'A failed page reports `list themes failed: EACCES fs: inner; keeping the previously loaded themes (if any)` — `gt` writes code, failure class and cause — and the store keeps its cached themes.',
    'A cursor that never ends stops `Wi` after exactly 10000 pages and warns `list themes exceeded 10000 pages; …` (`Yf`).',
    'A reader that throws is caught before `Wi` sees a page: `list themes failed: boom; …`.',
    'No reader at all is the file-system path: the paging driver is not reached.',
  ],
  verifier: '`node .audit/w45-25-splice.mjs --verify` re-reads all 14 records the ledger holds for this target (the 11 from W44 plus these three) and checks both the module digest and byte-identity in the file: `records 14 bad 0` — the W44 copy ledger had no such check before.',
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'src/tui-custom-theme-source.ts: unresolved 0',
    ledger: 'records 14 bad 0 (module digest and byte-identity)',
    chain_verifier: 'passed true, 25 plans',
    regressions: 'test/tui-custom-theme-reader.test.ts 2/2; runtime/plugin-chain-ui together 27/27',
    full: '1330/1330',
    compiled: 'all fifteen dist drivers exit 0',
    smoke: 'scripts/smoke-package.mjs passed, upstreamRequests 0, 224 files',
  },
  limitations: [
    'The four names are spliced into the hand-adapted W44 file rather than a generated copy, because that file has no plan/ledger pair; its ledger is research/ports/W44-custom-theme-copies.json, which now carries the three ranges and is checked by the new verifier mode.',
    'The file itself remains `// @ts-nocheck`, so the type checker does not cover its copies; the scan and the ledger verifier are what guard it.',
  ],
  next_package: [
    'the `ui.toast` entry and the toast queue (`Kxo`, `DWt`, `sI`, `ACn`, `mLs`, `hLs`, `gLs`)',
    'the rest of the `$` table beyond the two ui floors, entry by entry',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
  ],
};
write('research/ports/W45-theme-reader-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

// The W44 record points at its closure.
const w44 = JSON.parse(read('research/ports/W44-custom-theme-evidence.json'));
w44.historicalEvidence = [...(w44.historicalEvidence ?? []), 'research/ports/W45-theme-reader-evidence.json'];
write('research/ports/W44-custom-theme-evidence.json', JSON.stringify(w44, null, 1) + '\n');

// CURRENT: the W45-25 row above the W45-24 one.
const current = read('research/CURRENT.md');
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-15最新**：W45-25 **补上自定义主题加载器读路径的四个未声明引用（Q-093 收束）**。缺陷来源：W45-24 的作用域感知扫描——\`src/tui-custom-theme-source.ts\` 的 \`P\` 只在被交给 reader 时走读路径（\`load(reader)\`），而既有测试只走文件系统路径，故 \`gt\`/\`Fe\`/\`Wi\`/\`Yf\` 四名一直是死文本。**按使用方自己的 import map 认名**（Q-089）后逐块搬运 3 段 3,499 单位：chunk-9t9v3t5g.js [1879,2121)（\`gt\`+\`i\`，错误文本与其 cause 格式化）、chunk-wdffj3z9.js [615,1006)（\`Yf\` 页上限 + \`Wi\` 分页驱动）、chunk-nv1qvpv3.js [1614,4480)（\`Fe\` 命名空间键表 + 其依赖 \`r\`/\`f\`/\`h\`）；三段都是紧邻连续区，避免半可解切片。**实测**：分页列表一次批量读（reader 收到的正是 \`Fe.userConfigDir\` 形状 \`{namespace:"userConfigDir",dir:"themes",relPath:["ocean.json"]}\`）、跳过 \`dir\`/非 \`.json\`/超 262144 并给出 \`exceeds 256KB\` 警告、失败页 \`list themes failed: EACCES fs: inner; …\`（\`gt\` 写 code+failureClass+cause）、游标不尽时 \`Wi\` 恰在第 10000 页停并警告 \`exceeded 10000 pages\`（\`Yf\`）、reader 抛出被前置捕获、无 reader 即文件系统路径。**新增可复跑校验**：\`node .audit/w45-25-splice.mjs --verify\` 重读该目标台账全部 14 条（W44 的 11 条 + 新 3 条），同时校验模块摘要与文件内逐字节一致——\`records 14 bad 0\`（W44 台账此前没有这类校验）。验收：check/build/notices、扫描 \`unresolved 0\`、25 计划一致、聚焦 2/2 与相关 27/27、全量 **1330/1330**、十五个编译驱动、打包冒烟 0 上游请求；身份 \`bc9f8fba…\`。 | [主题读路径证据](ports/W45-theme-reader-evidence.json)、[ui 证据](ports/W45-ui-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('C-12 row not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the reader-path closure.
const features = read('research/FEATURES.md');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('interactive row not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = rowText.slice(0, lastPipe).replace(/\s+$/, '') +
  '. W45-25 closed the custom-theme loader\'s reader path: `load(reader)` reaches the paging driver, the namespace-key table and the error text it logs, all four names copied verbatim and the copy ledger now checked record by record |';
write('research/FEATURES.md', lines.join('\n'));

// question.md: Q-093's disposition records the closure.
const question = read('research/question.md');
const q93At = question.indexOf('### Q-093');
if (q93At < 0) throw new Error('Q-093 not found');
const q93End = question.indexOf('\n### ', q93At + 1);
const q93Close = `
**已收束（W45-25，2026-10-15）**：四名各自认到声明模块后按整段搬运（\`gt\`+\`i\` chunk-9t9v3t5g.js [1879,2121)；\`Yf\`+\`Wi\` chunk-wdffj3z9.js [615,1006)；\`Fe\`+\`r\`/\`f\`/\`h\` chunk-nv1qvpv3.js [1614,4480)），三段均在 \`src/tui-custom-theme-source.ts\` 内逐字落位，扫描 \`unresolved 0\`。回归 \`test/tui-custom-theme-reader.test.ts\` 2/2 驱动 \`load(reader)\`：分页批量读（\`Fe\` 键形状）、\`gt\` 的 \`EACCES fs: inner\` 文案、\`Yf\` 的第 10000 页上限、reader 抛出与无 reader 两条旁路。台账 \`research/ports/W44-custom-theme-copies.json\` 增补三条，并新增可复跑校验 \`node .audit/w45-25-splice.mjs --verify\`（14 条记录，模块摘要 + 文件内逐字节，\`bad 0\`）。\n`;
write('research/question.md', question.slice(0, q93End) + q93Close + question.slice(q93End));

// STATUS: the W45-25 paragraph above the W45-24 one.
const status = read('research/STATUS.md');
const statusAt = status.indexOf('W45-24: the `$` call table');
if (statusAt < 0) throw new Error('STATUS W45-24 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-25: the custom-theme loader's reader path is closed (Q-093). The scan W45-24 left behind found four names \\\`src/tui-custom-theme-source.ts\\\` reaches and never declares — the paging driver (\\\`Wi\\\`/\\\`Yf\\\`), the namespace-key table (\\\`Fe\\\`, with \\\`r\\\`/\\\`f\\\`/\\\`h\\\`) and the error text (\\\`gt\\\`/\\\`i\\\`) — reachable only when the loader is handed a reader, which no test did. Three contiguous ranges (3,499 units) are spliced verbatim, the ledger gains a repeatable verifier (\\\`records 14 bad 0\\\`) and two regressions drive \\\`load(reader)\\\` end to end. Evidence: \\\`research/ports/W45-theme-reader-evidence.json\\\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// coding-standard: the dated review line.
const standard = read('research/coding-standard.md');
const standardAt = standard.indexOf('2026-10-15 W45-24 ');
if (standardAt < 0) throw new Error('coding-standard W45-24 line not found');
const standardEntry = `2026-10-15 W45-25 自定义主题读路径缺口复查：S-1至S-7已对照。S-1（先读源）：四名先按使用方（chunk-6yqf5ttk.js）自己的 import map 认到声明模块，再取整段——\`Yf\` 紧邻 \`Wi\`、\`Fe\` 依赖 \`r\`/\`f\`/\`h\`、\`gt\` 依赖 \`i\`，三段都取到连续区边界，避免半可解切片。S-3（不留半包）：缺口只在 \`load(reader)\` 这条路上可见，故回归直接驱动它——分页批量读并断言 reader 收到的键形状、\`gt\` 的 \`EACCES fs: inner\`、\`Yf\` 的 10000 页上限、reader 抛出与无 reader 两条旁路。既有台账（W44）只有记录、没有校验，本包补了可复跑模式：\`node .audit/w45-25-splice.mjs --verify\` 同时校验模块摘要与文件内逐字节（14 条，\`bad 0\`）。验收：check/build/notices、扫描 unresolved 0、25 计划一致、全量 1330/1330、十五个编译驱动、打包冒烟 0 上游请求。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

const rows = [
  ['2026-10-16T05:40:00Z', 'package', 'W45-25 补上主题加载器读路径四名（gt/Fe/Wi/Yf），Q-093 收束',
    'P 只在 load(reader) 时走读路径，既有测试只走文件系统路径，四名长期是死文本；未声明引用由 W45-24 的作用域感知扫描发现',
    '按使用方 import map 认名后整段搬运 3 段 3,499 单位（chunk-9t9v3t5g.js [1879,2121)、chunk-wdffj3z9.js [615,1006)、chunk-nv1qvpv3.js [1614,4480)），逐字落入 src/tui-custom-theme-source.ts',
    '回归 test/tui-custom-theme-reader.test.ts 2/2 驱动 load(reader)；台账 W44-custom-theme-copies.json 增补三条；新增 --verify（records 14 bad 0）'],
  ['2026-10-16T05:58:00Z', 'verification', 'W45-25 验收：扫描 unresolved 0、1330/1330、打包 0 上游请求',
    '主题读路径搬运与台账校验',
    'check/build/notices；扫描 unresolved 0；台账 --verify records 14 bad 0；verify-chain-copies passed true（25 plans）；聚焦 2/2 与相关 27/27；全量 1330/1330；十五个编译驱动 exit 0；smoke-package（224 files, upstreamRequests 0）',
    '身份 bc9f8fba…（inputs 3fc322a2 / 308，validation 1e04c832 / 123，build c879cefb / 216）'],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md');
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-25 acceptance (2026-10-15)

- [x] **Named through the using module's own import map.** \`gt\`/\`Wi\`/\`Fe\`/\`Yf\` resolve to three modules, not to the same-named functions elsewhere in the bundle (the Q-089 trap).
- [x] **Whole runs, not slices.** Each range ends at a boundary the source itself draws: \`Yf\`+\`Wi\`, \`gt\`+\`i\`, and \`r\`+\`f\`+\`h\`+\`Fe\` — no partly-resolvable fragment.
- [x] **The dead path is driven.** The four names are reachable only through \`load(reader)\`; the regression calls it and pins the batched read's key shape, the error text, the 10000-page cap, a throwing reader and the no-reader path.
- [x] **The ledger became checkable.** \`node .audit/w45-25-splice.mjs --verify\` re-reads all 14 records for this target and checks module digest plus byte-identity: \`records 14 bad 0\`.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\`, 25 byte-identical plans, 2/2 new regressions, full 1330/1330, fifteen compiled drivers, packaged smoke with zero upstream requests.
`);
console.log('records written');
