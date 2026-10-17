// W107-01 record: SubagentStart additionalContext.
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

const note = `# W107 — SubagentStart additional context

## Source position

The SubagentStart output schema is \`hookSpecificOutput: {hookEventName:
"SubagentStart", additionalContext?: string}\` (chunk-n3ykh62m.js offset
392621). The subagent start consumer collects every \`additionalContexts\`
entry into \`Bo\` and, when non-empty, pushes a \`hook_additional_context\`
attachment with \`content: Bo\`, \`hookName\` and \`hookEvent: "SubagentStart"\`
into the child's message list before its first turn
(chunk-40cepjpq.js offsets 127150 and 127532). A blocking error becomes a
\`hook_non_blocking_error\` attachment (\`Jtt\`, chunk-sfn1dbxq.js offset
3009808) instead of failing the start; the whole injection is skipped when the
child has an isolated context.

## Port

\`pendingHookContext\` now collects the additional context of SubagentStart
hook results alongside SessionStart when the start events precede the first
message. The existing \`Hook context:\` prefix carries them into the first
request, the same position the recovered attachment occupies.

## Adaptation

The isolated-context exclusion has no analogue here (the runtime has no
isolated-context child option). Our exit-2 message for a non-blocking event is
a \`Hook context:\` line; the source's attachment is a
\`hook_non_blocking_error\` record, but both reach the same next request and
neither fails the child.

## Verification

\`agent-lifecycle\` asserts the child's first request carries
\`Hook context:\\nchild start context\` and that a top-level session never
raises SubagentStart. Focused 45/45, tsc 0, build 0, full 2,145/2,145, chain
767/767, notices 0, identity \`b6d0794d…\`.
`;
write('research/ports/W107-subagent-context.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W107-01 consumes SubagentStart \`additionalContext\`. A child session's first
request carries the recovered \`hook_additional_context\` content, the same
position the source attachment occupies; a top-level session never raises the
event. Focused 45/45, tsc 0, build 0, full 2,145/2,145, chain 767/767,
identity \`b6d0794d…\`.
[W107 record](ports/W107-subagent-context.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W107-01 SubagentStart additionalContext：S-1（先读源）：输出 schema 392621（chunk-n3ykh62m.js）、附件注入 127150/127532、非阻塞错误 Jtt 3009808（chunk-sfn1dbxq.js）、子代理启动消费 chunk-40cepjpq.js。S-2（不臆造）：仅 childMode 会话会 raise；上下文只进入首个请求；isolatedContext 排除在本构建无对应项。S-3（边界）：源注入 hook_additional_context 附件，本实现用既有 Hook context 行；exit 2 文本形状不同但同样进入下一请求且不使启动失败。S-4（可测）：agent-lifecycle 断言子会话首请求含上下文、顶层会话不 raise。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：聚焦 45/45、tsc 0、build 0、全量 2,145/2,145、链 767/767、notices 0、索引不变、身份 b6d0794d…。
`);

replaceOnce('research/FEATURES.md',
  'which this build has no classifier for) |',
  'which this build has no classifier for); W107 injects the SubagentStart hook\'s `additionalContext` into the child session\'s first request |');

replaceAll('research/CURRENT.md',
  '；W106消费PermissionDenied的retry（拒绝批次后追加隐藏meta消息提示可重试，源仅对无裁决分类器拒绝抑制）；完整消费者与脚本语义仍待处理',
  '；W106消费PermissionDenied的retry（拒绝批次后追加隐藏meta消息提示可重试，源仅对无裁决分类器拒绝抑制）；W107消费SubagentStart的additionalContext（子会话首请求携带附件内容，顶层会话不触发）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-17T20:24:00Z', 'package', 'W107-01 SubagentStart additionalContext',
    'schema 392621（chunk-n3ykh62m.js）、附件注入 127150/127532、Jtt 3009808、消费 chunk-40cepjpq.js',
    '仅childMode raise；仅首个请求；顶层不触发；isolatedContext无对应',
    'agent-lifecycle 45/45；tsc 0；build 0；全量 2,145/2,145；链 767/767'],
  ['2026-10-17T20:26:00Z', 'decision', 'W107-01 本地适配',
    '源注入hook_additional_context附件；本实现以既有Hook context行进入首请求',
    'exit 2文本形状不同但效果相同；不使子会话启动失败',
    '.audit/w107-01-full.txt'],
  ['2026-10-17T20:28:00Z', 'verification', 'W107-01 验收：聚焦 45/45、tsc 0、build 0、2,145/2,145、767/767',
    '子会话首请求含上下文；顶层无SubagentStart事件',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity b6d0794d…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w107-runtime.tsv', tsv + '\n');

write('.audit/w107-runtime.todo.md', `# W107 runtime trail

## W107-01 acceptance (2026-10-17)

- [x] **Source read.** Output schema, the attachment injection and its
  isolated-context exclusion, and the non-blocking error attachment.
- [x] **Port.** SubagentStart joins the pending hook context that the first
  request consumes.
- [x] **Bounds.** Top-level sessions do not raise the event; the context is
  delivered once, before the first message.
- [x] **Gates.** focused 45/45, tsc 0, build 0, full 2,145/2,145, chain
  767/767, notices 0, source index unchanged, identity \`b6d0794d…\`.
- [ ] Remaining C-6: the rest of the script semantics.
`);

const evidence = {
  schema: 'W107SubagentContextEvidence.v1',
  package: 'W107-01 — SubagentStart additional context',
  date: '2026-10-17',
  question: 'Where does the SubagentStart hook additionalContext go?',
  answer: 'The child subagent start consumer collects every additionalContexts entry and injects a hook_additional_context attachment into the child message list before its first turn, unless the child has an isolated context. A blocking error becomes a hook_non_blocking_error attachment rather than failing the start.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    schema: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', offset: 392621 },
    injection: { module: 'extracted-v2/modules/chunk-40cepjpq.js', offsets: [127150, 127532] },
    nonBlockingError: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'Jtt', offset: 3009808 },
  },
  behavior: {
    event: 'SubagentStart',
    field: 'hookSpecificOutput.additionalContext',
    target: 'child first request',
    attachment: 'hook_additional_context',
    isolatedContextSkips: true,
  },
  adaptations: [
    'The runtime has no isolated-context child option, so the exclusion cannot trigger.',
    'Exit 2 on this non-blocking event surfaces as a Hook context line instead of a hook_non_blocking_error attachment; both reach the next request without failing the child.',
  ],
  changes: [
    { file: 'src/agent.ts', change: 'pendingHookContext includes SubagentStart', sha256: sha(read('src/agent.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'child injection and top-level absence', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W107', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W107', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W107-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W107-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '45/45 (agent-lifecycle)',
    build: 'exit 0',
    full: '2,145/2,145',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'b6d0794d1fcacb0b20d07b7c8b4fcda91dbc7b72b3929a6b6bb72233525f74be',
  },
  residuals: [
    'The remaining C-6 script semantics are unconsumed.',
    'A blocking error is delivered as generic context text rather than a typed non-blocking attachment.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with the remaining script semantics.',
};
write('research/ports/W107-subagent-context-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW107-01 consumes SubagentStart',
  'research/coding-standard.md': '\n2026-10-17 W107-01 ',
  'research/FEATURES.md': 'W107 injects the SubagentStart',
  'research/ports/W107-subagent-context.md': '# W107 — SubagentStart additional context',
  '.audit/w107-runtime.todo.md': '\n## W107-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
