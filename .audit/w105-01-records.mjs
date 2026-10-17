// W105-01 record: suppressOriginalPrompt and prompt block messages.
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

const note = `# W105 — suppressOriginalPrompt and prompt block messages

## Source position

\`suppressOriginalPrompt\` exists on the UserPromptSubmit and UserPromptExpansion
output schemas (chunk-n3ykh62m.js offsets 391571 and 391772): "When decision is
\\"block\\", omit the original prompt from the block message." The consumers
append \`\\n\\nOriginal prompt: <prompt>\` to the block text unless it is set
(chunk-htgmc2p1.js offsets 34121 and 39033; the TUI consumer does the same at
chunk-ksjypbtc.js offset 4938). The UserPromptSubmit prefix is
\`UserPromptSubmit operation blocked by hook:\\n\` (\`EMe\`, chunk-sfn1dbxq.js
offset 3009974) and the expansion uses the same shape. A top-level
\`decision:"block"\` becomes a blocking error for any parsed output (\`pX\`,
chunk-sfn1dbxq.js offset 2961295). Internal runner failures, invalid output and
truncated stdio suppress the prompt automatically (\`Ret\` at offset 566691,
invalid-output path at 3032045, stdio path at 3034961); an ordinary exit 2 does
not.

## Port

\`HookResult\` gains \`suppressOriginalPrompt\`, parsed only from those two events
with \`=== true\`. \`promptBlockMessage\` renders the recovered text.
\`Agent.run\` returns it as the blocked turn's text for UserPromptSubmit and for
a fallthrough skill's UserPromptExpansion, and the interactive execution-skill
path prints it. The two prompt events joined \`DECISION_BLOCK_EVENTS\`, because
\`pX\` honors their top-level block decisions. Internal blocks (input byte cap,
unresolved hook kinds, missing async owner, resolver capacity) set the
suppression flag themselves.

## Adaptation

The source also stores a warning message in the conversation and returns the
same string as resultText. This runtime returns the string as the turn's text
and lets the front end print it, so the event log and the model's history are
unchanged. Ordinary exit-2 blocks keep the original prompt; only an explicit
output field or an internal non-run block suppresses it.

## Verification

\`hooks\` asserts parsing on both prompt events, the \`false\` and
SessionStart ignores, and automatic suppression when a model hook has no
resolver. \`lifecycle\` asserts the exact visible and suppressed texts for both
events. \`interactive\` asserts the execution-skill path appends or omits the
command. Focused 88/88, tsc 0, build 0, full 2,143/2,143, chain 767/767,
notices 0, identity \`3319a5a3…\`.
`;
write('research/ports/W105-prompt-block.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W105-01 consumes \`suppressOriginalPrompt\` on UserPromptSubmit and
UserPromptExpansion. Blocked prompts render the recovered
\`<event> operation blocked by hook:\\n<reason>\` text plus
\`Original prompt: <prompt>\` unless the hook suppressed it; internal blocks
where the hook never ran suppress automatically, and ordinary exit 2 keeps the
prompt. Both prompt events now honor a top-level \`decision:"block"\` like \`pX\`.
Focused 88/88, tsc 0, build 0, full 2,143/2,143, chain 767/767, identity
\`3319a5a3…\`.
[W105 record](ports/W105-prompt-block.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W105-01 suppressOriginalPrompt 与提示阻断消息：S-1（先读源）：输出 schema 391571/391772（chunk-n3ykh62m.js）、消费 34121/39033（chunk-htgmc2p1.js）、TUI 4938（chunk-ksjypbtc.js）、EMe 3009974、pX 2961295、Ret 566691、无效输出 3032045、stdio 3034961（chunk-sfn1dbxq.js）。S-2（不臆造）：仅两事件解析且 ===true；普通 exit 2 不抑制；内部未运行/无效输出自动抑制；两事件按 pX 接受顶层 decision:block。S-3（边界）：源同时向会话写入警告消息并返回 resultText；本实现只作为该轮 text 交前端打印，事件日志与模型历史不变（记录为本地适配）。S-4（可测）：hooks 断言两事件解析、false/SessionStart 忽略、模型钩子缺解析器时自动抑制；lifecycle 断言两种事件的可见与抑制文本；interactive 断言执行型技能的追加/省略。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：聚焦 88/88、tsc 0、build 0、全量 2,143/2,143、链 767/767、身份 3319a5a3…。
`);

replaceOnce('research/FEATURES.md',
  '(live array and system-prompt section) without reloading settings |',
  '(live array and system-prompt section) without reloading settings; W105 renders the recovered UserPromptSubmit/UserPromptExpansion block message and honors the hook\'s `suppressOriginalPrompt`, with internal non-run blocks suppressing automatically |');

replaceAll('research/CURRENT.md',
  '并重建系统提示的技能段；完整消费者',
  '并重建系统提示的技能段；W105消费UserPromptSubmit/UserPromptExpansion的suppressOriginalPrompt（阻断消息省略原提示/命令）并在内部阻断时自动省略；完整消费者', 3);

const tsv = [
  ['2026-10-18T12:30:00Z', 'package', 'W105-01 suppressOriginalPrompt 与阻断消息',
    'schema 391571/391772、消费 34121/39033、TUI 4938、EMe 3009974、pX 2961295、Ret 566691',
    '仅两事件解析且===true；普通exit 2不抑制；内部未运行自动抑制；两事件支持decision:block',
    'hooks/lifecycle/interactive 88/88；tsc 0；build 0；全量 2,143/2,143；链 767/767'],
  ['2026-10-18T12:33:00Z', 'decision', 'W105-01 本地适配',
    '源写入警告消息并返回resultText；本实现仅返回该轮text',
    '事件日志与模型历史保持不变；由前端打印',
    '.audit/w105-01-full.txt'],
  ['2026-10-18T12:36:00Z', 'verification', 'W105-01 验收：聚焦 88/88、tsc 0、build 0、2,143/2,143、767/767',
    '可见文本含 Original prompt；抑制文本不含；内部缺解析器自动抑制；执行型技能路径同形',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 3319a5a3…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w105-runtime.tsv', tsv + '\n');

write('.audit/w105-runtime.todo.md', `# W105 runtime trail

## W105-01 acceptance (2026-10-18)

- [x] **Source read.** Both output schemas, both consumers, the TUI consumer,
  the formatter, the decision mapping and the internal-suppression paths.
- [x] **Port.** Field parse, block-message renderer, decision support for both
  prompt events, automatic suppression for internal blocks.
- [x] **Bounds.** Ordinary exit 2 keeps the prompt; no warning message is added
  to the event log.
- [x] **Gates.** focused 88/88, tsc 0, build 0, full 2,143/2,143, chain
  767/767, notices 0, source index unchanged, identity \`3319a5a3…\`.
- [ ] Remaining C-6: SessionStart \`retry\` and the rest of the script semantics.
`);

const evidence = {
  schema: 'W105PromptBlockEvidence.v1',
  package: 'W105-01 — suppressOriginalPrompt and prompt block messages',
  date: '2026-10-18',
  question: 'How do the prompt hooks suppress the original prompt from a block message, and when does the runner suppress it itself?',
  answer: 'The two prompt events carry suppressOriginalPrompt in their hookSpecificOutput. Their block text is "<event> operation blocked by hook:\\n<reason>" plus "\\n\\nOriginal prompt: <prompt>" unless suppressed. Internal non-run, invalid-output and truncated-stdio blocks suppress automatically; an ordinary exit 2 does not. A top-level decision block becomes a blocking error for any parsed output.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    submitSchema: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', offset: 391571 },
    expansionSchema: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', offset: 391772 },
    submitConsumer: { module: 'extracted-v2/modules/chunk-htgmc2p1.js', offset: 34121 },
    expansionConsumer: { module: 'extracted-v2/modules/chunk-htgmc2p1.js', offset: 39033 },
    tuiConsumer: { module: 'extracted-v2/modules/chunk-ksjypbtc.js', offset: 4938 },
    formatter: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'EMe', offset: 3009974 },
    decisionMapping: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'pX', offset: 2961295 },
    internalSuppression: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'Ret', offset: 566691 },
  },
  behavior: {
    events: ['UserPromptSubmit', 'UserPromptExpansion'],
    suffix: 'Original prompt: <prompt>',
    suppressedBy: ['explicit output field', 'internal non-run or invalid-output block'],
    exitTwoSuppresses: false,
    decisionBlockHonored: true,
  },
  adaptations: [
    'The source stores a warning message in the conversation and returns resultText; this runtime returns the text as the turn result and leaves the event log and model history unchanged.',
    'Internal block paths in this runner set the suppression flag themselves, matching the source Ret behavior.',
  ],
  changes: [
    { file: 'src/hooks.ts', change: 'field parse, renderer, decision set, auto-suppression', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/agent.ts', change: 'block text for both prompt events', sha256: sha(read('src/agent.ts')) },
    { file: 'src/interactive.ts', change: 'execution-skill block text', sha256: sha(read('src/interactive.ts')) },
    { file: 'test/hooks.test.ts', change: 'parse and auto-suppression assertions', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'test/lifecycle.test.ts', change: 'exact visible and suppressed texts', sha256: sha(read('test/lifecycle.test.ts')) },
    { file: 'test/interactive.test.ts', change: 'execution-skill suffix assertions', sha256: sha(read('test/interactive.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W105', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W105', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W105-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W105-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '88/88 (hooks, lifecycle, interactive)',
    build: 'exit 0',
    full: '2,143/2,143',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '3319a5a3e6cdbcca976d1bab8d2704ec3d7386c0aa27f5cf77403e9ef74bc736',
  },
  residuals: [
    'SessionStart retry and the remaining script semantics are unconsumed.',
    'The block text is not persisted as a conversation warning message.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with SessionStart retry and the remaining script semantics.',
};
write('research/ports/W105-prompt-block-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW105-01 consumes `suppressOriginalPrompt`',
  'research/coding-standard.md': '\n2026-10-18 W105-01 ',
  'research/FEATURES.md': 'W105 renders the recovered',
  'research/ports/W105-prompt-block.md': '# W105 — suppressOriginalPrompt and prompt block messages',
  '.audit/w105-runtime.todo.md': '\n## W105-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
