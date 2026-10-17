# W89 — script hooks are refused by the recovered build

## Source position

The schematic `type: "script"` hook never executes in this build: `ito`
throws `"script hooks are not available in this build"`
(chunk-n3ykh62m.js offset 409142). The command adapter calls `ito` before
running anything (chunk-sfn1dbxq.js offset 3053030) and its catch records the
message as the failure output with `succeeded: false` (offset 3054829). The
catch marks the result blocked only when the event is in `SV`, the
`{PreToolUse, PermissionRequest}` set (chunk-3cynezh1.js offset 109855).

## Port

`runHooks` no longer executes a `type: "script"` command. It records
`[<event> hook: script hooks are not available in this build]` as a failure and,
for PreToolUse and PermissionRequest, blocks with that message. Other events
receive the same non-blocking failure note.

## Correction

The prior transport contract ran script hooks as synchronous bounded shell
commands. That was an inference: the recovered build refuses them before
execution, so the transport test now asserts refusal, that no payload/cwd files
are written, and that the failure is blocking only on the two `SV` events.

## Verification

`hooks` 51/51 and `hook-transports` 3/3: a PreToolUse script hook blocks with
the exact message and does not run its command (no marker file); a SessionStart
script hook records the same non-blocking note. tsc 0; build 0; full
2,118/2,118; chain 767/767; notices 0; source index unchanged; identity
`f7a620b6…`.
