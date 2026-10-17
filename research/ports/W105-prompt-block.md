# W105 — suppressOriginalPrompt and prompt block messages

## Source position

`suppressOriginalPrompt` exists on the UserPromptSubmit and UserPromptExpansion
output schemas (chunk-n3ykh62m.js offsets 391571 and 391772): "When decision is
\"block\", omit the original prompt from the block message." The consumers
append `\n\nOriginal prompt: <prompt>` to the block text unless it is set
(chunk-htgmc2p1.js offsets 34121 and 39033; the TUI consumer does the same at
chunk-ksjypbtc.js offset 4938). The UserPromptSubmit prefix is
`UserPromptSubmit operation blocked by hook:\n` (`EMe`, chunk-sfn1dbxq.js
offset 3009974) and the expansion uses the same shape. A top-level
`decision:"block"` becomes a blocking error for any parsed output (`pX`,
chunk-sfn1dbxq.js offset 2961295). Internal runner failures, invalid output and
truncated stdio suppress the prompt automatically (`Ret` at offset 566691,
invalid-output path at 3032045, stdio path at 3034961); an ordinary exit 2 does
not.

## Port

`HookResult` gains `suppressOriginalPrompt`, parsed only from those two events
with `=== true`. `promptBlockMessage` renders the recovered text.
`Agent.run` returns it as the blocked turn's text for UserPromptSubmit and for
a fallthrough skill's UserPromptExpansion, and the interactive execution-skill
path prints it. The two prompt events joined `DECISION_BLOCK_EVENTS`, because
`pX` honors their top-level block decisions. Internal blocks (input byte cap,
unresolved hook kinds, missing async owner, resolver capacity) set the
suppression flag themselves.

## Adaptation

The source also stores a warning message in the conversation and returns the
same string as resultText. This runtime returns the string as the turn's text
and lets the front end print it, so the event log and the model's history are
unchanged. Ordinary exit-2 blocks keep the original prompt; only an explicit
output field or an internal non-run block suppresses it.

## Verification

`hooks` asserts parsing on both prompt events, the `false` and
SessionStart ignores, and automatic suppression when a model hook has no
resolver. `lifecycle` asserts the exact visible and suppressed texts for both
events. `interactive` asserts the execution-skill path appends or omits the
command. Focused 88/88, tsc 0, build 0, full 2,143/2,143, chain 767/767,
notices 0, identity `3319a5a3…`.
