import os

B = '/Users/mant1ssa/Projects/cc-base-2188/'


def rd(p):
    return open(B + p, encoding='utf-8').read()


def wr(p, t):
    open(B + p, 'w', encoding='utf-8').write(t)


def cut(p, old, new=''):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:90], n)
    wr(p, t.replace(old, new))


def cut_all(p, old, new=''):
    t = rd(p)
    n = t.count(old)
    assert n >= 1, (p, old[:90], n)
    wr(p, t.replace(old, new))


def cut_range(p, start, end, new=''):
    t = rd(p)
    i = t.index(start)
    j = t.index(end, i) + len(end)
    wr(p, t[:i] + new + t[j:])


# ---------- services/api/claude.ts ----------
C = 'services/api/claude.ts'
cut(C, """import {
  currentLimits,
  extractQuotaStatusFromError,
  extractQuotaStatusFromHeaders,
} from '../claudeAiLimits.js'
""")
cut(C, """    userEligible =
      process.env.USER_TYPE === 'ant' ||
      (isClaudeAISubscriber() && !currentLimits.isUsingOverage)
""", """    userEligible = process.env.USER_TYPE === 'ant'
""")
cut(C, "      isUsingOverage: currentLimits.isUsingOverage ?? false,\n")
cut(C, "        extractQuotaStatusFromHeaders(resp.headers)\n")
cut_range(
    C,
    """      // Extract quota status from error headers if it's a rate limit error
      if (error instanceof APIError) {
        extractQuotaStatusFromError(error)
      }

""",
    """      if (error instanceof APIError) {
        extractQuotaStatusFromError(error)
      }

""",
)
cut(C, """        if (error instanceof APIError) {
          extractQuotaStatusFromError(error)
        }

""")

# ---------- services/api/errors.ts ----------
E = 'services/api/errors.ts'
cut(E, """import {
  type ClaudeAILimits,
  getRateLimitErrorMessage,
  type OverageDisabledReason,
} from '../claudeAiLimits.js'
import { shouldProcessRateLimits } from '../rateLimitMocking.js' // Used for /mock-limits command
""")
cut_range(
    E,
    """  if (
    error instanceof APIError &&
    error.status === 429 &&
    shouldProcessRateLimits(isClaudeAISubscriber())
  ) {
""",
    """    // SDK's APIError.makeMessage prepends "429 " and JSON-stringifies the body
    // when there's no top-level .message — extract the inner error.message.
    const stripped = error.message.replace(/^429\\s+/, '')
    const innerMessage = stripped.match(/"message"\\s*:\\s*"([^"]*)"/)?.[1]
    const detail = innerMessage || stripped
    return createAssistantAPIErrorMessage({
      content: `${API_ERROR_MESSAGE_PREFIX}: Request rejected (429) · ${detail || 'this may be a temporary capacity issue — check status.anthropic.com'}`,
      error: 'rate_limit',
    })
  }
""",
    """  if (error instanceof APIError && error.status === 429) {
    // SDK's APIError.makeMessage prepends "429 " and JSON-stringifies the body
    // when there's no top-level .message — extract the inner error.message.
    const stripped = error.message.replace(/^429\\s+/, '')
    const innerMessage = stripped.match(/"message"\\s*:\\s*"([^"]*)"/)?.[1]
    const detail = innerMessage || stripped
    return createAssistantAPIErrorMessage({
      content: `${API_ERROR_MESSAGE_PREFIX}: Request rejected (429) · ${detail || 'this may be a temporary capacity issue — check status.anthropic.com'}`,
      error: 'rate_limit',
    })
  }
""",
)

# ---------- services/api/withRetry.ts ----------
W = 'services/api/withRetry.ts'
cut(W, """import {
  checkMockRateLimitError,
  isMockRateLimitError,
} from '../rateLimitMocking.js'
""")
cut(W, """      // Check for mock rate limits (used by /mock-limits command for Ant employees)
      if (process.env.USER_TYPE === 'ant') {
        const mockError = checkMockRateLimitError(
          retryContext.model,
          wasFastModeActive,
        )
        if (mockError) {
          throw mockError
        }
      }

""")
cut(W, """  // Never retry mock errors - they're from /mock-limits command for testing
  if (isMockRateLimitError(error)) {
    return false
  }

""")

# ---------- services/PromptSuggestion/promptSuggestion.ts ----------
P = 'services/PromptSuggestion/promptSuggestion.ts'
cut(P, "import { currentLimits } from '../claudeAiLimits.js'\n")
cut(P, """  if (
    process.env.USER_TYPE === 'external' &&
    currentLimits.status !== 'allowed'
  )
    return 'rate_limit'
""")

# ---------- utils/messages/mappers.ts ----------
M = 'utils/messages/mappers.ts'
cut(M, "import type { ClaudeAILimits } from 'src/services/claudeAiLimits.js'\n")
cut_range(M, """/**
 * Maps internal ClaudeAILimits to the SDK-facing SDKRateLimitInfo type,
""", """    ...(limits.surpassedThreshold !== undefined && {
      surpassedThreshold: limits.surpassedThreshold,
    }),
  }
}

""")

# ---------- utils/model/check1mAccess.ts ----------
wr('utils/model/check1mAccess.ts', """import { is1mContextDisabled } from '../context.js'

// @[MODEL LAUNCH]: Add check if the new model supports 1M context
export function checkOpus1mAccess(): boolean {
  return !is1mContextDisabled()
}

export function checkSonnet1mAccess(): boolean {
  return !is1mContextDisabled()
}
""")

# ---------- cli/print.ts ----------
T = 'cli/print.ts'
cut(T, """import {
  toInternalMessages,
  toSDKRateLimitInfo,
} from 'src/utils/messages/mappers.js'
""", """import { toInternalMessages } from 'src/utils/messages/mappers.js'
""")
cut(T, """import {
  statusListeners,
  type ClaudeAILimits,
} from 'src/services/claudeAiLimits.js'
""")
cut(T, """  // Set up rate limit status listener to emit SDKRateLimitEvent for all status changes.
  // Emitting for all statuses (including 'allowed') ensures consumers can clear warnings
  // when rate limits reset. The upstream emitStatusChange already deduplicates via isEqual.
  const rateLimitListener = (limits: ClaudeAILimits) => {
    const rateLimitInfo = toSDKRateLimitInfo(limits)
    if (rateLimitInfo) {
      output.enqueue({
        type: 'rate_limit_event',
        rate_limit_info: rateLimitInfo,
        uuid: randomUUID(),
        session_id: getSessionId(),
      })
    }
  }
  statusListeners.add(rateLimitListener)

""")
cut_all(T, "        statusListeners.delete(rateLimitListener)\n")

# ---------- main.tsx ----------
N = 'main.tsx'
cut(N, "import { prefetchPassesEligibility } from './services/api/referral.js'\n")
cut(N, "import { checkQuotaStatus } from './services/claudeAiLimits.js'\n")
cut(N, "        checkQuotaStatus().catch(error => logError(error))\n")
cut(N, "        void prefetchPassesEligibility()\n")

# ---------- utils/auth.ts ----------
A = 'utils/auth.ts'
cut(A, """import {
  getMockSubscriptionType,
  shouldUseMockSubscription,
} from '../services/mockRateLimits.js'
""")
cut(A, """  if (shouldUseMockSubscription()) {
    return getMockSubscriptionType()
  }
""")

# ---------- commands/cost/cost.ts ----------
wr('commands/cost/cost.ts', """import { formatTotalCost } from '../../cost-tracker.js'
import type { LocalCommandCall } from '../../types/command.js'

export const call: LocalCommandCall = async () => {
  return { type: 'text', value: formatTotalCost() }
}
""")

# ---------- utils/billing.ts ----------
wr('utils/billing.ts', """import { getAnthropicApiKey, getAuthTokenSource } from './auth.js'
import { isEnvTruthy } from './envUtils.js'

/**
 * Cost reporting is a local accounting feature. The subscription-plan and
 * organization-role gates that used to narrow it read account data that is
 * not part of this build; what remains is the local off-switch and "is there
 * any local credential at all".
 */
export function hasConsoleBillingAccess(): boolean {
  if (isEnvTruthy(process.env.DISABLE_COST_WARNINGS)) {
    return false
  }

  const authSource = getAuthTokenSource()
  const hasApiKey = getAnthropicApiKey() !== null

  return authSource.hasToken || hasApiKey
}
""")

# ---------- utils/config.ts ----------
G = 'utils/config.ts'
cut_range(G, """  // Overage credit grant upsell tracking (keyed by org UUID — multi-org users).
""", """  >
""")
cut(G, """  overageCreditUpsellSeenCount?: number // Number of times the overage credit upsell has been shown
  hasVisitedExtraUsage?: boolean // Whether the user has visited /extra-usage — hides credit upsells
""")

# ---------- delete files ----------
for p in [
    'services/claudeAiLimits.ts',
    'services/claudeAiLimitsHook.ts',
    'services/rateLimitMessages.ts',
    'services/mockRateLimits.ts',
    'services/rateLimitMocking.ts',
    'services/api/firstTokenDate.ts',
    'services/api/overageCreditGrant.ts',
    'utils/extraUsage.ts',
]:
    os.remove(B + p)

print('c1 ok')
