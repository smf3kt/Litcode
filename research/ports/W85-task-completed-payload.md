# W85 — TaskCompleted and TeammateIdle payloads

## Source position

`pvt` (chunk-sfn1dbxq.js, UTF-16 [2947228,2947575)) builds TaskCompleted as
`{task_id, task_subject, task_description, teammate_name, team_name}` over the
common context `$d` [2958255,2958860). The idle call site
(chunk-5b2hxy2e.js offset 74688) resolves `{teammateName, teamName}` through
`Ua` (offset 60370) and raises TaskCompleted for every `in_progress` task whose
`owner` equals the teammate name before raising TeammateIdle. `qir`
[2946651,2946909) builds TeammateIdle as `{teammate_name, team_name}` over the
same common fields.

## Port

The TaskCompleted gate reads the target record through the new
`readTaskRecord` and sends `task_id`, `task_subject`, `task_description` and
`teammate_name` from the record's `owner` when set. When the record is absent
it keeps the prior tool-field payload as a fallback. WorktreeCreate is
unchanged. The interactive TeammateIdle raise drops its local `source` field;
it keeps the common `agent_id` and `teammate_name`.

## Adaptation

The product completes one task per gate call, whereas the source iterates every
in-progress task owned by the idle teammate at idle time; the per-task gate is
the existing adaptation and its trigger is unchanged. `team_name` remains
unset because neither the task store nor the local idle event carries a team
name.

## Verification

`agent-lifecycle` 29/29 and `hooks` 50/50: a blocking TaskCompleted gate sees
the created task's `task_id`/`task_subject`/`task_description`, no tool
fields, and leaves the task pending; with `owner: "alice"` the payload carries
`teammate_name: "alice"` and the update completes. tsc 0; build 0; full
2,114/2,114; chain 767/767; notices 0; source index unchanged; identity
`6b50f209…`.
