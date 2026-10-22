# W268 recovered command aliases

The `local-jsx` registrations in `chunk-sfn1dbxq.js` (SHA-256
`4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da`) declare aliases that the host
never accepted. Offsets are zero-based UTF-16 code units.

| Registration | Offset | Aliases | Taken |
| --- | --- | --- | --- |
| `rename` | 1165018 | `name` | yes |
| `tasks` | 1167415 | `bashes` | yes |
| `permissions` | 1636668 | `allowed-tools` | yes |
| `exit` | 1647455 | `quit` | yes |
| `clear` | 1121013 | `reset`, `new` | yes |
| `rewind` | 1640413 | `checkpoint`, `undo` | `undo` only |
| `resume` | 1165474 | `continue` | no |
| `config` | 1133054 | `settings` | no |
| `plugin` | 1639556 | `plugins`, `marketplace` | no, command absent |
| `pause-memory` | 1135018 | `memory-pause`, `toggle-memory` | no, command absent |

## Behaviour

- **Dispatch.** A typed `/alias args` becomes `/canonical args` before the command chain runs, so
  the alias reaches the same branch, argument parser and report as the canonical name. The rewrite
  only applies to a user-submitted line; skills and event prompts are untouched.
- **Composer.** Each taken alias is offered as a row on its canonical command, so `/ba` completes
  to `/bashes` and Enter inserts the alias while the row names the canonical command.
- **Help.** `COMMAND_HELP` names the aliases on their canonical rows.

## Deliberate exclusions

- **`/resume` + `continue`.** This host's `/continue` resumes an interrupted turn, so taking the
  alias would break that command.
- **`/rewind` + `checkpoint`.** The host has a real `/checkpoint`; offering `checkpoint` as a
  `rewind` alias would make the composer insert `/checkpoint` for a `rewind` row. `undo` is kept.
- **`/config` + `settings`.** `/settings` does not exist here, and the vendor alias would imply a
  command the host does not have.
- **`plugin` and `pause-memory`.** Neither command exists in this host.

## Validation

- `test/command-aliases.test.ts`: 4/4 (the table, a title write through `/name`, the `/rewind`
  argument check through `/undo`, and `/quit` closing without a model call).
- `test/tui-autocomplete.test.ts`: 24/24, including all seven taken aliases resolving to their
  canonical rows and the arrow-navigation case that ruled out the `checkpoint` alias.
- Focused usage/aliases/autocomplete/MCP/status/context/interactive: 69/69.
- Compiled `.audit/w268-aliases.mjs`: 4/4 at identity `9c620fc2…`; `/name` retitles the session
  (read back through `/status`), `/undo` reaches `/rewind`'s check, `/quit` exits 0.
- `npm run check` and `npm run build` pass. Full suite 3102, 3101 pass, with only the known
  CLI-effort failure; one async-hooks cancellation test failed once under full-suite load and
  passed alone and on the rerun.
