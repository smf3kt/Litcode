// W116-01 record: DirectoryAdded hook raise and failed-output display.
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

const note = `# W116 — DirectoryAdded raise and failed-output display

## Source position

The DirectoryAdded hook input carries \`directory\` and \`source\`, and \`source\`
is the documented enum \`slash_command\` | \`register_repo_root\` (\`jK\`,
chunk-r2vtj1kh.js offset 203596). The event is raised by the /add-dir command
(chunk-340rde3k.js offset 2197) and by the register_repo_root control request
(chunk-rx2nah4x.js offset 565798). The extractor \`lvt\`
(chunk-sfn1dbxq.js [2933905,2934228)) returns the per-hook results plus every
non-empty \`systemMessage\`. Both call sites display the system messages and then
walk the results, displaying \`output\` for each failed hook
(\`DirectoryAdded hook failed: \${output}\`).

## Port

The workspace-relocation raise now passes the documented \`slash_command\`
producer instead of the off-enum \`cwd_relocation\` value, so a matcher written
against the documented enum selects the local hook. The returned failures are
displayed on the status stream after the system messages, following the same
order as the FileChanged/CwdChanged watcher display (\`ke\`/\`Pe\`,
chunk-sfn1dbxq.js [1678937,1679560)). System messages are displayed by the
runtime's hook display path while the event runs, so only failed outputs need
the consumer-side loop.

## Adaptation

This CLI has no /add-dir command and no register_repo_root control request; its
slash relocation commands (/cwd, /worktree, /worktree-exit) are the producer, so
the source's registration lifecycle and its \`register_repo_root\` trigger have no
local analogue. The runner aggregates hook output by event, so a failure is the
same context text used by the watcher display rather than a per-hook
\`{succeeded, output}\` record; the source's \`DirectoryAdded hook failed: \` prefix
is therefore not re-added. The /add-dir task-notification summary line has no
local notification surface.

## Verification

\`interactive\` asserts a /cwd relocation delivers
\`{hook_event_name: "DirectoryAdded", directory: <target>, source: "slash_command"}\`
to a matcher-selected hook, displays its system message, and displays a failing
hook's output. \`hooks\` uses the documented source value in its matcher-selection
fixture. Focused 71/71, tsc 0, build 0, full 2,159/2,159, chain 767/767,
identity \`7b5c2d92…\`.
`;
write('research/ports/W116-directory-added.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W116-01 raises DirectoryAdded with the documented slash_command producer on a
workspace relocation and displays each failed hook output after the system
messages. The local CLI has no /add-dir or register_repo_root, so relocation
commands stand in for the source's registration triggers. Focused 71/71, tsc 0,
build 0, full 2,159/2,159, chain 767/767, identity \`7b5c2d92…\`.
[W116 record](ports/W116-directory-added.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W116-01 DirectoryAdded消费者：S-1（先读源）：schema jK 203596（chunk-r2vtj1kh.js）、lvt 2933998（chunk-sfn1dbxq.js）、/add-dir 2197（chunk-340rde3k.js）、register_repo_root 565798（chunk-rx2nah4x.js）。S-2（不臆造）：source仅slash_command/register_repo_root；本地以slash迁移命令为生产者；失败输出在systemMessages之后显示（ke/Pe顺序）。S-3（边界）：本地无/add-dir与register_repo_root，注册生命周期与通知摘要行无对应；运行器按事件聚合失败文本，故不重复源前缀。S-4（可测）：interactive断言载荷、匹配、systemMessage与失败显示；hooks改用文档枚举值。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据JSON。验证：聚焦71/71、tsc 0、build 0、全量2,159/2,159、链767/767、notices 0、索引不变、身份7b5c2d92…。
`);

replaceOnce('research/FEATURES.md',
  'W115 lets Elicitation and ElicitationResult hooks answer or override the MCP form |',
  'W115 lets Elicitation and ElicitationResult hooks answer or override the MCP form; W116 raises DirectoryAdded as a documented slash_command hook on relocation and displays its failed output |');

replaceAll('research/CURRENT.md',
  '；W115消费Elicitation/ElicitationResult钩子答案（动作/内容替换对话框，阻断即拒绝）；完整消费者与脚本语义仍待处理',
  '；W115消费Elicitation/ElicitationResult钩子答案（动作/内容替换对话框，阻断即拒绝）；W116以文档slash_command生产者提升DirectoryAdded并显示失败输出（本地无/add-dir与register_repo_root）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-17T23:25:00Z', 'package', 'W116-01 DirectoryAdded raise and failed output',
    'jK 203596（chunk-r2vtj1kh.js）、lvt 2933998（chunk-sfn1dbxq.js）、/add-dir 2197、register_repo_root 565798',
    'source限slash_command/register_repo_root；本地迁移命令为slash_command生产者；失败输出在systemMessages之后',
    'interactive/hooks 71/71；tsc 0；build 0；全量 2,159/2,159；链 767/767'],
  ['2026-10-17T23:27:00Z', 'decision', 'W116-01 本地适配',
    '本地无/add-dir与register_repo_root；运行器按事件聚合失败文本；通知摘要行无本地通知面',
    '不重复源前缀；注册生命周期无对应',
    '.audit/w116-01-full.txt'],
  ['2026-10-17T23:29:00Z', 'verification', 'W116-01 验收：聚焦 71/71、tsc 0、build 0、2,159/2,159、767/767',
    '/cwd载荷为slash_command；systemMessage与失败输出均显示',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 7b5c2d92…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w116-runtime.tsv', tsv + '\n');

write('.audit/w116-runtime.todo.md', `# W116 runtime trail

## W116-01 acceptance (2026-10-17)

- [x] **Source read.** The input schema enum, the extractor, and both display
  call sites.
- [x] **Port.** Documented slash_command producer; failed outputs displayed
  after the system messages.
- [x] **Bounds.** Source is one of the two documented values; local relocation
  commands are the slash producer; no per-hook output record exists.
- [x] **Gates.** focused 71/71, tsc 0, build 0, full 2,159/2,159, chain
  767/767, notices 0, source index unchanged, identity \`7b5c2d92…\`.
- [ ] Remaining C-6: the rest of the hook output consumers and script semantics.
`);

const evidence = {
  schema: 'W116DirectoryAddedEvidence.v1',
  package: 'W116-01 — DirectoryAdded raise and failed-output display',
  date: '2026-10-17',
  question: 'How is DirectoryAdded raised, and how are its system messages and failed outputs consumed?',
  answer: 'The event carries an absolute directory and a source limited to slash_command or register_repo_root. The two producers display each system message, then each failed hook output. The local relocation raise now passes slash_command and displays failed outputs after the system messages.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    schema: { module: 'extracted-v2/modules/chunk-r2vtj1kh.js', offset: 203596 },
    extractor: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', range: [2933905, 2934228] },
    producers: [
      { module: 'extracted-v2/modules/chunk-340rde3k.js', offset: 2197, source: 'slash_command' },
      { module: 'extracted-v2/modules/chunk-rx2nah4x.js', offset: 565798, source: 'register_repo_root' },
    ],
    displayOrder: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', range: [1678937, 1679560] },
  },
  behavior: {
    sourceEnum: ['slash_command', 'register_repo_root'],
    directoryAbsolute: true,
    systemMessagesDisplayed: true,
    failedOutputDisplayed: true,
    failuresAfterSystemMessages: true,
  },
  adaptations: [
    'This CLI has no /add-dir command or register_repo_root control request; its slash relocation commands are the slash_command producer.',
    'The runner aggregates failure text by event, so the source per-hook output prefix is not re-added.',
    'The /add-dir task-notification summary has no local notification surface.',
  ],
  changes: [
    { file: 'src/interactive.ts', change: 'slash_command producer and failed-output display', sha256: sha(read('src/interactive.ts')) },
    { file: 'test/interactive.test.ts', change: 'relocation DirectoryAdded test', sha256: sha(read('test/interactive.test.ts')) },
    { file: 'test/hooks.test.ts', change: 'documented source value in matcher fixture', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W116', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W116', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W116-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W116-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '71/71 (interactive, hooks)',
    build: 'exit 0',
    full: '2,159/2,159',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '7b5c2d92f3b5af8b82c58a7310b63e3dd06bf895d03438bff3ff99ef02f5baee',
  },
  residuals: ['The remaining C-6 hook output consumers and script semantics are unconsumed.'],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with the remaining hook output consumers.',
};
write('research/ports/W116-directory-added-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW116-01 raises DirectoryAdded',
  'research/coding-standard.md': '\n2026-10-17 W116-01 ',
  'research/FEATURES.md': 'W116 raises DirectoryAdded as a documented slash_command hook',
  'research/ports/W116-directory-added.md': '# W116 — DirectoryAdded raise and failed-output display',
  '.audit/w116-runtime.todo.md': '\n## W116-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
