// W109-01 record: Setup additionalContext.
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

const note = `# W109 — Setup additional context

## Source position

The Setup output schema is \`hookSpecificOutput: {hookEventName: "Setup",
additionalContext?: string}\` (chunk-n3ykh62m.js offset 392333). The Setup
dispatcher \`GZo\` (chunk-sfn1dbxq.js offset 2483675) runs \`n7r\`, collects every
\`additionalContexts\` entry into \`b\`, appends each non-blocking hook message,
and when any context exists wraps them in one
\`{type: "hook_additional_context", content: b, hookName: "Setup", toolUseID:
"Setup", hookEvent: "Setup"}\` attachment in the startup message list
(offset 2484520).

## Port

\`pendingHookContext\` now also collects Setup hook results, which are raised at
the process-startup dispatch only. The startup request receives the content
once through the existing \`Hook context:\` prefix, matching the attachment's
place in the startup message list.

## Adaptation

The source wraps the contexts in a typed attachment; this runtime carries the
same strings as \`Hook context:\` text. A Setup hook's non-blocking exit-2 error
is already recorded in the hook result's additionalContext by the runner, so it
joins the same request like the source's \`hook_non_blocking_error\` attachment.

## Verification

\`agent-lifecycle\` asserts the startup request carries \`Hook context:\\nsetup
context\` and that a resume start does not raise Setup. Focused 47/47, tsc 0,
build 0, full 2,147/2,147, chain 767/767, notices 0, identity \`45cc6853…\`.
`;
write('research/ports/W109-setup-context.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W109-01 consumes Setup \`additionalContext\`. Startup-only Setup results reach
the first request through the same one-shot hook context scan; a resume start
does not raise the event. Focused 47/47, tsc 0, build 0, full 2,147/2,147,
chain 767/767, identity \`45cc6853…\`.
[W109 record](ports/W109-setup-context.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W109-01 Setup additionalContext：S-1（先读源）：输出 schema 392333（chunk-n3ykh62m.js）、分发 GZo 2483675、附件 2484520（chunk-sfn1dbxq.js）。S-2（不臆造）：仅 startup 触发的 Setup 结果被扫描；resume 不 raise；非阻塞 exit 2 文本随 additionalContext 进入首请求。S-3（边界）：源注入 hook_additional_context 附件，本实现以 Hook context 文本进入首请求。S-4（可测）：agent-lifecycle 断言 startup 首请求含上下文、resume 不 raise。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：聚焦 47/47、tsc 0、build 0、全量 2,147/2,147、链 767/767、notices 0、索引不变、身份 45cc6853…。
`);

replaceOnce('research/FEATURES.md',
  'W108 stages the PostModelSwitch hook\'s `additionalContext` for exactly the next request |',
  'W108 stages the PostModelSwitch hook\'s `additionalContext` for exactly the next request; W109 injects Setup `additionalContext` into the startup request |');

replaceAll('research/CURRENT.md',
  '；W108消费PostModelSwitch的additionalContext（切换后暂存，下一请求携带一次）；完整消费者与脚本语义仍待处理',
  '；W108消费PostModelSwitch的additionalContext（切换后暂存，下一请求携带一次）；W109消费Setup的additionalContext（仅startup，进入首个请求）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-17T20:52:00Z', 'package', 'W109-01 Setup additionalContext',
    'schema 392333（chunk-n3ykh62m.js）、GZo 2483675、附件 2484520（chunk-sfn1dbxq.js）',
    '仅startup；resume不raise；exit 2文本随上下文进入首请求',
    'agent-lifecycle 47/47；tsc 0；build 0；全量 2,147/2,147；链 767/767'],
  ['2026-10-17T20:54:00Z', 'decision', 'W109-01 本地适配',
    '源以hook_additional_context附件进入启动消息列表；本实现以Hook context文本进入首请求',
    '文本等价；不新增附件类型',
    '.audit/w109-01-full.txt'],
  ['2026-10-17T20:56:00Z', 'verification', 'W109-01 验收：聚焦 47/47、tsc 0、build 0、2,147/2,147、767/767',
    'startup首请求含上下文；resume无Setup事件',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 45cc6853…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w109-runtime.tsv', tsv + '\n');

write('.audit/w109-runtime.todo.md', `# W109 runtime trail

## W109-01 acceptance (2026-10-17)

- [x] **Source read.** Output schema, the Setup dispatcher's collection and
  its wrapped attachment in the startup message list.
- [x] **Port.** Setup joins the one-shot pending hook context scan.
- [x] **Bounds.** Startup only; resume does not raise the event.
- [x] **Gates.** focused 47/47, tsc 0, build 0, full 2,147/2,147, chain
  767/767, notices 0, source index unchanged, identity \`45cc6853…\`.
- [ ] Remaining C-6: the rest of the script semantics.
`);

const evidence = {
  schema: 'W109SetupContextEvidence.v1',
  package: 'W109-01 — Setup additional context',
  date: '2026-10-17',
  question: 'Where does the Setup hook additionalContext go?',
  answer: 'The Setup dispatcher collects additionalContexts into one hook_additional_context attachment in the startup message list; non-blocking hook messages are appended too. Setup is raised from the process-startup dispatch only.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    schema: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', offset: 392333 },
    dispatcher: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'GZo', offset: 2483675 },
    attachment: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 2484520 },
  },
  behavior: {
    event: 'Setup',
    field: 'hookSpecificOutput.additionalContext',
    target: 'startup request',
    trigger: 'init only',
    attachment: 'hook_additional_context',
  },
  adaptations: [
    'The source wraps the contexts in a typed attachment; this runtime delivers the same strings as Hook context text in the first request.',
    'A non-blocking exit-2 error already joins the hook result additionalContext, matching the source non-blocking error attachment effect.',
  ],
  changes: [
    { file: 'src/agent.ts', change: 'pendingHookContext includes Setup', sha256: sha(read('src/agent.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'startup injection and resume absence', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W109', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W109', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W109-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W109-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '47/47 (agent-lifecycle)',
    build: 'exit 0',
    full: '2,147/2,147',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '45cc68537adb3e42e9ff352fe7226335efa777025322b785783ebd2e846eae75',
  },
  residuals: [
    'The remaining C-6 script semantics are unconsumed.',
    'Set-up hook messages are not modeled as typed attachments.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with the remaining script semantics.',
};
write('research/ports/W109-setup-context-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW109-01 consumes Setup',
  'research/coding-standard.md': '\n2026-10-17 W109-01 ',
  'research/FEATURES.md': 'W109 injects Setup',
  'research/ports/W109-setup-context.md': '# W109 — Setup additional context',
  '.audit/w109-runtime.todo.md': '\n## W109-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
