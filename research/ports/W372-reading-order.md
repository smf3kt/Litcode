# W372 — the reading decision order

Status: implemented at 4a1b14b, review-repaired, identity dc976fb5. Base: the W371 repair commit bc7011e.

## Source position

All coordinates are zero-based half-open UTF-16 code units in the extracted 2.1.296 sample (artifact `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`).

| Symbol | Module | Range | body16 |
| --- | --- | --- | --- |
| `jwe` (soft ask) | chunk-sfn1dbxq.js | [3234078,3234326) | 63a4609d828d83bf |
| `Lcn` (strictness rank) | chunk-sfn1dbxq.js | [3234326,3234534) | bb4863a870d1a305 |
| `DTr` (combine) | chunk-sfn1dbxq.js | [3234534,3234967) | 4cd43add5ae5c4a4 |
| `sfn` (message projection) | chunk-sfn1dbxq.js | [3252890,3253132) | fd055389fe0fc6f6 |
| `$cn` (matched ask rule) | chunk-sfn1dbxq.js | [3253132,3253708) | 724ee7599692796f |
| `ior` (call site and soft-ask downgrade) | chunk-sfn1dbxq.js | [3253708,3254351) | c6d9d9367c71cf0b |
| `$pn` (entry; auto reroute and passthrough conversion) | chunk-sfn1dbxq.js | [3360777,3364305) | 4182360934672780 |
| `ize` (rule-only reason) | chunk-sfn1dbxq.js | [609639,609790) | ef323ba2c52fa0c7 |
| `m0` (ask rule present) | chunk-sfn1dbxq.js | [3354764,3354848) | 6324bb3421c6c791 |
| `utt` (rule ask anywhere) | chunk-sfn1dbxq.js | [3354561,3354764) | 9df48f931bd97a80 |
| `Dl` (safety-check walk) | chunk-sfn1dbxq.js | [3365554,3365753) | dd4494b95f393787 |
| `Rl` (reason message) | chunk-sfn1dbxq.js | [3314893,3316265) | 73c3bc38bf93a02c |
| `trn` (safety-check table) | chunk-a60ee1ne.js | [987,2081) | bcea04ab0ec45687 |
| `X3` (bypass-immune check) | chunk-a60ee1ne.js | [2082,2146) | e4bc2210e56e5e98 |
| `nrn` (unplaceable check) | chunk-a60ee1ne.js | [2146,2216) | 2254d9d5c1973da8 |
| `d` (circuit-breaker walk) | chunk-a60ee1ne.js | [2216,2303) | 98e0d1b4d1f81a48 |

Module digests: chunk-sfn1dbxq.js 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; chunk-a60ee1ne.js fe5d3ed9cb5d16b40ded156d060aeed714dc3a382405609422688756f0707ee1.

## Source behaviour

- `Lcn(e)` ranks one reading: deny 6; an ask that is soft 3, else `m0(e) || Dl(e.decisionReason, X3) !== undefined` 5, else 4; passthrough 2; allow with `ize(reason)` 0, else 1.
- `jwe(e)` is true for an ask without `matchedAskRule` whose reason is absent or `type: "other"`, or whose `subcommandResults` reasons are all allow, passthrough or soft in turn.
- `m0(e)` is `utt(e.decisionReason) || e.matchedAskRule?.ruleBehavior === "ask"`; `utt` finds a rule reason with `ruleBehavior: "ask"` anywhere in the reason tree.
- `Dl(e, n)` walks the reason tree and returns the first `safetyCheck` reason the predicate accepts. `X3` accepts a reason whose circuit breaker (or any `also` entry) names a `trn` check with `bypassImmune: true`: `dangerousRemoval`, `isolatePeerMachines`, `restrictedMode`, `outsideReadsBlocked`.
- `DTr(e, n, r)` takes the primary `e` and alternate readings `n`: a deny anywhere wins; a primary ask that is not soft returns before any ranking; otherwise the highest `Lcn` wins; if the set is not exhaustive (`r` false) and the winner is not an ask, it returns a synthetic ask whose reason is "Variables set in front of a declaration in this command can't all be checked before it runs" with `bashMissKind: "too-complex"`.
- `ior` projects the combined result through `sfn`, then: if the result is the primary, or is not an ask, or is not soft, it becomes the answer; a soft ask from the alternates becomes a passthrough carrying its message and reason unless the primary is already a passthrough.
- `$pn` reroutes an auto-mode allow to an ask with `decisionReason: {type: "other", reason: srn, ...}`; `srn` is "Auto mode held this command for the server-side classifier to review", and `jwe` treats an `other` reason as soft. The reroute is gated by `hor` and runs after the permission check.
- The entry `$pn` ends with `let $e=V.behavior==="passthrough"?{...V,behavior:"ask",message:Rl(e.name,V.decisionReason)}:V; ... return $e` ([3364091,3364185), body16 5beadd59c5d65458; tail through `return $e` at [3364091,3364304)): every passthrough that survives `ior` is turned back into an ask before the caller sees it.
- `sfn` turns an `other`-reason ask with a known `bashMissKind` into the read-block ask (`VW`) when `blockReadsOutsideWorkingDirectories` is on.
- `$cn` upgrades an ask with a prefix ask rule to `matchedAskRule`, which `m0` reads as rank 5.

## Host adaptations

- `applyShellReadings` ranks every reading with `readingRank` and lets the strictest decide, matching `DTr`: a deny anywhere wins, then the highest rank wins between the primary and the alternates.
- The host's rank mapping: deny 6; an ask with `floor: 'rule'` 5 (the host's equivalent of `matchedAskRule`); any other ask 4; allow 1. The source also ranks a soft ask 3, a passthrough 2 and a rule-only allow 0. The host has no producer for those: an allow carries no reason tree, no reading result is a passthrough, and every host ask carries a mode or rule reason.
- The host applies its mode hold inside `decideOnce`, so a mode ask reaches the ranking with no floor and ranks 4. The recovered order applies the hold after the reading combination; for every case the host can produce, ranking the hold as a plain ask gives the same decision, because a rule ask from an alternate still outranks it and it still outranks an allow.
- `ior`'s downgrade of a soft ask to a passthrough is not ported: the host produces no soft ask, and the entry `$pn` turns every passthrough back into an ask, so the downgrade could not end in an allow.
- A non-exhaustive set whose winner is an allow still becomes the reading ask, with the host's existing wording; the bypass guard on that branch is the host's standing stand-in for the source mode short-circuit and is unchanged.
- The alternate-ask winner keeps its own floor (`'rule'` or none) and is reported with the reading that raised it.
- Not ported: `sfn`'s read-block projection (the host has no read-block ask), `$cn`'s matched-ask upgrade (each reading is decided through `decideOnce`, so a rule that matches a reading already returns `floor: 'rule'`), and the `X3` bypass-immune checks (the host produces no safety-check reasons).

## Contract and boundaries

A shell command line whose readings mix allow and ask resolves the way the recovered `DTr`/`Lcn` order resolves it: a denial anywhere denies; an ask outranks an allow even when the reading set is complete; a rule ask outranks a mode ask; an ask from an alternate reading never lets the command run; and a non-exhaustive set whose winner is an allow asks. Bypass mode still never turns a reading into a prompt on its own.

## Validation

`test/shell-permissions.test.ts` gains one group: an exact allow on the quoted line with a de-quoted alternate reading asks with the alternate's reason on a complete reading set; a mode ask on the primary is outranked by a rule ask from an alternate reading; a denial still beats that rule ask; an auto-mode allow with an alternate ask asks instead of running; and an alternate rule ask beats the auto-mode hold.

`scripts/smoke-shell-order-cli.mjs` runs two cases through the compiled CLI against an owned loopback SSE server: the exact-allow line (alternate ask) and the auto-mode line (alternate ask over the hold). `--baseline` asserts the previous build's answers (4a1b14b, identity 7a5d4ab1d6dd799a4a3af4a9866a18e8c2cef15577f0e02061cab316b2b02286): the alternate ask keeps its own reason, and the auto-mode line is downgraded to a passthrough and runs. The repaired build refuses both; the auto case wins as an ask with no floor, so auto mode holds it for the classifier, which the owned fixture cannot answer, and the command ends with "Classifier returned no policy verdict" and no marker file.

Red baseline: the group fails against 4a1b14b's `src/permissions.ts` (the auto-mode allow); the driver passes `--baseline` on a build of 4a1b14b and fails the new assertions there.

One full run under concurrent work reported a single failure in the unrelated migration async-hook timing test (4361 ms against its own 5 s bounds); it passes in isolation (323 ms) and in the clean rerun, so it is load-sensitive, not a product change.

Check and build pass. Permission suites 68/68 (shell-permissions 8, agent-lifecycle 60). Full suite 3457/3457 across 118 suites, 0 fail/cancel/skip/todo. Identity dc976fb5117db23aaab4ad578856cadeef8122dac6c55ac9bd3ec250b62b1bb0 (941 input / 360 validation / 662 build records).

## Review disposition

An independent review of commit 4a1b14b found one High, one Medium and two Low findings. All four were repaired in the follow-up commit.

- High: the `ior` downgrade was ported as "return the primary allow", so in auto mode an alternate soft ask let the command run. The entry `$pn` ([3364091,3364185)) converts every passthrough back to an ask, so the recovered result is never an allow. The soft-ask rank and the downgrade were removed; an alternate ask now always wins as an ask, and the compiled auto case refuses.
- Medium: the record and the `src/permissions.ts` comment claimed a passthrough "maps to allow" and that the auto hold is the `$pn` reroute. The reroute is gated by `hor` (allow-only, sandbox/readOnly reasons) and runs after `ior`, so it cannot be a `DTr` input. The comment and this record now state the host adaptation: the host applies the mode hold inside `decideOnce`, the hold ranks as a plain ask, and no soft ask exists to downgrade.
- Low: the `autoRuleAsk` assertion also passes on the previous build. It is kept as a guard; the distinguishing compiled baseline is the auto case, which the previous build allows.
- Low: `--baseline` was not pinned to a build. The baseline branch now asserts the 4a1b14b build's answers, and the baseline identity is recorded above.

## Reproduction

```sh
node --import tsx --test test/shell-permissions.test.ts
node scripts/smoke-shell-order-cli.mjs
node scripts/smoke-shell-order-cli.mjs --baseline
```
