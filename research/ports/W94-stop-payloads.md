# W94 — Stop-family payloads

## Source position

The Stop and SubagentStop schema declares `stop_hook_active`,
`last_assistant_message` and the optional `background_tasks` and
`session_crons` (chunk-r2vtj1kh.js offset 197403); SubagentStop adds
`agent_id`, `agent_transcript_path` and `agent_type` (offset 198320). The
shared builder at chunk-sfn1dbxq.js offset 2946104 computes
`last_assistant_message` as the trimmed message text or omits it, and sends
the child transcript path. StopFailure declares `{error, error_details?,
last_assistant_message?}` (offset 198098); `Gze` (offset 2945292) trims the
message and passes `errorDetails`, with no `stop_reason` field.

## Port

Stop and SubagentStop now send the trimmed last message only when non-empty.
SubagentStop adds `agent_transcript_path` from the child session file and no
longer sends the invented `reason` field. StopFailure drops its invented
`stop_reason` on both raise sites and trims the last message.

## Adaptation

`background_tasks` and `session_crons` stay omitted: the agent has no handle
on the runtime's job and scheduler registries. They are optional in the
schema, but their absence is a recorded gap, not a claim that none exist.

## Verification

`agent-lifecycle` 36/36: every SubagentStop payload carries the child
transcript path and the trimmed message, and none carries `reason`; a
`max_tokens` stop raises StopFailure with `error` and the message and no
`stop_reason`. tsc 0; build 0; full 2,123/2,123; chain 767/767; notices 0;
source index unchanged; identity `5ac052d1…`.
