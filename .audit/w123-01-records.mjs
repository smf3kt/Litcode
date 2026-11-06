// W123-01 record: dynamic skill directory discovery.
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

const note = `# W123 — Dynamic skill directory discovery

## Source position

\`MU\` (chunk-sfn1dbxq.js offset 3399634) runs from the read, write and edit
tool paths before the access (offsets 739846, 3547532, 4167540). It calls
\`dAr\` with the touched path and the workspace base, then loads the returned
directories with \`E3t\` and activates conditional skills for the same touch.
A request-time drain also reloads pending directories through \`E3t\` when the
Read tool is available.

\`dAr\` (offset 3396591) walks upward from the touched file's directory to the
workspace base. At each ancestor it forms \`<dir>/.claude/skills\`; the first
time a candidate is seen it records it in the session's \`dynamicSkillDirs\`
set, then keeps it only when the directory exists, is not ignored by git
(\`KAr\`: \`git check-ignore -- <dir>\`, chunk-x0dc37w9.js offset 4806), and is
not sync-owned. Discovery is skipped entirely when skills are disabled, a
policy base is active, or the session is diskless. Errors from a candidate are
swallowed; the walk continues at the next ancestor.

\`E3t\` (offset 3397661) loads every returned directory with the project source
(\`mO\`, offset 3384052), keeps prompt skills in \`dynamicSkills\` keyed by
\`skillRoot\` and name, removes stale entries when \`replace\` is set, and emits
\`dynamicSkillsLoaded\`. The recovered request assembly merges those entries
under the live catalog. A global rescan (\`WRn\`, offset 3399814) re-reads the
already discovered directories with \`{replace: true}\`.

## Port

- \`discoverTouchedSkills\` (src/skill-catalog.ts) climbs the same ancestors,
  substitutes the product's \`<HARNESS_DIR>/skills\` for the recovered
  \`.claude/skills\`, records every candidate in \`SessionConfig.dynamicSkillDirs\`
  before checking it, skips candidates that are absent or ignored by
  \`git check-ignore\`, and loads survivors with
  \`loadSkillsFromDirectories\` (source \`projectSettings\`).
- New skills are appended to the live \`skills\` array in place and the catalog
  section is re-rendered, so the next model request sees them. No \`contexts\`
  are returned, so a mutating tool is not forced to re-evaluate.
- \`loadSkillsFromDirectories\` scans each directory with the project loader's
  \`SKILL.md\` rules but skips a malformed entry instead of failing the tool
  call (\`mO\` logs and continues); names already live or held are not returned.
- \`reloadSkills\` re-reads \`dynamicSkillDirs\` after the static rescan, matching
  \`WRn\`; \`dynamicSkillDirs\` is journaled with the session config.

## Adaptation

- The recovered product scans \`.claude/skills\`; this product's configuration
  directory is neutral, so it scans \`.harness/skills\` and the workspace base is
  the session workspace.
- The recovered tool path queues directories on \`dynamicSkillDirTriggers\` and
  the request path drains them; this runtime awaits the load inside the touch
  trigger so the next request is deterministic. Loading is once per candidate
  directory per session, as in \`dAr\`.
- Duplicate names: the recovered \`E3t\` stores dynamic skills separately and
  merges by name during request assembly; this flat catalog skips a discovered
  name that is already live or held.
- Dynamic skills with frontmatter \`paths\` join the catalog directly. The
  recovered \`E3t\` stores every prompt skill in \`dynamicSkills\` without the
  load-time conditional split, so the visible behavior matches.
- The diskless, policy-base and sync-owned gates have no counterpart here.
  Reserved-name refusal and collision naming remain open under C-10.

## Verification

\`config\` pins tolerant directory loading (a malformed entry is skipped, an
existing name is filtered, a missing directory is a no-op). \`skill-runtime\`
pins ancestor discovery, the once-per-candidate set, the workspace boundary
and the gitignore skip through a real \`git check-ignore\`. \`agent-lifecycle\`
pins the touch trigger: after reading a nested file, the next request's system
prompt carries the discovered skill and the catalog array keeps its identity.
Focused pool 137/137, three-suite 164/164, tsc 0, build 0, full 2,194/2,194,
chain 768/768, identity \`4149770c…\`.
`;
write('research/ports/W123-dynamic-skill-discovery.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W123-01 ports dynamic skill directory discovery. Every path-bearing tool call walks from the
touched file's directory up to the workspace and records each \`<dir>/.harness/skills\` candidate
once per session. A candidate that exists and is not ignored by \`git check-ignore\` is loaded
with the project skill rules; malformed entries are skipped rather than failing the tool, names
already live or held are not duplicated, and new skills are appended to the live catalog and
re-rendered before the next request. \`reloadSkills\` re-reads the discovered directories after
the static rescan. Focused 137/137, three-suite 164/164, tsc 0, build 0, full 2,194/2,194, chain
768/768, identity \`4149770c…\`. [W123 record](ports/W123-dynamic-skill-discovery.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W123-01 动态技能目录发现：S-1（先读源）：MU 3399634（调用点739846/3547532/4167540）、dAr 3396591、E3t 3397661、mO 3384052、WRn 3399814（chunk-sfn1dbxq.js）、KAr 4806（chunk-x0dc37w9.js）。S-2（不臆造）：逐级向上到工作区、候选先记录后检查、git check-ignore跳过忽略目录、每目录每会话只检查一次、坏条目跳过不失败、动态技能含paths直接可见（E3t不分流）。S-3（边界）：.claude→.harness中性名；请求时排空改为touch内await；同名动态技能不覆盖已live/held；diskless/policy/sync门无对应物；保留名与冲突命名仍开放。S-4（可测）：config新增1条、skill-runtime新增2条（含真实git check-ignore）、lifecycle新增1条。S-5：无新依赖。S-6：仅会话配置新增dynamicSkillDirs并记入严格schema。S-7：端口记录与证据JSON。验证：聚焦137/137、三件套164/164、tsc 0、build 0、全量2,194/2,194、链768/768、notices 0、索引75 chunks/323,525 units不变、身份4149770c…。
`);

replaceOnce('research/FEATURES.md',
  'then the skill joins the live catalog and system prompt; dynamic directory discovery remains a gap);',
  'then the skill joins the live catalog and system prompt; W123 discovers nested `<dir>/.harness/skills` beside a touched path, checks `git check-ignore`, and loads new skills into the live catalog once per candidate directory);');

replaceAll('research/CURRENT.md',
  '；来源优先级已由W99覆盖；动态目录发现；',
  '；W123交付动态目录发现（touch路径逐级向上查<dir>/.harness/skills、候选先记录后检查且每会话一次、git check-ignore跳过忽略目录、坏条目跳过、新技能并入目录并重渲染、reload按已发现目录重载、工作区外不发现）；来源优先级已由W99覆盖；', 3);

const tsv = [
  ['2026-10-17T15:05:00Z', 'package', 'W123-01 动态技能目录发现',
    'MU 3399634、dAr 3396591、E3t 3397661、mO 3384052、WRn 3399814、KAr 4806（chunk-x0dc37w9.js）',
    '逐级向上、候选先记录后检查、git check-ignore、每目录一次、坏条目跳过、并入live目录并重渲染',
    'config新增1；skill-runtime新增2；lifecycle新增1；聚焦137/137；三件套164/164；tsc 0；build 0；全量2,194/2,194；链768/768'],
  ['2026-10-17T15:07:00Z', 'decision', 'W123-01 适配',
    '.claude→.harness；请求时排空→touch内await；同名不覆盖live/held；paths动态技能直接可见（E3t语义）',
    'dynamicSkillDirs记入严格session schema；reload重读已发现目录；diskless/policy/sync门无对应物',
    '.audit/w123-01-notices.txt'],
  ['2026-10-17T15:09:00Z', 'verification', 'W123-01 验收：聚焦137/137、三件套164/164、tsc 0、build 0、2,194/2,194、768/768',
    '祖先发现；每会话一次；工作区外不发现；真实git check-ignore跳过；下一请求system含新技能；数组身份保持',
    'notices 0；索引75 chunks/323,525 units不变；identity 4149770c…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w123-runtime.tsv', tsv + '\n');

write('.audit/w123-runtime.todo.md', `# W123 runtime trail

## W123-01 acceptance (2026-10-17)

- [x] **Source read.** \`MU\` triggers \`dAr\`, \`dAr\` walks ancestors and
  \`git check-ignore\`s the containing directory, \`E3t\` loads with the project
  source, \`WRn\` re-reads discovered directories on rescan.
- [x] **Port.** Session candidate set, ancestor walk, gitignore skip, tolerant
  directory loader, in-place catalog append and prompt re-render.
- [x] **Bounds.** Once per candidate, workspace boundary, no duplicate names,
  dynamic \`paths\` stay visible per \`E3t\`, diskless/policy/sync gates absent.
- [x] **Gates.** focused 137/137, three-suite 164/164, tsc 0, build 0, full
  2,194/2,194, chain 768/768, notices 0, source index unchanged, identity
  \`4149770c…\`.
- [ ] Remaining C-10: reserved names and collision naming.
`);

const evidence = {
  schema: 'W123DynamicSkillDiscoveryEvidence.v1',
  package: 'W123-01 — Dynamic skill directory discovery',
  date: '2026-10-17',
  question: 'How does the recovered runtime discover and load skills from a directory beside a touched path?',
  answer: 'A touch walks from the file directory up to the workspace base. Each <dir>/.claude/skills candidate is recorded in a session set before it is checked, so it is examined once; a candidate is loaded only when it exists and git check-ignore reports it is not ignored. The project loader scans the directory, keeps prompt skills in a dynamic map under the live catalog, and a rescan re-reads the recorded directories with replacement.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    modules: {
      'extracted-v2/modules/chunk-sfn1dbxq.js': [3399634, 3396591, 3397661, 3384052, 3399814, 739846, 3547532, 4167540],
      'extracted-v2/modules/chunk-x0dc37w9.js': [4806],
    },
  },
  behavior: {
    ancestorWalkToWorkspace: true,
    candidateRecordedBeforeCheck: true,
    checkedOncePerSession: true,
    requiresExistingDirectory: true,
    gitignoreSkipViaCheckIgnore: true,
    loadsWithProjectSource: true,
    malformedEntrySkipped: true,
    existingNamesNotDuplicated: true,
    catalogAppendedInPlace: true,
    systemPromptRerendered: true,
    reloadReReadsDiscoveredDirectories: true,
    outsideWorkspaceDiscovered: false,
  },
  adaptations: [
    'The recovered product scans .claude/skills; this product uses its neutral .harness/skills configuration directory.',
    'The recovered tool path queues directories on dynamicSkillDirTriggers and drains them at request assembly; this runtime awaits discovery and loading inside the touch trigger.',
    'Duplicate names: E3t keeps a separate dynamic map merged at request time; this flat catalog filters names already live or held.',
    'Dynamic skills carrying frontmatter paths join the catalog directly, matching E3t which stores every prompt skill in dynamicSkills without the conditional split.',
    'Diskless, policy-base and sync-owned gates have no counterpart in this runtime.',
    'Reserved-name refusal and collision naming remain open under C-10.',
  ],
  changes: [
    { file: 'src/config.ts', change: 'tolerant directory scan and loadSkillsFromDirectories', sha256: sha(read('src/config.ts')) },
    { file: 'src/skill-catalog.ts', change: 'ancestor discovery, gitignore check, catalog append, reload', sha256: sha(read('src/skill-catalog.ts')) },
    { file: 'src/session.ts', change: 'dynamicSkillDirs field and schema', sha256: sha(read('src/session.ts')) },
    { file: 'src/agent.ts', change: 'discovery from the touch trigger', sha256: sha(read('src/agent.ts')) },
    { file: 'test/config.test.ts', change: 'tolerant directory loader test', sha256: sha(read('test/config.test.ts')) },
    { file: 'test/skill-runtime.test.ts', change: 'discovery and gitignore tests', sha256: sha(read('test/skill-runtime.test.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'nested discovery integration test', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-10 rows record W123', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Skills row records W123', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W123-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W123-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '137/137 (config, skill-runtime, skill-effects, reload, runtime)',
    threeSuite: '164/164 (config, skill-runtime, agent-lifecycle)',
    build: 'exit 0',
    full: '2,194/2,194',
    chain: '768/768',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '4149770c592b2f237117295d04a5829e3f61f956e227bd3d59528dd06568aa3a',
  },
  residuals: [
    'C-10 reserved-name refusal and collision naming remain open.',
    'C-10 referenced-URL invalidation and the shell AST disposition remain open.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-10 continues with reserved-name refusal and collision naming.',
};
write('research/ports/W123-dynamic-skill-discovery-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW123-01 ports dynamic skill directory discovery',
  'research/coding-standard.md': '\n2026-10-17 W123-01 ',
  'research/FEATURES.md': 'W123 discovers nested',
  'research/ports/W123-dynamic-skill-discovery.md': '# W123 — Dynamic skill directory discovery',
  '.audit/w123-runtime.todo.md': '\n## W123-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
