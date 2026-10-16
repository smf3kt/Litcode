# -*- coding: utf-8 -*-
"""Wave D step 7e, comment pass: three comments still name the removed entries."""
B = '/Users/mant1ssa/Projects/cc-base-2188/'


def cut(p, old, new=''):
    t = open(B + p, encoding='utf-8').read()
    n = t.count(old)
    assert n == 1, (p, old[:70], n)
    open(B + p, 'w', encoding='utf-8').write(t.replace(old, new))


G = 'services/analytics/growthbook.ts'
cut(G, """//
// NOT cleared by resetGrowthBook — subscribers register once (typically in
// init.ts) and must survive auth-change resets.
""", """//
// The listeners are never cleared: subscribers register once and hold their
// subscription for the life of the process.
""")
cut(G, """ * What remains is the local half, which is what this module is now for:
 *
 *   - the env-var override channel (`CLAUDE_INTERNAL_FC_OVERRIDES`), and
 *   - the local config override channel (`growthBookOverrides` in ~/.claude.json).
""", """ * What remains is the local half, which is what this module is now for:
 *
 *   - the env-var override channel (`CLAUDE_INTERNAL_FC_OVERRIDES`), and
 *   - the local config override channel (`growthBookOverrides` in ~/.claude.json).
 *
 * The entry points that went with the client — initializeGrowthBook,
 * resetGrowthBook and refreshGrowthBookAfterAuthChange — had no local effect
 * left: the first returned null, the second cleared a memo of an env-var parse,
 * and the third emitted a refresh for subscribers that no write could have
 * changed. Their two call sites were warm-ups and reset a client that cannot be
 * built.
""")

cut('interactiveHelpers.tsx', """    // checkGate_CACHED_OR_BLOCKING returns immediately if disk already says
    // true; only blocks on a cold/stale-false cache (awaits the same memoized
    // initializeGrowthBook promise fired earlier). Also warms the
    // isChannelsEnabled() check in the dev-channels dialog below.
""", """    // checkGate_CACHED_OR_BLOCKING returns immediately if the cache already says
    // true; only a cold or stale-false cache makes it wait. Also warms the
    // isChannelsEnabled() check in the dev-channels dialog below.
""")

print('d7n ok')
