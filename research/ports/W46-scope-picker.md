# W46 — the scope-picker frame

## Sources

| module | sha256 |
| --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 |
| chunk-06azbynj.js | 5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd |
| chunk-x90vmw14.js | 2c126986038d8ecb93fd6b25b601b3455f481aaa9064ea3af815dfb1fc02ee6d |

## W46-01 ported the frame and the row list (2026-10-17)

Six blocks are copied verbatim (8,409 UTF-16 units) into `tui-scope-picker-frame-source.ts`:
`FLt` with the limits `TBe`/`MBe`/`DBe` [605350,605389), `gLt` [605389,611517), `Vse`
[611517,613200) and `pHe` [613200,613266) from chunk-24k7d6mw.js; the clamp `ad` [200495,200579)
from chunk-06azbynj.js; the empty-state block `fo` [757,1166) from chunk-x90vmw14.js.

The frame owns the focus and window in one state object. The visible count is
`max(2, min(visibleCount, rows - 10 - (matchLabel ? 1 : 0)))`; the items are sliced to the window.
Up/down (and ctrl+p/n) move the focus by one, pageup/pagedown by the visible count, return selects
the focused item, and tab runs the tab action or selects. Every other key goes to the search hook.
A query change reports the query and resets focus, window and hover; an item change clamps both; a
reset key clears both. The preview sits right of the rows when asked and below them otherwise; under
120 columns the enter hint is the first word of the select action. The hint row is a dim Text around
an inline row of key hints, and the frame is a permission-colour Box with the wheel handler.

`Vse` draws the empty-state block, or one clickable row per visible item with focus, the
declare-cursor flag, the scroll markers by direction, the stray-click guard, hover reporting and a
mouse-leave reset. `ad` clamps into an optional range, `pHe` takes the first word of an action, and
`fo` draws the empty text with an optional hint.

## Host boundary

`src/tui-scope-picker-frame-host.ts` supplies the seams the copied bodies read: the terminal-size
hook `ke` (from the input-field seam), the terminal-focus and declare-cursor contexts (`Qc`, `nt`),
the search input hook `_y` (injectable; the default keeps query and cursor in hook state and edits
by key and paste), the stray-click guard `aS`, and the visual tokens `z`, `Se`, `es`, `rS`, `_C`.

The recovered frame calls its state setter with an updater function. The shared hook seam `y` in
`plugin-chain-react-hooks.ts` previously stored the function itself, so the picker state read
undefined; it now follows React's functional-update semantics, and a test pins that form.

## Verified

`.audit/w46-01-probe.txt` measured the limits, labels, layout, movement, wheel, search editing, the
row markers, the click guard and hover before the tests asserted them. 25 new tests. tsc 0, copy
scan declared 145 / unresolved 0, notices 0, chain family 767/767, full 2,068/2,068, index 75
chunks / 323,525 units (3.0%), identity `ea5a3a68…`.

Next: mount this frame in the product picker (C-2a integration) and rerun the picker entry tests.

## W46-02 mounted the frame in the product TUI (2026-10-17)

The same six blocks are generated a second time against the product runtime:
`tui-scope-picker-frame-tui-source.ts` imports hooks from `tui-react-runtime.js`, elements from
`tui-jsx.js`, and Box/Text plus the host seam from `tui-scope-picker-frame-tui-host.ts`.

Host seams: `w`/`b` keep the compiler memo cache in one `useMemo` slot per call site with the React
sentinel; `ke` returns the picker's current column/row budget; `Qc` and `nt` are focus and
declare-cursor contexts; `_y` is injectable and the picker injects its query and caret before each
host render; `aS` is the 300ms stray-click guard. The visual primitives (`z`, `Se`, `es`, `rS`,
`_C`) draw with Box/Text and drop interaction props, because the document renderer's tree has no
focus manager and the picker routes keys itself. The hint row uses compact labels (`Enter select`,
`Esc cancel`, `Ctrl+S scope`, and `↕` for movement) so it fits a 40-column projection.

The picker integration: `pickerFrameProps` now calls the recovered frame with the source consumer's
props (draft query, scope reset key, `select` action, scope hint), and `ScopePicker.frameElement`
sets the frame size and the search hook before the host render. The preview height follows the row
budget (`min(8, rows - 5)`) so a ten-row projection keeps the hint row.

Verified: `test/tui-scope-picker-frame-tui.test.ts` 5/5, `test/scope-picker.test.ts` 2/2, full
2,073/2,073, chain 767/767, tsc 0, both generated copies unresolved 0, notices 0, identity
`6e8c48df…`.

## W46-03 made the recovered frame the ScopedPicker frame (2026-10-17)

The W46-02 frame was mounted only in the test-facing `ScopePicker`; the class both terminal hosts
actually use is `ScopedPicker`. It now renders the same `gLt`/`Vse` element through its
persistent document tree and projects the rows twice: `frame()` pads plain text for the tests and
`styled()` returns the ANSI cells the TUI and line painters draw. The frame owns `{focus,window}`.

The document tree has no focus manager, so the frame's only key handler, which rides on its search
field (`rS` receives `props.onKeyDown` = `zr`), is captured at the host seam. `dispatchFrameKey`
replays the frame's own key events, so movement stays the source's: up is focus+1 under
`direction:"up"`, down is focus-1, ctrl+p/n match, and pageup/pagedown move by
`Bo = max(DBe, min(TBe, rows - MBe)) = max(2, min(8, rows - 10))`. `onFocus` reports the focused row
back and the picker mirrors it into its cursor, so the drawn marker, the picker selection and the
accepted row are one state; `move` and `page` clamp rather than wrap.

A query or scope change changes the host element key (`scope\0query`), which remounts the host
component, the host-tree equivalent of the source query handler resetting `{focus:0,window:0}`.
The scan mutates its row array in place while the frame memo compares `items` by identity, so each
render passes a fresh slice; without it the frame kept a stale empty window.

Host key mappings in `src/tui.ts` and `src/terminal.ts` follow the source mapping, including raw
`\x1b[5~`/`\x1b[6~` paging. The preview height fits the frame budget so a ten-row projection keeps
the hint row.

Verified: `test/tui-scope-picker-frame-scoped.test.ts` 5/5, `test/picker-entry.test.ts` 2/2 in
both modes, chain family 767/767, full 2,078/2,078, build 0, tsc 0, both generated copies
unresolved 0, notices 0, index 75 chunks / 323,525 units, identity `e8177e84…`.
`scripts/smoke-input-history.mjs --search-chain` passes in TUI and `--line` modes; its walk
targets the focused row, because a visible row in the frame window is not necessarily the focus.
