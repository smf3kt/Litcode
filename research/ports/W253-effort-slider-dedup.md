# W253 effort slider single opener

Date: 2026-10-22. Artifact SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
Coordinates are zero-based UTF-16 code units over `extracted-v2/modules/`.

## Defect

W244 moved `/effort` onto `applyEffortCommand` but left the earlier bare-command slider block in
the loop (`if (prompt === '/effort' && terminal?.prompt)`). The stale block ran first: it opened
`It`/`Ce` (chunk-76jkr621.js `[22174,30123)`, keys `[17514,17916)`), read `answer.key`, and
rewrote the prompt to `/effort LEVEL` with a local `pendingSessionOnly`. `applyEffortCommand`
then took the argument arm, where `sessionOnly` starts false, so `s` (for this session only) was
discarded and `MOe` (chunk-0q6c90q6.js 6286) persisted the level as the default. The W231
compiled arm failed at the session-only accept with the default-save message.

## Change

`src/interactive.ts` deletes the stale block. `applyEffortCommand` is the only opener for both
paths, which is the source shape: `kEo` (chunk-sfn1dbxq.js 1659192) runs the same local-jsx
command whether the submit gate is idle or mid-turn, and the slider answer feeds `MOe` directly.
No other behaviour moves; the queued `/effort LEVEL` argument arm and the mid-turn arm are
unchanged.

## Validation

- `npm run check` and `npm run build` pass.
- `test/effort-command.test.ts`, `test/effort-slider.test.ts`, `test/interactive.test.ts`,
  `test/model-picker.test.ts`, `test/thinking-dialog.test.ts`, `test/tui-model-picker.test.ts`:
  51/51.
- Compiled `.audit/w231-effort-slider.mjs`: 18/18, identity `5b52acc4…`. The `s` arm keeps the
  settings bytes, Enter still writes the default, max stays session-only on Enter, and the
  environment override still starts the slider.
- Compiled `.audit/w244-effort-live.mjs`: 10/10 at the same identity, covering the mid-turn
  argument and slider arms.
- `.audit/w234-autocompact.mjs` (updated in the same commit): 26/26. The live `/config` rows keep
  the settings snapshot the resumed session was opened with, so the driver now runs `/reload`
  before asserting the persisted `true`.
