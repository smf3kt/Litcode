// W84-01 record: TaskCreated payload and rollback.
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

const note = `# W84 — TaskCreated payload and rollback

## Source position

\`Kir\` (chunk-sfn1dbxq.js, UTF-16 [2946915,2947222)) builds the TaskCreated
payload from task metadata, not from the tool call:
\`{task_id, task_subject, task_description, teammate_name, team_name}\`.
The task-create tool raises it with the record it just wrote and, when a hook
returns a blocking error, deletes that record before throwing
(chunk-tar639dc.js [140910,141200)); the delete also strips the task id from
every dependent's \`blocks\`/\`blockedBy\` (\`XCt\`, chunk-9xs8s13r.js). Exit 2 is
blocking for TaskCreated because \`Zge\` includes it (chunk-sfn1dbxq.js offset
564884). \`X_\`/\`$l\` (chunk-rgrg9230.js [1889,1979)) supply the teammate and
team names from the team context.

## Port

\`createdTaskFields\` reads the validated \`subject\`/\`description\` from the input
and the generated UUID from the tool result JSON (its first key, so a capped
result still carries it). The raise sends \`task_id\`, \`task_subject\` and
\`task_description\`. A blocked hook deletes the task through the new internal
\`removeTask\` (lock, unlink from \`blockedBy\`, graph validation, atomic write)
and replaces the tool result with an error carrying the source's
\`TaskCreated hook feedback:\` prefix. \`TaskCreated\` joins the blocking and
decision-block sets, matching \`Zge\`.

## Adaptation

The tool path has no team context, so \`teammate_name\` and \`team_name\` stay
unset; the record notes the gap. The raise happens after the tool returns
rather than inside the tool body, because hooks live on the agent; the rollback
still removes the task before the model sees the result. The product has no
numeric high-water mark or background task host, so only the stored task and
its dependency edges are cleaned.

## Verification

\`agent-lifecycle\` 27/27 and \`hooks\` 50/50: a blocking TaskCreated hook
receives \`task_id\`, \`task_subject\`, \`task_description\` with no tool fields,
the record is deleted, and the result is the prefixed error; a context-only
hook keeps the pending task and adds \`Hook context:\`. tsc 0; build 0; full
2,112/2,112; chain 767/767; notices 0; source index unchanged; identity
\`081a61bf…\`.
`;
write('research/ports/W84-task-created-hooks.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W84-01 ports the TaskCreated payload and its rollback. The raise sends the
created task's own \`task_id\`, \`task_subject\` and \`task_description\` rather than
the tool echo; a blocking hook deletes the task through the new internal
\`removeTask\` (unlinks it from dependents' \`blockedBy\`), and the tool result
becomes \`TaskCreated hook feedback:\`. TaskCreated joins the blocking and
decision-block sets, matching \`Zge\`. Team fields stay unset because the tool
path has no team identity. \`agent-lifecycle\` 27/27, \`hooks\` 50/50, tsc 0,
build 0, full 2,112/2,112, chain 767/767, identity \`081a61bf…\`.
[W84 record](ports/W84-task-created-hooks.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W84-01 TaskCreated 载荷与回滚：S-1（先读源）：读取 chunk-sfn1dbxq.js 的 Kir [2946915,2947222)、Zge 偏移 564884、chunk-tar639dc.js 创建工具 [140910,141200)、chunk-9xs8s13r.js 的 XCt、chunk-rgrg9230.js [1889,1979) 的 X_/$l（UTF-16）。S-2（不臆造）：载荷取输入 subject/description 与工具结果首个 id；阻断时删除任务并从依赖方 blockedBy 摘除。S-3（边界）：工具路径无团队身份，teammate_name/team_name 不设；raise 在工具返回后、模型看到结果前完成回滚。S-4（可测）：阻断用例断言三字段、无工具字段、删除与带前缀错误；非阻断用例断言任务保留与上下文。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：agent-lifecycle 27/27、hooks 50/50、tsc 0、build 0、全量 2,112/2,112、链 767/767、身份 081a61bf…。
`);

replaceOnce('research/FEATURES.md',
  'and the FileChanged/CwdChanged raises print it after system messages) |',
  'and the FileChanged/CwdChanged raises print it after system messages); W84 gives TaskCreated the created task\'s own fields (`task_id`, `task_subject`, `task_description`) and rolls the task back on a blocking hook (`TaskCreated hook feedback:` result, dependents unlinked), while team fields stay unset because the tool path has no team identity |');

replaceAll('research/CURRENT.md',
  '完整消费者与脚本语义仍待处理',
  'W84完成TaskCreated任务载荷与回滚（task_id/task_subject/task_description，阻断时删除并清理依赖，team字段本地无来源）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-17T23:40:00Z', 'package', 'W84-01 TaskCreated 载荷与回滚',
    'Kir [2946915,2947222)、Zge 564884、创建工具 [140910,141200)、XCt、X_/$l；createdTaskFields、removeTask、TaskCreated raise',
    '载荷取任务自身字段；阻断删除并清理依赖；错误前缀 TaskCreated hook feedback:；team 字段不设',
    'agent-lifecycle 27/27；hooks 50/50；tsc 0；build 0；全量 2,112/2,112；链 767/767'],
  ['2026-10-17T23:42:00Z', 'decision', 'W84-01 边界',
    '① TaskCreated 进入 BLOCKING_EVENTS 与 DECISION_BLOCK_EVENTS（Zge）；② 仅在工具返回后、结果入上下文前回滚；③ 不复刻数字高水位与后台任务宿主',
    '残余：TaskCompleted/TeammateIdle 同源字段、完整消费者与脚本语义',
    '.audit/w84-01-full.txt'],
  ['2026-10-17T23:45:00Z', 'verification', 'W84-01 验收：agent-lifecycle 27/27、hooks 50/50、tsc 0、build 0、2,112/2,112、767/767',
    '阻断钩子收到 task_id/subject/description 且无工具字段；任务被删除；结果带前缀错误；非阻断保留 pending',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 081a61bf…（inputs 07314c4e…、validation 87759d92…、build f34607f2…）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w84-runtime.tsv', tsv + '\n');

write('.audit/w84-runtime.todo.md', `# W84 runtime trail

## W84-01 acceptance (2026-10-17)

- [x] **Source read.** \`Kir\`, \`Zge\`, the task-create rollback site, \`XCt\` and
  the \`X_\`/\`$l\` team context measured in UTF-16 code units.
- [x] **Port.** \`createdTaskFields\`, the metadata payload, \`removeTask\` and the
  blocking/decision sets.
- [x] **Bounds.** No team identity in the tool path; rollback removes the task
  and its dependency edges before the model sees the result. Numeric high-water
  mark and background task host are not replicated.
- [x] **Gates.** agent-lifecycle 27/27, hooks 50/50, tsc 0, build 0, full
  2,112/2,112, chain 767/767, notices 0, source index unchanged, identity
  \`081a61bf…\`.
- [ ] Remaining C-6: TaskCompleted/TeammateIdle fields, full consumers and
  script semantics.
`);

const evidence = {
  schema: 'W84TaskCreatedHooksEvidence.v1',
  package: 'W84-01 — TaskCreated payload and rollback',
  date: '2026-10-17',
  question: 'Does TaskCreated receive the created task metadata and roll the task back when a hook blocks, like the recovered Kir/Zge path?',
  answer: 'Yes: the raise sends task_id/task_subject/task_description from the created task, exit 2 or a decision block is honored for TaskCreated, and a block deletes the task (unlinking dependents) before the model sees a TaskCreated hook feedback error; teammate/team names are unset because the tool path has no team identity.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-sfn1dbxq.js',
    unit: 'UTF-16 code units',
    builder: { symbol: 'Kir', range: [2946915, 2947222] },
    blockingSet: { symbol: 'Zge', offset: 564884 },
    toolSite: { module: 'extracted-v2/modules/chunk-tar639dc.js', range: [140910, 141200] },
    deleteHelper: { module: 'extracted-v2/modules/chunk-9xs8s13r.js', symbol: 'XCt' },
    teamContext: { module: 'extracted-v2/modules/chunk-rgrg9230.js', range: [1889, 1979], symbols: ['X_', '$l'] },
  },
  behavior: {
    payload: 'task_id, task_subject, task_description',
    block: 'deletes the task, unlinks it from dependents, result is "TaskCreated hook feedback:\\n" + reason',
    contextOnly: 'task stays pending and Hook context is appended',
    notPorted: ['teammate_name/team_name (no team identity in the tool path)', 'numeric high-water mark', 'background task host'],
  },
  changes: [
    { file: 'src/hooks.ts', change: 'task_description/team_name fields; TaskCreated in blocking and decision-block sets', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/tasks.ts', change: 'deleteTaskRecord and exported removeTask rollback helper', sha256: sha(read('src/tasks.ts')) },
    { file: 'src/agent.ts', change: 'createdTaskFields and TaskCreated raise/rollback', sha256: sha(read('src/agent.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'blocking payload/rollback and context-only tests', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record TaskCreated', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records TaskCreated', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W84-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W84-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    lifecycle: '27/27',
    hooks: '50/50',
    build: 'exit 0',
    full: '2,112/2,112',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '081a61bffc067e8b41a0f9a71e95b316718ae01988b16d22241183a16d7dfec7',
  },
  residuals: [
    'teammate_name/team_name remain unset in the tool path.',
    'TaskCompleted still gates with tool fields rather than task metadata.',
    'Full hook consumers and script semantics remain C-6 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with TaskCompleted/TeammateIdle fields, full consumers and script semantics.',
};
write('research/ports/W84-task-created-hooks-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW84-01 ports the TaskCreated payload and its rollback',
  'research/coding-standard.md': '\n2026-10-17 W84-01 ',
  'research/FEATURES.md': 'W84 gives TaskCreated',
  'research/ports/W84-task-created-hooks.md': '# W84 — TaskCreated payload and rollback',
  '.audit/w84-runtime.todo.md': '\n## W84-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
