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
