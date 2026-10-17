// W110-01 record: PreModelSwitch permissionDecision.
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

const note = `# W110 — PreModelSwitch permissionDecision

## Source position

The PreModelSwitch output schema is \`hookSpecificOutput: {hookEventName:
"PreModelSwitch", permissionDecision?: "allow" | "deny" | "ask",
permissionDecisionReason?: string}\` (chunk-n3ykh62m.js offset 392413). The
runner \`oXr\` (chunk-sfn1dbxq.js offset 2937531) maps a deny to a blocking
error with reason \`permissionDecisionReason ?? "Blocked by hook"\`, records any
ask with its reason, treats allow as \`skipConfirm\`, and returns block before
ask when both appear. The user-facing texts are \`RWe\` (chunk-hh0bresc.js
offset 9514, "\`Model switch blocked by a PreModelSwitch hook\`" plus
": <reason>") and \`jU\` (offset 9782, "\`Model switch to <model> was blocked by
a PreModelSwitch hook\`"). The interactive picker turns an ask into a
confirmation ("A PreModelSwitch hook asked you to confirm",
chunk-24k7d6mw.js offset 859352; ask branch at chunk-f5wjy38g.js offset 21336).

## Port

\`applyJsonOutput\` records allow/deny/ask and the reason for PreModelSwitch
with deny-wins precedence. The interactive \`/model\` path renders the recovered
deny text, asks the user to confirm on ask (declining renders the recovered
\`jU\` text), and keeps the existing block/stop check for top-level blocks.

## Adaptation

The source's \`skipConfirm\` from an allow feeds an expensive-model confirmation
dialog this runtime does not have, so the flag has no consumer. The source also
has command and SDK flows that turn an ask into a block with a "run /model
interactively to confirm" parenthetical; this runtime's only switch surface is
interactive, so it takes the picker's confirmation branch.

## Verification

\`hooks\` asserts allow/ask/deny parsing, deny precedence across hooks, an absent
reason key, and that another event's permissionDecision is ignored.
\`interactive\` asserts deny and declined ask leave the model unchanged with the
recovered texts, and an accepted ask switches it. Focused 67/67, tsc 0, build
0, full 2,148/2,148, chain 767/767, notices 0, identity \`dbe3098b…\`.
`;
write('research/ports/W110-modelswitch-decision.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W110-01 consumes PreModelSwitch \`permissionDecision\`. Deny blocks with the
recovered text, ask asks the user to confirm and declining blocks with the
recovered model-specific text, and allow records the answer without a local
skip-confirm consumer. Focused 67/67, tsc 0, build 0, full 2,148/2,148, chain
767/767, identity \`dbe3098b…\`.
[W110 record](ports/W110-modelswitch-decision.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W110-01 PreModelSwitch permissionDecision：S-1（先读源）：输出 schema 392413（chunk-n3ykh62m.js）、runner oXr 2937531（chunk-sfn1dbxq.js）、RWe 9514 与 jU 9782（chunk-hh0bresc.js）、确认文案 859352（chunk-24k7d6mw.js）、ask 分支 21336（chunk-f5wjy38g.js）。S-2（不臆造）：deny 优先于 ask；reason 缺省为 "Blocked by hook"；ask 走确认，拒绝用 jU 文案；allow 不阻断。S-3（边界）：源 allow 的 skipConfirm 在本构建无昂贵模型确认可跳过；命令/SDK 流的 ask 转阻断文案不适用，本构建仅交互切换面。S-4（可测）：hooks 断言解析、跨钩子 deny 优先、缺省键不出现、他事件忽略；interactive 断言 deny/拒绝保持模型并显示恢复文案，接受后切换。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：聚焦 67/67、tsc 0、build 0、全量 2,148/2,148、链 767/767、notices 0、索引不变、身份 dbe3098b…。
`);

replaceOnce('research/FEATURES.md',
  'W109 injects Setup `additionalContext` into the startup request |',
  'W109 injects Setup `additionalContext` into the startup request; W110 honors the PreModelSwitch `permissionDecision` (deny blocks, ask confirms, allow records) |');

replaceAll('research/CURRENT.md',
  '；W109消费Setup的additionalContext（仅startup，进入首个请求）；完整消费者与脚本语义仍待处理',
  '；W109消费Setup的additionalContext（仅startup，进入首个请求）；W110消费PreModelSwitch的permissionDecision（deny阻断、ask确认、allow记录）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-17T21:08:00Z', 'package', 'W110-01 PreModelSwitch permissionDecision',
    'schema 392413、oXr 2937531、RWe 9514、jU 9782、确认文案 859352、ask 分支 21336',
    'deny优先；缺省reason=Blocked by hook；ask确认；拒绝用jU文案；allow不阻断',
    'hooks/interactive 67/67；tsc 0；build 0；全量 2,148/2,148；链 767/767'],
  ['2026-10-17T21:10:00Z', 'decision', 'W110-01 本地适配',
    '源allow的skipConfirm无本地昂贵模型确认消费者；命令/SDK流的ask阻断文案不适用',
    '仅交互切换面，走picker的确认分支',
    '.audit/w110-01-full.txt'],
  ['2026-10-17T21:12:00Z', 'verification', 'W110-01 验收：聚焦 67/67、tsc 0、build 0、2,148/2,148、767/767',
    'deny与拒绝ask保持模型并显示恢复文案；接受ask切换',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity dbe3098b…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w110-runtime.tsv', tsv + '\n');

write('.audit/w110-runtime.todo.md', `# W110 runtime trail

## W110-01 acceptance (2026-10-17)

- [x] **Source read.** Output schema, the runner's deny/ask/allow mapping and
  precedence, the two user-facing texts, and the picker's ask confirmation.
- [x] **Port.** PreModelSwitch decision parsing, deny-wins merge, deny text,
  ask confirmation, decline text.
- [x] **Bounds.** allow records without blocking; skip-confirm has no local
  consumer; other events do not set the fields.
- [x] **Gates.** focused 67/67, tsc 0, build 0, full 2,148/2,148, chain
  767/767, notices 0, source index unchanged, identity \`dbe3098b…\`.
- [ ] Remaining C-6: the rest of the script semantics.
`);

const evidence = {
  schema: 'W110ModelSwitchDecisionEvidence.v1',
  package: 'W110-01 — PreModelSwitch permissionDecision',
  date: '2026-10-17',
  question: 'How do PreModelSwitch hook allow, deny and ask decisions affect a model switch?',
  answer: 'Deny becomes a blocking error with the hook reason or "Blocked by hook"; block wins over ask when both appear. Ask records the reason and requires confirmation, declining yields the model-specific blocked text. Allow records the answer and skips the expensive-model confirmation when one exists.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    schema: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', offset: 392413 },
    runner: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'oXr', offset: 2937531 },
    blockedText: { module: 'extracted-v2/modules/chunk-hh0bresc.js', symbol: 'RWe', offset: 9514 },
    switchBlockedText: { module: 'extracted-v2/modules/chunk-hh0bresc.js', symbol: 'jU', offset: 9782 },
    confirmText: { module: 'extracted-v2/modules/chunk-24k7d6mw.js', offset: 859352 },
    askBranch: { module: 'extracted-v2/modules/chunk-f5wjy38g.js', offset: 21336 },
  },
  behavior: {
    event: 'PreModelSwitch',
    decisions: ['allow', 'deny', 'ask'],
    denyWins: true,
    defaultReason: 'Blocked by hook',
    askRequiresConfirmation: true,
  },
  adaptations: [
    'skipConfirm from an allow feeds an expensive-model confirmation dialog this runtime does not have.',
    'Command and SDK flows turn ask into a block with a parenthetical; this runtime has only the interactive surface, so it confirms.',
    'Deny is not marked blocked in the hook result; the switch consumer renders the recovered prefix, keeping the raw reason for other callers.',
  ],
  changes: [
    { file: 'src/hooks.ts', change: 'PreModelSwitch decision parse', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/interactive.ts', change: 'deny text, ask confirmation, decline text', sha256: sha(read('src/interactive.ts')) },
    { file: 'test/hooks.test.ts', change: 'parse and precedence assertions', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'test/interactive.test.ts', change: 'deny/decline/accept switch assertions', sha256: sha(read('test/interactive.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W110', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W110', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W110-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W110-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '67/67 (hooks, interactive)',
    build: 'exit 0',
    full: '2,148/2,148',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'dbe3098bc7e710e3e7fae0553c4e9d9f5db5598407d2fe0c06aec9b5152dc9aa',
  },
  residuals: [
    'The remaining C-6 script semantics are unconsumed.',
    'skipConfirm and the command/SDK ask-blocking flows have no local analogue.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with the remaining script semantics.',
};
write('research/ports/W110-modelswitch-decision-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW110-01 consumes PreModelSwitch',
  'research/coding-standard.md': '\n2026-10-17 W110-01 ',
  'research/FEATURES.md': 'W110 honors the PreModelSwitch',
  'research/ports/W110-modelswitch-decision.md': '# W110 — PreModelSwitch permissionDecision',
  '.audit/w110-runtime.todo.md': '\n## W110-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
