// W80-01 record: recovered model-switch hook payload fields.
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

const note = `# W80 — model-switch hook payloads

## Source position

\`oXr\` (chunk-sfn1dbxq.js, UTF-16 [2937531,2939081)) builds the PreModelSwitch
input as:

\`\`\`
{...$d(e,se()), hook_event_name:"PreModelSwitch",
 from_model:n.fromModel, to_model:n.toModel, requested_model:n.requestedModel,
 source:n.source, ...zWe(n.toModel)}
\`\`\`

\`sXr\` [2939454,2940852) builds the PostModelSwitch input with the same fields
and the same \`...zWe(toModel)\` spread. Both run the matcher against
\`g4e(to_model)\` only when \`zIt\` accepts the normalized alias.

The product previously sent \`{model, previous_model}\` for PreModelSwitch and
\`{model, permission_mode, thinking}\` for PostModelSwitch.

## Port

- PreModelSwitch sends \`{from_model: config.model, to_model: model,
  requested_model: model}\` before the configuration changes.
- PostModelSwitch sends \`{from_model: previousModel, to_model: config.model,
  requested_model: config.model}\`; \`previousModel\` is captured at the start
  of \`applyConfig\`, before the branch and session replacement.
- ConfigChange keeps its product payload on the non-model branch.
- \`hookMatcherValue\` for Pre/PostModelSwitch now reads \`to_model\` only.

## Adaptation

The model-alias normalization used by the recovered selector (\`g4e\`/zIt,
chunk-bk5ct2gw.js offsets 383071 and 383141) has no product counterpart, so the
selector uses the raw \`to_model\` text. \`source\` and the \`zWe\` model-flag
spread stay absent because the product's model command has no recovered source
value or flag set to report.

## Verification

\`interactive\` 7/7 captures real PreModelSwitch and PostModelSwitch hook stdin
around \`/model second-model\`: \`from_model\` is the prior model,
\`to_model\`/\`requested_model\` the new one. \`hooks\` 48/48 asserts the selector
takes \`to_model\` and ignores the old \`model\` field. tsc 0; build 0; full
2,107/2,107; chain 767/767; notices 0; source index unchanged; identity
\`560f098a…\`.
`;
write('research/ports/W80-model-switch-payloads.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W80-01 ports the recovered model-switch hook payloads. PreModelSwitch sends
\`from_model\`, \`to_model\` and \`requested_model\` before the change;
PostModelSwitch sends the same three fields after it, with the prior model
captured before \`applyConfig\` replaces the session. The selector reads
\`to_model\` only; model-alias normalization and the \`source\`/flag fields stay
unported. \`interactive\` 7/7 with both payloads captured from real hooks,
\`hooks\` 48/48, tsc 0, full 2,107/2,107, chain 767/767, identity \`560f098a…\`.
[W80 record](ports/W80-model-switch-payloads.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W80-01 模型切换载荷：S-1（先读源）：读取 chunk-sfn1dbxq.js 的 oXr [2937531,2939081)、sXr [2939454,2940852)（UTF-16），选择器归一化 g4e/zIt 位于 chunk-bk5ct2gw.js 偏移 383071/383141。S-2（不臆造）：Pre/Post 均带 from_model、to_model、requested_model；Post 的 from_model 在 applyConfig 入口捕获。S-3（边界）：选择器只取 to_model；源 source 与 zWe 标志展开、模型别名归一化保持未移植。S-4（可测）：interactive 用例用真实命令钩子捕获两条载荷；hooks 用例断言 to_model 选择且旧 model 字段不再参与。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：interactive 7/7、hooks 48/48、tsc 0、build 0、全量 2,107/2,107、链 767/767、身份 560f098a…。
`);

replaceOnce('research/FEATURES.md',
  'and Elicitation carries `mcp_server_name` |',
  'and Elicitation carries `mcp_server_name`; W80 aligns the model-switch payloads (PreModelSwitch and PostModelSwitch carry `from_model`, `to_model` and `requested_model`, with the prior model captured before the configuration branch), while model-alias normalization and the recovered `source`/flag fields remain gaps |');

replaceAll('research/CURRENT.md',
  '完整消费者与脚本语义仍待处理',
  'W80完成模型切换载荷（Pre/Post均带from_model/to_model/requested_model；选择器只取to_model）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-17T21:40:00Z', 'package', 'W80-01 模型切换载荷',
    'oXr [2937531,2939081)、sXr [2939454,2940852)；Pre/Post from_model/to_model/requested_model；选择器只取 to_model',
    'applyConfig 入口捕获 prior model；非模型分支保留 ConfigChange 载荷',
    'interactive 7/7；hooks 48/48；tsc 0；build 0；全量 2,107/2,107；链 767/767'],
  ['2026-10-17T21:42:00Z', 'decision', 'W80-01 未移植项',
    '① 模型别名归一化 g4e/zIt 无产品对应，选择器用原始 to_model；② 源 source 字段与 zWe 标志展开未提供；③ ConfigChange 载荷保持产品形态',
    '残余：完整消费者、脚本语义、per-file watcher 与指令加载',
    '.audit/w80-01-full.txt'],
  ['2026-10-17T21:45:00Z', 'verification', 'W80-01 验收：interactive 7/7、hooks 48/48、tsc 0、build 0、2,107/2,107、767/767',
    '真实钩子捕获 Pre/Post 载荷；from_model 为切换前模型；to_model/requested_model 为新模型',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 560f098a…（inputs cbc2dcbb…、validation fcfba5b7…、build 98bfd7dd…）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w80-runtime.tsv', tsv + '\n');

write('.audit/w80-runtime.todo.md', `# W80 runtime trail

## W80-01 acceptance (2026-10-17)

- [x] **Source read.** \`oXr\` and \`sXr\` payload builders and their selector
  normalization measured in UTF-16 code units.
- [x] **Port.** Pre/Post payloads carry \`from_model\`, \`to_model\` and
  \`requested_model\`; the selector reads \`to_model\`.
- [x] **Adaptation.** Model-alias normalization, \`source\` and the model-flag
  spread stay residual.
- [x] **Gates.** interactive 7/7, hooks 48/48, tsc 0, build 0, full 2,107/2,107,
  chain 767/767, notices 0, source index unchanged, identity \`560f098a…\`.
- [ ] Remaining C-6: full consumers and script semantics, per-file watcher raise
  and per-file instruction loading.
`);

const evidence = {
  schema: 'W80ModelSwitchPayloadsEvidence.v1',
  package: 'W80-01 — model-switch hook payloads',
  date: '2026-10-17',
  question: 'Do PreModelSwitch and PostModelSwitch carry the recovered from_model/to_model/requested_model fields and select matchers by to_model?',
  answer: 'Yes: both raise sites send the three recovered fields, the prior model is captured before the configuration branch, and the selector reads to_model; alias normalization and the source/flag fields remain unported.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-sfn1dbxq.js',
    unit: 'UTF-16 code units',
    preModelSwitch: { symbol: 'oXr', range: [2937531, 2939081] },
    postModelSwitch: { symbol: 'sXr', range: [2939454, 2940852] },
    selectorNormalization: { module: 'extracted-v2/modules/chunk-bk5ct2gw.js', offsets: [383071, 383141], symbols: ['g4e', 'zIt'] },
  },
  behavior: {
    pre: 'from_model, to_model and requested_model before the configuration changes',
    post: 'the same fields after the branch, with from_model captured before applyConfig',
    selector: 'to_model only',
    notPorted: ['model alias normalization', 'source field', 'zWe model-flag spread'],
  },
  changes: [
    { file: 'src/interactive.ts', change: 'Pre/Post payloads and previousModel capture', sha256: sha(read('src/interactive.ts')) },
    { file: 'src/hooks.ts', change: 'model-switch selector reads to_model only', sha256: sha(read('src/hooks.ts')) },
    { file: 'test/interactive.test.ts', change: 'captured model-switch payload assertions', sha256: sha(read('test/interactive.test.ts')) },
    { file: 'test/hooks.test.ts', change: 'to_model selector assertions', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record model-switch payloads', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records model-switch payloads', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W80-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W80-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    interactive: '7/7',
    hooks: '48/48',
    build: 'exit 0',
    full: '2,107/2,107',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '560f098a0027484157f437d47d9828065a9566b3788038bf3a5c0b10c57fb03f',
  },
  residuals: [
    'Model-alias normalization for the selector remains unported.',
    'The recovered source field and model-flag spread are absent.',
    'FileChanged per-file watcher raise and per-file instruction loading remain C-6 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with the full hook consumers, script semantics and per-file watcher/instruction raises.',
};
write('research/ports/W80-model-switch-payloads-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW80-01 ports the recovered model-switch hook payloads',
  'research/coding-standard.md': '\n2026-10-17 W80-01 ',
  'research/FEATURES.md': 'W80 aligns the model-switch payloads',
  'research/ports/W80-model-switch-payloads.md': '# W80 — model-switch hook payloads',
  '.audit/w80-runtime.todo.md': '\n## W80-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
