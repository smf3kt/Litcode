// W122-01 record: conditional skills by frontmatter paths.
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

const note = `# W122 — Conditional skills (frontmatter \`paths\`)

## Source position

\`qlr\` parses a skill's frontmatter and stores \`paths: smn(z)\` (chunk-sfn1dbxq.js
offset 3376365); \`smn\` (offset 3374436) splits the string or array with the
brace-aware comma splitter \`bRt\` (chunk-zm79vshj.js offset 8785), drops a
trailing \`/**\`, discards empty entries, and returns undefined when nothing
meaningful remains or every entry is \`**\`. The assembler \`sAr\` (offset
3392751) then partitions the de-duplicated skills: a prompt skill with a
non-empty \`paths\` goes to \`conditionalSkills\` keyed by name instead of the
returned catalog, unless \`activatedConditionalSkillNames\` already holds it.

Activation is \`emn\` (offset 3398872). For each held skill it builds a
gitignore matcher from the paths (\`cKe\` filters patterns the matcher cannot
compile, chunk-2bcyxj9q.js offset 152393), then for each touched path: an
absolute path is made relative to the workspace, and empty, \`..\`-prefixed or
absolute results are skipped; the first match moves the skill from
\`conditionalSkills\` to \`dynamicSkills\`, records its name in
\`activatedConditionalSkillNames\`, logs the matched path and emits
\`dynamicSkillsLoaded\`. \`MU\` (offset 3399649) calls it from the read, write and
edit tool paths before the access (offsets 739846, 3547532, 4167540).

## Port

- \`SkillInfo.paths\` carries the normalized patterns; \`skillPathPatterns\`
  reproduces \`smn\` including the comma/brace split and the \`/**\` trim, and a
  non-string pattern raises a \`ConfigError\` instead of dropping the skill.
- \`loadProjectConfig\` returns live \`skills\` and \`conditionalSkills\` separately
  (\`LoadedConfig.conditionalSkills\`), so every caller gets the same split the
  recovered assembler performs.
- \`SessionConfig.heldSkills\` is the live held list. \`activateTouchedSkills\`
  (src/skill-catalog.ts) moves matching entries into the captured \`skills\`
  array in place and re-renders the system-prompt section only when something
  activated.
- \`Agent.ruleContext\` calls the activation for every path-bearing tool input
  before the tool runs. The next model request reads the updated
  \`config.system\`, so the new catalog entry is visible without a restart.
- The matcher is the \`ignore\` package the recovered bundle itself uses; pattern
  semantics (a directory pattern covers descendants, \`!\` re-includes) are
  therefore identical. Activation of a name already in \`skills\` is a no-op
  because it left the held list with the same name.

## Adaptation

- The recovered trigger is wired to read/write/edit only. This runtime applies
  the same touch test to every path-bearing tool already covered by
  \`ruleContext\` (read_media, notebook_read, notebook_edit, lsp, search,
  list_files); the trigger is idempotent and strictly additive.
- Dynamic directory discovery (\`dAr\`/\`E3t\`, which loads \`.claude/skills\`
  directories found beside a touched path) is not ported; this package covers
  the conditional-skill half only.
- The source's reserved-name refusal and collision naming are unchanged (still
  open under C-10).

## Verification

\`config\` pins normalization (\`src/**\` → \`src\`, \`**\` → unconditional, string
form, empty list, non-string error) and the partition. The activation tests pin
gitignore semantics, one-level \`docs/*.md\`, negation via directory patterns,
workspace escape and absolute inputs. \`skill-runtime\` pins the live catalog
and prompt re-render through the captured array. \`agent-lifecycle\` pins that a
matching read activates the skill before the next model request and a
non-matching read leaves it held. Focused 134/134, lifecycle 55/55, tsc 0,
build 0, full 2,190/2,190, chain 768/768, identity \`a27c3443…\`.
`;
write('research/ports/W122-conditional-skills.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W122-01 ports conditional skills. A skill whose frontmatter names \`paths\` is held out of the
loaded catalog; \`loadProjectConfig\` returns it separately and \`SessionConfig.heldSkills\` keeps
the live list. Every path-bearing tool call runs the recovered activation test: the touched path
is made workspace-relative, patterns are matched with the same gitignore library the source
bundles, and the first match moves the skill into the captured catalog array and re-renders the
system-prompt section before the next request. \`src/**\` normalizes to \`src\`, a lone \`**\` leaves
the skill unconditional, a non-string pattern is a config error, and paths outside the workspace
never activate. Dynamic directory discovery remains open. Focused 134/134, lifecycle 55/55, tsc 0,
build 0, full 2,190/2,190, chain 768/768, identity \`a27c3443…\`. [W122 record](ports/W122-conditional-skills.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W122-01 条件技能paths：S-1（先读源）：qlr 3376365、smn 3374436、bRt 8785（chunk-zm79vshj.js）、sAr 3392751、emn 3398872、cKe 152393（chunk-2bcyxj9q.js）、MU 3399649及调用点739846/3547532/4167540（chunk-sfn1dbxq.js）；frontmatter paths 425241。S-2（不臆造）：smn 的去尾/**与全**即无条件照抄；激活按 ignore 语义、绝对路径转相对并跳过..与绝对结果；非字符串paths报错而非静默丢弃。S-3（边界）：源只在read/write/edit触发，本地沿用ruleContext的路径工具集合（幂等、只增不减）；动态目录发现dAr/E3t不在本包；保留名与冲突命名仍开放。S-4（可测）：config新增3条、skill-runtime新增1条、agent-lifecycle新增2条。S-5：新增 ignore@7.0.5（源自身使用的同一库），notices已再生成。S-6：无其他依赖变化。S-7：端口记录与证据JSON。验证：聚焦134/134、生命周期55/55、tsc 0、build 0、全量2,190/2,190、链768/768、notices 0、索引75 chunks/323,525 units不变、身份a27c3443…。
`);

replaceOnce('research/FEATURES.md',
  'source precedence and dynamic discovery remain gaps; W121 journals every inline shell span before its effect and reports an interrupted span once on the next run.',
  'source precedence is implemented and covered; W122 adds conditional skills (frontmatter `paths` holds a skill out of the catalog until the model touches a matching workspace path, then the skill joins the live catalog and system prompt; dynamic directory discovery remains a gap); W121 journals every inline shell span before its effect and reports an interrupted span once on the next run.');

replaceAll('research/CURRENT.md',
  '；W121交付内联shell效果日志（spawn前fsync started、结束写finished/failed、崩溃后下次运行一次性报告并确认unknown，仅存skill/序号/SHA-256，损坏或超4MiB失败关闭）；来源优先级、动态发现；',
  '；W121交付内联shell效果日志（spawn前fsync started、结束写finished/failed、崩溃后下次运行一次性报告并确认unknown，仅存skill/序号/SHA-256，损坏或超4MiB失败关闭）；W122交付条件技能frontmatter paths（smn式归一化、加载时拆出held清单、ignore语义按touch路径激活并入目录与系统提示、非字符串报错、工作区外不激活）；来源优先级已由W99覆盖；动态目录发现；', 3);

const tsv = [
  ['2026-10-17T14:20:00Z', 'package', 'W122-01 条件技能paths',
    'qlr 3376365、smn 3374436、bRt 8785、sAr 3392751、emn 3398872、MU 3399649、调用点739846/3547532/4167540',
    '加载时拆held；touch路径按ignore语义激活；目录数组原地追加并重渲染system；非字符串报错',
    'config新增3；skill-runtime新增1；lifecycle新增2；聚焦134/134；tsc 0；build 0；全量2,190/2,190；链768/768'],
  ['2026-10-17T14:22:00Z', 'decision', 'W122-01 依赖与适配',
    '源使用ignore库做gitignore匹配；本地无该依赖',
    '新增ignore@7.0.5并再生成notices；触发集合沿用ruleContext路径工具（幂等）；动态目录发现仍开放',
    '.audit/w122-01-notices.txt'],
  ['2026-10-17T14:24:00Z', 'verification', 'W122-01 验收：聚焦134/134、lifecycle55/55、tsc 0、build 0、2,190/2,190、768/768',
    'src/**→src；**无条件；非字符串报错；工作区外/绝对路径不激活；目录数组身份保持；system重渲染',
    'notices 0；索引75 chunks/323,525 units不变；identity a27c3443…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w122-runtime.tsv', tsv + '\n');

write('.audit/w122-runtime.todo.md', `# W122 runtime trail

## W122-01 acceptance (2026-10-17)

- [x] **Source read.** \`smn\` normalizes paths, \`sAr\` holds them, \`emn\` activates
  on a touched workspace-relative path, \`MU\` runs the test from the file tools.
- [x] **Port.** Frontmatter \`paths\`, the loader split, the live held list, the
  gitignore matcher and the in-place catalog/prompt update.
- [x] **Bounds.** \`/**\` trim and lone-\`**\` rules, non-string error, workspace
  escape/absolute skip, no-op re-activation, dynamic directory discovery left
  open, ignore@7.0.5 noticed.
- [x] **Gates.** focused 134/134, lifecycle 55/55, tsc 0, build 0, full
  2,190/2,190, chain 768/768, notices 0, source index unchanged, identity
  \`a27c3443…\`.
- [ ] Remaining C-10: dynamic directory discovery, reserved names and collision
  naming.
`);

const evidence = {
  schema: 'W122ConditionalSkillsEvidence.v1',
  package: 'W122-01 — Conditional skills by frontmatter paths',
  date: '2026-10-17',
  question: 'How does the recovered runtime keep a path-scoped skill out of the catalog until the model touches a matching file?',
  answer: 'The loader normalizes frontmatter paths (comma/brace split, trailing /** trim, lone ** means unconditional) and stores path-scoped skills in a conditional list instead of the returned catalog. A touched workspace-relative path is tested with the same gitignore matcher the source bundles; the first match moves the skill into the live catalog and re-renders the system-prompt section before the next model request. Non-string paths fail config load; absolute or escaping targets never activate.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    modules: {
      'extracted-v2/modules/chunk-sfn1dbxq.js': [3376365, 3374436, 3392751, 3398872, 3399649, 739846, 3547532, 4167540, 425241],
      'extracted-v2/modules/chunk-zm79vshj.js': [8785],
      'extracted-v2/modules/chunk-2bcyxj9q.js': [152393],
    },
  },
  behavior: {
    heldUntilTouched: true,
    normalizationStripsTrailingGlobstar: true,
    loneGlobstarUnconditional: true,
    nonStringPathThrows: true,
    matcher: 'ignore@7.0.5 (gitignore semantics)',
    workspaceEscapeSkipped: true,
    absoluteTargetsMadeRelative: true,
    catalogArrayIdentityPreserved: true,
    systemPromptRerenderedOnActivation: true,
    activationIdempotent: true,
  },
  adaptations: [
    'The source triggers activation from the read, write and edit tools only; this runtime applies the same test to every path-bearing tool ruleContext already covers (read_media, notebook_read, notebook_edit, lsp, search, list_files). The test is idempotent and strictly additive.',
    'Dynamic directory discovery (dAr/E3t scanning .claude/skills beside the touched path) is not ported; only the conditional-skill half is covered.',
    'Reserved-name refusal and collision naming remain open under C-10.',
    'ignore@7.0.5 is added as a direct dependency because the recovered bundle uses the same library; notices were regenerated.',
  ],
  changes: [
    { file: 'src/config.ts', change: 'parse paths, split conditional skills, activation matcher', sha256: sha(read('src/config.ts')) },
    { file: 'src/skill-catalog.ts', change: 'held list and in-place catalog activation', sha256: sha(read('src/skill-catalog.ts')) },
    { file: 'src/session.ts', change: 'heldSkills config field and schema', sha256: sha(read('src/session.ts')) },
    { file: 'src/agent.ts', change: 'touch trigger before path tools', sha256: sha(read('src/agent.ts')) },
    { file: 'src/cli.ts', change: 'install held list at startup', sha256: sha(read('src/cli.ts')) },
    { file: 'src/reload.ts', change: 'install held list on reload', sha256: sha(read('src/reload.ts')) },
    { file: 'package.json', change: 'ignore dependency', sha256: sha(read('package.json')) },
    { file: 'test/config.test.ts', change: 'normalization and activation tests', sha256: sha(read('test/config.test.ts')) },
    { file: 'test/skill-runtime.test.ts', change: 'catalog activation test', sha256: sha(read('test/skill-runtime.test.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'touch trigger tests', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-10 rows record W122', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Skills row records W122', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W122-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W122-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '134/134 (config, skill-runtime, skill-effects, reload, runtime)',
    lifecycle: '55/55',
    build: 'exit 0',
    full: '2,190/2,190',
    chain: '768/768',
    notices: 'exit 0 (ignore@7.0.5 retained)',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'a27c3443617a4770c0d2d1516bcb4172b80c478a5e52bd7ed963546805393e18',
  },
  residuals: [
    'C-10 dynamic directory discovery (dAr/E3t) remains open.',
    'C-10 reserved-name refusal and collision naming remain open.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-10 continues with dynamic directory discovery.',
};
write('research/ports/W122-conditional-skills-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW122-01 ports conditional skills',
  'research/coding-standard.md': '\n2026-10-17 W122-01 ',
  'research/FEATURES.md': 'W122 adds conditional skills',
  'research/ports/W122-conditional-skills.md': '# W122 — Conditional skills',
  '.audit/w122-runtime.todo.md': '\n## W122-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
