# -*- coding: utf-8 -*-
"""Wave D step 7b, the follow-on edits: the orphaned key module, the two stale
imports in main.tsx, and the two comments that still describe the fetch."""
import os
B = '/Users/mant1ssa/Projects/cc-base-2188/'


def rd(p):
    return open(B + p, encoding='utf-8').read()


def wr(p, t):
    open(B + p, 'w', encoding='utf-8').write(t)


def cut(p, old, new=''):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:70], n)
    wr(p, t.replace(old, new))


# 1. constants/keys.ts held one export — the GrowthBook SDK client key — and
#    getGrowthBookClientKey() was called from exactly one place, the client
#    construction that step 7b removed. Its source stays in history.
assert not [f for f in os.listdir(B + 'constants') if f.startswith('keys.ts.w')], 'keys.ts has a bak'
os.remove(B + 'constants/keys.ts')

# 2. main.tsx imported two symbols it never called.
cut('main.tsx', """import {
  hasGrowthBookEnvOverride,
  initializeGrowthBook,
  refreshGrowthBookAfterAuthChange,
} from './services/analytics/growthbook.js'
""", """import { refreshGrowthBookAfterAuthChange } from './services/analytics/growthbook.js'
""")

# 3. useSkillsChange's second trigger described a refresh the fetch used to emit.
cut('hooks/useSkillsChange.ts', """ * 2. GrowthBook init/refresh — memo-only clear, since only `isEnabled()`
 *    predicates may have changed. Handles commands like /btw whose gate
 *    reads a flag that isn't in the disk cache yet on first session after
 *    a flag rename: getCommands() runs before GB init (main.tsx:2855 vs
 *    showSetupScreens at :3106), so the memoized list is baked with the
 *    default. Once init populates remoteEvalFeatureValues, re-filter.
""", """ * 2. A GrowthBook override write — memo-only clear, since only `isEnabled()`
 *    predicates may have changed. A gate read now answers with the caller's
 *    default unless a local override pins it, so a memoized command list baked
 *    before that write has to be re-filtered.
""")

# 4. useMainLoopModel subscribed for the same reason and named the same two
#    sources of a value that no longer exists.
cut('hooks/useMainLoopModel.ts', """  // parseUserSpecifiedModel reads tengu_ant_model_override via
  // _CACHED_MAY_BE_STALE (in resolveAntModel). Until GB init completes,
  // that's the stale disk cache; after, it's the in-memory remoteEval map.
  // AppState doesn't change when GB init finishes, so we subscribe to the
  // refresh signal and force a re-render to re-resolve with fresh values.
  // Without this, the alias resolution is frozen until something else
  // happens to re-render the component — the API would sample one model
  // while /model (which also re-resolves) displays another.
""", """  // parseUserSpecifiedModel reads tengu_ant_model_override via
  // _CACHED_MAY_BE_STALE (in resolveAntModel), which answers with the caller's
  // default unless a local override pins it. AppState doesn't change when an
  // override is written, so we subscribe to the refresh signal and force a
  // re-render to re-resolve. Without this, the alias resolution is frozen
  // until something else happens to re-render the component — the API would
  // sample one model while /model (which also re-resolves) displays another.
""")

print('d7d ok')
