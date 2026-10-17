// W88-01 record: MessageDisplay payload and display rewrite.
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

const note = `# W88 — MessageDisplay payload and display rewrite

## Source position

\`zir\` (chunk-sfn1dbxq.js, UTF-16 [2936136,2936500)) builds MessageDisplay as
\`{turn_id, message_id, index, final, delta}\`. The completed-message path
\`WHo\` (chunk-6ejn7q9s.js offset 100801) raises one final delta with
\`index: 0\` and reads \`hookSpecificOutput.displayContent\`; display content
replaces the delta on screen only, while the stored message and the model view
are untouched (schema description in chunk-5s0t90hn.js; output processing at
chunk-sfn1dbxq.js offset 2967137).

## Port

The agent raises MessageDisplay with a generated \`message_id\`, the turn's
uuid, \`index: 0\`, \`final: true\` and the completed text as \`delta\`, matching
the completed-message call shape. \`HookResult.displayContent\` accepts the
matching \`hookSpecificOutput.displayContent\`; the turn's displayed text becomes
that value while the appended session message keeps the original content.
Empty text skips the raise, as \`WHo\` does.

## Adaptation

The product does not rewrite per-token deltas, so the whole completed text is
the single final delta. Streamed text events already emitted during the
completion keep the original text; the rewrite applies to the turn result that
the runtime reports and displays afterwards.

## Verification

\`agent-lifecycle\` 32/32: the hook receives the four delta fields with
\`turn_id\`/\`message_id\` uuids, \`delta: "original text"\`; returning
\`displayContent: "rewritten display"\` makes the run result that text while the
session message still contains only the original. tsc 0; build 0; full
2,117/2,117; chain 767/767; notices 0; source index unchanged; identity
\`9088606a…\`.
`;
write('research/ports/W88-message-display.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W88-01 ports the MessageDisplay contract. The agent raises
\`{turn_id, message_id, index: 0, final: true, delta}\` once per completed
message (the source's completed-message path), and
\`hookSpecificOutput.displayContent\` replaces the turn's displayed text while the
stored message and model view keep the original. Per-token delta rewriting is
not replicated; the whole completed text is the single final delta.
\`agent-lifecycle\` 32/32, tsc 0, build 0, full 2,117/2,117, chain 767/767,
identity \`9088606a…\`. [W88 record](ports/W88-message-display.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W88-01 MessageDisplay 契约：S-1（先读源）：读取 chunk-sfn1dbxq.js 的 zir [2936136,2936500) 与输出处理偏移 2967137、chunk-6ejn7q9s.js 的 WHo 100801、chunk-5s0t90hn.js 的字段说明（UTF-16）。S-2（不臆造）：载荷为 turn_id/message_id/index/final/delta，完成消息一次 final delta；displayContent 仅替换显示。S-3（边界）：不复刻逐 token 重写；已流式输出的文本保持原文，重写作用于回合结果。S-4（可测）：新增载荷字段、显示替换与存储不变用例。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：agent-lifecycle 32/32、tsc 0、build 0、全量 2,117/2,117、链 767/767、身份 9088606a…。
`);

replaceOnce('research/FEATURES.md',
  'and forwards `/compact` trailing text |',
  'and forwards `/compact` trailing text; W88 raises MessageDisplay with the recovered `{turn_id, message_id, index, final, delta}` shape and applies `hookSpecificOutput.displayContent` to the displayed turn text only (the stored message and model view keep the original; per-token rewriting is not replicated) |');

replaceAll('research/CURRENT.md',
  '完整消费者与脚本语义仍待处理',
  'W88完成MessageDisplay契约（turn_id/message_id/index/final/delta，displayContent仅改显示，存储不变）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-18T01:40:00Z', 'package', 'W88-01 MessageDisplay 契约',
    'zir [2936136,2936500)、输出处理 2967137、WHo 100801、字段说明；HookPayload.delta 系列与 displayContent',
    '完成消息一次 final delta；displayContent 仅替换回合显示文本',
    'agent-lifecycle 32/32；tsc 0；build 0；全量 2,117/2,117；链 767/767'],
  ['2026-10-18T01:42:00Z', 'decision', 'W88-01 边界',
    '① 不复刻逐 token 重写；② 流式输出保持原文；③ 空文本不触发 raise',
    '残余：完整消费者与脚本语义',
    '.audit/w88-01-full.txt'],
  ['2026-10-18T01:45:00Z', 'verification', 'W88-01 验收：agent-lifecycle 32/32、tsc 0、build 0、2,117/2,117、767/767',
    'payload 含四个 delta 字段；result.text=rewritten display；session.messages 仅 original text',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 9088606a…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w88-runtime.tsv', tsv + '\n');

write('.audit/w88-runtime.todo.md', `# W88 runtime trail

## W88-01 acceptance (2026-10-18)

- [x] **Source read.** \`zir\`, \`WHo\`, the display output processing and the
  schema description.
- [x] **Port.** Delta payload fields and \`displayContent\`.
- [x] **Bounds.** One final delta per completed message; stored message and
  model view unchanged; empty text skips the raise.
- [x] **Gates.** agent-lifecycle 32/32, tsc 0, build 0, full 2,117/2,117, chain
  767/767, notices 0, source index unchanged, identity \`9088606a…\`.
- [ ] Remaining C-6: full consumers and script semantics.
`);

const evidence = {
  schema: 'W88MessageDisplayEvidence.v1',
  package: 'W88-01 — MessageDisplay payload and display rewrite',
  date: '2026-10-18',
  question: 'Does MessageDisplay carry the recovered delta fields and apply displayContent without changing stored messages?',
  answer: 'Yes: the agent raises turn_id/message_id/index/final/delta once per completed message, displayContent replaces the displayed turn text, and the stored session message keeps the original text; per-token rewriting is not replicated.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-sfn1dbxq.js',
    unit: 'UTF-16 code units',
    builder: { symbol: 'zir', range: [2936136, 2936500] },
    outputProcessing: { offset: 2967137 },
    completedPath: { module: 'extracted-v2/modules/chunk-6ejn7q9s.js', symbol: 'WHo', offset: 100801 },
    schemaDescription: { module: 'extracted-v2/modules/chunk-5s0t90hn.js' },
  },
  behavior: {
    payload: 'turn_id, message_id, index: 0, final: true, delta',
    rewrite: 'hookSpecificOutput.displayContent replaces the displayed turn text',
    storage: 'session message and model view remain the original',
    skipped: 'empty completed text does not raise',
  },
  changes: [
    { file: 'src/hooks.ts', change: 'delta payload fields, displayContent result and parser', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/agent.ts', change: 'MessageDisplay raise and displayed text', sha256: sha(read('src/agent.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'MessageDisplay payload and rewrite test', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W88', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W88', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W88-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W88-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    lifecycle: '32/32',
    build: 'exit 0',
    full: '2,117/2,117',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '9088606aa20b6f11456cc7f46227f54935c15caaf6c0bdabe5f005dfcccc780d',
  },
  residuals: [
    'Per-token delta rewriting is not replicated; streamed text keeps the original.',
    'Full hook consumers and script semantics remain C-6 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with full consumers and script semantics.',
};
write('research/ports/W88-message-display-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW88-01 ports the MessageDisplay contract',
  'research/coding-standard.md': '\n2026-10-18 W88-01 ',
  'research/FEATURES.md': 'W88 raises MessageDisplay',
  'research/ports/W88-message-display.md': '# W88 — MessageDisplay payload and display rewrite',
  '.audit/w88-runtime.todo.md': '\n## W88-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
