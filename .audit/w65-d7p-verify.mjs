import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "4a799eb"
const digest = text => createHash("sha256").update(text).digest("hex")

// The subscription constants are unreachable in this build and this package
// folds them out of the request path: isAnthropicAuthEnabled() is `return
// false`, isClaudeAISubscriber() early-returns on it, getOauthAccountInfo()
// returns undefined, and hasProfileScope() is false because the only two token
// producers left (CLAUDE_CODE_OAUTH_TOKEN and the file descriptor) hardcode
// scopes ['user:inference']. Nothing an API key session sends changes.
const touched = [
  "main.tsx",
  "services/api/claude.ts",
  "services/api/client.ts",
  "services/api/errors.ts",
  "services/api/withRetry.ts",
  "utils/betas.ts",
  "utils/http.ts",
  "utils/model/model.ts",
  "utils/model/modelCapabilities.ts",
  "utils/model/modelOptions.ts",
]
const read = p => fs.readFileSync(`${root}/${p}`, "utf8")

function rg(pattern, paths = [root]) {
  try {
    return execFileSync("rg", [
      "-n", "--glob", "!node_modules", "--glob", "!*.w*bak", "--glob", "!*.json", "--glob", "!*.md",
      "-e", pattern, ...paths,
    ], {encoding: "utf8"}).trim()
  } catch (e) {
    assert.equal(e.status, 1, `rg failed: ${e.message}`)
    return ""
  }
}

// 1. The account bootstrap and the wrapper that existed for it are gone whole.
assert.equal(rg("fetchBootstrapData|withOAuth401Retry|api/bootstrap"), "", "the bootstrap surface remains")
assert.equal(fs.existsSync(`${root}/services/api/bootstrap.ts`), false, "bootstrap.ts is gone")

// 2. No subscriber read survives in the files this package owns. The constants
//    themselves stay in utils/auth.ts with the readers a later package owns.
for (const p of touched) {
  assert.doesNotMatch(
    read(p),
    /isClaudeAISubscriber|isAnthropicAuthEnabled\(\)|getOauthAccountInfo|hasProfileScope|isEnterpriseSubscriber|OAUTH_BETA_HEADER/,
    `${p} still reads a subscription constant`,
  )
}

// 3. Each site folded to the arm the false constant produced.
const client = read("services/api/client.ts")
assert.match(client, /  await configureApiKeyHeaders\(defaultHeaders, getIsNonInteractiveSession\(\)\)\n/)
assert.match(client, /    apiKey: apiKey \|\| getAnthropicApiKey\(\),\n/)
assert.doesNotMatch(client, /authToken|OAuth token check|USE_STAGING_OAUTH/)

const claude = read("services/api/claude.ts")
assert.match(claude, /      \/\/ No OAuth account exists in this build, so the field is always empty\.\n      account_uuid: '',\n/)
assert.match(claude, /  if \(\n    isNonCustomOpusModel\(options\.model\) &&\n/)
assert.doesNotMatch(claude, /Subscribers don't hit this path/)

const withRetry = read("services/api/withRetry.ts")
assert.match(withRetry, /  if \(shouldRetryHeader === 'true'\) \{\n    return true\n  \}\n/)
assert.match(withRetry, /  \/\/ Retry on rate limits\.\n  if \(error\.status === 429\) \{\n    return true\n  \}\n/)
assert.match(
  withRetry,
  /        \(process\.env\.FALLBACK_FOR_ALL_PRIMARY_MODELS \|\|\n          isNonCustomOpusModel\(options\.model\)\)\n/,
)
assert.match(
  withRetry,
  /        \/\/ On 401 "token expired" or 403 "token revoked", re-read the client\.\n        \/\/ This build's bearers carry no refresh token, so there is nothing to\n        \/\/ exchange first\.\n        client = await getClient\(\)\n/,
)

const errors = read("services/api/errors.ts")
assert.doesNotMatch(errors, /Claude Opus is not available with the Claude Pro plan/)
assert.match(
  errors,
  /    const msg = `\[ANT-ONLY\] Your org isn't gated into the \\`\$\{model\}\\` model\. Either run \\`claude\\` with \\`ANTHROPIC_MODEL=\$\{getDefaultMainLoopModelSetting\(\)\}\\` or reach out in \$\{MACRO\.FEEDBACK_CHANNEL\} for help getting access\.`\n/,
)
assert.match(
  errors,
  /    if \(source === 'ANTHROPIC_API_KEY' && process\.env\.ANTHROPIC_API_KEY\) \{\n/,
)
assert.match(errors, /      const hasStoredOAuth = getClaudeAIOAuthTokens\(\)\?\.accessToken != null\n/)

const http = read("utils/http.ts")
assert.match(http, /^import \{ getAnthropicApiKey \} from '\.\/auth\.js'\n/m)
assert.match(http, /export function getUserAgent\(\): string \{/)
assert.match(http, /export function getMCPUserAgent\(\): string \{/)
assert.match(http, /export function getWebFetchUserAgent\(\): string \{/)
assert.match(http, /  const apiKey = getAnthropicApiKey\(\)\n/)
assert.doesNotMatch(http, /Authorization|axios|withOAuth401Retry/)
assert.equal(http.endsWith("}\n"), true)

const betas = read("utils/betas.ts")
assert.doesNotMatch(betas, /Custom betas are only available for API key users/)
assert.match(betas, /  if \(has1mContext\(model\)\) \{\n    betaHeaders\.push\(CONTEXT_1M_BETA_HEADER\)\n  \}\n/)

const caps = read("utils/model/modelCapabilities.ts")
assert.match(caps, /    for await \(const entry of anthropic\.models\.list\(\{\}\)\) \{\n/)

const model = read("utils/model/model.ts")
assert.match(
  model,
  /export function getClaudeAiUserDefaultModelDescription\(\): string \{\n  return 'Sonnet 4\.6 · Best for everyday tasks'\n\}\n/,
)
assert.match(
  model,
  /  if \(is1mContextDisabled\(\) \|\| getAPIProvider\(\) !== 'firstParty'\) \{\n    return false\n  \}\n  return true\n/,
)
assert.match(model, /  \/\/ PAYG \(1P and 3P\), Enterprise, Team Standard, and Pro get Sonnet as default\n/)

const options = read("utils/model/modelOptions.ts")
assert.doesNotMatch(options, /MaxSonnet46Option|MaxHaiku45Option|getMaxOpus46_1MOption|getMaxSonnet46_1MOption|Billed as extra usage/)
assert.match(options, /  \/\/ PAYG 1P API: Default \(Sonnet\) \+ Sonnet 1M \+ Opus 4\.6 \+ Opus 1M \+ Haiku\n/)
assert.match(options, /function getMaxOpusOption\(fastMode = false\): ModelOption \{/)
assert.match(options, /function getMergedOpus1MOption\(fastMode = false\): ModelOption \{/)

assert.doesNotMatch(read("main.tsx"), /fetchBootstrapData/)

// 4. The gate.
const tscText = fs.readFileSync(new URL("w65-d7p-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const digests = {}
for (const f of ["services/api/bootstrap.ts", ...touched]) {
  digests[f] = digest(execFileSync("git", ["-C", root, "show", `${before}:${f}`], {encoding: "utf8"}))
}

fs.writeFileSync(
  new URL("w65-d7p-source-evidence.json", import.meta.url),
  JSON.stringify(
    {
      before,
      kind: "subscription constants folded out of the model-call path (no ported bodies; one module deleted with its only client)",
      surface:
        "the subscription reads in the Anthropic client's request setup (the OAuth token check, the apiKey/authToken pair, the staging baseURL), the subscriber arms of the system prompt's account_uuid, the off-switch gate, the two retry exemptions, the Pro-plan Opus error, the ant org message, the OAuth header builder in utils/http.ts, the custom-betas warning and the oauth beta header, the model-listing betas, and the Max/Team-Premium default-model and model-option surfaces",
      decisiveFact:
        "isAnthropicAuthEnabled() is `return false` (wave D step 1), so isClaudeAISubscriber() early-returns false, getOauthAccountInfo() returns undefined and getSubscriptionType()/getRateLimitTier() return null; hasProfileScope() is false for a second, independent reason — the only two OAuthTokens producers left in this build (CLAUDE_CODE_OAUTH_TOKEN and the inherited file descriptor) hardcode scopes ['user:inference']. Every arm folded here is therefore unreachable, and an API key session's request is byte-identical",
      evidence: [
        {
          file: "services/api/bootstrap.ts",
          change:
            "removed whole (141 lines): a GET of `${BASE_API_URL}/api/claude_cli/bootstrap` (an OAuth-account endpoint) whose OAuth arm was dead under the hasProfileScope fold, persisting server-declared client_data and additional_model_options into the global config; utils/http.ts' withOAuth401Retry existed only for its call, so the wrapper went with it",
          sourceSha256: digests["services/api/bootstrap.ts"],
          portSha256: null,
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "services/api/client.ts",
          change:
            "the OAuth token check call with its two debug lines goes and the configureApiKeyHeaders call becomes unconditional; the client config keeps only `apiKey: apiKey || getAnthropicApiKey()` — the authToken field and the ant-only staging baseURL (the last getOauthConfig reader here) go with the subscriber arm",
          sourceSha256: digests["services/api/client.ts"],
          portSha256: digest(client),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "services/api/claude.ts",
          change:
            "the system-prompt metadata's account_uuid folds to the empty string the ternary already produced, and the off-switch gate loses its subscriber term and the comment clause that explained it",
          sourceSha256: digests["services/api/claude.ts"],
          portSha256: digest(claude),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "services/api/withRetry.ts",
          change:
            "the x-should-retry exemption loses its subscriber/enterprise disjunction, the 429 arm returns true, the 9xx fallback condition loses its subscriber term, and the 401/revoked refresh attempt goes — handleOAuth401Error returns false unconditionally in this build, so the call could only re-read the client, which the surrounding block still does",
          sourceSha256: digests["services/api/withRetry.ts"],
          portSha256: digest(withRetry),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "services/api/errors.ts",
          change:
            "the Pro-plan Opus 400 error block is deleted, the ant org message loses its orgId ternary (getOauthAccountInfo() is undefined), and the env-var org-disabled guard drops its subscriber term; hasStoredOAuth stays — an env or file-descriptor bearer can still exist and still changes which message is shown",
          sourceSha256: digests["services/api/errors.ts"],
          portSha256: digest(errors),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/http.ts",
          change:
            "getAuthHeaders loses its OAuth arm and keeps the API key path, withOAuth401Retry is removed, and the imports its two deletions orphaned (axios, getClaudeAIOAuthTokens, handleOAuth401Error) go; the three user-agent helpers that are this file's live surface are untouched",
          sourceSha256: digests["utils/http.ts"],
          portSha256: digest(http),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/betas.ts",
          change:
            "the custom-betas warning block (which could only fire for a subscriber) and the oauth beta-header push are deleted, taking the OAUTH_BETA_HEADER import with them",
          sourceSha256: digests["utils/betas.ts"],
          portSha256: digest(betas),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/model/modelCapabilities.ts",
          change: "the models.list call's betas option folds to the undefined the ternary produced",
          sourceSha256: digests["utils/model/modelCapabilities.ts"],
          portSha256: digest(caps),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/model/model.ts",
          change:
            "the Max and Team-Premium default-model arms go, getClaudeAiUserDefaultModelDescription collapses to its surviving return (and loses its now-unused fastMode parameter), isOpus1mMergeEnabled loses its Pro term and the whole subscriber fail-closed guard, and modelDisplayString loses its subscriber label arm",
          sourceSha256: digests["utils/model/model.ts"],
          portSha256: digest(model),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/model/modelOptions.ts",
          change:
            "the subscriber Default option and the whole Max/Team-Premium / Pro-Team-Enterprise option block go, with the two ' · Billed as extra usage' interpolations; the four builders and prepared options that block alone read (getMaxSonnet46_1MOption, getMaxOpus46_1MOption, MaxSonnet46Option, MaxHaiku45Option) are deleted with it",
          sourceSha256: digests["utils/model/modelOptions.ts"],
          portSha256: digest(options),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "main.tsx",
          change:
            "the import and the `void fetchBootstrapData()` call with its TODO go; the prefetch block around them is untouched. The `isClaudeAISubscriber` name in this file's utils/auth.js import block had no call site already, so it goes too — the import that carried the bootstrap call was the one place it looked live",
          sourceSha256: digests["main.tsx"],
          portSha256: digest(read("main.tsx")),
          coordinateUnit: "utf16-half-open",
        },
      ],
      removed: [
        "services/api/bootstrap.ts and utils/http.ts' withOAuth401Retry, whose only client it was",
        "the OAuth token check call and the apiKey/authToken/staging-baseURL trio in the Anthropic client setup",
        "the Pro-plan Opus 400 message, and the subscriber terms in the retry exemptions, the off-switch gate and the org-disabled guard",
        "the OAuth arm of getAuthHeaders, the subscriber betas push, the custom-betas warning, and the models.list betas option",
        "the Max/Team-Premium default-model arms and the four model-option builders they alone read",
      ],
      kept: [
        "the two OAuth bearer sources: getClaudeAIOAuthTokens() still returns the CLAUDE_CODE_OAUTH_TOKEN or file-descriptor token, so getAuthTokenSource, getAccountInformation, validateForceLoginOrg's shape and utils/errors.ts' hasStoredOAuth choice all keep their meaning",
        "handleOAuth401Error, checkAndRefreshOAuthTokenIfNeeded and getClaudeAIOAuthTokensAsync as the no-op stubs wave D step 2 left — services/mcp/client.ts and utils/fastMode.ts still call them",
        "the constants themselves in utils/auth.ts (isAnthropicAuthEnabled, isClaudeAISubscriber, getOauthAccountInfo, hasProfileScope, getSubscriptionType, the five is*Subscriber predicates, getSubscriptionName, getRateLimitTier, hasOpusAccess, isOverageProvisioningAllowed, isConsumerSubscriber): their remaining readers are the status/commands/onboarding surface a later package owns, and a predicate goes when its last reader does",
        "withRetry.ts' 401/revoked client re-read, which survives the removed refresh attempt",
      ],
      tsc: {
        command: "node_modules/.bin/tsc --noEmit --pretty false",
        cwd: root,
        exitCode: 0,
        diagnostics: 0,
        logSha256: digest(tscText),
      },
      validation:
        "Absence sweep over the ten touched files for every subscription constant and the oauth beta header; a tree-wide sweep proving the bootstrap module and its retry wrapper left no reference; each folded site asserted as the arm the false constant produced (the unconditional configureApiKeyHeaders call, the single-term apiKey config, the empty account_uuid, the two retry arms returning true, the two-guard org-disabled condition, the API-key-only getAuthHeaders with its three surviving user-agent helpers, the constant model description, the two-term merge guard); the four builders the deleted option block alone read asserted gone while the options the PAYG path shares are asserted present; tsc clean",
      remaining:
        "the subscriber reads this package leaves for the next one: utils/status.tsx, utils/statusNoticeDefinitions.tsx, utils/logoV2Utils.ts, commands.ts, commands/cost/index.ts, components/Onboarding.tsx, components/mcp/MCPRemoteServerMenu.tsx, utils/telemetryAttributes.ts, services/tips/tipRegistry.ts, utils/fastMode.ts, hooks/useApiKeyVerification.ts and utils/planModeV2.ts, plus the claude.ai MCP connector whose scope check the same producer fact kills and the prose in services/mcp/claudeai.ts that names the two predicates. Then the ~33 in-place CLI blocks, cli/transports/, the dependency-pruning pass and the utils/filePersistence/ rename",
      notes: [
        "two repair passes: the first run died on a duplicated `const billingInfo` anchor (2 occurrences, now cut with n=2) and the second on a brace a cut consumed (modelDisplayString's `} else if`, whose leading closer is now preserved), after which the script was re-run from a restored tree and reproduces the final state in one pass",
        "utils/http.ts' getAuthHeaders had no caller in the tree before this package either — the transports carry their own getAuthHeaders option — so its removal is not this package's to make; what changed is that its body is now the API-key arm alone",
      ],
    },
    null,
    2,
  ) + "\n",
)
console.log("PASS subscription constants folded out of the request path; bootstrap and its retry wrapper gone; tsc log empty")
