// W96-01 record: watcher-driven ConfigChange.
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

const note = `# W96 — watcher-driven ConfigChange

## Source position

\`QXr\` (chunk-sfn1dbxq.js [2933599,2933905)) builds
\`{session context, hook_event_name: "ConfigChange", source, file_path}\` and
matches selectors on \`source\`. The schema's source enum is \`user_settings\`,
\`project_settings\`, \`local_settings\`, \`policy_settings\` and \`skills\`
(chunk-r2vtj1kh.js offset 202846); \`policy_settings\` results are forced
non-blocking. \`Uc\` (chunk-2bcyxj9q.js [42936,43157)) maps the settings scopes
to the first four values. The settings watcher gates change and deletion
through the hook before fanning out (\`oi\` [39334,39473)); the skills watcher
gates skill, command and agent files with \`skills\` (\`re\`,
chunk-zkxek575.js [4471,4606)). \`Zge\` (offset 564884) includes ConfigChange
and \`hX\` (offset 2980890) excludes only PostToolBatch, TaskCreated and
PreCompact, so exit 2 blocks it.

## Port

\`configChangeSource\` maps a watched path: the project settings files
(\`.harness/settings.json\` and an explicit \`settingsFile\`) are
\`project_settings\`, \`.harness/settings.local.json\` is \`local_settings\`, the
user \`settings.json\` is \`user_settings\`, an explicit managed settings file is
\`policy_settings\`, and skill, command, agent, plugin and content-root files
are \`skills\`. The config watcher now lets \`onFileChange\` return \`false\` or a
promise to hold or suppress the debounced reload fan-out; the interactive
watcher raises ConfigChange with \`source\` and \`file_path\`, treats
\`policy_settings\` as non-blocking, and skips the reload when blocked.
ConfigChange joins the exit-2 blocking set.

## Correction

The product previously raised ConfigChange synchronously from \`/theme\`,
\`/config editor\`, \`/model\`-family config switches, \`/reload\` and
\`/mcp-reconnect\`, with invented sources (\`theme\`, \`editor\`, \`reload\`,
\`mcp_reconnect\`) and payloads (\`model\`, \`permission_mode\`, \`thinking\`,
\`editorMode\`, \`server_name\`). Those raises are removed: the recovered event is
watcher-driven only, and theme/editor writes reach it through the user
settings file.

## Adaptation

The local watcher covers the \`.harness\` catalogs and the user directory; OS
MDM polling is not implemented, and the explicit managed settings file is
watched in its place with the recovered non-blocking rule. Instruction files,
keybindings, rules and other non-skill catalog files raise no ConfigChange.

## Verification

\`config-watch\` 4/4: a pending gate holds the fan-out and \`false\` suppresses
it. \`hooks\` 52/52: exit 2 blocks ConfigChange with its stderr as the reason.
\`interactive\` 9/9: the source mapping covers settings scopes, skill roots,
content roots and the non-ConfigChange paths. tsc 0; build 0; full
2,127/2,127; chain 767/767; notices 0; source index unchanged; identity
\`6443354c…\`.
`;
write('research/ports/W96-config-change.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W96-01 corrects ConfigChange. The event is watcher-driven with the recovered
five-value \`source\` and \`file_path\`; the settings and skills watchers gate
their reload fan-out on it, \`policy_settings\` never blocks, and exit 2 blocks.
The invented synchronous raises for theme, editor, model-family config,
reload and MCP reconnect are removed. \`config-watch\` 4/4, \`hooks\` 52/52,
\`interactive\` 9/9, tsc 0, build 0, full 2,127/2,127, chain 767/767, identity
\`6443354c…\`. [W96 record](ports/W96-config-change.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W96-01 ConfigChange 语义：S-1（先读源）：读取 QXr [2933599,2933905)、Uc [42936,43157)、设置门 oi [39334,39473)、技能门 re [4471,4606)、Zge 564884 与 hX 2980890（UTF-16）。S-2（不臆造）：仅设置/技能监视器触发，载荷 source+file_path，policy_settings 不阻断，exit 2 可阻断；删除 theme/editor/reload/mcp_reconnect/模型同步伪造触发与额外字段。S-3（边界）：本地无 MDM 轮询，以显式 managed 文件替代；指令文件、keybindings、rules 不触发。S-4（可测）：config-watch 门控延迟/抑制；hooks exit 2 阻断；interactive 源映射。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON，纠正记录在端口内。验证：config-watch 4/4、hooks 52/52、interactive 9/9、tsc 0、build 0、全量 2,127/2,127、链 767/767、身份 6443354c…。
`);

replaceOnce('research/FEATURES.md',
  '(plain prompts and `/attach` no longer raise it) |',
  '(plain prompts and `/attach` no longer raise it); W96 raises ConfigChange only from the settings and skill watchers with the recovered five-value `source` and `file_path`, keeps `policy_settings` non-blocking, makes exit 2 gate the reload, and removes the invented synchronous theme/editor/reload/MCP/model raises |');

replaceAll('research/CURRENT.md',
  '；完整消费者与脚本语义仍待处理',
  '；W96完成ConfigChange语义纠正（仅设置/技能监视器触发，source五值+file_path，policy_settings不阻断，exit 2可阻断重载；伪造的theme/editor/reload/mcp_reconnect/模型同步触发已删除）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-18T06:05:00Z', 'package', 'W96-01 ConfigChange 语义纠正',
    'QXr 2933599、Uc 42936、oi 39334、re 4471、Zge 564884、hX 2980890；configChangeSource 与监视器门控',
    '仅监视器触发；source+file_path；policy 不阻断；exit 2 阻断；删除伪造同步触发',
    'config-watch 4/4；hooks 52/52；interactive 9/9；tsc 0；build 0；全量 2,127/2,127；链 767/767'],
  ['2026-10-18T06:07:00Z', 'decision', 'W96-01 纠正',
    '删除 theme/editor/reload/mcp_reconnect/模型配置的同步 ConfigChange 与额外字段；设置/技能变化改由监视器 raise 并在阻断时跳过重载',
    '本地以显式 managed 文件替代 MDM 轮询；内容根映射 skills',
    '.audit/w96-01-full.txt'],
  ['2026-10-18T06:10:00Z', 'verification', 'W96-01 验收：config-watch 4/4、hooks 52/52、interactive 9/9、tsc 0、build 0、2,127/2,127、767/767',
    '挂起门控保持、false 抑制；exit 2 阻断且 stderr 为原因；五类源映射与不应触发路径',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 6443354c…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w96-runtime.tsv', tsv + '\n');

write('.audit/w96-runtime.todo.md', `# W96 runtime trail

## W96-01 acceptance (2026-10-18)

- [x] **Source read.** Builder, source mapping, both watcher gates and the
  exit-2 blocking set.
- [x] **Port.** Watcher-driven raise with \`source\`/\`file_path\`, policy
  non-blocking, gated reload fan-out.
- [x] **Correction.** The synchronous invented raises are removed.
- [x] **Bounds.** No MDM poll; explicit managed file stands in; non-skill
  catalogs raise nothing.
- [x] **Gates.** config-watch 4/4, hooks 52/52, interactive 9/9, tsc 0,
  build 0, full 2,127/2,127, chain 767/767, notices 0, source index unchanged,
  identity \`6443354c…\`.
- [ ] Remaining C-6: full consumers and the remaining unwired event fields.
`);

const evidence = {
  schema: 'W96ConfigChangeEvidence.v1',
  package: 'W96-01 — watcher-driven ConfigChange',
  date: '2026-10-18',
  question: 'When is ConfigChange raised, what does it carry and what does blocking mean?',
  answer: 'Only from the settings and skill watchers, with source (user_settings, project_settings, local_settings, policy_settings, skills) and file_path. policy_settings results are never blocking; exit 2 blocks the reload fan-out.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    builder: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'QXr', range: [2933599, 2933905] },
    sourceMapping: { module: 'extracted-v2/modules/chunk-2bcyxj9q.js', symbol: 'Uc', range: [42936, 43157] },
    settingsGate: { module: 'extracted-v2/modules/chunk-2bcyxj9q.js', symbol: 'oi', range: [39334, 39473] },
    skillsGate: { module: 'extracted-v2/modules/chunk-zkxek575.js', symbol: 're', range: [4471, 4606] },
    schema: { module: 'extracted-v2/modules/chunk-r2vtj1kh.js', offset: 202846,
      sources: ['user_settings', 'project_settings', 'local_settings', 'policy_settings', 'skills'] },
    blocking: { set: 'Zge', offset: 564884, exit2Helper: { symbol: 'hX', offset: 2980890 },
      excluded: ['PostToolBatch', 'TaskCreated', 'PreCompact'] },
  },
  behavior: {
    payload: ['source', 'file_path'],
    selector: 'source',
    policySettings: 'never blocking',
    blocking: 'skips the settings/skills reload fan-out',
  },
  correction: {
    previous: 'synchronous raises with invented sources theme/editor/reload/mcp_reconnect and extra fields',
    basis: 'the source raises only from the watchers and has a closed source enum',
    removedSites: ['applyConfig non-model branch', 'selectTheme', '/config editor', '/mcp-reconnect', '/reload'],
  },
  adaptations: [
    'No OS MDM polling; an explicit managed settings file is watched as policy_settings instead.',
    'Plugin content roots map to skills, matching the plugin watcher gate.',
    'Instruction files, keybindings, rules and other non-skill catalogs raise no ConfigChange.',
  ],
  changes: [
    { file: 'src/config-watch.ts', change: 'boolean/promise file-change gate', sha256: sha(read('src/config-watch.ts')) },
    { file: 'src/interactive.ts', change: 'source mapping, watcher raise, removed invented raises', sha256: sha(read('src/interactive.ts')) },
    { file: 'src/hooks.ts', change: 'ConfigChange exit-2 blocking', sha256: sha(read('src/hooks.ts')) },
    { file: 'test/config-watch.test.ts', change: 'gate delays and suppresses fan-out', sha256: sha(read('test/config-watch.test.ts')) },
    { file: 'test/hooks.test.ts', change: 'ConfigChange exit-2 block test', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'test/interactive.test.ts', change: 'source mapping test', sha256: sha(read('test/interactive.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W96', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W96', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W96-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W96-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    configWatch: '4/4',
    hooks: '52/52',
    interactive: '9/9',
    build: 'exit 0',
    full: '2,127/2,127',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '6443354c5d7436a508318274dc6d8054608dd831d442280e1700c7b6a8be3796',
  },
  residuals: [
    'No OS-managed settings discovery/polling.',
    'Full hook consumers remain C-6 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with full consumers.',
};
write('research/ports/W96-config-change-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW96-01 corrects ConfigChange',
  'research/coding-standard.md': '\n2026-10-18 W96-01 ',
  'research/FEATURES.md': 'W96 raises ConfigChange only from',
  'research/ports/W96-config-change.md': '# W96 — watcher-driven ConfigChange',
  '.audit/w96-runtime.todo.md': '\n## W96-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
