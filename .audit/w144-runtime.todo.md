# W144 runtime trail

## W144-01 acceptance (2026-10-18)

- [x] **Source read.** `gno` [283212,284410) 1,198u; closure measured by probe
  (9 → 20 → 29 site blocks) plus the 16 n3 blocks; 46 blocks, 8,188 units.
- [x] **Port.** Generated `src/plugin-chain-engine-pipeline-source.ts` (16 blocks, 3,392u)
  and `src/plugin-chain-engine-render-site-source.ts` (30 blocks, 4,796u); typed seams
  `plugin-chain-engine-pipeline.ts` + `plugin-chain-engine-render-site.ts`.
- [x] **Reuse.** `ls`/`tIt` from host-call-source (one AsyncLocalStorage); `er`/`b3`
  already exported by source.
- [x] **Site timing.** Pipeline's first import registers `ui.render` before `Ito` binds.
- [x] **Tests.** Eight pipeline tests; probe `.audit/w144-run.mts` draws
  `{type:'engine',ref:1}` with the input as descriptor.
- [x] **Gates.** Focused 34/34, full 2273/2273, tsc 0, build 0, notices 0, identity
  `e6ede94c…`.
- [ ] Next: C-2 diff/attachment/footer/above-prompt panes; C-5/C-6/C-11 remainders.
