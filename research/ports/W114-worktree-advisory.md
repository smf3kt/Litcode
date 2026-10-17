# W114 — non-Git worktree advisory

## Source position

The child agent worktree creator resolves its repository root first
(`Pze`, chunk-sfn1dbxq.js offset 1762797): with no root and no WorktreeCreate
hook it throws "Cannot create a worktree: not in a git repository and no
WorktreeCreate hooks are configured. Configure WorktreeCreate/WorktreeRemove
hooks in settings.json to use worktree isolation with other VCS systems."
The neighbouring `osr` (offset 1733866) carries the same shape with "Cannot
create agent worktree" for its own entry point.

## Port

`WorktreeManager.repositoryState` reports `none` when `git rev-parse
--show-toplevel` fails, `root` when its realpath equals the workspace, and
`elsewhere` otherwise. The child environment factory raises the recovered
advisory on `none` before creating anything; `root` and `elsewhere` keep the
manager's existing path, so a nested workspace still reports the manager's
root-identity error rather than a misleading no-repository one.

## Adaptation

The advisory is the child-worktree text (`Pze`); `osr`'s "Cannot create agent
worktree" variant belongs to its own entry point and is not raised here. The
diskless/confined-session checks above `Pze` have no local analogue.

## Verification

`agent-isolation-runtime` asserts the advisory for a plain temporary workspace
with no hooks. Focused 88/88, tsc 0, build 0, full 2,155/2,155, chain 767/767,
identity `95c17af3…`.
