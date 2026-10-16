# -*- coding: utf-8 -*-
"""Wave D step 7d, follow-on: the URL normalizer getRepoRemoteHash was the only
caller of, the host helper that only the normalizer used, and the two lines of
main.tsx that named the removed prefetch."""
B = '/Users/mant1ssa/Projects/cc-base-2188/'


def rd(p): return open(B + p, encoding='utf-8').read()
def wr(p, t): open(B + p, 'w', encoding='utf-8').write(t)


def cut(p, old, new=''):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:70], n)
    wr(p, t.replace(old, new))


G = 'utils/git.ts'
# normalizeGitRemoteUrl existed to canonicalize a remote before hashing it for
# the analytics `rh` field; getRepoRemoteHash was its only caller.
i = rd(G).index("""/**
 * Normalizes a git remote URL to a canonical form for hashing.""")
j = rd(G).index('export const getIsHeadOnRemote', i)
wr(G, rd(G)[:i] + rd(G)[j:])
# isLocalHost existed for the normalizer's CCR-proxy branch alone.
cut(G, """function isLocalHost(host: string): boolean {
  const hostWithoutPort = host.split(':')[0] ?? ''
  return (
    hostWithoutPort === 'localhost' ||
    /^127\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$/.test(hostWithoutPort)
  )
}

""")

M = 'main.tsx'
cut(M, "import { refreshGrowthBookAfterAuthChange } from './services/analytics/growthbook.js'\n")
cut(M, """    // first-turn responsiveness (initUser, getUserContext, tips, countFiles,""",
    """    // first-turn responsiveness (getUserContext, tips, countFiles,""")

print('d7j ok')
