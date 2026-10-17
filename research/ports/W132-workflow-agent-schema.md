# W132 — Workflow `agent({schema})` structured output

C-8's remaining schema-mode item. A workflow script can now ask a child for a JSON object:
the child gets the recovered `StructuredOutput` tool, its validated call ends the turn, and
`agent()` returns that object instead of the child summary. Invalid and unusable schemas are
refused before a child exists; a missing call and the retry cap report the source's messages.

## Source position

- `chunk-5wc3wh5m.js` [21672, ~22000) `ie`: the root lint. `type` must be `"object"`, with the
  exact message used here. [29524] `Ea = "StructuredOutput"`. [29842, ~30100) `me`: the tool's
  model-facing prompt (used as the API description), `maxResultSizeChars: 1e5`, and the call
  result `{data: "Structured output provided successfully", structured_output, endsTurn: true}`.
  [26712, ~27000) `Ffr` and [30896] `$ot = Je` are the strict-schema derivation and cached
  Ajv/lint compile; this runtime reuses its own bounded schema subset instead.
- `chunk-4t0s8gye.js` [812] `xhn = 5`: the structured-output retry cap.
- `chunk-hedqf2m1.js` [39103] `bs` (system note when a custom agent definition is used);
  [39488] `Ss` (the dedicated workflow-subagent prompt); [52202, ~53000) the schema branch:
  `$ot(schema)`, invalid/unusable refusal, the tool appended when the agent's list lacks `Ea`,
  and the system note; [63606] `MAX_STRUCTURED_OUTPUT_RETRIES`; [64059] `requiresStructuredOutput`;
  [64399] the `structured_output` attachment capture; [65184] the retry-cap error; [73056]
  `ups(A.structured, {reservedKeys:["webFetchSavedFiles"]})`; [73819] the
  `subagent completed without calling StructuredOutput (after in-conversation nudge)` error.
- `chunk-5b2hxy2e.js` [60792] `Da` (last real user turn) and [68150] the enforcement nudge
  `[structured-output-enforce] You MUST call the ${Ea} tool to complete this request. Call this tool now.`
- `chunk-sfn1dbxq.js` [823307] `Kro` (a tool's `prompt()` is the API description),
  [4422125] `N_` (a tool-result carrier is not a real user turn), [4506192] `Tts` (the last
  call's own result decides satisfaction).

## Port

- `src/structured-output.ts`: the tool name, prompt, success string, retry limit, nudge marker,
  system note (`bs`) and `formatSchemaIssues` (`Ze`: `${instancePath || "root"}: ${message}`),
  plus `compileStructuredOutputSchema`, which enforces the source's object-root lint before the
  existing bounded compiler. `inspectJson` now accepts a plain record or array from another
  realm (the workflow VM's `JSON.parse` and `args`), while still rejecting class instances and
  reading only own enumerable data properties.
- `src/tools.ts`: `endsTurn?: boolean`.
- `src/agent.ts`: a successful `endsTurn` tool result finishes the turn through the normal
  `finishWithHooks('end_turn')` path; `requiredTool` ports `Da`/`Tts`/the nudge, skipping
  tool-result carriers and the product's meta retry notice, with one nudge per real user turn.
- `src/agent-registry.ts`: `structured_schema` on a launch, compiled before the capacity check;
  the tool is appended after mode/type filtering (replacing a same-name entry, because this
  runtime's lists hold definitions rather than a name pool); the note extends the child system
  prompt; validation errors are tool errors; attempts cap at 5; the descriptor gains
  `structured_output` and `structured_error`.
- `src/workflow-script.ts`: `schema` leaves the unsupported list; it is validated before the
  journal key and spawn, with the source's distinct unusable-root and invalid-schema texts; the
  bridge result union gains `{structured}`; the script sees the object and the journal stores
  that script-visible value, so resume returns the same shape.
- `src/workflow.ts`: passes `structured_schema` and returns the object, the cap message, or the
  source's completed-without-call message.

## Adaptations

- The product has one shared child system prompt. The source appends `bs` to a custom agent
  definition and replaces the default workflow-subagent prompt with `Ss`; this port always
  appends `bs`, the structurally matching note for a fixed prompt.
- `ups` reserved-key stripping and its pattern scanner are not ported. The product has no
  `webFetchSavedFiles` harness record to protect, and the scanner belongs to a separate
  subagent-output security subsystem; the validated object is returned unchanged.
- The source aborts the model stream at the fifth failed call. This runtime has no mid-stream
  abort hook there, so the fifth call returns the cap error as its tool result and every later
  call is refused; the workflow reports the same cap failure.
- Full Ajv compilation is replaced by the existing bounded JSON Schema subset; a schema using a
  keyword outside that subset refuses with `received an invalid JSON Schema`.

## Verification

`test/workflow-script.test.ts` covers root refusal, unsupported-keyword refusal and schema
pass-through. `test/agent-registry.test.ts` covers the endsTurn success path (one model call,
no re-invoke), the validation-error and nudge path, and the captured object.
`test/workflow.test.ts` covers the whole path from `workflow_run` through the script and the
registry back to the script result.

Results: focused 73/73 (workflow-script, agent-registry, workflow), full 2223/2223, tsc 0,
build 0, notices 0, `smoke:workflow-resume` and `smoke:workflow-cli` passed, identity
`eaeec9c8…`.

## Residuals

- Named workflows, remote journal mirror, reattach, automatic effect replay,
  `disallowedTools`, `bashCommandClamp` and `stallMs` remain unported.
- The `ups` pattern scanner and the `webFetchSavedFiles` reserved key are not ported, as above.
- Cross-realm schema acceptance is covered by the workflow tests; nested class-instance
  schemas remain rejected by inspection.
