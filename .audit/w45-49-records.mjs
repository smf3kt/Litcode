// Write the W45-49 record from the artifacts themselves: the lockfile library, its sixteen copied
// blocks, the one binding the seam supplies, and the store side that waits on it.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 377, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 144, `validation ${identity.validation.files}`);
expect(identity.build.files === 262, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 48) throw new Error('the chain verifier did not pass 48 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const copy = verifier.files.find((file) => file.product.endsWith('plugin-chain-lockfile-source.ts'));
if (!copy || copy.blocks !== 16 || copy.units !== 22356) throw new Error('the lockfile copy is not the 16-block, 22,356-unit one');

const ledger = JSON.parse(read('src/plugin-chain-lockfile-source-blocks.json'));
if (ledger.blocks.length !== 16) throw new Error('the lockfile ledger does not hold sixteen blocks');
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 22356) throw new Error(`the ledger holds ${units} units`);
const scan = execFileSync(process.execPath, ['scripts/source-undeclared-scan.mjs', 'src/plugin-chain-lockfile-source.ts'], { encoding: 'utf8' });
if (!/unresolved 0/.test(scan)) throw new Error('the lockfile copy has unresolved names');
if (new Set(ledger.blocks.map((block) => block.module)).size !== 1) throw new Error('the lockfile copy is not one module');

// Every copied range is re-read from the module, and the three facts the record states are asserted
// against the source text rather than described.
const lock = read('extracted-v2/modules/chunk-c6qwr3kc.js');
for (const block of ledger.blocks) {
  const [start, end] = block.range;
  if (end - start !== block.units) throw new Error(`${block.range} is not ${block.units} units`);
  if (!read('src/plugin-chain-lockfile-source.ts').includes(lock.slice(start, end))) {
    throw new Error(`${block.note.slice(0, 40)} is no longer in the copy`);
  }
}
const byNeedle = (needle) => ledger.blocks.find((block) => lock.slice(block.range[0], block.range[1]).startsWith(needle));
const acquire = byNeedle('async function Wa(');
if (!acquire) throw new Error('the acquire wrapper moved');
if (lock.slice(...acquire.range) !== 'async function Wa(e,r){let n=await lt().lock(e,r);return Object.assign(n,{[Symbol.asyncDispose]:n})}') {
  throw new Error('the acquire wrapper is not the body this record describes');
}
const release = byNeedle('async function Um(');
if (!release || !lock.slice(...release.range).includes('lock was no longer held at release (${u})')) {
  throw new Error('the release wrapper lost its lost-lock diagnostic');
}
const checkLedger = byNeedle('function VPs(');
if (!checkLedger || lock.slice(...checkLedger.range) !== 'function VPs(e,r){return lt().check(e,r)}') {
  throw new Error('the check wrapper is not the body this record describes');
}
const entry = byNeedle('var ft=T(function(');
if (!entry || !lock.slice(...entry.range).includes('K.exports.check=zt')) {
  throw new Error('the library entry no longer exposes the surface the seam names');
}
// The seam's own binding is quoted from its module, and the seam still carries it.
const runtime = read('extracted-v2/modules/chunk-txt1tvjz.js');
if (runtime.slice(1624, 1647) !== 'Le=import.meta.require;') throw new Error('the bundle require moved');
if (!read('src/plugin-chain-bundle-require.ts').includes('Le=import.meta.require;')) {
  throw new Error('the boundary no longer quotes the bundle require');
}
// The store side that waits on this library: the module imports the two wrappers, wraps its dispatcher
// in the lock runner, and carries the lock options this package measured.
const store = read('extracted-v2/modules/chunk-tvdq3hrk.js');
if (!store.includes('var ct=le()')) throw new Error('the store no longer runs its entries under the lock');
if (!store.includes('var pt={realpath:!1,retries:{retries:10,minTimeout:5,maxTimeout:100},onCompromised:')) {
  throw new Error('the store lock options moved');
}
if (!store.includes('$.store lock compromised: ${l(e)}')) throw new Error('the compromised notice moved');

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-49-tests.txt');
if (full.failed !== 0 || full.tests !== 1482) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-49-family.txt');
if (family.failed !== 0 || family.tests !== 206) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const seam = summary('.audit/w45-49-seam.txt');
if (seam.failed !== 0 || seam.tests !== 6) throw new Error('the lockfile sweep is not clean');

const smokeReport = read('.audit/w45-49-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 270) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const allMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
const sharedMarkers = read('.audit/w45-49-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-49-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45LockfileCompiled.v1')) throw new Error('the shared driver did not print the W45-49 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45LockfileCompiled.v1 (${sharedMarkers.length} markers in the shared driver, ${allMarkers.length} across every driver: it takes a real lock on a real file, checks the handle is its own disposer, is refused ELOCKED while the lock is held, takes over a stale one, and warns the source's own text when a release has nothing to remove)`;

const evidence = {
  schema: 'W45LockfileEvidence.v1',
  package: 'W45-49 — the lockfile library the plugin store acquires through',
  date: '2026-10-16',
  question: 'W45-48 named the lockfile library as the store family\'s first precondition. What is it, exactly, and how much of it has to come across for the store\'s lock to be the source\'s lock?',
  answer: 'It is one module, chunk-c6qwr3kc.js, and for this slice the closure is the module\'s whole body: proper-lockfile itself (`ot` the lockfile, `ct` the adapter, `ft` the entry), the product\'s three wrappers over it (`lt`, `Wa`, `VPs`, `Um`) and the vendored dependencies proper-lockfile locks through — graceful-fs (`qe` polyfills, `$e` legacy streams, `Ye` clone, `ge` itself), retry (`ze` the operation, `Ve` the index) and signal-exit (`Xe` the signal list, `Je` the exit hook), plus the mtime-precision module `Ze`. Sixteen statements, 22,356 units, one module, computed as a closure rather than guessed: the record and the ledger hold every range, and an acorn walk of the module shows nothing outside these sixteen is referenced and nothing inside them is missing. The store\'s own side is already visible in its module — `Wa` and `Um` are its imports, `var ct=le()` wraps the dispatcher so all four `store.*` entries run under the lock, and `pt` is the option object the store passes.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  boundary: 'One name is bound rather than copied: `Le`, the bundle\'s own require (chunk-txt1tvjz.js [1624,1647) `Le=import.meta.require;`), which the vendored code calls for `fs`, `constants`, `path`, `stream` and `util`. src/plugin-chain-bundle-require.ts quotes that declaration and binds the product\'s equivalent, `createRequire(import.meta.url)`, which answers the same module objects — the very objects graceful-fs patches. Nothing else comes from outside: `T` (the bundle factory) is already exported by ./tui-bundle-runtime.ts, `E` (an error\'s code) by ./plugin-chain-fs-source.ts, `l` (an error\'s text) by ./plugin-chain-source.ts and `t` (the log sink) by ./plugin-chain-host.ts.',
  measured: [
    'The lock is a directory beside the file (`<file>.lock`), created 0755, and the file must exist first: both `lock` and `check` answer ENOENT for a missing one.',
    'The handle an acquisition answers is the release itself: `typeof handle === "function"`, `Object.getOwnPropertyNames` is `["length","name"]`, there is no `.release`, and `handle[Symbol.asyncDispose] === handle` — which is exactly `Object.assign(n,{[Symbol.asyncDispose]:n})`.',
    'A live lock is not stolen: a second acquisition with the default `retries` 0 rejects with code ELOCKED and the message `Lock file is already being held`.',
    'Retries are what makes a waiter win: with `{retries:{retries:50,minTimeout:20,maxTimeout:20}}` a second acquisition is still waiting when the holder releases inside its window, and it then holds the lock.',
    '`check` answers true while held and false once released.',
    'A stale lock is taken over: with `stale: 2000` and the lock directory\'s mtime moved a minute into the past, an acquisition succeeds and the taker is the holder.',
    'A displaced holder\'s release does not throw and says nothing — and it removes the lock path it finds, which is now the taker\'s. That is the library\'s own behaviour and the reason the store treats a takeover as a lost section.',
    'Release never throws: with no handle it is a no-op; a lock that is already gone logs `lock was no longer held at release (ERELEASED); the locked section may have run without exclusivity`; any other failure logs `lock directory could not be removed and is left to go stale: <message>`; and a rejection whose `code` cannot even be read logs `lock release rejected with a value that cannot be described`. All three are at warn level under the caller\'s label.',
    'The store\'s own lock options are the source\'s, read from its module: `{realpath:false, retries:{retries:10,minTimeout:5,maxTimeout:100}, onCompromised: …}` with the notice `$.store lock compromised: <message>`. The library supports `onCompromised`, so the next package can pass the object through unchanged.',
  ],
  behaviour_changed: [
    'The product can take, check and release the source\'s own lock — proper-lockfile over graceful-fs, with the retry schedule, the staleness takeover and the exit hook that releases a held lock when the process leaves.',
    '22,356 units left the unported set across one module, and they are the store\'s first precondition: the four `store.*` entries now wait only on the store\'s own read/write bodies, not on the lock.',
    'One binding is added rather than invented: `Le` is quoted from the runtime chunk and answered by `createRequire`, so the vendored code runs against the same module objects the bundle gave it.',
    'No product file changed behaviour on another path: the only edits outside the new copy, seam, boundary and suite are the verifier registering the plan and the shared driver printing its marker.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'the new copy: unresolved 0',
    chain_verifier: chain,
    ledger_check: 'every one of the sixteen ranges is re-read from its module, compared against the ledger and searched for in the copy; the acquire, check, release and library-entry bodies are asserted against the source text',
    boundary_check: 'the seam still quotes `Le=import.meta.require;` from chunk-txt1tvjz.js [1624,1647), and the store-side facts are asserted in chunk-tvdq3hrk.js (`var ct=le()`, the `pt` options, the compromised notice)',
    regressions: `the new lockfile suite ${seam.passed}/${seam.tests}; ${familyLine}`,
    full: fullLine,
    compiled: driverLine,
    smoke,
  },
  next_package: [
    'the store under its lock: `le()` and the `ct` wrapper (chunk-tvdq3hrk.js [15829,15840) `var ct=le()`), the option object `pt` [15456,15600), the dispatcher `JAt` [19056,19326) `var JAt=(e,r)=>ct(r)(()=>Ce(e,r))` and the four entries of `Ce` [18223,19056) with `Se` [17609,18092)',
    'the store\'s read and carry layer: `vt` (chunk-tvdq3hrk.js [17444,17609)) over `ke`/`he`/`W` with `mR`, which carries another session\'s store when the file is missing',
    'the atomic writer `vn` (imported into the store module from chunk-1t033v1j.js; `Ope` alone 2,167 units)',
    '`settings.read` (`yGo`/`hGo`) once the settings store is ported; `http.fetch` (`VQt`) once the request runner `dNo` is',
    '`ui.copy` (`wGo`/`uzo`/`dzo`) once the clipboard encoder `Sv` and the surface catalog are ported, with the `stamp` field modelled',
    '`ui.blit` (`fNs`/`kFo`/`mNs`/`bFo`), `ui.scroll` (`O5n`/`L5n`), `ui.focus` (`fzo`/`Szo`), `ui.notify` (`Dzo`/`Fzo`/`Nzo`), each measured the same way first',
    '`fs.ancestors` (`mzt`/`kNs`) and `state.get`/`state.set` (`Jf`/`KD`)',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'the notification context provider `a4n` and the clearTimer context `R`, and a streaming provider through the loader path',
    'the config/home layer behind `be` (configuration directory, home directory, `jsn`, the memoizer `po`): porting it would replace the store file layer\'s bound hook with the source\'s own `bl()`',
  ],
};
write('research/ports/W45-lockfile-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-49 **搬锁文件库',
  features: "; W45-49 ports the lockfile library the store acquires through",
  standard: '2026-10-16 W45-49 锁文件库',
  status: 'W45-49: the lockfile library.',
  runner: '## W45-49 ported the lockfile library',
};
const stripBlock = (text, mark, { toEnd = false, paragraph = false } = {}) => {
  const at = text.indexOf(mark);
  if (at < 0) return text;
  const start = text.lastIndexOf('\n', at) + 1;
  if (toEnd) return text.slice(0, start);
  const end = paragraph ? text.indexOf('\n\n', at) : text.indexOf('\n', at);
  return text.slice(0, start) + text.slice(end < 0 ? text.length : end + 1);
};

// CURRENT: the W45-49 row above the W45-48 one.
const current = stripBlock(read('research/CURRENT.md'), marks.current);
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-49 **搬锁文件库**（store 家族第一道前置：整个 chunk-c6qwr3kc.js）：16 段 **22,356 单位**、单模块，**闭包由 acorn 走查算出**（模块内被引用者不少、闭包内不缺一），含 proper-lockfile 本体（\`ot\` 锁文件 / \`ct\` 适配器 / \`ft\` 入口）+ 产品三包装（\`lt\`/\`Wa\`/\`VPs\`/\`Um\`）+ 其锁所经的 vendored 依赖：graceful-fs（\`qe\` polyfills、\`$e\` legacy-streams、\`Ye\` clone、\`ge\` 本体）、retry（\`ze\`/\`Ve\`）、signal-exit（\`Xe\`/\`Je\`）、mtime 精度 \`Ze\`。**唯一绑定**：\`Le\`（bundle 自己的 require，chunk-txt1tvjz.js [1624,1647) 原文 \`Le=import.meta.require;\`）在 \`src/plugin-chain-bundle-require.ts\` 逐字引源并以 \`createRequire(import.meta.url)\` 绑定（返回同一批模块对象，即 graceful-fs 所 patch 的对象）；\`T\`/\`E\`/\`l\`/\`t\` 均已有现成来源。**实测（先测后断言）**：锁是文件旁同名目录（0755），目标文件不存在则 acquire/check 均 ENOENT；**handle 就是 release 本身**（\`typeof handle === "function"\`、无 \`.release\`、\`handle[Symbol.asyncDispose] === handle\`）；活锁不被抢（默认 retries 0 → \`ELOCKED\` / \`Lock file is already being held\`）；**retry 才让等待者赢**（\`{retries:{retries:50,minTimeout:20,maxTimeout:20}}\` 在持有者窗口内释放后赢得锁）；\`stale:2000\` + 目录 mtime 拨回一分钟 → 接管成立；**被顶替者的 release 不抛不响，但会删掉它找到的锁目录（现在是接管者的）**——库自身行为，也是 store 视接管为丢失区段的原因；release 三条分支全部按源文告警：无句柄为 no-op、\`(ERELEASED); the locked section may have run without exclusivity\`、\`lock directory could not be removed and is left to go stale: <msg>\`、不可读 code 时 \`…cannot be described\`；store 侧 \`var ct=le()\` 把四个 \`store.*\` 条目全罩在锁下、\`pt={realpath:!1,retries:{retries:10,minTimeout:5,maxTimeout:100},onCompromised:…}\` 与 \`$.store lock compromised: …\` 通知已就位（库支持 \`onCompromised\`，下一包可原样传入）。验收：check/build/notices、新副本扫描 \`unresolved 0\`、**${chain}**、账本 16 段逐段回读+四处体文断言、边界引文与 store 侧三处事实断言、新回归 ${seam.passed}/${seam.tests}、插件链家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45LockfileCompiled.v1\`，共享 ${sharedMarkers.length} 标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [锁文件库证据](ports/W45-lockfile-evidence.json)、[store 文件层证据](ports/W45-store-path-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('the C-12 row was not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the lockfile library.
const features = read('research/FEATURES.md').replace(new RegExp(`${marks.features.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^|]*`), '');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('the interactive feature row was not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-49 ports the lockfile library the store acquires through: proper-lockfile over its vendored graceful-fs, retry and signal-exit, reached through the source's own three wrappers, with the lock a directory beside the file, the handle its own release, and a release that logs a lost lock instead of throwing. |`;
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standard.indexOf('2026-10-16 W45-48 store 文件层');
if (standardAt < 0) throw new Error('coding-standard W45-48 line not found');
const standardEntry = `2026-10-16 W45-49 锁文件库：S-1至S-7已对照。S-1（先读源）：不按"库名"猜范围，先写闭包走查器（\`.audit/w45-49-closure.mjs\`，acorn 顶层声明 + 逐语句引用/内部绑定作用域），由 store 模块的三个导入名 \`Wa\`/\`VPs\`/\`Um\` 反推闭包 → 16 语句 22,356 单位、恰为该模块全体，未解析名仅标准全局对象；同时由 store 模块自身确认消费面（\`var ct=le()\`、\`pt\` 选项、\`Wa\`/\`Um\` 为其 import）。S-2（不留半包）：一次给全（含 graceful-fs/retry/signal-exit 三个 vendored 依赖），种子模块外仅一个名字需要绑定（\`Le\`）。S-3：\`.audit/w45-49-probe.ts\` 与 \`-timing.ts\` 先实测（handle 形状、ELOCKED 文本、retry 窗口内赢得锁、stale 接管、被顶替者删锁、release 三分支文本）再写断言；断言以字面值与源文告警文本为准，含一处"被顶替者 release 会删掉接管者锁目录"的库自身行为，注明为实测。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器/打包冒烟/${drivers.length} 个编译驱动并解析输出，\`ported\` 由 ledger 回读并逐段回源比长度与内容，\`Le\` 引文与 store 侧三处事实回源断言。S-5/S-6：seam 只做命名、类型收窄（handle 类型按实测改为"可调用自身 + asyncDispose 指向自身"）与三个包装，无死导出；不重复搬 \`T\`/\`E\`/\`l\`/\`t\` 已有副本。S-7：store 四条目与其读写/携带层（\`le\`/\`ct\`/\`pt\`/\`JAt\`/\`Ce\`/\`Se\`/\`vt\`）、原子写 \`vn\`/\`Ope\`、\`settings.read\`、\`http.fetch\`、\`ui.copy\`（含 \`stamp\`）、\`ui.blit\`/\`scroll\`/\`focus\`/\`notify\`、\`fs.ancestors\`、\`state.*\`、Q-086、通知 Provider、config/home 层写入 next_package。验收：check/build/notices、扫描 unresolved 0、${chain}、账本与边界自证、回归 ${seam.passed}/${seam.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-49 paragraph above the W45-48 one.
const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf("W45-48: the `$` store's file layer");
if (statusAt < 0) throw new Error('STATUS W45-48 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-49: the lockfile library. W45-48 named it the store family's first precondition, and this package took it whole: chunk-c6qwr3kc.js is one module whose closure for this slice is its entire body — proper-lockfile, the product's three wrappers over it, and the vendored dependencies the lock runs through (graceful-fs, retry, signal-exit). Sixteen statements, 22,356 units, and the closure was computed rather than guessed: an acorn walk seeded from the store's own imports shows nothing outside those sixteen is referenced. One name is bound instead of copied — \`Le\`, the bundle's require, quoted from the runtime chunk and answered by \`createRequire\`. Everything was measured before it was asserted: the handle is its own release with \`Symbol.asyncDispose\` attached, a live lock is refused ELOCKED, a waiter wins only because of the retry schedule, a stale lock is taken over, and a release with nothing to remove is logged rather than thrown. Two first-version slips were caught by the artifacts: the driver's log helper yields messages without the level prefix, and the seam first typed the handle with a \`release\` property the library does not have. Evidence: \`research/ports/W45-lockfile-evidence.json\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-49 section.
const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-49 ported the lockfile library (2026-10-16)

The store's first precondition, taken whole: chunk-c6qwr3kc.js is one module, and for this slice its
closure is its entire body — sixteen statements, 22,356 units, all of one chunk. That includes what
proper-lockfile locks through: graceful-fs (its polyfills, legacy streams, clone and the fs itself),
retry (the operation and its timeouts) and signal-exit (the signal list and the exit hook that
releases a lock the process still holds).

The closure was computed, not guessed. \`.audit/w45-49-closure.mjs\` walks the module with acorn from
the names the store imports and prints what is reachable: sixteen statements, five imports, and only
standard globals unresolved — so nothing inside is missing and nothing outside is referenced. The
plan locates each block by the needle the module spells it with, and the record re-reads every range.

One name is bound rather than copied: \`Le\`, the bundle's own require
(chunk-txt1tvjz.js [1624,1647) \`Le=import.meta.require;\`), which the vendored code calls for \`fs\`,
\`constants\`, \`path\`, \`stream\` and \`util\`. src/plugin-chain-bundle-require.ts quotes that
declaration and binds \`createRequire(import.meta.url)\`, which answers the same module objects —
including the fs object graceful-fs patches.

Measured before asserted: the lock is a directory beside the file; the handle is the release itself
with \`Symbol.asyncDispose\` pointing back at it; a live lock is refused \`ELOCKED\`; a waiter wins only
inside the retry schedule; a stale lock is taken over and the displaced holder's release removes the
lock path it finds (the library's own behaviour, and why the store treats a takeover as a lost
section); and the release wrapper describes whatever it is handed at warn level, never throwing.

Verified: check/build/notices, the new copy \`unresolved 0\`, ${chain}, the ledger and boundary checks,
the new suite ${seam.passed}/${seam.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers
(the shared driver now also prints \`W45LockfileCompiled.v1\`), and the packaged smoke (${smoke}).
Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: the store under its lock — \`le()\` and the \`ct\` wrapper, the option object \`pt\` (whose
\`onCompromised\` this library supports as-is), the dispatcher \`JAt\`, and the four entries of \`Ce\`
with \`Se\` — then the read/carry layer \`vt\` and the atomic writer \`vn\`.
`);

const rows = [
  ['2026-10-17T00:20:00Z', 'package', 'W45-49 搬锁文件库（store 家族第一道前置；16 段 22,356 单位，闭包由 acorn 走查算出）',
    'proper-lockfile(ot/ct/ft) + 产品三包装(lt/Wa/VPs/Um) + vendored graceful-fs(qe/$e/Ye/ge)、retry(ze/Ve)、signal-exit(Xe/Je)、mtime 精度 Ze 全部成为产品面；Le 以 createRequire 绑定',
    'chunk-c6qwr3kc.js qe [758,4746)、$e [4746,6264)、Ye [6264,6628)、ge [6628,11842)、ze [11842,14117)、Ve [14117,15279)、Xe [15279,15464)、Je [15464,17546)、Ze [17546,18065)、ot [18065,21324)、ct [21324,22042)、ft [22042,22559)、lt [22559,22585)、Wa [22585,22685)、VPs [22685,22726)、Um [22726,23114)；绑定引文 chunk-txt1tvjz.js [1624,1647)',
    `实测（.audit/w45-49-probe.ts、-timing.ts 与 test/plugin-chain-lockfile.test.ts + .audit/w45-24-compiled.mjs）：handle 是 release 本身且 asyncDispose 指向自身、活锁 ELOCKED、retry 窗口内等待者赢得锁、stale 接管、被顶替者 release 删掉接管者锁目录、release 三分支告警文本；6/6 通过`],
  ['2026-10-17T00:26:00Z', 'finding', 'W45-49 闭包走查显示该模块对本切片是"全取"：16 语句覆盖模块全体，未解析名仅标准全局',
    'W45-46/W45-48 的手抄区间与正则枚举在本文件上会重叠（43,779>23,134），故本包先写 acorn 顶层语句表（.audit/w45-49-top.mjs）与闭包走查器，再据实生成计划',
    '计划改用 needle 定位（与 W45-48 同规），生成器输出 blocks 16 / missing 0 / units 22356；记录脚本逐段回读并与副本内容比对',
    'check/build 通过；链校验器 48 plans 通过（本包 16 段 / 22,356 单位）；span-scan total 0'],
  ['2026-10-17T00:30:00Z', 'finding', 'W45-49 两处首版错误被产物当场抓住（记录脚本断言 + 驱动断言）',
    '① 编译驱动的 logs() 只取 message 不带 level 前缀，首版期望串多写 `warn: ` → 按实际修正；② seam 首版把 handle 类型写成带 .release 的对象，实测为"可调用函数 + Symbol.asyncDispose 指向自身" → 类型与注释按实测改写',
    '两处修正均以实测为准，未改产品行为；类型改写后 tsc --noEmit 与 build 均通过',
    '回归 6/6、家族 206/206、全量 1482/1482 通过；共享驱动 23 标记全出（新增 W45LockfileCompiled.v1）'],
  ['2026-10-17T00:34:00Z', 'verification', `W45-49 验收：新副本扫描 unresolved 0、账本 16 段逐段回读、边界与 store 侧事实回源自证、${chain}、回归 ${seam.passed}/${seam.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '锁文件库收束，下一包转 store 本体（le/ct/pt/JAt/Ce/Se）',
    `check/build/notices；扫描 unresolved 0；${chain}；账本 16 段逐段回源比长度与内容；Le 引文与 store 侧 var ct=le()/pt/compromised 通知三处回源断言；回归 ${seam.passed}/${seam.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45LockfileCompiled.v1，共享 ${sharedMarkers.length} 标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-49 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-49 acceptance (2026-10-16)

- [x] **The closure was computed, not guessed.** An acorn walk from the store's own imports: sixteen statements, five imports, standard globals only.
- [x] **The whole body came across.** 22,356 units of one module, including the vendored graceful-fs, retry and signal-exit the lock runs through; chain verifier (${chain}) and \`unresolved 0\`.
- [x] **One name bound, none invented.** \`Le\` quoted from the runtime chunk and answered by \`createRequire\`; \`T\`, \`E\`, \`l\` and \`t\` reuse copies the product already holds.
- [x] **Everything measured before it was asserted.** The handle's shape, ELOCKED, the retry window, the stale takeover, the displaced release, and all three release-warning texts.
- [x] **The store side is recorded.** \`var ct=le()\`, the \`pt\` options with their \`onCompromised\` notice, and the fact that the library supports it — the next package passes the object through.
- [x] **Two first-version slips caught by the artifacts.** The driver's log prefix, and the seam's handle type.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\`, ${chain}, ledger and boundary checks, new suite ${seam.passed}/${seam.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
