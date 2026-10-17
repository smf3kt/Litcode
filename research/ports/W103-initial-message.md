# W103 — SessionStart initialUserMessage

## Source position

`initialUserMessage` is a SessionStart output field (chunk-n3ykh62m.js offset
391966). The hook loop stages every truthy value on the session app state and
lets the last hook win (`H7`, chunk-sfn1dbxq.js offset 2482643); it ignores the
field from plugins loaded after session start (`newPluginsOnly`) and stores it
as `lateInitialUserMessage` when the hooks were overtaken. The headless
prologue drains the staged value with `OXr()` (chunk-sfn1dbxq.js offset
2480020) and calls `ie.prependUserMessage(Js)` (chunk-rx2nah4x.js offset
472137); the claim path does the same for overdue hook output (offset 584530,
late delivery at offset 378598). `prependUserMessage` pushes a user line ahead
of the input stream, so the value becomes the first queued user turn, not part
of an unfinished turn.

## Port

`HookResult` gains `initialUserMessage`, parsed only from SessionStart output
with an empty string ignored. `Agent.startSession` returns
`{ initialUserMessage? }` instead of writing it into the transcript: a stored
lone user message would make `Session.awaitingResponse` true and the next
`run()` would refuse with "unfinished turn". The front ends queue the value at
the same point as the recovered prologue: the headless CLI runs it as the first
turn before the typed prompt, the interactive loop pushes it ahead of typed or
piped input at startup, and clear/fork restarts unshift it onto the queue.

## Adaptation

The source stages the value in shared app state that its prologue drains; this
runtime has no such store, so `startSession` hands the value back to the caller
that owns the input queue. Mid-session resume starts (configuration change,
branch switch, resume in place) do not drain it, matching the source, whose
`OXr` drain exists only in the prologue and claim paths. Overdue-hook delivery
(`lateInitialUserMessage`) and the post-start plugin warning are not
applicable: `startSession` awaits every hook synchronously and this path has no
post-start plugin discovery.

## Verification

`hooks` asserts last-wins parsing, the empty-string skip, and that
UserPromptSubmit is ignored. `agent-lifecycle` asserts the return value, that
no message event is stored, and that `awaitingResponse` stays false before and
after the first turn. `interactive` asserts the hook message reaches the first
request ahead of typed input. Focused 107/107, tsc 0, build 0, full
2,138/2,138, chain 767/767, notices 0, identity `b4860f22…`.
