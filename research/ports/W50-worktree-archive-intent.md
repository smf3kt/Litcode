# W50 — a durable archive intent makes worktree removal power-loss recoverable

## Source position

The archive layout (`.agent/worktree-history`) and the removal flow are this runtime's own
construction; the recovered client keeps worktree state in Git and has no archive directory to
port. This package therefore extends the local removal contract. The reconciliation follows the
recovered observation-time policy used by `zPo` (chunk-sfn1dbxq.js [1801370,1802540)): act only on
facts that can be proven now, retain everything else.

## Behavior

`removeExitedWorktree` now writes `.agent/worktree-history/.pending-<uuid>.json` with fsync before
renaming the checkout history into the archive. The intent records the origin, checkout, history,
archive, the checkout's dev/ino, the pid and the creation time. A successful removal deletes the
intent; a failed removal deletes it only when the history is back in place, was never archived, or
the checkout is gone and the archive is final. Otherwise the intent stays.

`recoverWorktreeArchives(workspace)` runs at interactive start and before every removal:

- history exists, archive absent: clear the intent.
- history exists, archive also exists: retain with a warning (ambiguous).
- archive exists, checkout absent: the removal completed; clear the intent and keep the archive.
- archive exists, checkout present with the recorded dev/ino: restore the archive to
  `<checkout>/.agent` and clear the intent.
- checkout identity changed, archive not a real directory, both paths missing, an intent owned by
  a live pid, invalid JSON, or paths outside this workspace: retain with a warning.

The scan is capped at 100 intents; interactive startup reports every restoration and warning on
the status stream and never fails session start.

## Verification

Worktree session 4/4 with a new power-loss recovery case (restore, live-owner skip, completed
removal cleanup), and the existing removal case now asserts no pending intent remains. Full
2,084/2,084, chain 767/767, tsc 0, build 0, notices 0, source and compiled worktree smokes exit 0,
source index unchanged, identity `6fb4abe8…`.
