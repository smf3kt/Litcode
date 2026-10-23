# W271 `/reload-plugins`

The `/reload-plugins [--force]` command over this host's local plugin store. Offsets are
zero-based UTF-16 code units, ranges half-open.

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | `MTo` 1639842 | the `local` registration: `reload-plugins`, `Activate pending plugin changes in the current session`, argument hint `[--force]`, `supportsNonInteractive`, `thinClientDispatch: "control-request"` |
| `chunk-x876fw6t.js` | `82f072d959103651ec4007a02691e4b1883602213581c89d88809dca574beef2` | `Re` 16550 | `/reload-plugins isn't available over a remote connection in this session.` |
| ↳ | | `we` 16629 | `Plugin MCP server changes take effect in your next session.` |
| ↳ | | `Yr` 16694 | the body: declined gate, force parse, server diff, reload, summary |
| ↳ | | `r` 17347 | the force token: `--force` or `force` anywhere in the trimmed split |
| ↳ | | `h` 18376 | `Reloaded: N plugins · N skills · N agents · N hooks · N plugin MCP servers · N plugin LSP servers` plus the load-error line |
| ↳ | | `Ee` 19098 | `!isNonInteractiveSession \|\| bot(options)` |
| ↳ | | `Q` 19162 | the cache-warning gate |
| ↳ | | `l` 19417 | `<count> <noun>` |
| ↳ | | `Z` 19456 | `This reload changes MCP tools (…) … Run /reload-plugins --force to apply.` |
| `chunk-xrjhyksm.js` | `8c426459e3b62c20041beb8c0cd44943aac373bad15744d92b060e79d68a9d12` | `bot` 1603 | `submittedOnLocalStdin === true && !UF(e)`; `UF` 1512 is `dispatchedOverBridge === true \|\| submissionVerifiedSlackHumanTurn === true` |
| `chunk-ax7r0qj7.js` | `8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e` | `I` 798 | `t === 1 ? n : n + "s"` |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | `Nee` 197841, result at 200285 | the reload result: `enabled_count`, `skill_count`, `agent_count`, `hook_count`, `mcp_count`, `lsp_count`, `error_count` |
| ↳ | | `Gte` (in `chunk-sfn1dbxq.js` 387493) | ` (+ N dependencies: …)`, appended when the reload resolves dependencies |
| `chunk-3cynezh1.js` | `c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3` | `Nn` 311185 | the display name `Z` prints for a single changed server |

## Behaviour

- **Gate.** `Ee` refuses a non-interactive session unless the prompt arrived on the process's own
  stdin (`bot`). A refused session prints the declined line instead of reloading.
- **Force.** A `--force` or `force` token skips the cache-warning stop; it also makes the body skip
  the second diff it would otherwise take after resolving dependencies.
- **Cache warning.** `Q` compares the resolved MCP server sets and the LSP tool's presence. In an
  interactive session any added or removed server warns; an LSP-only change warns too. A
  non-interactive session warns only for an LSP change. Without `--force` the warning is the whole
  output and nothing is applied; with `--force` it is appended after the summary.
- **Summary.** `h` counts `enabled_count` plugins, `command_count + skill_count` skills, agents,
  hooks, plugin MCP servers (interactive only), plugin LSP servers, then ` (+ …)` for resolved
  dependencies and a `N errors during load. Run /plugin for details.` line when any load failed.
- **Pending note.** A non-interactive session whose MCP set changed gets
  `Plugin MCP server changes take effect in your next session.` after the summary.

## Host adaptations

W299 adds explicit runtime reconfiguration before binding the successor, so applying plugin state replaces connected resources as well as pinned catalogs. Preflight and pure observers do not adopt hooks. Both accepted reload paths await hooks before SessionStart, including watchConfig. Counts use only active installed plugins. Warning and failed replacement/bind retain the old resource owner. See [W299](W299-plugin-toggle.md).

- **Session.** The source keeps the current session and patches the live plugin store in place.
  This host's catalogs are pinned on the session config, so the rescan goes through the same
  successor-session path `/reload` uses (`applyConfig`), which re-reads the store, re-merges plugin
  skills/agents/hooks/servers and starts a resumed session.
- **Declined arm.** This host has no remote bridge. A runtime without `reconfigure` is the
  counterpart of the source's thin-client session, and prints `RELOAD_PLUGINS_DECLINED` rather than
  throwing.
- **Server diff.** Plugin servers are named `<plugin>/<server>` by the store; the source compares
  `plugin:<plugin>:<server>` ids. `pluginServerIdentities` reduces both to `{plugin, name}`, so a
  spelling difference is not a change.
- **Counts.** `errors` is `pluginComponentDiagnostics`, now carried on the session config by
  `reloadConfig`. `lspServers` is 0: plugin manifests in this host declare no LSP servers, so the
  loader never adds one. Hooks and MCP servers are counted from
  `discoverInstalledPluginComponents`, which is the loader's own set, not every configured row.
- **Non-interactive.** `nonInteractive` is `!terminal?.prompt`; this host has no separate headless
  command surface for the loop, so a piped session is the non-interactive case.
- **Dependency line.** `Gte`'s ` (+ N dependencies: …)` needs the source's dependency resolution,
  which this host's store does not perform; no line is printed.

## Not ported

- The remote arm (`ll()` → `sendControlRequest({subtype:"reload_plugins"})` and
  `Reloaded on remote: …`). This host has no remote control channel; the declined line covers it.
- The folder re-read notices `Ce`/`Pe` (`xe` compares `readFromFolderAt` stamps) and the
  `markNeedsRefresh` / `Gte(s.installed) installed but not applied` path, whose producers are the
  vendor's folder-cache layer.
- The marketplace-unreachable notice (`The <marketplace> could not be reached …`).
- The `tengu_reload_plugins_cache_impact` telemetry (`mjt`).

## Validation

- `test/reload-plugins.test.ts`: 9/9 (pluralizer, force parse, both summary shapes, the pending
  note, both cache-warning forms, the no-warning cases, server identity reduction, the LSP flip,
  the declined line).
- `test/reload-plugins-command.test.ts`: 7/7 (store counts, empty store, declared skill/agent
  counts, refused bare argument, `--force`, the declined runtime, the late-MCP warn-then-force
  flow).
- `test/tui-autocomplete.test.ts` 28/28 and `test/command-aliases.test.ts` 4/4 with the new row;
  focused reload/plugin/alias/autocomplete 66/66.
- Compiled `.audit/w271-reload-plugins.mjs`: 8/8 at identity `b296571b…` (summary over two
  installed packages with one skill, the session survives, `--force`, the composer row and its
  description, the refused arm, clean exit).
- `npm run check` and `npm run build` pass. Full suite 3131, 3130 pass, with only the known
  CLI-effort failure.
