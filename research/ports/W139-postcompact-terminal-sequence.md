# W139 — PostCompact keeps the runner-side terminalSequence effect

C-6's remaining PostCompact side effect. W137 made the collector ignore PostCompact's
structured fields, matching `avt`'s own reads. The shared hook runner, however, applies
`terminalSequence` while each record settles, before `b0` returns, so the side effect is not
part of the structured contract `avt` ignores. The product now applies it for PostCompact too.

## Source position

- `chunk-sfn1dbxq.js` offset 3018155: the per-hook execution generator. As each hook record is
  settled it reads the parsed output's `terminalSequence` and calls the emitter
  (`if(Wo.terminalSequence)LLe(Wo.terminalSequence)` at offset 3041266).
- `chunk-sfn1dbxq.js` offset 619331: `LLe(e){Sie().write(e)}` — the effect is the write to the
  terminal stream.
- `chunk-sfn1dbxq.js` offset 3046416: `b0`, the collector every caller awaits. It consumes that
  generator, so the effect has already occurred when `avt` receives the records at 2932807 and
  reads only cancellation and raw output.

## Port

- `src/hooks.ts`: the terminal-sequence validation, aggregate budget and diagnostic moved out of
  `applyJsonOutput` into `applyTerminalSequence(json, result)`, unchanged. `applyJsonOutput` calls
  it as before.
- The PostCompact branch parses the command's stdout solely for this helper, then builds the
  `avt` display line. `additionalContext`, `systemMessage`, `suppressOutput` and
  `hookSpecificOutput` remain unread for this event, so W137's display semantics are unchanged.
- The effect keeps the product's journal-before-effect model: sequences land on the
  `hook_result` event and `Agent.hook` emits them after the runner, so a crash does not replay
  them. This ordering is a recorded product-wide adaptation (source writes during execution).

## Verification

- `test/hooks.test.ts`: a PostCompact record carrying `terminalSequence`, `additionalContext`
  and `systemMessage` yields exactly the allowlisted sequence (terminator-normalized to ST),
  no context, no system message, and the raw stdout display line.
- Focused 139/139, full 2241/2241, tsc 0, build 0, notices 0, identity `a118ac44…`.
