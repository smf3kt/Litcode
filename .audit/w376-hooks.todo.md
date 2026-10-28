# W376 Hooks family acceptance

Acceptance package with a test-owner re-base. Base 69d8cf5 (W375). Family: Lifecycle hooks.

## Predicate

Verify the existing async adoption, deadline, terminal sequence and bounded display paths through focused suites, the compiled PTY and the status sink. Keep the family Partial until remaining plugin-chain and VM/worker boundaries are reconciled.

## Evidence

- Async adoption: `AsyncHookRegistry.start` (src/async-hooks.ts:137), `adopt` (:203), `wait` (:256), `stop` (:261), `close` (:268); first-line header skipped by the recovered `gbt` rule; configured-async runs never re-adopt (W185/C6).
- Deadlines W307; Notification order and idle prompt W308.
- Terminal sequences: src/agent.ts:354-360; display: src/agent.ts:361-385.
- PostCompact `avt`: src/hooks.ts:1749-1767 reads only the terminal sequence from JSON and displays the labeled record.
- TeammateIdle: src/interactive.ts:2154-2156; Notification: src/interactive.ts:1066-1072.

## Plan

- [x] Re-base the driver's completion gates on the session journal (turn_end, hook_result, compact, child turn_end).
- [x] Assert the TeammateIdle record and the `avt` PostCompact record; drop Notification from this flow and the full-line status assertions.
- [x] Add one display-budget group at the status sink in agent-lifecycle.
- [x] Nine hooks suites 138/138; agent-lifecycle 61/61.
- [x] Compiled driver: default 3, event 18, post-compact 12, children 13 model calls; all exit 0. A 160-column PTY checks visible and hidden TeammateIdle output.
- [x] Check/build pass; full suite 3458/3458 on the second run after one MCP stream failure and a passing 6/6 focused rerun. The revised test and driver pass a third full suite, 3458/3458, at identity `3f1d784d`.
- [x] Record W376 and update CURRENT and the Partial family row.
- [x] One bounded independent reader returned `VERIFIED_SCOPED` at `3f1d784d` for the three review repairs. Its background parent-command observation led to a terminal-rendered descriptor ID gate; compiled children 13 calls pass at `cbe7f1ad`.
- [x] Independent review returned `VERIFIED_SCOPED` for descriptor ID binding at `cbe7f1ad`; it identified an unfinished first journal line being parsed prematurely. The no-newline boundary is repaired and a four-case probe plus compiled children/event/PostCompact pass at `6a6a89d1`.
- [x] The same independent reader returned `VERIFIED_SCOPED` for the partial-journal repair at `6a6a89d1`, with seven boundary scenarios and a matching 1,963-record identity.

Local only. No account, OAuth, hosted subscription, paid upstream, push, coauthor or schedule.
