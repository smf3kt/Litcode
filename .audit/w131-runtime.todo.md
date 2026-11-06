# W131 runtime trail

## W131-01 acceptance (2026-10-17)

- [x] **Source read.** Installed Magpie's `MAGPIE_ADDR`, `settings/port`, `caller-keys`, key
  prefixes, and `stash.json claude.wired_at`; W03 route records re-read.
- [x] **Port.** Endpoint resolver, bounded wiring reader, revoked-key selection and one
  rotation re-read in `src/gateway-inherit.ts`.
- [x] **Wiring.** Launcher resolves before origin validation; check provenance fields; pinned
  resume still first.
- [x] **Tests.** Endpoint precedence/loopback/untrusted/order tests, four revoked-key cases,
  four hermetic launcher smoke cases.
- [x] **Gates.** Focused 18/18, tsc 0, build 0, notices 0, both Magpie smokes passed,
  identity `eac028a1…`.
- [ ] Live macOS app cold start and caller-key issuance remain the user's action.
- [ ] Next C item: C-2 interaction remainder.
