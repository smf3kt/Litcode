# W79 runtime trail

## W79-01 acceptance (2026-10-17)

- [x] **Source read.** `y5e`, `zze`, the six payload builders, `KZn` and the
  setup dispatch measured in UTF-16 code units.
- [x] **Port.** `hookMatcherValue`; undefined selector accepts every matcher;
  payload field alignment at every raise site.
- [x] **Adaptation.** Tool-driven FileChanged reports `change`; the
  InstructionsLoaded raise stays session-level; model-alias normalization and
  UserPromptExpansion `command_name` stay residual.
- [x] **Gates.** hooks 48/48, agent-lifecycle 25/25, tsc 0, build 0, full
  2,107/2,107, chain 767/767, notices 0, source index unchanged, identity
  `fd3b6906…`.
- [ ] Remaining C-6: full consumers and script semantics, a per-file watcher
  raise, and per-file instruction loading.
