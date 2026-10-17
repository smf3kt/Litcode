// W91-01 record: per-file InstructionsLoaded payloads.
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

const note = `# W91 — per-file InstructionsLoaded payloads

## Source position

\`kTn\` (chunk-sfn1dbxq.js offset 2935767) builds
\`{file_path, memory_type, load_reason, globs, trigger_file_path,
parent_file_path}\`; the schema fixes \`memory_type\` to User/Project/Local/
Managed and \`load_reason\` to session_start/nested_traversal/path_glob_match/
include/compact (chunk-r2vtj1kh.js offset 202907). The eager loop
(chunk-sfn1dbxq.js offset 672482) raises once per loaded file with the eager
reason from \`KZn\` (\`session_start\` at startup, [672828,672967)) and \`include\`
for an imported file. The path-access site (offset 3671285) raises with
\`trigger_file_path\` set to the accessed path and the reason
\`globs ? "path_glob_match" : parent ? "include" : "nested_traversal"\`.

## Port

The config loader now records each instruction file's importing parent and a
conditional rule's patterns, and \`loadPathInstructions\` records the parent of
an import. The session carries only those identity fields
(\`instructionSources\`, no content). \`startSession\` raises one
\`InstructionsLoaded\` per loaded file with its path, \`memory_type\`,
\`load_reason\`, optional \`globs\` and \`parent_file_path\`. Path access raises
per loaded file with \`trigger_file_path\`, \`nested_traversal\` for an ancestor
file and \`include\` for an import; a selected conditional rule raises
\`path_glob_match\` with its patterns and an imported rule file raises
\`include\`.

## Adaptation

The source's instruction tiers are User/Project/Local/Managed; this runtime
loads one project instruction set (ancestor walk plus \`.harness/rules\`), so
every raise reports \`Project\`. The product raises the eager reason
\`session_start\` on every \`startSession\`; the source's later eager reasons
(compaction, directory_added) are not tracked. The source gates the raise on a
configured hook (\`tar()\`); the product calls the hook unconditionally and the
hook runner is the no-op when none is configured.

## Verification

\`agent-lifecycle\` 34/34: an eager file receives \`file_path\`,
\`memory_type: "Project"\`, \`load_reason: "session_start"\` and no parent; a
path read raises ancestor (\`nested_traversal\`, trigger path), import
(\`include\`, parent path), selected rule (\`path_glob_match\`, globs, trigger
path) and rule import (\`include\`, parent path) in order. tsc 0; build 0; full
2,120/2,120; chain 767/767; notices 0; source index unchanged; identity
\`87bbcc5c…\`.
`;
write('research/ports/W91-instructions-loaded.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W91-01 ports the per-file InstructionsLoaded payload. The loader records each
file's importing parent and a rule's patterns; \`startSession\` raises one event
per loaded file (\`file_path\`, \`memory_type\`, \`load_reason\`, optional
\`globs\`/\`parent_file_path\`), and path access raises
\`nested_traversal\`/\`include\`/\`path_glob_match\` with
\`trigger_file_path\`. This runtime has one project instruction tier, so every
file reports \`Project\`; later eager reasons are not tracked.
\`agent-lifecycle\` 34/34, tsc 0, build 0, full 2,120/2,120, chain 767/767,
identity \`87bbcc5c…\`. [W91 record](ports/W91-instructions-loaded.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W91-01 InstructionsLoaded 逐文件载荷：S-1（先读源）：读取 chunk-sfn1dbxq.js 的 kTn 2935767、急切循环 672482 与 KZn [672828,672967)、路径访问点 3671285，以及 chunk-r2vtj1kh.js 的字段枚举 202907（UTF-16）。S-2（不臆造）：载荷为 file_path/memory_type/load_reason 与可选 globs、trigger_file_path、parent_file_path；原因映射为 session_start、include、nested_traversal、path_glob_match。S-3（边界）：本运行时仅一个 Project 指令层；startSession 固定急切原因 session_start；源按已配置钩子门控，本产品由 runHooks 空转等价。S-4（可测）：载荷改为逐文件断言，新增路径访问四类原因用例。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：agent-lifecycle 34/34、tsc 0、build 0、全量 2,120/2,120、链 767/767、身份 87bbcc5c…。
`);

replaceOnce('research/FEATURES.md',
  'W90 sends WorktreeCreate only the requested name and WorktreeRemove only the removed path, dropping the tool echo |',
  'W90 sends WorktreeCreate only the requested name and WorktreeRemove only the removed path, dropping the tool echo; W91 raises InstructionsLoaded once per loaded instruction file with the recovered `{file_path, memory_type, load_reason}` plus optional `globs`/`parent_file_path`, and on path access with `trigger_file_path` (`nested_traversal`/`include`/`path_glob_match`), reporting the single local `Project` tier |');

replaceAll('research/CURRENT.md',
  '完整消费者与脚本语义仍待处理',
  'W91完成InstructionsLoaded逐文件载荷（文件路径/类型/加载原因，含globs与父文件，路径访问带trigger_file_path；本地仅Project层）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-18T03:05:00Z', 'package', 'W91-01 InstructionsLoaded 逐文件载荷',
    'kTn 2935767、急切循环 672482、KZn [672828,672967)、路径访问 3671285、字段枚举 202907；config 指令父级/规则 globs、instructionSources、startSession 与 ruleContext',
    '逐文件 raise；四种原因映射；路径访问带 trigger_file_path',
    'agent-lifecycle 34/34；tsc 0；build 0；全量 2,120/2,120；链 767/767'],
  ['2026-10-18T03:07:00Z', 'decision', 'W91-01 边界',
    '① 本地仅 Project 指令层；② startSession 固定 session_start，compaction/directory_added 未跟踪；③ 源按已配置钩子门控，本产品由 runHooks 空转等价',
    '残余：完整消费者',
    '.audit/w91-01-full.txt'],
  ['2026-10-18T03:10:00Z', 'verification', 'W91-01 验收：agent-lifecycle 34/34、tsc 0、build 0、2,120/2,120、767/767',
    '急切文件含 file_path/Project/session_start 且无 parent；路径访问依次 nested_traversal、include、path_glob_match、include',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 87bbcc5c…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w91-runtime.tsv', tsv + '\n');

write('.audit/w91-runtime.todo.md', `# W91 runtime trail

## W91-01 acceptance (2026-10-18)

- [x] **Source read.** \`kTn\`, the eager loop and \`KZn\`, the path-access call
  site, and the schema enumerations.
- [x] **Port.** Per-file eager and path-access raises with the recovered field
  set and reasons.
- [x] **Bounds.** One Project tier; eager reason fixed to \`session_start\`;
  uncompacted reasons not tracked.
- [x] **Gates.** agent-lifecycle 34/34, tsc 0, build 0, full 2,120/2,120, chain
  767/767, notices 0, source index unchanged, identity \`87bbcc5c…\`.
- [ ] Remaining C-6: full consumers.
`);

const evidence = {
  schema: 'W91InstructionsLoadedEvidence.v1',
  package: 'W91-01 — per-file InstructionsLoaded payloads',
  date: '2026-10-18',
  question: 'What does InstructionsLoaded carry, when is it raised, and how do the product raises map to it?',
  answer: 'It carries file_path, memory_type, load_reason plus optional globs, trigger_file_path and parent_file_path. The product now raises once per loaded file at session start and on path access with nested_traversal/include/path_glob_match, reporting the single local Project tier.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-sfn1dbxq.js',
    unit: 'UTF-16 code units',
    builder: { symbol: 'kTn', offset: 2935767 },
    eagerLoop: { offset: 672482 },
    eagerReason: { symbol: 'KZn', range: [672828, 672967] },
    pathAccess: { offset: 3671285 },
    schema: { module: 'extracted-v2/modules/chunk-r2vtj1kh.js', offset: 202907,
      memoryTypes: ['User', 'Project', 'Local', 'Managed'],
      loadReasons: ['session_start', 'nested_traversal', 'path_glob_match', 'include', 'compact'] },
  },
  behavior: {
    eager: 'one raise per loaded file; include for imports',
    pathAccess: 'trigger_file_path set; nested_traversal for an ancestor file, include for an import, path_glob_match for a selected rule',
    fields: 'file_path, memory_type, load_reason, globs?, trigger_file_path?, parent_file_path?',
  },
  adaptations: [
    'This runtime loads one project instruction set, so every raise reports Project; user/local/managed instruction tiers are absent.',
    'startSession always reports session_start; compaction and directory_added eager reasons are not tracked.',
    'The source gates the raise on a configured hook; the product calls the hook and the runner no-ops without one.',
  ],
  changes: [
    { file: 'src/config.ts', change: 'instruction parent/globs and instructionSources', sha256: sha(read('src/config.ts')) },
    { file: 'src/session.ts', change: 'instructionSources config and schema', sha256: sha(read('src/session.ts')) },
    { file: 'src/agent.ts', change: 'per-file eager and path-access raises', sha256: sha(read('src/agent.ts')) },
    { file: 'src/cli.ts', change: 'instructionSources wiring', sha256: sha(read('src/cli.ts')) },
    { file: 'src/reload.ts', change: 'instructionSources wiring', sha256: sha(read('src/reload.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'per-file payload and reason tests', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W91', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W91', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W91-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W91-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    lifecycle: '34/34',
    build: 'exit 0',
    full: '2,120/2,120',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '87bbcc5c4a9f1731c1de6009c38de10975e1ceeadda04c1a6b99591ee4fe618a',
  },
  residuals: [
    'User/local/managed instruction tiers and the compaction/directory_added eager reasons are not tracked.',
    'Full hook consumers remain C-6 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with full consumers.',
};
write('research/ports/W91-instructions-loaded-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW91-01 ports the per-file InstructionsLoaded payload',
  'research/coding-standard.md': '\n2026-10-18 W91-01 ',
  'research/FEATURES.md': 'W91 raises InstructionsLoaded',
  'research/ports/W91-instructions-loaded.md': '# W91 — per-file InstructionsLoaded payloads',
  '.audit/w91-runtime.todo.md': '\n## W91-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
