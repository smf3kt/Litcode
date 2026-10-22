# W270 `/plugin` Installed list

The `/plugin` command (`plugins`, `marketplace` aliases) over this host's local plugin store.
Offsets are zero-based UTF-16 code units, ranges half-open.

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-tw1h5pks.js` | `a2e774c2edf6cae411ba63eaf5ce554b8f92d00ed5ab9597311e7bc36d2990f7` | `fc` `[216895,218065)` | the Installed tab list: `Installed plugins:`, `  • <id> (<version>, <scope>) <status>`, `No plugins installed. Use \`/plugin install\` to install a plugin.`, `No <filter> plugins.` |
| ↳ | | `yc` 218065 | the empty branch after the list |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | `AKt` 3875439 | the `v<version>` cell, first real version wins |
| ↳ | | `PTo` 1639556 | the `local-jsx` registration: `plugin`, aliases `plugins`/`marketplace`, `Manage Claude Code plugins` |
| `chunk-9faebf06.js` | `05dc8be6308fb078c23c776e87c1a39ab504b760a3fd881448ef3d73acec2631` | `p` 14002, `g` 14154 | the `list --enabled/--disabled` filters and the marketplace actions |
| `chunk-04v7vxqn.js` | glyph table | `te` 7714 | `✔` / `✘` for the status cell (already ported as `src/tui-symbols.ts`) |

## Behaviour

- **Rows.** `fc` sorts the installed ids, then prints `  • <id> (<version>, <scope>) <status>` with
  the status one of `✔ enabled`, `✘ disabled`, `✘ failed to load`. The version cell is `AKt`'s
  `v<version>` and is omitted when no candidate resolves.
- **Empty.** No installed plugins prints `No plugins installed. Use \`/plugin install\` to install
  a plugin.` A filter that removes every row prints `No <filter> plugins.` instead.
- **Filter.** `list --enabled` keeps enabled rows, `list --disabled` keeps the rest, and the panel
  key walks all → enabled → disabled → all.

## Host adaptations

- **Store.** The vendor reads `installed_plugins.json` with several scopes and a synced layer; this
  host reads its one workspace store, `.harness/plugins`, through the new `readPluginStore` in
  `src/plugins.ts` (same `load`/`snapshot`/digest verification as `plugin_list`). Every row is
  therefore `project` scope.
- **Enabled state.** The vendor resolves enable/disable per plugin from settings; this host has one
  global `plugins.enabled` gate, so every row shares it. A row whose tree no longer matches its
  index digest is `failed to load`, the host's counterpart of the vendor's load-error rows.
- **Filter key.** The vendor's `filter` prop arrives from the `/plugin list` argument; the modal
  surface also offers the same cycle on `f`, because the host dialog has no separate argument
  step once it is open.

## Not ported

- The `enable`, `disable`, `install`, `uninstall`, `configure` and `update` arms: this host has no
  per-plugin enable list and no marketplace client, and the store's mutating tools stay
  model-facing. A typed arm other than `list` is refused with `Use /plugin list
  [--enabled|--disabled]`.
- The Discover tab, the marketplaces tab, the Errors tab, the Stats tab and the details page.
- The `directory` and `stats` top-level completions, whose producers are absent here.

## Validation

- `test/plugin-panel.test.ts`: 6/6 (version label, row label and its 100-unit cut, status
  precedence, sorted body and empty text, both filters, and the store reader over two installs plus
  an out-of-index edit and the disabled gate).
- `test/plugin-command.test.ts`: 7/7 (the panel body and title, both aliases, the empty store, the
  `f` cycle through all three states, a gated store, the piped text list, and the refused arm).
- `test/command-aliases.test.ts` 4/4 and `test/tui-autocomplete.test.ts` 28/28 with the two new
  aliases; focused plugin/usage/MCP/alias/autocomplete 44/44.
- Compiled `.audit/w270-plugin.mjs`: 10/10 at identity `3df4a74f…` (two installed packages listed
  with version, scope and state; title, hint key, Escape, both aliases, refused arm, clean exit).
- `npm run check` and `npm run build` pass. Full suite 3115, 3114 pass, with only the known
  CLI-effort failure.
