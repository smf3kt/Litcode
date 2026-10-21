# W247 review fixes for the live model, effort and thinking switches

Status: implemented and verified locally, 2026-10-22. Local only; no push, no paid calls.

## Task card

- Close the independent review's findings against W243/W244/W246 (reviewer
  `aef4840949a82ea68`, SOUND with no high findings):
  - the picker's default write ran before the live switch and aborted it on a write failure;
  - `preModelSwitch` did not revalidate the model a hook read (`dk`'s second pass);
  - the MCP journal digest read a live model/effort/thinking write as a configuration change;
  - the effort live write was not rolled back when its default write threw (`MOe`);
  - the picker and thinking chords could not close their own open dialog.
- Keep one package: source order and failure text for the switch, the digest exclusion, the
  rollback, and the chord toggle, each with an acceptance arm.

## Baseline

At 0c63580: the picker ran `saveModelSetting` before `session.config.model` moved, so a corrupt
`settings.json` made the picker accept throw and leave the model unchanged; `/effort` kept the
new level after a throwing write; with `mcpPersistence`/`mcpRecovery`/`mcpSubscriptions` on, a
live switch made `bindSession` and journal-owned MCP tools throw; `alt+p`/`alt+t` while their
dialog was open were swallowed.

## Source gate

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Ranges are zero-based UTF-16 code units, half-open, verified against extracted-v2/manifest.json.
Recovered application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | picker accept `w9` 894465 and `FL` 895434, panel toggle `S8t` 863272 / `w8t` 863369, thinking accept `kp` 898567, handler `lL` 882215 |
| chunk-hh0bresc.js | 676add2366d870ee2f7ed3405c6ca095d9079f0cf20aebf11fabb56a52ddb455 | hook gate `dk` 8545 (revalidation), default write `R_t` 10432, failure text `x_t` 10783 |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | success suffix `gne` 4359915 (` and saved as your default for new sessions`), `fle` 4359891 (`Set model to `) |
| chunk-0q6c90q6.js | 97c49a70fcefc8407f6fc93c4b4c8d50a7b63ca8c6d3a3aba6627e91c761457b | applier `MOe` 6286 (snapshot and restore) |
| chunk-9vcaezw1.js | eccb69a1f121aa90407d23fbd69b3167178da1b759c1a4cd8b29609d15cb98e0 | persistence `X9` 13965 (async; `w9` calls it without `await`) |

## Recovered behaviour

- `w9` writes the effort default first (`X9`, not awaited), then the live state, then awaits the
  model default write (`R_t`) only for the save arm. A failed `R_t` returns `{kind:'failed'}`;
  the model stays applied and `x_t` appends
  ` · couldn't save it as your default: <settings> can't be written (<error>)` (or
  `isn't valid JSON`). The save arm's success text is
  ` and saved as your default for new sessions`; the `s` arm is ` for this session only`.
- `dk` reads the current model before the hooks and, if any hook moved it, re-runs the gate once;
  a second move blocks with `the session model changed while a PreModelSwitch hook was running;
  pick again`.
- `MOe` snapshots `sessionEffort`/`ultracode` at its first live update and restores them when
  the write reports no update.
- `aL` and `lL` toggle their panel: `S8t(v){return !v}`, `w8t(v){return !v}`, applied to the
  panel state the chord handler reaches.

## Adaptations and ownership

- `switchModelInPlace` now follows `w9`'s order: hook gate, effort default write (failure
  ignored like the source's unawaited `X9`), live model and effort, model default write, with the
  recovered success and failure suffixes. The failure text uses the local absolute settings path.
- `preModelSwitch` takes the internal `revalidating` flag and re-runs once; the second move
  throws the recovered message.
- `applyEffortCommand` snapshots `effort`/`effortSelection` before its live update, restores them
  when `saveEffortSetting` throws, and rethrows so the caller reports the error.
- `connectionConfigDigest` now excludes the live request fields through a new `fingerprintOf`
  helper (`src/session.ts`), matching the tool-set fingerprint exclusion. This digest is a local
  adapter for the MCP journal owner; the source has no counterpart, and these fields never shape
  an MCP connection.
- `TuiTerminal` hands `\x1bp`/`\x1bt` to the host while a modal dialog is open, where the host
  aborts the matching `liveDialog`; the source's panel state is inline and never owns the
  keyboard, so this restores the chord's toggle for the modal host. A mismatched chord is
  ignored rather than opening a second dialog over the first.
- The picker and thinking dialogs register their abort controller (`withLiveDialog`) so the
  chord can close them; an aborted dialog writes no error.

## Throughput

One lead writer. The review's findings are the scope; the compiled acceptance covers all five.

## Validation

- `npm run check` and `npm run build` pass.
- `test/thinking-dialog.test.ts` 3/3 (new chord handoff test), `test/runtime-mcp-persistence`
  1/1 with the new live-field regression (it fails with
  `Runtime session configuration differs from its connected settings` when the digest fix is
  stashed), `test/interactive.test.ts` 25/25.
- Compiled acceptance `.audit/w247-review-fixes.mjs` (wide PTY `.audit/w247-review-fixes.exp`):
  12/12 at identity `16917da48eecb196a952c8a4682601e467f88bdf6f2398d1f9a29013e7301098`.
  With a corrupt settings file: `/effort high` reports the JSON error and the next request keeps
  `low`; `alt+t` opens and closes the thinking dialog; `alt+p` opens, the same chord closes it,
  it reopens for a real pick, and the failed default write leaves `second-model` applied with
  `couldn't save it as your default`.
- W243, W244, W245 and W246 rerun on the same tree: 9/9, 10/10, 10/10, 12/12 at the same
  identity.
- Full suite: 3001 tests, 3000 pass; the single failure is the pre-existing CLI effort-flag
  divergence at HEAD.
