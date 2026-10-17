// W68-01: disposition of the original TaskGet/TaskList contract, plus the W67 identity correction.
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const OLD = 'b1c74f0cd1d7691847491fd1919d64b2910fa47814b598339eb3912501f19dd9';
const NEW = 'f8c89d5ad385f2e3ccd29baa1720bc6a70653c2339438bf3475678d281c51b9d';

function replaceOnce(path, from, to) {
  const text = read(path);
  if (text.split(from).length - 1 !== 1) throw new Error(`${path}: expected one occurrence of ${JSON.stringify(from)}`);
  write(path, text.replace(from, to));
}

// The W67 identity was measured before the post-comment rebuild; the committed build is NEW.
replaceOnce('research/ports/W67-os-managed-policy.md', 'identity `b1c74f0c…`', 'identity `f8c89d5a…` (the first measurement, `b1c74f0c…`, predated the rebuild that included the added module comment; `f8c89d5a…` is the committed build identity)');
replaceOnce('research/STATUS.md', 'identity `b1c74f0c…`', 'identity `f8c89d5a…` (corrected after the final build; W68-01 records it)');
replaceOnce('research/coding-standard.md', '身份 b1c74f0c…', '身份 f8c89d5a…（最终构建后，W68-01 更正）');
replaceOnce('.audit/w67-runtime.todo.md', 'identity `b1c74f0c…`', 'identity `f8c89d5a…` (final build)');
replaceOnce('.audit/w67-runtime.tsv', 'identity 5ef9e11b…→b1c74f0c…（新增注释与实现）', 'identity 5ef9e11b…→b1c74f0c…→f8c89d5a…（最终构建；W68-01 更正）');
const evidencePath = 'research/ports/W67-os-managed-policy-evidence.json';
const evidence = JSON.parse(read(evidencePath));
if (evidence.gates.identity === OLD) {
  evidence.gates.identity = NEW;
  evidence.residuals.push('The identity first recorded in this file (b1c74f0c…) was measured before the final build; W68-01 corrects it to f8c89d5a… for the committed tree.');
  write(evidencePath, JSON.stringify(evidence, null, 1) + '\n');
}

const note = `# W68 — the original task tool contract against the local store

## Source position

The recovered task tools are in \`chunk-tar639dc.js\` (UTF-16 code units):

| Tool | Input schema | Output schema | Tool body |
| --- | --- | --- | --- |
| TaskCreate | \`Oi\` [139849,140169) 320 | \`xi\` [140172,140213) 41 | \`xr\` [140216,141450) 1234 |
| TaskGet | \`Pi\` [142239,142306) 67 | \`zi\` [142309,142421) 112 | \`Dr\` [142424,143539) 1115 |
| TaskUpdate | \`Di\` [145886,146609) 723 | \`Li\` [146611,146733) 122 | \`Nr\` [146736,149722) 2986 |
| TaskList | \`Mi\` [151469,151483) 14 | \`Ni\` [151486,151582) 96 | \`Ur\` [151585,152664) 1079 |

The source stores one JSON document per sequential integer id under the task-list directory with a
\`.highwatermark\` (chunk-9xs8s13r.js), and its tools render text:

- TaskGet returns \`{task: {id, subject, description, status, blocks, blockedBy} | null}\` and
  renders \`Task #id: subject\` / \`Status\` / \`Description\` / \`Blocked by\` / \`Blocks\`, or
  \`Task not found\`.
- TaskList takes \`{}\` and returns \`{tasks: [{id, subject, status, owner?, blockedBy}]}\`, after
  dropping every task whose \`metadata._internal\` is set and every completed id from each
  \`blockedBy\`; it renders \`#id [status] subject (owner) [blocked by #..]\`, or \`No tasks found\`.
- TaskUpdate takes \`taskId\`, \`addBlocks\`, \`addBlockedBy\`, and a status that includes
  \`deleted\`, and returns \`{success, taskId, updatedFields, error?, statusChange?}\`.

## What this product already ports

The product's store keeps UUID identities in one durable, lock-guarded \`.agent/tasks.json\`
rather than numeric ids in one file per task. On top of it, the source's visibility rules are
implemented: read projections hide \`metadata._internal\`, drop completed ids from \`blockedBy\`, and
derive \`blocks\`; a pending task with no outstanding blockers is \`ready\`; the graph is a strict DAG
and status changes cannot rest on unfinished dependencies.

## Accepted divergences

The tool surface itself remains the product's own JSON API, and that is recorded rather than
replaced:

- **UUID identity.** The product's TUI, runtime, agent isolation and task tests address tasks by
  UUID. Switching to sequential integer ids and one file per task would replace the durable store
  and its crash-safe write path for no behavioral gain in this harness.
- **Field set.** Get/List add \`owner\`, \`metadata\`, \`activeForm\` and \`ready\`, and Get returns the
  stored \`blockedBy\` filtered to outstanding blockers. These are the fields the task panel and
  the model consume here; the source's six-field Get omits exactly the fields the product relies
  on.
- **Transport.** These tools return JSON strings, like every other tool in this runtime; the
  source's renderer text is produced for the original client's tool-result pipeline and would drop
  the structured fields this runtime's callers parse.
- **Update surface.** The product accepts \`removeBlockedBy\`/\`removeBlocks\` and \`deleted: true\`
  in addition to the source's \`add*\` fields and \`status: "deleted"\`; removing them would delete
  working operations used by the tests and the task panel.
- **Unknown id.** TaskGet throws the product's tool error instead of answering null, consistent
  with the other tools in this runtime.

This is an adaptation with a stated reason, not a missing port: the source's visibility semantics
are present, and the differing container follows from the product's own durable identity and
transport choices.

## W67 identity correction

W67's first identity measurement (\`b1c74f0c…\`) was taken before the final build that included an
added module comment. The committed tree's identity is \`f8c89d5a…\` (inputs \`4ac6abc8…\`, build
\`f22723bf…\`); every W67 record now carries the corrected value.

## Verification

No product code changed. tsc 0; task suites 24/24 (both task files); the W67 full-suite result
(2,092/2,092) still describes this tree because only comments and records differ; identity
\`f8c89d5a…\`.
`;
write('research/ports/W68-task-contract.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W68-01 dispositions the original TaskGet/TaskList contract against the local task store. The
recovered shapes (\`Dr\`/\`Ur\` and their schemas in chunk-tar639dc.js, UTF-16 ranges in the record)
are compared field by field: the source's visibility rules are already ported (hidden
\`_internal\`, completed blockers dropped in List, derived \`blocks\`, strict DAG), while UUID
identity, JSON transport, richer fields and the extra update operations remain deliberate
adaptations with the reason recorded. No product code changed; task suites 24/24 and tsc 0. The
same record corrects the W67 identity to \`f8c89d5a…\` (the value first recorded predated the final
build). [W68 record](ports/W68-task-contract.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W68-01 任务工具合同处置：S-1（先读源）：逐段读取 chunk-tar639dc.js 的 TaskCreate/Get/Update/List 输入/输出 schema 与工具体（UTF-16 区间见记录）及 chunk-9xs8s13r.js 的顺序 ID/单文件存储。S-2（不臆造）：来源的可见性规则（隐藏 _internal、List 过滤已完成阻塞、派生 blocks、严格 DAG）已移植；UUID 身份、JSON 传输、更丰富字段与额外 update 操作保留为有记录的适配，理由逐条写入。S-3（边界）：不改产品代码；未知 id 保持本运行时统一的抛错约定。S-4（可测）：任务两套件 24/24、tsc 0；W67 全量仍适用。S-5/S-6：无依赖变化。S-7（记录）：W68 端口记录并以最终构建更正 W67 身份为 f8c89d5a…。
`);

const featureOld = 'UUID storage and original Get/List field/visibility contracts still differ';
const featureNew = 'UUID storage and the richer JSON Get/List contract are a recorded adaptation (W68-01): the source visibility rules are ported (hidden _internal, completed blockers dropped in list, derived blocks, strict DAG), while UUID identity, JSON transport, extra fields and update operations stay because the product TUI/runtime consume them';
replaceOnce('research/FEATURES.md', featureOld, featureNew);

const rowOld = '| C-7 | 会话、子代理与任务 | 后台 fork、跨会话发现（现为 external）、任务 UUID 存储与原文 Get/List 字段/可见性合同 | Session list/fork/clear/model/plan/context/usage；Agent messaging/ListAgents/Poll；Task CRUD/dependencies；Local child agents/types/context fork |';
const rowNew = '| C-7 | 会话、子代理与任务 | 任务合同已处置（W68-01：逐字段核对原文 TaskGet/TaskList/TaskUpdate 的 schema、工具体与渲染；来源可见性规则已移植——隐藏 _internal、List 过滤已完成阻塞、派生 blocks、严格 DAG；UUID 单文件存储、JSON 传输、更丰富字段与额外 update 操作为有理由的本地适配）；后台 fork、跨会话发现（现为 external）仍待处理 | Session list/fork/clear/model/plan/context/usage；Agent messaging/ListAgents/Poll；Task CRUD/dependencies；Local child agents/types/context fork |';
const current = read('research/CURRENT.md');
if (current.split(rowOld).length - 1 !== 3) throw new Error('CURRENT C-7 row count changed');
write('research/CURRENT.md', current.split(rowOld).join(rowNew));

const tsv = [
  ['2026-10-17T13:05:00Z', 'package', 'W68-01 任务工具合同处置与 W67 身份更正',
    '逐段读取 TaskCreate/Get/Update/List（chunk-tar639dc.js）与顺序 ID/单文件存储（chunk-9xs8s13r.js）；对照产品 UUID 单文件 JSON 工具面',
    '可见性规则已移植；UUID/JSON/字段/update 操作保留为记录适配；无产品代码改动',
    'tsc 0；tasks+task-projections 24/24；W67 全量 2,092/2,092 仍适用；身份 f8c89d5a…'],
  ['2026-10-17T13:08:00Z', 'decision', 'W68-01 保留本地任务工具合同',
    '① 来源 TaskGet 六字段/null/文本渲染会移除产品 TUI/runtime 解析的 owner/metadata/activeForm/ready；② 顺序整数 ID 与单文件存储会替换已验收的 UUID 持久 store；③ 产品统一以 JSON 字符串返回工具结果；④ 来源 add* 面保留，额外 remove*/deleted 继续支持；⑤ 未知 id 保持统一抛错',
    '残余：后台 fork、跨会话发现（external）',
    '.audit/w68-01-tasks.txt'],
  ['2026-10-17T13:11:00Z', 'correction', 'W67 身份更正为 f8c89d5a…',
    '首次测量 b1c74f0c… 发生在最终构建（含新增模块注释）之前；最终构建后 inputs 4ac6abc8…、build f22723bf…、合并身份 f8c89d5a…',
    'W67 端口记录、证据 JSON、STATUS、coding-standard、runtime 记录同步更正',
    '.audit/w67-01-identity.txt'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w68-runtime.tsv', tsv + '\n');

write('.audit/w68-runtime.todo.md', `# W68 runtime trail

## W68-01 acceptance (2026-10-17)

- [x] **Source read.** TaskCreate/Get/Update/List schemas and bodies measured in
  \`chunk-tar639dc.js\`; the sequential-ID single-file store measured in \`chunk-9xs8s13r.js\`.
- [x] **Visibility rules ported.** \`metadata._internal\` hidden, List drops completed blockers,
  \`blocks\` derived, strict DAG and gated status changes.
- [x] **Divergences recorded with reasons.** UUID identity, JSON transport, richer fields, extra
  update operations and the unknown-id error stay.
- [x] **No product code changed.** tsc 0, task suites 24/24; the W67 full-suite result still
  applies because only comments and records differ.
- [x] **Identity corrected.** W67 now records \`f8c89d5a…\`; the earlier value predated the final
  build.
- [ ] Remaining C-7: background fork and cross-session discovery (external).
`);

const record = {
  schema: 'W68TaskContractEvidence.v1',
  package: 'W68-01 — original task tool contract disposition and W67 identity correction',
  date: '2026-10-17',
  question: 'Should the original TaskGet/TaskList field, visibility and rendering contract replace the product task tool surface?',
  answer: 'No: the source visibility rules are ported, and the remaining differences follow from the product UUID store and JSON tool transport; each divergence is recorded with its reason, and no product code changed.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-tar639dc.js',
    unit: 'UTF-16 code units',
    create: { input: [139849, 140169], output: [140172, 140213], body: [140216, 141450] },
    get: { input: [142239, 142306], output: [142309, 142421], body: [142424, 143539] },
    update: { input: [145886, 146609], output: [146611, 146733], body: [146736, 149722] },
    list: { input: [151469, 151483], output: [151486, 151582], body: [151585, 152664] },
    store: { module: 'extracted-v2/modules/chunk-9xs8s13r.js', kind: 'sequential integer id, one JSON file per task, .highwatermark' },
  },
  sourceContract: {
    get: '{task: {id,subject,description,status,blocks,blockedBy}|null}, rendered as text',
    list: '{tasks:[{id,subject,status,owner?,blockedBy}]}, _internal hidden, completed blockers dropped',
    update: 'taskId, addBlocks, addBlockedBy, status including deleted; {success,taskId,updatedFields,error?,statusChange?}',
    create: '{task:{id,subject}}',
  },
  productContract: {
    store: '.agent/tasks.json, UUID ids, lock + atomic write, strict DAG',
    get: 'task_get by UUID; full record projection with _internal hidden, completed blockers dropped, derived blocks and ready',
    list: 'task_list with optional status filter; array of projected records including blocks/ready',
    update: 'task_update by UUID; addBlockedBy/removeBlockedBy, addBlocks/removeBlocks, deleted:true; returns the updated record or a deletion summary',
    create: 'task_create returns the full created record',
  },
  portedRules: ['metadata._internal hidden', 'completed blockers dropped from list projections', 'blocks derived from stored edges', 'ready = pending with zero outstanding blockers', 'strict DAG and gated status changes'],
  acceptedDivergences: [
    'UUID identity and one JSON store instead of sequential integer ids and one file per task',
    'JSON string tool results instead of the original renderer text',
    'extra fields (owner, metadata, activeForm, ready) and raw Get blockedBy filtering',
    'extra update operations (removeBlockedBy/removeBlocks/deleted:true)',
    'unknown id throws instead of returning a null task',
  ],
  reason: 'The product TUI, runtime, agent isolation and task tests consume the structured UUID records; replacing them would remove working capabilities without adding source behavior. The source visibility rules are already present.',
  correction: {
    field: 'W67 identity',
    from: OLD,
    to: NEW,
    reason: 'the first measurement predated the final build containing an added module comment',
  },
  changes: [
    { file: 'research/ports/W68-task-contract.md', change: 'disposition record', sha256: sha(read('research/ports/W68-task-contract.md')) },
    { file: 'research/CURRENT.md', change: 'three C-7 rows record the disposition', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Task CRUD row records the adaptation', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W68-01 entry and W67 identity', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W68-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
    { file: 'research/ports/W67-os-managed-policy.md', change: 'identity corrected', sha256: sha(read('research/ports/W67-os-managed-policy.md')) },
    { file: 'research/ports/W67-os-managed-policy-evidence.json', change: 'identity corrected', sha256: sha(read('research/ports/W67-os-managed-policy-evidence.json')) },
  ],
  gates: {
    tsc: 'exit 0',
    tasks: '24/24',
    full: 'W67 2,092/2,092 still describes this tree (records and comments only)',
    identity: NEW,
  },
  residuals: [
    'Background fork and cross-session discovery remain C-7 work; cross-session discovery stays external.',
    'The original numeric-id single-file task store is not ported; the local UUID store is retained.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-7 continues with background fork; cross-session discovery stays external.',
};
write('research/ports/W68-task-contract-evidence.json', JSON.stringify(record, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW68-01 dispositions the original TaskGet/TaskList',
  'research/coding-standard.md': '\n2026-10-17 W68-01 ',
  'research/FEATURES.md': 'The source visibility rules are ported (hidden _internal',
  'research/ports/W68-task-contract.md': '# W68 — the original task tool contract',
  '.audit/w68-runtime.todo.md': '\n## W68-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
