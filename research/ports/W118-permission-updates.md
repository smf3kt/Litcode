# W118 — PermissionRequest allow updatedPermissions

## Source position

The PermissionRequest allow arm carries `updatedInput` and
`updatedPermissions`; the list is the schema `Bz` (chunk-n3ykh62m.js offset
389976, union at 390059): addRules/replaceRules/removeRules
`{rules: [{toolName, ruleContent?}], behavior: allow|deny|ask, destination}`,
setMode `{mode, destination}` and addDirectories/removeDirectories. setMode's
mode passes through `rh`, which maps the retired `manual` to `default`
(chunk-a60ee1ne.js offsets 678 and 782), and the output schema validates the
whole stdout object, so one malformed entry makes every field of that output
unused (chunk-n3ykh62m.js offset 395547).

The launcher consumer applies an adopted allow's updates to the session
permission context and persists them (`CUt`, chunk-fyhzvvp0.js offset 3459,
through `q` offset 3158 and the web filter `WK` in chunk-nkb63p1y.js offset
3840); the native fold reads the first allow/deny answer (`n2e`, offset
15469). The strict consumer refuses the call when a deny/ask rule cannot be in
force (`Bnr` chunk-sfn1dbxq.js offset 548142, text `AXn` offset 544491), and
`s9r` (offset 546964) drops unsupported update kinds. The classic answer is
checked by `Fr`/`Lr` (chunk-nyce03br.js [28640,29566) and [29566,30208)).

## Port

`permissionUpdateSchema` copies `Bz`; `applyPermissionUpdates` adds the
answer's rules and mode to a session-owned state (`Session.permissionUpdates`)
and the decision path merges that state with the settings policy: a deny on
either side wins, a session allow satisfies the settings allow list, and a
session ask adds an ask. The answer applies only when it is the adopted allow
and only after the updatedInput re-check, before the call runs.
`runHooks` validates the list before any field of that output is read; the
classic chain answer is validated with the same schema before its fields are
read.

## Adaptation

- No settings writer: every destination applies to the in-memory session state
  and dies with the session; the source persists through `O1`.
- Rules are the product's tool-name patterns. A deny or ask rule that carries
  `ruleContent` cannot be represented, so the call is refused with the
  source's strict-consumer text (`AXn`) instead of running without it. An
  allow rule with `ruleContent`, a setMode this product cannot express
  (`auto`, `dontAsk`) and directory updates are dropped.
- replaceRules/removeRules address the session store; the source addresses the
  destination's rule set, of which the settings policy is a separate part here.
- The WebFetch/WebSearch loosening filter (`PDn`, chunk-nkb63p1y.js offset
  3223) is inactive: its predicate `Ure` (offset 1801) needs a Projects or
  remote-execution session this product has no counterpart for. The tool-level
  suppression branches (`eK` offset 3316759, `Zq` offset 3316685) likewise
  have no local flags.

## Verification

`permissions` pins the schema, the merged decisions, replace/remove, the
refusal and the drops. `hooks` pins whole-output invalidation. `agent-lifecycle`
pins a setMode answer that refuses a later call, a deny rule that survives the
answer, and the refused call for an unrepresentable tightening. Focused
131/131, extended 246/246, tsc 0, build 0, full 2,168/2,168, chain 768/768,
identity `b50e00a3…`.
