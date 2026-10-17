# W76 runtime trail

## W76-01 acceptance (2026-10-17)

- [x] **Source read.** `Yb`, `pn`, `N6`, `Pe`, `pc`, `ln`/`cn`/`Ce`, `xg`,
  `Zs`/`kt` and `rPe` measured in UTF-16 code units.
- [x] **Port.** The source string branch: 2000-unit cut, `pc` sanitise, tab to one
  space, truncation-marker and mark-run withholding.
- [x] **Shared module.** `preview-sanitize.ts` owns `pc`/`nD`; W74 delegates.
- [x] **Gates.** terminal 28/28, interaction-tools 32/32, tsc 0, build 0, full
  2,104/2,104, chain 767/767, notices 0, source index unchanged, identity
  `27613f94…`.
- [ ] Remaining C-11: full renderer and formatting host.
