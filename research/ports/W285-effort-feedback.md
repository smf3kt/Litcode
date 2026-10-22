# W285 effective effort feedback

Status: verified locally. Independent review repairs rechecked. Local UI only.

## Task card

- Entry: effort arguments, the effort slider, model selection, config rebind and focus.
- Outcome: effective effort feedback with the ultracode suffix, deduplicated and cleared after 10000 ms.
- Source: `ZZ`, `eee`, `DS`, and the `Ix` notification effect in `chunk-24k7d6mw.js`.
- Targets: `effort-command.ts`, `interactive.ts`, `reload.ts`, `terminal.ts`, `tui.ts`, `tui-renderer.ts` and affected tests.
- Shape: effective label is the comparison key. An optional active notice owns its text and timer.
- Mode: adapt `eee` and the effect to the existing local terminal owner, preserving local effort resolution.
- Validation: compiled CLI, real 10000 ms expiry, local command/model transitions, request effort and clean exit.
- Done: source comparison, necessary regressions, check/build, content identity and a local commit.

## Source preflight

Sample 2.1.296 SHA-256 is `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
`chunk-24k7d6mw.js` matches its manifest SHA-256
`1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`.
Acorn 8.15.0 parsed these zero-based UTF-16 code-unit ranges, half-open.

| Body | Range | Contract |
| --- | --- | --- |
| `ZZ` | `[153220,153274)` | No level in brief mode or for a model without effort. Otherwise `qC(model, selection)`. |
| `DS` | `[153274,153296)` | The fixed key `effort-level`. |
| `eee` | `[153296,153407)` | No label for absent effort. Glyph or `effort:` prefix, level, optional ` · ultracode`, ` · /effort`. |
| `z$` | `[153407,153563)` | Existing local `effortGlyph` mapping. |
| Feedback effect | `[894148,894249)` | Remove the old key, then add `{kind:"feedback",priority:"high",timeoutMs:1e4}` if a label exists. |
| Effect dependencies | `894255` | `[Ix,cl,Ec]` means unchanged label does not re-arm the notice. |

Body SHA-256 for `eee` is `f6ce829ad79d82d3015c6e468868fb167873fabb3eb0358a5e3d01984ba01ec3`.
Effect SHA-256 is `0db332fa095120c4c2ffecafab8ee157c470d9f399347eddfd5d2654d5cc00c2`.
The source hook `rv` in `chunk-2932rvqh.js` reads `uc(state)`.
Its module hash is `235dda5306eb2e813522d89fa7bbe4399804e6c676c84f09bcb40c32fd3d68c4`.
`uc` [12346,12719), `kE` [12972,13279), and `qC` [14204,14273) in
`chunk-9vcaezw1.js`, SHA-256
`eccb69a1f121aa90407d23fbd69b3167178da1b759c1a4cd8b29609d15cb98e0`, give environment precedence
and the `high` fallback. W231 already ports environment resolution at the request boundary.

## Host adaptation decided before implementation

The existing formatter omits the ultracode argument. The interactive command writes the label
to the persistent status string, with no timer, and model changes do not refresh the label.

A terminal-owned effort notice has its own active slot and cancellable timer, with the last
derived label as a deduplication key. The provisional left-status adapter hid later status writes
in a decoded probe. Source investigation acquired `Hfe` [11971,12618) in `chunk-qfjvvwpv.js`,
SHA-256 `116de8fc147859476928cc4bb1a0c61d1a54b1373f46eb01bfee91349e1b2504`.
Its plain-text arm is `n({color:o.color,dimColor:!o.color,wrap:"truncate",children:o.text})`.
`Vo` [11925,11971) reads the current notification. `Cj` [1299,1359) and `hEe` [1359,1431)
in `chunk-356hrhz3.js`, SHA-256 `0c821efb255e53af566480e6263c87c8be068ed1a7dae3205b2964f0f0c9076a`,
hide it while the diff panel holds toasts. `oue` [789157,789881) in `chunk-24k7d6mw.js` aligns
notifications to the footer's right. Fullscreen mount `D9` [906888,907115) hides during suggestions.
The adapter uses that right-aligned dim/truncate arm beside the existing footer left text,
bounded to half the local row so ordinary status remains visible. Paste and shell hints remain
left text. Dialogs use the same footer seam rather than the source modal's top separator.
Generic notification queuing, hold/pause accounting, voice/onboarding and screen-reader prefix
routing remain out. The local diff visibility and suggestion list are the relevant display gates.
`effortIndicator` retains its prefix argument for existing callers and adds the source ultracode arm.
The absent-level gate becomes explicit. All local models still accept every effort level, as in W212.

`refreshEffortUi` binds the source effective-label inputs after config binding, model apply and
effort apply. It uses the existing `modelEffort`, `effortOverride`, `DEFAULT_EFFORT` and workflow gate.
`setBriefTranscript` and `setUltracodeTag` recompute the notice when their existing state changes.
Close cancels its timer. Expiry does not mutate the draft, config, saved defaults or model requests.

## Review repairs

The review also reproduced a footer width defect: the adapter narrowed `Tde` only after the host
padded the hints for the full width, clipping `ctrl+c to interrupt` at 80 columns. `oue` and its
parent `Vs` [788625,788742) allocate left and right column widths before text layout. The local
footer seam now resolves status and hint content after reserving the feedback width.

Independent review found an inherited-default reload mismatch. A direct probe confirms a reloaded
`modelSettings.fixture.effortLevel=xhigh` yields an xhigh label while `next.effort` remains low.
`uc` [12346,12719) reads `sessionEffort.kind`: level returns its value, default returns undefined,
and inherit re-reads `de(settingsEffortTable, model)`. `se` [10679,11697) and `de` [11834,12021)
own the refreshed table and per-model fallback in `chunk-9vcaezw1.js` at the SHA recorded above.
The host stores that derived value in `config.effort` for Agent.request. At the reload boundary,
an inherited selection now refreshes that snapshot with the same `modelEffort` used by the label.
Manual/default selections retain their existing behavior. The extended reload regression fails
before repair with `low !== xhigh`. The final compiled run reloads medium into an inherited low
session, checks the medium label, and verifies medium on the next owned provider request.

## Throughput checkpoint

Source and owner checks precede edits. One writer owns the coupled local chain. Verification uses
the existing PTY/xterm driver and at most three new regression groups. No shared writer or service.

## Validation

- `npm run check` exits 0. `npm run build` exits 0.
- Affected suites pass 178/178 across effort-command, effort-slider, effort-slider-opener, model-picker,
  tui-model-picker, tui, terminal, interactive, tui-statusline and reload. Three feedback groups and
  the extended existing reload group cover every formatter arm,
  the 10000 ms deadline, unchanged-label dedup after expiry, replacement cancelling the old deadline,
  close cleanup, brief and ultracode gates, suggestions, paste-hint coexistence, 40-to-120-column
  resize, the source inactive foreground (`rgb(153,153,153)` on dark), inherited-default reload and
  the 80-column interrupt hint beside effort feedback.
- `W285_RESULT=<path> node .audit/w285-effort-feedback.mjs` exits 0. Source preflight checks the
  module against the manifest, both exact source-range hashes and all compiled formatter branches
  against the isolated recovered pure formatter. No recovered application entrypoint runs.
- Compiled acceptance passes 26 checks through expect and the xterm decoder. Initial inherited
  low expires after 10010 ms, and status or a same-level update does not rearm it. Typed model
  changes and picker acceptance follow target defaults. The effort slider, ultracode suffix,
  focus and saved-mode config reload refresh the feedback. LLM_EFFORT wins over a saved choice.
  Auto displays high and leaves wire effort absent. Four explicit prompts reach owned loopback
  SSE with the expected model and effort. UI commands add no model request. All CLI processes exit
  zero, history and session locks are released, and journals omit the fixture credential.
- Existing compiled config driver passes 35/35, including the Config model/effort chain and 20-column
  picker. Existing history-border driver passes 17/17. All run against final identity `66d6817e...`.
- Full suite is not repeated for this local display package. The last full result remains W283's
  3201/3202 with the existing `cli-migration.test.ts:87` effort mismatch.
Both independent findings were repaired. A bounded read-only recheck confirmed inherited request
agreement, prior-owner immutability and both footer rendering paths, with no remaining findings.

Final content identity is `66d6817e7894805f29f1e48986a2db0dc65b7d9e6fe5cfc73ae8b69d4437a588`.
Inputs are `f92ff3fbbe14d149772318690003a66e95ac6c38946c900f591cefcdc5347979`.
Validation is `ef7b985204ddef08cbd8ed87a34fe22b4bee2a7838205b2f55493dc474c9ea97`.
Build is `3e69c316fb50b852c03ff0a993d8050014ec3726fc16740c336b334bf08fb9b5`.
All final tests and compiled drivers use that identity. Logs and identity live under the job
temporary directory as `w285-focused-final.log`,
`w285-check.log`, `w285-build.log`, `w285-cli.log`, `w285-cli-result.json`, `w285-config-cli.log`,
`w285-history-cli.log`, `w285-repair-focused.log` and `w285-verified-identity.json`.

## Coding-standard check and limits

S-1: module/range identity and decoded placement probes precede final assertions. S-2: existing
command and status expectations remain. S-3: feedback is renderer output and never joins draft,
request or persistence. S-4: the terminal owns and cancels its timer; the dedup key survives expiry.
S-5: the reload driver uses the measured clipped prefix and an actual mode change. S-6: typed and
picker model paths, slider and argument effort paths, config rebind and all footer readers use the
new seam. S-7: source formatter, effect, selector and placement evidence are recorded above.
Corrections are retained in `research/question.md`; that pre-existing ignored log stays local.
LLM_EFFORT=unset is accepted by the runtime resolver but rejected by the existing startup parser.
This package tests the reachable auto fallback and makes no compiled claim for unset startup.
