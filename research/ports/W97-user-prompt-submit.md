# W97 — UserPromptSubmit payload

## Source position

Both builders (chunk-sfn1dbxq.js `Yir` [2952083,2952369) and `qtt`
[2952369,2952751)) send the session context, `hook_event_name`,
`prompt` and the current `session_title`; this build emits no `source`.
The schema keeps `source` optional with the values `user`, `sdk`,
`system`, `loop_wakeup`, `schedule_wakeup` and `poll_event`, with the
recovery text "Payloads may omit it while the field rolls out"
(chunk-r2vtj1kh.js offset 194211).

## Port

`Agent.run` raises UserPromptSubmit with `prompt` and, when one is
recorded, `session_title` resolved from the latest `title` event (the same
`vm` resolution SessionStart already uses). The payload no longer carries
`source: "user"`.

## Correction

The product unconditionally sent `source: "user"` even though neither
recovered builder emits the field; a prompt injected by the SDK, a loop
wakeup or the event channel is not user-authored, so the implied verdict was
wrong.

## Adaptation

The schema enum stays documented in the hook contract; the runtime simply
does not invent a value the studied build omits.

## Verification

`agent-lifecycle` 38/38 with a new capture asserting the prompt and title,
and the absence of `source`. tsc 0; build 0; full 2,128/2,128; chain
767/767; notices 0; source index unchanged; identity `fc290fa6…`.
