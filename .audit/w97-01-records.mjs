// W97-01 record: UserPromptSubmit payload.
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

const note = `# W97 — UserPromptSubmit payload

## Source position

Both builders (chunk-sfn1dbxq.js \`Yir\` [2952083,2952369) and \`qtt\`
[2952369,2952751)) send the session context, \`hook_event_name\`,
\`prompt\` and the current \`session_title\`; this build emits no \`source\`.
The schema keeps \`source\` optional with the values \`user\`, \`sdk\`,
\`system\`, \`loop_wakeup\`, \`schedule_wakeup\` and \`poll_event\`, with the
recovery text "Payloads may omit it while the field rolls out"
(chunk-r2vtj1kh.js offset 194211).

## Port

\`Agent.run\` raises UserPromptSubmit with \`prompt\` and, when one is
recorded, \`session_title\` resolved from the latest \`title\` event (the same
\`vm\` resolution SessionStart already uses). The payload no longer carries
\`source: "user"\`.

## Correction

The product unconditionally sent \`source: "user"\` even though neither
recovered builder emits the field; a prompt injected by the SDK, a loop
wakeup or the event channel is not user-authored, so the implied verdict was
wrong.

## Adaptation

The schema enum stays documented in the hook contract; the runtime simply
does not invent a value the studied build omits.

## Verification

\`agent-lifecycle\` 38/38 with a new capture asserting the prompt and title,
and the absence of \`source\`. tsc 0; build 0; full 2,128/2,128; chain
767/767; notices 0; source index unchanged; identity \`fc290fa6…\`.
`;
write('research/ports/W97-user-prompt-submit.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W97-01 aligns the UserPromptSubmit payload. The event carries \`prompt\` and the
recorded \`session_title\` and no longer invents \`source: "user"\`; this build's
two builders omit the optional field. The title resolves from the latest
\`title\` event through the same helper SessionStart uses.
\`agent-lifecycle\` 38/38, tsc 0, build 0, full 2,128/2,128, chain 767/767,
identity \`fc290fa6…\`. [W97 record](ports/W97-user-prompt-submit.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W97-01 UserPromptSubmit 载荷：S-1（先读源）：读取 Yir [2952083,2952369) 与 qtt [2952369,2952751)、schema 194211（UTF-16）。S-2（不臆造）：删除 source:"user"；载荷为 prompt + 记录到的 session_title；标题取最新 title 事件（与 SessionStart 同一 vm 语义）。S-3（边界）：schema 的可选 source 枚举保留为契约，本构建不发出。S-4（可测）：新增捕获断言 prompt/title 存在且无 source。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON，纠正记录在端口内。验证：agent-lifecycle 38/38、tsc 0、build 0、全量 2,128/2,128、链 767/767、身份 fc290fa6…。
`);

replaceOnce('research/FEATURES.md',
  'removes the invented synchronous theme/editor/reload/MCP/model raises |',
  'removes the invented synchronous theme/editor/reload/MCP/model raises; W97 sends UserPromptSubmit with `prompt` and the recorded `session_title` and no invented `source` (the studied build omits the optional field) |');

replaceAll('research/CURRENT.md',
  '；完整消费者与脚本语义仍待处理',
  '；W97对齐UserPromptSubmit载荷（prompt+记录到的session_title，删除source:"user"；本构建两个builder均省略可选source）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-18T07:00:00Z', 'package', 'W97-01 UserPromptSubmit 载荷',
    'Yir 2952083、qtt 2952369、schema 194211；currentSessionTitle 复用',
    'prompt + session_title；删除 source',
    'agent-lifecycle 38/38；tsc 0；build 0；全量 2,128/2,128；链 767/767'],
  ['2026-10-18T07:02:00Z', 'decision', 'W97-01 纠正',
    '先前每个提示固定 source:"user"，但两个源 builder 都不发该字段；SDK/loop/事件注入的提示并非用户作者',
    'schema 枚举保留为契约，不伪造值',
    '.audit/w97-01-full.txt'],
  ['2026-10-18T07:05:00Z', 'verification', 'W97-01 验收：agent-lifecycle 38/38、tsc 0、build 0、2,128/2,128、767/767',
    '捕获断言 prompt 与 title，且 "source" in payload === false',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity fc290fa6…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w97-runtime.tsv', tsv + '\n');

write('.audit/w97-runtime.todo.md', `# W97 runtime trail

## W97-01 acceptance (2026-10-18)

- [x] **Source read.** Both builders and the conditionally documented schema.
- [x] **Port.** prompt + recorded session title; no invented source.
- [x] **Correction.** The unconditional \`source: "user"\` is removed.
- [x] **Bounds.** The optional schema enum stays a contract; the runtime emits
  no value this build omits.
- [x] **Gates.** agent-lifecycle 38/38, tsc 0, build 0, full 2,128/2,128,
  chain 767/767, notices 0, source index unchanged, identity \`fc290fa6…\`.
- [ ] Remaining C-6: full consumers and the remaining unwired event fields.
`);

const evidence = {
  schema: 'W97UserPromptSubmitEvidence.v1',
  package: 'W97-01 — UserPromptSubmit payload',
  date: '2026-10-18',
  question: 'Which fields does UserPromptSubmit carry, and does it carry source?',
  answer: 'The prompt and the current session title. Both builders omit the optional source field in this build; the product no longer sends source: "user".',
  sourcePosition: {
    unit: 'UTF-16 code units',
    builders: [
      { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'Yir', range: [2952083, 2952369] },
      { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'qtt', range: [2952369, 2952751] },
    ],
    schema: { module: 'extracted-v2/modules/chunk-r2vtj1kh.js', offset: 194211,
      sourceValues: ['user', 'sdk', 'system', 'loop_wakeup', 'schedule_wakeup', 'poll_event'],
      optional: true, note: 'Payloads may omit it while the field rolls out.' },
  },
  behavior: {
    fields: ['prompt', 'session_title'],
    titleResolution: 'latest recorded title event (vm)',
    source: 'absent in this build',
  },
  correction: {
    previous: 'unconditional source: "user"',
    basis: 'neither recovered builder emits source; injected prompts are not user-authored',
    updatedTests: ['test/agent-lifecycle.test.ts'],
  },
  adaptations: [
    'The optional source enum remains documented in the hook contract.',
  ],
  changes: [
    { file: 'src/agent.ts', change: 'title helper, no source, session_title on submit', sha256: sha(read('src/agent.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'UserPromptSubmit payload capture', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W97', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W97', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W97-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W97-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    lifecycle: '38/38',
    build: 'exit 0',
    full: '2,128/2,128',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'fc290fa6be71c5380bc35616c13597eeb1adc6a2fcfd60f1702ac3fe9122622f',
  },
  residuals: [
    'The source values for sdk, loop wakeup, scheduled fire, system injection and poll-event passes stay unwired because this build emits none of them.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with full consumers or the Stop runtime handle fields.',
};
write('research/ports/W97-user-prompt-submit-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW97-01 aligns the UserPromptSubmit payload',
  'research/coding-standard.md': '\n2026-10-18 W97-01 ',
  'research/FEATURES.md': 'W97 sends UserPromptSubmit with',
  'research/ports/W97-user-prompt-submit.md': '# W97 — UserPromptSubmit payload',
  '.audit/w97-runtime.todo.md': '\n## W97-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
