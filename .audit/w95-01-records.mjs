// W95-01 record: UserPromptExpansion payload.
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

const note = `# W95 — UserPromptExpansion payload

## Source position

\`VYr\` (chunk-sfn1dbxq.js offset 2947732) builds
\`{expansion_type, command_name, command_args, command_source, prompt}\`; the
schema fixes \`expansion_type\` to \`slash_command\`/\`mcp_prompt\` and requires
name, args and prompt (chunk-r2vtj1kh.js offset 194968). The one call site
(chunk-htgmc2p1.js offset 38795) raises it from the skill-expansion path with
the typed arguments and the reconstructed command text (\`/name args\`).

## Port

\`Agent.run\` takes an optional expansion descriptor and raises
\`UserPromptExpansion\` only when one is supplied, with the recovered four
fields. The interactive slash-command path supplies the canonical skill name,
the typed arguments and the reconstructed command text for both the executed
and the expanded skill paths.

## Correction

The product previously raised \`{prompt, source: "user"}\` for every prompt,
not only expansions. That payload lacked every required expansion field and
made the event fire on plain prompts and on \`/attach\`; the attachments test
that relied on the rewrite now asserts the hook stays silent and the original
task text reaches the model.

## Adaptation

\`command_source\` stays unset: this runtime's skill catalog does not record the
source the source build reports. A forked skill execution that runs inside the
skill runtime does not carry expansion metadata yet.

## Verification

\`agent-lifecycle\` 38/38: a plain prompt raises nothing; an expansion carries
the four fields and its \`updatedPrompt\`/\`additionalContext\` reach the model
request. \`interactive\` 8/8: \`/greet world\` and \`/auto z\` raise the canonical
command names and command text. \`attachments\` 2/2 with the corrected
silence assertion. tsc 0; build 0; full 2,124/2,124; chain 767/767; notices 0;
source index unchanged; identity \`50e58886…\`.
`;
write('research/ports/W95-user-prompt-expansion.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W95-01 ports the UserPromptExpansion payload. The event is raised only when
\`Agent.run\` receives an expansion descriptor, carrying \`expansion_type\`,
\`command_name\`, \`command_args\` and the reconstructed command text; the
interactive slash-command path supplies them. The prior per-prompt
\`{prompt, source}\` raise is removed, and the attachments test now asserts the
hook stays silent for \`/attach\`. \`agent-lifecycle\` 38/38, \`interactive\` 8/8,
\`attachments\` 2/2, tsc 0, build 0, full 2,124/2,124, chain 767/767, identity
\`50e58886…\`. [W95 record](ports/W95-user-prompt-expansion.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W95-01 UserPromptExpansion 载荷：S-1（先读源）：读取 chunk-sfn1dbxq.js 的 VYr 2947732 与调用点 chunk-htgmc2p1.js 38795、chunk-r2vtj1kh.js 的字段枚举 194968（UTF-16）。S-2（不臆造）：仅展开事件触发；字段为 expansion_type/command_name/command_args/prompt；prompt 为按规范名重建的命令文本。S-3（边界）：command_source 因本地无技能来源目录而省略；技能运行时内的 fork 执行尚未携带展开元数据。S-4（可测）：普通提示不触发、展开四项字段、updatedPrompt/additionalContext 进入模型请求；interactive 断言 greet/auto；attachments 改为静默断言。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON，纠正记录在端口内。验证：agent-lifecycle 38/38、interactive 8/8、attachments 2/2、tsc 0、build 0、全量 2,124/2,124、链 767/767、身份 50e58886…。
`);

replaceOnce('research/FEATURES.md',
  'and leaves `background_tasks`/`session_crons` unwired |',
  'and leaves `background_tasks`/`session_crons` unwired; W95 raises UserPromptExpansion only for an actual expansion with `expansion_type`, `command_name`, `command_args` and the reconstructed command text (plain prompts and `/attach` no longer raise it) |');

replaceAll('research/CURRENT.md',
  '完整消费者与脚本语义仍待处理',
  'W95完成UserPromptExpansion载荷（仅真实展开触发；expansion_type/command_name/command_args/prompt；普通提示与/attach不再触发）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-18T05:15:00Z', 'package', 'W95-01 UserPromptExpansion 载荷',
    'VYr 2947732、调用点 38795、字段枚举 194968；Agent.run expansion 参数与 interactive 斜杠命令路径',
    '仅展开触发；四项字段；updatedPrompt/additionalContext 生效',
    'agent-lifecycle 38/38；interactive 8/8；attachments 2/2；tsc 0；build 0；全量 2,124/2,124；链 767/767'],
  ['2026-10-18T05:17:00Z', 'decision', 'W95-01 纠正',
    '先前每个提示都发 {prompt,source:"user"}，缺全部必填字段且误触发 /attach；改为仅带展开描述符时触发，attachments 断言静默',
    '残余：command_source 与 fork 技能路径',
    '.audit/w95-01-full.txt'],
  ['2026-10-18T05:20:00Z', 'verification', 'W95-01 验收：agent-lifecycle 38/38、interactive 8/8、attachments 2/2、tsc 0、build 0、2,124/2,124、767/767',
    '普通提示无捕获；展开载荷四项正确且改写进入请求；greet/auto 命令名与文本正确',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 50e58886…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w95-runtime.tsv', tsv + '\n');

write('.audit/w95-runtime.todo.md', `# W95 runtime trail

## W95-01 acceptance (2026-10-18)

- [x] **Source read.** \`VYr\`, its call site and the schema enum.
- [x] **Port.** Expansion-only raise with the four recovered fields.
- [x] **Correction.** The per-prompt raise is gone; attachments now assert
  silence.
- [x] **Bounds.** \`command_source\` unset; the skill-runtime fork path does not
  yet carry expansion metadata.
- [x] **Gates.** agent-lifecycle 38/38, interactive 8/8, attachments 2/2, tsc 0,
  build 0, full 2,124/2,124, chain 767/767, notices 0, source index unchanged,
  identity \`50e58886…\`.
- [ ] Remaining C-6: full consumers.
`);

const evidence = {
  schema: 'W95UserPromptExpansionEvidence.v1',
  package: 'W95-01 — UserPromptExpansion payload',
  date: '2026-10-18',
  question: 'When is UserPromptExpansion raised and what fields does it carry?',
  answer: 'Only from the skill-expansion path, with expansion_type, command_name, command_args and the reconstructed command text. The product now raises it only when Agent.run receives that descriptor and no longer raises it for plain prompts or /attach.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    builder: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'VYr', offset: 2947732 },
    callSite: { module: 'extracted-v2/modules/chunk-htgmc2p1.js', offset: 38795 },
    schema: { module: 'extracted-v2/modules/chunk-r2vtj1kh.js', offset: 194968,
      expansionTypes: ['slash_command', 'mcp_prompt'] },
  },
  behavior: {
    fields: ['expansion_type', 'command_name', 'command_args', 'prompt'],
    prompt: 'reconstructed /name args text',
    updatedPrompt: 'replaces the model prompt',
    additionalContext: 'joins the hook context',
  },
  correction: {
    previous: 'raised for every prompt with {prompt, source: "user"}',
    basis: 'the source raises only from the expansion path and requires the expansion fields',
    updatedTests: ['test/attachments.test.ts'],
  },
  adaptations: [
    'command_source is unset because the local skill catalog records no source.',
    'A forked skill execution inside the skill runtime does not yet carry expansion metadata.',
  ],
  changes: [
    { file: 'src/hooks.ts', change: 'expansion_type and command_args payload fields', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/agent.ts', change: 'expansion-only raise and descriptor type', sha256: sha(read('src/agent.ts')) },
    { file: 'src/interactive.ts', change: 'slash-command expansion descriptors', sha256: sha(read('src/interactive.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'expansion payload and silence test', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'test/interactive.test.ts', change: 'greet/auto expansion assertions', sha256: sha(read('test/interactive.test.ts')) },
    { file: 'test/attachments.test.ts', change: 'attach silence correction', sha256: sha(read('test/attachments.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W95', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W95', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W95-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W95-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    lifecycle: '38/38',
    interactive: '8/8',
    attachments: '2/2',
    build: 'exit 0',
    full: '2,124/2,124',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '50e588861e39fb2ae0d0a1491e95139b0d1e4a9279ece47c0cbaa9849a3906f7',
  },
  residuals: [
    'command_source is not carried.',
    'The skill-runtime fork path does not yet raise the expansion event.',
    'Full hook consumers remain C-6 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with full consumers.',
};
write('research/ports/W95-user-prompt-expansion-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW95-01 ports the UserPromptExpansion payload',
  'research/coding-standard.md': '\n2026-10-18 W95-01 ',
  'research/FEATURES.md': 'W95 raises UserPromptExpansion only',
  'research/ports/W95-user-prompt-expansion.md': '# W95 — UserPromptExpansion payload',
  '.audit/w95-runtime.todo.md': '\n## W95-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
