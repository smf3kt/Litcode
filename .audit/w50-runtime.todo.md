# W50 runtime trail

## W50-01 acceptance (2026-10-17)

- [x] **The archive rename has a durable intent.** The intent is written and fsync'd before the
  rename, with origin, checkout, history, archive, dev/ino and pid.
- [x] **Recovery is provable-state only.** Restore an archive into an unchanged checkout; clear a
  completed, already-home, or never-archived intent; retain ambiguous states with a warning.
- [x] **Live owners are skipped.** A pending intent whose pid is alive is left alone.
- [x] **Startup is not blocked.** Interactive start reports restorations and warnings and carries on
  when recovery throws.
- [x] **Gates.** tsc 0, worktree-session 4/4, full 2,084/2,084, chain 767/767, notices 0, build 0,
  both worktree smokes exit 0, index unchanged, identity `6fb4abe8…`.
- [ ] Remaining C-4 items: worktree archive picker, concurrent new-lock race, capture-correlation
  crash window, power-loss/GC.
