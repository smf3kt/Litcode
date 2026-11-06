// W126-01 record: scriptPath file loading for workflow scripts.
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

const note = `# W126 — Workflow \`scriptPath\` file loading

W125 accepted an inline \`script\`. The recovered tool also accepts a
\`scriptPath\` file and reads it through the hardened loader \`Chn\`. This package
ports that loader into \`workflow_run\`; named workflows and journal/resume stay
out.

## Source position

- Tool schema (chunk-a7gk0710): \`script\`, \`args\`, \`scriptPath\`, \`resumeFromRunId\`
  and \`name\`, with a refinement requiring one of script/name/scriptPath/runId.
- Loader \`Chn\` (chunk-hedqf2m1.js offset 19175), with path resolution and the
  refusal text \`Qt\` (18614) and the reader/permission helper \`Oo\` (18913).
  The file is opened \`O_RDONLY|O_NOFOLLOW\`, and the opened descriptor is
  \`fstat\`ed before any read: \`ino === 0\` or \`nlink > 1\` refuses the path,
  a non-file is rejected with \`is not a regular file\`, and a size above
  \`wE\` (524288) is rejected. Errors distinguish a missing file
  (\`Workflow script file not found: …\`) from any other read failure.
  Only after loading is the source parsed with \`YS\`.

## Port

- \`loadWorkflowScriptFile\` (src/workflow-script.ts) resolves the path against
  the session workspace, opens with \`O_RDONLY|O_NOFOLLOW\`, checks
  \`ino === 0n\`/\`nlink > 1n\`, \`isFile()\`, the 524288-byte cap (before and
  after the read), and reads from the descriptor.
- \`workflow_run\` accepts \`scriptPath\` beside \`script\`; the zod refinement
  requires exactly one of the two, and \`tasks\` cannot be mixed with either.
  The tool description and JSON schema list the new input.
- Refusal text keeps the source's first line and inline-script advice, with the
  product's own tool name.

## Adaptation

- The recovered loader gates the path through the session's tool-permission and
  read-tool checks (\`aXn\`/\`$o\`); this runtime relies on the workflow tool's own
  permission decision and therefore allows any readable regular path, while
  keeping the source's link/inode/regular-file/size refusals.
- The recovered resolves relative paths against the process cwd; this runtime
  resolves them against the session workspace, and absolute paths resolve as
  absolute.
- Only \`scriptPath\` is added. \`name\` (saved workflows), \`resumeFromRunId\`,
  journal replay and reattachment remain open under C-8.

## Verification

\`workflow-script\` pins the regular-file load and run, the symlink and hard-link
refusals, the directory refusal (nlink > 1), the missing-file text, the size
cap, and a tool-level run from a workspace file plus the exactly-one
rejection. Workflow family 43/43, tsc 0, build 0, full 2,204/2,204, chain
768/768, notices 0, source index unchanged, identity \`adad009d…\`.
`;
write('research/ports/W126-script-path.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W126-01 adds \`scriptPath\` to \`workflow_run\`. A workflow script can now be read from a file:
the path resolves against the session workspace, opens with \`O_RDONLY|O_NOFOLLOW\`, and the
opened descriptor is checked for \`ino === 0\`/\`nlink > 1\`, regular-file type and the 524,288-byte
cap before the source is parsed and run in the same sandbox as an inline script. Exactly one of
\`script\`/\`scriptPath\` is required and neither composes with \`tasks\`. Named workflows,
journal/resume, reattachment and structured output remain out. Workflow family 43/43, tsc 0,
build 0, full 2,204/2,204, chain 768/768, notices 0, identity \`adad009d…\`.
[W126 record](ports/W126-script-path.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W126-01 scriptPath文件加载：S-1（先读源）：Chn 19175、Qt 18614、Oo 18913、aXn/$o 18614-19175（chunk-hedqf2m1.js）、工具schema refinement（chunk-a7gk0710）、wE=524288。S-2（不臆造）：O_NOFOLLOW打开、ino==0/nlink>1拒链、仅常规文件、读取前后524,288字节上限、从描述符读取、缺失与其他读错误区分、加载后再解析meta。S-3（边界）：相对路径按会话工作区解析、绝对路径原样；源的工具权限/read-tool检查无对应物，依赖workflow工具本身权限；name/resumeFromRunId/journal/重新挂接仍开放。S-4（可测）：workflow-script新增1条文件加载（常规文件运行、符号链接、硬链接、目录、缺失、超限）与工具级scriptPath运行、恰好其一拒绝。S-5：无依赖变化。S-6：输入schema新增scriptPath与三选一anyOf，zod refine恰好其一。S-7：端口记录与证据JSON。验证：工作流家族43/43、tsc 0、build 0、全量2,204/2,204、链768/768、notices 0、索引不变、身份adad009d…。
`);

replaceOnce('research/FEATURES.md',
  'the original script API is ported (W125: pure-literal meta parser,',
  'the original script API is ported (W125: inline scripts; W126: scriptPath files opened with O_NOFOLLOW and inode/link/regular-file/size checks; pure-literal meta parser,');

replaceAll('research/CURRENT.md',
  '；未移植：journal/resume、scriptPath/命名工作流、重新挂接、自动效果重放、agent({schema})结构化输出',
  '；W126补scriptPath文件加载（O_NOFOLLOW打开、ino==0/nlink>1拒链、仅常规文件、524,288字节上限、工作区相对/绝对解析、script与scriptPath恰好其一）；未移植：journal/resume、命名工作流、重新挂接、自动效果重放、agent({schema})结构化输出',
  3);

const tsv = [
  ['2026-10-17T17:10:00Z', 'package', 'W126-01 scriptPath文件加载',
    'Chn 19175、Qt 18614、Oo 18913（chunk-hedqf2m1.js）；a7gk0710工具schema；wE=524288',
    'O_NOFOLLOW、inode/nlink拒链、常规文件、读取前后大小上限、描述符读取、加载后解析meta',
    'workflow-script新增1；工作流家族43/43；tsc 0；build 0'],
  ['2026-10-17T17:18:00Z', 'decision', 'W126-01 适配',
    '相对路径按会话工作区解析；源的工具权限/read-tool检查无对应物；name/resumeFromRunId/journal/重新挂接仍开放',
    '输入schema新增scriptPath与三选一anyOf；zod refine恰好其一',
    '无依赖变化'],
  ['2026-10-17T17:25:00Z', 'verification', 'W126-01 验收：全量2,204/2,204、链768/768、notices 0',
    'identity adad009d…；source index 75 chunks不变',
    '.audit/w126-01-full.txt、.audit/w126-01-chain.txt'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w126-runtime.tsv', tsv + '\n');

write('.audit/w126-runtime.todo.md', `# W126 runtime trail

## W126-01 acceptance (2026-10-17)

- [x] **Loader.** Workspace-relative resolution, O_NOFOLLOW, inode/link
  refusal, regular file, 524,288-byte cap, descriptor read.
- [x] **Tool input.** \`scriptPath\` beside \`script\`, exactly one required,
  no mixing with \`tasks\`.
- [x] **Errors.** Missing file, unreadable file, refusal text, non-file and
  oversize messages.
- [x] **Gates.** Workflow family 43/43, tsc 0, build 0, full 2,204/2,204,
  chain 768/768, notices 0, identity \`adad009d…\`.
- [ ] Remaining C-8: named workflows, journal/resume, reattachment, automatic
  effect replay, structured output.
`);

const evidence = {
  schema: 'W126ScriptPathEvidence.v1',
  package: 'W126-01 — Workflow scriptPath file loading',
  date: '2026-10-17',
  question: 'How does the recovered workflow tool load a script from disk, and which file checks does it enforce?',
  answer: 'It resolves the path, opens it O_RDONLY|O_NOFOLLOW, checks the opened descriptor for ino 0 or nlink > 1, requires a regular file, rejects a size over 524288 bytes, reads from the descriptor, and only then parses the meta/source. The port keeps those checks and resolves relative paths against the session workspace; the recovered session permission/read-tool gate has no counterpart, and the workflow tool permission decision governs the call instead.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    modules: {
      'extracted-v2/modules/chunk-hedqf2m1.js': [18614, 18913, 19175],
      'extracted-v2/modules/chunk-a7gk0710.js': ['workflow tool schema refinement'],
    },
    implementation: { 'src/workflow-script.ts': { ranges: 'loadWorkflowScriptFile' }, 'src/workflow.ts': { ranges: 'scriptSchema and runScript' } },
  },
  behavior: {
    noFollowOpen: true,
    rejectsInoZero: true,
    rejectsHardLinks: true,
    requiresRegularFile: true,
    scriptByteCap: 524288,
    readsFromDescriptor: true,
    parsesMetaAfterLoad: true,
    exactlyOneOfScriptAndPath: true,
    composesWithTasks: false,
    missingFileText: 'Workflow script file not found: <path>',
  },
  adaptations: [
    'Relative paths resolve against the session workspace instead of the process cwd.',
    'The recovered loader gates the path through session tool permissions and an added-directory read check; this runtime relies on the workflow tool permission decision and keeps the link/inode/regular-file/size refusals.',
    'Named workflows, resumeFromRunId, journal replay and reattachment remain out.',
  ],
  changes: [
    { file: 'src/workflow-script.ts', change: 'loadWorkflowScriptFile', sha256: sha(read('src/workflow-script.ts')) },
    { file: 'src/workflow.ts', change: 'scriptPath schema and branch', sha256: sha(read('src/workflow.ts')) },
    { file: 'test/workflow-script.test.ts', change: 'file loader and tool-level scriptPath tests', sha256: sha(read('test/workflow-script.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-8 rows record W126', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'workflow row records scriptPath', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W126-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W126-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '43/43 (workflow family)',
    build: 'exit 0',
    full: '2,204/2,204',
    chain: '768/768',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'adad009d1eaf9d37bbdb15437a080d84baf0155a1deea979e3d5faefb0719e08',
  },
  residuals: [
    'C-8: named workflows, resumeFromRunId, journal/resume replay, reattachment and automatic effect replay remain out.',
    'C-8: agent({schema}) structured output, disallowedTools, bashCommandClamp and stallMs remain rejected explicitly.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-8 continues with named workflows or journal/resume, or the next ready C-area cluster from CURRENT.',
};
write('research/ports/W126-script-path-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW126-01 adds `scriptPath`',
  'research/coding-standard.md': '\n2026-10-17 W126-01 ',
  'research/FEATURES.md': 'W126: scriptPath files opened with O_NOFOLLOW',
  'research/CURRENT.md': { mark: 'W126补scriptPath文件加载', count: 3 },
  'research/ports/W126-script-path.md': '# W126 — Workflow `scriptPath` file loading',
  '.audit/w126-runtime.todo.md': '\n## W126-01 acceptance',
};
for (const [path, expected] of Object.entries(marks)) {
  const { mark, count } = typeof expected === 'string' ? { mark: expected, count: 1 } : expected;
  const found = read(path).split(mark).length - 1;
  if (found !== count) throw new Error(`${path} holds ${found} entries for ${JSON.stringify(mark)}, expected ${count}`);
}
console.log('record ok');
