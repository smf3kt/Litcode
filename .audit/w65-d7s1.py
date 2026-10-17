# -*- coding: utf-8 -*-
"""Wave D step 7s cut: utils/fastMode.ts's account-status path.

Deletes the /api/claude_code_penguin_mode probe, its auth selection and 401
retry, the cache-resolution substitute and the startup throttle, together with
the auth predicates whose last reader the probe was. The local fast-mode
surface (env flags, provider/model checks, cooldown, the persisted toggle) and
the API-rejection path stay.
"""
import os

ROOT = '/Users/mant1ssa/Projects/cc-base-2188'


def rd(rel):
    return open(os.path.join(ROOT, rel), encoding='utf-8').read()


def wr(rel, text):
    open(os.path.join(ROOT, rel), 'w', encoding='utf-8').write(text)


def cut(rel, old, new='', n=1):
    text = rd(rel)
    count = text.count(old)
    assert count == n, (rel, 'found', count, 'expected', n, old[:120])
    wr(rel, text.replace(old, new))


def cut_between(rel, start, end, new=''):
    text = rd(rel)
    assert text.count(start) == 1, (rel, 'start', text.count(start), start[:120])
    assert text.count(end) >= 1, (rel, 'end', text.count(end), end[:120])
    i = text.index(start)
    j = text.index(end, i + len(start))
    wr(rel, text[:i] + new + text[j:])


F = 'utils/fastMode.ts'

# ---------------------------------------------------------------- imports
cut(F, "import axios from 'axios'\n")
cut(F, "import { getOauthConfig, OAUTH_BETA_HEADER } from 'src/constants/oauth.js'\n")
cut(F, """import {
  getAnthropicApiKey,
  getClaudeAIOAuthTokens,
  handleOAuth401Error,
  hasProfileScope,
} from './auth.js'
""")
cut(F, "import { getGlobalConfig, saveGlobalConfig } from './config.js'\n")
cut(F, "import { isEssentialTrafficOnly } from './privacyLevel.js'\n")

# ------------------------------------------------- semantics of the removal
# The API-reported reason table existed only to render the probe's answer.
cut(F, """type AuthType = 'oauth' | 'api-key'

function getDisabledReasonMessage(
  disabledReason: FastModeDisabledReason,
  authType: AuthType,
): string {
  switch (disabledReason) {
    case 'free':
      return authType === 'oauth'
        ? 'Fast mode requires a paid subscription'
        : 'Fast mode unavailable during evaluation. Please purchase credits.'
    case 'preference':
      return 'Fast mode has been disabled by your organization'
    case 'extra_usage_disabled':
      // Only OAuth users can have extra_usage_disabled; console users don't have this concept
      return 'Fast mode requires extra usage billing'
    case 'network_error':
      return 'Fast mode unavailable due to network connectivity issues'
    case 'unknown':
      return 'Fast mode is currently unavailable'
  }
}

""")

cut(F, """export function isFastModeAvailable(): boolean {
  if (!isFastModeEnabled()) {
    return false
  }
  return getFastModeUnavailableReason() === null
}

""", """export function isFastModeAvailable(): boolean {
  if (!isFastModeEnabled()) {
    return false
  }
  return getFastModeUnavailableReason() === null
}

// Set when the API rejects a fast mode request for this account. The server is
// the only authority this build consults; no status probe runs.
let orgFastModeDisabled = false

""")

# ------------------------------------------- the probe's arm of availability
cut(F, """  if (orgStatus.status === 'disabled') {
    if (
      orgStatus.reason === 'network_error' ||
      orgStatus.reason === 'unknown'
    ) {
      // The org check can fail behind corporate proxies that block the
      // endpoint. We add CLAUDE_CODE_SKIP_FAST_MODE_NETWORK_ERRORS=1 to
      // bypass this check in the CC binary. This is OK since we have
      // another check in the API to error out when disabled by org.
      if (isEnvTruthy(process.env.CLAUDE_CODE_SKIP_FAST_MODE_NETWORK_ERRORS)) {
        return null
      }
    }
    const authType: AuthType =
      getClaudeAIOAuthTokens() !== null ? 'oauth' : 'api-key'
    const reason = getDisabledReasonMessage(orgStatus.reason, authType)
    logForDebugging(`Fast mode unavailable: ${reason}`)
    return reason
  }
""", """  if (orgFastModeDisabled) {
    const reason = 'Fast mode has been disabled by your organization'
    logForDebugging(`Fast mode unavailable: ${reason}`)
    return reason
  }
""")

# ------------------------------------------------- the rejection path folds
cut(F, """/**
 * Called when the API rejects a fast mode request (e.g., 400 "Fast mode is
 * not enabled for your organization"). Permanently disables fast mode using
 * the same flow as when the prefetch discovers the org has it disabled.
 */
export function handleFastModeRejectedByAPI(): void {
  if (orgStatus.status === 'disabled') {
    return
  }
  orgStatus = { status: 'disabled', reason: 'preference' }
  updateSettingsForSource('userSettings', { fastMode: undefined })
  saveGlobalConfig(current => ({
    ...current,
    penguinModeOrgEnabled: false,
  }))
  orgFastModeChange.emit(false)
}
""", """/**
 * Called when the API rejects a fast mode request (e.g., 400 "Fast mode is
 * not enabled for your organization"). Disables fast mode for the rest of the
 * session and clears the persisted preference.
 */
export function handleFastModeRejectedByAPI(): void {
  if (orgFastModeDisabled) {
    return
  }
  orgFastModeDisabled = true
  updateSettingsForSource('userSettings', { fastMode: undefined })
  orgFastModeChange.emit()
}
""")

# --------------------------------------- the status model and probe go whole
cut_between(F, """// Disabled reason returned by the API. The API is the canonical source for why
// fast mode is disabled (free account, admin preference, extra usage not enabled).""",
"""// Listeners notified when org-level fast mode status changes""")
cut(F, """// Listeners notified when org-level fast mode status changes
const orgFastModeChange = createSignal<[orgEnabled: boolean]>()
export const onOrgFastModeChanged = orgFastModeChange.subscribe""",
"""// Listeners notified when the API disables fast mode for this account
const orgFastModeChange = createSignal()
export const onOrgFastModeChanged = orgFastModeChange.subscribe""")

text = rd(F)
anchor = 'type FastModeResponse = {'
assert text.count(anchor) == 1, ('fastMode tail', text.count(anchor))
wr(F, text[:text.index(anchor)].rstrip('\n') + '\n')

# ---------------------------------------------------------------- auth.ts
A = 'utils/auth.ts'
cut(A, """import {
  CLAUDE_AI_PROFILE_SCOPE,
} from 'src/constants/oauth.js'
""")
cut_between(A, '/**\n * Handle a 401 "OAuth token has expired" error from the API.',
            'export function is1PApiCustomer(): boolean {')

# ------------------------------------------------------------ oauth config
cut('constants/oauth.ts',
    "export const OAUTH_BETA_HEADER = 'oauth-2025-04-20' as const\n")

# ------------------------------------------------------------ global config
cut('utils/config.ts', """  // Cached org-level fast mode status from the API.
  // Used to detect cross-session changes and notify users.
  penguinModeOrgEnabled?: boolean

  // Epoch ms when background refreshes last ran (fast mode, quota, passes, client data).
  // Used with tengu_cicada_nap_ms to throttle API calls
  startupPrefetchedAt?: number

""")

# ---------------------------------------------------------------- main.tsx
M = 'main.tsx'
cut(M, """import {
  getInitialFastModeSetting,
  isFastModeEnabled,
  prefetchFastModeStatus,
  resolveFastModeStatusFromCache,
} from './utils/fastMode.js'
""", "import { getInitialFastModeSetting, isFastModeEnabled } from './utils/fastMode.js'\n")
cut(M, "import { getFeatureValue_CACHED_MAY_BE_STALE } from 'src/services/analytics/growthbook.js'\n")
cut_between(M, '      // Check quota status, fast mode, passes eligibility, and bootstrap data',
            '      if (!isNonInteractiveSession) {\n        void refreshExampleCommands()')

# ------------------------------------------------------- the /fast command
C = 'commands/fast/fast.tsx'
cut(C, "  prefetchFastModeStatus,\n")
cut(C, """  // Fetch org fast mode status before showing the picker. We must know
  // whether the org has disabled fast mode before allowing any toggle.
  // If a startup prefetch is already in flight, this awaits it.
  await prefetchFastModeStatus()

""")

# ------------------------------------------------------- notification hook
H = 'hooks/notifs/useFastModeNotification.tsx'
cut(H, """  // Notify when org fast mode status changes
  useEffect(() => {
    if (getIsRemoteMode()) return
    if (!isFastModeEnabled()) {
      return
    }

    return onOrgFastModeChanged(orgEnabled => {
      if (orgEnabled) {
        addNotification({
          key: ORG_CHANGED_KEY,
          color: 'fastMode',
          priority: 'immediate',
          text: 'Fast mode is now available · /fast to turn on',
        })
      } else if (isFastMode) {
        // Org disabled fast mode — permanently turn off fast mode
        setAppState(prev => ({ ...prev, fastMode: false }))
        addNotification({
          key: ORG_CHANGED_KEY,
          color: 'warning',
          priority: 'immediate',
          text: 'Fast mode has been disabled by your organization',
        })
      }
    })
  }, [addNotification, isFastMode, setAppState])
""", """  // Notify when the API disables fast mode for this account
  useEffect(() => {
    if (getIsRemoteMode()) return
    if (!isFastModeEnabled()) {
      return
    }

    return onOrgFastModeChanged(() => {
      if (isFastMode) {
        // The API rejected fast mode — permanently turn off the setting
        setAppState(prev => ({ ...prev, fastMode: false }))
        addNotification({
          key: ORG_CHANGED_KEY,
          color: 'warning',
          priority: 'immediate',
          text: 'Fast mode has been disabled by your organization',
        })
      }
    })
  }, [addNotification, isFastMode, setAppState])
""")

print('cut ok')
