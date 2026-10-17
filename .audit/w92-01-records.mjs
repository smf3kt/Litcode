// W92-01 record: permission-prompt Notification, runtime raise correction.
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

const note = `# W92 — permission-prompt Notification

## Source position

\`O9n\` (chunk-fyhzvvp0.js offset 4925) arms a timer while a permission
prompt is pending. The timer's delay is \`aVt\` = 6000 ms (chunk-sfn1dbxq.js
offset 2915839); when it fires it raises \`S0\` (chunk-sfn1dbxq.js offset
2941901) with \`{message, notification_type}\` — the message is
\`Claude needs your permission to use <tool>\` and the type is
\`permission_prompt\`. The timer is unref'd and the returned function clears
it when the prompt resolves; \`CLAUDE_CODE_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS\`
skips the whole arm. The permission request site calls it at
chunk-fyhzvvp0.js offset 10393.

## Port

\`notifyPermissionPrompt\` ports \`O9n\`: it returns a cancel function, skips
under the disable flag, arms an unref'd 6000 ms timer and emits
\`{message, notification_type: "permission_prompt"}\`. The interactive
permission callback arms it around the prompt and cancels it in \`finally\`,
so an answer within six seconds raises nothing.

## Correction

The prior interactive raise \`{source: "runtime", prompt}\` on runtime event
prompts had no source caller: \`S0\` is called for permission prompts,
elicitation responses/completions and plugin notifications, not for internal
event-injection prompts. The raise and the queue's \`notification\` flag are
removed; the recovered permission-prompt notification replaces them.

## Adaptation

The source message names its product. This runtime keeps its neutral text
(\`Permission needed to use <tool>\`); the hook's \`notification_type\`,
timing, cancellation and disable flag are the source's.

## Verification

\`interactive\` 8/8: the timer stays silent at 5999 ms, emits the payload at
6000 ms, a cancelled prompt never emits, and the disable flag suppresses the
arm. tsc 0; build 0; full 2,121/2,121; chain 767/767; notices 0; source index
unchanged; identity \`8ff650c8…\`.
`;
write('research/ports/W92-permission-notification.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W92-01 ports the permission-prompt Notification. While a prompt is pending,
\`notifyPermissionPrompt\` arms the source's unref'd six-second timer and
raises \`{message, notification_type: "permission_prompt"}\`; an answer cancels
it and \`CLAUDE_CODE_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS\` suppresses the
arm. The prior Notification raise for internal runtime event prompts is
removed because \`S0\` has no such caller. \`interactive\` 8/8, tsc 0, build 0,
full 2,121/2,121, chain 767/767, identity \`8ff650c8…\`.
[W92 record](ports/W92-permission-notification.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W92-01 权限提示通知：S-1（先读源）：读取 chunk-fyhzvvp0.js 的 O9n 4925 与调用点 10393、chunk-sfn1dbxq.js 的 aVt=6000 2915839 与 S0 2941901。S-2（不臆造）：仅权限提示使用 permission_prompt；消息、类型、取消与禁用开关按源；内部事件提示不再伪造 Notification。S-3（边界）：消息保持中性产品名；延迟固定 6000ms。S-4（可测）：新增 5999/6000ms、取消与禁用开关用例。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON，纠正记录在端口内。验证：interactive 8/8、tsc 0、build 0、全量 2,121/2,121、链 767/767、身份 8ff650c8…。
`);

replaceOnce('research/FEATURES.md',
  'reporting the single local `Project` tier |',
  'reporting the single local `Project` tier; W92 raises the recovered permission-prompt Notification after six seconds (`permission_prompt`, cancellable, disabled by `CLAUDE_CODE_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS`) and removes the invented Notification raise for internal runtime event prompts |');

replaceAll('research/CURRENT.md',
  '完整消费者与脚本语义仍待处理',
  'W92完成权限提示通知（6秒后permission_prompt、可取消、禁用开关；内部事件提示不再伪造Notification）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-18T03:40:00Z', 'package', 'W92-01 权限提示通知',
    'O9n 4925、aVt 2915839、S0 2941901、调用点 10393；interactive 权限回调',
    '6秒后 permission_prompt；取消与禁用开关；消息保持中性',
    'interactive 8/8；tsc 0；build 0；全量 2,121/2,121；链 767/767'],
  ['2026-10-18T03:42:00Z', 'decision', 'W92-01 纠正',
    '内部 runtime 事件提示的 {source,prompt} Notification 无源调用点；S0 仅权限/elicitation/插件通知，移除并加权限通知',
    '残余：完整消费者',
    '.audit/w92-01-full.txt'],
  ['2026-10-18T03:45:00Z', 'verification', 'W92-01 验收：interactive 8/8、tsc 0、build 0、2,121/2,121、767/767',
    '5999ms 静默、6000ms 发载荷、取消不发、禁用开关不装载',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 8ff650c8…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w92-runtime.tsv', tsv + '\n');

write('.audit/w92-runtime.todo.md', `# W92 runtime trail

## W92-01 acceptance (2026-10-18)

- [x] **Source read.** \`O9n\`, \`aVt\`, \`S0\` and the permission call site.
- [x] **Port.** Six-second cancellable \`permission_prompt\` notification with
  the disable flag.
- [x] **Correction.** The runtime event-prompt Notification raise is removed;
  \`S0\` has no such caller.
- [x] **Gates.** interactive 8/8, tsc 0, build 0, full 2,121/2,121, chain
  767/767, notices 0, source index unchanged, identity \`8ff650c8…\`.
- [ ] Remaining C-6: full consumers.
`);

const evidence = {
  schema: 'W92PermissionNotificationEvidence.v1',
  package: 'W92-01 — permission-prompt Notification',
  date: '2026-10-18',
  question: 'When does the recovered build raise Notification for a permission prompt, and did the product raise it anywhere the source does not?',
  answer: 'It raises after 6000 ms with message and notification_type permission_prompt, cancellable and disabled by CLAUDE_CODE_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS. The product now ports that and removes its raise for internal runtime event prompts, which has no source caller.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    permissionTimer: { module: 'extracted-v2/modules/chunk-fyhzvvp0.js', symbol: 'O9n', offset: 4925 },
    callSite: { module: 'extracted-v2/modules/chunk-fyhzvvp0.js', offset: 10393 },
    delay: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', constant: 'aVt', offset: 2915839, milliseconds: 6000 },
    builder: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'S0', offset: 2941901,
      fields: ['message', 'title', 'notification_type'] },
  },
  behavior: {
    delayMs: 6000,
    notificationType: 'permission_prompt',
    cancellation: 'the returned clearTimeout runs when the prompt resolves',
    disableFlag: 'CLAUDE_CODE_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS',
    message: 'Permission needed to use <tool> (neutral adaptation)',
    removed: 'the internal runtime event-prompt raise and its queue notification flag',
  },
  changes: [
    { file: 'src/interactive.ts', change: 'permission notification and runtime raise removal', sha256: sha(read('src/interactive.ts')) },
    { file: 'test/interactive.test.ts', change: 'timer, cancel and disable-flag test', sha256: sha(read('test/interactive.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W92', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W92', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W92-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W92-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    interactive: '8/8',
    build: 'exit 0',
    full: '2,121/2,121',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '8ff650c88f8e4edc7547c6d94f884a8df978be457ed4bbc4fa96451fa51a60e8',
  },
  residuals: [
    'Elicitation response/completion and plugin notification raises remain unported.',
    'Full hook consumers remain C-6 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with full consumers.',
};
write('research/ports/W92-permission-notification-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW92-01 ports the permission-prompt Notification',
  'research/coding-standard.md': '\n2026-10-18 W92-01 ',
  'research/FEATURES.md': 'W92 raises the recovered permission-prompt Notification',
  'research/ports/W92-permission-notification.md': '# W92 — permission-prompt Notification',
  '.audit/w92-runtime.todo.md': '\n## W92-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
