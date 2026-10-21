# W248 `/config` Thinking mode applies live

Status: implemented and verified locally, 2026-10-22. Local only; no push, no paid calls.

## Task card

- Entry is the `/config` dialog's `Thinking mode` row.
- The source row (`chunk-nybcbd9t.js` 15590) writes live `thinkingEnabled` and persists its
  setting (`P({alwaysThinkingEnabled: e ? undefined : false})`) instead of restarting the
  session; the value is `_4e(alwaysThinking, model)` (`chunk-bk5ct2gw.js` 400925), and a model
  that rejects disabled thinking locks the row.
- Locally the row took the generic `applyConfig` path, which opens a configuration-branch
  session. This package applies the row live like the W246 chord.
- Validate the compiled CLI for the live write and for another row still branching.

## Baseline

At `1a5ecc1` toggling `Thinking mode` to true in `/config` created a second session file; the
next request did carry thinking, but through a successor session.

## Source gate

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Ranges are zero-based UTF-16 code units, half-open, verified against extracted-v2/manifest.json.
Recovered application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-nybcbd9t.js | 0abe0d704940977466d81c1efab7f953d8f9dac0f30cd758c4a3d0286b5c1bca | `thinking` row 15590 (value, lock, `onChange`) |
| chunk-bk5ct2gw.js | efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1 | `_4e` 400925 (enabled unless the setting is false or the model rejects disabled), `kyo` 401809 (`alwaysThinkingEnabled` override), `rS` 51 (model capability) |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | `kp` 898567 (the live `thinkingEnabled` write the chord shares) |

## Recovered behaviour

- `onChange(true)` clears the `alwaysThinkingEnabled` override; `onChange(false)` writes
  `alwaysThinkingEnabled: false` and refuses when the model cannot disable thinking. Both arms
  write live state and log the toggle.

## Adaptations and ownership

- The local settings key is `thinking` (`parseSettings`, `src/runtime.ts:216`), not
  `alwaysThinkingEnabled`; `saveConfigPanelSetting` already owns that write, so the row persists
  first and then writes `session.config.thinking` live. The key substitution is the only
  settings-level adaptation.
- `_4e`/`rS` need the model capability table this host has no source for, so no lock or forced-on
  value is shown; same recorded gap as W246.
- The change callback returns early with `configPanelInput(session.config)`, so the panel repaints
  the row and the accumulated change report without `applyConfig`; every other row keeps the
  successor path.

## Throughput

One lead writer. The independent W246/W247 review is still running; this row is small enough to
ride the same review pass.

## Validation

- `npm run check` and `npm run build` pass.
- Compiled acceptance `.audit/w248-config-live.mjs` (wide PTY `.audit/w248-config-live.exp`):
  9/9 at identity `5ab78a0676206aba442fafb3ddc33d6623a45248c3f2b5649d6319a8638c61d5`.
  Thinking on persists, keeps the rest of the settings document, opens no configuration branch,
  and the next request carries `thinking: adaptive`; an `Auto-compact` toggle still opens one.
- W233 config acceptance 35/35 at the same identity; W246 12/12, W247 12/12; focused
  interactive/thinking-dialog/config-panel 31/31.
- Full suite: 3001 tests, 3000 pass; the single failure is the pre-existing CLI effort-flag
  divergence at HEAD (one earlier run reported 2 transiently; two reruns reported 1).
