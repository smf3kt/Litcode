# W83 — failed hook output for watcher events

## Source position

`ke($e,Ve)` (chunk-sfn1dbxq.js, UTF-16 [1678937,1679425)) displays every
`systemMessage` from the FileChanged run, then walks the per-hook results and
displays `result.output` for each result whose `succeeded` is false. The
CwdChanged handler at offset 1680136 does the same for its results. The command
and HTTP adapters produce `{succeeded, output, ...}` where a non-zero status
carries stderr as `output` (offsets 3054588 and 3050719).

## Port

`HookResult.failures` records the failure text for spawn errors, timeouts,
non-blocking exit 2 and any other non-zero exit. The same text is still pushed
to `additionalContext`, so model context is unchanged. The interactive
FileChanged and CwdChanged raises display each entry on the status stream after
the system messages, matching the source's display order.

## Adaptation

The product reports failure text rather than a per-hook `{succeeded, output}`
record, because its runner aggregates hook output by event. The text is the
same one already surfaced as context, so no new interpretation is introduced.
Blocking exit-2 events keep their block/reason behavior and do not add a
failure entry.

## Verification

`hooks` 50/50: a FileChanged hook exiting 3 with stderr reports
`[FileChanged hook: exit code 3] boom` in both `failures` and
`additionalContext`; a successful hook leaves `failures` undefined. tsc 0;
build 0; full 2,110/2,110; chain 767/767; notices 0; source index unchanged;
identity `53e0f27e…`.
