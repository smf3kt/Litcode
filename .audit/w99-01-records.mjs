// W99-01 record: UserPromptExpansion command_source.
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

const note = `# W99 — UserPromptExpansion command_source

## Source position

\`VYr\` (chunk-sfn1dbxq.js [2947575,2947964)) builds the expansion payload with
\`expansion_type\`, \`command_name\`, \`command_args\`, \`command_source\` and
\`prompt\`. The single caller, \`at\` (chunk-htgmc2p1.js offset 38703), passes the
command entry's own \`source\` as \`command_source\` and derives
\`expansion_type\` from it (\`mcp\` → \`mcp_prompt\`, everything else →
\`slash_command\`). The hook schema keeps \`command_source\` optional
(chunk-r2vtj1kh.js offset 195092).

The skill loader assigns that \`source\` while reading each directory: the
filesystem loader \`mO\` (chunk-sfn1dbxq.js [3384052,3388176)) places the
scope passed by its caller into the skill record (\`source:n\` at 3383703), and
the directory discovery \`sAr\` (offset 3390484) passes \`policySettings\`,
\`userSettings\` and \`projectSettings\` for the managed, user and project
locations. Plugin components carry the literal \`source:"plugin"\`
(offset 962912), alongside \`loadedFrom:"plugin"\`.

## Port

\`SkillInfo\` gains \`source?: SkillSource\` with the three scopes this product
reads: \`.harness/skills\` → \`projectSettings\`, \`<userDir>/skills\` →
\`userSettings\`, installed plugin skill directories and explicit
\`settings.pluginDirs\` → \`plugin\`. The interactive slash-command expansion
adds \`command_source: skill.source\`; when a hand-built skill has no scope the
key is omitted, matching the optional schema field.

## Adaptation

The recovered loader also reads managed policy skills, the synced host catalog
and bundled/MCP/memory-store skills. This runtime has none of those catalogs,
so only the three scopes it actually scans can appear; no source string is
invented for the absent ones.

## Verification

\`config\` asserts the scope on project, user, installed-plugin and configured
plugin skills. \`interactive\` asserts the wire payload carries
\`projectSettings\` for a scoped skill and no key for a hand-built one.
\`agent-lifecycle\` asserts the expansion hook receives \`command_source\`.
Focused 170/170, tsc 0, build 0, full 2,131/2,131, chain 767/767, notices 0,
identity \`e0cd9d5e…\`.
`;
write('research/ports/W99-skill-source.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W99-01 restores the UserPromptExpansion \`command_source\` field. The skill
loader records the settings scope that authorized each directory
(\`projectSettings\`, \`userSettings\`, \`plugin\`) and the interactive slash
command passes it into the hook payload; a hand-built skill without a scope
omits the optional key. Focused 170/170, tsc 0, build 0, full 2,131/2,131,
chain 767/767, identity \`e0cd9d5e…\`. [W99 record](ports/W99-skill-source.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W99-01 UserPromptExpansion command_source：S-1（先读源）：读取 VYr [2947575,2947964)、调用点 at 38703（chunk-htgmc2p1.js）、加载器 mO [3384052,3388176)、source 赋值 3383703、目录发现 sAr 3390484、插件 source 962912、schema 195092（UTF-16）。S-2（不臆造）：command_source 为技能来源 scope；省略时为可选键；插件为字面量 plugin。S-3（边界）：本运行时仅 projectSettings/userSettings/plugin 三类目录，无 policy/synced/bundled/MCP/memory-store 目录，不为其编造来源。S-4（可测）：config 断言四类技能来源；interactive 断言载荷含 projectSettings 且无来源时键省略；agent-lifecycle 断言 hook 收到 command_source。S-5/S-6：session 配置 schema 增补可选 source 枚举，无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：聚焦 170/170、tsc 0、build 0、全量 2,131/2,131、链 767/767、身份 e0cd9d5e…。
`);

replaceOnce('research/FEATURES.md',
  "(running shell/monitor jobs, 1000-unit truncation) and `session_crons` projections on every top-level and child path |",
  "(running shell/monitor jobs, 1000-unit truncation) and `session_crons` projections on every top-level and child path; W99 sends UserPromptExpansion's recovered `command_source` (the skill's settings scope: projectSettings/userSettings/plugin) and omits the optional key when no scope is known |");

replaceAll('research/CURRENT.md',
  '顶层与全部子代理路径接所属runtime）；完整消费者',
  '顶层与全部子代理路径接所属runtime）；W99补齐UserPromptExpansion的command_source（技能来源scope：projectSettings/userSettings/plugin，省略时键不存在）；完整消费者', 3);

const tsv = [
  ['2026-10-18T09:00:00Z', 'package', 'W99-01 UserPromptExpansion command_source',
    'VYr [2947575,2947964)、at 38703、mO [3384052,3388176)、source 3383703、sAr 3390484、plugin source 962912、schema 195092',
    'SkillInfo.source 三值；interactive 展开携带 command_source；无来源时省略',
    'config/interactive/agent-lifecycle/hooks 170/170；tsc 0；build 0；全量 2,131/2,131；链 767/767'],
  ['2026-10-18T09:03:00Z', 'decision', 'W99-01 适配',
    '本地无 policySettings/synced/bundled/MCP/memoryStore 技能目录，只映射实际扫描的三类',
    'session 配置 schema 增补可选 source 枚举',
    '.audit/w99-01-full.txt'],
  ['2026-10-18T09:06:00Z', 'verification', 'W99-01 验收：聚焦 170/170、tsc 0、build 0、2,131/2,131、767/767',
    '项目/用户/安装插件/配置插件来源断言；作用于技能时键存在，手建技能时不存在',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity e0cd9d5e…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w99-runtime.tsv', tsv + '\n');

write('.audit/w99-runtime.todo.md', `# W99 runtime trail

## W99-01 acceptance (2026-10-18)

- [x] **Source read.** Expansion builder, its only caller, the skill loader's
  source assignment, the directory discovery scopes and the plugin literal.
- [x] **Port.** \`SkillSource\`, \`SkillInfo.source\`, loader plumbing and the
  interactive payload field.
- [x] **Bounds.** Only the three scopes this runtime scans can appear; no
  invented policy/synced/bundled/MCP/memory-store sources.
- [x] **Gates.** focused 170/170, tsc 0, build 0, full 2,131/2,131, chain
  767/767, notices 0, source index unchanged, identity \`e0cd9d5e…\`.
- [ ] Remaining C-6: full consumers and the fork-skill expansion path.
`);

const evidence = {
  schema: 'W99SkillSourceEvidence.v1',
  package: 'W99-01 — UserPromptExpansion command_source',
  date: '2026-10-18',
  question: 'Which field does UserPromptExpansion carry for the command source, and what values can it take?',
  answer: 'VYr always passes command_source from the command entry; the skill loader sets it to the settings scope that authorized the skill directory (projectSettings, userSettings, plugin among the scopes this runtime reads). The hook schema keeps it optional.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    builder: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'VYr', range: [2947575, 2947964] },
    caller: { module: 'extracted-v2/modules/chunk-htgmc2p1.js', symbol: 'at', offset: 38703 },
    loader: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'mO', range: [3384052, 3388176] },
    sourceAssignment: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 3383703, text: 'source:n,baseDir:V,loadedFrom:"skills"' },
    discovery: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'sAr', offset: 3390484 },
    pluginSource: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 962912, text: 'source:"plugin"' },
    schema: { module: 'extracted-v2/modules/chunk-r2vtj1kh.js', offset: 195092, field: 'command_source:o().optional()' },
  },
  behavior: {
    payload: ['expansion_type', 'command_name', 'command_args', 'command_source', 'prompt'],
    expansionType: { mcp: 'mcp_prompt', other: 'slash_command' },
    scopes: ['projectSettings', 'userSettings', 'plugin'],
  },
  adaptations: [
    'No managed policy skills, synced host catalog, bundled, MCP or memory-store catalogs exist, so those scopes cannot occur.',
    'A hand-built skill without a scope omits the optional key instead of sending undefined.',
    'Only the interactive slash-command path expands; the source also expands MCP prompts, which this runtime does not load.',
  ],
  changes: [
    { file: 'src/config.ts', change: 'SkillSource type, SkillInfo.source, loader plumbing', sha256: sha(read('src/config.ts')) },
    { file: 'src/hooks.ts', change: 'payload field declaration', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/agent.ts', change: 'PromptExpansion type and corrected source range', sha256: sha(read('src/agent.ts')) },
    { file: 'src/interactive.ts', change: 'expansion carries command_source', sha256: sha(read('src/interactive.ts')) },
    { file: 'src/session.ts', change: 'stored config schema accepts source', sha256: sha(read('src/session.ts')) },
    { file: 'test/config.test.ts', change: 'scope assertions and minimal key set', sha256: sha(read('test/config.test.ts')) },
    { file: 'test/interactive.test.ts', change: 'payload scope and omission assertions', sha256: sha(read('test/interactive.test.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'hook receives command_source', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W99', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W99', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W99-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W99-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '170/170 (config, interactive, agent-lifecycle, hooks)',
    build: 'exit 0',
    full: '2,131/2,131',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'e0cd9d5ea54fd4260349d6d0d13d251e6c7dbf9fce87f146a04a286a833c3177',
  },
  residuals: [
    'policySettings, synced/bundled/MCP/memory-store sources cannot occur without their catalogs.',
    'MCP prompt expansion is not implemented, so expansion_type stays slash_command.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with full consumers and the fork-skill expansion path.',
};
write('research/ports/W99-skill-source-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW99-01 restores the UserPromptExpansion',
  'research/coding-standard.md': '\n2026-10-18 W99-01 ',
  'research/FEATURES.md': "W99 sends UserPromptExpansion's recovered",
  'research/ports/W99-skill-source.md': '# W99 — UserPromptExpansion command_source',
  '.audit/w99-runtime.todo.md': '\n## W99-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
