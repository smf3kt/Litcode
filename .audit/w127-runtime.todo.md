# W127 runtime trail

## W127-01 acceptance (2026-10-17)

- [x] **Trigger read.** Feature gate, remote/SDK/memory-mode gates, 24h and
  5-session thresholds, 10-minute throttle, permission-write refusal.
- [x] **State read.** Last-consolidated timestamp, PID lock with stale window
  and rollback, sessions-touched listing.
- [x] **Pass read.** Forked background query, 30-turn bound, file tracking,
  capped-run write deferral and item settlement.
- [x] **Disposition.** Not ported as-is; in-conversation maintenance carries
  the user-facing function and is already the product contract.
- [x] **Gates.** No code change; W126's measured gates stand and the identity
  is unchanged.
- [ ] Remaining C-9: marketplace/publish/full component semantics, plugin
  source-vs-builtin conflicts and auto-discovery.
