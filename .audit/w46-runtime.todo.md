# W46 runtime acceptance

## W46-01 acceptance (2026-10-17)

- [x] **The frame layout is the source layout.** Title, search, windowed rows, match label, preview by position, and the hint row with the narrow-terminal chord collapse.
- [x] **The focus and window move by the source rules.** Up/down and ctrl+p/n by one, pageup/pagedown by the visible count, return selects, tab runs its action or selects.
- [x] **The wheel moves the window and stops the event.** The sign flips with the direction; a zero delta does nothing.
- [x] **The search hook edits and resets.** Typing, backspace, delete, left/home/end and paste edit the query; a query change reports it and resets focus, window and hover.
- [x] **The row list owns no state.** Empty state, focus, declare-cursor, direction markers, the 300ms stray-click guard, hover and mouse-leave.
- [x] **Sweep.** tsc 0, copy `declared 145 / unresolved 0`, notices 0, new suite 25/25, chain family 767/767, full 2,068/2,068, index 75 chunks / 323,525 units, identity `ea5a3a68…`.


## W46-02 acceptance (2026-10-17)

- [x] **The frame renders inside the product document tree.** The same six blocks are generated against the TUI runtime; the picker's `pick()`/`frame()` shows title, rows, focus marker, search and hints.
- [x] **The host seams are explicit.** Memo cache, terminal size, focus and cursor contexts, injected search hook, stray-click guard and interaction-free visual primitives.
- [x] **The replacement frame is gone.** `pickerFrameProps` calls the recovered frame with the consumer props; the draft query seeds it.
- [x] **The narrow projection fits.** Compact hint labels and a budget-shaped preview keep `Ctrl+S scope` visible at 40x10.
- [x] **Sweep.** tsc 0, both copies unresolved 0, notices 0, 5/5 new, scope-picker 2/2, chain 767/767, full 2,073/2,073, identity `6e8c48df…`.


## W46-03 acceptance (2026-10-17)

- [x] **The frame is the ScopedPicker frame.** The class both terminal hosts use renders the recovered `gLt`/`Vse` element through the persistent document tree.
- [x] **The frame owns focus and window.** Host movement dispatches the frame's own keys; `onFocus` mirrors the focused row into the picker cursor, and movement clamps instead of wrapping.
- [x] **The source reset is preserved.** Scope and query changes remount the host component; a fresh item slice per render keeps the identity-based memo in step with the scan.
- [x] **Both projections work.** `frame()` pads plain text and `styled()` returns ANSI cells; the TUI keeps the hint row in the footer and line mode draws the same rows.
- [x] **The real CLI walks the focus.** `--search-chain` accepts the folded paste row with tab, rebases a new paste onto it, and passes in TUI and `--line` modes.
- [x] **Sweep.** tsc 0, both generated copies unresolved 0, notices 0, 5/5 new, picker entry 2/2, chain 767/767, full 2,078/2,078, build 0, identity `e8177e84…`.
