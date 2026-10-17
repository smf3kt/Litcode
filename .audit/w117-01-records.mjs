// W117-01 record: PermissionRequest deny interrupt.
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

const note = `# W117 — PermissionRequest deny interrupt

## Source position

A PermissionRequest answer's deny arm carries \`{message?, interrupt?}\`
(chunk-n3ykh62m.js offsets 395544-395771; the same arm in the classic answer
schema). The normalizer keeps \`interrupt\` only when it is exactly \`true\`
(\`J_t\`, chunk-sfn1dbxq.js offset 556404). The answer fold returns at the first
non-allow hook, so only that hook's \`interrupt\` reaches the consumer (\`n2e\`,
chunk-fyhzvvp0.js offset 15469). The consumer logs
\`Hook interrupt: tool=<name> hookMessage=<message>\` and aborts the turn's
controller (chunk-rx2nah4x.js offset 660951; the subagent path does the same at
chunk-fk088dyb.js offset 89113). The denial itself still returns as the tool
result.

## Port

\`runHooks\` records \`HookResult.interrupt\` only from the adopted denying
decision. \`authorize\` combines it with the classic chain answer's
\`permissionRequestResult.interrupt\`, writes the source's log line to the status
stream, and calls the new \`AgentEvents.interruptTurn\` before returning the
denial. The interactive loop aborts its own turn controller there; the headless
CLI and background registry children abort their owned controllers. The turn
then finishes as \`aborted\`, the denied batch is recorded, and post hooks are
skipped because the signal is already aborted.

## Adaptation

The status line is user-visible where the source writes it to its log. Two
Agent owners receive only a signal and own no controller (the foreground
subagent runner and the skill-fork runner), so they do not abort; their denial
still blocks and the process keeps a recordable turn. The product has no
per-hook outcome record beyond the adopted interrupt flag.

## Verification

\`hooks\` asserts adoption, the later-deny refusal and the allow arm.
\`agent-lifecycle\` asserts the abort, the logged interrupt and the skipped tool.
\`plugin-chain-permission\` asserts the classic answer arm aborts the same way.
Focused 214/214, tsc 0, build 0, full 2,162/2,162, chain 768/768,
identity \`1c73f452…\`.
`;
write('research/ports/W117-permission-interrupt.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W117-01 consumes PermissionRequest's deny \`interrupt\`. The adopted denying hook
(regular or classic chain) logs \`Hook interrupt: tool=… hookMessage=…\` and
aborts the turn's owned controller; the denial is still the tool result and the
turn finishes aborted before any post hook. Focused 214/214, tsc 0, build 0,
full 2,162/2,162, chain 768/768, identity \`1c73f452…\`.
[W117 record](ports/W117-permission-interrupt.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W117-01 PermissionRequest中断：S-1（先读源）：deny schema 395544-395771（chunk-n3ykh62m.js）、J_t 556404（chunk-sfn1dbxq.js）、n2e 15469（chunk-fyhzvvp0.js）、消费者660951（chunk-rx2nah4x.js）/89113（chunk-fk088dyb.js）。S-2（不臆造）：仅采纳的首个非allow决定携带interrupt；interrupt===true；阻断结果仍作为工具结果；随后中止回合。S-3（边界）：状态行为本地可见；前台子代理与技能fork仅持signal无controller，不中止；无逐钩子结果记录。S-4（可测）：hooks断言采纳/拒绝后续interrupt/allow；agent-lifecycle断言中止与日志；plugin-chain-permission断言classic臂。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据JSON。验证：聚焦214/214、tsc 0、build 0、全量2,162/2,162、链768/768、notices 0、索引不变、身份1c73f452…。
`);

replaceOnce('research/FEATURES.md',
  'W116 raises DirectoryAdded as a documented slash_command hook on relocation and displays its failed output |',
  'W116 raises DirectoryAdded as a documented slash_command hook on relocation and displays its failed output; W117 consumes PermissionRequest deny interrupt by aborting the turn controller |');

replaceAll('research/CURRENT.md',
  '；W116以文档slash_command生产者提升DirectoryAdded并显示失败输出（本地无/add-dir与register_repo_root）；完整消费者与脚本语义仍待处理',
  '；W116以文档slash_command生产者提升DirectoryAdded并显示失败输出（本地无/add-dir与register_repo_root）；W117消费PermissionRequest拒绝的interrupt（首个非allow决定，日志后中止回合controller）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-17T23:45:00Z', 'package', 'W117-01 PermissionRequest deny interrupt',
    'deny schema 395544-395771（chunk-n3ykh62m.js）、J_t 556404、n2e 15469（chunk-fyhzvvp0.js）、660951/89113消费者',
    '仅采纳决定携带interrupt；仅===true；拒绝结果保留；中止回合controller',
    'hooks/agent-lifecycle/interactive/plugin-chain-permission等 214/214；tsc 0；build 0；全量 2,162/2,162；链 768/768'],
  ['2026-10-17T23:47:00Z', 'decision', 'W117-01 本地适配',
    'interactive/cli/registry子代理拥有controller；前台子代理与技能fork仅有signal；状态行为用户可见',
    '无controller的路径只阻断不中止',
    '.audit/w117-01-full.txt'],
  ['2026-10-17T23:49:00Z', 'verification', 'W117-01 验收：聚焦214/214、tsc 0、build 0、2,162/2,162、768/768',
    '常规钩子与classic链均可中止；工具未执行；日志匹配源格式',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 1c73f452…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w117-runtime.tsv', tsv + '\n');

write('.audit/w117-runtime.todo.md', `# W117 runtime trail

## W117-01 acceptance (2026-10-17)

- [x] **Source read.** The deny arm schema, the normalizer, the first-result
  fold and both consumers.
- [x] **Port.** HookResult.interrupt, the authorize log/abort, the interactive,
  headless and registry-owned controllers.
- [x] **Bounds.** Only the adopted decision; only \`=== true\`; the denial stays
  the tool result; signal-only owners do not abort.
- [x] **Gates.** focused 214/214, tsc 0, build 0, full 2,162/2,162, chain
  768/768, notices 0, source index unchanged, identity \`1c73f452…\`.
- [ ] Remaining C-6: the rest of the hook output consumers and script semantics.
`);

const evidence = {
  schema: 'W117PermissionInterruptEvidence.v1',
  package: 'W117-01 — PermissionRequest deny interrupt',
  date: '2026-10-17',
  question: 'How does a PermissionRequest deny with interrupt affect the turn?',
  answer: 'Only the adopted denying hook can carry interrupt, and only when it is exactly true. The consumer logs Hook interrupt with the tool and message, then aborts the turn controller; the denial remains the recorded tool result and the turn finishes aborted.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    denyArmSchemas: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', range: [395544, 395771] },
    normalizer: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 556404 },
    answerFold: { module: 'extracted-v2/modules/chunk-fyhzvvp0.js', offset: 15469 },
    consumers: [
      { module: 'extracted-v2/modules/chunk-rx2nah4x.js', offset: 660951 },
      { module: 'extracted-v2/modules/chunk-fk088dyb.js', offset: 89113 },
    ],
  },
  behavior: {
    adoptedDecisionOnly: true,
    interruptMustBeTrue: true,
    denialRecordedAsToolResult: true,
    turnAbortedAfterLog: true,
    postHooksSkippedAfterAbort: true,
    logFormat: 'Hook interrupt: tool=<name> hookMessage=<message>',
  },
  adaptations: [
    'The status line is user-visible where the source writes a log line.',
    'The foreground subagent runner and the skill-fork runner receive only a signal and own no controller, so they record the denial without aborting.',
    'No per-hook outcome record exists beyond the adopted interrupt flag.',
  ],
  changes: [
    { file: 'src/hooks.ts', change: 'interrupt parse', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/agent.ts', change: 'interrupt consumption and turn abort seam', sha256: sha(read('src/agent.ts')) },
    { file: 'src/interactive.ts', change: 'turn controller abort wiring', sha256: sha(read('src/interactive.ts')) },
    { file: 'src/cli.ts', change: 'headless controller abort wiring', sha256: sha(read('src/cli.ts')) },
    { file: 'src/agent-registry.ts', change: 'registry child controller abort wiring', sha256: sha(read('src/agent-registry.ts')) },
    { file: 'src/plugin-chain-classic-raise.ts', change: 'classic deny interrupt type', sha256: sha(read('src/plugin-chain-classic-raise.ts')) },
    { file: 'test/hooks.test.ts', change: 'interrupt adoption test', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'turn abort test', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'test/plugin-chain-permission.test.ts', change: 'classic interrupt test', sha256: sha(read('test/plugin-chain-permission.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W117', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W117', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W117-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W117-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '214/214 (hooks, agent-lifecycle, plugin-chain-permission, interactive, agent-registry, cli, skill-runtime, subagents)',
    build: 'exit 0',
    full: '2,162/2,162',
    chain: '768/768',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '1c73f4529c42a0667306529e8b8cb0c22d72ad647baa6f2845aa62621927282b',
  },
  residuals: ['The remaining C-6 hook output consumers and script semantics are unconsumed.'],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with the remaining hook output consumers.',
};
write('research/ports/W117-permission-interrupt-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW117-01 consumes PermissionRequest',
  'research/coding-standard.md': '\n2026-10-17 W117-01 ',
  'research/FEATURES.md': 'W117 consumes PermissionRequest deny interrupt',
  'research/ports/W117-permission-interrupt.md': '# W117 — PermissionRequest deny interrupt',
  '.audit/w117-runtime.todo.md': '\n## W117-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
