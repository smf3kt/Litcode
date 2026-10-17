# W120 — Background session fork

## Source position

The REPL handler `_1s` (chunk-24k7d6mw.js offset 38204) gates the command:
no backgrounding while already a background job, disabled persistence
(`Cannot background — session persistence is disabled, so the forked job would
have nothing to resume.`), and an empty seed
(`Nothing to background yet — send a message first.`). The seed is `fBe`
(offset 51242): walk messages backward, take the latest assistant text
whitespace-collapsed and truncated to 120 as `detail`, take the latest real
user text as `intent` unless an explicit prompt was passed, skip tool-result
messages, meta messages and command records, fall back to `(backgrounded)`, and
truncate `intent` to 200. Helpers: `TF`/`zg`/`rb`/`N_`
(chunk-sfn1dbxq.js offsets 4432714/4432935/4433793/4422125), `ne`
(chunk-ax7r0qj7.js offset 1128), `O$` (chunk-r2vtj1kh.js offset 164599) with
the tags of chunk-gsnbskq4.js offset 8723. The spawn core `gft` (offset 38766)
forks the conversation, checks the fork point, copies a snapshot before the
spawn, filters CLI arguments and returns `{ok, error, queued, reason}`; a spawn
failure removes the unused snapshot.

## Port

`backgroundSeed` ports `fBe` over the local `session.messages`. The local
journal has no `isMeta` flag, so the two meta kinds this harness appends
(`Hook context:`, `Stop hook feedback:`) join the skip set.
`startBackgroundSession` materializes the fork with `forkSession` before
spawning, so the child journal is complete even if the parent exits at once.
The child is a detached headless CLI: `<exec> <execArgv> <entry> --resume
<forkId> <task>`, cwd at the workspace, stdout/stderr appended to
`<workspace>/.agent/background/<forkId>.log`. A synchronous spawn failure
removes the unused fork and raises `Couldn't fork — <message>`. The interactive
command `/background [PROMPT]` refuses a running turn and prints the fork id,
pid, log path and resume command.

## Adaptation

- Local sessions always persist; the source's disabled-persistence gate has no
  switch here, and its branch is unreachable.
- There is no session background-job registry: the child is an ordinary
  detached headless CLI with its own journal. The queued-restart/adoption path,
  job directory, snapshot V5 copy, `bgIsolation` worktree briefing, carry-over
  counts and the confirmation dialog have no local counterpart.
- The source fork point is a transcript leaf uuid; local forks use the completed
  history without a boundary.
- The child receives only the local CLI surface. The source's carried
  permission snapshots, allowed-tool list, hooks and effort switches are not
  forwarded.
- Command-record detection reproduces the source tag set. This journal marks
  local-command output through its own events, so the tags only matter for text
  that carries them.

## Verification

`background-session` pins seed selection, skips, UTF-16 truncation, fork
lineage and spawn arguments, failed-spawn cleanup and the empty gate.
Focused 50/50, extended 86/86, tsc 0, build 0, full 2,177/2,177, chain
768/768, identity `5824092a…`.
