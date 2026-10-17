// W69-01 record: the recovered HTML preview fragment gate is ported.
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

const note = `# W69 — the HTML preview fragment gate

## Source position

The recovered validator is \`Ae\` in \`chunk-ktr9sak2.js\` (UTF-16 code units
[19624,20102), 478 units). Its AskUserQuestion \`validateInput\` caller is [16528,16776), 248 units:

\`\`\`js
async validateInput({questions:e}){if(uPr()!=="html")return{result:!0};
  for(let t of e)for(let n of t.options){let r=Ae(n.preview);
    if(r)return{result:!1,message:\`Option "\${n.label}" in question "\${t.question}": \${r}\`,errorCode:1}}
  return{result:!0}}
\`\`\`

The gate \`uPr\` (\`chunk-4bw62nzm.js\` [98437,98515), 78 units) reads the host launch option
\`questionPreviewFormat()\`; its setter is \`pPr\`. \`Ae\` checks, in this order:

1. \`undefined\` preview — no error.
2. \`/<\\s*(html|body|!doctype)\\b/i\` — \`preview must be an HTML fragment, not a full document
   (no <html>, <body>, or <!DOCTYPE>)\`.
3. \`/<\\s*(script|style)\\b/i\` — \`preview must not contain <script> or <style> tags. Use inline
   styles via the style attribute if needed.\`
4. no \`/<[a-z][^>]*>/i\` — \`preview must contain HTML (previewFormat is set to "html"). Wrap
   content in a tag like <div> or <pre>.\`

## Port

\`src/interaction-tools.ts\` adds \`previewFragmentError\`, a direct port of \`Ae\` whose three
messages are copied verbatim, and \`InteractionToolOptions.previewFormat?: 'html'\`. When the host
declares HTML previews, \`ask_user_question\` walks every question option before dispatch and throws
the source's message shape with the product's tool-name prefix:

\`ask_user_question: Option "<label>" in question "<question>": <message>\`

The host launch option is represented by the product's explicit \`previewFormat\` factory option
instead of reading a live client setting, which is the recorded local adaptation: this harness has
no launch-options store, and the option makes the gate testable without a host. Omission keeps
previews opaque (length-checked only), matching the source's non-\`"html"\` path.

## Deliberate omissions

- The client setting storage and its setter (\`pPr\`), the launch-option plumbing and the
  tool-input error envelope (\`result\`/\`errorCode\`) are not ported; the product throws its usual
  tool error, and every other tool reports errors the same way.
- Annotation admission (\`V\`), extended question kinds and notes are separate C-11 work.

## Verification

\`interaction-tools\` 23/23 including two new cases (the three messages and their order; the gate
rejecting before any host call and accepting a fragment, with the opaque path unchanged). tsc 0;
build 0; full 2,094/2,094; chain 767/767; notices 0; source index unchanged (75 chunks, 323,525
units); identity \`dc4f6cce…\`.
`;
write('research/ports/W69-preview-gating.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W69-01 ports the recovered HTML preview fragment gate. \`Ae\` (chunk-ktr9sak2.js UTF-16
[19624,20102)) rejects a full document, script/style tags and markup-free text with three exact
messages, gated by the host's \`questionPreviewFormat\` (\`uPr\`, chunk-4bw62nzm.js [98437,98515)).
The product exposes the same gate as \`previewFormat: "html"\` on the interaction tools and applies
it to every option preview before dispatch; the host launch-option store is replaced by that
explicit option, recorded as the local adaptation. Two new cases, interaction-tools 23/23, tsc 0,
full 2,094/2,094, chain 767/767, identity \`dc4f6cce…\`. [W69 record](ports/W69-preview-gating.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W69-01 HTML 预览片段门控：S-1（先读源）：逐字读取 chunk-ktr9sak2.js 的 Ae [19624,20102)、其 validateInput [16528,16776) 与 chunk-4bw62nzm.js 的 uPr [98437,98515)（UTF-16 单元），确认三条消息、检查顺序与 "html" 门控。S-2（不臆造）：previewFragmentError 直接移植 Ae，三条消息原样；未声明 html 时保持不透明文本，仅长度校验。S-3（边界）：宿主 launchOptions 存储与 pPr setter 不移植，以 previewFormat 工厂选项承载并在记录中说明；错误按本运行时统一抛错并保留源消息形状。S-4（可测）：两条新用例覆盖消息/顺序、分发前拒绝、合法片段放行与不透明路径。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：interaction-tools 23/23、tsc 0、build 0、全量 2,094/2,094、链 767/767、身份 dc4f6cce…。
`);

replaceOnce('research/FEATURES.md',
  'Source multi-question review, previews and richer approval contracts differ; ports/W39-tui-dialogs.md',
  'W69 ports the recovered HTML preview fragment gate (Ae, gated on the host declaring HTML previews): every option preview must carry markup, must not be a full document and must not contain script/style, with the source messages; multi-question review and richer approval contracts differ; ports/W39-tui-dialogs.md');

const rowOld = '| C-11 | 计划与问答交互 | W39已接入模态问答/计划/权限与取消恢复，W42完成多题按序推进与回看页（含未答警示、左右切题、提交/取消），W43完成模型schema→回调→聚焦预览→回看→答案结果及行模式链，原样搬运JavaScript布局核心、Markdown词法器与格式化正文，86文件离线安装宽屏/窄屏/行模式验收通过；完整渲染器、格式化宿主、notes/annotations和preview门控仍有差异，按S-7先核验来源再继续 | Question/plan/findings interactions；[W39](ports/W39-tui-dialogs.md)、[W42](ports/W42-tui-groups.md)、[W43](ports/W43-tui-preview.md) |';
const rowNew = '| C-11 | 计划与问答交互 | W39已接入模态问答/计划/权限与取消恢复，W42完成多题按序推进与回看页（含未答警示、左右切题、提交/取消），W43完成模型schema→回调→聚焦预览→回看→答案结果及行模式链，原样搬运JavaScript布局核心、Markdown词法器与格式化正文，86文件离线安装宽屏/窄屏/行模式验收通过；W69完成preview门控本地移植（Ae片段规则：需含标记、禁整文档、禁script/style，宿主声明html时逐选项在分发前校验，三条消息原样；宿主launchOptions由previewFormat选项承载）；完整渲染器、格式化宿主和notes/annotations仍有差异，按S-7先核验来源再继续 | Question/plan/findings interactions；[W39](ports/W39-tui-dialogs.md)、[W42](ports/W42-tui-groups.md)、[W43](ports/W43-tui-preview.md) |';
const current = read('research/CURRENT.md');
if (current.split(rowOld).length - 1 !== 3) throw new Error('CURRENT C-11 row count changed');
write('research/CURRENT.md', current.split(rowOld).join(rowNew));

const tsv = [
  ['2026-10-17T13:40:00Z', 'package', 'W69-01 HTML 预览片段门控',
    'Ae [19624,20102) 三条消息与 validateInput [16528,16776) 门控；uPr [98437,98515) 读宿主 questionPreviewFormat；产品以 previewFormat:"html" 承载',
    '分发前逐选项校验；未声明 html 保持不透明；宿主设置存储未移植（记录适配）',
    'interaction-tools 23/23；tsc 0；build 0；全量 2,094/2,094；链 767/767'],
  ['2026-10-17T13:42:00Z', 'decision', 'W69-01 用显式 previewFormat 选项承载宿主声明',
    '① 本 harness 无 launchOptions 存储与 pPr setter；② 显式选项让门控可离线测试；③ 错误保留源消息形状但按产品统一抛错；④ 不声明 html 时不改变现有预览行为',
    '残余：完整渲染器、格式化宿主、notes/annotations、扩展问题类型',
    '.audit/w69-01-full.txt'],
  ['2026-10-17T13:44:00Z', 'verification', 'W69-01 验收：interaction-tools 23/23、tsc 0、build 0、2,094/2,094、767/767',
    '整文档/script/style/无标记三类拒绝；合法片段放行且宿主仅调用一次；不透明路径保持原行为',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity dc4f6cce…（inputs f6c114b5…、build 053dd2b2…）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w69-runtime.tsv', tsv + '\n');

write('.audit/w69-runtime.todo.md', `# W69 runtime trail

## W69-01 acceptance (2026-10-17)

- [x] **Source read.** \`Ae\` [19624,20102), its \`validateInput\` [16528,16776) and the \`uPr\`
  gate [98437,98515) measured in UTF-16 code units; the three messages copied verbatim.
- [x] **Gate ported.** \`previewFormat: "html"\` checks every option preview before dispatch; a
  missing option keeps previews opaque.
- [x] **Host setting adapted.** The launch-options store and \`pPr\` setter are replaced by the
  explicit factory option; the reason is recorded.
- [x] **Gates.** interaction-tools 23/23, tsc 0, build 0, full 2,094/2,094, chain 767/767,
  notices 0, source index unchanged, identity \`dc4f6cce…\`.
- [ ] Remaining C-11: full renderer, formatting host, notes/annotations, extended kinds.
`);

const evidence = {
  schema: 'W69PreviewGatingEvidence.v1',
  package: 'W69-01 — recovered HTML preview fragment gate',
  date: '2026-10-17',
  question: 'Does the product apply the recovered AskUserQuestion preview fragment rules with the source messages when the host declares HTML previews?',
  answer: 'Yes: previewFragmentError is a direct port of Ae with the three source messages in source order, gated by the product previewFormat option standing in for the host launch option; previews stay opaque otherwise.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-ktr9sak2.js',
    unit: 'UTF-16 code units',
    validator: { symbol: 'Ae', range: [19624, 20102], units: 478 },
    caller: { symbol: 'validateInput', range: [16528, 16776], units: 248 },
    gate: { symbol: 'uPr', module: 'extracted-v2/modules/chunk-4bw62nzm.js', range: [98437, 98515], units: 78, reads: 'host.launchOptions.questionPreviewFormat()', setter: 'pPr' },
  },
  sourceMessages: [
    'preview must be an HTML fragment, not a full document (no <html>, <body>, or <!DOCTYPE>)',
    'preview must not contain <script> or <style> tags. Use inline styles via the style attribute if needed.',
    'preview must contain HTML (previewFormat is set to "html"). Wrap content in a tag like <div> or <pre>.',
  ],
  port: {
    function: 'previewFragmentError',
    option: 'InteractionToolOptions.previewFormat',
    order: 'full document, then script/style, then missing markup',
    dispatch: 'checked for every question option before the host ask callback',
    errorShape: 'ask_user_question: Option "<label>" in question "<question>": <source message>',
    opaquePath: 'no previewFormat option means previews are text and only length-checked',
  },
  changes: [
    { file: 'src/interaction-tools.ts', change: 'previewFormat option, previewFragmentError, dispatch gate', sha256: sha(read('src/interaction-tools.ts')) },
    { file: 'test/interaction-tools.test.ts', change: 'two preview gate cases', sha256: sha(read('test/interaction-tools.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-11 rows record the preview gate', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Question/plan/findings row records the gate', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W69-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W69-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    interactionTools: '23/23',
    build: 'exit 0',
    full: '2,094/2,094',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'dc4f6cce982240c956b999be9ba905be6eae6e79a2a364ecb048258935a540bb',
  },
  residuals: [
    'The host launch-options store and the pPr setter are not ported; the explicit previewFormat option carries the declaration.',
    'The source tool-input error envelope (result/errorCode) is not ported; the product throws its usual tool error.',
    'Annotation admission, extended question kinds and notes remain C-11 work.',
    'The full renderer and formatting host remain C-11 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-11 continues with the full renderer, formatting host and notes/annotations.',
};
write('research/ports/W69-preview-gating-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW69-01 ports the recovered HTML preview fragment gate',
  'research/coding-standard.md': '\n2026-10-17 W69-01 ',
  'research/FEATURES.md': 'W69 ports the recovered HTML preview fragment gate',
  'research/ports/W69-preview-gating.md': '# W69 — the HTML preview fragment gate',
  '.audit/w69-runtime.todo.md': '\n## W69-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
