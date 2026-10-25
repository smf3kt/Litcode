# W335 the `/fork` row name and width fitting

Status: verified and committed locally on `work/w43-choice-preview`. Fullscreen rendering and resize behavior are superseded by [W338](W338-fork-row-renderer.md). No coauthor, no push.

Task card.
- Outcome: an open-fleet `/fork` row names its copy, and a row that does not fit the terminal degrades in the recovered order instead of running off the line.
- Source: `Ue`'s row assembly (chunk-zsg1bb14.js [20040,21857)) with `gft`'s `at` (chunk-24k7d6mw.js 38766), `TMr`/`UKn`/`Bcn`/`RMr` (chunk-t721xmjm.js [46946,47911)/[47101,47819)) and `Ip`'s gutter budget (chunk-phg89898.js [113052,114313)).
- Domain: the row fields `{state, name, id, chips}`, the copy's name, and the fitting ladder.
- Historical adapter: W335 fitted to the plain terminal width before serialization. [W338](W338-fork-row-renderer.md) replaces that fullscreen path with native `  ⎿  ` rendering and the source's `columns - Yy` budget. Plain/inline fallback keeps the W335 path.
- Validation: three regression groups, actual compiled CLI at two widths, check/build, exact-path local commit.

Artifact 2.1.296 SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`. Coordinates zero-based half-open UTF-16 code units; recovered bytes remain inert.

| Module | SHA-256 | Acquired body |
| --- | --- | --- |
| chunk-t721xmjm.js | c88d190d4b973f293465e812bffa970b235dcf6b7f2e12525af0551168a2cb26 | `Bcn` [47101,47446): row text to fields; `RMr` [47446,47819): the fitting ladder; `UKn` [47819,47911): fields to text; the constants `Ucn`/`rFt`/`Xr`/`_e`/`Yr`/`gn` at 46831-46940. |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | `gft` 38766: `Je=ne(ps(Nr(prompt)),60)` and `at` (parent name + glyph + prompt, glyph + prompt, or nothing). |
| chunk-zsg1bb14.js | b92e586d18ae25da4ecd7cb55903d4ac94ab1ead4a6433ad17636f8a27886d26 | `U` [20040,21857): `de=o.name?TMr(ps(Nr(o.name))):void 0` and `pe=UKn({state, name, id, chips})`. |
| chunk-phg89898.js | b52cc8f30379c267a8f9afb0f475b87c00d8fd96f8ddadcd0bdab1549234dfe3 | `Ip` [113052,114313): `RMr(l, columns - Yy, id !== undefined)`; `Ap="  ⎿  "`, `Yy=ae(Ap)` at 113026. |
| chunk-ax7r0qj7.js | — | `Nr` [5245,5312): control-range strip, whitespace collapse, trim; `ne` 1128: a UTF-16 cut that keeps surrogate pairs. |
| chunk-3cynezh1.js | — | `OR="⑂"` at 65963, the fork glyph both `gft` and `TMr` split on. |

## Findings

1. The row had no name. `Ue` prints `UKn({state, name: TMr(parent ⑂ prompt), id, chips})`; the host printed `forkSessionLine({state, id, chips})`, so a copy was identified only by eight hex characters even though `gft` had already named it.
2. The row was never fitted. `Ip` calls `RMr(l, columns - Yy, id !== undefined)` before rendering; the host wrote the whole row and let the terminal wrap it, which loses the chip on a narrow window.
3. The fitting order is not a plain truncation. `RMr` first collapses `session waiting for a prompt` to `session waiting`, then drops the id **only when the row is clickable**, then clips the name to `max(room, 20)` cells with `ct`'s trailing ellipsis. The 20-cell floor can overflow the terminal on purpose, so a fitted row is not guaranteed to fit.
4. The glyph does not survive a name with no parent. `TMr` splits on `⑂` and rejoins; a name that is only `⑂ prompt` becomes one segment, so the row shows the prompt alone. This is the source's own behaviour, not a host simplification, and the W333/W334 row assertions were updated to it.
5. At W335, native styling, gutter and system display were not ported. [W338](W338-fork-row-renderer.md) supplies those parts and retains full fields for resize. Hover underline and `requestAttach` remain absent because the host has no live attach owner. The earlier `Sp()` attribution was incorrect. The local chunk-phg89898.js binding is `function Sp(){return Ae(TKn)}` at [111375,111404), an attach-context reader. The same-named awsCredentialExport binding elsewhere has no role here. The host retains the id because live attach remains unavailable. The broader `Pm` subLines behavior remains separate.

## Implementation

`src/fork-row.ts` (new): `forkRowText` ports `Nr`; `forkCopyName` ports `gft`'s `at` including the 60-unit cut and `ps`'s redaction (this host's `redactCredentialShapes`); `forkRowName` ports `TMr`; `forkRowFields` ports `Bcn`; `fitForkRow` ports `RMr` with `attachAvailable` as its third parameter. The row text itself reuses `forkSessionLine`, the existing `UKn` port.

`src/interactive.ts`: the open-fleet arm builds the name from `session.title` and the typed prompt, fits the row to `process.stdout.columns`, and writes it.

## Verification

- `npm run check` and `npm run build` exit 0.
- New `test/fork-row.test.ts` (4 cases): the name for a titled, untitled and empty parent, with the control strip and the redaction; the grammar including the non-row rejections and the `not-an-id`-is-a-name case; the three-step fitting ladder; and `/fork` printing a row that `forkRowFields` parses back with the parent title and the prompt.
- Focused set `test/fork-row.test.ts test/fork-command.test.ts test/fork-relocation.test.ts test/background-session.test.ts test/interactive.test.ts test/tui-autocomplete.test.ts test/worktree-session.test.ts test/btw-fork.test.ts`: 91/91. Two pre-existing row assertions in `test/fork-command.test.ts` and `test/fork-relocation.test.ts` were updated to the named row.
- Compiled `scripts/smoke-fork-relocation-cli.mjs` 9 checks / 1 model request and `scripts/smoke-fork-gates-cli.mjs` 14 checks / 1 model request, both against the named row.
- Compiled narrow check at 60 columns (job-tmp driver, `rows 40 columns 60`): 6 checks, 1 model request. The long name is clipped with `…`, the id survives, the row still parses, and the copy still runs the typed prompt. The same driver against the pre-edit sources fails at `the row clipped the long name`, so the run measures this change.

## Commit

The package commit subject is `Name the fork row and fit it to the terminal` on `work/w43-choice-preview`; local only, no coauthor, no push. Its literal hash is deliberately not written here. Content identity `3a1d236822adc7d5933cd542f569962404b9252b7b442dd20924816d0c36ae23` (inputs 877, validation 339, build 622).
