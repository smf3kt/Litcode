# W67 runtime trail

## W67-01 acceptance (2026-10-17)

- [x] **Recovered order matched.** Base `managed-settings.json`, then non-hidden `.json` drop-ins
  (regular files and symlinks) sorted by name, as `Lko`/`X$s` do.
- [x] **Source merge.** Documents fold through the ported `MB(..., Y3)` customizer.
- [x] **Product policy projection.** Only `allowShell`, `permissions`, `features`, `mcpClient`
  are enforced; other keys are reported and dropped.
- [x] **Failure semantics.** Missing directory is absence; unreadable/invalid documents are
  reported and contribute nothing; an invalid merged policy yields no policy.
- [x] **Explicit file unchanged.** Strict unknown-key and schema errors still throw.
- [x] **Gates.** tsc 0, config 69/69, settings chain 15/15, build 0, full 2,092/2,092, chain
  767/767, notices 0, index unchanged, identity `f8c89d5a…` (final build).
- [ ] Remaining C-5: remote policy (excluded), full approval flow, recursive discovery,
  provider/key policy.
