// W129-01 record: startup header.
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

const currentSection = `## W129 启动头部（2026-10-17）

[W129](ports/W129-tui-welcome.md)按原文搬运 \`Hee\` 的启动头部：宽度58、少于30行折叠为单行、主题分支（light/light-daltonized/light-ansi 用浅色艺术，其余用深色艺术）、16行正文与 claude/clawd_body/clawd_background 颜色；产品名中性化为 "Welcome to LiTcode"，版本取自包；头部仅在 transcript 为空时显示，首条消息提交后消失。Apple_Terminal 专用 \`V\` 变体未移植。tsc 0、build 0、聚焦75/75、120x40 与 80x24 PTY 及首条消息清除验证通过，身份 \`da976d47…\`。

`;
{
  const text = read('research/CURRENT.md');
  const marker = '## 待完成清单';
  const at = text.indexOf(marker);
  if (at < 0) throw new Error('CURRENT: missing 待完成清单');
  write('research/CURRENT.md', text.slice(0, at) + currentSection + text.slice(at));
}

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W129-01 ports the recovered startup header. The first interactive frame now paints the source's
16-row ASCII header above the prompt, with the 58-cell art width, the light/dark theme branches,
the product's neutral name, and the package version from \`cliVersion()\`. Below 30 terminal rows
the header collapses to the source's single line. It is shown only while the transcript is empty,
so the first committed message removes it. The Apple_Terminal-only \`V\` variant remains out.
tsc 0, build 0, focused 75/75, notices 0, source index unchanged, identity \`da976d47…\`.
[W129 record](ports/W129-tui-welcome.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W129-01 启动头部：S-1（先读源）：Hee chunk-9c78dh5n.js [960,15899)，V 同模块后续；常量 A=58、z=30。S-2（不臆造）：紧凑分支条件（屏幕阅读器标志或 rows<30）、主题分支顺序（Apple_Terminal→light列表→默认深色）、16行顺序与内联Text、dimColor/bold/color/backgroundColor、紧凑行版本后缀无尾空格、艺术行版本后缀有尾空格。S-3（边界）：产品名中性化，版本取自包；V未移植，Apple Terminal走通用艺术；屏幕阅读器上下文在本运行时恒false；头部仅transcript为空时显示，非transcript条目。S-4（可测）：新增test/tui-welcome.test.ts（深色16行、浅色无星、紧凑单行）；120x40/80x24 PTY与提交后清除实测。S-5：无依赖变化。S-6：TuiOptions新增version，CLI传入cliVersion()；TuiTerminal新增welcomeRenderer缓存并在close释放。S-7：端口记录与证据JSON。验证：聚焦75/75、tsc 0、build 0、notices 0、索引不变、身份da976d47…。
`);

replaceOnce('research/FEATURES.md',
  'W46-03 makes it the ScopedPicker frame in both terminal hosts, with the frame owning focus and window, a captured search-field handler driving the source movement, and onFocus keeping the picker cursor in step. |',
  'W46-03 makes it the ScopedPicker frame in both terminal hosts, with the frame owning focus and window, a captured search-field handler driving the source movement, and onFocus keeping the picker cursor in step. W129 ports the recovered startup header (`Hee`): the 58-cell light/dark ASCII art and its 16 rows render above the prompt while the transcript is empty, collapse to the source single line below 30 terminal rows, use the neutral product name and the package version, and disappear after the first committed message; the Apple_Terminal-only `V` variant remains out, ports/W129-tui-welcome.md. |');

const tsv = [
  ['2026-10-17T23:20:00Z', 'package', 'W129-01 启动头部',
    'Hee chunk-9c78dh5n.js [960,15899)；A=58、z=30；light/dark分支与16行艺术',
    '紧凑条件、主题分支、内联Text与颜色、版本来源',
    'tsc 0；build 0；聚焦75/75；120x40与80x24 PTY；首条消息清除'],
  ['2026-10-17T23:25:00Z', 'decision', 'W129-01 适配',
    '产品名中性化；V未移植；屏幕阅读器恒false；仅transcript为空显示',
    '版本由cliVersion传入；渲染缓存按列数/紧凑/版本/主题',
    '无依赖变化'],
  ['2026-10-17T23:30:00Z', 'verification', 'W129-01 验收：聚焦75/75、notices 0、索引不变',
    'identity da976d47…；构建后dist含welcome',
    '.audit/w129-01-focused.txt、.audit/w129-01-build.txt、.audit/w129-01-identity.txt'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w129-runtime.tsv', tsv + '\n');

write('.audit/w129-runtime.todo.md', `# W129 runtime trail

## W129-01 acceptance (2026-10-17)

- [x] **Source read.** \`Hee\` compact branch, theme order, 58-cell rows, version placement.
- [x] **Port.** \`src/tui-welcome.ts\` with exact light/dark rows and compact line.
- [x] **Wiring.** Empty-transcript header in \`TuiTerminal.render()\`, cached renderer, released
  on close; \`version\` passed from \`cliVersion()\`.
- [x] **Unit tests.** Dark 16 rows, light starless art, compact single line.
- [x] **Live PTY.** 120x40 full art, 80x24 compact line, header gone after one message.
- [x] **Gates.** Focused 75/75, tsc 0, build 0, notices 0, index unchanged.
- [ ] Apple_Terminal \`V\` variant remains out (documented adaptation).
- [ ] Header text is fixed to the product name; no configurable welcome message.
`);

const evidence = {
  schema: 'W129TuiWelcomeEvidence.v1',
  package: 'W129-01 — Startup header',
  date: '2026-10-17',
  question: 'What does the recovered startup header render, and how is it wired into the product TUI?',
  answer: 'The recovered Hee component renders a 16-row ASCII header (light or dark) at width 58, or a single welcome line when rows < 30. It shows the product name and version, then disappears once the transcript has content. The port reproduces both branches and the compact rule, uses this product\'s neutral name and package version, and leaves the Apple_Terminal-only V variant out.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    modules: {
      'extracted-v2/modules/chunk-9c78dh5n.js': [960, 15899],
    },
    implementation: {
      'src/tui-welcome.ts': { ranges: 'whole file' },
      'src/tui.ts': { ranges: 'TuiOptions.version, renderWelcome, render frame, close' },
      'src/cli.ts': { ranges: 'createTuiTerminal version option' },
    },
  },
  behavior: {
    artWidth: 58,
    minimumRowsForArt: 30,
    artRows: 16,
    compactWhenRowsBelow30: true,
    lightThemes: ['light', 'light-daltonized', 'light-ansi'],
    appleTerminalVariantPorted: false,
    headerShownWhileTranscriptEmpty: true,
    versionSource: 'cliVersion()',
  },
  adaptations: [
    'The recovered product name is replaced with the neutral product name.',
    'The build-literal version is replaced with the package version passed by the caller.',
    'The Apple_Terminal-only V variant is not ported; Apple Terminal uses the generic art.',
    'The screen-reader presentation context is absent and treated as false.',
    'The header is UI state while the transcript is empty, not a transcript entry.',
  ],
  changes: [
    { file: 'src/tui-welcome.ts', change: 'ported compact branch and light/dark art', sha256: sha(read('src/tui-welcome.ts')) },
    { file: 'src/tui.ts', change: 'version option, welcome render and cache, frame substitution, close', sha256: sha(read('src/tui.ts')) },
    { file: 'src/cli.ts', change: 'pass cliVersion()', sha256: sha(read('src/cli.ts')) },
    { file: 'test/tui-welcome.test.ts', change: 'dark/light/compact tests', sha256: sha(read('test/tui-welcome.test.ts')) },
    { file: 'research/CURRENT.md', change: 'W129 section', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'terminal row records W129', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W129-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W129-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '75/75 (tui-welcome, tui, terminal)',
    build: 'exit 0',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 1743/30144 statements, 323525 units (unchanged)',
    identity: 'da976d47aef7422b704df1ae41334f5acb977d48093879e1321854f8f10b522c',
    livePty: '120x40 full dark art; 80x24 compact line; header cleared after one message',
    fullSuite: 'not rerun; focused set covers the rendered TUI and terminal lifecycle',
  },
  residuals: [
    'The Apple_Terminal V variant remains out.',
    'The header message is fixed; no configuration surface.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'The user asked for a runnable end-to-end TUI before remaining C-area work; the header now completes the first frame.',
};
write('research/ports/W129-tui-welcome-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW129-01 ports the recovered startup header',
  'research/coding-standard.md': '\n2026-10-17 W129-01 ',
  'research/FEATURES.md': 'W129 ports the recovered startup header',
  'research/CURRENT.md': '## W129 启动头部（2026-10-17）',
  'research/ports/W129-tui-welcome.md': '# W129 — Startup header',
  '.audit/w129-runtime.todo.md': '\n## W129-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const found = read(path).split(mark).length - 1;
  if (found !== 1) throw new Error(`${path} holds ${found} entries for ${JSON.stringify(mark)}, expected 1`);
}
console.log('record ok');
