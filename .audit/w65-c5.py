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


# ---------- components/LogoV2/feedConfigs.tsx: strip trailing blank lines ----------
F = 'components/LogoV2/feedConfigs.tsx'
wr(F, rd(F).rstrip('\n') + '\n')

# ---------- utils/messages/mappers.ts ----------
M = 'utils/messages/mappers.ts'
cut(M, "  SDKRateLimitInfo,\n")

# ---------- services/api/promptCacheBreakDetection.ts ----------
P = 'services/api/promptCacheBreakDetection.ts'
cut(P, """  /** Overage state flip — should NOT break cache anymore (eligibility is
   *  latched session-stable in should1hCacheTTL). Tracked to verify the fix. */
  isUsingOverage: boolean
""")
cut(P, "  overageChanged: boolean\n")
cut(P, "  isUsingOverage?: boolean\n")
cut(P, "      isUsingOverage = false,\n")
cut(P, "        isUsingOverage,\n")
cut(P, "    const overageChanged = isUsingOverage !== prev.isUsingOverage\n")
cut(P, "      overageChanged ||\n")
cut(P, "        overageChanged,\n")
cut(P, "    prev.isUsingOverage = isUsingOverage\n")
cut(P, """      if (changes.overageChanged) {
        parts.push('overage state changed (TTL latched, no flip)')
      }
""")
cut(P, "      overageChanged: changes?.overageChanged ?? false,\n")

print('c5 ok')
