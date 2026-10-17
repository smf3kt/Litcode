# W93 runtime trail

## W93-01 acceptance (2026-10-18)

- [x] **Source read.** `GK`, the SessionEnd builder and the `resume` call site.
- [x] **Port.** Close-cause mapping onto the recovered enum before the raise.
- [x] **Correction.** Internal reasons no longer reach the hook.
- [x] **Gates.** agent-lifecycle 35/35, interactive 8/8, tsc 0, build 0, full
  2,122/2,122, chain 767/767, notices 0, source index unchanged, identity
  `11df4f85…`.
- [ ] Remaining C-6: full consumers.
