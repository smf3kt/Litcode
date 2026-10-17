# W49 runtime trail

## W49-01 acceptance (2026-10-17)

- [x] **Interrupted creates no longer wedge a name.** Under the store lock, a `creating` record is
  reconciled because no live create can hold the lock at the same time.
- [x] **Adoption is verified.** The registration, branch, directory dev/ino, Git directory and
  backlink must pass `verify` before the record becomes `ready`.
- [x] **Clearing is conservative.** The unchanged empty directory is removed and the record dropped
  only when the branch is absent; everything else is retained.
- [x] **Read paths stay read-only.** `list` does not reconcile.
- [x] **Gates.** tsc 0, worktrees 29/29, full 2,083/2,083, chain 767/767, notices 0, build 0, both
  worktree smokes exit 0, index unchanged, identity `92d4ad84…`.
- [ ] Remaining C-4 items: worktree archive picker, concurrent new-lock race, power-loss archive
  recovery, capture-correlation crash window, power-loss/GC.
