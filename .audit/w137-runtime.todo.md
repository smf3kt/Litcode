# W137 runtime trail

## W137-01 acceptance (2026-10-18)

- [x] **Source read.** `avt` (chunk-sfn1dbxq.js 2932807-2933200), command record output
  semantics (3052800-3053200) and `Mx` labels (chunk-n3ykh62m.js 409429).
- [x] **Port.** `hookDisplayLabel`, PostCompact early branch, `userDisplayMessage` journal and
  display; structured fields ignored for this event.
- [x] **Tests.** hooks: plain stdout, JSON raw text, failed line, exit-2 non-blocking;
  lifecycle: four compaction modes, journal and no model context.
- [x] **Gates.** Focused 136/136, full 2238/2238, tsc 0, build 0, notices 0, identity
  `9e503123…`.
- [ ] Next C items: C-2 interaction remainder, C-5/C-6/C-7 remainders, C-11, C-12.
