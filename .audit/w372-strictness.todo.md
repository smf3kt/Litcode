# W372 permissions: the reading decision order

Package todo. Base: the W371 repair commit bc7011e. Family: Permissions (stays Partial for the analyser command model, the declaration-prefix rule and remote managed policy).

Source owners (extracted-v2, zero-based half-open UTF-16; full ranges and digests in [W372](../../research/ports/W372-reading-order.md)):
- `jwe` chunk-sfn1dbxq.js [3234078,3234326): an ask is soft without `matchedAskRule` and with an absent/`other` reason or all-soft subcommand results.
- `Lcn` [3234326,3234534): deny 6, soft ask 3, rule ask or bypass-immune safety check 5, other ask 4, passthrough 2, allow 1 (rule-only allow 0).
- `DTr` [3234534,3234967): deny anywhere, then a non-soft primary ask, then the highest rank, then the synthetic non-exhaustive ask.
- `ior` [3253708,3254351): projects through `sfn`; a soft ask from the alternates becomes a passthrough.
- `$pn` [3360777,3364305): the auto-mode hold is `{type: "other", reason: srn}`, so it is soft.
- `X3`/`trn` chunk-a60ee1ne.js [2082,2146)/[987,2081): bypass-immune safety checks (no host producer).

Plan:
- [x] Read every owner above and measure exact bodies and digests; the preflight ranges for `jwe`/`Lcn`/`DTr`/`ize`/`m0`/`Dl` were truncated and are re-measured.
- [x] `readingRank` + `softAsk` in src/permissions.ts; `applyShellReadings` collects alternates with the deny scan first, returns a non-soft primary ask, ranks, downgrades an alternate soft ask to the primary allow, and keeps the synthetic non-exhaustive ask and the bypass guard.
- [x] One new group in test/shell-permissions.test.ts: alternate ask on a complete set, primary ask over a rule ask, deny over the primary ask, auto soft-ask downgrade, auto rule ask.
- [x] scripts/smoke-shell-order-cli.mjs: three compiled cases (alternate ask, primary ask, auto downgrade) with `--baseline` asserting the HEAD answers.
- [x] Red baselines: the group fails against HEAD's src/permissions.ts; the driver passes `--baseline` on a build of HEAD and fails the new assertions there.
- [x] An existing agent-lifecycle assertion caught the first version treating the auto hold as non-soft; repaired with `softAsk` and the downgrade.
- [x] check/build, focused permission suites 88/88, full 3457/3457 clean, identity b8546796.
- [x] Records: W372 record, evidence JSON, CURRENT, FEATURES row, partial-closure row, this card.
- [ ] One bounded independent review; record its verdict and repair any confirmed finding.
- [ ] Commit exact paths locally (no amend, no push, no coauthor).

Local only. No account, OAuth, hosted subscription, paid upstream, push, coauthor or schedule.
