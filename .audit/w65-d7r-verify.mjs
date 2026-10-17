import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "6fa308a"
const digest = text => createHash("sha256").update(text).digest("hex")

// The connector was a pure account fetch: services/mcp/claudeai.ts asked
// `${BASE_API_URL}/v1/mcp_servers?limit=1000` with an OAuth bearer, gated on
// `tokens.scopes?.includes('user:mcp_servers')`. The only two token producers
// left in this build hardcode scopes ['user:inference'] (utils/auth.ts'
// hasProfileScope documents exactly that), so the gate was always false and
// the module always returned {}. Nothing could ever produce a claudeai-proxy
// config, which is why every branch keyed on that type was unreachable.
function rg(pattern) {
  try {
    return execFileSync("rg", [
      "-n", "--glob", "!node_modules", "--glob", "!*.w*bak", "--glob", "!*.json", "--glob", "!*.md",
      "-e", pattern, root,
    ], {encoding: "utf8"}).trim()
  } catch (e) {
    assert.equal(e.status, 1, `rg failed: ${e.message}`)
    return ""
  }
}

const read = p => fs.readFileSync(`${root}/${p}`, "utf8")

// 1. The connector module and every name it owned are gone.
assert.equal(
  fs.existsSync(`${root}/services/mcp/claudeai.ts`),
  false,
  "services/mcp/claudeai.ts is deleted",
)
assert.equal(
  rg("claudeai-proxy|fetchClaudeAIMcpConfigsIfEligible|markClaudeAiMcpConnected|hasClaudeAiMcpEverConnected|clearClaudeAIMcpConfigsCache|dedupClaudeAiMcpServers|claudeAiMcpEverConnected|McpClaudeAIProxy|ClaudeAIServerInfo|CLAUDEAI_SERVER_PREFIX|claude_ai_|tengu_claudeai_"),
  "",
  "a live reference to the connector family remains",
)
// The three OAuth-config fields the connector's transport and auth menu read.
assert.equal(rg("CLAUDE_AI_ORIGIN|MCP_PROXY_URL|MCP_PROXY_PATH"), "", "an oauth-config field only the connector read remains")

// 2. The predicates whose last reader the connector was.
assert.equal(
  rg("isAnthropicAuthEnabled|isClaudeAISubscriber|getOauthAccountInfo|shouldUseClaudeAIAuth|getClaudeAIOAuthTokensAsync|checkAndRefreshOAuthTokenIfNeeded"),
  "",
  "a auth predicate the connector kept alive remains",
)

// 3. What stays, with the reader that keeps it.
const auth = read("utils/auth.ts")
assert.match(
  auth,
  /\/\*\* Where the auth token is being sourced from, if any\. \*\/\nexport function getAuthTokenSource\(\) \{/,
  "getAuthTokenSource follows its doc comment after the deleted 1P predicate",
)
assert.match(auth, /export function hasProfileScope\(\): boolean \{/)
assert.match(auth, /export function handleOAuth401Error\(/)
assert.match(auth, /export const getClaudeAIOAuthTokens = memoize/)
assert.match(auth, /export function getAccountInformation\(\) \{/)
assert.match(
  auth,
  /\/\/ The plan names a token can carry\.\ntype SubscriptionType = 'max' \| 'team' \| 'enterprise' \| 'pro'\n/,
)
assert.doesNotMatch(auth, /\bAccountInfo\b/)
assert.match(
  auth,
  /  \/\/ no OAuth token to validate, the original's first guard — a constant-false\n  \/\/ auth-enabled check — is the whole function\.\n/,
)

const config = read("utils/config.ts")
assert.doesNotMatch(config, /AccountInfo|BillingType|claudeAiMcpEverConnected/)
assert.match(
  config,
  /export type NotificationChannel = \(typeof NOTIFICATION_CHANNELS\)\[number\]\n\n\/\/ TODO: 'emacs' is kept for backward compatibility/,
)
assert.match(config, /  preferredNotifChannel: NotificationChannel\n/)

const oauth = read("constants/oauth.ts")
assert.match(oauth, /  CLAUDE_AI_AUTHORIZE_URL: string\n/)
assert.match(oauth, /  OAUTH_FILE_SUFFIX: string\n\}/)
assert.match(oauth, /export const CLAUDE_AI_INFERENCE_SCOPE = 'user:inference' as const/)

// 4. Each host folded to the arm the absent connector left.
const main = read("main.tsx")
assert.doesNotMatch(main, /claudeai|ClaudeAIAuth/)
assert.match(
  main,
  /      const mcpPromise = isNonInteractiveSession\n        \? Promise\.resolve\(\{ clients: \[\], tools: \[\], commands: \[\] \}\)\n        : prefetchAllMcpResources\(regularMcpConfigs\)\n/,
)
assert.match(
  main,
  /        await connectMcpBatch\(regularMcpConfigs, 'regular'\)\n        profileCheckpoint\('after_connectMcp'\)\n\n        \/\/ In headless mode, start deferred prefetches immediately/,
)

const hook = read("services/mcp/useManageMCPConnections.ts")
assert.equal(
  hook.split("await getClaudeCodeMcpConfigs(dynamicMcpConfig)").length - 1,
  2,
  "both config loads call getClaudeCodeMcpConfigs with the dynamic servers alone",
)
assert.match(hook, /      const allConfigs = configs\n/)
assert.match(hook, /        enterprise: 0,\n        global: 0,\n        project: 0,\n        user: 0,\n        plugin: 0,\n      \}/)
assert.doesNotMatch(hook, /claudeai|Phase 2|extraDedup/)

const client = read("services/mcp/client.ts")
assert.match(client, /  transportType: 'sse' \| 'http',\n/)
assert.match(client, /    sse: 'SSE',\n    http: 'HTTP',\n  \}\n/)
assert.match(
  client,
  /      \} else if \(serverRef\.type === 'sdk'\) \{\n        throw new Error\('SDK servers should be handled in print\.ts'\)\n      \} else if \(isMcpStdioServerConfig\(serverRef\)\) \{/,
)
assert.match(client, /        if \(transportType === 'http' && isMcpSessionExpiredError\(error\)\) \{/)
assert.match(client, /        if \(transportType === 'sse' \|\| transportType === 'http'\) \{/)
assert.match(
  client,
  /        \(config\.type === 'http' \|\| config\.type === 'sse'\) &&\n        \(\(await isMcpAuthCached\(name\)\) \|\|/,
)
assert.match(client, /        e\.message\.includes\('Connection closed'\) &&\n        config\.type === 'http'\n/)
assert.doesNotMatch(client, /createClaudeAiProxyFetch|getClaudeAIOAuthTokens|getOauthConfig/)

const types = read("services/mcp/types.ts")
assert.doesNotMatch(types, /claudeai/)
assert.match(types, /    'enterprise',\n    'managed',\n  \]\),\n\)/)

const mcpConfig = read("services/mcp/config.ts")
assert.doesNotMatch(mcpConfig, /claudeai|extraDedupTargets|dedupClaudeAi/)
assert.match(
  mcpConfig,
  /export async function getAllMcpConfigs\(\): Promise<\{\n  servers: Record<string, ScopedMcpServerConfig>\n  errors: PluginError\[\]\n\}> \{\n  return getClaudeCodeMcpConfigs\(\)\n\}\n/,
)
assert.match(mcpConfig, /    case 'sdk':\n      expanded = config\n      break\n  \}\n/)
assert.match(mcpConfig, /    case 'enterprise':\n      throw new Error\('Cannot add MCP server to scope: enterprise'\)\n  \}\n/)

const menu = read("components/mcp/MCPRemoteServerMenu.tsx")
assert.doesNotMatch(menu, /ClaudeAI|claudeAIAuth|claudeAIClearAuth|getOauthAccountInfo/)
assert.match(menu, /    const authCopy = server\.config\.oauth\?\.xaa\n/)
assert.match(
  menu,
  /  if \(isEffectivelyAuthenticated\) \{\n    menuOptions\.push\(\{\n      label: 'Re-authenticate',/,
)
assert.match(menu, /          <Box>\n            <Text bold>Auth: <\/Text>/)

const settings = read("components/mcp/MCPSettings.tsx")
assert.doesNotMatch(settings, /ClaudeAI/)
assert.match(settings, /      const defaultTab = 'Claude Code'\n/)

const list = read("components/mcp/MCPListPanel.tsx")
assert.doesNotMatch(list, /claudeAi/)
assert.match(
  list,
  /  const serversByScope = React\.useMemo\(\n    \(\) => groupServersByScope\(servers\),\n    \[servers\],\n  \)\n/,
)

const plugins = read("commands/plugin/ManagePlugins.tsx")
assert.doesNotMatch(plugins, /ClaudeAIServerInfo|claudeai-proxy/)
assert.match(plugins, /    let server: StdioServerInfo \| SSEServerInfo \| HTTPServerInfo\n/)

const notifs = read("hooks/notifs/useMcpConnectivityStatus.tsx")
assert.doesNotMatch(notifs, /claudeai|ClaudeAi/)
assert.match(notifs, /      client => client\.type === 'needs-auth',\n/)
assert.match(
  notifs,
  /    if \(\n      failedLocalClients\.length === 0 &&\n      needsAuthLocalServers\.length === 0\n    \) \{/,
)

const print = read("cli/print.ts")
assert.match(print, /        config\.type !== 'ws'\n      \) \{/)
assert.doesNotMatch(print, /claudeai/)

const schemas = read("entrypoints/sdk/coreSchemas.ts")
assert.match(
  schemas,
  /\/\/ Config type for status responses\nexport const McpServerStatusConfigSchema = lazySchema\(\(\) =>\n  McpServerConfigForProcessTransportSchema\(\),\n\)\n/,
)
assert.doesNotMatch(schemas, /claudeai/)
assert.doesNotMatch(read("entrypoints/sdk/coreTypes.ts"), /McpClaudeAIProxy/)

const meta = read("services/analytics/metadata.ts")
assert.match(
  meta,
  /export function isAnalyticsToolDetailsLoggingEnabled\(\n  mcpServerBaseUrl: string \| undefined,\n\): boolean \{/,
)
assert.doesNotMatch(meta, /claudeai/)
const te = read("services/tools/toolExecution.ts")
assert.equal(
  te.split("mcpToolDetailsForAnalytics(tool.name, mcpServerBaseUrl)").length - 1,
  8,
  "every tool-level call site drops the now-unread server-type argument",
)
assert.equal(
  te.split("mcpToolDetailsForAnalytics(toolName, mcpServerBaseUrl)").length - 1,
  1,
)
assert.doesNotMatch(te, /mcpServerType, mcpServerBaseUrl/)

const norm = read("services/mcp/normalization.ts")
assert.match(
  norm,
  /export function normalizeNameForMCP\(name: string\): string \{\n  return name\.replace\(\/\[\^a-zA-Z0-9_-\]\/g, '_'\)\n\}\n/,
)

assert.match(
  read("hooks/useApiKeyVerification.ts"),
  /  \/\/ This build has no OAuth auth path, so the source's guard took the 'valid'\n  \/\/ arm on every call and the key-verification path below it was unreachable\.\n/,
)
assert.match(
  read("utils/managedEnv.ts"),
  / \* env vars that the remote's ~\/\.claude settings\.env MUST NOT clobber\. Strip\n \* them from any settings-sourced env object\.\n/,
)
assert.doesNotMatch(read("tools/MCPTool/classifyForCollapse.ts"), /claude_ai_/)
assert.doesNotMatch(read("commands/commit-push-pr.ts"), /claude_ai_/)

// 5. The gate.
const tscText = fs.readFileSync(new URL("w65-d7r-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const digests = {}
for (const f of [
  "services/mcp/claudeai.ts",
  "services/mcp/types.ts",
  "services/mcp/config.ts",
  "services/mcp/utils.ts",
  "services/mcp/client.ts",
  "services/mcp/useManageMCPConnections.ts",
  "services/mcp/normalization.ts",
  "main.tsx",
  "utils/auth.ts",
  "utils/config.ts",
  "constants/oauth.ts",
  "components/mcp/MCPRemoteServerMenu.tsx",
  "components/mcp/MCPSettings.tsx",
  "services/analytics/metadata.ts",
  "entrypoints/sdk/coreSchemas.ts",
]) {
  digests[f] = digest(execFileSync("git", ["-C", root, "show", `${before}:${f}`], {encoding: "utf8"}))
}

fs.writeFileSync(
  new URL("w65-d7r-source-evidence.json", import.meta.url),
  JSON.stringify(
    {
      before,
      kind: "claude.ai MCP connector removed whole (no ported bodies; the module was a network fetch under a constant-false scope gate)",
      surface:
        "services/mcp/claudeai.ts (the memoized /v1/mcp_servers?limit=1000 fetch with an OAuth bearer, the anthropic-beta header and the user:mcp_servers scope gate, plus its cache-clear and ever-connected helpers), the claudeai-proxy config schema and transport in services/mcp/{types,config,utils,client}.ts, the two-phase claude.ai loading lane in useManageMCPConnections and the -p prefetch/merge/dedup/connect batch in main.tsx, MCPRemoteServerMenu's connector auth and clear-auth flow with the claude.ai web URLs, the connector branches in MCPSettings, MCPListPanel and ManagePlugins, the prior-connected connectivity notices, the SDK status/config schemas, and the analytics gate's claudeai-proxy arm",
      decisiveFact:
        "the connector's eligibility check required tokens.scopes to include 'user:mcp_servers', but the only two OAuthTokens producers this build retains (CLAUDE_CODE_OAUTH_TOKEN and the inherited file descriptor) hardcode scopes ['user:inference'] — the fact hasProfileScope's own comment records — so fetchClaudeAIMcpConfigsIfEligible could only return {}. No claudeai-proxy config could ever exist, making every branch keyed on that type unreachable. Independently, isAnthropicAuthEnabled() is `return false`, so isClaudeAISubscriber() was false and getOauthAccountInfo() always undefined; the connector was their last reader",
      evidence: [
        {
          file: "services/mcp/claudeai.ts",
          change:
            "removed whole (164 lines): the memoized fetch of `${getOauthConfig().BASE_API_URL}/v1/mcp_servers?limit=1000` with `Authorization: Bearer` and `anthropic-beta: mcp-servers-2025-12-04`, gated on ENABLE_CLAUDEAI_MCP_SERVERS and the user:mcp_servers scope; it built {type:'claudeai-proxy', url, id, scope:'claudeai'} configs under collision-suffixed `claude.ai <name>` keys, with clearClaudeAIMcpConfigsCache, markClaudeAiMcpConnected and hasClaudeAiMcpEverConnected",
          sourceSha256: digests["services/mcp/claudeai.ts"],
          portSha256: null,
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "services/mcp/types.ts",
          change:
            "the 'claudeai' ConfigScope member, McpClaudeAIProxyServerConfigSchema with its union member, and the McpClaudeAIProxyServerConfig type are deleted",
          sourceSha256: digests["services/mcp/types.ts"],
          portSha256: digest(types),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "services/mcp/config.ts",
          change:
            "dedupClaudeAiMcpServers is deleted (its only callers were the connector merges), getClaudeCodeMcpConfigs loses its extraDedupTargets parameter and the spread it fed, getAllMcpConfigs becomes a bare getClaudeCodeMcpConfigs() call, the expand switch loses its claudeai-proxy arm, addMcpConfig loses its claudeai scope throw, and the comments that described the connector fetch and merge are rewritten",
          sourceSha256: digests["services/mcp/config.ts"],
          portSha256: digest(mcpConfig),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "services/mcp/utils.ts",
          change:
            "both scope switches lose their claudeai case, getMcpServerScope loses the `claude_ai_` prefix fallback (no source of such names remains), and the transport-skip comment drops claudeai-proxy",
          sourceSha256: digests["services/mcp/utils.ts"],
          portSha256: digest(read("services/mcp/utils.ts")),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "services/mcp/client.ts",
          change:
            "createClaudeAiProxyFetch is deleted (it attached the OAuth bearer and retried a 401 through handleOAuth401Error, logging tengu_mcp_claudeai_proxy_401), the claudeai-proxy transport branch building the MCP_PROXY_URL/MCP_PROXY_PATH URL goes, handleRemoteAuthFailure narrows to sse/http, the proxy arm of the connection-failure branch goes, both markClaudeAiMcpConnected blocks go, and the four session-expiry/auth-cache comparisons fold to their http/sse terms; the auth import block drops checkAndRefreshOAuthTokenIfNeeded, getClaudeAIOAuthTokens and handleOAuth401Error",
          sourceSha256: digests["services/mcp/client.ts"],
          portSha256: digest(client),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "services/mcp/useManageMCPConnections.ts",
          change:
            "the two-phase lane folds to one: the claudeaiPromise prefetch with its cache clear, the Phase 2 policy filter, dedup and pending-client merge all go, getClaudeCodeMcpConfigs takes the dynamic servers alone, the counts object loses its claudeai bucket, and the phase comments are rewritten",
          sourceSha256: digests["services/mcp/useManageMCPConnections.ts"],
          portSha256: digest(hook),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "main.tsx",
          change:
            "the -p claudeaiConfigPromise prefetch with its enterprise/strict/bare gate and policy warning go, the claudeaiMcpPromise prefetch and the uniqBy merge fold to the single local prefetch, and the lazy dedup + connectMcpBatch('claudeai') block with its 5s CLAUDE_AI_MCP_TIMEOUT_MS race goes; the imports only that block read (fetchClaudeAIMcpConfigsIfEligible, dedupClaudeAiMcpServers, getMcpServerSignature, clearServerCache, the two exclude helpers, pickBy, getOauthConfig) are removed",
          sourceSha256: digests["main.tsx"],
          portSha256: digest(main),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "components/mcp/MCPRemoteServerMenu.tsx",
          change:
            "the connector auth surface is deleted: the five claude.ai states, handleClaudeAIAuthComplete and handleClaudeAIClearAuthComplete, both Escape keybindings, the Enter/copy branches of useInput, handleClaudeAIAuth (which built /api/organizations/<org>/mcp/start-auth/<serverId> or /settings/connectors from getOauthConfig().CLAUDE_AI_ORIGIN) and handleClaudeAIClearAuth, the two connector render screens, the connector menu branch and its Select cases, the toggle/reconnect analytics blocks, both claudeai-proxy early returns, and the transport guard on the Auth row; the menu options now branch only on isEffectivelyAuthenticated",
          sourceSha256: digests["components/mcp/MCPRemoteServerMenu.tsx"],
          portSha256: digest(menu),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "components/mcp/{MCPSettings,MCPListPanel}.tsx + commands/plugin/ManagePlugins.tsx",
          change:
            "MCPSettings loses the isClaudeAIProxy transport branch and its type import, and its defaultTab folds to 'Claude Code'; MCPListPanel loses the claude.ai filter, its memo, its items loop, its dep entry and its render section; ManagePlugins loses the claudeai-proxy detail branch, the two connector fallback assignments and the ClaudeAIServerInfo union members",
          sourceSha256: digests["components/mcp/MCPSettings.tsx"],
          portSha256: digest(settings),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "hooks/notifs/useMcpConnectivityStatus.tsx",
          change:
            "the two claude.ai client filters and their notifications are deleted along with the hasClaudeAiMcpEverConnected import; the surviving local filters lose their always-true claudeai-proxy exclusions",
          sourceSha256: digests["hooks/notifs/useMcpConnectivityStatus.tsx"],
          portSha256: digest(notifs),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "entrypoints/sdk/{coreSchemas,coreTypes}.ts + cli/{print.ts,handlers/mcp.tsx}",
          change:
            "the proxy schema is deleted and McpServerStatusConfigSchema collapses to McpServerConfigForProcessTransportSchema (the scope description loses its claudeai example); print.ts loses the proxy status-config branch and the applyPluginMcpDiff exclusion; handlers/mcp.tsx loses the proxy print branch",
          sourceSha256: digests["entrypoints/sdk/coreSchemas.ts"],
          portSha256: digest(schemas),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "services/analytics/metadata.ts + services/tools/toolExecution.ts",
          change:
            "the analytics gate's claudeai-proxy arm and its doc bullet go, which orphans the mcpServerType parameter of isAnalyticsToolDetailsLoggingEnabled and mcpToolDetailsForAnalytics; both signatures drop it and all nine toolExecution call sites drop the argument",
          sourceSha256: digests["services/analytics/metadata.ts"],
          portSha256: digest(meta),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "services/mcp/normalization.ts + tools/MCPTool/classifyForCollapse.ts + commands/commit-push-pr.ts",
          change:
            "normalizeNameForMCP loses the `claude.ai ` prefix special case (the collapse-and-trim that kept connector names clear of the __ delimiter) and becomes the single replace; the two comments that used a connector name as their example are rewritten, and the connector tool name leaves commit-push-pr's allowedTools list",
          sourceSha256: digests["services/mcp/normalization.ts"],
          portSha256: digest(norm),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/config.ts",
          change:
            "claudeAiMcpEverConnected (the prior-connected gate for the connector notices) is deleted together with AccountInfo and the BillingType alias — the shape the deleted getOauthAccountInfo returned, and with no writer or reader left in the tree",
          sourceSha256: digests["utils/config.ts"],
          portSha256: digest(config),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "constants/oauth.ts",
          change:
            "CLAUDE_AI_ORIGIN with its doc block, MCP_PROXY_URL and MCP_PROXY_PATH leave the OauthConfig type and all four config arms (prod, staging, local, custom-override); their only readers were the connector transport and the auth menu. The authorize URLs, the scope constants and every other field stay",
          sourceSha256: digests["constants/oauth.ts"],
          portSha256: digest(oauth),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/auth.ts",
          change:
            "isAnthropicAuthEnabled, shouldUseClaudeAIAuth, isClaudeAISubscriber and getOauthAccountInfo are deleted — the connector was the last reader of all four — together with the now-readerless getClaudeAIOAuthTokensAsync and checkAndRefreshOAuthTokenIfNeeded stubs; handleOAuth401Error stays for utils/fastMode.ts. The AccountInfo import, the inference-scope import and the comment that named the deleted predicate are removed. Kept in full: getClaudeAIOAuthTokens with both producers, getAuthTokenSource, getAccountInformation, hasProfileScope and the API-key surface",
          sourceSha256: digests["utils/auth.ts"],
          portSha256: digest(auth),
          coordinateUnit: "utf16-half-open",
        },
      ],
      removed: [
        "services/mcp/claudeai.ts and its three helpers",
        "the claudeai-proxy config type, transport, auth-failure handling, status echo and analytics arm",
        "the two-phase claude.ai loading lane in useManageMCPConnections and the -p prefetch/merge/dedup/connect lane in main.tsx, including the 5s connector timeout",
        "MCPRemoteServerMenu's connector auth and clear-auth flow, the connector menu branch and its analytics events",
        "the connector list/default-tab/detail branches in MCPSettings, MCPListPanel and ManagePlugins, and the prior-connected connectivity notices",
        "the four auth predicates whose last reader the connector was, plus two token stubs that existed only for the MCP client",
        "CLAUDE_AI_ORIGIN, MCP_PROXY_URL and MCP_PROXY_PATH from the OAuth config table",
      ],
      kept: [
        "the whole API-key and bearer surface: getAnthropicApiKey, the keychain and apiKeyHelper resolution, getClaudeAIOAuthTokens, getAuthTokenSource, getAccountInformation, validateForceLoginOrg and handleOAuth401Error (utils/fastMode.ts still calls it)",
        "hasProfileScope and the SubscriptionType-typed field of OAuthTokens, which is externally supplied even though no predicate reads it any more",
        "getAuthTokenSource's and validateForceLoginOrg's retained shapes, with the comments that named the deleted predicates rewritten",
        "the CCR proxy URL unwrapping used by signature dedup, and getMcpServerSignature/dedupPluginMcpServers, which keep their other readers",
        "forceLoginMethod setting, the login-method selector whose claudeai value describes the OAuth login surface, not this connector",
      ],
      tsc: {
        command: "node_modules/.bin/tsc --noEmit --pretty false",
        cwd: root,
        exitCode: 0,
        diagnostics: 0,
        logSha256: digest(tscText),
      },
      validation:
        "Tree-wide absence sweep over the connector family (module, proxy type, fetch/mark/cache helpers, ever-connected field, menu auth flow, analytics events, the `claude.ai ` normalization prefix and the `claude_ai_` name shape), over the three oauth-config fields only the connector read, and over the six auth predicates/stubs the connector kept alive; survivor assertions for every retained token/auth helper with the reader that keeps it; each host asserted as the arm the absent connector left (the single mcpPromise prefetch, the direct connectMcpBatch→headless seam, both getClaudeCodeMcpConfigs call sites, the two-member auth-failure union, the sdk→stdio transport adjacency, the folded session-expiry terms, the isEffectivelyAuthenticated menu, the constant default tab, the local-only connectivity filters, the collapsed status schema, the two-argument analytics gate); tsc clean; import-graph orphan scan stays at its ten legitimate entries with the file count down by exactly the deleted module",
      remaining:
        "utils/fastMode.ts's account-status path (hasProfileScope's last reader), the ~33 in-place CLI blocks, cli/transports/, the dependency-pruning pass (nine zero-importer dependencies) and the utils/filePersistence/ rename. The claude.ai mentions that remain are not the connector: the bridge-era prose in cli/structuredIO.ts, the retained login-method setting, the CommandAvailability comments and the product base URLs",
      notes: [
        "two repair passes after the first full run: four comparison-fold sites in client.ts that strict type narrowing rejected once the union lost its member, and a normalization special case plus three comment/allowlist examples that still named connector-shaped strings; each was fixed in w65-d7r1.py and the tree was restored from HEAD before the final replay, which reproduces the final state in one pass",
        "the connector's two interactive branches in MCPRemoteServerMenu were reachable only through its own menu, and the two MCPToolListView fallbacks that built a ClaudeAIServerInfo were reachable only from a detail branch that already excluded the type, so removing them leaves no unreachable code behind",
      ],
    },
    null,
    2,
  ) + "\n",
)
console.log("PASS claude.ai connector gone; connector hosts folded; last-reader predicates deleted; tsc log empty")
