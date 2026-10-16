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


# ---------- utils/auth.ts ----------
A = 'utils/auth.ts'
cut(A, """function isAnthropicAuthEnabledLegacy(): boolean {
  if (isBareMode()) return false

  // `claude ssh` remote: ANTHROPIC_UNIX_SOCKET tunnels API calls through a
  // local auth-injecting proxy. The launcher sets CLAUDE_CODE_OAUTH_TOKEN as a
  // placeholder iff the local side is a subscriber (so the remote includes the
  // oauth-2025 beta header to match what the proxy will inject). The remote's
  // ~/.claude settings (apiKeyHelper, settings.env.ANTHROPIC_API_KEY) MUST NOT
  // flip this — they'd cause a header mismatch with the proxy and a bogus
  // "invalid x-api-key" from the API. See src/ssh/sshAuthProxy.ts.
  if (process.env.ANTHROPIC_UNIX_SOCKET) {
    return !!process.env.CLAUDE_CODE_OAUTH_TOKEN
  }

  const is3P =
    isEnvTruthy(process.env.CLAUDE_CODE_USE_BEDROCK) ||
    isEnvTruthy(process.env.CLAUDE_CODE_USE_VERTEX) ||
    isEnvTruthy(process.env.CLAUDE_CODE_USE_FOUNDRY)

  // Check if user has configured an external API key source
  // This allows externally-provided API keys to work (without requiring proxy configuration)
  const settings = getSettings_DEPRECATED() || {}
  const apiKeyHelper = settings.apiKeyHelper
  const hasExternalAuthToken =
    process.env.ANTHROPIC_AUTH_TOKEN ||
    apiKeyHelper ||
    process.env.CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR

  // Check if API key is from an external source (not managed by /login)
  const { source: apiKeySource } = getAnthropicApiKeyWithSource({
    skipRetrievingKeyFromApiKeyHelper: true,
  })
  const hasExternalApiKey =
    apiKeySource === 'ANTHROPIC_API_KEY' || apiKeySource === 'apiKeyHelper'

  // Disable Anthropic auth if:
  // 1. Using 3rd party services (Bedrock/Vertex/Foundry)
  // 2. User has an external API key (regardless of proxy configuration)
  // 3. User has an external auth token (regardless of proxy configuration)
  // this may cause issues if users have complex proxy / gateway "client-side creds" auth scenarios,
  // e.g. if they want to set X-Api-Key to a gateway key but use Anthropic OAuth for the Authorization
  // if we get reports of that, we should probably add an env var to force OAuth enablement
  const shouldDisableAuth =
    is3P ||
    (hasExternalAuthToken && !isManagedOAuthContext()) ||
    (hasExternalApiKey && !isManagedOAuthContext())

  return !shouldDisableAuth
}

""")

cut(A, """  const { source: authTokenSource } = getAuthTokenSource()
  const accountInfo: UserAccountInfo = {}
  if (
    authTokenSource === 'CLAUDE_CODE_OAUTH_TOKEN' ||
    authTokenSource === 'CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR'
  ) {
    accountInfo.tokenSource = authTokenSource
  } else if (isClaudeAISubscriber()) {
    accountInfo.subscription = getSubscriptionName()
  } else {
    accountInfo.tokenSource = authTokenSource
  }
  const { key: apiKey, source: apiKeySource } = getAnthropicApiKeyWithSource()
  if (apiKey) {
    accountInfo.apiKeySource = apiKeySource
  }

  // We don't know the organization if we're relying on an external API key or auth token
  if (
    authTokenSource === 'claude.ai' ||
    apiKeySource === '/login managed key'
  ) {
    // Get organization name from OAuth account info
    const orgName = getOauthAccountInfo()?.organizationName
    if (orgName) {
      accountInfo.organization = orgName
    }
  }
  const email = getOauthAccountInfo()?.emailAddress
  if (
    (authTokenSource === 'claude.ai' ||
      apiKeySource === '/login managed key') &&
    email
  ) {
    accountInfo.email = email
  }
  return accountInfo
""", """  const { source: authTokenSource } = getAuthTokenSource()
  const accountInfo: UserAccountInfo = {}
  accountInfo.tokenSource = authTokenSource
  const { key: apiKey, source: apiKeySource } = getAnthropicApiKeyWithSource()
  if (apiKey) {
    accountInfo.apiKeySource = apiKeySource
  }

  return accountInfo
""")

# validateForceLoginOrg: its first guard is the whole function once auth is off
def cut_range(p, start, end, new=''):
    t = rd(p)
    i = t.index(start)
    j = t.index(end, i) + len(end)
    wr(p, t[:i] + new + t[j:])


cut_range(A, """  if (!isAnthropicAuthEnabled()) {
    return { valid: true }
  }

  const requiredOrgUuid =
""", """      `Please log in with the correct organization: claude auth login`,
  }
}
""", """  // Organization pinning is an OAuth-identity check: it validates the active
  // OAuth token's org against `forceLoginOrgUUID` from managed settings. With
  // no OAuth token to validate, the original's first guard —
  // `if (!isAnthropicAuthEnabled()) return { valid: true }` — is the whole
  // function.
  return { valid: true }
}
""")

# ---------- utils/statusNoticeDefinitions.tsx ----------
S = 'utils/statusNoticeDefinitions.tsx'
cut(S, """            · Trying to use{' '}
            {authTokenInfo.source === 'claude.ai'
              ? 'claude.ai'
              : authTokenInfo.source}
            ?{' '}
""", """            · Trying to use {authTokenInfo.source}?{' '}
""")
cut(S, """            · Trying to use {apiKeySource}?{' '}
            {authTokenInfo.source === 'claude.ai'
              ? 'claude /logout to sign out of claude.ai.'
              : `Unset the ${authTokenInfo.source} environment variable.`}
""", """            · Trying to use {apiKeySource}?{' '}
            {`Unset the ${authTokenInfo.source} environment variable.`}
""")

# ---------- main.tsx ----------
M = 'main.tsx'
cut(M, """
        // Validate that the active token's org matches forceLoginOrgUUID (if set
        // in managed settings). Runs after onboarding so managed settings and
        // login state are fully loaded.
        const orgValidation = await validateForceLoginOrg()
        if (orgValidation.valid !== true) {
          await exitWithError(root, orgValidation.message)
        }
""")
cut(M, """        profileCheckpoint('before_validateForceLoginOrg')
        // Validate org restriction for non-interactive sessions
        const orgValidation = await validateForceLoginOrg()
        if (orgValidation.valid !== true) {
          process.stderr.write(orgValidation.message + '\\n')
          process.exit(1)
        }

""")

print('d1b ok')
