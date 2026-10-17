# W81 — watcher-driven FileChanged

## Source position

`ke($e,Ve)` (chunk-sfn1dbxq.js, UTF-16 [1678937,1679425)) is the watcher's
event handler: it logs `FileChanged: <event> <path>`, calls
`e7r(session, path, event, ...)`, and consumes the result:

- non-empty `watchPaths` are added to the watched set through `Se`;
- every `systemMessage` is displayed as a non-error message;
- a failed hook's output is displayed as an error;
- a rejected run logs `file_watcher_change_detected`/`hook_exec_failed` and
  displays the error.

The watcher subscribes to `add`, `change` and `unlink`; `e7r`
[2935646,2935767) builds `{...$d, hook_event_name:"FileChanged", file_path,
event}`.

## Port

`watchProjectConfig` accepts `onFileChange(filePath, event)` in its sources.
For each relevant `fs.watch` event it reports the absolute path and maps the
event:

- `rename` with an existing target is `add`;
- `rename` with a missing target is `unlink`;
- anything else is `change`.

The interactive loop installs the callback when `watchConfig` is enabled and
raises `FileChanged` with the recovered payload; `systemMessages` from the
result are written to the status stream, matching the source display path. The
raise is asynchronous and non-blocking, and a failure writes a single status
line instead of interrupting the watcher.

## Adaptation

The product watcher covers the configuration, instruction and content roots it
already watches; it does not follow `watchPaths` returned by a FileChanged hook
because the product hook result has no such field. The recovered failure-output
display is reduced to an error status line. These stay recorded as C-6 work.

## Verification

`config-watch` 3/3: a real watcher reports an added file as `add`, a rewrite
as `change` (or `add` where the platform reports rename), and a deletion as
`unlink`, each with the absolute path. tsc 0; build 0; full 2,108/2,108; chain
767/767; notices 0; source index unchanged; identity `700a4af5…`.
