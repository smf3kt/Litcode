# W51 — preserved worktree histories are listed and restorable

## Source position

The archive directory is this runtime's own layout; the recovered client keeps worktree state in
Git and has no archive equivalent. This package builds on the W50 intent and the recovered
observation-time policy (`zPo`, chunk-sfn1dbxq.js [1801370,1802540)): only provable state is
acted on, and selection is refused when it is ambiguous.

## Behavior

`listWorktreeArchives` scans `.agent/worktree-history` for real directories named
`<worktree>-<uuid>`, reads each archive as a session directory, and reports the original name,
creation time, session count and the newest session title. The session reader is the same body
`listSessions` uses, extracted as `listSessionDirectory` so archives are not symlinked or copied.

`/worktree-history` lists up to 20 archives. `/worktree-history restore ARCHIVE` accepts an exact
name or a unique prefix and restores the archive into a fresh owned worktree at its original name.
The original name is required because archived session metadata names its original workspace; a
different name would leave every restored session pointing at a missing directory. The restore
creates the worktree first, refuses if the name, path or branch is taken or the checkout already
has `.agent`, writes the same durable archive intent used by removal, renames the archive into
`<checkout>/.agent`, and then clears the intent. A failure moves the archive back before removing
the checkout it created; if the move back fails, the checkout is kept so the history is never
deleted.

## Verification

Worktree session 5/5 with a list/restore case covering the original-name requirement, the occupied
name refusal and the restored session file. Interactive 7/7, full 2,085/2,085, chain 767/767,
tsc 0, build 0, notices 0, source and compiled worktree smokes exit 0, source index unchanged,
identity `436bb75f…`.
