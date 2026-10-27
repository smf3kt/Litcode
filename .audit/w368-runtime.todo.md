# W368 settings and instructions

- [x] Read the recovered owners before any product edit: `mCt` chunk-sfn1dbxq.js [674681,674896), `Znr` [674896,675599), `gCt` [675599,675783), `qie` [675783,676285), `Zyn` [3669904,3671831), `Sar` [3671831,3672142), `gd` chunk-40cepjpq.js [147565,147921), the agent-definition `omitClaudeMd` schema [429193,429523), and `claudeMd` in the managed settings schema chunk-x0dc37w9.js 53098.
- [x] Capture the compiled baseline: the host has no managed instruction tier, and an isolated (`worktree`) child carries the parent's instruction text instead of the checkout's.
- [x] Port the managed instruction tier into the instruction loader (managed settings `claudeMd`, `<root>/HARNESS.md`, `<root>/AGENTS.md`, `<root>/.harness/rules`).
- [x] Recompute an isolated child's instruction set from its own checkout. `childPromptSuffix` holds the appended child text back so the section rewrite lands on the parent span, then restores it.
- [x] Add at most three regression groups and one compiled driver covering managed merge, a new instruction in an unvisited directory, and the isolated child root. Two config groups (the second carries the child-tier case), one agent-registry group, and scripts/smoke-managed-instructions-cli.mjs in source and compiled modes.
- [x] Run check, build, focused suites, the compiled driver and the full suite; freeze identity c614f1e5 (939/360/662).
- [x] One bounded independent review; record its verdict. Verdict NOT_VERIFIED with four confirmed defects: (1) the section ended at an H1 inside an instruction file and leaked parent text, (2) the managed tier was read after the ancestor walk, (3) child imports had no depth limit, (4) the conditional-rule channel was not rebased. All four repaired.
- [x] Second bounded review of the repairs. Verdict CONFIRMED_REPAIRED, with three further fixes (patterned child rules no longer enter the prompt, duplicate rule collection deduplicated, relative managed paths resolved against the child root) and two recorded limitations (an embedded block header inside an instruction body, and /context suppressing instruction rows for a child prompt with memory blocks). Check, build, focused 125/125, source and compiled drivers, memory-reload driver and full 3442/3442 pass at identity ee819909.
- [x] Update CURRENT, FEATURES, partial-closure and the package record (W368-managed-instructions.md plus evidence JSON).
- [ ] Commit exact paths locally after the review verdict.

Local only. No account, OAuth, hosted subscription, paid upstream, push, coauthor or schedule.
