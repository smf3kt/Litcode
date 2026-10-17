# W136 — StopFailure answer is discarded

C-6's remaining StopFailure difference: the product displayed a StopFailure hook's
`additionalContext` as status lines, while the recovered caller awaits the hook run and
ignores its answer. The answer is now dropped on both paths.

## Source position

- `chunk-sfn1dbxq.js` [2945048,2945292): `Gze` builds
  `{hook_event_name: 'StopFailure', error, error_details, last_assistant_message}`, awaits
  `b0` (the outside-REPL hook executor) and returns nothing; no returned field is read.
- `chunk-r2vtj1kh.js` [198098]: the StopFailure input schema carries `error`,
  `error_details?` and `last_assistant_message?`; there is no `stop_reason`.

## Port

- `src/agent.ts`: both StopFailure raise sites (the failed-model-request catch and
  `finishWithHooks` for non-clean stops) still await `this.hook('StopFailure', ...)` so the
  transports run, journal, and keep their at-most-once semantics, but neither reads
  `additionalContext` nor writes a status line. The payload keeps the source fields already
  carried (`error`, `last_assistant_message`).

## Adaptations

- `error_details` is not sent because this runtime's error values do not carry the source's
  detail object; the schema field is absent rather than fabricated.
- `b0` has no direct counterpart: `Agent.hook` is the single outside-turn executor here, and
  its result is now discarded the same way.

## Verification

- `test/lifecycle.test.ts`: the model-error StopFailure test still requires the hook result
  event and now asserts no status line contains the hook's `additionalContext`.
- Focused 136/136 (lifecycle, agent-lifecycle, hooks), full 2238/2238, tsc 0, build 0,
  notices 0, identity `1d28148b…`.
