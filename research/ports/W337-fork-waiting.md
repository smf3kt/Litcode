# W337 promptless fork waiting

Status: verified locally with independent review. Local commit only, no coauthor, no push.

Task card:
- Entry and outcome: bare `/fork` saves a copy that waits for a new prompt. Resume that copy interactively and execute a new task once.
- Data: `mode: fork | background` distinguishes a copy's optional execution prompt from a background handoff's seed fallback. The existing journal owns the waiting copy.
- Source: `Ue` and `U` in chunk-zsg1bb14.js; `gft` and `fBe` in chunk-24k7d6mw.js; `zY`, `Cn` and `qBe` in chunk-78w3rfp3.js.
- Targets: background-session.ts, interactive.ts, existing fork tests and compiled smoke-fork-gates-cli.mjs.
- Method: adapt the source's no-prompt branch to a durable, unlocked copy. Retain `/background`'s existing fallback. Format the actual workspace and interactive resume command.
- Validation: at most three behavior groups, compiled parent/fork/resume chain, check/build, independent review and content identity.

All source coordinates below are zero-based half-open UTF-16 code units. Module bytes were SHA-256 verified against extracted-v2/manifest.json before reading their Acorn-bound bodies. Recovered application code stays inert.

| Module | SHA-256 | Acquired bodies |
| --- | --- | --- |
| chunk-zsg1bb14.js | b92e586d18ae25da4ecd7cb55903d4ac94ab1ead4a6433ad17636f8a27886d26 | Ue declarator [19315,20039), U [20040,21857) |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | gft [38766,45161), fBe [51242,51842) |
| chunk-78w3rfp3.js | fb3c1bfd79c275709b224864837de2d4189dba1c243c4fccc44ce840da2c65a3 | zY [48611,49289), Cn [49289,55904), qBe [64775,65099) |

`U` passes `t || null` to gft and chooses the waiting label when t is empty. `gft` includes `["--", T]` only when T is truthy. `fBe`'s intent is display metadata. `Cn` derives L from launch arguments, keeps `Me = r?.intent ?? L ?? ""` separate, and computes `he` from the absence of initialPrompt, exec, L and reply-on-resume. That branch writes blocked tempo and waiting needs. The host instead evaluates `prompt.trim() || seed.intent` for both commands, replaying the last task after a bare fork.

The source dispatches an idle REPL worker through its local daemon. This host has detached one-shot children and no worker that accepts later prompts. Rewriting the worker service is outside this bounded package. The adapter therefore keeps the fork journal, title and briefing, closes its lock, creates its existing log and returns no PID. A later normal CLI resume opens that journal. This difference is explicit; a resident background process and peer messaging remain gaps. The source's qBe names its attach command; this host's equivalent instruction must include the target workspace and `--interactive` because CLI implies interactive mode only for a bare invocation without --resume.

Throughput checkpoint:
- Blocking first steps: manifest/Acorn source acquisition and the pre-edit compiled reproduction precede product changes.
- Independent workstreams: main owns the complete implementation and fixture. One bounded reader reviews the final diff.
- Shared mutable state: the existing Session owns the copied journal and lock. No new queue, process registry or database.
- Smallest decomposition: one explicit launch mode, the no-prompt spawn branch and the interactive resume hint. Source bodies decide the behavior, so competing architecture implementations add no evidence.

## Implementation

`BackgroundStartOptions.mode` selects fork or background behavior. Fork mode uses only the trimmed prompt. Background mode, including callers that omit mode, retains the existing seed fallback. A blank fork still writes its copied history, title and optional briefing, closes the Session and creates the existing log, then returns with an undefined PID before spawn. Nonempty tasks follow the existing spawn and failure-cleanup branch. The argv now includes `--` before task text, matching gft's positional boundary.

`backgroundResumeCommand` adapts qBe's terminal-open instruction to `litcode --workspace 'TARGET' --resume UUID --interactive`. Both `/fork` and `/background` use it. The target is the returned relocation directory when present, otherwise the current workspace. Single quotes in paths are shell-escaped. No gateway settings, credentials or provider arguments are added.

## Verification

- Pre-edit compiled baseline on eac78af failed at `the waiting copy sends no model request`. The copy replayed ORIGINAL_TASK. No checkout files were reverted to obtain this baseline.
- Three added behavior groups cover same-workspace and relocated waiting journals with briefing/title/history, dash-leading prompted forks, and actual `/bin/sh` argument parsing of resume hints with quotes and shell metacharacters. The existing `/background` seed-fallback assertion remains exact apart from the new `--` delimiter.
- Focused tests pass 31/31. The affected fork/interactive/worktree set passes 95/95. `npm run check` and `npm run build` exit 0.
- Compiled smoke-fork-gates-cli.mjs passes 24 checks with 3 owned loopback model requests. The original 14 coordinator/seed/typed-fork checks still run. The added chain completes the parent task, saves a bare fork, verifies unchanged parent and copy journals with no additional model request, exits the parent, resumes the copy interactively from another working directory, and executes NEW_COPY_TASK exactly once with the original conversation retained. Both locks release.
- Compiled smoke-fork-relocation-cli.mjs passes 10 checks with 1 owned loopback request. Prompted worktree relocation, briefing, copied title and journal ownership remain verified.
- Independent review reran 31/31 focused tests and the compiled 24-check chain, verified all three recovered module digests and ranges, and found no confirmed scoped correctness defect. The reviewer also checked journals, released locks and absence of fixture processes. One accepted comment finding corrected the module header and function documentation that still said every path spawns a child.
- The final check/build pass after that comment-only correction. Transpilation with comments removed produces identical executable text; the full identity comparison changes only src/background-session.ts and dist/background-session.js. Final content identity is `fa5a994317cf1e05db9d44164fb43f1379595f41ac7e81da9478de5a05b27b90`, with 877 input, 339 validation and 622 build files. Full-suite testing is not run for this bounded package.

## Rule comparison

S-1/S-7 bind the actual null-prompt source branch and local spawn consumer before edits. S-2 retains the background fallback and all prior compiled gate assertions. S-3 checks decoded terminal text separately from committed journals. S-4 closes the waiting copy before returning and verifies later resume acquires and releases the lock. S-5 binds no replay to request counts and exact journal bytes. S-6 updates the start options, fork caller, shared resume hint, both command consumers and their fixtures together.

The same-host messaging hint stays pending. Source `xi()` permits a live independently messageable session; a dormant journal has no peer inbox. No peer tools or messaging promises were added.
