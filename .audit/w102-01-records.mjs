// W102-01 record: SessionStart and UserPromptSubmit session titles.
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

const note = `# W102 — SessionStart and UserPromptSubmit session titles

## Source position

The hook output schemas carry \`sessionTitle\` on exactly two events:
UserPromptSubmit (chunk-n3ykh62m.js offset 391440) and SessionStart
(offset 391966). The consumers take the last provided title:
UserPromptSubmit stores it in \`n\` (chunk-ksjypbtc.js offset 5177) and commits
\`u = m.sessionTitle ?? u\`; SessionStart stores \`Ve\` and sets
\`pendingHookSessionTitle\` only when the start source is startup, resume or
fork (chunk-sfn1dbxq.js offset 2478978), so clear and compact starts ignore it.

The title setter \`$vt\` (chunk-sfn1dbxq.js offset 4658579) normalizes through
\`ci\` (chunk-r2vtj1kh.js offset 663011): trim, \`Rn\` replaces each
control/format/U+2028/U+2029 run with a space (chunk-gyf58rwf.js offset 11680),
\`wW\` strips the remaining C0/C1 controls and keeps the first \`AP\` = 200 code
points (chunk-64ag51qf.js offset 2304), then trims again. A title equal to the
current one is not recorded.

## Port

\`HookResult\` gains \`sessionTitle\`, parsed only from those two events' outputs.
\`normalizeSessionTitle\` ports \`ci\` exactly. \`Agent.startSession\` records a
\`title\` event for the startup, resume and fork sources when the normalized
title is non-empty and differs from the current one; \`Agent.run\` records it
from UserPromptSubmit before the turn. The session list and the UserPromptSubmit
payload's \`session_title\` then read the recorded title.

## Adaptation

The local session schema bounds titles at 200 UTF-16 units, so a title whose
first 200 code points exceed 200 units (all astral characters) is cut once more
without splitting a surrogate pair. The source's own storage limit is code
points.

## Verification

\`hooks\` asserts the field is parsed for both events and ignored elsewhere, and
covers normalization of controls, U+2028, the 200 cap, and astral input.
\`agent-lifecycle\` records the SessionStart title, records the UserPromptSubmit
title, exposes it through the session list, and proves a clear start ignores it.
Focused 94/94, tsc 0, build 0, full 2,136/2,136, chain 767/767, notices 0,
identity \`6c6de060…\`.
`;
write('research/ports/W102-session-title.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W102-01 consumes the hook-provided session title. SessionStart records it only
for startup, resume and fork sources, UserPromptSubmit records it before the
turn, and both normalize through the recovered \`ci\` helper (control/format
runs become a space, 200 code points, trimmed). The session list and later
UserPromptSubmit payloads now read the recorded title. Focused 94/94, tsc 0,
build 0, full 2,136/2,136, chain 767/767, identity \`6c6de060…\`.
[W102 record](ports/W102-session-title.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W102-01 SessionStart/UserPromptSubmit 会话标题：S-1（先读源）：读取输出 schema 391440/391966（chunk-n3ykh62m.js）、提交消费者 5177（chunk-ksjypbtc.js）、startup/resume/fork 门 2478978、设置器 4658579、ci 663011/wW 662926（chunk-r2vtj1kh.js）、Rn 11680（chunk-gyf58rwf.js）、AP=200 2304（chunk-64ag51qf.js）。S-2（不臆造）：两端各取最后一个标题；clear 起始忽略；规范化按 ci；与当前标题相同则不写。S-3（边界）：本地存储限 200 UTF-16 单位，星体字符标题会再截一次且不拆代理对（记录为本地适配），源限制为码点。S-4（可测）：hooks 断言两事件解析、他事件忽略与规范化边界；agent-lifecycle 断言两来源写入、会话列表可见、clear 不写。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：聚焦 94/94、tsc 0、build 0、全量 2,136/2,136、链 767/767、身份 6c6de060…。
`);

replaceOnce('research/FEATURES.md',
  'and carries the hook context into fallthrough turns |',
  'and carries the hook context into fallthrough turns; W102 consumes the SessionStart (startup/resume/fork only) and UserPromptSubmit `sessionTitle` outputs through the recovered `ci` normalization and records them as session titles |');

replaceAll('research/CURRENT.md',
  'fallthrough回合携带钩子上下文；完整消费者',
  'fallthrough回合携带钩子上下文；W102消费SessionStart（仅startup/resume/fork）与UserPromptSubmit的sessionTitle输出，按ci规范化并记录为会话标题；完整消费者', 3);

const tsv = [
  ['2026-10-18T12:00:00Z', 'package', 'W102-01 会话标题消费者',
    'schema 391440/391966、提交消费者 5177、起始门 2478978、设置器 4658579、ci 663011、Rn 11680、AP 2304',
    'sessionTitle 仅两事件解析；ci 规范化；clear 忽略；相同不重复写',
    'hooks/agent-lifecycle 94/94；tsc 0；build 0；全量 2,136/2,136；链 767/767'],
  ['2026-10-18T12:03:00Z', 'decision', 'W102-01 本地适配',
    '会话 schema 限 200 UTF-16 单位，源按 200 码点',
    '星体标题再截一次且不拆代理对',
    '.audit/w102-01-full.txt'],
  ['2026-10-18T12:06:00Z', 'verification', 'W102-01 验收：聚焦 94/94、tsc 0、build 0、2,136/2,136、767/767',
    '两来源写入 title 事件；会话列表读取；clear 起始不写；控制字符/U+2028 规范化为空格',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 6c6de060…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w102-runtime.tsv', tsv + '\n');

write('.audit/w102-runtime.todo.md', `# W102 runtime trail

## W102-01 acceptance (2026-10-18)

- [x] **Source read.** Both output schemas, both consumers, the start-source
  gate, the setter and the normalizer chain.
- [x] **Port.** Field parse, \`normalizeSessionTitle\`, title events from both
  events.
- [x] **Bounds.** Local storage caps at 200 UTF-16 units; astral titles are cut
  once more.
- [x] **Gates.** focused 94/94, tsc 0, build 0, full 2,136/2,136, chain
  767/767, notices 0, source index unchanged, identity \`6c6de060…\`.
- [ ] Remaining C-6: \`initialUserMessage\` and \`reloadSkills\`, plus the rest of
  the script semantics.
`);

const evidence = {
  schema: 'W102SessionTitleEvidence.v1',
  package: 'W102-01 — SessionStart and UserPromptSubmit session titles',
  date: '2026-10-18',
  question: 'Which hook events can set the session title, when is the value recorded, and how is it normalized?',
  answer: 'Only SessionStart and UserPromptSubmit outputs carry sessionTitle. SessionStart records it for startup, resume and fork starts; UserPromptSubmit records it before the turn. Both normalize through ci (control/format runs to a space, 200 code points, trimmed) and skip an unchanged value.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    submitSchema: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', offset: 391440 },
    startSchema: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', offset: 391966 },
    submitConsumer: { module: 'extracted-v2/modules/chunk-ksjypbtc.js', offset: 5177 },
    startGate: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 2478978 },
    setter: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: '$vt', offset: 4658579 },
    normalizer: { module: 'extracted-v2/modules/chunk-r2vtj1kh.js', symbol: 'ci', range: [663011, 663057] },
    controlReplacer: { module: 'extracted-v2/modules/chunk-gyf58rwf.js', symbol: 'Rn', offset: 11680 },
    limit: { module: 'extracted-v2/modules/chunk-64ag51qf.js', symbol: 'AP', offset: 2304, value: 200 },
  },
  behavior: {
    events: ['SessionStart', 'UserPromptSubmit'],
    startSources: ['startup', 'resume', 'fork'],
    lastTitleWins: true,
    unchangedSkipped: true,
  },
  adaptations: [
    'Local session storage bounds titles at 200 UTF-16 units, so astral-heavy titles are cut once more without splitting a surrogate.',
    'SessionStart title handling happens in Agent.startSession (the product has no separate pending-title store).',
  ],
  changes: [
    { file: 'src/hooks.ts', change: 'field parse and normalizeSessionTitle', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/agent.ts', change: 'title events from SessionStart and UserPromptSubmit', sha256: sha(read('src/agent.ts')) },
    { file: 'test/hooks.test.ts', change: 'parse, ignore and normalization tests', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'title recording and clear gate tests', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W102', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W102', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W102-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W102-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '94/94 (hooks, agent-lifecycle)',
    build: 'exit 0',
    full: '2,136/2,136',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '6c6de0605a596fb45ed469d5539761a68d56ca35602ddbbb540af456477de193',
  },
  residuals: [
    'initialUserMessage and reloadSkills SessionStart outputs remain unconsumed.',
    'SessionStart titles are applied directly in startSession; the source stages a pending value that the command loop drains.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with initialUserMessage, reloadSkills and the remaining script semantics.',
};
write('research/ports/W102-session-title-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW102-01 consumes the hook-provided session title',
  'research/coding-standard.md': '\n2026-10-18 W102-01 ',
  'research/FEATURES.md': 'W102 consumes the SessionStart',
  'research/ports/W102-session-title.md': '# W102 — SessionStart and UserPromptSubmit session titles',
  '.audit/w102-runtime.todo.md': '\n## W102-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
