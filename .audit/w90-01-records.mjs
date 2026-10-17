// W90-01 record: WorktreeCreate and WorktreeRemove payloads.
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

const note = `# W90 — WorktreeCreate and WorktreeRemove payloads

## Source position

The two worktree hooks carry one field each. \`CTn\` builds
\`{...$d(e,se()), hook_event_name: "WorktreeCreate", name: n}\`
(chunk-sfn1dbxq.js offset 2952999) and raises it through \`b0\`.
\`Xir\` builds \`{...$d(e,se()), hook_event_name: "WorktreeRemove", worktree_path: n}\`
(offset 2954347). Neither sends the tool name, the tool input or the tool
response.

## Port

The WorktreeCreate gate now sends only the requested \`name\`; the tool fields
are gone. The WorktreeRemove raise sends only \`worktree_path\`, computed as the
manager's own deterministic target (\`path.join(workspace,
WORKTREE_DIRECTORY, name)\`), since this product removes the worktree itself
before raising the hook, exactly as the source raises after its removal.

## Adaptation

In the source the WorktreeCreate hook owns the creation and must return the
worktree path; this product keeps its tool-owned creation and a blocking gate,
so only the payload is ported. The WorktreeRemove hook stays informational:
the source logs failed entries without turning them into a block, and the
product keeps its fire-and-forget raise.

## Verification

\`agent-lifecycle\` 33/33: the WorktreeCreate hook receives \`{name: "worker",
hook_event_name: "WorktreeCreate", ...}\` with no \`tool_name\`/\`tool_input\`,
and the WorktreeRemove hook receives \`{worktree_path:
<workspace>/.harness-worktrees/worker, ...}\` with no \`tool_name\`/
\`tool_response\`. tsc 0; build 0; full 2,119/2,119; chain 767/767; notices 0;
source index unchanged; identity \`8288ec96…\`.
`;
write('research/ports/W90-worktree-hooks.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W90-01 aligns the worktree hook payloads. WorktreeCreate sends only the
requested \`name\` (\`CTn\`, chunk-sfn1dbxq.js offset 2952999) and WorktreeRemove
sends only \`worktree_path\` (\`Xir\`, offset 2954347), the manager's own
deterministic target; the tool echo is gone from both. The source's hook-owned
WorktreeCreate creation and informational WorktreeRemove failures stay
recorded adaptations. \`agent-lifecycle\` 33/33, tsc 0, build 0, full
2,119/2,119, chain 767/767, identity \`8288ec96…\`.
[W90 record](ports/W90-worktree-hooks.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W90-01 工作树钩子载荷：S-1（先读源）：读取 chunk-sfn1dbxq.js 的 CTn 2952999（WorktreeCreate 仅 name）与 Xir 2954347（WorktreeRemove 仅 worktree_path）。S-2（不臆造）：两事件不再发送 tool_name/tool_input/tool_response；移除路径取管理器自身确定性目标。S-3（边界）：源中 WorktreeCreate 由钩子负责创建并返回路径，本产品保留工具创建与阻断门；WorktreeRemove 失败仅记录不阻断，保持原样。S-4（可测）：新增两事件载荷捕获断言，检查事件名与唯一字段。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：agent-lifecycle 33/33、tsc 0、build 0、全量 2,119/2,119、链 767/767、身份 8288ec96…。
`);

replaceOnce('research/FEATURES.md',
  'W89 corrects script hooks to the recovered refusal: the hook never executes, records "script hooks are not available in this build", and blocks only for PreToolUse/PermissionRequest |',
  'W89 corrects script hooks to the recovered refusal: the hook never executes, records "script hooks are not available in this build", and blocks only for PreToolUse/PermissionRequest; W90 sends WorktreeCreate only the requested name and WorktreeRemove only the removed path, dropping the tool echo |');

replaceAll('research/CURRENT.md',
  '完整消费者与脚本语义仍待处理',
  'W90完成WorktreeCreate/WorktreeRemove载荷（name与其移除路径；工具回显不再发送）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-18T02:35:00Z', 'package', 'W90-01 工作树钩子载荷',
    'CTn 2952999、Xir 2954347；WorktreeCreate 门载荷与 WorktreeRemove 事后 raise',
    '仅 name 与 worktree_path；不含工具回显',
    'agent-lifecycle 33/33；tsc 0；build 0；全量 2,119/2,119；链 767/767'],
  ['2026-10-18T02:37:00Z', 'decision', 'W90-01 边界',
    '① 源中 WorktreeCreate 为钩子创建并须返回路径，本产品保留工具创建+阻断门；② WorktreeRemove 失败只记录不阻断；③ 路径取管理器确定性目标',
    '残余：完整消费者',
    '.audit/w90-01-full.txt'],
  ['2026-10-18T02:40:00Z', 'verification', 'W90-01 验收：agent-lifecycle 33/33、tsc 0、build 0、2,119/2,119、767/767',
    'WorktreeCreate 载荷含 name 与事件名，无 tool_name/tool_input；WorktreeRemove 载荷含 worktree_path 与事件名，无 tool_name/tool_response',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 8288ec96…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w90-runtime.tsv', tsv + '\n');

write('.audit/w90-runtime.todo.md', `# W90 runtime trail

## W90-01 acceptance (2026-10-18)

- [x] **Source read.** \`CTn\` (2952999) and \`Xir\` (2954347).
- [x] **Port.** WorktreeCreate sends \`{name}\`; WorktreeRemove sends
  \`{worktree_path}\`.
- [x] **Bounds.** No tool echo on either event; tool-owned creation and the
  blocking gate stay; removal failures stay informational.
- [x] **Gates.** agent-lifecycle 33/33, tsc 0, build 0, full 2,119/2,119, chain
  767/767, notices 0, source index unchanged, identity \`8288ec96…\`.
- [ ] Remaining C-6: full consumers.
`);

const evidence = {
  schema: 'W90WorktreeHooksEvidence.v1',
  package: 'W90-01 — WorktreeCreate and WorktreeRemove payloads',
  date: '2026-10-18',
  question: 'What fields do the recovered worktree hooks carry, and does the product send only those?',
  answer: 'WorktreeCreate carries only {name} and WorktreeRemove only {worktree_path}; the product now sends those fields and no tool echo, deriving the removal path from the manager target.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-sfn1dbxq.js',
    unit: 'UTF-16 code units',
    worktreeCreate: { symbol: 'CTn', offset: 2952999, payload: 'name' },
    worktreeRemove: { symbol: 'Xir', offset: 2954347, payload: 'worktree_path' },
  },
  behavior: {
    worktreeCreate: 'gate before the tool runs; blocking exit 2 keeps its semantics',
    worktreeRemove: 'raised after a successful tool removal; failures are logged, not blocking',
    omitted: 'tool_name, tool_input, tool_use_id and tool_response are not sent',
    path: 'manager target path.join(workspace, WORKTREE_DIRECTORY, name)',
  },
  adaptations: [
    'The source WorktreeCreate hook owns creation and must return a worktree path; this product keeps tool-owned creation plus a blocking gate.',
    'The source WorktreeRemove hook treats failed entries as a reported failure without blocking; the product keeps the fire-and-forget raise.',
  ],
  changes: [
    { file: 'src/hooks.ts', change: 'name and worktree_path payload documentation', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/agent.ts', change: 'worktree hook payloads and imports', sha256: sha(read('src/agent.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'worktree payload capture tests', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W90', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W90', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W90-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W90-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    lifecycle: '33/33',
    build: 'exit 0',
    full: '2,119/2,119',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '8288ec963bca539837eb2a2f522567507b2b88d5306e3fc376578980d3cb9812',
  },
  residuals: [
    'The source hook-owned worktree creation and its worktreePath contract remain unported.',
    'Full hook consumers remain C-6 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with full consumers.',
};
write('research/ports/W90-worktree-hooks-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW90-01 aligns the worktree hook payloads',
  'research/coding-standard.md': '\n2026-10-18 W90-01 ',
  'research/FEATURES.md': 'W90 sends WorktreeCreate',
  'research/ports/W90-worktree-hooks.md': '# W90 — WorktreeCreate and WorktreeRemove payloads',
  '.audit/w90-runtime.todo.md': '\n## W90-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
