// W79-01 record: recovered hook matcher selectors and event payload fields.
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

const note = `# W79 — hook selector table and event payloads

## Source position

\`y5e(e)\` (chunk-sfn1dbxq.js, UTF-16 [2984225,2985215)) selects the one field a
matcher is tested against:

- tool events (PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest,
  PermissionDenied) use \`tool_name\`;
- UserPromptExpansion uses \`command_name\`; SessionStart uses \`source\`;
  Setup, PreCompact and PostCompact use \`trigger\`; Pre/PostModelSwitch use the
  normalized \`to_model\`;
- Notification uses \`notification_type\`; SessionEnd uses \`reason\`;
  StopFailure uses \`error\`; SubagentStart/SubagentStop use \`agent_type\`;
- Elicitation/ElicitationResult use \`mcp_server_name\`; ConfigChange and
  DirectoryAdded use \`source\`; InstructionsLoaded uses \`load_reason\`;
- FileChanged uses \`h5e(file_path)\`, and \`h5e\` is \`path.basename\` (import at
  the top of the module);
- TeammateIdle, TaskCreated, TaskCompleted and every event outside the table
  return no value.

\`zze(e,n,r)\` [2983916,2984075) applies the hook: \`s===void 0||!n||gX(...)\`.
A missing selector value therefore accepts every configured matcher, and only
a present value is compared.

Payload builders measured for this package:

- \`ZXr\` [2935532,2935646): \`CwdChanged\` with \`old_cwd\` and \`new_cwd\`;
- \`e7r\` [2935646,2935767): \`FileChanged\` with \`file_path\` and \`event\`;
- \`lvt\` [2933905,2934228): \`DirectoryAdded\` with \`directory\` and \`source\`;
- \`kTn\` [2935761,2936142): \`InstructionsLoaded\` with \`file_path\`,
  \`memory_type\`, \`load_reason\`, \`globs\`, \`trigger_file_path\` and
  \`parent_file_path\`;
- \`cvt\` [2934222,2934736): \`Elicitation\` with \`mcp_server_name\`;
- \`n7r\` [2943161,2943444): \`Setup\` with \`trigger\`, dispatched as \`"init"\`
  at chunk-9shw4xrd.js offset 143466;
- \`KZn\` [672828,672967): the eager instruction load reason, whose state
  default is \`"session_start"\` (offset 654708);
- \`$d\` [2958255,2958860): the shared session, transcript, cwd and permission
  context every builder spreads.

## Port

\`hookMatcherValue\` follows \`y5e\` and returns the selector per event;
FileChanged uses \`basename\`. \`runHooks\` now filters a definition only when a
selector exists, porting \`zze\`'s undefined branch: an event with no selector
accepts every matcher.

Raise sites carry the recovered fields:

- \`CwdChanged\` sends \`{old_cwd, new_cwd}\`; the pre-relocation workspace is
  captured before the target is resolved.
- \`DirectoryAdded\` sends \`{directory, source}\` instead of \`directory_path\`.
- \`FileChanged\` sends \`{file_path, event}\`; the path is absolute.
- \`InstructionsLoaded\` sends \`{load_reason: "session_start"}\`.
- \`Setup\` sends \`{trigger: "init"}\`.
- \`Elicitation\` sends \`mcp_server_name\`; ElicitationResult inherits it.

## Adaptation

The source raises FileChanged from its file watcher with one of \`add\`,
\`change\` or \`unlink\`. This runtime has no per-file watcher callback, so its
mutation tools raise the event with the absolute tool path and report the
mutation as \`change\`; \`memory_write\` derives \`.harness/memory/<name>.md\`.
InstructionsLoaded stays a session-level raise with the recovered default load
reason because the runtime has no per-file eager instruction loader; the
file-only fields stay absent. The model-alias normalization (\`g4e\`/\`zIt\`) used
by Pre/PostModelSwitch selectors is not ported; the selector uses \`to_model\`
and falls back to the product's \`model\`. UserPromptExpansion keeps its
product payload, which carries no \`command_name\`, so its matcher value is
absent exactly as for any other selector-less payload.

## Verification

\`hooks\` 48/48 and \`agent-lifecycle\` 25/25: the selector table is asserted
directly (basename, notification type, server name, session end reason, and no
TaskCreated value); transition matchers match source/reason/trigger and match
every occurrence for CwdChanged and TaskCreated; the raised Setup,
InstructionsLoaded and FileChanged payloads are captured from real command
hooks. The hook-group no-selector expectation now follows \`zze\`: all three
hooks run when the selector is absent. tsc 0; build 0; full 2,107/2,107;
chain 767/767; notices 0; source index unchanged; identity \`fd3b6906…\`.
`;
write('research/ports/W79-hook-selectors.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W79-01 ports the recovered hook selector table. \`hookMatcherValue\` follows
\`y5e\`: tool events select \`tool_name\`, DirectoryAdded and ConfigChange select
\`source\`, InstructionsLoaded selects \`load_reason\`, Setup selects \`trigger\`,
FileChanged selects the file basename, and an event outside the table has no
selector, so its configured matchers accept every occurrence as \`zze\` does.
CwdChanged now carries \`old_cwd\`/\`new_cwd\`, DirectoryAdded carries
\`directory\`/\`source\`, FileChanged carries \`file_path\`/\`event\`,
InstructionsLoaded carries \`load_reason\`, Setup carries \`trigger: "init"\`,
and Elicitation carries \`mcp_server_name\`. \`hooks\` 48/48,
\`agent-lifecycle\` 25/25, tsc 0, full 2,107/2,107, chain 767/767, identity
\`fd3b6906…\`. [W79 record](ports/W79-hook-selectors.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W79-01 钩子选择器与载荷：S-1（先读源）：读取 chunk-sfn1dbxq.js 的 y5e [2984225,2985215)、zze [2983916,2984075)、ZXr [2935532,2935646)、e7r [2935646,2935767)、lvt [2933905,2934228)、kTn [2935761,2936142)、cvt [2934222,2934736)、n7r [2943161,2943444)、KZn [672828,672967)、$d [2958255,2958860)（UTF-16），以及 chunk-9shw4xrd.js 偏移 143466 的 setup trigger。S-2（不臆造）：选择器逐事件按 y5e；缺失选择器按 zze 接受全部匹配；FileChanged 用 path.basename；载荷字段按源构建器命名。S-3（边界）：FileChanged 由工具变更本地扩展触发并固定 event=change；InstructionsLoaded 保持会话级 raise 且仅带默认 load_reason；模型别名归一化与 UserPromptExpansion 的 command_name 留待后续。S-4（可测）：新增选择器直测、转换事件匹配、真实命令钩子捕获 Setup/InstructionsLoaded/FileChanged 载荷；hook-groups 无选择器期望改为全部运行。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：hooks 48/48、agent-lifecycle 25/25、tsc 0、build 0、全量 2,107/2,107、链 767/767、身份 fd3b6906…。
`);

replaceOnce('research/FEATURES.md',
  'so the sink it binds was lost) |',
  'so the sink it binds was lost); W79 ports the recovered selector table (`y5e`) and aligns the transition payloads: tool events select `tool_name`, DirectoryAdded/ConfigChange select `source`, InstructionsLoaded selects `load_reason`, Setup selects `trigger`, FileChanged selects the file basename, and an event with no selector accepts every matcher as `zze` does; CwdChanged carries `old_cwd`/`new_cwd`, DirectoryAdded carries `directory`/`source`, FileChanged carries `file_path`/`event`, InstructionsLoaded carries `load_reason`, Setup carries `trigger: "init"`, and Elicitation carries `mcp_server_name` |');

replaceAll('research/CURRENT.md',
  '完整消费者与脚本语义仍待处理',
  'W79完成钩子选择器表（y5e：FileChanged用basename，DirectoryAdded/ConfigChange用source，InstructionsLoaded用load_reason，Setup用trigger，无选择器接受全部匹配）与文件/目录/指令事件载荷字段移植；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-17T21:10:00Z', 'package', 'W79-01 钩子选择器与载荷',
    'y5e [2984225,2985215)、zze [2983916,2984075)；ZXr/e7r/lvt/kTn/cvt/n7r/KZn/$d；hookMatcherValue 与载荷字段',
    '逐事件选择器；缺失选择器接受全部；FileChanged basename；old_cwd/new_cwd、directory/source、file_path/event、load_reason、trigger=init、mcp_server_name',
    'hooks 48/48；agent-lifecycle 25/25；tsc 0；build 0；全量 2,107/2,107；链 767/767'],
  ['2026-10-17T21:12:00Z', 'decision', 'W79-01 本地扩展与残余',
    '① FileChanged 由工具变更触发并固定 event=change；② InstructionsLoaded 保持会话级 raise，仅带默认 load_reason；③ 模型别名归一化未移植，选择器回退 model；④ UserPromptExpansion 无 command_name',
    '残余：完整消费者、脚本语义、per-file watcher 与 per-file 指令加载',
    '.audit/w79-01-full.txt'],
  ['2026-10-17T21:15:00Z', 'verification', 'W79-01 验收：hooks 48/48、agent-lifecycle 25/25、tsc 0、build 0、2,107/2,107、767/767',
    '选择器直测；转换事件匹配；真实钩子捕获 Setup/InstructionsLoaded/FileChanged；hook-groups 无选择器改为全部运行',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity fd3b6906…（inputs 1924b244…、validation 56edd1e8…、build 2aa9dac5…）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w79-runtime.tsv', tsv + '\n');

write('.audit/w79-runtime.todo.md', `# W79 runtime trail

## W79-01 acceptance (2026-10-17)

- [x] **Source read.** \`y5e\`, \`zze\`, the six payload builders, \`KZn\` and the
  setup dispatch measured in UTF-16 code units.
- [x] **Port.** \`hookMatcherValue\`; undefined selector accepts every matcher;
  payload field alignment at every raise site.
- [x] **Adaptation.** Tool-driven FileChanged reports \`change\`; the
  InstructionsLoaded raise stays session-level; model-alias normalization and
  UserPromptExpansion \`command_name\` stay residual.
- [x] **Gates.** hooks 48/48, agent-lifecycle 25/25, tsc 0, build 0, full
  2,107/2,107, chain 767/767, notices 0, source index unchanged, identity
  \`fd3b6906…\`.
- [ ] Remaining C-6: full consumers and script semantics, a per-file watcher
  raise, and per-file instruction loading.
`);

const evidence = {
  schema: 'W79HookSelectorsEvidence.v1',
  package: 'W79-01 — hook selector table and event payloads',
  date: '2026-10-17',
  question: 'Does the runtime select matchers and build transition payloads exactly as the recovered y5e/zze and payload builders do?',
  answer: 'Yes for the selector table, the undefined-selector rule, and the payload fields the runtime can supply; FileChanged is raised by mutation tools with event "change" because the runtime has no per-file watcher callback, and InstructionsLoaded stays a session-level raise with the default load_reason.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-sfn1dbxq.js',
    unit: 'UTF-16 code units',
    selector: { symbol: 'y5e', range: [2984225, 2985215] },
    predicate: { symbol: 'zze', range: [2983916, 2984075] },
    cwdChanged: { symbol: 'ZXr', range: [2935532, 2935646] },
    fileChanged: { symbol: 'e7r', range: [2935646, 2935767] },
    directoryAdded: { symbol: 'lvt', range: [2933905, 2934228] },
    instructionsLoaded: { symbol: 'kTn', range: [2935761, 2936142] },
    elicitation: { symbol: 'cvt', range: [2934222, 2934736] },
    setup: { symbol: 'n7r', range: [2943161, 2943444] },
    eagerLoadReason: { symbol: 'KZn', range: [672828, 672967], defaultOffset: 654708 },
    commonContext: { symbol: '$d', range: [2958255, 2958860] },
    setupDispatch: { module: 'extracted-v2/modules/chunk-9shw4xrd.js', offset: 143466, trigger: 'init' },
    basename: 'h5e is path.basename, imported at the top of chunk-sfn1dbxq.js',
  },
  behavior: {
    selectors: 'tool_name for tool events; command_name, source, trigger, to_model, notification_type, reason, error, agent_type, mcp_server_name, source, load_reason, basename(file_path)',
    absentSelector: 'accepts every configured matcher',
    fileChanged: 'file_path and event (add, change or unlink)',
    cwdChanged: 'old_cwd and new_cwd',
    directoryAdded: 'directory and source',
    instructionsLoaded: 'file_path, memory_type, load_reason, globs, trigger_file_path, parent_file_path',
    setup: 'trigger',
    elicitation: 'mcp_server_name',
  },
  changes: [
    { file: 'src/hooks.ts', change: 'hookMatcherValue, payload fields, undefined-selector filtering', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/agent.ts', change: 'Setup/InstructionsLoaded/FileChanged payloads and changedFilePath', sha256: sha(read('src/agent.ts')) },
    { file: 'src/interactive.ts', change: 'CwdChanged/DirectoryAdded/Elicitation payloads', sha256: sha(read('src/interactive.ts')) },
    { file: 'test/hooks.test.ts', change: 'selector and transition matcher assertions', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'test/hook-groups.test.ts', change: 'no-selector expectation follows zze', sha256: sha(read('test/hook-groups.test.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'captured Setup/InstructionsLoaded/FileChanged payload test', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record the selector port', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records the selector port', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W79-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W79-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    hooks: '48/48',
    agentLifecycle: '25/25',
    build: 'exit 0',
    full: '2,107/2,107',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'fd3b690619c6dab0f21f6969fd3e6f9ebb8141d7e4081aa2afb679608e142494',
  },
  residuals: [
    'FileChanged is raised by mutation tools with event "change"; a per-file watcher raise remains C-6 work.',
    'InstructionsLoaded stays session-level with the default load_reason; per-file instruction loading remains C-6 work.',
    'Model-alias normalization for Pre/PostModelSwitch selectors and UserPromptExpansion command_name remain gaps.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with the full hook consumers, script semantics and per-file watcher/instruction raises.',
};
write('research/ports/W79-hook-selectors-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW79-01 ports the recovered hook selector table',
  'research/coding-standard.md': '\n2026-10-17 W79-01 ',
  'research/FEATURES.md': 'W79 ports the recovered selector table',
  'research/ports/W79-hook-selectors.md': '# W79 — hook selector table and event payloads',
  '.audit/w79-runtime.todo.md': '\n## W79-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
