# W120 runtime trail

## W120-01 acceptance (2026-10-18)

- [x] **Source read.** The REPL gate texts, the seed walk with its skip set and
  truncation units, and the spawn core's fork-before-spawn ordering and failure
  cleanup.
- [x] **Port.** The seed function over local messages, the fork-then-spawn
  module, and the interactive command with resume guidance.
- [x] **Bounds.** Always-persisted sessions, no session job registry, no
  snapshot V5 or worktree briefing, completed-history fork point, local CLI
  arguments only.
- [x] **Gates.** focused 50/50, extended 86/86, tsc 0, build 0, full
  2,177/2,177, chain 768/768, notices 0, source index unchanged, identity
  `5824092a…`.
- [ ] Remaining C-7: cross-session discovery remains external.
