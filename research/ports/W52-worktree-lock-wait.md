# W52 — live store-lock contention waits instead of failing at once

## Source position

The ownership store and its lock are this runtime's construction; the recovered client keeps
worktree state in Git. W47-02 already ported the recovered liveness policy for dead owners
(`_x`/`Rze`/`P1t`/`zPo`). This package adds only the local scheduling decision: when the lock is
held by a live owner, the operation waits for a bounded time instead of failing on the freshly
created lock.

## Behavior

`WorktreeManager` takes `lockWaitMs` (default 30,000, 0 to 120,000). Acquisition now:

1. tries `open` with `O_EXCL`; on success it owns the lock;
2. on `EEXIST`, attempts the W47-02 dead-owner reclaim and retries immediately if it succeeded;
3. otherwise waits 50 ms, honoring the operation signal, until the deadline;
4. at the deadline it fails with the existing locked error.

`lockWaitMs: 0` keeps the previous fail-fast behavior for embedding and tests. The wait does not
change ownership verification, the reason format, the identity-bound release, or the dead-owner
reclaim; it only lets a second process serialize behind a live operation.

## Verification

Worktrees 30/30 with a new wait case (a live lock released after 150 ms is acquired; an aborted
wait rejects with AbortError). The two existing fail-closed lock tests set `lockWaitMs: 0`. Full
2,086/2,086, chain 767/767, tsc 0, build 0, notices 0, source and compiled worktree smokes exit 0,
source index unchanged, identity `9d611189…`.
