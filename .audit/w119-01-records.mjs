// W119-01 record: asyncRewake command hooks.
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

const note = `# W119 — asyncRewake command hooks

## Source position

The plugin command-hook schema (chunk-3cynezh1.js offset 101418) carries
\`asyncRewake\` ("runs in background and wakes the model on exit code 2 … Implies
async"), \`rewakeMessage\` (the prefix before the hook output) and
\`rewakeSummary\` (the one-line terminal summary, default \`Stop hook feedback\`).
The consumer \`m5e\` (chunk-sfn1dbxq.js offset 2956018) waits for the background
run, wakes only when its exit code is 2, defaults the prefix to
\`Stop hook blocking error from command "<hookName>":\` and appends
\`stderr || stdout\`. The broken-install detector \`Ebt\` (offset 632160) and its
dedupe \`Abt\` (offset 632770) apply only to script hooks' \`scriptPaths\`. The
summary may come from a trusted plugin's stdout JSON \`rewakeSummary\`, trimmed,
whitespace-collapsed and capped at \`nkr\` 300 (offset 2955284); otherwise the
definition's text is used. The wake body is purified by \`UT\` (offset 632948)
over \`Ait\` (chunk-hwpb27as.js offset 43), which escapes \`<\` before
\`system-reminder\` and a trailing \`<\`, and by \`zLe\` (offset 633015), which
applies credential redaction. \`z6t\` (offset 633021) queues the body as a task
notification with priority \`next\`, \`stopHookActive: true\` and
\`turnAttribution: "inherit"\`.

## Port

\`commandHookSchema\` gains the three fields, and \`runHooks\` treats
\`asyncRewake\` as async, so the definition reaches the owned async registry.
\`HookRunOptions.onCommandResult\` exposes each command run's raw exit code,
stdout and stderr to its owner. The registry strips \`asyncRewake\` from the
forwarded foreground run, captures that raw result, and on exit code 2 adds
\`AsyncHookCompletion.rewake\`: the summary (default \`Stop hook feedback\`) and
the body (configured prefix, else the default prefix with the command text,
then stderr else stdout), both credential-redacted and the body reminder-escaped.
The runtime's owner callback queues the wake body as the event prompt instead of
the generic completion record; the interactive loop already turns queued event
prompts into model turns, which is the local wake.

## Adaptation

- A local command hook has no hook name; the default prefix quotes its command.
- The stdout JSON \`rewakeSummary\` path needs a trusted plugin id, which
  flattened local hooks do not carry. Only the definition's \`rewakeSummary\` is
  read, and it is used as the source uses the definition text, without the
  300-unit normalization that applies to the JSON path.
- Broken-install detection and its dedupe need script hooks' \`scriptPaths\`.
  This build refuses script hooks and command hooks carry no \`scriptPaths\`, so
  neither is ported.
- \`ranForAccountMemory\` has no local counterpart; its withheld-output branch
  has no surface.
- The wake is a FIFO event prompt, not a task notification with priority,
  \`stopHookActive\` and turn attribution. Child-agent registries record the
  completion through their observer but own no wake queue.
- The shared schema accepts the two rewake texts on any command hook, matching
  the source's single plugin hook schema.

## Verification

\`hooks\` pins the schema, the implied async owner, and the raw result seam.
\`async-hooks\` pins exit-2-only wakes, stderr over stdout, the custom prefix and
summary, and the reminder escape. \`runtime-resources\` pins the queued wake
body. Focused 103/103, extended 226/226, tsc 0, build 0, full 2,171/2,171,
chain 768/768, identity \`06c37dbf…\`.
`;
write('research/ports/W119-async-rewake.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W119-01 consumes a plugin command hook's \`asyncRewake\`. The definition implies
the async owner; the owner keeps the run's raw exit code and output, and an
exit code 2 completion carries a wake whose body is the configured prefix (or
\`Stop hook blocking error from command "…":\`) followed by stderr else stdout,
reminder-escaped and credential-redacted, with \`rewakeSummary\` or
\`Stop hook feedback\` as the summary. The runtime queues the body as the owner's
event prompt. Broken-install detection, its dedupe and the trusted-plugin JSON
summary have no local surface. Focused 103/103, extended 226/226, tsc 0,
build 0, full 2,171/2,171, chain 768/768, identity \`06c37dbf…\`.
[W119 record](ports/W119-async-rewake.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W119-01 asyncRewake：S-1（先读源）：插件命令钩子schema 101418（chunk-3cynezh1.js）、m5e 2956018、Ebt 632160、Abt 632770、nkr 2955284、UT 632948/Ait（chunk-hwpb27as.js 43）、zLe 633015、z6t 633021（chunk-sfn1dbxq.js）。S-2（不臆造）：asyncRewake隐式async；仅exit 2唤醒；前缀rewakeMessage或默认Stop hook blocking error from command "…":，输出stderr优先stdout；摘要rewakeSummary或Stop hook feedback；正文UT/Ait提醒转义与zLe凭据脱敏。S-3（边界）：本地钩子无名字，默认前缀引用命令文本；插件JSON摘要需受信插件id，本地不读，只读定义字段且不做300上限规范化；破损脚本检测与去重仅scriptPaths，本地脚本钩子被拒；ranForAccountMemory无对应；唤醒为FIFO事件提示，无priority/stopHookActive/turnAttribution；子代理仅记录完成。S-4（可测）：hooks断言schema/隐式异步/原始结果；async-hooks断言仅exit 2、stderr优先、自定义前缀与摘要、提醒转义；runtime-resources断言入队正文。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据JSON。验证：聚焦103/103、扩展226/226、tsc 0、build 0、全量2,171/2,171、链768/768、notices 0、索引不变、身份06c37dbf…。
`);

replaceOnce('research/FEATURES.md',
  "; W118 applies an allow answer's updatedPermissions to a session-owned rule/mode state and refuses unrepresentable tightenings |",
  "; W118 applies an allow answer's updatedPermissions to a session-owned rule/mode state and refuses unrepresentable tightenings; W119 wakes the model on an asyncRewake command hook's exit 2 with its configured summary and prefix after purifying the hook output |");

replaceAll('research/CURRENT.md',
  '；W118消费PermissionRequest允许的updatedPermissions（Bz校验、会话规则/模式生效、不可表示的限制拒绝调用；无设置写入）；完整消费者与脚本语义仍待处理',
  '；W118消费PermissionRequest允许的updatedPermissions（Bz校验、会话规则/模式生效、不可表示的限制拒绝调用；无设置写入）；W119消费插件命令钩子的asyncRewake（隐式async、exit 2唤醒、rewakeMessage前缀与rewakeSummary摘要、正文提醒转义与凭据脱敏；破损脚本检测/去重与插件JSON摘要本地无对应）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-18T01:10:00Z', 'package', 'W119-01 asyncRewake command hooks',
    '插件schema 101418（chunk-3cynezh1.js）、m5e 2956018、Ebt/Abt 632160/632770、UT/zLe/z6t 632948/633015/633021（chunk-sfn1dbxq.js）',
    '隐式async；exit 2唤醒；stderr优先；默认前缀引用命令；摘要rewakeSummary/Stop hook feedback；提醒转义与凭据脱敏',
    'hooks/async-hooks/runtime-resources 103/103；扩展226/226；tsc 0；build 0；全量2,171/2,171；链768/768'],
  ['2026-10-18T01:13:00Z', 'decision', 'W119-01 本地适配',
    '本地无钩子名与插件id；脚本钩子构建拒绝；无account-memory工具',
    '破损检测与去重不移植；插件JSON摘要路径不读；唤醒为FIFO事件提示',
    '.audit/w119-01-full.txt'],
  ['2026-10-18T01:16:00Z', 'verification', 'W119-01 验收：聚焦103/103、扩展226/226、tsc 0、build 0、2,171/2,171、768/768',
    'exit 2唤醒；exit 0/1不唤醒；stderr优先stdout；自定义前缀与摘要；提醒转义；runtime入队正文',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 06c37dbf…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w119-runtime.tsv', tsv + '\n');

write('.audit/w119-runtime.todo.md', `# W119 runtime trail

## W119-01 acceptance (2026-10-18)

- [x] **Source read.** The plugin schema fields, the exit-2 consumer, the
  broken-install detector and dedupe, the summary sources and cap, the
  reminder/credential purification, and the notification queue call.
- [x] **Port.** Schema fields, implied async, the raw command-result seam, the
  exit-2 wake on the completion, and the runtime's wake body.
- [x] **Bounds.** Command text in place of a hook name; definition summary only;
  no broken-install or dedupe surface; FIFO event prompt; child agents observe
  the completion without a wake queue.
- [x] **Gates.** focused 103/103, extended 226/226, tsc 0, build 0, full
  2,171/2,171, chain 768/768, notices 0, source index unchanged, identity
  \`06c37dbf…\`.
- [ ] Remaining C-6: the rest of the hook output consumers and script semantics.
`);

const evidence = {
  schema: 'W119AsyncRewakeEvidence.v1',
  package: 'W119-01 — asyncRewake command hooks',
  date: '2026-10-18',
  question: 'How does an asyncRewake command hook wake the model?',
  answer: 'asyncRewake implies the async owner. The owner keeps the run\'s raw exit code, stdout and stderr; an exit code 2 completion carries a wake whose body is the configured rewakeMessage prefix (default Stop hook blocking error from command "<command>":) followed by stderr else stdout, reminder-escaped and credential-redacted, with rewakeSummary (default Stop hook feedback) as the summary. The runtime queues that body as the owner\'s event prompt instead of the generic completion record.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    pluginSchema: { module: 'extracted-v2/modules/chunk-3cynezh1.js', offsets: [101418] },
    consumer: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offsets: [2956018, 632160, 632770, 2955284, 632948, 633015, 633021] },
    reminderEscape: { module: 'extracted-v2/modules/chunk-hwpb27as.js', offsets: [43] },
  },
  behavior: {
    asyncRewakeImpliesAsync: true,
    wakeOnlyOnExitTwo: true,
    stderrPreferredOverStdout: true,
    defaultSummary: 'Stop hook feedback',
    defaultPrefixQuotesCommand: true,
    reminderEscape: true,
    credentialRedaction: true,
    runtimeQueuesWakeBody: true,
    brokenInstallDedupePorted: false,
    pluginJsonSummaryPorted: false,
    notificationPriorityAndAttributionPorted: false,
  },
  adaptations: [
    'Local command hooks have no hook name; the default prefix quotes the command text.',
    'The trusted-plugin stdout JSON rewakeSummary path has no local plugin identity; only the definition field is read, without the JSON path\'s 300-unit normalization.',
    'Broken-install detection and dedupe need script hooks\' scriptPaths; this build refuses script hooks and command hooks carry none.',
    'ranForAccountMemory and its withheld-output branch have no local counterpart.',
    'The wake is a FIFO event prompt, not a task notification with priority, stopHookActive and turnAttribution; child-agent registries journal the completion without a wake queue.',
  ],
  changes: [
    { file: 'src/hooks.ts', change: 'schema fields, implied async, raw command result seam', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/async-hooks.ts', change: 'exit-2 wake on the completion', sha256: sha(read('src/async-hooks.ts')) },
    { file: 'src/runtime.ts', change: 'wake body as the owner event prompt', sha256: sha(read('src/runtime.ts')) },
    { file: 'test/hooks.test.ts', change: 'schema, implication and raw result tests', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'test/async-hooks.test.ts', change: 'wake condition, text and escape tests', sha256: sha(read('test/async-hooks.test.ts')) },
    { file: 'test/runtime-resources.test.ts', change: 'queued wake body test', sha256: sha(read('test/runtime-resources.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W119', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W119', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W119-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W119-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '103/103 (hooks, async-hooks, runtime-resources, hook-groups, hook-transports)',
    extended: '226/226',
    build: 'exit 0',
    full: '2,171/2,171',
    chain: '768/768',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '06c37dbf84a7b7c228acdfdc566caa8c56d390b1c0376b64784fe6aabc69c8d5',
  },
  residuals: ['The remaining C-6 hook output consumers and script semantics are unconsumed.'],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with the remaining hook output consumers.',
};
write('research/ports/W119-async-rewake-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW119-01 consumes a plugin command hook',
  'research/coding-standard.md': '\n2026-10-17 W119-01 ',
  'research/FEATURES.md': 'W119 wakes the model on an asyncRewake',
  'research/ports/W119-async-rewake.md': '# W119 — asyncRewake command hooks',
  '.audit/w119-runtime.todo.md': '\n## W119-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
