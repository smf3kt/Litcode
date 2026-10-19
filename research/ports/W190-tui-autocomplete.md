# W190 composer slash suggestions

Status: implemented locally on `work/w43-choice-preview`. Ports the recovered composer
suggestion list into the product TUI as `src/tui-autocomplete.ts` plus its seams in
`src/tui.ts` and the catalog wiring in `src/cli.ts`. No push, no upstream calls.

## Source coordinates

Zero-based UTF-16 half-open ranges; digests are SHA-256 of the extracted module.

| Module | Digest | Symbol and range |
| --- | --- | --- |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | `Wre` [507454,507979) row builder, `U0` [507979,509573) filter/order, `LK` [510169,510842) accept, `mse` [569848,592289) key semantics |
| `chunk-qfjvvwpv.js` | `116de8fc147859476928cc4bb1a0c61d1a54b1373f46eb01bfee91349e1b2504` | `ze` [4084,8770) row component, `iEe` [8770,10298) window and padding |
| `chunk-6ccen3s8.js` | `4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d` | `Autocomplete` context bindings, already transcribed at `src/tui-keys.ts:103` |

## Ported bodies

`commandSuggestions` adapts `U0`: the slash-token gate, the empty-prefix bucket order
(first five skills, then local commands, then the remaining prompts), the non-empty
search, and the `suggestionsEmptyMessage` gate. `suggestionWindow` and
`maxVisibleSuggestions` adapt `iEe` (`max(1, min(max(6, floor(rows/2)), rows-3))`).
`layoutSuggestionRows` adapts `ze`'s command branch: pointer lane, the display text
padded to a common column, then the description when the row has space, truncated
otherwise. `acceptanceText` adapts `LK`: `/<name> ` at the cursor end, an alias
spelling when the match came from an alias. Key semantics follow `mse`: Tab accepts
without submitting, Enter accepts and submits only for a local command or an
argument-less prompt command, Escape dismisses, arrows and ctrl+n/ctrl+p move the
selection, and an edit keeps the selected row by id.

## Adaptations and excluded source surface

- **Catalog.** The source receives `commands` as a prop. This product's table is
  transcribed from `COMMAND_HELP` one-to-one (a test asserts both directions) and
  extended with `session.config.skills` entries that are user-invocable and whose name
  does not shadow a local command. The vendor command set is not copied.
- **Search engine.** The source calls its fuzzy `search` with a prompt score boost.
  This port scores exact, prefix, substring and subsequence over the full name and its
  segment after `:`, adds 25 for skills, and sorts by score then name. The empty-prefix
  bucket order is kept, but the source's "top five scored prompt skills" becomes the
  first five skills alphabetically because the source's static score table is not
  available locally.
- **Default selection.** Source `Gre` leaves a non-prefix fuzzy match unselected
  (`-1`). This port selects row 0 so Enter always has a target.
- **Rendering.** `ze`/`iEe` render ink rows with lanes, source tags and mouse hit
  targets. This port emits raw ANSI rows (bold selected row, dim the rest) through the
  composer frame's progress band, directly above the prompt, so `iEe`'s multi-line row
  accounting is unnecessary. The pointer glyph is `te.pointer` from
  `src/tui-symbols.ts`. Mouse hover/click, `keepWindow`, the overlay expansion and the
  kind/source lanes are not ported.
- **Providers not ported.** Slack channels (account sync, excluded), MCP resources and
  templates, file/directory, `@agent`, emoji, resume titles, shell history and
  mid-command arguments. Only the command/skill list is ported.
- **`/model` chooser.** The source picker's option list is the vendor model catalog
  with account entitlements, which the local-only constraint excludes, so the existing
  local chooser stays. It now opens with `defaultIndex` on the current model (source
  `defaultValue`/`selectedValue`) and its option list also carries skill-declared
  models, a local source the earlier list missed.

## Validation

- `test/tui-autocomplete.test.ts` 14/14: catalog/`COMMAND_HELP` parity, token gate,
  bucket order, ranking, alias and segment matching, argument-less accept, shadowing,
  the no-match message, window math, row layout, and the composer through a headless
  terminal for list open, prefix filter, Tab, Enter, Escape, arrows and ctrl+n/ctrl+p.
- Affected suites: `tui`, `tui-scope-picker-frame` (+`-tui`, `-scoped`), `tui-welcome`,
  `tui-custom-theme-reader`, `question-images-tui` 102/102; `interactive`,
  `cli-migration` 28/28. `npm run check` and `npm run build` clean.
- Compiled PTY (`dist/cli.js`, private HOME/XDG/userDir/workspace, unreachable loopback
  gateway, `--no-inherit-gateway`, driver
  `/Users/mant1ssa/.claude/jobs/c9c17d97/tmp/tui-autocomplete-probe.mjs`): `/` draws the
  list with the pointer on the first row, `/mo` narrows it to model, demo-skill,
  mcp-reconnect and permissions, Tab leaves `/model ` with nothing submitted, Enter
  opens the local Model chooser listing the fixture model and the skill-declared
  `fixture/skill-model` with the pointer on the current model, and `/exit` exits 0. No
  provider request is issued.

Raw samples stay unchanged; no recovered entrypoint is executed.
