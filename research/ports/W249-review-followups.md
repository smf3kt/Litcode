# W249 review follow-ups for the live switches

Status: implemented and verified locally, 2026-10-22. Local only; no push, no paid calls.

## Task card

- Close the second independent review's findings on W246/W247 (reviewer `aa44033c924175cd6`):
  - the confirmation's focused row was No, while the source binds enter to `confirm:yes`;
  - `switchModelInPlace` awaited the effort default write that `w9` calls unawaited, so a
    blocked settings queue stalled the live switch;
  - `dk`'s revalidation compared only the model, while `fw` reads model and permission mode;
  - two citations named `838388`, which is inside the paste handler, not `lL`;
  - the W247 record called `895434` `FL` and `863369` `w8t`;
  - the W247 record claimed the dialog "never owns the keyboard", but `SG` registers
    `confirm:no`/`confirm:yes`, so the host chord handoff is an adaptation;
  - the digest exclusion also relaxed the first-bind guard, so a session with another model
    could adopt a connection built for a different one.
- One package: the confirmation focus, the unawaited effort write, the mode-aware revalidation,
  the digest split, and the citation corrections.

## Source gate

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Ranges are zero-based UTF-16 code units, half-open, verified against extracted-v2/manifest.json.
Recovered application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | `SG` confirmation keys 626232/626467, `w9` 894465 with the unawaited `X9(Ex,iae(lC),k9,Xn)` at 894527, `FL` 895326, `w8t` 863360, `lL` 882215 |
| chunk-6ccen3s8.js | 4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d | Confirmation bindings 4063 (`enter:"confirm:yes"`, `escape:"confirm:no"`) |
| chunk-hh0bresc.js | 676add2366d870ee2f7ed3405c6ca095d9079f0cf20aebf11fabb56a52ddb455 | `dk` 8545 (identity and revalidation) |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | `fw` 2937319 = `Gqt(zqt(e), e.toolPermissionContext.mode)` |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | `w9` live write order 894560-894700 |

## Recovered behaviour

- `SG`: `Ze("confirm:no", He)` and `Ze("confirm:yes", je, {isActive: Je})`; the Confirmation
  context binds enter to yes and escape to no, so the warning dialog approves on Enter.
- `w9`: `if(Ex!==void 0)X9(Ex,iae(lC),k9,Xn);` runs before the live `dr(...)` update without
  `await`. `X9` returns `{error}` instead of throwing, and `w9` ignores that result; only the
  model default write (`R_t`) is awaited and shapes the notice.
- `dk`: `i=fw(d())` captures `Gqt(zqt(e), e.toolPermissionContext.mode)`; after the hooks,
  `fw(o())!==i` re-runs once and blocks on a second move.
- `I` also derives hook pairs for the current mode and its alternate (`plan`/`default`); this
  host's PreModelSwitch payload carries only the model fields and stays as recorded in W245.

## Adaptations and ownership

- The host's generic confirmation now lists Yes first and focuses it, so Enter approves and
  Escape cancels like the Confirmation context. This is the only change to shared confirmation
  behaviour; the source renders no rows, so the row layout stays a host adaptation.
- `switchModelInPlace` fires `saveConfigModelEffort` without awaiting it and mirrors
  `modelSettings` only after the write resolves; the switch no longer waits on the settings
  queue, and a failed effort write still leaves the model applied.
- `preModelSwitch` compares a `model + permission mode` identity, matching `fw`. This host
  serialises `/permissions` through the command queue, so a mode change cannot currently land
  inside a running hook; the comparison is parity with the source and guards any future
  immediate mode path.
- `runtime.ts` splits the digests: `liveConfigDigest` (live fields excluded) serves the
  same-session rebind and the journal owner check, while `connectionConfigDigest` (full) still
  guards a first bind. A first bind with another model is rejected as before.
- Citations corrected: `thinking-dialog.ts` and the `lL` comment now name `882215`; the W247
  record names `FL` 895326 and `w8t` 863360 and records the chord handoff as an adaptation.

## Validation

- `npm run check` and `npm run build` pass.
- `test/runtime-mcp-persistence.test.ts` 2/2 with the new first-bind regression (a session with
  `other-model` is rejected); `test/thinking-dialog.test.ts` 3/3; `test/interactive.test.ts`
  25/25.
- Compiled `.audit/w246-thinking-live.mjs`: 12/12 at identity
  `bf65a3e8dd3388bb53cb8b8471f3b582b619fef2676c925773214edbd6356844`; the confirmation is
  approved with a bare Enter, which the pre-fix focus rejected.
- W243, W244, W245, W247 and W248 rerun on the same identity: 9/9, 10/10, 10/10, 12/12, 9/9.
- Full suite: 3002 tests, 3001 pass; the single failure is the pre-existing CLI effort-flag
  divergence at HEAD.
