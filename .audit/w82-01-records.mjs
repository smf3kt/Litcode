// W82-01 record: hook-returned watchPaths.
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

const note = `# W82 — hook-returned watch paths

## Source position

\`Vln\` (chunk-sfn1dbxq.js, UTF-16 [2935234,2935532)) runs the CwdChanged and
FileChanged hooks and returns \`{results, watchPaths, systemMessages}\`, where
\`watchPaths\` is \`results.flatMap(result => result.watchPaths ?? [])\`. The
command and HTTP adapters read the field from
\`hookSpecificOutput.watchPaths\` (offsets 3050719 and 3054588), and \`QY\`
[557776,557905) concatenates \`watchPaths\` across hook results.
The FileChanged watcher (\`ke\` [1678937,1679425)) adds every returned path to
its watched set; the CwdChanged handler (offset 1680136) replaces the watched
set with the returned paths.

## Port

\`HookResult\` gains \`watchPaths\`. The output parser accepts
\`hookSpecificOutput.watchPaths\` only when \`hookEventName\` matches, keeps
non-empty strings in order, and accumulates across hooks. The interactive
FileChanged and CwdChanged raises hand the collected paths to
\`configWatch.addInstructionPaths\`, which keeps its existing absolute-path,
2048-entry and 64 KiB checks.

## Adaptation

The tool-mutation FileChanged raise inside the agent has no watcher consumer
and therefore ignores returned paths. The source's failed-hook output display
stays reduced to a status line. The watcher still treats the paths as
instruction paths rather than arbitrary file watches, matching its existing
scope.

## Verification

\`hooks\` 49/49: two matching hooks contribute \`["/a","/b"]\` and \`["/c"]\`
in order, a mismatched \`hookEventName\` contributes nothing, non-strings and
empty strings are dropped, and a result without the field leaves
\`watchPaths\` undefined. tsc 0; build 0; full 2,109/2,109; chain 767/767;
notices 0; source index unchanged; identity \`35629d1f…\`.
`;
write('research/ports/W82-watch-paths.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W82-01 ports hook-returned watch paths. \`HookResult.watchPaths\` collects
\`hookSpecificOutput.watchPaths\` from hooks whose event name matches, in run
order; the interactive FileChanged and CwdChanged raises add the collected
paths to the config watcher, which applies its existing absolute-path, count
and byte bounds. The agent's tool-mutation FileChanged raise has no watcher
consumer and ignores them. \`hooks\` 49/49, tsc 0, build 0, full 2,109/2,109,
chain 767/767, identity \`35629d1f…\`. [W82 record](ports/W82-watch-paths.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W82-01 钩子 watchPaths：S-1（先读源）：读取 chunk-sfn1dbxq.js 的 Vln [2935234,2935532)、ke [1678937,1679425)、QY [557776,557905)，以及命令/HTTP 适配器偏移 3050719/3054588（UTF-16）。S-2（不臆造）：仅匹配事件名的 hookSpecificOutput.watchPaths；保留非空字符串并跨钩子按序累积。S-3（边界）：交给既有 addInstructionPaths 的绝对路径/2048/64KiB 界限；Agent 内工具变更触发的 FileChanged 无监视器消费者。S-4（可测）：新增两钩子顺序累积、事件名不匹配丢弃、非字符串过滤与缺省 undefined 的用例。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：hooks 49/49、tsc 0、build 0、全量 2,109/2,109、链 767/767、身份 35629d1f…。
`);

replaceOnce('research/FEATURES.md',
  'while hook-returned `watchPaths` and the failure-output display remain gaps |',
  'while W82 consumes hook-returned `watchPaths` (matching `hookSpecificOutput` entries accumulate in order and feed the config watcher, bounded by its existing checks) and the failure-output display remains a gap |');

replaceAll('research/CURRENT.md',
  '完整消费者与脚本语义仍待处理',
  'W82完成钩子watchPaths（匹配hookSpecificOutput按序累积，交给配置监视器既有界限）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-17T22:40:00Z', 'package', 'W82-01 钩子 watchPaths',
    'Vln [2935234,2935532)、ke [1678937,1679425)、QY [557776,557905)、适配器 3050719/3054588；HookResult.watchPaths 与解析',
    '仅匹配事件名；非空字符串按序累积；交给 addInstructionPaths 既有界限',
    'hooks 49/49；tsc 0；build 0；全量 2,109/2,109；链 767/767'],
  ['2026-10-17T22:42:00Z', 'decision', 'W82-01 消费边界',
    '① interactive FileChanged/CwdChanged 消费；② Agent 工具变更 raise 无监视器消费者；③ 路径按指令路径处理，沿用既有绝对路径/2048/64KiB 检查',
    '残余：失败输出显示、完整消费者与脚本语义',
    '.audit/w82-01-full.txt'],
  ['2026-10-17T22:45:00Z', 'verification', 'W82-01 验收：hooks 49/49、tsc 0、build 0、2,109/2,109、767/767',
    '顺序累积 /a,/b,/c；不匹配事件名丢弃；非字符串与空串过滤；缺省 undefined',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 35629d1f…（inputs 8ed0053e…、validation 938bf296…、build 5a57e594…）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w82-runtime.tsv', tsv + '\n');

write('.audit/w82-runtime.todo.md', `# W82 runtime trail

## W82-01 acceptance (2026-10-17)

- [x] **Source read.** \`Vln\`, \`ke\`, \`QY\` and the command/HTTP adapters
  measured in UTF-16 code units.
- [x] **Port.** \`HookResult.watchPaths\` and matching-output parsing; interactive
  FileChanged/CwdChanged feed the config watcher.
- [x] **Bounds.** The watcher's existing absolute-path, 2048-entry and 64 KiB
  checks apply unchanged.
- [x] **Gates.** hooks 49/49, tsc 0, build 0, full 2,109/2,109, chain 767/767,
  notices 0, source index unchanged, identity \`35629d1f…\`.
- [ ] Remaining C-6: failure-output display, full consumers and script
  semantics.
`);

const evidence = {
  schema: 'W82WatchPathsEvidence.v1',
  package: 'W82-01 — hook-returned watch paths',
  date: '2026-10-17',
  question: 'Are hookSpecificOutput.watchPaths collected from matching hooks and consumed by the watcher like the recovered Vln/ke path?',
  answer: 'Yes: matching hooks contribute non-empty strings in run order to HookResult.watchPaths, the interactive FileChanged and CwdChanged raises add them through addInstructionPaths, and the watcher retains its existing bounds; the agent tool-mutation raise has no watcher consumer.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-sfn1dbxq.js',
    unit: 'UTF-16 code units',
    builder: { symbol: 'Vln', range: [2935234, 2935532] },
    watcherHandler: { symbol: 'ke', range: [1678937, 1679425] },
    merge: { symbol: 'QY', range: [557776, 557905] },
    adapters: [3050719, 3054588],
    cwdChangedHandler: { offset: 1680136 },
  },
  behavior: {
    source: 'hookSpecificOutput.watchPaths on an event-name-matching output',
    collection: 'non-empty strings, accumulated across hooks in run order',
    consumption: 'interactive FileChanged and CwdChanged call configWatch.addInstructionPaths',
    bounds: 'existing absolute-path, 2048-entry and 64 KiB checks',
    notPorted: ['agent tool-mutation watcher consumption', 'failed hook output display'],
  },
  changes: [
    { file: 'src/hooks.ts', change: 'HookResult.watchPaths and output parsing', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/interactive.ts', change: 'FileChanged/CwdChanged watchPaths consumption', sha256: sha(read('src/interactive.ts')) },
    { file: 'test/hooks.test.ts', change: 'watchPaths collection test', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record watchPaths', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records watchPaths', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W82-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W82-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    hooks: '49/49',
    build: 'exit 0',
    full: '2,109/2,109',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '35629d1fd49d29241f41d55d2d6d1b74f36e4580b7cd4701a6b7ff3640b3ae93',
  },
  residuals: [
    'The agent tool-mutation FileChanged raise has no watcher consumer.',
    'Failed hook output display remains reduced to a status line.',
    'Full consumers and script semantics remain C-6 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with failure-output display, full consumers and script semantics.',
};
write('research/ports/W82-watch-paths-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW82-01 ports hook-returned watch paths',
  'research/coding-standard.md': '\n2026-10-17 W82-01 ',
  'research/FEATURES.md': 'W82 consumes hook-returned `watchPaths`',
  'research/ports/W82-watch-paths.md': '# W82 — hook-returned watch paths',
  '.audit/w82-runtime.todo.md': '\n## W82-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
