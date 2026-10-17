# -*- coding: utf-8 -*-
"""Wave D step 7s research record: four files, one commit."""
def rd(p): return open(p, encoding='utf-8').read()
def wr(p, t): open(p, 'w', encoding='utf-8').write(t)
def rep(p, old, new):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:80], n)
    wr(p, t.replace(old, new))

W = 'research/ports/W65-account-network.md'
rep(W, """
## Protocol slip (recorded)""", """
## Wave D step 7s — the fast-mode account-status probe (`8c8d201`, landed)

**The probe was a subscription lookup with one dead arm and one live one.** `utils/fastMode.ts` fetched `GET ${getOauthConfig().BASE_API_URL}/api/claude_code_penguin_mode`, chose between an OAuth bearer with `anthropic-beta: OAUTH_BETA_HEADER` and an `x-api-key`, and cached the org answer in `orgStatus` for `getFastModeUnavailableReason`. The OAuth arm was dead on the same producer fact step 7r recorded: both surviving token sources hardcode `scopes: ['user:inference']`, so `hasProfileScope()` was constant false. The API-key arm still posted a remote account endpoint whose answer only the server can give — what the 2026-10-16 local-only directive excludes — so the whole probe goes.

**The local surface stays.** `isFastModeEnabled` (the disable env flag), the cached GrowthBook flags (`tengu_penguins_off`, `tengu_marble_sandcastle`), the SDK `flagSettings` opt-in, the first-party provider gate, the model-support and initial-setting predicates, the cooldown state machine with its two signals, `/fast` and the picker are untouched. The gate the probe fed — `orgStatus.status === 'disabled'` — has no producer left, so it folds to an in-session flag set by the API-rejection path. `handleFastModeRejectedByAPI` remains the server-feedback arm: it still clears the persisted `fastMode` preference and emits the notification signal, now payloadless because no probe can report the opposite transition. The hook loses its unreachable `orgEnabled === true` arm.

**Every host folds.** `prefetchFastModeStatus`, `resolveFastModeStatusFromCache`, `fetchFastModeStatus`, the `FastModeResponse`/`FastModeOrgStatus`/`FastModeDisabledReason` model, the reason table, the 30 s throttle and the `startupPrefetchedAt` bookkeeping are deleted. `main.tsx` loses the whole startup-prefetch block (the throttle, the kill switch, the cache resolution, the config write and both log lines) and the two imports it alone read (`prefetchFastModeStatus`/`resolveFastModeStatusFromCache`, `getFeatureValue_CACHED_MAY_BE_STALE`); the settings-dialog block is followed directly by the example-command prefetch. `commands/fast/fast.tsx` no longer awaits the probe before its picker. `penguinModeOrgEnabled` and `startupPrefetchedAt` leave `utils/config.ts`.

**The last readers leave.** `handleOAuth401Error` and `hasProfileScope` are deleted — the probe was the last reader of both — and `OAUTH_BETA_HEADER` leaves `constants/oauth.ts` with them. The bearer/API-key surface stays in full: `getClaudeAIOAuthTokens` with both producers, `getAuthTokenSource`, `getAccountInformation`, the API-key helpers and the `SubscriptionType`-typed token field.

**One behaviour change, stated.** The org-disabled memory is now session-scoped: the source persisted it through `penguinModeOrgEnabled` and restored it at startup from the deleted cache. The preference is still cleared on rejection, so a restart begins with fast mode off, and the inference API remains the authority on the next request. Before any probe answer arrived the source treated fast mode as available (`pending` fell through), so a fresh session's availability answer is unchanged.

### Port coordinate refresh

Eleven historical evidence files moved, all by re-running their own fixtures: `w65-d2`, `w65-d7b`, `w65-d7h`, `w65-d7i`, `w65-d7j`, `w65-d7l`, `w65-d7n`, `w65-d7o`, `w65-d7p`, `w65-d7q` and `w65-d7r`. `portSha256` only; no `sourceSha256` changed and no range moved.

### Verification

tsc 0, twenty-seven fixtures pass (the new `w65-d7s-verify` plus twenty-six carried), `git diff --check` clean, the orphan scan at its ten legitimate entries with the file count unchanged (1632 — no module was deleted). Two carried fixtures were amended, each a pin this step supersedes: `w65-d7q-verify` pinned `hasProfileScope` as the fast-mode account gate, and `w65-d7r-verify` pinned both predicates the probe kept alive. Both now assert their absence.

The fixture's absence sweep covers the probe family (the fetch/prefetch/resolve names, the status model, the reason table, the throttle, the endpoint, the env bypass, the analytics event and both config fields), the two auth predicates and the header only the probe read. Survivors are asserted with the reader that keeps each, including the folded rejection body, the payloadless signal, the hook's single arm, the direct settings-dialog→example-command seam and the `/fast` argument path. The base-commit check confirms `755d79b` carried the probe the tree no longer has.

One repair pass: `w65-d7s1.py`'s first `cut_between` retained its end anchor while the replacement re-declared the signal, which tsc rejected with four TS2451s; the script now deletes up to the old signal block and rewrites it in a separate cut, and the tree was restored from `HEAD` before the replay that produced the final state in one pass.

**Next (step 7t):** the ~33 in-place CLI blocks, `cli/transports/`, the dependency-pruning pass (nine zero-importer dependencies) and the `utils/filePersistence/` rename.

## Protocol slip (recorded)""")

C = 'research/CURRENT.md'
rep(C, "Thirteen earlier evidence records refreshed digest-only.\n", """Thirteen earlier evidence records refreshed digest-only.

Wave D step 7s (`8c8d201`): the fast-mode account-status probe is gone. `utils/fastMode.ts` fetched `/api/claude_code_penguin_mode` — an OAuth bearer with `OAUTH_BETA_HEADER`, or an API key — to cache whether the account's organization allows fast mode; the OAuth arm was dead on the producer fact 7r recorded (both surviving token sources hardcode `['user:inference']`), and the API-key arm was a remote account lookup, which the local-only directive excludes. Deleted with it: `prefetchFastModeStatus`, `resolveFastModeStatusFromCache`, the `FastModeResponse`/`FastModeOrgStatus`/`FastModeDisabledReason` model with its reason table, the 30 s throttle, the `startupPrefetchedAt` bookkeeping and both `main.tsx` startup branches, the `/fast` pre-picker fetch, and the `penguinModeOrgEnabled` cache. `handleFastModeRejectedByAPI` folds to the server-feedback arm: it sets an in-session flag, clears the persisted preference and emits the now-payloadless signal, whose hook loses the unreachable re-enablement branch. The local flags (`tengu_penguins_off`, `tengu_marble_sandcastle`), provider/SDK checks, cooldown state machine, model predicates and `/fast` stay. `handleOAuth401Error` and `hasProfileScope` leave `utils/auth.ts` as the probe's last readers, and `OAUTH_BETA_HEADER` leaves `constants/oauth.ts`. 7 files, +17/-368; tsc exits 0; twenty-seven fixtures pass (two carried pins amended, both superseded by this step). Eleven earlier evidence records refreshed digest-only.
""")

S = 'research/STATUS.md'
rep(S, "thirteen earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).\n",
"""thirteen earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).

Wave D step 7s (`8c8d201`) removes the fast-mode account-status probe: `utils/fastMode.ts`'s `GET ${BASE_API_URL}/api/claude_code_penguin_mode` with its OAuth bearer + `OAUTH_BETA_HEADER` (dead under the same producer fact 7r recorded — both surviving token sources hardcode `['user:inference']`) and its API-key arm, the 30 s throttle and `startupPrefetchedAt` bookkeeping with both `main.tsx` startup branches, the `/fast` pre-picker fetch, the cache-resolution substitute and the `orgStatus` model with its reason table. `handleFastModeRejectedByAPI` becomes the in-session server-feedback arm (it still clears the persisted preference and emits the signal, now payloadless, whose hook loses the unreachable re-enablement branch); the local flags, provider/SDK checks, cooldown and `/fast` stay. `handleOAuth401Error` and `hasProfileScope` leave `utils/auth.ts` as the probe's last readers, `OAUTH_BETA_HEADER` leaves `constants/oauth.ts`, and `penguinModeOrgEnabled`/`startupPrefetchedAt` leave `utils/config.ts`. The org-disabled memory is now session-scoped: the preference is still cleared on rejection, so a restart begins with fast mode off, while a fresh session's availability answer is unchanged (`pending` previously fell through). 7 files, +17/-368; tsc exits 0; twenty-seven fixtures pass (two carried pins amended, both superseded by this step); eleven earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).
""")

F = 'research/FEATURES.md'
rep(F, "Remaining under the 2026-10-16 local-only directive: utils/fastMode.ts's account-status path (hasProfileScope's last reader), cli/transports/ as the SDK transport, in-place CLI blocks, the analytics transports",
    "Remaining under the 2026-10-16 local-only directive: cli/transports/ as the SDK transport, in-place CLI blocks, the analytics transports")

rep(F, " Next: utils/fastMode.ts's account-status path, the in-place CLI blocks, cli/transports/, and the dependency-pruning pass. [W65](ports/W65-account-network.md). |",
    " Step 7s (`8c8d201`) removes utils/fastMode.ts's account-status probe: the `/api/claude_code_penguin_mode` fetch with its OAuth bearer + anthropic-beta header (dead under the profile-scope producer fact) and its API-key arm, the 30 s throttle and `startupPrefetchedAt` bookkeeping, the org-status model and reason table, and the cache-resolution substitute. `handleFastModeRejectedByAPI` becomes the in-session server-feedback arm and the notification signal loses its now-impossible re-enablement payload; the local flags, provider/SDK checks, cooldown and `/fast` stay. `handleOAuth401Error` and `hasProfileScope` leave `utils/auth.ts` as the probe's last readers, `OAUTH_BETA_HEADER` leaves the OAuth config, and `penguinModeOrgEnabled`/`startupPrefetchedAt` leave `utils/config.ts`. 7 files, +17/-368. Next: the in-place CLI blocks, cli/transports/, and the dependency-pruning pass. [W65](ports/W65-account-network.md). |")

print('record ok')
