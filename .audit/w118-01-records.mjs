// W118-01 record: PermissionRequest allow updatedPermissions.
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

const note = `# W118 — PermissionRequest allow updatedPermissions

## Source position

The PermissionRequest allow arm carries \`updatedInput\` and
\`updatedPermissions\`; the list is the schema \`Bz\` (chunk-n3ykh62m.js offset
389976, union at 390059): addRules/replaceRules/removeRules
\`{rules: [{toolName, ruleContent?}], behavior: allow|deny|ask, destination}\`,
setMode \`{mode, destination}\` and addDirectories/removeDirectories. setMode's
mode passes through \`rh\`, which maps the retired \`manual\` to \`default\`
(chunk-a60ee1ne.js offsets 678 and 782), and the output schema validates the
whole stdout object, so one malformed entry makes every field of that output
unused (chunk-n3ykh62m.js offset 395547).

The launcher consumer applies an adopted allow's updates to the session
permission context and persists them (\`CUt\`, chunk-fyhzvvp0.js offset 3459,
through \`q\` offset 3158 and the web filter \`WK\` in chunk-nkb63p1y.js offset
3840); the native fold reads the first allow/deny answer (\`n2e\`, offset
15469). The strict consumer refuses the call when a deny/ask rule cannot be in
force (\`Bnr\` chunk-sfn1dbxq.js offset 548142, text \`AXn\` offset 544491), and
\`s9r\` (offset 546964) drops unsupported update kinds. The classic answer is
checked by \`Fr\`/\`Lr\` (chunk-nyce03br.js [28640,29566) and [29566,30208)).

## Port

\`permissionUpdateSchema\` copies \`Bz\`; \`applyPermissionUpdates\` adds the
answer's rules and mode to a session-owned state (\`Session.permissionUpdates\`)
and the decision path merges that state with the settings policy: a deny on
either side wins, a session allow satisfies the settings allow list, and a
session ask adds an ask. The answer applies only when it is the adopted allow
and only after the updatedInput re-check, before the call runs.
\`runHooks\` validates the list before any field of that output is read; the
classic chain answer is validated with the same schema before its fields are
read.

## Adaptation

- No settings writer: every destination applies to the in-memory session state
  and dies with the session; the source persists through \`O1\`.
- Rules are the product's tool-name patterns. A deny or ask rule that carries
  \`ruleContent\` cannot be represented, so the call is refused with the
  source's strict-consumer text (\`AXn\`) instead of running without it. An
  allow rule with \`ruleContent\`, a setMode this product cannot express
  (\`auto\`, \`dontAsk\`) and directory updates are dropped.
- replaceRules/removeRules address the session store; the source addresses the
  destination's rule set, of which the settings policy is a separate part here.
- The WebFetch/WebSearch loosening filter (\`PDn\`, chunk-nkb63p1y.js offset
  3223) is inactive: its predicate \`Ure\` (offset 1801) needs a Projects or
  remote-execution session this product has no counterpart for. The tool-level
  suppression branches (\`eK\` offset 3316759, \`Zq\` offset 3316685) likewise
  have no local flags.

## Verification

\`permissions\` pins the schema, the merged decisions, replace/remove, the
refusal and the drops. \`hooks\` pins whole-output invalidation. \`agent-lifecycle\`
pins a setMode answer that refuses a later call, a deny rule that survives the
answer, and the refused call for an unrepresentable tightening. Focused
131/131, extended 246/246, tsc 0, build 0, full 2,168/2,168, chain 768/768,
identity \`b50e00a3…\`.
`;
write('research/ports/W118-permission-updates.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W118-01 consumes a PermissionRequest allow's \`updatedPermissions\`. The list is
validated with the recovered \`Bz\` schema, and the adopted answer's rules and
mode join a session-owned permission state consulted by every decision; an
unrepresentable deny or ask rule refuses the call with the source's own text,
while allow rules with content, unsupported modes and directories are dropped.
No settings writer exists, so the updates die with the session. Focused
131/131, extended 246/246, tsc 0, build 0, full 2,168/2,168, chain 768/768,
identity \`b50e00a3…\`. [W118 record](ports/W118-permission-updates.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W118-01 updatedPermissions：S-1（先读源）：Bz 389976/390059（chunk-n3ykh62m.js）、答案臂395547、CH/rh 678/782（chunk-a60ee1ne.js）、hkt 558460、s9r 546964、Bnr 548142、AXn 544491（chunk-sfn1dbxq.js）、CUt 3459/q 3158、n2e 15469（chunk-fyhzvvp0.js）、PDn 3223/WK 3840/Ure 1801（chunk-nkb63p1y.js）、Fr/Lr（chunk-nyce03br.js）。S-2（不臆造）：仅采纳的allow携带；整输出严格校验；会话态合并设置策略（deny双胜、session allow满足allow list、session ask追加）；不可表示的deny/ask带ruleContent拒绝调用；ruleContent allow/setMode auto|dontAsk/目录更新丢弃。S-3（边界）：无设置写入，所有destination仅内存会话态；replace/remove针对会话存储；Web过滤与工具级抑制分支本地无对应。S-4（可测）：permissions断言schema/合并/replace/remove/拒绝/丢弃；hooks断言整输出失效；agent-lifecycle断言模式生效、deny规则存活、不可表示限制拒绝调用。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据JSON。验证：聚焦131/131、扩展246/246、tsc 0、build 0、全量2,168/2,168、链768/768、notices 0、索引不变、身份b50e00a3…。
`);

replaceOnce('research/FEATURES.md',
  'W116 raises DirectoryAdded as a documented slash_command hook on relocation and displays its failed output; W117 consumes PermissionRequest deny interrupt by aborting the turn controller |',
  'W116 raises DirectoryAdded as a documented slash_command hook on relocation and displays its failed output; W117 consumes PermissionRequest deny interrupt by aborting the turn controller; W118 applies an allow answer\'s updatedPermissions to a session-owned rule/mode state and refuses unrepresentable tightenings |');

replaceAll('research/CURRENT.md',
  '；W116以文档slash_command生产者提升DirectoryAdded并显示失败输出（本地无/add-dir与register_repo_root）；W117消费PermissionRequest拒绝的interrupt（首个非allow决定，日志后中止回合controller）；完整消费者与脚本语义仍待处理',
  '；W116以文档slash_command生产者提升DirectoryAdded并显示失败输出（本地无/add-dir与register_repo_root）；W117消费PermissionRequest拒绝的interrupt（首个非allow决定，日志后中止回合controller）；W118消费PermissionRequest允许的updatedPermissions（Bz校验、会话规则/模式生效、不可表示的限制拒绝调用；无设置写入）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-18T00:35:00Z', 'package', 'W118-01 PermissionRequest allow updatedPermissions',
    'Bz 389976（chunk-n3ykh62m.js）、rh 782（chunk-a60ee1ne.js）、CUt 3459（chunk-fyhzvvp0.js）、s9r/Bnr/AXn（chunk-sfn1dbxq.js）、PDn/WK（chunk-nkb63p1y.js）',
    '严格列表校验；会话态合并；deny双胜；session allow满足allow list；不可表示deny/ask拒绝调用',
    'permissions/hooks/agent-lifecycle 131/131；扩展246/246；tsc 0；build 0；全量2,168/2,168；链768/768'],
  ['2026-10-18T00:38:00Z', 'decision', 'W118-01 本地适配',
    '无设置写入：所有destination仅会话内存；规则仅为工具名模式；Web过滤与工具级抑制无对应',
    'ruleContent deny/ask用源AXn拒绝；ruleContent allow/setMode auto|dontAsk/目录更新丢弃',
    '.audit/w118-01-full.txt'],
  ['2026-10-18T00:42:00Z', 'verification', 'W118-01 验收：聚焦131/131、扩展246/246、tsc 0、build 0、2,168/2,168、768/768',
    '模式更新即时生效；deny规则跨调用存活；不可表示限制阻止调用',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity b50e00a3…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w118-runtime.tsv', tsv + '\n');

write('.audit/w118-runtime.todo.md', `# W118 runtime trail

## W118-01 acceptance (2026-10-18)

- [x] **Source read.** The answer schema and its whole-output validation, the
  launcher consumer and its strip path, the strict consumer's refusal, and the
  classic answer check.
- [x] **Port.** Session permission state, schema validation in the runner, the
  merged decision, adoption before the call runs.
- [x] **Bounds.** No settings writer; tool-name rules only; unrepresentable
  tightenings refuse the call; allow content, unsupported modes and directories
  drop.
- [x] **Gates.** focused 131/131, extended 246/246, tsc 0, build 0, full
  2,168/2,168, chain 768/768, notices 0, source index unchanged, identity
  \`b50e00a3…\`.
- [ ] Remaining C-6: the rest of the hook output consumers and script semantics.
`);

const evidence = {
  schema: 'W118PermissionUpdatesEvidence.v1',
  package: 'W118-01 — PermissionRequest allow updatedPermissions',
  date: '2026-10-18',
  question: 'How does a PermissionRequest allow answer\'s updatedPermissions affect the session?',
  answer: 'The list is validated as a whole against the recovered Bz schema; the adopted allow applies its rules and mode to session-owned permission state consulted by every later decision. Rules map to the product\'s tool-name patterns; a deny or ask rule with ruleContent cannot be represented and refuses the call with the source\'s strict-consumer text, while allow rules with content, unsupported modes and directory updates are dropped.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    answerSchema: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', offsets: [389976, 390059, 395547] },
    modes: { module: 'extracted-v2/modules/chunk-a60ee1ne.js', offsets: [678, 782] },
    normalizer: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offsets: [558460] },
    strictStripAndRefusal: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offsets: [546964, 548142, 544491] },
    launcherConsumer: { module: 'extracted-v2/modules/chunk-fyhzvvp0.js', offsets: [3459, 3158, 15469] },
    webFilter: { module: 'extracted-v2/modules/chunk-nkb63p1y.js', offsets: [3223, 3840, 1801] },
    classicValidation: { module: 'extracted-v2/modules/chunk-nyce03br.js', ranges: [[28640, 29566], [29566, 30208]] },
    suppressions: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offsets: [3316759, 3316685] },
  },
  behavior: {
    adoptedAllowOnly: true,
    wholeOutputInvalidatedByBadEntry: true,
    sessionRulesJoinSettingsRules: true,
    denyDominatesSessionAllow: true,
    sessionAllowSatisfiesAllowList: true,
    sessionAskAddsAsk: true,
    setModeAppliesToSession: true,
    unrepresentableTighteningRefusesCall: true,
    settingsPersistence: false,
  },
  adaptations: [
    'No settings writer: every destination applies to the in-memory session state and dies with the session.',
    'Rules are tool-name patterns; deny/ask rules carrying ruleContent refuse the call (source AXn), allow rules with content are dropped.',
    'setMode auto and dontAsk have no local mode and are dropped; directory updates have no local concept and are dropped.',
    'replaceRules/removeRules address the session store rather than a destination-keyed rule store.',
    'The WebFetch/WebSearch loosening filter and the tool-level suppression branches have no local activation surface.',
  ],
  changes: [
    { file: 'src/permissions.ts', change: 'update schema, session state, merged decision', sha256: sha(read('src/permissions.ts')) },
    { file: 'src/hooks.ts', change: 'whole-output validation and typed updates', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/agent.ts', change: 'adoption before the call and classic list validation', sha256: sha(read('src/agent.ts')) },
    { file: 'src/session.ts', change: 'session permission state', sha256: sha(read('src/session.ts')) },
    { file: 'src/plugin-chain-classic-raise.ts', change: 'classic answer type', sha256: sha(read('src/plugin-chain-classic-raise.ts')) },
    { file: 'test/permissions.test.ts', change: 'schema and merge tests', sha256: sha(read('test/permissions.test.ts')) },
    { file: 'test/hooks.test.ts', change: 'whole-output invalidation test', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'adoption, deny survival, refusal tests', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W118', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W118', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W118-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W118-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '131/131 (permissions, hooks, agent-lifecycle)',
    extended: '246/246',
    build: 'exit 0',
    full: '2,168/2,168',
    chain: '768/768',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'b50e00a3424a7095ffa5ab479f197a4f5a16fd3a350770751c83f52eab636305',
  },
  residuals: ['The remaining C-6 hook output consumers and script semantics are unconsumed.'],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with the remaining hook output consumers.',
};
write('research/ports/W118-permission-updates-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW118-01 consumes a PermissionRequest allow',
  'research/coding-standard.md': '\n2026-10-17 W118-01 ',
  'research/FEATURES.md': 'W118 applies an allow answer',
  'research/ports/W118-permission-updates.md': '# W118 — PermissionRequest allow updatedPermissions',
  '.audit/w118-runtime.todo.md': '\n## W118-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
