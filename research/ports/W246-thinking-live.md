# W246 the thinking chord opens its dialog and applies live

Status: implemented and verified locally, 2026-10-22. Local only; no push, no paid calls.

## Task card

- Entry is the `chat:thinkingToggle` chord (`alt+t`, keybinding map chunk-6ccen3s8.js 2813).
- The source handler `lL` (chunk-24k7d6mw.js 882215) opens the `SG` dialog (625719) directly; the
  accept `kp` (898567) writes `thinkingEnabled` to live state, closes the dialog, sends the
  `set_max_thinking_tokens` control request and shows `Thinking on/off`; the cancel `ph` (898638)
  only closes. A changed value mid-conversation asks for confirmation first (`627114`/`627288`).
- Locally the chord queued `/thinking`, which needed an idle turn and opened a successor session.
  This package ports the dialog and the live write.
- Validate the compiled CLI mid-turn for both answers, cite source ranges, take one bounded
  independent review with the pending W243/W244/W245 fixes.

## Baseline

At 1a69ede `alt+t` queued a `/thinking` command. While a turn was active it stayed queued until
the turn ended; when drained the command took the successor-session configuration branch.

## Source gate

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Ranges are zero-based UTF-16 code units, half-open, verified against extracted-v2/manifest.json.
Recovered application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | handler `lL` 882215, dialog `SG` 625719, rows 625859/625941, title 626784, subtitle 626835, warning 627114, proceed 627288, dialog gate 898656 (`Gu`), current value 898682 (`Gi??!0`), accept `kp` 898567, cancel `ph` 898638 |
| chunk-6ccen3s8.js | 4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d | Chat context `meta+t: chat:thinkingToggle` (line 2813) |

## Recovered behaviour

- `lL` swallows a click while another dialog owns the input (`ll()`/`Tw()`), then toggles the
  `SG` dialog open (`Iu(w8t)`, `w8t = v => !v`, 863369). It first reports the "thinking is always
  on" text when `lZt(model)` has one.
- `SG` renders two rows, `Enabled`/`Disabled`, with the current value focused. Accepting an
  unchanged value applies immediately. Accepting a changed value while an assistant message
  exists sets a pending value and renders the warning plus `Do you want to proceed?`; the
  `confirm:yes` binding applies the pending value and `confirm:no` clears it.
- `kp` writes `thinkingEnabled` live, closes the dialog, sends `set_max_thinking_tokens`
  (`wg ? null : 0`), logs the toggle, and shows the 3000 ms `Thinking on/off` feedback.

## Adaptations and ownership

- `onAction` now maps `chat:thinkingToggle` to `applyThinkingToggle` instead of queueing
  `/thinking`; the chord therefore runs while a turn is active, like the model picker (W243).
- `src/thinking-dialog.ts` carries the recovered strings and rows with the current value as the
  default focus. `applyThinkingToggle` reads the first answer, applies it live to
  `session.config.thinking`, and shows `Thinking on/off`. The mid-conversation confirmation uses
  the host's confirmation prompt with the recovered warning and proceed text; since W249 its
  focused row is Yes, so Enter approves as `confirm:yes` does.
- The `lZt` "thinking is always on" arm needs the model capability table (`rS` on
  `rejects_disabled_thinking`, chunk-bk5ct2gw.js 51); this host has no such catalogue, so the
  dialog is always offered. The `sendControlRequest` channel has no local producer; the request
  builder reads `config.thinking` on every call (`src/agent.ts:192`), so the live write is enough.
- The live write joins the runtime tool-set fingerprint exclusion (`thinking`, `src/runtime.ts`),
  so a later turn does not throw `Runtime owner configuration changed`.
- The typed `/thinking on|off` command keeps its existing successor-session path; this package
  covers the chord and its dialog only.

## Throughput

One lead writer. One bounded independent review will cover this package together with the
outstanding W243/W244 findings.

## Validation

- `npm run check` and `npm run build` pass.
- `test/thinking-dialog.test.ts`: 2/2; `test/interactive.test.ts`: 25/25.
- Compiled acceptance `.audit/w246-thinking-live.mjs` (wide PTY `.audit/w246-thinking-live.exp`):
  12/12 at identity `b1555844c8d9847f665270bac3699ddda81b367b054d2ddbd04844db2c75bf8e`.
  A first turn is held, `alt+t` opens the dialog mid-turn, the Enabled row applies without a
  confirmation (no assistant message yet), and the held turn's next request carries
  `thinking: adaptive`; a second held turn opens the dialog again, the changed row shows the
  mid-conversation warning, Enter applies `Thinking off` (the focused Yes row), and the next
  request has no `thinking`.
- W243, W244 and W245 acceptances rerun on the same tree: 9/9, 10/10, 10/10 at the same identity.
- Full suite: 3000 tests, 2999 pass; the single failure is the pre-existing CLI effort-flag
  divergence at HEAD.
