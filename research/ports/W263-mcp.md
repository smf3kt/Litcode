# W263 `/mcp`

The management list behind the composer's `/mcp`. Offsets are zero-based UTF-16 code units.

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-6sz429bf.js` | `b32da1daa2dbef9742c8cf8f1f85c8857d87f7b20cd7092d8c66cc837921e8aa` | `wt` 28713 | the list: `Manage MCP servers`, the `I(Nt,"server")` subtitle, scope headings, rows and the empty-catalog null |
| ↳ | | `Qo` 35295 | the row status text and icon per client state |
| ↳ | | `ps` 36559 | the name sort |
| ↳ | | `At` 36657 | the dialog entry and its selection state |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | `jfo` 1164118 | the `local-jsx` registration: `Manage MCP servers`, `immediate`, `twin` dispatch |

## Behaviour

- **List.** `wt` returns null when no scope has a server. Otherwise it emits scope headings in the order project, local, user, enterprise, managed, agent, then built-in; each scope's servers sort by name (`ps`). The subtitle counts `o.length + W.length` servers as `N server` / `N servers`.
- **Statuses.** `Qo` maps the client state to a status icon and meta text: connected with a tool count (or `no tools`), cached with its cache facts, `reconnecting (m/n)…`, `needs authentication`, `not configured`, `config issue`, or a failure icon when the client reports an error.
- **Detail.** Selecting a row opens the server page with Type, URL, Command, Used by and Status, plus the Authenticate action when the server needs auth, and Back. Escape closes the list; Enter confirms the focused row.

## Host adaptations

- **One scope.** The host keeps one merged `mcpServers` map and a flat `servers()` status record, so the list has one heading set: configured names sorted by name. Tool counts come from the live tool names (`mcp__<server>__<tool>`).
- **Statuses.** The host statuses map directly: `connected` gains its tool count or `connected · no tools`, `reconnecting` gains its attempt count, `disconnected`/`closed` gain `lastError` when present, and a configured server without a connection record reads `not connected`.
- **Actions.** `r` reconnects the selected server through `Runtime.reconnectMcp`; Enter is inert because the host has no per-server detail page. Enable/disable, authentication, agent-scoped servers, claude.ai connectors and built-in servers have no local producer and stay out. Escape closes the panel. An empty catalog prints `No MCP servers configured.` instead of the recovered silent null.
- **Piped.** The existing JSON report remains the non-interactive `/mcp`.

## Validation

- `test/mcp-panel.test.ts`: 3/3 (status wording, sorted rows and subtitle, tool attribution).
- `test/mcp-command.test.ts`: 1/1 (dialog title, subtitle, sorted rows, `r` reconnect, refreshed panel).
- Focused status/context/btw/MCP/interactive/tui/catalog: 145/145.
- Compiled `.audit/w263-mcp.mjs`: 6/6 at identity `0dbe310c…`. A fixture MCP HTTP server answers `initialize` and `tools/list`; `/mcp` shows one configured server with a recovered status word, and Escape returns to the composer.
- `npm run check` and `npm run build` pass. Full suite 3083, 3082 pass, with only the known CLI-effort failure.
