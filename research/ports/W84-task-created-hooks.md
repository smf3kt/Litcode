# W84 — TaskCreated payload and rollback

## Source position

`Kir` (chunk-sfn1dbxq.js, UTF-16 [2946915,2947222)) builds the TaskCreated
payload from task metadata, not from the tool call:
`{task_id, task_subject, task_description, teammate_name, team_name}`.
The task-create tool raises it with the record it just wrote and, when a hook
returns a blocking error, deletes that record before throwing
(chunk-tar639dc.js [140910,141200)); the delete also strips the task id from
every dependent's `blocks`/`blockedBy` (`XCt`, chunk-9xs8s13r.js). Exit 2 is
blocking for TaskCreated because `Zge` includes it (chunk-sfn1dbxq.js offset
564884). `X_`/`$l` (chunk-rgrg9230.js [1889,1979)) supply the teammate and
team names from the team context.

## Port

`createdTaskFields` reads the validated `subject`/`description` from the input
and the generated UUID from the tool result JSON (its first key, so a capped
result still carries it). The raise sends `task_id`, `task_subject` and
`task_description`. A blocked hook deletes the task through the new internal
`removeTask` (lock, unlink from `blockedBy`, graph validation, atomic write)
and replaces the tool result with an error carrying the source's
`TaskCreated hook feedback:` prefix. `TaskCreated` joins the blocking and
decision-block sets, matching `Zge`.

## Adaptation

The tool path has no team context, so `teammate_name` and `team_name` stay
unset; the record notes the gap. The raise happens after the tool returns
rather than inside the tool body, because hooks live on the agent; the rollback
still removes the task before the model sees the result. The product has no
numeric high-water mark or background task host, so only the stored task and
its dependency edges are cleaned.

## Verification

`agent-lifecycle` 27/27 and `hooks` 50/50: a blocking TaskCreated hook
receives `task_id`, `task_subject`, `task_description` with no tool fields,
the record is deleted, and the result is the prefixed error; a context-only
hook keeps the pending task and adds `Hook context:`. tsc 0; build 0; full
2,112/2,112; chain 767/767; notices 0; source index unchanged; identity
`081a61bf…`.
