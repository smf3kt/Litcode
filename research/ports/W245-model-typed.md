# W245 the typed `/model` command runs mid-turn

Status: implemented and verified locally, 2026-10-22. Local only; no push, no paid calls.

## Task card

- Entry is the typed `/model` command: bare `/model` (picker) and `/model ID` (direct switch).
- The source registers `/model` as a local-jsx command with `immediate: true`
  (chunk-sfn1dbxq.js 1650742 `bWe`), so the submit gate (`zn`, chunk-24k7d6mw.js 1491124) runs it
  beside an active turn. The inline arm (`R`, chunk-naxwgf3s.js 14320) validates the id, runs
  `dk`, and performs the same live switch the picker uses; the bare command opens the picker
  ported in W243.
- Locally the typed command queued behind the turn and then refused mid-turn; W244 left it out of
  scope. This package adds the mid-turn submit arm.
- Validate the compiled CLI for both arms mid-turn, cite source ranges, take one bounded review.

## Baseline

At ab2717f a `/model` line typed during a turn stayed in the prompt queue; once drained, the
command path threw `Finish or continue the current turn first`.

## Source gate

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Ranges are zero-based UTF-16 code units, half-open, verified against extracted-v2/manifest.json.
Recovered application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | non-interactive registration `SWe` 1650517, local-jsx registration `bWe` 1650742 (`type:"local-jsx"`, `immediate:!0`) |
| chunk-naxwgf3s.js | 7ab116f8d6a266f3bc1b0e3d9d3e82bb5c60825a6ffa08c59cf1ad5925219c1d | inline `call` `R` 14320 (argument dispatch, availability probe `Mve`/`ze`, hook `dk`, switch `xWe`, notice and default-save result) |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | submit gate `zn` 1491124, picker accept `w9` 894465 / `FL` 895434 |
| chunk-hh0bresc.js | 676add2366d870ee2f7ed3405c6ca095d9079f0cf20aebf11fabb56a52ddb455 | pre-switch hook gate `dk` 8545 |

## Recovered behaviour

- With no argument the command opens the picker component; an argument is validated, run through
  the PreModelSwitch hooks, switched (default arm persists; an in-place live state write), and its
  notice returned. Hook `block`/`ask` refusals are returned as text.
- Immediate commands run while the turn guard is active instead of queueing; the dispatch carries
  `isMidTurn: true`.
- The availability probe and the usage-credit consent belong to the account catalogue; rows in
  this host are its own model set (W190/W243).

## Adaptations and ownership

- `onLine` intercepts `/model` while `turnController` is active and calls the shared
  `applyModelCommand`; the queued path still owns the idle command.
- `applyModelCommand` sends the bare form to `openModelPickerLive` (W243) and an argument to
  `switchModelInPlace` (W243's `w9`/`FL` port, sharing `preModelSwitch`), with the default-save arm
  and `PostModelSwitch`. The running turn's next request sees the new model because the request is
  built from live session state.
- No availability probe is performed: the local picker's model set is the host's own, and there is
  no account catalogue. The source's off-box/row-commit persistence and the usage-credit consent
  have no local producer and are out of scope with the source's non-interactive arm.
- The W244 fingerprint exclusion (`model`, `modelSettings`, `effort`, `effortSelection`) is what
  lets a later turn rebuild tools after this live switch.

## Throughput

One lead writer. One bounded independent review is bundled with W243/W244; it checks the immediate
registration, the inline arm's hook/persistence parity, and the acceptance.

## Validation

- `npm run check` and `npm run build` pass.
- `test/interactive.test.ts`: 25/25.
- Compiled acceptance `.audit/w245-model-typed.mjs` (wide PTY `.audit/w245-model-typed.exp`):
  10/10 at identity `2ae8a9fb6e94fc40ae0a37157eee1d3f741c7d93500c9aa01b063b553bc6b888`.
  Turn one holds the provider request, typed `/model` opens `Select model` mid-turn, Down+Enter
  accepts the seeded `second-model`, the held turn continues on it; turn two holds again, typed
  `/model third-model` applies directly, and its next request carries `third-model`.
- W243 and W244 acceptances rerun on the same tree: 9/9 and 10/10 at the same identity.
- Full suite: 2998 tests, 2997 pass; the single failure is the pre-existing CLI effort-flag
  divergence at HEAD.
