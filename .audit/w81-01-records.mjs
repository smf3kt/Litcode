// W81-01 record: watcher-driven FileChanged raises.
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

const note = `# W81 — watcher-driven FileChanged

## Source position

\`ke($e,Ve)\` (chunk-sfn1dbxq.js, UTF-16 [1678937,1679425)) is the watcher's
event handler: it logs \`FileChanged: <event> <path>\`, calls
\`e7r(session, path, event, ...)\`, and consumes the result:

- non-empty \`watchPaths\` are added to the watched set through \`Se\`;
- every \`systemMessage\` is displayed as a non-error message;
- a failed hook's output is displayed as an error;
- a rejected run logs \`file_watcher_change_detected\`/\`hook_exec_failed\` and
  displays the error.

The watcher subscribes to \`add\`, \`change\` and \`unlink\`; \`e7r\`
[2935646,2935767) builds \`{...$d, hook_event_name:"FileChanged", file_path,
event}\`.

## Port

\`watchProjectConfig\` accepts \`onFileChange(filePath, event)\` in its sources.
For each relevant \`fs.watch\` event it reports the absolute path and maps the
event:

- \`rename\` with an existing target is \`add\`;
- \`rename\` with a missing target is \`unlink\`;
- anything else is \`change\`.

The interactive loop installs the callback when \`watchConfig\` is enabled and
raises \`FileChanged\` with the recovered payload; \`systemMessages\` from the
result are written to the status stream, matching the source display path. The
raise is asynchronous and non-blocking, and a failure writes a single status
line instead of interrupting the watcher.

## Adaptation

The product watcher covers the configuration, instruction and content roots it
already watches; it does not follow \`watchPaths\` returned by a FileChanged hook
because the product hook result has no such field. The recovered failure-output
display is reduced to an error status line. These stay recorded as C-6 work.

## Verification

\`config-watch\` 3/3: a real watcher reports an added file as \`add\`, a rewrite
as \`change\` (or \`add\` where the platform reports rename), and a deletion as
\`unlink\`, each with the absolute path. tsc 0; build 0; full 2,108/2,108; chain
767/767; notices 0; source index unchanged; identity \`700a4af5…\`.
`;
write('research/ports/W81-file-watcher-events.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W81-01 wires the recovered watcher-driven FileChanged raise. \`watchProjectConfig\`
reports each relevant Node watcher event as \`(filePath, add|change|unlink)\`
(rename is add or unlink by existence), and the interactive loop raises
FileChanged with the recovered \`{file_path, event}\` payload, displaying the
result's \`systemMessages\` like \`ke\` does. Hook-returned \`watchPaths\` and the
source failure-output display stay residual. \`config-watch\` 3/3, tsc 0, build
0, full 2,108/2,108, chain 767/767, identity \`700a4af5…\`.
[W81 record](ports/W81-file-watcher-events.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W81-01 监视器 FileChanged：S-1（先读源）：读取 chunk-sfn1dbxq.js 的 ke [1678937,1679425) 与 e7r [2935646,2935767)（UTF-16），确认 add/change/unlink 订阅及 watchPaths/systemMessages 消费。S-2（不臆造）：rename 以目标存在与否映射 add/unlink，其余为 change；绝对路径；载荷 {file_path,event}。S-3（边界）：仅覆盖产品既有配置/指令/内容监视根；不追随钩子返回的 watchPaths（结果类型无该字段）；失败输出降为单行状态。S-4（可测）：新增真实监视器用例断言 add、change/add、unlink 与路径。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：config-watch 3/3、tsc 0、build 0、全量 2,108/2,108、链 767/767、身份 700a4af5…。
`);

replaceOnce('research/FEATURES.md',
  'while model-alias normalization and the recovered `source`/flag fields remain gaps |',
  'while model-alias normalization and the recovered `source`/flag fields remain gaps; W81 raises FileChanged from the config watcher with the recovered `{file_path, event}` payload (rename maps to `add`/`unlink` by existence) and displays the result\'s system messages, while hook-returned `watchPaths` and the failure-output display remain gaps |');

replaceAll('research/CURRENT.md',
  '完整消费者与脚本语义仍待处理',
  'W81完成监视器驱动的FileChanged（add/change/unlink映射与systemMessages显示；钩子watchPaths未接）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-17T22:10:00Z', 'package', 'W81-01 监视器 FileChanged',
    'ke [1678937,1679425)、e7r [2935646,2935767)；watchProjectConfig onFileChange；interactive raise',
    'rename按存在性映射add/unlink；其余change；绝对路径；systemMessages显示；非阻塞',
    'config-watch 3/3；tsc 0；build 0；全量 2,108/2,108；链 767/767'],
  ['2026-10-17T22:12:00Z', 'decision', 'W81-01 边界',
    '① 复用既有配置/指令/内容监视根；② 不追随钩子返回的watchPaths（结果无该字段）；③ 失败输出降为状态行；④ 事件逐条raise，reload仍按既有debounce',
    '残余：watchPaths、失败输出语义、完整消费者与脚本语义',
    '.audit/w81-01-full.txt'],
  ['2026-10-17T22:15:00Z', 'verification', 'W81-01 验收：config-watch 3/3、tsc 0、build 0、2,108/2,108、767/767',
    '新增/改写/删除分别报告 add、change(add)、unlink 与绝对路径',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 700a4af5…（inputs b9f4b540…、validation 0ab9ad33…、build 95e80070…）'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w81-runtime.tsv', tsv + '\n');

write('.audit/w81-runtime.todo.md', `# W81 runtime trail

## W81-01 acceptance (2026-10-17)

- [x] **Source read.** \`ke\` and \`e7r\` measured in UTF-16 code units.
- [x] **Port.** Per-file watcher callback with add/change/unlink mapping and the
  recovered payload at the interactive raise.
- [x] **Display.** Result \`systemMessages\` are written, matching the source's
  watcher display path.
- [x] **Gates.** config-watch 3/3, tsc 0, build 0, full 2,108/2,108, chain
  767/767, notices 0, source index unchanged, identity \`700a4af5…\`.
- [ ] Remaining C-6: hook-returned \`watchPaths\`, failure-output display, full
  consumers and script semantics.
`);

const evidence = {
  schema: 'W81FileWatcherEventsEvidence.v1',
  package: 'W81-01 — watcher-driven FileChanged',
  date: '2026-10-17',
  question: 'Does the config watcher raise FileChanged with the recovered payload and event kinds when watched files change?',
  answer: 'Yes: watchProjectConfig reports each relevant event as (path, add|change|unlink) using rename existence, and the interactive loop raises the recovered {file_path, event} payload and displays result systemMessages; hook watchPaths and failure-output display remain unported.',
  sourcePosition: {
    module: 'extracted-v2/modules/chunk-sfn1dbxq.js',
    unit: 'UTF-16 code units',
    watcherHandler: { symbol: 'ke', range: [1678937, 1679425] },
    fileChanged: { symbol: 'e7r', range: [2935646, 2935767] },
  },
  behavior: {
    events: 'add, change and unlink from the file watcher',
    mapping: 'rename + existing target = add; rename + missing target = unlink; otherwise change',
    payload: '{file_path, event}',
    display: 'result systemMessages with the source display path',
    notPorted: ['hook-returned watchPaths', 'failed hook output display'],
  },
  changes: [
    { file: 'src/config-watch.ts', change: 'onFileChange callback and event mapping', sha256: sha(read('src/config-watch.ts')) },
    { file: 'src/interactive.ts', change: 'FileChanged raise and systemMessages display', sha256: sha(read('src/interactive.ts')) },
    { file: 'test/config-watch.test.ts', change: 'real watcher event test', sha256: sha(read('test/config-watch.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record watcher FileChanged', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records watcher FileChanged', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W81-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W81-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    configWatch: '3/3',
    build: 'exit 0',
    full: '2,108/2,108',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '700a4af574cc72118392b52e3e4f72f25329bee85b729c63ef9c758a125a5220',
  },
  residuals: [
    'Hook-returned watchPaths are not consumed because the product hook result lacks the field.',
    'Failed hook output is reduced to one status line.',
    'Full consumers and script semantics remain C-6 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with hook watchPaths, failure-output display, full consumers and script semantics.',
};
write('research/ports/W81-file-watcher-events-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW81-01 wires the recovered watcher-driven FileChanged raise',
  'research/coding-standard.md': '\n2026-10-17 W81-01 ',
  'research/FEATURES.md': 'W81 raises FileChanged from the config watcher',
  'research/ports/W81-file-watcher-events.md': '# W81 — watcher-driven FileChanged',
  '.audit/w81-runtime.todo.md': '\n## W81-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
