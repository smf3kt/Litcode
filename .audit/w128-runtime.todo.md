# W128 runtime trail

## W128-01 acceptance (2026-10-17)

- [x] **Journal read.** Line entries, chained v2 key, canonical options,
  result/started/failed indexes, unparseable lines skipped.
- [x] **Cache read.** Hit returns without spawn; started-without-failed
  respawns while keeping later hits; first miss stops cache reads; null writes
  failed only.
- [x] **Resume read.** Run id shape, collision refusal, missing-journal
  refusal, local-only adaptation for the absent remote mirror.
- [x] **Tool wiring.** Journal under the owner workflow directory, launched
  entry, run_id in the result, onStarted child ids.
- [x] **Gates.** Workflow family 29/29, focused 64/64, tsc 0, build 0, notices
  0, source index unchanged, identity `4c2f329b…`.
- [ ] Full suite and plugin chain were not rerun this package (the full run was
  interrupted); the focused set covers every test that references
  `workflow_run`.
- [ ] Remaining C-8: named workflows, remote journal mirroring, reattachment,
  automatic effect replay, structured output, disallowedTools,
  bashCommandClamp, stallMs.
