// W128-01 record: workflow script journal and resume.
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

const note = `# W128 — Workflow script journal and resume

W125/W126 run workflow scripts but leave every invocation independent. The
recovered runtime journals each agent() call and lets \`resumeFromRunId\` reuse
the unchanged prefix. This package ports the journal and the resume path.

## Source position

- Journal (\`sn\`, \`Do\`, \`Hr\`, \`No\`, \`Qr\`; chunk-hedqf2m1.js 20500-23000):
  \`<run dir>/journal.jsonl\`, one JSON entry per line, \`launched\`/\`started\`/
  \`result\`/\`failed\`; results and started attempts are indexed by key, failed
  keys tracked separately; unparseable lines are skipped. The key is
  \`v2:sha256(previousKey \\0 prompt \\0 canonicalOptions)\` where canonical
  options are \`schema/model/effort/isolation/agentType/disallowedTools/
  bashCommandClamp\` copied with sorted keys and functions dropped, and the
  prompt is \`String(prompt)\` for primitives. The first key chains from \`""\`.
- Runner cache (chunk-hedqf2m1.js 47494-48200): a cached result returns
  without spawning; a call with a \`started\` entry and no \`failed\` entry
  respawns without breaking the cache for later calls; the first miss stops
  cache reads for the rest of the run; a \`null\` result writes \`failed\` and no
  \`result\`.
- Resume entry (chunk-a7gk0710.js 59981 schema, 65391/69003 preflight, 70009
  run id, 73879 collision check): \`resumeFromRunId\` matches
  \`/^wf_[a-z0-9-]{6,}$/\`; run ids are \`wf_\` plus the first 12 characters of
  a UUID; a run with the same id that is still active is refused; a missing
  journal is refused with a "nothing to resume" message, and the recovered
  path then tries a remote session mirror.

## Port

- \`workflowAgentJournalKey\` (src/workflow-script.ts) ports \`No\`/\`Hr\` and the
  primitive prompt projection. \`loadWorkflowScriptJournal\` reads the file
  with \`O_NOFOLLOW\`, rejects a non-regular file and a size over 2 MiB, skips
  unparseable/invalid entries, and returns undefined when the file is absent.
  \`openWorkflowScriptJournal\` appends with \`O_WRONLY|O_CREAT|O_APPEND|
  O_NOFOLLOW\` after creating the directory with mode 0700.
- \`runWorkflowScript\` takes an optional journal. Each agent() call computes
  the chained key after options validation, returns a cached result without
  spawning, applies the started-without-failed respawn rule, and writes
  \`started\`/\`result\`/\`failed\` entries in order. Journal write failures never
  fail the script, matching the recovered warning-only behavior.
- \`workflow_run\` generates \`wf_<uuid12>\` (or reuses \`resumeFromRunId\`), stores
  the journal under the owner's workflow directory at
  \`journals/<runId>/journal.jsonl\`, appends \`launched\` for a fresh run, and
  returns \`run_id\` beside the script result. The bridge reports the child id
  through \`onStarted\` so \`started\` entries carry the real session id.
- \`WorkflowStore.journalDirectory\` validates the run id before building the
  session-owned path; the owner directory is never traversed by a caller path.
  \`WorkflowRegistry\` tracks active script runs to refuse a concurrent resume.

## Adaptation

- The recovered journal has an account-backed remote mirror used to restore a
  missing or partial local journal. This runtime is local-only, so a missing
  journal is refused with the local adaptation of the same message, and no
  remote restore is attempted. \`resumeFromRunId\` is exposed only when the
  workflow tool is constructed with session persistence.
- The recovered remote-session fields (\`remoteSessionId\`) are accepted and
  ignored on load; entries are otherwise validated exactly as \`Qr\`.
- Script runs and DAG runs share one owner directory; script journals live in
  the \`journals/\` subdirectory so existing snapshot listing and limits are
  unchanged.
- Named workflows, remote journal mirroring, reattachment and automatic effect
  replay remain out. Script text itself is not part of the key chain, exactly
  as in the recovered runtime: editing the script while keeping the same call
  sequence and options reuses cached results.

## Verification

\`workflow-script\` adds prefix reuse (including label insensitivity), changed
options rerunning only that call, started-without-result respawn, failed-call
non-caching, malformed-line skipping, and a tool-level persisted run plus
resume with one provider request. tsc 0, build 0, focused 64/64 (workflow,
agent-isolation, cli-gateway, migration-integration), notices 0, source index
unchanged, identity \`4c2f329b…\`.
`;
write('research/ports/W128-script-journal.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W128-01 ports the workflow script journal and \`resumeFromRunId\`. Each script run now owns a
\`journal.jsonl\` under the session workflow directory, with the recovered v2 chained key over the
previous key, the prompt and the execution options. A resumed run reuses completed agent() results
for the longest unchanged prefix, reruns a call that has a \`started\` entry but no \`failed\` entry,
reruns failed or skipped calls, and runs the first changed call and everything after it live.
Journal writes are best-effort and never fail the script. The remote journal mirror, named
workflows, reattachment and automatic effect replay remain out. tsc 0, build 0, focused 64/64,
notices 0, identity \`4c2f329b…\`. [W128 record](ports/W128-script-journal.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W128-01 workflow脚本journal/resume：S-1（先读源）：sn/Do/Hr/No/Qr chunk-hedqf2m1.js 20500-23000、缓存47494-48200、运行器83820、schema/预检/runId/Ir chunk-a7gk0710.js 59981/65391/69003/70009/73879。S-2（不臆造）：journal.jsonl行式条目、v2链式键sha256(前键\\0prompt\\0optionsJSON)、规范选项白名单与排序、结果/started/failed索引、跳过不可解析行、命中不spawn、started无failed重跑但后续仍可命中、首个miss后不再读缓存、null结果记failed不记result、失败/跳过不缓存、run id为wf_+UUID前12字符、活动运行拒绝、缺失journal拒绝。S-3（边界）：本地无远程镜像，缺失即拒绝；resumeFromRunId仅持久化工具暴露；remoteSessionId接受但忽略；journal位于owner目录journals/子目录；脚本正文不入键（与源一致）；命名工作流/镜像/重新挂接/效果重放仍开放。S-4（可测）：workflow-script新增4条（前缀复用与label不敏感、变更仅重跑该调用、started重跑而先前命中、失败不缓存与坏行跳过、工具级持久化运行+恢复+缺失拒绝）。S-5：无依赖变化。S-6：scriptSchema新增resumeFromRunId，persistent输入schema新增该字段，结果新增run_id；WorkflowStore新增journalDirectory，Registry新增journaling/journal路径/活动脚本运行跟踪。S-7：端口记录与证据JSON。验证：工作流家族29/29、聚焦64/64、tsc 0、build 0、notices 0、索引不变、身份4c2f329b…。
`);

replaceOnce('research/FEATURES.md',
  'the original script API is ported (W125: inline scripts; W126: scriptPath files opened with O_NOFOLLOW and inode/link/regular-file/size checks; pure-literal meta parser,',
  'the original script API is ported (W125: inline scripts; W126: scriptPath files opened with O_NOFOLLOW and inode/link/regular-file/size checks; W128: session-owned journal with chained prompt/options keys reuses the unchanged prefix on resumeFromRunId, reruns started-but-unfinished or failed calls and returns a run_id; pure-literal meta parser,');
replaceOnce('research/FEATURES.md',
  'reattachment, scriptPath/named workflows, journal/resume, automatic effect replay and agent({schema}) structured output remain out. ports/W04-crash-recovery.md, ports/W125-workflow-scripts.md |',
  'reattachment, named workflows, the remote journal mirror, automatic effect replay and agent({schema}) structured output remain out. ports/W04-crash-recovery.md, ports/W125-workflow-scripts.md, ports/W128-script-journal.md |');

replaceAll('research/CURRENT.md',
  '；W126补scriptPath文件加载（O_NOFOLLOW打开、ino==0/nlink>1拒链、仅常规文件、524,288字节上限、工作区相对/绝对解析、script与scriptPath恰好其一）；未移植：journal/resume、命名工作流、重新挂接、自动效果重放、agent({schema})结构化输出',
  '；W126补scriptPath文件加载（O_NOFOLLOW打开、ino==0/nlink>1拒链、仅常规文件、524,288字节上限、工作区相对/绝对解析、script与scriptPath恰好其一）；W128补journal/resume（会话自有journal.jsonl、v2链式键sha256(前键\\0prompt\\0optionsJSON)、已完成agent结果最长不变前缀复用、started未完成调用重跑而后续仍复用、失败/跳过不缓存、首个变更及其后现场运行、结果返回run_id、活动运行与缺失journal拒绝）；未移植：命名工作流、远程journal镜像、重新挂接、自动效果重放、agent({schema})结构化输出、disallowedTools/bashCommandClamp/stallMs',
  3);

const tsv = [
  ['2026-10-17T18:40:00Z', 'package', 'W128-01 workflow脚本journal/resume',
    'sn/Do/Hr/No/Qr 20500-23000、缓存47494-48200（chunk-hedqf2m1.js）；schema/预检/runId/Ir（chunk-a7gk0710.js 59981/65391/69003/70009/73879）',
    'v2链式键、最长不变前缀、started重跑、失败不缓存、wf_ runId、活动/缺失拒绝',
    'workflow-script新增4；工作流家族29/29；聚焦64/64；tsc 0；build 0'],
  ['2026-10-17T18:50:00Z', 'decision', 'W128-01 适配',
    '本地无远程镜像；resumeFromRunId仅持久化暴露；remoteSessionId忽略；journals/子目录；脚本正文不入键',
    'journal写入best-effort不失败；run_id加入结果',
    '无依赖变化'],
  ['2026-10-17T18:58:00Z', 'verification', 'W128-01 验收：聚焦64/64、notices 0、索引不变',
    'identity 4c2f329b…；全量/链本轮未重跑（用户中断全量）',
    '.audit/w128-01-focused.txt、.audit/w128-01-build.txt'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w128-runtime.tsv', tsv + '\n');

write('.audit/w128-runtime.todo.md', `# W128 runtime trail

## W128-01 acceptance (2026-10-17)

- [x] **Journal read.** Line entries, chained v2 key, canonical options,
  result/started/failed indexes, unparseable lines skipped.
- [x] **Cache read.** Hit returns without spawn; started-without-failed
  respawns while keeping later hits; first miss stops cache reads; null writes
  failed only.
- [x] **Resume read.** Run id shape, collision refusal, missing-journal
  refusal, local-only adaptation for the absent remote mirror.
- [x] **Tool wiring.** Journal under the owner workflow directory, launched
  entry, run_id in the result, onStarted child ids.
- [x] **Gates.** Workflow family 29/29, focused 64/64, tsc 0, build 0, notices
  0, source index unchanged, identity \`4c2f329b…\`.
- [ ] Full suite and plugin chain were not rerun this package (the full run was
  interrupted); the focused set covers every test that references
  \`workflow_run\`.
- [ ] Remaining C-8: named workflows, remote journal mirroring, reattachment,
  automatic effect replay, structured output, disallowedTools,
  bashCommandClamp, stallMs.
`);

const evidence = {
  schema: 'W128ScriptJournalEvidence.v1',
  package: 'W128-01 — Workflow script journal and resume',
  date: '2026-10-17',
  question: 'How does the recovered workflow script runtime journal agent calls and resume an interrupted run, and which parts can be ported locally?',
  answer: 'It appends line entries (launched/started/result/failed) to journal.jsonl, keyed by a v2 chain of sha256(previous key, prompt, canonical options). A resumed run reuses results for the unchanged prefix, respawns a call that started but never finished while still reusing later completed calls, and never reuses failed or skipped calls. The local port keeps those semantics, the run-id shape and the collision/missing-journal refusals; the account-backed remote mirror is absent and is replaced by an explicit local refusal.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    modules: {
      'extracted-v2/modules/chunk-hedqf2m1.js': [20500, 21490, 21965, 22270, 22680, 47494, 47753, 47913, 48046, 83820],
      'extracted-v2/modules/chunk-a7gk0710.js': [59981, 65391, 69003, 70009, 73879],
    },
    implementation: {
      'src/workflow-script.ts': { ranges: 'journal section and onAgent journal branch' },
      'src/workflow.ts': { ranges: 'runScript, registry journal methods' },
      'src/workflow-store.ts': { ranges: 'journalDirectory' },
    },
  },
  behavior: {
    journalFile: 'journal.jsonl',
    keyFormat: 'v2:sha256(previousKey \\0 prompt \\0 canonicalOptionsJSON)',
    canonicalOptionKeys: ['schema', 'model', 'effort', 'isolation', 'agentType', 'disallowedTools', 'bashCommandClamp'],
    reusesUnchangedPrefix: true,
    respawnsStartedWithoutResult: true,
    cachesFailedCalls: false,
    runIdPattern: '^wf_[0-9a-f]{8}-[0-9a-f]{3}$',
    refusesActiveRun: true,
    refusesMissingJournal: true,
    remoteMirrorPorted: false,
    journalMaxBytes: 2097152,
  },
  adaptations: [
    'The remote session journal mirror is absent; a missing local journal is refused instead of restored.',
    'resumeFromRunId is exposed only when the workflow tool is created with session persistence.',
    'Script journals live under the owner workflow directory in a journals/ subdirectory.',
    'Journal writes are best-effort and never fail the script, as the recovered runtime only warns.',
    'Script text is not part of the key chain, matching the recovered runtime.',
  ],
  changes: [
    { file: 'src/workflow-script.ts', change: 'journal entries, key, loader and cache branch', sha256: sha(read('src/workflow-script.ts')) },
    { file: 'src/workflow-store.ts', change: 'journalDirectory', sha256: sha(read('src/workflow-store.ts')) },
    { file: 'src/workflow.ts', change: 'resumeFromRunId, run ids, registry journal methods, onStarted bridge', sha256: sha(read('src/workflow.ts')) },
    { file: 'test/workflow-script.test.ts', change: 'journal and resume tests', sha256: sha(read('test/workflow-script.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-8 rows record W128', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'workflow row records W128', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W128-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W128-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '64/64 (workflow family, agent-isolation, cli-gateway, migration-integration)',
    workflowFamily: '29/29',
    build: 'exit 0',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '4c2f329b452cae54acdfc836873c2972c954cf5a57ed32de4dcd393e3c1da053',
    fullSuite: 'not rerun (interrupted); focused set covers every test referencing workflow_run',
    pluginChain: 'not rerun (unrelated to the workflow surface)',
  },
  residuals: [
    'C-8: named workflows remain out.',
    'C-8: the remote journal mirror and reattachment remain out.',
    'C-8: automatic effect replay remains out.',
    'C-8: agent({schema}) structured output, disallowedTools, bashCommandClamp and stallMs remain rejected explicitly.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-8 continues with named workflows or structured output, or the next ready C-area cluster from CURRENT.',
};
write('research/ports/W128-script-journal-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW128-01 ports the workflow script journal',
  'research/coding-standard.md': '\n2026-10-17 W128-01 ',
  'research/FEATURES.md': 'W128: session-owned journal with chained prompt/options keys',
  'research/CURRENT.md': { mark: 'W128补journal/resume', count: 3 },
  'research/ports/W128-script-journal.md': '# W128 — Workflow script journal and resume',
  '.audit/w128-runtime.todo.md': '\n## W128-01 acceptance',
};
for (const [path, expected] of Object.entries(marks)) {
  const { mark, count } = typeof expected === 'string' ? { mark: expected, count: 1 } : expected;
  const found = read(path).split(mark).length - 1;
  if (found !== count) throw new Error(`${path} holds ${found} entries for ${JSON.stringify(mark)}, expected ${count}`);
}
console.log('record ok');
