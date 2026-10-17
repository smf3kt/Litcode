# W88 — MessageDisplay payload and display rewrite

## Source position

`zir` (chunk-sfn1dbxq.js, UTF-16 [2936136,2936500)) builds MessageDisplay as
`{turn_id, message_id, index, final, delta}`. The completed-message path
`WHo` (chunk-6ejn7q9s.js offset 100801) raises one final delta with
`index: 0` and reads `hookSpecificOutput.displayContent`; display content
replaces the delta on screen only, while the stored message and the model view
are untouched (schema description in chunk-5s0t90hn.js; output processing at
chunk-sfn1dbxq.js offset 2967137).

## Port

The agent raises MessageDisplay with a generated `message_id`, the turn's
uuid, `index: 0`, `final: true` and the completed text as `delta`, matching
the completed-message call shape. `HookResult.displayContent` accepts the
matching `hookSpecificOutput.displayContent`; the turn's displayed text becomes
that value while the appended session message keeps the original content.
Empty text skips the raise, as `WHo` does.

## Adaptation

The product does not rewrite per-token deltas, so the whole completed text is
the single final delta. Streamed text events already emitted during the
completion keep the original text; the rewrite applies to the turn result that
the runtime reports and displays afterwards.

## Verification

`agent-lifecycle` 32/32: the hook receives the four delta fields with
`turn_id`/`message_id` uuids, `delta: "original text"`; returning
`displayContent: "rewritten display"` makes the run result that text while the
session message still contains only the original. tsc 0; build 0; full
2,117/2,117; chain 767/767; notices 0; source index unchanged; identity
`9088606a…`.
