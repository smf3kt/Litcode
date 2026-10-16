// Write the W45-52 record from the artifacts themselves: the store entry and dispatcher, its eighteen
// copied blocks across four modules, and the four table entries it ports into the seam.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 387, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 147, `validation ${identity.validation.files}`);
expect(identity.build.files === 269, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 51) throw new Error('the chain verifier did not pass 51 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const copy = verifier.files.find((file) => file.product.endsWith('plugin-chain-store-entry-source.ts'));
if (!copy || copy.blocks !== 18 || copy.units !== 2343) throw new Error('the store-entry copy is not the 18-block, 2,343-unit one');
const carryCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-store-carry-source.ts'));
if (!carryCopy || carryCopy.blocks !== 21 || carryCopy.units !== 2217) {
  throw new Error('the store-carry copy did not take the JSON text helper this package added to it');
}

const ledger = JSON.parse(read('src/plugin-chain-store-entry-source-blocks.json'));
if (ledger.blocks.length !== 18) throw new Error('the store-entry ledger does not hold eighteen blocks');
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 2343) throw new Error(`the ledger holds ${units} units`);
const scan = execFileSync(process.execPath, ['scripts/source-undeclared-scan.mjs', 'src/plugin-chain-store-entry-source.ts'], { encoding: 'utf8' });
if (!/unresolved 0/.test(scan)) throw new Error('the store-entry copy has unresolved names');

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
const copyText = read('src/plugin-chain-store-entry-source.ts');
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
// The bodies this record names, located by the text they start with, with the unit counts it states.
const store = sources.get('chunk-tvdq3hrk.js').text;
const lead = [
  ['function _ro(e){', store, 275],
  ['function ppr(e){', store, 69],
  ['var xNs=(e)=>ppr(e)??_ro(e?.value);', store, 35],
  ['var pt={realpath:!1', store, 145],
  ['var Se={async read(e){', store, 484],
  ['async function Ce(e,r){', store, 833],
  ['var JAt=(e,r)=>ct(r)(()=>Ce(e,r));', store, 34],
];
for (const [needle, text, count] of lead) {
  const block = ledger.blocks.find((entry) => text.slice(...entry.range).startsWith(needle));
  if (!block || block.units !== count) throw new Error(`${needle} is not the ${count}-unit body this record describes`);
}
// The three facts that make the chain complete: the entry writes through the earlier layers, reads
// through them, and locks beside the store file with `pt`.
if (!store.slice(...ledger.blocks.find((b) => b.units === 484).range).includes("write:async(e,r)=>vn(await xe(e),`${_(r,null,2)}\n`,384)")) {
  throw new Error('the store entry no longer writes through the atomic writer with the JSON text helper');
}
if (!store.slice(...ledger.blocks.find((b) => b.units === 484).range).includes('{lockfilePath:`${r}.lock`,...pt}')) {
  throw new Error('the store entry no longer locks beside the store file with the lock options');
}
if (!store.slice(...ledger.blocks.find((b) => b.units === 145).range).includes('onCompromised')) {
  throw new Error('the lock options lost the compromised-lock notice');
}
// The dispatcher's own two refusals and its one log line.
const dispatcher = store.slice(...ledger.blocks.find((b) => b.units === 833).range);
for (const fragment of ['the key is ${e.key.length} characters, over the ${Z} limit',
  'the store would be ${c} characters, over the ${jde} limit', '$.store.set (${r}): ${e.key}',
  'Object.hasOwn(a,e.key)?a[e.key]:void 0', 'await n.lock?.(r)']) {
  if (!dispatcher.includes(fragment)) throw new Error(`the dispatcher lost ${fragment}`);
}
// The storage-id reader: the source quote in the seam is the module's own text.
const table = read('extracted-v2/modules/chunk-sfn1dbxq.js');
const fwText = 'var fW=(e,n)=>e.knownArgs.get(n)?.pluginStorageId??n;';
if (table.slice(2342617, 2342670) !== fwText) throw new Error('the storage-id reader moved in its module');
if (!copyText.includes(fwText)) throw new Error('the copy no longer holds the storage-id reader');
// The four table entries: the seam quotes each one, and each quote is the literal's own text.
const seam = read('src/plugin-chain-store.ts');
for (const [start, end] of [[2353939, 2354017], [2354018, 2354129], [2354130, 2354233], [2354234, 2354294]]) {
  const entry = table.slice(start, end);
  if (!seam.includes(entry)) throw new Error(`the seam no longer quotes the entry at [${start},${end})`);
}
for (const fragment of ['export function storeCallTable()', 'export async function raiseStoreCall(',
  "bottom: storeCallTable()[request.event]", 'export function bindStoreStorageId(', 'export const STORE_KEY_MAX_CHARS = Z;',
  'export const STORE_CHAR_LIMIT = jde;', 'export const storeLockOptions = pt;']) {
  if (!seam.includes(fragment)) throw new Error(`the seam lost ${fragment}`);
}
// The seam's storage-id fallback is the source's own: the plugin name when the map holds nothing.
if (!seam.includes('knownStorageIds.get(plugin) ?? plugin')) throw new Error('the storage-id fallback changed');

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-52-tests.txt');
if (full.failed !== 0 || full.tests !== 1511) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-52-family.txt');
if (family.failed !== 0 || family.tests !== 235) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const seamSweep = summary('.audit/w45-52-seam.txt');
if (seamSweep.failed !== 0 || seamSweep.tests !== 11) throw new Error('the store-entry sweep is not clean');

const smokeReport = read('.audit/w45-52-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 277) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const allMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
const sharedMarkers = read('.audit/w45-52-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-52-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45StoreEntryCompiled.v1')) throw new Error('the shared driver did not print the W45-52 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45StoreEntryCompiled.v1 (${sharedMarkers.length} markers in the shared driver, ${allMarkers.length} across every driver: it round-trips a store through the dist copy — the four names, the file's mode and shape, the own-key read, the key limit, the check a chain with a handler reaches, the per-id queue, and the backend slot replacing the store)`;

const evidence = {
  schema: 'W45StoreEntryEvidence.v1',
  package: 'W45-52 — the `$` store\'s entry and dispatcher',
  date: '2026-10-16',
  question: 'What do `store.get`, `store.set`, `store.delete` and `store.keys` reach? What is the entry the other store layers hand off to, and what does the dispatcher do on the way?',
  answer: 'The four table entries name the plugin\'s storage id and hand the event to `JAt`, which puts the dispatcher `Ce` behind a serial queue per storage id; `Ce` checks the key length, reads through the store entry `Se`, takes the store\'s lock for set and delete, holds the whole store to 4,194,304 characters, logs the key it wrote, and wraps anything the backend throws in the hooks error class. `Se` is the store itself: read through W45-51\'s read-and-carry layer, parsed and shape-checked, write through W45-50\'s atomic writer at 0600 after W45-48\'s directory, lock through W45-49\'s lockfile beside the store file with the options `pt`. The closure this package copied is 18 whole top-level statements, 2,343 units across four chunks; the four entries themselves are table fragments and are ported verbatim into the seam with their spans quoted.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  boundary: 'None is needed for behaviour: every dependency resolves to a copy the product already holds (`He`/`l`, `t`, `S`/`xe`/`St`, `vn`, `Wa`/`Um`, `vt`/`L`/`Y`) or to one of the three small bodies copied here (`jde`, `bs`, `fW`). No node builtin is reached by this closure. Two pieces are deliberately not modelled: the plugin-method dispatcher\'s `knownArgs` context (the seam keeps its own map, and `fW`\'s own fallback — the plugin\'s name — is what an unbound plugin runs against), and the table entry field `stamp` (recorded in W45-47, still not modelled by any name this product binds).',
  measured: [
    'The four names answer: `store.get` returns the stored value or undefined, `store.set` and `store.delete` answer undefined once their write landed, `store.keys` answers the store\'s own keys — and a store that is not there is `[]`.',
    'The store file is two-space JSON with a trailing newline at mode 0600 (`{}\\n` for an empty store), and a write leaves the store file and nothing else in the directory.',
    'Only the store\'s own keys are keys: `get`/`delete` on `toString` answer undefined and write nothing.',
    'The key limit is 256 characters and covers every event but `keys`: `tips: $.store.get: the key is 257 characters, over the 256 limit`. `keys` ignores a key argument entirely.',
    'The store limit is 4,194,304 characters over the whole serialized store: a set whose store would be 4,194,312 characters is refused with `the store would be 4194312 characters, over the 4194304 limit`, and no store file is written.',
    'The value check only rejects what has no JSON text: a number and an object pass (`_ro` stringifies with `_`), `undefined` is refused as `value is not JSON data: undefined`.',
    'Two writes to one store do not interleave: both land, whichever order the queue ran them in.',
    'The entries run against the storage id the context holds: with `cc-plugin-claude-test@builtin` bound for `claude-test` the write lands in that store, and unbinding puts the plugin back on its own name — the source\'s own `?? n`.',
    'The backend slot replaces the store for the whole product: with a fake bound, `store.get` reads the fake with the plugin\'s own id, and binding `undefined` restores the store entry (the source\'s `?? Se`).',
    'The store entry is `{read, write, lock}`: the lock handle is a function whose `[Symbol.asyncDispose]` is itself, the lock file is `<store>.json.lock` beside the store, and calling the handle removes it.',
    'A store file that does not parse is the store\'s own error — `tips: store file <path> is malformed (<parse error>)` — and one that parses to something other than a plain object is `(the JSON is not an object)`.',
    'The entries\' checks reach the caller only through a chain that has a handler — with no handler the call short-circuits to `run` and the check never runs (the copier path W45-20 recorded) — and then the refusal is `${event}: ${text} (host check)`: `store.get: takes a key (host check)`, `store.set: value is not JSON data: undefined (host check)`.',
    'The lock options are the source\'s own: no `realpath`, ten retries from 5ms to 100ms, and a compromised lock logged at warn as `$.store lock compromised: ${reason}` rather than thrown.',
  ],
  behaviour_changed: [
    'The store subsystem is complete from the plugin surface down to the file: `store.*` entries → `JAt` queue → `Ce` dispatcher → `Se` entry → W45-51 read/carry, W45-50 writer, W45-49 lock, W45-48 file layer. The product can answer a plugin store call the way the source does, with the source\'s own limits, logging and error class.',
    'The store-carry copy grew by one block: the JSON text helper `_` lives there because it shares `ih` and `Pe` with the parse, and because the store chunk\'s unrelated `Pe` (the backend factory) would collide with a second copy in this package\'s own module. That plan is now 21 blocks / 2,217 units and exports `_`, `L` and `Y` for this package to import.',
    'The `$` store cores are not registered in the product\'s chain catalog: the entries reach the chain through `raiseStoreCall`, which this product has no `$` object to call, exactly as the ui entries did in W45-24. Nothing raises it on its own.',
    'No product file changed behaviour on another path: the only edits outside the new copy, seam, suite and probes are the two plan/registry entries and the shared driver printing its marker.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'the new copy: unresolved 0',
    chain_verifier: chain,
    ledger_check: 'all 18 ranges are re-read from their four modules, compared with the ledger, searched for in the copy, and checked against acorn: every block is a whole top-level statement and none is copied twice',
    boundary_check: 'the four table entries are asserted in the literal at their measured spans and in the seam that quotes them; the storage-id reader is asserted in its module and in the copy; the store entry\'s write, lock and lock-option bodies, the dispatcher\'s two refusals and its one log line, and the seam\'s own named exports and storage-id fallback are all re-read from the source',
    regressions: `the new store-entry suite ${seamSweep.passed}/${seamSweep.tests}; ${familyLine}`,
    full: fullLine,
    compiled: driverLine,
    smoke,
  },
  next_package: [
    '`settings.read` (`yGo`/`hGo`) over the settings store, now that the store family is complete — the settings file is the next subsystem the `$` table\'s entries wait on',
    'registering the `store.*` and remaining `ui.*` cores in the product\'s chain catalog once the product has a `$` surface to call them from (the entries are ported; the surface is the product\'s own decision)',
    '`http.fetch` (`VQt`) once the request runner `dNo` is ported',
    '`ui.copy` (`wGo`/`uzo`/`dzo`) once the clipboard encoder `Sv` and the surface catalog are ported, with the `stamp` field modelled',
    '`ui.blit` (`fNs`/`kFo`/`mNs`/`bFo`), `ui.scroll` (`O5n`/`L5n`), `ui.focus` (`fzo`/`Szo`), `ui.notify` (`Dzo`/`Fzo`/`Nzo`), each measured the same way first',
    '`fs.ancestors` (`mzt`/`kNs`) and `state.get`/`state.set` (`Jf`/`KD`)',
    'Q-086\'s 15 registry-reading cores and their 34 sites',
    'the notification context provider `a4n` and the clearTimer context `R`, and a streaming provider through the loader path',
    'the config/home layer behind `be`: porting it would replace the store file layer\'s bound hook with the source\'s own `bl()`',
  ],
};
write('research/ports/W45-store-entry-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-52 **搬 `$` store 条目',
  features: "; W45-52 ports the store's entry and dispatcher",
  standard: '2026-10-16 W45-52 store 条目',
  status: 'W45-52: the store entry and its dispatcher.',
  runner: '## W45-52 ported the store entry and its dispatcher',
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
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-52 **搬 \`$\` store 条目**（\`store.get\`/\`set\`/\`delete\`/\`keys\` 到文件的最后一环）：**18 段 2,343 单位**、跨四模块（chunk-tvdq3hrk.js 的 \`_ro\`/\`ppr\`/\`xNs\`/\`pt\`/\`de\`/\`NDe\`/\`le\`/\`ct\`/\`Se\`/\`Pe\`/\`Dt\`/\`Ae\`/\`Z\`/\`Ce\`/\`JAt\`、chunk-nyce03br.js 的 \`jde\`、chunk-c9vsmdqj.js 的 \`bs\`、chunk-sfn1dbxq.js 的 \`fW\`），**四条表项按表片段逐字搬进 seam 并引用区间**（[2353939,2354017) 78u / [2354018,2354129) 111u / [2354130,2354233) 103u / [2354234,2354294) 60u）。**链路**：表项按 \`fW\` 取存储 id（上下文有则用 id，否则用插件名——源自身的 \`?? n\`）→ \`JAt\` 把 \`Ce\` 放进**按存储 id 的串行队列**（\`ct=le()\`/\`NDe\`/\`de\`）→ \`Ce\` 按键长（256，除 \`keys\` 外全事件）、读、写/删取锁并经 \`Um\` 释放、整库限 4,194,304 字符、写后记 \`$.store.set (plugin): key\`、后端抛错一律包成 hooks 错误类；\`Se\` = read（W45-51）/write（W45-50 原子写、0600、W45-48 目录）/lock（W45-49 锁，\`<file>.lock\` + \`pt\`）。\`Ae\`/\`Dt\`/\`Pe\`/\`bs\` 构成**后端槽**（\`setStoreBackend\` 换、\`undefined\` 还原，即源的 \`?? Se\`）。**先测后断言**（.audit/w45-52-probe.ts、-probe2.ts 与 test/plugin-chain-store.test.ts 11 条）：四事件往返、文件 \`{}\n\` 且 0600、目录只剩库文件；**自有键**（\`toString\` 非键）；键长 257 → \`the key is 257 characters, over the 256 limit\` 且 \`keys\` 无此限；整库限 → \`the store would be 4194312 characters, over the 4194304 limit\` 且**不落文件**；值检查只拒无 JSON 文本者（数/对象通过、\`undefined\` 拒）；同库两写不交错；绑定 id 后写进 id 库、解绑回插件名；后端槽换/还原；\`storeEntry\` = \`{read,write,lock}\`、锁把手是自带 \`Symbol.asyncDispose\` 的函数、释放即删锁文件；坏 JSON/非对象两类 malformed 报错原文；**表项 check 只在链上有 handler 时生效**（无 handler 短路到 run），拒绝文本 \`store.get: takes a key (host check)\` / \`store.set: value is not JSON data: undefined (host check)\`。**本包对 W45-51 计划做了一处扩展**：JSON 文本助手 \`_\` 加进读/携带副本（与 \`ih\`/\`Pe\` 同处，且本模块的 \`Pe\` 是后端工厂会撞名）→ 该计划 21 段 2,217 单位并导出 \`_\`/\`L\`/\`Y\`。验收：check/build/notices、新副本扫描 \`unresolved 0\`、**${chain}**、账本 18 段逐段回源+内容比对+**acorn 断言"每段都是完整顶层语句、无重叠"**、四条表项与 \`fW\`、\`Se\` 写/锁、\`pt\` 的 \`onCompromised\`、\`Ce\` 的两处拒绝与一行日志、seam 导出与 id 回退全部回源断言、新回归 ${seamSweep.passed}/${seamSweep.tests}、插件链家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45StoreEntryCompiled.v1\`，共享 ${sharedMarkers.length} 标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [store 条目证据](ports/W45-store-entry-evidence.json)、[携带层证据](ports/W45-store-carry-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
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
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-52 ports the store's entry and dispatcher: the four store names run through a per-plugin serial queue into the store file, with the source's own key and store limits, its lock beside the file, its log line and its error class. |`;
write('research/FEATURES.md', lines.join('\n'));

const standard = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standard.indexOf('2026-10-16 W45-51 store 读/携带层');
if (standardAt < 0) throw new Error('coding-standard W45-51 line not found');
const standardEntry = `2026-10-16 W45-52 store 条目与调度器：S-1至S-7已对照。S-1（先读源）：由四条表项的**表层**（\`"store.get":{check:ppr,run:(n,r)=>JAt({…},fW(e,r.plugin))}\` 等，逐条量区间）起手，再读 \`JAt\`/\`Ce\`/\`Se\`/\`pt\`/\`Pe\`/\`Dt\`/\`Ae\` 全体与两个检查 \`ppr\`/\`xNs\`/\`_ro\`，最后定 seam（表片段逐字入 seam，正体 18 段入副本）。S-2（不留半包）：一次给全 18 段（含 \`fW\`、\`jde\`、\`bs\` 三个跨模块小体），并把"\`knownArgs\` 上下文由 seam 自持""\`stamp\` 仍未建模"如实写入 seam 与证据，不伪造调度器。S-3：\`.audit/w45-52-probe.ts\`/\`-probe2.ts\` 先实测（四事件往返与文件形态、自有键、两条限制的确切数字、并发两写、绑定 id 前后、后端槽、锁把手与锁文件、两类 malformed 文本、**表项 check 仅在链上有 handler 时生效**），再写 11 条断言；首版误把 \`store.get {}\` 当成 check 生效路径（实测为 \`Cannot read properties of undefined\` 的 run 短路），据此改为"装 handler 才断言拒绝文本"。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器/打包冒烟/${drivers.length} 个编译驱动并解析输出；acorn 断言（完整顶层语句、无重叠、无重复）+ 四条表项区间与 seam 引文逐字比对 + \`fW\` 源文比对，防记忆漂移。S-5/S-6：seam 只做命名与类型收窄（\`storeEntry\`/\`storeBackend\`/\`setStoreBackend\`/表/raise/两个限制/锁选项/槽工厂），无死导出；表片段带来源区间，未建模字段如实记录。S-7：\`settings.read\` 与设置存储、\`$\` 表面注册、\`http.fetch\`、\`ui.copy\`（含 \`stamp\`）、\`ui.blit\`/\`scroll\`/\`focus\`/\`notify\`、\`fs.ancestors\`、\`state.*\`、Q-086、通知 Provider、config/home 层写入 next_package。验收：check/build/notices、扫描 unresolved 0、${chain}、账本与边界自证、回归 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf("W45-51: the store's read and carry layer.");
if (statusAt < 0) throw new Error('STATUS W45-51 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-52: the store entry and its dispatcher. The four table entries — \`store.get\`, \`store.set\`, \`store.delete\`, \`store.keys\` — hand their event to \`JAt\`, which puts the dispatcher behind a serial queue per storage id; the dispatcher checks the key length, reads through the store entry, takes the store's lock for set and delete, holds the whole store to 4,194,304 characters, logs the key it wrote, and wraps anything the backend throws in the hooks error class. The store entry itself is \`{read, write, lock}\`: W45-51's read and carry, W45-50's atomic writer at 0600 after W45-48's directory, and W45-49's lock beside the store file with the options \`pt\` — which makes the store subsystem complete from the plugin surface to the file. 18 whole top-level statements, 2,343 units across four chunks; the four entries are table fragments and are ported verbatim into the seam with their spans quoted. Measured first, then asserted: the file's shape and mode, the own-key read, both limits with their exact counts, two writes not interleaving, the storage id the context holds against the plugin name, the backend slot replacing and restoring the store, the lock handle and its file, the two malformed-store texts, and the entry checks — which only a chain with a handler can reach, because with no handler the call short-circuits to \`run\`. One plan grew: the JSON text helper \`_\` joined the store-carry copy (it shares the parse's guard and length reporter, and this package's own module has an unrelated \`Pe\`), so that copy is now 21 blocks / 2,217 units and exports \`_\`, \`L\` and \`Y\`. Evidence: \`research/ports/W45-store-entry-evidence.json\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-52 ported the store entry and its dispatcher (2026-10-16)

The `+"`$`"+` store's four table entries hand their event to \`JAt\`, which runs the dispatcher \`Ce\` behind a
serial queue per storage id (\`ct\` is \`le()\`: one chain per id, and a rejection does not stop the next
caller). The dispatcher refuses a key longer than 256 for every event but \`keys\`, reads through the
store entry, takes the store's lock for set and delete and releases it through \`Um\` whatever happens,
refuses a write that would push the whole store past 4,194,304 characters, logs the key it wrote as
\`$.store.set (plugin): key\`, and wraps anything the backend throws in the hooks error class. The store
entry \`Se\` is \`{read, write, lock}\` — W45-51's read and carry, W45-50's atomic writer at 0600 after
W45-48's directory, and W45-49's lock beside the store file with the options \`pt\` (no realpath, ten
retries from 5ms to 100ms, a compromised lock logged rather than thrown). With that, the store subsystem
is complete from the plugin surface to the file.

The closure is 18 whole top-level statements, 2,343 units across four chunks, and no node builtin is
reached: every dependency is a copy the product already holds. Three small cross-module bodies come with
it — the store's size limit \`jde\`, the backend slot \`bs\`, and the storage-id reader \`fW\`. The four
entries themselves are fragments of the plugin-method table's literal, so they are ported verbatim into
src/plugin-chain-store.ts with their spans quoted, the way the ui entries were in W45-24; their \`run\`
bodies and the checks \`ppr\`/\`xNs\`/\`_ro\` are the source's own.

The dispatch context. The source's entries close over the table function's \`e\` and read
\`e.knownArgs.get(plugin)?.pluginStorageId\`; this product has no plugin interface dispatcher, so the seam
keeps that map itself (\`bindStoreStorageId\`) and an unbound plugin runs against its own name — which is
exactly \`fW\`'s fallback, not a default invented here.

Measured before asserted: the four events round-tripping through a real file (\`{}\\n\`, mode 0600, the
directory left with the store file alone); the own-key read (\`toString\` is not a key); the key limit
with its exact text and count; the store limit with its exact count and no file written; the value check
rejecting only what has no JSON text; two writes to one store not interleaving; the bound storage id
against the plugin name; the backend slot replacing and restoring the store; the lock handle, its file
and its release; both malformed-store texts; and the entry checks, which reach the caller only through a
chain that has a handler — with none, the call short-circuits to \`run\` and the check never runs.

One plan grew rather than being duplicated: the JSON text helper \`_\` joined the store-carry copy,
because it holds the same disposable guard as the parse and reports its length through the same \`Pe\`,
and because this package's own module has an unrelated \`Pe\` (the backend factory). That copy is now 21
blocks / 2,217 units and exports \`_\`, \`L\` and \`Y\`.

Verified: check/build/notices, the new copy \`unresolved 0\`, ${chain}, the ledger, acorn and boundary
checks, the new suite ${seamSweep.passed}/${seamSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled
drivers (the shared driver now also prints \`W45StoreEntryCompiled.v1\`), and the packaged smoke
(${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: \`settings.read\` over the settings store, now that the store family is complete; then \`http.fetch\`
over the request runner, \`ui.copy\` with its \`stamp\` field, the remaining \`ui.*\` names, \`fs.ancestors\`,
\`state.*\`, and the config/home layer behind \`be\`.
`);

const rows = [
  ['2026-10-17T01:50:00Z', 'package', 'W45-52 搬 $ store 条目（store.get/set/delete/keys 到文件的最后一环；18 段 2,343 单位，跨四模块 + 四条表片段）',
    'JAt 队列 + Ce 调度器 + Se 条目 + 后端槽 + 两检查成为产品面：键长 256、整库 4,194,304、set/delete 取锁、写后日志、后端错误包成 hooks 错误类；store 子系统从插件表面到文件贯通',
    'chunk-tvdq3hrk.js _ro [10939,11214) 275u、ppr [11214,11283) 69u、xNs [13344,13379) 35u、pt [15456,15601) 145u、de [15601,15635) 34u、NDe [15635,15722) 87u、le [15722,15805) 83u、ct [15829,15841) 12u、Se [17609,18093) 484u、Pe [18093,18165) 72u、Dt [18165,18177) 12u、Ae [18177,18213) 36u、Z [18213,18223) 10u、Ce [18223,19056) 833u、JAt [19056,19090) 34u；chunk-nyce03br.js jde [212618,212634) 16u；chunk-c9vsmdqj.js bs [615,668) 53u；chunk-sfn1dbxq.js fW [2342617,2342670) 53u',
    `实测（.audit/w45-52-probe.ts、-probe2.ts 与 test/plugin-chain-store.test.ts + .audit/w45-24-compiled.mjs）：四事件往返与 {} 0600 文件、自有键、两条限制确切数字、并发两写、绑定 id、后端槽、锁把手与锁文件、两类 malformed、check 仅在链上有 handler 时生效；11/11 通过`],
  ['2026-10-17T01:53:00Z', 'finding', 'W45-52 计划扩展：JSON 文本助手 _ 并入 W45-51 读/携带副本（避免 Pe 撞名）',
    '本包模块自带 chunk-tvdq3hrk.js 的 Pe（后端工厂），与 chunk-gyf58rwf.js 的 Pe（解析长度报告者）同名；_ 需要后者，若在本模块再复制会重复声明',
    '_ 加入 W45-51 计划（21 段 2,217 单位，导出 _/L/Y），本包改为 import { _, L, Y }；链校验器与 acorn 复验通过',
    '链校验器 51 plans 通过（本包 18 段 / 2,343 单位；读/携带 21 段 / 2,217 单位）；扫描 unresolved 0'],
  ['2026-10-17T01:56:00Z', 'finding', 'W45-52 实测纠偏：表项 check 只在链上有 handler 时生效',
    '首版探针直接 raiseStoreCall({event:"store.get", args:{}}) 期望得到 "takes a key"，实测走的是"无 handler 短路到 run"，抛 Cannot read properties of undefined (reading) —— 与 W45-20 记录的 copier/check 路径一致',
    '改为装 passthrough handler 后再断言拒绝文本（store.get: takes a key (host check) / store.set: value is not JSON data: undefined (host check)），并把"无 handler 不跑 check"写进测试注释与证据',
    '回归 11/11、家族 235/235、全量 1511/1511 通过；共享驱动 26 标记全出（新增 W45StoreEntryCompiled.v1）'],
  ['2026-10-17T02:00:00Z', 'verification', `W45-52 验收：新副本扫描 unresolved 0、账本 18 段逐段回源 + acorn 完整性、四条表项与 fW/Se/pt/Ce 回源自证、${chain}、回归 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    'store 子系统闭环，下一包转 settings.read 与设置存储',
    `check/build/notices；扫描 unresolved 0；${chain}；账本 18 段逐段回源比长度与内容 + acorn 断言（完整顶层语句、无重叠、无重复）；四条表项区间与 seam 引文逐字比对、fW 源文比对、Se 写/锁与 pt(onCompromised)、Ce 两处拒绝与一行日志、seam 导出与 id 回退回源断言；回归 ${seamSweep.passed}/${seamSweep.tests}；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45StoreEntryCompiled.v1，共享 ${sharedMarkers.length} 标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-52 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-52 acceptance (2026-10-16)

- [x] **The surface decided the package.** The four table entries were measured first (spans and text), then the bodies behind them, then the seam.
- [x] **The whole closure came across.** 18 whole top-level statements, 2,343 units, four chunks; chain verifier (${chain}) and \`unresolved 0\`.
- [x] **The entries are ported where they can be verified.** Table fragments, so verbatim in the seam with their spans quoted and asserted against the literal.
- [x] **Everything measured before it was asserted.** The file's shape and mode, the own-key read, both limits with exact counts, two writes not interleaving, the bound id, the backend slot, the lock handle and file, both malformed texts.
- [x] **The check path is the source's, not the expected one.** With no handler the call short-circuits to \`run\` and the check never runs; the test installs a handler before asserting a refusal.
- [x] **One plan grew instead of duplicating a name.** \`_\` joined the store-carry copy (shared guard and length reporter; this module's own \`Pe\` would collide), now 21 blocks / 2,217 units exporting \`_\`, \`L\`, \`Y\`.
- [x] **Sweep.** check/build/notices, scan \`unresolved 0\`, ${chain}, ledger, acorn and boundary checks, new suite ${seamSweep.passed}/${seamSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
