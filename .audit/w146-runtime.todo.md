# W146 runtime trail

## W146-01 acceptance (2026-10-18)

- [x] **Source read.** AbovePrompt renderer pieces measured at 16 blocks, 2,722 units; the NFe
  dependency map showed the local cluster plus seams the product already has.
- [x] **Port.** Generated `src/plugin-chain-above-prompt-parts-source.ts`; typed seam
  `plugin-chain-above-prompt-parts.ts` exposes the wrapper, bounds, focus, indicator and select
  helpers.
- [x] **Namespace adapter.** `plugin-chain-press-button.ts` exports `_3n as releaseInkFocus` so
  `OI`'s `Sc.releaseInkFocus(…)` stays verbatim.
- [x] **Scan.** `source-undeclared-scan` unresolved 0 with imports from react-hooks, ActionBox,
  pressFromTerminal, site columns, list window and F4.
- [x] **Tests.** 11 cases cover wheel mapping, held edges, key bounds, content wrapper, merge and
  clamp, raised scroll, toggle label, chrome components, focus branches, indicator and digit
  no-ops.
- [x] **Gates.** Focused 13/13, full 2296/2296, tsc 0, build 0, notices 0, identity `6d39c0c6…`.
- [ ] Next: `NFe` and the input/select key subsystem (`Tp`/`C0`/`nK`/`uK`/`X1`/`lK`).
