# W49 — an interrupted create's reservation is reconciled

## Source position

The reconciliation is the same cleanup create already performs in its failure path, applied when a
`creating` reservation is observed by a later locked operation. The recovered client reconciles
stale worktree state when it observes it: `zPo` in chunk-sfn1dbxq.js [1801370,1802540) re-reads the
registry at release time and only releases a lock whose owner is provably dead. This store's
reservation has no owner pid, but it does not need one: every create holds the store lock across
its Git mutations, so a `creating` record read under that lock cannot belong to a live operation.

## Behavior

`reclaimCreating` runs at the start of `create` and `remove`, inside the store lock, and walks
every `creating` record:

- Git registered the recorded directory under the recorded branch: `verify` confirms the
  directory dev/ino, branch, Git directory and backlink, the record becomes `ready`, and the store
  is saved. This is the crash-after-`git worktree add` window.
- No registration and no branch: when the recorded directory is still the unchanged empty
  directory, it is removed and the reservation is dropped. This is the crash-before-work window
  and matches create's own cleanup conditions.
- Anything else (non-empty or replaced directory, branch still present, verification failure) is
  retained for inspection.

`list` stays read-only and does not reconcile.

## Verification

Worktrees 29/29 with two new cases (adoption after Git registration; drop when Git work never
landed). Full 2,083/2,083, chain 767/767, tsc 0, build 0, notices 0, source and compiled worktree
smokes exit 0 with `locksReleased:true`, source index unchanged at 75 chunks / 323,525 units,
identity `92d4ad84…`.
