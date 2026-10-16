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


# ---------- components/LogoV2/feedConfigs.tsx ----------
F = 'components/LogoV2/feedConfigs.tsx'
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

# ---------- delete files ----------
for p in [
    'services/api/referral.ts',
    'components/LogoV2/OverageCreditUpsell.tsx',
    'components/LogoV2/GuestPassesUpsell.tsx',
    'components/messages/RateLimitMessage.tsx',
    'hooks/notifs/useRateLimitWarningNotification.tsx',
]:
    os.remove(B + p)

print('c2b ok')
