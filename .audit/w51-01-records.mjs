// W51-01 record: preserved worktree histories are listed and restored by their original name.
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

const note = `# W51 — preserved worktree histories are listed and restorable

## Source position

The archive directory is this runtime's own layout; the recovered client keeps worktree state in
Git and has no archive equivalent. This package builds on the W50 intent and the recovered
observation-time policy (\`zPo\`, chunk-sfn1dbxq.js [1801370,1802540)): only provable state is
acted on, and selection is refused when it is ambiguous.

## Behavior

\`listWorktreeArchives\` scans \`.agent/worktree-history\` for real directories named
\`<worktree>-<uuid>\`, reads each archive as a session directory, and reports the original name,
creation time, session count and the newest session title. The session reader is the same body
\`listSessions\` uses, extracted as \`listSessionDirectory\` so archives are not symlinked or copied.

\`/worktree-history\` lists up to 20 archives. \`/worktree-history restore ARCHIVE\` accepts an exact
name or a unique prefix and restores the archive into a fresh owned worktree at its original name.
The original name is required because archived session metadata names its original workspace; a
different name would leave every restored session pointing at a missing directory. The restore
creates the worktree first, refuses if the name, path or branch is taken or the checkout already
has \`.agent\`, writes the same durable archive intent used by removal, renames the archive into
\`<checkout>/.agent\`, and then clears the intent. A failure moves the archive back before removing
the checkout it created; if the move back fails, the checkout is kept so the history is never
deleted.

## Verification

Worktree session 5/5 with a list/restore case covering the original-name requirement, the occupied
name refusal and the restored session file. Interactive 7/7, full 2,085/2,085, chain 767/767,
tsc 0, build 0, notices 0, source and compiled worktree smokes exit 0, source index unchanged,
identity \`436bb75f…\`.
`;
write('research/ports/W51-worktree-archive-picker.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W51-01 lists and restores preserved worktree histories. \`listWorktreeArchives\` scans
\`.agent/worktree-history\` for \`<worktree>-<uuid>\` directories and reads each as a session
directory through the extracted \`listSessionDirectory\`, reporting name, creation time, session
count and newest title. \`/worktree-history\` lists up to 20; \`/worktree-history restore ARCHIVE\`
accepts an exact name or unique prefix and restores into a fresh owned worktree at the original
name, because archived session metadata names its original workspace. The restore reuses the W50
durable intent, moves the archive into \`<checkout>/.agent\`, and keeps the checkout rather than
deleting moved history when a rollback cannot be proven. 5/5 worktree-session tests, interactive
7/7, full 2,085/2,085, both smokes pass; identity \`436bb75f…\`.
[W51 record](ports/W51-worktree-archive-picker.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W51-01 worktree 归档选择器：S-1（先读源）：归档布局为本地构造，恢复源无对应体；观察时核对与不可证明即保留沿用 recovered zPo，会话读取复用既有 listSessions 主体。S-2（不臆造）：恢复必须使用原名，因为归档会话元数据记录原 workspace；占用、分支存在或 checkout 已有 .agent 一律拒绝。S-3（边界）：只处理归档目录内的真实目录；失败先把归档移回再移除新建 checkout，移回失败则保留 checkout。S-4（可测）：新增列出/恢复用例，覆盖原名要求、占用拒绝与会话文件。S-5/S-6：无新增依赖。S-7（记录）：端口记录与证据 JSON。验证：tsc 0、session 5/5、interactive 7/7、全量 2,085/2,085、链 767/767、两模式 smoke 通过、身份 436bb75f…。
`);

rep('research/FEATURES.md',
  'archive picker,concurrent new-lock race,tmux/full original semantics remain gaps',
  'preserved histories are listed and can be restored to their original name via /worktree-history, concurrent new-lock race and tmux/full original semantics remain gaps',
);

const oldRow = '| C-4 | 恢复与崩溃边界 | 陈旧 store 锁回收已完成（W47-02：锁原因指向已死 pid 时按恢复的 pid 校验回收，活进程/外来/空锁失败关闭）；checkpoint 无主 staging 文件回收已完成（W48-01：staging 名携带 store 标签，恢复在持锁下清扫本店临时文件，外来/旧式/链接保留）；create 崩溃遗留 creating 预留回收已完成（W49-01：store 锁下按 Git 注册/分支/目录身份收养或清除，无法验证则保留）；断电后归档恢复已完成（W50-01：归档前持久写入 pending intent，启动或下次移除按 pid/目录身份/归档状态恢复或清理，歧义保留并告警）；worktree 归档选择器、并发新锁竞争、捕获关联崩溃窗口、断电/GC 仍待处理 | Git worktree/cwd relocation；Checkpoint/rewind |';
const newRow = '| C-4 | 恢复与崩溃边界 | 陈旧 store 锁回收已完成（W47-02：锁原因指向已死 pid 时按恢复的 pid 校验回收，活进程/外来/空锁失败关闭）；checkpoint 无主 staging 文件回收已完成（W48-01：staging 名携带 store 标签，恢复在持锁下清扫本店临时文件，外来/旧式/链接保留）；create 崩溃遗留 creating 预留回收已完成（W49-01：store 锁下按 Git 注册/分支/目录身份收养或清除，无法验证则保留）；断电后归档恢复已完成（W50-01：归档前持久写入 pending intent，启动或下次移除按 pid/目录身份/归档状态恢复或清理，歧义保留并告警）；归档选择器已完成（W51-01：/worktree-history 列出并按原名恢复到新建 owned checkout，复用 intent 断电恢复）；并发新锁竞争、捕获关联崩溃窗口、断电/GC 仍待处理 | Git worktree/cwd relocation；Checkpoint/rewind |';
const current = read('research/CURRENT.md');
const rows = current.split(oldRow).length - 1;
if (rows !== 3) throw new Error(`CURRENT holds ${rows} of the C-4 row`);
write('research/CURRENT.md', current.split(oldRow).join(newRow));

const tsv = [
  ['2026-10-17T09:18:00Z', 'package', 'W51-01 worktree 归档选择器与按原名恢复',
    'listSessionDirectory 抽取；listWorktreeArchives 读取归档会话摘要；restoreWorktreeArchive 新建 owned checkout 后复用 intent 移入归档；/worktree-history [restore ARCHIVE] 列出与恢复',
    '归档布局为本地构造；观察时核对沿用 recovered zPo',
    'session 5/5；interactive 7/7；全量 2,085/2,085；链 767/767；两模式 smoke 通过'],
  ['2026-10-17T09:21:00Z', 'decision', 'W51-01 恢复只允许原名',
    '① 归档会话元数据记录原 workspace，换名会让恢复后的会话指向不存在的目录；② 名称、路径、分支任一占用即拒绝；③ checkout 已有 .agent 即拒绝；④ 失败先移回归档再移除新建 checkout，移回失败保留 checkout；⑤ 选择器支持唯一前缀，歧义拒绝',
    '残余：恢复后的代码状态为 HEAD，旧文件状态需经归档内 checkpoint 恢复；新建 checkout 后、intent 前崩溃会留下空 owned worktree',
    '.audit/w51-01-test.txt'],
  ['2026-10-17T09:24:00Z', 'verification', 'W51-01 验收：session 5/5、interactive 7/7、2,085/2,085、767/767、两模式 smoke、身份 436bb75f…',
    '列出、占用拒绝、恢复后会话文件均在位；归档目录清空',
    'tsc 0；build 0；notices 0；索引 75 chunks / 323,525 单位不变；smoke locksReleased:true'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w51-runtime.tsv', tsv + '\n');

write('.audit/w51-runtime.todo.md', `# W51 runtime trail

## W51-01 acceptance (2026-10-17)

- [x] **Archives are readable without mutation.** \`listWorktreeArchives\` reads each archive as a
  session directory and reports name, created time, session count and newest title.
- [x] **The picker surface exists.** \`/worktree-history\` lists up to 20; \`restore ARCHIVE\` accepts
  an exact name or a unique prefix and refuses ambiguity.
- [x] **Restore preserves session paths.** The original worktree name is required and recreated, so
  archived metadata still points at the restored checkout.
- [x] **Restore is crash-aware.** It reuses the W50 intent, moves the archive back before removing
  a created checkout, and keeps the checkout when the move back cannot be proven.
- [x] **Gates.** tsc 0, worktree-session 5/5, interactive 7/7, full 2,085/2,085, chain 767/767,
  notices 0, build 0, both smokes exit 0, index unchanged, identity \`436bb75f…\`.
- [ ] Remaining C-4 items: concurrent new-lock race, capture-correlation crash window,
  power-loss/GC.
`);

const evidence = {
  schema: 'W51WorktreeArchivePickerEvidence.v1',
  package: 'W51-01 — preserved worktree histories listed and restored by original name',
  date: '2026-10-17',
  question: 'Can preserved worktree histories be browsed and brought back into a usable checkout?',
  answer: 'Yes. Archives are listed from their session metadata and restored into a fresh owned worktree at the original name, so archived session workspaces remain valid; ambiguous or occupied restores are refused.',
  sourcePosition: {
    kind: 'local extension; archive layout has no recovered body',
    evidence: 'recovered zPo (chunk-sfn1dbxq.js [1801370,1802540), UTF-8 bytes) reconciles stale state only from provable facts; listSessionDirectory is the existing session reader.',
  },
  behavior: {
    list: 'scan .agent/worktree-history for real <worktree>-<uuid> directories; report name, created, sessions, newest title',
    surface: '/worktree-history lists up to 20; /worktree-history restore ARCHIVE accepts an exact name or unique prefix',
    restore: 'create a fresh owned worktree at the original name, write the W50 durable intent, rename the archive into <checkout>/.agent, clear the intent',
    refusal: 'occupied name/path/branch, existing checkout .agent, ambiguous selector, or an active worktree session',
    rollback: 'move the archive back before removing a created checkout; keep the checkout when the move back cannot be proven',
  },
  changes: [
    { file: 'src/sessions.ts', change: 'extract listSessionDirectory; listSessions delegates', sha256: sha(read('src/sessions.ts')) },
    { file: 'src/worktree-session.ts', change: 'listWorktreeArchives and restoreWorktreeArchive', sha256: sha(read('src/worktree-session.ts')) },
    { file: 'src/interactive.ts', change: '/worktree-history list/restore handler and help line', sha256: sha(read('src/interactive.ts')) },
    { file: 'test/worktree-session.test.ts', change: 'list/restore case', sha256: sha(read('test/worktree-session.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-4 rows record the completed picker', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'worktree relocation row records the picker', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W51-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W51-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  tests: {
    file: 'test/worktree-session.test.ts',
    added: 'preserved histories are listed and restored to their original name',
    result: '5/5 pass; interactive 7/7',
  },
  gates: {
    tsc: 'exit 0',
    worktreeSession: '5/5',
    interactive: '7/7',
    build: 'exit 0',
    full: '2,085/2,085',
    chain: '767/767',
    notices: 'exit 0',
    smokeSource: 'exit 0, locksReleased true',
    smokeCompiled: 'exit 0, locksReleased true, compiledCLI true',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '436bb75fafcdf546432e9348b2938964fa5899a3867637b952b3f99784185a2d',
  },
  residuals: [
    'Restore recreates the checkout at HEAD; the removed dirty or committed file state is only recoverable through checkpoints stored in the archive.',
    'A crash after creating the checkout but before the intent leaves an empty owned worktree; it can be removed with the normal removal path.',
    'Archives whose original branch still exists cannot be restored until that branch is removed.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-4 continues with the concurrent new-lock race, the capture-correlation crash window and power-loss/GC.',
};
write('research/ports/W51-worktree-archive-picker-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW51-01 lists and restores',
  'research/coding-standard.md': '\n2026-10-17 W51-01 ',
  'research/FEATURES.md': 'preserved histories are listed and can be restored',
  'research/ports/W51-worktree-archive-picker.md': '# W51 — preserved worktree histories',
  '.audit/w51-runtime.todo.md': '\n## W51-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
