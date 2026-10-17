// W86-01 record: SessionStart agent type and session title.
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

const note = `# W86 — SessionStart agent type and session title

## Source position

\`t7r\` (chunk-sfn1dbxq.js, UTF-16 [2942449,2942805)) builds SessionStart as
\`{source, agent_type, model, session_title, ...}\` over the common context,
with \`session_title\` falling back to \`vm(sessionId)\`. \`vm\`
(chunk-sfn1dbxq.js offset 4651858) returns the current session's title and
\`undefined\` for any other session; the runtime stores that title as a \`title\`
event.

## Port

\`startSession\` sends \`agent_type\` when the session is a child
(\`config.childMode\`) and \`session_title\` from the latest recorded \`title\`
event. Both fields stay absent when the runtime has no value, matching the
source's undefined-valued fields.

## Adaptation

The source also accepts an explicit title argument and reads an in-memory title
store; this runtime records titles as durable events and has no separate
in-memory title, so the latest event is the only local source.

## Verification

\`agent-lifecycle\` 30/30: a child session with a recorded title receives
\`source: "startup"\`, \`model\`, \`agent_type: "general"\` and
\`session_title: "Fixture title"\`. tsc 0; build 0; full 2,115/2,115; chain
767/767; notices 0; source index unchanged; identity \`3c77f51d…\`.
`;
write('research/ports/W86-session-start-payload.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W86-01 completes the SessionStart payload. \`startSession\` adds
\`agent_type\` for child sessions and \`session_title\` from the latest recorded
\`title\` event, matching \`t7r\`; a session without a title leaves the field
unset, as the source's \`vm\` yields undefined. \`agent-lifecycle\` 30/30, tsc 0,
build 0, full 2,115/2,115, chain 767/767, identity \`3c77f51d…\`.
[W86 record](ports/W86-session-start-payload.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W86-01 SessionStart 载荷补全：S-1（先读源）：读取 chunk-sfn1dbxq.js 的 t7r [2942449,2942805) 与 vm 偏移 4651858（UTF-16）。S-2（不臆造）：agent_type 仅子会话；session_title 取最新 title 事件，无值则不设，与源 undefined 字段一致。S-3（边界）：不复刻显式标题参数与内存标题存储。S-4（可测）：新增子会话含标题的 SessionStart 载荷用例。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：agent-lifecycle 30/30、tsc 0、build 0、全量 2,115/2,115、链 767/767、身份 3c77f51d…。
`);

replaceOnce('research/FEATURES.md',
  'remain recorded adaptations) |',
  'remain recorded adaptations); W86 adds the SessionStart `agent_type` (child sessions) and `session_title` (latest recorded `title` event) fields, leaving each unset without a value as `t7r` does |');

replaceAll('research/CURRENT.md',
  '完整消费者与脚本语义仍待处理',
  'W86完成SessionStart的agent_type与session_title（子会话标记与最新title事件，无值不设）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-18T00:40:00Z', 'package', 'W86-01 SessionStart 载荷',
    't7r [2942449,2942805)、vm 4651858；HookPayload.session_title 与 startSession 载荷',
    'agent_type 仅子会话；session_title 取最新 title 事件；无值不设',
    'agent-lifecycle 30/30；tsc 0；build 0；全量 2,115/2,115；链 767/767'],
  ['2026-10-18T00:42:00Z', 'decision', 'W86-01 边界',
    '① 不复刻显式标题参数与内存标题存储；② 字段缺省与源 undefined 一致；③ SubagentStart 载荷不变',
    '残余：完整消费者与脚本语义',
    '.audit/w86-01-full.txt'],
  ['2026-10-18T00:45:00Z', 'verification', 'W86-01 验收：agent-lifecycle 30/30、tsc 0、build 0、2,115/2,115、767/767',
    '子会话含 title 时 payload 为 startup/fixture-model/general/Fixture title',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 3c77f51d…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w86-runtime.tsv', tsv + '\n');

write('.audit/w86-runtime.todo.md', `# W86 runtime trail

## W86-01 acceptance (2026-10-18)

- [x] **Source read.** \`t7r\` and \`vm\` measured in UTF-16 code units.
- [x] **Port.** SessionStart \`agent_type\` and \`session_title\`.
- [x] **Bounds.** No explicit title argument or in-memory title store; absent
  values stay unset.
- [x] **Gates.** agent-lifecycle 30/30, tsc 0, build 0, full 2,115/2,115, chain
  767/767, notices 0, source index unchanged, identity \`3c77f51d…\`.
- [ ] Remaining C-6: full consumers and script semantics.
`);

const evidence = {
  schema: 'W86SessionStartPayloadEvidence.v1',
  package: 'W86-01 — SessionStart agent type and session title',
  date: '2026-10-18',
  question: 'Does SessionStart carry the recovered agent_type and session_title fields?',
  answer: 'Yes: child sessions add agent_type, the latest recorded title event supplies session_title, and each field stays unset when the runtime has no value, matching the source\'s undefined-valued fields.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-sfn1dbxq.js',
    unit: 'UTF-16 code units',
    builder: { symbol: 't7r', range: [2942449, 2942805] },
    titleResolver: { symbol: 'vm', offset: 4651858 },
  },
  behavior: {
    agentType: 'config.childMode, omitted for root sessions',
    sessionTitle: 'latest recorded title event, omitted when absent',
    unchanged: ['source', 'model'],
  },
  changes: [
    { file: 'src/hooks.ts', change: 'HookPayload.session_title', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/agent.ts', change: 'SessionStart payload fields', sha256: sha(read('src/agent.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'SessionStart payload test', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W86', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W86', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W86-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W86-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    lifecycle: '30/30',
    build: 'exit 0',
    full: '2,115/2,115',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '3c77f51d9528fb1e73f97a8039acb5edc96cca66c30b0d799e9b6f1c5c3275f2',
  },
  residuals: [
    'Explicit title arguments and the in-memory title store are not replicated.',
    'Full hook consumers and script semantics remain C-6 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with full consumers and script semantics.',
};
write('research/ports/W86-session-start-payload-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW86-01 completes the SessionStart payload',
  'research/coding-standard.md': '\n2026-10-18 W86-01 ',
  'research/FEATURES.md': 'W86 adds the SessionStart',
  'research/ports/W86-session-start-payload.md': '# W86 — SessionStart agent type and session title',
  '.audit/w86-runtime.todo.md': '\n## W86-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
