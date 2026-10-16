# -*- coding: utf-8 -*-
"""Wave D step 7d: the reader-less leftovers the analytics removal stranded.

Four files, all the same shape: a module whose only purpose was to feed the
removed transports, a startup prefetch and a cache reset that existed for the
records those transports carried, and three exports whose last readers were
step 7c's dead half.
"""
import os
B = '/Users/mant1ssa/Projects/cc-base-2188/'


def rd(p): return open(B + p, encoding='utf-8').read()
def wr(p, t): open(B + p, 'w', encoding='utf-8').write(t)


def cut(p, old, new=''):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:70], n)
    wr(p, t.replace(old, new))


# ---------------------------------------------------------------- user.ts ----
# Everything but getGitEmail existed to build the analytics user record:
# getCoreUserData assembled it, getUserForGrowthBook was its GrowthBook variant,
# initUser pre-fetched the email so the record could stay synchronous, and
# resetUserCache cleared that cache on login/logout. getGitEmail is the one
# export with a live caller (utils/exampleCommands.ts).
U = 'utils/user.ts'
assert not [f for f in os.listdir(B + 'utils') if f.startswith('user.ts.w')], 'user.ts has a bak'
wr(U, """import { execa } from 'execa'
import memoize from 'lodash-es/memoize.js'
import { getCwd } from './cwd.js'

/**
 * Get the user's git email from `git config user.email`.
 * Memoized so the subprocess only spawns once per process.
 *
 * This module used to hold the whole analytics user record — the core user data
 * builder, its GrowthBook variant, the startup email prefetch those two needed
 * and the cache reset that went with it. All of it fed the two transports that
 * left in wave D step 7a and the 1P record builders that left in step 7c, so
 * the git-email lookup the local example-commands path still calls is what
 * remains.
 */
export const getGitEmail = memoize(async (): Promise<string | undefined> => {
  const result = await execa('git config --get user.email', {
    shell: true,
    reject: false,
    cwd: getCwd(),
  })
  return result.exitCode === 0 && result.stdout
    ? result.stdout.trim()
    : undefined
})
""")

# ---------------------------------------------------------------- main.tsx ----
cut('main.tsx', "import { initUser, resetUserCache } from './utils/user.js'\n")
cut('main.tsx', """  // Process-spawning prefetches (consumed at first API call, user is still typing)
  void initUser()
  void getUserContext()
""", """  // Process-spawning prefetches (consumed at first API call, user is still typing)
  void getUserContext()
""")
# The whole block goes: the cache reset existed for the analytics record, and the
# refresh it was ordered around is the guard-only function step 7b left behind.
cut('main.tsx', """        if (onboardingShown) {
          // Clear user data cache BEFORE GrowthBook refresh so it picks up fresh credentials
          resetUserCache()
          // Refresh GrowthBook after login to get updated feature flags (e.g., for claude.ai MCPs)
          refreshGrowthBookAfterAuthChange()
        }
""")

# -------------------------------------------------------------- utils/git.ts ----
G = 'utils/git.ts'
cut(G, "import { createHash } from 'crypto'\n")
cut(G, """/**
 * Returns a SHA256 hash (first 16 chars) of the normalized git remote URL.
 * This provides a globally unique identifier for the repository that:
 * - Is the same regardless of SSH vs HTTPS clone
 * - Does not expose the actual repository name in logs
 */
export async function getRepoRemoteHash(): Promise<string | null> {
  const remoteUrl = await getRemoteUrl()
  if (!remoteUrl) return null

  const normalized = normalizeGitRemoteUrl(remoteUrl)
  if (!normalized) return null

  const hash = createHash('sha256').update(normalized).digest('hex')
  return hash.substring(0, 16)
}

""")

# --------------------------------------------------------- utils/platform.ts ----
P = 'utils/platform.ts'
cut(P, "import { readdir, readFile } from 'fs/promises'\nimport memoize from 'lodash-es/memoize.js'\nimport { release as osRelease } from 'os'\n",
    "import memoize from 'lodash-es/memoize.js'\n")
i = rd(P).index("export type LinuxDistroInfo = {")
wr(P, rd(P)[:i].rstrip('\n') + '\n')

print('d7i ok')
