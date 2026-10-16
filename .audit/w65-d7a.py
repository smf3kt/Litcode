import os
import shutil

B = '/Users/mant1ssa/Projects/cc-base-2188/'
Q = '/Users/mant1ssa/Projects/cc_reverse/.audit/w65-d7-baks/'


def rd(p):
    return open(B + p, encoding='utf-8').read()


def wr(p, t):
    open(B + p, 'w', encoding='utf-8').write(t)


def cut(p, old, new=''):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:80], n)
    wr(p, t.replace(old, new))


def cut_range(p, start, end, new=''):
    t = rd(p)
    i = t.index(start)
    j = t.index(end, i) + len(end)
    wr(p, t[:i] + new + t[j:])


# ---- 1. baks first ----
for rel in [
    'services/analytics/datadog.ts.w54bak',
    'services/analytics/firstPartyEventLoggingExporter.ts.w54bak',
    'services/analytics/firstPartyEventLogger.ts.w54bak',
    'services/analytics/sink.ts.w54bak',
]:
    src = B + rel
    if os.path.exists(src):
        dst = Q + rel
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        assert open(src, 'rb').read() == open(dst, 'rb').read(), rel
        print('quarantined', rel)

# ---- 2. the transports and the two modules that only existed to feed them ----
for rel in [
    'services/analytics/datadog.ts',
    'services/analytics/firstPartyEventLoggingExporter.ts',
    'services/analytics/firstPartyEventLogger.ts',
    'services/analytics/sink.ts',
    'services/analytics/sinkKillswitch.ts',
]:
    os.remove(B + rel)

# ---- 3. index.ts becomes an inert local API ----
wr('services/analytics/index.ts', '''/**
 * Analytics service — public API for event logging
 *
 * The two backends this module used to fan out to are gone: Datadog (a
 * third-party log intake at http-intake.logs.us5.datadoghq.com) and first-party
 * event logging (an OpenTelemetry batch exporter POSTing to
 * api.anthropic.com/api/event_logging/batch). Both were outbound telemetry with
 * no local function, so the queue, the sink interface and the attach/drain
 * machinery went with them.
 *
 * What stays is the call-site contract: roughly 230 files call logEvent, and
 * they keep compiling and keep their metadata types. The calls are no-ops.
 */

/**
 * Marker type for verifying analytics metadata doesn't contain sensitive data
 *
 * This type forces explicit verification that string values being logged
 * don't contain code snippets, file paths, or other sensitive information.
 *
 * Usage: `myString as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS`
 */
export type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS = never

/**
 * Marker type for values that used to be routed to PII-tagged proto columns via
 * `_PROTO_*` payload keys. Retained as a call-site type only: the exporter that
 * destructured those keys is gone, so no payload leaves the process.
 */
export type AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED = never

// Internal type for logEvent metadata
type LogEventMetadata = { [key: string]: boolean | number | undefined }

/**
 * Log an event to analytics backends (synchronous).
 *
 * No backends remain. Kept as a no-op so call sites stay readable and the
 * metadata types keep doing their job at the boundary.
 */
export function logEvent(
  _eventName: string,
  // intentionally no strings unless AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
  _metadata: LogEventMetadata,
): void {}

/**
 * Log an event to analytics backends (asynchronous).
 *
 * No backends remain; see logEvent.
 */
export async function logEventAsync(
  _eventName: string,
  _metadata: LogEventMetadata,
): Promise<void> {}
''')

# ---- 4. the attachers ----
cut('utils/sinks.ts', """import { initializeAnalyticsSink } from '../services/analytics/sink.js'
import { initializeErrorLogSink } from './errorLogSink.js'

/**
 * Attach error log and analytics sinks, draining any events queued before
 * attachment. Both inits are idempotent. Called from setup() for the default
 * command; other entrypoints (subcommands, daemon, bridge) call this directly
 * since they bypass setup().
 *
 * Leaf module — kept out of setup.ts to avoid the setup → commands → bridge
 * → setup import cycle.
 */
export function initSinks(): void {
  initializeErrorLogSink()
  initializeAnalyticsSink()
}
""", """import { initializeErrorLogSink } from './errorLogSink.js'

/**
 * Attach the error log sink. Idempotent. Called from setup() for the default
 * command; other entrypoints (subcommands, daemon, bridge) call this directly
 * since they bypass setup().
 *
 * The analytics sink used to attach here too; it went with the two backends it
 * fanned out to.
 *
 * Leaf module — kept out of setup.ts to avoid the setup → commands → bridge
 * → setup import cycle.
 */
export function initSinks(): void {
  initializeErrorLogSink()
}
""")
cut('main.tsx', "import { initializeAnalyticsGates } from 'src/services/analytics/sink.js'\n")
cut('main.tsx', """  // Analytics and feature flag initialization
  void initializeAnalyticsGates()
  void prefetchOfficialMcpUrls()
""", """  void prefetchOfficialMcpUrls()
""")

# ---- 5. the deferred 1P logger init in entrypoints/init.ts ----
cut('entrypoints/init.ts', "\n// initialize1PEventLogging is dynamically imported to defer OpenTelemetry sdk-logs/resources\n")
cut_range(
    'entrypoints/init.ts',
    "    // Initialize 1P event logging (no security concerns, but deferred to avoid\n",
    "    profileCheckpoint('init_after_1p_event_logging')\n\n",
)

# ---- 6. the shutdown flush ----
cut('utils/gracefulShutdown.ts', "import { shutdownDatadog } from '../services/analytics/datadog.js'\n")
cut('utils/gracefulShutdown.ts', "import { shutdown1PEventLogging } from '../services/analytics/firstPartyEventLogger.js'\n")
cut('utils/gracefulShutdown.ts', """  // Flush analytics — capped at 500ms. Previously unbounded: the 1P exporter
  // awaits all pending axios POSTs (10s each), eating the full failsafe budget.
  // Lost analytics on slow networks are acceptable; a hanging exit is not.
  try {
    await Promise.race([
      Promise.all([shutdown1PEventLogging(), shutdownDatadog()]),
      sleep(500),
    ])
  } catch {
    // Ignore analytics shutdown errors
  }

""")

# ---- 7. growthbook: the enable switch depended on the deleted 1P logger ----
G = 'services/analytics/growthbook.ts'
cut(G, """import {
  is1PEventLoggingEnabled,
  logGrowthBookExperimentTo1P,
} from './firstPartyEventLogger.js'
""")
cut(G, """function isGrowthBookEnabled(): boolean {
  // GrowthBook depends on 1P event logging.
  return is1PEventLoggingEnabled()
}
""", """function isGrowthBookEnabled(): boolean {
  // The source's own gate was `is1PEventLoggingEnabled()`. That logger and its
  // exporter were the account-side telemetry transport and are gone, so the
  // remote-eval client this switch guards can no longer be constructed — every
  // getFeatureValue/getDynamicConfig read therefore answers with its caller's
  // default, which is the documented no-init behaviour.
  return false
}
""")
cut(G, """  const expData = experimentDataByFeature.get(feature)
  if (expData) {
    loggedExposures.add(feature)
    logGrowthBookExperimentTo1P({
      experimentId: expData.experimentId,
      variationId: expData.variationId,
      userAttributes: getUserAttributes(),
      experimentMetadata: {
        feature_id: feature,
      },
    })
  }
""", """  const expData = experimentDataByFeature.get(feature)
  if (expData) {
    // Exposure used to be shipped to the 1P column here. The transport is gone;
    // the local dedup set is kept because it also backs the refresh listeners.
    loggedExposures.add(feature)
  }
""")

# ---- 8. analytics/config.ts no longer describes backends that are gone ----
cut('services/analytics/config.ts', """/**
 * Shared analytics configuration
 *
 * Common logic for determining when analytics should be disabled
 * across all analytics systems (Datadog, 1P)
 */""", """/**
 * Shared analytics configuration
 *
 * The transports this used to gate (Datadog, 1P) are gone; `isAnalyticsDisabled`
 * survives because two live callers read it for their own opt-out decisions —
 * main.tsx's startup path and utils/api.ts — and because it is the tree's single
 * expression of the privacy-level rules.
 */""")

print('d7a ok')
