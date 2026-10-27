# W367 observation: the config-watch CLI driver is stale, not broken by W367

Found while checking whether the W367 reading change disturbed the settings
family. Out of scope for W367 and not repaired here.

## What happens

`scripts/smoke-config-watch-cli.mjs` fails in this environment. Its PTY branch
spawns the CLI with `--interactive --watch-config` and no `--no-tui`.

`cb4ad36` (2026-10-13, "Open the full-screen session by default") made the
full-screen TUI the default whenever stdin and stdout are TTYs. The branch was
written before that, when `--interactive` alone still gave line mode.

Consequences, both observed:

- The TUI never writes `Personal harness. /help for commands.` to stderr. It
  owns the screen and draws its own composer, so the branch's
  `wait(() => stderr.includes("Personal harness."))` never satisfies and the
  run dies on the 10s wait.
- The TUI also cannot be driven through `scripts/pty-cli.exp` here: typing
  `/fork` character by character leaves the composer showing `/ad…` and the
  hint row, and no submit reaches the loop. So switching the branch to TUI
  assertions is not a small edit.

## What still passes

Everything the driver covers outside that branch, on the real CLI:

- with the branch skipped (`if (false)`), the whole run passes:
  `{"cli":"passed", …, "ttyKeybindings":false, "modelRequests":41}`
- the resume + new-instruction chain passes in isolation
  (`resumeempty.mjs`: resumed true, banner true, reloaded true, 10 model calls)
- the empty-directory chain passes in isolation three times out of three
  (`emptyprobe2.mjs`: reloaded true, 5 model calls)

## Second, separate defect: the driver is flaky

With the branch skipped, one run in three still failed at a 10s wait on
`Local configuration reloaded` after the empty-directory write. The same
sequence passes 3/3 when run alone. The driver serialises ~40 model calls over
one gateway and uses fixed `delay(100)`/`delay(650)` gaps, so a slow reload
debounce crosses the wait.

## Not repaired, and why

Repairing it means either restoring line mode with `--no-tui` in that one
spawn (which changes what the branch claims to test) or rewriting the branch
against the TUI. Both are a package of their own, and neither is needed to
close W367. The W367 change is covered by the full suite, the seven affected
suites and the shell-readings driver in both source and compiled modes.

`test/config-watch.test.ts`, `test/reload.test.ts` and `test/config.test.ts`
pass 81/81, and `node scripts/smoke-config-watch.mjs` passes against the real
`fs.watch`.
