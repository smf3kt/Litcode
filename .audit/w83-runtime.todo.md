# W83 runtime trail

## W83-01 acceptance (2026-10-17)

- [x] **Source read.** `ke`, the CwdChanged handler and both adapters measured
  in UTF-16 code units.
- [x] **Port.** `HookResult.failures` and status display in the interactive
  FileChanged and CwdChanged raises.
- [x] **Bounds.** Failure text is the existing context text; blocking exit 2 is
  unchanged and not recorded as a failure.
- [x] **Gates.** hooks 50/50, tsc 0, build 0, full 2,110/2,110, chain 767/767,
  notices 0, source index unchanged, identity `53e0f27e…`.
- [ ] Remaining C-6: full consumers and script semantics.
