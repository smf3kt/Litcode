// W49-01 record: an interrupted create's `creating` reservation is adopted or dropped under the
// store lock. Writes the port note, evidence, doc tails and runtime trail.
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

const note = `# W49 — an interrupted create's reservation is reconciled

## Source position

The reconciliation is the same cleanup create already performs in its failure path, applied when a
\`creating\` reservation is observed by a later locked operation. The recovered client reconciles
stale worktree state when it observes it: \`zPo\` in chunk-sfn1dbxq.js [1801370,1802540) re-reads the
registry at release time and only releases a lock whose owner is provably dead. This store's
reservation has no owner pid, but it does not need one: every create holds the store lock across
its Git mutations, so a \`creating\` record read under that lock cannot belong to a live operation.

## Behavior

\`reclaimCreating\` runs at the start of \`create\` and \`remove\`, inside the store lock, and walks
every \`creating\` record:

- Git registered the recorded directory under the recorded branch: \`verify\` confirms the
  directory dev/ino, branch, Git directory and backlink, the record becomes \`ready\`, and the store
  is saved. This is the crash-after-\`git worktree add\` window.
- No registration and no branch: when the recorded directory is still the unchanged empty
  directory, it is removed and the reservation is dropped. This is the crash-before-work window
  and matches create's own cleanup conditions.
- Anything else (non-empty or replaced directory, branch still present, verification failure) is
  retained for inspection.

\`list\` stays read-only and does not reconcile.

## Verification

Worktrees 29/29 with two new cases (adoption after Git registration; drop when Git work never
landed). Full 2,083/2,083, chain 767/767, tsc 0, build 0, notices 0, source and compiled worktree
smokes exit 0 with \`locksReleased:true\`, source index unchanged at 75 chunks / 323,525 units,
identity \`92d4ad84…\`.
`;
write('research/ports/W49-worktree-reservation.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W49-01 reconciles an interrupted create's reservation. A \`creating\` record cannot belong to a live
operation when it is read under the store lock, because every create holds that lock across its Git
mutations. \`create\` and \`remove\` now run the same cleanup create's failure path uses: a record
whose directory Git registered under the recorded branch is verified and restored to \`ready\`; a
record whose Git work never landed is dropped when its unchanged empty directory can be removed and
the branch is absent; anything unverifiable is retained. \`list\` stays read-only. Two new worktree
tests, 29/29 worktree, full 2,083/2,083, both smokes pass; identity \`92d4ad84…\`.
[W49 record](ports/W49-worktree-reservation.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W49-01 create 崩溃预留回收：S-1（先读源）：沿用 create 失败路径的清理条件与 recovered zPo 的“观察时再核对、不可证明即保留”策略；store 锁语义见 W47-02。S-2（不臆造）：只收养 verify 通过的注册，只在目录身份未变且为空、分支不存在时清除；其余保留。S-3（边界）：仅在 create/remove 的 store 锁内运行，list 保持只读；store 锁覆盖整个 create，因此在锁内读到的 creating 记录不可能属于活跃操作。S-4（可测）：新增收养与清除两条用例。S-5/S-6：无新增依赖。S-7（记录）：端口记录与证据 JSON；未执行恢复入口点。验证：tsc 0、worktrees 29/29、全量 2,083/2,083、链 767/767、两模式 smoke 通过、身份 92d4ad84…。
`);

rep('research/FEATURES.md',
  'A store lock left by a dead owner is reclaimed on the next operation under the recovered pid-reason policy, while live, foreign and empty locks fail closed;',
  'A store lock left by a dead owner is reclaimed on the next operation under the recovered pid-reason policy, while live, foreign and empty locks fail closed; a creating reservation left by an interrupted create is adopted when Git registered it or dropped when its Git work never landed, with unverifiable reservations retained;',
);

const oldRow = '| C-4 | 恢复与崩溃边界 | 陈旧 store 锁回收已完成（W47-02：锁原因指向已死 pid 时按恢复的 pid 校验回收，活进程/外来/空锁失败关闭）；checkpoint 无主 staging 文件回收已完成（W48-01：staging 名携带 store 标签，恢复在持锁下清扫本店临时文件，外来/旧式/链接保留）；worktree 归档选择器、并发新锁竞争、断电后归档恢复、捕获关联崩溃窗口、断电/GC 仍待处理 | Git worktree/cwd relocation；Checkpoint/rewind |';
const newRow = '| C-4 | 恢复与崩溃边界 | 陈旧 store 锁回收已完成（W47-02：锁原因指向已死 pid 时按恢复的 pid 校验回收，活进程/外来/空锁失败关闭）；checkpoint 无主 staging 文件回收已完成（W48-01：staging 名携带 store 标签，恢复在持锁下清扫本店临时文件，外来/旧式/链接保留）；create 崩溃遗留 creating 预留回收已完成（W49-01：store 锁下按 Git 注册/分支/目录身份收养或清除，无法验证则保留）；worktree 归档选择器、并发新锁竞争、断电后归档恢复、捕获关联崩溃窗口、断电/GC 仍待处理 | Git worktree/cwd relocation；Checkpoint/rewind |';
const current = read('research/CURRENT.md');
const rows = current.split(oldRow).length - 1;
if (rows !== 3) throw new Error(`CURRENT holds ${rows} of the C-4 row`);
write('research/CURRENT.md', current.split(oldRow).join(newRow));

const tsv = [
  ['2026-10-17T08:24:00Z', 'package', 'W49-01 回收 create 崩溃遗留的 creating 预留',
    'create/remove 在 store 锁内调用 reclaimCreating；Git 已注册则 verify 后置 ready，未落地且目录身份未变且为空且分支不存在则删目录并清记录；其余保留；list 不变',
    '沿用 create 失败路径清理条件与 recovered zPo 的观察时核对策略',
    'worktrees 29/29；全量 2,083/2,083；链 767/767；两模式 smoke 通过'],
  ['2026-10-17T08:27:00Z', 'decision', 'W49-01 在锁内把 creating 记录视为无活跃属主',
    '① store 锁覆盖整个 create，锁内读到的 creating 记录必来自中断操作；② 收养必须先通过 verify（目录 dev/ino、分支、gitDir、backlink）；③ 清除必须满足目录身份未变、为空、分支不存在；④ 分支仍存在或目录已变则保留；⑤ list 只读不触发',
    '残余：无法验证的预留保留给人工检查',
    '.audit/w49-01-test.txt'],
  ['2026-10-17T08:31:00Z', 'verification', 'W49-01 验收：29/29、2,083/2,083、767/767、两模式 smoke、身份 92d4ad84…',
    'create 注册后崩溃可收养；注册前崩溃可清除；无行为回退',
    'tsc 0；build 0；notices 0；索引 75 chunks / 323,525 单位不变；smoke locksReleased:true'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w49-runtime.tsv', tsv + '\n');

write('.audit/w49-runtime.todo.md', `# W49 runtime trail

## W49-01 acceptance (2026-10-17)

- [x] **Interrupted creates no longer wedge a name.** Under the store lock, a \`creating\` record is
  reconciled because no live create can hold the lock at the same time.
- [x] **Adoption is verified.** The registration, branch, directory dev/ino, Git directory and
  backlink must pass \`verify\` before the record becomes \`ready\`.
- [x] **Clearing is conservative.** The unchanged empty directory is removed and the record dropped
  only when the branch is absent; everything else is retained.
- [x] **Read paths stay read-only.** \`list\` does not reconcile.
- [x] **Gates.** tsc 0, worktrees 29/29, full 2,083/2,083, chain 767/767, notices 0, build 0, both
  worktree smokes exit 0, index unchanged, identity \`92d4ad84…\`.
- [ ] Remaining C-4 items: worktree archive picker, concurrent new-lock race, power-loss archive
  recovery, capture-correlation crash window, power-loss/GC.
`);

const evidence = {
  schema: 'W49WorktreeReservationEvidence.v1',
  package: 'W49-01 — interrupted create reservation reconciled under the store lock',
  date: '2026-10-17',
  question: 'Does a crash during create leave a reservation that blocks later operations forever?',
  answer: 'It did. Under the store lock a creating record cannot belong to a live create, so create and remove now verify and adopt it, or clear it when its Git work never landed; unverifiable reservations stay.',
  sourcePosition: {
    kind: 'local extension using the existing cleanup contract',
    evidence: 'create\'s own failure path defines the adoption/clear conditions; the recovered sweep zPo (chunk-sfn1dbxq.js [1801370,1802540), UTF-8 bytes) reconciles stale state at observation time and retains what it cannot prove.',
  },
  behavior: {
    adoption: 'Git registered the recorded directory under the recorded branch: verify directory dev/ino, branch, gitDir and backlink, set state ready, save the store',
    clearing: 'no registration and no branch: remove the recorded unchanged empty directory and drop the record',
    retention: 'non-empty or replaced directory, branch still present, or verification failure keeps the reservation',
    trigger: 'start of create and remove inside the store lock; list stays read-only',
  },
  changes: [
    { file: 'src/worktrees.ts', change: 'reclaimCreating and its call sites in create/remove', sha256: sha(read('src/worktrees.ts')) },
    { file: 'test/worktrees.test.ts', change: 'adoption and clearing cases', sha256: sha(read('test/worktrees.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-4 rows record the completed reservation recovery', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'worktree relocation row records the reservation recovery', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W49-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W49-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  tests: {
    file: 'test/worktrees.test.ts',
    added: [
      'a creating record whose Git work landed is adopted and removable',
      'a creating reservation whose Git work never landed is reclaimed',
    ],
    result: '29/29 pass',
  },
  gates: {
    tsc: 'exit 0',
    worktrees: '29/29',
    build: 'exit 0',
    full: '2,083/2,083',
    chain: '767/767',
    notices: 'exit 0',
    smokeSource: 'exit 0, locksReleased true',
    smokeCompiled: 'exit 0, locksReleased true, compiledCLI true',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '92d4ad84e354a7a5c9ba207941df0d10234d82746b44fee34591659cb446e516',
  },
  residuals: [
    'A reservation whose directory changed, whose branch still exists, or whose registration fails verification is retained for inspection.',
    'Reconciliation runs only in create and remove; a read-only list deliberately does not mutate the store.',
    'A branch created by the interrupted create but never registered keeps the reservation because deleting the branch is not provably safe from the store state.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-4 continues with the worktree archive picker, the concurrent new-lock race and the capture-correlation crash window.',
};
write('research/ports/W49-worktree-reservation-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW49-01 reconciles',
  'research/coding-standard.md': '\n2026-10-17 W49-01 ',
  'research/FEATURES.md': 'a creating reservation left by an interrupted create',
  'research/ports/W49-worktree-reservation.md': '# W49 — an interrupted create',
  '.audit/w49-runtime.todo.md': '\n## W49-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
