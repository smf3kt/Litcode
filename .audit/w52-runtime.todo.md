# W52 runtime trail

## W52-01 acceptance (2026-10-17)

- [x] **Live contention waits.** A live owner is awaited in 50 ms steps up to `lockWaitMs`.
- [x] **Dead owners are unchanged.** Every wait round still attempts the W47-02 reclaim first.
- [x] **Waiting is abortable.** The operation signal ends the wait with AbortError.
- [x] **Fail-fast remains available.** `lockWaitMs: 0` preserves the previous behavior; the two
  fail-closed lock tests use it.
- [x] **Gates.** tsc 0, worktrees 30/30, full 2,086/2,086, chain 767/767, notices 0, build 0, both
  smokes exit 0, index unchanged, identity `9d611189…`.
- [ ] Remaining C-4 items: capture-correlation crash window, power-loss/GC.
