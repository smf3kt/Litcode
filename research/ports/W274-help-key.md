# W274 `?` opens the help panel

The composer's own shortcut key, and the idle footer row that advertises it. Offsets are
zero-based UTF-16 code units, ranges half-open.

| Module | SHA-256 | Offset | Contents |
| --- | --- | --- | --- |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | 880989 | the input handler's `?` branch: an empty draft opens help instead of typing |
| ↳ | | 871712 | `aw`: the opener that records `tengu_help_toggled` and calls `Nn(e8t)` |
| ↳ | | 815713 | `QE`: the gate that closes the panel on escape or backspace with an empty query |
| ↳ | | 762242 | `LVe`: the footer that draws the idle indicator |
| ↳ | | 765495 | the `Ei` chain's last arm, `M && !Jn ? "shortcuts" : "none"` |
| ↳ | | 766656 | the row itself, `? for shortcuts` |
| ↳ | | 789074 | `s2`: the predicate that hides every other indicator while help is open |

## Behaviour

- **The key.** `Zv`'s insert path normalises the character, then, before `typeText`, tests
  `sc.key === "?" && ee.value === ""`. An empty draft opens the help panel; a non-empty draft
  types the character. The branch runs before the editor sees the key, so nothing is inserted.
- **The toggle.** `dw` is `aw`, which emits `tengu_help_toggled` and calls `Nn(e8t)` — the same
  setter the panel's own `onClose` uses, so the panel and the footer share one flag.
- **The close.** `QE` clears the flag on escape or backspace when the query is empty, and also
  when `K1e` sees a delete key. That is the panel's cancel, not a second press of `?`.
- **The footer.** `LVe`'s `Ei` chain ends with `M && !Jn ? "shortcuts" : "none"`, where `M` is
  `showHint` and `Jn` is the live help flag; the row is `? for shortcuts`. `s2` gates every other
  indicator on `!helpOpen`, so the row is the only indicator the idle footer shows.

## Host adaptations

- **The gesture is not a keybinding.** `?` is not in the recovered binding table; it is a branch
  in the input handler. `TuiTerminal` therefore matches it on the decoded `insert` action in
  `push`, before `dispatch`, rather than adding a chord to `KEY_BINDINGS`. Vim mode is untouched:
  a NORMAL-mode `?` still reaches the Vim state machine, which is what the source's own Vim gate
  does.
- **The panel is the existing one.** `browseHelp` already renders `G`'s three tabs for `/help`;
  the key emits `app:toggleHelp`, which the interactive loop maps to the same builder through
  `openHelpPanelLive`. A second request while the panel is open is dropped instead of stacking.
- **The footer row is additive.** The recovered `Ei` chain has six other indicators this host
  does not have, so `? for shortcuts` leads the local navigation hints instead of replacing them.
  The half-width clip would otherwise cut `ctrl+o transcript` down to `ctrl+o`, so the row is
  dropped below a 23-cell half-row and the local hints stand alone.
- **Not ported.** The `tengu_help_toggled` event, the `useHelpOpen` store, and the
  `inputOwnsEscape` handshake that lets the panel take escape from the editor.

## Validation

Unit 82/82 (`test/tui.test.ts`, two new tests: the empty-draft branch and the footer's two
widths); focused help/interactive/keys 37/37; full suite 3153/3154 with the known
`cli-migration` effort failure at HEAD. Compiled 10/10 at identity `947f4a82…`: the idle footer
names the row, `?` opens the panel on `[General]` with the recovered shortcut table, escape
closes it and the footer returns, and a non-empty draft keeps `?` as text.
