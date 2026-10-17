# W108 — PostModelSwitch additional context

## Source position

The PostModelSwitch output schema is `hookSpecificOutput: {hookEventName:
"PostModelSwitch", additionalContext?: string}` (chunk-n3ykh62m.js offset
392672). The switch consumer `sXr` (chunk-sfn1dbxq.js offset 2939454) collects
every `additionalContexts` entry and successful hook content into a pending
entry keyed by session and target model. `gZo` (offset 2940920) waits for
in-flight switch hooks, drains that entry, drops entries whose `toModel` is not
the session's landed model, dedupes identical contexts and messages, and returns
them to the model-request loop, which yields them as attachments before the next
request (chunk-5b2hxy2e.js offset 139177).

## Port

`pendingHookContext` now also collects PostModelSwitch hook results. The
one-shot backward scan that stops at the first message, compact or turn-end
delivers the staged context with the next request and never again, which is the
same drain-once behavior; the dedupe filter is unnecessary because each hook
result is read once.

## Adaptation

The source stages asynchronously and waits for in-flight hooks before the next
request. This runtime emits PostModelSwitch synchronously after the switch has
applied, so no in-flight wait exists. Failed hook output is delivered as
ordinary `Hook context:` text rather than a typed attachment, and the
`toModel === landedOn.toModel` filter is vacuous because the event is only
raised after a successful switch.

## Verification

`agent-lifecycle` stages a context with `emitHook` and asserts the next
request carries exactly one occurrence, including after a second turn (the text
stays in history; it is not injected twice). Focused 46/46, tsc 0, build 0,
full 2,146/2,146, chain 767/767, notices 0, identity `1e2c779c…`.
