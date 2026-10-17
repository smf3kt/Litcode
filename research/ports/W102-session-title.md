# W102 — SessionStart and UserPromptSubmit session titles

## Source position

The hook output schemas carry `sessionTitle` on exactly two events:
UserPromptSubmit (chunk-n3ykh62m.js offset 391440) and SessionStart
(offset 391966). The consumers take the last provided title:
UserPromptSubmit stores it in `n` (chunk-ksjypbtc.js offset 5177) and commits
`u = m.sessionTitle ?? u`; SessionStart stores `Ve` and sets
`pendingHookSessionTitle` only when the start source is startup, resume or
fork (chunk-sfn1dbxq.js offset 2478978), so clear and compact starts ignore it.

The title setter `$vt` (chunk-sfn1dbxq.js offset 4658579) normalizes through
`ci` (chunk-r2vtj1kh.js offset 663011): trim, `Rn` replaces each
control/format/U+2028/U+2029 run with a space (chunk-gyf58rwf.js offset 11680),
`wW` strips the remaining C0/C1 controls and keeps the first `AP` = 200 code
points (chunk-64ag51qf.js offset 2304), then trims again. A title equal to the
current one is not recorded.

## Port

`HookResult` gains `sessionTitle`, parsed only from those two events' outputs.
`normalizeSessionTitle` ports `ci` exactly. `Agent.startSession` records a
`title` event for the startup, resume and fork sources when the normalized
title is non-empty and differs from the current one; `Agent.run` records it
from UserPromptSubmit before the turn. The session list and the UserPromptSubmit
payload's `session_title` then read the recorded title.

## Adaptation

The local session schema bounds titles at 200 UTF-16 units, so a title whose
first 200 code points exceed 200 units (all astral characters) is cut once more
without splitting a surrogate pair. The source's own storage limit is code
points.

## Verification

`hooks` asserts the field is parsed for both events and ignored elsewhere, and
covers normalization of controls, U+2028, the 200 cap, and astral input.
`agent-lifecycle` records the SessionStart title, records the UserPromptSubmit
title, exposes it through the session list, and proves a clear start ignores it.
Focused 94/94, tsc 0, build 0, full 2,136/2,136, chain 767/767, notices 0,
identity `6c6de060…`.
