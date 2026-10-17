// W50-01 record: worktree removal writes a durable archive intent and later starts reconcile it.
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

const note = `# W50 — a durable archive intent makes worktree removal power-loss recoverable

## Source position

The archive layout (\`.agent/worktree-history\`) and the removal flow are this runtime's own
construction; the recovered client keeps worktree state in Git and has no archive directory to
port. This package therefore extends the local removal contract. The reconciliation follows the
recovered observation-time policy used by \`zPo\` (chunk-sfn1dbxq.js [1801370,1802540)): act only on
facts that can be proven now, retain everything else.

## Behavior

\`removeExitedWorktree\` now writes \`.agent/worktree-history/.pending-<uuid>.json\` with fsync before
renaming the checkout history into the archive. The intent records the origin, checkout, history,
archive, the checkout's dev/ino, the pid and the creation time. A successful removal deletes the
intent; a failed removal deletes it only when the history is back in place, was never archived, or
the checkout is gone and the archive is final. Otherwise the intent stays.

\`recoverWorktreeArchives(workspace)\` runs at interactive start and before every removal:

- history exists, archive absent: clear the intent.
- history exists, archive also exists: retain with a warning (ambiguous).
- archive exists, checkout absent: the removal completed; clear the intent and keep the archive.
- archive exists, checkout present with the recorded dev/ino: restore the archive to
  \`<checkout>/.agent\` and clear the intent.
- checkout identity changed, archive not a real directory, both paths missing, an intent owned by
  a live pid, invalid JSON, or paths outside this workspace: retain with a warning.

The scan is capped at 100 intents; interactive startup reports every restoration and warning on
the status stream and never fails session start.

## Verification

Worktree session 4/4 with a new power-loss recovery case (restore, live-owner skip, completed
removal cleanup), and the existing removal case now asserts no pending intent remains. Full
2,084/2,084, chain 767/767, tsc 0, build 0, notices 0, source and compiled worktree smokes exit 0,
source index unchanged, identity \`6fb4abe8…\`.
`;
write('research/ports/W50-worktree-archive-intent.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W50-01 makes worktree removal power-loss recoverable. Before renaming the checkout history into
\`.agent/worktree-history\`, removal writes and fsyncs a \`.pending-<uuid>.json\` intent with the
origin, checkout, history, archive, checkout dev/ino and pid. \`recoverWorktreeArchives\` runs at
interactive start and before each removal: it restores an archived history into an unchanged
checkout, clears a completed or already-home intent, and retains ambiguous states with a warning
(history and archive both present, changed checkout identity, live owner, invalid paths). A
successful removal and an in-process restore both clear their intent. 4/4 worktree-session tests,
full 2,084/2,084, both smokes pass; identity \`6fb4abe8…\`.
[W50 record](ports/W50-worktree-archive-intent.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W50-01 worktree 归档断电恢复：S-1（先读源）：归档布局与移除流程为本地构造，恢复源无对应体；观察时核对与不可证明即保留沿用 recovered zPo。S-2（不臆造）：intent 只在归档 rename 前持久写入，恢复只处理能证明的四种状态，歧义一律保留并告警。S-3（边界）：intent 路径必须在本工作区归档目录内，checkout 必须位于本工作区 worktrees 目录；活 pid 跳过；扫描上限 100；启动恢复失败不阻断会话。S-4（可测）：新增断电恢复用例，成功移除与失败回滚均断言无遗留 intent。S-5/S-6：复用 zod 与既有目录同步，无新增依赖。S-7（记录）：端口记录与证据 JSON。验证：tsc 0、session 4/4、全量 2,084/2,084、链 767/767、两模式 smoke 通过、身份 6fb4abe8…。
`);

rep('research/FEATURES.md',
  'a creating reservation left by an interrupted create is adopted when Git registered it or dropped when its Git work never landed, with unverifiable reservations retained; archive picker,concurrent new-lock race,power-loss archive recovery,tmux/full original semantics remain gaps',
  'a creating reservation left by an interrupted create is adopted when Git registered it or dropped when its Git work never landed, with unverifiable reservations retained; a removal records a durable archive intent and the next start or removal restores an archived history whose unchanged checkout remains, clears a completed intent, and retains ambiguous states; archive picker,concurrent new-lock race,tmux/full original semantics remain gaps',
);

const oldRow = '| C-4 | 恢复与崩溃边界 | 陈旧 store 锁回收已完成（W47-02：锁原因指向已死 pid 时按恢复的 pid 校验回收，活进程/外来/空锁失败关闭）；checkpoint 无主 staging 文件回收已完成（W48-01：staging 名携带 store 标签，恢复在持锁下清扫本店临时文件，外来/旧式/链接保留）；create 崩溃遗留 creating 预留回收已完成（W49-01：store 锁下按 Git 注册/分支/目录身份收养或清除，无法验证则保留）；worktree 归档选择器、并发新锁竞争、断电后归档恢复、捕获关联崩溃窗口、断电/GC 仍待处理 | Git worktree/cwd relocation；Checkpoint/rewind |';
const newRow = '| C-4 | 恢复与崩溃边界 | 陈旧 store 锁回收已完成（W47-02：锁原因指向已死 pid 时按恢复的 pid 校验回收，活进程/外来/空锁失败关闭）；checkpoint 无主 staging 文件回收已完成（W48-01：staging 名携带 store 标签，恢复在持锁下清扫本店临时文件，外来/旧式/链接保留）；create 崩溃遗留 creating 预留回收已完成（W49-01：store 锁下按 Git 注册/分支/目录身份收养或清除，无法验证则保留）；断电后归档恢复已完成（W50-01：归档前持久写入 pending intent，启动或下次移除按 pid/目录身份/归档状态恢复或清理，歧义保留并告警）；worktree 归档选择器、并发新锁竞争、捕获关联崩溃窗口、断电/GC 仍待处理 | Git worktree/cwd relocation；Checkpoint/rewind |';
const current = read('research/CURRENT.md');
const rows = current.split(oldRow).length - 1;
if (rows !== 3) throw new Error(`CURRENT holds ${rows} of the C-4 row`);
write('research/CURRENT.md', current.split(oldRow).join(newRow));

const tsv = [
  ['2026-10-17T08:52:00Z', 'package', 'W50-01 worktree 归档断电恢复 intent',
    'removeExitedWorktree 在 rename 前 fsync 写入 .pending-<uuid>.json（origin/checkout/history/archive/dev/ino/pid）；成功与进程内回滚清理 intent；recoverWorktreeArchives 在交互启动与每次移除前恢复/清理/保留；INTERACTIVE 启动输出恢复与告警',
    '归档布局为本地构造；观察时核对策略沿用 recovered zPo',
    'session 4/4；全量 2,084/2,084；链 767/767；两模式 smoke 通过'],
  ['2026-10-17T08:55:00Z', 'decision', 'W50-01 恢复只在可证明状态上动作',
    '① history 已在位→清 intent；② archive 在位、checkout 缺失→移除已完成，保留 archive 并清 intent；③ archive 在位、checkout dev/ino 未变→恢复 history；④ 双份/身份变化/非真实目录/双缺失/活 pid/非法路径→保留并告警；⑤ intent 扫描上限 100，启动失败不阻断',
    '残余：intent 写入前崩溃遗留的临时文件不自动清理；无头单次启动不触发恢复',
    '.audit/w50-01-test.txt'],
  ['2026-10-17T08:58:00Z', 'verification', 'W50-01 验收：session 4/4、2,084/2,084、767/767、两模式 smoke、身份 6fb4abe8…',
    '成功移除与失败回滚均无遗留 intent；断电恢复用例覆盖恢复/跳过/完成清理',
    'tsc 0；build 0；notices 0；索引 75 chunks / 323,525 单位不变；smoke locksReleased:true'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w50-runtime.tsv', tsv + '\n');

write('.audit/w50-runtime.todo.md', `# W50 runtime trail

## W50-01 acceptance (2026-10-17)

- [x] **The archive rename has a durable intent.** The intent is written and fsync'd before the
  rename, with origin, checkout, history, archive, dev/ino and pid.
- [x] **Recovery is provable-state only.** Restore an archive into an unchanged checkout; clear a
  completed, already-home, or never-archived intent; retain ambiguous states with a warning.
- [x] **Live owners are skipped.** A pending intent whose pid is alive is left alone.
- [x] **Startup is not blocked.** Interactive start reports restorations and warnings and carries on
  when recovery throws.
- [x] **Gates.** tsc 0, worktree-session 4/4, full 2,084/2,084, chain 767/767, notices 0, build 0,
  both worktree smokes exit 0, index unchanged, identity \`6fb4abe8…\`.
- [ ] Remaining C-4 items: worktree archive picker, concurrent new-lock race, capture-correlation
  crash window, power-loss/GC.
`);

const evidence = {
  schema: 'W50WorktreeArchiveIntentEvidence.v1',
  package: 'W50-01 — durable worktree archive intent and power-loss recovery',
  date: '2026-10-17',
  question: 'Can a power loss between the archive rename and the worktree removal be reconciled later?',
  answer: 'Yes. A durable intent written before the rename lets the next start or removal restore the archived history into an unchanged checkout, clear a completed removal, and retain anything ambiguous.',
  sourcePosition: {
    kind: 'local extension; archive layout has no recovered body',
    evidence: 'recovered zPo (chunk-sfn1dbxq.js [1801370,1802540), UTF-8 bytes) reconciles stale state at observation time and retains what it cannot prove.',
  },
  behavior: {
    write: 'before the history rename: fsync .agent/worktree-history/.pending-<uuid>.json with origin, checkout, history, archive, checkout dev/ino, pid, created_at',
    success: 'successful removal deletes the intent',
    rollback: 'an in-process restore deletes the intent; an intent is kept when the archive remains and the checkout still exists',
    recovery: 'interactive start and every removal run recoverWorktreeArchives: restore into an unchanged checkout, clear completed/already-home intents, retain ambiguous states with warnings',
  },
  changes: [
    { file: 'src/worktree-session.ts', change: 'intent schema/writer/sweeper and removeExitedWorktree integration', sha256: sha(read('src/worktree-session.ts')) },
    { file: 'src/interactive.ts', change: 'startup recovery and status reporting', sha256: sha(read('src/interactive.ts')) },
    { file: 'test/worktree-session.test.ts', change: 'power-loss recovery case and no-pending assertions', sha256: sha(read('test/worktree-session.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-4 rows record the completed archive recovery', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'worktree relocation row records the intent and recovery', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W50-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W50-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  tests: {
    file: 'test/worktree-session.test.ts',
    added: 'an archive intent left by a power loss is reconciled on the next start',
    result: '4/4 pass',
  },
  gates: {
    tsc: 'exit 0',
    worktreeSession: '4/4',
    worktrees: '29/29',
    build: 'exit 0',
    full: '2,084/2,084',
    chain: '767/767',
    notices: 'exit 0',
    smokeSource: 'exit 0, locksReleased true',
    smokeCompiled: 'exit 0, locksReleased true, compiledCLI true',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '6fb4abe8cc8cd3128c298b43da78f7b3a0fe5bf1fef22678cee0cafc3509fe08',
  },
  residuals: [
    'A crash before the intent rename leaves a .pending-<uuid>.json.<uuid>.tmp file; recovery ignores it because it carries no owner.',
    'Ambiguous states (history and archive both present, changed checkout identity, invalid intent) are retained for inspection.',
    'Headless single-shot runs do not reconcile archives until an interactive start or another removal in that workspace.',
    'The scan is capped at 100 intents per workspace.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-4 continues with the worktree archive picker, the concurrent new-lock race and the capture-correlation crash window.',
};
write('research/ports/W50-worktree-archive-intent-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW50-01 makes worktree',
  'research/coding-standard.md': '\n2026-10-17 W50-01 ',
  'research/FEATURES.md': 'a removal records a durable archive intent',
  'research/ports/W50-worktree-archive-intent.md': '# W50 — a durable archive intent',
  '.audit/w50-runtime.todo.md': '\n## W50-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
