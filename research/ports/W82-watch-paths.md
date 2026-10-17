# W82 — hook-returned watch paths

## Source position

`Vln` (chunk-sfn1dbxq.js, UTF-16 [2935234,2935532)) runs the CwdChanged and
FileChanged hooks and returns `{results, watchPaths, systemMessages}`, where
`watchPaths` is `results.flatMap(result => result.watchPaths ?? [])`. The
command and HTTP adapters read the field from
`hookSpecificOutput.watchPaths` (offsets 3050719 and 3054588), and `QY`
[557776,557905) concatenates `watchPaths` across hook results.
The FileChanged watcher (`ke` [1678937,1679425)) adds every returned path to
its watched set; the CwdChanged handler (offset 1680136) replaces the watched
set with the returned paths.

## Port

`HookResult` gains `watchPaths`. The output parser accepts
`hookSpecificOutput.watchPaths` only when `hookEventName` matches, keeps
non-empty strings in order, and accumulates across hooks. The interactive
FileChanged and CwdChanged raises hand the collected paths to
`configWatch.addInstructionPaths`, which keeps its existing absolute-path,
2048-entry and 64 KiB checks.

## Adaptation

The tool-mutation FileChanged raise inside the agent has no watcher consumer
and therefore ignores returned paths. The source's failed-hook output display
stays reduced to a status line. The watcher still treats the paths as
instruction paths rather than arbitrary file watches, matching its existing
scope.

## Verification

`hooks` 49/49: two matching hooks contribute `["/a","/b"]` and `["/c"]`
in order, a mismatched `hookEventName` contributes nothing, non-strings and
empty strings are dropped, and a result without the field leaves
`watchPaths` undefined. tsc 0; build 0; full 2,109/2,109; chain 767/767;
notices 0; source index unchanged; identity `35629d1f…`.
