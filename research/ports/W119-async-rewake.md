# W119 — asyncRewake command hooks

## Source position

The plugin command-hook schema (chunk-3cynezh1.js offset 101418) carries
`asyncRewake` ("runs in background and wakes the model on exit code 2 … Implies
async"), `rewakeMessage` (the prefix before the hook output) and
`rewakeSummary` (the one-line terminal summary, default `Stop hook feedback`).
The consumer `m5e` (chunk-sfn1dbxq.js offset 2956018) waits for the background
run, wakes only when its exit code is 2, defaults the prefix to
`Stop hook blocking error from command "<hookName>":` and appends
`stderr || stdout`. The broken-install detector `Ebt` (offset 632160) and its
dedupe `Abt` (offset 632770) apply only to script hooks' `scriptPaths`. The
summary may come from a trusted plugin's stdout JSON `rewakeSummary`, trimmed,
whitespace-collapsed and capped at `nkr` 300 (offset 2955284); otherwise the
definition's text is used. The wake body is purified by `UT` (offset 632948)
over `Ait` (chunk-hwpb27as.js offset 43), which escapes `<` before
`system-reminder` and a trailing `<`, and by `zLe` (offset 633015), which
applies credential redaction. `z6t` (offset 633021) queues the body as a task
notification with priority `next`, `stopHookActive: true` and
`turnAttribution: "inherit"`.

## Port

`commandHookSchema` gains the three fields, and `runHooks` treats
`asyncRewake` as async, so the definition reaches the owned async registry.
`HookRunOptions.onCommandResult` exposes each command run's raw exit code,
stdout and stderr to its owner. The registry strips `asyncRewake` from the
forwarded foreground run, captures that raw result, and on exit code 2 adds
`AsyncHookCompletion.rewake`: the summary (default `Stop hook feedback`) and
the body (configured prefix, else the default prefix with the command text,
then stderr else stdout), both credential-redacted and the body reminder-escaped.
The runtime's owner callback queues the wake body as the event prompt instead of
the generic completion record; the interactive loop already turns queued event
prompts into model turns, which is the local wake.

## Adaptation

- A local command hook has no hook name; the default prefix quotes its command.
- The stdout JSON `rewakeSummary` path needs a trusted plugin id, which
  flattened local hooks do not carry. Only the definition's `rewakeSummary` is
  read, and it is used as the source uses the definition text, without the
  300-unit normalization that applies to the JSON path.
- Broken-install detection and its dedupe need script hooks' `scriptPaths`.
  This build refuses script hooks and command hooks carry no `scriptPaths`, so
  neither is ported.
- `ranForAccountMemory` has no local counterpart; its withheld-output branch
  has no surface.
- The wake is a FIFO event prompt, not a task notification with priority,
  `stopHookActive` and turn attribution. Child-agent registries record the
  completion through their observer but own no wake queue.
- The shared schema accepts the two rewake texts on any command hook, matching
  the source's single plugin hook schema.

## Verification

`hooks` pins the schema, the implied async owner, and the raw result seam.
`async-hooks` pins exit-2-only wakes, stderr over stdout, the custom prefix and
summary, and the reminder escape. `runtime-resources` pins the queued wake
body. Focused 103/103, extended 226/226, tsc 0, build 0, full 2,171/2,171,
chain 768/768, identity `06c37dbf…`.
