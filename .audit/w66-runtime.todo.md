# W66 runtime trail

## W66-01 acceptance (2026-10-17)

- [x] **Recovered body matched.** `OI` [8488,8667) and `K3t` [7526,7656) in
  `chunk-kexg5hxg.js` double ESC inside DCS for tmux and screen; the port matches.
- [x] **Real tmux decodes.** An outer tmux pane title equals the emitted title.
- [x] **Real screen decodes.** Screen forwards the doubled-ESC payload and the outer tmux parses
  the OSC 0.
- [x] **Both delivery modes.** Source and compiled smokes pass; emitted bytes are hashed.
- [x] **Crash-safe disposition.** Journal-before-effect at-most-once, no replay; exactly-once is
  not provable without a terminal acknowledgment.
- [x] **Gates.** tsc 0, both mux smokes, full 2,090/2,090 at concurrency 2, chain 767/767, notices
  0, index unchanged, identity `bb47c630…`.
- [ ] Remaining C-6 item: full original consumers and script semantics.
