# W148 runtime trail

## W148-01 acceptance (2026-10-18)

- [x] **Source read.** `X1`, `eK`, `Ane`, `v0` (926 units) and `cje` (30); 5 blocks, 956 units.
  The select keyboard was measured and deferred because `nK` needs the `ui.input` dispatcher.
- [x] **Port.** Generated `src/plugin-chain-above-prompt-seats-source.ts`; typed seam exposes the
  seat key, key handlers, index callback, registry and change watch.
- [x] **Scan.** unresolved 0 with imports from the hook surface and press dispatch only.
- [x] **Tests.** 6 cases cover key shape, wrapping, Input submit and null press, index hit/miss,
  registry grouping and unbind, value-change reporting with tag filtering, and quiet unchanged.
- [x] **Gates.** Focused 8/8, full 2311/2311, tsc 0, build 0, notices 0, identity `8f0b66ab…`.
- [ ] Next: `C0`/`nK`/`uK`/`lK` (select keyboard and context resolution), then `NFe`.
