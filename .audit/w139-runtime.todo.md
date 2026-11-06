# W139 runtime trail

## W139-01 acceptance (2026-10-18)

- [x] **Source read.** Shared per-hook generator (chunk-sfn1dbxq.js 3018155, read 3041266),
  emitter `LLe` (619331), collector `b0` (3046416), `avt` (2932807).
- [x] **Port.** `applyTerminalSequence` helper; PostCompact parses stdout only for the effect;
  other structured fields stay unread.
- [x] **Tests.** hooks: allowlisted sequence delivered, context/system message ignored,
  display line unchanged.
- [x] **Gates.** Focused 139/139, full 2241/2241, tsc 0, build 0, notices 0, identity
  `a118ac44…`.
- [ ] Next C items: C-2 diff/attachment panes, C-5 remainders, C-7/C-9 external, C-11
  renderer, C-12 `gno` engine pipeline.
