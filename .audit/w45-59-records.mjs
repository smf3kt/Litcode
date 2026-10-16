// Write the W45-59 record from the artifacts themselves: the mount side of the `$` table's raster surface
// — the register helper `Yto` and the two row writers `hNs` / `ELs` / `vLs` — the copy, the seam, and the
// suite that drives them through the ui.blit entry W45-58 ported.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 407, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 154, `validation ${identity.validation.files}`);
expect(identity.build.files === 282, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 58) throw new Error('the chain verifier did not pass 58 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const registry = read('scripts/verify-chain-copies.mjs');
if (!registry.includes("['W45-raster-mount', 'plugin-chain-raster-mount-source']")) throw new Error('the new plan is not registered');
const mountCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-raster-mount-source.ts'));
if (!mountCopy || mountCopy.blocks !== 2 || mountCopy.units !== 541) {
  throw new Error(`the mount copy is ${JSON.stringify(mountCopy)}, not the 2-block 541-unit one`);
}
const blitCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-ui-blit-source.ts'));
if (!blitCopy || blitCopy.blocks !== 7 || blitCopy.units !== 7852) throw new Error('the blit copy changed size');
const runnerCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-source.ts'));
if (!runnerCopy || runnerCopy.blocks !== 73 || runnerCopy.units !== 26233) throw new Error('the chain-runner copy changed size');
if (runnerCopy.sha256 !== '58c01b12f6b607e55a7568d11afb4120588721aa5d9637f979bb0ca42d0c7eff') {
  throw new Error('the chain-runner copy is not the one this package imports through');
}

const ledger = JSON.parse(read('src/plugin-chain-raster-mount-source-blocks.json'));
const expectedBlocks = [
  ['chunk-n3ykh62m.js', 256712, 257058, 346],
  ['chunk-sfn1dbxq.js', 1869519, 1869714, 195],
];
if (ledger.blocks.length !== 2) throw new Error(`the mount ledger holds ${ledger.blocks.length} blocks`);
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 541) throw new Error(`the mount ledger holds ${units} units`);
if (ledger.missing.length !== 0) throw new Error('the mount ledger reports missing names');
for (const [module, start, end, count] of expectedBlocks) {
  const block = ledger.blocks.find((b) => b.module === module && b.range[0] === start);
  if (!block || block.range[1] !== end || block.units !== count) {
    throw new Error(`${module} [${start},${end}) is not in the ledger as ${count} units`);
  }
}

// Every block is re-read from its module, compared with the copy, and checked against acorn: each is a
// contiguous run of whole top-level statements, no statement is cut, and no two overlap.
const sources = new Map();
const statements = new Map();
for (const module of new Set(ledger.blocks.map((block) => block.module))) {
  const text = read(`extracted-v2/modules/${module}`);
  let tree;
  try { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' }); }
  catch { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script' }); }
  sources.set(module, text);
  statements.set(module, tree.body.map((node) => ({ start: node.start, end: node.end })));
}
const copyText = read('src/plugin-chain-raster-mount-source.ts');
const claimed = new Map();
for (const block of ledger.blocks) {
  const [start, end] = block.range;
  if (end - start !== block.units) throw new Error(`${block.range} is not ${block.units} units`);
  const body = sources.get(block.module).slice(start, end);
  if (!copyText.includes(body)) throw new Error(`${block.module} ${JSON.stringify(block.range)} is no longer in the copy`);
  const all = statements.get(block.module);
  const inside = all.filter((node) => node.start >= start && node.end <= end);
  if (inside.length === 0 || inside[0].start !== start || inside[inside.length - 1].end !== end) {
    throw new Error(`${block.module} ${JSON.stringify(block.range)} does not start and end on statement boundaries`);
  }
  for (let index = 1; index < inside.length; index++) {
    if (inside[index - 1].end !== inside[index].start) throw new Error(`${block.range} skips a statement`);
  }
  if (all.some((node) => (node.start < start && node.end > start) || (node.start < end && node.end > end))) {
    throw new Error(`${block.range} cuts a statement in half`);
  }
  const key = `${block.module} ${block.range.join(',')}`;
  if (claimed.has(key)) throw new Error(`${key} is copied twice`);
  claimed.set(key, true);
}

// The four bodies, each read from its module at the measured boundary and located in the copy verbatim.
const mountModule = sources.get('chunk-n3ykh62m.js');
const imageModule = sources.get('chunk-sfn1dbxq.js');
const bodies = {
  Yto: mountModule.slice(256712, 256899),
  hNs: mountModule.slice(256899, 257058),
  ELs: imageModule.slice(1869519, 1869676),
  vLs: imageModule.slice(1869676, 1869714),
};
if (!bodies.Yto.startsWith('function Yto(e){let{sites:n,siteKey:r,mount:s,mountsOf:h,freshSite:y}=e,b=n.get(r)??y();')
  || !bodies.Yto.endsWith('if(w.delete(s),w.size===0&&n.get(r)===b)n.delete(r)}}')) {
  throw new Error('the register helper is not the measured `Yto`');
}
if (!bodies.hNs.includes("var hNs=(e)=>Yto({sites:hs(),siteKey:e5t(e.requestId,e.key,e.plugin),mount:e,mountsOf:(n)=>n.rasters,freshSite:()=>({rasters:new Set,windowStart:0,blits:0})})")) {
  throw new Error('the Raster writer is not the measured `hNs`');
}
if (!bodies.ELs.includes("var ELs=(e)=>Yto({sites:Yj(),siteKey:e5t(e.requestId,e.key,e.plugin),mount:e,mountsOf:(n)=>n.images,freshSite:()=>({images:new Set,windowStart:0,blits:0})})")) {
  throw new Error('the Image writer is not the measured `ELs`');
}
if (bodies.vLs !== 'var vLs=(e,n,r)=>({...e,...n,swap:r});') throw new Error('the element builder is not the measured `vLs`');
for (const [name, body] of Object.entries(bodies)) {
  if (!copyText.includes(body)) throw new Error(`the copy no longer carries ${name} verbatim`);
}
// The Image pair begins exactly where W45-58's last block ended: one module, no statement between them.
const blitTail = imageModule.slice(1868588, 1869519);
if (!blitTail.endsWith('function bFo(e){return"source"in e&&L(e.source)}')) throw new Error('the blit tail moved in its module');
const between = statements.get('chunk-sfn1dbxq.js').filter((node) => node.start >= 1869519 && node.start < 1869714);
if (between.length !== 2) throw new Error(`the Image block is ${between.length} statements, not the pair`);
// The registries and the site key are the blit copy's, not copied a second time.
for (const carried of ['hs', 'Yj', 'e5t']) {
  if (new RegExp(`(function|var|let|const)\\s+${carried}\\b`).test(copyText)) {
    throw new Error(`the mount copy declares ${carried} itself instead of importing the blit copy's`);
  }
}
if (!copyText.includes("import { e5t, hs, Yj } from './plugin-chain-ui-blit-source.js';")) {
  throw new Error('the mount copy does not import the registries and the site key from the blit copy');
}
// No import of the blit run or the fs boundary leaked into this copy: the mount side needs neither.
if (copyText.includes('plugin-chain-fs-boundaries')) throw new Error('the mount copy drags in the fs boundary');
if (/plugin-chain-ui-blit-source\.js';$[\s\S]*\b(kFo|mNs|Mss|fNs|bFo)\b/.test(copyText)) {
  throw new Error('the mount copy reaches into the blit run rather than just its registries');
}

// The seam: the four bodies quoted verbatim in its header, and the names a site calls.
const seam = read('src/plugin-chain-raster-mount.ts');
for (const [name, body] of Object.entries(bodies)) {
  if (!seam.includes(body)) throw new Error(`the seam header does not quote ${name}`);
}
for (const range of ['[256712,256899) 187 units', '[256899,257058) 159 units', '[1869519,1869676) 157 units', '[1869676,1869714) 38 units']) {
  if (!seam.includes(range)) throw new Error(`the seam header does not cite ${range}`);
}
for (const name of ['registerSiteMount', 'mountRaster', 'mountImage', 'withSwap', 'MountedRasterElement', 'MountedImageElement']) {
  if (!seam.includes(name)) throw new Error(`the seam does not export ${name}`);
}
if (!seam.includes("export { Yto, hNs, ELs, vLs } from './plugin-chain-raster-mount-source.js';")) {
  throw new Error('the seam does not re-export the copied bodies under their source names');
}
if (!seam.includes("import type { MountedImageSite, MountedRasterSite } from './plugin-chain-registry-state.js';")) {
  throw new Error('the seam does not type its elements from the registry state W45-58 added');
}
const registryState = read('src/plugin-chain-registry-state.ts');
for (const name of ['MountedRasterSite', 'MountedImageSite', 'mountedRasters', 'mountedImages']) {
  if (!registryState.includes(name)) throw new Error(`the registry state does not carry ${name}`);
}
// The suite drives the product seam, not the raw bodies.
const suite = read('test/plugin-chain-raster-mount.test.ts');
for (const name of ['registerSiteMount', 'mountRaster', 'mountImage', 'withSwap', 'raiseUiCall']) {
  if (!suite.includes(name)) throw new Error(`the suite does not exercise ${name}`);
}
if (suite.includes('plugin-chain-raster-mount-source.js')) throw new Error('the suite reaches past the seam to the copy');

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-59-tests.txt');
if (full.failed !== 0 || full.tests !== 1570) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-59-family.txt');
if (family.failed !== 0 || family.tests !== 294) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const mountSweep = summary('.audit/w45-59-raster-mount.txt');
if (mountSweep.failed !== 0 || mountSweep.tests !== 9) throw new Error('the mount sweep is not clean');
const scanSweep = read('.audit/w45-59-scan.txt');
if ((scanSweep.match(/unresolved 0/g) ?? []).length !== 2) throw new Error('the two scanned copies did not scan clean');
const span = JSON.parse(read('.audit/w45-59-span.txt'));
if (span.total !== 0) throw new Error(`the span scan found ${span.total}`);
const notices = JSON.parse(read('.audit/w45-59-notices.txt').split('\n').filter((line) => line.startsWith('{')).at(-1));
if (notices.sha256 !== '384c78801194aedea80331383ccd93708c2dfa46bc746003dc112c930b73d13c') {
  throw new Error('the dependency-notice digest moved');
}
const smokeReport = read('.audit/w45-59-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 290) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const allMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
const sharedMarkers = read('.audit/w45-59-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-59-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45RasterMountCompiled.v1')) throw new Error('the shared driver did not print the W45-59 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45RasterMountCompiled.v1 (${sharedMarkers.length} markers, ${allMarkers.length} across every driver: it drives the register helper's row reuse, its empties-only unregister and its same-row guard, then mounts a Raster through the seam and blits it, unmounts and reads the denial, and builds an Image through withSwap and swaps it through the entry)`;

const evidence = {
  schema: 'W45RasterMountEvidence.v1',
  package: "W45-59 — the mount side of the `$` table's raster surface",
  date: '2026-10-16',
  question: 'What fills the two registries the ui.blit entry reads — what is a site mount, what key does it write under, and what does its unregister take away?',
  answer: 'A site mount is `Yto(e)` (chunk-n3ykh62m.js [256712,256899) 187 units): it destructures `{sites, siteKey, mount, mountsOf, freshSite}`, takes `sites.get(siteKey) ?? freshSite()` as the row, adds the mount to `mountsOf(row)`, writes the row back under the key, and answers an unregister that deletes the mount and then deletes the key only when the set has emptied AND `sites.get(siteKey) === row`. The same row object is reused by every later mount under that key, so the row\'s blit window and count survive a remount, and a row someone else has replaced is left alone even when its set empties. `hNs` (chunk-n3ykh62m.js [256899,257058) 159 units) calls it against `hs()` — the mounted-raster registry — with the key `e5t(requestId, key, plugin)` and the row `{rasters: new Set, windowStart: 0, blits: 0}`; `ELs` (chunk-sfn1dbxq.js [1869519,1869676) 157 units) calls it against `Yj()` with `{images: new Set, windowStart: 0, blits: 0}`; and `vLs` ([1869676,1869714) 38 units) is the builder an Image site spreads its element and props through to gain its swap — `{...element, ...props, swap}`. Both writers read the registry through the memoized accessors the blit copy carries, so what a mount writes is what the ui.blit entry reads, and the key both sides compute is the same NUL-joined string.',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  planExtensions: [
    {
      plan: 'research/ports/W45-raster-mount-blocks.plan.json',
      what: 'a new plan, two blocks and four exports',
      blocks: '0 → 2 blocks, 541 units',
      why: 'each side is a pair of adjacent statements in its module — the register helper beside the writer that drives it — and both registries plus the site key are bodies the blit copy already carries, so they are imports',
    },
  ],
  boundary: 'No new boundary. `hs`, `Yj` and `e5t` are imported from ./plugin-chain-ui-blit-source.ts (W45-58 copy) rather than copied a second time, and the copy is asserted not to declare them; nothing here reaches the fs boundary or the blit run itself, only its registries. The two element shapes are typed from ./plugin-chain-registry-state.ts, whose `MountedRasterSite` / `MountedImageSite` rows W45-58 added, so a mount cannot be written in a shape the blit does not read.',
  measured: [
    'The register helper: the first mount under a key builds the row through `freshSite()`; a second mount under that key reuses the same row object (identity compared, not just equality) and `freshSite` runs once for that key; a different key builds its own row.',
    'The unregister: it deletes the mount and leaves the key while the set still holds one; the last unregister takes the key with it; a second call leaves the map as it was; and a row the map no longer holds survives untouched even when its set empties — the `sites.get(siteKey) === row` guard, driven by replacing the row between the mount and the unregister.',
    'The row holds a `Set`, so mounting the same element twice is one entry and the first unregister empties it.',
    '`hNs`: the key is `[plugin, requestId, key].join(NUL)`, the row appears in `mountedRasters()` holding the very element the site handed over, and its `windowStart`/`blits` start at 0; the unregister takes both the mount and the key.',
    '`ELs`: the same for `mountedImages()`.',
    '`vLs`: the props win over the element they spread, the element fields the props do not name survive, the swap is the third argument, and a `swap` carried among the props is overridden by the one the caller passes.',
    'The chain into W45-58: after `mountRaster`, `raiseUiCall({event: "ui.blit"})` paints that element and answers `{}`, and the row counts the blit; after the unregister the same call answers `no Raster of its own is mounted under key "k" in r`. After `mountImage` the entry calls the mounted element\'s swap with the source it was handed (the source object itself, not a decoded copy) and answers `{}`; a swap that answers a string is reported as `{deny: that string}`; after the unregister the Image denial is answered.',
    'A remount under a live key keeps the row, so the rate window and the blit count are the row\'s and not the mount\'s — measured by pre-seeding a row with `blits: 7` and watching the next accepted blit make it 8.',
    'The Image run reads `e.source`, so an argument carrying `png` instead goes down the Raster path and is refused with the Raster denial — measured while probing, and the reason the mount suite passes its source as `source: { png }`.',
  ],
  regressions: `the new mount suite ${mountSweep.passed}/${mountSweep.tests}; ${familyLine}`,
  full: fullLine,
  compiled: driverLine,
  smoke,
  next_package: [
    'the raster encoder and admission family that follows the mount pair in chunk-n3ykh62m.js: `fb`/`mb` the memoized token bucket ([253828,…)), `Sb` the refill ([253980,…)) and `$f` the cell encoder ([254123,…)), plus `tF` ([257058,…) — the statement immediately after this package\'s first block) and the Raster/Image site components (`Tc(jo, …)` in chunk-kjfwbh4w.js) that call the mount writers recorded here',
    'the remaining `$` table entries, each measured the same way first: `ui.scroll` (`O5n` 194u + `L5n` 808u + `mVe` 54u + `Nye` 39u), `ui.focus` (`fzo` 202u + `Szo` 532u + `mVe`), `ui.copy` (`wGo`/`uzo`/`dzo`, blocked on the clipboard encoder `Sv`), `state.get`/`state.set` (`Pur`/`Our`, `Iur`/`$ss`/`Hur`), `fs.ancestors` (`kNs` 492u)',
    'the plugin-facing `$` dispatcher `G2e` (chunk-sfn1dbxq.js [2356082,…)), the path that applies `raise` then `stamp` then `run`',
    'the settings read path behind `y9e` — measured at 590 statements / 327,047 units, of which 318,262 are fresh, so it is a subsystem to walk in pieces; the managed-settings gate `CT` (chunk-4bw62nzm.js) and `Tp` (chunk-wtch2p0g.js, 263u); Q-086\'s 15 registry-reading cores and their 34 sites; the notification provider `a4n`',
  ],
};
write('research/ports/W45-raster-mount-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-59 **补',
  features: "; W45-59 ports the site mount",
  standard: '2026-10-16 W45-59 ',
  status: 'W45-59:',
  runner: "## W45-59 ported the site mount",
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
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-59 **补"挂载侧"（谁把行写进 W45-58 那两个注册表）**：**2 段 541 单位**——chunk-n3ykh62m.js [256712,257058) 346u（登记器 \`Yto\` 187u + Raster 写入器 \`hNs\` 159u）+ chunk-sfn1dbxq.js [1869519,1869714) 195u（Image 写入器 \`ELs\` 157u + 元素成形器 \`vLs\` 38u；该段**紧接 W45-58 末段结尾 1869519**，同模块无间隔语句）。**语义（源文实测）**：\`Yto({sites,siteKey,mount,mountsOf,freshSite})\` 取 \`sites.get(siteKey)??freshSite()\` 为行、把 mount 加入 \`mountsOf(row)\`、回写并**返回注销器**；注销器先 \`delete(mount)\`，**仅当集合已空且 \`sites.get(siteKey)===row\` 才删键**——被他人替换过的行不动。**同一键的后续挂载复用同一行对象**，故行的 \`windowStart\`/\`blits\`（即 W45-58 的 120/秒窗口与计数）**跨重挂载延续**；\`hNs\` 对 \`hs()\` 写 \`{rasters:new Set,windowStart:0,blits:0}\`、\`ELs\` 对 \`Yj()\` 写 \`{images:new Set,…}\`，键同为 \`e5t(requestId,key,plugin)\`（NUL 连接），\`vLs\` 是 Image 站点 \`{...元素,...props,swap}\` 的成形器（props 盖过元素、swap 恒为第三参）。**复用而非重复**：\`hs\`/\`Yj\`/\`e5t\` 取 W45-58 的 blit 副本（**断言本副本不自声明**这三个名），元素形状取 W45-58 新增的注册表类型 \`MountedRasterSite\`/\`MountedImageSite\`，故"挂载"写不出 blit 读不了的形状。验收：check/build/notices（摘要未变）、两副本 \`unresolved 0\`、span \`total 0\`、**${chain}**、mount 账本 2 段逐段回源 + acorn（完整语句、无重叠、无切半、无重复）+ 四个正文逐字在 seam 头引用 + 段界与坐标引用 + Image 段紧接 blit 末段的连续性断言、新回归 ${mountSweep.passed}/${mountSweep.tests}、家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45RasterMountCompiled.v1\`，共享 ${sharedMarkers.length} 标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [挂载侧证据](ports/W45-raster-mount-evidence.json)、[ui.blit 证据](ports/W45-ui-blit-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
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
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-59 ports the site mount behind it: ` +
  'the register helper that builds a row on the first mount under a site key and reuses that same row afterwards, the unregister that ' +
  'takes the key only once its set has emptied and the map still holds that row, and the two writers that fill the Raster and Image ' +
  'registries the blit reads under the NUL-joined key, plus the builder an Image element gains its swap through. |';
write('research/FEATURES.md', lines.join('\n'));

const standardText = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standardText.indexOf('2026-10-16 W45-58');
if (standardAt < 0) throw new Error('coding-standard W45-58 line not found');
const standardEntry = `2026-10-16 W45-59 挂载侧（站点登记与两个行写入器）：S-1至S-7已对照。S-1（先读源）：W45-58 结束时已实测坐标，本包**先逐字读四个正文再动手**——\`Yto\` 的解构与 \`??y()\` 缺省、\`h(b).add(s)\` 与 \`n.set(r,b)\` 的顺序、注销器里 \`w.delete(s)\` 与 \`w.size===0&&n.get(r)===b\` 的合取、\`hNs\`/\`ELs\` 的 \`hs()\`/\`Yj()\` 与两行形状、\`vLs\` 的 \`{...e,...n,swap:r}\`；**两个注册表与站点键 \`e5t\` 是 blit 副本已有的正文**，故 import 而非二次拷贝，并新增断言"本副本不自声明 \`hs\`/\`Yj\`/\`e5t\`"。**关键取舍**：Image 段起点 1869519 **正是 W45-58 末段的终点**（同模块、无间隔语句），记录脚本把这条连续性写成断言；元素形状取注册表类型而非另立界面接口。S-2（不留半包）：新边界零；编码族（\`fb\`/\`mb\`/\`Sb\`/\`$f\`/\`tF\`）与站点组件（\`Tc(jo,…)\`）**不搬也不发明**，按实测坐标写进 next_package。S-3（先测后断言）：\`.audit/w45-59-probe.ts\`、\`-b\`、\`-c\`、\`-d\` 先跑再写 9 条断言；**两处按实测纠偏**——① 首版 Image 链探针把外观参数写成 \`png\`，而 \`kFo\` 读 \`e.source\`（\`bFo\` 判的是 \`"source" in e\`），故落进 Raster 路径答 Raster 拒答文案，改回 \`source:{png}\` 后测得正确路径；② \`swap\` 收到的**不是解码后的 Buffer 而是原 source 对象本身**（\`swap(h)\`），首版断言 \`Buffer.isBuffer\` 失败，改为按对象同一性断言。另实测确认 \`swap\` 的约定是**答 undefined 表示接受、答字符串表示拒绝**（答真值会被 \`xDe\` 包成 \`{deny:true}\`），与 W45-58 的 \`xDe(_e)\` 一致。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器（58 计划）与 ${drivers.length} 个编译驱动并解析输出，断言两副本 \`unresolved 0\`、span \`total 0\` 与 notices 摘要未变；acorn（完整语句、无重叠、无切半、无重复）+ 四正文回源 + 段界/坐标引用 + 连续性 + "不自声明被导入名" + "不伸进 blit 运行体"。S-5/S-6：seam 只加四个按名包装（\`registerSiteMount\`/\`mountRaster\`/\`mountImage\`/\`withSwap\`）、两个元素类型别名，并按源名再导出四个正文；测试只经 seam 调用（断言不 import 副本）；无死导出。S-7：编码族、其余 \`$\` 表项、\`G2e\`、\`y9e\` 读路径写入 next_package。验收：check/build/notices、两副本 unresolved 0、${chain}、账本与正文自证、回归 ${mountSweep.passed}/${mountSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standardText.slice(0, standardAt) + standardEntry + standardText.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf("W45-58: the `$` table's ui.blit entry.");
if (statusAt < 0) throw new Error('STATUS W45-58 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = 'W45-59: the mount side of the raster surface — what fills the two registries the ui.blit entry reads. Two blocks, 541 ' +
  'units, and each is a pair of adjacent statements in its module: `Yto` (the register helper, chunk-n3ykh62m.js [256712,256899) 187 units) ' +
  'with `hNs` ([256899,257058) 159 units), which calls it against `hs()` with the row `{rasters: new Set, windowStart: 0, blits: 0}`; and ' +
  '`ELs` (chunk-sfn1dbxq.js [1869519,1869676) 157 units — the statement immediately after W45-58\'s last block) with `vLs` ([1869676,1869714) ' +
  '38 units), which does the same for `Yj()` and `{images: new Set, …}`. The register helper builds the row through `freshSite()` only when ' +
  'the key holds none, writes the same row object back on every later mount, and answers an unregister that takes the key only once the ' +
  'set has emptied and the map still holds that row — so a row\'s rate window and blit count survive a remount, and a row someone else has ' +
  'replaced is left alone. Both writers key their row with `e5t`, the NUL-joined plugin/requestId/key the blit computes, so a mount and a ' +
  'blit agree on the row. The registries and the key are imports of the W45-58 copy rather than copies a second time, and the element ' +
  'shapes are typed from the registry-state rows that package added. Evidence: `research/ports/W45-raster-mount-evidence.json`, and\n' +
  '[工作包](ports/W45-chain-runner.md).\n\n';
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-59 ported the site mount (2026-10-16)

W45-58 ported the blit — what reads the registries. This package ports what fills them, measured at the same time and
named as the next package in that record. Two blocks, 541 units.

\`Yto\` (chunk-n3ykh62m.js [256712,256899) 187 units) is the register helper: it takes \`{sites, siteKey, mount, mountsOf, freshSite}\`,
resolves the row as \`sites.get(siteKey) ?? freshSite()\`, adds the mount to \`mountsOf(row)\`, writes the row back under the key, and
answers an unregister that deletes the mount and then deletes the key only when the set has emptied **and** \`sites.get(siteKey) === row\`.
Two properties follow from that body and are asserted rather than assumed: every later mount under a key writes into the *same* row
object, so a row's \`windowStart\` and \`blits\` — which is where the blit's 120-per-second window lives — survive a remount; and a row
someone else has replaced is left alone even when its set empties. The row holds a \`Set\`, so mounting one element twice is one entry.

\`hNs\` ([256899,257058) 159 units) drives it against \`hs()\`, the mounted-raster registry, with the key \`e5t(requestId, key, plugin)\`
and the row \`{rasters: new Set, windowStart: 0, blits: 0}\`. \`ELs\` (chunk-sfn1dbxq.js [1869519,1869676) 157 units) does the same for
\`Yj()\` and \`{images: new Set, windowStart: 0, blits: 0}\`; that block starts exactly where W45-58's last block ended, in the same
module, with no statement between them — the record script asserts that continuity. \`vLs\` ([1869676,1869714) 38 units) is the
builder an Image site spreads its element and props through to gain its swap: \`{...element, ...props, swap}\`, so the props win over
the element and the swap the caller passes is the one the blit will call.

\`hs\`, \`Yj\` and \`e5t\` are imports of the W45-58 blit copy, not copies a second time — the record asserts the mount copy does not
declare them, and that it reaches into neither the blit run nor the fs boundary. The element shapes are typed from the
\`MountedRasterSite\` / \`MountedImageSite\` rows that package added to ./plugin-chain-registry-state.ts, so a mount cannot be written in
a shape the blit does not read. The seam adds four named wrappers (\`registerSiteMount\`, \`mountRaster\`, \`mountImage\`, \`withSwap\`), the
two element aliases, and re-exports the bodies under their source names; the suite calls only the seam.

Two probe corrections, both measured rather than reasoned: the Image path reads \`e.source\` (\`bFo\` tests \`"source" in e\`), so an
argument carrying \`png\` instead goes down the Raster run and is refused with the Raster denial — the first probe did exactly that and
read a Raster sentence from an Image mount. And what a swap receives is the source object as it arrived, not a decoded buffer, so
the assertion is object identity. The swap's convention is the blit's own: \`undefined\` accepts, a string is the reason it refuses
(any truthy value is wrapped by \`xDe\` as \`{deny: that value}\`).

Verified: check/build/notices, both scanned copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, both ledger blocks re-read from
their modules and matched against the copy with acorn (whole statements, contiguous, no cut, no repetition), the four bodies quoted
verbatim in the seam header with their ranges, the continuity between the Image block and W45-58's, the "does not declare what it
imports" and "does not reach into the blit run" checks, the new suite ${mountSweep.passed}/${mountSweep.tests}, ${familyLine}, full
${fullLine}, ${drivers.length} compiled drivers (the shared driver now also prints \`W45RasterMountCompiled.v1\`), and the packaged smoke
(${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: the raster encoder and admission family that follows the mount pair in the same module (\`fb\`/\`mb\` the token bucket at
[253828,…), \`Sb\` the refill at [253980,…), \`$f\` the cell encoder at [254123,…), \`tF\` at [257058,…) — the statement right after
this package's first block) and the site components that call these writers (\`Tc(jo, …)\` in chunk-kjfwbh4w.js), then the remaining
\`$\` table entries (\`ui.scroll\`, \`ui.focus\`, \`ui.copy\`, \`state.get\`/\`state.set\`, \`fs.ancestors\`) and the dispatcher \`G2e\`. The
settings read path behind \`y9e\` stays the measured subsystem: 590 statements / 327,047 units, 318,262 of them fresh.
`);

const rows = [
  ['2026-10-17T08:02:00Z', 'package', 'W45-59 补 `$` 表光栅面的挂载侧（谁写入 W45-58 读的那两个注册表：2 段 541 单位 = Yto 187u + hNs 159u + ELs 157u + vLs 38u）',
    'Yto/registerSiteMount、hNs/mountRaster、ELs/mountImage、vLs/withSwap 成为产品面：seam 加四个按名包装 + 两个元素类型别名 + 四正文按源名再导出；元素形状取 W45-58 的注册表类型 MountedRasterSite/MountedImageSite',
    'chunk-n3ykh62m.js [256712,256899) 187u + [256899,257058) 159u；chunk-sfn1dbxq.js [1869519,1869676) 157u + [1869676,1869714) 38u（起点正是 W45-58 末段终点 1869519）',
    `实测（.audit/w45-59-probe{,b,c,d}.ts 与 test/plugin-chain-raster-mount.test.ts + .audit/w45-24-compiled.mjs）：行建造一次、同行对象复用、注销仅空且同行才删键、替换行存活、Set 去重、两写入器键与行形状、vLs 的 props/swap 优先级、挂载→blit 画/换→注销→拒答文案、重挂载延续 blits；9/9 通过`],
  ['2026-10-17T08:07:00Z', 'decision', 'W45-59 取舍：注册表与站点键 import 而非二次拷贝，元素形状取注册表类型',
    'hs/Yj/e5t 是 W45-58 blit 副本已有的正文（同一批块），重复拷贝会让同一定义出现两次；注册表类型已由 W45-58 命名为 MountedRasterSite/MountedImageSite',
    '新计划只 import { e5t, hs, Yj }；记录脚本新增断言"本副本不自声明 hs/Yj/e5t"、"不导入 fs 边界"、"不伸进 blit 运行体（kFo/mNs/Mss/fNs/bFo）"',
    `chain ${chain}；两副本 unresolved 0`],
  ['2026-10-17T08:11:00Z', 'finding', 'W45-59 实测纠偏两处：Image 链的参数名与 swap 的入参类型',
    '① 首版 Image 探针传 png，而 kFo 读 e.source（bFo 判 "source" in e），故落进 Raster 路径并答 Raster 拒答文案；② swap 收到的是原 source 对象本身（swap(h)），不是解码后的 Buffer',
    '① 改传 source:{png} 后测得正确路径（兑现 …swap… 文案）；② 断言改为对象同一性；并顺带实测确认 swap 约定为答 undefined 接受、答字符串拒绝（真值被 xDe 包成 {deny:true}）',
    '回归 9/9；证据 measured 第 7/8 条记录'],
  ['2026-10-17T08:15:00Z', 'verification', `W45-59 验收：两副本 unresolved 0、span total 0、mount 账本 2 段逐段回源 + acorn（无重叠/无切半/无重复）+ 四正文与坐标在 seam 头逐字 + Image 段紧接 blit 末段的连续性、${chain}、回归 ${mountSweep.passed}/${mountSweep.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    '挂载侧闭环：W45-58 的 ui.blit 读的两个注册表，现在有产品代码把它填起来；下一包转编码族（fb/mb/Sb/$f/tF）与站点组件 Tc(jo,…)',
    `check/build/notices；两副本 unresolved 0；span total 0；${chain}；mount 账本 2 段逐段回源比长度与内容 + acorn + 无重复断言；四个正文与四组坐标引用逐字；"不自声明被导入名"/"不导入 fs 边界"/"不伸进 blit 运行体"三条判据；seam 判据（四个包装 + 两别名 + 按源名再导出 + 类型来源）；注册表类型判据（两界面 + 两字段）；suite 只经 seam 调用（不 import 副本）；回归 9/9；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45RasterMountCompiled.v1，共享 ${sharedMarkers.length} 标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-59 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-59 acceptance (2026-10-16)

- [x] **The queue picked the package.** W45-58's record named the mount side as the next package and measured it while writing that one; this package ported exactly those four bodies and nothing else.
- [x] **The whole chain came across.** Two blocks, 541 units, each a pair of adjacent statements; the register helper, both writers, the element builder — and the continuity with W45-58's last block in the same module is asserted, not assumed.
- [x] **Obtainable source was copied, not bound.** \`hs\`, \`Yj\` and \`e5t\` come from the W45-58 blit copy and the copy is asserted not to declare them; the element shapes come from the registry-state rows that package added; nothing reaches the blit run or the fs boundary.
- [x] **Nothing was invented.** The encoder family and the site components are recorded as the next package with measured coordinates instead of being guessed at.
- [x] **Everything measured before it was asserted,** with two probe corrections recorded: the Image path reads \`e.source\`, and a swap receives the source object itself rather than a decoded buffer.
- [x] **The closed loop is driven end to end.** Mount through the product seam, blit through the W45-58 entry, the paint and the swap observed, the unregister, and the denial the entry then answers.
- [x] **Sweep.** check/build/notices, both copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, both ledger blocks with acorn, the four quoted bodies and their ranges, the continuity check, new suite ${mountSweep.passed}/${mountSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
// The state this record leaves behind, read back from disk: one entry per document, and no
// backslash-escaped code span anywhere.
const written = {
  'research/CURRENT.md': 'W45-59 **补',
  'research/STATUS.md': '\nW45-59:',
  'research/coding-standard.md': '\n2026-10-16 W45-59 ',
  'research/ports/W45-chain-runner.md': '\n## W45-59 ported',
  '.audit/w45-runtime.todo.md': '\n## W45-59 acceptance',
};
for (const [path, mark] of Object.entries(written)) {
  const text = read(path);
  const found = text.split(mark).length - 1;
  if (found !== 1) throw new Error(`${path} holds ${found} entries for ${JSON.stringify(mark)}`);
  if ((text.match(/\\`/g) ?? []).length !== 0) throw new Error(`${path} carries a backslash-escaped code span`);
}
const standardLines = read('research/coding-standard.md').split('\n').filter((line) => line.startsWith('2026-'));
if (new Set(standardLines).size !== standardLines.length) throw new Error('the coding standard repeats a one-line entry');
const stamps = read('.audit/w45-runtime.tsv').split('\n').filter((line) => line.startsWith('2026-10-17T08:')).map((line) => line.split('\t')[0]);
if (new Set(stamps).size !== stamps.length) throw new Error('the runtime trail repeats a timestamp');
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
