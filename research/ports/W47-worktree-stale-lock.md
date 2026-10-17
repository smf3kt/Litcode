# W47 — the worktree ownership store reclaims a dead owner's lock

## Sources

| module | sha256 |
| --- | --- |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da |
| chunk-3sda67c1.js | 285259b1c6dcf821a48f703d5fb866a9f69e9b52f19a235a9ae68f7dd7384cef |

Ranges are zero-based UTF-8 byte half-open offsets into the extracted module.

## W47-02 reclaims a store lock left by a dead owner (2026-10-17)

The product store lock (`.agent/worktrees.json.lock`) was created with `O_EXCL` and never
carried an owner. A crash between acquisition and release left it behind forever: every later
operation failed closed with "worktree ownership store is locked by another operation", with no
way to distinguish a crashed owner from a live one. The recovered client does carry that
distinction for worktree liveness locks, so the policy is ported rather than invented.

- `_x` and `Rze` [1759186,1759662): the reason is matched against a strict anchored pattern;
  release is safe only when the reason is absent or names a non-own pid that `U1t` proves dead.
- `P1t` [1801260,1801370): a reason longer than 512 bytes, or one the pattern rejects, is never
  treated as stale.
- `zPo` [1801370,1802540): the sweep skips the current worktree, re-reads the registry at release
  time before unlinking, and caps a sweep at `A1t = 50`.
- `Iue` [2547,2601) and `Nm` [2601,2715) in chunk-3sda67c1.js: a pid is dead only when it is an
  integer in `(1, 2147483647]` and `process.kill(pid, 0)` reports `ESRCH`; any other error,
  including `EPERM`, means not-dead.

The port adapts the sweep to a single lock. Acquisition now writes `harness worktree store (pid N)`
and fsyncs it. On `EEXIST` the lock is opened `O_NOFOLLOW`, its size is bounded at 512 bytes, its
reason must match the runtime's own format, and the owner pid must be dead. The file is re-stat'ed
immediately before `unlink` and must still be the same dev/inode that was read, the direct analogue
of the sweep re-reading the registry at release time. Exactly one reclaim-and-retry happens; a
second `EEXIST` fails closed. An empty, foreign, own-pid or live-pid lock is never removed.

Own-pid locks are not reclaimed, matching `U1t`; this process also holds the lock across awaits,
so reclaiming it would break mutual exclusion inside one process. The recovered sweep's reason
prefix `claude agent|session` becomes this runtime's store name because the lock belongs to this
store, and there is no registry of lock owners to sweep: the store holds one lock, so the cap of
50 and the per-sweep registry iteration have no analogue.

## Verification

`test/worktrees.test.ts` 27/27, including a new case that writes a lock reason for a reaped pid
and proves the next `create` reclaims it, then proves a live-pid lock and a pid outside the ported
integer bound still fail closed. tsc 0; build 0; full suite 2,079/2,079; chain family 767/767;
dependency notices 0; source and compiled worktree smokes exit 0 with `locksReleased:true`;
source index unchanged at 75 chunks / 323,525 units (no recovered module changed); identity
`2732f49a…`.
