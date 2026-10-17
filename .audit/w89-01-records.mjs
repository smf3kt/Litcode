// W89-01 record: script hooks are refused by the recovered build.
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

const note = `# W89 — script hooks are refused by the recovered build

## Source position

The schematic \`type: "script"\` hook never executes in this build: \`ito\`
throws \`"script hooks are not available in this build"\`
(chunk-n3ykh62m.js offset 409142). The command adapter calls \`ito\` before
running anything (chunk-sfn1dbxq.js offset 3053030) and its catch records the
message as the failure output with \`succeeded: false\` (offset 3054829). The
catch marks the result blocked only when the event is in \`SV\`, the
\`{PreToolUse, PermissionRequest}\` set (chunk-3cynezh1.js offset 109855).

## Port

\`runHooks\` no longer executes a \`type: "script"\` command. It records
\`[<event> hook: script hooks are not available in this build]\` as a failure and,
for PreToolUse and PermissionRequest, blocks with that message. Other events
receive the same non-blocking failure note.

## Correction

The prior transport contract ran script hooks as synchronous bounded shell
commands. That was an inference: the recovered build refuses them before
execution, so the transport test now asserts refusal, that no payload/cwd files
are written, and that the failure is blocking only on the two \`SV\` events.

## Verification

\`hooks\` 51/51 and \`hook-transports\` 3/3: a PreToolUse script hook blocks with
the exact message and does not run its command (no marker file); a SessionStart
script hook records the same non-blocking note. tsc 0; build 0; full
2,118/2,118; chain 767/767; notices 0; source index unchanged; identity
\`f7a620b6…\`.
`;
write('research/ports/W89-script-hooks.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W89-01 corrects script-hook handling from the recovered build. \`ito\` throws
"script hooks are not available in this build" before anything runs, and the
adapter catch records that as the failure, blocking only for PreToolUse and
PermissionRequest. \`runHooks\` now refuses script hooks the same way instead of
executing the command; the transport test asserts the refusal and that no
command ran. \`hooks\` 51/51, \`hook-transports\` 3/3, tsc 0, build 0, full
2,118/2,118, chain 767/767, identity \`f7a620b6…\`.
[W89 record](ports/W89-script-hooks.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W89-01 脚本钩子拒绝执行：S-1（先读源）：读取 chunk-n3ykh62m.js 的 ito 409142、chunk-sfn1dbxq.js 调用点 3053030 与 catch 3054829、chunk-3cynezh1.js 的 SV 109855（UTF-16）。S-2（不臆造）：脚本钩子不执行；失败文本为源固定消息；仅 PreToolUse/PermissionRequest 阻断。S-3（边界）：不运行命令、不产生载荷/目录文件。S-4（可测）：hooks 新增拒绝用例；hook-transports 改为拒绝断言。S-5/S-6：无依赖变化。S-7（记录）：该包纠正先前把 script 当同步 shell 的推断，证据记录在端口与证据 JSON。验证：hooks 51/51、hook-transports 3/3、tsc 0、build 0、全量 2,118/2,118、链 767/767、身份 f7a620b6…。
`);

replaceOnce('research/FEATURES.md',
  '(the stored message and model view keep the original; per-token rewriting is not replicated) |',
  '(the stored message and model view keep the original; per-token rewriting is not replicated); W89 corrects script hooks to the recovered refusal: the hook never executes, records "script hooks are not available in this build", and blocks only for PreToolUse/PermissionRequest |');

replaceAll('research/CURRENT.md',
  '完整消费者与脚本语义仍待处理',
  'W89纠正脚本钩子（源构建拒绝执行：不运行命令，固定失败文本，仅PreToolUse/PermissionRequest阻断）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-18T02:10:00Z', 'package', 'W89-01 脚本钩子拒绝执行',
    'ito 409142、调用点 3053030、catch 3054829、SV 109855；runHooks script 分支与传输测试',
    '不执行命令；失败文本固定；仅 PreToolUse/PermissionRequest 阻断',
    'hooks 51/51；hook-transports 3/3；tsc 0；build 0；全量 2,118/2,118；链 767/767'],
  ['2026-10-18T02:12:00Z', 'decision', 'W89-01 纠正记录',
    '先前“script=同步受限 shell”属推断，源构建在 ito 直接抛出；按源改写传输契约，并在端口记录与 S-7 注明',
    '残余：完整消费者（脚本语义本身在源构建不可用）',
    '.audit/w89-01-full.txt'],
  ['2026-10-18T02:15:00Z', 'verification', 'W89-01 验收：hooks 51/51、hook-transports 3/3、tsc 0、build 0、2,118/2,118、767/767',
    'PreToolUse 脚本钩子阻断且无标记文件；SessionStart 脚本钩子仅非阻断失败注记',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity f7a620b6…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w89-runtime.tsv', tsv + '\n');

write('.audit/w89-runtime.todo.md', `# W89 runtime trail

## W89-01 acceptance (2026-10-18)

- [x] **Source read.** \`ito\`, the adapter call site and catch, and the \`SV\`
  blocking set.
- [x] **Port.** Script hooks are refused without execution.
- [x] **Correction.** The prior synchronous-shell contract is replaced with the
  source's refusal, recorded in the port and S-7 entry.
- [x] **Gates.** hooks 51/51, hook-transports 3/3, tsc 0, build 0, full
  2,118/2,118, chain 767/767, notices 0, source index unchanged, identity
  \`f7a620b6…\`.
- [ ] Remaining C-6: full consumers.
`);

const evidence = {
  schema: 'W89ScriptHooksEvidence.v1',
  package: 'W89-01 — script hooks are refused by the recovered build',
  date: '2026-10-18',
  question: 'Does the recovered build execute type:"script" hooks, and how are they refused?',
  answer: 'No: ito throws "script hooks are not available in this build" before execution; the adapter records that as the failure output and blocks only for PreToolUse and PermissionRequest (SV). The product now refuses them the same way instead of running the command.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    refusal: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', symbol: 'ito', offset: 409142 },
    callSite: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 3053030 },
    catchResult: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 3054829 },
    blockingSet: { module: 'extracted-v2/modules/chunk-3cynezh1.js', symbol: 'SV', offset: 109855, events: ['PreToolUse', 'PermissionRequest'] },
  },
  behavior: {
    execution: 'none',
    message: 'script hooks are not available in this build',
    blocking: 'PreToolUse and PermissionRequest only',
    otherEvents: 'non-blocking failure note',
  },
  correction: {
    previous: 'script hooks ran as synchronous bounded shell commands',
    basis: 'the recovered build throws before execution; the transport contract was an inference',
    updatedTest: 'test/hook-transports.test.ts',
  },
  changes: [
    { file: 'src/hooks.ts', change: 'script branch refuses without execution', sha256: sha(read('src/hooks.ts')) },
    { file: 'test/hooks.test.ts', change: 'script refusal test', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'test/hook-transports.test.ts', change: 'transport contract corrected to refusal', sha256: sha(read('test/hook-transports.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W89', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W89', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W89-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W89-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    hooks: '51/51',
    hookTransports: '3/3',
    build: 'exit 0',
    full: '2,118/2,118',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'f7a620b69d6f2ca3bc9deb2cefb0dc641f5a1e1a0375ac08e64b214fb1b37a8f',
  },
  residuals: [
    'Script semantics remain unavailable because the recovered build refuses them.',
    'Full hook consumers remain C-6 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with full consumers.',
};
write('research/ports/W89-script-hooks-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW89-01 corrects script-hook handling',
  'research/coding-standard.md': '\n2026-10-18 W89-01 ',
  'research/FEATURES.md': 'W89 corrects script hooks',
  'research/ports/W89-script-hooks.md': '# W89 — script hooks are refused by the recovered build',
  '.audit/w89-runtime.todo.md': '\n## W89-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
