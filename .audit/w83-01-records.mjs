// W83-01 record: failed hook output display for watcher events.
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

const note = `# W83 — failed hook output for watcher events

## Source position

\`ke($e,Ve)\` (chunk-sfn1dbxq.js, UTF-16 [1678937,1679425)) displays every
\`systemMessage\` from the FileChanged run, then walks the per-hook results and
displays \`result.output\` for each result whose \`succeeded\` is false. The
CwdChanged handler at offset 1680136 does the same for its results. The command
and HTTP adapters produce \`{succeeded, output, ...}\` where a non-zero status
carries stderr as \`output\` (offsets 3054588 and 3050719).

## Port

\`HookResult.failures\` records the failure text for spawn errors, timeouts,
non-blocking exit 2 and any other non-zero exit. The same text is still pushed
to \`additionalContext\`, so model context is unchanged. The interactive
FileChanged and CwdChanged raises display each entry on the status stream after
the system messages, matching the source's display order.

## Adaptation

The product reports failure text rather than a per-hook \`{succeeded, output}\`
record, because its runner aggregates hook output by event. The text is the
same one already surfaced as context, so no new interpretation is introduced.
Blocking exit-2 events keep their block/reason behavior and do not add a
failure entry.

## Verification

\`hooks\` 50/50: a FileChanged hook exiting 3 with stderr reports
\`[FileChanged hook: exit code 3] boom\` in both \`failures\` and
\`additionalContext\`; a successful hook leaves \`failures\` undefined. tsc 0;
build 0; full 2,110/2,110; chain 767/767; notices 0; source index unchanged;
identity \`53e0f27e…\`.
`;
write('research/ports/W83-failed-hook-output.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W83-01 ports the failed-hook display for watcher events. \`HookResult.failures\`
carries the same failure text already placed in model context for spawn
errors, timeouts, non-blocking exit 2 and other non-zero exits; the interactive
FileChanged and CwdChanged raises display those entries after the system
messages, as \`ke\` does with unsuccessful results. Blocking exit-2 events keep
their existing block behavior. \`hooks\` 50/50, tsc 0, build 0, full
2,110/2,110, chain 767/767, identity \`53e0f27e…\`.
[W83 record](ports/W83-failed-hook-output.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W83-01 失败钩子输出显示：S-1（先读源）：读取 chunk-sfn1dbxq.js 的 ke [1678937,1679425)、CwdChanged 处理器偏移 1680136、命令/HTTP 适配器偏移 3054588/3050719（UTF-16）。S-2（不臆造）：失败文本沿用既有 additionalContext 文本，仅另存 failures；事件顺序为先 systemMessages 后 failures。S-3（边界）：阻塞 exit 2 保持 block/reason，不记失败；不做逐钩子 succeeded/output 结构。S-4（可测）：新增 exit 3 带 stderr 的失败用例与成功缺省用例。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：hooks 50/50、tsc 0、build 0、全量 2,110/2,110、链 767/767、身份 53e0f27e…。
`);

replaceOnce('research/FEATURES.md',
  'and the failure-output display remains a gap |',
  'and W83 displays failed hook output for watcher events (`HookResult.failures` carries the same text already placed in context, and the FileChanged/CwdChanged raises print it after system messages) |');

replaceAll('research/CURRENT.md',
  '完整消费者与脚本语义仍待处理',
  'W83完成监视器事件失败输出显示（failures与上下文同文，按systemMessages之后输出；阻塞exit 2保持原语义）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-17T23:10:00Z', 'package', 'W83-01 失败钩子输出显示',
    'ke [1678937,1679425)、CwdChanged 1680136、适配器 3054588/3050719；HookResult.failures 与 interactive 显示',
    'spawn/timeout/非阻塞exit2/其他非零退出记失败；文本与 additionalContext 相同；先系统消息后失败',
    'hooks 50/50；tsc 0；build 0；全量 2,110/2,110；链 767/767'],
  ['2026-10-17T23:12:00Z', 'decision', 'W83-01 边界',
    '① 不引入逐钩子 succeeded/output 结构；② 阻塞 exit 2 不记失败；③ 仅监视器 raise 显示，其他事件消费路径不变',
    '残余：完整消费者与脚本语义',
    '.audit/w83-01-full.txt'],
  ['2026-10-17T23:15:00Z', 'verification', 'W83-01 验收：hooks 50/50、tsc 0、build 0、2,110/2,110、767/767',
    'exit 3 + stderr 文本进入 failures 与上下文；成功钩子 failures 缺省',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 53e0f27e…（inputs 3aab77f3…、validation 58131ad4…、build 47067e1a…）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w83-runtime.tsv', tsv + '\n');

write('.audit/w83-runtime.todo.md', `# W83 runtime trail

## W83-01 acceptance (2026-10-17)

- [x] **Source read.** \`ke\`, the CwdChanged handler and both adapters measured
  in UTF-16 code units.
- [x] **Port.** \`HookResult.failures\` and status display in the interactive
  FileChanged and CwdChanged raises.
- [x] **Bounds.** Failure text is the existing context text; blocking exit 2 is
  unchanged and not recorded as a failure.
- [x] **Gates.** hooks 50/50, tsc 0, build 0, full 2,110/2,110, chain 767/767,
  notices 0, source index unchanged, identity \`53e0f27e…\`.
- [ ] Remaining C-6: full consumers and script semantics.
`);

const evidence = {
  schema: 'W83FailedHookOutputEvidence.v1',
  package: 'W83-01 — failed hook output for watcher events',
  date: '2026-10-17',
  question: 'Are failed hook outputs exposed and displayed for watcher events like the recovered ke/CwdChanged handlers?',
  answer: 'Yes: HookResult.failures carries the existing failure text for spawn errors, timeouts, non-blocking exit 2 and other non-zero exits, and the interactive FileChanged/CwdChanged raises display it after system messages; blocking exit 2 keeps its block semantics.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-sfn1dbxq.js',
    unit: 'UTF-16 code units',
    fileChangedHandler: { symbol: 'ke', range: [1678937, 1679425] },
    cwdChangedHandler: { offset: 1680136 },
    adapters: [3054588, 3050719],
  },
  behavior: {
    recorded: 'spawn error, timeout, non-blocking exit 2, other non-zero exit',
    text: 'the same failure text already placed in additionalContext',
    display: 'status stream after systemMessages for FileChanged and CwdChanged',
    notPorted: ['per-hook succeeded/output records'],
  },
  changes: [
    { file: 'src/hooks.ts', change: 'HookResult.failures and failure recording', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/interactive.ts', change: 'FileChanged/CwdChanged failure display', sha256: sha(read('src/interactive.ts')) },
    { file: 'test/hooks.test.ts', change: 'failed-output recording test', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record failure display', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records failure display', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W83-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W83-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    hooks: '50/50',
    build: 'exit 0',
    full: '2,110/2,110',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '53e0f27e21a67150481550ab9058e02f582f381280627213eb1c0b70078703d1',
  },
  residuals: [
    'Per-hook succeeded/output records are not introduced.',
    'Full hook consumers and script semantics remain C-6 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with full consumers and script semantics.',
};
write('research/ports/W83-failed-hook-output-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW83-01 ports the failed-hook display for watcher events',
  'research/coding-standard.md': '\n2026-10-17 W83-01 ',
  'research/FEATURES.md': 'W83 displays failed hook output for watcher events',
  'research/ports/W83-failed-hook-output.md': '# W83 — failed hook output for watcher events',
  '.audit/w83-runtime.todo.md': '\n## W83-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
