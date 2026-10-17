# W92 — permission-prompt Notification

## Source position

`O9n` (chunk-fyhzvvp0.js offset 4925) arms a timer while a permission
prompt is pending. The timer's delay is `aVt` = 6000 ms (chunk-sfn1dbxq.js
offset 2915839); when it fires it raises `S0` (chunk-sfn1dbxq.js offset
2941901) with `{message, notification_type}` — the message is
`Claude needs your permission to use <tool>` and the type is
`permission_prompt`. The timer is unref'd and the returned function clears
it when the prompt resolves; `CLAUDE_CODE_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS`
skips the whole arm. The permission request site calls it at
chunk-fyhzvvp0.js offset 10393.

## Port

`notifyPermissionPrompt` ports `O9n`: it returns a cancel function, skips
under the disable flag, arms an unref'd 6000 ms timer and emits
`{message, notification_type: "permission_prompt"}`. The interactive
permission callback arms it around the prompt and cancels it in `finally`,
so an answer within six seconds raises nothing.

## Correction

The prior interactive raise `{source: "runtime", prompt}` on runtime event
prompts had no source caller: `S0` is called for permission prompts,
elicitation responses/completions and plugin notifications, not for internal
event-injection prompts. The raise and the queue's `notification` flag are
removed; the recovered permission-prompt notification replaces them.

## Adaptation

The source message names its product. This runtime keeps its neutral text
(`Permission needed to use <tool>`); the hook's `notification_type`,
timing, cancellation and disable flag are the source's.

## Verification

`interactive` 8/8: the timer stays silent at 5999 ms, emits the payload at
6000 ms, a cancelled prompt never emits, and the disable flag suppresses the
arm. tsc 0; build 0; full 2,121/2,121; chain 767/767; notices 0; source index
unchanged; identity `8ff650c8…`.
