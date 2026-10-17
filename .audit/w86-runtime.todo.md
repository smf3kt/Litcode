# W86 runtime trail

## W86-01 acceptance (2026-10-18)

- [x] **Source read.** `t7r` and `vm` measured in UTF-16 code units.
- [x] **Port.** SessionStart `agent_type` and `session_title`.
- [x] **Bounds.** No explicit title argument or in-memory title store; absent
  values stay unset.
- [x] **Gates.** agent-lifecycle 30/30, tsc 0, build 0, full 2,115/2,115, chain
  767/767, notices 0, source index unchanged, identity `3c77f51d…`.
- [ ] Remaining C-6: full consumers and script semantics.
