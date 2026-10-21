# W250 `/config` Verbose and Reduce motion apply live

Status: implemented and verified locally, 2026-10-22. Local only; no push, no paid calls.

## Task card

- Continue the live `/config` rows after W248. Both `verbose` and `reduceMotion` write live app
  state in the source and never restart the session.
- Recovered source first: read the two row bodies, then map them onto the host's existing
  terminal setters.
- Validate the compiled CLI for persistence, no configuration branch, and a following turn.

## Baseline

At `1b6cbca` both rows took `applyConfig`, which opens a successor session. Writing the same
fields live without the runtime exclusion made the next turn fail with
`Runtime owner configuration changed; release session resources before rebuilding`.

## Source gate

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Ranges are zero-based UTF-16 code units, half-open, verified against extracted-v2/manifest.json.
Recovered application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-nybcbd9t.js | 0abe0d704940977466d81c1efab7f953d8f9dac0f30cd758c4a3d0286b5c1bca | `Te` 9556 (`W("verbose",e)`, global config, live app state, change log), verbose row 20116, reduceMotion row 15296 (localSettings, settings data, live `settings`) |

## Recovered behaviour

- `Te`: `W("verbose", e)` persists the setting, `v` updates the global config, `Y` updates the
  live app state, and `U.toggle("verbose", e)` records the change in the transcript.
- reduceMotion: `me({prefersReducedMotion:e})` writes local settings, `T` updates the settings
  cache, and `Y` writes `settings.prefersReducedMotion` into live app state.
- Neither row opens a new session or rebuilds the tool set.

## Adaptations and ownership

- The change callback now writes `session.config.verbose`/`prefersReducedMotion` and calls the
  terminal's `setVerbose`/`setPrefersReducedMotion`, which repaint (W235/W243 renderer), then
  repaints the panel through `configPanelInput`. Persistence stays with
  `saveConfigPanelSetting` (user settings for verbose, local settings for reduce motion).
- The change-log row (`U.toggle`) has no local counterpart; the panel's accumulated change
  report is the host's record, as in W248.
- `runtime.ts` excludes the two display-only fields from the owner tool-set fingerprint and from
  both connection digests: they shape neither the tools nor an MCP connection.
- `setVerbose`/`setPrefersReducedMotion` are host setters rather than recovered symbols; the
  recovered state is the app field, and the local renderer owns its own presentation surface.

## Validation

- `npm run check` and `npm run build` pass.
- Compiled `.audit/w250-config-live.mjs` (wide PTY `.audit/w250-config-live.exp`): 11/11 at
  identity `90e580b8efefb30b9edfb4f9b35b758d9bfd80f03949ac1cf7d6f2eb6acc7cec`.
  `/config` verbose and reduceMotion toggle their settings, keep the other keys, open no
  configuration branch, and both following turns run in the same session file.
- New `test/runtime-resources.test.ts` display-only case (16/16 in the file); W233 config 35/35;
  W243–W248 rerun 9/9, 10/10, 10/10, 12/12, 12/12, 9/9 at the same identity.
- Full suite: 3003 tests, 3002 pass; the single failure is the pre-existing CLI effort-flag
  divergence at HEAD.
