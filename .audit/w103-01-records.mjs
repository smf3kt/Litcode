// W103-01 record: SessionStart initialUserMessage.
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

const note = `# W103 — SessionStart initialUserMessage

## Source position

\`initialUserMessage\` is a SessionStart output field (chunk-n3ykh62m.js offset
391966). The hook loop stages every truthy value on the session app state and
lets the last hook win (\`H7\`, chunk-sfn1dbxq.js offset 2482643); it ignores the
field from plugins loaded after session start (\`newPluginsOnly\`) and stores it
as \`lateInitialUserMessage\` when the hooks were overtaken. The headless
prologue drains the staged value with \`OXr()\` (chunk-sfn1dbxq.js offset
2480020) and calls \`ie.prependUserMessage(Js)\` (chunk-rx2nah4x.js offset
472137); the claim path does the same for overdue hook output (offset 584530,
late delivery at offset 378598). \`prependUserMessage\` pushes a user line ahead
of the input stream, so the value becomes the first queued user turn, not part
of an unfinished turn.

## Port

\`HookResult\` gains \`initialUserMessage\`, parsed only from SessionStart output
with an empty string ignored. \`Agent.startSession\` returns
\`{ initialUserMessage? }\` instead of writing it into the transcript: a stored
lone user message would make \`Session.awaitingResponse\` true and the next
\`run()\` would refuse with "unfinished turn". The front ends queue the value at
the same point as the recovered prologue: the headless CLI runs it as the first
turn before the typed prompt, the interactive loop pushes it ahead of typed or
piped input at startup, and clear/fork restarts unshift it onto the queue.

## Adaptation

The source stages the value in shared app state that its prologue drains; this
runtime has no such store, so \`startSession\` hands the value back to the caller
that owns the input queue. Mid-session resume starts (configuration change,
branch switch, resume in place) do not drain it, matching the source, whose
\`OXr\` drain exists only in the prologue and claim paths. Overdue-hook delivery
(\`lateInitialUserMessage\`) and the post-start plugin warning are not
applicable: \`startSession\` awaits every hook synchronously and this path has no
post-start plugin discovery.

## Verification

\`hooks\` asserts last-wins parsing, the empty-string skip, and that
UserPromptSubmit is ignored. \`agent-lifecycle\` asserts the return value, that
no message event is stored, and that \`awaitingResponse\` stays false before and
after the first turn. \`interactive\` asserts the hook message reaches the first
request ahead of typed input. Focused 107/107, tsc 0, build 0, full
2,138/2,138, chain 767/767, notices 0, identity \`b4860f22…\`.
`;
write('research/ports/W103-initial-message.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W103-01 consumes the SessionStart \`initialUserMessage\`. The last non-empty
value is returned by \`startSession\` and queued by the front end as the session's
first user turn: headless runs it before the typed prompt, interactive puts it
ahead of typed or piped input, and clear/fork restarts unshift it. It is never
stored as a lone message event, so the first \`run()\` is not blocked by an
unfinished turn. Focused 107/107, tsc 0, build 0, full 2,138/2,138, chain
767/767, identity \`b4860f22…\`.
[W103 record](ports/W103-initial-message.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W103-01 SessionStart initialUserMessage：S-1（先读源）：输出 schema 391966（chunk-n3ykh62m.js）、暂存与 last-wins 2482643、newPluginsOnly 忽略同处、排空 OXr 2480020（chunk-sfn1dbxq.js）、headless prepend 472137 与 claim 584530、late 378598（chunk-rx2nah4x.js）。S-2（不臆造）：仅 SessionStart 解析；空串忽略；最后一个真值生效；不把消息写成单独 message 事件，否则 awaitingResponse 会阻止首个 run。S-3（边界）：本运行时无共享暂存器，startSession 返回值交前端入队；中途 resume（配置变更、分支切换）不排空，与源的 prologue/claim 排空点一致；overdue/late 与插件后载入警告不适用。S-4（可测）：hooks 断言 last-wins、空串跳过、UserPromptSubmit 忽略；agent-lifecycle 断言返回值、无 message 事件、awaitingResponse 为 false；interactive 断言首请求先见钩子消息。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：聚焦 107/107、tsc 0、build 0、全量 2,138/2,138、链 767/767、身份 b4860f22…。
`);

replaceOnce('research/FEATURES.md',
  'records them as session titles |',
  'records them as session titles; W103 returns the SessionStart `initialUserMessage` (last non-empty wins) for the front end to queue ahead of typed input |');

replaceAll('research/CURRENT.md',
  '按ci规范化并记录为会话标题；完整消费者',
  '按ci规范化并记录为会话标题；W103交付SessionStart的initialUserMessage（最后一个非空值，由前端入队为首个用户轮次）；完整消费者', 3);

const tsv = [
  ['2026-10-18T12:10:00Z', 'package', 'W103-01 SessionStart initialUserMessage',
    'schema 391966、暂存 2482643、排空 2480020、prepend 472137/584530、late 378598',
    '仅SessionStart解析；空串忽略；last-wins；以首个用户轮次入队而非单独message',
    'hooks/agent-lifecycle/interactive 107/107；tsc 0；build 0；全量 2,138/2,138；链 767/767'],
  ['2026-10-18T12:13:00Z', 'decision', 'W103-01 本地适配',
    '本运行时没有源中的共享暂存器；startSession 将值返回给持有输入队列的前端',
    '写入独立 message 事件会置 awaitingResponse=true 并阻止首个 run',
    '.audit/w103-01-full.txt'],
  ['2026-10-18T12:16:00Z', 'verification', 'W103-01 验收：聚焦 107/107、tsc 0、build 0、2,138/2,138、767/767',
    'headless 先运行钩子消息；interactive 置于输入之前；clear/fork 入队；中途 resume 不排空',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity b4860f22…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w103-runtime.tsv', tsv + '\n');

write('.audit/w103-runtime.todo.md', `# W103 runtime trail

## W103-01 acceptance (2026-10-18)

- [x] **Source read.** Output schema, staging loop, drain, both prepend call
  sites and the late-delivery path.
- [x] **Port.** SessionStart-only parse with last-wins and empty-string skip;
  \`startSession\` returns the value.
- [x] **Queueing.** Headless first turn, interactive startup and clear/fork
  restarts; no lone message event, \`awaitingResponse\` unchanged.
- [x] **Gates.** focused 107/107, tsc 0, build 0, full 2,138/2,138, chain
  767/767, notices 0, source index unchanged, identity \`b4860f22…\`.
- [ ] Remaining C-6: \`reloadSkills\` and the rest of the script semantics.
`);

const evidence = {
  schema: 'W103InitialUserMessageEvidence.v1',
  package: 'W103-01 — SessionStart initialUserMessage',
  date: '2026-10-18',
  question: 'What does the SessionStart initialUserMessage output do, and how can a front end deliver it without blocking the first turn?',
  answer: 'The hook loop stages the last truthy initialUserMessage; the headless prologue and claim path drain it and prepend it to the user input queue, making it the first queued user turn. This runtime returns the value from startSession and each front end queues it at the same point; it is never stored as a lone message event.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    schema: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', offset: 391966 },
    stageAndLastWins: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 2482643 },
    drain: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'OXr', offset: 2480020 },
    headlessPrepend: { module: 'extracted-v2/modules/chunk-rx2nah4x.js', offset: 472137 },
    claimPrepend: { module: 'extracted-v2/modules/chunk-rx2nah4x.js', offset: 584530 },
    lateDelivery: { module: 'extracted-v2/modules/chunk-rx2nah4x.js', offset: 378598 },
  },
  behavior: {
    events: ['SessionStart'],
    lastTruthyWins: true,
    emptyIgnored: true,
    delivery: 'prepended user turn',
    ignoredForLatePlugins: true,
    drainSites: ['headless prologue', 'claim path'],
  },
  adaptations: [
    'Local startSession returns the value; the front end that owns the input queue performs the prepend, because this runtime has no shared app-state pending slot.',
    'A lone message event would set awaitingResponse and block the next run(), so the value is queued as a turn by the caller instead.',
    'Mid-session resume starts do not drain it, matching the source drain points; overdue-hook late delivery and newPluginsOnly warnings are not applicable here.',
  ],
  changes: [
    { file: 'src/hooks.ts', change: 'SessionStart-only parse with last-wins', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/agent.ts', change: 'startSession returns initialUserMessage', sha256: sha(read('src/agent.ts')) },
    { file: 'src/interactive.ts', change: 'startup and clear/fork queueing', sha256: sha(read('src/interactive.ts')) },
    { file: 'src/cli.ts', change: 'headless first turn and interactive handoff', sha256: sha(read('src/cli.ts')) },
    { file: 'test/hooks.test.ts', change: 'parse, skip and ignore assertions', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'return value and transcript assertions', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'test/interactive.test.ts', change: 'queue-ahead assertion', sha256: sha(read('test/interactive.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W103', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W103', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W103-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W103-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '107/107 (hooks, agent-lifecycle, interactive)',
    build: 'exit 0',
    full: '2,138/2,138',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'b4860f2258c8eb0a01cb36d70f14c780ab58b12bbcdcb8b28935c5ab7a7cc373',
  },
  residuals: [
    'reloadSkills SessionStart output remains unconsumed.',
    'Overdue-hook late initial messages are not modeled because startSession awaits hooks synchronously.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with reloadSkills and the remaining script semantics.',
};
write('research/ports/W103-initial-message-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW103-01 consumes the SessionStart',
  'research/coding-standard.md': '\n2026-10-18 W103-01 ',
  'research/FEATURES.md': 'W103 returns the SessionStart',
  'research/ports/W103-initial-message.md': '# W103 — SessionStart initialUserMessage',
  '.audit/w103-runtime.todo.md': '\n## W103-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
