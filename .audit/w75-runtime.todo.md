# W75 runtime trail

## W75-01 acceptance (2026-10-17)

- [x] **Source read.** `xHe`, `sze`, `fDe`, `pDe`, the three bounds and the
  stringify/parse/deep-equal aliases measured in UTF-16 code units.
- [x] **Port.** Answer-side bounds walk, JSON roundtrip and deep strict equality;
  `de` uses the same comparison.
- [x] **Effect.** JSON-equivalent forms match; out-of-bounds fields refuse with
  `changed_shown_field`; the source warning is not emitted.
- [x] **Gates.** interaction-tools 32/32, tsc 0, build 0, full 2,103/2,103,
  chain 767/767, notices 0, source index unchanged, identity `b03f27a0…`.
- [ ] Remaining C-11: full renderer and formatting host.
