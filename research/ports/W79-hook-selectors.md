# W79 — hook selector table and event payloads

## Source position

`y5e(e)` (chunk-sfn1dbxq.js, UTF-16 [2984225,2985215)) selects the one field a
matcher is tested against:

- tool events (PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest,
  PermissionDenied) use `tool_name`;
- UserPromptExpansion uses `command_name`; SessionStart uses `source`;
  Setup, PreCompact and PostCompact use `trigger`; Pre/PostModelSwitch use the
  normalized `to_model`;
- Notification uses `notification_type`; SessionEnd uses `reason`;
  StopFailure uses `error`; SubagentStart/SubagentStop use `agent_type`;
- Elicitation/ElicitationResult use `mcp_server_name`; ConfigChange and
  DirectoryAdded use `source`; InstructionsLoaded uses `load_reason`;
- FileChanged uses `h5e(file_path)`, and `h5e` is `path.basename` (import at
  the top of the module);
- TeammateIdle, TaskCreated, TaskCompleted and every event outside the table
  return no value.

`zze(e,n,r)` [2983916,2984075) applies the hook: `s===void 0||!n||gX(...)`.
A missing selector value therefore accepts every configured matcher, and only
a present value is compared.

Payload builders measured for this package:

- `ZXr` [2935532,2935646): `CwdChanged` with `old_cwd` and `new_cwd`;
- `e7r` [2935646,2935767): `FileChanged` with `file_path` and `event`;
- `lvt` [2933905,2934228): `DirectoryAdded` with `directory` and `source`;
- `kTn` [2935761,2936142): `InstructionsLoaded` with `file_path`,
  `memory_type`, `load_reason`, `globs`, `trigger_file_path` and
  `parent_file_path`;
- `cvt` [2934222,2934736): `Elicitation` with `mcp_server_name`;
- `n7r` [2943161,2943444): `Setup` with `trigger`, dispatched as `"init"`
  at chunk-9shw4xrd.js offset 143466;
- `KZn` [672828,672967): the eager instruction load reason, whose state
  default is `"session_start"` (offset 654708);
- `$d` [2958255,2958860): the shared session, transcript, cwd and permission
  context every builder spreads.

## Port

`hookMatcherValue` follows `y5e` and returns the selector per event;
FileChanged uses `basename`. `runHooks` now filters a definition only when a
selector exists, porting `zze`'s undefined branch: an event with no selector
accepts every matcher.

Raise sites carry the recovered fields:

- `CwdChanged` sends `{old_cwd, new_cwd}`; the pre-relocation workspace is
  captured before the target is resolved.
- `DirectoryAdded` sends `{directory, source}` instead of `directory_path`.
- `FileChanged` sends `{file_path, event}`; the path is absolute.
- `InstructionsLoaded` sends `{load_reason: "session_start"}`.
- `Setup` sends `{trigger: "init"}`.
- `Elicitation` sends `mcp_server_name`; ElicitationResult inherits it.

## Adaptation

The source raises FileChanged from its file watcher with one of `add`,
`change` or `unlink`. This runtime has no per-file watcher callback, so its
mutation tools raise the event with the absolute tool path and report the
mutation as `change`; `memory_write` derives `.harness/memory/<name>.md`.
InstructionsLoaded stays a session-level raise with the recovered default load
reason because the runtime has no per-file eager instruction loader; the
file-only fields stay absent. The model-alias normalization (`g4e`/`zIt`) used
by Pre/PostModelSwitch selectors is not ported; the selector uses `to_model`
and falls back to the product's `model`. UserPromptExpansion keeps its
product payload, which carries no `command_name`, so its matcher value is
absent exactly as for any other selector-less payload.

## Verification

`hooks` 48/48 and `agent-lifecycle` 25/25: the selector table is asserted
directly (basename, notification type, server name, session end reason, and no
TaskCreated value); transition matchers match source/reason/trigger and match
every occurrence for CwdChanged and TaskCreated; the raised Setup,
InstructionsLoaded and FileChanged payloads are captured from real command
hooks. The hook-group no-selector expectation now follows `zze`: all three
hooks run when the selector is absent. tsc 0; build 0; full 2,107/2,107;
chain 767/767; notices 0; source index unchanged; identity `fd3b6906…`.
