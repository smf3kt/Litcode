// W113-01 record: hook-based isolated worktrees.
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

const note = `# W113 — hook-based isolated worktrees

## Source position

\`ATn\` (chunk-sfn1dbxq.js offset 2952836) selects the hook path when a
WorktreeCreate hook is configured (\`Bne\`) or a classic module hooks the event
(\`die\`, offset 556297). \`CTn\` (offset 2952999) raises the hook with
\`{name, cwd}\`, reads the first successful hook's trailing non-empty output line
(\`cU\`/\`p7n\`, offsets 561890 and 561804), and distinguishes three failures: no
hook ran, failed records, and a run with no path. An absolute answer is used
verbatim; a relative one is resolved against the hook cwd. The caller then
rejects a dotted spelling (\`el\`), screens every component below the checkout
root for symlinks (\`sme\`, offset 1736863), and requires an existing directory
(\`C1t\`, offset 1774896). Cleanup goes through \`Xir\` (offset 2954231): the
WorktreeRemove hook must succeed, a path already gone counts as removed, and
otherwise the checkout is kept with the failure summary.

## Port

\`runHooks\` now surfaces the WorktreeCreate path on \`worktreePath\`: from
\`hookSpecificOutput.worktreePath\` (schema at chunk-n3ykh62m.js offset 396282,
producers at chunk-sfn1dbxq.js offsets 3049056 and 3052454) and from a command
hook's trailing stdout line. \`executedHooks\` reports how many hooks started a
run for the two worktree events. The runtime child-environment factory selects
the hook path when WorktreeCreate hooks are configured or a classic module hooks
the event, raises it through \`runHooks\` and the classic chain, applies the
source's validations and error texts, and removes the checkout through
WorktreeRemove on close. Without hooks the owned Git worktree manager runs
unchanged.

## Adaptation

The hook payload carries \`name\` and \`cwd\` but no \`session_id\` or
\`transcript_path\`, because the factory owns no Session; the classic raise adds
the keys \`fe\` supplies. Failure summaries use this runtime's recorded failure
strings rather than the source's \`exitCode\` line bounds. The symlink screen runs
against the workspace realpath (the source's \`Fs\`/\`ur\` roots collapse to one
here). The source's not-a-git-repository error that advises configuring hooks
(\`osr\`) is unchanged; the Git manager's own error still surfaces when no hooks
are configured.

## Verification

\`hooks\` asserts the JSON and command paths, first-non-empty ordering, and that
no other event sets the field. \`agent-isolation-runtime\` asserts a non-git
workspace receives the hook checkout, the WorktreeRemove hook runs on
\`stop_agent\`, and dotted or symlinked answers are refused. Focused 111/111,
tsc 0, build 0, full 2,154/2,154, chain 767/767, notices 0, identity
\`2f5efec2…\`.
`;
write('research/ports/W113-hook-worktree.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W113-01 creates isolated child worktrees through WorktreeCreate hooks: the first
successful hook's path (JSON field or trailing stdout line), dot-segment and
symlink-ancestry screening, an existing-directory check, and WorktreeRemove on
cleanup with the checkout preserved on failure. Hooks always win when
configured; the Git manager remains the fallback. Focused 111/111, tsc 0, build
0, full 2,154/2,154, chain 767/767, identity \`2f5efec2…\`.
[W113 record](ports/W113-hook-worktree.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W113-01 钩子式隔离工作树：S-1（先读源）：ATn/die 2952836/556297、CTn 2952999、cU/p7n 561890/561804、schema 396282、producers 3049056/3052454、sme 1736863、C1t 1774896、Xir 2954231（chunk-sfn1dbxq.js/chunk-n3ykh62m.js）。S-2（不臆造）：钩子配置即优先；绝对路径原样、相对路径按工作区解析；点段、符号链接祖先、目录存在三重校验沿用源文错误。S-3（边界）：工厂无 Session，载荷缺 session_id/transcript_path；失败摘要用本地记录串；符号链接扫描以工作区 realpath 为根；无钩子时 Git 错误原文未改。S-4（可测）：hooks 断言 JSON/命令通道与顺序；agent-isolation-runtime 断言非 Git 工作树、stop 时移除钩子、点段与符号链接拒绝。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：聚焦 111/111、tsc 0、build 0、全量 2,154/2,154、链 767/767、notices 0、索引不变、身份 2f5efec2…。
`);

replaceOnce('research/FEATURES.md',
  'W112 applies the PostToolUse `updatedMCPToolOutput` rewrite to `mcp__` tools only |',
  'W112 applies the PostToolUse `updatedMCPToolOutput` rewrite to `mcp__` tools only; W113 creates isolated child worktrees through WorktreeCreate hooks with dot-segment and symlink screening, and removes them through WorktreeRemove |');

replaceAll('research/CURRENT.md',
  '；W112消费PostToolUse的updatedMCPToolOutput（仅mcp__工具，优先于updatedToolOutput）；完整消费者与脚本语义仍待处理',
  '；W112消费PostToolUse的updatedMCPToolOutput（仅mcp__工具，优先于updatedToolOutput）；W113实现钩子式隔离工作树（挂钩建树、点段与符号链接祖先筛查、目录校验、移除钩子，无钩子回退Git）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-17T22:10:00Z', 'package', 'W113-01 hook-based isolated worktrees',
    'ATn/die 2952836/556297、CTn 2952999、cU/p7n 561890/561804、sme 1736863、C1t 1774896、Xir 2954231（chunk-sfn1dbxq.js）',
    '钩子配置优先；绝对路径原样；点段/符号链接/目录三重校验；移除钩子失败保留',
    'hooks/agent-isolation/subagents/agent-registry 111/111；tsc 0；build 0；全量 2,154/2,154；链 767/767'],
  ['2026-10-17T22:12:00Z', 'decision', 'W113-01 本地适配',
    '工厂无 Session：载荷缺 session_id/transcript_path；符号链接扫描以工作区 realpath 为根；失败摘要用本地记录串',
    '无 WorktreeCreate 钩子时 Git 管理器路径不变（含其原始错误）',
    '.audit/w113-01-full.txt'],
  ['2026-10-17T22:14:00Z', 'verification', 'W113-01 验收：聚焦 111/111、tsc 0、build 0、2,154/2,154、767/767',
    '非 Git 工作区由钩子提供 checkout；stop_agent 触发移除钩子；点段与符号链接被拒',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 2f5efec2…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w113-runtime.tsv', tsv + '\n');

write('.audit/w113-runtime.todo.md', `# W113 runtime trail

## W113-01 acceptance (2026-10-17)

- [x] **Source read.** Hook selection, path extraction, three create failures,
  the three validations, and the removal contract.
- [x] **Port.** worktreePath channel, executedHooks count, factory hook branch,
  WorktreeRemove on close.
- [x] **Bounds.** Absolute used verbatim; relative resolved; dotted, symlinked
  and missing-directory answers refused; Git fallback unchanged.
- [x] **Gates.** focused 111/111, tsc 0, build 0, full 2,154/2,154, chain
  767/767, notices 0, source index unchanged, identity \`2f5efec2…\`.
- [ ] Remaining C-6: the rest of the hook output consumers and script semantics.
`);

const evidence = {
  schema: 'W113HookWorktreeEvidence.v1',
  package: 'W113-01 — hook-based isolated worktrees',
  date: '2026-10-17',
  question: 'How does an isolated child worktree come from a WorktreeCreate hook, and how is it verified and removed?',
  answer: 'When a WorktreeCreate hook is configured (or a classic module hooks it) the hook supplies the checkout path on stdout or in hookSpecificOutput.worktreePath; the path is used verbatim when absolute, resolved when relative, rejected for dot segments, screened component-by-component for symlinks below the checkout root, and required to be an existing directory. Cleanup raises WorktreeRemove and keeps the checkout when that hook fails.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    selection: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offsets: [2952836, 556297] },
    create: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 2952999 },
    outputFold: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offsets: [561804, 561890] },
    schema: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', offset: 396282 },
    ancestryScreen: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 1736863 },
    directoryCheck: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 1774896 },
    remove: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 2954231 },
  },
  behavior: {
    hookPrecedenceOverGit: true,
    absoluteVerbatim: true,
    dotSegmentRejected: true,
    symlinkAncestryScreened: true,
    directoryRequired: true,
    removalKeepsOnHookFailure: true,
  },
  adaptations: [
    'The factory has no Session, so the hook payload omits session_id and transcript_path.',
    'Failure summaries use this runtime\'s recorded hook failure strings.',
    'The symlink screen root is the workspace realpath.',
    'The Git manager path and its own not-a-repository error are unchanged when no hooks are configured.',
  ],
  changes: [
    { file: 'src/hooks.ts', change: 'worktreePath, executedHooks, lastNonEmptyLine, command stdout fold', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/worktrees.ts', change: 'dot-segment, ancestry screen, directory check', sha256: sha(read('src/worktrees.ts')) },
    { file: 'src/runtime.ts', change: 'hook-based child environment branch and removal', sha256: sha(read('src/runtime.ts')) },
    { file: 'test/hooks.test.ts', change: 'WorktreeCreate output channel assertions', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'test/agent-isolation-runtime.test.ts', change: 'hook create/remove and rejection tests', sha256: sha(read('test/agent-isolation-runtime.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W113', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W113', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W113-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W113-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '111/111 (hooks, agent-isolation-runtime, subagents, agent-registry)',
    build: 'exit 0',
    full: '2,154/2,154',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '2f5efec24b931b77e71dadbd6025cb0d67501f30e5b45f70d68aa4dccb59daa1',
  },
  residuals: [
    'The remaining C-6 hook output consumers and script semantics are unconsumed.',
    'The source\'s not-a-git-repository advisory error is not raised before the Git manager path.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with the remaining hook output consumers.',
};
write('research/ports/W113-hook-worktree-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW113-01 creates isolated child worktrees',
  'research/coding-standard.md': '\n2026-10-17 W113-01 ',
  'research/FEATURES.md': 'W113 creates isolated child worktrees',
  'research/ports/W113-hook-worktree.md': '# W113 — hook-based isolated worktrees',
  '.audit/w113-runtime.todo.md': '\n## W113-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
