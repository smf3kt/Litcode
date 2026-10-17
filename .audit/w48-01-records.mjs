// W48-01 record: checkpoint staging files carry a store tag and recovery sweeps this store's
// orphans under the checkpoint lock. Writes the port note, evidence, doc tails and runtime trail.
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const rep = (path, old, next) => {
  const text = read(path);
  const count = text.split(old).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} of ${JSON.stringify(old.slice(0, 70))}`);
  write(path, text.replace(old, next));
};

const note = `# W48 — checkpoint staging files carry their store and are reclaimed

## Source status

This is an extension of the local checkpoint rewrite, not a port. W04 records that the original
durable checkpoint transaction implementation was never established, and W04's residual names the
unpublished \`.checkpoint-UUID.tmp\` files as having no durable path or inode ownership. The
staging contract below therefore follows this runtime's own atomic writer and store lock.

## What changed

\`atomicWrite\` now names its staging file \`.checkpoint-<tag>-<uuid>.tmp\`, where \`tag\` is the
first 12 hex characters of the SHA-256 of the absolute store path (\`.agent/checkpoints\`). The
name alone proves which store owns the file, without a sidecar and without trusting a pid.

\`recoverCheckpoint\` holds the store lock for every checkpoint write, so while that lock is held
no live writer can own a staging file. Under the lock it sweeps \`<store>\`, \`<store>/objects\`
and \`<store>/manifests\`. \`recoverTransaction\`, after validating the transaction and before its
ownership and conflict checks, sweeps the parent directory of every operation target once. That
second sweep also lets a recorded directory that must be removed come empty.

Only regular files whose name matches the exact tagged pattern are removed. Files tagged for
another store, untagged legacy staging (the pre-W48 \`.checkpoint-<uuid>.tmp\` name), directories
and symlinks stay for inspection. Each directory scan is bounded at 10,000 entries and stops
there. Unlink failures other than ENOENT propagate.

## Verification

Checkpoints 21/21 (two new cases: store sweep with foreign/legacy/symlink retention; pending
transaction sweeps its target directories while retaining the transaction), rewind 5/5, full
2,081/2,081, chain 767/767, source and compiled crash smokes pass with \`stagingResidue:[]\` at all
eight SIGKILL cutpoints plus \`/checkpoint-recover\`, build 0, tsc 0, notices 0, source index
unchanged at 75 chunks / 323,525 units, identity \`f3419f9c…\`.
`;
write('research/ports/W48-checkpoint-staging.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W48-01 tags checkpoint staging files with the owning store and reclaims them during recovery. The
atomic writer now names temporaries \`.checkpoint-<12hex store tag>-<uuid>.tmp\`; under the
checkpoint store lock, \`recoverCheckpoint\` sweeps the store, objects and manifests directories,
and a pending transaction's recovery sweeps each target directory once before its ownership and
conflict checks. Foreign tags, untagged legacy staging, directories and symlinks stay. This closes
the W04 residual for tagged staging while leaving the pre-W48 untagged files visible. Since the
recovered durable checkpoint transaction is unobtainable (W04), this remains a recorded local
extension. 21/21 checkpoint tests, full 2,081/2,081, both crash smokes pass with no staging
residue; identity \`f3419f9c…\`. [W48 record](ports/W48-checkpoint-staging.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W48-01 checkpoint staging 回收：S-1（先读源）：恢复源不可得已由 W04 记录（原持久 checkpoint 事务未建立），本包不声称移植，按本运行时原子写与 store 锁契约扩展。S-2（不臆造）：staging 名携带 store 路径摘要前缀，所有权由名字证明；无标签的旧式文件、外来标签、目录与符号链接全部保留。S-3（边界）：只在持有 store 锁时清扫，因此不存在活跃写入者的临时文件；目标目录仅限待处理事务操作路径的父目录。S-4（可测）：新增 store 清扫与待处理事务目录清扫两条用例，crash smoke 八个切点 stagingResidue 为空。S-5/S-6：无新增依赖。S-7（记录）：W04 追加链接，端口记录与证据 JSON 记录改编理由与残余。验证：tsc 0、checkpoints 21/21、rewind 5/5、全量 2,081/2,081、链 767/767、两模式 crash smoke 通过、身份 f3419f9c…。
`);

rep('research/FEATURES.md',
  'Unowned staging files, capture-association crash windows, power-loss/GC and original equivalence remain gaps',
  'Store-tagged staging files left by a crash are swept under the checkpoint lock, while untagged or foreign staging stays for inspection; capture-association crash windows, power-loss/GC and original equivalence remain gaps',
);

const oldRow = '| C-4 | 恢复与崩溃边界 | 陈旧 store 锁回收已完成（W47-02：锁原因指向已死 pid 时按恢复的 pid 校验回收，活进程/外来/空锁失败关闭）；worktree 归档选择器、并发新锁竞争、断电后归档恢复；checkpoint 无主 staging 文件、捕获关联崩溃窗口、断电/GC 仍待处理 | Git worktree/cwd relocation；Checkpoint/rewind |';
const newRow = '| C-4 | 恢复与崩溃边界 | 陈旧 store 锁回收已完成（W47-02：锁原因指向已死 pid 时按恢复的 pid 校验回收，活进程/外来/空锁失败关闭）；checkpoint 无主 staging 文件回收已完成（W48-01：staging 名携带 store 标签，恢复在持锁下清扫本店临时文件，外来/旧式/链接保留）；worktree 归档选择器、并发新锁竞争、断电后归档恢复、捕获关联崩溃窗口、断电/GC 仍待处理 | Git worktree/cwd relocation；Checkpoint/rewind |';
const current = read('research/CURRENT.md');
const rows = current.split(oldRow).length - 1;
if (rows !== 3) throw new Error(`CURRENT holds ${rows} of the C-4 row`);
write('research/CURRENT.md', current.split(oldRow).join(newRow));

write('research/ports/W04-crash-recovery.md', read('research/ports/W04-crash-recovery.md').replace(/\n+$/, '\n') + `
## W48-01 staging ownership (2026-10-17)

The atomic writer now tags staging names with the store path digest
(\`.checkpoint-<12hex>-<uuid>.tmp\`), and recovery sweeps this store's tags under the checkpoint
lock in the store directories and in a pending transaction's target directories. The residual
above still applies to the pre-W48 untagged names, which stay visible. [W48 record](W48-checkpoint-staging.md).
`);

const tsv = [
  ['2026-10-17T07:52:00Z', 'package', 'W48-01 checkpoint staging 名携带 store 标签并在恢复时清扫',
    'atomicWrite 增加 store 参数并以 SHA-256(store) 前 12 位命名临时文件；recoverCheckpoint 持锁清扫 store/objects/manifests；recoverTransaction 在校验后清扫事务目标父目录；test/checkpoints.test.ts 新增两条用例',
    'W04 已记录原持久 checkpoint 事务不可得，本包按本地写者与 store 锁契约扩展',
    'checkpoints 21/21；rewind 5/5；全量 2,081/2,081；链 767/767'],
  ['2026-10-17T08:02:00Z', 'decision', 'W48-01 以名字证明 staging 所有权',
    '① 标签来自 store 绝对路径摘要，无需 sidecar 与 pid；② 持 store 锁时不存在活跃写者，因此本店标签文件必为孤儿；③ 旧式无标签、外来标签、目录与链接保留，失败关闭；④ 目录扫描上限 10,000 项，超出即停；⑤ 目标目录只取待处理事务操作路径的父目录',
    '残余：旧式无标签文件仍可见；store 路径迁移后旧标签不再匹配',
    '.audit/w48-01-test.txt + .audit/w48-01-records.mjs'],
  ['2026-10-17T08:06:00Z', 'finding', 'W48-01 crash smoke 八个切点无 staging 残留',
    'source 与 compiled 各八个 SIGKILL 切点加 /checkpoint-recover，stagingResidue 全为空；恢复结果与既有断言一致',
    '由 scripts/smoke-checkpoint-crash.mjs 两种模式实测',
    '.audit/w48-01-smoke.txt + .audit/w48-01-smoke-compiled.txt'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w48-runtime.tsv', tsv + '\n');

write('.audit/w48-runtime.todo.md', `# W48 runtime trail

## W48-01 acceptance (2026-10-17)

- [x] **Staging names carry the store.** \`atomicWrite\` writes
  \`.checkpoint-<12hex store tag>-<uuid>.tmp\`; the tag is the store path's SHA-256 prefix.
- [x] **Recovery sweeps under the lock.** The store, objects and manifests directories are swept;
  a pending transaction sweeps each target directory once before its ownership checks.
- [x] **Ownership is fail-closed.** Foreign tags, untagged legacy names, directories and symlinks
  stay; only regular files with this store's tag are removed.
- [x] **Crash smokes stay clean.** Source and compiled smokes pass at eight SIGKILL cutpoints plus
  \`/checkpoint-recover\` with \`stagingResidue:[]\`.
- [x] **Gates.** tsc 0, checkpoints 21/21, rewind 5/5, full 2,081/2,081, chain 767/767, notices 0,
  build 0, index unchanged, identity \`f3419f9c…\`.
- [ ] Remaining C-4 items: worktree archive picker, concurrent new-lock race, power-loss archive
  recovery, capture-correlation crash window, power-loss/GC.
`);

const evidence = {
  schema: 'W48CheckpointStagingEvidence.v1',
  package: 'W48-01 — store-tagged checkpoint staging reclaimed during recovery',
  date: '2026-10-17',
  question: 'Can a crash leave checkpoint staging files behind without a way to prove their owner?',
  answer: 'The staging name now carries the owning store path digest, so recovery under the checkpoint lock can prove ownership and remove this store\'s orphans while keeping foreign, legacy and linked entries.',
  sourceStatus: {
    disposition: 'local extension; recovered body unobtainable',
    evidence: 'research/ports/W04-crash-recovery.md records that the original durable checkpoint transaction implementation was never established and lists unpublished .checkpoint-UUID.tmp files as an explicit residual.',
  },
  behavior: {
    naming: 'atomicWrite(store, target, ...) writes .checkpoint-<sha256(store)[0..12]>-<uuid>.tmp beside the target',
    storeSweep: 'recoverCheckpoint, under the checkpoint lock, sweeps store, store/objects and store/manifests',
    targetSweep: 'recoverTransaction, after validating the transaction and before ownership/conflict checks, sweeps the parent directory of each operation target once',
    retention: 'foreign tags, untagged legacy staging, directories and symlinks stay; each directory scan is capped at 10,000 entries',
  },
  changes: [
    { file: 'src/checkpoints.ts', change: 'stagingName/sweepStaging; atomicWrite takes the store; store and target-directory sweeps', sha256: sha(read('src/checkpoints.ts')) },
    { file: 'test/checkpoints.test.ts', change: 'two new staging tests', sha256: sha(read('test/checkpoints.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-4 rows record the completed staging reclamation', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Checkpoint/rewind row states the tagged sweep and keeps the remaining gaps', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W48-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W48-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
    { file: 'research/ports/W04-crash-recovery.md', change: 'dated addendum linking the staging record', sha256: sha(read('research/ports/W04-crash-recovery.md')) },
  ],
  tests: {
    file: 'test/checkpoints.test.ts',
    added: [
      'recovery removes this store\'s staging files and keeps foreign, legacy and linked ones',
      'a pending transaction sweeps staging files from its target directories',
    ],
    result: '21/21 pass; rewind 5/5',
  },
  gates: {
    tsc: 'exit 0',
    checkpoints: '21/21',
    build: 'exit 0',
    full: '2,081/2,081',
    chain: '767/767',
    notices: 'exit 0',
    smokeSource: 'exit 0; eight SIGKILL cutpoints plus /checkpoint-recover, stagingResidue []',
    smokeCompiled: 'exit 0; same cutpoints, stagingResidue []',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'f3419f9c0279c43c98b191aaccd9d96a5be7fe349bb62cd70ff041503993f6ef',
  },
  residuals: [
    'Pre-W48 untagged .checkpoint-UUID.tmp files are never auto-removed; they stay visible as W04 recorded.',
    'A store whose path changes between the crash and recovery no longer matches the old tag; its staging stays.',
    'A directory with more than 10,000 entries may retain tagged staging beyond the scan cap.',
    'The sweep is bounded and best-effort; an unlink error other than ENOENT propagates and recovery fails with the transaction retained.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-4 continues with the worktree archive picker, the concurrent new-lock race and the capture-correlation crash window.',
};
write('research/ports/W48-checkpoint-staging-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW48-01 tags checkpoint',
  'research/coding-standard.md': '\n2026-10-17 W48-01 ',
  'research/FEATURES.md': 'Store-tagged staging files left by a crash',
  'research/ports/W48-checkpoint-staging.md': '# W48 — checkpoint staging files',
  'research/ports/W04-crash-recovery.md': '\n## W48-01 staging ownership',
  '.audit/w48-runtime.todo.md': '\n## W48-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
