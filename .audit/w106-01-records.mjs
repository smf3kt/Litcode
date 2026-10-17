// W106-01 record: PermissionDenied retry hint.
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

const note = `# W106 — PermissionDenied retry hint

## Source position

The PermissionDenied output schema is \`hookSpecificOutput: {hookEventName:
"PermissionDenied", retry?: boolean}\` (chunk-n3ykh62m.js [395412,395472)).
The raise is gated on \`decisionReason?.type === "classifier" &&
decisionReason.classifier === "auto-mode"\` (chunk-sfn1dbxq.js 2288685); the
runner loops the hook answers and any truthy \`retry\` sets \`gr\`, then
\`if (gr && !decisionReason.noVerdict)\` pushes
\`{message: xe({content: Hen, isMeta: !0, turnCompanion: !0, now: X})}\`
(offset 2289047). \`Hen\` is "The PermissionDenied hook indicated you may retry
this tool call." (chunk-phm7wwmz.js offset 10022). \`noVerdict\` is only set on
auto-mode classifier no-verdict denials (chunk-sfn1dbxq.js 3343515, 3344972,
3351249, 3353122); no other assignment exists.

## Port

\`HookResult.retry\` is parsed only from PermissionDenied and only when
\`=== true\`. \`authorize\` captures the existing native PermissionDenied hook
answer on both rule-deny sites and returns the flag with the denial; the tool
batch keeps a batch-scope flag and appends one meta user message after the
paired result batch. Comments cite the ranges.

## Adaptation

This product has no auto-mode classifier and no decision-reason surface; the
native PermissionDenied raise on rule denials is the recorded W45 divergence,
so the recovered consumer attaches to that existing path. The source's
\`!noVerdict\` gate is vacuous here because \`noVerdict\` never exists. The
source pushes one hint per denied call; this batch model appends one after the
whole result batch. \`isMeta\`/\`turnCompanion\` have no analogue in the session
model: the hint is a plain user message that no front end renders and the next
request includes.

## Verification

\`hooks\` asserts the field parses for PermissionDenied alone, \`false\` and a
PermissionRequest output are ignored. \`agent-lifecycle\` asserts the exact hint
follows the denied result batch only when \`retry\` is set and is absent
otherwise. Focused 97/97, tsc 0, build 0, full 2,144/2,144, chain 767/767,
notices 0, identity \`ef87a5eb…\`.
`;
write('research/ports/W106-permission-retry.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W106-01 consumes the PermissionDenied \`retry\` output. When a deny path's hook
returns it, the recovered meta user message "The PermissionDenied hook
indicated you may retry this tool call." is appended after the paired tool
result batch, hidden from display and present in the next request. The source
skips it only on \`noVerdict\` auto-mode classifier denials, which this build
cannot produce. Focused 97/97, tsc 0, build 0, full 2,144/2,144, chain
767/767, identity \`ef87a5eb…\`.
[W106 record](ports/W106-permission-retry.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W106-01 PermissionDenied retry：S-1（先读源）：schema [395412,395472)（chunk-n3ykh62m.js）、Hen 10022（chunk-phm7wwmz.js）、消费 2289047 与分类器门 2288685、noVerdict 赋值 3343515/3344972/3351249/3353122（chunk-sfn1dbxq.js）。S-2（不臆造）：仅 PermissionDenied 且 ===true；仅已有拒绝路径消费；源在 noVerdict 时抑制，而 noVerdict 只属于自动模式分类器拒绝，本构建无分类器故该门恒真。S-3（边界）：源每次拒绝推一条，本批处理模型在整批结果后推一条；isMeta/turnCompanion 无对应，消息不渲染但进入下一请求。S-4（可测）：hooks 断言解析与忽略；agent-lifecycle 断言提示紧随结果批且未 retry 时不存在。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：聚焦 97/97、tsc 0、build 0、全量 2,144/2,144、链 767/767、notices 0、索引不变、身份 ef87a5eb…。
`);

replaceOnce('research/FEATURES.md',
  'with internal non-run blocks suppressing automatically |',
  'with internal non-run blocks suppressing automatically; W106 echoes the PermissionDenied hook\'s `retry` as the recovered hidden meta user message after the denied batch (the source skips it only on no-verdict classifier denials, which this build has no classifier for) |');

replaceAll('research/CURRENT.md',
  '；W105消费UserPromptSubmit/UserPromptExpansion的suppressOriginalPrompt（阻断消息省略原提示/命令）并在内部阻断时自动省略；完整消费者与脚本语义仍待处理',
  '；W105消费UserPromptSubmit/UserPromptExpansion的suppressOriginalPrompt（阻断消息省略原提示/命令）并在内部阻断时自动省略；W106消费PermissionDenied的retry（拒绝批次后追加隐藏meta消息提示可重试，源仅对无裁决分类器拒绝抑制）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-17T20:10:00Z', 'package', 'W106-01 PermissionDenied retry',
    'schema [395412,395472)、Hen 10022、消费 2289047、分类器门 2288685、noVerdict 3343515/3344972/3351249/3353122',
    '仅PermissionDenied且===true；仅已有拒绝路径；每批一条；无分类器时noVerdict门恒真',
    'hooks/agent-lifecycle 97/97；tsc 0；build 0；全量 2,144/2,144；链 767/767'],
  ['2026-10-17T20:12:00Z', 'decision', 'W106-01 本地适配',
    '源每次拒绝推一条且带isMeta/turnCompanion；本批处理模型整批后推一条普通用户消息',
    '不渲染但进入下一请求；分类器门无对应路径',
    '.audit/w106-01-full.txt'],
  ['2026-10-17T20:14:00Z', 'verification', 'W106-01 验收：聚焦 97/97、tsc 0、build 0、2,144/2,144、767/767',
    'retry时提示紧随结果批；未retry时不存在；hooks仅解析PermissionDenied',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity ef87a5eb…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w106-runtime.tsv', tsv + '\n');

write('.audit/w106-runtime.todo.md', `# W106 runtime trail

## W106-01 acceptance (2026-10-17)

- [x] **Source read.** Output schema, the auto-mode classifier gate, the
  any-truthy retry accumulation, the \`noVerdict\` condition and its only
  assignments, and the exact \`Hen\` text.
- [x] **Port.** Field parse, deny-path capture on both re-check sites, one
  meta message after the paired batch.
- [x] **Bounds.** No hint without \`retry\`; other events cannot set it; the
  hint is not an event and is not rendered.
- [x] **Gates.** focused 97/97, tsc 0, build 0, full 2,144/2,144, chain
  767/767, notices 0, source index unchanged, identity \`ef87a5eb…\`.
- [ ] Remaining C-6: the rest of the script semantics.
`);

const evidence = {
  schema: 'W106PermissionRetryEvidence.v1',
  package: 'W106-01 — PermissionDenied retry hint',
  date: '2026-10-17',
  question: 'What does the PermissionDenied hook retry output do, and when is it honored?',
  answer: 'The output schema carries retry?: boolean. The source raises the hook only for auto-mode classifier denials, accumulates any truthy answer, and when retry is set and decisionReason.noVerdict is not, pushes a meta user message ("The PermissionDenied hook indicated you may retry this tool call.") after the denied tool result. noVerdict only marks classifier no-verdict denials.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    schema: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', range: [395412, 395472] },
    text: { module: 'extracted-v2/modules/chunk-phm7wwmz.js', symbol: 'Hen', offset: 10022 },
    consumer: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 2289047 },
    classifierGate: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 2288685 },
    noVerdictAssignments: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offsets: [3343515, 3344972, 3351249, 3353122] },
  },
  behavior: {
    events: ['PermissionDenied'],
    flag: 'retry === true',
    accumulation: 'any truthy answer',
    gate: 'decisionReason.classifier === "auto-mode" && !decisionReason.noVerdict',
    message: 'The PermissionDenied hook indicated you may retry this tool call.',
    placement: 'meta user message after the denied tool result',
  },
  adaptations: [
    'This product has no auto-mode classifier; the native PermissionDenied raise on rule denials is the existing W45 divergence, and the recovered consumer attaches to that path. The !noVerdict gate is vacuous because noVerdict never exists here.',
    'The source appends one hint per denied call; this batch model appends one after the whole result batch.',
    'isMeta/turnCompanion have no analogue; the hint is a plain user message that is not rendered and reaches the next request.',
  ],
  changes: [
    { file: 'src/hooks.ts', change: 'retry field parse', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/agent.ts', change: 'deny-path capture and post-batch meta message', sha256: sha(read('src/agent.ts')) },
    { file: 'test/hooks.test.ts', change: 'parse and ignore assertions', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'hint placement and absence', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W106', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W106', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W106-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W106-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '97/97 (hooks, agent-lifecycle)',
    build: 'exit 0',
    full: '2,144/2,144',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'ef87a5eb7dd6dc15cb0a96802a99d5e8977c3706d96910fa038354b1e4129ae6',
  },
  residuals: [
    'The remaining C-6 script semantics are unconsumed.',
    'PermissionDenied is still raised on rule denials rather than only classifier denials (W45 divergence).',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with the remaining script semantics.',
};
write('research/ports/W106-permission-retry-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW106-01 consumes the PermissionDenied `retry`',
  'research/coding-standard.md': '\n2026-10-17 W106-01 ',
  'research/FEATURES.md': 'W106 echoes the PermissionDenied',
  'research/ports/W106-permission-retry.md': '# W106 — PermissionDenied retry hint',
  '.audit/w106-runtime.todo.md': '\n## W106-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
