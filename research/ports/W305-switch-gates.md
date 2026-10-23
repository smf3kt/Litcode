# W305 composer effort and model switch gates

Status: verified locally on 2026-10-23. Local commit only; no push.

## Task card

- Entry: `/model` (typed, picker and live), `/effort` (typed and slider), the max-effort state.
- Outcome: a switch made after the conversation has grown asks the recovered cache-miss question
  before it applies; the model switch notice is the recovered `Set model to …` form; a session at
  `max` effort with the reminder on carries the pinned `Max effort · … · /effort to change` row.
- Shape: one new module owns the recovered dialog text and the two gates; `interactive.ts` asks
  them in `switchModelInPlace`, `selectModel` and `applyEffortCommand`; `tui.ts` draws the row.
- Targets: `src/switch-confirm.ts` (new), `src/interactive.ts`, `src/tui.ts`, `src/terminal.ts`
  (dialog `confirmLabel`), `test/switch-confirm.test.ts` (new), `test/interactive.test.ts`.
- CLI: compiled `.audit/w305-switch-confirm.mjs` through `bin/litcode.mjs` under a real PTY.

## Source preflight

Sample 2.1.296, SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
All coordinates are zero-based UTF-16 code units, half-open. Every module digest matches the
manifest.

| Module | SHA-256 | Source ranges |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | `cie` 858783, `BJt` 858708, `FQ` 712145, `gqe` 712114, `Sqe` 712217, strings 858961/858977/859375/859561/859795/859954, `kh` 397561 |
| chunk-hh0bresc.js | 676add2366d870ee2f7ed3405c6ca095d9079f0cf20aebf11fabb56a52ddb455 | `KJn` 13170, `x_t` 10783, `Hve` 2154 |
| chunk-9vcaezw1.js | eccb69a1f121aa90407d23fbd69b3167178da1b759c1a4cd8b29609d15cb98e0 | `FNe` 13584, `fde` 4151, `Vb` 4235, `kE` 12972 |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | `ple` 1681312, `air` 1681409, `Vqt` 1681010, `x7` 1680764, `fle` 4359891, `gne` 4359921, `Bze` 4359965 |
| chunk-f5wjy38g.js | a81959c4f96008347bfdb2f900ad3e1bf8927b8b002bc5d05a298ae6078a50ee | `lt` 21771, notice builder 23096 |
| chunk-76jkr621.js | 09c383199652e7be3cc3b79215c6616e6653f6fa65c265ebe5e99e7dc43ae04e | `Ce` 18261, `Kept effort level as` 18701 |
| chunk-tcpnppq7.js | 97b2c9f0a7b1e068647ff67d1dc9b080e2295cfe694cfe832f82b4d7131572db | `B1` 7812 (300000), `cR` 7822 (3600000) |
| chunk-4bw62nzm.js | 1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713 | `Fg` 83409 |
| chunk-51w556q5.js | 936e82f9b226fcfd2f5e397cb01a04cb683196239269d4fecee39066649d521a | `Dn` 1471 |

Copied bodies:

```js
function KJn(e,o,r,s,n){if(n===void 0)return!1;let d=Fg();if(d===0||d===s)return!1;
  let i=Dn(iae(e));if(i===Dn(iae(R7({mainLoopModel:o,mainLoopModelForSession:r}))))return!1;
  let c=n.response?.message.model;
  return!(typeof c==="string"&&(c===i||sin(i)?.has(c)===!0))}
function FNe(e,n,r,s,f){if(!f)return!1;let d=Fg();if(d===0||d===s)return!1;if(!Vb(r))return!1;
  if(typeof kE(r,e)!=="number"&&typeof kE(r,n)!=="number"&&BUn(r,We(r)))return!1;
  if(kE(r,e,{carriedEffort:null})===kE(r,n))return!1;
  if(ll()&&e!==void 0&&Z_e(typeof e==="string"?Y9(e,r):e)===void 0)return!1;return!0}
```

Recovered branches that are out, each with its reason:

- `sin` (requested-to-served model latch) and `R7` (session model projection) have no local
  counterpart, so the family comparison is exact against the current and the last response model.
- `Vb`/`Jre`/`Bit`/`kE`/`BUn` read a per-model effort capability table this host has no source
  for (already recorded by W212 and W292), so every model supports every level, `Vb` is true and
  `kE` reduces to the effective level. `BUn` is therefore unreachable.
- `ll()` is the remote transport, absent here.
- `Z_e` only limits a remote session's default write.
- `cie`'s `overDraft`/`hideIndexes` and the `PreModelSwitch` hook reason belong to the hook gate,
  which this host already runs (`preModelSwitch`) before the cache gate; `cie`'s own hook branch
  is therefore unreachable here.
- `x_t`'s `unconfirmed` arm needs the source's settings write queue; this host's write is
  synchronous, so only the `failed` arm can occur.

## Implementation

- `src/switch-confirm.ts` owns the recovered dialog text (`Switch model?`, `Change effort level?`,
  `Your next response will be slower and use more tokens`, `Yes, switch to X`, `No, go back`), the
  two gates, the notice builder (`Set model to X`, ` and saved as your default for new sessions`,
  ` for this session only`, the effort clause), `Kept model as X`, `Kept effort level as X`, and
  the pinned max-effort row with its environment gate.
- The cache clock reads the journal: `totalOutputTokens` sums each response's `usage.output_tokens`
  (source `Fg`), `lastResponseModel` is the newest response's model (source `x7`), and
  `cacheIsCold` compares the newest `turn_end` timestamp against the main-thread lifetime `cR`
  (1 hour). The recovered reads the last assistant message's own timestamp; this host stamps no
  per-message time, so the turn end stands in for it, and the adapter is recorded here.
- `interactive.ts` keeps the acknowledgement in a loop-local variable (source `BJt` writes it to
  the app state). Both switch paths (`switchModelInPlace`, `selectModel`) run the model gate and
  then the effort gate before any write, matching `lt`'s order; a refusal writes `Kept model as X`
  and returns without touching the session. `applyEffortCommand` runs the effort gate for a level
  change, and the slider's ultracode toggle now waits for that answer instead of moving early.
- `confirmSwitch` draws `cie`'s dialog through the existing prompt surface with the recovered
  button labels; `TerminalPromptRequest.confirmLabel` was added so a dialog can name its focused
  action without changing any other prompt's guide.
- `tui.ts` draws the pinned row in the progress band while the session sits at `max` and
  `LITCODE_MAX_EFFORT_REMINDER` is on. The recovered registers it as a pinned notification keyed
  `max-effort`; this host has no notification store, so the row is drawn where pinned rows land.

## Verification

- `npx tsc --noEmit` 0, `npm run build` 0, `git diff --check` clean.
- `test/switch-confirm.test.ts` 8/8 (new): the verbatim dialog text, the notice builder with the
  saved/session/effort/failure forms, both gates across their boundary cases, the family key, the
  journal readers, the cache clock and the reminder gate.
- Related group (`switch-confirm`, `effort-command`, `effort-slider`, `effort-slider-opener`,
  `model-picker`, `tui-model-picker`, `picker-entry`, `interactive`, `status-command`, `tui`)
  166/166.
- `test/interactive.test.ts` 26/26: the new case seeds a cold-cache journal, asserts the dialog
  text and the target label, that a cancelled answer writes `Kept model as first-model` and keeps
  the session untouched, that a refusal does not acknowledge the tokens (the same change asks
  again), that a confirmation writes the recovered notice and moves the loop onto the successor
  session, and that a later switch no longer asks.
- CLI group (`cli`, `cli-advanced`, `login`) 29/29.
- Compiled driver `.audit/w305-switch-confirm.mjs` 14/14 at identity
  `cb89413f1fee3d2041169d4d69b21cab71cef3da0e89c5e6d8512c566c3fb50c`: a resumed cold-cache
  session asks before a family change, names the target model and the cache warning, keeps the
  model on cancel without reaching the provider, applies on confirm with the recovered notice and
  the saved suffix, does not ask again once acknowledged, continues the running turn on the new
  model, and draws the pinned max-effort row. One owned loopback server; paid upstream 0.

## Limitations

- The acknowledgement lives in the loop, so a resumed process asks once more. The recovered keeps
  it in the app state, which this host does not persist.
- `cacheIsCold` uses the turn-end stamp because the journal has no per-message timestamp. A turn
  that ran longer than the cache lifetime but ended recently reads as warm.
- The pinned row is drawn in the progress band rather than through a notification store; it
  therefore scrolls with that band and is not dismissible.

Existing tracked user changes in `.audit/w45-77-evidence.mjs` and `test/skills-command.test.ts`
remain outside this package. W301 and its cancelled loop remain paused.
