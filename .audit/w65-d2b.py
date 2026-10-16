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


A = 'utils/auth.ts'

cut(A, """/**
 * Clears all OAuth token caches. Call this on 401 errors to ensure
 * the next token read comes from secure storage, not stale in-memory caches.
 * This handles the case where the local expiration check disagrees with the
 * server (e.g., due to clock corrections after token was issued).
 */
export function clearOAuthTokenCache(): void {
  getClaudeAIOAuthTokens.cache?.clear?.()
  clearKeychainCache()
}
""", """/**
 * Clears the OAuth token memo cache so the next read re-derives from the
 * environment or file descriptor.
 */
export function clearOAuthTokenCache(): void {
  getClaudeAIOAuthTokens.cache?.clear?.()
}
""")

cut_range(
    A,
    "let lastCredentialsMtimeMs = 0\n",
    "    getClaudeAIOAuthTokens.cache?.clear?.()\n  }\n}\n\n",
    "",
)

cut_range(
    A,
    "// In-flight dedup: when N claude.ai proxy connectors hit 401 with the same\n",
    "  return checkAndRefreshOAuthTokenIfNeeded(0, true)\n}\n\n",
    """/**
 * Handle a 401 "OAuth token has expired" error from the API.
 *
 * A token taken from `CLAUDE_CODE_OAUTH_TOKEN` or the file descriptor carries
 * no refresh token, so there is nothing to refresh and no other holder to read
 * a newer token from. The caller retries or fails on its own.
 *
 * @param failedAccessToken - The access token that was rejected with 401
 * @returns false - this build cannot recover a rejected token
 */
export function handleOAuth401Error(
  _failedAccessToken: string,
): Promise<boolean> {
  return Promise.resolve(false)
}

""",
)

cut_range(
    A,
    "/**\n * Reads OAuth tokens asynchronously, avoiding blocking keychain reads.\n",
    "  } catch (error) {\n    logError(error)\n    return null\n  }\n}\n\n",
    """/**
 * Reads OAuth tokens. Every remaining source (environment variable, file
 * descriptor) is synchronous, so this delegates to the memoized sync reader.
 */
export async function getClaudeAIOAuthTokensAsync(): Promise<OAuthTokens | null> {
  return getClaudeAIOAuthTokens()
}

""",
)

cut_range(
    A,
    "// In-flight promise for deduplicating concurrent calls\n",
    "    logEvent('tengu_oauth_token_refresh_lock_released', {})\n  }\n}\n\n",
    """/**
 * Refresh the OAuth token if it is close to expiry.
 *
 * Returns false unconditionally: the only tokens this build can produce are
 * the environment-variable and file-descriptor bearers, and neither carries a
 * refresh token. Callers treat false as "no refresh happened" and continue.
 */
export function checkAndRefreshOAuthTokenIfNeeded(
  _retryCount = 0,
  _force = false,
): Promise<boolean> {
  return Promise.resolve(false)
}

""",
)

t = rd(A)
for bad in ['services/oauth', 'clearKeychainCache', 'lastCredentialsMtimeMs',
            'pending401Handlers', 'pendingRefreshCheck', 'refreshOAuthToken',
            'getOauthProfileFromOauthToken', 'saveOAuthTokensIfNeeded',
            'invalidateOAuthCacheIfDiskChanged', 'secureStorage', 'lockfile']:
    assert bad not in t, (bad, 'auth.ts 残留')
wr(A, t)
print('d2b ok')
