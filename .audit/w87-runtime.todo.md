# W87 runtime trail

## W87-01 acceptance (2026-10-18)

- [x] **Source read.** `rAe`, `wnn`, `ztt`, the manual call site and the
  PreCompact schema.
- [x] **Port.** Nullable `custom_instructions`, `newCustomInstructions`, the
  Additional Instructions block and `/compact` arguments.
- [x] **Bounds.** Stdout stays in `additionalContext`; only the summary request
  de-duplicates it.
- [x] **Gates.** agent-lifecycle 31/31, tsc 0, build 0, full 2,116/2,116, chain
  767/767, notices 0, source index unchanged, identity `e3257471…`.
- [ ] Remaining C-6: full consumers and script semantics.
