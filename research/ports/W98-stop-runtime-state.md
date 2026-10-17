# W98 — Stop/SubagentStop runtime state

## Source position

`Sle` (chunk-sfn1dbxq.js [2945580,2946104)) always adds
`{background_tasks: sdn(taskRegistry.all()), session_crons: idn()}` to both
Stop and SubagentStop. `sdn` [2944321,2944915) keeps tasks that are running
or pending and not marked `isBackgrounded: false` (`Vg`, chunk-j8hqhz0c.js
offset 16174), maps the type through `wcr` (offset 14951; `local_bash` →
`shell`, `monitor_*` → `monitor`), and caps each string with `_c`
(chunk-ax7r0qj7.js [4917,5030)) at 1000 code units, dropping a dangling high
surrogate and appending `… [+N chars]`. Type-specific fields: `command` for
shell, `agent_type` for agents, `server`/`tool` for MCP and monitors, `name`
for workflows. `idn` [2944915,2945033) projects `{id, schedule: cron,
recurring: recurring ?? false, prompt}` from `Km()`
(chunk-4bw62nzm.js offset 106264).

## Port

`BackgroundRegistry.active()` returns the running jobs; the runtime's
`stopState(owner)` projects them as `shell`/`monitor` entries with the
truncated description and shell command, and projects the scheduler's
`list()` as `session_crons`. `Agent` exposes `events.stopState`; the
interactive and headless entry points and every child-agent path (skill
execution, subagent tool, agent registry) pass the owning runtime's provider,
so Stop and SubagentStop always carry both arrays.

## Adaptation

The product's background kinds are `run` and `monitor` with no MCP task
registry, so only `shell` and `monitor` entries can appear. Its statuses are
running/completed/failed/cancelled/timed_out; the source's running/pending
filter becomes running-only. `isBackgrounded` does not exist because every
registered job is a background job.

## Verification

`background` 23/23 with the active projection and its removal after the job
ends. `runtime-resources` 11/11: a shell job and a cron job project, the
prompt truncates at 1000 code units. `agent-lifecycle` 39/39: the Stop payload
carries both arrays verbatim. tsc 0; build 0; full 2,131/2,131; chain
767/767; notices 0; source index unchanged; identity `9b2dc7df…`.
