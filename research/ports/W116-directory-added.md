# W116 — DirectoryAdded raise and failed-output display

## Source position

The DirectoryAdded hook input carries `directory` and `source`, and `source`
is the documented enum `slash_command` | `register_repo_root` (`jK`,
chunk-r2vtj1kh.js offset 203596). The event is raised by the /add-dir command
(chunk-340rde3k.js offset 2197) and by the register_repo_root control request
(chunk-rx2nah4x.js offset 565798). The extractor `lvt`
(chunk-sfn1dbxq.js [2933905,2934228)) returns the per-hook results plus every
non-empty `systemMessage`. Both call sites display the system messages and then
walk the results, displaying `output` for each failed hook
(`DirectoryAdded hook failed: ${output}`).

## Port

The workspace-relocation raise now passes the documented `slash_command`
producer instead of the off-enum `cwd_relocation` value, so a matcher written
against the documented enum selects the local hook. The returned failures are
displayed on the status stream after the system messages, following the same
order as the FileChanged/CwdChanged watcher display (`ke`/`Pe`,
chunk-sfn1dbxq.js [1678937,1679560)). System messages are displayed by the
runtime's hook display path while the event runs, so only failed outputs need
the consumer-side loop.

## Adaptation

This CLI has no /add-dir command and no register_repo_root control request; its
slash relocation commands (/cwd, /worktree, /worktree-exit) are the producer, so
the source's registration lifecycle and its `register_repo_root` trigger have no
local analogue. The runner aggregates hook output by event, so a failure is the
same context text used by the watcher display rather than a per-hook
`{succeeded, output}` record; the source's `DirectoryAdded hook failed: ` prefix
is therefore not re-added. The /add-dir task-notification summary line has no
local notification surface.

## Verification

`interactive` asserts a /cwd relocation delivers
`{hook_event_name: "DirectoryAdded", directory: <target>, source: "slash_command"}`
to a matcher-selected hook, displays its system message, and displays a failing
hook's output. `hooks` uses the documented source value in its matcher-selection
fixture. Focused 71/71, tsc 0, build 0, full 2,159/2,159, chain 767/767,
identity `7b5c2d92…`.
