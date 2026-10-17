# W109 — Setup additional context

## Source position

The Setup output schema is `hookSpecificOutput: {hookEventName: "Setup",
additionalContext?: string}` (chunk-n3ykh62m.js offset 392333). The Setup
dispatcher `GZo` (chunk-sfn1dbxq.js offset 2483675) runs `n7r`, collects every
`additionalContexts` entry into `b`, appends each non-blocking hook message,
and when any context exists wraps them in one
`{type: "hook_additional_context", content: b, hookName: "Setup", toolUseID:
"Setup", hookEvent: "Setup"}` attachment in the startup message list
(offset 2484520).

## Port

`pendingHookContext` now also collects Setup hook results, which are raised at
the process-startup dispatch only. The startup request receives the content
once through the existing `Hook context:` prefix, matching the attachment's
place in the startup message list.

## Adaptation

The source wraps the contexts in a typed attachment; this runtime carries the
same strings as `Hook context:` text. A Setup hook's non-blocking exit-2 error
is already recorded in the hook result's additionalContext by the runner, so it
joins the same request like the source's `hook_non_blocking_error` attachment.

## Verification

`agent-lifecycle` asserts the startup request carries `Hook context:\nsetup
context` and that a resume start does not raise Setup. Focused 47/47, tsc 0,
build 0, full 2,147/2,147, chain 767/767, notices 0, identity `45cc6853…`.
