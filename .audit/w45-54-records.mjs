// Write the W45-54 record from the artifacts themselves: the settings source → file layer, its
// thirty-six copied blocks across five modules, the probe cache behind the ownership gate, and the
// store handle the probes are read through.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 397, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 149, `validation ${identity.validation.files}`);
expect(identity.build.files === 276, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 54) throw new Error('the chain verifier did not pass 54 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const copy = verifier.files.find((file) => file.product.endsWith('plugin-chain-settings-source-source.ts'));
if (!copy || copy.blocks !== 36 || copy.units !== 7881) throw new Error('the settings-source copy is not the 36-block, 7,881-unit one');
const probesCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-local-store-probes-source.ts'));
if (!probesCopy || probesCopy.blocks !== 1 || probesCopy.units !== 549) throw new Error('the probe-cache copy is not the 1-block, 549-unit one');
const carryCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-store-carry-source.ts'));
if (!carryCopy || carryCopy.blocks !== 21 || carryCopy.units !== 2217) {
  throw new Error('the store-carry copy changed beyond the W this package exports from it');
}

const ledger = JSON.parse(read('src/plugin-chain-settings-source-source-blocks.json'));
if (ledger.blocks.length !== 36) throw new Error('the settings-source ledger does not hold thirty-six blocks');
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 7881) throw new Error(`the ledger holds ${units} units`);
if (new Set(ledger.blocks.map((block) => block.module)).size !== 5) throw new Error('the ledger is no longer five modules');
const probesLedger = JSON.parse(read('src/plugin-chain-local-store-probes-source-blocks.json'));
if (probesLedger.blocks.length !== 1 || probesLedger.blocks[0].units !== 549) throw new Error('the probe-cache ledger is not the one 549-unit block');
for (const file of ['src/plugin-chain-settings-source-source.ts', 'src/plugin-chain-local-store-probes-source.ts']) {
  const scan = execFileSync(process.execPath, ['scripts/source-undeclared-scan.mjs', file], { encoding: 'utf8' });
  if (!/unresolved 0/.test(scan)) throw new Error(`${file} has unresolved names`);
}
// The store-carry plan gained one export and nothing else: the ENOENT test the settings resolver
// reads out of the same module W45-51 copied it from.
const carryPlan = JSON.parse(read('research/ports/W45-store-carry-blocks.plan.json'));
if (carryPlan.exports.join(',') !== 'ye,he,vt,mR,_,L,Y,W') throw new Error('the store-carry plan exports changed beyond W');
if (carryPlan.blocks.length !== 21) throw new Error('the store-carry plan gained a block');

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
const copyText = read('src/plugin-chain-settings-source-source.ts');
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
const settings = sources.get('chunk-3cynezh1.js').text;
for (const [needle, count] of [
  ['function GW(e,n){switch(e){', 264],
  ['function TO(e){switch(e){', 148],
  ['function Ynn(e,n){switch(e){', 349],
  ['function Z$s(e){if(typeof process.getuid!==', 1124],
  ['function b_(e){let n=ie()', 167],
  ['function m_(){return Se(eC(),', 54],
  ['function k_(e){if(e.coworkPlugins', 103],
]) {
  const block = ledger.blocks.find((entry) => settings.slice(...entry.range).startsWith(needle));
  if (!block || block.units !== count) throw new Error(`${needle} is not the ${count}-unit body this record describes`);
}
const bodyOf = (needle) => {
  const block = ledger.blocks.find((entry) => settings.slice(...entry.range).startsWith(needle));
  if (!block) throw new Error(`${needle} is not copied`);
  return settings.slice(...block.range);
};
// What the bodies say, re-read from the source rather than from memory.
if (!bodyOf('function GW(e,n){switch(e){').includes('"projectSettings":case"localSettings":{if(n.cwd===null&&n.projectConfigDir===void 0)return;return Se(Ynn(e,n),TO(e))}')) {
  throw new Error('the resolver lost its project/local branch, or the null guard changed');
}
if (!bodyOf('function Ynn(e,n){switch(e){').includes('case"policySettings":return fe(FWn(n))')) {
  throw new Error('the directory resolver no longer answers the cwd for the policy source');
}
if (!bodyOf('function TO(e){switch(e){').includes('return Se(".claude","settings.json")')) {
  throw new Error('the project name is no longer a relative path under .claude');
}
if (!bodyOf('function Z$s(e){if(typeof process.getuid!==').includes('so the store stays at the session cwd (canonicalization is POSIX-only)')) {
  throw new Error('the no-uid-semantics warn text changed');
}
if (!bodyOf('function b_(e){let n=ie()').includes('return{rootUid:n.statSync(e).uid,gitEntryUid:E_(e),claudeEntryUid:s}')) {
  throw new Error('the ownership triple changed');
}
// The decision's second parameter is a function, not a path: `pTr` calls it with the path.
const decision = settings.slice(...ledger.blocks.find((entry) => settings.slice(...entry.range).startsWith('function pTr(e,n){')).range);
if (!decision.includes('let s=n?.(e)')) throw new Error('the canonical-root resolver no longer calls its second argument');
// The facade and the probe cache: the module's own text, at the recorded spans.
const facade = sources.get('chunk-gyf58rwf.js').text;
if (facade.slice(80312, 80336) !== 'function ie(){return Vy}') throw new Error('the facade accessor moved in its module');
if (!copyText.includes('function ie(){return Vy}')) throw new Error('the copy no longer holds the facade accessor');
const store = sources.get('chunk-4bw62nzm.js').text;
if (!store.slice(16313, 16862).startsWith('class Ht{ownerUidsByRoot=new Map;realHomeDir=void 0;')) {
  throw new Error('the probe cache moved in its module');
}
if (!read('src/plugin-chain-local-store-probes-source.ts').includes('class Ht{ownerUidsByRoot=new Map;'))
  throw new Error('the probe-cache copy lost the class');
// The handle: the source's own `ji` is quoted in the boundary, and the boundary owns the default.
const boundary = read('src/plugin-chain-local-store.ts');
for (const fragment of ['function ji(){return Ixr.of(B().host)}', 'export function ji()', 'export function bindLocalStore(',
  'localStoreProbes=new Ht', 'new Ht()']) {
  if (!boundary.includes(fragment)) throw new Error(`the store boundary lost ${fragment}`);
}
// The seam: the names it exposes, and the two measured corrections it records.
const seam = read('src/plugin-chain-settings-source.ts');
for (const fragment of ['export function settingsFilePath(', 'export function settingsSourceDirectory(',
  'export function settingsSourceRelativePath(', 'export function settingsFileName(', 'export const SETTINGS_FILE_NAMES',
  'export function managedSettingsPath(', 'export function managedSettingsDir(', 'export function managedSettingsDropInDir(',
  'export function resetManagedSettingsCache(', 'export function claudeDirectory(', 'export function localSettingsRoot(',
  'export function canonicalRootOwnedByUser(', 'export function normalizedRealHomeDir(', 'export function realHomeDir(',
  'export function realpathOrNull(', 'export function normalizePath(', 'export const NoProjectDirectoryError',
  'export function sourceCwd(', 'export function sourceFs(']) {
  if (!seam.includes(fragment)) throw new Error(`the seam lost ${fragment}`);
}
if (!seam.includes('not a bare file name')) throw new Error('the seam no longer records that TO is a relative path');
if (!seam.includes('canonicalRootGitRoot') && !seam.includes('canonicalGitRoot?: ((path: string) => string | null | undefined)')) {
  throw new Error('the seam no longer types the canonical git root as a function');
}

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-54-tests.txt');
if (full.failed !== 0 || full.tests !== 1526) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-54-family.txt');
if (family.failed !== 0 || family.tests !== 250) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const seamSweep = summary('.audit/w45-54-seam.txt');
if (seamSweep.failed !== 0 || seamSweep.tests !== 8) throw new Error('the settings-source sweep is not clean');

const smokeReport = read('.audit/w45-54-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 284) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const allMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
const sharedMarkers = read('.audit/w45-54-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-54-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45SettingsSourceCompiled.v1')) throw new Error('the shared driver did not print the W45-54 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45SettingsSourceCompiled.v1 (${sharedMarkers.length} markers in the shared driver, ${allMarkers.length} across every driver: it resolves every source to its file and directory from the dist copy, throws the source's own no-project-directory error, reads the managed-settings cache, takes the canonical root only for a root the user owns — with the source's own warn line when it cannot — and proves the probes are read through the store handle)`;

const evidence = {
  schema: 'W45SettingsSourceEvidence.v1',
  package: 'W45-54 — the settings source → file layer',
  date: '2026-10-16',
  question: 'What file backs each settings source, where does it live, and what decides between the session cwd and the canonical local-settings root?',
  answer: '`GW(source, ctx)` is the resolver every settings read goes through: `userSettings` is the `.claude` directory joined with the settings file name, `projectSettings`/`localSettings` are the resolved source directory joined with `.claude/settings.json` and `.claude/settings.local.json`, `policySettings` is `managed-settings.json` inside the managed directory, and `flagSettings` is the context\'s flag path. `Ynn` is the directory behind that, and it answers the *cwd* for a policy source — the managed directory is reached through `m_`, not through that branch. `RN`/`pTr`/`Z$s` are the local-settings decision: when the cwd and its canonical git root differ and the root is not the real home directory, the root wins only if the root, its `.git` entry and its `.claude` entry are all owned by the current user; otherwise the store stays at the session cwd and the source writes one of three warn lines. The closure this package copied is 36 whole top-level statements, 7,881 units across five chunks, plus the local store\'s probe cache (`Ht`, 549 units) which the ownership gate is reached through.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  portedProbeCache: probesLedger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  boundary: 'Two boundaries, both recorded rather than approximated. First, the local store the ownership probes are reached through: the source\'s `ji` is `Ixr.of(B().host)` and `Ixr` is the whole store class, so `src/plugin-chain-local-store.ts` owns the handle — but its default is the source\'s own, because the field the copied bodies read (`localStoreProbes`) is a class this package carries whole, so the probes are real and no refusal is needed. Second, the config context: the source\'s `M()` builds a ~30-field object and passes it to all of these; the copied bodies read five fields, so the seam names exactly those (`cwd`, `projectConfigDir`, `flagPath`, `coworkPlugins`, `canonicalGitRoot`) and takes them from its caller. Two pieces of shared infrastructure come with the copy rather than bounding: the fs facade `ie()` (3,270 units, the object every module in the bundle reads through) and the realpath cache `lA`/`Hp`. Names the product already holds are imported, not duplicated: `t`/`a`, `E`, `O`, `po`, and `W` (the last from the store-carry copy, whose plan this package extends with one export and no block).',
  measured: [
    'Every source resolves to the file the source names: user → `<claude>/settings.json`, project → `<cwd>/.claude/settings.json`, local → `<cwd>/.claude/settings.local.json`, policy → the managed settings file, flag → the context\'s flag path. A name that is not a source, and a flag source with no flag path, answer `undefined`.',
    'The directory resolver answers the cwd for a policy source — measured, not assumed: the managed directory is reached through `m_` in the file resolver, and `Ynn`\'s policy branch is `resolve(cwd)`.',
    '`TO` is a relative path, not a bare file name: it answers `.claude/settings.json` and `.claude/settings.local.json`, which is why the project and local files are joined under the directory rather than named directly.',
    'The null guard is strict: a context with `cwd: null` and no project directory answers `undefined` from the file resolver and throws the source\'s own no-project-directory error (`NoProjectDirectoryError`, "This session has no working directory.") from the directory resolver — while `cwd: undefined` falls through both `===null` checks and fails inside `path.resolve`.',
    'The managed settings file is `<directory>/managed-settings.json` in `<directory>/managed-settings.d`\'s parent, and both the path and the drop-in directory are cached in one instance (`Ad`) until `resetManagedSettingsCache()`. The directory itself falls back to a per-platform default, because the override `Oko` answers nothing in this build.',
    'The settings file name is `settings.json`, or `cowork_settings.json` when the context asks for it or the environment flag is set; the `.claude` directory is remembered after the first read; and the home realpath is NFC-normalized.',
    'The ownership gate answers true only when the root, its `.git` entry and its `.claude` entry are all owned by the current user — measured on a fixture the test creates and owns. A fixture without `.git` warns "its ownership could not be verified (ENOENT: … )", and a root owned by another user warns "it (uid …), its .git entry (uid …), or its .claude entry (uid …) is not owned by the current user (uid …)".',
    'The root is preferred only when it is owned: with an owned root the local settings resolve to it, with an unowned root they stay at the session cwd, and a root equal to the cwd or equal to the real home directory never wins.',
    'The probe cache remembers *answers*, not throws: an owned root is answered from the cache on the second ask with no new warn line, while a path whose probe threw is probed again and warns again.',
    'The probes are read through the store handle: with a bound handle the gate answers the handle\'s triple and writes the uid-mismatch warn line, and unbinding restores the source\'s own cache.',
    'The canonical git root in the context is a *function* (`canonicalGitRoot: TP`), not a path: the decision calls it with the cwd. A seam that typed it as a string would have been wrong, and the measurement is what caught that.',
  ],
  behaviour_changed: [
    'The settings source → file layer is product behaviour: the file and directory behind each of the five sources, the managed-settings file/directory/drop-in with its cache, the user settings file name, the ownership gate and the local-settings root decision are all answerable from the product, with the source\'s own paths, warn texts and error class.',
    'The fs facade `ie()` and the realpath helpers came with it, so later packages whose bodies read files through `ie()` no longer need to bind it.',
    'The local store\'s probe cache `Ht` is ported into its own copy, and `src/plugin-chain-local-store.ts` owns the store handle with the source\'s own class as its default — the seam the next package\'s readers (`mergedSettings`, `perSource`, `repoTierFreeze`) will be added to.',
    'The store-carry plan grew by one export (`W`, the ENOENT test) and no block: it is the same body the settings resolver reads out of the same module, so exporting it is cheaper and more honest than copying it twice.',
    'No product file changed behaviour on another path: the only edits outside the two new copies, the two seams, the suite and the probes are the two plan entries, the registry entry and the shared driver printing its marker.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'both new copies: unresolved 0',
    chain_verifier: chain,
    ledger_check: 'all 36 ranges are re-read from their five modules, compared with the ledger, searched for in the copy, and checked against acorn: every block is a whole top-level statement and none is copied twice; the probe-cache block is checked the same way',
    boundary_check: 'the resolver\'s project/local branch and its strict null guard, the policy branch\'s cwd answer, `TO`\'s relative path, the no-uid-semantics warn text and the ownership triple are re-read from the source; `pTr`\'s call of its second argument, the facade accessor and the probe cache are asserted in their modules and in the copies; the store boundary quotes the source\'s `ji` and holds the probe-cache default; the seam\'s exports and its two measured corrections are asserted present',
    regressions: `the new settings-source suite ${seamSweep.passed}/${seamSweep.tests}; ${familyLine}`,
    full: fullLine,
    compiled: driverLine,
    smoke,
  },
  next_package: [
    'the settings *read* path behind `y9e` (`Qnn` + `$t`, 325,824 units) and the merge behind `bTr` (335,278 units), now that the file each source reads is resolved — the two largest items in the queue, and the ones that turn this layer\'s answers into parsed settings',
    'the local store\'s remaining fields the settings readers need (`mergedSettings`, `perSource`, `repoTierFreeze`, `isLoadingFromDisk`), added to the handle `src/plugin-chain-local-store.ts` already owns',
    'the managed-settings gate `CT`/`Tp` (61,983 units) that `fe` consults before a read, which would let `settings.read` drop its bound hook',
    'registering the `store.*`, `settings.read` and remaining `ui.*` cores in the product\'s chain catalog once the product has a `$` surface to call them from',
    '`http.fetch` (`VQt`) once the request runner `dNo` is ported',
    '`ui.copy` (`wGo`/`uzo`/`dzo`) once the clipboard encoder `Sv` is ported, with the `stamp` field modelled',
    '`ui.blit` (`fNs`/`kFo`/`mNs`/`bFo`), `ui.scroll` (`O5n`/`L5n`), `ui.focus` (`fzo`/`Szo`), `ui.notify` (`Dzo`/`Fzo`/`Nzo`), each measured the same way first',
    '`fs.ancestors` (`mzt`/`kNs`) and `state.get`/`state.set` (`Jf`/`KD`)',
    'Q-086\'s 15 registry-reading cores and their 34 sites',
  ],
};
write('research/ports/W45-settings-source-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-54 **搬 settings 源→文件层',
  features: "; W45-54 ports the settings source → file layer",
  standard: '2026-10-16 W45-54 settings 源→文件层',
  status: 'W45-54: the settings source → file layer.',
  runner: '## W45-54 ported the settings source → file layer',
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
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-54 **搬 settings 源→文件层**（\`settings.read\` 读之前先要拿到"读哪个文件"）：**36 段 7,881 单位**、跨五模块（chunk-3cynezh1.js 的 \`vd\`/\`Ad\`/\`eC\`/\`My\`/\`Oko\`/\`m_\`/\`Ynn\`/\`FWn\`/\`RN\`/\`pTr\`/\`Q$s\`/\`b_\`/\`E_\`/\`Z$s\`/\`fTr\`/\`w_\`/\`UE\`/\`k_\`/\`GW\`/\`TO\`、chunk-gyf58rwf.js 的 \`Xs\`/\`Qs\`/\`ih\`/\`pi\`/\`hi\`/\`kY\`/**\`Vy\`（全束 fs facade 3,270u）**/\`ie\`/\`ID\`、chunk-4bw62nzm.js 的 \`an\`/\`GP\`、chunk-nqc6v990.js 的 \`o\`/\`be\`、chunk-ae84tp6z.js 的 \`lA\`/\`Hp\`/\`On\`）+ **本地 store 探针缓存 \`Ht\` 独立副本 1 段 549 单位**。**语义（源文实测）**：\`GW(source,ctx)\` 是唯一入口——user= \`.claude\` 目录 + 文件名、project/local= 解析目录 + \`.claude/settings.json\`/\`.claude/settings.local.json\`（**\`TO\` 是相对路径不是文件名**）、policy= 托管目录下的 \`managed-settings.json\`、flag= ctx 的 flagPath（无则 undefined，未知名亦 undefined）；\`Ynn\` 是背后的目录，**policy 分支答的是 \`resolve(cwd)\`**（托管目录走 \`m_\` 不走这里，实测纠偏）；\`RN\`/\`pTr\`/\`Z$s\` 是本地设置根决策——cwd 与 canonical git root 不同且 root 非真实家目录时，**只有 root、其 \`.git\`、其 \`.claude\` 三者 uid 都属于当前用户**才取 root，否则留在 session cwd 并按三种情形写源自己的 warn 原文。**边界二处**：① \`ji()\`（源 \`Ixr.of(B().host)\`，\`Ixr\` 是整个 local store 类）由 \`src/plugin-chain-local-store.ts\` 持句柄，**但默认值是源自己的**——copied 正文只读 \`localStoreProbes\` 一个字段，而那就是同模块里本包整段搬来的 \`Ht\`，故探针是真的、无需拒绝；② 源的 \`M()\`（~30 字段）只被读到五个（\`cwd\`/\`projectConfigDir\`/\`flagPath\`/\`coworkPlugins\`/\`canonicalGitRoot\`），seam 只命名这五个。**先测后断言**（.audit/w45-54-probe.ts 与 test/plugin-chain-settings-source.test.ts 8 条）：五源文件与目录、\`TO\` 相对路径、flag 无路径 undefined、**\`cwd:null\` 与 \`cwd:undefined\` 的区别**（前者 file 答 undefined / dir 抛 \`NoProjectDirectoryError\` "This session has no working directory."，后者两个 \`===null\` 都不中、在 \`path.resolve\` 里炸）、托管文件/目录/落点目录与 \`reset\` 后一致、设置文件名（cowork）、\`.claude\` 目录与家目录 realpath 的 NFC、facade 有 \`lstatSync\`/\`statSync\`、**拥有权闸三答案**（自建 \`.git\`+\`.claude\` 夹具为真；缺 \`.git\` 走"无法验证"warn；他人 uid 走 uid 不匹配 warn，两段文本逐字断言）、**根只在被拥有时胜出**（等同 cwd 或等同真实家目录都不胜）、**探针缓存只记"答案"不记"抛错"**（第二次问 owned 不再写日志，抛过错的路径会重探并再写）、**探针经 store 句柄读取**（绑假句柄答 uid 不匹配、解绑回源自身缓存）。验收：check/build/notices、两副本扫描 \`unresolved 0\`、**${chain}**、账本 37 段逐段回源+内容比对+**acorn 断言"每段都是完整顶层语句、无重叠"**、GW 的 project/local 分支与严格 null 守卫、Ynn 的 policy 分支、TO 相对路径、无 uid 语义 warn 原文、所有权三元组、\`pTr\` 调第二个参数、facade 与探针缓存双向回源、seam 19 处导出与两处实测纠偏、新回归 ${seamSweep.passed}/${seamSweep.tests}、插件链家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45SettingsSourceCompiled.v1\`，共享 ${sharedMarkers.length} 标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [settings 源层证据](ports/W45-settings-source-evidence.json)、[settings.read 证据](ports/W45-settings-read-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
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
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-54 ports the settings source → file layer: the file and directory behind each of the five sources, the managed-settings cache, the ownership gate that decides between the session cwd and the canonical local-settings root, and the fs facade those probes read through. |`;
write('research/FEATURES.md', lines.join('\n'));

const standard = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standard.indexOf('2026-10-16 W45-53 settings.read');
if (standardAt < 0) throw new Error('coding-standard W45-53 line not found');
const standardEntry = `2026-10-16 W45-54 settings 源→文件层：S-1至S-7已对照。S-1（先读源）：由 \`hGo\` 正文里那两行 \`ft()\`/\`fe(J9[n])\` 反查到 \`fe\` 的 \`y9e\`/\`M\`，量出 \`y9e\` 闭包 590 语句 / 327,047 单位、\`bTr\` 609 语句 / 335,278 单位、\`CT\` 234 语句 / 61,983 单位后判定"读"不是本包；转而量 \`GW\`/\`Ynn\`/\`TO\`/\`m_\`/\`k_\` + 本地根决策簇 = 20 段 3,601 单位，再补其真实依赖（fs facade 9 段 3,792u、探针缓存 549u、错误类 127u、\`.claude\` 2 段 108u、realpath 3 段 253u）共 36 段 7,881 单位。S-2（不留半包）：facade 与 realpath 缓存**整段搬运而非绑定**（源文可得，按硬规则不许发明）；\`ji()\` 因 \`Ixr\` 是整个 local store 类而设边界，**但其默认值是源自己的 \`Ht\`**，因此探针是真探针而非空壳，且把"local store 其余字段留给下一包"写进 seam 与证据。S-3：\`.audit/w45-54-probe.ts\` 先实测（五源文件/目录、\`cwd:null\` 与 \`undefined\` 的分野、托管缓存与 reset、三答案拥有权闸与两段 warn 原文、缓存只记答案不记抛错、句柄可换），再写 8 条断言；两处按实测纠偏：**\`Ynn\` 的 policy 分支答 cwd 而不是托管目录**、**\`canonicalGitRoot\` 是函数不是路径**（首版 seam 按字符串定参数，探针以 \`ERR_INVALID_ARG_TYPE\` 当场否掉）。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器/打包冒烟/${drivers.length} 个编译驱动并解析输出；acorn 断言（完整顶层语句、无重叠、无重复）+ 关键正文片段（project/local 分支、严格 null 守卫、policy 分支、\`TO\` 相对路径、无 uid 语义 warn、所有权三元组、\`pTr\` 调参）+ facade 与探针缓存双向回源。S-5/S-6：seam 只做命名与类型收窄（19 个导出），boundary 只暴露句柄与默认值；无死导出。S-7：\`y9e\`/\`Qnn\`/\`$t\`/\`bTr\` 读与合并、\`CT\`/\`Tp\` 托管闸、local store 其余字段、\`$\` 表面注册、\`http.fetch\`、\`ui.copy\`、\`ui.blit\`/\`scroll\`/\`focus\`/\`notify\`、\`fs.ancestors\`、\`state.*\`、Q-086 写入 next_package。验收：check/build/notices、两副本扫描 unresolved 0、${chain}、账本与边界自证、回归 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf("W45-53: the `$` table's `settings.read`.");
if (statusAt < 0) throw new Error('STATUS W45-53 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-54: the settings source → file layer. \`GW(source, ctx)\` resolves every settings read to its file — user settings are the \`.claude\` directory joined with the settings file name, project and local are the resolved directory joined with \`.claude/settings.json\` and \`.claude/settings.local.json\`, policy is \`managed-settings.json\` inside the managed directory, and flag is the context's flag path — while \`Ynn\` is the directory behind that, and answers the *cwd* for a policy source (measured; the managed directory is reached through \`m_\`). The local-settings decision is \`RN\`/\`pTr\`/\`Z$s\`: the canonical git root wins over the session cwd only when the root, its \`.git\` entry and its \`.claude\` entry are all owned by the current user, and the three warn lines it writes when it keeps the store where it is are the source's own. 36 whole top-level statements, 7,881 units across five chunks, plus the local store's probe cache \`Ht\` in its own 549-unit copy. Two boundaries, both recorded: the local store handle (\`ji\` is \`Ixr.of(B().host)\` and \`Ixr\` is the whole store class) — but its default is the source's own probe cache, so the probes are real and no refusal is needed — and the config context, whose ~30 fields the copied bodies read five of. The fs facade \`ie()\` and the realpath cache came with the copy rather than bounding, because the source text is obtainable. Measured before asserted: every source's file and directory, \`TO\` being a relative path rather than a name, the strict \`===null\` guard that makes \`cwd: null\` and \`cwd: undefined\` behave differently, the managed-settings cache, the ownership gate's three answers with their warn texts, the probe cache remembering answers but not throws, and the probes being read through the handle. Evidence: \`research/ports/W45-settings-source-evidence.json\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-54 ported the settings source → file layer (2026-10-16)

\`settings.read\` reaches \`fe(source, M())\` for the file to read; this package is what turns a source
name into that file. \`GW(source, ctx)\` is the resolver — user settings are the \`.claude\` directory
joined with the settings file name, project and local are the resolved directory joined with
\`.claude/settings.json\` and \`.claude/settings.local.json\`, policy is \`managed-settings.json\` inside
the managed directory, and flag is the context's flag path — and \`Ynn\` is the directory behind it.
The local-settings decision is \`RN\`/\`pTr\`/\`Z$s\`: when the cwd and its canonical git root disagree
and the root is not the real home directory, the root wins only if the root, its \`.git\` entry and its
\`.claude\` entry are all owned by the current user; otherwise the store stays at the session cwd and
one of three warn lines says why. The closure is 36 whole top-level statements, 7,881 units across
five chunks, plus the local store's probe cache \`Ht\` in its own 549-unit copy.

Two boundaries, both recorded rather than approximated. The local store handle: the source's \`ji\` is
\`Ixr.of(B().host)\` and \`Ixr\` is the whole store class, so src/plugin-chain-local-store.ts owns the
handle — but its default is the source's own, because the only field the copied bodies read
(\`localStoreProbes\`) is a class this package carries whole, so the probes are real and no refusal is
needed. The config context: the source's \`M()\` builds about thirty fields and passes it to all of
these, and the copied bodies read five, so the seam names exactly those. The fs facade \`ie()\` and the
realpath cache came with the copy instead of bounding, because their source text is obtainable — which
is what the hard rule asks for.

Measured before asserted, and two measurements corrected the port: the directory resolver answers the
*cwd* for a policy source (the managed directory is reached through \`m_ in the file resolver\`, not
through that branch), and the context's \`canonicalGitRoot\` is a *function* the decision calls with the
cwd rather than a path — a seam that typed it as a string fails inside \`path.resolve\`, which is how
the probe caught it. Also measured: \`TO\` is a relative path rather than a bare file name; the null
guard is strict, so \`cwd: null\` answers \`undefined\` from the file resolver and throws
\`NoProjectDirectoryError\` from the directory resolver while \`cwd: undefined\` falls through both
\`===null\` checks; the managed-settings path and drop-in directory are cached in one instance until
reset; the ownership gate's three answers carry the source's own warn texts; the probe cache remembers
answers but not throws; and the probes are read through the store handle, since binding a handle
changes the answer and unbinding restores it.

Verified: check/build/notices, both new copies \`unresolved 0\`, ${chain}, the two ledgers, acorn and
boundary checks, the new suite ${seamSweep.passed}/${seamSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled
drivers (the shared driver now also prints \`W45SettingsSourceCompiled.v1\`), and the packaged smoke
(${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: the settings *read* path behind \`y9e\` (\`Qnn\` + \`$t\`, 325,824 units) and the merge behind \`bTr\`
(335,278 units), which are what turn these answers into parsed settings; then the managed-settings gate
\`CT\`/\`Tp\` (61,983 units) that would let \`settings.read\` drop its bound hook, and the local store's
remaining fields, which belong on the handle this package created.
`);

const rows = [
  ['2026-10-17T03:10:00Z', 'package', 'W45-54 搬 settings 源→文件层（$ settings.read 读之前的"读哪个文件"；36 段 7,881 单位跨五模块 + 探针缓存 1 段 549 单位）',
    'GW/Ynn/TO/m_/k_/UE + 本地根决策 RN/pTr/Q$s/b_/E_/Z$s/fTr/w_ + 托管缓存 vd/Ad/eC/My/Oko + fs facade Vy/ie/ID + realpath lA/Hp/On + .claude 的 o/be + 错误类 an/GP 成为产品面：五源文件与目录、托管文件/目录/落点、所有权闸三答案与源自己的 warn 原文',
    'chunk-3cynezh1.js 20 段（vd [359965,360273) 308u、Ad [360273,360287) 14u、eC [360287,360332) 45u、My [360332,360539) 207u、Oko [360539,360561) 22u、m_ [387272,387326) 54u、Ynn [398204,398553) 349u、FWn [398553,398611) 58u、RN [398611,398733) 122u、pTr [398733,398952) 219u、Q$s [398952,399026) 74u、b_ [399026,399193) 167u、E_ [399193,399278) 85u、Z$s [399278,400402) 1124u、fTr [400402,400472) 70u、w_ [400472,400577) 105u、UE [400716,400779) 63u、k_ [400779,400882) 103u、GW [400882,401146) 264u、TO [401146,401294) 148u）；chunk-gyf58rwf.js 9 段（Xs/Qs/ih/pi/hi/kY/Vy [77042,80312) 3270u/ie [80312,80336) 24u/ID）；chunk-4bw62nzm.js 2 段（an/GP）；chunk-nqc6v990.js 2 段（o/be）；chunk-ae84tp6z.js 3 段（lA/Hp/On）；探针缓存 Ht chunk-4bw62nzm.js [16313,16862) 549u',
    `实测（.audit/w45-54-probe.ts 与 test/plugin-chain-settings-source.test.ts + .audit/w45-24-compiled.mjs）：五源文件与目录、TO 相对路径、cwd:null 与 undefined 的分野、托管缓存与 reset、拥有权闸三答案与两段 warn 原文、缓存只记答案不记抛错、根只在被拥有时胜出、句柄可换；8/8 通过`],
  ['2026-10-17T03:13:00Z', 'finding', 'W45-54 实测纠偏一：Ynn 的 policy 分支答 cwd，不是托管目录',
    '首版按"policy 的目录就是托管目录"写断言，实测 settingsSourceDirectory("policySettings") 返回 resolve(cwd) —— 托管目录只经 m_ 出现在文件解析里',
    '断言与 seam 注释一并改正为"file 走 m_、dir 走 FWn"，并把这条写进证据与工作包',
    '回归 8/8 通过；编译驱动同口径断言'],
  ['2026-10-17T03:16:00Z', 'finding', 'W45-54 实测纠偏二：context 的 canonicalGitRoot 是函数不是路径',
    '首版 seam 把 localSettingsRoot 第二参数与 ctx.canonicalGitRoot 都按字符串定型，探针以 ERR_INVALID_ARG_TYPE（pTr 内部 n?.(e)）当场否掉；源里 M() 写的是 canonicalGitRoot: TP，TP 是 (path)=>string|null',
    '两处类型改为函数（canonicalGitRoot?: (path) => string | null | undefined），并把"决策会用 cwd 调它"写进 seam 注释与证据',
    '回归 8/8、家族 250/250、全量 1526/1526 通过'],
  ['2026-10-17T03:20:00Z', 'verification', `W45-54 验收：两副本扫描 unresolved 0、账本 37 段逐段回源 + acorn 完整性、GW 严格 null 守卫与 TO 相对路径、Ynn policy 分支、pTr 调参、facade/探针缓存双向回源、${chain}、回归 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    'settings 子系统"读哪个文件"闭环，下一包转 y9e 的读路径与 bTr 的合并',
    `check/build/notices；两副本 unresolved 0；${chain}；账本 36+1 段逐段回源比长度与内容 + acorn 断言（完整顶层语句、无重叠、无重复）；GW project/local 分支与 n.cwd===null 守卫、Ynn case"policySettings":return fe(FWn(n))、TO 的 Se(".claude","settings.json")、Z$s 无 uid 语义 warn 原文、b_ 的所有权三元组、pTr 的 n?.(e)、facade [80312,80336) 与 Ht [16313,16862) 双向比对、seam 19 处导出与两处纠偏存在性；回归 8/8；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45SettingsSourceCompiled.v1，共享 ${sharedMarkers.length} 标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-54 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-54 acceptance (2026-10-16)

- [x] **The dependency chain picked the package.** \`settings.read\`'s body reaches \`fe\`; \`fe\` reaches \`y9e\`/\`CT\`; those close over 327k and 62k units, so the layer that *resolves* the file was taken instead, sized from \`GW\`'s own closure.
- [x] **The whole closure came across.** 36 whole top-level statements, 7,881 units, five chunks, plus the probe cache in its own 549-unit copy; chain verifier (${chain}) and \`unresolved 0\` on both.
- [x] **Obtainable source was copied, not bound.** The fs facade \`ie()\` (3,270 units) and the realpath cache came across, because the hard rule asks for the source body when it exists.
- [x] **The two boundaries are recorded.** The local store handle has the source's own probe cache as its default, so the probes are real and no refusal is invented; the config context is named field by field rather than approximated.
- [x] **Two measurements corrected the port.** The directory resolver answers the cwd for a policy source, and the context's canonical git root is a function, not a path.
- [x] **Everything measured before it was asserted.** Every source's file and directory, \`TO\`'s relative path, the strict null guard, the managed-settings cache, the ownership gate's three answers with the source's own warn texts, the cache remembering answers but not throws, and the handle being the read path.
- [x] **Sweep.** check/build/notices, both scans \`unresolved 0\`, ${chain}, the ledgers, acorn and boundary checks, new suite ${seamSweep.passed}/${seamSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
