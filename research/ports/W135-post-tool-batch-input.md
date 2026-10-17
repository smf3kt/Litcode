# W135 — PostToolBatch input shape

C-6's remaining payload difference: the independent hook transport sent `tool_use_ids`, while
the recovered hook input schema and its caller send the resolved calls themselves. The
independent path now sends `tool_calls` with the source's per-call fields; the classic chain
already did.

## Source position

- `chunk-r2vtj1kh.js` [193602] `cK`: one call is `{tool_name, tool_input, tool_use_id,
  tool_response?}`; `dK`: the event input is the common hook fields plus
  `hook_event_name: 'PostToolBatch'` and `tool_calls: cK[]`.
- `chunk-5b2hxy2e.js` [123931,124000): the caller maps every resolved call to
  `{tool_name: R.name, tool_input: R.input, tool_use_id: R.id, tool_response: H.get(R.id)}`,
  where `H` is keyed by `tool_result.tool_use_id` over the batch's result messages, then runs
  the batch hooks once.

## Port

- `src/hooks.ts`: `HookPayload.tool_use_ids` is replaced by
  `tool_calls?: Array<{tool_name, tool_input, tool_use_id, tool_response?}>`; the dispatcher's
  existing payload spread serializes it onto stdin unchanged.
- `src/agent.ts`: the batch builds one `toolCalls` array from the resolved calls and results
  and passes it to both the independent `hook()` call and the classic chain event, so the two
  transports observe the same entries.

## Adaptations

- None in shape. The product's tool results carry the same content value the source reads
  from `tool_result` (`results[index].content`).
- The independent event keeps this product's ordered hook dispatch and blocking semantics;
  only the per-call input changed. `tool_use_ids` is no longer emitted.

## Verification

- `test/hooks.test.ts`: the payload case asserts the full `tool_calls` entry round-trips
  through stdin.
- `test/lifecycle.test.ts`: an agent run captures the independent hook stdin and asserts
  `hook_event_name`, the exact call entry with `tool_response`, and the absence of
  `tool_use_ids`.
- Focused 83/83 (hooks, lifecycle, classic batch), full 2238/2238, tsc 0, build 0, notices 0,
  identity `8066539f…`.
