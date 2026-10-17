// W104-01 record: SessionStart reloadSkills.
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

const note = `# W104 — SessionStart reloadSkills

## Source position

\`reloadSkills\` is a SessionStart output field described as "Re-scan skill and
command directories after SessionStart hooks complete, so skills installed by
the hook are available in the same session" (chunk-n3ykh62m.js offset 392149;
schema at chunk-r2vtj1kh.js offset 205984). The hook loop keeps it sticky when
any output sets it true (\`H7\`, chunk-sfn1dbxq.js offset 2482855). After the
loop it runs \`bM(),$5(),i1.emit()\`: \`bM\` is \`VT(),Nhr(),Fhr(),Hz()\` at offset
1675968 (commands, agents, output styles, skill dirs), \`$5\` resets the
sent-skill names at offset 3689254, and \`i1\` emits the \`skillsChanged\` signal
defined at offset 2478788. The schema admits only \`true\`.

## Port

\`HookResult\` gains \`reloadSkills\`, parsed only from SessionStart output with
\`=== true\`. \`Agent.startSession\` applies it after the hooks complete and after
the title handling, so every start path (interactive, headless, clear/fork,
subagents, execution-mode skills) gets the rescan. \`skill-catalog.ts\` owns the
shared catalog section: \`buildSystem\` now renders through \`skillsSection\`, and
\`reloadSkills\` re-reads the skill directories, replaces the live array's
contents in place (the model-facing skill tool holds that reference) and
rewrites the system prompt's catalog section while preserving any later
sections. Settings, hooks, permissions and instructions stay as loaded.

## Adaptation

The source invalidates derived cache tables. This product has no derived caches:
its catalog is the session config's \`skills\` array, read at call time, and its
rendered form is the system prompt string, so the equivalent is an in-place
array replacement plus a section rewrite. \`$5\`'s sent-skill-name reset has no
counterpart here, and \`i1\`'s change signal has no subscriber. A legacy
configuration (\`skills === undefined\`) has no skill tool to feed and is left
alone. A rescan failure is reported through the status stream and keeps the
previous catalog. The rescan uses \`loadProjectConfig\`, which validates settings
on the way; the source touches only skill directories.

## Verification

\`hooks\` asserts SessionStart-only parsing for \`true\`, the \`false\` skip and the
UserPromptSubmit ignore. \`reload\` proves additions, removals, the preserved
array reference, the rewritten section, unchanged settings and the legacy
no-op. \`agent-lifecycle\` proves a hook-installed skill reaches the live catalog
and the system prompt after \`startSession\`. Focused 110/110, tsc 0, build 0,
full 2,140/2,140, chain 767/767, notices 0, identity \`b59db97a…\`.
`;
write('research/ports/W104-skill-reload.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W104-01 honors the SessionStart \`reloadSkills\` output. After the hooks
complete, the skill directories are re-scanned, the live catalog array is
replaced in place so the already-built skill tool sees it, and the system
prompt's catalog section is rewritten; settings, hooks, permissions and
instructions stay as loaded. A legacy configuration without a skill catalog and
a failed rescan both keep the previous state. Focused 110/110, tsc 0, build 0,
full 2,140/2,140, chain 767/767, identity \`b59db97a…\`.
[W104 record](ports/W104-skill-reload.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W104-01 SessionStart reloadSkills：S-1（先读源）：输出 schema 392149/205984、粘性标志与消费点 2482855、bM 1675968、$5 3689254、i1 2478788。S-2（不臆造）：仅 SessionStart 且 ===true；重扫在钩子完成后执行；设置/钩子/权限/指令不重载。S-3（边界）：本产品无派生缓存，等价实现为原地替换 skills 数组（技能工具持有引用）并重写系统提示技能段且保留后续段；legacy（skills 未定义）不动；重扫失败保留旧目录并经状态流报告；loadProjectConfig 会顺带校验设置（源的 bM 只碰技能目录），记录为本地适配。S-4（可测）：hooks 断言解析/跳过/他事件忽略；reload 断言增删、数组引用、系统段、设置不变与 legacy 空操作；agent-lifecycle 断言钩子安装的技能进入活动目录与系统提示。S-5/S-6：无依赖变化；SKILL_TOOL_NAME 迁至 skill-catalog 并由 runtime 再导出。S-7（记录）：端口记录与证据 JSON。验证：聚焦 110/110、tsc 0、build 0、全量 2,140/2,140、链 767/767、身份 b59db97a…。
`);

replaceOnce('research/FEATURES.md',
  'for the front end to queue ahead of typed input |',
  'for the front end to queue ahead of typed input; W104 honors the SessionStart `reloadSkills` output by rescanning skill directories in place (live array and system-prompt section) without reloading settings |');

replaceAll('research/CURRENT.md',
  '由前端入队为首个用户轮次）；完整消费者',
  '由前端入队为首个用户轮次；W104在SessionStart钩子请求reloadSkills时原地重扫技能目录并重建系统提示的技能段；完整消费者', 3);

const tsv = [
  ['2026-10-18T12:20:00Z', 'package', 'W104-01 SessionStart reloadSkills',
    'schema 392149/205984、消费点 2482855、bM 1675968、$5 3689254、i1 2478788',
    '仅SessionStart且===true；原地替换skills数组并重写系统技能段；设置不重载',
    'hooks/reload/agent-lifecycle/runtime-resources 110/110；tsc 0；build 0；全量 2,140/2,140；链 767/767'],
  ['2026-10-18T12:23:00Z', 'decision', 'W104-01 本地适配',
    '源使派生缓存失效；本产品目录即活动数组与系统提示文本',
    'legacy无技能工具时不动；重扫失败保留旧目录；SKILL_TOOL_NAME迁至skill-catalog并由runtime再导出',
    '.audit/w104-01-full.txt'],
  ['2026-10-18T12:26:00Z', 'verification', 'W104-01 验收：聚焦 110/110、tsc 0、build 0、2,140/2,140、767/767',
    '增删技能可见；数组引用保留；系统段重写且保留后续段；设置与权限不变；钩子安装技能进入活动目录',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity b59db97a…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w104-runtime.tsv', tsv + '\n');

write('.audit/w104-runtime.todo.md', `# W104 runtime trail

## W104-01 acceptance (2026-10-18)

- [x] **Source read.** Output schema, sticky flag, and the invalidation family
  with its two unported helpers.
- [x] **Port.** SessionStart-only parse; post-hook rescan in \`startSession\`;
  shared catalog section; in-place array replacement.
- [x] **Bounds.** Legacy no-op, rescan failure keeps the old catalog, settings
  untouched, later system-prompt sections preserved.
- [x] **Gates.** focused 110/110, tsc 0, build 0, full 2,140/2,140, chain
  767/767, notices 0, source index unchanged, identity \`b59db97a…\`.
- [ ] Remaining C-6: the rest of the script semantics
  (\`suppressOriginalPrompt\`, \`retry\`).
`);

const evidence = {
  schema: 'W104SkillReloadEvidence.v1',
  package: 'W104-01 — SessionStart reloadSkills',
  date: '2026-10-18',
  question: 'What does the SessionStart reloadSkills output change, and what is the equivalent when this product has no derived skill caches?',
  answer: 'Any SessionStart output setting reloadSkills true makes the hook loop re-scan skill directories after the hooks complete. This product replaces the live skills array in place and rewrites the system prompt\'s catalog section, leaving settings, hooks, permissions and instructions as loaded.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    description: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', offset: 392149 },
    schema: { module: 'extracted-v2/modules/chunk-r2vtj1kh.js', offset: 205984 },
    consumer: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 2482855 },
    invalidation: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'bM', offset: 1675968 },
    sentNamesReset: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: '$5', offset: 3689254 },
    changeSignal: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', symbol: 'i1', offset: 2478788 },
  },
  behavior: {
    events: ['SessionStart'],
    value: true,
    sticky: true,
    runsAfterHooks: true,
    reloadsSettings: false,
  },
  adaptations: [
    'The source invalidates derived command/skill cache tables; this product keeps a live skills array and a rendered system-prompt section, so it replaces the array contents in place and rewrites the section.',
    'The sent-skill-name reset and the skills-changed signal have no counterparts in this product.',
    'A legacy configuration with skills undefined keeps its catalog untouched because it has no skill tool.',
    'A failed rescan keeps the previous catalog and reports through the status stream; the rescan also validates settings because it uses loadProjectConfig.',
    'SKILL_TOOL_NAME moved to skill-catalog.ts and is re-exported from runtime.ts.',
  ],
  changes: [
    { file: 'src/hooks.ts', change: 'SessionStart-only reloadSkills parse', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/agent.ts', change: 'post-hook rescan with reported failure', sha256: sha(read('src/agent.ts')) },
    { file: 'src/skill-catalog.ts', change: 'catalog section and in-place rescan', sha256: sha(read('src/skill-catalog.ts')) },
    { file: 'src/runtime.ts', change: 'shared skillsSection and constant re-export', sha256: sha(read('src/runtime.ts')) },
    { file: 'test/hooks.test.ts', change: 'reloadSkills parse assertions', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'test/reload.test.ts', change: 'rescan behavior test', sha256: sha(read('test/reload.test.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'hook-driven catalog refresh test', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W104', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W104', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W104-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W104-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '110/110 (hooks, reload, agent-lifecycle, runtime-resources)',
    build: 'exit 0',
    full: '2,140/2,140',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'b59db97a6c6c6d0588161be424feafcb2ca3777f054847882c5ac886f781f327',
  },
  residuals: [
    'suppressOriginalPrompt and retry SessionStart outputs remain unconsumed.',
    'The rescan is an in-memory catalog refresh; the journal keeps the config snapshot from session open, and a resumed session re-runs its SessionStart hooks.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with suppressOriginalPrompt, retry and the remaining script semantics.',
};
write('research/ports/W104-skill-reload-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW104-01 honors the SessionStart',
  'research/coding-standard.md': '\n2026-10-18 W104-01 ',
  'research/FEATURES.md': 'W104 honors the SessionStart',
  'research/ports/W104-skill-reload.md': '# W104 — SessionStart reloadSkills',
  '.audit/w104-runtime.todo.md': '\n## W104-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
