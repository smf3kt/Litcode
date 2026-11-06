// W130-01 record: Apple Terminal welcome art.
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

const currentSection = `## W130 Apple Terminal 启动头部（2026-10-17）

[W130](ports/W130-welcome-apple-terminal.md)补齐 \`Hee\` 的 Apple_Terminal 变体 \`V\`：浅色/深色均复用通用艺术前12行，第13行起改用 \`▗\`/\`▖\`、clawd_body 背景与九格腹带；\`TERM_PROGRAM=Apple_Terminal\` 选择该分支，其余终端保持通用艺术。新增双主题测试；聚焦76/76、tsc 0、build 0、notices 0、索引不变，身份 \`21ac3022…\`；120x40 PTY 实测分支切换。

`;
{
  const text = read('research/CURRENT.md');
  const marker = '## 待完成清单';
  const at = text.indexOf(marker);
  if (at < 0) throw new Error('CURRENT: missing 待完成清单');
  write('research/CURRENT.md', text.slice(0, at) + currentSection + text.slice(at));
}

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W130-01 ports the Apple Terminal welcome variant \`V\`. When \`TERM_PROGRAM\` is
\`Apple_Terminal\`, the startup header now uses the source's quarter-block body in both themes;
the first 12 rows stay the generic art, and every other terminal keeps W129's rendering. The
variant is selected through \`TuiOptions.termProgram\`, cached with the header, and covered by a
two-theme test. Focused TUI/terminal tests 76/76, tsc 0, build 0, notices 0, source index
unchanged, identity \`21ac3022…\`. [W130 record](ports/W130-welcome-apple-terminal.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W130-01 Apple Terminal头部：S-1（先读源）：V chunk-9c78dh5n.js [960,15899)内Hee之后；浅色/深色分支与16行顺序。S-2（不臆造）：前12行复用通用艺术、第13行起为V专属四行、▗/▖、clawd_background文字色与clawd_body背景、九格腹带、深色粗体星。S-3（边界）：分支条件为TERM_PROGRAM==="Apple_Terminal"（与恢复源终端检测一致），其余终端保持通用艺术；紧凑分支优先于该变体。S-4（可测）：tui-welcome新增双主题V测试（16行、含▗、不含通用身体）。S-5：无依赖变化。S-6：TuiOptions新增termProgram，CLI传入TERM_PROGRAM，缓存键纳入该值。S-7：端口记录与证据JSON。验证：聚焦76/76、tsc 0、build 0、notices 0、索引不变、身份21ac3022…、120x40 PTY分支实测。
`);

replaceOnce('research/FEATURES.md',
  'and disappear after the first committed message; the Apple_Terminal-only `V` variant remains out, ports/W129-tui-welcome.md. |',
  'and disappear after the first committed message; W130 adds the Apple_Terminal `V` variant selected by `TERM_PROGRAM`, with the source quarter-block body in both themes, ports/W129-tui-welcome.md, ports/W130-welcome-apple-terminal.md. |');

const tsv = [
  ['2026-10-17T23:55:00Z', 'package', 'W130-01 Apple Terminal启动头部',
    'V chunk-9c78dh5n.js [960,15899)；前12行复用、第13-16行V专属',
    '▗/▖、clawd_body背景、九格腹带、深色星',
    'tsc 0；build 0；聚焦76/76；120x40 TERM_PROGRAM=Apple_Terminal PTY'],
  ['2026-10-17T23:58:00Z', 'decision', 'W130-01 适配',
    'TERM_PROGRAM直接等值判断；紧凑分支优先；缓存键纳入termProgram',
    '其余终端保持通用艺术',
    '无依赖变化'],
  ['2026-10-17T23:59:00Z', 'verification', 'W130-01 验收：聚焦76/76、notices 0、索引不变',
    'identity 21ac3022…；dist重建',
    '.audit/w130-01-focused.txt、.audit/w130-01-build.txt、.audit/w130-01-identity.txt'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w130-runtime.tsv', tsv + '\n');

write('.audit/w130-runtime.todo.md', `# W130 runtime trail

## W130-01 acceptance (2026-10-17)

- [x] **Source read.** \`V\` light/dark bodies, 12 shared rows plus four variant rows.
- [x] **Port.** \`appleArt\` in \`src/tui-welcome.ts\` with exact quarter-block rows.
- [x] **Wiring.** \`termProgram\` option, equality branch, cache key, CLI environment pass-through.
- [x] **Tests.** Two themes, 16 rows, quarter-block body, no generic body.
- [x] **Live PTY.** 120x40 with \`TERM_PROGRAM=Apple_Terminal\` shows \`V\`; without it the generic art stays.
- [x] **Gates.** Focused 76/76, tsc 0, build 0, notices 0, index unchanged.
- [ ] Other terminals' art differences remain uninvestigated.
`);

const evidence = {
  schema: 'W130AppleTerminalWelcomeEvidence.v1',
  package: 'W130-01 — Apple Terminal welcome art',
  date: '2026-10-17',
  question: 'How does the recovered startup header render on Apple Terminal, and how is that variant selected?',
  answer: 'The recovered V component keeps the generic art for the first 12 rows and replaces the body with quarter-block rows; light and dark themes differ only in the body styling. The product selects it when TERM_PROGRAM is Apple_Terminal, ports the rows exactly, and keeps the generic art for every other terminal.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    modules: {
      'extracted-v2/modules/chunk-9c78dh5n.js': [960, 15899],
    },
    implementation: {
      'src/tui-welcome.ts': { ranges: 'appleArt, appleLightArt, appleDarkArt' },
      'src/tui.ts': { ranges: 'termProgram option and selection' },
      'src/cli.ts': { ranges: 'TERM_PROGRAM pass-through' },
    },
  },
  behavior: {
    selectedWhen: 'TERM_PROGRAM === "Apple_Terminal"',
    sharedRows: 12,
    variantRows: 4,
    lightThemeBody: 'quarter blocks with clawd_body background',
    darkThemeBody: 'quarter blocks plus bold star',
    compactBranchPrecedesVariant: true,
  },
  adaptations: [
    'The variant is selected from process.env.TERM_PROGRAM, matching the recovered detector for this branch.',
    'The welcome message stays the neutral product name.',
  ],
  changes: [
    { file: 'src/tui-welcome.ts', change: 'V light/dark art', sha256: sha(read('src/tui-welcome.ts')) },
    { file: 'src/tui.ts', change: 'termProgram option and cache key', sha256: sha(read('src/tui.ts')) },
    { file: 'src/cli.ts', change: 'TERM_PROGRAM pass-through', sha256: sha(read('src/cli.ts')) },
    { file: 'test/tui-welcome.test.ts', change: 'Apple Terminal test', sha256: sha(read('test/tui-welcome.test.ts')) },
    { file: 'research/CURRENT.md', change: 'W130 section', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'terminal row records W130', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W130-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W130-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '76/76 (tui-welcome, tui, terminal)',
    build: 'exit 0',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 1743/30144 statements, 323525 units (unchanged)',
    identity: '21ac3022efd501dd2ac18afb838cf5d683194f89cb4ebb23620a64423aeabf3b',
    livePty: '120x40 with TERM_PROGRAM=Apple_Terminal shows the V body; without it the generic art stays',
    fullSuite: 'not rerun; focused set covers the rendered TUI and terminal lifecycle',
  },
  residuals: [
    'Other terminal-specific welcome variants are not present in the recovered component.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'Continue the TUI parity work requested by the user before the remaining C-area items.',
};
write('research/ports/W130-welcome-apple-terminal-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW130-01 ports the Apple Terminal welcome variant',
  'research/coding-standard.md': '\n2026-10-17 W130-01 ',
  'research/FEATURES.md': 'W130 adds the Apple_Terminal `V` variant',
  'research/CURRENT.md': '## W130 Apple Terminal 启动头部（2026-10-17）',
  'research/ports/W130-welcome-apple-terminal.md': '# W130 — Apple Terminal welcome art',
  '.audit/w130-runtime.todo.md': '\n## W130-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const found = read(path).split(mark).length - 1;
  if (found !== 1) throw new Error(`${path} holds ${found} entries for ${JSON.stringify(mark)}, expected 1`);
}
console.log('record ok');
