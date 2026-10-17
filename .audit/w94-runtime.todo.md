# W94 runtime trail

## W94-01 acceptance (2026-10-18)

- [x] **Source read.** Stop, SubagentStop and StopFailure schemas and builders.
- [x] **Port.** Trimmed message, SubagentStop transcript path, no invented
  reason fields.
- [x] **Gap.** `background_tasks` and `session_crons` need a runtime registry
  handle and stay omitted.
- [x] **Gates.** agent-lifecycle 36/36, tsc 0, build 0, full 2,123/2,123, chain
  767/767, notices 0, source index unchanged, identity `5ac052d1…`.
- [ ] Remaining C-6: full consumers.
