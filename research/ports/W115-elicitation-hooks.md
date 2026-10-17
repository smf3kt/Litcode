# W115 — Elicitation and ElicitationResult hook answers

## Source position

The Elicitation and ElicitationResult output schemas carry an optional
`action` (`accept`/`decline`/`cancel`) and `content` string-or-record
(chunk-n3ykh62m.js offsets 395776 and 395895). `f7r` (chunk-sfn1dbxq.js
offset 3055929) turns each record into either a `blockingError` or a
`response {action, content}`, requiring the matching `hookEventName` and a
present action; `cvt`/`dvt` (offsets 2934418 and 2934736) keep the last
response and the last blocking error across hooks. The MCP caller
(chunk-nejdhvxk.js `Zgn` at offset 2367) returns a hook response instead of
opening the dialog, returns `decline` when a hook blocked, and otherwise asks
the person. After the person answers, `ehn` (offset 2849) runs the
ElicitationResult hooks: a blocking result declines, an answer replaces the
action and keeps the person's content when the hook supplies none, and a
response notice is posted.

## Port

`runHooks` stores the last hook answer on `elicitationResponse`, admitting
the schema's string-or-record content. The interactive elicit callback returns
that answer without opening the dialog (and without running ElicitationResult
hooks), and after the dialog applies the ElicitationResult override: block
declines, an action overrides, and the person's content survives an empty hook
content.

## Adaptation

The hook answer still passes through this runtime's MCP result validation, so a
form answer must match the requested schema and a URL answer carries no
content; the source forwards hook content without re-validating it. The
source's "Elicitation response for server X: <action>" notice has no local
notification surface and is not shown. The `answerHeld` personal-hook merge
and async-response exclusion have no local analogue because async hooks do not
return outputs here.

## Verification

`hooks` asserts action/content parsing, last-wins, the action requirement and
the event gate. `mcp-form-ownership` asserts a hook answer skips the dialog and
an ElicitationResult hook overrides the answered form. Focused 97/97, tsc 0,
build 0, full 2,158/2,158, chain 767/767, identity `82dd4570…`.
