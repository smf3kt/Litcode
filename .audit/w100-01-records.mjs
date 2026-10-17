// W100-01 record: remove the invented updatedPrompt rewrite.
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

const note = `# W100 — remove the invented updatedPrompt rewrite

## Source position

The only UserPromptExpansion consumer, \`at\` (chunk-htgmc2p1.js
[38703,39841)), reads four results: \`blockingError\` (terminal block),
\`preventContinuation\` (terminal stop), \`additionalContexts\` (context blocks)
and \`message\` (messages to append). The command help text
(chunk-5s0t90hn.js offset 3461) documents the same contract: exit code 2 blocks
the expansion and stderr is shown; exit code 0 stdout is shown to Claude.

\`updatedPrompt\` does not occur anywhere in the extracted modules (0 matches
across every chunk), while the fields that do exist — \`updatedInput\`,
\`updatedPermissions\`, \`updatedToolOutput\` — each appear dozens of times. The
product carried a field mapping that rewrote the submitted or expanded prompt
from hook JSON; that behavior was invented and contradicted the recovered
consumer.

## Port

Remove \`HookResult.updatedPrompt\`, its \`hookSpecificOutput\` parse branch, and
both consumer assignments in \`Agent.run\`. Blocking and additional context are
unchanged. A hook output that names \`updatedPrompt\` is retained as an opaque
\`hookSpecificOutput\` entry and has no effect on the prompt.

## Verification

\`hooks\` asserts the parsed result has no \`updatedPrompt\` even when the output
names it. \`agent-lifecycle\` asserts the model sees the expanded prompt text and
not the fixture's rewritten text, while the additional context still arrives.
Focused 103/103, tsc 0, build 0, full 2,131/2,131, chain 767/767, notices 0,
identity \`f4fc4704…\`.
`;
write('research/ports/W100-no-prompt-rewrite.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W100-01 removes the invented \`updatedPrompt\` hook field. The recovered
expansion consumer reads only blocking verdicts, continuation stops, additional
context and messages, and the string \`updatedPrompt\` does not occur anywhere in
the extracted modules. The submitted and expanded prompt are now authoritative;
a hook output naming that field is kept opaque and ignored. Focused 103/103,
tsc 0, build 0, full 2,131/2,131, chain 767/767, identity \`f4fc4704…\`.
[W100 record](ports/W100-no-prompt-rewrite.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W100-01 删除臆造的 updatedPrompt：S-1（先读源）：读取唯一消费者 at [38703,39841)（chunk-htgmc2p1.js）与帮助文本 3461（chunk-5s0t90hn.js）；对 extracted-v2 全量检索 updatedPrompt 为 0 次，而 updatedInput/updatedPermissions/updatedToolOutput 均存在。S-2（不臆造）：删除 HookResult 字段、解析分支与 Agent 两处改写；阻断与附加上下文保留；命名该字段的输出仅作为不透明 hookSpecificOutput 保留。S-3（边界）：UserPromptSubmit 与 UserPromptExpansion 两个消费者同步。S-4（可测）：hooks 断言解析结果无该字段；agent-lifecycle 断言模型看到展开正文而非改写文本且上下文仍到达。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：聚焦 103/103、tsc 0、build 0、全量 2,131/2,131、链 767/767、身份 f4fc4704…。
`);

replaceOnce('research/FEATURES.md',
  "and omits the optional key when no scope is known |",
  "and omits the optional key when no scope is known; W100 removes the invented `updatedPrompt` rewrite (the recovered consumer reads only blocking, continuation stop, additional context and messages) |");

replaceAll('research/CURRENT.md',
  '省略时键不存在）；完整消费者',
  '省略时键不存在）；W100删除臆造的updatedPrompt改写（恢复的消费者只读阻断、继续停止、附加上下文与消息）；完整消费者', 3);

const tsv = [
  ['2026-10-18T10:00:00Z', 'package', 'W100-01 删除臆造的 updatedPrompt 改写',
    'at [38703,39841) 唯一的 UserPromptExpansion 消费者；帮助文本 3461；全量检索 0 次',
    '移除 HookResult.updatedPrompt、解析分支与两处 Agent 改写；阻断/上下文保留',
    'hooks/agent-lifecycle/attachments/interactive 103/103；tsc 0；build 0；全量 2,131/2,131；链 767/767'],
  ['2026-10-18T10:03:00Z', 'decision', 'W100-01 证据',
    'updatedInput/updatedPermissions/updatedToolOutput 在源码中存在，updatedPrompt 不存在，说明该字段并非压缩改名',
    '命名该字段的输出作为不透明 hookSpecificOutput 保留，不生效',
    '.audit/w100-01-full.txt'],
  ['2026-10-18T10:06:00Z', 'verification', 'W100-01 验收：聚焦 103/103、tsc 0、build 0、2,131/2,131、767/767',
    '模型看到展开正文而非改写文本；附加上下文仍到达；无字段解析残留',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity f4fc4704…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w100-runtime.tsv', tsv + '\n');

write('.audit/w100-runtime.todo.md', `# W100 runtime trail

## W100-01 acceptance (2026-10-18)

- [x] **Source read.** The only expansion consumer and the command help text.
- [x] **Absence proof.** \`updatedPrompt\` occurs zero times in the extracted
  modules; the fields that exist occur repeatedly.
- [x] **Port.** Field, parse branch and both assignments removed; blocking and
  additional context kept.
- [x] **Gates.** focused 103/103, tsc 0, build 0, full 2,131/2,131, chain
  767/767, notices 0, source index unchanged, identity \`f4fc4704…\`.
- [ ] Remaining C-6: full consumers and the fork-skill expansion path.
`);

const evidence = {
  schema: 'W100PromptRewriteEvidence.v1',
  package: 'W100-01 — remove the invented updatedPrompt rewrite',
  date: '2026-10-18',
  question: 'Does the recovered UserPromptExpansion consumer rewrite the prompt from hook JSON?',
  answer: 'No. The only consumer reads blockingError, preventContinuation, additionalContexts and message. updatedPrompt has zero occurrences in the extracted modules.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    consumer: { module: 'extracted-v2/modules/chunk-htgmc2p1.js', symbol: 'at', range: [38703, 39841] },
    helpText: { module: 'extracted-v2/modules/chunk-5s0t90hn.js', offset: 3461 },
  },
  search: {
    updatedPrompt: 0,
    updatedInput: 'present',
    updatedPermissions: 'present',
    updatedToolOutput: 40,
  },
  changes: [
    { file: 'src/hooks.ts', change: 'field and parse branch removed', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/agent.ts', change: 'both rewrite assignments removed', sha256: sha(read('src/agent.ts')) },
    { file: 'test/hooks.test.ts', change: 'asserts the field is ignored', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'prompt stays authoritative', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W100', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W100', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W100-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W100-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '103/103 (hooks, agent-lifecycle, attachments, interactive)',
    build: 'exit 0',
    full: '2,131/2,131',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'f4fc470443a8f33e97bcfcc33e371b9ecb754a98d192429c57acff76cf0bafad',
  },
  residuals: [
    'Terminal stop messages use the product wording rather than the source stop-reason template.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with the fork-skill expansion raise and full consumers.',
};
write('research/ports/W100-no-prompt-rewrite-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW100-01 removes the invented',
  'research/coding-standard.md': '\n2026-10-18 W100-01 ',
  'research/FEATURES.md': 'W100 removes the invented `updatedPrompt`',
  'research/ports/W100-no-prompt-rewrite.md': '# W100 — remove the invented updatedPrompt rewrite',
  '.audit/w100-runtime.todo.md': '\n## W100-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
