# W85 runtime trail

## W85-01 acceptance (2026-10-18)

- [x] **Source read.** `pvt`, `qir`, `$d`, the idle call site and `Ua`
  measured in UTF-16 code units.
- [x] **Port.** `readTaskRecord` and the TaskCompleted/TeammateIdle payloads.
- [x] **Bounds.** The per-task completion gate stays; `team_name` has no local
  source; the tool-field fallback only applies when the record is absent.
- [x] **Gates.** agent-lifecycle 29/29, hooks 50/50, tsc 0, build 0, full
  2,114/2,114, chain 767/767, notices 0, source index unchanged, identity
  `6b50f209…`.
- [ ] Remaining C-6: full consumers and script semantics.
