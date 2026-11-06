// W124-01 record: close the C-10 residual list.
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

const note = `# W124 — Closing the C-10 residual list

C-10 (\`Skills；WebFetch/web tools\`) carried three residual phrases after
W123: source precedence, referenced URL invalidation and the recovered shell
AST, plus reserved names and collision naming from W122. Every one now has a
disposition; no product code changes.

## Reserved names and collision naming — excluded with account sync

Recovered evidence. The reserved list holds one name:
\`var uRe=["anthropic-skills"]\` (chunk-mven2c2x.js offset 619). \`b9t\`
(chunk-xrjhyksm.js offset 2913) maps a candidate onto that namespace by exact
match, \`<name>:\` prefix, or a first-segment comparison; \`I2\` at 3550 tests
it, \`vce\` at 3817 exempts synced skills and account-wrapped plugin skills, and
\`dqe\` at 3950 flags any non-synced skill whose name or \`userFacingName\`
lands in the namespace. The user-settings filter \`J9e\`
(chunk-sfn1dbxq.js offset 3373292) drops those entries and reports each
through \`Qfe\` (3372867), whose collision naming \`Nxr\` (3373506) recomputes
the directory path a namespaced skill would need. The refusal text itself says
the name are "reserved for the skills synced from your claude.ai account"
(chunk-xrjhyksm.js offset 3588).

Decision: excluded, not ported. The namespace exists only for claude.ai
account sync, and this product is local-only by an explicit constraint (no
account, subscription or sync transport). There is no synced namespace to
protect, so every local name is unreserved and there is nothing for collision
naming to rename. A local skill called \`anthropic-skills\` or
\`anthropic-skills:<x>\` loads like any other skill. Recorded as item 7 of
\`ports/remaining-dispositions.md\`; the \`syncOwnedPrefixes\` gate that \`dAr\`
uses has the same basis and was already recorded as having no counterpart in
W123.

## Referenced URL invalidation — already shipped

The phrase "a reference whose URL changes is dropped" describes the citation
rule in \`web_search\`: a citation is dropped when its URL is rewritten by
either redaction pass (\`src/web-search.ts\` line 155:
\`redact(rawUrl, secrets) !== rawUrl → continue\`). That landing is recorded in
\`ports/W19-credential-shapes.md\` and stated in the FEATURES WebFetch/web tools
row; the C-10 row text was stale, not a gap.

## Shell AST — decided not-ported

Item 3 of \`ports/remaining-dispositions.md\`: the recovered parser (\`SE\`,
chunk-sfn1dbxq.js [4697,4822), 10,000 character cap) loses to the tested
quote-group contract, which the product keeps.

## Verification

Documentation-only package: no source or test change. The last measured gates
are W123's — focused 137/137, three-suite 164/164, tsc 0, build 0, full
2,194/2,194, chain 768/768 — and the content identity is unchanged at
\`4149770c…\`.
`;
write('research/ports/W124-c10-dispositions.md', note);

write('research/ports/remaining-dispositions.md', read('research/ports/remaining-dispositions.md').replace(/\n+$/, '\n') + `
## 7. Reserved skill names and collision naming - excluded with account sync

Recovered evidence. The reserved list holds one name, \`var uRe=["anthropic-skills"]\` (chunk-mven2c2x.js offset 619). \`b9t\` (chunk-xrjhyksm.js offset 2913) maps a candidate onto that namespace by exact match, prefix, or first-segment comparison; \`I2\` at 3550 tests it, \`vce\` at 3817 exempts synced and account-wrapped plugin skills, and \`dqe\` at 3950 flags a non-synced skill whose name or \`userFacingName\` lands in the namespace. The user-settings filter \`J9e\` (chunk-sfn1dbxq.js offset 3373292) drops those entries and reports them through \`Qfe\` (3372867); the collision naming \`Nxr\` (3373506) recomputes the directory path a namespaced skill would have to move to. The refusal text names the skills synced from a claude.ai account (chunk-xrjhyksm.js offset 3588).

Decision: excluded, not ported. The namespace is populated only by account sync, and this runtime is local-only by explicit constraint (no account, subscription or sync transport). No synced namespace can exist, every local name is unreserved, and collision naming has nothing to rename. User-visible contract here: a local skill named \`anthropic-skills\` or \`anthropic-skills:<x>\` loads like any other skill. The \`syncOwnedPrefixes\` gate in \`dAr\` rests on the same excluded sync layer (W123 record).
`);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W124-01 closes the C-10 residual list without product changes. The \`anthropic-skills\` reserved
namespace and its collision naming are part of claude.ai account sync and are excluded with it;
the citation-drops-when-redaction-changes-its-URL rule is already the \`web_search\` contract
(\`src/web-search.ts\` line 155, recorded in W19); the recovered shell AST keeps its not-ported
decision. The disposition is item 7 of \`ports/remaining-dispositions.md\`; FEATURES and the
three C-10 rows now read as closed. Last measured gates are W123's (full 2,194/2,194) and the
identity is unchanged at \`4149770c…\`. [W124 record](ports/W124-c10-dispositions.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W124-01 C-10收口：S-1（先读源）：uRe=["anthropic-skills"]（chunk-mven2c2x.js 619）、b9t 2913、I2 3550、cqe 3588、dqe 3950、vce 3817（chunk-xrjhyksm.js）、J9e 3373292、Qfe 3372867、Nxr 3373506（chunk-sfn1dbxq.js）；引用URL丢弃见src/web-search.ts:155。S-2（不臆造）：保留名仅服务账号同步命名空间，按仅本地约束排除；URL丢弃已实现，属陈旧行文；shell AST维持既有不移植决定。S-3（边界）：本地同名技能正常加载，无同步命名空间可冲突。S-4：文档包无行为变更，未新增测试。S-5/S-6：无依赖变化。S-7：端口记录、dispositions第7项与证据JSON。验证：沿用W123闸门（全量2,194/2,194），身份4149770c…不变。
`);

replaceOnce('research/FEATURES.md',
  'and loads new skills into the live catalog once per candidate directory); W121 journals',
  'and loads new skills into the live catalog once per candidate directory); C-10 is closed: the `anthropic-skills` reserved namespace and its collision naming belong to claude.ai account sync and are excluded with it, the citation-drops-on-redaction rule is already the WebFetch/web tools contract, and the recovered shell AST stays decided not-ported (ports/remaining-dispositions.md); W121 journals');

replaceAll('research/CURRENT.md',
  '；来源优先级已由W99覆盖；引用 URL 变化即丢弃、shell AST 遗留 | Skills；WebFetch/web tools |',
  '；来源优先级已由W99覆盖；W124收口C-10（anthropic-skills保留名与冲突命名属账号同步域、按仅本地约束排除；引用URL被脱敏改写即丢弃已由WebSearch引用过滤实现；shell AST保持不移植） | Skills；WebFetch/web tools |', 3);

const tsv = [
  ['2026-10-17T15:40:00Z', 'package', 'W124-01 C-10收口',
    'uRe 619（chunk-mven2c2x.js）；b9t 2913、I2 3550、cqe 3588、dqe 3950、vce 3817（chunk-xrjhyksm.js）；J9e 3373292、Qfe 3372867、Nxr 3373506（chunk-sfn1dbxq.js）；src/web-search.ts:155',
    '保留名/冲突命名排除（账号同步域）；URL丢弃已实现（陈旧行文）；shell AST维持不移植',
    '文档包无代码变更；沿用W123闸门；身份4149770c…不变'],
  ['2026-10-17T15:42:00Z', 'verification', 'W124-01 验收：CURRENT×3、FEATURES Skills行、dispositions第7项、STATUS与标准条目',
    '无源文件改动；不需要重跑tsc/全量；W123最后一次全量2,194/2,194',
    'identity 4149770c…；索引未变'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w124-runtime.tsv', tsv + '\n');

write('.audit/w124-runtime.todo.md', `# W124 runtime trail

## W124-01 acceptance (2026-10-17)

- [x] **Reserved names.** \`uRe=["anthropic-skills"]\`, the refusal and the
  collision naming all serve claude.ai account sync; excluded with it.
- [x] **Referenced URL.** Already shipped at \`src/web-search.ts:155\`; the
  C-10 row text was stale.
- [x] **Shell AST.** Existing not-ported disposition (item 3).
- [x] **Records.** Disposition item 7, C-10 rows, Features row, STATUS and
  coding-standard entry.
- [x] **Gates.** No code change; W123's measured gates stand and the identity
  is unchanged.
`);

const evidence = {
  schema: 'W124C10DispositionsEvidence.v1',
  package: 'W124-01 — C-10 residual dispositions',
  date: '2026-10-17',
  question: 'What remains open in C-10 after conditional skills and dynamic directory discovery?',
  answer: 'Nothing that can be ported locally. Reserved names and collision naming only protect the anthropic-skills namespace created by claude.ai account sync, which this product excludes. The citation-drops-when-redaction-changes-its-URL rule is already implemented in web search. The recovered shell AST keeps its prior not-ported decision.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    modules: {
      'extracted-v2/modules/chunk-mven2c2x.js': [619],
      'extracted-v2/modules/chunk-xrjhyksm.js': [2913, 3550, 3588, 3817, 3950],
      'extracted-v2/modules/chunk-sfn1dbxq.js': [3372867, 3373292, 3373506, 4697],
    },
    implementation: { 'src/web-search.ts': { line: 155 } },
  },
  behavior: {
    reservedNames: ['anthropic-skills'],
    reservedNamespaceBasis: 'claude.ai account sync',
    accountSyncShipped: false,
    localSkillWithReservedNameLoads: true,
    urlInvalidationAlreadyShipped: true,
    shellAstPorted: false,
  },
  changes: [
    { file: 'research/ports/remaining-dispositions.md', change: 'item 7 reserved names', sha256: sha(read('research/ports/remaining-dispositions.md')) },
    { file: 'research/CURRENT.md', change: 'three C-10 rows closed', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Skills row close-out', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W124-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W124-01 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    codeChange: 'none (documentation only)',
    lastMeasured: 'W123: focused 137/137, three-suite 164/164, tsc 0, build 0, full 2,194/2,194, chain 768/768',
    identity: '4149770c592b2f237117295d04a5829e3f61f956e227bd3d59528dd06568aa3a',
  },
  residuals: [],
  recoveredEntrypointsExecuted: false,
  next: 'C-10 is closed; continue with the next ready C-area cluster from CURRENT.',
};
write('research/ports/W124-c10-dispositions-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW124-01 closes the C-10 residual list',
  'research/coding-standard.md': '\n2026-10-17 W124-01 ',
  'research/FEATURES.md': 'C-10 is closed:',
  'research/ports/remaining-dispositions.md': '\n## 7. Reserved skill names',
  'research/ports/W124-c10-dispositions.md': '# W124 — Closing the C-10 residual list',
  '.audit/w124-runtime.todo.md': '\n## W124-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
