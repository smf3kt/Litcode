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


# ================= services/oauth/ 整体删除 =================
for f in os.listdir(B + 'services/oauth'):
    os.remove(B + 'services/oauth/' + f)
os.rmdir(B + 'services/oauth')

# ================= utils/auth.ts =================
A = 'utils/auth.ts'
cut(A, """import {
  isOAuthTokenExpired,
  refreshOAuthToken,
  shouldUseClaudeAIAuth,
} from '../services/oauth/client.js'
import { getOauthProfileFromOauthToken } from '../services/oauth/getOauthProfile.js'
import type { OAuthTokens, SubscriptionType } from '../services/oauth/types.js'
""")

# 本地类型与纯函数：types.ts 在 dump 里就是 stub（无实体），形状由读取处决定；
# 两个 helper 的实体从 services/oauth/client.ts 逐字移植。
cut(A, "const DEFAULT_API_KEY_HELPER_TTL = 5 * 60 * 1000\n",
    """// The OAuth token shape, read off this file's own producers and consumers:
// getClaudeAIOAuthTokens builds every field, saveOAuthTokensIfNeeded persisted
// them as a group. services/oauth/types.ts was a stub in the dump (no bodies),
// so there is no source form to port — only these field names.
type OAuthTokens = {
  accessToken: string
  refreshToken: string | null
  expiresAt: number | null
  scopes: string[]
  subscriptionType: SubscriptionType | null
  rateLimitTier: string | null
}

// The plan names the subscription predicates below compare against.
type SubscriptionType = 'max' | 'team' | 'enterprise' | 'pro'

// Ported from services/oauth/client.ts:38-40 — the Claude.ai inference scope test.
function shouldUseClaudeAIAuth(scopes: string[] | undefined): boolean {
  return Boolean(scopes?.includes(CLAUDE_AI_INFERENCE_SCOPE))
}

// Ported from services/oauth/client.ts:344-353 — expiry with a 5-minute buffer.
function isOAuthTokenExpired(expiresAt: number | null): boolean {
  if (expiresAt === null) {
    return false
  }

  const bufferTime = 5 * 60 * 1000
  const now = Date.now()
  const expiresWithBuffer = now + bufferTime
  return expiresWithBuffer >= expiresAt
}

const DEFAULT_API_KEY_HELPER_TTL = 5 * 60 * 1000
""")
cut(A, "import { CLAUDE_AI_PROFILE_SCOPE } from 'src/constants/oauth.js'\n",
    "import {\n  CLAUDE_AI_INFERENCE_SCOPE,\n  CLAUDE_AI_PROFILE_SCOPE,\n} from 'src/constants/oauth.js'\n")

# saveOAuthTokensIfNeeded：整块删除（唯一外部消费者随 services/oauth 消失）
cut_range(
    A,
    "// Function to store OAuth tokens in secure storage\nexport function saveOAuthTokensIfNeeded(tokens: OAuthTokens): {\n",
    "    return { success: false, warning: 'Failed to save OAuth tokens' }\n  }\n}\n\n",
    "",
)

# getClaudeAIOAuthTokens：keychain 读取臂删除，只剩 env 与 fd 两个本地来源
cut(A, """  try {
    const secureStorage = getSecureStorage()
    const storageData = secureStorage.read()
    const oauthData = storageData?.claudeAiOauth

    if (!oauthData?.accessToken) {
      return null
    }

    return oauthData
  } catch (error) {
    logError(error)
    return null
  }
})
""", """  // No keychain read: the encrypted `claudeAiOauth` blob is the account
  // session this build does not carry. Only the two local bearer sources
  // above can produce a token.
  return null
})
""")

# clearOAuthTokenCache：只剩 memoize 清理
cut(A, """/**
 * Clears all OAuth token caches. Call this on 401 errors to ensure
 * the next token read comes from secure storage, not stale in-memory caches.
 * This handles the case where the local expiration check disagrees with
 * the server (e.g., due to clock corrections after token was issued).
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

# 磁盘失效检查：读的是 keychain 迁移后留下的凭据文件
cut_range(
    A,
    "let lastCredentialsMtimeMs = 0\n",
    "    getClaudeAIOAuthTokens.cache?.clear?.()\n  }\n}\n\n",
    "",
)

# 401 恢复链：本地令牌无法刷新
cut_range(
    A,
    "// In-flight dedup: when N claude.ai proxy connectors hit 401 with the same\n",
    "  // Same token that failed - force refresh, bypassing local expiration check\n  return checkAndRefreshOAuthTokenIfNeeded(0, true)\n}\n\n",
    """/**
 * Handle a 401 "OAuth token has expired" error from the API.
 *
 * A token from `CLAUDE_CODE_OAUTH_TOKEN` or the file descriptor carries no
 * refresh token, so there is nothing to refresh and no other holder to read a
 * newer token from. The caller retries or fails on its own.
 *
 * @param failedAccessToken - The access token that was rejected with 401
 * @returns false - this build cannot recover a rejected token
 */
export function handleOAuth401Error(_failedAccessToken: string): Promise<boolean> {
  return Promise.resolve(false)
}

""",
)

# getClaudeAIOAuthTokensAsync：委托给同步版即可
cut_range(
    A, "export async function getClaudeAIOAuthTokensAsync(): Promise<OAuthTokens | null> {\n",
    "  } catch (error) {\n    logError(error)\n    return null\n  }\n}\n\n",
    """export async function getClaudeAIOAuthTokensAsync(): Promise<OAuthTokens | null> {
  // Every remaining source (env var, file descriptor) is synchronous and
  // nowhere near a keychain, so there is nothing to await.
  return getClaudeAIOAuthTokens()
}

""",
)

# 刷新调度：无刷新来源
cut_range(
    A, "// In-flight promise for deduplicating concurrent calls\n",
    "    logEvent('tengu_oauth_token_refresh_lock_released', {})\n  }\n}\n\n",
    """/**
 * Refresh the OAuth token if it is close to expiry.
 *
 * Returns false unconditionally: the only tokens this build can produce are
 * the env var and file-descriptor bearers, and neither carries a refresh
 * token. Callers treat false as "no refresh happened" and continue.
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
assert 'services/oauth' not in t, 'auth.ts 仍引用 services/oauth'
wr(A, t)

# ================= entrypoints/init.ts =================
I = 'entrypoints/init.ts'
cut(I, "import { populateOAuthAccountInfoIfNeeded } from '../services/oauth/client.js'\n")
cut(I, "    void populateOAuthAccountInfoIfNeeded()\n")

# ================= utils/config.ts =================
C = 'utils/config.ts'
cut(C, """import type {
  BillingType,
  ReferralEligibilityResponse,
} from '../services/oauth/types.js'
""", """// services/oauth/types.ts was a stub in the dump; this alias stands in for
// the billing-type string /api/oauth/profile reports.
type BillingType = string
""")

# ================= components/ConsoleOAuthFlow.tsx =================
os.remove(B + 'components/ConsoleOAuthFlow.tsx')

print('d2a ok')
