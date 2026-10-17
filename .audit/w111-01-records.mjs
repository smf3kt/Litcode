// W111-01 record: SessionStart watchPaths.
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

const note = `# W111 — SessionStart watchPaths

## Source position

The SessionStart output schema carries \`watchPaths?: string[]\` ("Absolute
paths to watch for FileChanged hooks", chunk-n3ykh62m.js offset 392062) and the
output translation retains it (offset 387382). The hook runner collects every
hook's paths into \`$e\` and registers them with the file watcher: normally
\`updateWatchPaths\` (\`Kjt\`, chunk-sfn1dbxq.js offset 2483234, destructured
from the watcher module at offset 1680634), and \`addWatchPaths\` (\`Vjt\`) when
the session was overtaken or the hook came from a plugin loaded after start
(offset 2483221).

## Port

\`Agent.startSession\` returns the merged \`watchPaths\` from the SessionStart
hook results. The interactive loop registers them through its existing
\`addInstructionPaths\` channel: the startup run's paths arrive as
\`initialWatchPaths\` because that run precedes the loop, while clear/fork,
resume, configuration reload and cwd relocation register the return value
directly. The channel's existing bounds (absolute paths, 2,048 entries,
65,536-byte manifest) apply unchanged.

## Adaptation

The watcher distinguishes replace and add modes for plugin-late hooks; this
runtime has no plugin-late SessionStart concept (the new-plugins-only staging
is already ignored), so every result takes the additive path. A headless run
has no config watcher and ignores the returned paths.

## Verification

\`agent-lifecycle\` asserts the returned paths. \`interactive\` asserts the
startup paths create an \`instruction_watch\` event under \`watchConfig\`.
Focused 63/63, tsc 0, build 0, full 2,150/2,150, chain 767/767, notices 0,
identity \`ec6093d6…\`.
`;
write('research/ports/W111-sessionstart-watch-paths.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W111-01 consumes SessionStart \`watchPaths\`. The merged paths return from
\`startSession\`; the interactive loop registers them with the config watcher
for startup via \`initialWatchPaths\` and for every later start from the return
value. Focused 63/63, tsc 0, build 0, full 2,150/2,150, chain 767/767,
identity \`ec6093d6…\`.
[W111 record](ports/W111-sessionstart-watch-paths.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W111-01 SessionStart watchPaths：S-1（先读源）：schema 392062、输出映射 387382（chunk-n3ykh62m.js）、收集与注册 2483234、addWatchPaths 2483221、watcher 绑定 1680634（chunk-sfn1dbxq.js）。S-2（不臆造）：所有 SessionStart 结果合并；注册进既有 addInstructionPaths 通道并沿用其绝对路径/2048/64KB 界限；headless 无 watcher 忽略返回值。S-3（边界）：源区分 updateWatchPaths/addWatchPaths（插件晚到），本构建无该概念，统一走增量路径。S-4（可测）：agent-lifecycle 断言返回路径；interactive 断言 startup 路径生成 instruction_watch。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：聚焦 63/63、tsc 0、build 0、全量 2,150/2,150、链 767/767、notices 0、索引不变、身份 ec6093d6…。
`);

replaceOnce('research/FEATURES.md',
  'W110 honors the PreModelSwitch `permissionDecision` (deny blocks, ask confirms, allow records) |',
  'W110 honors the PreModelSwitch `permissionDecision` (deny blocks, ask confirms, allow records); W111 registers SessionStart `watchPaths` with the config watcher for startup and every later start |');

replaceAll('research/CURRENT.md',
  '；W110消费PreModelSwitch的permissionDecision（deny阻断、ask确认、allow记录）；完整消费者与脚本语义仍待处理',
  '；W110消费PreModelSwitch的permissionDecision（deny阻断、ask确认、allow记录）；W111消费SessionStart的watchPaths（startup经initialWatchPaths、后续启动取返回值注册到配置监视器）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-17T21:24:00Z', 'package', 'W111-01 SessionStart watchPaths',
    'schema 392062、输出映射 387382、注册 2483234/2483221、watcher 绑定 1680634',
    '所有SessionStart结果合并；沿用addInstructionPaths界限；headless无watcher忽略',
    'agent-lifecycle/interactive 63/63；tsc 0；build 0；全量 2,150/2,150；链 767/767'],
  ['2026-10-17T21:26:00Z', 'decision', 'W111-01 本地适配',
    '源区分update/add（插件晚到）；本构建无插件晚到SessionStart',
    '统一走增量注册；startup路径经initialWatchPaths转入循环',
    '.audit/w111-01-full.txt'],
  ['2026-10-17T21:28:00Z', 'verification', 'W111-01 验收：聚焦 63/63、tsc 0、build 0、2,150/2,150、767/767',
    'startSession返回合并路径；startup路径生成instruction_watch事件',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity ec6093d6…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w111-runtime.tsv', tsv + '\n');

write('.audit/w111-runtime.todo.md', `# W111 runtime trail

## W111-01 acceptance (2026-10-17)

- [x] **Source read.** Output schema, translation retention, the collection
  into \`$e\`, and both watcher registration helpers.
- [x] **Port.** startSession return value, initialWatchPaths, and registration
  on clear/fork, resume, config reload and cwd relocation.
- [x] **Bounds.** Existing watcher limits apply; headless ignores the paths;
  the plugin-late replace mode has no local analogue.
- [x] **Gates.** focused 63/63, tsc 0, build 0, full 2,150/2,150, chain
  767/767, notices 0, source index unchanged, identity \`ec6093d6…\`.
- [ ] Remaining C-6: the rest of the script semantics.
`);

const evidence = {
  schema: 'W111SessionStartWatchPathsEvidence.v1',
  package: 'W111-01 — SessionStart watchPaths',
  date: '2026-10-17',
  question: 'What happens to the SessionStart hook watchPaths output?',
  answer: 'The runner collects every hook watchPaths entry and registers them with the file watcher, replacing the set normally and adding when the session was overtaken or the hook came from a plugin loaded after start.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    schema: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', offset: 392062 },
    translation: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', offset: 387382 },
    collectAndRegister: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offsets: [2483221, 2483234] },
    watcherBinding: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 1680634 },
  },
  behavior: {
    event: 'SessionStart',
    field: 'hookSpecificOutput.watchPaths',
    mergedAcrossHooks: true,
    registeredWith: 'config file watcher',
    modes: ['updateWatchPaths', 'addWatchPaths'],
  },
  adaptations: [
    'This runtime has no plugin-late SessionStart concept, so every result uses the additive registration path.',
    'A headless run has no config watcher and ignores the returned paths.',
    'Startup paths cross into the loop as initialWatchPaths because the startup hook run precedes the loop that owns the watcher.',
  ],
  changes: [
    { file: 'src/agent.ts', change: 'startSession returns merged watchPaths', sha256: sha(read('src/agent.ts')) },
    { file: 'src/interactive.ts', change: 'initialWatchPaths and start-time registration', sha256: sha(read('src/interactive.ts')) },
    { file: 'src/cli.ts', change: 'passes initialWatchPaths', sha256: sha(read('src/cli.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'returned paths assertion', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'test/interactive.test.ts', change: 'instruction_watch assertion', sha256: sha(read('test/interactive.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W111', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W111', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W111-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W111-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '63/63 (agent-lifecycle, interactive)',
    build: 'exit 0',
    full: '2,150/2,150',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'ec6093d643195af8d008d0a16af050eff84d5df42524d697d21dbb70ad758521',
  },
  residuals: [
    'The remaining C-6 script semantics are unconsumed.',
    'The source replace mode for plugin-late hooks has no local analogue.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with the remaining script semantics.',
};
write('research/ports/W111-sessionstart-watch-paths-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW111-01 consumes SessionStart',
  'research/coding-standard.md': '\n2026-10-17 W111-01 ',
  'research/FEATURES.md': 'W111 registers SessionStart',
  'research/ports/W111-sessionstart-watch-paths.md': '# W111 — SessionStart watchPaths',
  '.audit/w111-runtime.todo.md': '\n## W111-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
