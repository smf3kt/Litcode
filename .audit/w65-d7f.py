# -*- coding: utf-8 -*-
"""Wave D step 7b research record: four files, one commit."""
def rd(p): return open(p, encoding='utf-8').read()
def wr(p, t): open(p, 'w', encoding='utf-8').write(t)
def rep(p, old, new):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:70], n)
    wr(p, t.replace(old, new))

# ---------------------------------------------------- the W65 account record ---
W = 'research/ports/W65-account-network.md'
rep(W, "## Protocol slip (recorded)\n", """## Wave D step 7b — the GrowthBook fetch machinery (landed, `25c134f`)

Step 7a left the module's switch as a literal `false`, which is what made the client unconstructible. This step removes the machinery that switch guards, leaving the local half the module still serves: the env-var override channel (`CLAUDE_INTERNAL_FC_OVERRIDES`) and the `growthBookOverrides` config channel, both consulted before the switch exactly as in the source. 1,148 lines to 457; 6 files, +126/−847.

Gone: the client construction with its trust check, auth headers, ant base-URL override and attribute set; the remote-eval payload transform and its `{value}` → `{defaultValue}` workaround; the disk-cache writer; the exposure log and its three tracking sets; the light refresh; the periodic interval (6h, 20min for ants) and its two named process handlers; the user-attribute builder; `getApiBaseUrlHost`; `getAllGrowthBookFeatures`; and `constants/keys.ts`, whose single export — the GrowthBook SDK client key — had exactly one caller, the client construction.

### The one design call: the disk cache does not survive

`getFeatureValue_CACHED_MAY_BE_STALE` fell back to a disk cache that `syncRemoteEvalToDisk` had written from the last successful remote-eval payload. Two reasons it goes rather than moves: it is a stale copy of *server* state rather than local configuration, and in the source it sat **below** the `!isGrowthBookEnabled()` guard. Honouring it would mean moving the guard above it, which is the one thing a port of this kind may not do — so a read without a local override answers with the caller's default, and that is a recorded behaviour change for any session whose cache held a value.

### Two things a later reader needs

**The duplicated return is load-bearing.** Each read keeps the source's `if (!isGrowthBookEnabled())` line and then returns the same value a second time. With this tsconfig's `"strict": false`, tsc accepts falling off the end of the function, so deleting that second return compiles clean and silently hands all ~80 call sites `undefined` instead of their default. Both facts were measured, not assumed: with `: false` on the switch the file compiles, and with the tail removed it also compiles. The fixture pins the counts (four `return defaultValue`, six `return false`, six guards).

**The three zero-caller local functions stay.** `setGrowthBookConfigOverride`, `clearGrowthBookConfigOverrides` and `getGrowthBookConfigOverrides` have no caller left — the `/config Gates` panel that used them left in an earlier wave, and `main.tsx`'s import of `hasGrowthBookEnvOverride` was a dead import that this step removed. They stay because they are the local writer of the path the reads consult, and because they are the only remaining emitter of `onGrowthBookRefresh`, which two live hooks (`useSkillsChange`, `useMainLoopModel`) subscribe to. Deleting them would have cascaded into both hooks for no observable gain.

`utils/config.ts` loses the three flag-cache fields with it. `cachedStatsigGates` and `cachedGrowthBookFeatures` had their last readers here; `cachedDynamicConfigs` had already lost both its reader and its writer when the Statsig client left, and goes with its siblings rather than staying as the odd one out.

### Verification

The surviving bodies were extracted verbatim from `b2c553b` rather than retyped, and the new `w65-d7b-verify` fixture checks each of eight of them word-for-word against that revision, alongside the absence sweep for the 22 collapsed declarations (matched by declaration form, since this cut's own comments still name three of them) and the count assertions above. tsc 0, ten fixtures pass, `git diff --check` clean. The orphan scan, re-run after the deletion, stays at its ten legitimate entries. The step-7a fixture was amended in one assertion — the exposure-log line it checked is what 7b deliberately removes.

**Next (step 7c):** `services/analytics/metadata.ts`'s `getEventMetadata`, `buildProcessMetrics` and the `FirstPartyEventLogging*` converters, and with them `utils/user.ts`'s `getUserForGrowthBook` → `getCoreUserData` → `CoreUserData` chain. All of it is reader-less now; the only live surface left in `metadata.ts` is the tool-name and skill-name helpers the tool path still calls.

## Protocol slip (recorded)
""")

# ------------------------------------------------------------------ CURRENT ---
C = 'research/CURRENT.md'
anchor = "tsc 0, nine fixtures pass (new `w65-d7-verify`), `git diff --check` clean; the post-cut orphan scan named both new orphans.\n"
rep(C, anchor, anchor + """

Wave D step 7b (`25c134f`): the GrowthBook fetch machinery is gone, 1,148 lines to 457. Step 7a had forced the enable switch to `false`, which made the remote-eval client unconstructible; this removes what the switch guards — the client construction with its trust check, auth headers and attribute set, the remote-eval payload transform, the disk-cache writer, the exposure log and its three tracking sets, the light refresh, the periodic interval and its two process handlers, the user-attribute builder, `getApiBaseUrlHost`, `getAllGrowthBookFeatures`, and `constants/keys.ts` (one export, the SDK client key, whose only caller was the client). What is left is the local half: the env-var and config override channels, both ahead of the switch as in the source. The disk cache was deliberately not kept — it is a stale copy of server state and it sat below the source's own guard, so honouring it would have meant moving the guard; a read without a local override now answers with the caller's default. Two things the next reader needs: the duplicated `return` after each guard is what actually hands the caller its default (with `"strict": false` tsc accepts falling off the end, so deleting it compiles clean and returns `undefined` to ~80 call sites — measured both ways), and the three zero-caller local override functions stay because they are the only remaining emitter of `onGrowthBookRefresh`. The surviving bodies were extracted verbatim from `b2c553b` and the new `w65-d7b-verify` checks eight of them word-for-word against it. 6 files, +126/-847. tsc 0, ten fixtures pass.""")

# ------------------------------------------------------------------- STATUS ---
S = 'research/STATUS.md'
rep(S, "the post-cut orphan scan named both new orphans. Independent review not run (rate-limited). [W65 record](ports/W65-account-network.md).\n",
    "the post-cut orphan scan named both new orphans. Wave D step 7b (`25c134f`) collapses the GrowthBook fetch machinery the now-false switch guarded: the remote-eval client, its payload transform, the disk-cache writer, the exposure log, the periodic refresh and constants/keys.ts are gone, leaving the env-var and config override channels ahead of the switch (1,148 lines to 457; 6 files, +126/-847). The disk cache was deliberately not kept — a stale copy of server state sitting below the source's own guard. Recorded and pinned by the new fixture: the duplicated return after each guard is what hands callers their default, since tsc accepts falling off the end under \"strict\": false. tsc exits 0; ten fixtures pass. Independent review not run (rate-limited). [W65 record](ports/W65-account-network.md).\n")

# ----------------------------------------------------------------- FEATURES ---
F = 'research/FEATURES.md'
rep(F, "and growthbook.ts's now-unconstructible fetch machinery still to collapse in step 7b).",
    "and growthbook.ts's fetch machinery collapsed in step 7b, which took the module from 1,148 lines to 457 and deleted constants/keys.ts, keeping only the env-var and config override channels ahead of the switch; the three flag-cache fields in utils/config.ts went with it).")
rep(F, "[W65](ports/W65-account-network.md). |",
    "Next in the same cluster: `services/analytics/metadata.ts`'s getEventMetadata / buildProcessMetrics / FirstPartyEventLogging* converters and `utils/user.ts`'s getUserForGrowthBook + CoreUserData + getCoreUserData chain, all reader-less after step 7b. [W65](ports/W65-account-network.md). |")

print('record ok')
