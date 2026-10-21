# W238 shift+tab permission-mode cycle

Status: implemented and verified locally, 2026-10-21. Local only; no push, no paid calls.

## Task card

- Entry is the Chat keybinding `chat:cycleMode` behind the composer. Source spells it `le`, and
  `le` resolves to `shift+tab` on every platform of this artifact (see Source gate).
- Outcome requires the live permission mode to advance by the recovered order, the footer chip to
  follow it, the change to stay session-scoped, and the key to be inert when a turn is running.
- Reuse the existing `/permissions MODE` transition; no settings write, no account or network work.
- Validate the compiled CLI, source ranges and independent review. One lead writer.

## Baseline

At ecfdd0f the Chat context has no shift+tab binding and the footer chip changes only through
`/permissions MODE`. The recovered tree binds shift+tab to a handler that computes the next mode
with `BBt` and applies it to the permission context.

## Source gate

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Ranges are zero-based UTF-16 code units, half-open, verified against extracted-v2/manifest.json.
Recovered application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-nw76x9y3.js | ad5bcf821ca92d9cf7554a77bec08fb05b9d89a085ff5d6a6569fe4df6edc4a8 | `Dj` [805,1005), `UBt` [1005,1071), `BBt` [1071,1371), `sjr` [1371,1450) |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | handler `Pq` [882826,884298), `Ax` [887106,887134), chat map at 887474 |
| chunk-6ccen3s8.js | 4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d | key token `le` at 1933, Chat binding at 2679 |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | `O_` 3605667, `_M` 3605748 (auto gate, adapted) |
| chunk-np2hxx6s.js | b51e24d5bda405827dc889616e86032fef2c4de9f5a2a994d4610b6d048a40c7 | `Iv` 809, `uuo` settings check |
| chunk-yvnhkg35.js | ce3689687897e987959f19ab07f98d79e5c925a8b15620dce02d29ba4943348d | `nA()` returns true at 1245 |
| chunk-bk5ct2gw.js | efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1 | `Yho` = `Bun.semver.satisfies` |

`BBt(e,o)` switches on the live mode: `default -> acceptEdits -> plan`; from `plan` it returns
`bypassPermissions` when `UBt` holds, else `auto` when `Dj` holds, else `default`;
`bypassPermissions -> auto` or `default`; `dontAsk -> default`; anything else `default`.
`UBt` reads `isBypassPermissionsModeAvailable` and `!Iv()`; `Dj` reads `isAutoModeAvailable` and
`O_()`. The handler takes the live permission context, computes that step, ignores a no-op step,
and applies `{...context, mode}`; it also announces `[<indicator> on]` through the screen-reader
queue (`tV`), records a plan-use timestamp, and, for an in-process teammate task, updates that
task's mode instead of the session.

The chord token is `le = Le ? "shift+tab" : "meta+m"` with
`Le = L !== "windows" || (nA() ? Yho("1.4.3", ">=1.2.23") : <node version range>)`
(chunk-6ccen3s8.js 1933). On this artifact `nA()` is the constant `true` and
`Yho("1.4.3", ">=1.2.23")` holds, so `Le` is true everywhere and the Windows
`meta+m` fallback is never selected. The local binding transcribes the resolved
`shift+tab` for every platform, and the file header records the resolution.

## Adaptations and ownership

- `src/permission-cycle.ts` ports the cycle table in the source's external spelling, the bypass
  availability read and the command builder. `internalCycleMode` maps only the bypass name back
  to this product's policy spelling (`V3`/`vc` do the same).
- Bypass availability reads the session's existing `isBypassPermissionsModeAvailable`. The source
  `Iv` check reads the `disableBypassPermissionsMode` settings key, which this host does not carry;
  the session field is already false unless the session was launched in bypass, which is the
  source's other half.
- Auto availability is an explicit local adapter: `Dj`'s `O_` gate reads the vendor circuit-breaker,
  settings and model-capability tables, none of which exist here, while `/permissions` offers auto
  unconditionally, so the cycle treats auto as available.
- The product applies the step by queueing the recovered `/permissions MODE` command, so plan/auto
  bookkeeping and hooks stay on the existing transition path. The source updates the context
  synchronously; here the key is ignored while a turn or dialog owns the loop instead of queueing a
  transition that the command boundary would refuse. A press that lands before the previous queued
  step runs computes from that pending command, so a quick second press still advances again, and a
  wrap repeats a command that may still be queued because every press applies exactly once in the
  source. The
  screen-reader announcement, plan-use timestamp and in-process-teammate branch have no local
  consumer and stay unported.
- `src/session.ts` now carries a launch-granted `isBypassPermissionsModeAvailable` through a live
  mode change. The source builds the flag once per session context, so leaving bypass and cycling
  back must remain possible; previously the successor session recomputed it from the new mode.
- `src/tui-keys.ts` binds shift+tab in the Chat context; `src/interactive.ts` handles the action.

## Throughput

One bounded independent reader checks the ranges, table and integration. One lead writer owns all
product changes. The compiled acceptance drives the real CLI under a PTY.

## Validation

- `npm run check` and `npm run build` pass.
- 6 permission-cycle tests and the TUI action test pass; keybindings tests stay green.
- Full suite: 2987 tests, 2986 pass. The single failure, CLI effort flag overrides environment,
  remains the pre-existing W231 divergence reproduced at HEAD5717eb9.
- Compiled acceptance `.audit/w238-cycle.mjs`: 14/14 checks at identity
  53e16e5cdd50dde92627f457263e6e894e325fe517855d4a9106af6cfe548afe. It covers: a default session
  cycles manual -> accept edits -> plan -> auto -> manual; the cycle writes nothing to settings; a
  non-empty composer keeps its draft; a bypass session cycles bypass -> auto -> manual -> accept
  edits -> plan -> bypass, proving the launch-granted bypass stays available; a fresh session
  returns to the settings default; two quick presses advance two steps, proving a pending queued
  step is used as the current mode instead of the stale live one; and five quick presses wrap once
  and land on accept edits, proving a repeated step at the wrap is not dropped. Every CLI exits
  zero.
- Independent review found no high findings. Its two media items were assessed: the wrap drop was
  real and is fixed by queueing every computed step without the identical-command dedupe, with the
  new five-press check; the Windows `meta+m` branch does not exist on this artifact (`le` resolves
  to `shift+tab` everywhere, see Source gate), so the unconditional binding stays and the header
  and record now carry that evidence. Its two low items are closed: the missing digest is filled
  and a non-bypass carry assertion was added.
