// W125-01 record: original workflow script API in the vm sandbox.
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

const note = `# W125 — Workflow script API in a hardened vm sandbox

C-8's second item was "no original script API". The recovered \`workflow_run\`
accepts a JavaScript script whose first statement is a pure-literal \`meta\`
export; this package ports the parser, the await rewriting, the compiler
wrapper, the sandbox and the host hooks. Journal/resume, \`scriptPath\`,
named-workflow resolution, reattachment and automatic effect replay stay out
and are recorded below.

## Source position

- Meta parser \`YS\` (chunk-rk6tjv7j.js offset 3670): bounded source, first
  statement must be \`export const meta = {…}\`, pure-literal evaluator with
  reserved keys (\`__proto__\`, \`constructor\`, \`prototype\`), \`name\` and
  \`description\` non-empty, phases filtered by shape, body sliced after the
  statement.
- Transform \`Lr\` (chunk-hedqf2m1.js 15198): wraps the body in a strict async
  arrow, rejects \`__wRg$*\` identifiers, \`with\`, \`import()\` and
  \`await using\`, and rewrites awaits, async returns, yields and the right side
  of \`for await\` through \`__wRg$((…))\` / \`__wRg$a((…))\`.
- Compiler \`qie\` (16762): the async-iterator bridge and
  \`new vm.Script(…, { filename: 'workflow.js', importModuleDynamically: throws })\`.
- Context \`lXn\` (81501): \`vm.createContext\` with
  \`codeGeneration: { strings: false, wasm: false }\`, the Date/Math shim
  \`Sn\`/\`Or\` (13422), intrinsic hardening \`q3e\`
  (chunk-nyce03br.js 128850), the non-writable \`__wRg$resolve\` binding
  \`Tn\`, boundary helpers \`pQt\` 135345, \`fQt\` 135434, \`K3e\` 136171,
  \`cwr\` 141515, \`dwr\` 141891, error projection \`PFe\` 140054 /
  \`rRe\` 139055 / \`Q0\` 140422 / \`IFe\` 140571, the copy generator \`ws\`
  143459 with \`Lx\` 142739 and \`$x\` 142992, and the hook builder \`ir\`
  (chunk-hedqf2m1.js 40325).
- Hooks: \`parallel\` 78944, \`pipeline\` 79758, \`log\` 80636, \`phase\`
  40325; \`agent\` failures record \`[label] failed: …\` and return null
  (71400); the runner \`lr\` 83352 settles the script promise, rejects a
  function result, sanitizes and JSON-validates the value, and returns
  \`{ result, agentCount, logs, failures, durationMs }\` (84200).
- Caps: 4096 array elements and 100000 nesting levels
  (chunk-nyce03br.js \`hR\`/\`PQt\`), 524288 script bytes (\`wE\`,
  chunk-2bcyxj9q.js), 30000 ms synchronous timeout (\`XBt\`), 1000 agents
  (\`or\`), 1000 collected log lines (\`As\`).

## Port

- \`src/workflow-script.ts\` contains the parser, transform, compiler wrapper
  and runner. The Date/Math errors, hardening body, copy generator, wrapper
  and error projection are ported with the source text.
- \`parallel\` snapshots its thunks, rejects non-functions before running any,
  converts every failure to null while recording \`parallel[i] failed: …\`,
  and clones its result back into the sandbox. \`pipeline\` does the same per
  item, passes \`(previous, item, index)\`, and stops an item's chain on null.
- \`agent\` maps to \`AgentRegistry.launch\` with \`background: true\`, waits on
  the child view, and returns its bounded summary. A failed or cancelled child
  becomes \`{ failure }\` in the bridge, which the runner records as
  \`[label] failed: …\` and exposes to the script as null.
- \`workflow_run\` accepts either \`tasks\` (declarative DAG) or \`script\` +
  \`args\`. The script result is \`{ result, agent_count, logs, failures,
  phases, duration_ms, error? }\`, capped by the same output budget as the DAG.
- \`phase()\` seeds from \`meta.phases\` and records first-use order; the result
  carries the titles because this runtime has no progress tree. \`log()\` and
  \`console.*\` append to the bounded log list; \`console.*\` formats values
  through the in-context copy and JSON stringifier, \`log()\`/phase() render
  non-primitives as \`[object]\` as \`Y3e\` does.
- \`budget\` is \`{ total: null, spent: () => 0, remaining: () => Infinity }\`;
  timers are tracked and cleared on abort; \`args\` is JSON-round-tripped into
  the context.

## Not ported in this package

- \`scriptPath\`, \`name\` and \`resumeFromRunId\` inputs; named workflows and
  \`workflow()\` nesting (the global exists and rejects with a clear message).
- Journal/resume replay: no agent result cache, no attempt log, no reattachment
  of running children and no automatic effect replay.
- \`agent({schema})\` structured output, \`disallowedTools\`,
  \`bashCommandClamp\` and \`stallMs\`; each rejects explicitly.
- Progress events, safety classification, rate-limit waiting and the
  per-agent stall watchdog.

## Verification

\`workflow-script\` pins the meta contract, the transform (async return,
async arrow expression, for-await over an async generator), the sandbox
(Date, Math.random, strings-disallowed Function, absent process/require,
import(), reserved identifiers, strict-mode with), agent/parallel/pipeline
semantics including failure recording and nulls, JSON-safe logs and copies,
the function-result rejection, option rejections, abort, and an end-to-end
\`workflow_run\` that spawns two children through the registry and reports a
failed child as null. Workflow family 42/42, tsc 0, build 0, full
2,203/2,203, chain 768/768, notices regenerated and checked, source index
unchanged at 75 chunks / 323,525 units, identity \`3f771f63…\`.
`;
write('research/ports/W125-workflow-scripts.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W125-01 ports the original workflow script API. \`workflow_run\` now accepts \`script\` + \`args\`
beside \`tasks\`: the first statement must be a pure-literal \`meta\` export, the body is
await/yield/for-await rewritten, and it runs in a vm context with code generation disabled,
Date/Math.random removed, intrinsics frozen and a copy generator at the boundary. Scripts call
agent/parallel/pipeline/phase/log/console/budget/timers/args; agents spawn through the same
AgentRegistry, a failed child records \`[label] failed: …\` and returns null, and the result is
\`{ result, agent_count, logs, failures, phases, duration_ms, error? }\`. Journal/resume,
\`scriptPath\`/named workflows, reattachment, automatic effect replay and \`agent({schema})\`
remain out. Workflow family 42/42, tsc 0, build 0, full 2,203/2,203, chain 768/768, notices
checked, index unchanged, identity \`3f771f63…\`.
[W125 record](ports/W125-workflow-scripts.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W125-01 工作流脚本运行时：S-1（先读源）：YS 3670（chunk-rk6tjv7j.js）、Lr 15198、qie 16762、Or/Sn 13422/14367、iXn 14418、lXn 81501、ir 40325、parallel 78944、pipeline 79758、log 80636、lr 83352、失败合同71400（chunk-hedqf2m1.js）、q3e 128850、PFe 140054、rRe 139055、Q0 140422、IFe 140571、K3e 136171、pQt 135345、fQt 135434、cwr 141515、dwr 141891、ws 143459、Lx 142739、$x 142992（chunk-nyce03br.js）。S-2（不臆造）：元数据纯字面量/保留键/首语句、await与async迭代改写、import()拒绝、硬化内建、4096/100000拷贝上限、parallel/pipeline失败转null并记录、agent失败记日志返回null、函数结果拒绝、JSON校验。S-3（边界）：scriptPath/命名workflow/journal/resume/重新挂接/自动重放/agent({schema})未移植并以明确错误拒绝；进度树、安全分类、限流等待、stall看门狗无对应物。S-4（可测）：workflow-script新增9条（解析、变换、沙箱、并行/流水线、日志与拷贝、函数结果、选项拒绝、abort、注册表端到端）。S-5：新增运行依赖acorn-walk 8.3.4，acorn 8.15.0由dev转dependencies，notices已重生成并校验。S-6：workflow_run输入新增script/args并保持tasks互斥语义；输出为有界JSON。S-7：端口记录与证据JSON。验证：工作流家族42/42、tsc 0、build 0、全量2,203/2,203、链768/768、notices 0、索引75 chunks/323,525 units不变、身份3f771f63…。
`);

replaceOnce('research/FEATURES.md',
  'Old interruptedchildlock preserved; no reattachment/originalscriptAPI or automaticeffectreplay. ports/W04-crash-recovery.md',
  'Old interruptedchildlock preserved; the original script API is ported (W125: pure-literal meta parser, await/async-iteration rewriting, vm sandbox with code generation disabled and intrinsics frozen, agent/parallel/pipeline/phase/log/console/budget/timers/args, bounded logs/failures/phases and child failures as null); reattachment, scriptPath/named workflows, journal/resume, automatic effect replay and agent({schema}) structured output remain out. ports/W04-crash-recovery.md, ports/W125-workflow-scripts.md');

replaceAll('research/CURRENT.md',
  '| C-8 | Workflow 引擎 | 无重新挂接、原文脚本 API、自动效果重放 | Workflow engine |',
  '| C-8 | Workflow 引擎 | **2026-10-17最新**：W125交付原文脚本API——元数据解析（`YS`：首语句export const meta、纯字面量、保留键、phases过滤、524,288字节上限）、`Lr`变换（await/async return/yield/for-await外包、保留标识符/with/import()/await using拒绝）、`qie`编译包装（严格模式、async-iterator桥、importModuleDynamically拒绝）、硬化VM（Date.now/new Date与Math.random禁用、内建冻结、then删除、codeGeneration strings/wasm关闭、Q0/IFe错误投影）、`ws`拷贝生成器（4096数组/100000深度上限、函数丢弃、__proto__跳过、环保持）、agent/parallel/pipeline/phase/log/console/budget/setTimeout/clearTimeout/args/空workflow()；agent走AgentRegistry，失败按`kr`合同记`[label] failed`并返回null；结果含result/agent_count/logs/failures/phases/duration_ms/error；未移植：journal/resume、scriptPath/命名工作流、重新挂接、自动效果重放、agent({schema})结构化输出 | Workflow engine |',
  3);

const tsv = [
  ['2026-10-17T16:30:00Z', 'package', 'W125-01 工作流脚本运行时',
    'YS 3670（chunk-rk6tjv7j.js）；Lr 15198、qie 16762、lXn 81501、ir 40325、parallel 78944、pipeline 79758、lr 83352、失败71400（chunk-hedqf2m1.js）；q3e 128850、ws 143459、PFe/IFe/Q0（chunk-nyce03br.js）',
    '元数据/变换/包装/硬化VM/拷贝边界；parallel与pipeline失败转null并记录；agent失败记日志返回null；函数结果拒绝',
    'workflow-script新增9；tsc 0；build 0'],
  ['2026-10-17T16:40:00Z', 'decision', 'W125-01 边界',
    'scriptPath/命名工作流/journal/resume/重新挂接/自动重放/agent({schema})未移植并明确拒绝；进度树/安全分类/限流/stall无对应物',
    'acorn 8.15.0转dependencies并新增acorn-walk 8.3.4；notices重生成',
    '.audit/w125-wrapper.txt（qie包装原文）'],
  ['2026-10-17T16:52:00Z', 'verification', 'W125-01 验收：工作流家族42/42、tsc 0、build 0、全量2,203/2,203、链768/768',
    'notices --check 0；source index 75 chunks/323,525 units不变；identity 3f771f63…',
    '.audit/w125-full.txt、.audit/w125-chain.txt'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w125-runtime.tsv', tsv + '\n');

write('.audit/w125-runtime.todo.md', `# W125 runtime trail

## W125-01 acceptance (2026-10-17)

- [x] **Parser.** First pure-literal \`meta\` export, reserved keys, phase
  filtering, 524,288-byte cap and acorn caret errors.
- [x] **Transform.** Strict async wrapper, reserved identifiers, \`with\`,
  \`import()\`, \`await using\`, and await/return/yield/for-await rewriting.
- [x] **Compiler.** Async-iterator bridge, \`workflow.js\` script with dynamic
  import rejected.
- [x] **Sandbox.** Date/Math.random disabled, intrinsics frozen, code
  generation disabled, \`process\`/\`require\` absent, host errors projected.
- [x] **Hooks.** agent through the registry, parallel/pipeline failure
  semantics, phase/log/console/budget/timers/args, bounded copies.
- [x] **Contracts.** Function results rejected; failed children log and return
  null; result shape and output cap.
- [x] **Gates.** Workflow family 42/42, tsc 0, build 0, full 2,203/2,203,
  chain 768/768, notices 0, index unchanged, identity \`3f771f63…\`.
- [ ] Remaining C-8: journal/resume, scriptPath/named workflows, reattachment,
  automatic effect replay, structured output.
`);

const evidence = {
  schema: 'W125WorkflowScriptsEvidence.v1',
  package: 'W125-01 — Workflow script API in a hardened vm sandbox',
  date: '2026-10-17',
  question: 'How does the recovered workflow tool execute an original JavaScript script, and what sandbox and agent semantics does it guarantee?',
  answer: 'The script starts with a pure-literal meta export. The body is rewritten so awaits, async returns, yields and for-await cross a promise-aware bridge, then compiled into a workflow.js vm script. The context disables code generation, removes time and randomness, freezes intrinsics and copies values across the boundary with array/depth caps. agent() spawns a child and returns its summary, or null after recording a terminal failure; parallel() and pipeline() convert failures to null and record them; the result is sanitized and JSON-validated.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    modules: {
      'extracted-v2/modules/chunk-rk6tjv7j.js': [3670],
      'extracted-v2/modules/chunk-hedqf2m1.js': [13119, 13422, 14367, 14418, 15198, 16762, 40325, 71400, 78944, 79758, 80636, 81501, 83352, 84200],
      'extracted-v2/modules/chunk-nyce03br.js': [128850, 135345, 135434, 136171, 139055, 140054, 140422, 140571, 140732, 141515, 141891, 142739, 142992, 143459],
    },
    implementation: { 'src/workflow-script.ts': { ranges: '1-931' }, 'src/workflow.ts': { ranges: 'createWorkflowTools' } },
  },
  behavior: {
    metaMustBeFirstPureLiteral: true,
    reservedMetaKeys: ['__proto__', 'constructor', 'prototype'],
    scriptByteCap: 524288,
    syncTimeoutMs: 30000,
    awaitAndAsyncIterationRewritten: true,
    dynamicImportRejected: true,
    codeGenerationStrings: false,
    codeGenerationWasm: false,
    dateNowDisabled: true,
    mathRandomDisabled: true,
    intrinsicsFrozen: true,
    globalThenRemoved: true,
    arrayLengthCap: 4096,
    depthCap: 100000,
    functionsDroppedInCopies: true,
    protoKeysSkipped: true,
    cyclesPreserved: true,
    agentCap: 1000,
    logCap: 1000,
    failedChildIsNull: true,
    functionResultRejected: true,
    resultJsonValidated: true,
  },
  adaptations: [
    'The recovered runtime resolves named workflows from account storage; this runtime exposes workflow() and rejects because no saved-workflow registry exists.',
    'No progress tree exists here; phase titles are returned in the result and logs are returned directly.',
    'The bridge maps agent options to the local AgentRegistry (model/effort/isolation:worktree/agentType); schema, disallowedTools, bashCommandClamp and stallMs are rejected explicitly.',
    'A failed child returns { failure } to the runner, which records [label] failed and yields null to the script, matching the recovered kr contract.',
    'Journal/resume, scriptPath, reattachment, automatic effect replay, safety classification, rate-limit waiting and the stall watchdog are not ported.',
  ],
  changes: [
    { file: 'src/workflow-script.ts', change: 'parser, transform, compiler, sandbox, hooks and runner', sha256: sha(read('src/workflow-script.ts')) },
    { file: 'src/workflow.ts', change: 'script input, registry bridge and tool description', sha256: sha(read('src/workflow.ts')) },
    { file: 'test/workflow-script.test.ts', change: 'nine script runtime tests', sha256: sha(read('test/workflow-script.test.ts')) },
    { file: 'package.json', change: 'acorn dependency and acorn-walk', sha256: sha(read('package.json')) },
    { file: 'package-lock.json', change: 'locked dependency graph', sha256: sha(read('package-lock.json')) },
    { file: 'THIRD_PARTY_NOTICES.txt', change: 'regenerated', sha256: sha(read('THIRD_PARTY_NOTICES.txt')) },
    { file: 'research/ports/dependency-notices.json', change: 'regenerated', sha256: sha(read('research/ports/dependency-notices.json')) },
    { file: 'research/CURRENT.md', change: 'three C-8 rows record W125', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'workflow engine row records W125', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W125-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W125-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '42/42 (workflow, workflow-resume, workflow-script, cli-gateway, agent-isolation)',
    build: 'exit 0',
    full: '2,203/2,203',
    chain: '768/768',
    notices: 'regenerated then --check exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '3f771f63b2d75d27bb63cd9c969f7ee55c6c2391ee4ed87a1c07604903be8271',
  },
  residuals: [
    'C-8: journal/resume replay, scriptPath and named-workflow resolution, reattachment and automatic effect replay remain out.',
    'C-8: agent({schema}) structured output, disallowedTools, bashCommandClamp and stallMs are rejected explicitly.',
    'C-8: progress events, safety classification, usage-limit waiting and the per-agent stall watchdog have no counterpart in this runtime.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-8 continues with journal/resume and scriptPath, or the next ready C-area cluster from CURRENT.',
};
write('research/ports/W125-workflow-scripts-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW125-01 ports the original workflow script API',
  'research/coding-standard.md': '\n2026-10-17 W125-01 ',
  'research/FEATURES.md': 'the original script API is ported (W125:',
  'research/CURRENT.md': { mark: 'W125交付原文脚本API', count: 3 },
  'research/ports/W125-workflow-scripts.md': '# W125 — Workflow script API in a hardened vm sandbox',
  '.audit/w125-runtime.todo.md': '\n## W125-01 acceptance',
};
for (const [path, expected] of Object.entries(marks)) {
  const { mark, count } = typeof expected === 'string' ? { mark: expected, count: 1 } : expected;
  const found = read(path).split(mark).length - 1;
  if (found !== count) throw new Error(`${path} holds ${found} entries for ${JSON.stringify(mark)}, expected ${count}`);
}
console.log('record ok');
