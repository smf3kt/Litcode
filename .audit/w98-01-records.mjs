// W98-01 record: Stop/SubagentStop runtime state.
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

const note = `# W98 — Stop/SubagentStop runtime state

## Source position

\`Sle\` (chunk-sfn1dbxq.js [2945580,2946104)) always adds
\`{background_tasks: sdn(taskRegistry.all()), session_crons: idn()}\` to both
Stop and SubagentStop. \`sdn\` [2944321,2944915) keeps tasks that are running
or pending and not marked \`isBackgrounded: false\` (\`Vg\`, chunk-j8hqhz0c.js
offset 16174), maps the type through \`wcr\` (offset 14951; \`local_bash\` →
\`shell\`, \`monitor_*\` → \`monitor\`), and caps each string with \`_c\`
(chunk-ax7r0qj7.js [4917,5030)) at 1000 code units, dropping a dangling high
surrogate and appending \`… [+N chars]\`. Type-specific fields: \`command\` for
shell, \`agent_type\` for agents, \`server\`/\`tool\` for MCP and monitors, \`name\`
for workflows. \`idn\` [2944915,2945033) projects \`{id, schedule: cron,
recurring: recurring ?? false, prompt}\` from \`Km()\`
(chunk-4bw62nzm.js offset 106264).

## Port

\`BackgroundRegistry.active()\` returns the running jobs; the runtime's
\`stopState(owner)\` projects them as \`shell\`/\`monitor\` entries with the
truncated description and shell command, and projects the scheduler's
\`list()\` as \`session_crons\`. \`Agent\` exposes \`events.stopState\`; the
interactive and headless entry points and every child-agent path (skill
execution, subagent tool, agent registry) pass the owning runtime's provider,
so Stop and SubagentStop always carry both arrays.

## Adaptation

The product's background kinds are \`run\` and \`monitor\` with no MCP task
registry, so only \`shell\` and \`monitor\` entries can appear. Its statuses are
running/completed/failed/cancelled/timed_out; the source's running/pending
filter becomes running-only. \`isBackgrounded\` does not exist because every
registered job is a background job.

## Verification

\`background\` 23/23 with the active projection and its removal after the job
ends. \`runtime-resources\` 11/11: a shell job and a cron job project, the
prompt truncates at 1000 code units. \`agent-lifecycle\` 39/39: the Stop payload
carries both arrays verbatim. tsc 0; build 0; full 2,131/2,131; chain
767/767; notices 0; source index unchanged; identity \`9b2dc7df…\`.
`;
write('research/ports/W98-stop-runtime-state.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W98-01 completes the Stop/SubagentStop runtime state. Both events now carry
\`background_tasks\` (running shell/monitor jobs with the 1000-unit truncation)
and \`session_crons\` (\`id\`, \`schedule\`, \`recurring\`, truncated \`prompt\`),
projected from the owning runtime in the interactive, headless and every
child-agent path. \`background\` 23/23, \`runtime-resources\` 11/11,
\`agent-lifecycle\` 39/39, tsc 0, build 0, full 2,131/2,131, chain 767/767,
identity \`9b2dc7df…\`. [W98 record](ports/W98-stop-runtime-state.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W98-01 Stop/SubagentStop 运行时状态：S-1（先读源）：读取 Sle [2945580,2946104)、sdn [2944321,2944915)、idn [2944915,2945033)、Vg 16174、wcr 14951、_c 4917、Km 106264（UTF-16）。S-2（不臆造）：两事件恒带 background_tasks 与 session_crons；类型映射 shell/monitor；描述、命令、prompt 按 _c 截断到 1000 并附丢弃计数。S-3（边界）：本地无 MCP 任务注册表，仅 shell/monitor；状态 running-only；interactive/headless 与全部子代理路径传入所属 runtime 的投影。S-4（可测）：background active 投影与结束后清空；runtime 投影含截断；Agent 原样携带两数组。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：background 23/23、runtime-resources 11/11、agent-lifecycle 39/39、tsc 0、build 0、全量 2,131/2,131、链 767/767、身份 9b2dc7df…。
`);

replaceOnce('research/FEATURES.md',
  '(the studied build omits the optional field) |',
  '(the studied build omits the optional field); W98 adds the always-present Stop/SubagentStop `background_tasks` (running shell/monitor jobs, 1000-unit truncation) and `session_crons` projections on every top-level and child path |');

replaceAll('research/CURRENT.md',
  '；完整消费者与脚本语义仍待处理',
  '；W98完成Stop/SubagentStop运行时状态（background_tasks=运行中的shell/monitor任务，session_crons=id/schedule/recurring/prompt，均按_c截断1000；顶层与全部子代理路径接所属runtime）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-18T08:00:00Z', 'package', 'W98-01 Stop/SubagentStop 运行时状态',
    'Sle 2945580、sdn 2944321、idn 2944915、Vg 16174、wcr 14951、_c 4917、Km 106264；BackgroundRegistry.active 与 runtime.stopState',
    '两数组恒在；类型 shell/monitor；1000 截断；全部 Agent 构造路径接线',
    'background 23/23；runtime-resources 11/11；agent-lifecycle 39/39；tsc 0；build 0；全量 2,131/2,131；链 767/767'],
  ['2026-10-18T08:03:00Z', 'decision', 'W98-01 适配',
    '本地无 MCP 任务注册表与 pending 状态，仅 running 的 run/monitor 任务；isBackgrounded 不存在因全部任务均为后台',
    '子代理按所属 runtime owner 取得同一投影',
    '.audit/w98-01-full.txt'],
  ['2026-10-18T08:06:00Z', 'verification', 'W98-01 验收：background 23/23、runtime-resources 11/11、agent-lifecycle 39/39、tsc 0、build 0、2,131/2,131、767/767',
    'active 仅运行中且 stop 后清空；runtime 投影含 shell 命令与截断 prompt；Stop 载荷两数组原样',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 9b2dc7df…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w98-runtime.tsv', tsv + '\n');

write('.audit/w98-runtime.todo.md', `# W98 runtime trail

## W98-01 acceptance (2026-10-18)

- [x] **Source read.** Stop builder, both serializers, the filter, type map,
  truncation and cron source.
- [x] **Port.** \`active()\`, \`stopState(owner)\`, AgentEvents provider and all
  Agent construction paths.
- [x] **Bounds.** Shell/monitor only; running-only statuses; no MCP task
  registry.
- [x] **Gates.** background 23/23, runtime-resources 11/11, agent-lifecycle
  39/39, tsc 0, build 0, full 2,131/2,131, chain 767/767, notices 0, source
  index unchanged, identity \`9b2dc7df…\`.
- [ ] Remaining C-6: full consumers and the fork-skill expansion metadata.
`);

const evidence = {
  schema: 'W98StopRuntimeStateEvidence.v1',
  package: 'W98-01 — Stop/SubagentStop runtime state',
  date: '2026-10-18',
  question: 'What do background_tasks and session_crons contain, and where are they projected?',
  answer: 'Every Stop and SubagentStop carries both arrays: running background jobs (shell or monitor, 1000-unit truncated strings) and session cron tasks (id, cron schedule, recurring, truncated prompt).',
  sourcePosition: {
    unit: 'UTF-16 code units',
    builder: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'Sle', range: [2945580, 2946104] },
    background: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'sdn', range: [2944321, 2944915] },
    crons: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'idn', range: [2944915, 2945033] },
    filter: { module: 'extracted-v2/modules/chunk-j8hqhz0c.js', symbol: 'Vg', offset: 16174 },
    typeMap: { module: 'extracted-v2/modules/chunk-j8hqhz0c.js', symbol: 'wcr', offset: 14951 },
    truncation: { module: 'extracted-v2/modules/chunk-ax7r0qj7.js', symbol: '_c', range: [4917, 5030], limit: 1000 },
    cronSource: { module: 'extracted-v2/modules/chunk-4bw62nzm.js', symbol: 'Km', offset: 106264 },
  },
  behavior: {
    background_tasks: ['id', 'type', 'status', 'description', 'command (shell)'],
    session_crons: ['id', 'schedule', 'recurring', 'prompt'],
    alwaysPresent: true,
  },
  adaptations: [
    'No MCP task registry: only run→shell and monitor→monitor entries exist.',
    'Statuses map to running only; isBackgrounded does not exist.',
    'All top-level and child Agent paths receive the owning runtime projection.',
  ],
  changes: [
    { file: 'src/agent.ts', change: 'StopRuntimeState types, provider and payload', sha256: sha(read('src/agent.ts')) },
    { file: 'src/background.ts', change: 'active() running-job projection', sha256: sha(read('src/background.ts')) },
    { file: 'src/runtime.ts', change: 'truncateHookText, stopStateForOwner, wiring', sha256: sha(read('src/runtime.ts')) },
    { file: 'src/interactive.ts', change: 'top-level stopState provider', sha256: sha(read('src/interactive.ts')) },
    { file: 'src/cli.ts', change: 'headless and TUI stopState providers', sha256: sha(read('src/cli.ts')) },
    { file: 'src/subagents.ts', change: 'child option and Agent pass-through', sha256: sha(read('src/subagents.ts')) },
    { file: 'src/skill-runtime.ts', change: 'skill option pass-through', sha256: sha(read('src/skill-runtime.ts')) },
    { file: 'src/agent-registry.ts', change: 'registry child pass-throughs', sha256: sha(read('src/agent-registry.ts')) },
    { file: 'test/background.test.ts', change: 'active projection test', sha256: sha(read('test/background.test.ts')) },
    { file: 'test/runtime-resources.test.ts', change: 'stopState projection and truncation test', sha256: sha(read('test/runtime-resources.test.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'Stop runtime state payload test', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W98', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W98', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W98-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W98-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    background: '23/23',
    runtimeResources: '11/11',
    lifecycle: '39/39',
    build: 'exit 0',
    full: '2,131/2,131',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '9b2dc7df7b218548b944dbcf4efa593309d498d8278bec64c15d92913c10910c',
  },
  residuals: [
    'MCP task and teammate/cloud task kinds cannot appear without their registries.',
    'Workflow-name fields are not projected because workflow children are their own registry kind.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with full consumers and the fork-skill expansion metadata.',
};
write('research/ports/W98-stop-runtime-state-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW98-01 completes the Stop/SubagentStop runtime state',
  'research/coding-standard.md': '\n2026-10-18 W98-01 ',
  'research/FEATURES.md': 'W98 adds the always-present Stop/SubagentStop',
  'research/ports/W98-stop-runtime-state.md': '# W98 — Stop/SubagentStop runtime state',
  '.audit/w98-runtime.todo.md': '\n## W98-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
