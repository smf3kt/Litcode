# W248 `/config` Thinking mode row applies live

Status: done; record at research/ports/W248-config-thinking.md.

## Why

The `/config` dialog's Thinking mode row still takes the generic successor-session path
(`applyConfig`). The recovered row writes the live switch and persists its setting
(chunk-nybcbd9t.js 15590):

```
onChange(e){
  if(!e && Se!==void 0) return {error:new Fr(Se,"Thinking can't be turned off for this model")};
  Y(o=>({...o,thinkingEnabled:e})); P({alwaysThinkingEnabled:e?void 0:!1});
  i("tengu_thinking_toggled",{enabled:e}); g("thinking_toggle");
}
```

`value` is `_4e(xe,C)` (chunk-bk5ct2gw.js 400925): thinking shows enabled unless the
`alwaysThinkingEnabled` setting is false. The lock `Se` is the model-capability refusal.

## Local mapping

- App-store `thinkingEnabled` == `session.config.thinking`.
- Persisted `alwaysThinkingEnabled` has no local key; this host persists `settings.thinking`
  (`parseSettings`, src/runtime.ts 216; `saveConfigPanelSetting` already maps `thinking`).
  Record the key substitution as the adaptation; the live-write semantics are the port.
- The `_4e`/`Se` capability lock needs `rS`/`xRe` model tables this host has no source for, so
  the row stays offered (same recorded gap as W246).

## Change

In the `/config` change callback (src/interactive.ts ~1798): persist first (already done by
`saveConfigPanelSetting`), then write `session.config.thinking` live and return
`configPanelInput(session.config)` instead of calling `applyConfig`. Record the change in the
panel's `changes` map as today.

## Acceptance

- Compiled: settings `thinking:false`; `/config`, Down×2, Space, Esc, `/config` reports the
  change; one turn's request carries `thinking: adaptive`; `listSessions` has no new
  configuration branch; settings file has `thinking: true`.
- Regression: `/config` other rows still open their successor branch (at least autoCompact).
- Recheck W246 12/12 and W247 12/12; full suite with the known CLI-effort failure.
