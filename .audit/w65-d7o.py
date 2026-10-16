# -*- coding: utf-8 -*-
"""Wave D step 7e research record: four files, one commit."""
def rd(p): return open(p, encoding='utf-8').read()
def wr(p, t): open(p, 'w', encoding='utf-8').write(t)
def rep(p, old, new):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:70], n)
    wr(p, t.replace(old, new))

W = 'research/ports/W65-account-network.md'
rep(W, "## Protocol slip (recorded)\n", """## Wave D step 7e — the GrowthBook warm-up surface (landed, `0e225a4`)

Three exports and two call sites existed only to warm up, reset and refresh a client that cannot be constructed. Each had already lost every local effect: `initializeGrowthBook`'s body was `return null` (step 7b collapsed it to the source's own disabled-switch arm), `resetGrowthBook`'s only remaining work was clearing the memoized parse of `CLAUDE_INTERNAL_FC_OVERRIDES` that nothing re-read, and `refreshGrowthBookAfterAuthChange` emitted a refresh no write could have changed. Step 7d removed the last caller of the third and deliberately left the export so this step could take it together with the fixture it moves. 3 files, +12/−63. **Behaviour change: none** — every removed export was a no-op under the false switch.

Both call sites were warm-ups: `interactiveHelpers.tsx`'s after-trust block and `print.ts`'s headless entry. The trust block keeps `setSessionTrustAccepted(true)` and the `getSystemContext` prefetch; `print.ts` keeps both profiler calls that surrounded it. Two comments went with them: the header note about `resetGrowthBook` not clearing the listener set, and the trust-block comment that awaited "the same memoized `initializeGrowthBook` promise fired earlier".

### What was deliberately not taken

`checkGate_CACHED_OR_BLOCKING` keeps its export because it keeps a caller — inside `interactiveHelpers.tsx`'s `KAIROS_CHANNELS` dev-channels block. That block is dead by constant folding, but removing it is a package of its own rather than a tail of this one: **54 files read `KAIROS` or `KAIROS_CHANNELS`, 124 times between them.** The two cannot be separated without straddling a package boundary, so the gate function waits for that package (step 7f).

With the `type GrowthBook` import gone, `@growthbook/growthbook` now has **zero importers** in the tree. It is not removed from `package.json` here: the lockfile is generated, and hand-editing one package out of it is a worse risk than carrying the entry until a dependency-pruning pass does the whole set. That pass is named in the remaining-waves list below.

### Verification

The 7b fixture's guard-brace count moved from 6 to 5 in this commit, exactly as step 7d's record predicted it would have to — the third amendment to a per-step fixture this wave, and the reason the note was written where the next package would read it rather than only in this section. tsc 0, thirteen fixtures pass, `git diff --check` clean, the orphan scan unchanged at its ten legitimate entries.

**Next (step 7f):** the `KAIROS` / `KAIROS_CHANNELS` cluster — 54 files, 124 flag reads, including `interactiveHelpers`' dev-channels dialog block and, with it, `checkGate_CACHED_OR_BLOCKING` and its import.

## Protocol slip (recorded)
""")

C = 'research/CURRENT.md'
anchor = "4 files, +8/-335. tsc 0, twelve fixtures pass.\n"
rep(C, anchor, anchor + """

Wave D step 7e (`0e225a4`): the GrowthBook warm-up surface is gone. `initializeGrowthBook` (body `return null` since step 7b), `resetGrowthBook` (its only remaining work cleared an env-var parse memo nothing re-read) and `refreshGrowthBookAfterAuthChange` (emitted a refresh no write could have changed) are removed, along with the two warm-up call sites — `interactiveHelpers.tsx`'s after-trust block leaves `setSessionTrustAccepted` and the `getSystemContext` prefetch, and `print.ts` keeps both profiler calls around it. No behaviour change: all three were no-ops under the false switch. `checkGate_CACHED_OR_BLOCKING` is deliberately kept — its one caller sits in interactiveHelpers' KAIROS_CHANNELS dev-channels block, which is dead by constant folding but is a package of its own (54 files, 124 flag reads). With the type import gone, `@growthbook/growthbook` has zero importers; it is not pruned from package.json here, because the lockfile is generated and that belongs to a dependency-pruning pass. The 7b fixture's guard count moved 6 → 5 in this commit, as step 7d's record said it would. 3 files, +12/-63. tsc 0, thirteen fixtures pass.""")

S = 'research/STATUS.md'
rep(S, "4 files, +8/-335; tsc exits 0; twelve fixtures pass.",
    "Wave D step 7e (`0e225a4`) removes the GrowthBook warm-up surface: `initializeGrowthBook`, `resetGrowthBook` and `refreshGrowthBookAfterAuthChange` had no local effect left and go with their two call sites (`interactiveHelpers.tsx`'s after-trust block, which keeps the trust signal and the system-context prefetch, and `print.ts`'s headless entry). No behaviour change. `checkGate_CACHED_OR_BLOCKING` is kept because its one caller sits in the KAIROS_CHANNELS dev-channels block, which waits for its own package (54 files, 124 flag reads). `@growthbook/growthbook` now has zero importers; pruning it from package.json belongs to a dependency-pruning pass, since the lockfile is generated. The 7b fixture's guard count moved 6 to 5 in this commit. 3 files, +12/-63; tsc exits 0; thirteen fixtures pass.")

F = 'research/FEATURES.md'
rep(F, "Next: the growthbook warm-up surface — `refreshGrowthBookAfterAuthChange`'s now caller-less export, `initializeGrowthBook`'s two `void` warm-up calls, and the `tengu_harbor` gate call inside interactiveHelpers' dead KAIROS block. [W65](ports/W65-account-network.md). |",
    "Wave D step 7e removed the GrowthBook warm-up surface (initializeGrowthBook, resetGrowthBook and refreshGrowthBookAfterAuthChange, none of which had a local effect left, plus their two call sites; behaviour change none), leaving `checkGate_CACHED_OR_BLOCKING` for the package that owns its only caller. That exposed a new item: `@growthbook/growthbook` now has zero importers, and pruning it from package.json belongs to a dependency-pruning pass because the lockfile is generated. Next: the KAIROS / KAIROS_CHANNELS cluster — 54 files, 124 flag reads, including interactiveHelpers' dev-channels dialog and that gate call. [W65](ports/W65-account-network.md). |")

print('record ok')
