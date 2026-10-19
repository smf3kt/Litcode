# W188/C2 inline diff dialog and the turn-result producer

Date: 2026-10-19. Final identity with the W189 repair `88b41c2251d3b4c30da42b3a924c19adcbc158b298fdf686c7be4327f9a9335b`. Source carrier: `extracted-v2/modules/chunk-sfn1dbxq.js`, SHA-256
`4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da`. Turn history
module: `chunk-twzxjzbk.js`, SHA-256
`84e9dd9e0d193d0d9e64cfdf3534a0f0c2f2b42cee51236346b5eef34b7dd35b`. Dialog tabs and
their viewport context: `chunk-3gz7s57c.js`, SHA-256
`9d44818f1c5a17e8ddddbce66694eab43a75e489d8afbeaf0369756daf2e378b`. Patch engine
modules: `chunk-34bv7wfw.js` (`3c54cf84…`), `chunk-f606a53w.js` (`dd0a1dc6…`),
`chunk-kcwp0ct0.js` (`6e2a2f6d…`), `chunk-r2vtj1kh.js` (`2b13302b…`),
`chunk-4qh9ecjv.js` (`4e74c1bc…`). All ranges are zero-based UTF-16 half-open.

## Ported source

- `src/diff-patch-core-source.ts`: seven verbatim blocks from `chunk-34bv7wfw.js` —
  `L` [615,3451) the Myers engine, `V` [3856,4082) the newline tokenizer, `N`
  [3451,3803), `R` [3803,3815), `_qe` [3815,3856), `Y` [5395,5517) and `t6`
  [4082,5395), the hunk builder. Exact unit counts and body digests are in
  `src/diff-patch-core-source-blocks.json`.
- `src/diff-patch-apply-source.ts`: thirteen verbatim blocks — `HN` from
  `chunk-f606a53w.js` [7703,7802); the `&`/`$` sentinel literals, `V`, `Te` and
  `var ckt=3,ucr=5000` from `chunk-kcwp0ct0.js`; `Fle`, `yK` and the remaining apply
  helpers from `chunk-f606a53w.js`/`chunk-r2vtj1kh.js`/`chunk-4qh9ecjv.js`. Digests in
  `src/diff-patch-apply-source-blocks.json`.
- `uno` (chunk-sfn1dbxq.js [739599,743280)) and `sjr` ([4167188,4171835)): the write
  and edit effect results. `uno` branches on truthy prior content, so an existing
  empty file takes the create branch. `sjr` carries no `type`. Both compute the patch
  through `Fle`, the post-effect seam that sees the bytes actually on disk.
- `xe` ([4380701,4382470)): the host result travels as a sibling of the API
  tool_result, never inside the model text. `TRn` ([4500463,4501738)): the storage
  projection — an update row drops `content`/`originalFile`, an edit row drops
  `originalFile`, the patch always survives. Reproduced in `src/tool-use-result.ts`.
- Turn walk, `chunk-twzxjzbk.js`: `Rt` [17903,18122) recognizes the result, `St`
  [18122,18194), `Mt` [18194,18338), `Ct` [18338,18487), `we` [18487,18642), `ne`
  [18642,20073) the message-to-turn walk, `ri` [22140,22184), `Ie` [22184,22672).
  Ported in `src/diff-turn.ts` over `src/diff-turn-source.ts`.
- Dialog: `si` (chunk-twzxjzbk.js [22672,28980)) is the mounted element; the tabs
  `sS` and the scroll box `OT` come from `src/diff-dialog-tabs-source.ts`. The
  viewport holder `Kp`/`uIe` (chunk-3gz7s57c.js [11348,11607), 259 units, body
  `fff228a4…`) is copied in `src/diff-scroll-viewport-source.ts`.

## Ported semantics in this host

- Every file effect produces the typed host row: `write_file` reads the prior bytes
  before writing and reports create/update; `edit_file` reports the applied edit.
  `src/agent.ts` projects each row with `TRn` and journals it beside the API
  tool_result (`SessionEvent.host`), so a reopened session replays the same rows.
- `turnDiffMessages` turns the journal into the message list `ne` reads: one row per
  recorded call carrying the API result and the host row. It never invents a human
  turn from a tool row; the batch message the agent appends is passed through and the
  walk skips it.
- `_5t` (chunk-n3ykh62m.js [670566,670666)) selects the presentation: a local
  line-mode session takes the inline branch, which `src/inline-diff.ts` mounts.
  `/diff` routes there before the checkpoint parser; `/diff NAME [OFFSET]` still
  falls through.
- The inline mount supplies the host bindings the recovered dialog reads: the
  git-diff data view in `auto` mode, the key service `u`, the app context with its
  focus manager, the store with `activeOverlays`, the clock, terminal size, render
  settings, the selection instance, the session/project context, and the `VS`
  viewport context. `VS` carries `{rows, columns, scrollViewport, claimScrollBox}`,
  the shape the modal host `nmt` passes (`Ga.modalViewport`) and the claim slot `Fc`
  adds for modal content. The tabs therefore take their scroll-box branch, attach the
  `OT` handle through `scrollViewport.attach`, and the detail view's
  `scrollBy`/`scrollTo`/`scrollToBottom` drive it.
- Scroll actions resolve through the recovered binding table: `src/tui-keys.ts` adds
  the `DiffDialog` and `Select` context tables (arrows, j/k, page keys, space/b,
  g/G, home/end, enter/escape), and the line-mode terminal resolves one raw sequence
  through `Keymap.push` against those contexts before dispatching the named action.

## Host adaptations

- The journal keeps the API result and the host result as separate events; the source
  keeps one live object. `turnDiffMessages` restores the source's sibling shape, so
  the ported walk is unchanged. This is a storage decision, not a behaviour change.
- The mount supplies the modal `VS` value directly instead of inserting `Fc`
  (chunk-3gz7s57c.js): `Fc` exists to give modal content its own claim slot and
  overflow hints, and this mount has exactly one scroll consumer (the tabs). The
  claim slot, viewport and row/column shape are the source's.
- The wheel settings read (`hs`) is reached when the detail view scrolls to its edge
  (`rMe`). `src/cli.ts` now binds the settings store and the wheel host: every source
  name answers the merged settings map the loader produced (the build merges its
  layers at load), and the legacy global config is empty. This also restores the
  above-prompt wheel path, which had no binding before.
- `tI` (chunk-06azbynj.js [173047,173232)) was ported with `while (u !== null)`; the
  source is `while(u)`. A root node built by this host reconciler can carry
  `parentNode: undefined`, so the truthy loop is restored. `ZFt` gained an
  `onRender`-is-a-function guard because a scroll repaint queued before an unmount
  can reach a detached box.
- `TuiDocumentRenderer.unmount()` rebuilds the root, paint pass and reconciler
  container: after `updateContainerSync(null)` this reconciler never commits another
  tree to the same root, so a dismissed dialog could not be reopened. The rebuild also
  frees the old root's yoga nodes. `close()` performs its own null render before
  setting `closed` (the old order made `unmount()` return early and skip every effect
  cleanup).
- `notebook_edit` and `memory_write` have no recovered producer in the acquired
  source and therefore emit no host row. The dialog shows them only when a later
  package ports those producers.
- Account and subscription network paths stay excluded; the dialog reads local
  session data and the local git repository only.

## Validation

- `npm run check`: 0. `npm run build`: passes.
- `test/diff-patch.test.ts` 10/10: hand-derived hunks, no-newline markers, tab
  conversion on/off, `$&` sentinel round-trip, empty patch for identical content,
  `applyEdit`, `editsPatch`, create/update rows and their projections.
- `test/turn-diff-effect.test.ts` 3/3: a scripted provider drives real
  `write_file`/`edit_file`; the journal reopens with both rows;
  `TurnDiffAccumulator` reports `{filesChanged:1, linesAdded:5, linesRemoved:1}` and
  the literal hunk; a refused write leaves no row.
- `test/inline-diff.test.ts` 2/2: three open/dismiss cycles each draw the title and
  the file list (the reopen regression), and the detail view scrolls through an
  80-line hunk — `pageDown` moves the first visible line number, `scroll:top` returns
  to it.
- Affected regression group (diff dialog suites, diff-patch, turn-diff-effect,
  wheel glue, above-prompt focus): 55/55.
- Full suite 2663/2663 with the W189 repair (2662 before its new regression).
- Compiled PTY, verifier driver (exit listener attached before input): `/diff` open,
  list, Enter detail, scroll, Escape back to the list, Escape to dismiss, reopen,
  `zzz` routing, draft retention, one tool turn, resize 100 → 40 → 100, `/exit` = 0;
  no provider call while the dialog is open.
- Compiled PTY, two-turn driver: two user prompts whose tool calls write and edit
  `made.txt` (`first\nSECOND\nTHIRD\n` asserted), then the dialog shows
  `Current   T2   T1`, `2 files changed +20 -20`, `made.txt untracked`,
  `sample.txt +20 -20`; `/exit` = 0.
- Compiled PTY, resume/cancel driver: `/diff` dismisses and one turn completes, the
  session exits 0; `--resume <id> --interactive` remounts the dialog over the stored
  transcript with no provider call, Ctrl+C while the dialog is open leaves the dialog
  and process alive, Escape dismisses, `/exit` = 0.
- Probe `/Users/mant1ssa/.claude/jobs/9b2805b2/tmp/c2-h-probe.mts`: viewport 24,
  content 81; `scrollTop` 0 → 12 → 24 across two page-downs with one scroll box
  mounted.

## Boundaries

- The full-screen panel keeps its own mount; this package does not move it onto the
  `VS` viewport. Its detail scroll has the same open gap and is a later package.
- The compiled PTY end-to-end acceptance is driven by the peer job `c9c17d97` plus two
  local drivers. The peer driver's earlier `/exit` hang was its own race (the `exit`
  listener was attached after the two-second settle window, so an already-exited child
  was missed); with the listener attached before input the product exits 0 with and
  without the dialog. Its `zzz` check records that printable keys still reach the live
  line editor, which is the inline AbovePrompt design; navigation keys are consumed by
  the dialog.
- The two-turn acceptance needs the W189 repair (`c05ec3f`): before it, any session that
  called a tool refused every later prompt.
