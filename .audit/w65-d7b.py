# -*- coding: utf-8 -*-
"""Wave D step 7b: collapse the GrowthBook fetch machinery.

The file is rebuilt as: new imports, then the surviving source blocks extracted
verbatim by anchor pair (so every surviving body stays byte-exact), then the
rewritten read functions. Nothing surviving is retyped.
"""
B = '/Users/mant1ssa/Projects/cc-base-2188/'
G = 'services/analytics/growthbook.ts'

T = open(B + G, encoding='utf-8').read()


def region(a, b):
    i = T.index(a)
    j = T.index(b, i + len(a))
    return T[i:j]


def cut(t, old, new=''):
    n = t.count(old)
    assert n == 1, (old[:80], n)
    return t.replace(old, new)


# ---------------------------------------------------------------- blocks ----
listeners = region('// Listeners notified when', '/**\n * Parse env var overrides')
listeners = cut(listeners, """  let subscribed = true
  const unsubscribe = refreshed.subscribe(() => callSafe(listener))
  if (remoteEvalFeatureValues.size > 0) {
    queueMicrotask(() => {
      // Re-check: listener may have been removed, or resetGrowthBook may have
      // cleared the Map, between registration and this microtask running.
      if (subscribed && remoteEvalFeatureValues.size > 0) {
        callSafe(listener)
      }
    })
  }
  return () => {
    subscribed = false
    unsubscribe()
  }
""", """  // The catch-up microtask that used to sit here fired when the init callback
  // had already populated remoteEvalFeatureValues before the listener
  // registered. Nothing populates that map now, so registration is the whole
  // function.
  return refreshed.subscribe(() => callSafe(listener))
""")
listeners = cut(listeners, """ * If init has already completed with features by the time this is called
 * (remoteEvalFeatureValues is populated), the listener fires once on the
 * next microtask. This catch-up handles the race where GB's network response
 * lands before the REPL's useEffect commits — on external builds with fast
 * networks and MCP-heavy configs, init can finish in ~100ms while REPL mount
 * takes ~600ms (see #20951 external-build trace at 30.540 vs 31.046).
 *
 * Change detection is on the subscriber: the callback fires on every refresh;
 * use isEqual against your last-seen config to decide whether to act.
""", """ * Change detection is on the subscriber: the callback fires on every refresh;
 * use isEqual against your last-seen config to decide whether to act.
""")

env_overrides = region('/**\n * Parse env var overrides', '/**\n * Local config overrides set via /config Gates tab')

config_overrides = region('/**\n * Local config overrides set via /config Gates tab',
                          '/**\n * Log experiment exposure for a feature')
config_overrides = cut(config_overrides, """/**
 * Enumerate all known GrowthBook features and their current resolved values
 * (not including overrides). In-memory payload first, disk cache fallback —
 * same priority as the getters. Used by the /config Gates tab.
 */
export function getAllGrowthBookFeatures(): Record<string, unknown> {
  if (remoteEvalFeatureValues.size > 0) {
    return Object.fromEntries(remoteEvalFeatureValues)
  }
  return getGlobalConfig().cachedGrowthBookFeatures ?? {}
}

""")

switch = region('/**\n * Check if GrowthBook operations should be enabled', '/**\n * Hostname of ANTHROPIC_BASE_URL')

deprecated = region('/**\n * @deprecated Use getFeatureValue_CACHED_MAY_BE_STALE instead', '/**\n * Get a feature value from disk cache immediately')
with_refresh = region('/**\n * @deprecated Disk cache is now synced on every successful payload load',
                      '/**\n * Check a Statsig feature gate value via GrowthBook')
dynamic = region('// ============================================================================\n// Dynamic Config Functions', None) if False else region(
    '// ============================================================================\n// Dynamic Config Functions', '\x00') if False else T[T.index('// ============================================================================\n// Dynamic Config Functions'):]

# --------------------------------------------------------------- the file ----
out = '''/**
 * GrowthBook feature-flag reads.
 *
 * The source's client was a remote-eval GrowthBook client: it was constructed
 * with auth headers and the user's attributes, fetched a pre-evaluated feature
 * payload from api.anthropic.com, cached the answers in memory and on disk, and
 * re-fetched every 6 hours (20 minutes for ants). Its enable switch was
 * `is1PEventLoggingEnabled()` — the account-side telemetry transport that went
 * in step 7a — so the client can no longer be constructed and every read
 * answers with the value the source's own `!isGrowthBookEnabled()` arm returns.
 *
 * What remains is the local half, which is what this module is now for:
 *
 *   - the env-var override channel (`CLAUDE_INTERNAL_FC_OVERRIDES`), and
 *   - the local config override channel (`growthBookOverrides` in ~/.claude.json).
 *
 * Both are consulted before the switch, exactly as in the source, so a locally
 * pinned flag value still takes effect. Everything downstream of the switch —
 * the client, the payload transform, the exposure log, the disk cache and the
 * periodic refresh — is gone with the transport.
 */

import { type GrowthBook } from '@growthbook/growthbook'
import { isEqual } from 'lodash-es'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { logForDebugging } from '../../utils/debug.js'
import { logError } from '../../utils/log.js'
import { createSignal } from '../../utils/signal.js'

'''

out += listeners
out += env_overrides
out += config_overrides
out += switch
out += '''/**
 * Initialize the GrowthBook client (blocks until ready).
 *
 * The source built the client here and awaited its init. That client could only
 * be constructed while `isGrowthBookEnabled()` was true, so the source's own
 * `if (!clientWrapper) return null` arm is what runs. Kept as an exported no-op
 * because three call sites await it purely as a warm-up.
 */
export async function initializeGrowthBook(): Promise<GrowthBook | null> {
  return null
}

/**
 * Get a feature value with a default fallback - blocks until initialized.
 * @internal Used by both deprecated and cached functions.
 */
async function getFeatureValueInternal<T>(
  feature: string,
  defaultValue: T,
  _logExposure: boolean,
): Promise<T> {
  // Check env var overrides first (for eval harnesses)
  const overrides = getEnvOverrides()
  if (overrides && feature in overrides) {
    return overrides[feature] as T
  }
  const configOverrides = getConfigOverrides()
  if (configOverrides && feature in configOverrides) {
    return configOverrides[feature] as T
  }

  // The source then awaited the client and read its pre-evaluated value (or the
  // SDK's own getFeatureValue), logging an experiment exposure. Both needed the
  // remote-eval client; the switch below is the source's own guard for that.
  if (!isGrowthBookEnabled()) {
    return defaultValue
  }
  return defaultValue
}

'''
out += deprecated
out += '''/**
 * Get a feature value from local overrides, else the caller's default.
 *
 * The source read a disk cache here that `syncRemoteEvalToDisk` had written
 * from the last successful remote-eval payload. That cache is a stale copy of
 * server state rather than local configuration, and it sat *below* the
 * `!isGrowthBookEnabled()` guard the source returns its default from — so
 * honouring it would mean moving the guard, which is the one thing this port
 * may not do. The local override channels are the surviving input.
 */
export function getFeatureValue_CACHED_MAY_BE_STALE<T>(
  feature: string,
  defaultValue: T,
): T {
  // Check env var overrides first (for eval harnesses)
  const overrides = getEnvOverrides()
  if (overrides && feature in overrides) {
    return overrides[feature] as T
  }
  const configOverrides = getConfigOverrides()
  if (configOverrides && feature in configOverrides) {
    return configOverrides[feature] as T
  }

  if (!isGrowthBookEnabled()) {
    return defaultValue
  }
  return defaultValue
}

'''
out += with_refresh
out += '''/**
 * Check a feature gate value, with the local override channels only.
 *
 * **MIGRATION ONLY** in the source, where the tail fell back to the Statsig
 * gate cache and then to the GrowthBook disk cache. Both were populated by the
 * removed flag service; the source's `!isGrowthBookEnabled()` arm — false — is
 * what a caller sees now.
 *
 * @deprecated Use getFeatureValue_CACHED_MAY_BE_STALE() for new code. This
 * function exists only to support migration of existing Statsig gates.
 */
export function checkStatsigFeatureGate_CACHED_MAY_BE_STALE(
  gate: string,
): boolean {
  // Check env var overrides first (for eval harnesses)
  const overrides = getEnvOverrides()
  if (overrides && gate in overrides) {
    return Boolean(overrides[gate])
  }
  const configOverrides = getConfigOverrides()
  if (configOverrides && gate in configOverrides) {
    return Boolean(configOverrides[gate])
  }

  if (!isGrowthBookEnabled()) {
    return false
  }
  return false
}

/**
 * Check a security restriction gate.
 *
 * The source awaited any in-flight re-initialization and then read the Statsig
 * cache before the GrowthBook one, so that a gate turned on for a previous
 * logged-in session was still honoured. There is no re-initialization and no
 * cache; the override channels and the switch's own arm are what is left.
 */
export async function checkSecurityRestrictionGate(
  gate: string,
): Promise<boolean> {
  // Check env var overrides first (for eval harnesses)
  const overrides = getEnvOverrides()
  if (overrides && gate in overrides) {
    return Boolean(overrides[gate])
  }
  const configOverrides = getConfigOverrides()
  if (configOverrides && gate in configOverrides) {
    return Boolean(configOverrides[gate])
  }

  if (!isGrowthBookEnabled()) {
    return false
  }
  return false
}

/**
 * Check a boolean entitlement gate with fallback-to-blocking semantics.
 *
 * The source's fast path trusted a disk-cached `true` and its slow path awaited
 * a fresh fetch (max ~5s). Both read the removed client's cache; with no client
 * there is no `true` to trust, and the switch's arm below is false.
 *
 * Use for user-invoked features (e.g. /remote-control) that are gated on
 * subscription/org, where a stale `false` would unfairly block access but a
 * stale `true` is acceptable (the server is the real gatekeeper).
 */
export async function checkGate_CACHED_OR_BLOCKING(
  gate: string,
): Promise<boolean> {
  // Check env var overrides first (for eval harnesses)
  const overrides = getEnvOverrides()
  if (overrides && gate in overrides) {
    return Boolean(overrides[gate])
  }
  const configOverrides = getConfigOverrides()
  if (configOverrides && gate in configOverrides) {
    return Boolean(configOverrides[gate])
  }

  if (!isGrowthBookEnabled()) {
    return false
  }

  // Slow path: disk said false/missing — may be stale, fetch fresh
  return getFeatureValueInternal(gate, false, true)
}

/**
 * Refresh feature values after auth changes (login/logout).
 *
 * The source destroyed and re-created the client here, because GrowthBook's
 * apiHostRequestHeaders cannot be updated after creation, and emitted a refresh
 * so subscribers re-read. There is no client to rebuild, and the switch the
 * body checked first is false, so the guard is the whole function.
 */
export function refreshGrowthBookAfterAuthChange(): void {
  if (!isGrowthBookEnabled()) {
    return
  }
}

/**
 * Reset GrowthBook state (primarily for testing).
 *
 * The source also stopped the periodic refresh, removed the client's process
 * handlers, destroyed the client and cleared the remote-eval maps. What remains
 * is the memoized env-var parse, which is the one piece of state a reset still
 * has to drop.
 */
export function resetGrowthBook(): void {
  envOverrides = null
  envOverridesParsed = false
}

'''
out += dynamic

open(B + G, 'w', encoding='utf-8').write(out)
print('lines:', len(out.split('\n')))
