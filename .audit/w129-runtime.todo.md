# W129 runtime trail

## W129-01 acceptance (2026-10-17)

- [x] **Source read.** `Hee` compact branch, theme order, 58-cell rows, version placement.
- [x] **Port.** `src/tui-welcome.ts` with exact light/dark rows and compact line.
- [x] **Wiring.** Empty-transcript header in `TuiTerminal.render()`, cached renderer, released
  on close; `version` passed from `cliVersion()`.
- [x] **Unit tests.** Dark 16 rows, light starless art, compact single line.
- [x] **Live PTY.** 120x40 full art, 80x24 compact line, header gone after one message.
- [x] **Gates.** Focused 75/75, tsc 0, build 0, notices 0, index unchanged.
- [ ] Apple_Terminal `V` variant remains out (documented adaptation).
- [ ] Header text is fixed to the product name; no configurable welcome message.
