# W121 — Skill inline effect journal

## Source position

The recovered inline executor never spawns an authored span itself. `xxr`
(chunk-sfn1dbxq.js offset 3370821) validates every span that `Gtr` extracted
(offset 434915), the executor gives each span a synthetic tool-use id
(`toolUseId:` offset 3369204) and runs it through the tool runtime
(`await y.call({command:ke})` offset 3370268) behind the tool's permission
check. The tool layer therefore journals a started call before the effect and
its result after it; a crash between the two leaves a started call whose
outcome is unknown.

## Port

`SkillEffectJournal` (src/skill-effects.ts) carries that ordering in an
append-only JSONL file per workspace and owner:
`.agent/skill-effects/<owner>.jsonl`. `start` fsyncs
`{v,id,skill,index,digest,phase:"started",at}` before the spawn; `finish`
appends `finished` or `failed`; a start with no terminal record is unresolved.
The digest is the SHA-256 of the expanded command, and the command text is never
written. `expandedBody` reports every unresolved span before the skill runs
again with the local recovery sentence already used for interrupted tool calls,
and acknowledges it with a terminal `unknown` record only after the run
returns. A failed rerun rethrows the warning together with the failure and keeps
the record unresolved. A torn trailing line (the crash artifact this journal
exists for) is discarded; a complete malformed line fails closed; a journal
larger than 4 MiB fails closed.

## Adaptation

- The source's durability is the tool-call journal keyed by the synthetic
  tool-use id. Local inline spans have no model tool id, so a dedicated journal
  file replaces that pair rather than inventing synthetic `tool_start` and
  `tool_result` events that model transaction recovery would read.
- The owner is the runtime owner (`session.id`, or `initial`/`reload` during
  tool rebuilds). A child runtime created without an owner shares
  `initial.jsonl`, so an interrupted child span can warn a later session that
  runs the same skill name in the same workspace; the warning is conservative.
- The source's `promptShellHandOff` path for denied spans has no local surface
  and is unchanged.
- Recovery is per span: a skill re-invocation always runs its body again. The
  journal only reports the earlier effect whose outcome is unknown.

## Verification

`skill-effects` pins pairing, per-skill filtering, acknowledgement, torn-tail
handling, malformed-line failure, owner validation and the size bound.
`skill-runtime` pins the started/finished pairs with no stored command, the
failed terminal record, the one-time recovery prefix, and that a failed rerun
keeps the warning. Focused 35/35, extended 86/86, tsc 0, build 0, full
2,184/2,184, chain 768/768, identity `04147ee3…`.
