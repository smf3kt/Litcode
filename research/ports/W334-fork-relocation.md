# W334 fork briefing and worktree relocation

Status: task card, source verification and implementation. Work in place on `work/w43-choice-preview`; local commit only, no coauthor, no push.

Task card.
- Outcome: an open-fleet `/fork` taken from inside a worktree runs its copy in the origin tree, says so on the row, and hands the copy a briefing that forbids editing the parent's checkout. A fork taken elsewhere in a repository tells the copy to make its own worktree.
- Source: `gft` (chunk-24k7d6mw.js [38766,~46900)) with `keepParent:!0`, the `/fork` path `Ue` opens, plus `Ue`'s row assembly (chunk-zsg1bb14.js [20040,21857)).
- Domain: `po` (relocation target), `xo` (`editsIn`), `Fo` (briefing text), and `Ue`'s `H` chip.
- Adapter: the source relaunches one journal with a different cwd; this host's journal identity is per workspace, so the copy is relocated with the same body `/worktree` already uses.
- Validation: three regression groups, actual compiled CLI, check/build, independent review, exact-path local commit.

Artifact 2.1.296 SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`. Coordinates zero-based half-open UTF-16 code units; recovered bytes remain inert.

| Module | SHA-256 | Acquired body |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | `gft` [38766,~46900): `no=dd()`, `po` (entered origin, else `tG`/`ur` canonical root), `_o` (`bgIsolation==="none"`), `xo` (`this-tree`/`own-worktree`), `Fo` (two briefing templates), `Uo` (`fork_briefing` record at the fork point). |
| ↳ | | `_1s` [38204,38766): `/background`'s own gate order, for contrast with `Ue`. |
| chunk-zsg1bb14.js | b92e586d18ae25da4ecd7cb55903d4ac94ab1ead4a6433ad17636f8a27886d26 | `Ue` [19311,20040) and `U` [20040,21857): the `gft` call with `keepParent:!0`, and the row's `H` chip from `o.relocatedTo`/`o.editsIn`. |
| chunk-t721xmjm.js | c88d190d4b973f293465e812bffa970b235dcf6b7f2e12525af0551168a2cb26 | `Bcn` [47101,47446), `RMr` [47446,47819), `UKn` [47819,47911): row parsing, width fitting and joining. |
| chunk-phg89898.js | b52cc8f30379c267a8f9afb0f475b87c00d8fd96f8ddadcd0bdab1549234dfe3 | `Ip` [113052,114313): the row component, including the chip row and the attach click. |
| chunk-hwpb27as.js | — | `Ait` [44060,~44140): the briefing's `system-reminder` escape. |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | `Xar` [4547554,4547720) and the `fork_briefing` reader at 4468231. |
| chunk-bf3z2ftn.js | — | `ur`/`tG`/`Fs`/`gt`: nearest `.git` ancestor, linked-worktree detection, canonical root. |

## Findings

1. Relocation was missing. `gft` computes `po` for every `keepParent` fork and spawns the child in `co ?? no?.worktreePath ?? Ee()` with `bgIsolation:"default"`. The host's fork always ran in `source.config.workspace`, so a copy taken from inside a worktree kept editing the same checkout as its parent.
2. The briefing was missing. `gft` builds `Fo` from `po`/`xo` and appends it as the optional `fork_briefing` record at the fork point; the reader turns it into one `isMeta` user message. Without it a copy had no instruction not to edit the parent's worktree.
3. The row chip was missing. `Ue` builds `H` as `runs in the origin tree` when `o.relocatedTo` is set, else `edits this checkout` when `o.editsIn === "this-tree"`, else nothing.
4. A briefing row alone leaves the copy awaiting a response. This host's `awaitingResponse` is true after any message row without a following `turn_end`, so a resumed copy refused its own task with `Session has an unfinished turn; continue it first`. The briefing is therefore closed with its own `turn_end`, the same shape `runBashCommand` uses for a caveat row.
5. Not ported: `tengu_session_fork` telemetry, `rosterName`/`xc` messaging hint, `resumeAtLeaf`/`fork_point_missing`, `providedSessionId`, `replyOnResume`, the `--append-system-prompt` fallback (`Io`), and the worktree hook handoff. The host has no `bgIsolation` setting, so `_o` is always false, which is the source's own value when the setting is absent.

## Implementation

`src/fork-relocation.ts` (new): `forkBriefing` ports both `Fo` templates clause for clause, including the dropped branch clauses and the `—` literal; `forkRelocation` derives `po`/`xo` by asking Git for `--show-toplevel`, `--absolute-git-dir` and `--git-common-dir` instead of re-implementing `gt`'s path parsing, and returns no relocation outside a repository. `FORK_WORKTREE_TOOL` is this build's `worktree_create`, the tool the recovered text names as `EnterWorktree`.

`src/fork-command.ts`: `forkRowChip` ports `Ue`'s `H`.

`src/background-session.ts`: `BackgroundStartOptions` gains `briefing`, `relocatedTo` and `relocate`; `escapeBriefing` ports `Ait`; the copy is relocated before the briefing is written, the briefing is closed with `turn_end`, and the result reports `relocatedTo`.

`src/interactive.ts`: the open-fleet arm computes the relocation, passes it with a `relocate` body built on `relocateSession`, and adds the chip to the row.

## Verification

- `npm run check` and `npm run build` exit 0.
- New `test/fork-relocation.test.ts` (4 cases): both briefing templates and their dropped clauses, the three chip outcomes, relocation over a real repository / linked worktree / detached checkout / non-repository, and the `/fork` arm passing the briefing and printing `session running · <8 hex> · runs in the origin tree`.
- Focused set `test/fork-relocation.test.ts test/fork-command.test.ts test/background-session.test.ts test/subtask-command.test.ts test/interactive.test.ts test/tui-autocomplete.test.ts test/worktree-session.test.ts test/btw-fork.test.ts`: 96/96. Session/lifecycle set `test/session-storage.test.ts test/workspace-session.test.ts test/agent-lifecycle.test.ts test/resume-picker.test.ts`: 103/103.
- Compiled `scripts/smoke-fork-relocation-cli.mjs`, 9 checks, 1 model request, locks released: the parent runs inside a real linked worktree, the row reads `session running · <8 hex> · runs in the origin tree`, the copy's own request carries the briefing and names the origin path, the copy writes its journal in the origin tree, and the worktree keeps only its own journal.
- Baseline: the same driver against the pre-edit sources fails at `the fork row names the origin tree`, so the compiled run measures this change.
- `scripts/smoke-fork-gates-cli.mjs` still passes 14 checks / 1 model request, so W333's gates are unchanged.

## Commit

The package commit subject is `Port the fork briefing and worktree relocation` on `work/w43-choice-preview`; local only, no coauthor, no push. Its literal hash is deliberately not written here, because amending this line to add it would change the hash again. Content identity `1906a63431fd0d1b4f2bf8fb84fb8bb1afa85c3272d98160b3d9eb54082d14a5` (inputs 876, validation 338, build 621).
