// W114-01 record: non-git worktree isolation advisory.
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

const note = `# W114 — non-Git worktree advisory

## Source position

The child agent worktree creator resolves its repository root first
(\`Pze\`, chunk-sfn1dbxq.js offset 1762797): with no root and no WorktreeCreate
hook it throws "Cannot create a worktree: not in a git repository and no
WorktreeCreate hooks are configured. Configure WorktreeCreate/WorktreeRemove
hooks in settings.json to use worktree isolation with other VCS systems."
The neighbouring \`osr\` (offset 1733866) carries the same shape with "Cannot
create agent worktree" for its own entry point.

## Port

\`WorktreeManager.repositoryState\` reports \`none\` when \`git rev-parse
--show-toplevel\` fails, \`root\` when its realpath equals the workspace, and
\`elsewhere\` otherwise. The child environment factory raises the recovered
advisory on \`none\` before creating anything; \`root\` and \`elsewhere\` keep the
manager's existing path, so a nested workspace still reports the manager's
root-identity error rather than a misleading no-repository one.

## Adaptation

The advisory is the child-worktree text (\`Pze\`); \`osr\`'s "Cannot create agent
worktree" variant belongs to its own entry point and is not raised here. The
diskless/confined-session checks above \`Pze\` have no local analogue.

## Verification

\`agent-isolation-runtime\` asserts the advisory for a plain temporary workspace
with no hooks. Focused 88/88, tsc 0, build 0, full 2,155/2,155, chain 767/767,
identity \`95c17af3…\`.
`;
write('research/ports/W114-worktree-advisory.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W114-01 reports the recovered advisory when an isolated child runs in a
workspace with no Git repository and no WorktreeCreate hook, instead of the Git
manager's failure. A workspace inside a repository whose root is elsewhere
still takes the manager's own root error. Focused 88/88, tsc 0, build 0, full
2,155/2,155, chain 767/767, identity \`95c17af3…\`.
[W114 record](ports/W114-worktree-advisory.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W114-01 无Git工作树告警：S-1（先读源）：Pze 1762797 告警文与仓库根判定、osr 1733866 同形入口。S-2（不臆造）：仅当 rev-parse 失败时报源告警；仓库根在别处仍由管理器报自身根错误。S-3（边界）：采用子代理工作树的 Pze 文本，osr 的 "agent worktree" 变体不在此处触发；无磁盘/受限会话检查无本地对应。S-4（可测）：agent-isolation-runtime 断言纯临时工作区且无钩子时得到该告警。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：聚焦 88/88、tsc 0、build 0、全量 2,155/2,155、链 767/767、notices 0、索引不变、身份 95c17af3…。
`);

replaceOnce('research/FEATURES.md',
  'W113 creates isolated child worktrees through WorktreeCreate hooks with dot-segment and symlink screening, and removes them through WorktreeRemove |',
  'W113 creates isolated child worktrees through WorktreeCreate hooks with dot-segment and symlink screening, and removes them through WorktreeRemove; W114 reports the source advisory when a worktree-isolated child runs outside a Git repository with no hook |');

replaceAll('research/CURRENT.md',
  '；W113实现钩子式隔离工作树（挂钩建树、点段与符号链接祖先筛查、目录校验、移除钩子，无钩子回退Git）；完整消费者与脚本语义仍待处理',
  '；W113实现钩子式隔离工作树（挂钩建树、点段与符号链接祖先筛查、目录校验、移除钩子，无钩子回退Git）；W114补齐无Git且无钩子时的源告警（repositoryState三态）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-17T22:40:00Z', 'package', 'W114-01 non-git worktree advisory',
    'Pze 1762797（chunk-sfn1dbxq.js）、osr 1733866',
    'rev-parse 失败才报源告警；仓库根在别处保持管理器错误',
    'agent-isolation/subagents/agent-registry/worktrees 88/88；tsc 0；build 0；全量 2,155/2,155；链 767/767'],
  ['2026-10-17T22:42:00Z', 'decision', 'W114-01 本地适配',
    '采用子代理工作树 Pze 文本；osr 变体属另一入口；无磁盘/受限检查无对应',
    'repositoryState 三态避免把嵌套工作区误报为无仓库',
    '.audit/w114-01-full.txt'],
  ['2026-10-17T22:44:00Z', 'verification', 'W114-01 验收：聚焦 88/88、tsc 0、build 0、2,155/2,155、767/767',
    '纯临时工作区无钩子得到源告警',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 95c17af3…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w114-runtime.tsv', tsv + '\n');

write('.audit/w114-runtime.todo.md', `# W114 runtime trail

## W114-01 acceptance (2026-10-17)

- [x] **Source read.** The child-worktree repository-root check and its
  advisory text, plus the neighbouring entry point's variant.
- [x] **Port.** repositoryState none/root/elsewhere and the factory advisory.
- [x] **Bounds.** Only a workspace with no repository takes the advisory; a
  nested workspace keeps the manager's root error.
- [x] **Gates.** focused 88/88, tsc 0, build 0, full 2,155/2,155, chain
  767/767, notices 0, source index unchanged, identity \`95c17af3…\`.
- [ ] Remaining C-6: the rest of the hook output consumers and script semantics.
`);

const evidence = {
  schema: 'W114WorktreeAdvisoryEvidence.v1',
  package: 'W114-01 — non-Git worktree advisory',
  date: '2026-10-17',
  question: 'What does an isolated child worktree request do in a workspace outside Git when no WorktreeCreate hook is configured?',
  answer: 'It fails with the recovered advisory telling the user to configure WorktreeCreate/WorktreeRemove hooks, rather than surfacing a raw Git failure. A workspace inside a repository whose root is elsewhere keeps the manager\'s own root-identity error.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    advisory: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 1762797 },
    siblingEntryPoint: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 1733866 },
  },
  behavior: { advisoryOnNoRepository: true, nestedWorkspaceUnchanged: true, hookPrecedenceUnchanged: true },
  adaptations: [
    'The child-worktree text (Pze) is used; the agent-worktree osr variant belongs to its own entry point.',
    'The diskless and confined-session checks above Pze have no local analogue.',
  ],
  changes: [
    { file: 'src/worktrees.ts', change: 'repositoryState three-state check', sha256: sha(read('src/worktrees.ts')) },
    { file: 'src/runtime.ts', change: 'advisory before the Git worktree create', sha256: sha(read('src/runtime.ts')) },
    { file: 'test/agent-isolation-runtime.test.ts', change: 'non-git advisory assertion', sha256: sha(read('test/agent-isolation-runtime.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W114', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W114', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W114-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W114-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '88/88 (agent-isolation-runtime, subagents, agent-registry, worktrees)',
    build: 'exit 0',
    full: '2,155/2,155',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '95c17af3c50fd099c17e7ff4ca8cdf7eb146695171fe918c8a94ad29b95aa751',
  },
  residuals: ['The remaining C-6 hook output consumers and script semantics are unconsumed.'],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with the remaining hook output consumers.',
};
write('research/ports/W114-worktree-advisory-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW114-01 reports the recovered advisory',
  'research/coding-standard.md': '\n2026-10-17 W114-01 ',
  'research/FEATURES.md': 'W114 reports the source advisory',
  'research/ports/W114-worktree-advisory.md': '# W114 — non-Git worktree advisory',
  '.audit/w114-runtime.todo.md': '\n## W114-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
