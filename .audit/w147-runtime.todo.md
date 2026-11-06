# W147 runtime trail

## W147-01 acceptance (2026-10-18)

- [x] **Source read.** `Tp` and its hint table (1,468 units), `Xa`/`Uo` (65), `rc`/`IG`/`Oo` (92);
  3 blocks, 1,625 units; unresolved 0.
- [x] **Port.** Generated `src/plugin-chain-above-prompt-input-source.ts`; typed seam
  `plugin-chain-above-prompt-input.ts` exposes the hint map, delays, clock, due window and the
  digit-confirm hook.
- [x] **Host token.** `PromptClock` stands in for the source's `b4n` context; unmounted stays the
  source `Date.now` fallback.
- [x] **Seam fix.** `en`/`P` now distinguish omitted deps from `[]`; an effect without a dependency
  array runs after every render, matching React and the source handler-ref effect.
- [x] **Tests.** 9 cases cover hints and NFKC, constants, due-window edges, clock context, the
  Enter path (success, non-submit, multi-character, mount window, once), debounce and unmount.
- [x] **Gates.** Focused 11/11, full 2305/2305, tsc 0, build 0, notices 0, identity `307fee76…`.
- [ ] Next: select-key subsystem (`C0`/`nK`/`uK`/`X1`/`lK`) and `NFe`.
