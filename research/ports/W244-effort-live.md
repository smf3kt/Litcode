# W244 `/effort` applies live, including mid-turn

Status: implemented and verified locally, 2026-10-22. Local only; no push, no paid calls.

## Task card

- Entry is the typed `/effort` command, both `/effort LEVEL` and the bare `/effort` slider, plus
  the slider adjusted from the model picker (W243).
- The source registers `/effort` as a local-jsx command with `immediate: true`
  (chunk-sfn1dbxq.js 1659192). The submit gate (`zn`, chunk-24k7d6mw.js 1491124) runs an
  immediate command while the turn guard is active, and the applier `MOe`
  (chunk-0q6c90q6.js 6286) writes the level to live state (`sessionEffort`) with a rollback on a
  failed write, never restarting the session.
- Locally `/effort` was queued until the turn ended, then refused mid-turn and applied through
  `applyConfig`, which opened a successor session. This package ports the immediate arm and the
  live application.
- Validate the compiled CLI mid-turn for both the argument and slider arms, cite source ranges,
  take one bounded independent review.

## Baseline

At 77be88a `/effort high` submitted during a turn stayed queued and, when drained, threw
`Finish or continue the current turn first`; the idle path opened a configuration branch.

## Source gate

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Ranges are zero-based UTF-16 code units, half-open, verified against extracted-v2/manifest.json.
Recovered application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | argument hint `Mjt` 1659192, local-jsx registration `kEo` 1659299 (`immediate:!0`), non-interactive registration `CWe` 1659495 |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | submit gate `zn` 1491124 (`In && (Qn || fromKeybinding) || Jn`), immediate dispatch 1491999, slider `It` 22174 |
| chunk-0q6c90q6.js | 97c49a70fcefc8407f6fc93c4b4c8d50a7b63ca8c6d3a3aba6627e91c761457b | level setter `D` 2541, applier `MOe` 6286 (live state, rollback), parser `P` 6037 |
| chunk-76jkr621.js | 09c383199652e7be3cc3b79215c6616e6653f6fa65c265ebe5e99e7dc43ae04e | slider component `It` [22174,30123), `s` session-only arm, Enter accept 21789 |
| chunk-9vcaezw1.js | eccb69a1f121aa90407d23fbd69b3167178da1b759c1a4cd8b29609d15cb98e0 | persistence `X9` 13965 (default arm only) |

## Recovered behaviour

- While a turn is active, an immediate local-jsx command runs beside the turn instead of entering
  the prompt queue; the dispatch marks `isMidTurn: true` and `dispatchedAsImmediate`.
- The applier sets `sessionEffort`, and on a failed write restores the previous effort and
  ultracode values. The default write (`X9`) runs only on the Enter arm; `s` is session-only.
- A read-only answer (usage, status, invalid argument) leaves the state alone. The level change
  also emits the `effort-level` status notice with its glyph.

## Adaptations and ownership

- `onLine` now intercepts `/effort` submissions while `turnController` is active and calls the
  shared `applyEffortCommand` directly, mirroring `zn`; the queued path calls the same function,
  so there is one implementation for both.
- `applyEffortCommand` keeps the ported slider (`effortSliderRequest`), `effortCommand` grammar
  and message text, but writes `session.config.effort`/`effortSelection` in place and performs the
  existing settings writes, instead of building a successor config and calling `applyConfig`. The
  next provider request reads the new level at `src/agent.ts:189`.
- The slider uses `options.signal` rather than `withTurn`, so opening it mid-turn does not replace
  the running turn's controller. The hook-less apply path is the source's own.
- The live write changes the session config without a successor session, so the runtime tool-set
  fingerprint excludes `model`, `modelSettings`, `effort` and `effortSelection`
  (`src/runtime.ts`); they shape requests only. Without that exclusion the next turn throws
  `Runtime owner configuration changed`. W243's model switch has the same dependency.
- Out of scope with the record: typed `/model` mid-turn (the chord is ported in W243; the typed
  command keeps the queued path), the `immediate` predicates for `/theme` and `/config`, ultracode
  and the workflow gate, the remote transport, and rollback on an asynchronous settings-write
  failure (the local writer has no failure channel; the in-memory state stays applied as before).
- `test/interactive.test.ts` encoded the old successor-session count; it now expects one
  configuration branch (the model switch) instead of two.

## Throughput

One lead writer. One bounded independent review will check the immediate gate, the live apply and
rollback semantics, the fingerprint exclusion, and both acceptance arms.

## Validation

- `npm run check` and `npm run build` pass.
- `test/interactive.test.ts`: 25/25, including the updated effort/model request assertions.
- `test/runtime-resources.test.ts`: 15/15; `test/interaction-runtime.test.ts` and
  `test/workspace-session.test.ts`: 14/14.
- Compiled acceptance `.audit/w244-effort-live.mjs` (wide PTY `.audit/w244-effort-live.exp`):
  10/10 at identity `2ae8a9fb6e94fc40ae0a37157eee1d3f741c7d93500c9aa01b063b553bc6b888`.
  A first turn starts on the stored `low` effort, `/effort high` runs while the turn is held,
  the turn's next request carries `high`; a second turn starts on `high`, the bare `/effort`
  slider opens mid-turn, Right+Enter accepts `xhigh`, and the next request carries `xhigh`.
- W243's compiled acceptance was extended to a later turn after its live model switch and passes
  9/9 at the same identity, covering the fingerprint fix.
- Full suite: 2998 tests, 2997 pass; the single failure is the pre-existing CLI effort-flag
  divergence at HEAD.
