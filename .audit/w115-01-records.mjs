// W115-01 record: Elicitation hook answers.
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

const note = `# W115 — Elicitation and ElicitationResult hook answers

## Source position

The Elicitation and ElicitationResult output schemas carry an optional
\`action\` (\`accept\`/\`decline\`/\`cancel\`) and \`content\` string-or-record
(chunk-n3ykh62m.js offsets 395776 and 395895). \`f7r\` (chunk-sfn1dbxq.js
offset 3055929) turns each record into either a \`blockingError\` or a
\`response {action, content}\`, requiring the matching \`hookEventName\` and a
present action; \`cvt\`/\`dvt\` (offsets 2934418 and 2934736) keep the last
response and the last blocking error across hooks. The MCP caller
(chunk-nejdhvxk.js \`Zgn\` at offset 2367) returns a hook response instead of
opening the dialog, returns \`decline\` when a hook blocked, and otherwise asks
the person. After the person answers, \`ehn\` (offset 2849) runs the
ElicitationResult hooks: a blocking result declines, an answer replaces the
action and keeps the person's content when the hook supplies none, and a
response notice is posted.

## Port

\`runHooks\` stores the last hook answer on \`elicitationResponse\`, admitting
the schema's string-or-record content. The interactive elicit callback returns
that answer without opening the dialog (and without running ElicitationResult
hooks), and after the dialog applies the ElicitationResult override: block
declines, an action overrides, and the person's content survives an empty hook
content.

## Adaptation

The hook answer still passes through this runtime's MCP result validation, so a
form answer must match the requested schema and a URL answer carries no
content; the source forwards hook content without re-validating it. The
source's "Elicitation response for server X: <action>" notice has no local
notification surface and is not shown. The \`answerHeld\` personal-hook merge
and async-response exclusion have no local analogue because async hooks do not
return outputs here.

## Verification

\`hooks\` asserts action/content parsing, last-wins, the action requirement and
the event gate. \`mcp-form-ownership\` asserts a hook answer skips the dialog and
an ElicitationResult hook overrides the answered form. Focused 97/97, tsc 0,
build 0, full 2,158/2,158, chain 767/767, identity \`82dd4570…\`.
`;
write('research/ports/W115-elicitation-hooks.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W115-01 consumes Elicitation and ElicitationResult hook answers. The
Elicitation answer replaces the MCP dialog (and skips the result hooks); after
a dialog answer, a blocking ElicitationResult declines and an answer overrides
the action while keeping the person's content when the hook supplies none.
Focused 97/97, tsc 0, build 0, full 2,158/2,158, chain 767/767, identity
\`82dd4570…\`.
[W115 record](ports/W115-elicitation-hooks.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W115-01 Elicitation钩子答案：S-1（先读源）：schema 395776/395895（chunk-n3ykh62m.js）、f7r 3055929、cvt/dvt 2934418/2934736（chunk-sfn1dbxq.js）、Zgn/ehn（chunk-nejdhvxk.js 2367/2849）。S-2（不臆造）：action 必填且为三值；content 仅字符串或记录；后钩覆盖先钩；阻断即拒绝；结果钩内容缺省保留本人内容。S-3（边界）：本地 MCP 结果校验仍在表单答案上运行（源不复核）；源的响应通知无本地通知面；answerHeld/异步排除无对应。S-4（可测）：hooks 断言解析、覆盖与门控；mcp-form-ownership 断言钩子答题跳过对话框及结果钩覆盖。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：聚焦 97/97、tsc 0、build 0、全量 2,158/2,158、链 767/767、notices 0、索引不变、身份 82dd4570…。
`);

replaceOnce('research/FEATURES.md',
  'W114 reports the source advisory when a worktree-isolated child runs outside a Git repository with no hook |',
  'W114 reports the source advisory when a worktree-isolated child runs outside a Git repository with no hook; W115 lets Elicitation and ElicitationResult hooks answer or override the MCP form |');

replaceAll('research/CURRENT.md',
  '；W114补齐无Git且无钩子时的源告警（repositoryState三态）；完整消费者与脚本语义仍待处理',
  '；W114补齐无Git且无钩子时的源告警（repositoryState三态）；W115消费Elicitation/ElicitationResult钩子答案（动作/内容替换对话框，阻断即拒绝）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-17T23:05:00Z', 'package', 'W115-01 Elicitation hook answers',
    'schema 395776/395895（chunk-n3ykh62m.js）、f7r 3055929、cvt/dvt 2934418/2934736（chunk-sfn1dbxq.js）、Zgn/ehn（chunk-nejdhvxk.js）',
    'action必填；content字符串或记录；后钩覆盖；阻断=拒绝；结果钩缺省内容保留本人内容',
    'hooks/mcp-form-ownership/mcp-client-requests/interactive 97/97；tsc 0；build 0；全量 2,158/2,158；链 767/767'],
  ['2026-10-17T23:07:00Z', 'decision', 'W115-01 本地适配',
    '本地MCP结果校验仍运行于表单答案；源响应通知无本地通知面；answerHeld/异步排除无对应',
    'URL 模式钩子内容被本地校验拒绝（源直接转发）',
    '.audit/w115-01-full.txt'],
  ['2026-10-17T23:09:00Z', 'verification', 'W115-01 验收：聚焦 97/97、tsc 0、build 0、2,158/2,158、767/767',
    '钩子答题不弹对话框；结果钩覆盖动作与内容',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 82dd4570…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w115-runtime.tsv', tsv + '\n');

write('.audit/w115-runtime.todo.md', `# W115 runtime trail

## W115-01 acceptance (2026-10-17)

- [x] **Source read.** The two output schemas, the per-record extractor, the
  last-wins folds, and both caller arms.
- [x] **Port.** elicitationResponse parse, dialog skip, result override.
- [x] **Bounds.** Action required and enumerated; content string or record; a
  blocking result declines; local MCP validation still applies.
- [x] **Gates.** focused 97/97, tsc 0, build 0, full 2,158/2,158, chain
  767/767, notices 0, source index unchanged, identity \`82dd4570…\`.
- [ ] Remaining C-6: the rest of the hook output consumers and script semantics.
`);

const evidence = {
  schema: 'W115ElicitationHooksEvidence.v1',
  package: 'W115-01 — Elicitation and ElicitationResult hook answers',
  date: '2026-10-17',
  question: 'How do Elicitation and ElicitationResult hooks answer or override an MCP elicitation?',
  answer: 'An Elicitation hook answer (action plus optional content) replaces the dialog and skips the result hooks. After a person answers, a blocking ElicitationResult declines, and an answer overrides the action while the person\'s content survives a missing hook content. The last hook answer wins in both phases.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    schemas: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', offsets: [395776, 395895] },
    extractor: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 3055929 },
    folds: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offsets: [2934418, 2934736] },
    callers: { module: 'extracted-v2/modules/chunk-nejdhvxk.js', offsets: [2367, 2849] },
  },
  behavior: {
    actionRequired: true,
    lastAnswerWins: true,
    dialogSkippedOnHookAnswer: true,
    resultHooksSkippedOnHookAnswer: true,
    blockingResultDeclines: true,
    contentFallbackToPerson: true,
  },
  adaptations: [
    'Hook answers still pass through this runtime\'s MCP result validation; the source forwards them unvalidated.',
    'The source response notice after ElicitationResult has no local notification surface.',
    'answerHeld merging and async-response exclusion have no local analogue.',
  ],
  changes: [
    { file: 'src/hooks.ts', change: 'elicitationResponse parse', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/interactive.ts', change: 'dialog skip and result override', sha256: sha(read('src/interactive.ts')) },
    { file: 'test/hooks.test.ts', change: 'parse assertions', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'test/mcp-form-ownership.test.ts', change: 'dialog-skip and override tests', sha256: sha(read('test/mcp-form-ownership.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W115', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W115', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W115-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W115-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '97/97 (hooks, mcp-form-ownership, mcp-client-requests, interactive)',
    build: 'exit 0',
    full: '2,158/2,158',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '82dd4570ee85763673666e7734715758c1fdc2a0c275e97c1ee849422192d912',
  },
  residuals: ['The remaining C-6 hook output consumers and script semantics are unconsumed.'],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with the remaining hook output consumers.',
};
write('research/ports/W115-elicitation-hooks-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW115-01 consumes Elicitation',
  'research/coding-standard.md': '\n2026-10-17 W115-01 ',
  'research/FEATURES.md': 'W115 lets Elicitation and ElicitationResult hooks',
  'research/ports/W115-elicitation-hooks.md': '# W115 — Elicitation and ElicitationResult hook answers',
  '.audit/w115-runtime.todo.md': '\n## W115-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
