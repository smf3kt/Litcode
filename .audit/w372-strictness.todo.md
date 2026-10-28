# W372 permissions: the reading decision order

Package todo. Base: the W371 repair commit bc7011e. Family: Permissions (stays Partial for the analyser command model, the declaration-prefix rule and remote managed policy).

Source owners (extracted-v2, zero-based half-open UTF-16; full ranges and digests in [W372](../../research/ports/W372-reading-order.md)):
- `jwe` chunk-sfn1dbxq.js [3234078,3234326): an ask is soft without `matchedAskRule` and with an absent/`other` reason or all-soft subcommand results.
- `Lcn` [3234326,3234534): deny 6, soft ask 3, rule ask or bypass-immune safety check 5, other ask 4, passthrough 2, allow 1 (rule-only allow 0).
- `DTr` [3234534,3234967): deny anywhere, then a non-soft primary ask, then the highest rank, then the synthetic non-exhaustive ask.
- `ior` [3253708,3254351): projects through `sfn`; a soft ask from the alternates becomes a passthrough.
- `$pn` [3360777,3364305): the auto-mode reroute `{type: "other", reason: srn}` is gated by `hor` and runs after `ior`; the entry tail [3364091,3364185) converts every surviving passthrough to an ask before returning.
- `X3`/`trn` chunk-a60ee1ne.js [2082,2146)/[987,2081): bypass-immune safety checks (no host producer).

Plan:
- [x] Read every owner above and measure exact bodies and digests; the preflight ranges for `jwe`/`Lcn`/`DTr`/`ize`/`m0`/`Dl` were truncated and are re-measured.
- [x] `readingRank` in src/permissions.ts; `applyShellReadings` collects alternates with the deny scan first, ranks the primary with the alternates, lets the highest rank win, and keeps the synthetic non-exhaustive ask and the bypass guard. The review repair removed the soft-ask rank and the downgrade.
- [x] One new group in test/shell-permissions.test.ts: alternate ask on a complete set, mode ask outranked by a rule ask, deny over the rule ask, auto-mode alternate ask refuses, auto rule ask.
- [x] scripts/smoke-shell-order-cli.mjs: two compiled cases (alternate ask, auto-mode alternate ask) with `--baseline` asserting the 4a1b14b answers.
- [x] Red baselines: the group fails against 4a1b14b's src/permissions.ts (the auto allow); the driver passes `--baseline` on a build of 4a1b14b and fails the new assertions there.
- [x] An existing agent-lifecycle assertion caught the first version treating the auto hold as non-soft; the review then found the downgrade could end in an allow, and the repair removed it.
- [x] check/build, focused permission suites 68/68, full suite, identity re-frozen.
- [x] Records: W372 record, evidence JSON, CURRENT, FEATURES row, partial-closure row, this card.
- [x] One bounded independent review: one High, one Medium, two Low; all four repaired.
- [x] Commit exact paths locally: 4a1b14b (no amend, no push, no coauthor); repair commit after the review.

Local only. No account, OAuth, hosted subscription, paid upstream, push, coauthor or schedule.
