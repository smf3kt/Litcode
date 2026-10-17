#!/usr/bin/env python3
"""W65 wave D step 7p: the subscriber constants out of the model-call path.

isAnthropicAuthEnabled() is `return false` (wave D step 1) and everything the
subscription reads hang off it — isClaudeAISubscriber() early-returns false,
getOauthAccountInfo() returns undefined, hasProfileScope() is false because the
only two token producers left in this build hardcode scopes ['user:inference'].
This package folds those constants out of the request path: not one byte of an
API key session's request changes, and every subscriber-only arm (OAuth
Authorization headers, the oauth beta header, the Pro-plan Opus error, the
enterprise retry exemptions) is unreachable.

services/api/bootstrap.ts goes whole: it is an account endpoint fetch
(`${BASE_API_URL}/api/claude_cli/bootstrap`) whose OAuth arm is dead under the
same hasProfileScope fold, leaving an API key against an account endpoint that
is not this product's. Its only client, utils/http.ts' withOAuth401Retry, goes
with it.
"""

import pathlib

ROOT = pathlib.Path("/Users/mant1ssa/Projects/cc-base-2188")


def read(p):
    return (ROOT / p).read_text()


def write(p, s):
    (ROOT / p).write_text(s)


def cut(path, old, new="", n=1):
    s = read(path)
    c = s.count(old)
    assert c == n, f"{path}: expected {n} occurrence(s), found {c}: {old[:110]!r}"
    write(path, s.replace(old, new))


def cut_between(path, start, end, new=""):
    s = read(path)
    assert s.count(start) == 1, f"{path}: start anchor not unique: {start[:110]!r}"
    assert s.count(end) == 1, f"{path}: end anchor not unique: {end[:110]!r}"
    i = s.index(start)
    j = s.index(end, i)
    write(path, s[:i] + new + s[j + len(end):])


# ---------------------------------------------------------------- client.ts
C = "services/api/client.ts"
cut(C, "  checkAndRefreshOAuthTokenIfNeeded,\n")
cut(C, "  isClaudeAISubscriber,\n")
cut(C, "  getClaudeAIOAuthTokens,\n")
cut(C, "import { getOauthConfig } from '../../constants/oauth.js'\n")
cut(
    C,
    "  logForDebugging('[API:auth] OAuth token check starting')\n"
    "  await checkAndRefreshOAuthTokenIfNeeded()\n"
    "  logForDebugging('[API:auth] OAuth token check complete')\n"
    "\n"
    "  if (!isClaudeAISubscriber()) {\n"
    "    await configureApiKeyHeaders(defaultHeaders, getIsNonInteractiveSession())\n"
    "  }\n",
    "  await configureApiKeyHeaders(defaultHeaders, getIsNonInteractiveSession())\n",
)
cut(
    C,
    "  // Determine authentication method based on available tokens\n"
    "  const clientConfig: ConstructorParameters<typeof Anthropic>[0] = {\n"
    "    apiKey: isClaudeAISubscriber() ? null : apiKey || getAnthropicApiKey(),\n"
    "    authToken: isClaudeAISubscriber()\n"
    "      ? getClaudeAIOAuthTokens()?.accessToken\n"
    "      : undefined,\n"
    "    // Set baseURL from OAuth config when using staging OAuth\n"
    "    ...(process.env.USER_TYPE === 'ant' &&\n"
    "    isEnvTruthy(process.env.USE_STAGING_OAUTH)\n"
    "      ? { baseURL: getOauthConfig().BASE_API_URL }\n"
    "      : {}),\n",
    "  const clientConfig: ConstructorParameters<typeof Anthropic>[0] = {\n"
    "    apiKey: apiKey || getAnthropicApiKey(),\n",
)

# ---------------------------------------------------------------- claude.ts
CL = "services/api/claude.ts"
cut(CL, "import { getOauthAccountInfo } from '../../utils/auth.js'\n")
cut(CL, "import { isClaudeAISubscriber } from 'src/utils/auth.js'\n")
cut(
    CL,
    "      // Only include OAuth account UUID when actively using OAuth authentication\n"
    "      account_uuid: getOauthAccountInfo()?.accountUuid ?? '',\n",
    "      // No OAuth account exists in this build, so the field is always empty.\n"
    "      account_uuid: '',\n",
)
cut(
    CL,
    "  // Check cheap conditions first — the off-switch await blocks on GrowthBook\n"
    "  // init (~10ms). For non-Opus models (haiku, sonnet) this skips the await\n"
    "  // entirely. Subscribers don't hit this path at all.\n"
    "  if (\n"
    "    !isClaudeAISubscriber() &&\n"
    "    isNonCustomOpusModel(options.model) &&\n",
    "  // Check cheap conditions first — the off-switch await blocks on GrowthBook\n"
    "  // init (~10ms). For non-Opus models (haiku, sonnet) this skips the await\n"
    "  // entirely.\n"
    "  if (\n"
    "    isNonCustomOpusModel(options.model) &&\n",
)

# -------------------------------------------------------------- withRetry.ts
W = "services/api/withRetry.ts"
cut(W, "  getClaudeAIOAuthTokens,\n")
cut(W, "  handleOAuth401Error,\n")
cut(W, "  isClaudeAISubscriber,\n")
cut(W, "  isEnterpriseSubscriber,\n")
cut(
    W,
    "        // On 401 \"token expired\" or 403 \"token revoked\", force a token refresh\n"
    "        if (\n"
    "          (lastError instanceof APIError && lastError.status === 401) ||\n"
    "          isOAuthTokenRevokedError(lastError)\n"
    "        ) {\n"
    "          const failedAccessToken = getClaudeAIOAuthTokens()?.accessToken\n"
    "          if (failedAccessToken) {\n"
    "            await handleOAuth401Error(failedAccessToken)\n"
    "          }\n"
    "        }\n"
    "        client = await getClient()\n",
    "        // On 401 \"token expired\" or 403 \"token revoked\", re-read the client.\n"
    "        // This build's bearers carry no refresh token, so there is nothing to\n"
    "        // exchange first.\n"
    "        client = await getClient()\n",
)
cut(
    W,
    "        // If FALLBACK_FOR_ALL_PRIMARY_MODELS is not set, fall through only if the primary model is a non-custom Opus model.\n",
    "        // If FALLBACK_FOR_ALL_PRIMARY_MODELS is not set, fall through only if the primary model is a non-custom Opus model.\n",
)
cut(
    W,
    "        (process.env.FALLBACK_FOR_ALL_PRIMARY_MODELS ||\n"
    "          (!isClaudeAISubscriber() && isNonCustomOpusModel(options.model)))\n",
    "        (process.env.FALLBACK_FOR_ALL_PRIMARY_MODELS ||\n"
    "          isNonCustomOpusModel(options.model))\n",
)
cut(
    W,
    "  // If the server explicitly says whether or not to retry, obey.\n"
    "  // For Max and Pro users, should-retry is true, but in several hours, so we shouldn't.\n"
    "  // Enterprise users can retry because they typically use PAYG instead of rate limits.\n"
    "  if (\n"
    "    shouldRetryHeader === 'true' &&\n"
    "    (!isClaudeAISubscriber() || isEnterpriseSubscriber())\n"
    "  ) {\n"
    "    return true\n"
    "  }\n",
    "  // If the server explicitly says whether or not to retry, obey.\n"
    "  if (shouldRetryHeader === 'true') {\n"
    "    return true\n"
    "  }\n",
)
cut(
    W,
    "  // Retry on rate limits, but not for ClaudeAI Subscription users\n"
    "  // Enterprise users can retry because they typically use PAYG instead of rate limits\n"
    "  if (error.status === 429) {\n"
    "    return !isClaudeAISubscriber() || isEnterpriseSubscriber()\n"
    "  }\n",
    "  // Retry on rate limits.\n"
    "  if (error.status === 429) {\n"
    "    return true\n"
    "  }\n",
)
cut(
    W,
    "  // Clear API key cache on 401 and allow retry.\n"
    "  // OAuth token handling is done in the main retry loop via handleOAuth401Error.\n",
    "  // Clear API key cache on 401 and allow retry.\n",
)

# ---------------------------------------------------------------- errors.ts
E = "services/api/errors.ts"
cut(E, "  getOauthAccountInfo,\n")
cut(E, "  isClaudeAISubscriber,\n")
cut(E, "  isNonCustomOpusModel,\n")
cut(
    E,
    "  // Check for invalid model name error for subscription users trying to use Opus\n"
    "  if (\n"
    "    isClaudeAISubscriber() &&\n"
    "    error instanceof APIError &&\n"
    "    error.status === 400 &&\n"
    "    error.message.toLowerCase().includes('invalid model name') &&\n"
    "    (isNonCustomOpusModel(model) || model === 'opus')\n"
    "  ) {\n"
    "    return createAssistantAPIErrorMessage({\n"
    "      content:\n"
    "        'Claude Opus is not available with the Claude Pro plan. If you have updated your subscription plan recently, run /logout and /login for the plan to take effect.',\n"
    "      error: 'invalid_request',\n"
    "    })\n"
    "  }\n"
    "\n",
)
cut(
    E,
    "    // Get organization ID from config - only use OAuth account data when actively using OAuth\n"
    "    const orgId = getOauthAccountInfo()?.organizationUuid\n"
    "    const baseMsg = `[ANT-ONLY] Your org isn't gated into the \\`${model}\\` model. Either run \\`claude\\` with \\`ANTHROPIC_MODEL=${getDefaultMainLoopModelSetting()}\\``\n"
    "    const msg = orgId\n"
    "      ? `${baseMsg} or share your orgId (${orgId}) in ${MACRO.FEEDBACK_CHANNEL} for help getting access.`\n"
    "      : `${baseMsg} or reach out in ${MACRO.FEEDBACK_CHANNEL} for help getting access.`\n",
    "    const msg = `[ANT-ONLY] Your org isn't gated into the \\`${model}\\` model. Either run \\`claude\\` with \\`ANTHROPIC_MODEL=${getDefaultMainLoopModelSetting()}\\` or reach out in ${MACRO.FEEDBACK_CHANNEL} for help getting access.`\n",
)
cut(
    E,
    "    // getAnthropicApiKeyWithSource conflates the env var with FD-passed keys\n"
    "    // under the same source value, and in CCR mode OAuth stays active despite\n"
    "    // the env var. The three guards ensure we only blame the env var when it's\n"
    "    // actually set and actually on the wire.\n"
    "    if (\n"
    "      source === 'ANTHROPIC_API_KEY' &&\n"
    "      process.env.ANTHROPIC_API_KEY &&\n"
    "      !isClaudeAISubscriber()\n"
    "    ) {\n",
    "    // getAnthropicApiKeyWithSource conflates the env var with FD-passed keys\n"
    "    // under the same source value. The two guards ensure we only blame the env\n"
    "    // var when it's actually set and actually on the wire.\n"
    "    if (source === 'ANTHROPIC_API_KEY' && process.env.ANTHROPIC_API_KEY) {\n",
)

# ------------------------------------------------------------------ http.ts
H = "utils/http.ts"
cut(H, "import { OAUTH_BETA_HEADER } from '../constants/oauth.js'\n")
cut(H, "  getClaudeAIOAuthTokens,\n")
cut(H, "  handleOAuth401Error,\n")
cut(H, "  isClaudeAISubscriber,\n")
cut(
    H,
    "/**\n"
    " * Get authentication headers for API requests\n"
    " * Returns either OAuth headers for Max/Pro users or API key headers for regular users\n"
    " */\n"
    "export function getAuthHeaders(): AuthHeaders {\n"
    "  if (isClaudeAISubscriber()) {\n"
    "    const oauthTokens = getClaudeAIOAuthTokens()\n"
    "    if (!oauthTokens?.accessToken) {\n"
    "      return {\n"
    "        headers: {},\n"
    "        error: 'No OAuth token available',\n"
    "      }\n"
    "    }\n"
    "    return {\n"
    "      headers: {\n"
    "        Authorization: `Bearer ${oauthTokens.accessToken}`,\n"
    "        'anthropic-beta': OAUTH_BETA_HEADER,\n"
    "      },\n"
    "    }\n"
    "  }\n"
    "  // TODO: this will fail if the API key is being set to an LLM Gateway key\n",
    "/**\n"
    " * Get authentication headers for API requests.\n"
    " */\n"
    "export function getAuthHeaders(): AuthHeaders {\n"
    "  // TODO: this will fail if the API key is being set to an LLM Gateway key\n",
)
cut_between(
    H,
    "/**\n * Wrapper that handles OAuth 401 errors by force-refreshing the token and\n",
    "    await handleOAuth401Error(failedAccessToken)\n    return await request()\n  }\n}\n",
)
# The wrapper was axios' only user in this file and the last caller of the
# auth import's other members, and its deletion left a blank line at EOF.
_s = read(H)
assert _s.endswith("}\n\n")
write(H, _s[:-1])
cut(H, "import axios from 'axios'\n")
cut(
    H,
    "import {\n  getAnthropicApiKey,\n} from './auth.js'\n",
    "import { getAnthropicApiKey } from './auth.js'\n",
)

# ----------------------------------------------------------------- betas.ts
B = "utils/betas.ts"
cut(B, "import { OAUTH_BETA_HEADER } from '../constants/oauth.js'\n")
cut(B, "import { isClaudeAISubscriber } from './auth.js'\n")
cut(
    B,
    "  if (isClaudeAISubscriber()) {\n"
    "    // biome-ignore lint/suspicious/noConsole: intentional warning\n"
    "    console.warn(\n"
    "      'Warning: Custom betas are only available for API key users. Ignoring provided betas.',\n"
    "    )\n"
    "    return undefined\n"
    "  }\n",
)
cut(
    B,
    "  if (isClaudeAISubscriber()) {\n"
    "    betaHeaders.push(OAUTH_BETA_HEADER)\n"
    "  }\n",
)

# --------------------------------------------------- model/modelCapabilities
MC = "utils/model/modelCapabilities.ts"
cut(MC, "import { OAUTH_BETA_HEADER } from '../../constants/oauth.js'\n")
cut(MC, "import { isClaudeAISubscriber } from '../auth.js'\n")
cut(
    MC,
    "    const betas = isClaudeAISubscriber() ? [OAUTH_BETA_HEADER] : undefined\n",
)
cut(
    MC,
    "    for await (const entry of anthropic.models.list({ betas })) {\n",
    "    for await (const entry of anthropic.models.list({})) {\n",
)

# ------------------------------------------------------------ model/model.ts
M = "utils/model/model.ts"
cut(
    M,
    "import {\n"
    "  getSubscriptionType,\n"
    "  isClaudeAISubscriber,\n"
    "  isMaxSubscriber,\n"
    "  isProSubscriber,\n"
    "  isTeamPremiumSubscriber,\n"
    "} from '../auth.js'\n",
)
cut(
    M,
    "  // Max users get Opus as default\n"
    "  if (isMaxSubscriber()) {\n"
    "    return getDefaultOpusModel() + (isOpus1mMergeEnabled() ? '[1m]' : '')\n"
    "  }\n"
    "\n"
    "  // Team Premium gets Opus (same as Max)\n"
    "  if (isTeamPremiumSubscriber()) {\n"
    "    return getDefaultOpusModel() + (isOpus1mMergeEnabled() ? '[1m]' : '')\n"
    "  }\n"
    "\n",
)
cut(
    M,
    "export function getClaudeAiUserDefaultModelDescription(\n"
    "  fastMode = false,\n"
    "): string {\n"
    "  if (isMaxSubscriber() || isTeamPremiumSubscriber()) {\n"
    "    if (isOpus1mMergeEnabled()) {\n"
    "      return `Opus 4.6 with 1M context · Most capable for complex work${fastMode ? getOpus46PricingSuffix(true) : ''}`\n"
    "    }\n"
    "    return `Opus 4.6 · Most capable for complex work${fastMode ? getOpus46PricingSuffix(true) : ''}`\n"
    "  }\n"
    "  return 'Sonnet 4.6 · Best for everyday tasks'\n"
    "}\n",
    "export function getClaudeAiUserDefaultModelDescription(): string {\n"
    "  return 'Sonnet 4.6 · Best for everyday tasks'\n"
    "}\n",
)
cut(
    M,
    "  if (\n"
    "    is1mContextDisabled() ||\n"
    "    isProSubscriber() ||\n"
    "    getAPIProvider() !== 'firstParty'\n"
    "  ) {\n"
    "    return false\n"
    "  }\n"
    "  // Fail closed when a subscriber's subscription type is unknown. The VS Code\n"
    "  // config-loading subprocess can have OAuth tokens with valid scopes but no\n"
    "  // subscriptionType field (stale or partial refresh). Without this guard,\n"
    "  // isProSubscriber() returns false for such users and the merge leaks\n"
    "  // opus[1m] into the model dropdown — the API then rejects it with a\n"
    "  // misleading \"rate limit reached\" error.\n"
    "  if (isClaudeAISubscriber() && getSubscriptionType() === null) {\n"
    "    return false\n"
    "  }\n"
    "  return true\n",
    "  if (is1mContextDisabled() || getAPIProvider() !== 'firstParty') {\n"
    "    return false\n"
    "  }\n"
    "  return true\n",
)
cut(
    M,
    "    } else if (isClaudeAISubscriber()) {\n"
    "      return `Default (${getClaudeAiUserDefaultModelDescription()})`\n"
    "    }\n",
    "    }\n",
)

# ------------------------------------------------------ model/modelOptions.ts
MO = "utils/model/modelOptions.ts"
cut(
    MO,
    "import {\n"
    "  isClaudeAISubscriber,\n"
    "  isMaxSubscriber,\n"
    "  isTeamPremiumSubscriber,\n"
    "} from '../auth.js'\n",
)
cut(MO, "  getClaudeAiUserDefaultModelDescription,\n")
cut(
    MO,
    "  // Subscribers\n"
    "  if (isClaudeAISubscriber()) {\n"
    "    return {\n"
    "      value: null,\n"
    "      label: 'Default (recommended)',\n"
    "      description: getClaudeAiUserDefaultModelDescription(fastMode),\n"
    "    }\n"
    "  }\n"
    "\n",
)
cut(
    MO,
    "  const billingInfo = isClaudeAISubscriber() ? ' · Billed as extra usage' : ''\n",
    n=2,
)
cut(
    MO,
    "    description: `Sonnet 4.6 with 1M context${billingInfo}${is3P ? '' : ` · ${formatModelPricing(COST_TIER_3_15)}`}`,\n",
    "    description: `Sonnet 4.6 with 1M context${is3P ? '' : ` · ${formatModelPricing(COST_TIER_3_15)}`}`,\n",
)
cut(
    MO,
    "    description: `Opus 4.6 with 1M context${billingInfo}${getOpus46PricingSuffix(fastMode)}`,\n",
    "    description: `Opus 4.6 with 1M context${getOpus46PricingSuffix(fastMode)}`,\n",
)
cut_between(
    MO,
    "  if (isClaudeAISubscriber()) {\n    if (isMaxSubscriber() || isTeamPremiumSubscriber()) {\n",
    "    standardOptions.push(MaxHaiku45Option)\n    return standardOptions\n  }\n\n",
    "",
)
# The two Max/Team-Premium option builders and the two prepared options had no
# reader outside the block above.
cut(
    MO,
    "export function getMaxSonnet46_1MOption(): ModelOption {\n"
    "  const is3P = getAPIProvider() !== 'firstParty'\n"
    "  return {\n"
    "    value: 'sonnet[1m]',\n"
    "    label: 'Sonnet (1M context)',\n"
    "    description: `Sonnet 4.6 with 1M context${is3P ? '' : ` · ${formatModelPricing(COST_TIER_3_15)}`}`,\n"
    "  }\n"
    "}\n\n",
)
cut(
    MO,
    "export function getMaxOpus46_1MOption(fastMode = false): ModelOption {\n"
    "  return {\n"
    "    value: 'opus[1m]',\n"
    "    label: 'Opus (1M context)',\n"
    "    description: `Opus 4.6 with 1M context${getOpus46PricingSuffix(fastMode)}`,\n"
    "  }\n"
    "}\n\n",
)
cut(
    MO,
    "const MaxSonnet46Option: ModelOption = {\n"
    "  value: 'sonnet',\n"
    "  label: 'Sonnet',\n"
    "  description: 'Sonnet 4.6 · Best for everyday tasks',\n"
    "}\n\n",
)
cut(
    MO,
    "const MaxHaiku45Option: ModelOption = {\n"
    "  value: 'haiku',\n"
    "  label: 'Haiku',\n"
    "  description: 'Haiku 4.5 · Fastest for quick answers',\n"
    "}\n\n",
)

# ----------------------------------------------------------- bootstrap, main
MAIN = "main.tsx"
cut(MAIN, "import { fetchBootstrapData } from './services/api/bootstrap.js'\n")
cut(
    MAIN,
    "        // Fetch bootstrap data from the server and update all cache values.\n"
    "        void fetchBootstrapData()\n"
    "\n"
    "        // TODO: Consolidate other prefetches into a single bootstrap request.\n",
)
p = ROOT / "services/api/bootstrap.ts"
assert p.exists()
p.unlink()

print("7p cut applied")
