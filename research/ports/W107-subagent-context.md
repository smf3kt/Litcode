# W107 — SubagentStart additional context

## Source position

The SubagentStart output schema is `hookSpecificOutput: {hookEventName:
"SubagentStart", additionalContext?: string}` (chunk-n3ykh62m.js offset
392621). The subagent start consumer collects every `additionalContexts`
entry into `Bo` and, when non-empty, pushes a `hook_additional_context`
attachment with `content: Bo`, `hookName` and `hookEvent: "SubagentStart"`
into the child's message list before its first turn
(chunk-40cepjpq.js offsets 127150 and 127532). A blocking error becomes a
`hook_non_blocking_error` attachment (`Jtt`, chunk-sfn1dbxq.js offset
3009808) instead of failing the start; the whole injection is skipped when the
child has an isolated context.

## Port

`pendingHookContext` now collects the additional context of SubagentStart
hook results alongside SessionStart when the start events precede the first
message. The existing `Hook context:` prefix carries them into the first
request, the same position the recovered attachment occupies.

## Adaptation

The isolated-context exclusion has no analogue here (the runtime has no
isolated-context child option). Our exit-2 message for a non-blocking event is
a `Hook context:` line; the source's attachment is a
`hook_non_blocking_error` record, but both reach the same next request and
neither fails the child.

## Verification

`agent-lifecycle` asserts the child's first request carries
`Hook context:\nchild start context` and that a top-level session never
raises SubagentStart. Focused 45/45, tsc 0, build 0, full 2,145/2,145, chain
767/767, notices 0, identity `b6d0794d…`.
