# W136 runtime trail

## W136-01 acceptance (2026-10-18)

- [x] **Source read.** `Gze` (chunk-sfn1dbxq.js 2945048-2945292) and the StopFailure schema
  (chunk-r2vtj1kh.js 198098).
- [x] **Port.** Both raise sites await the hook and discard its answer; payload fields kept.
- [x] **Tests.** Model-error StopFailure test asserts no status line carries the hook context.
- [x] **Gates.** Focused 136/136, full 2238/2238, tsc 0, build 0, notices 0, identity
  `1d28148b…`.
- [ ] Next C items: C-2 interaction remainder, C-5/C-6/C-7 remainders, C-11, C-12.
