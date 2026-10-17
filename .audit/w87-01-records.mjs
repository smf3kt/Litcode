// W87-01 record: PreCompact custom instructions.
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

const note = `# W87 — PreCompact custom instructions

## Source position

\`rAe\` (chunk-sfn1dbxq.js, UTF-16 [2931620,2932807)) sends PreCompact
\`{trigger, custom_instructions}\`, where \`custom_instructions\` is nullable
(schema in chunk-r2vtj1kh.js). Its output processing takes every successful,
non-blocked hook's trimmed stdout, joins them with \`\\n\\n\` and returns
\`newCustomInstructions\`; the compaction prompt appends
\`Additional Instructions:\\n<...>\` (\`wnn\` offset 2504123). Manual compaction
prefixes the user's \`/compact\` arguments with \`User context: \` and composes
hook instructions first (\`ztt\` offset 2565187; manual site at offset 2572138).

## Port

PreCompact now carries \`custom_instructions\` (the user's \`/compact\` text, or
null). \`HookResult.newCustomInstructions\` collects the same trimmed stdout that
already enters \`additionalContext\`; \`compact\` joins it with \`\\n\\n\`, composes
\`<hook instructions>\\n\\nUser context: <user instructions>\` and appends the
\`Additional Instructions:\` block to the summary request. The raw-stdout entries
are excluded from the separate \`Hook context:\` block so the same text is not
sent twice; other PreCompact context still travels there. \`/compact\` accepts
trailing instructions and forwards them through \`compactContext\`.

## Adaptation

PreCompact stdout still also remains in \`additionalContext\` for every other
consumer; only the compaction prompt de-duplicates it. The product's summary
prompt body is its own sentence, so the source's instruction block is appended
to that body rather than replacing it.

## Verification

\`agent-lifecycle\` 31/31: a PreCompact hook receives
\`trigger: "manual"\` and \`custom_instructions: "user instruction"\`, prints
\`hook instruction\`, and the summary request contains
\`Additional Instructions:\\nhook instruction\\n\\nUser context: user instruction\`;
the compact event records the summary. tsc 0; build 0; full 2,116/2,116; chain
767/767; notices 0; source index unchanged; identity \`e3257471…\`.
`;
write('research/ports/W87-precompact-instructions.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W87-01 ports PreCompact custom instructions. The payload carries
\`custom_instructions\` (the \`/compact\` text, or null); successful hook stdout
collects as \`newCustomInstructions\`, and the summary prompt appends
\`Additional Instructions:\` with hook instructions first and the user text as
\`User context:\`, matching \`rAe\`/\`wnn\`/\`ztt\`. The raw stdout is excluded from
the duplicate \`Hook context:\` block but still reaches other consumers through
\`additionalContext\`. \`agent-lifecycle\` 31/31, tsc 0, build 0, full
2,116/2,116, chain 767/767, identity \`e3257471…\`.
[W87 record](ports/W87-precompact-instructions.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W87-01 PreCompact 自定义指令：S-1（先读源）：读取 chunk-sfn1dbxq.js 的 rAe [2931620,2932807)、wnn 2504123、ztt 2565187、手动调用点 2572138，以及 chunk-r2vtj1kh.js 的 PreCompact schema（UTF-16）。S-2（不臆造）：custom_instructions 为用户文本或 null；成功未阻断钩子的 stdout 以 \\n\\n 连接为 newCustomInstructions；提示词追加 Additional Instructions，先钩子后 User context。S-3（边界）：stdout 仍进入 additionalContext 供其他消费者；总结合成提示词中排除重复。S-4（可测）：新增载荷、提示词块与 compact 事件用例。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：agent-lifecycle 31/31、tsc 0、build 0、全量 2,116/2,116、链 767/767、身份 e3257471…。
`);

replaceOnce('research/FEATURES.md',
  'leaving each unset without a value as `t7r` does |',
  'leaving each unset without a value as `t7r` does; W87 carries the nullable PreCompact `custom_instructions`, collects successful hook stdout as `newCustomInstructions`, appends the recovered `Additional Instructions:` block (hook instructions first, `/compact` text as `User context:`) to the summary request, and forwards `/compact` trailing text |');

replaceAll('research/CURRENT.md',
  '完整消费者与脚本语义仍待处理',
  'W87完成PreCompact自定义指令（nullable custom_instructions、stdout汇入newCustomInstructions、Additional Instructions块、/compact参数）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-18T01:10:00Z', 'package', 'W87-01 PreCompact 自定义指令',
    'rAe [2931620,2932807)、wnn 2504123、ztt 2565187、手动点 2572138、PreCompact schema；newCustomInstructions 与提示词块',
    'custom_instructions 文本或 null；stdout 以 \\n\\n 连接；先钩子后 User context；提示词去重',
    'agent-lifecycle 31/31；tsc 0；build 0；全量 2,116/2,116；链 767/767'],
  ['2026-10-18T01:12:00Z', 'decision', 'W87-01 边界',
    '① stdout 仍进入 additionalContext；② 仅总结请求去重；③ 保留产品自身总结提示词正文',
    '残余：完整消费者与脚本语义',
    '.audit/w87-01-full.txt'],
  ['2026-10-18T01:15:00Z', 'verification', 'W87-01 验收：agent-lifecycle 31/31、tsc 0、build 0、2,116/2,116、767/767',
    '载荷 trigger=manual/custom_instructions=user instruction；提示词含 Additional Instructions 块；compact 事件记录 summary',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity e3257471…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w87-runtime.tsv', tsv + '\n');

write('.audit/w87-runtime.todo.md', `# W87 runtime trail

## W87-01 acceptance (2026-10-18)

- [x] **Source read.** \`rAe\`, \`wnn\`, \`ztt\`, the manual call site and the
  PreCompact schema.
- [x] **Port.** Nullable \`custom_instructions\`, \`newCustomInstructions\`, the
  Additional Instructions block and \`/compact\` arguments.
- [x] **Bounds.** Stdout stays in \`additionalContext\`; only the summary request
  de-duplicates it.
- [x] **Gates.** agent-lifecycle 31/31, tsc 0, build 0, full 2,116/2,116, chain
  767/767, notices 0, source index unchanged, identity \`e3257471…\`.
- [ ] Remaining C-6: full consumers and script semantics.
`);

const evidence = {
  schema: 'W87PreCompactInstructionsEvidence.v1',
  package: 'W87-01 — PreCompact custom instructions',
  date: '2026-10-18',
  question: 'Does PreCompact receive nullable custom instructions, and does successful hook stdout reach the compaction prompt like the recovered newCustomInstructions path?',
  answer: 'Yes: /compact text reaches custom_instructions (null when absent), successful non-blocked hook stdout becomes newCustomInstructions joined by blank lines, and the summary request appends Additional Instructions with hook instructions first and the user text as "User context:"; the raw stdout is excluded from the duplicate Hook context block.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-sfn1dbxq.js',
    unit: 'UTF-16 code units',
    builder: { symbol: 'rAe', range: [2931620, 2932807] },
    promptBuilder: { symbol: 'wnn', offset: 2504123 },
    compose: { symbol: 'ztt', offset: 2565187 },
    manualSite: { offset: 2572138 },
    schema: { module: 'extracted-v2/modules/chunk-r2vtj1kh.js' },
  },
  behavior: {
    payload: 'trigger plus custom_instructions (string|null)',
    newCustomInstructions: 'successful non-blocked hook stdout, joined with two newlines',
    prompt: 'Additional Instructions:\\n<hook>\\n\\nUser context: <user>',
    dedupe: 'raw stdout excluded from the Hook context block in the summary request only',
  },
  changes: [
    { file: 'src/hooks.ts', change: 'custom_instructions payload field and newCustomInstructions collection', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/agent.ts', change: 'compact payload, instruction composition and prompt block', sha256: sha(read('src/agent.ts')) },
    { file: 'src/interactive.ts', change: '/compact trailing instructions', sha256: sha(read('src/interactive.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'PreCompact payload and prompt test', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W87', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W87', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W87-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W87-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    lifecycle: '31/31',
    build: 'exit 0',
    full: '2,116/2,116',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'e32574717dfd3d9506bd9e8af106a415bb28d18a64b4eb24d43e13f0c86b1969',
  },
  residuals: [
    'PreCompact stdout remains in additionalContext for other consumers; only the summary request de-duplicates it.',
    'Full hook consumers and script semantics remain C-6 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with full consumers and script semantics.',
};
write('research/ports/W87-precompact-instructions-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW87-01 ports PreCompact custom instructions',
  'research/coding-standard.md': '\n2026-10-18 W87-01 ',
  'research/FEATURES.md': 'W87 carries the nullable PreCompact',
  'research/ports/W87-precompact-instructions.md': '# W87 — PreCompact custom instructions',
  '.audit/w87-runtime.todo.md': '\n## W87-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
