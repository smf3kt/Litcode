// W101-01 record: expansion raise before every skill execution mode.
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

const note = `# W101 — expansion raise before every skill execution mode

## Source position

Both command entry points call \`at\` before resolving and running the skill:
the main command path (chunk-htgmc2p1.js call at 33172) and the stacked-skill
loop (call at 35257). \`at\` [38703,39841) raises UserPromptExpansion first and
returns early with the blocking warning when the hooks return a blocking error
or a continuation stop, so execution-mode commands (fork, background, model or
effort routing, hooks, allowed tools) are gated exactly like plain expansions.
\`Zge\` (chunk-sfn1dbxq.js offset 564884) includes \`UserPromptExpansion\` in the
exit-2 blocking set, and the command help text (chunk-5s0t90hn.js offset 3461)
states that exit 2 blocks the expansion.

## Port

The interactive slash-command branch raises \`UserPromptExpansion\` through
\`emitHook\` before \`runSkill\` whenever the skill requires execution. A blocked
verdict writes the recovered prefix \`UserPromptExpansion operation blocked by
hook: <reason>\`, reports \`hook_blocked\`, and skips the skill. Skills that fall
through to a model turn receive the hook's additional context through a new
optional \`Agent.run\` context parameter, so the event is raised exactly once per
command. \`UserPromptExpansion\` joins the blocking-event set.

## Adaptation

A skill that ends in its own fork, background or terminal result has no parent
model turn, so its hook additional context has no turn to join and is dropped;
the block verdict still gates execution. The plain expansion path keeps raising
the hook inside \`Agent.run\`, which owns the turn that consumes the context.

## Verification

\`interactive\` asserts one raise per command with the scope, that both a fork
and a command-bearing skill execute, that the fallthrough turn carries the hook
context, and that a blocked hook prevents \`runSkill\`. \`hooks\` adds
UserPromptExpansion to the exit-2 gating matrix. Focused 102/102, tsc 0, build
0, full 2,133/2,133, chain 767/767, notices 0, identity \`ef637462…\`.
`;
write('research/ports/W101-expansion-execution.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W101-01 raises UserPromptExpansion before every execution-mode skill, not just
plain expansions. The interactive branch calls the hook before \`runSkill\`, a
blocked verdict prevents the run and reports \`hook_blocked\`, and the hook's
additional context reaches fallthrough turns through a new optional
\`Agent.run\` context parameter. UserPromptExpansion is now in the exit-2
blocking set. Focused 102/102, tsc 0, build 0, full 2,133/2,133, chain
767/767, identity \`ef637462…\`.
[W101 record](ports/W101-expansion-execution.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W101-01 执行型技能的 UserPromptExpansion：S-1（先读源）：读取 at [38703,39841)、两个调用点 33172/35257（chunk-htgmc2p1.js）、Zge 564884、帮助文本 3461（chunk-5s0t90hn.js）。S-2（不臆造）：命令输入即提升钩子，先于任何执行模式；阻断即不执行并报 hook_blocked；exit 2 属阻断集。S-3（边界）：纯展开路径仍由 Agent.run 提升以消费上下文；自带 fork/background/终态的技能无父回合，附加上下文丢弃但阻断仍生效（记录为残余）。S-4（可测）：interactive 断言每命令一次、两种执行路径、上下文到达 fallthrough 回合、阻断时不执行；hooks 把关卡加入 exit-2 矩阵。S-5/S-6：Agent.run 增可选 hookContext 参数；无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：聚焦 102/102、tsc 0、build 0、全量 2,133/2,133、链 767/767、身份 ef637462…。
`);

replaceOnce('research/FEATURES.md',
  'W100 removes the invented `updatedPrompt` rewrite (the recovered consumer reads only blocking, continuation stop, additional context and messages) |',
  'W100 removes the invented `updatedPrompt` rewrite (the recovered consumer reads only blocking, continuation stop, additional context and messages); W101 raises UserPromptExpansion before every execution-mode skill, lets exit 2 block the run, and carries the hook context into fallthrough turns |');

replaceAll('research/CURRENT.md',
  'W100删除臆造的updatedPrompt改写（恢复的消费者只读阻断、继续停止、附加上下文与消息）；完整消费者',
  'W100删除臆造的updatedPrompt改写（恢复的消费者只读阻断、继续停止、附加上下文与消息）；W101在执行型技能（fork/background/model/effort/hooks/allowedTools）运行前提升UserPromptExpansion，exit 2阻断执行，fallthrough回合携带钩子上下文；完整消费者', 3);

const tsv = [
  ['2026-10-18T11:00:00Z', 'package', 'W101-01 执行型技能的 UserPromptExpansion',
    'at [38703,39841)、调用点 33172/35257、Zge 564884、帮助文本 3461',
    '命令输入即提升；阻断先于执行；fallthrough 上下文经 Agent.run hookContext',
    'interactive/hooks/agent-lifecycle 102/102；tsc 0；build 0；全量 2,133/2,133；链 767/767'],
  ['2026-10-18T11:03:00Z', 'decision', 'W101-01 边界',
    '自带 fork/background/终态的技能没有父模型回合，附加上下文无处落地',
    '阻断仍生效；上下文丢弃记录为残余，不发明注入机制',
    '.audit/w101-01-full.txt'],
  ['2026-10-18T11:06:00Z', 'verification', 'W101-01 验收：聚焦 102/102、tsc 0、build 0、2,133/2,133、767/767',
    '每命令一次提升；两种执行路径均运行；阻断时不调用 runSkill；上下文进入模型请求',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity ef637462…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w101-runtime.tsv', tsv + '\n');

write('.audit/w101-runtime.todo.md', `# W101 runtime trail

## W101-01 acceptance (2026-10-18)

- [x] **Source read.** Both \`at\` call sites, the consumer, the blocking set and
  the help text.
- [x] **Port.** Pre-execution raise, block handling, fallthrough context, exit-2
  membership.
- [x] **Bounds.** Early-terminal skills drop the context because they have no
  parent turn; the block still applies.
- [x] **Gates.** focused 102/102, tsc 0, build 0, full 2,133/2,133, chain
  767/767, notices 0, source index unchanged, identity \`ef637462…\`.
- [ ] Remaining C-6: full consumers and the remaining script semantics.
`);

const evidence = {
  schema: 'W101ExpansionExecutionEvidence.v1',
  package: 'W101-01 — expansion raise before every skill execution mode',
  date: '2026-10-18',
  question: 'When is UserPromptExpansion raised relative to a skill run, and does its verdict gate execution-mode skills?',
  answer: 'Both command entry points raise it before resolving and running the skill; a blocking verdict returns early, so fork, background and other execution-mode skills never run. Exit 2 is in the blocking set.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    consumer: { module: 'extracted-v2/modules/chunk-htgmc2p1.js', symbol: 'at', range: [38703, 39841] },
    mainCall: { module: 'extracted-v2/modules/chunk-htgmc2p1.js', offset: 33172 },
    stackedCall: { module: 'extracted-v2/modules/chunk-htgmc2p1.js', offset: 35257 },
    blockingSet: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'Zge', offset: 564884 },
    helpText: { module: 'extracted-v2/modules/chunk-5s0t90hn.js', offset: 3461 },
  },
  behavior: {
    blocking: 'exit 2 and blockingError prevent execution',
    context: 'additionalContexts join the command turn when a parent model turn exists',
    oncePerCommand: true,
  },
  adaptations: [
    'Early-terminal execution skills have no parent turn; their hook context is dropped while the block still gates.',
    'The plain expansion path keeps raising inside Agent.run, which owns the turn.',
  ],
  changes: [
    { file: 'src/interactive.ts', change: 'pre-execution raise, block and context pass-through', sha256: sha(read('src/interactive.ts')) },
    { file: 'src/agent.ts', change: 'optional hookContext parameter', sha256: sha(read('src/agent.ts')) },
    { file: 'src/hooks.ts', change: 'UserPromptExpansion in the blocking set', sha256: sha(read('src/hooks.ts')) },
    { file: 'test/interactive.test.ts', change: 'raise-once, context and block tests', sha256: sha(read('test/interactive.test.ts')) },
    { file: 'test/hooks.test.ts', change: 'exit-2 matrix entry', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W101', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W101', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W101-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W101-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '102/102 (interactive, hooks, agent-lifecycle)',
    build: 'exit 0',
    full: '2,133/2,133',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'ef63746264382a483ec07b65d067fc4344c9cbe0a791892f374640957b662bcd',
  },
  residuals: [
    'Execution skills that produce their own terminal result drop the hook additional context because the parent has no model turn.',
    'UserPromptExpansion previously raised after execution for command-bearing fallthrough skills; now it is raised once before execution.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with full consumers and the remaining script semantics.',
};
write('research/ports/W101-expansion-execution-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW101-01 raises UserPromptExpansion',
  'research/coding-standard.md': '\n2026-10-18 W101-01 ',
  'research/FEATURES.md': 'W101 raises UserPromptExpansion before every execution-mode skill',
  'research/ports/W101-expansion-execution.md': '# W101 — expansion raise before every skill execution mode',
  '.audit/w101-runtime.todo.md': '\n## W101-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
