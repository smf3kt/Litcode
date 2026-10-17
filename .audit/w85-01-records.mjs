// W85-01 record: TaskCompleted and TeammateIdle payloads.
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

const note = `# W85 — TaskCompleted and TeammateIdle payloads

## Source position

\`pvt\` (chunk-sfn1dbxq.js, UTF-16 [2947228,2947575)) builds TaskCompleted as
\`{task_id, task_subject, task_description, teammate_name, team_name}\` over the
common context \`$d\` [2958255,2958860). The idle call site
(chunk-5b2hxy2e.js offset 74688) resolves \`{teammateName, teamName}\` through
\`Ua\` (offset 60370) and raises TaskCompleted for every \`in_progress\` task whose
\`owner\` equals the teammate name before raising TeammateIdle. \`qir\`
[2946651,2946909) builds TeammateIdle as \`{teammate_name, team_name}\` over the
same common fields.

## Port

The TaskCompleted gate reads the target record through the new
\`readTaskRecord\` and sends \`task_id\`, \`task_subject\`, \`task_description\` and
\`teammate_name\` from the record's \`owner\` when set. When the record is absent
it keeps the prior tool-field payload as a fallback. WorktreeCreate is
unchanged. The interactive TeammateIdle raise drops its local \`source\` field;
it keeps the common \`agent_id\` and \`teammate_name\`.

## Adaptation

The product completes one task per gate call, whereas the source iterates every
in-progress task owned by the idle teammate at idle time; the per-task gate is
the existing adaptation and its trigger is unchanged. \`team_name\` remains
unset because neither the task store nor the local idle event carries a team
name.

## Verification

\`agent-lifecycle\` 29/29 and \`hooks\` 50/50: a blocking TaskCompleted gate sees
the created task's \`task_id\`/\`task_subject\`/\`task_description\`, no tool
fields, and leaves the task pending; with \`owner: "alice"\` the payload carries
\`teammate_name: "alice"\` and the update completes. tsc 0; build 0; full
2,114/2,114; chain 767/767; notices 0; source index unchanged; identity
\`6b50f209…\`.
`;
write('research/ports/W85-task-completed-payload.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W85-01 aligns the TaskCompleted and TeammateIdle payloads. The TaskCompleted
gate reads the target record and sends \`task_id\`, \`task_subject\`,
\`task_description\` and \`teammate_name\` from its \`owner\`, falling back to the
tool fields only when the record is absent; WorktreeCreate is unchanged. The
interactive TeammateIdle raise drops its local \`source\` and keeps \`agent_id\`
and \`teammate_name\`. The per-task completion trigger stays as the existing
adaptation; \`team_name\` has no local source. \`agent-lifecycle\` 29/29,
\`hooks\` 50/50, tsc 0, build 0, full 2,114/2,114, chain 767/767, identity
\`6b50f209…\`. [W85 record](ports/W85-task-completed-payload.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W85-01 TaskCompleted/TeammateIdle 载荷：S-1（先读源）：读取 chunk-sfn1dbxq.js 的 pvt [2947228,2947575)、qir [2946651,2946909)、$d [2958255,2958860)，以及 chunk-5b2hxy2e.js 空闲调用点 74688 与 Ua 60370（UTF-16）。S-2（不臆造）：TaskCompleted 取记录自身字段，teammate_name 取 owner；记录缺失时保留工具字段回退；TeammateIdle 去掉本地 source。S-3（边界）：保持逐任务完成门控，不复刻空闲时按 owner 遍历；team_name 本地无来源。S-4（可测）：新增阻断门控字段用例与 owner→teammate_name 用例。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：agent-lifecycle 29/29、hooks 50/50、tsc 0、build 0、全量 2,114/2,114、链 767/767、身份 6b50f209…。
`);

replaceOnce('research/FEATURES.md',
  'while team fields stay unset because the tool path has no team identity |',
  'while team fields stay unset because the tool path has no team identity; W85 gives TaskCompleted the target task\'s own fields and takes `teammate_name` from its `owner`, and the interactive TeammateIdle raise drops its local `source` while keeping `agent_id`/`teammate_name` (the per-task completion trigger and the absent `team_name` remain recorded adaptations) |');

replaceAll('research/CURRENT.md',
  '完整消费者与脚本语义仍待处理',
  'W85完成TaskCompleted/TeammateIdle载荷（任务字段取记录自身，teammate_name取owner；TeammateIdle去source）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-18T00:10:00Z', 'package', 'W85-01 TaskCompleted/TeammateIdle 载荷',
    'pvt [2947228,2947575)、qir [2946651,2946909)、$d [2958255,2958860)、空闲调用点 74688、Ua 60370；readTaskRecord 与载荷构造',
    'TaskCompleted 取记录字段，teammate_name=owner，缺失时回退工具字段；TeammateIdle 去 source 保留 agent_id/teammate_name',
    'agent-lifecycle 29/29；hooks 50/50；tsc 0；build 0；全量 2,114/2,114；链 767/767'],
  ['2026-10-18T00:12:00Z', 'decision', 'W85-01 边界',
    '① 保持逐任务完成门控；② 不复刻空闲时按 owner 遍历 in_progress；③ team_name 无本地来源',
    '残余：完整消费者与脚本语义',
    '.audit/w85-01-full.txt'],
  ['2026-10-18T00:15:00Z', 'verification', 'W85-01 验收：agent-lifecycle 29/29、hooks 50/50、tsc 0、build 0、2,114/2,114、767/767',
    '阻断门控含 task_id/subject/description 且无工具字段、任务保持 pending；owner=alice 时 teammate_name=alice 且完成',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 6b50f209…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w85-runtime.tsv', tsv + '\n');

write('.audit/w85-runtime.todo.md', `# W85 runtime trail

## W85-01 acceptance (2026-10-18)

- [x] **Source read.** \`pvt\`, \`qir\`, \`$d\`, the idle call site and \`Ua\`
  measured in UTF-16 code units.
- [x] **Port.** \`readTaskRecord\` and the TaskCompleted/TeammateIdle payloads.
- [x] **Bounds.** The per-task completion gate stays; \`team_name\` has no local
  source; the tool-field fallback only applies when the record is absent.
- [x] **Gates.** agent-lifecycle 29/29, hooks 50/50, tsc 0, build 0, full
  2,114/2,114, chain 767/767, notices 0, source index unchanged, identity
  \`6b50f209…\`.
- [ ] Remaining C-6: full consumers and script semantics.
`);

const evidence = {
  schema: 'W85TaskCompletedPayloadEvidence.v1',
  package: 'W85-01 — TaskCompleted and TeammateIdle payloads',
  date: '2026-10-18',
  question: 'Do TaskCompleted and TeammateIdle carry the recovered metadata fields instead of the tool echo?',
  answer: 'Yes for the task metadata: TaskCompleted sends task_id/task_subject/task_description and teammate_name from the record owner (falling back to tool fields only when absent); TeammateIdle no longer sends its local source. The per-task completion trigger and the absent team_name remain recorded adaptations.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-sfn1dbxq.js',
    unit: 'UTF-16 code units',
    taskCompleted: { symbol: 'pvt', range: [2947228, 2947575] },
    teammateIdle: { symbol: 'qir', range: [2946651, 2946909] },
    commonContext: { symbol: '$d', range: [2958255, 2958860] },
    idleCallSite: { module: 'extracted-v2/modules/chunk-5b2hxy2e.js', offset: 74688 },
    teammateResolver: { module: 'extracted-v2/modules/chunk-5b2hxy2e.js', symbol: 'Ua', offset: 60370 },
  },
  behavior: {
    taskCompleted: 'task_id, task_subject, task_description, teammate_name (owner)',
    teammateIdle: 'agent_id and teammate_name; local source removed',
    fallback: 'tool fields only when the target record is absent',
    adaptations: ['one task per completion gate', 'no team_name source'],
  },
  changes: [
    { file: 'src/tasks.ts', change: 'readTaskRecord accessor', sha256: sha(read('src/tasks.ts')) },
    { file: 'src/agent.ts', change: 'TaskCompleted metadata payload', sha256: sha(read('src/agent.ts')) },
    { file: 'src/interactive.ts', change: 'TeammateIdle payload drops source', sha256: sha(read('src/interactive.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'TaskCompleted field and owner tests', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W85', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W85', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W85-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W85-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    lifecycle: '29/29',
    hooks: '50/50',
    build: 'exit 0',
    full: '2,114/2,114',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '6b50f209b2f9d705e95c919860d93a59cf56d376cc614249b28269bc2e69b99e',
  },
  residuals: [
    'The completion trigger stays per task; the source iterates owned in-progress tasks at idle.',
    'team_name has no local source.',
    'Full hook consumers and script semantics remain C-6 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with full consumers and script semantics.',
};
write('research/ports/W85-task-completed-payload-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW85-01 aligns the TaskCompleted and TeammateIdle payloads',
  'research/coding-standard.md': '\n2026-10-17 W85-01 ',
  'research/FEATURES.md': 'W85 gives TaskCompleted',
  'research/ports/W85-task-completed-payload.md': '# W85 — TaskCompleted and TeammateIdle payloads',
  '.audit/w85-runtime.todo.md': '\n## W85-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
