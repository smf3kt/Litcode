// W66-01 record: the hook terminal wrapper is decoded by real tmux and screen.
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

const note = `# W66 — the hook terminal wrapper through real tmux and screen

## Source position

The recovered wrapper is \`OI\` in \`chunk-kexg5hxg.js\` UTF-8 bytes [8488,8667), with mux detection
\`K3t\` at [7526,7656): tmux and screen both double every ESC inside DCS. The port in
\`src/hook-terminal.ts\` reproduces that body for the two supported multiplexers; zellij detection
is not ported. \`HOOKS.md\` recorded the wrapper bytes but not real mux decoding, which this package
adds.

## Verification

\`scripts/smoke-hook-mux.mjs\` emits the product wrapper from inside a real multiplexer and lets a
second, independent terminal implementation parse the forwarded bytes:

1. an outer \`tmux\` server runs the case in its pane with \`automatic-rename off\`;
2. the pane starts the inner \`tmux\` (\`allow-passthrough all\`) or \`screen\`, which runs an emitter
   that calls \`formatHookTerminalSequence\` with the matching environment;
3. after a startup delay the emitter writes the wrapped OSC 0 with a per-run title;
4. the outer tmux parses the forwarded OSC 0 and reports \`#{pane_title}\`.

Both muxes decode to the exact title in source and compiled modes. The emitted bytes are hashed in
the smoke output; tmux starts with \`ESC Ptmux;\`, screen with \`ESC P\` and doubled ESC inside. This
proves decoding by a real parser, not only that the wrapper bytes were written.

## Crash-safe delivery disposition

Display effects are appended to the session journal before the TTY write
(\`src/interactive.ts\` drain), and resume preserves the records as data without replaying them. A
crash between the journal append and the TTY write therefore loses at most that display effect; a
crash before the append leaves no journal record and no effect. Exactly-once delivery would need a
terminal acknowledgment the TTY does not provide, so the recorded contract is at-most-once attempt
delivery with no replay, as \`HOOKS.md\` states.

## Verification totals

Source and compiled mux smokes pass, tsc 0, full 2,090/2,090 at concurrency 2 (host load made the
default-concurrency run time out in unrelated worktree cases; the isolated rerun passed), chain
767/767, notices 0, source index unchanged, identity \`bb47c630…\`.
`;
write('research/ports/W66-hook-mux-decode.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W66-01 verifies real multiplexer decoding of the hook terminal wrapper. The recovered \`OI\` body
(chunk-kexg5hxg.js UTF-8 [8488,8667), detection \`K3t\` [7526,7656)) doubles ESC inside DCS for tmux
and screen; the port matches. \`scripts/smoke-hook-mux.mjs\` runs the product formatter inside each
real multiplexer and has an outer tmux parse the forwarded OSC 0, asserting the pane title, in
source and compiled modes. Display delivery is dispositioned as journal-before-effect at-most-once
with no replay; full original consumers and script semantics remain gaps. tsc 0, full 2,090/2,090,
chain 767/767, identity \`bb47c630…\`. [W66 record](ports/W66-hook-mux-decode.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W66-01 hook 终端 mux 解码：S-1（先读源）：逐字核对 OI [8488,8667) 与 K3t [7526,7656)，端口对 tmux/screen 的双 ESC 规则一致。S-2（不臆造）：仅验证已移植的两种 mux；zellij 未移植。S-3（边界）：冒烟用外层 tmux 作为独立解析器，内层真实 tmux/screen 转发；运行后清理会话与临时目录。S-4（可测）：源码与编译两种模式各跑一次并校验 pane title 与字节前缀/摘要。S-5/S-6：无新增依赖。S-7（记录）：端口记录与证据 JSON。验证：tsc 0、两模式 smoke 通过、全量 2,090/2,090（并发 2）、链 767/767、身份 bb47c630…。
`);

const featureOld = 'Original full consumers/script semantics,real mux decoding and crash-proof display delivery remain gaps';
const featureNew = 'Real mux decoding is verified against installed tmux and screen with a second tmux parser; display delivery stays at-most-once by journal-before-effect with no replay, and original full consumers/script semantics remain gaps';
const featureText = read('research/FEATURES.md');
if (featureText.split(featureOld).length - 1 !== 1) throw new Error('FEATURES hooks gap sentence count changed');
write('research/FEATURES.md', featureText.replace(featureOld, featureNew));

const rowOld = '| C-6 | Hooks 与显示 | 完整消费者与脚本语义、真实 mux 解码、崩溃安全投递；部分 hook 类型在本运行时只读 | Lifecycle hooks |';
const rowNew = '| C-6 | Hooks 与显示 | 真实 mux 解码已完成（W66-01：内层真实 tmux/screen 转发，外层 tmux 解析 OSC 0 并回读 pane title，源码与编译两模式通过）；显示投递判定为 journal-before-effect 的 at-most-once（崩溃不重放）；完整消费者与脚本语义仍待处理 | Lifecycle hooks |';
const current = read('research/CURRENT.md');
if (current.split(rowOld).length - 1 !== 3) throw new Error('CURRENT C-6 row count changed');
write('research/CURRENT.md', current.split(rowOld).join(rowNew));

const tsv = [
  ['2026-10-17T11:32:00Z', 'package', 'W66-01 真实 tmux/screen 解码',
    'smoke-hook-mux.mjs：外层 tmux 面板内启动内层真实 tmux(allow-passthrough all)/screen，产品 formatter 生成 OSC 0，外层 tmux 回读 pane title；源码/编译两模式',
    '恢复源 OI/K3t 逐字核对；zellij 未移植',
    '两模式 smoke 通过；tsc 0；全量 2,090/2,090；链 767/767'],
  ['2026-10-17T11:35:00Z', 'decision', 'W66-01 崩溃安全投递判定为 at-most-once',
    '① interactive drain 先 append hook_terminal 再写 TTY；② resume 只恢复记录不重放；③ 日志后、写前崩溃丢失该次显示效果，日志前崩溃无记录无效果；④ 终端无 ack，exactly-once 不可证明',
    '残余：完整原始消费者/脚本语义仍为缺口；zellij 检测未移植',
    '.audit/w66-01-smoke.txt'],
  ['2026-10-17T11:38:00Z', 'verification', 'W66-01 验收：两模式 smoke、2,090/2,090、767/767、身份 bb47c630…',
    'tmux 与 screen 的 pane title 均等于本次唯一标题；tmux 字节前缀 ESC Ptmux;，screen 前缀 ESC P 且含双 ESC',
    'tsc 0；notices 0；索引 75 chunks / 323,525 单位不变；首次并发 4 的全量因主机负载在无关 worktree 用例超时，并发 2 隔离重跑通过'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w66-runtime.tsv', tsv + '\n');

write('.audit/w66-runtime.todo.md', `# W66 runtime trail

## W66-01 acceptance (2026-10-17)

- [x] **Recovered body matched.** \`OI\` [8488,8667) and \`K3t\` [7526,7656) in
  \`chunk-kexg5hxg.js\` double ESC inside DCS for tmux and screen; the port matches.
- [x] **Real tmux decodes.** An outer tmux pane title equals the emitted title.
- [x] **Real screen decodes.** Screen forwards the doubled-ESC payload and the outer tmux parses
  the OSC 0.
- [x] **Both delivery modes.** Source and compiled smokes pass; emitted bytes are hashed.
- [x] **Crash-safe disposition.** Journal-before-effect at-most-once, no replay; exactly-once is
  not provable without a terminal acknowledgment.
- [x] **Gates.** tsc 0, both mux smokes, full 2,090/2,090 at concurrency 2, chain 767/767, notices
  0, index unchanged, identity \`bb47c630…\`.
- [ ] Remaining C-6 item: full original consumers and script semantics.
`);

const evidence = {
  schema: 'W66HookMuxDecodeEvidence.v1',
  package: 'W66-01 — real tmux/screen decoding of the hook terminal wrapper',
  date: '2026-10-17',
  question: 'Do real multiplexers decode the hook terminal wrapper the product emits?',
  answer: 'Yes. A real tmux and a real screen each forward the wrapped OSC 0 so a second tmux parses it and reports the exact pane title, in both source and compiled modes.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-kexg5hxg.js',
    wrapper: { symbol: 'OI', utf8: [8488, 8667] },
    detection: { symbol: 'K3t', utf8: [7526, 7656] },
    port: 'src/hook-terminal.ts',
  },
  method: {
    outer: 'tmux server with allow-rename on and automatic-rename off; #{pane_title} is the oracle',
    inner: 'real tmux with allow-passthrough all, or real screen, each running the product formatter',
    delay: '1200 ms after start so the inner client is attached before the effect',
    assertion: 'outer pane title equals the per-run title; emitted bytes checked for the wrapper prefix',
  },
  changes: [
    { file: 'scripts/smoke-hook-mux.mjs', change: 'real mux decode smoke', sha256: sha(read('scripts/smoke-hook-mux.mjs')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record the completed mux gap', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'lifecycle hooks row records mux verification and delivery disposition', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W66-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W66-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  delivery: {
    contract: 'append hook_terminal, then write the TTY; resume keeps records without replay',
    disposition: 'at-most-once attempt delivery',
    exactlyOnce: 'not provable; the TTY has no acknowledgment channel',
  },
  gates: {
    tsc: 'exit 0',
    smokeSource: 'passed (tmux and screen decoded)',
    smokeCompiled: 'passed (tmux and screen decoded)',
    full: '2,090/2,090 at concurrency 2',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'bb47c6306263312b2cb01fea76c9b872df0d9ac7f54cee17ea098f4e215d9aa9',
  },
  residuals: [
    'Zellij detection exists in the recovered K3t body but is not ported.',
    'The first full-suite run at concurrency 4 timed out in unrelated worktree cases under host load; the isolated concurrency-2 rerun passed.',
    'Screen 4.00.03 forwards the doubled ESC verbatim; decoding depends on the parser tolerating the prefix ESC ESC.',
    'Full original consumer and plugin script semantics remain a gap.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with full original consumers and script semantics.',
};
write('research/ports/W66-hook-mux-decode-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW66-01 verifies real multiplexer',
  'research/coding-standard.md': '\n2026-10-17 W66-01 ',
  'research/FEATURES.md': 'Real mux decoding is verified against installed tmux',
  'research/ports/W66-hook-mux-decode.md': '# W66 — the hook terminal wrapper',
  '.audit/w66-runtime.todo.md': '\n## W66-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
