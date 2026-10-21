# W251 `/config` turn duration, time format, editor and progress bar apply live

Status: implemented and verified locally, 2026-10-22. Local only; no push, no paid calls.

## Task card

- Continue the live `/config` rows after W248/W250. Four more rows write only settings and the
  global config, never a new session: `turnDuration`, `timeFormat`, `editor`, `progressBar`.
- Map each onto the host's existing terminal setter and keep the merged-layer precedence for
  the progress-bar row.
- Validate the compiled CLI for persistence, no configuration branch, and a following turn.

## Baseline

At `c94098e` the four rows took `applyConfig`, which opens a successor session. Their fields
also joined the owner tool-set fingerprint, so a live write alone would fail the next turn with
`Runtime owner configuration changed`.

## Source gate

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Ranges are zero-based UTF-16 code units, half-open, verified against extracted-v2/manifest.json.
Recovered application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-nybcbd9t.js | 0abe0d704940977466d81c1efab7f953d8f9dac0f30cd758c4a3d0286b5c1bca | `verbose`/`progressBar` rows 20116/20203, `turnDuration` 20771, `timeFormat` 21614, `editor` 26180 |

## Recovered behaviour

- `progressBar`: `W("terminalProgressBarEnabled", e)` plus the global config; the row value is
  the merged setting.
- `turnDuration`: `W("showTurnDuration", e)` plus the global config.
- `timeFormat`: `P({timeFormat})` plus the settings cache and a change-log record; the picker
  commits the same way.
- `editor`: `W("editorMode", e)` plus the global config.
- None of them calls the live app-state setter or opens a session.

## Adaptations and ownership

- The change callback writes the live session field and calls `setShowTurnDuration`,
  `setProgressSettings`, `setEditorMode` or `setTerminalProgressBar`, then repaints the panel
  through `configPanelInput`; persistence stays with `saveConfigPanelSetting`.
- The time-format child picker now writes the live formatter instead of cloning the config and
  applying it.
- The progress-bar row still re-reads the merged setting (`hs`) so a higher authored layer keeps
  precedence, then applies the merged boolean live.
- `runtime.ts` extends the display-only exclusion to these four fields in the owner tool-set
  fingerprint and both connection digests; no field shapes a tool or an MCP connection.

## Validation

- `npm run check` and `npm run build` pass.
- Compiled `.audit/w251-config-live.mjs` (wide PTY `.audit/w251-config-live.exp`): 12/12 at
  identity `3aab3ef73c9898dcaa546e6b7f369efe9075faaeaf48bd90c47e5ad35a748e3a`. Each row
  persists its value, keeps the other keys, opens no configuration branch, and a following
  turn runs in the same session file.
- `test/runtime-resources.test.ts` 16/16 with the extended display-only case; W233 config 35/35;
  W243–W248 and W250 rerun 9/9, 10/10, 10/10, 12/12, 12/12, 9/9, 11/11 at the same identity.
- Full suite: 3003 tests, 3002 pass; the single failure is the pre-existing CLI effort-flag
  divergence at HEAD.
