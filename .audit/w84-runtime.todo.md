# W84 runtime trail

## W84-01 acceptance (2026-10-17)

- [x] **Source read.** `Kir`, `Zge`, the task-create rollback site, `XCt` and
  the `X_`/`$l` team context measured in UTF-16 code units.
- [x] **Port.** `createdTaskFields`, the metadata payload, `removeTask` and the
  blocking/decision sets.
- [x] **Bounds.** No team identity in the tool path; rollback removes the task
  and its dependency edges before the model sees the result. Numeric high-water
  mark and background task host are not replicated.
- [x] **Gates.** agent-lifecycle 27/27, hooks 50/50, tsc 0, build 0, full
  2,112/2,112, chain 767/767, notices 0, source index unchanged, identity
  `081a61bf…`.
- [ ] Remaining C-6: TaskCompleted/TeammateIdle fields, full consumers and
  script semantics.
