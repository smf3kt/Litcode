# W125 — Workflow script API in a hardened vm sandbox

C-8's second item was "no original script API". The recovered `workflow_run`
accepts a JavaScript script whose first statement is a pure-literal `meta`
export; this package ports the parser, the await rewriting, the compiler
wrapper, the sandbox and the host hooks. Journal/resume, `scriptPath`,
named-workflow resolution, reattachment and automatic effect replay stay out
and are recorded below.

## Source position

- Meta parser `YS` (chunk-rk6tjv7j.js offset 3670): bounded source, first
  statement must be `export const meta = {…}`, pure-literal evaluator with
  reserved keys (`__proto__`, `constructor`, `prototype`), `name` and
  `description` non-empty, phases filtered by shape, body sliced after the
  statement.
- Transform `Lr` (chunk-hedqf2m1.js 15198): wraps the body in a strict async
  arrow, rejects `__wRg$*` identifiers, `with`, `import()` and
  `await using`, and rewrites awaits, async returns, yields and the right side
  of `for await` through `__wRg$((…))` / `__wRg$a((…))`.
- Compiler `qie` (16762): the async-iterator bridge and
  `new vm.Script(…, { filename: 'workflow.js', importModuleDynamically: throws })`.
- Context `lXn` (81501): `vm.createContext` with
  `codeGeneration: { strings: false, wasm: false }`, the Date/Math shim
  `Sn`/`Or` (13422), intrinsic hardening `q3e`
  (chunk-nyce03br.js 128850), the non-writable `__wRg$resolve` binding
  `Tn`, boundary helpers `pQt` 135345, `fQt` 135434, `K3e` 136171,
  `cwr` 141515, `dwr` 141891, error projection `PFe` 140054 /
  `rRe` 139055 / `Q0` 140422 / `IFe` 140571, the copy generator `ws`
  143459 with `Lx` 142739 and `$x` 142992, and the hook builder `ir`
  (chunk-hedqf2m1.js 40325).
- Hooks: `parallel` 78944, `pipeline` 79758, `log` 80636, `phase`
  40325; `agent` failures record `[label] failed: …` and return null
  (71400); the runner `lr` 83352 settles the script promise, rejects a
  function result, sanitizes and JSON-validates the value, and returns
  `{ result, agentCount, logs, failures, durationMs }` (84200).
- Caps: 4096 array elements and 100000 nesting levels
  (chunk-nyce03br.js `hR`/`PQt`), 524288 script bytes (`wE`,
  chunk-2bcyxj9q.js), 30000 ms synchronous timeout (`XBt`), 1000 agents
  (`or`), 1000 collected log lines (`As`).

## Port

- `src/workflow-script.ts` contains the parser, transform, compiler wrapper
  and runner. The Date/Math errors, hardening body, copy generator, wrapper
  and error projection are ported with the source text.
- `parallel` snapshots its thunks, rejects non-functions before running any,
  converts every failure to null while recording `parallel[i] failed: …`,
  and clones its result back into the sandbox. `pipeline` does the same per
  item, passes `(previous, item, index)`, and stops an item's chain on null.
- `agent` maps to `AgentRegistry.launch` with `background: true`, waits on
  the child view, and returns its bounded summary. A failed or cancelled child
  becomes `{ failure }` in the bridge, which the runner records as
  `[label] failed: …` and exposes to the script as null.
- `workflow_run` accepts either `tasks` (declarative DAG) or `script` +
  `args`. The script result is `{ result, agent_count, logs, failures,
  phases, duration_ms, error? }`, capped by the same output budget as the DAG.
- `phase()` seeds from `meta.phases` and records first-use order; the result
  carries the titles because this runtime has no progress tree. `log()` and
  `console.*` append to the bounded log list; `console.*` formats values
  through the in-context copy and JSON stringifier, `log()`/phase() render
  non-primitives as `[object]` as `Y3e` does.
- `budget` is `{ total: null, spent: () => 0, remaining: () => Infinity }`;
  timers are tracked and cleared on abort; `args` is JSON-round-tripped into
  the context.

## Not ported in this package

- `scriptPath`, `name` and `resumeFromRunId` inputs; named workflows and
  `workflow()` nesting (the global exists and rejects with a clear message).
- Journal/resume replay: no agent result cache, no attempt log, no reattachment
  of running children and no automatic effect replay.
- `agent({schema})` structured output, `disallowedTools`,
  `bashCommandClamp` and `stallMs`; each rejects explicitly.
- Progress events, safety classification, rate-limit waiting and the
  per-agent stall watchdog.

## Verification

`workflow-script` pins the meta contract, the transform (async return,
async arrow expression, for-await over an async generator), the sandbox
(Date, Math.random, strings-disallowed Function, absent process/require,
import(), reserved identifiers, strict-mode with), agent/parallel/pipeline
semantics including failure recording and nulls, JSON-safe logs and copies,
the function-result rejection, option rejections, abort, and an end-to-end
`workflow_run` that spawns two children through the registry and reports a
failed child as null. Workflow family 42/42, tsc 0, build 0, full
2,203/2,203, chain 768/768, notices regenerated and checked, source index
unchanged at 75 chunks / 323,525 units, identity `3f771f63…`.
