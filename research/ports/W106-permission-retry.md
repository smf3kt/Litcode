# W106 — PermissionDenied retry hint

## Source position

The PermissionDenied output schema is `hookSpecificOutput: {hookEventName:
"PermissionDenied", retry?: boolean}` (chunk-n3ykh62m.js [395412,395472)).
The raise is gated on `decisionReason?.type === "classifier" &&
decisionReason.classifier === "auto-mode"` (chunk-sfn1dbxq.js 2288685); the
runner loops the hook answers and any truthy `retry` sets `gr`, then
`if (gr && !decisionReason.noVerdict)` pushes
`{message: xe({content: Hen, isMeta: !0, turnCompanion: !0, now: X})}`
(offset 2289047). `Hen` is "The PermissionDenied hook indicated you may retry
this tool call." (chunk-phm7wwmz.js offset 10022). `noVerdict` is only set on
auto-mode classifier no-verdict denials (chunk-sfn1dbxq.js 3343515, 3344972,
3351249, 3353122); no other assignment exists.

## Port

`HookResult.retry` is parsed only from PermissionDenied and only when
`=== true`. `authorize` captures the existing native PermissionDenied hook
answer on both rule-deny sites and returns the flag with the denial; the tool
batch keeps a batch-scope flag and appends one meta user message after the
paired result batch. Comments cite the ranges.

## Adaptation

This product has no auto-mode classifier and no decision-reason surface; the
native PermissionDenied raise on rule denials is the recorded W45 divergence,
so the recovered consumer attaches to that existing path. The source's
`!noVerdict` gate is vacuous here because `noVerdict` never exists. The
source pushes one hint per denied call; this batch model appends one after the
whole result batch. `isMeta`/`turnCompanion` have no analogue in the session
model: the hint is a plain user message that no front end renders and the next
request includes.

## Verification

`hooks` asserts the field parses for PermissionDenied alone, `false` and a
PermissionRequest output are ignored. `agent-lifecycle` asserts the exact hint
follows the denied result batch only when `retry` is set and is absent
otherwise. Focused 97/97, tsc 0, build 0, full 2,144/2,144, chain 767/767,
notices 0, identity `ef87a5eb…`.
