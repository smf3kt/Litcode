# W336 the copy's own name

Status: task card, source verification and implementation. Work in place on `work/w43-choice-preview`; local commit only, no coauthor, no push.

Task card.
- Outcome: a background or fork copy carries its own name in its journal from the moment it starts, so `/sessions`, `/rename` and a later resume read the fork's name rather than the parent's.
- Source: `gft`'s `at`/`_t` (chunk-24k7d6mw.js 38766) and `Ue`'s `de` (chunk-zsg1bb14.js [20040,21857)).
- Domain: the fork journal's `title` record.
- Adapter: none. The host already has a `title` journal event with the same 200-character, control-free bound `fBe`'s intent carries.
- Validation: one new behaviour case, focused set, three compiled drivers, check/build, exact-path local commit.

Artifact 2.1.296 SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`. Coordinates zero-based half-open UTF-16 code units; recovered bytes remain inert.

| Module | SHA-256 | Acquired body |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | `gft` 38766: `Je=ne(ps(Nr(prompt)),60)`, `at`, and `_t=Le?.keepParent?{...h,name:at,nameSource:at?"auto":void 0}:h`, the record the spawn starts from. |
| chunk-zsg1bb14.js | b92e586d18ae25da4ecd7cb55903d4ac94ab1ead4a6433ad17636f8a27886d26 | `U` [20040,21857): `de=o.name?TMr(ps(Nr(o.name))):void 0`, the same name rendered back for the row. |

## Findings

1. The copy had no name of its own. `gft` replaces the whole session record with `{...h, name: at}` before it spawns, where `at` is the parent's name and the prompt joined by the fork glyph (or the glyph and the prompt alone). The host's `forkSession` copies the parent's `title` event and nothing else, so a fork was indistinguishable from its parent in `/sessions` and survived a `/rename` as the parent's name.
2. The name is already computed. W335's `forkCopyName` is `gft`'s `at` verbatim, so the port needed a journal write, not a second derivation. The row and the journal now read one value, which is what `Ue` does with `de`.
3. `nameSource` is not portable. `gft` marks the derived name `"auto"`; this host's `title` event has no provenance field, and its `/rename` already writes a plain title. Recording the source would mean a schema change with no reader, so it stays out.
4. Ordering matters. The name is appended after the fork point and after the briefing, so a resumed copy reads its own title last and the parent's earlier `title` event cannot win.

## Implementation

`src/background-session.ts`: `BackgroundStartOptions` gains `name`; the fork appends `{kind:'title', title: name}` after the briefing and before the spawn, bounded to the schema's 200 characters.

`src/interactive.ts`: the open-fleet arm computes `copyName` once and passes it both to the start options and to the row, so the two cannot drift.

## Verification

- `npm run check` and `npm run build` exit 0.
- New case in `test/fork-row.test.ts`: a titled parent forked with a prompt leaves the parent's title unchanged and writes both `title` events to the fork journal, the last one being `fix-parser ⑂ split the lexer`.
- Focused set `test/fork-row.test.ts test/fork-command.test.ts test/fork-relocation.test.ts test/background-session.test.ts test/interactive.test.ts test/tui-autocomplete.test.ts test/worktree-session.test.ts test/btw-fork.test.ts`: 92/92.
- Compiled `scripts/smoke-fork-relocation-cli.mjs` now 10 checks (the new one reads the copy's journal for `⑂ FORK_TASK`), `scripts/smoke-fork-gates-cli.mjs` 14 checks, and the 60-column driver 6 checks, each 1 model request.
- Baseline: the new 10-check driver against the pre-edit product sources fails at the copy-title check, so the passing run measures this change.

## Commit

The package commit subject is `Name the fork copy in its own journal` on `work/w43-choice-preview`; local only, no coauthor, no push. Its literal hash is deliberately not written here. Content identity `398b71cc2b5a3886439aa5a0332bacede22ade521fb2701df8974bc1c35a6e6d` (inputs 877, validation 339, build 622).
