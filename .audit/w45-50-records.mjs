// Write the W45-50 record from the artifacts themselves: the atomic writer, its thirty-four copied
// blocks across two modules, and the store call it serves.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 380, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 145, `validation ${identity.validation.files}`);
expect(identity.build.files === 264, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 49) throw new Error('the chain verifier did not pass 49 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const copy = verifier.files.find((file) => file.product.endsWith('plugin-chain-atomic-source.ts'));
if (!copy || copy.blocks !== 34 || copy.units !== 6509) throw new Error('the atomic copy is not the 34-block, 6,509-unit one');

const ledger = JSON.parse(read('src/plugin-chain-atomic-source-blocks.json'));
if (ledger.blocks.length !== 34) throw new Error('the atomic ledger does not hold thirty-four blocks');
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 6509) throw new Error(`the ledger holds ${units} units`);
const scan = execFileSync(process.execPath, ['scripts/source-undeclared-scan.mjs', 'src/plugin-chain-atomic-source.ts'], { encoding: 'utf8' });
if (!/unresolved 0/.test(scan)) throw new Error('the atomic copy has unresolved names');

// Every block is re-read from its module, compared with the ledger, searched for in the copy, and
// checked against acorn: each one has to be a whole top-level statement, and no two may overlap.
const sources = new Map();
for (const module of new Set(ledger.blocks.map((block) => block.module))) {
  const text = read(`extracted-v2/modules/${module}`);
  let tree;
  try { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' }); }
  catch { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script' }); }
  sources.set(module, { text, statements: new Set(tree.body.map((node) => `${node.start}:${node.end}`)) });
}
const copyText = read('src/plugin-chain-atomic-source.ts');
const seen = new Set();
for (const block of ledger.blocks) {
  const [start, end] = block.range;
  if (end - start !== block.units) throw new Error(`${block.range} is not ${block.units} units`);
  const body = sources.get(block.module).text.slice(start, end);
  if (!sources.get(block.module).statements.has(`${start}:${end}`)) {
    throw new Error(`${block.module} ${JSON.stringify(block.range)} is not a whole top-level statement`);
  }
  if (seen.has(`${block.module}:${start}`)) throw new Error(`${block.module} ${start} is copied twice`);
  seen.add(`${block.module}:${start}`);
  if (!copyText.includes(body)) throw new Error(`${block.note.slice(0, 40)} is no longer in the copy`);
}
// The three facts the record states about the writer, asserted against the source text.
const writer = sources.get('chunk-1t033v1j.js').text;
const entry = ledger.blocks.find((block) => block.units === 63);
if (!entry || writer.slice(...entry.range) !== 'async function vn(e,t,n,r){return Ope(e,t,{mode:n,renameFn:r})}') {
  throw new Error('the entry the store calls is not the body this record describes');
}
const body = ledger.blocks.find((block) => block.units === 2167);
if (!body) throw new Error('the writer body is missing');
const writerBody = writer.slice(...body.range);
for (const fragment of ['refusing the in-place arm on a non-regular target', 'staging block exited without a staging file',
  'beforePublish', 'O_NOFOLLOW', 'O_CREAT']) {
  if (!writerBody.includes(fragment)) throw new Error(`the writer body lost ${fragment}`);
}
const refusal = ledger.blocks.find((block) => block.units === 145);
if (!refusal || !writer.slice(...refusal.range).includes('in-place write refused: the target has other names (a hard link)')) {
  throw new Error('the in-place refusal is not the body this record describes');
}
// Nothing in the copied closure turns the in-place gate on: `te` is false at its declaration and the
// only setter is the module's own `AOs`, which is not part of this closure.
if (!/var te=!1;/.test(writer)) throw new Error('the gate flag moved');
if (ledger.blocks.some((block) => writer.slice(...block.range).includes('function AOs('))) {
  throw new Error('the closure now carries the gate setter, so this record is stale');
}
// The store's own call is the shape the seam exposes.
const store = read('extracted-v2/modules/chunk-tvdq3hrk.js');
if (!store.includes('write:async(e,r)=>vn(await xe(e),`${_(r,null,2)}\n`,384)')) {
  throw new Error('the store no longer calls the writer with a file, its text and 0600');
}
// `Q` is the abortable wait, exported by its chunk under that name and already copied by W45-22.
const waitChunk = read('extracted-v2/modules/chunk-yjc18bey.js');
if (!/export\{[^}]*\bQ\b[^}]*\}/.test(waitChunk)) throw new Error('the wait is no longer exported as Q');
if (!copyText.includes("import { Q } from './plugin-chain-stream-source.js';")) {
  throw new Error('the copy no longer takes the abortable wait from the stream copy');
}

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-50-tests.txt');
if (full.failed !== 0 || full.tests !== 1491) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-50-family.txt');
if (family.failed !== 0 || family.tests !== 215) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const seam = summary('.audit/w45-50-seam.txt');
if (seam.failed !== 0 || seam.tests !== 9) throw new Error('the atomic sweep is not clean');

const smokeReport = read('.audit/w45-50-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 272) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const allMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
const sharedMarkers = read('.audit/w45-50-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-50-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45AtomicCompiled.v1')) throw new Error('the shared driver did not print the W45-50 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45AtomicCompiled.v1 (${sharedMarkers.length} markers in the shared driver, ${allMarkers.length} across every driver: it writes the store's own call shape, leaves no staged file, raises the source's refused-publish error with nothing behind it, falls back to the in-place arm on a cross-device rename, and rewrites a target whose staging write was refused)`;

const evidence = {
  schema: 'W45AtomicWriterEvidence.v1',
  package: 'W45-50 — the atomic file writer the plugin store publishes through',
  date: '2026-10-16',
  question: 'The store\'s `Se.write` calls `vn(file, text, 0600)`. What is `vn`, what does it drag with it, and what does the write really do to the file?',
  answer: 'It is the module\'s atomic writer: `vn` (63 units) is a four-line entry over `Ope` (2,167 units), and the closure around them is 32 more statements of chunk-1t033v1j.js plus one error class from chunk-886tf6ja.js — 34 blocks, 6,509 units. The write stages the contents beside the target (temp name `<file>.tmp.<4 hex>`, taken by exclusive create, in `stagingDir` when given) and publishes by rename; when the rename fails with EXDEV, EPERM, EEXIST or EBUSY it falls back to an in-place arm that snapshots the file first, refuses a non-regular target, and restores or removes on failure. `exactMode` and `flush` switch to a file-handle path so the mode can be fixed and the write synced. Two names come from outside the file — `E` (already copied by W45-46) and the abortable wait `Q` (already copied by W45-22) — and one class is copied with it, the telemetry-safe error the in-place refusal is raised in.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  boundary: 'None is needed: the closure is self-contained. `E` comes from ./plugin-chain-fs-source.ts (the W45-46 copy), the abortable wait `Q` from ./plugin-chain-stream-source.ts (the W45-22 copy, exported by its own chunk as `Q` and imported by this module under that name), and the node builtins are bound to the names the source uses. The one error class the writer raises its in-place refusal in is copied here rather than imported, because it was not in any earlier closure.',
  measured: [
    'The publish leaves the target and nothing else: after `vn(file, text, 0o600)` the directory holds the file alone, with the mode the call named.',
    'The target is replaced whole: a second write with different contents leaves the new contents, and `exactMode` fixes the mode through the handle path.',
    'A refused publish raises the source\'s own error — name `PublishRefusedError`, message `beforePublish refused the write; nothing was published` — and leaves nothing behind, whether the target existed or not. An existing file keeps its old contents.',
    '`stagingDir` is where the staged file lives while it is being written: it is empty again once the publish happened. A staging directory that does not exist is not an error — the entry falls back to the target\'s own directory.',
    'A rename that fails without a retryable code propagates and publishes nothing: the staged file is cleaned up and the target is not created. This build\'s retry helper `le` answers false, so the rename is attempted exactly once (measured).',
    'A cross-device rename (EXDEV) falls back to the in-place arm, which writes the target where it lies: the file ends up with the new contents after one rename attempt.',
    'The publish is a rename, so a symlink given as the file is replaced by the published file rather than followed — the link is a regular file afterwards and the file it pointed at is untouched. `followSymlinks` changes the in-place arm\'s open flags and snapshot, not the publish.',
    'When the staged file cannot be created (a read-only directory), the write fails with EACCES and nothing is written; with `inPlaceOnTempCreateRefused` set and the target existing, the same call rewrites the target in place instead.',
    'The in-place refusal `ae` (`in-place write refused: the target has other names (a hard link)`, raised in the copied telemetry-safe error) is unreachable in this bundle: it is behind the gate `$Rr`, whose flag `te` is `!1` and whose only setter `AOs` is not part of this closure. The in-place arm is therefore reached only through the two fallbacks above, and the tests assert exactly those.',
    'The store\'s own call is `vn(await xe(e), `${JSON.stringify(data,null,2)}\n`, 384)` — the file path from the W45-48 layer, the text with a trailing newline, and 0600.',
  ],
  behaviour_changed: [
    'The product can publish a file the way the source does: staged beside the target, published by rename, with the in-place fallback for a rename that cannot cross a device and for a refused staged create — and with the source\'s own refusal error when a caller says no.',
    '6,509 units left the unported set: the store\'s `Se.write` now has its writer, so the store family waits only on the read/carry layer (`vt`, `he`, `mR`).',
    'Two earlier copies are reused rather than duplicated: `E` from the W45-46 fs copy and the abortable wait `Q` from the W45-22 stream copy.',
    'No product file changed behaviour on another path: the only edits outside the new copy, seam and suite are the verifier registering the plan and the shared driver printing its marker.',
    'A generator trap is recorded for the next plan: a `var` block whose needle is given without `k: "stmt"` resolves through `extractFn` and swallows the following declaration, which the acorn check in this record now catches (it caught six of them here).',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'the new copy: unresolved 0',
    chain_verifier: chain,
    ledger_check: 'all 34 ranges are re-read from their two modules, compared with the ledger, searched for in the copy, and checked against acorn: every block is a whole top-level statement and none is copied twice',
    boundary_check: 'the writer entry, the in-place refusal and five fragments of the writer body are asserted in the source text; the gate flag `te` is asserted false and the gate setter `AOs` asserted absent from the closure; the store call site and the `Q` export are asserted in their modules',
    regressions: `the new atomic suite ${seam.passed}/${seam.tests}; ${familyLine}`,
    full: fullLine,
    compiled: driverLine,
    smoke,
  },
  next_package: [
    'the store\'s read and carry layer: `vt` (chunk-tvdq3hrk.js [17444,17609)) over `ke`/`he`/`W` with `mR` (chunk-nrk8z90j.js, its own closure 9 statements / 914 units, importing `xQt` from chunk-mven2c2x.js and `wD` from chunk-3cynezh1.js — both to be sized first)',
    'then the store under its lock: `le()`, the `ct` wrapper, the option object `pt`, the dispatcher `JAt` and the four entries of `Ce` with `Se` — by then every name they reach is in the product',
    '`settings.read` (`yGo`/`hGo`) once the settings store is ported; `http.fetch` (`VQt`) once the request runner `dNo` is',
    '`ui.copy` (`wGo`/`uzo`/`dzo`) once the clipboard encoder `Sv` and the surface catalog are ported, with the `stamp` field modelled',
    '`ui.blit` (`fNs`/`kFo`/`mNs`/`bFo`), `ui.scroll` (`O5n`/`L5n`), `ui.focus` (`fzo`/`Szo`), `ui.notify` (`Dzo`/`Fzo`/`Nzo`), each measured the same way first',
    '`fs.ancestors` (`mzt`/`kNs`) and `state.get`/`state.set` (`Jf`/`KD`)',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'the notification context provider `a4n` and the clearTimer context `R`, and a streaming provider through the loader path',
    'the config/home layer behind `be` (configuration directory, home directory, `jsn`, the memoizer `po`): porting it would replace the store file layer\'s bound hook with the source\'s own `bl()`',
  ],
};
write('research/ports/W45-atomic-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-50 **搬原子写',
  features: "; W45-50 ports the atomic writer the store publishes through",
  standard: '2026-10-16 W45-50 原子写',
  status: 'W45-50: the atomic file writer.',
  runner: '## W45-50 ported the atomic writer',
};
const stripBlock = (text, mark, { toEnd = false, paragraph = false } = {}) => {
  const at = text.indexOf(mark);
  if (at < 0) return text;
  const start = text.lastIndexOf('\n', at) + 1;
  if (toEnd) return text.slice(0, start);
  const end = paragraph ? text.indexOf('\n\n', at) : text.indexOf('\n', at);
  return text.slice(0, start) + text.slice(end < 0 ? text.length : end + 1);
};

const current = stripBlock(read('research/CURRENT.md'), marks.current);
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-50 **搬原子写**（store 的 \`Se.write\` 走的 \`vn\`）：**34 段 6,509 单位**、跨两模块（chunk-1t033v1j.js 33 段 + chunk-886tf6ja.js 的 telemetry-safe 错误类），入口 \`vn\`（63u）四行覆盖 \`Ope\`（2,167u）。**写法（源文语义）**：先在目标旁暂存（temp = \`<file>.tmp.<4 随机 hex>\`，独占创建、三试，\`stagingDir\` 给定时暂存在其中），**用 rename 发布**；rename 遇 EXDEV/EPERM/EEXIST/EBUSY → 落到 in-place 臂（先快照 \`Me\`、非普通文件拒绝 \`refusing the in-place arm on a non-regular target\`/ENXIO、truncate 后写、失败则还原快照或删除并标注）。\`exactMode\`/\`flush\` 走句柄路径以便 chmod/fsync。**先测后断言**：发布后目录只剩目标且权限=调用所给；二次写入整体替换；\`beforePublish\` 拒绝 → 抛源文自身错误（name \`PublishRefusedError\`、消息 \`beforePublish refused the write; nothing was published\`）且**不留任何文件**（目标存在则原内容不动）；\`stagingDir\` 用后清空、目录不存在也不报错（回落目标自身目录）；**不可重试的 rename 失败 → 不发布且清理暂存**（本 build 的 \`le\` 恒 false，故 rename 只尝试一次）；**EXDEV → in-place 臂直接就地改写成功**；**发布即 rename ⇒ 符号链接目标被替换而非跟随**（\`followSymlinks\` 只影响 in-place 臂的打开标志与快照）；**只读目录暂存失败 → EACCES 不写**，置 \`inPlaceOnTempCreateRefused\` 后同调用就地改写成功。**一处诚实限制**：in-place 的"同 inode 多名"拒绝 \`ae\` 在本 bundle 不可达（门 \`$Rr\` 的 flag \`te=!1\`，唯一置位者 \`AOs\` 不在闭包内），故 in-place 臂只经上述两条回退进入，测试即断言这两条。store 侧调用实为 \`vn(await xe(e),\`\${_(r,null,2)}\\n\`,384)\`（0600）。复用既有副本：\`E\`（W45-46）、可中断等待 \`Q\`（W45-22）。验收：check/build/notices、新副本扫描 \`unresolved 0\`、**${chain}**、账本 34 段逐段回源+内容比对+**acorn 断言"每段都是完整顶层语句、无重叠"**、writer 体五处片段与 store 调用点/ \`Q\` 导出回源断言、新回归 ${seam.passed}/${seam.tests}、插件链家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45AtomicCompiled.v1\`，共享 ${sharedMarkers.length} 标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [原子写证据](ports/W45-atomic-evidence.json)、[锁文件库证据](ports/W45-lockfile-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('the C-12 row was not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

const features = read('research/FEATURES.md').replace(new RegExp(`${marks.features.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^|]*`), '');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('the interactive feature row was not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-50 ports the atomic writer the store publishes through: contents staged beside the target and published by rename, with the in-place fallback for a cross-device rename or a refused staged create, and a refused publish raising the source's own error with nothing left behind. |`;
write('research/FEATURES.md', lines.join('\n'));

const standard = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standard.indexOf('2026-10-16 W45-49 锁文件库');
if (standardAt < 0) throw new Error('coding-standard W45-49 line not found');
const standardEntry = `2026-10-16 W45-50 原子写：S-1至S-7已对照。S-1（先读源）：由 store 的真实调用 \`vn(await xe(e),\`\${_(r,null,2)}\\n\`,384)\` 起手，闭包走查得 32 段同模块语句 + 1 个错误类，**先通读 \`Ope\` 全体**（\`beforePublish\` 两次询问、句柄路径、rename 回退、in-place 臂的 \\(O_NOFOLLOW\\)/truncate/还原）再定 seam。S-2（不留半包）：一次给全 34 段（含 telemetry-safe 错误类），并把"本 bundle 中 in-place 门恒关、\`le\` 恒 false"如实写入证据与 seam 注释，而非伪称可达。S-3：\`.audit/w45-50-probe.ts\`/\`-probe2.ts\` 先实测（权限、暂存清理、beforePublish 错误名与消息、stagingDir 不存在、EIO 只试一次、EXDEV 就地改写、符号链接被替换、只读目录 EACCES 与允许回退），再写 9 条断言；两处首版断言（把别的 test 建的文件漏进目录清单）由断言当场抓住并改为"无 .tmp. 残留"这种与顺序无关的判定。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器/打包冒烟/${drivers.length} 个编译驱动并解析输出；**新增 acorn 断言**：每段必须是完整顶层语句且无重叠——该断言正是发现"漏写 k:stmt 导致 extractFn 吞掉下一条声明"（本包 6 处）的工具。S-5/S-6：seam 只做命名与类型收窄（并把 followSymlinks 的实测语义写进注释），复用既有 \`E\`/\`Q\` 副本，无死导出。S-7：store 读/携带层（\`vt\`/\`he\`/\`mR\`，后者待先量 \`xQt\`/\`wD\`）、store 四条目与锁包装、\`settings.read\`、\`http.fetch\`、\`ui.copy\`（含 \`stamp\`）、\`ui.blit\`/\`scroll\`/\`focus\`/\`notify\`、\`fs.ancestors\`、\`state.*\`、Q-086、通知 Provider、config/home 层写入 next_package。验收：check/build/notices、扫描 unresolved 0、${chain}、账本与边界自证、回归 ${seam.passed}/${seam.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf('W45-49: the lockfile library.');
if (statusAt < 0) throw new Error('STATUS W45-49 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-50: the atomic file writer. The store's \`Se.write\` calls \`vn(file, text, 0600)\`, so this package took \`vn\` (63 units) and the body it calls, \`Ope\` (2,167 units), with the helpers they need: 34 whole top-level statements, 6,509 units, across chunk-1t033v1j.js and one error class from chunk-886tf6ja.js. The write stages the contents beside the target and publishes by rename, falling back to an in-place arm when the rename cannot cross a device or the staged create is refused — and raising the source's own error, with nothing left behind, when a caller refuses the publish. Everything was measured first: the mode the call leaves, the cleaned-up staging area, the refused-publish error's name and message, the once-attempted rename this build's inert retry helper implies, the in-place rewrite after EXDEV, a symlink target replaced rather than followed, and the read-only-directory fallback. Two honesty notes are in the record: the in-place "other names (a hard link)" refusal is unreachable in this bundle because the gate flag is false and its only setter is outside the closure, and the acorn check that catches a needle resolved as a function instead of a statement — six blocks here — is now part of the record script. Evidence: \`research/ports/W45-atomic-evidence.json\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-50 ported the atomic writer (2026-10-16)

The store's \`Se.write\` calls \`vn(file, text, 0600)\`. \`vn\` is four lines over \`Ope\`, and the closure
around them is 34 whole top-level statements — 33 in chunk-1t033v1j.js and one error class in
chunk-886tf6ja.js — 6,509 units. The write stages the contents beside the target (temp name the target
plus \`.tmp.\` and four random hex bytes, taken by exclusive create, in \`stagingDir\` when one is given)
and publishes by rename; a rename that cannot cross a device, or a staged create refused with EACCES
when \`inPlaceOnTempCreateRefused\` is set, falls back to an in-place arm that snapshots the file first
and restores or removes it on failure. \`exactMode\` and \`flush\` take the file-handle path so the mode
can be fixed and the write synced.

Two names come from copies the product already holds — \`E\` (W45-46) and the abortable wait \`Q\`
(W45-22, exported by its chunk under that name) — and the telemetry-safe error the in-place refusal is
raised in is copied here, because no earlier closure had it.

Measured before asserted: the mode the call leaves and the staging area it cleans; the refused
publish's own error (\`PublishRefusedError\`, \`beforePublish refused the write; nothing was published\`)
with nothing written; a rename that fails without a retryable code publishing nothing; EXDEV falling
back to the in-place arm; a symlink target replaced rather than followed; and the read-only-directory
EACCES that becomes an in-place rewrite only when the caller allows it.

Two honesty notes are recorded: the in-place "other names (a hard link)" refusal is unreachable in this
bundle (the gate flag \`te\` is \`!1\` and its only setter is outside the closure), so the in-place arm
is reached only through those two fallbacks — which is what the tests assert; and this build's retry
helper \`le\` answers false, so a rename is attempted exactly once.

The record script also gained an acorn check that every copied block is a whole top-level statement and
none is copied twice. It caught six blocks in this package's first plan: a \`var\` needle given without
\`k: "stmt"\` resolves through \`extractFn\` and swallows the declaration after it.

Verified: check/build/notices, the new copy \`unresolved 0\`, ${chain}, the ledger, acorn and boundary
checks, the new suite ${seam.passed}/${seam.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled
drivers (the shared driver now also prints \`W45AtomicCompiled.v1\`), and the packaged smoke (${smoke}).
Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: the store's read and carry layer — \`vt\` with \`he\`, \`W\`, \`ke\` and \`mR\` (whose own closure is
nine statements in chunk-nrk8z90j.js and reaches \`xQt\` and \`wD\`, to be sized first) — and then the four
\`store.*\` entries under their lock.
`);

const rows = [
  ['2026-10-17T01:05:00Z', 'package', 'W45-50 搬原子写（store 的 Se.write 走的 vn；34 段 6,509 单位，跨两模块）',
    'vn(63u)+Ope(2,167u)+30 余个 helper 与一个 telemetry-safe 错误类成为产品面：暂存旁路 + rename 发布 + EXDEV/写入失败回退 in-place 臂（快照/还原/拒绝非普通文件）；exactMode/flush 走句柄路径',
    'chunk-1t033v1j.js 33 段（te [2493,2503)、ne [2524,2548)、be [2926,2949)、$Rr [2949,3009)、rU/ST [3009,3076)、GGn [3076,3115)、pTo [3115,3366)、ae [3366,3511)、UR [3554,3611)、se/ce/ke/URr/Ae [3784,3898)、le [3936,3969)、ue [3969,3980)、Ce [3980,4054)、TD [4054,4240)、ss [4240,4285)、COs/fe/Mse [4539,4619)、de [4619,4691)、We [4691,4905)、Me [5018,5452)、Ye [5452,5821)、F [5821,6196)、i1e [6196,6285)、VGn [6285,6442)、De [6442,6719)、Ue [6719,6835)、C [6835,6843)、me [6843,6961)、W [6961,7136)、j [7136,7320)、RD [7320,7506)、Be [7710,7841)、vn [8106,8169)、Ope [8169,10336)）+ chunk-886tf6ja.js x [3714,3869)',
    `实测（.audit/w45-50-probe.ts、-probe2.ts 与 test/plugin-chain-atomic.test.ts + .audit/w45-24-compiled.mjs）：权限与暂存清理、beforePublish 错误名/消息且不留文件、stagingDir 清空与不存在不报错、EIO 只试一次、EXDEV 就地改写、符号链接被替换而非跟随、只读目录 EACCES 与允许后的就地改写；9/9 通过`],
  ['2026-10-17T01:12:00Z', 'finding', 'W45-50 记录脚本新增 acorn 校验，当场抓住"漏写 k:stmt"的生成器陷阱（本包 6 处）',
    '计划里 var 块只给 needle 未给 k 时，生成器用 extractFn（按"下一个花括号体"），结果吞掉紧随其后的函数声明 → 生成文件出现重复声明（acorn 报 Identifier already declared）',
    '为 6 个 var 块补 k:"stmt"，重生成后单位数 6,871 → 6,509（= 闭包精确值），并新增断言"每段必须是完整顶层语句且无重叠"写入记录脚本，防止复发',
    'check/build 通过；链校验器 49 plans 通过（本包 34 段 / 6,509 单位）；扫描 unresolved 0'],
  ['2026-10-17T01:16:00Z', 'finding', 'W45-50 两处"诚实限制"写入证据：in-place 门恒关、retry helper 恒 false',
    'in-place 的"同 inode 多名"拒绝 ae 位于门 $Rr 之后，flag te=!1 且唯一置位者 AOs 不在闭包内 → 该分支在本产品不可达；rename 重试经 le，而 le 恒返回 false → rename 只尝试一次（实测 attempts=1）',
    'seam 注释与证据如实记载；测试只断言可达的两条 in-place 进入路径（EXDEV 回退、EACCES+inPlaceOnTempCreateRefused）与一次尝试，不做无依据断言',
    '回归 9/9、家族 215/215、全量 1491/1491 通过；共享驱动 24 标记全出（新增 W45AtomicCompiled.v1）'],
  ['2026-10-17T01:20:00Z', 'verification', `W45-50 验收：新副本扫描 unresolved 0、账本 34 段逐段回源 + acorn 完整性、边界与 store 调用点回源自证、${chain}、回归 ${seam.passed}/${seam.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '原子写收束，下一包转 store 的读/携带层（vt/he/W/ke/mR，先量 xQt/wD）',
    `check/build/notices；扫描 unresolved 0；${chain}；账本 34 段逐段回源比长度与内容 + acorn 断言（完整顶层语句、无重叠、无重复）；writer 体五处片段、in-place 拒绝原文、te 标志与 AOs 缺席、store 调用点、Q 导出四处回源断言；回归 ${seam.passed}/${seam.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45AtomicCompiled.v1，共享 ${sharedMarkers.length} 标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-50 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-50 acceptance (2026-10-16)

- [x] **The store's own call decided the surface.** \`vn(file, text, 0600)\` and the body it calls, read in full before the seam was written.
- [x] **The whole closure came across.** 34 whole top-level statements, 6,509 units, two modules; chain verifier (${chain}) and \`unresolved 0\`.
- [x] **The acorn check is part of the record.** Every block a whole top-level statement, none copied twice — it caught six mis-resolved needles in this package's first plan.
- [x] **Everything measured before it was asserted.** Modes, staging cleanup, the refused-publish error, the single rename attempt, the EXDEV in-place rewrite, the replaced symlink, the read-only fallback.
- [x] **The unreachable branch is recorded, not implied.** The in-place "other names on disk" refusal is behind a gate this bundle keeps closed; the tests assert the two paths that do reach the arm.
- [x] **Two earlier copies reused, one class copied.** \`E\` (W45-46) and \`Q\` (W45-22) imported; the telemetry-safe error copied because no earlier closure had it.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\`, ${chain}, ledger, acorn and boundary checks, new suite ${seam.passed}/${seam.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
