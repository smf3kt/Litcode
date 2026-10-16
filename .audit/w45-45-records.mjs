// Write the W45-45 package record from the artifacts themselves: the six clock and env entries, the
// ten copied bodies behind them, and the entries this package left in the same literal.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 365, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 140, `validation ${identity.validation.files}`);
expect(identity.build.files === 253, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 45) throw new Error('the chain verifier did not pass 45 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const copy = verifier.files.find((file) => file.product.endsWith('plugin-chain-clock-env-source.ts'));
if (!copy || copy.blocks !== 10) throw new Error('the clock/env copy is not the 10-block one');

const ledger = JSON.parse(read('src/plugin-chain-clock-env-source-blocks.json'));
if (ledger.blocks.length !== 10) throw new Error('the clock/env ledger does not hold ten blocks');
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 1158) throw new Error(`the ledger holds ${units} units`);
const scan = execFileSync(process.execPath, ['scripts/source-undeclared-scan.mjs', 'src/plugin-chain-clock-env-source.ts'], { encoding: 'utf8' });
if (!/unresolved 0/.test(scan)) throw new Error('the clock/env copy has unresolved names');

// The entries are named from the module, not from memory: each of the six keys is looked up in the
// table's own text, and so is the neighbour this package leaves.
const sfn = read('extracted-v2/modules/chunk-sfn1dbxq.js');
const entries = {
  'clock.now': '"clock.now":{run:cDo}',
  'clock.sleep|clock.after|clock.every': '"clock.sleep":vme,"clock.after":vme,"clock.every":vme',
  'env.get': '"env.get":{check:s2t,run:pFo}',
  'env.set': '"env.set":{check:s2t,run:gFo}',
};
for (const [name, text] of Object.entries(entries)) {
  if (!sfn.includes(text)) throw new Error(`the table entry ${name} is not the text this record names`);
}
const neighbour = '"http.fetch":VQt(e)';
if (!sfn.includes(neighbour)) throw new Error('the http.fetch entry beside the clock keys was not found');
const { clockCallTable, envCallTable } = await import('../dist/plugin-chain-clock-env.js');
const clockKeys = Object.keys(clockCallTable()).sort().join(',');
const envKeys = Object.keys(envCallTable()).sort().join(',');
if (clockKeys !== 'clock.after,clock.every,clock.now,clock.sleep') throw new Error(`the built clock table binds ${clockKeys}`);
if (envKeys !== 'env.get,env.set') throw new Error(`the built env table binds ${envKeys}`);
const leftOut = 'the entries this package leaves in the same literal are named from the module and asserted unbound: `http.fetch` sits between `clock.every` and `settings.read` and runs a request, `process.run`/`process.spawn` go through the process host, and `settings.read` reads the settings sources';

// The wait is reused, not copied a second time: the record reads the export line of W45-22's stream
// source and the copy's own import, so the reuse is asserted rather than described.
const stream = read('src/plugin-chain-stream-source.ts');
if (!/export \{[^}]*\bnS\b[^}]*\bQ\b[^}]*\}/.test(stream)) throw new Error('the stream source no longer exports the clock and its wait');
const copyText = read('src/plugin-chain-clock-env-source.ts');
if (!copyText.includes("import { Q } from './plugin-chain-stream-source.js';")) throw new Error('the copy does not import the wait');
const reuse = '`Q` and its clock (`mIr`, `nS`) are W45-22\'s, carried in ./plugin-chain-stream-source.ts; the copy imports `Q` rather than copying it, and the record asserts that export line still carries all three';
if (!/function Q\(t,r,e\)\{/.test(stream)) throw new Error('the stream source no longer carries the wait body itself');

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
const full = summary('.audit/w45-45-tests.txt');
if (full.failed !== 0 || full.tests !== 1451) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-45-family.txt');
if (family.failed !== 0 || family.tests !== 175) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const seam = summary('.audit/w45-45-seam.txt');
if (seam.failed !== 0 || seam.tests !== 8) throw new Error('the clock/env sweep is not clean');

const smokeReport = read('.audit/w45-45-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const allMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
const sharedMarkers = read('.audit/w45-45-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-45-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45ClockEnvCompiled.v1')) throw new Error('the shared driver did not print the W45-45 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45ClockEnvCompiled.v1 (${sharedMarkers.length} markers in the shared driver, ${allMarkers.length} across every driver: it drives both floors against dist, aborts a wait mid-flight, and checks the ms refusal, the USER_TYPE override and the unset path)`;

const evidence = {
  schema: 'W45ClockEnvEvidence.v1',
  package: 'W45-45 — the `$` table\'s clock and env floors: six entries, ten bodies, and the wait W45-22 had already ported',
  date: '2026-10-16',
  question: 'W45-44 closed the session floor and queued the rest of the table entry by entry, naming the `state.*`, `clock.*`, `fs.*` and `store.*` families. Which of those is ready, and does the smallest one actually stand alone?',
  answer: 'The clock and env families do, and they are the process-facing pair: `clock.now` (`cDo`), the shared `clock.sleep`/`clock.after`/`clock.every` entry (`vme` over `mDo` and `pDo`), `env.get` (`s2t` + `pFo`) and `env.set` (`s2t` + `gFo`). Ten bodies, 1,158 units, and the only external name they need is the abortable wait `Q` — which W45-22 already carried with its clock in src/plugin-chain-stream-source.ts, so this package imports it rather than copying it a second time. `state.get`/`state.set` were the other candidate and are not ready: their bodies reach `Jf`/`KD`, the scope accessors Q-086 is about, and neither is in the product.',
  entries: Object.entries(entries).map(([name, text]) => ({ name, text })),
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  reuse,
  leftOut,
  measured: [
    '`clock.now` answers the process clock and not the pluggable one: the source body is `()=>Promise.resolve(Date.now())`, so moving `nS.now` (the clock `Q` waits on) does not move its answer, which the test asserts by injecting 12345 and still getting a real timestamp.',
    'One entry object serves three names: `vme` is `{check:mDo, run:(e,n)=>pDo(e,n.signal)}`, so `clock.sleep`, `clock.after` and `clock.every` share both the check and the wait — driven through all three names in the test and in the compiled driver.',
    'The wait runs on the caller\'s own signal, and what it rejects with is `pwr`\'s answer: an Error reason stands as it is; a string reason becomes an error whose message is that string; a bare `abort()` carries Node\'s own DOMException, so that is the rejection. `wait aborted` is the fallback for a signal with no reason at all.',
    'A call with no signal passes no options to `Q`, so the timer is never cancelled: the first version of the driver passed an already-aborted signal without attaching it to the caller and measured a full-second wait instead of a rejection, which is how the caller-signal contract was confirmed rather than assumed.',
    'The ms check asks only for a finite number: `10`, `-1` and `1.5` all pass, `Infinity` and a missing `ms` are refused with `takes { ms }, a non-negative number of milliseconds (got …)`, and through the chain the refusal is thrown as `${event}: ${text} (host check)`.',
    '`env.get` answers the process environment, and `USER_TYPE` is always `external` even with the variable set in the process — the source hides that one name from plugins.',
    '`env.set` writes the value, and `undefined` deletes the variable rather than writing an empty one; both runs answer a resolved promise.',
    'The env check refuses a name that is missing, empty, non-string, holds `=` or a NUL byte, and a value that is neither a string nor absent nor NUL-free — nine texts read back from the ported body.',
    'Both checks run only when a handler is in the chain: with none, the table short-circuits to `run` with the caller\'s own object (W45-20\'s `Hze`), which is why a refused sleep never waits and a refused `env.set` writes nothing.',
  ],
  behaviour_changed: [
    'A plugin can read the process clock and read or write the process environment through the `$` names the source gives them, including the `USER_TYPE` override and the unset-on-undefined write.',
    '1,158 units left the unported set; the wait they run was reused from W45-22 rather than copied, and the record asserts that reuse by reading the stream source\'s export line.',
    '`state.*` is recorded as not ready with the exact reason (`Jf`/`KD`, the scope accessors), so the next package does not start it blind.',
    'No product file changed behaviour on another path: the only edits outside the new copy and seam are the verifier registering the plan and the shared driver printing its marker.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'the new copy: unresolved 0',
    chain_verifier: chain,
    entries_check: 'the record re-reads all four entry texts and the `http.fetch` neighbour in the table itself, and asserts the built tables bind exactly the six names',
    ledger_check: 'every copied range is re-read from its module and its length compared against the ledger',
    reuse_check: 'the stream source still exports `nS` and `Q` and still carries the wait body, and the copy imports it',
    regressions: `the new clock/env suite ${seam.passed}/${seam.tests}; ${familyLine}`,
    full: fullLine,
    compiled: driverLine,
    smoke,
  },
  next_package: [
    'the `$` table beyond these floors, entry by entry: `fs.read`/`fs.write`/`fs.list`/`fs.stat` (`hzt`, `_zt`, `gzt`, `yzt`, `mzt` over `HE`), `store.get`/`store.set`/`store.delete`/`store.keys` (`xNs`, `ppr`, `JAt`, `fW`)',
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
write('research/ports/W45-clock-env-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-45 **搬 `$` 表时钟与环境两个 floor',
  features: '; W45-45 binds the `$` clock and env floors',
  standard: '2026-10-16 W45-45 时钟与环境 floor',
  status: 'W45-45: the `$` clock and env floors.',
  runner: '## W45-45 ported the `$` clock and env floors',
};
const stripBlock = (text, mark, { toEnd = false, paragraph = false } = {}) => {
  const at = text.indexOf(mark);
  if (at < 0) return text;
  const start = text.lastIndexOf('\n', at) + 1;
  if (toEnd) return text.slice(0, start);
  const end = paragraph ? text.indexOf('\n\n', at) : text.indexOf('\n', at);
  return text.slice(0, start) + text.slice(end < 0 ? text.length : end + 1);
};

// CURRENT: the W45-45 row above the W45-44 one.
const current = stripBlock(read('research/CURRENT.md'), marks.current);
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-45 **搬 \`$\` 表时钟与环境两个 floor（六条目）**（新副本 10 段 1,158 单位，两模块；seam 无新搬运块）：\`clock.now\`（\`cDo\`）、\`clock.sleep\`/\`clock.after\`/\`clock.every\` 三键共用一条目（\`vme\` = \`{check:mDo,run:(e,n)=>pDo(e,n.signal)}\`）、\`env.get\`（\`s2t\`+\`pFo\`）、\`env.set\`（\`s2t\`+\`gFo\`）；\`fwr\`（有限数判定）与 \`pwr\`（等待中止原因）另从 chunk-nyce03br.js 搬运。**复用而非再搬**：可中止等待 \`Q\` 与其时钟 \`mIr\`/\`nS\` 由 W45-22 已搬入 \`plugin-chain-stream-source.ts\`，本包 import；记录脚本读该模块导出表与导出体断言复用成立。**实测**（先量后断）：\`clock.now\` 走进程时钟而非可插拔时钟（注入 \`nS.now=12345\` 后仍得真实时间戳）；一条目服务三名（三名各驱动一遍）；等待跑在**调用方自己的 signal** 上，拒绝值即 \`pwr\` 的答案（Error 原样、字符串取其文本、裸 \`abort()\` 即 Node 自带 DOMException；\`wait aborted\` 仅是无 reason 时的兜底）——驱动首版把已中止 signal 挂在别处而非 caller 上，量到的是整秒等待而非拒绝，由此确认契约；ms 检查只要有限数（\`-1\`/\`1.5\` 通过，\`Infinity\`/缺省被拒）；\`env.get\` 的 \`USER_TYPE\` 恒为 \`external\`（进程里设了也如此）；\`env.set\` 传 \`undefined\` 是**删除**变量而非写空串；env 检查九条拒绝文本逐条读回；两条 check 仅在链上有 handler 时才跑（无 handler 时按 W45-20 \`Hze\` 直取 floor）。**同 literal 余项与未就绪项写明**：\`http.fetch\`（与时钟键同段）、\`process.run\`/\`spawn\`、\`settings.read\` 留待；\`state.get\`/\`state.set\` 因依赖作用域访问器 \`Jf\`/\`KD\`（即 Q-086 所指层）记录为未就绪。验收：check/build/notices、新副本扫描 \`unresolved 0\`、**${chain}**、条目与邻居自证、账本区间逐段回读、复用自证、新回归 ${seam.passed}/${seam.tests}、插件链家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45ClockEnvCompiled.v1\`，共享 ${sharedMarkers.length} / 全体 ${allMarkers.length} 标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [时钟与环境证据](ports/W45-clock-env-evidence.json)、[会话读取证据](ports/W45-session-floor-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('the C-12 row was not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the two floors.
const features = read('research/FEATURES.md').replace(new RegExp(`${marks.features.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^|]*`), '');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('the interactive feature row was not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-45 binds the \`$\` clock and env floors: a plugin reads the process clock, waits on its own abort signal, and reads or writes the process environment, with USER_TYPE always answered as external and no value unsetting the variable. |`;
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standard.indexOf('2026-10-16 W45-44 会话读取 floor');
if (standardAt < 0) throw new Error('coding-standard W45-44 line not found');
const standardEntry = `2026-10-16 W45-45 时钟与环境 floor：S-1至S-7已对照。S-1（先读源）：先把同表族逐名量体（\`.audit/w45-45-size.mjs\` 经导入表定 chunk、再在 chunk 内定位声明），据此判定 \`clock.*\`/\`env.*\` 可搬而 \`state.*\` 未就绪——后者体里读到 \`Jf\`/\`KD\`（作用域访问器，即 Q-086 所指层），产品无此二名，故不做半包；十条体逐条读出依赖后确认唯一的跨包名是 \`Q\`，且 W45-22 已搬。S-2（不留半包）：十条一次给全 + 六表项包装 + 直调包装；同 literal 的 \`http.fetch\`、\`process.*\`、\`settings.read\` 与未就绪的 \`state.*\` 写明在 seam 头注、\`leftOut\` 与 next_package。S-3：回归先依赖实测量出的取值（进程时钟 vs 可插拔时钟、三名共用一体、拒绝值三分法、\`USER_TYPE\` 覆盖、\`undefined\` 即删、九条拒绝文本、check 仅在链上有 handler 时跑），断言字面值与拒绝文本而非布尔；驱动首版把已中止 signal 挂错位置而量到整秒等待，即被断言抓住并据此确认"等待跑在 caller 的 signal 上"。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器/打包冒烟/${drivers.length} 个编译驱动并解析输出，\`ported\` 由 ledger 读回并逐段回源比对长度，复用由读 stream 源导出表与导出体断言。S-5/S-6：seam 只做命名与类型收窄（\`cDo\` 按源用法收窄为 \`()=>Promise<number>\`），无死导出；不重复搬 \`Q\`/\`mIr\`/\`nS\`，也不搬用不到的日志汇。S-7：同表余项（\`fs.*\`/\`store.*\`/\`state.*\`/\`settings.read\`/\`http.fetch\`、余下 \`ui.*\`）、Q-086、通知 Provider、helpers/config store 与装载管线写入 next_package。验收：check/build/notices、扫描 unresolved 0、${chain}、条目与邻居自证、账本回读、复用自证、回归 ${seam.passed}/${seam.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-45 paragraph above the W45-44 one.
const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf('W45-44: the `$` session read floor.');
if (statusAt < 0) throw new Error('STATUS W45-44 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-45: the \`$\` clock and env floors. The session floor's neighbours split cleanly: the clock and env families stand alone, and \`state.*\` does not — its bodies reach \`Jf\` and \`KD\`, the scope accessors Q-086 is about, and neither is in the product, so it is recorded as not ready rather than started. Ten bodies (1,158 units, two modules) give six entries: \`clock.now\` (\`cDo\`), the one entry object \`vme\` that \`clock.sleep\`, \`clock.after\` and \`clock.every\` all share, and the two env entries over \`s2t\`/\`pFo\`/\`gFo\`. The only cross-package name they need is the abortable wait \`Q\`, which W45-22 already carried with its clock — so this package imports it, and the record asserts the reuse by reading the stream source's export line and its body rather than describing it. Measured before asserted: \`clock.now\` answers the process clock and not the injectable one; the wait runs on the caller's own signal and rejects with exactly what \`pwr\` makes of the reason (an Error as it stands, a string's text, a bare abort's DOMException, and \`wait aborted\` only when a signal carries no reason at all); a finite ms is all the check asks for, so \`-1\` and \`1.5\` pass; \`USER_TYPE\` is always \`external\`; and \`env.set\` with no value unsets the variable. The driver's first version attached an already-aborted signal to something other than the caller and measured a full second of waiting, which is how the caller-signal contract was confirmed instead of assumed. Evidence: \`research/ports/W45-clock-env-evidence.json\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-45 section.
const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-45 ported the \`$\` clock and env floors (2026-10-16)

Six more entries of the \`$\` table are product surface, copied verbatim into
src/plugin-chain-clock-env-source.ts (10 blocks, 1,158 units of two modules) behind
src/plugin-chain-clock-env.ts: \`clock.now\` (\`cDo\`, 21 units of table text), the single entry object
\`vme\` that \`clock.sleep\`, \`clock.after\` and \`clock.every\` all share (53 units of text, three keys),
\`env.get\` (\`s2t\` + \`pFo\`) and \`env.set\` (\`s2t\` + \`gFo\`). The clock's three names differ only in the
spelling they are logged under: one \`check\` and one \`run\` serve all three.

The abandonment of a second copy is the package's one reuse: the wait is \`Q\`, which W45-22 already
carried with its clock (\`mIr\`, \`nS\`) in src/plugin-chain-stream-source.ts. The copy imports it, and
the record reads that module's export line and its body to assert the reuse rather than describing it.

What the ported bodies say, each measured: \`clock.now\` is \`()=>Promise.resolve(Date.now())\`, so it
never goes through the injectable clock; the wait runs on the caller's own signal and rejects with
\`pwr\`'s answer — an Error as it stands, another reason's text, a bare abort's own DOMException, and
\`wait aborted\` only for a signal with no reason; the ms check asks for a finite number and nothing
more; \`env.get\` answers the process environment with \`USER_TYPE\` always reported as \`external\`; and
\`env.set\` with no value deletes the variable. Both \`check\`s run only when a handler is in the chain,
so a refused sleep never waits and a refused \`env.set\` writes nothing.

\`state.get\` and \`state.set\` were the other candidates and are not ready: their bodies reach \`Jf\` and
\`KD\`, the scope accessors Q-086 is about, and neither is in the product. The rest of the same literal
— \`http.fetch\`, \`process.run\`/\`process.spawn\`, \`settings.read\` — is named in the seam header and in
next_package rather than half-taken.

Verified: check/build/notices, the new copy \`unresolved 0\`, ${chain}, the entry, ledger and reuse
checks, the new suite ${seam.passed}/${seam.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled
drivers (the shared driver now also prints \`W45ClockEnvCompiled.v1\`), and the packaged smoke
(${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself, which
asserts the counts).

Next: the \`fs.*\` and \`store.*\` families, then the remaining \`ui.*\` entries; \`state.*\` waits on the
scope accessors.
`);

const rows = [
  ['2026-10-16T21:20:00Z', 'package', 'W45-45 搬 `$` 表时钟与环境两 floor 六条目（新副本 10 段 1,158 单位，两模块；seam 无新搬运块）',
    'clock.now / clock.sleep|after|every / env.get / env.set 成为产品面；等待 Q 复用 W45-22 副本而非再搬；state.* 记录为未就绪（缺 Jf/KD）',
    'chunk-sfn1dbxq.js [2354369,2354390) clock.now、[2354391,2354444) 三键共用条目、[2354606,2354635) env.get、[2354636,2354665) env.set；体 cDo [1840645,1840684)、pDo [1840685,1840741)、mDo [1840742,1840864)、vme [1840864,1840910)、xme [1844317,1844394)、pFo [1867912,1868038)、s2t [1868038,1868447)、gFo [1868447,1868588)、chunk-nyce03br.js pwr [158106,158196)/fwr [158250,158302)',
    `实测（test/plugin-chain-clock-env.test.ts + .audit/w45-24-compiled.mjs）：进程时钟 vs 可插拔时钟、三名共用一体、拒绝值三分法、有限数判定、USER_TYPE 覆盖、undefined 即删、九条拒绝文本、check 仅在链上有 handler 时跑；8/8 通过`],
  ['2026-10-16T21:26:00Z', 'finding', 'W45-45 判定 state.get/state.set 未就绪并写明阻塞点：Jf/KD 作用域访问器（Q-086 所指层）',
    'Pur/Our/Iur/$ss/Hur 五体在 chunk-n3ykh62m.js，各自读到 Oi/Pye/s_（已搬）之外的 Jf、KD（作用域→存储句柄），产品无此二名；硬搬需自造作用域层，等于替源决定插件读到哪个 scope 的 state',
    '不搬；把五体、区间与阻塞点写入 evidence.next_package 首条与 runner 文档；同 literal 的 http.fetch/process.*/settings.read 一并写明为留待',
    'check/build 通过；同表余项名称由表内文本自证（http.fetch 邻居断言通过）'],
  ['2026-10-16T21:31:00Z', 'finding', 'W45-45 由驱动首版失败确认"等待跑在调用方自己的 signal 上"这一契约',
    '首版把已中止 signal 传给 raiseClockCall 的 caller 之外的位置，量到的是整秒等待而非拒绝（Missing expected rejection），说明 pDo 读的是 n.signal（caller 记录上的 signal），不是别处的信号',
    '回归与驱动改为把 signal 挂在 caller 记录上；另加三处拒绝断言（Error 原样 / 字符串取文本 / 裸 abort 得 DOMException）与一处"信号从不中止则等待正常结束"',
    '回归 8/8、家族 175/175、全量 1451/1451 通过；驱动 19 标记全出'],
  ['2026-10-16T21:36:00Z', 'verification', `W45-45 验收：新副本扫描 unresolved 0、条目与邻居自证、账本逐段回读、复用自证、${chain}、回归 ${seam.passed}/${seam.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '时钟与环境两 floor 收束，下一包转 fs.*/store.* 及余下 ui.*',
    `check/build/notices；扫描 unresolved 0；${chain}；条目四段与 http.fetch 邻居回读源文 + 编译后表键自证；账本 10 段逐段回源比长度；复用（stream 源导出表含 nS/Q 且含 Q 体 + 副本 import）；新回归 ${seam.passed}/${seam.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45ClockEnvCompiled.v1，共享 ${sharedMarkers.length} / 全体 ${allMarkers.length} 标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-45 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-45 acceptance (2026-10-16)

- [x] **The family was sized before it was taken.** Every remaining small body measured through the table module's own import header, which is how \`clock.*\`/\`env.*\` were chosen and \`state.*\` ruled out.
- [x] **Six entries are product surface.** \`clock.now\`, the three clock names that share one entry object, \`env.get\` and \`env.set\`, each behind a wrapper with the source's own arrow text in the seam.
- [x] **Ten bodies copied whole.** 1,158 units of two modules with a per-block ledger, chain verifier (${chain}) and \`unresolved 0\`; every range re-read from its module by the record.
- [x] **Nothing was copied twice.** The wait \`Q\` and its clock are W45-22's; the copy imports them, and the record asserts the export line and the body are still there.
- [x] **The not-ready family is recorded, not started.** \`state.get\`/\`state.set\` reach \`Jf\`/\`KD\`, and the reason is written where the next package will read it.
- [x] **Everything measured before it was asserted.** Process clock versus injectable clock, the three-name share, the three-way abort reason, the finite-ms rule, \`USER_TYPE\`, the unset path and nine refusal texts.
- [x] **A failing first driver was used as evidence.** It measured a full-second wait instead of a rejection, which is how the caller-signal contract got confirmed rather than assumed.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\`, ${chain}, entry/ledger/reuse checks, new suite ${seam.passed}/${seam.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
