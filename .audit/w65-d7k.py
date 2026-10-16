# -*- coding: utf-8 -*-
"""Wave D step 7d research record: four files, one commit."""
def rd(p): return open(p, encoding='utf-8').read()
def wr(p, t): open(p, 'w', encoding='utf-8').write(t)
def rep(p, old, new):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:70], n)
    wr(p, t.replace(old, new))

W = 'research/ports/W65-account-network.md'
rep(W, "## Protocol slip (recorded)\n", """## Wave D step 7d — the leftovers the analytics removal stranded (landed, `11e5a4c`)

Four files, one shape: modules and call sites whose only purpose was to feed the transports removed in 7a and the record builders removed in 7c. 4 files, +8/−335.

`utils/user.ts` existed to build the analytics user record. `getCoreUserData` assembled it, `getUserForGrowthBook` was its GrowthBook variant, `initUser` pre-fetched the email so the record could stay synchronous, and `resetUserCache` cleared that cache on login/logout. All four, the `CoreUserData` and `GitHubActionsMetadata` types, and the two email helpers behind them had no reader left — 194 lines to 33, leaving the one export with a live caller, `getGitEmail`, which `utils/exampleCommands.ts` calls.

`main.tsx` loses the startup prefetch and the post-login reset that went with it. **Two behaviour changes worth naming because they are real rather than notional:** the tree no longer spawns `git config --get user.email` during startup, and the `if (onboardingShown)` block that ordered the cache reset before a GrowthBook refresh is gone entirely rather than left as a no-op call. The prefetch comment above the skip-list was corrected to stop naming a prefetch that no longer exists.

Three exports that step 7c orphaned, in modules that keep other live exports:

- `getRepoRemoteHash` (`utils/git.ts`) hashed the normalized remote for the analytics `rh` field; `normalizeGitRemoteUrl` was its only caller and `isLocalHost` was the normalizer's only helper, so all three went, taking the `crypto` import with them.
- `getLinuxDistroInfo` and `detectVcs` (`utils/platform.ts`) filled the environment context, and took the `fs/promises` and `os` imports. `getPlatform`, `getWslVersion` and `SUPPORTED_PLATFORMS` stay.

### One call site is now deliberately caller-less

`refreshGrowthBookAfterAuthChange` had exactly one caller — the block removed here — so its export is now the fourth caller-less export in `growthbook.ts`, alongside the local override trio 7b kept on purpose. It stays for now rather than being deleted in this package, and the reason is mechanical: `w65-d7b-verify` pins the guard-brace count at 6, and deleting this function drops it to 5. Step 7e should take it together with `initializeGrowthBook`'s two remaining warm-up calls (`interactiveHelpers.tsx`, `cli/print.ts`) and move that fixture in the same commit.

### Verification

tsc 0, twelve fixtures pass, `git diff --check` clean, the orphan scan at its ten legitimate entries. Three exports the cut could have orphaned were checked and still have readers: `getRateLimitTier`, `getOrCreateUserID`, `getHostPlatformForAnalytics`.

**Next (step 7e):** the growthbook warm-up surface — `refreshGrowthBookAfterAuthChange`'s caller-less export, `initializeGrowthBook`'s two `void` calls, the `checkGate_CACHED_OR_BLOCKING('tengu_harbor')` call inside `interactiveHelpers.tsx`'s dead `KAIROS` block, and the resulting move of the 7b fixture.

## Protocol slip (recorded)
""")

C = 'research/CURRENT.md'
anchor = "4 files, +10/-1,749. tsc 0, eleven fixtures pass.\n"
rep(C, anchor, anchor + """

Wave D step 7d (`11e5a4c`): the leftovers the analytics removal stranded. `utils/user.ts` (194 lines to 33) keeps only `getGitEmail`, the one export with a live caller — the core user record, its GrowthBook variant, the startup email prefetch, the cache reset and both types behind them had no reader left. `main.tsx` loses that prefetch and the post-login reset, so the tree no longer spawns `git config --get user.email` at startup, and the `if (onboardingShown)` block that ordered the reset before the GrowthBook refresh is gone rather than left as a no-op call. Three exports step 7c orphaned in modules that keep other live exports also went: `getRepoRemoteHash` with its only caller `normalizeGitRemoteUrl` and that function's only helper `isLocalHost` (taking the crypto import), and `getLinuxDistroInfo` and `detectVcs` (taking the fs and os imports). One call site is now deliberately caller-less: `refreshGrowthBookAfterAuthChange` had this block as its only caller, and deleting the export would drop the guard-brace count its fixture pins from 6 to 5, so step 7e takes it with `initializeGrowthBook`'s two warm-up calls and moves that fixture. 4 files, +8/-335. tsc 0, twelve fixtures pass.""")

S = 'research/STATUS.md'
rep(S, "4 files, +10/-1,749; tsc exits 0; eleven fixtures pass.",
    "Wave D step 7d (`11e5a4c`) removes the leftovers that cut stranded: `utils/user.ts` keeps only `getGitEmail` (the core user record, its GrowthBook variant, the startup email prefetch, the cache reset and both types had no reader, 194 lines to 33), `main.tsx` loses that prefetch and the post-login reset — so the tree no longer spawns `git config --get user.email` at startup — and three exports step 7c orphaned go with them (`getRepoRemoteHash` plus `normalizeGitRemoteUrl` and `isLocalHost`, and `getLinuxDistroInfo` and `detectVcs`). `refreshGrowthBookAfterAuthChange` is left caller-less on purpose: deleting it would drop the guard count its fixture pins, so step 7e takes it with `initializeGrowthBook`'s two warm-up calls. 4 files, +8/-335; tsc exits 0; twelve fixtures pass.")

F = 'research/FEATURES.md'
rep(F, "Next: `utils/user.ts`'s getUserForGrowthBook + CoreUserData + getCoreUserData chain, `main.tsx`'s initUser/resetUserCache pair, and the three exports step 7c orphaned (getRepoRemoteHash, getLinuxDistroInfo, detectVcs). [W65](ports/W65-account-network.md). |",
    "Wave D step 7d removed the leftovers that cut stranded: `utils/user.ts` is down to its one live export (`getGitEmail`, since the core user record, its GrowthBook variant, the startup email prefetch, the cache reset and both types had no reader), `main.tsx` no longer prefetches the git email at startup or resets the user cache after login, and three exports went with them (`getRepoRemoteHash` with `normalizeGitRemoteUrl` and `isLocalHost`, plus `getLinuxDistroInfo` and `detectVcs`). Next: the growthbook warm-up surface — `refreshGrowthBookAfterAuthChange`'s now caller-less export, `initializeGrowthBook`'s two `void` warm-up calls, and the `tengu_harbor` gate call inside interactiveHelpers' dead KAIROS block. [W65](ports/W65-account-network.md). |")

print('record ok')
