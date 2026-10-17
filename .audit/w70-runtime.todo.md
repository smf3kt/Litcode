# W70 runtime trail

## W70-01 acceptance (2026-10-17)

- [x] **Source read.** `G`/`me` [7068,9556), `Q.check` [9925,10217), `be` [11256,…) and
  `K` [12694,12893) measured in UTF-16 code units.
- [x] **Rules ported.** All six per-kind checks with the source messages, options/multiSelect
  defaults, and `kind ?? "choice"` before dispatch.
- [x] **Uniqueness ported.** `Q.check`'s unique-question-text rule applies in both modes.
- [x] **Errors observable.** Custom schema messages now reach the caller.
- [x] **Gates.** interaction-tools 27/27, tsc 0, build 0, full 2,098/2,098, chain 767/767,
  notices 0, source index unchanged, identity `054cdd94…`.
- [ ] Remaining C-11: full renderer, formatting host, notes/annotations, card answer contract.
