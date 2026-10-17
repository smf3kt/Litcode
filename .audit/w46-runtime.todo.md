# W46 runtime acceptance

## W46-01 acceptance (2026-10-17)

- [x] **The frame layout is the source layout.** Title, search, windowed rows, match label, preview by position, and the hint row with the narrow-terminal chord collapse.
- [x] **The focus and window move by the source rules.** Up/down and ctrl+p/n by one, pageup/pagedown by the visible count, return selects, tab runs its action or selects.
- [x] **The wheel moves the window and stops the event.** The sign flips with the direction; a zero delta does nothing.
- [x] **The search hook edits and resets.** Typing, backspace, delete, left/home/end and paste edit the query; a query change reports it and resets focus, window and hover.
- [x] **The row list owns no state.** Empty state, focus, declare-cursor, direction markers, the 300ms stray-click guard, hover and mouse-leave.
- [x] **Sweep.** tsc 0, copy `declared 145 / unresolved 0`, notices 0, new suite 25/25, chain family 767/767, full 2,068/2,068, index 75 chunks / 323,525 units, identity `ea5a3a68…`.
