# W135 runtime trail

## W135-01 acceptance (2026-10-18)

- [x] **Source read.** `cK`/`dK` (chunk-r2vtj1kh.js 193602) and the `Hkn` caller
  (chunk-5b2hxy2e.js 123931-124000).
- [x] **Port.** `HookPayload.tool_calls`; one shared array for the independent hook and the
  classic event; `tool_use_ids` removed.
- [x] **Tests.** Hooks payload round-trip; lifecycle stdin capture with the exact entry.
- [x] **Gates.** Focused 83/83, full 2238/2238, tsc 0, build 0, notices 0, identity
  `8066539f…`.
- [ ] Next C items: C-2 interaction remainder, C-5/C-6/C-7 remainders, C-11, C-12.
