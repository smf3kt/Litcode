// W47-02 record: the worktree ownership store reclaims a lock whose reason names a dead owner.
// Writes the port note, the evidence JSON, the CURRENT/FEATURES/STATUS/coding-standard tails, and
// the W47 runtime trail (W47-01 had only the commit trail).
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

const portNote = `# W47 — the worktree ownership store reclaims a dead owner's lock

## Sources

| module | sha256 |
| --- | --- |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da |
| chunk-3sda67c1.js | 285259b1c6dcf821a48f703d5fb866a9f69e9b52f19a235a9ae68f7dd7384cef |

Ranges are zero-based UTF-8 byte half-open offsets into the extracted module.

## W47-02 reclaims a store lock left by a dead owner (2026-10-17)

The product store lock (\`.agent/worktrees.json.lock\`) was created with \`O_EXCL\` and never
carried an owner. A crash between acquisition and release left it behind forever: every later
operation failed closed with "worktree ownership store is locked by another operation", with no
way to distinguish a crashed owner from a live one. The recovered client does carry that
distinction for worktree liveness locks, so the policy is ported rather than invented.

- \`_x\` and \`Rze\` [1759186,1759662): the reason is matched against a strict anchored pattern;
  release is safe only when the reason is absent or names a non-own pid that \`U1t\` proves dead.
- \`P1t\` [1801260,1801370): a reason longer than 512 bytes, or one the pattern rejects, is never
  treated as stale.
- \`zPo\` [1801370,1802540): the sweep skips the current worktree, re-reads the registry at release
  time before unlinking, and caps a sweep at \`A1t = 50\`.
- \`Iue\` [2547,2601) and \`Nm\` [2601,2715) in chunk-3sda67c1.js: a pid is dead only when it is an
  integer in \`(1, 2147483647]\` and \`process.kill(pid, 0)\` reports \`ESRCH\`; any other error,
  including \`EPERM\`, means not-dead.

The port adapts the sweep to a single lock. Acquisition now writes \`harness worktree store (pid N)\`
and fsyncs it. On \`EEXIST\` the lock is opened \`O_NOFOLLOW\`, its size is bounded at 512 bytes, its
reason must match the runtime's own format, and the owner pid must be dead. The file is re-stat'ed
immediately before \`unlink\` and must still be the same dev/inode that was read, the direct analogue
of the sweep re-reading the registry at release time. Exactly one reclaim-and-retry happens; a
second \`EEXIST\` fails closed. An empty, foreign, own-pid or live-pid lock is never removed.

Own-pid locks are not reclaimed, matching \`U1t\`; this process also holds the lock across awaits,
so reclaiming it would break mutual exclusion inside one process. The recovered sweep's reason
prefix \`claude agent|session\` becomes this runtime's store name because the lock belongs to this
store, and there is no registry of lock owners to sweep: the store holds one lock, so the cap of
50 and the per-sweep registry iteration have no analogue.

## Verification

\`test/worktrees.test.ts\` 27/27, including a new case that writes a lock reason for a reaped pid
and proves the next \`create\` reclaims it, then proves a live-pid lock and a pid outside the ported
integer bound still fail closed. tsc 0; build 0; full suite 2,079/2,079; chain family 767/767;
dependency notices 0; source and compiled worktree smokes exit 0 with \`locksReleased:true\`;
source index unchanged at 75 chunks / 323,525 units (no recovered module changed); identity
\`2732f49a…\`.
`;
write('research/ports/W47-worktree-stale-lock.md', portNote);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W47-02 reclaims a worktree ownership-store lock left by a dead owner. The store lock now records
\`harness worktree store (pid N)\` and fsyncs it; on EEXIST the lock is read with O_NOFOLLOW under a
512-byte bound, its reason must match the runtime format and name a dead pid (integer in
\`(1, 2147483647]\` whose \`kill(pid, 0)\` reports ESRCH), and the same dev/inode must still be
present before unlink. One reclaim-and-retry is allowed; empty, foreign, own-pid and live locks
stay fail-closed. Ported from \`_x\`/\`Rze\`/\`P1t\`/\`zPo\` in chunk-sfn1dbxq.js and \`Iue\`/\`Nm\` in
chunk-3sda67c1.js. 27/27 worktree tests, tsc 0, full 2,079/2,079, chain 767/767, both smokes
pass; identity \`2732f49a…\`. [W47-02 record](ports/W47-worktree-stale-lock.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W47-02 陈旧 store 锁回收：S-1（先读源）：逐段对照 chunk-sfn1dbxq.js 的 _x/Rze [1759186,1759662)、P1t [1801260,1801370)、zPo [1801370,1802540) 与 chunk-3sda67c1.js 的 Iue [2547,2601)、Nm [2601,2715)（UTF-8 字节半开区间），策略逐项移植。S-2（不臆造）：锁原因改为本运行时 store 格式、单锁不设 50 上限、以 unlink 前的 dev/ino 复核等价于 sweep 的释放时重读登记表、本进程锁不回收（与 U1t 一致），理由已写入源码注释与记录。S-3（边界）：只删除通过格式与存活校验的锁，空锁/外来锁/活锁/自身锁全部失败关闭。S-4（可测）：新增死主回收、活锁与越界 pid 失败关闭用例。S-5/S-6：无新增依赖。S-7（记录）：端口记录与证据 JSON 记录来源、改编与验证；未执行恢复入口点。验证：tsc 0、worktrees 27/27、全量 2,079/2,079、链 767/767、notices 0、两模式 smoke 通过、身份 2732f49a…。
`);

rep('research/FEATURES.md',
  'Archive picker,concurrent new-lock race,power-loss archive recovery,tmux/full original semantics remain gaps',
  'A store lock left by a dead owner is reclaimed on the next operation under the recovered pid-reason policy, while live, foreign and empty locks fail closed; archive picker,concurrent new-lock race,power-loss archive recovery,tmux/full original semantics remain gaps',
);

const oldRow = '| C-4 | 恢复与崩溃边界 | worktree 归档选择器、并发新锁竞争、断电后归档恢复；checkpoint 无主 staging 文件、捕获关联崩溃窗口、断电/GC | Git worktree/cwd relocation；Checkpoint/rewind |';
const newRow = '| C-4 | 恢复与崩溃边界 | 陈旧 store 锁回收已完成（W47-02：锁原因指向已死 pid 时按恢复的 pid 校验回收，活进程/外来/空锁失败关闭）；worktree 归档选择器、并发新锁竞争、断电后归档恢复；checkpoint 无主 staging 文件、捕获关联崩溃窗口、断电/GC 仍待处理 | Git worktree/cwd relocation；Checkpoint/rewind |';
const current = read('research/CURRENT.md');
const rows = current.split(oldRow).length - 1;
if (rows !== 3) throw new Error(`CURRENT holds ${rows} of the C-4 row`);
write('research/CURRENT.md', current.split(oldRow).join(newRow));

const tsv = [
  ['2026-10-17T07:18:00Z', 'decision', 'W47-01 MCP 生命周期按决定结案',
    '① 自动下一轮重拨原文默认关闭，由有界恢复/显式重连/stdio 下次使用重拨取代；② parked refetch 绑定本运行时不实现的 listen 流，由替换刷新与 dirty-at-use 覆盖；③ 断流丢失更新原文同样不可恢复，保持 stale-known 并按事件 ID GET 续读；④ 完整像素解码需 Bun.Image，保留尺寸/字节上限与超限标注',
    '依据 remaining-dispositions.md 第 1/2/5/7 节已核验坐标；无行为变更',
    'research/ports/W47-mcp-dispositions-evidence.json'],
  ['2026-10-17T07:20:00Z', 'verification', 'W47-01 验收：CURRENT 三处 C-3 行与 FEATURES 差距句改为决定记录',
    '无产品行为变更，未执行恢复入口点',
    'CURRENT 三行替换、FEATURES 一行替换、STATUS/coding-standard 追加'],
  ['2026-10-17T07:31:00Z', 'package', 'W47-02 回收死主遗留的 worktree store 锁',
    'src/worktrees.ts 写入锁原因并 fsync；EEXIST 时 O_NOFOLLOW 读取、512 字节上限、死 pid 校验、dev/ino 复核后 unlink；一次重试后失败关闭；test/worktrees.test.ts 新增回收与失败关闭用例',
    '移植 chunk-sfn1dbxq.js _x/Rze/P1t/zPo 与 chunk-3sda67c1.js Iue/Nm',
    'tsc 0；worktrees 27/27；全量 2,079/2,079；链 767/767；两模式 smoke 通过'],
  ['2026-10-17T07:34:00Z', 'decision', 'W47-02 单锁适配恢复策略',
    '① 锁原因改为本运行时 store 格式（原文为 claude agent|session 工作树锁）；② 自身 pid 与 U1t 一致不回收；③ 不设 50 上限与登记表遍历，因为 store 只有一把锁；④ unlink 前以 dev/ino 复核等价于 sweep 的释放时重读；⑤ 空锁/外来锁失败关闭',
    '改编理由写入源码注释与端口记录',
    '.audit/w47-02-test.txt'],
  ['2026-10-17T07:44:00Z', 'finding', 'W47-02 死主锁回收实测与失败关闭',
    '① 已退出 pid 的锁在下次 create 时被回收并正常释放；② 活 pid（本进程）锁仍报 locked 且文件保留；③ 4000000000 越界 pid 仍报 locked；④ 两模式 worktree smoke locksReleased:true',
    '由新增用例与 smoke 实测后写入证据',
    '.audit/w47-02-smoke.txt + .audit/w47-02-smoke-compiled.txt'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w47-runtime.tsv', tsv + '\n');

write('.audit/w47-runtime.todo.md', `# W47 runtime trail

## W47-01 acceptance (2026-10-17)

- [x] **The four MCP lifecycle items are decisions.** CURRENT and FEATURES cite
  [remaining-dispositions.md](../research/ports/remaining-dispositions.md) items 1/2/5/7.
- [x] **No behavior changed.** No product file was touched and no recovered entrypoint ran.

## W47-02 acceptance (2026-10-17)

- [x] **A dead owner's lock is reclaimed.** The store writes \`harness worktree store (pid N)\`; on
  EEXIST a matching reason naming an ESRCH pid allows one reclaim-and-retry.
- [x] **Live and foreign locks fail closed.** Own pid, live pid, out-of-range pid, empty and
  foreign reasons are never removed.
- [x] **The release check is identity-bound.** The lock must still be the same file (dev/ino) that
  was read when the unlink happens, mirroring the sweep's release-time registry re-read.
- [x] **Tests and gates.** New reclaim/live/range case in \`test/worktrees.test.ts\`; tsc 0,
  worktrees 27/27, full 2,079/2,079, chain 767/767, notices 0, both worktree smokes exit 0,
  identity \`2732f49a…\`.
- [ ] Remaining C-4 items: archive picker, concurrent new-lock race, power-loss archive recovery,
  checkpoint orphan staging, capture-correlated crash window, power-loss/GC.
`);

const evidence = {
  schema: 'W47WorktreeStaleLockEvidence.v1',
  package: 'W47-02 — reclaim a worktree store lock left by a dead owner',
  date: '2026-10-17',
  question: 'Can a worktree ownership-store lock left by a crashed process be reclaimed without weakening mutual exclusion?',
  answer: 'Yes, under the recovered pid-reason policy: only a lock whose reason matches the runtime format and names an ESRCH pid is removed, and only after a fresh dev/inode check. Empty, foreign, own-pid and live locks still fail closed.',
  sources: [
    {
      module: 'chunk-sfn1dbxq.js',
      sha256: '4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da',
      ranges: [
        { symbol: '_x, aqt, U1t, V1e, Rze', range: '[1759186,1759662)', coordinateUnit: 'UTF-8 bytes, zero-based half-open', role: 'strict reason regex; own pid and live pid are not releasable; ESRCH decides' },
        { symbol: 'P1t', range: '[1801260,1801370)', coordinateUnit: 'UTF-8 bytes, zero-based half-open', role: 'reason over 512 bytes or not matching the regex is not stale' },
        { symbol: 'zPo', range: '[1801370,1802540)', coordinateUnit: 'UTF-8 bytes, zero-based half-open', role: 'sweep: skip current worktree, release-time registry re-read, A1t = 50 cap' },
      ],
    },
    {
      module: 'chunk-3sda67c1.js',
      sha256: '285259b1c6dcf821a48f703d5fb866a9f69e9b52f19a235a9ae68f7dd7384cef',
      ranges: [
        { symbol: 'Iue', range: '[2547,2601)', coordinateUnit: 'UTF-8 bytes, zero-based half-open', role: 'pid is an integer in (1, 2147483647]' },
        { symbol: 'Nm', range: '[2601,2715)', coordinateUnit: 'UTF-8 bytes, zero-based half-open', role: 'kill(pid, 0) reports ESRCH means dead; any other error means not dead' },
      ],
    },
  ],
  behavior: {
    acquire: 'write and fsync `harness worktree store (pid N)` into the O_EXCL lock',
    reclaim: 'on EEXIST: open O_NOFOLLOW, require a file of at most 512 bytes, match the runtime reason, require pid in the ported bound and ESRCH, re-stat the same dev/inode, unlink, retry acquisition once',
    failClosed: 'empty, foreign, own-pid, live-pid, out-of-range and identity-changed locks stay and raise the locked error',
  },
  adaptations: [
    { change: 'reason names this runtime store instead of `claude agent|session`', reason: 'the lock belongs to this store; there is no foreign agent registry to name' },
    { change: 'own-pid locks are not reclaimed', reason: 'matches U1t; this single process holds the lock across awaits, so reclaiming it would break mutual exclusion' },
    { change: 'no sweep cap or registry iteration', reason: 'the store holds exactly one lock, so A1t = 50 and zPo registry iteration have no analogue' },
    { change: 'unlink guarded by a fresh dev/inode stat', reason: 'direct adaptation of zPo re-reading the registry at release time' },
  ],
  changes: [
    { file: 'src/worktrees.ts', change: 'lock reason, dead-owner reclamation, one retry, identity-bound unlink', sha256: sha(read('src/worktrees.ts')) },
    { file: 'test/worktrees.test.ts', change: 'dead-owner reclaimed; live and out-of-range pids fail closed', sha256: sha(read('test/worktrees.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-4 rows record the completed reclamation and the remaining C-4 items', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'worktree relocation row records the reclamation and keeps the remaining gaps', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W47-02 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W47-02 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  tests: {
    file: 'test/worktrees.test.ts',
    added: 'a store lock whose owner is dead is reclaimed; live and foreign locks stay',
    result: '27/27 pass',
  },
  gates: {
    tsc: 'exit 0',
    worktrees: '27/27',
    build: 'exit 0',
    full: '2,079/2,079',
    chain: '767/767',
    notices: 'exit 0',
    smokeSource: 'exit 0, locksReleased true',
    smokeCompiled: 'exit 0, locksReleased true, compiledCLI true',
    sourceIndex: '75 chunks, 323,525 units (unchanged; no recovered module changed)',
    identity: '2732f49aabb22e6198f17793dab5b2d6b8af0a345720045b580165c0e5047f22',
  },
  residuals: [
    'A crash between O_EXCL creation and the synchronous reason write leaves a zero-byte lock that fails closed; the recovered client has the same window because it also writes its reason after acquisition.',
    'A pid reused between the crash and reclamation is treated as live; the recovered policy has the same limitation because it checks liveness only.',
    'An own-pid lock is never reclaimed, matching the source; it is released by the owning operation or left until that process exits.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-4 continues with the archive picker and the checkpoint crash boundaries; C-1 remains blocked on the user-owned A-1 decision.',
};
write('research/ports/W47-worktree-stale-lock-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW47-02 reclaims',
  'research/coding-standard.md': '\n2026-10-17 W47-02 ',
  'research/FEATURES.md': 'A store lock left by a dead owner is reclaimed',
  '.audit/w47-runtime.todo.md': '\n## W47-02 acceptance',
  'research/ports/W47-worktree-stale-lock.md': '# W47 — the worktree ownership store',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
