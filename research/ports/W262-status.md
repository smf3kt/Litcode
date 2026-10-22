# W262 `/status`

The Settings dialog's Status tab, restricted to the rows this host can answer locally. Offsets are zero-based UTF-16 code units.

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-8x0s4t30.js` | `c7861ef120eccf27e49ad5f9ed8bf3a5b3e44bec377441d4cfd203ae6fc980c0` | `t3n` 3424 | session rows: Version, Session name, Session ID, Session kind, tmux session, cwd |
| ↳ | | `n3n` 5523 | model and configuration rows: Model, MCP servers, setting sources, Auto mode server |
| ↳ | | `U` 7619 | joins the two groups, filters empty ones and lays out the table |
| ↳ | | `Ye` 2977 | `label: value` row shape |
| `chunk-dag4qhha.js` | `cd1a28e9b3a52a9e2fa16901017bf7b0151c67d1859d5104a840d41e33f3f4d2` | `Ofe` 114000 | the Settings shell: the `Status` tab and the `confirm:no` Escape footer |
| `chunk-efek3snh.js` | `c4e76aaf5ac8d89c00ea5bb047c37c957dcc63373a5c7e662eec4ad2a1772332` | `SNo` 14431 | the model label |
| ↳ | | `tdn` 10961 | provider rows, including `Gateway URL` |
| `chunk-wtch2p0g.js` | `00d29835d3b6ec21999ab2d38ae5086e7c798d82aa152e76a7e00cf5b0dc4b3b` | `fT` 4516 | setting-source labels |

## Behaviour

- **Rows.** `t3n` emits Version, Session name (or the dim `/rename to add a name`), Session ID, Session kind (`interactive`, `background job · unattended`, `background job · attached`), tmux session when `TMUX` is set, then cwd; `n3n` adds Model, MCP servers, setting sources and the auto mode server row. `U` filters each group by length and renders a two-column table in that order.
- **Shell.** `Ofe` mounts the tab under the title `Status`; Escape is the `confirm:no` cancel.

## Host adaptations

- **Local rows only.** This build opens the panel with Version (the package version `cliVersion` reports), Session name (the last `title` event, or the recovered prompt), Session ID, Session kind `interactive`, tmux session when `TMUX` is set, cwd, Model, and `Gateway URL` when the configured gateway differs from the default. The panel is a read-only text dialog in a single column because the host dialog has no table primitive; Escape closes it.
- **Excluded.** Login, organization, email, cloud-session, channel, peer-address, memory-pause and web-setup rows read an account or cloud control plane; the idle/system diagnostics, IDE and MCP statuses, setting-source enumeration and the server-side auto mode classifier row have no local equivalent in this host. The JSON report shared by `/status`, `/usage` and `/cost` remains the piped path.
- **Session name.** `latestSessionTitle` mirrors `kM`: the last recorded `title` event wins, including one restored from a resumed journal.
- **Gateway.** `tdn` shows the gateway row only when a gateway is configured; the host compares its base URL with `DEFAULT_GATEWAY`, so the built-in endpoint does not add noise.

## Validation

- `test/status-panel.test.ts`: 4/4 (row order and fallback, title/tmux/gateway rows, latest title, package version).
- `test/status-command.test.ts`: 1/1 (dialog title, read-only flag, version, title, session id/kind, cwd, model, gateway).
- Focused status/context/btw/interactive/tui/catalog: 141/141.
- Compiled `.audit/w262-status.mjs`: 7/7 at identity `86ba21d1…`. `/status` opens the panel with the version, the unnamed-session prompt, session kind/id, cwd and model; Escape returns to the composer.
- `npm run check` and `npm run build` pass. Full suite 3079, 3078 pass, with only the known CLI-effort failure.
