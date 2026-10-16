# -*- coding: utf-8 -*-
"""Wave D step 7b, comment pass: the surviving bodies name a fetch that is gone.

Each cut here is prose only — no behaviour. The bodies were extracted verbatim
from the source, so the comments that described the removed mechanism came with
them and have to be corrected to describe what the module does now.
"""
B = '/Users/mant1ssa/Projects/cc-base-2188/'
G = 'services/analytics/growthbook.ts'


def cut(old, new=''):
    t = open(B + G, encoding='utf-8').read()
    n = t.count(old)
    assert n == 1, (old[:80], n)
    open(B + G, 'w', encoding='utf-8').write(t.replace(old, new))


# 1. the header gains the note about why each read carries two returns
cut(""" * Both are consulted before the switch, exactly as in the source, so a locally
 * pinned flag value still takes effect. Everything downstream of the switch —
 * the client, the payload transform, the exposure log, the disk cache and the
 * periodic refresh — is gone with the transport.
 */""", """ * Both are consulted before the switch, exactly as in the source, so a locally
 * pinned flag value still takes effect. Everything downstream of the switch —
 * the client, the payload transform, the exposure log, the disk cache and the
 * periodic refresh — is gone with the transport.
 *
 * Every read below therefore keeps the source's `if (!isGrowthBookEnabled())`
 * line as its visible boundary and then returns the same value again. The
 * duplicate is not decoration: the switch is typed `boolean` rather than the
 * literal `false`, so the compiler still wants a return on the fall-through
 * path, and narrowing the type would turn the guard itself into a TS7027
 * unreachable-code error.
 */""")

# 2. the refresh signal
cut("""// Listeners notified when GrowthBook feature values refresh (initial init or
// periodic refresh). Use for systems that bake feature values into long-lived
// objects at construction time and need to rebuild when config changes.
//
// The 1P event logger that used to be the main subscriber is gone; the skill
// watcher (hooks/useSkillsChange.ts) is what remains.
//
// NOT cleared by resetGrowthBook — subscribers register once (typically in
// init.ts) and must survive auth-change resets.""",
    """// Listeners notified when a local GrowthBook override is written. Use for
// systems that bake feature values into long-lived objects at construction time
// and need to rebuild when config changes.
//
// The initial init and the periodic refresh that used to emit this are gone
// with the client; setGrowthBookConfigOverride and clearGrowthBookConfigOverrides
// are the emitters now. The 1P event logger that used to be the main subscriber
// is gone too; the skill watcher (hooks/useSkillsChange.ts) and the main-loop
// model hook are what remain.
//
// NOT cleared by resetGrowthBook — subscribers register once (typically in
// init.ts) and must survive auth-change resets.""")

# 3. the env-var channel
cut(""" * Parse env var overrides for GrowthBook features.
 * Set CLAUDE_INTERNAL_FC_OVERRIDES to a JSON object mapping feature keys to values
 * to bypass remote eval and disk cache. Useful for eval harnesses that need to
 * test specific feature flag configurations. Only active when USER_TYPE is 'ant'.""",
    """ * Parse env var overrides for GrowthBook features.
 * Set CLAUDE_INTERNAL_FC_OVERRIDES to a JSON object mapping feature keys to values
 * to answer with instead of the caller's default. Useful for eval harnesses that
 * need to test specific feature flag configurations. Only active when USER_TYPE
 * is 'ant'.""")

cut(""" * Check if a feature has an env-var override (CLAUDE_INTERNAL_FC_OVERRIDES).
 * When true, _CACHED_MAY_BE_STALE will return the override without touching
 * disk or network — callers can skip awaiting init for that feature.""",
    """ * Check if a feature has an env-var override (CLAUDE_INTERNAL_FC_OVERRIDES).
 * When true, _CACHED_MAY_BE_STALE answers with the override.""")

# 4. the config-override channel
cut(""" * Local config overrides set via /config Gates tab (ant-only). Checked after
 * env-var overrides — env wins so eval harnesses remain deterministic. Unlike
 * getEnvOverrides this is not memoized: the user can change overrides at
 * runtime, and getGlobalConfig() is already memory-cached (pointer-chase)
 * until the next saveGlobalConfig() invalidates it.""",
    """ * Local config overrides (ant-only). Checked after env-var overrides — env
 * wins so eval harnesses remain deterministic. Unlike getEnvOverrides this is
 * not memoized: the user can change overrides at runtime, and getGlobalConfig()
 * is already memory-cached (pointer-chase) until the next saveGlobalConfig()
 * invalidates it.""")

cut("""    // getGlobalConfig() throws before configReadingAllowed is set (early
    // main.tsx startup path). Same degrade as the disk-cache fallback below.
    return undefined""",
    """    // getGlobalConfig() throws before configReadingAllowed is set (early
    // main.tsx startup path).
    return undefined""")

cut(""" * Set or clear a single config override. Pass undefined to clear.
 * Fires onGrowthBookRefresh listeners so systems that bake gate values into
 * long-lived objects (useMainLoopModel, useSkillsChange, etc.) rebuild —
 * otherwise overriding e.g. tengu_ant_model_override wouldn't actually
 * change the model until the next periodic refresh.
 */""",
    """ * Set or clear a single config override. Pass undefined to clear.
 * Fires onGrowthBookRefresh listeners so systems that bake gate values into
 * long-lived objects (useMainLoopModel, useSkillsChange, etc.) rebuild —
 * otherwise overriding e.g. tengu_ant_model_override wouldn't actually change
 * the model at all.
 */""")

# 5. the read functions' doc lines
cut(""" * Get a feature value with a default fallback - blocks until initialized.
 * @internal Used by both deprecated and cached functions.""",
    """ * Get a feature value with a default fallback.
 * @internal Used by both deprecated and cached functions.""")

cut("""/**
 * @deprecated Disk cache is now synced on every successful payload load
 * (init + 20min/6h periodic refresh). The per-feature TTL never fetched
 * fresh data from the server — it only re-wrote in-memory state to disk,
 * which is now redundant. Use getFeatureValue_CACHED_MAY_BE_STALE directly.
 */""",
    """/**
 * @deprecated The source's per-feature TTL only re-wrote in-memory state to the
 * disk cache rather than fetching anything. Both the cache and the TTL are gone;
 * use getFeatureValue_CACHED_MAY_BE_STALE directly.
 */""")

cut(""" * Get a dynamic config value - blocks until GrowthBook is initialized.
 * Prefer getFeatureValue_CACHED_MAY_BE_STALE for startup-critical paths.""",
    """ * Get a dynamic config value.
 * Prefer getFeatureValue_CACHED_MAY_BE_STALE for startup-critical paths.""")

cut(""" * Get a dynamic config value from disk cache immediately. Pure read — see
 * getFeatureValue_CACHED_MAY_BE_STALE.""",
    """ * Get a dynamic config value immediately. Pure read — see
 * getFeatureValue_CACHED_MAY_BE_STALE.""")

print('d7e ok')
