# W133 runtime trail

## W133-01 acceptance (2026-10-17)

- [x] **Source read.** Option validation and pool checks (chunk-hedqf2m1.js), `fTr`/`xX` and
  denial text (chunk-sfn1dbxq.js), `Un`/`hpe` (chunk-z6p21rxk.js), `jxe`/`Bxe`
  (chunk-3cynezh1.js), `Be`/`Tt` (chunk-r2vtj1kh.js).
- [x] **Port.** `src/agent-tool-restrictions.ts`; registry deny filtering and spawn refusals;
  child config clamp plus the agent permission gate; script option normalization and
  pass-through; MCP scopes and implicit `mcp__*`.
- [x] **Tests.** Ten restriction tests, one script option test, one workflow end-to-end pool
  test.
- [x] **Gates.** Focused 111/111, full 2235/2235, tsc 0, build 0, notices 0, workflow resume
  and CLI smokes passed, identity `eff677d0…`.
- [ ] `stallMs` remains unported (C-8).
- [ ] Next C items: C-2 interaction remainder, C-5/C-6/C-7 remainders, C-11, C-12.
