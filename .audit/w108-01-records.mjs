// W108-01 record: PostModelSwitch additionalContext.
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

const note = `# W108 — PostModelSwitch additional context

## Source position

The PostModelSwitch output schema is \`hookSpecificOutput: {hookEventName:
"PostModelSwitch", additionalContext?: string}\` (chunk-n3ykh62m.js offset
392672). The switch consumer \`sXr\` (chunk-sfn1dbxq.js offset 2939454) collects
every \`additionalContexts\` entry and successful hook content into a pending
entry keyed by session and target model. \`gZo\` (offset 2940920) waits for
in-flight switch hooks, drains that entry, drops entries whose \`toModel\` is not
the session's landed model, dedupes identical contexts and messages, and returns
them to the model-request loop, which yields them as attachments before the next
request (chunk-5b2hxy2e.js offset 139177).

## Port

\`pendingHookContext\` now also collects PostModelSwitch hook results. The
one-shot backward scan that stops at the first message, compact or turn-end
delivers the staged context with the next request and never again, which is the
same drain-once behavior; the dedupe filter is unnecessary because each hook
result is read once.

## Adaptation

The source stages asynchronously and waits for in-flight hooks before the next
request. This runtime emits PostModelSwitch synchronously after the switch has
applied, so no in-flight wait exists. Failed hook output is delivered as
ordinary \`Hook context:\` text rather than a typed attachment, and the
\`toModel === landedOn.toModel\` filter is vacuous because the event is only
raised after a successful switch.

## Verification

\`agent-lifecycle\` stages a context with \`emitHook\` and asserts the next
request carries exactly one occurrence, including after a second turn (the text
stays in history; it is not injected twice). Focused 46/46, tsc 0, build 0,
full 2,146/2,146, chain 767/767, notices 0, identity \`1e2c779c…\`.
`;
write('research/ports/W108-modelswitch-context.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W108-01 consumes PostModelSwitch \`additionalContext\`. The hook result is
staged in the event log and the next request carries it once as
\`Hook context:\`; later requests see it only as ordinary history. Focused
46/46, tsc 0, build 0, full 2,146/2,146, chain 767/767, identity \`1e2c779c…\`.
[W108 record](ports/W108-modelswitch-context.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W108-01 PostModelSwitch additionalContext：S-1（先读源）：输出 schema 392672（chunk-n3ykh62m.js）、暂存 sXr 2939454、排空 gZo 2940920、请求前注入 chunk-5b2hxy2e.js 139177（chunk-sfn1dbxq.js）。S-2（不臆造）：仅切换成功后 raise 的事件才被暂存；一次性扫描消费后不再注入；toModel 过滤因只在成功后 raise 而恒真。S-3（边界）：源异步等待在途钩子，本实现同步 raise；失败输出以 Hook context 文本进入下一请求。S-4（可测）：agent-lifecycle 断言下一请求恰含一次文本，第二轮后仍只有一次。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：聚焦 46/46、tsc 0、build 0、全量 2,146/2,146、链 767/767、notices 0、索引不变、身份 1e2c779c…。
`);

replaceOnce('research/FEATURES.md',
  'into the child session\'s first request |',
  'into the child session\'s first request; W108 stages the PostModelSwitch hook\'s `additionalContext` for exactly the next request |');

replaceAll('research/CURRENT.md',
  '；W107消费SubagentStart的additionalContext（子会话首请求携带附件内容，顶层会话不触发）；完整消费者与脚本语义仍待处理',
  '；W107消费SubagentStart的additionalContext（子会话首请求携带附件内容，顶层会话不触发）；W108消费PostModelSwitch的additionalContext（切换后暂存，下一请求携带一次）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-17T20:38:00Z', 'package', 'W108-01 PostModelSwitch additionalContext',
    'schema 392672、sXr 2939454、gZo 2940920、注入 chunk-5b2hxy2e.js 139177',
    '仅成功后事件；一次注入；失败文本以Hook context进入；toModel过滤恒真',
    'agent-lifecycle 46/46；tsc 0；build 0；全量 2,146/2,146；链 767/767'],
  ['2026-10-17T20:40:00Z', 'decision', 'W108-01 本地适配',
    '源异步等待在途钩子并以附件注入；本实现同步raise后由一次性扫描注入',
    '历史中保留一次；后续请求不再重复注入',
    '.audit/w108-01-full.txt'],
  ['2026-10-17T20:42:00Z', 'verification', 'W108-01 验收：聚焦 46/46、tsc 0、build 0、2,146/2,146、767/767',
    '下一请求恰含一次文本；第二轮后仍为一次',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 1e2c779c…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w108-runtime.tsv', tsv + '\n');

write('.audit/w108-runtime.todo.md', `# W108 runtime trail

## W108-01 acceptance (2026-10-17)

- [x] **Source read.** Output schema, the pending staging, the drain that
  waits for in-flight hooks, the landed-model filter and the request-loop
  injection.
- [x] **Port.** PostModelSwitch joins the one-shot pending context scan.
- [x] **Bounds.** Exactly one injection; the text persists only as history.
- [x] **Gates.** focused 46/46, tsc 0, build 0, full 2,146/2,146, chain
  767/767, notices 0, source index unchanged, identity \`1e2c779c…\`.
- [ ] Remaining C-6: the rest of the script semantics.
`);

const evidence = {
  schema: 'W108ModelSwitchContextEvidence.v1',
  package: 'W108-01 — PostModelSwitch additional context',
  date: '2026-10-17',
  question: 'Where does the PostModelSwitch hook additionalContext go?',
  answer: 'The switch consumer stages additionalContexts per session and target model; the model-request loop drains entries whose target is the landed model, dedupes them and yields them as attachments before the next request. They are not injected again.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    schema: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', offset: 392672 },
    stage: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'sXr', offset: 2939454 },
    drain: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'gZo', offset: 2940920 },
    injection: { module: 'extracted-v2/modules/chunk-5b2hxy2e.js', offset: 139177 },
  },
  behavior: {
    event: 'PostModelSwitch',
    field: 'hookSpecificOutput.additionalContext',
    target: 'next model request',
    drainedOnce: true,
    landedModelFilter: true,
    deduped: true,
  },
  adaptations: [
    'The source waits for in-flight switch hooks; this runtime raises the event synchronously after the switch applies, so no wait exists.',
    'Failed hook output arrives as Hook context text rather than a typed attachment.',
    'The landed-model filter is vacuous because the event is only raised after a successful switch.',
  ],
  changes: [
    { file: 'src/agent.ts', change: 'pendingHookContext includes PostModelSwitch', sha256: sha(read('src/agent.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'one-shot injection assertion', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W108', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W108', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W108-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W108-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '46/46 (agent-lifecycle)',
    build: 'exit 0',
    full: '2,146/2,146',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '1e2c779cf1a69506d6033a4e1d4b509c4c4d2edb6a9a980550d1e9899db162fb',
  },
  residuals: [
    'The remaining C-6 script semantics are unconsumed.',
    'Successful hook stdout is not staged as hook_success content, only additionalContext.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with the remaining script semantics.',
};
write('research/ports/W108-modelswitch-context-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW108-01 consumes PostModelSwitch',
  'research/coding-standard.md': '\n2026-10-17 W108-01 ',
  'research/FEATURES.md': 'W108 stages the PostModelSwitch',
  'research/ports/W108-modelswitch-context.md': '# W108 — PostModelSwitch additional context',
  '.audit/w108-runtime.todo.md': '\n## W108-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
