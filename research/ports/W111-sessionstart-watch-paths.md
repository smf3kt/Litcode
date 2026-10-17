# W111 — SessionStart watchPaths

## Source position

The SessionStart output schema carries `watchPaths?: string[]` ("Absolute
paths to watch for FileChanged hooks", chunk-n3ykh62m.js offset 392062) and the
output translation retains it (offset 387382). The hook runner collects every
hook's paths into `$e` and registers them with the file watcher: normally
`updateWatchPaths` (`Kjt`, chunk-sfn1dbxq.js offset 2483234, destructured
from the watcher module at offset 1680634), and `addWatchPaths` (`Vjt`) when
the session was overtaken or the hook came from a plugin loaded after start
(offset 2483221).

## Port

`Agent.startSession` returns the merged `watchPaths` from the SessionStart
hook results. The interactive loop registers them through its existing
`addInstructionPaths` channel: the startup run's paths arrive as
`initialWatchPaths` because that run precedes the loop, while clear/fork,
resume, configuration reload and cwd relocation register the return value
directly. The channel's existing bounds (absolute paths, 2,048 entries,
65,536-byte manifest) apply unchanged.

## Adaptation

The watcher distinguishes replace and add modes for plugin-late hooks; this
runtime has no plugin-late SessionStart concept (the new-plugins-only staging
is already ignored), so every result takes the additive path. A headless run
has no config watcher and ignores the returned paths.

## Verification

`agent-lifecycle` asserts the returned paths. `interactive` asserts the
startup paths create an `instruction_watch` event under `watchConfig`.
Focused 63/63, tsc 0, build 0, full 2,150/2,150, chain 767/767, notices 0,
identity `ec6093d6…`.
