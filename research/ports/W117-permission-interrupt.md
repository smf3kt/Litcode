# W117 — PermissionRequest deny interrupt

## Source position

A PermissionRequest answer's deny arm carries `{message?, interrupt?}`
(chunk-n3ykh62m.js offsets 395544-395771; the same arm in the classic answer
schema). The normalizer keeps `interrupt` only when it is exactly `true`
(`J_t`, chunk-sfn1dbxq.js offset 556404). The answer fold returns at the first
non-allow hook, so only that hook's `interrupt` reaches the consumer (`n2e`,
chunk-fyhzvvp0.js offset 15469). The consumer logs
`Hook interrupt: tool=<name> hookMessage=<message>` and aborts the turn's
controller (chunk-rx2nah4x.js offset 660951; the subagent path does the same at
chunk-fk088dyb.js offset 89113). The denial itself still returns as the tool
result.

## Port

`runHooks` records `HookResult.interrupt` only from the adopted denying
decision. `authorize` combines it with the classic chain answer's
`permissionRequestResult.interrupt`, writes the source's log line to the status
stream, and calls the new `AgentEvents.interruptTurn` before returning the
denial. The interactive loop aborts its own turn controller there; the headless
CLI and background registry children abort their owned controllers. The turn
then finishes as `aborted`, the denied batch is recorded, and post hooks are
skipped because the signal is already aborted.

## Adaptation

The status line is user-visible where the source writes it to its log. Two
Agent owners receive only a signal and own no controller (the foreground
subagent runner and the skill-fork runner), so they do not abort; their denial
still blocks and the process keeps a recordable turn. The product has no
per-hook outcome record beyond the adopted interrupt flag.

## Verification

`hooks` asserts adoption, the later-deny refusal and the allow arm.
`agent-lifecycle` asserts the abort, the logged interrupt and the skipped tool.
`plugin-chain-permission` asserts the classic answer arm aborts the same way.
Focused 214/214, tsc 0, build 0, full 2,162/2,162, chain 768/768,
identity `1c73f452…`.
