// Write the W45-48 record from the artifacts themselves: the store's file layer, its eight copied
// blocks, and the one bounded dependency it builds its path under.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 373, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 143, `validation ${identity.validation.files}`);
expect(identity.build.files === 259, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 47) throw new Error('the chain verifier did not pass 47 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const copy = verifier.files.find((file) => file.product.endsWith('plugin-chain-store-path-source.ts'));
if (!copy || copy.blocks !== 8 || copy.units !== 574) throw new Error('the store-path copy is not the 8-block, 574-unit one');

const ledger = JSON.parse(read('src/plugin-chain-store-path-source-blocks.json'));
if (ledger.blocks.length !== 8) throw new Error('the store-path ledger does not hold eight blocks');
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 574) throw new Error(`the ledger holds ${units} units`);
const scan = execFileSync(process.execPath, ['scripts/source-undeclared-scan.mjs', 'src/plugin-chain-store-path-source.ts'], { encoding: 'utf8' });
if (!/unresolved 0/.test(scan)) throw new Error('the store-path copy has unresolved names');

// The bodies are re-read from the module the ledger names, and the two the seam's own comments quote
// are re-read too, so neither the copy nor the boundary can drift from the source.
for (const block of ledger.blocks) {
  const text = read(`extracted-v2/modules/${block.module}`);
  const body = text.slice(block.range[0], block.range[1]);
  if (body.length !== block.units) throw new Error(`${block.module} ${block.range} is not ${block.units} units`);
}
const byNote = (fragment) => ledger.blocks.find((block) => block.note.includes(fragment));
const tvdq = read('extracted-v2/modules/chunk-tvdq3hrk.js');
const s9zk = read('extracted-v2/modules/chunk-s9zkj3fw.js');
const tvdqBlock = (fragment) => tvdq.slice(byNote(fragment).range[0], byNote(fragment).range[1]);
const storagePath = tvdqBlock('the store file\'s path');
if (storagePath !== 'var S=(e)=>gt(bl(),"store",ue(e));') throw new Error('the path body moved');
const naming = tvdqBlock('the file name for a storage id');
if (!naming.includes('return`${e}.json`') || !naming.includes('${n.slice(0,me)||"plugin"}-${i}.json`')) {
  throw new Error('the naming body no longer has the two arms this record describes');
}
const boundary = read('src/plugin-chain-store-dir.ts');
const blBody = s9zk.slice(7352, 7440);
if (!boundary.includes(blBody)) throw new Error('the seam no longer quotes `bl` verbatim');
const yBody = s9zk.slice(7172, 7258);
if (!boundary.includes(yBody)) throw new Error('the seam no longer quotes the directory-name rule `Y` verbatim');
const ae = read('extracted-v2/modules/chunk-ae84tp6z.js');
if (!boundary.includes(ae.slice(14572, 14628))) throw new Error('the seam no longer quotes `Ld` verbatim');
const nqc = read('extracted-v2/modules/chunk-nqc6v990.js');
if (!boundary.includes(nqc.slice(2704, 2762))) throw new Error('the seam no longer quotes the configuration directory `be` verbatim');
const copyText = read('src/plugin-chain-store-path-source.ts');
if (!copyText.includes("import { bl } from './plugin-chain-store-dir.js';")) throw new Error('the copy does not import the data directory');
const bound = '`bl`, the plugin data directory (chunk-s9zkj3fw.js [7352,7440) 88 units), is the one name inside the copied `S` this package does not carry: its body reads an environment override through `Ld` (chunk-ae84tp6z.js [14572,14628) 56 units) and otherwise joins the configuration directory `be` (chunk-nqc6v990.js [2704,2762) 58 units) with the directory name `Y` answers (chunk-s9zkj3fw.js [7172,7258) 86 units). That configuration/home layer is the subsystem W45-43 recorded, so the seam quotes all four bodies verbatim, names the unported reach (`o()`, the home-directory join, `jsn`, the memoizer `po`), and binds the hook — with no default: unbound, the boundary refuses rather than guessing a path';

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-48-tests.txt');
if (full.failed !== 0 || full.tests !== 1476) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-48-family.txt');
if (family.failed !== 0 || family.tests !== 200) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const seam = summary('.audit/w45-48-seam.txt');
if (seam.failed !== 0 || seam.tests !== 6) throw new Error('the store-path sweep is not clean');

const smokeReport = read('.audit/w45-48-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 267) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const allMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
const sharedMarkers = read('.audit/w45-48-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-48-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45StorePathCompiled.v1')) throw new Error('the shared driver did not print the W45-48 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45StorePathCompiled.v1 (${sharedMarkers.length} markers in the shared driver, ${allMarkers.length} across every driver: it names store files by the source's rule, makes the directory, touches the file, logs a refused touch, and refuses with no data directory bound)`;

const evidence = {
  schema: 'W45StorePathEvidence.v1',
  package: 'W45-48 — the `$` store\'s file layer: the name, the path, the directory and the touch',
  date: '2026-10-16',
  question: 'W45-47 measured the `store.*` family as blocked on three pieces — the lockfile library, the atomic writer and the data directory. Which of the store\'s own layers can be taken whole before those three, without half-porting anything?',
  answer: 'The file layer can, and it is the whole of "where a plugin\'s store lives": `ue` names the file (safe ids verbatim as `<id>.json`, anything else sanitized to word characters, cut to 64 and given the first 12 hex digits of the id\'s sha256, with `.`/`..` and the Windows device names always hashed), `S` builds the path as `<data dir>/store/<name>`, `xe` makes the directory (`recursive`, mode 448) and answers the path, and `St` touches the file, logging rather than throwing when it cannot. Eight blocks, 574 units, one module. The data directory `bl()` is the one name inside `S` the product cannot carry yet — it reads the configuration directory, which is the config/home subsystem — so it is bounded and quoted verbatim, and it refuses rather than guessing a path when unbound.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  boundary: bound,
  measured: [
    'A safe id is used verbatim: `hook_agent` is `hook_agent.json`, and the rule is exactly the source\'s (`/^[a-z0-9._-]+$/` with no device name, at most 64 characters, not `.` or `..`).',
    'Anything else is sanitized, cut and hashed: `My Plugin!` → `My_Plugin_-<12 hex>.json`, `???` → `___-<hash>.json`, and an empty id → `plugin-<hash>.json` — the source\'s `${n.slice(0,me)||"plugin"}` fallback.',
    'The Windows device names are hashed even when they look safe: `con`, `com1` and `LPT9` (with or without an extension) are refused by `nt` before the verbatim arm, while `console` passes.',
    '`. ` and `..` do not pass through: they are sanitized to `_` and `__` and hashed, so no store file can be the directory itself.',
    'The path is the data directory, then `store`, then the name — asserted against a bound directory, and against a second one whose parent does not exist yet.',
    'The directory is made recursively and the call answers the file path; calling it twice is the same path and does not fail on the directory that is already there.',
    'The touch sets both times to now and says nothing when it works; a refused touch logs `$.store (${plugin}): could not touch ${file}: ${reason}` at warn level and answers rather than throwing.',
    'With no data directory bound the boundary refuses (`the plugin data directory is not bound; bindPluginDataDir() installs one`) instead of answering a guessed path — the source always has a directory, so this refusal is the boundary\'s own and is documented as such.',
    'The three pieces the `store.*` entries still wait on are measured: the lockfile library (chunk-c6qwr3kc.js, 23,134 bytes: `lt`, `Wa`, `Um`, `ft` and the acquisition machinery `ot` at 3,255 units), the atomic writer (`vn` → `Ope`, 2,167 units alone, chunk-1t033v1j.js), and the read/carry layer (`vt`/`he` over `mR`).',
  ],
  behaviour_changed: [
    'The product can name, path, make and touch a plugin store file exactly as the source does, with the source\'s naming rule (including the device-name and dot refusals) and its logged touch.',
    '574 units left the unported set across one module, and the copy is located by needle rather than by hand-measured ranges: the plan names each declaration the way the module spells it, so the ledger\'s ranges are computed by the generator and re-read by this record.',
    'The data directory is recorded as bounded with its full reach named (`Ld`, `be`, `Y`, the environment override, `jsn`, the memoizer), so the next package that ports the config/home layer replaces the hook rather than re-deriving it.',
    'The store\'s three remaining preconditions are recorded with their measured sizes, so the `store.*` family is three known packages away rather than an unknown one.',
    'No product file changed behaviour on another path: the only edits outside the new copy, seam and boundary module are the verifier registering the plan and the shared driver printing its marker.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'the new copy: unresolved 0',
    chain_verifier: chain,
    ledger_check: 'every copied range is re-read from its module and its length compared against the ledger; the naming body is asserted to carry both arms and the path body to be `var S=(e)=>gt(bl(),"store",ue(e));`',
    boundary_check: 'the seam still quotes `bl`, `Y`, `Ld` and `be` verbatim from their modules, and the copy still imports the data directory',
    regressions: `the new store-path suite ${seam.passed}/${seam.tests}; ${familyLine}`,
    full: fullLine,
    compiled: driverLine,
    smoke,
  },
  next_package: [
    'the lockfile library (`lt`/`Wa`/`Um`/`ft` and the acquisition machinery `ot`, chunk-c6qwr3kc.js 23,134 bytes): the store\'s `Se.lock` and the lock options `pt` wait on it',
    'the atomic writer (`vn` → `Ope`, chunk-1t033v1j.js; `Ope` alone 2,167 units): the store\'s `Se.write` waits on it',
    'the read/carry layer (`vt`/`he` over `mR`): the store\'s `Se.read` reads through it, carrying another session\'s store when the file is missing',
    'then the `store.*` family itself: the four entries over `JAt`/`Ce`/`Se` with the checks `ppr`/`xNs`',
    '`settings.read` (`yGo`/`hGo`) once the settings store is ported; `http.fetch` (`VQt`) once the request runner `dNo` is',
    '`ui.copy` (`wGo`/`uzo`/`dzo`) once the clipboard encoder `Sv` and the surface catalog are ported, with the `stamp` field modelled',
    '`ui.blit` (`fNs`/`kFo`/`mNs`/`bFo`), `ui.scroll` (`O5n`/`L5n`), `ui.focus` (`fzo`/`Szo`), `ui.notify` (`Dzo`/`Fzo`/`Nzo`), each measured the same way first',
    '`fs.ancestors` (`mzt`/`kNs`) and `state.get`/`state.set` (`Jf`/`KD`)',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'the notification context provider `a4n` and the clearTimer context `R`, and a streaming provider through the loader path',
    'the config/home layer behind `be` (configuration directory, home directory, `jsn`, the memoizer `po`): porting it would replace this package\'s boundary with the source\'s own `bl()`',
  ],
};
write('research/ports/W45-store-path-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-48 **搬 `$` store 的"文件层"',
  features: "; W45-48 binds the `$` store's file layer",
  standard: '2026-10-16 W45-48 store 文件层',
  status: 'W45-48: the `$` store\'s file layer.',
  runner: '## W45-48 ported the `$` store file layer',
};
const stripBlock = (text, mark, { toEnd = false, paragraph = false } = {}) => {
  const at = text.indexOf(mark);
  if (at < 0) return text;
  const start = text.lastIndexOf('\n', at) + 1;
  if (toEnd) return text.slice(0, start);
  const end = paragraph ? text.indexOf('\n\n', at) : text.indexOf('\n', at);
  return text.slice(0, start) + text.slice(end < 0 ? text.length : end + 1);
};

// CURRENT: the W45-48 row above the W45-47 one.
const current = stripBlock(read('research/CURRENT.md'), marks.current);
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-48 **搬 \`$\` store 的"文件层"**（\`ue\`/\`S\`/\`xe\`/\`St\` + 三条命名规则与两个常量）：8 段 574 单位、单模块（chunk-tvdq3hrk.js），**按 needle 定位块**（计划里直接写模块自己的声明文本，区间由生成器算、记录脚本回读，不再手抄区间）。**命名规则（源的原文语义，逐条实测）**：安全 id 原样成 \`<id>.json\`（\`/^[a-z0-9._-]+$/\` + 非设备名 + ≤64 字符 + 非 \`.\`/\`..\`）；其余先按 \`[^a-zA-Z0-9_-]→_\` 净化、截 64、再接 \`-\`+id 的 sha256 前 12 位（\`My Plugin!\`→\`My_Plugin_-<hash>.json\`、\`???\`→\`___-<hash>.json\`、空 id→\`plugin-<hash>.json\`）；**Windows 设备名**（\`con\`/\`com1\`/\`LPT9\`，带扩展名也算）即便"看起来安全"也走哈希、\`console\` 不受影响；\`.\`/\`..\` 净化后仍哈希（store 文件永不会是目录本身）。**路径与目录**：路径 = 数据目录 + \`store\` + 名字；\`xe\` 递归建目录（mode 448=0700）并回文件路径，二次调用同路径不报错。**触摸**：\`St\` 把两个时间都设为现在，成功不发声、失败按 warn 记 \`$.store (plugin): could not touch <file>: <reason>\` 且**不抛**。**唯一边界**：数据目录 \`bl()\`（chunk-s9zkj3fw.js [7352,7440) 88 单位）不在本包——其体读环境变量覆盖（经 \`Ld\` 展开 \`~\`）否则拼配置目录 \`be\`（chunk-nqc6v990.js [2704,2762)）与 \`Y\` 的目录名（chunk-s9zkj3fw.js [7172,7258)）——即 W45-43 记的 config/home 子系统；seam 逐字引用这四段原文、写明未搬可达面（\`o()\`、home 拼接、\`jsn\`、记忆器 \`po\`）并留可绑定钩子，**无默认**：未绑定即拒绝（\`the plugin data directory is not bound; bindPluginDataDir() installs one\`），拒绝文本属边界自身并已在 seam 注明（源永远有目录）。**store.\* 余下三道前置已量**：锁文件库（chunk-c6qwr3kc.js 23,134 字节，含 \`ot\` 3,255 单位）、原子写（\`vn\`→\`Ope\`，\`Ope\` 单为 2,167 单位）、读/携带层（\`vt\`/\`he\` over \`mR\`）。验收：check/build/notices、新副本扫描 \`unresolved 0\`、**${chain}**、账本 8 段逐段回读（命名体两臂 + 路径体原文断言）、边界四段引文回源自证、新回归 ${seam.passed}/${seam.tests}、插件链家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45StorePathCompiled.v1\`，共享 ${sharedMarkers.length} / 全体 ${allMarkers.length} 标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [store 文件层证据](ports/W45-store-path-evidence.json)、[ui.selection 证据](ports/W45-ui-selection-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('the C-12 row was not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the store file layer.
const features = read('research/FEATURES.md').replace(new RegExp(`${marks.features.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^|]*`), '');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('the interactive feature row was not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-48 binds the \`$\` store's file layer: a plugin's store file is named by the source's own rule (safe ids verbatim, anything else sanitized and hashed, device names never verbatim), pathed under the data directory, its directory made at 0700, and the file touched with a logged warning rather than a throw. |`;
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standard.indexOf('2026-10-16 W45-47 ui.selection 条目与剩余条目清点');
if (standardAt < 0) throw new Error('coding-standard W45-47 line not found');
const standardEntry = `2026-10-16 W45-48 store 文件层：S-1至S-7已对照。S-1（先读源）：先按"读它的模块"逐名解析，判定 store 家族的三道前置（锁文件库 / 原子写 / 读携带层）各为千级子系统、本包不可全取；转而取**自足**的一段：命名 \`ue\` + 三条规则 + 两常量 + 路径 \`S\` + 建目录 \`xe\` + 触摸 \`St\`，并把唯一跨包名 \`bl\` 的闭包（\`Ld\`/\`be\`/\`Y\`）完整读出。S-2（不留半包）：8 段一次给全 + 四个包装；三道前置与 config/home 层写入 next_package。S-3：回归先依赖实测量出的取值（原样/净化/哈希三类命名、设备名与 \`.\`/\`..\` 强制哈希、空 id 落 \`plugin\`、截断 64、12 位十六进制、路径形状、递归建目录、触摸成功静默与失败告警不抛、未绑定即拒绝），断言字面值与源文拒绝文本；两处首版断言错误（\`..\` 应为两个下划线、\`???\` 净化后保留下划线而非落 \`plugin\`）由断言当场抓住并修正。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器/打包冒烟/${drivers.length} 个编译驱动并解析输出，\`ported\` 由 ledger 读回并逐段回源比长度，边界四段引文回源比对。S-5/S-6：seam 只做命名与类型收窄（\`St\` 收窄为 \`Promise<void>\`），无死导出；不重复搬 \`l\`/\`t\`。S-7：锁文件库、原子写、读携带层、store 四条目、\`settings.read\`、\`http.fetch\`、\`ui.copy\`（含 \`stamp\`）、\`ui.blit\`/\`scroll\`/\`focus\`/\`notify\`、\`fs.ancestors\`、\`state.*\`、Q-086、通知 Provider、config/home 层写入 next_package。验收：check/build/notices、扫描 unresolved 0、${chain}、账本与边界自证、回归 ${seam.passed}/${seam.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-48 paragraph above the W45-47 one.
const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf('W45-47: `$` ui.selection');
if (statusAt < 0) throw new Error('STATUS W45-47 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-48: the \`$\` store's file layer. W45-47 measured the store family as three packages away, and this package took the one layer of it that stands alone: how a plugin's store file is named (\`ue\` — safe ids verbatim, anything else sanitized, cut to 64 characters and given the first 12 hex digits of the id's sha256, with \`.\`, \`..\` and the Windows device names always hashed), where it lives (\`S\` — the data directory, \`store\`, the name), the directory made recursively at 0700 (\`xe\`), and the touch that logs rather than throws (\`St\`). Eight blocks, 574 units, one module, and this is also the first plan located by needle: the plan names each declaration the way the module spells it, so the ranges are computed by the generator and re-read by the record instead of transcribed. The one name the layer cannot carry is the data directory \`bl()\`, whose body reads the configuration directory — the config/home subsystem — so all four of its bodies are quoted verbatim and the hook refuses rather than guessing a path when unbound. Two first-version assertions were wrong and were caught: \`..\` sanitizes to two underscores, and \`???\` keeps its underscores rather than falling back to \`plugin\`. Evidence: \`research/ports/W45-store-path-evidence.json\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-48 section.
const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-48 ported the \`$\` store file layer (2026-10-16)

The store family's three preconditions turned out to be three subsystems — a lockfile library
(chunk-c6qwr3kc.js, 23,134 bytes), an atomic writer (\`Ope\` at 2,167 units) and a read/carry layer —
so this package took the one layer of the store that stands alone: where a plugin's store file lives.
Eight blocks, 574 units, one module (chunk-tvdq3hrk.js): the safe-name rule and the two constants, the
Windows device-name rule, the name itself, the path, the directory and the touch.

The naming rule is the whole of the source: a safe id (lowercase, digits, dots, underscores, dashes,
at most 64 characters, not a device name, not \`.\` or \`..\`) is \`<id>.json\`; anything else is sanitized
to word characters, cut to 64 and given \`-\` plus the first 12 hex digits of the id's sha256; an id with
nothing left contributes the literal \`plugin\`. The path is the data directory, \`store\`, the name; the
directory is made recursively at 0700; and the touch logs \`$.store (plugin): could not touch …\` rather
than throwing.

This is the first plan located by needle: each block names the declaration as the module spells it
(\`var S=(e)=>gt(bl(),"store",ue(e));\`, \`function ue(\`, …), so the generator computes the ranges and
the record re-reads them — no hand-measured coordinates to drift.

The one name the layer cannot carry is \`bl()\`, the data directory: it reads an environment override
through \`Ld\`, and otherwise joins the configuration directory \`be\` (a memoized \`~/.claude\` unless the
process names another) with the directory name \`Y\` answers. That is the config/home layer, so all four
bodies are quoted verbatim in src/plugin-chain-store-dir.ts with their unported reach named, and the
hook has no default: unbound, it refuses rather than guessing a path.

Verified: check/build/notices, the new copy \`unresolved 0\`, ${chain}, the ledger and boundary checks,
the new suite ${seam.passed}/${seam.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers
(the shared driver now also prints \`W45StorePathCompiled.v1\`), and the packaged smoke (${smoke}).
Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: the lockfile library, then the atomic writer, then the read/carry layer — the store family's
three remaining preconditions — and then the \`store.*\` entries themselves.
`);

const rows = [
  ['2026-10-16T23:35:00Z', 'package', 'W45-48 搬 `$` store 文件层（8 段 574 单位，单模块；首用 needle 定位块）',
    'ue/S/xe/St + 三条命名规则与两常量成为产品面：命名、路径、递归建目录(0700)、触摸告警不抛；数据目录 bl() 为有界钩子且无默认',
    'chunk-tvdq3hrk.js ue [15976,16204)、S [16204,16238)、xe [16238,16319)、St [16357,16491)、lt [15805,15829)、nt [15383,15436)、me [15436,15446)、st [15446,15456)；边界引文 chunk-s9zkj3fw.js bl [7352,7440)/Y [7172,7258)、chunk-ae84tp6z.js Ld [14572,14628)、chunk-nqc6v990.js be [2704,2762)',
    `实测（test/plugin-chain-store-path.test.ts + .audit/w45-24-compiled.mjs）：三类命名、设备名与 ./.. 强制哈希、空 id 落 plugin、截 64、12 位哈希、路径形状、递归建目录、触摸成功静默/失败告警、未绑定即拒绝；6/6 通过`],
  ['2026-10-16T23:40:00Z', 'finding', 'W45-48 量出 store.* 的三道前置均为千级子系统，故本包只取自足的文件层',
    '锁文件库 chunk-c6qwr3kc.js 23,134 字节（lt/Wa/Um/ft 与获取机制 ot 3,255 单位）；原子写 Ope 单为 2,167 单位（chunk-1t033v1j.js）；读/携带层 vt/he over mR（mR 在 chunk-nrk8z90j.js）',
    '不半搬：本包取文件层八段；三道前置（含体量与模块）写入 evidence.next_package 前三条与 runner 文档 Next',
    'check/build 通过；账本 8 段逐段回源比长度通过；边界四段引文回源比对通过'],
  ['2026-10-16T23:43:00Z', 'finding', 'W45-48 两处首版断言错误当场被断言抓住（命名规则的两处细节）',
    '① `..` 期望写成单个下划线，实际净化后是两个（点→下划线，逐字符）；② `???` 期望落 `plugin`，实际净化后保留下划线为 `___`（只有空 id 才落 `plugin`）',
    '两处断言改为与源文一致的期望并写明依据（`[^a-zA-Z0-9_-]→_` 与 `${n.slice(0,me)||"plugin"}` 只在 `n` 为空时生效）',
    '回归 6/6、家族 200/200、全量 1476/1476 通过；驱动 22 标记全出'],
  ['2026-10-16T23:46:00Z', 'verification', `W45-48 验收：新副本扫描 unresolved 0、账本逐段回读、边界四段引文回源自证、${chain}、回归 ${seam.passed}/${seam.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    'store 文件层收束，下一包转锁文件库（store 家族三道前置之首）',
    `check/build/notices；扫描 unresolved 0；${chain}；账本 8 段逐段回源比长度（命名体两臂 + 路径体原文断言）；边界 bl/Y/Ld/be 四段引文回源 + 副本 import；回归 ${seam.passed}/${seam.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45StorePathCompiled.v1，共享 ${sharedMarkers.length} / 全体 ${allMarkers.length} 标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-48 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-48 acceptance (2026-10-16)

- [x] **The prerequisites were sized before one was taken.** Lockfile library, atomic writer and read/carry layer measured; the store's own file layer taken because it stands alone.
- [x] **Eight blocks copied whole.** 574 units of one module, located by needle so the ranges are computed and re-read rather than transcribed; chain verifier (${chain}) and \`unresolved 0\`.
- [x] **The naming rule is the source's.** Verbatim ids, sanitized-and-hashed ids, device names, \`.\`/\`..\`, the 64-character cut and the 12 hash digits, each asserted against a literal.
- [x] **The one uncarried name is bounded, not approximated.** \`bl()\` and its closure are quoted verbatim with the unported reach named, and the hook refuses rather than guessing a path when unbound.
- [x] **Two first-version assertions were caught.** \`..\` sanitizes to two underscores, and \`???\` keeps its underscores; both fixed to the source's own rule.
- [x] **Everything measured before it was asserted.** The path shape, the recursive directory, the silent touch and the logged refusal.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\`, ${chain}, ledger and boundary checks, new suite ${seam.passed}/${seam.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
