# -*- coding: utf-8 -*-
"""Two repairs the earlier record scripts left behind, then step 7d's rows.

Repair 1: CURRENT's 7c paragraph was appended to an anchor that ended with the
last line of the previous paragraph, so it landed on the same line as the
"See [W65]" link instead of a paragraph above it.
Repair 2: STATUS's step-7a insertion replaced step 6's "(2 files, +1/-157; tsc
exits 0)." sentence and left a double space. Both are prose defects in a
committed record, so they are fixed here rather than left for a later reader.
"""
def rd(p): return open(p, encoding='utf-8').read()
def wr(p, t): open(p, 'w', encoding='utf-8').write(t)
def rep(p, old, new):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:70], n)
    wr(p, t.replace(old, new))

C = 'research/CURRENT.md'
rep(C, "tsc 0, eleven fixtures pass.See [W65](ports/W65-account-network.md).",
    "tsc 0, eleven fixtures pass.\n\nSee [W65](ports/W65-account-network.md).")

S = 'research/STATUS.md'
rep(S, "since it warms the inference host's pool  Wave D step 7a (`18fbacc`)",
    "since it warms the inference host's pool (2 files, +1/-157; tsc exits 0). Wave D step 7a (`18fbacc`)")

C_ANCHOR = """the 1P payload. 4 files, +10/-1,749. tsc 0, eleven fixtures pass.

See [W65](ports/W65-account-network.md)."""
rep(C, C_ANCHOR, """the 1P payload. 4 files, +10/-1,749. tsc 0, eleven fixtures pass.

Wave D step 7d (`11e5a4c`): the leftovers the analytics removal stranded. `utils/user.ts` (194 lines to 33) keeps only `getGitEmail`, the one export with a live caller — the core user record, its GrowthBook variant, the startup email prefetch, the cache reset and both types behind them had no reader left. `main.tsx` loses that prefetch and the post-login reset, so the tree no longer spawns `git config --get user.email` at startup, and the `if (onboardingShown)` block that ordered the reset before the GrowthBook refresh is gone rather than left as a no-op call. Three exports step 7c orphaned in modules that keep other live exports also went: `getRepoRemoteHash` with its only caller `normalizeGitRemoteUrl` and that function's only helper `isLocalHost` (taking the crypto import), and `getLinuxDistroInfo` and `detectVcs` (taking the fs and os imports). One call site is now deliberately caller-less: `refreshGrowthBookAfterAuthChange` had that block as its only caller, and deleting the export would drop the guard-brace count its fixture pins from 6 to 5, so step 7e takes it with `initializeGrowthBook`'s two warm-up calls and moves that fixture. 4 files, +8/-335. tsc 0, twelve fixtures pass.

See [W65](ports/W65-account-network.md).""")

rep(S, "4 files, +10/-1,749; tsc exits 0; eleven fixtures pass.",
    "Wave D step 7d (`11e5a4c`) removes the leftovers that cut stranded: `utils/user.ts` keeps only `getGitEmail` (the core user record, its GrowthBook variant, the startup email prefetch, the cache reset and both types had no reader, 194 lines to 33), `main.tsx` loses that prefetch and the post-login reset — so the tree no longer spawns `git config --get user.email` at startup — and three exports step 7c orphaned go with them (`getRepoRemoteHash` plus `normalizeGitRemoteUrl` and `isLocalHost`, and `getLinuxDistroInfo` and `detectVcs`). `refreshGrowthBookAfterAuthChange` is left caller-less on purpose: deleting it would drop the guard count its fixture pins, so step 7e takes it with `initializeGrowthBook`'s two warm-up calls. 4 files, +8/-335; tsc exits 0; twelve fixtures pass.")

F = 'research/FEATURES.md'
rep(F, "Next: `utils/user.ts`'s getUserForGrowthBook + CoreUserData + getCoreUserData chain, `main.tsx`'s initUser/resetUserCache pair, and the three exports step 7c orphaned (getRepoRemoteHash, getLinuxDistroInfo, detectVcs). [W65](ports/W65-account-network.md). |",
    "Wave D step 7d removed the leftovers that cut stranded: `utils/user.ts` is down to its one live export (`getGitEmail`, since the core user record, its GrowthBook variant, the startup email prefetch, the cache reset and both types had no reader), `main.tsx` no longer prefetches the git email at startup or resets the user cache after login, and three exports went with them (`getRepoRemoteHash` with `normalizeGitRemoteUrl` and `isLocalHost`, plus `getLinuxDistroInfo` and `detectVcs`). Next: the growthbook warm-up surface — `refreshGrowthBookAfterAuthChange`'s now caller-less export, `initializeGrowthBook`'s two `void` warm-up calls, and the `tengu_harbor` gate call inside interactiveHelpers' dead KAIROS block. [W65](ports/W65-account-network.md). |")

print('record ok')
