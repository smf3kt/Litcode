// W54-01 record: checkpoint garbage collection and the power-loss write ordering.
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

const note = `# W54 — provable checkpoint garbage collection and the durable write order

## Source position

The checkpoint store is this runtime's construction; W04 records that the recovered durable
checkpoint transaction was never established. This package stays inside the local contract and the
recovered observe-and-prove policy (\`zPo\`, chunk-sfn1dbxq.js [1801370,1802540), UTF-8 bytes).

## Garbage collection

\`recoverCheckpoint\` already holds the store lock and has resolved any pending transaction before
it sweeps. Under that lock it now removes only what it can prove:

- a content-addressed object whose 64-hex name no valid manifest references;
- an association intent whose creator pid is dead and whose manifest was never published.

Anything that weakens the proof retains the whole affected set: an unknown file name in
\`objects\`, an unreadable or invalid manifest, a manifest set over the 2,000-entry cap, more than
100,000 objects, or a store directory over the 1,024-entry scan cap. Symlinks and non-regular
objects are never removed. A live creator keeps its intent because the capture may still publish.

A capture and a restore write their objects while holding the same store lock, so an unreferenced
object cannot belong to an in-flight operation. A resolved transaction's objects become
unreferenced only after its transaction file is gone.

## Power-loss ordering

Every durable checkpoint writer goes through \`atomicWrite\`: create an \`O_EXCL\` staging file in the
target directory, write it, \`fsync\` the file, run the ownership verifier, rename over the target
and \`fsync\` the parent directory. The order is:

1. association intent (before capture);
2. content-addressed objects (each file then directory fsync);
3. manifest, last, after a second workspace digest check;
4. transaction, before any target effect.

A cut before the rename leaves only a store-tagged staging file, which the next lock sweeps. A cut
after the rename has the directory fsync that makes the name durable. Hardware-level power-loss
equivalence (device caches, torn writes) is not measurable locally and remains a stated limitation,
not a behavior claim.

## Verification

Checkpoints 23/23 with one case for the sweep and one for the conservative invalid-manifest path;
rewind 7/7; full 2,090/2,090; chain 767/767; tsc 0; build 0; notices 0; checkpoint crash smoke eight
cutpoints in source and compiled modes; source index unchanged; identity \`6eaa8c28…\`.
`;
write('research/ports/W54-checkpoint-gc.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W54-01 sweeps provable checkpoint garbage and records the durable write order. Under the store lock,
after any pending transaction is resolved, \`recoverCheckpoint\` removes content-addressed objects no
valid manifest references and association intents whose creator died before publishing a manifest;
unknown names, unreadable manifests, symlinks and capped stores retain the whole affected set. The
four durable writers (intent, object, manifest, transaction) share \`atomicWrite\`: fsync file, rename,
fsync directory, with the manifest published last and the transaction before effects. Checkpoints
23/23, rewind 7/7, full 2,090/2,090, chain 767/767, both crash smoke modes pass; identity
\`6eaa8c28…\`. [W54 record](ports/W54-checkpoint-gc.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W54-01 checkpoint GC 与断电顺序：S-1（先读源）：store 为本地构造，恢复源未建立持久事务（W04）；观察时核对沿用 zPo。S-2（不臆造）：只删除无 manifest 引用的内容寻址对象与创建者已死且无 manifest 的 intent；不可读、未知、链接与超限一律保留。S-3（边界）：在 store 锁内、事务恢复之后执行；对象扫描上限 100,000，manifest 上限沿用 2,000。S-4（可测）：新增清扫与保守保留两条用例；断电顺序按 atomicWrite 逐点核对。S-5/S-6：无新增依赖。S-7（记录）：端口记录、证据 JSON 与 W04 附录。验证：tsc 0、checkpoints 23/23、rewind 7/7、全量 2,090/2,090、链 767/767、两模式 crash smoke、身份 6eaa8c28…。
`);

const featureOld = 'a durable association intent restores a crash between capture and its journal event on the next open, while power-loss/GC and original equivalence remain gaps';
const featureNew = 'a durable association intent restores a crash between capture and its journal event on the next open, recovery sweeps objects no manifest references and dead intents that never captured, the durable writers fsync each file before rename and each directory after, while hardware-level power-loss equivalence and original equivalence remain gaps';
const featureText = read('research/FEATURES.md');
if (featureText.split(featureOld).length - 1 !== 1) throw new Error('FEATURES checkpoint sentence count changed');
write('research/FEATURES.md', featureText.replace(featureOld, featureNew));

const rowOld = '；断电/GC 仍待处理 | Git worktree/cwd relocation；Checkpoint/rewind |';
const rowNew = '；GC 与断电顺序已完成（W54-01：恢复在 store 锁下清除无 manifest 引用的内容寻址对象与创建者已死且未发布 manifest 的 intent，不可读 manifest/未知文件/链接/超限保留；intent→对象→manifest、事务先于效果，均 fsync 文件再 rename 再 fsync 目录）；C-4 全部完成 | Git worktree/cwd relocation；Checkpoint/rewind |';
const current = read('research/CURRENT.md');
if (current.split(rowOld).length - 1 !== 3) throw new Error('CURRENT C-4 tail count changed');
write('research/CURRENT.md', current.split(rowOld).join(rowNew));

write('research/ports/W04-crash-recovery.md', read('research/ports/W04-crash-recovery.md').replace(/\n+$/, '\n') + `

## W54-01 garbage collection and write order (2026-10-17)

Recovery now sweeps content-addressed objects no valid manifest references and association intents
whose creator died before publishing a manifest, under the store lock and only when the whole
reference set is provable. The durable writers share one order: fsync the file, rename, fsync the
directory; the manifest is published last and the transaction before effects. [W54 record](W54-checkpoint-gc.md).
`);

const tsv = [
  ['2026-10-17T10:52:00Z', 'package', 'W54-01 checkpoint GC 与断电写序',
    'recoverCheckpoint 在 store 锁内、事务恢复后清扫无引用对象与死主无 manifest 的 intent；不可读/未知/链接/超限保留；atomicWrite 顺序逐点核对',
    '本地构造（W04）；观察时核对沿用 zPo',
    'checkpoints 23/23；rewind 7/7；全量 2,090/2,090；链 767/767；两模式 crash smoke 通过'],
  ['2026-10-17T10:55:00Z', 'decision', 'W54-01 只做可证明的清扫',
    '① 对象仅在全部 manifest 可验证且引用集完整时删除；② intent 仅在创建者已死且 manifest 缺失时删除；③ 活创建者可能仍在捕获，保留；④ 符号链接、未知文件名与超出 cap 的 store 一律不删；⑤ 在事务恢复之后执行，避免删掉回滚对象',
    '残余：硬件级断电等价（设备缓存/撕裂写）不可本地测量；孤儿 manifest 不自动删除',
    '.audit/w54-01-test.txt'],
  ['2026-10-17T10:58:00Z', 'verification', 'W54-01 验收：checkpoints 23/23、rewind 7/7、2,090/2,090、767/767、两模式 crash smoke、身份 6eaa8c28…',
    '无引用对象删除；外部文件、非摘要名、链接、被引用对象保留；死主 intent 删除、活主保留；无效 manifest 时全部保留',
    'tsc 0；build 0；notices 0；索引 75 chunks / 323,525 单位不变；smoke exit 0'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w54-runtime.tsv', tsv + '\n');

write('.audit/w54-runtime.todo.md', `# W54 runtime trail

## W54-01 acceptance (2026-10-17)

- [x] **GC runs under the store lock.** It follows transaction recovery, so rollback objects are
  never swept before the transaction is resolved.
- [x] **Objects are provably unreferenced.** Every manifest must validate and the complete
  reference set must fit the caps before any object is removed.
- [x] **Intents are provably dead.** Only a dead creator with no published manifest loses its
  intent; a live creator keeps it.
- [x] **Uncertain stores are retained.** Unknown names, symlinks, unreadable manifests and capped
  stores keep everything.
- [x] **Write order recorded.** Intent, object, manifest and transaction all fsync the file,
  rename, then fsync the directory; the manifest is last and the transaction precedes effects.
- [x] **Gates.** tsc 0, checkpoints 23/23, rewind 7/7, full 2,090/2,090, chain 767/767, crash smoke
  both modes, notices 0, build 0, index unchanged, identity \`6eaa8c28…\`.
- [x] **C-4 complete.** Stale lock, staging, create reservation, archive intent/picker, lock
  contention, capture association, GC and write order are all covered. The hardware-level
  power-loss limitation is recorded in the port note.
`);

const evidence = {
  schema: 'W54CheckpointGcEvidence.v1',
  package: 'W54-01 — provable checkpoint GC and durable write ordering',
  date: '2026-10-17',
  question: 'Can crashed or abandoned checkpoint objects and intents be reclaimed without risking a live capture or a referenced rollback object?',
  answer: 'Yes, under the store lock after transaction recovery, and only when the full reference set validates; every uncertain case retains the affected set.',
  sourcePosition: {
    kind: 'local extension; recovered durable checkpoint transaction not established',
    evidence: 'W04 local rewrite; zPo (chunk-sfn1dbxq.js [1801370,1802540), UTF-8 bytes) observe-and-prove policy.',
  },
  behavior: {
    sweep: 'recoverCheckpoint -> lock -> sweep staging -> recoverTransaction -> sweepStore',
    objects: 'delete 64-hex regular files no valid manifest references; caps 2,000 manifests and 100,000 objects',
    intents: 'delete only when pid is dead and manifestDigest is undefined',
    retained: 'unknown object names, symlinks, invalid/unreadable manifests, live pids, over-cap stores',
    order: 'intent -> objects -> manifest -> effects; each durable writer fsyncs the file, renames, fsyncs the directory',
  },
  changes: [
    { file: 'src/checkpoints.ts', change: 'sweepStore and recoverCheckpoint integration', sha256: sha(read('src/checkpoints.ts')) },
    { file: 'test/checkpoints.test.ts', change: 'sweep and conservative-retention cases', sha256: sha(read('test/checkpoints.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-4 rows record GC and write order', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'checkpoint row records GC and fsync order', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W54-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W54-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
    { file: 'research/ports/W04-crash-recovery.md', change: 'W54-01 addendum', sha256: sha(read('research/ports/W04-crash-recovery.md')) },
  ],
  tests: {
    file: 'test/checkpoints.test.ts',
    added: [
      'recovery sweeps unreferenced objects and intents whose creator died before capture',
      'an unreadable manifest retains every otherwise unreferenced object',
    ],
    result: 'checkpoints 23/23; rewind 7/7',
  },
  gates: {
    tsc: 'exit 0',
    checkpoints: '23/23',
    rewind: '7/7',
    build: 'exit 0',
    full: '2,090/2,090',
    chain: '767/767',
    notices: 'exit 0',
    crashSmoke: 'exit 0 (source and compiled, eight cutpoints)',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '6eaa8c28a8668cd58dc294de287443e3d4002c63f93ff63c0c0789b2493b163d',
  },
  residuals: [
    'Hardware-level power loss (device caches, torn writes) is not measurable in this environment; the claim is limited to the recorded fsync order.',
    'Unreferenced manifests are retained, so a manifest with no session association keeps its objects by design.',
    'Store directories beyond the scan caps are left untouched until a later recovery has room.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-4 is complete; C-1 remains blocked on the user action, C-5..C-11 continue per CURRENT.',
};
write('research/ports/W54-checkpoint-gc-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW54-01 sweeps provable',
  'research/coding-standard.md': '\n2026-10-17 W54-01 ',
  'research/FEATURES.md': 'recovery sweeps objects no manifest references',
  'research/ports/W54-checkpoint-gc.md': '# W54 — provable checkpoint',
  'research/ports/W04-crash-recovery.md': '\n## W54-01 garbage collection',
  '.audit/w54-runtime.todo.md': '\n## W54-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
