# W130 runtime trail

## W130-01 acceptance (2026-10-17)

- [x] **Source read.** `V` light/dark bodies, 12 shared rows plus four variant rows.
- [x] **Port.** `appleArt` in `src/tui-welcome.ts` with exact quarter-block rows.
- [x] **Wiring.** `termProgram` option, equality branch, cache key, CLI environment pass-through.
- [x] **Tests.** Two themes, 16 rows, quarter-block body, no generic body.
- [x] **Live PTY.** 120x40 with `TERM_PROGRAM=Apple_Terminal` shows `V`; without it the generic art stays.
- [x] **Gates.** Focused 76/76, tsc 0, build 0, notices 0, index unchanged.
- [ ] Other terminals' art differences remain uninvestigated.
