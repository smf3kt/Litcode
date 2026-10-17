// W52-01 record: live store-lock contention is serialized by a bounded, abort-aware wait.
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

const note = `# W52 — live store-lock contention waits instead of failing at once

## Source position

The ownership store and its lock are this runtime's construction; the recovered client keeps
worktree state in Git. W47-02 already ported the recovered liveness policy for dead owners
(\`_x\`/\`Rze\`/\`P1t\`/\`zPo\`). This package adds only the local scheduling decision: when the lock is
held by a live owner, the operation waits for a bounded time instead of failing on the freshly
created lock.

## Behavior

\`WorktreeManager\` takes \`lockWaitMs\` (default 30,000, 0 to 120,000). Acquisition now:

1. tries \`open\` with \`O_EXCL\`; on success it owns the lock;
2. on \`EEXIST\`, attempts the W47-02 dead-owner reclaim and retries immediately if it succeeded;
3. otherwise waits 50 ms, honoring the operation signal, until the deadline;
4. at the deadline it fails with the existing locked error.

\`lockWaitMs: 0\` keeps the previous fail-fast behavior for embedding and tests. The wait does not
change ownership verification, the reason format, the identity-bound release, or the dead-owner
reclaim; it only lets a second process serialize behind a live operation.

## Verification

Worktrees 30/30 with a new wait case (a live lock released after 150 ms is acquired; an aborted
wait rejects with AbortError). The two existing fail-closed lock tests set \`lockWaitMs: 0\`. Full
2,086/2,086, chain 767/767, tsc 0, build 0, notices 0, source and compiled worktree smokes exit 0,
source index unchanged, identity \`9d611189…\`.
`;
write('research/ports/W52-worktree-lock-wait.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W52-01 serializes live store-lock contention. Acquisition still reclaims a dead owner at once and
verifies the lock exactly as before; when the owner is live, the operation now waits in 50 ms
steps up to \`lockWaitMs\` (default 30,000; 0 restores fail-fast) and honors the operation signal,
so a second process queues behind a live create/remove instead of failing on a freshly created
lock. The wait does not alter reason matching, the identity-bound release or the dead-owner
policy. 30/30 worktree tests with a wait/abort case, full 2,086/2,086, both smokes pass; identity
\`9d611189…\`. [W52 record](ports/W52-worktree-lock-wait.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W52-01 活锁有界等待：S-1（先读源）：死主回收沿用 W47-02 已核验的 recovered 策略；活主等待是本地 store 的调度决定，不改变所有权校验。S-2（不臆造）：仅增加等待与重试，不扩大可回收范围；lockWaitMs=0 保留原行为。S-3（边界）：每 50ms 复查死主回收；等待受操作 signal 约束；到期仍失败关闭。S-4（可测）：新增活锁释放后获取与 abort 两条断言；既有快速失败用例显式设 0。S-5/S-6：无新增依赖。S-7（记录）：端口记录与证据 JSON。验证：tsc 0、worktrees 30/30、全量 2,086/2,086、链 767/767、两模式 smoke 通过、身份 9d611189…。
`);

rep('research/FEATURES.md',
  'concurrent new-lock race and tmux/full original semantics remain gaps',
  'live store-lock contention is serialized by a bounded abort-aware wait while a dead owner is still reclaimed at once, and tmux/full original semantics remain gaps',
);

const oldRow = '| C-4 | 恢复与崩溃边界 | 陈旧 store 锁回收已完成（W47-02：锁原因指向已死 pid 时按恢复的 pid 校验回收，活进程/外来/空锁失败关闭）；checkpoint 无主 staging 文件回收已完成（W48-01：staging 名携带 store 标签，恢复在持锁下清扫本店临时文件，外来/旧式/链接保留）；create 崩溃遗留 creating 预留回收已完成（W49-01：store 锁下按 Git 注册/分支/目录身份收养或清除，无法验证则保留）；断电后归档恢复已完成（W50-01：归档前持久写入 pending intent，启动或下次移除按 pid/目录身份/归档状态恢复或清理，歧义保留并告警）；归档选择器已完成（W51-01：/worktree-history 列出并按原名恢复到新建 owned checkout，复用 intent 断电恢复）；并发新锁竞争、捕获关联崩溃窗口、断电/GC 仍待处理 | Git worktree/cwd relocation；Checkpoint/rewind |';
const newRow = '| C-4 | 恢复与崩溃边界 | 陈旧 store 锁回收已完成（W47-02：锁原因指向已死 pid 时按恢复的 pid 校验回收，活进程/外来/空锁失败关闭）；checkpoint 无主 staging 文件回收已完成（W48-01：staging 名携带 store 标签，恢复在持锁下清扫本店临时文件，外来/旧式/链接保留）；create 崩溃遗留 creating 预留回收已完成（W49-01：store 锁下按 Git 注册/分支/目录身份收养或清除，无法验证则保留）；断电后归档恢复已完成（W50-01：归档前持久写入 pending intent，启动或下次移除按 pid/目录身份/归档状态恢复或清理，歧义保留并告警）；归档选择器已完成（W51-01：/worktree-history 列出并按原名恢复到新建 owned checkout，复用 intent 断电恢复）；并发锁竞争已完成（W52-01：活锁按 lockWaitMs 有界等待并每 50ms 复查死主回收，超时或 abort 失败关闭，0 保持快速失败）；捕获关联崩溃窗口、断电/GC 仍待处理 | Git worktree/cwd relocation；Checkpoint/rewind |';
const current = read('research/CURRENT.md');
const rows = current.split(oldRow).length - 1;
if (rows !== 3) throw new Error(`CURRENT holds ${rows} of the C-4 row`);
write('research/CURRENT.md', current.split(oldRow).join(newRow));

const tsv = [
  ['2026-10-17T09:44:00Z', 'package', 'W52-01 活 store 锁有界等待',
    'WorktreeManager 增加 lockWaitMs（默认 30s，0..120s）；EEXIST 时先尝试死主回收，否则每 50ms 等待并受 signal 约束，到期失败关闭；既有快速失败用例设 0',
    '死主策略沿用 W47-02；等待为本地调度决定',
    'worktrees 30/30；全量 2,086/2,086；链 767/767；两模式 smoke 通过'],
  ['2026-10-17T09:47:00Z', 'decision', 'W52-01 等待不改变所有权语义',
    '① 仅在活主持锁时等待；② 每轮仍先尝试死主回收；③ 等待受操作 signal 约束并以 deadline 失败关闭；④ lockWaitMs=0 完整保留原行为；⑤ 原因格式、dev/ino 复核与释放逻辑不变',
    '残余：持锁操作超过 deadline 时后来者仍失败；无排队公平性',
    '.audit/w52-01-test.txt'],
  ['2026-10-17T09:50:00Z', 'verification', 'W52-01 验收：worktrees 30/30、2,086/2,086、767/767、两模式 smoke、身份 9d611189…',
    '活锁 150ms 后释放可获取；abort 以 AbortError 结束；快速失败用例显式设 0',
    'tsc 0；build 0；notices 0；索引 75 chunks / 323,525 单位不变；smoke exit 0'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w52-runtime.tsv', tsv + '\n');

write('.audit/w52-runtime.todo.md', `# W52 runtime trail

## W52-01 acceptance (2026-10-17)

- [x] **Live contention waits.** A live owner is awaited in 50 ms steps up to \`lockWaitMs\`.
- [x] **Dead owners are unchanged.** Every wait round still attempts the W47-02 reclaim first.
- [x] **Waiting is abortable.** The operation signal ends the wait with AbortError.
- [x] **Fail-fast remains available.** \`lockWaitMs: 0\` preserves the previous behavior; the two
  fail-closed lock tests use it.
- [x] **Gates.** tsc 0, worktrees 30/30, full 2,086/2,086, chain 767/767, notices 0, build 0, both
  smokes exit 0, index unchanged, identity \`9d611189…\`.
- [ ] Remaining C-4 items: capture-correlation crash window, power-loss/GC.
`);

const evidence = {
  schema: 'W52WorktreeLockWaitEvidence.v1',
  package: 'W52-01 — bounded wait for a live worktree store lock',
  date: '2026-10-17',
  question: 'Do concurrent worktree operations have to fail when the store lock is held by a live process?',
  answer: 'No. A live owner is awaited for a bounded, abort-aware period (default 30 s); a dead owner is still reclaimed immediately and the ownership verification is unchanged.',
  sourcePosition: {
    kind: 'local scheduling extension',
    evidence: 'dead-owner policy from W47-02 (_x/Rze/P1t/zPo in chunk-sfn1dbxq.js; Iue/Nm in chunk-3sda67c1.js); the wait itself is a local store decision.',
  },
  behavior: {
    default: 'lockWaitMs 30,000 (0..120,000), 0 restores fail-fast',
    loop: 'O_EXCL acquire; on EEXIST reclaim a dead owner and retry, otherwise wait 50 ms; abort ends the wait; deadline fails closed',
    unchanged: 'reason format, size bound, dev/ino release check, dead-owner reclaim',
  },
  changes: [
    { file: 'src/worktrees.ts', change: 'lockWaitMs option, abortable pause, bounded acquisition loop', sha256: sha(read('src/worktrees.ts')) },
    { file: 'test/worktrees.test.ts', change: 'wait/abort case and fail-fast lockWaitMs 0 in the two fail-closed tests', sha256: sha(read('test/worktrees.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-4 rows record the completed lock contention work', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'worktree relocation row records the bounded wait', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W52-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W52-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  tests: {
    file: 'test/worktrees.test.ts',
    added: 'a live store lock is awaited until the owner releases it',
    result: '30/30 pass',
  },
  gates: {
    tsc: 'exit 0',
    worktrees: '30/30',
    build: 'exit 0',
    full: '2,086/2,086',
    chain: '767/767',
    notices: 'exit 0',
    smokeSource: 'exit 0',
    smokeCompiled: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '9d611189fa2bd7df10bd24c7b0525d3c0ea51a77ebfb15055568b6688cffdc8e',
  },
  residuals: [
    'A holder that runs longer than lockWaitMs still causes the waiter to fail closed.',
    'There is no queue fairness; waiters race and the first successful open wins.',
    'The wait deadline is per operation, not a global scheduler.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-4 continues with the capture-correlation crash window and power-loss/GC.',
};
write('research/ports/W52-worktree-lock-wait-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW52-01 serializes',
  'research/coding-standard.md': '\n2026-10-17 W52-01 ',
  'research/FEATURES.md': 'live store-lock contention is serialized',
  'research/ports/W52-worktree-lock-wait.md': '# W52 — live store-lock contention',
  '.audit/w52-runtime.todo.md': '\n## W52-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
