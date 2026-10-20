# W223 `/hooks`

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

Part of the loop that ports the TUI surfaces behind the composer's slash commands. `/hooks` is
`View hook configurations for tool events`, a `local-jsx` registration with `immediate: true`, and
the last bounded local command left in the input-bar scan.

## What was there

The command did not exist. The state it shows did: `src/hooks.ts` already carries `HOOK_EVENTS`
(33 events), the `HooksConfig` schema and `flattenHookDefinitions`, and `loadProjectConfig` merges
the plugin and settings layers into one `config.hooks`.

## Recovered source

| Module | SHA-256 / offset | Contents |
| --- | --- | --- |
| `chunk-5ggmnm67.js` | sha256 `ea9d9376a5653cc9717c6259d762931644a873dbbb103880bad9c78e5f917776`, `Jd` 61081 | the command entry |
| ↳ | `ft` 58711 | the mode machine: `list`, `select-event`, `select-matcher`, `select-hook`, `view-hook` |
| ↳ | `wo` 39911 | the hook list (`Hooks`) |
| ↳ | `So` 44300 | the event browser (`Hook events`) |
| ↳ | `bo` 44860 | the matcher browser |
| ↳ | `Ho` 45500 | one matcher's hooks |
| ↳ | `Eo` 48222 | the hook detail |
| ↳ | `kn` 51200 / `vn` 51492 | the type tables |
| `chunk-5s0t90hn.js` | sha256 `78fb5ac9b58de2292c2682ae027da0104606e0119919e1d87a6cbce32beafe89`, `igt` 861 | the event metadata table |
| `chunk-n3ykh62m.js` | sha256 `2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac`, `$p` 410486 / `Mx` 409429 | the source labels and the config formatter |
| `chunk-wtch2p0g.js` | `Bbe` 6070 | the matcher source order |
| `chunk-sfn1dbxq.js` | `ETo` 1637903 | the registration, classed `config` in the kind table |

The machine's transitions, read off `ft`:

```js
// list      → view-hook (from "list") | select-event
// select-event → metadata[event].matcherMetadata ? select-matcher : select-hook(matcher: "")
// select-matcher → select-hook ; Esc → select-event
// select-hook  → view-hook (from "events") ; Esc → matcherMetadata ? select-matcher : select-event
// view-hook    → Esc → the surface it came from
```

## Port

- `src/hooks-event-metadata.ts`: the `igt` transcription — 33 events with `summary`, `description`
  and `matcherField` — plus the `$p` source labels with the readers `SPn`/`H4t`/`O4t`, and `Bbe`.
- `src/hooks-panel.ts`: `pluralize` (`I`), `escapeHookText` (`ep`), `hookConfigText`/`hookConfigLabel`
  (`Mx`/`C0`), `hookDetailTitle` (`kn`), `hookConfigKindLabel` (`vn`), `hookGuidance` (`gn`),
  `hookListSubtitle` (`wo`'s subtitle), `hookEventSubtitle` (`So`'s), `hookMatcherLabel`/
  `hookMatcherTitle`/`hookEventHooksTitle`, the four request builders, `attributeHooks`, and the
  `browseHooks` driver over the recovered mode machine.
- `src/interactive.ts`: the `/hooks` branch, `hookSettingsLayers` (re-reads the three settings
  layers through `permissionSettingsPaths`) and `hooksReport` (the piped-session text form).
- `src/tui-autocomplete.ts`, `COMMAND_HELP` and `README.md`: the command row with the recovered
  description, in the `config` lane.

## Adaptations and what stays out

- **The source is reconstructed, not read.** The recovered model carries a `source` per hook. This
  host merges the plugin declarations and every settings layer into one `config.hooks`, so
  `attributeHooks` walks the merged entries and gives each to the first layer that declares the same
  entry (compared by `JSON.stringify` of the parsed entry, which is merge-stable because both sides
  come from the same schema), then gives the remainder to `pluginHook` — which is where the
  recovered merge puts plugin declarations. A layer cannot match twice for one entry.
- **`restrictedByPolicy` is always false.** The recovered flag is
  `fe("policySettings")?.allowManagedHooksOnly === true`; this host has no such policy key, so the
  list is never narrowed to managed hooks.
- **No `Status message` row.** The local `HookDefinition` has no `statusMessage`, so `C0`'s first arm
  and the detail's status row are unreachable here.
- **`Mx`'s extra arms collapse.** The recovered command hook carries `args` and the MCP hook carries
  `server`; this host's carry neither, so those arms read the single field the local schema has. A
  `callback` hook shows its `name` rather than the recovered literal `callback`.
- **The recovered `values` arrays are dropped** from the metadata table: they are the candidate
  values for `matcherField`, and the dialog never renders them.
- **Out with the surfaces that need absent state:** the cloud-session panel and its consent flow
  (`cloudSessionPanel`/`onDecideCloudHooks`), `suspendedBySafeMode`, and the policy-restricted list
  arm. The `All events` row and the empty states are kept.
- **The piped form is a local addition.** The recovered command is `local-jsx` only; without a modal
  surface the branch prints `hooksReport`, as `/help` does.

## Verification

- `test/hooks-event-metadata.test.ts` (8 tests): the table covers the local inventory exactly, every
  event carries a summary and contract, a multi-line contract keeps its breaks, the matcher field is
  present only where declared, quoted contracts survive, the seven source labels and their three
  readers, and the source order.
- `test/hooks-panel.test.ts` (16 tests): the formatters, both type tables, every guidance arm, the
  two subtitles, the list/events/matchers/hooks/detail builders including their empty states,
  attribution across layers with a duplicate declaration and a matcher group, and the browse machine
  walking `list → events → matchers → hooks → detail → back`, the list-origin return, and the
  matcher-less shortcut.
- Full suite 2897/2897 (118 suites), `npm run check` and `npm run build` clean.
- Compiled probe `.audit/w223-hooks.mjs` passes 8 checks over the real CLI against a workspace whose
  `.harness/settings.local.json` declares two hooks: the list reports `2 hooks on 2 events` and shows
  both config texts; the first row opens `Command hook` with `PreToolUse · Bash`, the source line and
  `edit <file> or ask Claude`; `Esc` returns to the list; `All events` opens `Hook events` with
  `33 events · 2 with hooks` and the event summaries; `Esc` twice dismisses the panel.
