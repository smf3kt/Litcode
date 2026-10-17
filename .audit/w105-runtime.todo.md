# W105 runtime trail

## W105-01 acceptance (2026-10-18)

- [x] **Source read.** Both output schemas, both consumers, the TUI consumer,
  the formatter, the decision mapping and the internal-suppression paths.
- [x] **Port.** Field parse, block-message renderer, decision support for both
  prompt events, automatic suppression for internal blocks.
- [x] **Bounds.** Ordinary exit 2 keeps the prompt; no warning message is added
  to the event log.
- [x] **Gates.** focused 88/88, tsc 0, build 0, full 2,143/2,143, chain
  767/767, notices 0, source index unchanged, identity `3319a5a3…`.
- [ ] Remaining C-6: SessionStart `retry` and the rest of the script semantics.
