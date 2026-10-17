# W96 — watcher-driven ConfigChange

## Source position

`QXr` (chunk-sfn1dbxq.js [2933599,2933905)) builds
`{session context, hook_event_name: "ConfigChange", source, file_path}` and
matches selectors on `source`. The schema's source enum is `user_settings`,
`project_settings`, `local_settings`, `policy_settings` and `skills`
(chunk-r2vtj1kh.js offset 202846); `policy_settings` results are forced
non-blocking. `Uc` (chunk-2bcyxj9q.js [42936,43157)) maps the settings scopes
to the first four values. The settings watcher gates change and deletion
through the hook before fanning out (`oi` [39334,39473)); the skills watcher
gates skill, command and agent files with `skills` (`re`,
chunk-zkxek575.js [4471,4606)). `Zge` (offset 564884) includes ConfigChange
and `hX` (offset 2980890) excludes only PostToolBatch, TaskCreated and
PreCompact, so exit 2 blocks it.

## Port

`configChangeSource` maps a watched path: the project settings files
(`.harness/settings.json` and an explicit `settingsFile`) are
`project_settings`, `.harness/settings.local.json` is `local_settings`, the
user `settings.json` is `user_settings`, an explicit managed settings file is
`policy_settings`, and skill, command, agent, plugin and content-root files
are `skills`. The config watcher now lets `onFileChange` return `false` or a
promise to hold or suppress the debounced reload fan-out; the interactive
watcher raises ConfigChange with `source` and `file_path`, treats
`policy_settings` as non-blocking, and skips the reload when blocked.
ConfigChange joins the exit-2 blocking set.

## Correction

The product previously raised ConfigChange synchronously from `/theme`,
`/config editor`, `/model`-family config switches, `/reload` and
`/mcp-reconnect`, with invented sources (`theme`, `editor`, `reload`,
`mcp_reconnect`) and payloads (`model`, `permission_mode`, `thinking`,
`editorMode`, `server_name`). Those raises are removed: the recovered event is
watcher-driven only, and theme/editor writes reach it through the user
settings file.

## Adaptation

The local watcher covers the `.harness` catalogs and the user directory; OS
MDM polling is not implemented, and the explicit managed settings file is
watched in its place with the recovered non-blocking rule. Instruction files,
keybindings, rules and other non-skill catalog files raise no ConfigChange.

## Verification

`config-watch` 4/4: a pending gate holds the fan-out and `false` suppresses
it. `hooks` 52/52: exit 2 blocks ConfigChange with its stderr as the reason.
`interactive` 9/9: the source mapping covers settings scopes, skill roots,
content roots and the non-ConfigChange paths. tsc 0; build 0; full
2,127/2,127; chain 767/767; notices 0; source index unchanged; identity
`6443354c…`.
