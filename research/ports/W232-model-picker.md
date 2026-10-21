# W232 model picker list

Status: verified locally on `work/w43-choice-preview`, 2026-10-21. Local commit only.

## Task card

- Entry: `/model` in the fullscreen terminal over the existing local model set.
- Outcome: numbered rows with current/focus markers, source list navigation/window, pointer accept, effort-touch semantics and correct default/session acceptance.
- Source: `uBe`, `ys`/`Cr`/`dr`/`Pr`, `Gse`, `KHe`, `Ve`/`Yi`, `Oi`, `W3n`, `lc`/`tl`.
- Targets: `model-picker.ts`, `terminal.ts`, `tui.ts`, `interactive.ts`; existing settings/hook/apply pipeline remains the writer.
- Shape: one `ModelPicker` owns focus, viewport and an `implicit | adjusted` effort value; a trusted model-picker descriptor opens it inside the existing modal.
- Method: adapt the recovered reachable list and effort bodies; keep the source's closed search gate.
- Acceptance: compiled CLI navigation, numbers, pointer selection, cancel, touched effort, same-current default save, fresh process and actual request model/effort.
- Checks: 0-3 new regression groups, related tests, check/build, compiled drivers, identity and independent review.
- Constraints: local model sources only, no account/network catalog, no recovered entrypoint execution, no push or paid calls.

## Source identity

Artifact SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
Ranges are zero-based UTF-16 code units, half-open. Acorn verified the declarations. Module hashes match the extraction manifest.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | `Gse` [616800,617486), `uBe` [617998,624627), `KS` [624627,624680), `KHe` [624931,625189), `Lie` [625189,625236), `yG` [625236,625524), `GHe` [625524,625715); chrome constant `$He=14` immediately before uBe |
| `chunk-yygmb66g.js` | `93220b26616034b337ff622aa95b4125688626cc0a1a883c473f2703565d60b0` | `_C` [3085,5388), `ei` [5388,6284), `fd` [23446,23642), `Dee` [24437,24926), `Oi` declarator [31583,34355), `Co` class [34406,34628), `lc` declarator [34632,37401), `tl` [37402,38135), `W3n` [38136,39720), `Ti` [39814,40138), `Ve` [40861,41667), `Yi` [41667,54367), `$Ft` [54383,54541) |
| `chunk-hh0bresc.js` | `676add2366d870ee2f7ed3405c6ca095d9079f0cf20aebf11fabb56a52ddb455` | `xWe` [9916,10415) applies the model and conditionally writes the default without a same-model early return |
| `chunk-6ccen3s8.js` | `4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d` | ModelPicker actions around 7848; Select actions around 8140, already copied in `tui-keys.ts` |

`uBe` imports `fd`/`Ve` from yygmb66g. `Ve` takes the ordinary terminal branch `Yi`; its list owner is `Ti` -> `W3n`, key owner `Oi`. Theme, symbols, layout and document rendering already have source-backed local hosts. The max note is W212's `V$` in `effort-command.ts`. The existing `modelPickerEffortStep` ports KHe with all local levels available.

## Search result and scope correction

The candidate search feature was withdrawn before product edits. `uBe` passes `Gse({canEnter:!1,startInSearchMode:!0})`. `Gse` initializes with `M=h&&T`, so isSearchMode starts false. Its key path returns at `if(!h)return`, and `Vo=enterSearchMode` is never invoked in uBe. Typing, slash and paste do not enter search. The generic query state machine and GHe substring filter exist, but are unreachable in this build. W232 must not enable them from the appearance of startInSearchMode alone. The preliminary todo and progress statement are superseded by this direct source result.

## Reachable contracts

Acorn also resolves the nested bodies precisely: `ys` declarator [620537,620695), `Cr`
declarator [620696,620942), and `dr` function [621284,621497), all in chunk-24k7d6mw.js.

`ys` always updates the focused model. It refreshes effort from session/model state only while `Io()` (manual adjustment) is false. `Cr` calls the clamp and sets that flag true even if the endpoint or a round trip leaves the same final value. After adjustment, the level carries across rows. `dr` passes effort only when the flag is true. W215's value-equality test omitted this state and is replaced. This host has one session effort and no model table, so every implicit row uses session effort or high.

`Oi` routes up/down and j/k or ctrl+p/ctrl+n to next/previous. `lc` wraps at either end. Page movement clamps by visibleOptionCount. Home/End choose first/last. Tab has no action without an input-mode callback. Digits 1-9 accept a numbered row directly, with no prefix accumulator. Enter calls Pr (default), s calls dr (session only), Escape cancels. No Other row exists in source; arbitrary ids remain available through `/model <id>`.

`Yi` draws numbered rows, source pointer and selected tick, colors current selection separately from focus, and caps visible rows. `_C`/Yi route an actual row click to onChange; the local string frame needs a measured row hit map. Press/release remain owned by the same dialog, and a resize invalidates the pressed row. The max effort note follows the effort line.

`Pr` calls onSetDefault even when accepting the current row. `xWe` also has no same-model no-op before the save. The local interactive fast path must therefore allow current-row Enter to reach the ordinary hook/save/apply path. s retains its no-default-write behavior. Failed hooks/writes remain governed by that existing pipeline.

## Host adaptation and implementation sketch

`TerminalPromptRequest.modelPicker` declares current model and optional session effort while choices retain the bounded local rows. `ModelPicker` exposes focus/navigation, adjust and accept returning the existing `TerminalPromptAnswer`; `adjusted` is present only for touched effort. Its `implicit | adjusted` state prevents final-value comparison from erasing user intent. The terminal creates/discards this owner with the dialog and renders it through the existing document renderer.

The model list uses a separate render path because generic question choices have Other/input and a Selected footer. Each measured option contributes its own hit rows. The existing chat frame, cancellation owner and footer remain. The page budget follows uBe's 2-10 item formula, then the host measures wrapped rows and limits the list to available space. At 20/24 columns the modal claims its measured caption, effort and minimum list space before the transcript. This repairs the independent review's hidden-focus finding. Captions yield only when the terminal cannot hold the minimum; model labels keep Yi's 60% column cap and truncation, so the 20-column last label is abbreviated while its number and pointer remain visible.

The hidden-below row follows Yi's reserved-height branch even when no items remain below; wy/xZ emit an empty string in that case. The additional xZ source is chunk-yn0pfn70.js, SHA-256 1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f, [13795,13867) UTF-16. Numbering, pointer/tick colors and wrapped descriptions use the recovered document renderer. Low-height host frames can reduce the visible count below uBe's preferred two; no account capability system or catalog is introduced.

Project WORKFLOW section 6 overrides the bundled Feature playbook's delegated writer, design fan-out and PR steps. One bounded source reader established the closed search gate. The lead implements the coupled modal chain directly; an independent read-only reviewer follows. Model the Domain chooses the explicit effort state. Test Behavior, Not Implementation chooses actual keys, settings bytes and model request fields as acceptance.

## Source comparison

Six character-level comparisons were generated with `git diff --no-index --word-diff=porcelain
--word-diff-regex=.` after Acorn and TypeScript range extraction. They cover effort state,
viewport, key/pointer routing, rows, frame and default acceptance. Full diffs and range/digest
manifest live at `/Users/mant1ssa/.claude/jobs/c9c17d97/tmp/w232-character-diff-*.txt` and
`w232-source-compare.json`. These are adaptations, so the diffs are expected to differ.
The comparison SHA-256 values, in the same order, are `061290ed5a5c5c04c2f00ead046e7bc53f5fdf4f8b3cecbf80333b844c3ae20e`,
`ffd19e839969162e414bb67bd3055a34990fd4c2df5c50eba8ed3e675cca2c44`,
`6bdad8dd5db26aa058c80d90d7456646befbc28a2e3f401d7e1488a26c2cac5b`,
`415dc3c82a9b34708ea837585e956dbb893594df4bf4f580135b853e274aacc1`,
`a11415016bc8df32a8af93c348e9b4e212e1b78d139f0d2afc8e38e64b18ee56`,
and `7f5c1cf1d7a7758ea4e99857b1c5db1a85af98e8717abd804531cb50ca6bf46e`.

- React refs/state/callbacks become one modal-owned class and a trusted descriptor.
- Co's value-linked nodes become unique local row indices; lc's wrap, previous-at-window-top,
  page positioning, focus-fit and scroll clamping remain explicit.
- Oi's input/image/multiselect branches are inapplicable to plain local model rows. Terminal
  key decoding supplies the same Select actions, and bracketed paste stays inert.
- Yi's input/disabled/vendor/expanded branches are excluded for this caller. The compact column,
  numbering, current/focus colors, source symbols and description wrapping are adapted to JSX.
- DOM row event targeting becomes a measured screen-row map with press/release identity and
  resize invalidation. Existing modal cancellation owns input handoff and draft restoration.
- uBe's catalog, account capability/cost, fast mode, ultracode and remote bootstrap stay excluded.
  The existing local hook/save/apply path consumes acceptance; removing its same-model early
  return restores Pr/xWe default behavior without changing that pipeline's write authority.
- The host frame budget and transcript allocation are the narrow-terminal adaptation described
  above. The source's max note remains complete when enough rows are available.

## Validation

- `npm run check` exit 0; `npm run build` exit 0; `git diff --check` exit 0.
- Two new `test/tui-model-picker.test.ts` regression groups and the migrated owner group in
  `test/model-picker.test.ts` cover actual keyboard, paste, wheel, current/focus colors, numbers,
  s/Enter, touched round-trip/endpoint, abort/Escape/close, draft handoff, resize and pointer rows.
  The final related set is 135/135 with terminal, TUI, interactive, keys, settings and slider.
- `.audit/w232-model-picker.mjs` passes 23 compiled CLI checks at 90x30, 20x24 and 24x24.
  It exercises the local agent model roster, all list navigation, closed search, side-effect-free
  preview/cancel, numeric default, manual effort across rows, s byte preservation, same-model
  promotion and both hooks, restart, pointer default, actual request model/effort and process/lock
  release. No upstream model is called; the owned loopback server returns Messages SSE.
- Final compiled W215 acceptance passes 11/11. Its obsolete generic marker/Selected assertion
  now checks the numbered pointer plus retained max effort, preserving its original two-axis
  intent. Final standalone W231 slider acceptance passes 18/18 on the same final identity.
- Independent source/behavior review found one P2 hidden-focus issue at 20/24 columns. The lead
  reproduced and repaired it; independent high/max and wrapped-description clicks plus
  narrow-to-wide resize recheck resolved it. No other confirmed findings in the bounded diff.
- Read-only comment review deleted no files. The lead removed one redundant narration line and
  replaced two fixture double casts with checked dependency access. Mandatory source citations
  remain. No suppressions were added.
- S-1 through S-7 checked. Source and behavior were observed before assertions; migrated tests
  retain original intent; styled rows stay separate from text; modal owns its focus/hit map;
  stable file/request facts drive acceptance; all changed consumers and drivers were exercised.
  Failures and fixture corrections are recorded in `research/question.md`: preliminary search
  scope corrected from caller evidence, retired helper test migrated, wrong lock directory fixed,
  narrow ready-prefix clipped and fixture model roster reordered. These fixture repairs did not
  relax product contracts. No new coding rule is needed because the causes are already covered by
  S-1/S-3/S-4/S-5/S-6/S-7.

Final content identity is `78181883e2891c964285e3ee329c02e2177db5bfadad8eb6fcf3afaf67b7e88e`.
Inputs 791 files `1da32d55a964654b455bb99709a82bcb392fe01046885a80ce00d559bd97722a`;
validation 264 files `284a2776cb50ebe4e11dd5ba83b8e950fda4d652f04acef0327eb943eed33d0e`;
build 552 files `5f145b856fb4c22183561f14f73b719cdb8ad1d998f0261aefb998e715a0f703`.
The complete identity manifest is `w232-final-identity.json` in the job temporary directory.
Compiled result and captured frames are under `w232-cli-9rN7N9/result.json` in that directory;
final related log is `w232-related-final.log`; slider result is `w231-cli-BQHqUN/result.json`.
W232 driver SHA-256 `1444344ed0009e48422b331ac01432d976b66a4ab00901f946e7e5cb6cf5d11c`.

Full suite, real Magpie/upstream integration and package smoke were not run for this bounded UI
package. Search stays closed by the sample gate. Account-backed catalog/caps/cost, separate base
model/session override notice and the command's live composer description remain excluded or
unported as scoped. The broader terminal feature family remains Partial.
