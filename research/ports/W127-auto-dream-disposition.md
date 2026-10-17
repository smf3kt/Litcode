# W127 — Unattended memory consolidation: substitution disposition

C-9's first clause was the original unattended consolidation pass ("auto
dream"). This package reads the trigger, state and settlement code and records
why it is not ported as-is, plus the product behaviour that carries the same
user-facing function.

## Recovered evidence

- Entry and gates (chunk-kxgzv2t8.js offset 11 onward): the runner fires from
  session start only when the feature flag is on and
  `he()` holds: no remote session (`vr`, chunk-qr9z1wer.js 1185), not an SDK
  entrypoint (`rj`, chunk-tadwrn0a.js 4842), memory enabled (`Ou`,
  chunk-bk5ct2gw.js 541750), and not the incompatible mode `D9`
  (chunk-2bcyxj9q.js 72290).
- Thresholds: `minHours 24`, `minSessions 5`, and a 600000 ms scan throttle.
  The pass skips when a permission rule would refuse memory writes and reports
  the refusal.
- State (chunk-2dvx15ja.js): `I7e` reads the last-consolidated timestamp from
  the memory items record or the directory mtime; `M1o` acquires a lock file
  holding the PID, treats a lock younger than the stale window as held by a
  live process, and `qgt` rolls the mtime back on failure; `D1o` lists
  sessions touched since that timestamp from the session store.
- The pass (chunk-kxgzv2t8.js): a forked background query with
  `querySource: "auto_dream"`, a memory-write permission context, a memory
  prompt covering personal and team directories, message streaming into a
  bounded turn list (30 turns), tracking of memory files written, and
  `deferCappedRunWrites`/`settleDreamItems` settlement when the items record
  was capped. Completion or failure updates a task-registry entry and triggers
  a notification.

## Decision

Not ported as-is. A faithful trigger needs four layers this runtime does not
have: a cross-session transcript store to enumerate "sessions touched since",
the memory items record with capped-run and settlement semantics, a
cross-session lock/state record, and a forked background query with its own
permission and task-registry lifecycle. Firing the pass without them would
either find no sessions or write memories with no item settlement.

The user-facing function is already carried in-conversation:
`AUTO_MEMORY_INSTRUCTIONS` (src/auto-memory.ts) tells the model to perform
memory maintenance in the current conversation, merge duplicates,
reconcile against instruction files, and never store transient or secret
material, and explicitly states that maintenance happens without a separate
extraction model call. The startup context loads the catalog and bodies under
the same permission policy.

Residual under C-9 stays: marketplace/publish/full component semantics and
plugin source-vs-builtin conflicts with auto-discovery.

## Verification

Documentation-only package: no source or test change. The last measured gates
are W126's — workflow family 43/43, tsc 0, build 0, full 2,204/2,204, chain
768/768, notices 0 — and the content identity is unchanged at `adad009d…`.
