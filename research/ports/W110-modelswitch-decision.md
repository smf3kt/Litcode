# W110 — PreModelSwitch permissionDecision

## Source position

The PreModelSwitch output schema is `hookSpecificOutput: {hookEventName:
"PreModelSwitch", permissionDecision?: "allow" | "deny" | "ask",
permissionDecisionReason?: string}` (chunk-n3ykh62m.js offset 392413). The
runner `oXr` (chunk-sfn1dbxq.js offset 2937531) maps a deny to a blocking
error with reason `permissionDecisionReason ?? "Blocked by hook"`, records any
ask with its reason, treats allow as `skipConfirm`, and returns block before
ask when both appear. The user-facing texts are `RWe` (chunk-hh0bresc.js
offset 9514, "`Model switch blocked by a PreModelSwitch hook`" plus
": <reason>") and `jU` (offset 9782, "`Model switch to <model> was blocked by
a PreModelSwitch hook`"). The interactive picker turns an ask into a
confirmation ("A PreModelSwitch hook asked you to confirm",
chunk-24k7d6mw.js offset 859352; ask branch at chunk-f5wjy38g.js offset 21336).

## Port

`applyJsonOutput` records allow/deny/ask and the reason for PreModelSwitch
with deny-wins precedence. The interactive `/model` path renders the recovered
deny text, asks the user to confirm on ask (declining renders the recovered
`jU` text), and keeps the existing block/stop check for top-level blocks.

## Adaptation

The source's `skipConfirm` from an allow feeds an expensive-model confirmation
dialog this runtime does not have, so the flag has no consumer. The source also
has command and SDK flows that turn an ask into a block with a "run /model
interactively to confirm" parenthetical; this runtime's only switch surface is
interactive, so it takes the picker's confirmation branch.

## Verification

`hooks` asserts allow/ask/deny parsing, deny precedence across hooks, an absent
reason key, and that another event's permissionDecision is ignored.
`interactive` asserts deny and declined ask leave the model unchanged with the
recovered texts, and an accepted ask switches it. Focused 67/67, tsc 0, build
0, full 2,148/2,148, chain 767/767, notices 0, identity `dbe3098b…`.
