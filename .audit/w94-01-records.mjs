// W94-01 record: Stop-family payloads.
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

const note = `# W94 — Stop-family payloads

## Source position

The Stop and SubagentStop schema declares \`stop_hook_active\`,
\`last_assistant_message\` and the optional \`background_tasks\` and
\`session_crons\` (chunk-r2vtj1kh.js offset 197403); SubagentStop adds
\`agent_id\`, \`agent_transcript_path\` and \`agent_type\` (offset 198320). The
shared builder at chunk-sfn1dbxq.js offset 2946104 computes
\`last_assistant_message\` as the trimmed message text or omits it, and sends
the child transcript path. StopFailure declares \`{error, error_details?,
last_assistant_message?}\` (offset 198098); \`Gze\` (offset 2945292) trims the
message and passes \`errorDetails\`, with no \`stop_reason\` field.

## Port

Stop and SubagentStop now send the trimmed last message only when non-empty.
SubagentStop adds \`agent_transcript_path\` from the child session file and no
longer sends the invented \`reason\` field. StopFailure drops its invented
\`stop_reason\` on both raise sites and trims the last message.

## Adaptation

\`background_tasks\` and \`session_crons\` stay omitted: the agent has no handle
on the runtime's job and scheduler registries. They are optional in the
schema, but their absence is a recorded gap, not a claim that none exist.

## Verification

\`agent-lifecycle\` 36/36: every SubagentStop payload carries the child
transcript path and the trimmed message, and none carries \`reason\`; a
\`max_tokens\` stop raises StopFailure with \`error\` and the message and no
\`stop_reason\`. tsc 0; build 0; full 2,123/2,123; chain 767/767; notices 0;
source index unchanged; identity \`5ac052d1…\`.
`;
write('research/ports/W94-stop-payloads.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W94-01 aligns the Stop-family payloads. Stop and SubagentStop send the trimmed
last message only when present, SubagentStop adds \`agent_transcript_path\` and
drops \`reason\`, and StopFailure drops \`stop_reason\` on both raise sites.
\`background_tasks\` and \`session_crons\` remain omitted because the agent has
no runtime registry handle. \`agent-lifecycle\` 36/36, tsc 0, build 0, full
2,123/2,123, chain 767/767, identity \`5ac052d1…\`.
[W94 record](ports/W94-stop-payloads.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W94-01 Stop 家族载荷：S-1（先读源）：读取 chunk-r2vtj1kh.js 的 Stop 197403、SubagentStop 198320、StopFailure 198098，以及 chunk-sfn1dbxq.js 2946104 与 Gze 2945292（UTF-16）。S-2（不臆造）：last_assistant_message 取修剪文本，空则省略；SubagentStop 含 agent_transcript_path；不再发送 reason/stop_reason。S-3（边界）：background_tasks 与 session_crons 因无运行时注册表句柄而省略并记录。S-4（可测）：子会话三条载荷断言转写路径/消息/无 reason；新增 StopFailure 载荷用例。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：agent-lifecycle 36/36、tsc 0、build 0、全量 2,123/2,123、链 767/767、身份 5ac052d1…。
`);

replaceOnce('research/FEATURES.md',
  'W93 maps every SessionEnd close cause onto the recovered `clear`/`resume`/`logout`/`prompt_input_exit`/`other` enum before the raise |',
  'W93 maps every SessionEnd close cause onto the recovered `clear`/`resume`/`logout`/`prompt_input_exit`/`other` enum before the raise; W94 trims `last_assistant_message` and omits it when empty, adds the SubagentStop `agent_transcript_path`, drops the invented `reason`/`stop_reason` fields, and leaves `background_tasks`/`session_crons` unwired |');

replaceAll('research/CURRENT.md',
  '完整消费者与脚本语义仍待处理',
  'W94完成Stop家族载荷（修剪并在空时省略last_assistant_message、SubagentStop带agent_transcript_path、删除reason/stop_reason；background_tasks/session_crons仍缺运行时句柄）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-18T04:45:00Z', 'package', 'W94-01 Stop 家族载荷',
    'Stop 197403、SubagentStop 198320、StopFailure 198098、构造 2946104、Gze 2945292；agent stop/StopFailure raise',
    '修剪并空省略消息；补 agent_transcript_path；删除 reason/stop_reason',
    'agent-lifecycle 36/36；tsc 0；build 0；全量 2,123/2,123；链 767/767'],
  ['2026-10-18T04:47:00Z', 'decision', 'W94-01 边界',
    'background_tasks/session_crons 可选但无 agent 侧运行时注册表句柄，省略并在端口记录为缺口',
    '残余：完整消费者',
    '.audit/w94-01-full.txt'],
  ['2026-10-18T04:50:00Z', 'verification', 'W94-01 验收：agent-lifecycle 36/36、tsc 0、build 0、2,123/2,123、767/767',
    'SubagentStop 每条含 agent_transcript_path 与 done，且无 reason；StopFailure 含 error/partial text 且无 stop_reason',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 5ac052d1…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w94-runtime.tsv', tsv + '\n');

write('.audit/w94-runtime.todo.md', `# W94 runtime trail

## W94-01 acceptance (2026-10-18)

- [x] **Source read.** Stop, SubagentStop and StopFailure schemas and builders.
- [x] **Port.** Trimmed message, SubagentStop transcript path, no invented
  reason fields.
- [x] **Gap.** \`background_tasks\` and \`session_crons\` need a runtime registry
  handle and stay omitted.
- [x] **Gates.** agent-lifecycle 36/36, tsc 0, build 0, full 2,123/2,123, chain
  767/767, notices 0, source index unchanged, identity \`5ac052d1…\`.
- [ ] Remaining C-6: full consumers.
`);

const evidence = {
  schema: 'W94StopPayloadsEvidence.v1',
  package: 'W94-01 — Stop-family payloads',
  date: '2026-10-18',
  question: 'Which fields do Stop, SubagentStop and StopFailure carry, and which product fields were invented?',
  answer: 'Stop carries stop_hook_active and the trimmed last message; SubagentStop adds agent_id, agent_transcript_path and agent_type; StopFailure carries error and the trimmed last message. The product now matches those and no longer sends reason or stop_reason; the optional runtime registries remain unwired.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    module: 'extracted-v2/modules/chunk-sfn1dbxq.js',
    stopSchema: { module: 'extracted-v2/modules/chunk-r2vtj1kh.js', offset: 197403 },
    subagentStopSchema: { module: 'extracted-v2/modules/chunk-r2vtj1kh.js', offset: 198320 },
    stopFailureSchema: { module: 'extracted-v2/modules/chunk-r2vtj1kh.js', offset: 198098 },
    sharedBuilder: { offset: 2946104 },
    stopFailureBuilder: { symbol: 'Gze', offset: 2945292 },
  },
  behavior: {
    lastAssistantMessage: 'trimmed; omitted when empty',
    subagentStop: ['agent_id', 'agent_transcript_path', 'agent_type'],
    removed: ['reason (SubagentStop)', 'stop_reason (StopFailure)'],
    unwired: ['background_tasks', 'session_crons'],
  },
  changes: [
    { file: 'src/agent.ts', change: 'stop-family payloads', sha256: sha(read('src/agent.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'payload assertions and StopFailure test', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W94', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W94', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W94-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W94-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    lifecycle: '36/36',
    build: 'exit 0',
    full: '2,123/2,123',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '5ac052d12cdffe3ff800fb621da119918d647ecc46a63c8c3b17b9741412182c',
  },
  residuals: [
    'background_tasks and session_crons stay omitted until the agent can read the runtime registries.',
    'Full hook consumers remain C-6 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with full consumers.',
};
write('research/ports/W94-stop-payloads-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW94-01 aligns the Stop-family payloads',
  'research/coding-standard.md': '\n2026-10-18 W94-01 ',
  'research/FEATURES.md': 'W94 trims `last_assistant_message`',
  'research/ports/W94-stop-payloads.md': '# W94 — Stop-family payloads',
  '.audit/w94-runtime.todo.md': '\n## W94-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
