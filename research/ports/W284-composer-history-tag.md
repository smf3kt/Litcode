# W284 composer history position

Status: verified locally, 2026-10-22. Local UI only.

## Task card

- Entry: Up and Down in the composer. Draw the recovered history position on the top border.
- Source: `gue`, `lue`, the `tRe` record, and `tRe ?? Vo` in `chunk-24k7d6mw.js`.
- Target: the existing history owner and `TuiTerminal.composerBorderText`, with the W283 border route.
- Mode: copy `gue`; adapt the history snapshot and copy the record's dim text, start alignment and offset.
- State: use the authoritative history index, total and last recalled text. No separate display index.
- Validation: actual compiled CLI with owned history entries; browse, edit, restore the draft, and compete with ultracode.
- Checks: at most three necessary regressions, affected history/TUI tests, check and build.
- Done: source/body comparison, decoded terminal frames, source/build identity, local commit only.

## Verified source

Sample 2.1.296 has SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
The manifest's `rawSha256` and `decodedSha256` for `chunk-24k7d6mw.js` both match the observed
`1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`.
All ranges below are zero-based UTF-16 code units, half-open, parsed with Acorn 8.15.0.

| Symbol | Range | Role |
| --- | --- | --- |
| `lue` | `[791954,796268)` | History owner. Offset counts backwards from the draft. `historyEdited` compares current text with the last recalled text. |
| `gue` | `[809815,809924)` | No text at index zero or after edits. `History` for an unknown total. Otherwise `History ${Math.max(1,total-index+1)}/${total}`. |
| `po` assignment | `792291` | Stores the recalled text in `Ft.current` after tab normalization, before the draft update. |
| `Vo` callback | `[795845,796072)` | Clears index, total, last recalled text, cached entries and pending reader generations. |
| `lue` return | `796162` | `historyEdited:we>0&&he!==Ft.current`. |
| `lue` consumer | `832198` | `historyIndex:ih,historyTotal:ah,historyEdited:iy`. |
| `gue` call | `[848720,848733)` | Reads `ih,ah,iy`. |
| `tRe` record | `[848742,848808)` | Dim, padded text on the top border, `align:"start",offset:2`. |
| `bf` declarator | `[853051,853071)` | `_r?void 0:tRe??Vo`. The history record wins over ultracode. |

Range SHA-256 for `gue` is `bf00e185a64b5a52265c7c2c0e682d378a687651e2994321ce42c679b43601fc`.
The record's is `73127d01f66f497a1448ce2a463e219011f714d52231987f347b10233d168ecc`.
The isolated pure formatter was evaluated with owned inputs before writing assertions. For total 3,
indices 1, 2 and 3 yield `History 3/3`, `History 2/3` and `History 1/3`. Edited text and index zero
yield undefined; a null total yields `History`. No recovered entrypoint was executed.

## Host mapping decided before implementation

`EditorState` already owns the oldest-first array, zero-based index, live-draft sentinel,
and pasted contents. The source's backwards index is `history.length - historyIndex`.
`history.length` is the known local total, after the existing limit and duplicate rules.
The current item supplies the reference text for the source's edited comparison. This also
suppresses a stale label after another owner replaces the draft while retaining the old index.

The tag builder reads that snapshot in `composerBorderText`, only on the chat screen, before
the ultracode gate. The existing `renderChat` parameter already accepts start alignment.
No separate display state, clock, new history reader or config flag is required.
The existing editor detaches normal text edits to the draft sentinel; that behavior is retained.
The formatter keeps the source's unknown-total arm, but the synchronously bound local snapshot
always has a known total. Global Ctrl+R picker counts do not describe normal Up/Down history.

## Throughput checkpoint

- Blocking first steps: source digest, parsed bodies, state dependencies and reset ownership before code.
- Independent workstreams: one bounded read-only question about the existing history owner.
- Shared mutable state: only the main executor edits this checkout. Existing unrelated changes remain intact.
- Smallest safe decomposition: one history tag package, using the existing renderer and history state.

## Validation

- `npm run check` exits 0. `npm run build` exits 0.
- Affected suites pass 160/160. The eight files are `tui`, `terminal`, `input-history`,
  `history-search`, `scope-picker`, and the three `tui-scope-picker-frame` suites.
  Two new tests exercise actual keys and decoded cells. They cover oldest/newest limits,
  saved-draft restoration, dim text and offset, editing, submit, multiline movement, search
  suppression, cancellation and precedence over the ultracode label.
- `W284_RESULT=<path> node .audit/w284-composer-history-tag.mjs` exits 0. Its source preflight
  compares the module with the manifest, the formatter's exact body and AST, and the border
  record after the one declared color-access adaptation. The compiled formatter also verifies
  unknown-total, index-zero and edited-text branches.
- The compiled CLI passes 17 interaction checks through the existing expect PTY and xterm 5.5
  decoder. Seeded persistent history gives `3/3`, `2/3`, `1/3`. The CLI restores the saved draft,
  hides the label after an edit, and switches correctly between history and ultracode text.
  The Ctrl+R picker hides the label and cancel restores it. Exit code is 0, history and session
  locks are released, and journals exclude the fixture credential. The only model call is the
  explicit test prompt, through owned loopback SSE. Paid upstream calls are 0.
- Full suite not rerun for this display-only package. The last full result remains W283's
  3201/3202 with the existing `cli-migration.test.ts:87` effort mismatch.
- Independent read-only review found no scoped correctness or comment issues. It verified the
  source ranges and formatter separately and did not repeat the passing suites.

Content identity: `fb0f5add9e79cbee1b763faae7d7570e52af17cdd147b067ffeacf95486e4bef`.
Inputs: `dd89ced3f9f01bef33e20febfe9823ee9509badac7472c29c640ab3f9718ce77`.
Build: `caa502e8fca554c362ada930d1984f29122d09e4b0e2d4ac66a66cf2bb23715a`.
The driver and compact source checks are committed with this record. Full local logs are
`w284-focused.log`, `w284-check.log`, `w284-build.log`, `w284-cli.log` and
`w284-cli-result.json` under the job's temporary directory.

## Coding-standard check

S-1: source body and terminal cells measured before final assertions. S-2: existing assertions
unchanged. S-3: label belongs to the border, never the draft or submitted text. S-4: derived state
adds no resource owner or reset path. S-5: label and draft predicates drive CLI waits. S-6: the
existing renderer record accepts start alignment; Ctrl+R keeps its separate counts. S-7: exact
formatter text/AST and the declared record adaptation are compared to the recovered ranges.
Fixture/API and color-level corrections are recorded in `research/question.md`.

Fixture corrections: a first expected border was one cell short, so it now pads to the known
viewport width. An absent draft-replacement helper was replaced with actual Ctrl-U and text keys.
The dim-cell fixture explicitly enables and restores color level 3. TypeScript's inferred type
for the copied color proxy omits dynamic builders, so the one allowed record adaptation is
`ge.dim(eRe)` to `Reflect.get(ge, 'dim')(eRe)`. The exact comparison above checks that replacement.
The existing local `research/question.md` records these failures; it remains ignored rather than
adding its unrelated historical contents to this package.
