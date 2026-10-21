# W231 standalone effort slider

Status: implemented, locally verified and independently reviewed on `work/w43-choice-preview`. No push or paid calls.

## Task card

- Entry and outcome: bare `/effort` opens the horizontal slider; arrows preview, Enter saves a persistable default, `s` applies to this session, Escape cancels.
- Source: recovered `It`/`Fe`/`Cr`/`wo`/`Ot`/`Pt`/`he` and `Ce` -> `MOe` -> `P` -> `D`/`X9`.
- Targets: `src/effort-slider.ts`, the existing terminal adjustment request, TUI modal owner and interactive command dispatcher.
- Shape: the adjustment becomes a line-or-slider union; a slider carries a trusted render callback and no text input or list selection.
- Method: adapt the recovered geometry, rendering and accept bodies to the existing owned modal and document renderer.
- Acceptance: compiled PTY preview, clamp, cancel, both save scopes, max note, request effort, reopen/restart and model-picker regression.
- Checks: up to three new regression groups, affected checks/build and bound content identity.
- Constraints: local model levels only; existing argument grammar remains; no remote/account actions, push or paid calls.

## Source identity and closure

Original artifact SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
All coordinates below are zero-based UTF-16 code units, half-open. Acorn identifies the function ranges.
The three main module byte hashes were matched against `extracted-v2/manifest.json` before implementation.

| Module | SHA-256 | Relevant bodies |
| --- | --- | --- |
| `chunk-76jkr621.js` | `09c383199652e7be3cc3b79215c6616e6653f6fa65c265ebe5e99e7dc43ae04e` | `mn` [17133,17173), `wt` [17456,17514), `Ce` [17514,17916), geometry constants [18962,19336), `Cr` [19336,19625), `wo` [19625,19717), `Nt` [19778,20102), `Fe` [20102,20622), `Ot` [20622,21105), `Pt` [21105,21382), `he` [21382,21789), `Te` [21789,22003), `It` [22174,30123), `So` [30667,30743), fallback `Ut` [30769,33046), entry `ll` [33046,33374) |
| `chunk-0q6c90q6.js` | `97c49a70fcefc8407f6fc93c4b4c8d50a7b63ca8c6d3a3aba6627e91c761457b` | `D` [2535,4018), `v` [4018,4083), `_hn` [4083,4189), `P` [6037,6286), `MOe` [6286,6863) |
| `chunk-9vcaezw1.js` | `eccb69a1f121aa90407d23fbd69b3167178da1b759c1a4cd8b29609d15cb98e0` | `O` [3391,3579), `Y0` [9148,9267), `Pe` [12184,12247), `YJ` [13546,13584), `FNe` [13584,13891), `we` [13891,13959), `X9` [13959,14114), `qC` [14204,14273), `yxt` [15431,15500), `J` [15616,15834) |
| `chunk-6ccen3s8.js` | `4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d` | `EffortSlider` binding record around 7972: left, right, tab (workflow toggle), s (session only) |
| `chunk-r0g20c30.js` | `fc76581115ae604776ec4047c53dec675adc28526135a798e930dec1d7152442` | `yEe` [827,835) = -100, reduced-motion settings reader `Eu` [836,902) |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | shimmer peak `mVn` [153803,153816) = #d0b4ff |
| `chunk-0qkpwgr4.js` | `470fcab1f965a43d7ec6a08213a15a49218e65d7e2cc8b4bef21d8c4622335a6` | key guide component `z` [3890,4537) |

The rainbow palette function `fB` is already copied in `src/tui-input-highlights-source.ts`, from
`chunk-bk5ct2gw.js` [399661,400220). The max note and effort persistence/parser are already ported
in W212. The existing document renderer owns the recovered box/text/layout/theme pipeline.

## Source contracts and host adaptations

`ll` selects the slider for an empty argument. `Te` first resolves the environment override, then
the selected session level, then `qC`; this host has no model-capability/default table, so the same
local fallback is high. Geometry is 42 cells, triangle positions [1,10,20,30,40], label spacers
[5,5,5,6]. The selected label is bold and colored; xhigh shimmers and max cycles its letters through
the existing rainbow palette every 100 ms. Reduced motion fixes both effects. Max shows `V$`.

`It` owns a tentative index and never mutates settings during adjustment. Left and right clamp.
Enter calls `Y(true)`; `s` calls `Y(false)`; Escape reports Cancelled. `Ce` applies a level even when
its index is unchanged if the workflow flag is unchanged (`wt`). `_hn` preserves auto only for a
carried model effort; that state and its model table do not exist here, so Enter applies the shown
level. A same-level confirmation must therefore reach the writer instead of reporting unchanged.
`X9` writes only a persistable level when requested; max keeps the previous default. `D` saves
before reporting an environment override, retained through W212's command result.

The line adjustment used by model selection keeps its current path. A slider has no dummy choice,
Other input or Selected footer. Its own render callback receives a frame and reduced-motion flag.
The existing terminal modal owns a 100 ms repaint clock, clears it on finish/abort/close, and draws
the content through the existing document renderer. The dialog retains its chat frame and footer.
The line-mode/piped command keeps the existing noninteractive argument path.

The source's workflow toggle is gated off, as in W212. Account/model caps and relative-cost notes,
organization notes, remote transport, carried-model auto state and cache-miss confirmation have no
local backing state and remain excluded. The max warning text is retained. No recovered entrypoint
is executed.

## Request-boundary repair found by compiled acceptance

The compiled override lane reproduced a mismatch: the command reported LLM_EFFORT=high while the
next actual request carried low. The chosen session state was correct; `Agent.request()` skipped
resolution and serialized it directly. The inert source chain is now acquired and verified:
`chunk-sfn1dbxq.js`, SHA-256
`4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da`, `cln` resolver expression
[2780635,2780743) calls `kE`, serializer invocation [2800268,2800344) calls `w0e` [2752428,2752586),
and request spread [2806874,2806921) carries the resulting output_config. `kE` in the already hashed
9vcaezw1 [12972,13279) gives a concrete environment level priority over the chosen session level;
its null override (auto/unset) returns undefined when no policy maximum exists.

Adapt `Agent.request()` to resolve that environment override just before serializing, preserving the
chosen value for later use. This host retains its existing implicit-default wire omission when both
environment and chosen effort are absent; it has no model fallback/cap table, extra-body effort,
per-turn hook effort or thinking-disabled cap. Count/compaction share the same local request builder.
The compiled override failure is the distinguishing before result, and the final driver must prove
both a concrete override and a subsequent cleared/default run.

## Validation

- `npm run check` and `npm run build`: exit 0. The new typed reply fixture was corrected to include the SDK's nullable response/usage fields; no cast was added.
- Three new regression groups in `test/effort-slider.test.ts` cover decoded geometry/colors/motion and 44-column rendering, arrow/clamp/accept/cancel/abort/close/draft ownership with a line-model-picker check, and public Agent run/count precedence for concrete, auto, unset, invalid, empty and missing overrides. Final focused result 3/3. Related agent, registry, lifecycle, effort, terminal, TUI and interactive set 264/264; full suite not repeated.
- `.audit/w231-effort-slider.mjs`: 18 compiled PTY checks pass at 90x30. Preview leaves settings and provider untouched; both endpoints clamp; cancel preserves bytes; s applies session-only; Enter saves; max never replaces the prior default; reopen follows live state; a fresh process reads the default; unchanged Enter promotes a session-only pick; concrete override saves the requested default but sends the override; clearing the environment restores the saved request value.
- Existing compiled probes pass: effort argument/storage/request 14/14 (layout assertions adapted to the source slider), model picker 11/11. The old assertions' opening/current/levels/cancel intent remains covered; glyph/description command behavior stays in the unchanged argument tests.
- Provider evidence is an owned loopback Messages SSE fixture. Actual upstream model and Magpie validation were not run. No paid calls or push.
- Final content identity `cec1deb8d047f93b4a85ee56a6987edff729a87fdee809a0ed34efe97a4e5ae3`; inputs 791 files, `7f738e821a76da38fd1590b0dac27463f399b3190c567425b55a387109460b9b`; validation 263 files, `0136dfd11890e9028c4aff18b5c046e451776aba0ed23babfd30c2e9219bc41a`; build 552 files, `5135019f0d3f3e44cf35994efa6a263efd5c9ebf41c48db9fab386dababbc61f`. Recomputed with `scripts/identity.mjs` and matched by the final driver.
- Temporary decoded frame, request-effort projection and result live under `/Users/mant1ssa/.claude/jobs/c9c17d97/tmp/w231-cli-5D3bC9/`; fixture workers exit 0 and the local SSE listener closes.
- Independent read-only review accepted the scoped implementation and source/request chain. It confirmed timer disposal and found no correctness defect, while identifying missing active-animation teardown coverage. The final focused lifecycle group now observes the decoded max letter color change with reduced motion off, closes the modal, and verifies zero subsequent terminal writes. All three final groups and typecheck pass; no production change followed the review.

Character-level `git diff --no-index --word-diff-regex=.` comparisons are retained in the job temporary directory as `w231-character-diff-geometry.txt`, `w231-character-diff-labels.txt` and `w231-character-diff-slider.txt`. Geometry constants and concatenation, label style branches, tentative-index clamp and accept semantics match; React memo caches/hooks and excluded gates are replaced by the documented host callbacks and modal owner. The files show the adaptations and are not copy-equivalence claims.

S-1 through S-7 checked: module hashes/AST ranges verified before product edits; command grammar and line-picker behavior retained; styled rows go through the source document renderer without text sanitizing ANSI; modal clock clears on finish/abort/close; waits use triangle/ready and exact persisted/request data; every adjustment reader and old driver is updated. Source/port comparison of geometry, label styles, clamp, accept and serializer expressions records only the host differences listed above. At widths below the fixed 42-cell source scale, the source layout clips the centered track; a compact scale is not invented. The question log records two fixture assertion corrections, the missing wire resolver and the typed SDK fixture correction.
