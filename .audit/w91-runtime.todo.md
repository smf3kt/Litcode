# W91 runtime trail

## W91-01 acceptance (2026-10-18)

- [x] **Source read.** `kTn`, the eager loop and `KZn`, the path-access call
  site, and the schema enumerations.
- [x] **Port.** Per-file eager and path-access raises with the recovered field
  set and reasons.
- [x] **Bounds.** One Project tier; eager reason fixed to `session_start`;
  uncompacted reasons not tracked.
- [x] **Gates.** agent-lifecycle 34/34, tsc 0, build 0, full 2,120/2,120, chain
  767/767, notices 0, source index unchanged, identity `87bbcc5c…`.
- [ ] Remaining C-6: full consumers.
