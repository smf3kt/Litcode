# W86 — SessionStart agent type and session title

## Source position

`t7r` (chunk-sfn1dbxq.js, UTF-16 [2942449,2942805)) builds SessionStart as
`{source, agent_type, model, session_title, ...}` over the common context,
with `session_title` falling back to `vm(sessionId)`. `vm`
(chunk-sfn1dbxq.js offset 4651858) returns the current session's title and
`undefined` for any other session; the runtime stores that title as a `title`
event.

## Port

`startSession` sends `agent_type` when the session is a child
(`config.childMode`) and `session_title` from the latest recorded `title`
event. Both fields stay absent when the runtime has no value, matching the
source's undefined-valued fields.

## Adaptation

The source also accepts an explicit title argument and reads an in-memory title
store; this runtime records titles as durable events and has no separate
in-memory title, so the latest event is the only local source.

## Verification

`agent-lifecycle` 30/30: a child session with a recorded title receives
`source: "startup"`, `model`, `agent_type: "general"` and
`session_title: "Fixture title"`. tsc 0; build 0; full 2,115/2,115; chain
767/767; notices 0; source index unchanged; identity `3c77f51d…`.
