// Write the W45-46 package record from the artifacts themselves: the five filesystem entries, the
// fifteen copied bodies behind them, and the two dependencies this package bounds instead of carrying.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 369, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 141, `validation ${identity.validation.files}`);
expect(identity.build.files === 256, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 46) throw new Error('the chain verifier did not pass 46 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const copy = verifier.files.find((file) => file.product.endsWith('plugin-chain-fs-source.ts'));
if (!copy || copy.blocks !== 15) throw new Error('the fs copy is not the 15-block one');

const ledger = JSON.parse(read('src/plugin-chain-fs-source-blocks.json'));
if (ledger.blocks.length !== 15) throw new Error('the fs ledger does not hold fifteen blocks');
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 3003) throw new Error(`the ledger holds ${units} units`);
const scan = execFileSync(process.execPath, ['scripts/source-undeclared-scan.mjs', 'src/plugin-chain-fs-source.ts'], { encoding: 'utf8' });
if (!/unresolved 0/.test(scan)) throw new Error('the fs copy has unresolved names');

// The entries are named from the module, not from memory: each of the five keys is looked up in the
// table's own text, and so are the two neighbours this package leaves.
const sfn = read('extracted-v2/modules/chunk-sfn1dbxq.js');
const entries = {
  'fs.read': '"fs.read":hzt',
  'fs.write': '"fs.write":_zt',
  'fs.list': '"fs.list":gzt',
  'fs.exists': '"fs.exists":{check:XAt,raise:IE,run:(n,r)=>HE({event:"exists",path:n.path},r.plugin,r.cwd).then((s)=>s===!0)}',
  'fs.stat': '"fs.stat":yzt',
};
for (const [name, text] of Object.entries(entries)) {
  if (!sfn.includes(text)) throw new Error(`the table entry ${name} is not the text this record names`);
}
if (!sfn.includes('"fs.ancestors":mzt')) throw new Error('the fs.ancestors entry beside these was not found');
if (!sfn.includes('"store.get":{check:ppr,run:')) throw new Error('the store family beside these was not found');
const { fsCallTable } = await import('../dist/plugin-chain-fs.js');
const fsKeys = Object.keys(fsCallTable()).sort().join(',');
if (fsKeys !== 'fs.exists,fs.list,fs.read,fs.stat,fs.write') throw new Error(`the built fs table binds ${fsKeys}`);
const leftOut = 'the entries this package leaves in the same literal are named from the module and asserted unbound: `fs.ancestors` (`mzt` over the check `kNs`) walks the roots the tool context holds (`fzt`, `pzt`, `RCn`, `cLo`), which this product does not carry, and the four `store.*` entries bottom out in the per-plugin store `NDe` through `le`';

// The two dependencies are bounded, not carried: the record re-reads each quoted body from its module
// and asserts the seam still holds that text, so the boundary cannot drift from the source.
const boundaries = read('src/plugin-chain-fs-boundaries.ts');
const n3ykh = read('extracted-v2/modules/chunk-n3ykh62m.js');
const neBody = n3ykh.slice(241513, 241740);
if (!boundaries.includes(neBody)) throw new Error('the seam no longer quotes `$ne` verbatim');
const xaes = read('extracted-v2/modules/chunk-xaes9ysz.js');
const oBody = xaes.slice(3527, 3565);
const sBody = xaes.slice(3287, 3493);
if (!boundaries.includes(oBody)) throw new Error('the seam no longer quotes `O` verbatim');
if (!boundaries.includes(sBody)) throw new Error('the seam no longer quotes the platform descriptor `s` verbatim');
const copyText = read('src/plugin-chain-fs-source.ts');
if (!copyText.includes("import { $ne, O } from './plugin-chain-fs-boundaries.js';")) throw new Error('the copy does not import the two boundaries');
const boundary = '`$ne`, the location policy (chunk-n3ykh62m.js [241513,241740) 227 units), and `O`, the platform (chunk-xaes9ysz.js [3527,3565) 38 units over the descriptor `s` [3287,3493)), are the two names inside the copied `HE` this package does not carry: their closures live in chunk-ae84tp6z.js, chunk-4bw62nzm.js and the unported WSL detector, so the seam in src/plugin-chain-fs-boundaries.ts quotes each verbatim, names the unported reach, and binds a hook — the unbound defaults answer "reached" and the host platform, and the record re-reads the quoted text from the modules';
const shared = read('src/plugin-chain-source.ts');
if (!/export \{[^}]*\bl\b[^}]*\}/.test(shared)) throw new Error('the chain source no longer exports the error text helper');
if (!shared.includes('function l(n){return n instanceof Error?n.message:String(n)}')) throw new Error('the chain source no longer carries the error text body');
const host = read('src/plugin-chain-host.ts');
if (!/export (function|const) se\b/.test(host) || !/export (function|const) t\b/.test(host)) throw new Error('the host no longer exports the cwd and the log sink');

// Each copied body's range is re-read from the module the ledger names.
for (const block of ledger.blocks) {
  const text = read(`extracted-v2/modules/${block.module}`);
  const body = text.slice(block.range[0], block.range[1]);
  if (body.length !== block.units) throw new Error(`${block.module} ${block.range} is not ${block.units} units`);
}

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-46-tests.txt');
if (full.failed !== 0 || full.tests !== 1465) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-46-family.txt');
if (family.failed !== 0 || family.tests !== 189) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const seam = summary('.audit/w45-46-seam.txt');
if (seam.failed !== 0 || seam.tests !== 14) throw new Error('the fs sweep is not clean');

const smokeReport = read('.audit/w45-46-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 264) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const allMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
const sharedMarkers = read('.audit/w45-46-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-46-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45FsCompiled.v1')) throw new Error('the shared driver did not print the W45-46 marker');
if (expectedMarkers.length !== sharedMarkers.length - 0) throw new Error('the marker list is not the captured one');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45FsCompiled.v1 (${sharedMarkers.length} markers in the shared driver, ${allMarkers.length} across every driver: it reads, writes, lists, stats and probes for existence through the built table, walks a link to its target, refuses a location through the bound policy and asks the bound platform once)`;

const evidence = {
  schema: 'W45FsEvidence.v1',
  package: 'W45-46 — the `$` table\'s filesystem floor: five entries, one body (`HE`) and fifteen blocks',
  date: '2026-10-16',
  question: 'W45-45 closed the clock and env floors and queued the `fs.*` and `store.*` families. Is the filesystem family one package, and does its body stand alone?',
  answer: 'The filesystem family is one body and five entries: `fs.read` (`hzt`), `fs.write` (`_zt`), `fs.list` (`gzt`), `fs.exists` (an inline entry object over `XAt`/`IE`) and `fs.stat` (`yzt`), all of which run `HE` — the 1,819-unit body that resolves the path against the caller\'s cwd, refuses a location the policy refuses, and then reads (with a 4 MiB limit and a base64 form), writes, probes, stats (following a link whose target is reachable) or lists. Fifteen blocks, 3,003 units of three modules. Two names inside `HE` are not carried: `$ne`, the location policy, and `O`, the platform — both are quoted verbatim and bounded in src/plugin-chain-fs-boundaries.ts, with the unported reach named, rather than approximated. `fs.ancestors` is the family\'s other entry and is not ready: it walks the roots the tool context holds. The four `store.*` entries bottom out in the per-plugin store `NDe` through `le`, which is the next package.',
  entries: Object.entries(entries).map(([name, text]) => ({ name, text })),
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  boundaries: boundary,
  leftOut,
  measured: [
    '`fs.read` answers the file text, and the bytes form is an object carrying `base64` (`return e.as==="bytes"?{base64:V.toString("base64")}:V.toString("utf8")`) — the first version of the test read it as a bare string, which is how the shape got pinned.',
    'The read refuses a file over `cGe` (4 MiB) with the byte count in the text (`the file is over the 4194304-byte limit`), and a file that fits is read whole through the 64 KiB chunk loop — asserted with a 200,000-byte file.',
    '`fs.write` makes the missing directories, writes the whole file (a second write of shorter text leaves no tail), and logs `$.fs.write (${plugin}): ${path} (${bytes} bytes)` to the sink — read back from the chain records, not assumed from the source.',
    'The write refuses text over `C3` (4 MiB) with `${bytes} bytes is over the 4194304-byte limit` **before** touching the disk: the test asserts the file does not exist after the refusal.',
    '`HE` resolves the path against the caller\'s `cwd`, and with none against `se()` — the process cwd the host binds (W45-44). The first version of the test moved `process.cwd()` and failed, which is how the port\'s own boundary got confirmed: the source reads its process cwd live, and this product binds it.',
    '`fs.exists` answers a boolean and never throws: an existing path true, a missing path false, and a path below a file false as well (the stat\'s `ENOTDIR` becomes false, not an error).',
    '`fs.list` sorts by name and reports `kind` through `uGe` (file / dir / other), so a symbolic link is `other` with `isLink` true, a directory carries size 0, and a file carries its size and mtime.',
    '`fs.stat` reports the entry and follows a link only when the target is reachable: a link to a file answers the target\'s kind and size with `isLink: true`, `realPath` appears only with `resolve: true`, and a broken link answers the link itself with no `realPath`.',
    'The location policy is the boundary\'s: with a policy bound the call is refused with the source\'s own text (`a network location is not reached from here`), the refusal reaches the log line, and with the policy unbound the same call reaches the filesystem and fails with `ENOENT` instead.',
    'The platform is asked exactly once per read: `O()` is called on the read path to choose `"r"` on Windows against `O_RDONLY|O_NONBLOCK` elsewhere, which the test asserts by counting calls through the bound hook.',
    'The three entry checks answer the source\'s texts (`takes a path`, `as is "text" or "bytes"`, `resolve is true or false`), and both `as` and `resolve` are named by their checks, so omitting either is refused too.',
    'A check runs only when a handler is in the chain: with none, the table short-circuits to `run` (W45-20\'s `Hze`), so a call with a bad path reaches `path.resolve` and throws its own `TypeError` — which the first version of the test measured, and why the refusal tests install a passthrough handler.',
  ],
  behaviour_changed: [
    'A plugin can read, write, list, stat and probe a file through the `$` names the source gives them, with the source\'s own argument checks, byte limits, log lines and refusal texts.',
    '3,003 units left the unported set across three modules, and the `fs.*` family of the table is one body: four of the five entries are named vars and the fifth is the inline existence entry, ported as its own arrow.',
    'The location policy and the platform are recorded as bounded, not approximated: the unported reach (`_4`, `lYe`, `gin`, `BH`, `ks`, `oie`, `qa`, `ree`; the WSL detector `f`) is named in the seam, in the evidence and in next_package.',
    '`fs.ancestors` and the four `store.*` entries are recorded as not ready with their exact reach, so the next package does not start them blind.',
    'No product file changed behaviour on another path: the only edits outside the new copy, seam and boundary module are the verifier registering the plan and the shared driver printing its marker.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'the new copy: unresolved 0',
    chain_verifier: chain,
    entries_check: 'the record re-reads all five entry texts and the two neighbours (`fs.ancestors`, `store.get`) in the table itself, and asserts the built table binds exactly the five names',
    ledger_check: 'every copied range is re-read from its module and its length compared against the ledger',
    boundary_check: 'the seam still quotes `$ne`, `O` and the descriptor `s` verbatim from their modules, and the copy still imports the two boundaries',
    regressions: `the new fs suite ${seam.passed}/${seam.tests}; ${familyLine}`,
    full: fullLine,
    compiled: driverLine,
    smoke,
  },
  next_package: [
    'the `store.*` family: `store.get`/`store.set`/`store.delete`/`store.keys` (`ppr`/`xNs`/`JAt`/`fW`) over the memoized handle `ct = le()` and the per-plugin store `NDe`',
    '`fs.ancestors` (`mzt`, chunk-sfn1dbxq.js [1849518,1849976) 458 units) over `kNs` once the tool-context roots (`fzt`, `pzt`, `RCn`, `cLo`) are ported',
    'the platform descriptor `f` with its WSL refinement (chunk-xaes9ysz.js [987,3287)), which would replace the platform boundary with the source\'s own `s()`',
    'the location policy `$ne` and its closure (`_4` in chunk-4bw62nzm.js; `lYe`, `gin`, `BH`, `ks`, `oie`, `qa`, `ree` in chunk-ae84tp6z.js), which would replace the policy boundary',
    '`state.get`/`state.set` (`Pur`/`Our`/`Iur`/`$ss`/`Hur`) once the scope accessors `Jf`/`KD` are ported — the same layer Q-086 names',
    '`settings.read` (`yGo` + `hGo` over `J9`/`ZH`/`ft`/`fe`) and `http.fetch` (`VQt`), the two entries beside the clock keys',
    'the remaining `ui.*` entries: `ui.selection` (`u2t` over `bI()?.selection`), `ui.scroll` (`O5n`/`L5n`), `ui.focus` (`fzo`/`Szo`), `ui.copy` (`wGo`/`uzo`/`dzo`), `ui.notify` (`Dzo`/`Fzo`/`Nzo`), `ui.blit` (`fNs`/`kFo`/`mNs`)',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'the notification context provider `a4n` (chunk-356hrhz3.js [1453,1607)) and the clearTimer context `R` [1431,1432)',
    'the registry fields the source\'s literal carries but no ported body reads yet (the hook registry, the marketplaces, the command-producer memos)',
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
    'the helpers/config store behind `BEo` and the load pipeline behind `zLr`/`sc`: both are subsystems in their own right, not packages (W45-43 recon)',
  ],
};
write('research/ports/W45-fs-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-46 **搬 `$` 表文件系统 floor',
  features: '; W45-46 binds the `$` filesystem floor',
  standard: '2026-10-16 W45-46 文件系统 floor',
  status: 'W45-46: the `$` filesystem floor.',
  runner: '## W45-46 ported the `$` filesystem floor',
};
const stripBlock = (text, mark, { toEnd = false, paragraph = false } = {}) => {
  const at = text.indexOf(mark);
  if (at < 0) return text;
  const start = text.lastIndexOf('\n', at) + 1;
  if (toEnd) return text.slice(0, start);
  const end = paragraph ? text.indexOf('\n\n', at) : text.indexOf('\n', at);
  return text.slice(0, start) + text.slice(end < 0 ? text.length : end + 1);
};

// CURRENT: the W45-46 row above the W45-45 one.
const current = stripBlock(read('research/CURRENT.md'), marks.current);
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-46 **搬 \`$\` 表文件系统 floor（五条目）**（新副本 15 段 3,003 单位，三模块）：\`fs.read\`（\`hzt\`）、\`fs.write\`（\`_zt\`）、\`fs.list\`（\`gzt\`）、\`fs.exists\`（表内内联条目对象，含 \`check:XAt,raise:IE\`）、\`fs.stat\`（\`yzt\`），五者全部走同一主体 \`HE\`（1,819 单位）：按 caller 的 cwd 解析路径 → 位置策略检查 → 读（64 KiB 循环、\`cGe\`=4 MiB 上限、\`as:"bytes"\` 回 \`{base64}\`）/写（\`C3\`=4 MiB 上限、先建目录、写前拒绝）/存在性（假即 \`false\`，不抛）/stat（链接目标可达则跟随，\`resolve:true\` 才有 \`realPath\`）/列表（按名排序，\`uGe\` 出 file/dir/other）。**两条依赖只做有界绑定、不近似**：\`$ne\`（位置策略，chunk-n3ykh62m.js [241513,241740) 227 单位）与 \`O\`（平台，chunk-xaes9ysz.js [3527,3565) 38 单位，源于描述符 \`s\` [3287,3493)）在 \`plugin-chain-fs-boundaries.ts\` 逐字引用原文、写明未搬闭包（\`_4\`、\`lYe\`、\`gin\`、\`BH\`、\`ks\`、\`oie\`、\`qa\`、\`ree\`；WSL 检测 \`f\`）并留可绑定钩子，记录脚本回源比对引文防漂移。**实测**（先量后断）：\`as:"bytes"\` 回对象 \`{base64}\`（测试首版当字符串读，由此钉住形状）；读上限与写入上限的拒绝文本各含实际字节数，且**被拒的写不落盘**（断言文件不存在）；写入日志 \`$.fs.write (plugin): path (N bytes)\` 从链记录读回；无 caller cwd 时用 \`se()\`——测试首版改 \`process.cwd()\` 失败，由此确认"产品把进程 cwd 绑定（W45-44）而源是实时读"；\`fs.list\` 链接为 \`other\`+\`isLink:true\`、目录 size 0；\`fs.stat\` 断链只答链接自身且无 \`realPath\`；策略绑定时拒绝文本与日志行都带源文 \`a network location is not reached from here\`，解绑后同一调用落到文件系统得 \`ENOENT\`；平台每次读只问一次（计数断言）；三条 check 的拒绝文本读回（\`as\` 与 \`resolve\` 均**必填**）；check 仅在链上有 handler 时跑——首版测试因此量到 \`path.resolve\` 的 TypeError，故拒绝用例安装 passthrough handler。**未就绪项写明**：\`fs.ancestors\`（\`mzt\` 458 单位 + \`kNs\` 492 单位）走工具上下文根 \`fzt\`/\`pzt\`/\`RCn\`/\`cLo\`，四条目 \`store.*\` 经 \`ct = le()\` 落在 \`NDe\`，均记录未搬原因。验收：check/build/notices、新副本扫描 \`unresolved 0\`、**${chain}**、条目与两邻居自证、账本区间逐段回读、边界引文回源自证、新回归 ${seam.passed}/${seam.tests}、插件链家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45FsCompiled.v1\`，共享 ${sharedMarkers.length} / 全体 ${allMarkers.length} 标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [文件系统证据](ports/W45-fs-evidence.json)、[时钟与环境证据](ports/W45-clock-env-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('the C-12 row was not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the filesystem floor.
const features = read('research/FEATURES.md').replace(new RegExp(`${marks.features.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^|]*`), '');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('the interactive feature row was not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-46 binds the \`$\` filesystem floor: a plugin reads (text or base64 bytes) and writes files under the source's own 4 MiB limits, lists a directory, probes for existence and stats an entry, with the location policy and the platform bounded as host hooks. |`;
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standard.indexOf('2026-10-16 W45-45 时钟与环境 floor');
if (standardAt < 0) throw new Error('coding-standard W45-45 line not found');
const standardEntry = `2026-10-16 W45-46 文件系统 floor：S-1至S-7已对照。S-1（先读源）：先按模块自身的导入表把 \`fs.*\` 五条目的主体逐名解出（同名压缩名跨 chunk 冲突，故一律在**读它的那个模块**里解析），得 \`HE\` 1,819 单位 + 检查 \`XAt\`/\`ANs\`/\`CNs\` + 描述符 \`IE\` + 局部 \`uGe\`/\`azt\`/\`lzt\`/\`C3\`/\`cGe\`/\`E\`；同时判定 \`fs.ancestors\`（\`mzt\`+\`kNs\`）与 \`store.*\` 未就绪并写出各自阻塞点。S-2（不留半包）：15 段一次给全 + 五表项包装 + 直调包装；\`fs.ancestors\`、\`store.*\` 与两条边界写明在 seam 头注、\`leftOut\` 与 next_package。S-3：回归先依赖实测量出的取值（\`{base64}\` 形状、两条 4 MiB 上限、被拒写不落盘、写入日志、\`se()\` 回退、列表排序与 kind、断链 stat、策略绑定/解绑两种结局、平台只问一次、三条拒绝文本、check 仅在链上有 handler 时跑），断言字面值与源文拒绝文本；两处首版错误（把 \`{base64}\` 当字符串、改 \`process.cwd()\` 期望 \`se()\` 跟着动）都被断言抓住并据此确认契约；第三处（bad path 直取 floor 抛 \`path.resolve\` 的 TypeError）确认了 check 与 handler 的关系。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器/打包冒烟/${drivers.length} 个编译驱动并解析输出，\`ported\` 由 ledger 读回并逐段回源比对长度，边界由回源比对引文自证。S-5/S-6：seam 只做命名与类型收窄（\`FsCallCaller\` 补 \`cwd\`，\`FsCallEntry\` 为 \`HostCallBottom & {raise}\`），无死导出；不重复搬 \`l\`/\`He\`/\`t\`/\`se\`（分别来自 W45 链源与主机 seam）。S-7：\`store.*\`、\`fs.ancestors\`、平台描述符 \`f\`、位置策略 \`$ne\` 闭包、\`state.*\`、\`settings.read\`/\`http.fetch\`、余下 \`ui.*\`、Q-086、通知 Provider、helpers/config store 与装载管线写入 next_package。验收：check/build/notices、扫描 unresolved 0、${chain}、条目与两邻居自证、账本回读、边界引文自证、回归 ${seam.passed}/${seam.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-46 paragraph above the W45-45 one.
const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf('W45-45: the `$` clock and env floors.');
if (statusAt < 0) throw new Error('STATUS W45-45 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-46: the \`$\` filesystem floor. The family turned out to be one body with five entries: \`fs.read\` (\`hzt\`), \`fs.write\` (\`_zt\`), \`fs.list\` (\`gzt\`), \`fs.exists\` (the one inline entry object, ported as its own arrow) and \`fs.stat\` (\`yzt\`) all run \`HE\` — 1,819 units that resolve the path against the caller's cwd, check the location policy, and then read (64 KiB chunks, a 4 MiB limit, base64 for \`as:"bytes"\`), write (a 4 MiB limit refused before the disk is touched, directories made first), probe, stat (following a link whose target is reachable, \`realPath\` only on request) or list (sorted, with kinds). Two names inside that body are not carried: \`$ne\`, the location policy, and \`O\`, the platform. Rather than approximate them, the seam quotes each verbatim from its module, names the unported closure, and binds a hook — and the record re-reads the quoted text so the boundary cannot drift. Everything was measured before it was asserted, and three first-version mistakes were caught by the assertions: the bytes form is an object carrying \`base64\` rather than a string, the port reads its process cwd through the bound \`se()\` rather than live \`process.cwd()\`, and an entry check runs only when a handler is in the chain, so a bad path with no handler reaches \`path.resolve\` and throws its own \`TypeError\`. \`fs.ancestors\` and the four \`store.*\` entries are recorded as not ready with their exact reach. Evidence: \`research/ports/W45-fs-evidence.json\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-46 section.
const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-46 ported the \`$\` filesystem floor (2026-10-16)

Five more entries of the \`$\` table are product surface, copied verbatim into
src/plugin-chain-fs-source.ts (15 blocks, 3,003 units of three modules) behind
src/plugin-chain-fs.ts: \`fs.read\` (\`hzt\`), \`fs.write\` (\`_zt\`), \`fs.list\` (\`gzt\`), \`fs.exists\` (the
one inline entry object, ported as its own arrow) and \`fs.stat\` (\`yzt\`). All five run one body,
\`HE\` (1,819 units), which resolves the path against the caller's cwd or the process's, checks the
location policy, and then reads, writes, probes, stats or lists.

What the ported body says, each measured: the read walks the file in 64 KiB chunks, refuses past
\`cGe\` (4 MiB, the byte count in the text) and answers \`{ base64 }\` for \`as:"bytes"\` against plain
UTF-8 otherwise; the write refuses text past \`C3\` (4 MiB) **before** touching the disk, makes the
missing directories, and logs \`$.fs.write (plugin): path (N bytes)\`; \`exists\` is a stat that answers
false instead of throwing; \`stat\` follows a symbolic link only when its target is a reachable
location, reporting the target's kind and size with \`isLink\` true and \`realPath\` only when the
caller asked to resolve; and \`list\` sorts by name with kinds through \`uGe\`, so a link is \`other\`.

Two names inside \`HE\` are not carried, and they are the package's one deliberate boundary.
\`$ne\` (chunk-n3ykh62m.js [241513,241740), 227 units) is the containment policy: the reachable root
(\`_4\`), that root's segments (\`lYe\`), the network and volume classification (\`gin\`, \`BH\`, \`ks\`,
\`qa\`, \`ree\`, \`oie\`) — none of it ported. \`O\` (chunk-xaes9ysz.js [3527,3565), 38 units) is the
platform, over the descriptor \`s\` [3287,3493) whose WSL detector is not ported either. Both are
quoted verbatim in src/plugin-chain-fs-boundaries.ts with their unported reach named, and bound as
hooks whose unbound defaults are "reached" and the host platform; the record re-reads each quoted
body from its module, so the boundary cannot drift from the source.

\`fs.ancestors\` (\`mzt\` 458 units over the check \`kNs\` 492 units) is the family's other entry and is
not ready: it walks the roots the tool context holds (\`fzt\`, \`pzt\`, \`RCn\`, \`cLo\`). The four
\`store.*\` entries bottom out in the per-plugin store \`NDe\` through the memoized handle \`ct = le()\`.

Verified: check/build/notices, the new copy \`unresolved 0\`, ${chain}, the entry, ledger and boundary
checks, the new suite ${seam.passed}/${seam.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled
drivers (the shared driver now also prints \`W45FsCompiled.v1\`), and the packaged smoke
(${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself, which
asserts the counts).

Next: the \`store.*\` family over \`NDe\`, then \`fs.ancestors\` once the tool-context roots are ported,
then the remaining \`ui.*\` entries; \`state.*\` waits on the scope accessors.
`);

const rows = [
  ['2026-10-16T22:05:00Z', 'package', 'W45-46 搬 `$` 表文件系统 floor 五条目（新副本 15 段 3,003 单位，三模块；seam 无新搬运块）',
    'fs.read / fs.write / fs.list / fs.exists / fs.stat 成为产品面，五者共用主体 HE；两条未搬依赖 $ne（位置策略）与 O（平台）改为有界绑定并逐字引文；fs.ancestors 与 store.* 记录为未就绪',
    'chunk-sfn1dbxq.js [2353753,2353766) fs.read、[2353767,2353781) fs.write、[2353782,2353795) fs.list、[2353796,2353905) fs.exists、[2353906,2353919) fs.stat；体 HE [1847454,1849273)、IE [1839344,1839395)、uGe [1846886,1846947)、azt [1847244,1847408)、lzt [1847408,1847421)、C3 [1847422,1847436)、cGe [1847437,1847447)、gzt [1849977,1850062)、hzt [1850063,1850156)、yzt [1850157,1850260)、_zt [1850261,1850448)、chunk-tvdq3hrk.js XAt [12056,12143)/ANs [12143,12249)/CNs [12249,12354)、chunk-886tf6ja.js E [4814,4913)',
    `实测（test/plugin-chain-fs.test.ts + .audit/w45-24-compiled.mjs）：base64 形状、两条 4 MiB 上限、被拒写不落盘、写入日志回读、se() 回退、列表排序与 kind、断链 stat、策略绑定/解绑两种结局、平台只问一次、三条拒绝文本、check 仅在链上有 handler 时跑；14/14 通过`],
  ['2026-10-16T22:12:00Z', 'finding', 'W45-46 判定 fs.ancestors 与 store.* 未就绪并写明阻塞点',
    'mzt 走 Ee() 之外的 Pme/pGe/RCn/cLo/fzt/pzt（工具上下文与 held docs 层），产品无这些名；store.* 的四个 run 经 JAt=(e,r)=>ct(r) 与 fW=e.knownArgs.get(n) 落在 le() 记忆化的 NDe（每插件磁盘 store），该体尚未搬',
    '不搬；把两族的主体、区间与阻塞点写入 evidence.next_package 首两条、seam 头注与 leftOut；同 literal 的 fs.ancestors 邻居在记录里回读自证',
    '同表五条目文本与两邻居（fs.ancestors、store.get）由表内文本自证；编译后表键恰为五名'],
  ['2026-10-16T22:18:00Z', 'finding', 'W45-46 三处首版错误被断言抓住，据此确认三条契约',
    '① 把 as:"bytes" 的答案当裸字符串读 → 实际是 {base64}；② 改 process.cwd() 期望无 caller cwd 的路径跟着动 → 失败，源是实时读而产品把 se() 绑定（W45-44）；③ 无 handler 时 bad path 的 check 不跑，调用直取 floor 并在 path.resolve 抛 TypeError',
    '① 断言改为 deepEqual {base64} 并在 seam 注释写明形状；② 测试改为 bindPluginProcessIdentity({cwd:root}) 并断言 se()===root；③ 拒绝用例安装 passthrough handler，另加"check 仅在链上有 handler 时跑"一条',
    '回归 14/14、家族 189/189、全量 1465/1465 通过；驱动 20 标记全出'],
  ['2026-10-16T22:24:00Z', 'verification', `W45-46 验收：新副本扫描 unresolved 0、条目与两邻居自证、账本逐段回读、边界引文回源自证、${chain}、回归 ${seam.passed}/${seam.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '文件系统 floor 收束，下一包转 store.*（NDe）与 fs.ancestors',
    `check/build/notices；扫描 unresolved 0；${chain}；条目五段与两邻居回读源文 + 编译后表键自证；账本 15 段逐段回源比长度；边界（$ne/O/s 三段引文回源比对 + 副本 import）；新回归 ${seam.passed}/${seam.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45FsCompiled.v1，共享 ${sharedMarkers.length} / 全体 ${allMarkers.length} 标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-46 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-46 acceptance (2026-10-16)

- [x] **The family was sized before it was taken.** Every name resolved through the module that reads it, which is how the five entries, their one body \`HE\`, the three checks and the three local constants were chosen, and \`fs.ancestors\` and \`store.*\` were ruled out.
- [x] **Five entries are product surface.** \`fs.read\`, \`fs.write\`, \`fs.list\`, \`fs.exists\` (the one inline entry, ported as its own arrow) and \`fs.stat\`, each behind a wrapper with the source's own key text in the seam.
- [x] **Fifteen bodies copied whole.** 3,003 units of three modules with a per-block ledger, chain verifier (${chain}) and \`unresolved 0\`; every range re-read from its module by the record.
- [x] **The two uncarried names are bounded, not approximated.** \`$ne\` and \`O\` are quoted verbatim with their unported closures named, and the record re-reads each quote from its module.
- [x] **The not-ready entries are recorded, not started.** \`fs.ancestors\` (the tool-context roots) and the four \`store.*\` entries (\`NDe\` through \`le\`) carry their reach and reason into next_package.
- [x] **Everything measured before it was asserted.** The base64 shape, both 4 MiB limits, the write that leaves no file when refused, the log line, the \`se()\` fallback, the sorted list with kinds, the broken-link stat, both policy outcomes, the one platform ask and the three refusal texts.
- [x] **Three first-version mistakes became evidence.** The bytes form is an object, the port reads its process cwd through the bound \`se()\`, and a check runs only behind a handler.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\`, ${chain}, entry/ledger/boundary checks, new suite ${seam.passed}/${seam.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
