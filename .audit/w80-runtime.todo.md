# W80 runtime trail

## W80-01 acceptance (2026-10-17)

- [x] **Source read.** `oXr` and `sXr` payload builders and their selector
  normalization measured in UTF-16 code units.
- [x] **Port.** Pre/Post payloads carry `from_model`, `to_model` and
  `requested_model`; the selector reads `to_model`.
- [x] **Adaptation.** Model-alias normalization, `source` and the model-flag
  spread stay residual.
- [x] **Gates.** interactive 7/7, hooks 48/48, tsc 0, build 0, full 2,107/2,107,
  chain 767/767, notices 0, source index unchanged, identity `560f098a…`.
- [ ] Remaining C-6: full consumers and script semantics, per-file watcher raise
  and per-file instruction loading.
