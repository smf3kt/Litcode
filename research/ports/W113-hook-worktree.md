# W113 — hook-based isolated worktrees

## Source position

`ATn` (chunk-sfn1dbxq.js offset 2952836) selects the hook path when a
WorktreeCreate hook is configured (`Bne`) or a classic module hooks the event
(`die`, offset 556297). `CTn` (offset 2952999) raises the hook with
`{name, cwd}`, reads the first successful hook's trailing non-empty output line
(`cU`/`p7n`, offsets 561890 and 561804), and distinguishes three failures: no
hook ran, failed records, and a run with no path. An absolute answer is used
verbatim; a relative one is resolved against the hook cwd. The caller then
rejects a dotted spelling (`el`), screens every component below the checkout
root for symlinks (`sme`, offset 1736863), and requires an existing directory
(`C1t`, offset 1774896). Cleanup goes through `Xir` (offset 2954231): the
WorktreeRemove hook must succeed, a path already gone counts as removed, and
otherwise the checkout is kept with the failure summary.

## Port

`runHooks` now surfaces the WorktreeCreate path on `worktreePath`: from
`hookSpecificOutput.worktreePath` (schema at chunk-n3ykh62m.js offset 396282,
producers at chunk-sfn1dbxq.js offsets 3049056 and 3052454) and from a command
hook's trailing stdout line. `executedHooks` reports how many hooks started a
run for the two worktree events. The runtime child-environment factory selects
the hook path when WorktreeCreate hooks are configured or a classic module hooks
the event, raises it through `runHooks` and the classic chain, applies the
source's validations and error texts, and removes the checkout through
WorktreeRemove on close. Without hooks the owned Git worktree manager runs
unchanged.

## Adaptation

The hook payload carries `name` and `cwd` but no `session_id` or
`transcript_path`, because the factory owns no Session; the classic raise adds
the keys `fe` supplies. Failure summaries use this runtime's recorded failure
strings rather than the source's `exitCode` line bounds. The symlink screen runs
against the workspace realpath (the source's `Fs`/`ur` roots collapse to one
here). The source's not-a-git-repository error that advises configuring hooks
(`osr`) is unchanged; the Git manager's own error still surfaces when no hooks
are configured.

## Verification

`hooks` asserts the JSON and command paths, first-non-empty ordering, and that
no other event sets the field. `agent-isolation-runtime` asserts a non-git
workspace receives the hook checkout, the WorktreeRemove hook runs on
`stop_agent`, and dotted or symlinked answers are refused. Focused 111/111,
tsc 0, build 0, full 2,154/2,154, chain 767/767, notices 0, identity
`2f5efec2…`.
