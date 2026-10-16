import fs from 'node:fs';

const edits = [
  {
    file: 'research/CURRENT.md',
    anchor: '| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-15最新**：W45-16已落地（',
    line: '| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-15最新**：W45-17已落地（`classic.PostToolBatch` 的产品调用点：一批工具跑完后按源自己的形状 raise 一次，并按源自己的终局规则丢弃并记录 block）。本包**不新增搬运**——W45-16 已含整条 raise，故源侧的 `Hkn`（chunk-sfn1dbxq.js [3062957,3063491) 534 单位：注册表门 → hook input `{hook_event_name:"PostToolBatch", tool_calls}` → `KT`）里，本产品具备的是 raise，配置钩子那层是 ./hooks.ts；批内条目就是源调用者自己构造的 `{tool_name, tool_input, tool_use_id, tool_response}`（chunk-5b2hxy2e.js [123669,124114)），且 `Hkn` **不带**单个事件才有的 `_X` 工具别名展开，故批输入只有 `tool_calls`。同一条调用者给出规则与原句：`if(N.blockingError||N.preventContinuation) t("[end-turn] PostToolBatch block discarded (turn ended by tool result, no model re-invoke): …")`——回合已由工具结果终结、不会再有模型回合，故 block 只记录不施加。测量：无模块挂钩时门关且整批不记录；挂钩后一次批的两次调用按序成为两条 `tool_calls` 条目并带各自结果，`additionalContexts` 走原生 batch 钩子同一条 `Hook context:` 消息；block 不终止回合（`run` 仍返回 `end_turn`），尾因读数 `preventContinuation`（源的兜底链 `blockingError?.blockingError ?? stopReason ?? "preventContinuation"` 在 `{block}` 答案上前两者皆空，属源行为非自造默认）。事件名现以 `CLASSIC_POST_TOOL_USE`/`CLASSIC_POST_TOOL_USE_FAILURE`/`CLASSIC_POST_TOOL_BATCH` 收在 src/plugin-chain-classic-raise.ts。check/build/notices、21 计划拷贝核验 passed true（未新增）、专项 3/3、全量 1314/1314、十一个编译驱动 exit 0（身份 96183297…）。上一包 W45-16 已落地（',
  },
  {
    file: 'research/FEATURES.md',
    anchor: 'ports/W45-classic-raise-evidence.json. Q-088 narrows to ',
    tail: '`classic.PostToolBatch`, `classic.PermissionRequest` and `classic.PermissionDenied` (legal names, raise available, no call site yet) and the `ui.`/`env.`/`state.` value events, which are not classic events and still have no raise at all |',
    line: 'ports/W45-classic-raise-evidence.json. W45-17 then gave `classic.PostToolBatch` its call site with no new copy at all: the source\'s own batch site is `Hkn` (chunk-sfn1dbxq.js [3062957,3063491), hook input `{hook_event_name: "PostToolBatch", tool_calls}` with `{tool_name, tool_input, tool_use_id, tool_response}` entries from its caller at chunk-5b2hxy2e.js [123669,124114)), and that caller also carries the rule the product now follows — a batch block is discarded and logged with the source\'s own sentence once the turn has ended by a tool result, because no model re-invoke follows. The event is raised next to the native `PostToolBatch` hook, its contexts ride that hook\'s context message, and unlike the single events the batch input carries no `_X` tool aliases. Measured and asserted: the input\'s key set, the gate open only while a module\'s pattern names the event, one batch of two calls reaching the hook as two ordered entries with their own results, the context message, and the discard line with `preventContinuation` as the source\'s own fallback. check/build/notices pass, the 21 copy plans are unchanged and still byte-identical, the new regression is 3/3, full 1,314/1,314, and the eleventh compiled driver `.audit/w45-17-compiled.mjs` prints `W45PostToolBatchCompiled.v1` against `dist/`; ports/W45-classic-batch-evidence.json. Q-088 narrows to `classic.PermissionRequest` and `classic.PermissionDenied` (raised by the source\'s permission layer and consumed as `permissionRequestResult`/`retry`, no call site here yet) and the `ui.`/`env.`/`state.` value events, which are not classic events and still have no raise at all |',
  },
  {
    file: '.audit/w45-runtime.todo.md',
    anchor: null,
    append: `
## W45-17 package acceptance (2026-10-15)

- [x] **Source first.** Read the source's own batch site before touching anything: \`Hkn\` chunk-sfn1dbxq.js [3062957,3063491) and its caller's entry construction and discard rule at chunk-5b2hxy2e.js [123669,124114), plus the neighbouring \`Okn\`/\`P9r\`/\`I9r\`/\`dze\` sites for contrast (\`_X\` tool aliases are on the single events only).
- [x] **Skill/tool selection.** The repo's S-7 reconnaissance plus direct reads and its copy generator match this recovered-text task; \`how\`/\`architect\` stay skipped with the recorded reason, and no MCP tool fits (no binary, capture or network observation is involved).
- [x] **Copy only what is missing.** Nothing was missing: W45-16's copy already holds \`fe\`/\`znr\`/\`h7n\` and the seam, so the package is one call site, one rule and their regressions — recorded as such rather than re-copied.
- [x] **Port the rule, not a paraphrase.** The discard line uses the source's own sentence and its own fallback chain (\`blockingError?.blockingError ?? stopReason ?? "preventContinuation"\`), which is why a \`{block}\` answer logs \`preventContinuation\`.
- [x] **Keep the names in one place.** \`CLASSIC_POST_TOOL_USE\`, \`CLASSIC_POST_TOOL_USE_FAILURE\` and \`CLASSIC_POST_TOOL_BATCH\` now live in \`src/plugin-chain-classic-raise.ts\` and the tool path uses them.
- [x] **Measure before asserting.** The hook input's key set, both gate states, the two-entry batch as the hook sees it, the context message and the discard line were read off the running product before the assertions were written.
- [x] **0-3 necessary regressions.** Three focused cases and one compiled driver over \`dist/\` covering the input/gate, the batch as the hook sees it, and the discard rule.
- [x] **Verify on the real artifact.** \`.audit/w45-17-compiled.mjs\` prints \`W45PostToolBatchCompiled.v1\`; the ten sibling drivers still print theirs and all eleven exit 0.
- [x] **Bind identity and update the indexes.** Identity \`96183297…\` (inputs 193c4f39 / 297, validation 73286c90 / 117, build 060d2531 / 209); W45-chain-runner.md, W45-classic-batch-evidence.json, CURRENT, FEATURES, STATUS, question.md (Q-088 narrowed again), coding-standard, .audit.
`,
  },
];

for (const edit of edits) {
  const text = fs.readFileSync(edit.file, 'utf8');
  if (edit.append) {
    if (text.includes('## W45-17 package acceptance')) { console.log(edit.file, 'already present'); continue; }
    fs.writeFileSync(edit.file, text + edit.append);
    console.log(edit.file, 'appended');
    continue;
  }
  const index = text.indexOf(edit.anchor);
  if (index < 0) throw new Error(`anchor not found in ${edit.file}`);
  if (text.includes('W45-17')) { console.log(edit.file, 'already mentions W45-17'); continue; }
  fs.writeFileSync(edit.file, text.slice(0, index) + edit.line + text.slice(index + edit.anchor.length));
  console.log(edit.file, 'updated');
}
