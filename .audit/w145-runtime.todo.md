# W145 runtime trail

## W145-01 acceptance (2026-10-18)

- [x] **Source read.** AbovePrompt pure core measured in chunk-24k7d6mw.js (10 blocks) plus
  `F4` from chunk-1r9zp6s1.js; 11 blocks, 1,473 units; component `NFe` measured separately at
  5,856 units with 82 unresolved names and deferred.
- [x] **Port.** Generated `src/plugin-chain-above-prompt-source.ts`; typed seam
  `plugin-chain-above-prompt.ts` exposes window, focus, context name, hotkeys, top walk, cue
  check, overlap, scroll handlers, key merge and the two constants.
- [x] **Scan.** `source-undeclared-scan` unresolved 0; the core imports nothing.
- [x] **Tests.** 13 cases assert overflow/fit/negative windows, focus selection, context names,
  hotkey capture without recursion and with engine skip, top sums, cue visibility, plugin
  disjointness, all six scroll arguments, merge order and input-only alias suppression.
- [x] **Gates.** Focused 14/14, full 2285/2285, tsc 0, build 0, notices 0, identity
  `b8af8bb6…`.
- [ ] Next: `NFe` component and data sources; then C-2 fast mode/diff/attachments/footer.
