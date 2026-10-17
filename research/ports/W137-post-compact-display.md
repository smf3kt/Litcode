# W137 — PostCompact user display message

C-6's remaining PostCompact formatting difference. The product parsed the hook's structured
JSON and treated plain stdout as display context. The recovered runner ignores the structured
fields, skips cancelled records, and builds one labeled user-facing line per remaining record
from its raw output. That message is now built and journaled the same way.

## Source position

- `chunk-sfn1dbxq.js` [2932807,2933200): `avt` builds
  `{hook_event_name: 'PostCompact', trigger, compact_summary}`, awaits the outside-REPL
  executor `b0`, and for each record: skips `cancelled`; on `succeeded`, appends
  `PostCompact [<command>] completed successfully` (plus `: <output.trim()>` when non-empty);
  otherwise `PostCompact [<command>] failed` with the same output suffix. The joined lines are
  returned as `userDisplayMessage`. Nothing else in the record is read.
- `chunk-sfn1dbxq.js` [3052800,3053200): the command record's `output` is stdout on status 0,
  the block reason or stderr on status 2, stderr on other non-zero exits, and `command` is
  the display label. An aborted run is `{cancelled: true, output: 'Hook cancelled'}`.
- `chunk-n3ykh62m.js` offset 409429: `Mx` maps a definition to its label — command, prompt,
  URL, `<server>/<tool>`, `callback`, `function`, or the script preview.
- The compact callers store the returned `userDisplayMessage` on the compaction result (for
  example `chunk-sfn1dbxq.js` [2569764] joins it after the existing message); it is display
  state, not model context.

## Port

- `src/hooks.ts`:
  - `HookResult.userDisplayMessage`;
  - `hookDisplayLabel` ports `Mx` over this runtime's definition variants; an
    `mcp__<server>__<tool>` name is split back into `<server>/<tool>`;
  - `runHooks` handles PostCompact before the generic success/failure paths: an aborted
    record is skipped (and the group stops), every other record contributes the source line
    from its raw stdout/stderr, and the loop continues. Structured JSON is not parsed for
    this event, so it contributes no `additionalContext`, `systemMessage` or suppression.
- `src/session.ts`: the `hook_result` event and its schema persist `userDisplayMessage`.
- `src/agent.ts`: the journal append carries the field, and the existing cleaned/bounded
  display path shows each line (one line per record) for PostCompact.

## Adaptations

- The source displays this as the compaction result's user-facing message; this runtime has
  no compaction-result message channel, so each line goes through `Agent.hook`'s status
  display with the product's `hook PostCompact: ` prefix and the shared byte budget.
- `suppressOutput`, `systemMessage` and `hookSpecificOutput.additionalContext` are ignored for
  PostCompact, because `avt` reads none of them. This changes the old hidden/bounded modes of
  the local test: the raw record line is displayed regardless of `suppressOutput`.
- Non-command transports use their `Mx`-equivalent label (URL, prompt, callback,
  `<server>/<tool>`); script hooks are refused before execution as before.

## Verification

- `test/hooks.test.ts`: a successful plain-stdout record, a JSON record (raw text shown, no
  context), a failed record, and exit-2 non-blocking behavior with the failed line.
- `test/lifecycle.test.ts`: all four compaction modes display a labeled line, journal the
  same message, carry no PostCompact context into model messages, and the bounded mode stays
  within its byte budget without control bytes.
- Focused 136/136, full 2238/2238, tsc 0, build 0, notices 0, identity `9e503123…`.
