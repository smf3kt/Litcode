# W252 the last four config rows apply live

Status: implemented and verified locally, 2026-10-22. Local only; no push, no paid calls.

## Task card

- Finish the live `/config` rows: `autoCompact`, `askUserQuestionTimeout`, `dialogExpiry` and
  `permissionMode`. Source applies each through the settings cache and never opens a session.
- With these cases every `ConfigUpdate` id returns live, so the post-switch `applyConfig`
  fallback is dead and is removed.
- Validate the compiled CLI for each row, persistence and a following turn.

## Baseline

At `2d511c7` these four rows still took `applyConfig` and opened a successor session; the
W248 acceptance used the auto-compact row as its branching control, which no longer holds.

## Source gate

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Ranges are zero-based UTF-16 code units, half-open, verified against extracted-v2/manifest.json.
Recovered application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-nybcbd9t.js | 0abe0d704940977466d81c1efab7f953d8f9dac0f30cd758c4a3d0286b5c1bca | `autoCompact` row 12035, `permissionMode` 21908 (settings cache only), `askUserQuestionTimeout` 26485, `dialogExpiry` 29983 |

## Recovered behaviour

- `autoCompact`: user settings plus the global config; no live app-state write.
- `permissionMode`: the row's value is `settings.permissions.defaultMode`; the change moves the
  settings cache and, on failure, restores the previous cache value. It never changes the live
  permission mode.
- `askUserQuestionTimeout` / `dialogExpiry`: settings cache first, then the persisted write, with
  a cache rollback when the write reports an error.
- None of the four opens a session.

## Adaptations and ownership

- The callback assigns the live session field after `saveConfigPanelSetting` succeeds and
  repaints the panel: `autoCompactEnabled` (merged setting re-read for precedence),
  `askUserQuestionTimeout`, `dialogExpiry` (`default` deletes the field), and
  `permissions.defaultMode` merged onto the live permission policy.
- The live permission mode (`permissions.mode`) is untouched, matching the source.
- With all union members handled, the shared `applyConfig` tail after the switch is removed;
  the change callback is now exhaustive over `ConfigUpdate`.
- `runtime.ts` adds the three behaviour fields to the display-only exclusion and normalises
  `permissions.defaultMode` out of the owner tool-set fingerprint and both connection digests,
  since the default applies to new sessions, not this tool set or MCP connection.

## Validation

- `npm run check` and `npm run build` pass.
- Compiled `.audit/w252-config-live.mjs` (wide PTY `.audit/w252-config-live.exp`): 13/13 at
  identity `951890652be97e5cfacf8d9ccfdcfef5df5126e3e58213794a21a3271a91101c`. Each row
  persists, the settings document keeps its unrelated keys, no configuration branch opens, and
  a following turn runs in the same session file.
- `test/runtime-resources.test.ts` 16/16 with the extended display-only case; W233 config 35/35;
  W243–W248, W250 and W251 rerun 9/9, 10/10, 10/10, 12/12, 12/12, 9/9, 11/11, 12/12 at the same
  identity. W248's control assertion now checks that another row also applies live.
- Full suite: 3003 tests, 3002 pass; the single failure is the pre-existing CLI effort-flag
  divergence at HEAD.
