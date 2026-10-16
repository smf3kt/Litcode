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


def cut_range(p, start, end, new=''):
    t = rd(p)
    i = t.index(start)
    j = t.index(end, i) + len(end)
    wr(p, t[:i] + new + t[j:])


# ---------- cli/print.ts ----------
cut('cli/print.ts', "      statusListeners.delete(rateLimitListener)\n")

# ---------- commands.ts ----------
C = 'commands.ts'
cut(C, """import {
  extraUsage,
  extraUsageNonInteractive,
} from './commands/extra-usage/index.js'
import rateLimitOptions from './commands/rate-limit-options/index.js'
""")
cut(C, """  extraUsage,
  extraUsageNonInteractive,
  rateLimitOptions,
""")

# ---------- commands/model/model.tsx ----------
M = 'commands/model/model.tsx'
cut(M, "import { isBilledAsExtraUsage } from '../../utils/extraUsage.js'\n")
cut(M, """    if (
      isBilledAsExtraUsage(
        model,
        wasFastModeToggledOn === true,
        isOpus1mMergeEnabled(),
      )
    ) {
      message += ` · Billed as extra usage`
    }
""")
cut(M, """      if (
        isBilledAsExtraUsage(
          modelValue,
          wasFastModeToggledOn === true,
          isOpus1mMergeEnabled(),
        )
      ) {
        message += ` · Billed as extra usage`
      }
""")

# ---------- components/PromptInput/PromptInput.tsx ----------
P = 'components/PromptInput/PromptInput.tsx'
cut(P, "import { isBilledAsExtraUsage } from '../../utils/extraUsage.js'\n")
cut(P, """      if (
        isBilledAsExtraUsage(model, effectiveFastMode, isOpus1mMergeEnabled())
      ) {
        message += ' · Billed as extra usage'
      }
""")

# ---------- components/Settings/Config.tsx ----------
S = 'components/Settings/Config.tsx'
cut(S, "import { isBilledAsExtraUsage } from '../../utils/extraUsage.js'\n")
cut(S, """      const valStr =
        modelDisplayString(value) +
        (isBilledAsExtraUsage(value, false, isOpus1mMergeEnabled())
          ? ' · Billed as extra usage'
          : '')
""", """      const valStr = modelDisplayString(value)
""")

# ---------- components/PromptInput/Notifications.tsx ----------
N = 'components/PromptInput/Notifications.tsx'
cut(N, """import {
  getApiKeyHelperElapsedMs,
  getConfiguredApiKeyHelper,
  getSubscriptionType,
} from '../../utils/auth.js'
""", """import {
  getApiKeyHelperElapsedMs,
  getConfiguredApiKeyHelper,
} from '../../utils/auth.js'
""")
cut(N, "import { useClaudeAiLimits } from '../../services/claudeAiLimitsHook.js'\n")
cut(N, "  const claudeAiLimits = useClaudeAiLimits()\n")
cut(N, """  // Check if we're in overage mode for UI indicators
  const isInOverageMode = claudeAiLimits.isUsingOverage
  const subscriptionType = getSubscriptionType()
  const isTeamOrEnterprise =
    subscriptionType === 'team' || subscriptionType === 'enterprise'

""")
cut(N, """          isInOverageMode={isInOverageMode ?? false}
          isTeamOrEnterprise={isTeamOrEnterprise}
""")
cut(N, """  isInOverageMode,
  isTeamOrEnterprise,
""")
cut(N, """  isInOverageMode: boolean
  isTeamOrEnterprise: boolean
""")
cut(N, """      {isInOverageMode && !isTeamOrEnterprise && (
        <Box>
          <Text dimColor wrap="truncate">
            Now using extra usage
          </Text>
        </Box>
      )}
""")

# ---------- components/StatusLine.tsx ----------
L = 'components/StatusLine.tsx'
cut(L, "import { getRawUtilization } from '../services/claudeAiLimits.js'\n")
cut_range(L, """  const rawUtil = getRawUtilization()
  const rateLimits: StatusLineCommandInput['rate_limits'] = {
""", """      },
    }),
  }
""")
cut(L, """    ...((rateLimits.five_hour || rateLimits.seven_day) && {
      rate_limits: rateLimits,
    }),
""")

# ---------- components/messages/AssistantTextMessage.tsx ----------
A = 'components/messages/AssistantTextMessage.tsx'
cut(A, "import { isRateLimitErrorMessage } from 'src/services/rateLimitMessages.js'\n")
cut(A, "import { RateLimitMessage } from './RateLimitMessage.js'\n")
cut(A, """  // Handle all rate limit error messages from getRateLimitErrorMessage
  // Use the exported function to avoid fragile string coupling
  if (isRateLimitErrorMessage(text)) {
    return (
      <RateLimitMessage
        text={text}
        onOpenRateLimitOptions={onOpenRateLimitOptions}
      />
    )
  }

""")
cut(A, "  onOpenRateLimitOptions?: () => void\n")
cut(A, "  onOpenRateLimitOptions,\n")

# ---------- hooks/notifs/useRateLimitWarningNotification.tsx (caller) ----------
R = 'screens/REPL.tsx'
cut(R, "import { useRateLimitWarningNotification } from 'src/hooks/notifs/useRateLimitWarningNotification.js'\n")
cut(R, "  useRateLimitWarningNotification(mainLoopModel)\n")

# ---------- services/tips/tipRegistry.ts ----------
G = 'services/tips/tipRegistry.ts'
cut(G, """import {
  formatGrantAmount,
  getCachedOverageCreditGrant,
} from '../api/overageCreditGrant.js'
import {
  checkCachedPassesEligibility,
  formatCreditAmount,
  getCachedReferrerReward,
} from '../api/referral.js'
""")
cut(G, "import { shouldShowOverageCreditUpsell } from '../../components/LogoV2/OverageCreditUpsell.js'\n")
cut_range(G, """  {
    id: 'guest-passes',
""", """    isRelevant: async () => shouldShowOverageCreditUpsell(),
  },
""")

# ---------- components/LogoV2/feedConfigs.tsx ----------
F = 'components/LogoV2/feedConfigs.tsx'
cut(F, """import {
  formatCreditAmount,
  getCachedReferrerReward,
} from '../../services/api/referral.js'
""")
cut_range(F, """export function createGuestPassesFeed(): FeedConfig {
""", """    footer: '/passes',
  }
}

""")

# ---------- components/LogoV2/LogoV2.tsx ----------
V = 'components/LogoV2/LogoV2.tsx'
cut(V, """  createProjectOnboardingFeed,
  createGuestPassesFeed,
} from './feedConfigs.js'
""", """  createProjectOnboardingFeed,
} from './feedConfigs.js'
""")
cut(V, """import {
  useShowGuestPassesUpsell,
  incrementGuestPassesSeenCount,
} from './GuestPassesUpsell.js'
import {
  useShowOverageCreditUpsell,
  incrementOverageCreditUpsellSeenCount,
  createOverageCreditFeed,
} from './OverageCreditUpsell.js'
""")
cut(V, """  const showGuestPassesUpsell = useShowGuestPassesUpsell()
  const showOverageCreditUpsell = useShowOverageCreditUpsell()
""")
cut(V, """  useEffect(() => {
    if (showGuestPassesUpsell && !showOnboarding && !isCondensedMode) {
      incrementGuestPassesSeenCount()
    }
  }, [showGuestPassesUpsell, showOnboarding, isCondensedMode])

  useEffect(() => {
    if (
      showOverageCreditUpsell &&
      !showOnboarding &&
      !showGuestPassesUpsell &&
      !isCondensedMode
    ) {
      incrementOverageCreditUpsellSeenCount()
    }
  }, [
    showOverageCreditUpsell,
    showOnboarding,
    showGuestPassesUpsell,
    isCondensedMode,
  ])

""")
cut(V, """                    : showGuestPassesUpsell
                      ? [
                          createRecentActivityFeed(activities),
                          createGuestPassesFeed(),
                        ]
                      : showOverageCreditUpsell
                        ? [
                            createRecentActivityFeed(activities),
                            createOverageCreditFeed(),
                          ]
                        : [
                            createRecentActivityFeed(activities),
                            createWhatsNewFeed(changelog),
                          ]
""", """                    : [
                        createRecentActivityFeed(activities),
                        createWhatsNewFeed(changelog),
                      ]
""")

# ---------- components/LogoV2/CondensedLogo.tsx ----------
D = 'components/LogoV2/CondensedLogo.tsx'
cut(D, """import {
  GuestPassesUpsell,
  incrementGuestPassesSeenCount,
  useShowGuestPassesUpsell,
} from './GuestPassesUpsell.js'
import {
  incrementOverageCreditUpsellSeenCount,
  OverageCreditUpsell,
  useShowOverageCreditUpsell,
} from './OverageCreditUpsell.js'
""")
cut(D, """  const showGuestPassesUpsell = useShowGuestPassesUpsell()
  const showOverageCreditUpsell = useShowOverageCreditUpsell()

  useEffect(() => {
    if (showGuestPassesUpsell) {
      incrementGuestPassesSeenCount()
    }
  }, [showGuestPassesUpsell])

  useEffect(() => {
    if (showOverageCreditUpsell && !showGuestPassesUpsell) {
      incrementOverageCreditUpsellSeenCount()
    }
  }, [showOverageCreditUpsell, showGuestPassesUpsell])

""")
cut(D, """        {showGuestPassesUpsell && <GuestPassesUpsell />}
        {!showGuestPassesUpsell && showOverageCreditUpsell && (
          <OverageCreditUpsell maxWidth={textWidth} twoLine />
        )}
""")

# ---------- utils/config.ts ----------
G2 = 'utils/config.ts'
cut_range(G2, """  // Guest passes eligibility cache per org - key is org ID
""", """    ReferralEligibilityResponse & { timestamp: number }
  >
""")
cut_range(G2, """  // Guest passes upsell tracking
""", """  hasVisitedPasses?: boolean // Whether the user has visited /passes command
""")

# ---------- delete files and dirs ----------
for p in [
    'services/api/referral.ts',
    'components/LogoV2/OverageCreditUpsell.tsx',
    'components/LogoV2/GuestPassesUpsell.tsx',
    'components/messages/RateLimitMessage.tsx',
    'hooks/notifs/useRateLimitWarningNotification.tsx',
]:
    os.remove(B + p)

print('c2 ok')
