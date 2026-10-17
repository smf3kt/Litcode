# -*- coding: utf-8 -*-
"""Wave D step 7q cut: the subscriber consumer surface.

Every remaining reader of the subscription predicates folds to the value the
predicate already produced (isAnthropicAuthEnabled() is `return false`), and
the predicates that lose their last reader are deleted. The two that the
claude.ai connector still reads (isClaudeAISubscriber, getOauthAccountInfo)
and isAnthropicAuthEnabled behind them stay for that package.
"""
import os
import sys

ROOT = '/Users/mant1ssa/Projects/cc-base-2188'
os.chdir(ROOT)


def rd(p): return open(p, encoding='utf-8').read()
def wr(p, t): open(p, 'w', encoding='utf-8').write(t)


def cut(p, old, new='', n=1):
    t = rd(p)
    got = t.count(old)
    assert got == n, (p, old[:90], got, n)
    wr(p, t.replace(old, new))


def cut_between(p, start, end, new=''):
    t = rd(p)
    assert t.count(start) == 1, (p, 'start', start[:90], t.count(start))
    assert t.count(end) == 1, (p, 'end', end[:90], t.count(end))
    i = t.index(start)
    j = t.index(end, i + len(start))
    wr(p, t[:i] + new + t[j:])


def rm(p):
    assert os.path.exists(p), p
    os.remove(p)


# ---------------------------------------------------------------- deleted units
rm('components/EffortCallout.tsx')
rm('migrations/resetProToOpusDefault.ts')
rm('migrations/migrateSonnet45ToSonnet46.ts')
# The tagged-id helper's only reader was the OAuth-account attribute block in
# telemetryAttributes.ts; the scan found it orphaned right after the cut.
rm('utils/taggedId.ts')

# ---------------------------------------------------------------- main.tsx
M = 'main.tsx'
cut(M, """  getSubscriptionType,
  prefetchAwsCredentialsAndBedRockInfoIfSafe,
""", """  prefetchAwsCredentialsAndBedRockInfoIfSafe,
""")
cut(M, "import { migrateSonnet45ToSonnet46 } from './migrations/migrateSonnet45ToSonnet46.js'\n")
cut(M, "import { resetProToOpusDefault } from './migrations/resetProToOpusDefault.js'\n")
cut(M, "    resetProToOpusDefault()\n")
cut(M, "    migrateSonnet45ToSonnet46()\n")
# The startup-telemetry payload's subscription field can only ever be null.
cut(M, """        subscriptionType:
          getSubscriptionType() as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
""")
cut(M, """      // Increment numStartups synchronously — first-render readers like
      // shouldShowEffortCallout (via useState initializer) need the updated
      // value before setImmediate fires. Defer only telemetry.
""", """      // Increment numStartups synchronously — first-render readers (the
      // logo's first-run check, via useState initializer) need the updated
      // value before setImmediate fires. Defer only telemetry.
""")

# ---------------------------------------------------------------- README of hosts
R = 'screens/REPL.tsx'
cut(R, """import {
  EffortCallout,
  shouldShowEffortCallout,
} from '../components/EffortCallout.js'
""")
cut(R, """  const [showEffortCallout, setShowEffortCallout] = useState(() =>
    shouldShowEffortCallout(mainLoopModel),
  )
""")
cut(R, "    | 'effort-callout'\n")
cut(R, """    // Effort callout (shown once for Opus 4.6 users when effort is enabled)
    if (allowDialogsWithAnimation && showEffortCallout) return 'effort-callout'

""")
cut(R, """                {focusedInputDialog === 'effort-callout' && (
                  <EffortCallout
                    model={mainLoopModel}
                    onDone={selection => {
                      setShowEffortCallout(false)
                      if (selection !== 'dismiss') {
                        setAppState(prev => ({
                          ...prev,
                          effortValue: selection,
                        }))
                      }
                    }}
                  />
                )}
""")

# ---------------------------------------------------------------- status.tsx
S = 'utils/status.tsx'
cut(S, "import chalk from 'chalk'\n")
cut(S, "import { getAccountInformation, isClaudeAISubscriber } from './auth.js'\n",
    "import { getAccountInformation } from './auth.js'\n")
cut(S, """import {
  getClaudeAiUserDefaultModelDescription,
  modelDisplayString,
} from './model/model.js'
""", "import { modelDisplayString } from './model/model.js'\n")
cut(S, """export function getModelDisplayLabel(mainLoopModel: string | null): string {
  let modelLabel = modelDisplayString(mainLoopModel)

  if (mainLoopModel === null && isClaudeAISubscriber()) {
    const description = getClaudeAiUserDefaultModelDescription()

    modelLabel = `${chalk.bold('Default')} ${description}`
  }

  return modelLabel
}
""", """export function getModelDisplayLabel(mainLoopModel: string | null): string {
  return modelDisplayString(mainLoopModel)
}
""")

# ---------------------------------------------------------------- statusNoticeDefinitions.tsx
N = 'utils/statusNoticeDefinitions.tsx'
cut(N, """const claudeAiSubscriberExternalTokenNotice: StatusNoticeDefinition = {
  id: 'claude-ai-external-token',
  type: 'warning',
  isActive: () => {
    const authTokenInfo = getAuthTokenSource()
    return (
      isClaudeAISubscriber() &&
      (authTokenInfo.source === 'ANTHROPIC_AUTH_TOKEN' ||
        authTokenInfo.source === 'apiKeyHelper')
    )
  },
  render: () => {
    const authTokenInfo = getAuthTokenSource()
    return (
      <Box flexDirection="row" marginTop={1}>
        <Text color="warning">{figures.warning}</Text>
        <Text color="warning">
          Auth conflict: Using {authTokenInfo.source} instead of Claude account
          subscription token. Either unset {authTokenInfo.source}, or run
          `claude /logout`.
        </Text>
      </Box>
    )
  },
}

""")
cut(N, "  claudeAiSubscriberExternalTokenNotice,\n")
cut(N, """  getAuthTokenSource,
  isClaudeAISubscriber,
} from './auth.js'
""", "  getAuthTokenSource,\n} from './auth.js'\n")

# ---------------------------------------------------------------- logoV2Utils.ts
L = 'utils/logoV2Utils.ts'
cut(L, "import { getSubscriptionName, isClaudeAISubscriber } from './auth.js'\n")
cut(L, """  const billingType = isClaudeAISubscriber()
    ? getSubscriptionName()
    : 'API Usage Billing'
""", "  const billingType = 'API Usage Billing'\n")

# ---------------------------------------------------------------- LogoV2.tsx
G = 'components/LogoV2/LogoV2.tsx'
cut(G, "  const username = getGlobalConfig().oauthAccount?.displayName ?? ''\n")
cut(G, "    let welcomeMessage = formatWelcomeMessage(username)\n",
    "    let welcomeMessage = formatWelcomeMessage('')\n")
cut(G, "  const welcomeMessage = formatWelcomeMessage(username)\n",
    "  const welcomeMessage = formatWelcomeMessage('')\n")
cut(G, """  const modelLine =
    !process.env.IS_DEMO && config.oauthAccount?.organizationName
      ? `${modelDisplayName} · ${billingType} · ${config.oauthAccount.organizationName}`
      : `${modelDisplayName} · ${billingType}`
""", "  const modelLine = `${modelDisplayName} · ${billingType}`\n")
cut(G, """          {!process.env.IS_DEMO && config.oauthAccount?.organizationName && (
              <Text dimColor>
                Message from {config.oauthAccount.organizationName}:
              </Text>
            )}
""")
cut(G, """          {!process.env.IS_DEMO && config.oauthAccount?.organizationName && (
            <Text dimColor>
              Message from {config.oauthAccount.organizationName}:
            </Text>
          )}
""")

# ---------------------------------------------------------------- buddy/companion.ts
C = 'buddy/companion.ts'
cut(C, "  return config.oauthAccount?.accountUuid ?? config.userID ?? 'anon'\n",
    "  return config.userID ?? 'anon'\n")

# ---------------------------------------------------------------- commands/cost/index.ts
K = 'commands/cost/index.ts'
cut(K, "import { isClaudeAISubscriber } from '../../utils/auth.js'\n")
cut(K, """  get isHidden() {
    // Keep visible for Ants even if they're subscribers (they see cost breakdowns)
    if (process.env.USER_TYPE === 'ant') {
      return false
    }
    return isClaudeAISubscriber()
  },
""")

# ---------------------------------------------------------------- commands.ts
D = 'commands.ts'
cut(D, "import { isUsing3PServices, isClaudeAISubscriber } from './utils/auth.js'\n",
    "import { isUsing3PServices } from './utils/auth.js'\n")
cut(D, """      case 'claude-ai':
        if (isClaudeAISubscriber()) return true
        break
""", """      case 'claude-ai':
        // No build of this product authenticates as a Claude.ai subscriber.
        break
""")
cut(D, """        if (
          !isClaudeAISubscriber() &&
          !isUsing3PServices() &&
          isFirstPartyAnthropicBaseUrl()
        )
          return true
""", """        if (!isUsing3PServices() && isFirstPartyAnthropicBaseUrl()) return true
""")

# ---------------------------------------------------------------- telemetryAttributes.ts
T = 'utils/telemetryAttributes.ts'
cut(T, "import { getOauthAccountInfo } from './auth.js'\n")
cut(T, "import { toTaggedId } from './taggedId.js'\n")
cut(T, """  OTEL_METRICS_INCLUDE_ACCOUNT_UUID: true,
""")
cut_between(T, """  // Only include OAuth account data when actively using OAuth authentication
  const oauthAccount = getOauthAccountInfo()
""", "  // Add terminal type if available\n")

# ---------------------------------------------------------------- Onboarding.tsx
O = 'components/Onboarding.tsx'
cut(O, "import { isAnthropicAuthEnabled } from '../utils/auth.js'\n")
cut(O, "  const [oauthEnabled] = useState(() => isAnthropicAuthEnabled())\n")
cut(O, """  useEffect(() => {
    logEvent('tengu_began_setup', {
      oauthEnabled,
    })
  }, [oauthEnabled])
""", """  useEffect(() => {
    logEvent('tengu_began_setup', {})
  }, [])
""")
cut(O, """      logEvent('tengu_onboarding_step', {
        oauthEnabled,
""", """      logEvent('tengu_onboarding_step', {
""")
cut(O, """  // Create the steps array - determine which steps to include based on reAuth and oauthEnabled
""", """  // Create the steps array - determine which steps to include based on reAuth
""")
cut(O, "  }, [currentStepIndex, steps.length, oauthEnabled, onDone])\n",
    "  }, [currentStepIndex, steps.length, onDone])\n", n=2)

# ---------------------------------------------------------------- useApiKeyVerification.ts
# `!isAnthropicAuthEnabled()` is `!false` = true, so the source's own guard took
# the 'valid' arm on every call and the key-verification path below it was
# unreachable. The hook keeps its interface for its three consumers and reports
# that arm as a constant; the record states the consequence.
V = 'hooks/useApiKeyVerification.ts'
cut(V, """import { useCallback, useState } from 'react'
import { getIsNonInteractiveSession } from '../bootstrap/state.js'
import { verifyApiKey } from '../services/api/claude.js'
import {
  getAnthropicApiKeyWithSource,
  getApiKeyFromApiKeyHelper,
  isAnthropicAuthEnabled,
  isClaudeAISubscriber,
} from '../utils/auth.js'
""", """import { useCallback } from 'react'
""")
cut_between(V, "export function useApiKeyVerification(): ApiKeyVerificationResult {\n",
    "  return {\n    status,\n    reverify: verify,\n    error,\n  }\n}",
    """export function useApiKeyVerification(): ApiKeyVerificationResult {
  // isAnthropicAuthEnabled() is false in this build, so the source's guard
  // (`!isAnthropicAuthEnabled() || isClaudeAISubscriber()`) took the 'valid'
  // arm and the key-verification path below it was unreachable.
  const verify = useCallback(async (): Promise<void> => {}, [])

""")
cut(V, """  return {
    status,
    reverify: verify,
    error,
  }
""", """  return {
    status: 'valid',
    reverify: verify,
    error: null,
  }
""")

# ---------------------------------------------------------------- planModeV2.ts
P = 'utils/planModeV2.ts'
cut(P, "import { getRateLimitTier, getSubscriptionType } from './auth.js'\n")
cut(P, """  const subscriptionType = getSubscriptionType()
  const rateLimitTier = getRateLimitTier()

  if (
    subscriptionType === 'max' &&
    rateLimitTier === 'default_claude_max_20x'
  ) {
    return 3
  }

  if (subscriptionType === 'enterprise' || subscriptionType === 'team') {
    return 3
  }

""")

# ---------------------------------------------------------------- effort.ts
E = 'utils/effort.ts'
cut(E, "import { isProSubscriber, isMaxSubscriber, isTeamSubscriber } from './auth.js'\n")
cut(E, """  // Default effort on Opus 4.6 to medium for Pro.
  // Max/Team also get medium when the tengu_grey_step2 config is enabled.
  if (model.toLowerCase().includes('opus-4-6')) {
    if (isProSubscriber()) {
      return 'medium'
    }
    if (
      getOpusDefaultEffortConfig().enabled &&
      (isMaxSubscriber() || isTeamSubscriber())
    ) {
      return 'medium'
    }
  }

""")
cut(E, """export type OpusDefaultEffortConfig = {
  enabled: boolean
  dialogTitle: string
  dialogDescription: string
}

const OPUS_DEFAULT_EFFORT_CONFIG_DEFAULT: OpusDefaultEffortConfig = {
  enabled: true,
  dialogTitle: 'We recommend medium effort for Opus',
  dialogDescription:
    'Effort determines how long Claude thinks for when completing your task. We recommend medium effort for most tasks to balance speed and intelligence and maximize rate limits. Use ultrathink to trigger high effort when needed.',
}

export function getOpusDefaultEffortConfig(): OpusDefaultEffortConfig {
  const config = getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_grey_step2',
    OPUS_DEFAULT_EFFORT_CONFIG_DEFAULT,
  )
  return {
    ...OPUS_DEFAULT_EFFORT_CONFIG_DEFAULT,
    ...config,
  }
}

""")

# ---------------------------------------------------------------- AgentTool/prompt.ts
A = 'tools/AgentTool/prompt.ts'
cut(A, "import { getSubscriptionType } from '../../utils/auth.js'\n")
cut(A, """  // When listing via attachment, the "launch multiple agents" note is in the
  // attachment message (conditioned on subscription there). When inline, keep
  // the existing per-call getSubscriptionType() check.
  const concurrencyNote =
    !listViaAttachment && getSubscriptionType() !== 'pro'
      ? `
- Launch multiple agents concurrently whenever possible, to maximize performance; to do that, use a single message with multiple tool uses`
      : ''
""", """  const concurrencyNote = !listViaAttachment
    ? `
- Launch multiple agents concurrently whenever possible, to maximize performance; to do that, use a single message with multiple tool uses`
    : ''
""")

# ---------------------------------------------------------------- attachments.ts
U = 'utils/attachments.ts'
cut(U, "import { getSubscriptionType } from './auth.js'\n")
cut(U, "      showConcurrencyNote: getSubscriptionType() !== 'pro',\n",
    "      showConcurrencyNote: true,\n")

# ---------------------------------------------------------------- auth.ts
H = 'utils/auth.ts'
cut(H, """  // Exclude Claude.ai subscribers
  if (isClaudeAISubscriber()) {
    return false
  }

""")
cut(H, """export function getOauthAccountInfo(): AccountInfo | undefined {
  return isAnthropicAuthEnabled() ? getGlobalConfig().oauthAccount : undefined
}
""", """export function getOauthAccountInfo(): AccountInfo | undefined {
  // No account is persisted in this build, so the guarded config read the
  // source performed could only have answered undefined.
  return undefined
}
""")
cut_between(H, """/**
 * Checks if overage/extra usage provisioning is allowed for this organization.
""", "/** Check if using third-party services (Bedrock or Vertex or Foundry) */", "")
cut_between(H, """function isConsumerPlan(plan: SubscriptionType): plan is 'max' | 'pro' {
""", "export type UserAccountInfo = {", "")

# ---------------------------------------------------------------- config.ts
X = 'utils/config.ts'
cut(X, "  oauthAccount?: AccountInfo\n")
cut(X, """  // Subscription notice tracking
  subscriptionNoticeCount?: number // Number of times the subscription notice has been shown
  hasAvailableSubscription?: boolean // Cached result of whether user has a subscription available
  subscriptionUpsellShownCount?: number // Number of times the subscription upsell has been shown (deprecated)
  recommendedSubscription?: string // Cached config value from Statsig (deprecated)

""")
cut(X, """  // Effort callout tracking - shown once for Opus 4.6 users
  effortCalloutDismissed?: boolean // v1 - legacy, read to suppress v2 for Pro users who already saw it
  effortCalloutV2Dismissed?: boolean

""")
cut(X, """  // Opus 4.5 Pro migration tracking
  opusProMigrationComplete?: boolean
  opusProMigrationTimestamp?: number

""")
cut(X, """  // Sonnet 4.5 → 4.6 migration (pro/max/team premium)
  sonnet45To46MigrationTimestamp?: number

""")
cut(X, """ * Detect whether writing `fresh` would lose auth/onboarding state that the
 * in-memory cache still has. This happens when `getConfig` hits a corrupted
 * or truncated file mid-write (from another process or a non-atomic fallback)
 * and returns DEFAULT_GLOBAL_CONFIG. Writing that back would permanently
 * wipe auth. See GH #3117.
 */
function wouldLoseAuthState(fresh: {
  oauthAccount?: unknown
  hasCompletedOnboarding?: boolean
}): boolean {
  const cached = globalConfigCache.config
  if (!cached) return false
  const lostOauth =
    cached.oauthAccount !== undefined && fresh.oauthAccount === undefined
  const lostOnboarding =
    cached.hasCompletedOnboarding === true &&
    fresh.hasCompletedOnboarding !== true
  return lostOauth || lostOnboarding
}
""", """ * Detect whether writing `fresh` would lose the completed-onboarding flag that
 * the in-memory cache still has. This happens when `getConfig` hits a corrupted
 * or truncated file mid-write (from another process or a non-atomic fallback)
 * and returns DEFAULT_GLOBAL_CONFIG. Writing that back would permanently
 * lose it. See GH #3117.
 */
function wouldLoseOnboardingState(fresh: {
  hasCompletedOnboarding?: boolean
}): boolean {
  const cached = globalConfigCache.config
  if (!cached) return false
  const lostOnboarding =
    cached.hasCompletedOnboarding === true &&
    fresh.hasCompletedOnboarding !== true
  return lostOnboarding
}
""")
cut(X, "    if (wouldLoseAuthState(currentConfig)) {\n",
    "    if (wouldLoseOnboardingState(currentConfig)) {\n")
cut(X, "    if (file === getGlobalClaudeFile() && wouldLoseAuthState(currentConfig)) {\n",
    "    if (file === getGlobalClaudeFile() && wouldLoseOnboardingState(currentConfig)) {\n")
cut(X, "    if (wouldLoseAuthState(config)) {\n",
    "    if (wouldLoseOnboardingState(config)) {\n")
cut(X, "export const _wouldLoseAuthStateForTesting = wouldLoseAuthState\n")

# ---------------------------------------------------------------- useModelMigrationNotifications.tsx
Y = 'hooks/notifs/useModelMigrationNotifications.tsx'
cut(Y, """  // Sonnet 4.5 → 4.6 (pro/max/team premium)
  c => {
    if (!recent(c.sonnet45To46MigrationTimestamp)) return
    return {
      key: 'sonnet-46-update',
      text: 'Model updated to Sonnet 4.6',
      color: 'suggestion',
      priority: 'high',
      timeoutMs: 3000,
    }
  },
""")
cut(Y, "    const ts = c.legacyOpusMigrationTimestamp ?? c.opusProMigrationTimestamp\n",
    "    const ts = c.legacyOpusMigrationTimestamp\n")

# ---------------------------------------------------------------- model.ts
Z = 'utils/model/model.ts'
cut(Z, """// @[MODEL LAUNCH]: Update the default model description strings shown to users.
export function getClaudeAiUserDefaultModelDescription(): string {
  return 'Sonnet 4.6 · Best for everyday tasks'
}

""")

# ---------------------------------------------------------------- effort.ts comment
cut(E, """ * session-ephemeral effort (CLI --effort, EffortCallout default) fall through
""", """ * session-ephemeral effort (CLI --effort) fall through
""")

print('7q cut applied')
