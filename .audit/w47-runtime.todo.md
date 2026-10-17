# W47 runtime trail

## W47-01 acceptance (2026-10-17)

- [x] **The four MCP lifecycle items are decisions.** CURRENT and FEATURES cite
  [remaining-dispositions.md](../research/ports/remaining-dispositions.md) items 1/2/5/7.
- [x] **No behavior changed.** No product file was touched and no recovered entrypoint ran.

## W47-02 acceptance (2026-10-17)

- [x] **A dead owner's lock is reclaimed.** The store writes `harness worktree store (pid N)`; on
  EEXIST a matching reason naming an ESRCH pid allows one reclaim-and-retry.
- [x] **Live and foreign locks fail closed.** Own pid, live pid, out-of-range pid, empty and
  foreign reasons are never removed.
- [x] **The release check is identity-bound.** The lock must still be the same file (dev/ino) that
  was read when the unlink happens, mirroring the sweep's release-time registry re-read.
- [x] **Tests and gates.** New reclaim/live/range case in `test/worktrees.test.ts`; tsc 0,
  worktrees 27/27, full 2,079/2,079, chain 767/767, notices 0, both worktree smokes exit 0,
  identity `2732f49a…`.
- [ ] Remaining C-4 items: archive picker, concurrent new-lock race, power-loss archive recovery,
  checkpoint orphan staging, capture-correlated crash window, power-loss/GC.
