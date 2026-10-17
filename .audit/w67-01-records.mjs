// W67-01 record: the OS-managed policy directory is read when no explicit file is given.
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

const note = `# W67 — the OS-managed policy directory

## Source position

The recovered file tier is \`Lko\` (chunk-3cynezh1.js, UTF-16 [388831,389776), 945 units): it reads
\`managed-settings.json\` in the managed directory and then every entry of \`managed-settings.d\`
accepted by \`X$s\` ([388659,388726), 67 units = regular file or symlink, name ends \`.json\`, name
does not start with a dot), sorted by name, and folds each document through \`Nd\`
([387659,388542), 883 units), whose merge line is \`e.merged=MB(e.merged,r,Y3)\` at 388440. The
directory is \`My\` ([360332,360539), 207 units): macOS \`/Library/Application Support/ClaudeCode\`,
Windows \`C:\\Program Files\\ClaudeCode\`, otherwise \`/etc/claude-code\`; the base file is \`m_\`
([387272,387326), 54 units) and the drop-in directory is \`eC()\` joined with \`managed-settings.d\`
(\`Ad\`, cached, [359965,360332)). \`Eut\` ([387326,387659), 333 units) adds the WSL inheritance arm.

## Port

\`src/config.ts\` now imports the already-ported source seams — \`managedSettingsDir()\` and the
source's own merge customizer \`mergeSettings\` — and adds \`loadManagedSettingsDirectory\`:

- no explicit \`managedSettingsFile\`: read \`<dir>/managed-settings.json\`, then
  \`<dir>/managed-settings.d/*.json\` as regular files or symlinks, non-hidden, sorted by name;
- merge with \`mergeSettings\`, the source's \`MB(..., Y3)\` (arrays concatenate and dedupe,
  \`fallbackModel\` replaces, the marketplace and managed-MCP maps take a one-level override);
- project each document onto the four policy keys this runtime carries (\`allowShell\`,
  \`permissions\`, \`features\`, \`mcpClient\`); other keys are dropped and reported once by name;
- a missing directory or file is absence; an unreadable, non-JSON or non-object document is
  reported and contributes nothing; a merged document the policy schema rejects yields no policy;
- the report (\`managedSettingsReport\`) names the source, directory, documents read in merge order,
  ignored keys and errors.

The explicit-file path is unchanged and remains strict: unknown keys and schema errors throw.
Managed fields still replace authored fields after every settings layer, so the policy precedence
recorded in W45 is preserved.

## Deliberate omissions

- Remote/account policy is excluded by the user's local-only directive.
- The plist/registry tiers, WSL inheritance (\`Eut\`), policy-helper flag protocol, substitutions
  (\`onlySubstitutes\`/\`Nd\` floor records), document-link bookkeeping and the \`loadState\` enum are
  not ported; the product reads the local file tier only.
- JSON is parsed strictly (no comments), matching the product's existing settings reader.
- The source's full settings schema accepts many more keys; this runtime reports and drops the
  ones it has no policy for instead of pretending to enforce them.

## Verification

\`config\` 69/69 including two new cases (base + sorted drop-ins with symlink, hidden/non-JSON/
directory exclusions and report; missing directory plus a broken document that contributes
nothing). Settings chain suites 15/15; tsc 0; build 0; full 2,092/2,092; chain 767/767; notices 0;
source index unchanged; identity \`b1c74f0c…\`.
`;
write('research/ports/W67-os-managed-policy.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W67-01 reads the local OS-managed policy directory when no explicit policy file is given. The
ported source seams give the platform directory (\`My\`), base file (\`m_\`) and the source merge
customizer; the new loader follows \`Lko\`'s file tier (base then non-hidden \`.json\` drop-ins by
name, regular files and symlinks) and reports ignored keys and unreadable documents instead of
inventing policy. Explicit-file strictness and managed-over-authored precedence are unchanged.
Remote policy, the plist/registry and WSL tiers, substitutions and the full approval flow remain
out of scope. tsc 0, config 69/69, settings chains 15/15, full 2,092/2,092, chain 767/767,
identity \`b1c74f0c…\`. [W67 record](ports/W67-os-managed-policy.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W67-01 本地 OS 托管策略目录：S-1（先读源）：Lko [388831,389776)、X$s [388659,388726)、Nd [387659,388542) 合并行 388440、My [360332,360539)、m_ [387272,387326) 逐段核对（UTF-16 单元）。S-2（不臆造）：未移植 plist/注册表、WSL 继承（Eut）、替换值与 loadState；只读本地文件层，四类策略键外的键上报并丢弃。S-3（边界）：显式 --managed-settings 保持严格抛错；目录缺失视为无策略，读取/解析失败只记录不伪造策略。S-4（可测）：两条新用例覆盖基础文件+排序 drop-in+符号链接+排除规则+报告，以及缺失目录与损坏文档。S-5/S-6：无新增依赖，复用已移植 seam 与合并定制器。S-7（记录）：端口记录、证据 JSON 与 W08 附录。验证：tsc 0、config 69/69、settings 链 15/15、全量 2,092/2,092、链 767/767、身份 b1c74f0c…。
`);

const featureOld = 'OS/remote managed policy,unvisited directories,isolated child paths and full recursive coverage remain gaps';
const featureNew = 'The local OS-managed policy directory is now read when no explicit file is given: the platform managed-settings.json then non-hidden managed-settings.d/*.json by name, regular files and symlinks, merged with the source customizer; ignored keys and unreadable documents are reported, and remote managed policy,unvisited directories,isolated child paths and full recursive coverage remain gaps';
const featureText = read('research/FEATURES.md');
if (featureText.split(featureOld).length - 1 !== 1) throw new Error('FEATURES OS-managed sentence count changed');
write('research/FEATURES.md', featureText.replace(featureOld, featureNew));

const permOld = 'OS/remote managed enforcement and original full approval flows remain separate';
const permNew = 'Local OS-managed permission policy now reaches the same managed snapshot enforcement;remote managed enforcement and original full approval flows remain separate';
const featureText2 = read('research/FEATURES.md');
if (featureText2.split(permOld).length - 1 !== 1) throw new Error('FEATURES permission sentence count changed');
write('research/FEATURES.md', featureText2.replace(permOld, permNew));

const rowOld = '| C-5 | 托管与策略 | OS/远程托管策略执行与完整审批流、完整递归配置发现、provider/key 策略 | Project settings/instructions；Permissions |';
const rowNew = '| C-5 | 托管与策略 | 本地 OS 托管策略目录已完成（W67-01：无显式策略文件时读取平台目录的 managed-settings.json 与 managed-settings.d/*.json，按名排序、仅常规文件/符号链接、非隐藏 .json，按源合并规则叠加并上报忽略键与读取错误；显式文件仍严格，托管先于作者设置的优先级不变）；远程托管策略、完整审批流、完整递归配置发现与 provider/key 策略仍待处理 | Project settings/instructions；Permissions |';
const current = read('research/CURRENT.md');
if (current.split(rowOld).length - 1 !== 3) throw new Error('CURRENT C-5 row count changed');
write('research/CURRENT.md', current.split(rowOld).join(rowNew));

write('research/ports/W08-policy-helper.md', read('research/ports/W08-policy-helper.md').replace(/\n+$/, '\n') + `

## W67-01 local OS-managed directory (2026-10-17)

The static default payload the helper falls back to is now the OS-managed policy when no explicit
\`--managed-settings\` file is given: the platform directory's base file and non-hidden \`.json\`
drop-ins, merged with the source customizer. Only the local file tier is read; the plist/registry
tiers, WSL inheritance and the remote policy path stay External. See
[W67 record](W67-os-managed-policy.md).
`);

const tsv = [
  ['2026-10-17T12:20:00Z', 'package', 'W67-01 本地 OS 托管策略目录',
    '无显式文件时读平台目录 managed-settings.json + managed-settings.d/*.json（排序、常规文件/链接、非隐藏），mergeSettings 叠加，上报忽略键/错误；四键投影',
    '恢复源 Lko/X$s/Nd/My/m_ 核对；plist/注册表/WSL/替换值未移植',
    'config 69/69；settings 链 15/15；tsc 0；全量 2,092/2,092；链 767/767'],
  ['2026-10-17T12:24:00Z', 'decision', 'W67-01 读取失败不伪造策略',
    '① 目录/文件缺失=无策略；② 不可读、非 JSON、非对象文档记录后跳过；③ 合并后策略 schema 拒绝则不产生策略；④ 显式 --managed-settings 保持抛错语义；⑤ 四键外的键上报一次并丢弃',
    '残余：远程策略、plist/注册表、WSL 继承、替换值、完整审批流、注释式 JSON',
    '.audit/w67-01-full.txt'],
  ['2026-10-17T12:27:00Z', 'verification', 'W67-01 验收：config 69/69、settings 15/15、2,092/2,092、767/767、身份 b1c74f0c…',
    '基础+排序 drop-in 合并、符号链接读取、隐藏/非 JSON/目录排除、忽略键报告；缺失目录无策略；损坏文档不产生策略',
    'tsc 0；build 0；notices 0；索引 75 chunks / 323,525 单位不变；identity 5ef9e11b…→b1c74f0c…（新增注释与实现）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w67-runtime.tsv', tsv + '\n');

write('.audit/w67-runtime.todo.md', `# W67 runtime trail

## W67-01 acceptance (2026-10-17)

- [x] **Recovered order matched.** Base \`managed-settings.json\`, then non-hidden \`.json\` drop-ins
  (regular files and symlinks) sorted by name, as \`Lko\`/\`X$s\` do.
- [x] **Source merge.** Documents fold through the ported \`MB(..., Y3)\` customizer.
- [x] **Product policy projection.** Only \`allowShell\`, \`permissions\`, \`features\`, \`mcpClient\`
  are enforced; other keys are reported and dropped.
- [x] **Failure semantics.** Missing directory is absence; unreadable/invalid documents are
  reported and contribute nothing; an invalid merged policy yields no policy.
- [x] **Explicit file unchanged.** Strict unknown-key and schema errors still throw.
- [x] **Gates.** tsc 0, config 69/69, settings chain 15/15, build 0, full 2,092/2,092, chain
  767/767, notices 0, index unchanged, identity \`b1c74f0c…\`.
- [ ] Remaining C-5: remote policy (excluded), full approval flow, recursive discovery,
  provider/key policy.
`);

const evidence = {
  schema: 'W67OsManagedPolicyEvidence.v1',
  package: 'W67-01 — local OS-managed settings directory discovery',
  date: '2026-10-17',
  question: 'Does the product read a locally deployed managed policy when no explicit policy file is given, with the source file-tier order and merge rules?',
  answer: 'Yes: the platform managed-settings.json and non-hidden drop-ins are read in the source order, merged with the source customizer, projected onto the four carried policy keys, and reported; explicit-file strictness and managed-over-authored precedence are unchanged.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-3cynezh1.js',
    unit: 'UTF-16 code units',
    fileTier: { symbol: 'Lko', range: [388831, 389776], units: 945 },
    dropInFilter: { symbol: 'X$s', range: [388659, 388726], units: 67 },
    nameRule: { symbol: 'mZ', range: [388597, 388659], units: 62 },
    mergeInto: { symbol: 'Nd', range: [387659, 388542], units: 883, mergeLine: 388440 },
    directory: { symbol: 'My', range: [360332, 360539], units: 207 },
    baseFile: { symbol: 'm_', range: [387272, 387326], units: 54 },
    wslArm: { symbol: 'Eut', range: [387326, 387659], units: 333, ported: false },
  },
  behavior: {
    discovery: 'options.managedSettingsFile wins; otherwise options.managedSettingsDir (test/caller seam where source Oko is dead) or managedSettingsDir()',
    order: 'managed-settings.json, then managed-settings.d names sorted ascending',
    filter: 'regular file or symlink, name ends .json, name does not start with "."',
    merge: 'mergeSettings(merged, document) — the source MB(..., Y3)',
    projection: ['allowShell', 'permissions', 'features', 'mcpClient'],
    ignored: 'other keys are dropped and reported once per key',
    errors: 'missing directory/file is absence; unreadable, invalid JSON or non-object documents and schema-rejected merges are reported and contribute no policy',
    explicitFile: 'unchanged strict path: unknown keys and schema errors throw',
  },
  changes: [
    { file: 'src/config.ts', change: 'managedSettingsDir option, loadManagedSettingsDirectory, report type, discovery wiring', sha256: sha(read('src/config.ts')) },
    { file: 'test/config.test.ts', change: 'two managed-directory cases', sha256: sha(read('test/config.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-5 rows record the local file tier', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'project settings and permissions rows', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W67-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W67-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
    { file: 'research/ports/W08-policy-helper.md', change: 'W67-01 addendum', sha256: sha(read('research/ports/W08-policy-helper.md')) },
  ],
  tests: {
    file: 'test/config.test.ts',
    added: [
      'the OS-managed directory merges its base file and sorted drop-ins',
      'a missing managed directory is absence and a broken document contributes nothing',
    ],
    result: 'config 69/69; settings chain suites 15/15',
  },
  gates: {
    tsc: 'exit 0',
    build: 'exit 0',
    config: '69/69',
    settingsChain: '15/15',
    full: '2,092/2,092',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'b1c74f0cd1d7691847491fd1919d64b2910fa47814b598339eb3912501f19dd9',
  },
  residuals: [
    'Remote/account managed policy is excluded by the local-only directive.',
    'The plist and Windows registry tiers, WSL inheritance (Eut) and the policy-helper flag protocol are not ported.',
    'Substitution values (onlySubstitutes / Nd floors), document-link bookkeeping and the loadState enum are not ported.',
    'Managed files must be strict JSON; comments are rejected and reported.',
    'Keys outside the four carried policy keys are reported and dropped, not enforced.',
    'The full original approval flow and recursive configuration discovery remain C-5 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-5 continues with the approval flow and recursive discovery; remote policy stays excluded.',
};
write('research/ports/W67-os-managed-policy-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW67-01 reads the local OS-managed policy',
  'research/coding-standard.md': '\n2026-10-17 W67-01 ',
  'research/FEATURES.md': 'The local OS-managed policy directory is now read',
  'research/ports/W67-os-managed-policy.md': '# W67 — the OS-managed policy directory',
  'research/ports/W08-policy-helper.md': '\n## W67-01 local OS-managed directory',
  '.audit/w67-runtime.todo.md': '\n## W67-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
