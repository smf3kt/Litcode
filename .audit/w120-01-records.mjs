// W120-01 record: background session fork.
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

function replaceOnce(path, from, to) {
  const text = read(path);
  if (text.split(from).length - 1 !== 1) throw new Error(`${path}: expected one occurrence of ${JSON.stringify(from)}`);
  write(path, text.replace(from, to));
}

function replaceAll(path, from, to, expected) {
  const text = read(path);
  const count = text.split(from).length - 1;
  if (count !== expected) throw new Error(`${path}: expected ${expected} occurrences of ${JSON.stringify(from)}, found ${count}`);
  write(path, text.split(from).join(to));
}

const note = `# W120 — Background session fork

## Source position

The REPL handler \`_1s\` (chunk-24k7d6mw.js offset 38204) gates the command:
no backgrounding while already a background job, disabled persistence
(\`Cannot background — session persistence is disabled, so the forked job would
have nothing to resume.\`), and an empty seed
(\`Nothing to background yet — send a message first.\`). The seed is \`fBe\`
(offset 51242): walk messages backward, take the latest assistant text
whitespace-collapsed and truncated to 120 as \`detail\`, take the latest real
user text as \`intent\` unless an explicit prompt was passed, skip tool-result
messages, meta messages and command records, fall back to \`(backgrounded)\`, and
truncate \`intent\` to 200. Helpers: \`TF\`/\`zg\`/\`rb\`/\`N_\`
(chunk-sfn1dbxq.js offsets 4432714/4432935/4433793/4422125), \`ne\`
(chunk-ax7r0qj7.js offset 1128), \`O$\` (chunk-r2vtj1kh.js offset 164599) with
the tags of chunk-gsnbskq4.js offset 8723. The spawn core \`gft\` (offset 38766)
forks the conversation, checks the fork point, copies a snapshot before the
spawn, filters CLI arguments and returns \`{ok, error, queued, reason}\`; a spawn
failure removes the unused snapshot.

## Port

\`backgroundSeed\` ports \`fBe\` over the local \`session.messages\`. The local
journal has no \`isMeta\` flag, so the two meta kinds this harness appends
(\`Hook context:\`, \`Stop hook feedback:\`) join the skip set.
\`startBackgroundSession\` materializes the fork with \`forkSession\` before
spawning, so the child journal is complete even if the parent exits at once.
The child is a detached headless CLI: \`<exec> <execArgv> <entry> --resume
<forkId> <task>\`, cwd at the workspace, stdout/stderr appended to
\`<workspace>/.agent/background/<forkId>.log\`. A synchronous spawn failure
removes the unused fork and raises \`Couldn't fork — <message>\`. The interactive
command \`/background [PROMPT]\` refuses a running turn and prints the fork id,
pid, log path and resume command.

## Adaptation

- Local sessions always persist; the source's disabled-persistence gate has no
  switch here, and its branch is unreachable.
- There is no session background-job registry: the child is an ordinary
  detached headless CLI with its own journal. The queued-restart/adoption path,
  job directory, snapshot V5 copy, \`bgIsolation\` worktree briefing, carry-over
  counts and the confirmation dialog have no local counterpart.
- The source fork point is a transcript leaf uuid; local forks use the completed
  history without a boundary.
- The child receives only the local CLI surface. The source's carried
  permission snapshots, allowed-tool list, hooks and effort switches are not
  forwarded.
- Command-record detection reproduces the source tag set. This journal marks
  local-command output through its own events, so the tags only matter for text
  that carries them.

## Verification

\`background-session\` pins seed selection, skips, UTF-16 truncation, fork
lineage and spawn arguments, failed-spawn cleanup and the empty gate.
Focused 50/50, extended 86/86, tsc 0, build 0, full 2,177/2,177, chain
768/768, identity \`5824092a…\`.
`;
write('research/ports/W120-background-fork.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W120-01 adds \`/background [PROMPT]\`. The seed port follows \`fBe\`: the latest
real user text (or the explicit prompt) as intent, the latest assistant line as
detail, with tool results, command records and the two local meta kinds
skipped. The command writes the fork journal before spawning a detached
headless child on \`--resume <forkId> <task>\` with output under
\`.agent/background/<forkId>.log\`; a failed spawn removes the fork. The source's
job registry, snapshot copy, worktree briefing and carry-over counts have no
local counterpart. Focused 50/50, extended 86/86, tsc 0, build 0, full
2,177/2,177, chain 768/768, identity \`5824092a…\`.
[W120 record](ports/W120-background-fork.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W120-01 后台会话fork：S-1（先读源）：_1s 38204、fBe 51242、gft 38766（chunk-24k7d6mw.js）、TF/zg/rb/N_ 4432714/4432935/4433793/4422125（chunk-sfn1dbxq.js）、ne 1128（chunk-ax7r0qj7.js）、O$ 164599（chunk-r2vtj1kh.js）、标签 8723（chunk-gsnbskq4.js）。S-2（不臆造）：种子取最新真实用户文本（显式prompt优先）与最新assistant行，跳过tool_result、命令记录与元消息，intent 200、detail 120、UTF-16不拆代理对；先落盘fork再分离headless子进程（--resume forkId task），日志入.agent/background；同步spawn失败删除未用fork并报Couldn't fork —。S-3（边界）：本地始终持久化，禁用持久化门不可达；无会话后台job registry，无排队重启/收养、job目录、快照V5复制、bgIsolation工作树简报、结转计数与确认对话框；fork点固定为完成历史；子进程仅带本地CLI面。S-4（可测）：background-session断言种子/跳过/截断/fork血缘与spawn参数/失败清理/空门；interactive、session-storage、workspace-session回归。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据JSON。验证：聚焦50/50、扩展86/86、tsc 0、build 0、全量2,177/2,177、链768/768、notices 0、索引不变、身份5824092a…。
`);

replaceOnce('research/FEATURES.md',
  'complete originalTUI/backgroundfork still gaps',
  'background fork now writes the fork before spawning a detached headless child (W120); complete original TUI fork surfaces still gaps');

replaceAll('research/CURRENT.md',
  '；后台 fork、跨会话发现（现为 external）仍待处理',
  '；W120交付/background后台fork（fBe种子选择、先落盘fork再分离headless子进程、失败清理；无job registry/快照复制/工作树简报）；跨会话发现（现为 external）仍待处理', 3);

const tsv = [
  ['2026-10-18T01:45:00Z', 'package', 'W120-01 background session fork',
    '_1s 38204、fBe 51242、gft 38766（chunk-24k7d6mw.js）、TF/zg/rb/N_（chunk-sfn1dbxq.js）、ne（chunk-ax7r0qj7.js）、O$（chunk-r2vtj1kh.js）',
    '种子选择与跳过；intent 200/detail 120；先fork后spawn；detached headless --resume；失败删除fork',
    'background-session 6/6；聚焦50/50；扩展86/86；tsc 0；build 0；全量2,177/2,177；链768/768'],
  ['2026-10-18T01:48:00Z', 'decision', 'W120-01 本地适配',
    '本地始终持久化；无会话后台job registry、快照复制、工作树简报与结转计数',
    '子进程为普通detached headless CLI；fork点固定为完成历史；不转发权限快照/allowed-tools/hooks',
    '.audit/w120-01-full.txt'],
  ['2026-10-18T01:51:00Z', 'verification', 'W120-01 验收：聚焦50/50、扩展86/86、tsc 0、build 0、2,177/2,177、768/768',
    '种子取最新真实用户文本与assistant行；/background拒绝运行中回合；日志与resume命令输出',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 5824092a…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w120-runtime.tsv', tsv + '\n');

write('.audit/w120-runtime.todo.md', `# W120 runtime trail

## W120-01 acceptance (2026-10-18)

- [x] **Source read.** The REPL gate texts, the seed walk with its skip set and
  truncation units, and the spawn core's fork-before-spawn ordering and failure
  cleanup.
- [x] **Port.** The seed function over local messages, the fork-then-spawn
  module, and the interactive command with resume guidance.
- [x] **Bounds.** Always-persisted sessions, no session job registry, no
  snapshot V5 or worktree briefing, completed-history fork point, local CLI
  arguments only.
- [x] **Gates.** focused 50/50, extended 86/86, tsc 0, build 0, full
  2,177/2,177, chain 768/768, notices 0, source index unchanged, identity
  \`5824092a…\`.
- [ ] Remaining C-7: cross-session discovery remains external.
`);

const evidence = {
  schema: 'W120BackgroundForkEvidence.v1',
  package: 'W120-01 — Background session fork',
  date: '2026-10-18',
  question: 'How does the interactive command fork a session into a background task?',
  answer: 'The seed walks the conversation backward for the latest real user text (or the explicit prompt) and the latest assistant line, skipping tool results, command records and local meta messages. The command writes a fork journal first, then spawns a detached headless child on --resume <forkId> <task> with stdout/stderr under .agent/background/<forkId>.log. A failed spawn removes the unused fork.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    handler: { module: 'extracted-v2/modules/chunk-24k7d6mw.js', offsets: [38204] },
    seed: { module: 'extracted-v2/modules/chunk-24k7d6mw.js', offsets: [51242] },
    spawnCore: { module: 'extracted-v2/modules/chunk-24k7d6mw.js', offsets: [38766] },
    helpers: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offsets: [4432714, 4432935, 4433793, 4422125] },
    truncate: { module: 'extracted-v2/modules/chunk-ax7r0qj7.js', offsets: [1128] },
    commandTags: { module: 'extracted-v2/modules/chunk-r2vtj1kh.js', offsets: [164599] },
  },
  behavior: {
    explicitPromptWins: true,
    intentCap: 200,
    detailCap: 120,
    toolResultMessagesSkipped: true,
    commandRecordsSkipped: true,
    localMetaSkipped: true,
    forkWrittenBeforeSpawn: true,
    detachedHeadlessChild: true,
    failedSpawnRemovesFork: true,
    sessionJobRegistry: false,
    snapshotV5Copy: false,
    worktreeForkBriefing: false,
    carryOverCounts: false,
  },
  adaptations: [
    'Local sessions always persist, so the source disabled-persistence gate and its text are unreachable.',
    'No session background-job registry: the child is an ordinary detached headless CLI; no queued restart/adoption, job directory or snapshot copy.',
    'No bgIsolation worktree briefing, carry-over counts or confirmation dialog.',
    'The fork point is the completed history; the source accepts a transcript leaf uuid.',
    'The child receives only the local CLI arguments; permission snapshots, allowed-tool lists, hooks and effort switches are not forwarded.',
  ],
  changes: [
    { file: 'src/background-session.ts', change: 'seed port and fork-then-spawn module', sha256: sha(read('src/background-session.ts')) },
    { file: 'src/interactive.ts', change: '/background command and help line', sha256: sha(read('src/interactive.ts')) },
    { file: 'test/background-session.test.ts', change: 'seed, lineage, spawn and gate tests', sha256: sha(read('test/background-session.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-7 rows record W120', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Session row records W120', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W120-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W120-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '50/50 (background-session, interactive, session-storage, workspace-session)',
    extended: '86/86',
    build: 'exit 0',
    full: '2,177/2,177',
    chain: '768/768',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '5824092ad22db8938248dfd95e6fe3084bb74459da31358563656b95bfb986c4',
  },
  residuals: ['Cross-session discovery remains external.'],
  recoveredEntrypointsExecuted: false,
  next: 'C-7 cross-session discovery remains external; the next ready local item is C-8 or C-10.',
};
write('research/ports/W120-background-fork-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW120-01 adds ',
  'research/coding-standard.md': '\n2026-10-17 W120-01 ',
  'research/FEATURES.md': 'background fork now writes the fork',
  'research/ports/W120-background-fork.md': '# W120 — Background session fork',
  '.audit/w120-runtime.todo.md': '\n## W120-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
