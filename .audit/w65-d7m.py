# -*- coding: utf-8 -*-
"""Wave D step 7e: the GrowthBook warm-up surface.

Three exports existed only to warm up a client that can no longer be built, and
two call sites existed only to call them. checkGate_CACHED_OR_BLOCKING stays: its
one caller is inside interactiveHelpers' dead KAIROS_CHANNELS block, which is its
own package (54 files, 124 flag reads).
"""
B = '/Users/mant1ssa/Projects/cc-base-2188/'


def rd(p): return open(B + p, encoding='utf-8').read()
def wr(p, t): open(B + p, 'w', encoding='utf-8').write(t)


def cut(p, old, new=''):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:70], n)
    wr(p, t.replace(old, new))


def drop(p, start, end):
    """Delete from the line equal to start up to (not including) the line equal to end."""
    lines = rd(p).split('\n')
    i = lines.index(start)
    j = lines.index(end, i + 1)
    del lines[i:j]
    wr(p, '\n'.join(lines))
    return j - i


# ------------------------------------------------------- interactiveHelpers ----
I = 'interactiveHelpers.tsx'
cut(I, """import {
  checkGate_CACHED_OR_BLOCKING,
  initializeGrowthBook,
  resetGrowthBook,
} from './services/analytics/growthbook.js'
""", """import { checkGate_CACHED_OR_BLOCKING } from './services/analytics/growthbook.js'
""")
cut(I, """    // Signal that trust has been verified for this session.
    // GrowthBook checks this to decide whether to include auth headers.
    setSessionTrustAccepted(true)

    // Reset and reinitialize GrowthBook after trust is established.
    // Defense for login/logout: clears any prior client so the next init
    // picks up fresh auth headers.
    resetGrowthBook()
    void initializeGrowthBook()

""", """    // Signal that trust has been verified for this session.
    setSessionTrustAccepted(true)

""")

# ---------------------------------------------------------------- cli/print ----
P = 'cli/print.ts'
cut(P, "import { initializeGrowthBook } from '../services/analytics/growthbook.js'\n")
cut(P, """  // Check Grove requirements for non-interactive consumer subscribers
  // Initialize GrowthBook so feature flags take effect in headless mode.
  // Without this, the disk cache is empty and all flags fall back to defaults.
  void initializeGrowthBook()

""")

# ---------------------------------------------------------- services/analytics ----
G = 'services/analytics/growthbook.ts'
cut(G, "import { type GrowthBook } from '@growthbook/growthbook'\n")
# initializeGrowthBook
i = rd(G).index("""/**
 * Initialize the GrowthBook client (blocks until ready).""")
j = rd(G).index("""/**
 * Get a feature value with a default fallback.""", i)
wr(G, rd(G)[:i] + rd(G)[j:])
# refreshGrowthBookAfterAuthChange and resetGrowthBook, both now caller-less
i = rd(G).index("""/**
 * Refresh feature values after auth changes (login/logout).""")
j = rd(G).index("""// ============================================================================
// Dynamic Config Functions""", i)
wr(G, rd(G)[:i] + rd(G)[j:])

print('d7m ok')
