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


# ---------- main.tsx ----------
M = 'main.tsx'
cut(M, """import {
  isPolicyAllowed,
  loadPolicyLimits,
  refreshPolicyLimits,
  waitForPolicyLimitsToLoad,
} from './services/policyLimits/index.js'
""")
cut(M, "\n    void loadPolicyLimits()\n")
cut(M, """          // Refresh auth-dependent services now that the user has logged in during onboarding.
          // Keep in sync with the post-login logic in src/commands/login.tsx
          void refreshPolicyLimits()
""")
cut(M, """          await waitForPolicyLimitsToLoad()
          if (!isPolicyAllowed('allow_remote_sessions')) {
            return await exitWithError(
              root,
              "Error: Remote sessions are disabled by your organization's policy.",
              () => gracefulShutdown(1),
            )
          }
""")

# ---------- entrypoints/init.ts ----------
I = 'entrypoints/init.ts'
cut(I, """import {
  initializePolicyLimitsLoadingPromise,
  isPolicyLimitsEligible,
} from '../services/policyLimits/index.js'
""")
cut(I, """    if (isPolicyLimitsEligible()) {
      initializePolicyLimitsLoadingPromise()
    }
""")

# ---------- entrypoints/cli.tsx ----------
C = 'entrypoints/cli.tsx'
cut(C, """    // Bridge is a remote control feature - check policy limits
    const { waitForPolicyLimitsToLoad, isPolicyAllowed } = await import(
      '../services/policyLimits/index.js'
    )
    await waitForPolicyLimitsToLoad()
    if (!isPolicyAllowed('allow_remote_control')) {
      exitWithError(
        "Error: Remote Control is disabled by your organization's policy.",
      )
    }

""")

# ---------- cli/print.ts ----------
P = 'cli/print.ts'
cut(P, "import { isPolicyAllowed } from 'src/services/policyLimits/index.js'\n")
cut(P, """      if (!isPolicyAllowed('allow_remote_sessions')) {
        throw new Error(
          "Remote sessions are disabled by your organization's policy.",
        )
      }

""")

# ---------- utils/background/remote/remoteSession.ts ----------
R = 'utils/background/remote/remoteSession.ts'
cut(R, "import { isPolicyAllowed } from '../../../services/policyLimits/index.js'\n")
cut(R, """  // Check policy first - if blocked, no need to check other preconditions
  if (!isPolicyAllowed('allow_remote_sessions')) {
    errors.push({ type: 'policy_blocked' })
    return errors
  }

""")

# ---------- utils/teleport.tsx ----------
T = 'utils/teleport.tsx'
cut(T, "import { isPolicyAllowed } from 'src/services/policyLimits/index.js'\n")
cut(T, """  if (!isPolicyAllowed('allow_remote_sessions')) {
    throw new Error(
      "Remote sessions are disabled by your organization's policy.",
    )
  }

""")

# ---------- bridge/initReplBridge.ts ----------
G = 'bridge/initReplBridge.ts'
cut(G, """import {
  isPolicyAllowed,
  waitForPolicyLimitsToLoad,
} from '../services/policyLimits/index.js'
""")
cut(G, """  // 3. Check organization policy — remote control may be disabled
  await waitForPolicyLimitsToLoad()
  if (!isPolicyAllowed('allow_remote_control')) {
    logBridgeSkip(
      'policy_denied',
      '[bridge:repl] Skipping: allow_remote_control policy not allowed',
    )
    onStateChange?.('failed', "disabled by your organization's policy")
    return null
  }

""")

# ---------- skills/bundled/scheduleRemoteAgents.ts ----------
S = 'skills/bundled/scheduleRemoteAgents.ts'
cut(S, "import { isPolicyAllowed } from '../../services/policyLimits/index.js'\n")
cut(S, """      getFeatureValue_CACHED_MAY_BE_STALE('tengu_surreal_dali', false) &&
      isPolicyAllowed('allow_remote_sessions'),
""", """      getFeatureValue_CACHED_MAY_BE_STALE('tengu_surreal_dali', false),
""")

# ---------- tools/RemoteTriggerTool/RemoteTriggerTool.ts ----------
D = 'tools/RemoteTriggerTool/RemoteTriggerTool.ts'
cut(D, "import { isPolicyAllowed } from '../../services/policyLimits/index.js'\n")
cut(D, """      getFeatureValue_CACHED_MAY_BE_STALE('tengu_surreal_dali', false) &&
      isPolicyAllowed('allow_remote_sessions')
""", """      getFeatureValue_CACHED_MAY_BE_STALE('tengu_surreal_dali', false)
""")

# ---------- components/FeedbackSurvey/useFeedbackSurvey.tsx ----------
F = 'components/FeedbackSurvey/useFeedbackSurvey.tsx'
cut(F, "import { isPolicyAllowed } from '../../services/policyLimits/index.js'\n")
cut(F, """      // Don't show if product feedback is blocked by org policy (ZDR)
      if (!isPolicyAllowed('allow_product_feedback')) {
        return false
      }

""")
cut(F, """    // Check if product feedback is allowed by org policy
    if (!isPolicyAllowed('allow_product_feedback')) {
      return false
    }

""")

# ---------- components/FeedbackSurvey/useMemorySurvey.tsx ----------
Y = 'components/FeedbackSurvey/useMemorySurvey.tsx'
cut(Y, "import { isPolicyAllowed } from '../../services/policyLimits/index.js'\n")
cut(Y, """      if (!isPolicyAllowed('allow_product_feedback')) {
        return false
      }
""")
cut(Y, """    if (!isPolicyAllowed('allow_product_feedback')) {
      return
    }

""")

# ---------- utils/errors.ts (stale comment naming deleted services) ----------
E = 'utils/errors.ts'
cut(E, """ * chain duplicated across sync-style services (settingsSync, policyLimits,
 * remoteManagedSettings, teamMemorySync).
""", """ * chain duplicated across the sync-style services.
""")

os.remove(B + 'services/policyLimits/index.ts')
os.remove(B + 'services/policyLimits/types.ts')
os.rmdir(B + 'services/policyLimits')
print('d2-policy ok')
