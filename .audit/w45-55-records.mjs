// Write the W45-55 record from the artifacts themselves: the settings merge layer, its fifty-two
// copied blocks, the four plan extensions it needed, and the Stack class the merge walks its nested
// objects with.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 400, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 150, `validation ${identity.validation.files}`);
expect(identity.build.files === 278, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);

const verifier = JSON.parse(execFileSync(process.execPath, ['scripts/verify-chain-copies.mjs'], { encoding: 'utf8' }));
if (verifier.passed !== true || verifier.files.length !== 55) throw new Error('the chain verifier did not pass 55 plans');
const chain = `passed ${verifier.passed}, ${verifier.files.length} plans`;
const copy = verifier.files.find((file) => file.product.endsWith('plugin-chain-settings-merge-source.ts'));
if (!copy || copy.blocks !== 52 || copy.units !== 4033) throw new Error('the merge copy is not the 52-block, 4,033-unit one');
const internalsCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-lodash-internals-source.ts'));
if (!internalsCopy || internalsCopy.blocks !== 153 || internalsCopy.units !== 11297) {
  throw new Error('the lodash-internals copy is not the 153-block, 11,297-unit one');
}
const memoizeCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-lodash-memoize-source.ts'));
if (!memoizeCopy || memoizeCopy.blocks !== 20 || memoizeCopy.units !== 1231) {
  throw new Error('the lodash-memoize copy gained a block beyond its three exports');
}
const sourceCopy = verifier.files.find((file) => file.product.endsWith('plugin-chain-settings-source-source.ts'));
if (!sourceCopy || sourceCopy.blocks !== 37 || sourceCopy.units !== 8041) {
  throw new Error('the settings-source copy is not the 37-block, 8,041-unit one');
}

const ledger = JSON.parse(read('src/plugin-chain-settings-merge-source-blocks.json'));
if (ledger.blocks.length !== 52) throw new Error('the merge ledger does not hold fifty-two blocks');
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
if (units !== 4033) throw new Error(`the ledger holds ${units} units`);
if (new Set(ledger.blocks.map((block) => block.module)).size !== 1) throw new Error('the merge ledger is no longer one module');
const internalsLedger = JSON.parse(read('src/plugin-chain-lodash-internals-source-blocks.json'));
if (internalsLedger.blocks.length !== 153) throw new Error('the lodash-internals ledger is not the 153-block one');
const internalsUnits = internalsLedger.blocks.reduce((sum, block) => sum + block.units, 0);
if (internalsUnits !== 11297) throw new Error(`the lodash-internals ledger holds ${internalsUnits} units`);
for (const [file, count] of [['src/plugin-chain-settings-merge-source.ts', 52],
  ['src/plugin-chain-lodash-internals-source.ts', 153],
  ['src/plugin-chain-lodash-memoize-source.ts', 20],
  ['src/plugin-chain-settings-source-source.ts', 37]]) {
  const scan = execFileSync(process.execPath, ['scripts/source-undeclared-scan.mjs', file], { encoding: 'utf8' });
  if (!/unresolved 0/.test(scan)) throw new Error(`${file} has unresolved names`);
  const file3 = JSON.parse(read(file.replace(/\.ts$/, '-blocks.json')));
  if (file3.blocks.length !== count) throw new Error(`${file} ledger is not the ${count}-block one`);
}

// The four plans this package touched: the merge plan is new, and the other three grew by exactly
// what the merge closure reads out of them.
const mergePlan = JSON.parse(read('research/ports/W45-settings-merge-blocks.plan.json'));
if (mergePlan.exports.join(',') !== 'MB,Y3,CHt,ic') throw new Error('the merge plan exports changed');
if (mergePlan.blocks.length !== 52) throw new Error('the merge plan is not the fifty-two-block one');
if (!mergePlan.imports.some((line) => line === 'var Cn = undefined;')) throw new Error('the merge plan lost its ported free-name declaration');
const internalsPlan = JSON.parse(read('research/ports/W45-lodash-internals-source-blocks.plan.json'));
for (const name of ['k1e', 'U8e', 'zw', 'A1e', 'nsn', 'D8e', 'osn', 'pG', 'Zon', 'Lxr']) {
  if (!internalsPlan.exports.includes(name)) throw new Error(`the lodash-internals plan does not export ${name}`);
}
if (internalsPlan.exports.join(',') !== 'uU,zZ,zpe,zse,qMt,wwe,xxr,$8e,Cxr,KMt,L8e,Pxr,Rxr,T1e,YMt,k1e,U8e,zw,A1e,nsn,D8e,osn,pG,Zon,Lxr') {
  throw new Error('the lodash-internals plan exports changed beyond the closure');
}
const memoizePlan = JSON.parse(read('research/ports/W45-lodash-memoize-source-blocks.plan.json'));
if (memoizePlan.exports.join(',') !== 'Eo,e1e,don,e8e') throw new Error('the lodash-memoize plan exports changed');
const sourcePlan = JSON.parse(read('research/ports/W45-settings-source-blocks.plan.json'));
if (sourcePlan.exports.at(-1) !== 'vse') throw new Error('the settings-source plan no longer ends with the local-path export');
if (sourcePlan.blocks.length !== 37) throw new Error('the settings-source plan is not the thirty-seven-block one');

// Every block is re-read from its module, compared with the ledger, searched for in the copy, and
// checked against acorn: each one has to be a whole top-level statement, and no two may overlap.
const sources = new Map();
const statements = new Map();
for (const module of new Set([...ledger.blocks, ...internalsLedger.blocks].map((block) => block.module))) {
  const text = read(`extracted-v2/modules/${module}`);
  let tree;
  try { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' }); }
  catch { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script' }); }
  sources.set(module, text);
  statements.set(module, tree.body.map((node) => ({ start: node.start, end: node.end })));
}
const mergeText = read('src/plugin-chain-settings-merge-source.ts');
const internalsText = read('src/plugin-chain-lodash-internals-source.ts');
for (const [blocks, copyText, label] of [[ledger.blocks, mergeText, 'merge'], [internalsLedger.blocks, internalsText, 'internals']]) {
  const seen = new Set();
  for (const block of blocks) {
    const [start, end] = block.range;
    if (end - start !== block.units) throw new Error(`${label} ${block.range} is not ${block.units} units`);
    const body = sources.get(block.module).slice(start, end);
    // A block covers whole top-level statements and nothing else: the first starts at the block's
    // start, the last ends at its end, they are contiguous, and no statement is cut in half. A block
    // may span several statements — the stack methods came across as one eleven-statement range.
    const all = statements.get(block.module);
    const inside = all.filter((node) => node.start >= start && node.end <= end);
    if (inside.length === 0 || inside[0].start !== start || inside[inside.length - 1].end !== end) {
      throw new Error(`${label} ${block.module} ${JSON.stringify(block.range)} does not start and end on statement boundaries`);
    }
    for (let index = 1; index < inside.length; index++) {
      if (inside[index - 1].end !== inside[index].start) {
        throw new Error(`${label} ${block.module} ${JSON.stringify(block.range)} skips a statement`);
      }
    }
    if (all.some((node) => (node.start < start && node.end > start) || (node.start < end && node.end > end))) {
      throw new Error(`${label} ${block.module} ${JSON.stringify(block.range)} cuts a statement in half`);
    }
    if (seen.has(`${block.module}:${start}`)) throw new Error(`${label} ${block.module} ${start} is copied twice`);
    seen.add(`${block.module}:${start}`);
    if (!copyText.includes(body)) throw new Error(`${label} ${block.note.slice(0, 40)} is no longer in the copy`);
  }
  // No two blocks of a copy may overlap either.
  const sorted = blocks.map((block) => block.range).sort((a, b) => a[0] - b[0]);
  for (let index = 1; index < sorted.length; index++) {
    if (sorted[index][0] < sorted[index - 1][1]) throw new Error(`${label} ${sorted[index]} overlaps ${sorted[index - 1]}`);
  }
}
// Statement order is load-bearing for the classes the merge walks: the aliases are `var`s, so a
// prototype assignment that runs before its method body is assigned keeps `undefined`.
const internalsOrder = internalsLedger.blocks.map((block) => block.range[0]);
const orderOf = (at) => internalsOrder.indexOf(at);
for (const [before, after, what] of [
  [1620, 2162, 'the stack method bodies come before the prototype assignments that point at them'],
  [2100, 2162, 'the stack constructor comes before the prototypes it carries'],
  [2272, 2514, 'the SetCache method bodies come before its prototype assignments'],
  [2421, 2514, 'the SetCache constructor comes before its prototypes'],
]) {
  if (!(orderOf(before) < orderOf(after))) throw new Error(`the copy lost the source order: ${what}`);
}

// The bodies this record names, located by the text they start with, with the unit counts it states.
const merge = sources.get('chunk-3cynezh1.js');
const bodyOf = (from, needle) => {
  const source = sources.get(from);
  const block = (from === 'chunk-4bw62nzm.js' ? internalsLedger : ledger).blocks
    .find((entry) => source.slice(...entry.range).startsWith(needle));
  if (!block) throw new Error(`${needle} is not copied`);
  return source.slice(...block.range);
};
if (bodyOf('chunk-3cynezh1.js', 'function CHt(e,n){return{...e,...n}}') !== 'function CHt(e,n){return{...e,...n}}') {
  throw new Error('the one-level override body changed');
}
if (bodyOf('chunk-3cynezh1.js', 'function Y3(e,n,s){') !== 'function Y3(e,n,s){if(s==="modelPicker"&&n!==void 0)return ic(n);'
  + 'if(Array.isArray(e)&&Array.isArray(n)){if(s==="fallbackModel")return n;return D([...e,...n])}'
  + 'if((s==="extraKnownMarketplaces"||s==="managedMcpServers")&&L(e)&&L(n))return CHt(e,n);return}') {
  throw new Error('the settings merge customizer changed');
}
if (bodyOf('chunk-3cynezh1.js', 'function ic(e){') !== 'function ic(e){if(!L(e))return e;let n=e.options;'
  + 'return{...e,...Array.isArray(n)&&{options:n.map((s)=>L(s)?{...s}:s)}}}') {
  throw new Error('the modelPicker normalizer changed');
}
// The merge itself: `mergeWith` is the assigner `Tf` bound through `Ml`, whose wrapped body is the
// four-argument `baseMerge` call — the arity `createAssigner` checks to keep a customizer.
const mergeWith = bodyOf('chunk-3cynezh1.js', 'var Pf=Ml(');
if (mergeWith !== 'var Pf=Ml(function(e,n,s,r){Cl(e,n,s,r)}),MB=Pf;') {
  throw new Error('the mergeWith binding changed');
}
if (bodyOf('chunk-3cynezh1.js', 'var Ml=Tf;') !== 'var Ml=Tf;') throw new Error('the assigner binding changed');
if (!bodyOf('chunk-3cynezh1.js', 'function Tf(e){').includes('if(d=e.length>3&&typeof d=="function"?(i--,d):void 0,')) {
  throw new Error('createAssigner no longer keeps a customizer by arity');
}
if (!bodyOf('chunk-3cynezh1.js', 'function Al(e,n,s,r,i){').includes('if(i||(i=new k1e),aA(d))vl(e,n,c,s,Al,r,i);')) {
  throw new Error('baseMerge no longer builds its stack');
}
if (!bodyOf('chunk-3cynezh1.js', 'function yf(e,n,s,r,i,d,c){').startsWith('function yf(e,n,s,r,i,d,c){var g=jt(e,s),m=jt(n,s),f=c.get(m);')) {
  throw new Error('baseMergeDeep no longer reads the merge stack');
}
// The stack the merge walks nested objects with, and the free name the port makes explicit.
const store = sources.get('chunk-4bw62nzm.js');
if (store.slice(2100, 2162) !== 'function P(e){var t=this.__data__=new Qpt(e);this.size=t.size}') {
  throw new Error('the stack constructor moved in its module');
}
if (store.slice(2162, 2262) !== 'P.prototype.clear=Ze;P.prototype.delete=et;P.prototype.get=tt;P.prototype.has=nt;P.prototype.set=ot;') {
  throw new Error('the stack prototype assignments moved in their module');
}
if (store.slice(1620, 2100).length !== 480) throw new Error('the stack method bodies moved');
for (const fragment of ['function Pn(){this.__data__=new Qpt,this.size=0}', 'var Ze=Pn;', 'function An(e){', 'var et=An;',
  'function Mn(e){', 'var tt=Mn;', 'function wn(e){', 'var nt=wn;', 'function In(e,t){', 'var ot=In;', 'var Ln=200;']) {
  if (!store.slice(1620, 2100).includes(fragment)) throw new Error(`the stack method bodies lost ${fragment}`);
}
if (store.slice(2272, 2421) !== 'var Fn="__lodash_hash_undefined__";function En(e){return this.__data__.set(e,Fn),this}'
  + 'var rt=En;function Dn(e){return this.__data__.has(e)}var it=Dn;') {
  throw new Error('the SetCache methods moved in their module');
}
if (bodyOf('chunk-4bw62nzm.js', 'function Qr(e){') !== 'function Qr(e){return function(t,o,r){var i=-1,s=Object(t),a=r(t),l=a.length;'
  + 'while(l--){var d=a[e?l:++i];if(o(s[d],d,s)===!1)break}return t}}') {
  throw new Error('the collection walker changed');
}
if (bodyOf('chunk-4bw62nzm.js', 'var Xr=Bt(),Lxr=Xr;') !== 'var Xr=Bt(),Lxr=Xr;') {
  throw new Error('the baseEach binding changed');
}
const port = mergePlan.imports.join('\n');
if (!port.includes('`Cn` has no declaration anywhere in the chunk')) throw new Error('the port note lost the free-name finding');
if (!mergeText.includes('var Cn = undefined;')) throw new Error('the copy lost the ported free-name declaration');
if (!mergeText.includes('var _l=typeof Rn=="object"&&Rn&&!Rn.nodeType&&Rn,fl=_l&&typeof Cn=="object"')) {
  throw new Error('the copied CommonJS preamble changed');
}
// The legacy local path this package added to the settings-source copy, looked up in that ledger.
const sourceLedger = JSON.parse(read('src/plugin-chain-settings-source-source-blocks.json'));
const vseBlock = sourceLedger.blocks.find((entry) => merge.slice(...entry.range).startsWith('function vse(e){'));
if (!vseBlock || vseBlock.units !== 160) throw new Error('the vse block is not the 160-unit one');
const localPath = merge.slice(...vseBlock.range);
if (localPath !== 'function vse(e){if(e.cwd===null||RN(e.cwd,e.canonicalGitRoot)===fe(e.cwd))return;'
  + 'if(e.projectConfigDir!==void 0)return;return Se(fe(e.cwd),TO("localSettings"))}') {
  throw new Error('the local settings path changed');
}
if (!read('src/plugin-chain-settings-source-source.ts').includes(localPath)) throw new Error('the settings-source copy lost vse');
// The seam: the names it exposes, the call sites it names, and the reach it does not invent.
const seam = read('src/plugin-chain-settings-merge.ts');
for (const fragment of ['export function mergeSettings<T extends object>(', 'export const settingsMergeCustomizer',
  'export function normalizeModelPicker(', 'export function shallowSettingsOverride(']) {
  if (!seam.includes(fragment)) throw new Error(`the seam lost ${fragment}`);
}
if (!seam.includes('`MB(r,s,Y3)` on `e.store.pluginBase`')) throw new Error('the seam no longer names the accumulation it ports');
if (!seam.includes('`Qnn` and `bTr` are')) throw new Error('the seam no longer names the reach it does not port');
const sourceSeam = read('src/plugin-chain-settings-source.ts');
if (!sourceSeam.includes('export function localSettingsPath(')) throw new Error('the settings-source seam lost the local path');
if (!sourceSeam.includes('Qnn`, chunk-3cynezh1.js [427468,')) throw new Error('the local path no longer cites its caller');

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^ℹ ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { text, tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
const full = summary('.audit/w45-55-tests.txt');
if (full.failed !== 0 || full.tests !== 1533) throw new Error('no clean full-sweep summary');
const fullLine = `${full.tests} tests / ${full.passed} pass / ${full.failed} fail on the frozen tree`;
const family = summary('.audit/w45-55-family.txt');
if (family.failed !== 0 || family.tests !== 257) throw new Error('the chain family sweep is not clean');
const familyLine = `the chain family (test/plugin-chain-*.test.ts) ${family.passed}/${family.tests}`;
const seamSweep = summary('.audit/w45-55-seam.txt');
if (seamSweep.failed !== 0 || seamSweep.tests !== 7) throw new Error('the merge sweep is not clean');
const scanSweep = read('.audit/w45-55-scan.txt');
if ((scanSweep.match(/unresolved 0/g) ?? []).length !== 4) throw new Error('the four copies did not all scan clean');
const span = JSON.parse(read('.audit/w45-55-span.txt'));
if (span.total !== 0) throw new Error(`the span scan found ${span.total}`);
const notices = JSON.parse(read('.audit/w45-55-notices.txt').split('\n').filter((line) => line.startsWith('{')).at(-1));
if (notices.sha256 !== '384c78801194aedea80331383ccd93708c2dfa46bc746003dc112c930b73d13c') {
  throw new Error('the dependency-notice digest moved');
}

const smokeReport = read('.audit/w45-55-smoke.txt').split('\n').filter((line) => line.startsWith('{'))
  .map((line) => { try { return JSON.parse(line); } catch { return null; } })
  .filter((report) => report?.package === 'passed').at(-1);
if (!smokeReport) throw new Error('the packaged report was not found');
if (smokeReport.upstreamRequests !== 0) throw new Error('the packaged smoke reached upstream');
if (smokeReport.files !== 286) throw new Error(`the packaged smoke packed ${smokeReport.files} files`);
const smoke = `pack ${smokeReport.files} files, offline install, help, --demo and the launcher driver pass; upstreamRequests ${smokeReport.upstreamRequests}`;

const drivers = fs.readdirSync('.audit').filter((name) => name.endsWith('-compiled.mjs')).sort();
const allMarkers = [];
for (const driver of drivers) {
  const out = execFileSync(process.execPath, [`.audit/${driver}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  allMarkers.push(...out.split('\n').filter((line) => /^W45.*Compiled\.v1$/.test(line.trim())).map((line) => line.trim()));
}
const sharedMarkers = read('.audit/w45-55-driver-output.txt').split('\n')
  .map((line) => line.trim()).filter((line) => /^W45.*Compiled\.v1$/.test(line));
const expectedMarkers = read('.audit/w45-55-drivers.txt').split('\n').filter((line) => line.trim() !== '');
if (sharedMarkers.join(',') !== expectedMarkers.join(',')) {
  throw new Error(`the shared driver prints ${sharedMarkers.length} markers, the list holds ${expectedMarkers.length}`);
}
if (!sharedMarkers.includes('W45SettingsMergeCompiled.v1')) throw new Error('the shared driver did not print the W45-55 marker');
const driverLine = `all ${drivers.length} compiled drivers exit 0; the shared driver now also prints W45SettingsMergeCompiled.v1 (${sharedMarkers.length} markers in the shared driver, ${allMarkers.length} across every driver: it deep-merges from the dist copy, accumulates into the target it is handed, terminates on a cyclic source — the path that walks the merge stack, so a stack class copied without its prototype methods fails here — takes the array union and the fallbackModel replacement, replaces the picker, one-level-overrides the two map fields, and answers the legacy local path only when the store root is not the session cwd)`;

const evidence = {
  schema: 'W45SettingsMergeEvidence.v1',
  package: 'W45-55 — the settings merge layer',
  date: '2026-10-16',
  question: 'When several settings sources are folded into one object, what does "merge" mean per key?',
  answer: '`bTr` opens with `MB(r, e.store.pluginBase, Y3)` and then merges every source into the same accumulator with `MB(r, $t(T, N, e), Y3)`; the per-source reader `Qnn` answers `MB(i||{}, d, Y3)` for the flag file and `MB(c, i||{}, Y3)` for the legacy local file. `MB` is lodash `mergeWith` and `Y3` is the customizer that defines settings merging: `modelPicker` with a defined value is normalized by `ic` (the picker spread, its `options` array elements spread in turn when they are plain objects); two arrays concatenate and deduplicate (`D([...target, ...source])`) except `fallbackModel`, which takes the source array outright; `extraKnownMarketplaces` and `managedMcpServers` take a one-level override when both sides are plain objects; every other key returns `undefined`, which is how a customizer asks lodash for the default deep merge. The closure this package copied is 52 whole top-level statements, 4,033 units, all in chunk-3cynezh1.js: the 49 lodash-merge internals statements spanning [340302,343952) plus `CHt` [428230,428266), `Y3` [428266,428518) and `ic` [428518,428637).',
  ported: ledger.blocks.map((block) => ({
    module: block.module,
    range: block.range,
    units: block.units,
    bodySha256: block.bodySha256,
    note: block.note,
  })),
  planExtensions: [
    {
      plan: 'research/ports/W45-lodash-internals-source-blocks.plan.json',
      what: 'the `Lxr` walker the merge iterates collections with (3 blocks, 170 units) plus the four blocks the merge stack needed (784 units: the `P` prototype assignments, the five stack method bodies and their aliases, the `Fn` sentinel and the SetCache methods), and the ten exports the closure reads',
      blocks: '149 → 153, units 10,513 → 11,297',
      why: 'the closure that seeded the W45-14 copy followed declaration use, so a class whose methods are assigned on its prototype came across as a constructor alone; the merge layer builds `new k1e` and reads it back with `stack.get`/`stack.set`/`stack.delete`, which is where the gap surfaced',
    },
    {
      plan: 'research/ports/W45-lodash-memoize-source-blocks.plan.json',
      what: 'the `e1e`, `don` and `e8e` exports (no block: the bodies were already copied)',
      blocks: '20 blocks, 1,231 units, unchanged',
    },
    {
      plan: 'research/ports/W45-settings-source-blocks.plan.json',
      what: '`vse`, the legacy local settings path — 1 block, 160 units, and its export',
      blocks: '36 → 37, units 7,881 → 8,041',
      why: 'it is the path `Qnn` takes its legacy local branch through, and its whole closure was already in the copy',
    },
  ],
  boundary: 'No new boundary. Every name the copied bodies close over resolves to a copy the product already carries: `D` (the dedupe) and `L` (the plain-object test), the lodash internals, and the memoize helpers. The reach behind the layer is not ported and the seam does not invent it: `Qnn` and `bTr` (325,824 and 335,278 units of schema-driven reading, with the file reader `FB`/`$t` inside them) are the callers, and `mergeSettings` is the seam a ported read path calls. One port is recorded in the plan rather than in code: the copied CommonJS preamble reads a module reference the minifier left free as `Cn`, which has no declaration anywhere in the chunk — the bundle takes the same false arm an ESM copy does — so the plan declares `var Cn = undefined;` with the span and the reason quoted.',
  measured: [
    'The customizer\'s rules, measured key by key: an ordinary key answers `undefined` (lodash\'s default deep merge), any two arrays answer the deduplicated union — the array rule is *not* keyed, so an unrelated array field unions too — `fallbackModel` answers the source array, `extraKnownMarketplaces` and `managedMcpServers` answer a one-level spread when both sides are plain objects, `modelPicker` with a defined value answers the normalized source, and `modelPicker` with an undefined source value falls through.',
    '`mergeSettings` deep-merges plain keys, so `{a:{x:1}}` merged with `{a:{y:2}}` is `{a:{x:1,y:2}}`; the nested objects are *copies*, not the source\'s objects.',
    'The merge accumulates into the target it is handed and returns the same object — which is how `bTr` folds sources into one `r`.',
    '`modelPicker` replaces rather than merges: a key the source picker does not carry is gone from the result. The normalized picker is a shallow spread of the source, each plain-object `options` element spread in turn, and an `options` that is not an array is left as it stands.',
    'The two map fields one-level-override: a shared entry takes the source\'s value outright (a nested key the source omits is lost) while a sibling entry on either side survives.',
    'An array target with an object source is lodash\'s own answer and a strange one: the array keeps its elements and the source\'s keys land on it as own properties. `JSON.stringify` hides this (it prints an array\'s index properties only), which is why the suite asserts it property by property.',
    'An `undefined` source value never overwrites, and `undefined`/`null` sources leave the target alone.',
    'A cyclic source terminates: the merge stack guards the cycle, and the self-reference in the result is the copy made for the cycle rather than the target.',
    '`vse` answers a path only when the store root is not the session cwd: no canonical git root, a root equal to the cwd, a root whose ownership cannot be verified, or a set project config directory all answer `undefined`; with an owned root elsewhere the answer is the *session cwd*\'s `.claude/settings.local.json`, with the cwd resolved first.',
    'The Stack class was the defect: `P` (the constructor) had been copied by W45-14 without its five prototype assignments or their bodies, so `new k1e()` had no `.get` and the first nested merge threw `TypeError: c.get is not a function`. The four blocks that close the gap are 784 units, and the compiled driver asserts the nested-merge path so the gap cannot come back.',
    'Statement order is load-bearing in these copies: the prototype aliases are `var`s, so a prototype assignment that runs before its method body is assigned keeps `undefined`. The first attempt ordered the blocks by edit rather than by source, and `P.prototype.get` was `undefined`; the plan now carries the four blocks in source order and the ledger is checked for it.',
  ],
  behaviour_changed: [
    'The settings merge layer is product behaviour: `mergeSettings(target, ...sources)` folds settings sources exactly as a read does, with the source\'s per-key rules, and `settingsMergeCustomizer`, `normalizeModelPicker` and `shallowSettingsOverride` expose the three rules the customizer is built from.',
    '`localSettingsPath` joins the settings-source seam, so the file a legacy local read takes is answerable from the product.',
    'The lodash-internals copy now carries the Stack and SetCache classes whole, which every later package that reads the merge internals gets for free — and which is a fidelity fix, not a new feature: the constructor alone was never the class the source runs.',
    'No product file changed behaviour on another path: the only edits outside the new copy, the seam, the suite and the probes are the four plan entries, the registry entry, the shared driver section and its imports.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: `pass (installed ${notices.installed}, missingText ${notices.missingText.length}, digest unchanged)`,
    scan: 'all four copies: unresolved 0',
    span_scan: `total ${span.total} over ${span.scanned} files`,
    chain_verifier: chain,
    ledger_check: 'all 52 merge blocks and all 153 lodash-internals blocks are re-read from their modules, compared with the ledger, searched for in the copy, and checked against acorn: every block is a whole top-level statement and none is copied twice; the source order of the stack and SetCache blocks is asserted, not assumed',
    body_check: '`CHt`, `Y3` and `ic` are compared byte for byte with the source, `mergeWith`\'s binding and the arity check that keeps the customizer, `baseMerge`\'s stack construction, `baseMergeDeep`\'s stack read, the stack constructor and its five prototype assignments, the SetCache methods, the walker `Qr` and `Lxr`, the copied CommonJS preamble and the ported `Cn` declaration, and `vse` — every one re-read from the module rather than from memory',
    seam_check: 'the four merge exports, the call sites the seam names, the reach it does not port, and the settings-source seam\'s `localSettingsPath` with its `Qnn` citation are asserted present',
    regressions: `the new merge suite ${seamSweep.passed}/${seamSweep.tests}; ${familyLine}`,
    full: fullLine,
    compiled: driverLine,
    smoke,
  },
  next_package: [
    'the settings *read* path behind `y9e` (`Qnn` + `$t`, 325,824 units) and the all-sources merge `bTr` (335,278 units): both are now one layer closer, because the file each source reads and the merge each result is folded with are ported',
    'the managed-settings gate `CT`/`Tp` (61,983 units) that `fe` consults before a read, which would let `settings.read` drop its bound hook',
    'the local store\'s remaining fields the settings readers need (`mergedSettings`, `perSource`, `repoTierFreeze`, `isLoadingFromDisk`), added to the handle `src/plugin-chain-local-store.ts` already owns',
    'registering the `store.*`, `settings.read` and remaining `ui.*` cores in the product\'s chain catalog once the product has a `$` surface to call them from',
    '`http.fetch` (`VQt`) once the request runner `dNo` is ported; `ui.copy` (`wGo`/`uzo`/`dzo`) once the clipboard encoder `Sv` is ported, with the `stamp` field modelled; `ui.blit`/`ui.scroll`/`ui.focus`/`ui.notify`; `fs.ancestors` (`mzt`/`kNs`) and `state.get`/`state.set` (`Jf`/`KD`)',
    'Q-086\'s 15 registry-reading cores and their 34 sites',
  ],
};
write('research/ports/W45-settings-merge-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-55 **搬 settings 合并层',
  features: '; W45-55 ports the settings merge layer',
  standard: '2026-10-16 W45-55 settings 合并层',
  status: 'W45-55: the settings merge layer.',
  runner: '## W45-55 ported the settings merge layer',
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
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-55 **搬 settings 合并层**（多源设置折叠成一份时，每个键的"合并"到底是什么意思）：**52 段 4,033 单位**，全在 chunk-3cynezh1.js——lodash \`mergeWith\` 内部 49 段 [340302,343952) + \`CHt\` [428230,428266) 36u + \`Y3\` [428266,428518) 252u + \`ic\` [428518,428637) 119u。**语义（源文实测，逐键）**：\`Y3\` 就是 settings 的"合并"定义——① \`modelPicker\` 且新值已定义 → \`ic(n)\` 归一化（picker 本体浅拷贝 + \`options\` 数组里每个纯对象元素再展开一层），② 两侧都是数组 → **一律**取 \`D([...e,...n])\` 并集去重（**数组规则不认键名**），唯一例外 \`fallbackModel\` 直接取新数组，③ \`extraKnownMarketplaces\`/\`managedMcpServers\` 且两侧都是纯对象 → \`{...e,...n}\` 只覆盖一层（共享条目整块替换、兄弟条目保留），④ 其余键 \`return\`（undefined = 交回 lodash 默认深合并）。**调用点（未搬，如实标注）**：\`bTr\` [428637,…) 开头 \`MB(r,e.store.pluginBase,Y3)\`，随后每源一次 \`MB(r,$t(T,N,e),Y3)\`；\`Qnn\` [427468,…) 对 flag 文件 \`MB(i||{},d,Y3)\`、对旧本地文件 \`MB(c,i||{},d…,Y3)\`——\`Qnn\`/\`bTr\` 各 325,824/335,278 单位，含读文件的 \`FB\`/\`$t\`，本包不发明。**四份计划扩展**：① lodash 内部副本 **+4 段 784 单位**（\`P\` 的 5 个原型赋值 [2162,2262)、五个栈方法本体与别名 \`Ze\`/\`et\`/\`tt\`/\`nt\`/\`ot\` [1620,2100)、\`Fn\` 哨兵与 SetCache 的 \`En\`/\`Dn\`/\`rt\`/\`it\` [2272,2421)、SetCache 原型 [2514,2569)）+ \`Lxr\` 3 段 170 单位 + 10 个导出（149→153 段、10,513→11,297u）；② lodash memoize **+3 导出**（\`e1e\`/\`don\`/\`e8e\`，正文原有）；③ settings 源层 **+\`vse\` 1 段 160 单位**（36→37 段、7,881→8,041u）。**本包抓出的缺陷（W45-14 遗留）**：W45-14 的闭包按"声明→使用"走，**类的方法挂在 prototype 上就不算依赖**，于是 \`P\`（Stack 构造器）被单独搬走、五个原型赋值与本体全缺；合并层第一个嵌套对象就 \`TypeError: c.get is not a function\`（\`baseMerge\` 里 \`i||(i=new k1e)\` 建栈、\`baseMergeDeep\` 里 \`c.get(m)\` 读栈）。修法是补 4 段 784 单位并把编译驱动钉在嵌套合并路径上。**第二处实测教训**：这些副本**语句顺序是语义**——别名是 \`var\`，原型赋值若排在方法本体之前会赋到 \`undefined\`（首版按编辑顺序排块即中招），现计划按源顺序排列并在账本里断言。**实测纠偏**：首版断言"只有特定键才并集"、"\`ic\` 把嵌套键也复制"皆被探针否掉——数组规则不认键名、\`ic\` 只做一层浅展开；另测出**数组目标 + 对象源 = 元素保留、源的键挂成数组自有的属性**（\`JSON.stringify\` 会隐藏，故按属性逐条断言）。验收：check/build/notices（摘要未变）、四副本扫描 \`unresolved 0\`、span 扫描 \`total 0\`、**${chain}**、账本 52+153 段逐段回源比长度与内容 + acorn 断言（完整顶层语句、无重叠、无重复）+ **源顺序断言**、关键正文逐字比对（\`CHt\`/\`Y3\`/\`ic\`、\`mergeWith\` 绑定与保住 customizer 的 arity 检查、\`baseMerge\` 建栈、\`baseMergeDeep\` 读栈、栈构造器与五个原型赋值、SetCache 方法、\`Qr\`/\`Lxr\`、CommonJS 前言与 \`Cn\` 声明、\`vse\`）、新回归 ${seamSweep.passed}/${seamSweep.tests}、插件链家族 ${family.passed}/${family.tests}、全量 **${fullLine}**、${drivers.length} 个编译驱动 exit 0（共享驱动新增 \`W45SettingsMergeCompiled.v1\`，共享 ${sharedMarkers.length} 标记）、打包冒烟 ${smoke.replace('pack ', '')}；身份 \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}）。 | [settings 合并层证据](ports/W45-settings-merge-evidence.json)、[settings 源层证据](ports/W45-settings-source-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
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
lines[featureLine] = `${rowText.slice(0, lastPipe).replace(/\s*$/, '')}; W45-55 ports the settings merge layer: ` +
  '`mergeWith` with the settings customizer, whose per-key rules are the source\'s own — the picker normalizes, ' +
  'arrays union and dedupe (except `fallbackModel`), the two map fields take a one-level override — plus the ' +
  'Stack and SetCache classes the merge walks nested objects with. |';
write('research/FEATURES.md', lines.join('\n'));

const standard = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standard.indexOf('2026-10-16 W45-54 settings 源→文件层');
if (standardAt < 0) throw new Error('coding-standard W45-54 line not found');
const standardEntry = `2026-10-16 W45-55 settings 合并层：S-1至S-7已对照。S-1（先读源）：由 W45-54 记下的调用点反查——\`bTr\` 开头就是 \`MB(r,e.store.pluginBase,Y3)\`，于是量 \`Y3\` 的闭包得 52 段 4,033 单位（lodash mergeWith 内部 49 段 + \`CHt\`/\`Y3\`/\`ic\`），**关键正文全部逐字读过再动手**（\`CHt\`=\`{...e,...n}\`、\`ic\` 的 \`options.map(s=>L(s)?{...s}:s)\`、\`Tf\` 里 \`if(d=e.length>3&&typeof d=="function"?...)\` 这段"靠 arity 保住 customizer"的逻辑、\`Al\` 里 \`i||(i=new k1e)\`、\`yf\` 里 \`c.get(m)\`）。S-2（不留半包）：合并层无新边界——闭包内所有自由名都落在已搬副本上（\`D\`/\`L\`/lodash 内部/memoize 助手）；\`Qnn\`/\`bTr\` 的"读"不搬也不发明，seam 只命名调用点。**W45-14 遗留缺陷在本包暴露**：旧闭包按声明→使用走，**挂在 prototype 上的方法不算依赖**，\`P\`（Stack 构造器）因此被单独搬走；合并层一进嵌套对象即 \`TypeError: c.get is not a function\`。补 4 段 784 单位（原型赋值、五个方法本体与别名、\`Fn\` 哨兵与 SetCache 方法、SetCache 原型），并把编译驱动钉在嵌套合并路径上。S-3（先测后断言）：\`.audit/w45-55-probe.ts\` 先跑，再写 7 条断言；**三处按实测纠偏**——数组并集**不认键名**（首版只给"特定键"写了并集）、\`ic\` **只做一层浅展开**（首版断言嵌套键也被复制，实测与源同引用）、**数组目标 + 对象源 = 元素保留、源的键挂成数组自有属性**（\`JSON.stringify\` 隐藏之，故改按属性逐条断言）。**第二处教训（顺序即语义）**：别名是 \`var\`，原型赋值排在方法本体之前会赋到 \`undefined\`（首版按编辑顺序排块即中招，\`P.prototype.get\` 为 undefined），现按源顺序排块并在账本里断言四条次序。S-4（可复跑校验）：记录脚本自读身份、自跑链校验器/打包冒烟/${drivers.length} 个编译驱动并解析输出，并断言 span 扫描 \`total 0\`、notices 摘要未变；acorn（完整顶层语句、无重叠、无重复）+ 15 处关键正文逐字比对 + 四副本 \`unresolved 0\`。S-5/S-6：seam 只做命名与类型收窄（4 个导出），无死导出；\`Cn\` 这个"整块 chunk 里没有声明"的自由名按 W45-14 先例在计划里显式声明并注明，非发明分支。S-7：\`y9e\`/\`Qnn\`/\`$t\`/\`bTr\`、\`CT\`/\`Tp\`、local store 其余字段、\`$\` 表面注册、\`http.fetch\`、\`ui.copy\`、\`ui.blit\`/\`scroll\`/\`focus\`/\`notify\`、\`fs.ancestors\`、\`state.*\`、Q-086 写入 next_package。验收：check/build/notices、四副本扫描 unresolved 0、${chain}、账本与正文自证、回归 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量 ${fullLine}、${drivers.length} 个编译驱动、打包冒烟 ${smoke.replace('pack ', '')}。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf('W45-54: the settings source → file layer.');
if (statusAt < 0) throw new Error('STATUS W45-54 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = 'W45-55: the settings merge layer. Every settings source is folded into one object with ' +
  '`mergeWith(..., Y3)`: `bTr` opens with `MB(r, e.store.pluginBase, Y3)` and merges each source into the same ' +
  'accumulator, and `Qnn` answers `MB(i||{}, d, Y3)` for the flag file and `MB(c, i||{}, Y3)` for the legacy local ' +
  'one. `Y3` is what "merge" means per key, and it is not lodash\'s default: `modelPicker` with a defined value is ' +
  'normalized by `ic` — the picker spread, its plain-object `options` elements spread in turn — two arrays ' +
  'concatenate and deduplicate under *any* key except `fallbackModel`, which takes the source array outright, and ' +
  '`extraKnownMarketplaces`/`managedMcpServers` take a one-level override; everything else returns `undefined`, ' +
  'which asks lodash for the default deep merge. 52 whole top-level statements, 4,033 units, all in ' +
  'chunk-3cynezh1.js: the 49 lodash-merge internals statements plus `CHt`, `Y3` and `ic`. No new boundary — every ' +
  'free name the bodies close over resolves to a copy the product already carries — but the package closed a defect ' +
  'W45-14 left behind: its closure followed declaration use, so a class whose methods are assigned on its prototype ' +
  'came across as a constructor alone, and `new k1e` had no `.get`. The merge layer hit it on the first nested ' +
  'object (`TypeError: c.get is not a function`), and the fix is four blocks, 784 units: the five stack prototype ' +
  'assignments, their method bodies and aliases, the `Fn` sentinel with the SetCache methods, and the SetCache ' +
  'prototype. Statement order turned out to be load-bearing in these copies — the aliases are `var`s, so a ' +
  'prototype assignment ordered before its method body keeps `undefined` — and the ledger now asserts the source ' +
  'order. Measured before asserted, with three corrections: the array union is not keyed, `ic` is a one-level ' +
  'shallow spread, and an array target with an object source keeps its elements and takes the source\'s keys as own ' +
  'properties (`JSON.stringify` hides that). Evidence: `research/ports/W45-settings-merge-evidence.json`, and\n' +
  '[工作包](ports/W45-chain-runner.md).\n\n';
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-55 ported the settings merge layer (2026-10-16)

When several settings sources are folded into one object, the fold is \`mergeWith(..., Y3)\`: \`bTr\` opens with
\`MB(r, e.store.pluginBase, Y3)\` and merges every source into the same accumulator, and the per-source reader
\`Qnn\` answers \`MB(i||{}, d, Y3)\` for the flag file and \`MB(c, i||{}, Y3)\` for the legacy local one. \`Y3\` is
what "merge" means per key, and it is not lodash's default: \`modelPicker\` with a defined value is normalized by
\`ic\`; two arrays concatenate and deduplicate under any key except \`fallbackModel\`, which takes the source array
outright; \`extraKnownMarketplaces\` and \`managedMcpServers\` take a one-level override when both sides are plain
objects; everything else returns \`undefined\`, which asks lodash for the default deep merge. The closure is 52
whole top-level statements, 4,033 units, all in chunk-3cynezh1.js — the 49 lodash-merge internals statements
spanning [340302,343952) plus \`CHt\`, \`Y3\` and \`ic\`.

No new boundary: every free name the copied bodies close over resolves to a copy the product already carries, so
nothing had to be bounded or invented. The reach behind the layer is stated rather than ported — \`Qnn\` and
\`bTr\` are 325,824 and 335,278 units of schema-driven reading with the file reader inside them, and the seam
names them as the callers. One port is recorded in the plan: the copied CommonJS preamble reads a module
reference the minifier left free as \`Cn\`, which no statement in the chunk declares, so the plan declares it and
quotes the span rather than inventing a branch.

This package closed a defect W45-14 left behind, and the way it surfaced is the point. That closure followed
declaration use, so a class whose methods are assigned on its prototype came across as a constructor alone:
\`P\` (the Stack) was copied without its five prototype assignments or their bodies. Nothing noticed until the
merge walked its first nested object, where \`baseMerge\` builds \`new k1e\` and \`baseMergeDeep\` reads it back with
\`c.get(m)\` — \`TypeError: c.get is not a function\`. The fix is four blocks, 784 units: the five stack prototype
assignments, the five method bodies with their aliases, the \`Fn\` sentinel with the SetCache methods, and the
SetCache prototype. A second lesson came with it: statement order is load-bearing in these copies, because the
aliases are \`var\`s — a prototype assignment ordered before its method body assigns \`undefined\` — so the plan
carries the blocks in source order and the ledger asserts it.

Measured before asserted, and three measurements corrected the port: the array union is not keyed (any two
arrays union, whatever the field is called), \`ic\` is a one-level shallow spread rather than a deep copy, and an
array target with an object source keeps its elements and takes the source's keys as own properties —
\`JSON.stringify\` hides that, so the suite asserts it property by property. Also measured: the merge accumulates
into and returns the target it is handed; nested values are copies; \`undefined\` never overwrites;
a cyclic source terminates on the merge stack; and \`vse\` answers the legacy local path only when the store root
is not the session cwd.

Verified: check/build/notices, all four copies \`unresolved 0\`, span scan \`total 0\`, ${chain}, the two ledgers,
acorn and body and seam checks, the new suite ${seamSweep.passed}/${seamSweep.tests}, ${familyLine}, full ${fullLine},
${drivers.length} compiled drivers (the shared driver now also prints \`W45SettingsMergeCompiled.v1\`), and the packaged
smoke (${smoke}). Identity \`${short}…\` (read from scripts/identity.mjs by the record script itself).

Next: the settings *read* path behind \`y9e\` (\`Qnn\` + \`$t\`, 325,824 units) and the all-sources merge \`bTr\`
(335,278 units), one layer closer now that the file each source reads and the merge each result is folded with
are ported; then the managed-settings gate \`CT\`/\`Tp\` (61,983 units), and the local store's remaining fields,
which belong on the handle W45-54 created.
`);

const rows = [
  ['2026-10-17T04:05:00Z', 'package', 'W45-55 搬 settings 合并层（多源折叠时每键"合并"的语义；52 段 4,033 单位全在 chunk-3cynezh1.js）',
    'MB/Y3/CHt/ic 成为产品面：mergeSettings(target,...sources) 按源自己的逐键规则折叠——modelPicker 归一化、数组并集去重（fallbackModel 例外）、extraKnownMarketplaces/managedMcpServers 只覆盖一层、其余交回 lodash 默认深合并；另把 vse（旧本地设置路径）补进 settings 源层',
    'chunk-3cynezh1.js 52 段（lodash mergeWith 内部 49 段 [340302,343952) 含 Xm/Ht/Rn/_l..yl 前言、Zm/Kt、Qm/Et、ef/Tn、tf/Pn、bl/of/xn/sf/El/rf..uf、pf/Zue、gf/jt、mf/Ie、hf/kl、yf/vl、Al/Cl、_f/Rl、Ol、Sf/Mn、bf/Tl、Ef/Pl、wf/kf/vf、Af/Dl、Cf/Ln、Rf/xl、Of/mCr、Tf/Ml、Pf/MB；CHt [428230,428266) 36u、Y3 [428266,428518) 252u、ic [428518,428637) 119u）；计划扩展四处：lodash 内部 +4 段 784u（[1620,2100) 480u、[2162,2262) 100u、[2272,2421) 149u、[2514,2569) 55u）+ Lxr 3 段 170u + 10 导出（149→153 段、10,513→11,297u）、lodash memoize +3 导出、settings 源层 +vse 1 段 160u（36→37 段、7,881→8,041u）',
    `实测（.audit/w45-55-probe.ts 与 test/plugin-chain-settings-merge.test.ts + .audit/w45-24-compiled.mjs）：逐键规则、深合并与嵌套复制、目标被就地累积并返回、modelPicker 替换而非合并、两图字段一层覆盖、数组目标+对象源的怪异答案、undefined 不覆盖、环源终止、vse 只在 store 根≠cwd 时答；7/7 通过`],
  ['2026-10-17T04:08:00Z', 'defect', 'W45-55 抓出 W45-14 遗留缺陷：Stack 类只有构造器，没有 prototype 方法',
    'W45-14 的闭包按"声明→使用"走，挂在 prototype 上的方法不算依赖，于是 P（Stack 构造器 [2100,2162)）与 k1e 被单独搬走，五个原型赋值 [2162,2262) 与本体 [1620,2100) 全缺；合并层第一个嵌套对象即 TypeError: c.get is not a function（Al 里 i||(i=new k1e) 建栈、yf 里 c.get(m) 读栈、c.set/c.delete 回写）',
    '补 4 段 784 单位（原型赋值、五个方法本体与别名 Ze/et/tt/nt/ot、Fn 哨兵与 SetCache 的 En/Dn/rt/it、SetCache 原型），并在编译驱动里把嵌套合并路径钉死；账本按源顺序断言四条次序',
    '回归 7/7、家族 257/257、全量 1533/1533；编译驱动 W45SettingsMergeCompiled.v1 即断言该路径'],
  ['2026-10-17T04:11:00Z', 'finding', 'W45-55 教训：这些副本里语句顺序就是语义（别名是 var）',
    '首版按编辑顺序把 [2162,2262) 原型赋值排在其方法本体 [1620,2100) 之前，实测 new k1e().get 仍为 undefined —— var Ze=Pn 在赋值语句之后才初始化，原型拿到的是 undefined；探针 npx tsx /tmp/w55-k1e.ts 逐条量出',
    '计划改为源顺序（本体 → 构造器 → 原型 → 别名），记录脚本断言四条次序，并把"顺序即语义"写进计划 note 与证据',
    'k1e 实例 .get/.set 均为 function；嵌套合并通过'],
  ['2026-10-17T04:14:00Z', 'finding', 'W45-55 实测纠偏：数组并集不认键名、ic 只做一层浅展开、数组目标+对象源答案怪异',
    '首版断言 ① 只有特定键才并集（实测任意两数组都并集）、② ic 把嵌套键也复制（实测与源同引用，只浅展开一层）、③ 数组目标遇对象源"保持数组"（实测元素保留且源的键挂成数组自有属性，JSON.stringify 会隐藏）',
    '三处断言按实测改写：并集规则去掉键名、ic 改断言浅展开、数组目标按属性逐条断言（[...arr] 与 arr.m）',
    '回归 7/7 通过；证据 measured 三条记录该行为'],
  ['2026-10-17T04:18:00Z', 'verification', `W45-55 验收：四副本 unresolved 0、span total 0、账本 52+153 段逐段回源 + acorn 完整性 + 源顺序、15 处关键正文逐字、${chain}、回归 ${seamSweep.passed}/${seamSweep.tests}、家族 ${family.passed}/${family.tests}、全量、${drivers.length} 个编译驱动与打包冒烟`,
    'settings 子系统"合并"闭环，下一包转 y9e 的读路径与 bTr 的全源合并',
    `check/build/notices；四副本 unresolved 0；span 扫描 total 0；${chain}；账本 52 段（merge）+153 段（internals）逐段回源比长度与内容 + acorn 断言（完整顶层语句、无重叠、无重复）+ 顺序断言；CHt/Y3/ic 逐字、mergeWith 绑定与 arity 检查、Al 建栈、yf 读栈、P 构造器与五条原型、SetCache 方法、Qr/Lxr、CommonJS 前言与 Cn 声明、vse（并回源 settings 源层副本）；seam 4 个导出 + 调用点 + 未搬的读路径；回归 7/7；${familyLine}；全量 ${fullLine}；${drivers.length} 个编译驱动 exit 0（共享驱动输出 W45SettingsMergeCompiled.v1，共享 ${sharedMarkers.length} 标记）；smoke-package（${smoke}）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const addedRows = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (addedRows) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + addedRows + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-55 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-55 acceptance (2026-10-16)

- [x] **The dependency chain picked the package.** W45-54's record named \`Qnn\`/\`bTr\` as the read path; \`bTr\` opens with \`MB(r, e.store.pluginBase, Y3)\`, so the merge layer was the unit that could come across whole without the schema readers.
- [x] **The whole closure came across.** 52 whole top-level statements, 4,033 units, chunk-3cynezh1.js; chain verifier (${chain}) and \`unresolved 0\` on all four touched copies.
- [x] **Obtainable source was copied, not bound.** The 49 lodash-merge internals statements came across rather than importing a lodash dependency, and the reach behind the layer (\`Qnn\`/\`bTr\`) is named as unported instead of guessed.
- [x] **The lesson from the defect is in the structure.** The Stack gap is closed by four blocks and pinned by the compiled driver's nested-merge assertion, and the source order the copy depends on is asserted in the ledger rather than left to review.
- [x] **Everything measured before it was asserted.** The per-key rules, the accumulation into the target, nested copies, the picker's replacement semantics, the one-level map override, the array rule not being keyed, the shallow spread, the weird array-target answer, undefined never overwriting, the cyclic source terminating, and \`vse\`'s condition.
- [x] **Sweep.** check/build/notices, all four scans \`unresolved 0\`, span scan \`total 0\`, ${chain}, the two ledgers with acorn and order checks, body and seam checks, new suite ${seamSweep.passed}/${seamSweep.tests}, ${familyLine}, full ${fullLine}, ${drivers.length} compiled drivers, packaged smoke (${smoke}).
`);
console.log('records written; identity', identity.sha256, '| chain:', chain, '| full:', fullLine, '| smoke:', smoke);
