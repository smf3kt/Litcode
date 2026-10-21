# W243 the model-picker chord's direct open and live switch

Status: implemented and verified locally, 2026-10-22. Local only; no push, no paid calls.

## Task card

- Entry is the Chat chord `alt+p` (`chat:modelPicker`), the composer action that previously queued
  the `/model` command.
- The source's local arm (`aL`, chunk-24k7d6mw.js 881614) does not run a command: it toggles the
  picker panel (`fa(S8t)`) and closes the help overlay. The picker's accept arm writes the chosen
  model to live application state (`mainLoopModel`, `sessionEffort`) and persists the default,
  with no session restart and no running-turn gate, so the chord works mid-turn.
- Locally the chord queued `/model`, and the command refuses while `session.awaitingResponse`;
  accepting also moved through the successor-session path, which ends the running turn. This
  package ports the source's local arm and its in-place accept.
- Validate the compiled CLI mid-turn, cite source ranges, take one bounded independent review.

## Baseline

At 43d3346 the chord queued `/model`; pressing it mid-turn surfaced
`Finish or continue the current turn first`, and only an idle press opened the picker.

## Source gate

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Ranges are zero-based UTF-16 code units, half-open, verified against extracted-v2/manifest.json.
Recovered application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | chord handler `aL` 881614 (remote feedback 881678, `He("/model",om,{fromKeybinding:true})` 881824, local `fa(S8t)` 881896); picker component `uBe` 617998; accept arm `w9` 894465 and `FL` 895434 (live state write 894727, effort save `X9` call 894692, feedback 894885); render of the panel 897377; `S8t` 863281 |
| chunk-hh0bresc.js | 676add2366d870ee2f7ed3405c6ca095d9079f0cf20aebf11fabb56a52ddb455 | pre-switch hook gate `dk` 8545 (revalidates when the session model moved during a hook) |
| chunk-6ccen3s8.js | 4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d | `ModelPicker` context 7848 (row keys, left/right effort step, `s` session-only) |
| chunk-9vcaezw1.js | eccb69a1f121aa90407d23fbd69b3167178da1b759c1a4cd8b29609d15cb98e0 | effort persistence helper `X9` 13965 (save only on the default arm) |

## Recovered behaviour

- Remote sessions (`Ht()`) show `Use /model to change the model in cloud sessions` when loading,
  in a non-prompt mode, or while a picker request is in flight; otherwise they invoke `/model`
  with `{fromKeybinding:true}`.
- Local sessions toggle the panel state and close help; the chord is not gated by the running
  turn.
- Accept runs the PreModelSwitch hooks (`dk`), writes `mainLoopModel` and `sessionEffort` into the
  app state, persists the model default on the enter arm (`R_t`/`saveModelSetting`), persists a
  touched effort only on the default arm (`X9`), and emits
  `Model set to <model>` with ` for this session only` on the `s` arm. The running turn's next
  request uses the new model because the request is built from live session state.
- A hook decision of block reports `model-switch-blocked`; a hook `ask` that is not approved also
  blocks the switch.

## Adaptations and ownership

- The TUI already emits `chat:modelPicker`; the host action handler now calls
  `openModelPickerLive` (a host closure assigned after the picker helpers) instead of queueing
  `/model`. The source's cloud branch has no local producer and is not ported.
- `openModelPickerLive` reads the same dialog (`modelPickerRequest`, already ported with `uBe`),
  builds its row set from the live model plus agent-type, skill and recorded-session models
  (`modelPickerModels`, shared with the command path), and calls `switchModelInPlace`.
- `switchModelInPlace` is the `w9`/`FL` port: it runs `preModelSwitch` (the extracted `dk` gate
  shared with `selectModel`), saves the default model when `sessionOnly` is false, saves the
  touched effort on the same arm, mutates `session.config.model`, `effort` and `effortSelection`
  in place, and emits `PostModelSwitch`. No successor session is opened, so an in-flight turn is
  not ended and its next provider request sees the new model.
- The chord path opens the dialog directly, so it works while the agent turn is awaiting the
  provider. It does not take `withTurn`, so it does not replace the running turn's controller; it
  uses the session signal for the hook and the dialog.
- Out of scope with the record: the cloud-session branch, fast-mode state in the same accept arm
  (`gW`/`fastMode`), the `showFastModeNotice` row, and the account-gated catalogue. The picker's
  per-model capability table remains out (W190 documented it), so every row offers every effort
  level. The typed `/model` command keeps its successor-session path; only the chord and its
  accept use the live path.

## Throughput

One lead writer. One bounded independent review will check the handler arm, the live-switch
semantics against `w9`/`FL`, the effort-save arm, and the mid-turn acceptance.

## Validation

- `npm run check` and `npm run build` pass.
- `test/tui.test.ts`, `test/tui-model-picker.test.ts` and `test/model-picker.test.ts`: 87 tests
  pass; the picker's row/effort/accept behavior is unchanged.
- Compiled acceptance `.audit/w243-model-picker.mjs` (wide PTY `.audit/w243-model-picker.exp`,
  rows 30 columns 160): 8/8 at identity
  `2fc7033fec12dbaa8ab937ec2cd5b7f4c70a70f4a1282b40a3907d78748cd606`. The fixture provider holds
  the first turn open; the chord opens `Select model` while that turn runs, a down-arrow plus
  Enter accepts the seeded second model and shows `Model set to second-model`, the held turn then
  continues and its second provider request carries `second-model`, the turn finishes, and the CLI
  exits zero.
- Full suite: 2998 tests, 2997 pass; the single failure is the pre-existing CLI effort-flag
  divergence at HEAD.
