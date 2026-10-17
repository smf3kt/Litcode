# -*- coding: utf-8 -*-
"""Wave D step 7r cut: the claude.ai MCP connector.

Deletes services/mcp/claudeai.ts, the claudeai-proxy config type and its
transports, the two-phase claude.ai loading lane, the connector auth menu,
the connectivity notices, and the three auth predicates whose last reader
the connector was.
"""
import os
import sys

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


def rm(rel):
    path = os.path.join(ROOT, rel)
    assert os.path.exists(path), (rel, 'missing')
    os.remove(path)


# ---------------------------------------------------------------- module
rm('services/mcp/claudeai.ts')

# ---------------------------------------------------------------- types.ts
T = 'services/mcp/types.ts'
cut(T, "    'claudeai',\n")
cut(T, """// Config type for Claude.ai proxy servers
export const McpClaudeAIProxyServerConfigSchema = lazySchema(() =>
  z.object({
    type: z.literal('claudeai-proxy'),
    url: z.string(),
    id: z.string(),
  }),
)

""")
cut(T, "    McpClaudeAIProxyServerConfigSchema(),\n")
cut(T, """export type McpClaudeAIProxyServerConfig = z.infer<
  ReturnType<typeof McpClaudeAIProxyServerConfigSchema>
>
""")

# ---------------------------------------------------------------- config.ts
C = 'services/mcp/config.ts'
cut(C, "import { fetchClaudeAIMcpConfigsIfEligible } from './claudeai.js'\n")
cut_between(
    C,
    "/**\n * Filter claude.ai connectors, dropping any whose signature matches an enabled",
    "/**\n * Convert a URL pattern with wildcards to a RegExp",
)
cut(C, """    case 'claudeai-proxy':
      expanded = config
      break
""")
cut(C, """    case 'claudeai':
      throw new Error('Cannot add MCP server to scope: claudeai')
""")
cut(C, """ * This is fast: only local file reads; no awaited network calls on the
 * critical path. The optional extraDedupTargets promise (e.g. the in-flight
 * claude.ai connector fetch) is awaited only after loadAllPluginsCacheOnly() completes,
 * so the two overlap rather than serialize.
""", """ * This is fast: only local file reads; no awaited network calls on the
 * critical path.
""")
cut(C, """export async function getClaudeCodeMcpConfigs(
  dynamicServers: Record<string, ScopedMcpServerConfig> = {},
  extraDedupTargets: Promise<
    Record<string, ScopedMcpServerConfig>
  > = Promise.resolve({}),
): Promise<{
""", """export async function getClaudeCodeMcpConfigs(
  dynamicServers: Record<string, ScopedMcpServerConfig> = {},
): Promise<{
""")
cut(C, "  const extraTargets = await extraDedupTargets\n")
cut(C, "    ...extraTargets,\n")
cut(C, """/**
 * Get all MCP configurations across all scopes, including claude.ai servers.
 * This may be slow due to network calls - use getClaudeCodeMcpConfigs() for fast startup.
 * @returns All server configurations with appropriate scopes
 */
export async function getAllMcpConfigs(): Promise<{
  servers: Record<string, ScopedMcpServerConfig>
  errors: PluginError[]
}> {
  // In enterprise mode, don't load claude.ai servers (enterprise has exclusive control)
  if (doesEnterpriseMcpConfigExist()) {
    return getClaudeCodeMcpConfigs()
  }

  // Kick off the claude.ai fetch before getClaudeCodeMcpConfigs so it overlaps
  // with loadAllPluginsCacheOnly() inside. Memoized — the awaited call below is a cache hit.
  const claudeaiPromise = fetchClaudeAIMcpConfigsIfEligible()
  const { servers: claudeCodeServers, errors } = await getClaudeCodeMcpConfigs(
    {},
    claudeaiPromise,
  )
  const { allowed: claudeaiMcpServers } = filterMcpServersByPolicy(
    await claudeaiPromise,
  )

  // Suppress claude.ai connectors that duplicate an enabled manual server.
  // Keys never collide (`slack` vs `claude.ai Slack`) so the merge below
  // won't catch this — need content-based dedup by URL signature.
  const { servers: dedupedClaudeAi } = dedupClaudeAiMcpServers(
    claudeaiMcpServers,
    claudeCodeServers,
  )

  // Merge with claude.ai having lowest precedence
  const servers = Object.assign({}, dedupedClaudeAi, claudeCodeServers)

  return { servers, errors }
}
""", """/**
 * Get all MCP configurations across all scopes.
 * @returns All server configurations with appropriate scopes
 */
export async function getAllMcpConfigs(): Promise<{
  servers: Record<string, ScopedMcpServerConfig>
  errors: PluginError[]
}> {
  return getClaudeCodeMcpConfigs()
}
""")

# ---------------------------------------------------------------- utils.ts
U = 'services/mcp/utils.ts'
cut(U, """    case 'claudeai':
      return 'claude.ai'
""")
cut(U, """    case 'claudeai':
      return 'claude.ai config'
""")
cut(U, """  // Fallback: claude.ai servers have normalized names starting with "claude_ai_"
  // but aren't in getMcpConfigByName (they're fetched async separately)
  if (!serverConfig && mcpInfo.serverName.startsWith('claude_ai_')) {
    return 'claudeai'
  }

""")
cut(U, "    // Skip unsupported transport types (sdk, claudeai-proxy, sse-ide, ws-ide)",
    "    // Skip unsupported transport types (sdk, sse-ide, ws-ide)")

# ---------------------------------------------------------------- client.ts
K = 'services/mcp/client.ts'
cut(K, "import { getOauthConfig } from '../../constants/oauth.js'\n")
cut(K, "import { markClaudeAiMcpConnected } from './claudeai.js'\n")
cut(K, """import {
  checkAndRefreshOAuthTokenIfNeeded,
  getClaudeAIOAuthTokens,
  handleOAuth401Error,
} from '../../utils/auth.js'
""")
cut(K, " * Shared handler for sse/http/claudeai-proxy auth failures during connect:",
    " * Shared handler for sse/http auth failures during connect:")
cut(K, "  transportType: 'sse' | 'http' | 'claudeai-proxy',\n",
    "  transportType: 'sse' | 'http',\n")
cut(K, "    'claudeai-proxy': 'claude.ai proxy',\n")
cut_between(
    K,
    "/**\n * Fetch wrapper for claude.ai proxy connections.",
    "// Minimal interface for WebSocket instances passed to mcpWebSocketTransport",
)
cut_between(
    K,
    "      } else if (serverRef.type === 'claudeai-proxy') {",
    "      } else if (isMcpStdioServerConfig(serverRef)) {",
)
cut_between(
    K,
    "        } else if (\n          serverRef.type === 'claudeai-proxy' &&\n          error instanceof Error\n        ) {",
    "        } else if (\n          serverRef.type === 'sse-ide' ||",
)
cut(K, """    if (config.type === 'claudeai-proxy') {
      markClaudeAiMcpConnected(name)
    }

""")
cut(K, """      if (config.type === 'claudeai-proxy') {
        markClaudeAiMcpConnected(name)
      }

""")
cut(K, """        if (
          (transportType === 'http' || transportType === 'claudeai-proxy') &&
          isMcpSessionExpiredError(error)
        ) {
""", """        if (transportType === 'http' && isMcpSessionExpiredError(error)) {
""")
cut(K, """        if (
          transportType === 'sse' ||
          transportType === 'http' ||
          transportType === 'claudeai-proxy'
        ) {
""", """        if (transportType === 'sse' || transportType === 'http') {
""")
cut(K, """      if (
        (config.type === 'claudeai-proxy' ||
          config.type === 'http' ||
          config.type === 'sse') &&
        ((await isMcpAuthCached(name)) ||
          ((config.type === 'http' || config.type === 'sse') &&
            hasMcpDiscoveryButNoToken(name, config)))
      ) {
""", """      if (
        (config.type === 'http' || config.type === 'sse') &&
        ((await isMcpAuthCached(name)) ||
          ((config.type === 'http' || config.type === 'sse') &&
            hasMcpDiscoveryButNoToken(name, config)))
      ) {
""")
cut(K, """        e.message.includes('Connection closed') &&
        (config.type === 'http' || config.type === 'claudeai-proxy')
""", """        e.message.includes('Connection closed') &&
        config.type === 'http'
""")

# ------------------------------------------------- useManageMCPConnections.ts
H = 'services/mcp/useManageMCPConnections.ts'
cut(H, """import {
  dedupClaudeAiMcpServers,
  doesEnterpriseMcpConfigExist,
  filterMcpServersByPolicy,
  getClaudeCodeMcpConfigs,
  isMcpServerDisabled,
  setMcpServerEnabled,
} from 'src/services/mcp/config.js'
""", """import {
  getClaudeCodeMcpConfigs,
  isMcpServerDisabled,
  setMcpServerEnabled,
} from 'src/services/mcp/config.js'
""")
cut(H, """import {
  clearClaudeAIMcpConfigsCache,
  fetchClaudeAIMcpConfigsIfEligible,
} from './claudeai.js'
""")
cut(H, """  // Load MCP configs and connect to servers
  // Two-phase loading: Claude Code configs first (fast), then claude.ai configs (may be slow)
""", """  // Load MCP configs and connect to servers
""")
cut(H, """      // Clear claude.ai MCP cache so we fetch fresh configs with current auth
      // state. This is important when authVersion changes (e.g., after login/
      // logout). Kick off the fetch now so it overlaps with loadAllPlugins()
      // inside getClaudeCodeMcpConfigs; it's awaited only at the dedup step.
      // Phase 2 below awaits the same promise — no second network call.
      let claudeaiPromise: Promise<Record<string, ScopedMcpServerConfig>>
      if (isStrictMcpConfig || doesEnterpriseMcpConfigExist()) {
        claudeaiPromise = Promise.resolve({})
      } else {
        clearClaudeAIMcpConfigsCache()
        claudeaiPromise = fetchClaudeAIMcpConfigsIfEligible()
      }

      // Phase 1: Load Claude Code configs. Plugin MCP servers that duplicate a
      // --mcp-config entry or a claude.ai connector are suppressed here so they
      // don't connect alongside the connector in Phase 2.
""", """      // Load Claude Code configs. Plugin MCP servers that duplicate a
      // --mcp-config entry are suppressed here.
""")
cut(H, "          : await getClaudeCodeMcpConfigs(dynamicMcpConfig, claudeaiPromise)",
    "          : await getClaudeCodeMcpConfigs(dynamicMcpConfig)")
cut(H, "      // Start connecting to Claude Code servers (don't wait - runs concurrently with Phase 2)\n",
    "      // Start connecting (don't wait for the results)\n")
cut_between(
    H,
    "      // Phase 2: Await claude.ai configs",
    "      // Log server counts after both phases complete",
)
cut(H, "      // Log server counts after both phases complete\n",
    "      // Log server counts\n")
cut(H, "      const allConfigs = { ...configs, ...claudeaiConfigs }\n",
    "      const allConfigs = configs\n")
cut(H, "        claudeai: 0,\n")
cut(H, "        else if (serverConfig.scope === 'claudeai') counts.claudeai++\n")

# ---------------------------------------------------------------- main.tsx
M = 'main.tsx'
cut(M, "import pickBy from 'lodash-es/pickBy.js'\n")
cut(M, "import { getOauthConfig } from './constants/oauth.js'\n")
cut(M, "import { fetchClaudeAIMcpConfigsIfEligible } from 'src/services/mcp/claudeai.js'\n")
cut(M, "import { clearServerCache } from 'src/services/mcp/client.js'\n")
cut(M, "  dedupClaudeAiMcpServers,\n")
cut(M, "  getMcpServerSignature,\n")
cut(M, """import {
  excludeCommandsByServer,
  excludeResourcesByServer,
} from 'src/services/mcp/utils.js'
""")
cut(M, """      // claude.ai config fetch: -p mode only (interactive uses useManageMCPConnections
      // two-phase loading). Kicked off here to overlap with setup(); awaited
      // before runHeadless so single-turn -p sees connectors. Skipped under
      // enterprise/strict MCP to preserve policy boundaries.
      const claudeaiConfigPromise: Promise<
        Record<string, ScopedMcpServerConfig>
      > =
        isNonInteractiveSession &&
        !strictMcpConfig &&
        !doesEnterpriseMcpConfigExist() &&
        // --bare / SIMPLE: skip claude.ai proxy servers (datadog, Gmail,
        // Slack, BigQuery, PubMed — 6-14s each to connect). Scripted calls
        // that need MCP pass --mcp-config explicitly.
        !isBareMode()
          ? fetchClaudeAIMcpConfigsIfEligible().then(configs => {
              const { allowed, blocked } = filterMcpServersByPolicy(configs)
              if (blocked.length > 0) {
                process.stderr.write(
                  `Warning: claude.ai MCP ${plural(blocked.length, 'server')} blocked by enterprise policy: ${blocked.join(', ')}%s`,
                )
              }
              return allowed
            })
          : Promise.resolve({})

""" % '\\n')
cut(M, """      const localMcpPromise = isNonInteractiveSession
        ? Promise.resolve({ clients: [], tools: [], commands: [] })
        : prefetchAllMcpResources(regularMcpConfigs)
      const claudeaiMcpPromise = isNonInteractiveSession
        ? Promise.resolve({ clients: [], tools: [], commands: [] })
        : claudeaiConfigPromise.then(configs =>
            Object.keys(configs).length > 0
              ? prefetchAllMcpResources(configs)
              : { clients: [], tools: [], commands: [] },
          )
      // Merge with dedup by name: each prefetchAllMcpResources call independently
      // adds helper tools (ListMcpResourcesTool, ReadMcpResourceTool) via
      // local dedup flags, so merging two calls can yield duplicates. print.ts
      // already uniqBy's the final tool pool, but dedup here keeps appState clean.
      const mcpPromise = Promise.all([
        localMcpPromise,
        claudeaiMcpPromise,
      ]).then(([local, claudeai]) => ({
        clients: [...local.clients, ...claudeai.clients],
        tools: uniqBy([...local.tools, ...claudeai.tools], 'name'),
        commands: uniqBy([...local.commands, ...claudeai.commands], 'name'),
      }))
""", """      const mcpPromise = isNonInteractiveSession
        ? Promise.resolve({ clients: [], tools: [], commands: [] })
        : prefetchAllMcpResources(regularMcpConfigs)
""")
cut(M, """        // Zero-server case is free via the early return in connectMcpBatch.
        // Connectors parallelize inside getMcpToolsCommandsAndResources
        // (processBatched with Promise.all). claude.ai is awaited too — its
        // fetch was kicked off early (line ~2558) so only residual time blocks
        // here. --bare skips claude.ai entirely for perf-sensitive scripts.
""", """        // Zero-server case is free via the early return in connectMcpBatch.
        // Connectors parallelize inside getMcpToolsCommandsAndResources
        // (processBatched with Promise.all). --bare skips auto-discovered
        // servers entirely for perf-sensitive scripts.
""")
cut_between(
    M,
    "        // Dedup: suppress plugin MCP servers that duplicate a claude.ai",
    "        // In headless mode, start deferred prefetches immediately (no user typing delay)",
    "\n",
)

# ------------------------------------------------- useMcpConnectivityStatus.tsx
N = 'hooks/notifs/useMcpConnectivityStatus.tsx'
cut(N, "import { hasClaudeAiMcpEverConnected } from '../../services/mcp/claudeai.js'\n")
cut(N, """    const failedLocalClients = mcpClients.filter(
      client =>
        client.type === 'failed' &&
        client.config.type !== 'sse-ide' &&
        client.config.type !== 'ws-ide' &&
        client.config.type !== 'claudeai-proxy',
    )
    // claude.ai failures get a separate notification: they almost always indicate
    // a toolbox-service outage (shared auth backend), not a local config issue.
    // Only flag connectors that have previously connected successfully — an
    // org-configured connector that's been needs-auth since it appeared is one
    // the user has ignored and shouldn't nag about; one that was working
    // yesterday and is now failed is a state change worth surfacing.
    const failedClaudeAiClients = mcpClients.filter(
      client =>
        client.type === 'failed' &&
        client.config.type === 'claudeai-proxy' &&
        hasClaudeAiMcpEverConnected(client.name),
    )
    const needsAuthLocalServers = mcpClients.filter(
      client =>
        client.type === 'needs-auth' && client.config.type !== 'claudeai-proxy',
    )
    const needsAuthClaudeAiServers = mcpClients.filter(
      client =>
        client.type === 'needs-auth' &&
        client.config.type === 'claudeai-proxy' &&
        hasClaudeAiMcpEverConnected(client.name),
    )
    if (
      failedLocalClients.length === 0 &&
      failedClaudeAiClients.length === 0 &&
      needsAuthLocalServers.length === 0 &&
      needsAuthClaudeAiServers.length === 0
    ) {
""", """    const failedLocalClients = mcpClients.filter(
      client =>
        client.type === 'failed' &&
        client.config.type !== 'sse-ide' &&
        client.config.type !== 'ws-ide',
    )
    const needsAuthLocalServers = mcpClients.filter(
      client => client.type === 'needs-auth',
    )
    if (
      failedLocalClients.length === 0 &&
      needsAuthLocalServers.length === 0
    ) {
""")
cut(N, """    if (failedClaudeAiClients.length > 0) {
      addNotification({
        key: 'mcp-claudeai-failed',
        jsx: (
          <>
            <Text color="error">
              {failedClaudeAiClients.length} claude.ai{' '}
              {failedClaudeAiClients.length === 1 ? 'connector' : 'connectors'}{' '}
              unavailable
            </Text>
            <Text dimColor> · /mcp</Text>
          </>
        ),
        priority: 'medium',
      })
    }
""")
cut(N, """    if (needsAuthClaudeAiServers.length > 0) {
      addNotification({
        key: 'mcp-claudeai-needs-auth',
        jsx: (
          <>
            <Text color="warning">
              {needsAuthClaudeAiServers.length} claude.ai{' '}
              {needsAuthClaudeAiServers.length === 1
                ? 'connector needs'
                : 'connectors need'}{' '}
              auth
            </Text>
            <Text dimColor> · /mcp</Text>
          </>
        ),
        priority: 'medium',
      })
    }
""")

# ------------------------------------------------- components/mcp/types.ts
cut('components/mcp/types.ts', "export type ClaudeAIServerInfo = any;\n")

# ------------------------------------------------- MCPRemoteServerMenu.tsx
R = 'components/mcp/MCPRemoteServerMenu.tsx'
cut(R, """import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
""", "import { logEvent } from 'src/services/analytics/index.js'\n")
cut(R, "import { getOauthConfig } from '../../constants/oauth.js'\n")
cut(R, "import { getOauthAccountInfo } from '../../utils/auth.js'\n")
cut(R, "import { openBrowser } from '../../utils/browser.js'\n")
cut(R, """import type {
  ClaudeAIServerInfo,
  HTTPServerInfo,
  SSEServerInfo,
} from './types.js'
""", "import type { HTTPServerInfo, SSEServerInfo } from './types.js'\n")
cut(R, "  server: SSEServerInfo | HTTPServerInfo | ClaudeAIServerInfo\n",
    "  server: SSEServerInfo | HTTPServerInfo\n")
cut(R, """  const [isClaudeAIAuthenticating, setIsClaudeAIAuthenticating] =
    useState(false)
  const [claudeAIAuthUrl, setClaudeAIAuthUrl] = useState<string | null>(null)
  const [isClaudeAIClearingAuth, setIsClaudeAIClearingAuth] = useState(false)
  const [claudeAIClearAuthUrl, setClaudeAIClearAuthUrl] = useState<
    string | null
  >(null)
  const [claudeAIClearAuthBrowserOpened, setClaudeAIClearAuthBrowserOpened] =
    useState(false)
""")
cut_between(
    R,
    "  const handleClaudeAIAuthComplete = React.useCallback(async () => {",
    "  // Escape to cancel authentication flow",
)
cut_between(
    R,
    "  // Escape to cancel Claude AI authentication",
    "  // Return key handling for authentication flows and 'c' to copy URL",
)
cut_between(
    R,
    "    if (key.return && isClaudeAIAuthenticating) {",
    "    if (input === 'c' && !urlCopied) {",
)
cut(R, """      const urlToCopy =
        authorizationUrl || claudeAIAuthUrl || claudeAIClearAuthUrl
""", "      const urlToCopy = authorizationUrl\n")
cut_between(
    R,
    "  const handleClaudeAIAuth = React.useCallback(async () => {",
    "  const handleToggleEnabled = React.useCallback(async () => {",
)
cut(R, """      if (server.config.type === 'claudeai-proxy') {
        logEvent('tengu_claudeai_mcp_toggle', {
          new_state: (wasEnabled
            ? 'disabled'
            : 'enabled') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        })
      }

""")
cut(R, """  }, [
    server.client.type,
    server.config.type,
    server.name,
    toggleMcpServer,
    onCancel,
    onComplete,
  ])
""", """  }, [
    server.client.type,
    server.name,
    toggleMcpServer,
    onCancel,
    onComplete,
  ])
""")
cut(R, """  const handleAuthenticate = React.useCallback(async () => {
    if (server.config.type === 'claudeai-proxy') return

    setIsAuthenticating(true)
""", """  const handleAuthenticate = React.useCallback(async () => {
    setIsAuthenticating(true)
""")
cut(R, """  const handleClearAuth = async () => {
    if (server.config.type === 'claudeai-proxy') return

    if (server.config) {
""", """  const handleClearAuth = async () => {
    if (server.config) {
""")
cut(R, """    const authCopy =
      server.config.type !== 'claudeai-proxy' && server.config.oauth?.xaa
        ? ' Authenticating via your identity provider'
        : ' A browser window will open for authentication'
""", """    const authCopy = server.config.oauth?.xaa
      ? ' Authenticating via your identity provider'
      : ' A browser window will open for authentication'
""")
cut_between(
    R,
    "  if (isClaudeAIAuthenticating) {",
    "  if (isClaudeAIClearingAuth) {",
)
cut_between(
    R,
    "  if (isClaudeAIClearingAuth) {",
    "  if (isReconnecting) {",
)
cut(R, """  if (server.config.type === 'claudeai-proxy') {
    if (server.client.type === 'connected') {
      menuOptions.push({
        label: 'Clear authentication',
        value: 'claudeai-clear-auth',
      })
    } else if (server.client.type !== 'disabled') {
      menuOptions.push({
        label: 'Authenticate',
        value: 'claudeai-auth',
      })
    }
  } else {
    if (isEffectivelyAuthenticated) {
      menuOptions.push({
        label: 'Re-authenticate',
        value: 'reauth',
      })
      menuOptions.push({
        label: 'Clear authentication',
        value: 'clear-auth',
      })
    }

    if (!isEffectivelyAuthenticated) {
      menuOptions.push({
        label: 'Authenticate',
        value: 'auth',
      })
    }
  }
""", """  if (isEffectivelyAuthenticated) {
    menuOptions.push({
      label: 'Re-authenticate',
      value: 'reauth',
    })
    menuOptions.push({
      label: 'Clear authentication',
      value: 'clear-auth',
    })
  }

  if (!isEffectivelyAuthenticated) {
    menuOptions.push({
      label: 'Authenticate',
      value: 'auth',
    })
  }
""")
cut(R, """          {server.transport !== 'claudeai-proxy' && (
            <Box>
              <Text bold>Auth: </Text>
              {isEffectivelyAuthenticated ? (
                <Text>
                  {color('success', theme)(figures.tick)} authenticated
                </Text>
              ) : (
                <Text>
                  {color('error', theme)(figures.cross)} not authenticated
                </Text>
              )}
            </Box>
          )}
""", """          <Box>
            <Text bold>Auth: </Text>
            {isEffectivelyAuthenticated ? (
              <Text>{color('success', theme)(figures.tick)} authenticated</Text>
            ) : (
              <Text>
                {color('error', theme)(figures.cross)} not authenticated
              </Text>
            )}
          </Box>
""")
cut(R, """                  case 'claudeai-auth':
                    await handleClaudeAIAuth()
                    break
                  case 'claudeai-clear-auth':
                    handleClaudeAIClearAuth()
                    break
""")
cut(R, """                      if (server.config.type === 'claudeai-proxy') {
                        logEvent('tengu_claudeai_mcp_reconnect', {
                          success: result.client.type === 'connected',
                        })
                      }
""")
cut(R, """                      if (server.config.type === 'claudeai-proxy') {
                        logEvent('tengu_claudeai_mcp_reconnect', {
                          success: false,
                        })
                      }
""")

# ---------------------------------------------------------------- MCPSettings.tsx
S = 'components/mcp/MCPSettings.tsx'
cut(S, "  McpClaudeAIProxyServerConfig,\n")
cut(S, "          const isClaudeAIProxy = client.config.type === 'claudeai-proxy'\n")
cut(S, """          if (isClaudeAIProxy) {
            return {
              ...baseInfo,
              transport: 'claudeai-proxy' as const,
              isAuthenticated: false,
              config: client.config as McpClaudeAIProxyServerConfig,
            }
          } else if (isSSE) {
""", "          if (isSSE) {\n")
cut(S, """      const defaultTab =
        viewState.server.transport === 'claudeai-proxy'
          ? 'claude.ai'
          : 'Claude Code'
""", "      const defaultTab = 'Claude Code'\n")

# ---------------------------------------------------------------- MCPListPanel.tsx
L = 'components/mcp/MCPListPanel.tsx'
cut(L, "  // Non-claudeai servers grouped by scope\n", "  // Servers grouped by scope\n")
cut(L, """  const serversByScope = React.useMemo(() => {
    const regularServers = servers.filter(
      s => s.client.config.type !== 'claudeai-proxy',
    )
    return groupServersByScope(regularServers)
  }, [servers])

  const claudeAiServers = React.useMemo(
    () =>
      servers
        .filter(s => s.client.config.type === 'claudeai-proxy')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [servers],
  )

""", """  const serversByScope = React.useMemo(
    () => groupServersByScope(servers),
    [servers],
  )

""")
cut(L, """    for (const server of claudeAiServers) {
      items.push({ type: 'server', server })
    }
""")
cut(L, "  }, [serversByScope, claudeAiServers, agentServers, dynamicServers])",
    "  }, [serversByScope, agentServers, dynamicServers])")
cut(L, """          {/* Claude.ai servers section */}
          {claudeAiServers.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Box paddingLeft={2}>
                <Text bold>claude.ai</Text>
              </Box>
              {claudeAiServers.map(server => renderServerItem(server))}
            </Box>
          )}

""")

# ---------------------------------------------------------------- ManagePlugins.tsx
P = 'commands/plugin/ManagePlugins.tsx'
cut(P, """import type {
  ClaudeAIServerInfo,
  HTTPServerInfo,
  SSEServerInfo,
  StdioServerInfo,
} from '../../components/mcp/types.js'
""", """import type {
  HTTPServerInfo,
  SSEServerInfo,
  StdioServerInfo,
} from '../../components/mcp/types.js'
""")
cut(P, "  McpClaudeAIProxyServerConfig,\n")
cut(P, """    } else if (configType === 'claudeai-proxy') {
      const server: ClaudeAIServerInfo = {
        name: client.name,
        client,
        scope,
        transport: 'claudeai-proxy',
        isAuthenticated: undefined,
        config: client.config as McpClaudeAIProxyServerConfig,
      }
      return (
        <MCPRemoteServerMenu
          server={server}
          serverToolsCount={serverToolsCount}
          onViewTools={handleMcpViewTools}
          onCancel={handleMcpCancel}
          onComplete={handleMcpComplete}
          borderless
        />
      )
    }
""", "    }\n")
cut(P, """    let server:
      | StdioServerInfo
      | SSEServerInfo
      | HTTPServerInfo
      | ClaudeAIServerInfo
""", "    let server: StdioServerInfo | SSEServerInfo | HTTPServerInfo\n", n=2)
cut(P, """    } else {
      server = {
        name: client.name,
        client,
        scope,
        transport: 'claudeai-proxy',
        isAuthenticated: undefined,
        config: client.config as McpClaudeAIProxyServerConfig,
      }
    }
""", "    }\n", n=2)

# ---------------------------------------------------------------- cli/print.ts
P2 = 'cli/print.ts'
cut_between(
    P2,
    "      } else if (connection.config.type === 'claudeai-proxy') {",
    "      } else if (isMcpStdioServerConfig(connection.config)) {",
)
cut(P2, """        config.type !== 'ws' &&
        config.type !== 'claudeai-proxy'
""", "        config.type !== 'ws'\n")

# ---------------------------------------------------------------- cli/handlers/mcp.tsx
cut_between(
    'cli/handlers/mcp.tsx',
    "      } else if (server.type === 'claudeai-proxy') {",
    "      } else if (isMcpStdioServerConfig(server)) {",
)

# ---------------------------------------------------------------- entrypoints
CS = 'entrypoints/sdk/coreSchemas.ts'
cut(CS, """export const McpClaudeAIProxyServerConfigSchema = lazySchema(() =>
  z.object({
    type: z.literal('claudeai-proxy'),
    url: z.string(),
    id: z.string(),
  }),
)

// Broader config type for status responses (includes claudeai-proxy which is output-only)
export const McpServerStatusConfigSchema = lazySchema(() =>
  z.union([
    McpServerConfigForProcessTransportSchema(),
    McpClaudeAIProxyServerConfigSchema(),
  ]),
)
""", """// Config type for status responses
export const McpServerStatusConfigSchema = lazySchema(() =>
  McpServerConfigForProcessTransportSchema(),
)
""")
cut(CS, "          'Configuration scope (e.g., project, user, local, claudeai, managed)',",
    "          'Configuration scope (e.g., project, user, local, managed)',")
cut('entrypoints/sdk/coreTypes.ts',
    "export type McpClaudeAIProxyServerConfig = z.infer<ReturnType<typeof import('./coreSchemas.js').McpClaudeAIProxyServerConfigSchema>>\n")

# ---------------------------------------------------------------- small hosts
cut('services/tools/toolExecution.ts', "  | 'claudeai-proxy'\n")
cut('tools/McpAuthTool/McpAuthTool.ts', """      // claude.ai connectors use a separate auth flow (handleClaudeAIAuth in
      // MCPRemoteServerMenu) that we don't invoke programmatically here —
      // just point the user at /mcp.
      if (config.type === 'claudeai-proxy') {
        return {
          data: {
            status: 'unsupported' as const,
            message: `This is a claude.ai MCP connector. Ask the user to run /mcp and select "${serverName}" to authenticate.`,
          },
        }
      }

""")
cut('utils/plugins/mcpPluginIntegration.ts',
    """    // For other types (sse-ide, ws-ide, sdk, claudeai-proxy), pass through unchanged
    case 'sse-ide':
    case 'ws-ide':
    case 'sdk':
    case 'claudeai-proxy':
""", """    // For other types (sse-ide, ws-ide, sdk), pass through unchanged
    case 'sse-ide':
    case 'ws-ide':
    case 'sdk':
""")
cut('services/analytics/metadata.ts', """  if (mcpServerType === 'claudeai-proxy') {
    return true
  }
""")

# ---------------------------------------------------------------- utils/config.ts
G = 'utils/config.ts'
cut(G, """  // claude.ai MCP connectors that have successfully connected at least once.
  // Used to gate "connector unavailable" / "needs auth" startup notifications:
  // a connector the user has actually used is worth flagging when it breaks,
  // but an org-configured connector that's been needs-auth since day one is
  // something the user has demonstrably ignored and shouldn't nag about.
  claudeAiMcpEverConnected?: string[]
""")
cut(G, """export type AccountInfo = {
  accountUuid: string
  emailAddress: string
  organizationUuid?: string
  organizationName?: string | null // added 4/23/2025, not populated for existing users
  organizationRole?: string | null
  workspaceRole?: string | null
  // Populated by /api/oauth/profile
  displayName?: string
  hasExtraUsageEnabled?: boolean
  billingType?: BillingType | null
  accountCreatedAt?: string
  subscriptionCreatedAt?: string
}

""")
cut(G, """// services/oauth/types.ts was a stub in the dump (no bodies); the profile
// endpoint reported the billing type as a plain string.
type BillingType = string
""")

# ---------------------------------------------------------------- constants/oauth.ts
O = 'constants/oauth.ts'
cut(O, """  /**
   * The claude.ai web origin. Separate from CLAUDE_AI_AUTHORIZE_URL because
   * that now routes through claude.com/cai/* for attribution — deriving
   * .origin from it would give claude.com, breaking links to /code,
   * /settings/connectors, and other claude.ai web pages.
   */
  CLAUDE_AI_ORIGIN: string
""")
cut(O, "  MCP_PROXY_URL: string\n  MCP_PROXY_PATH: string\n")
cut(O, "  CLAUDE_AI_ORIGIN: 'https://claude.ai',\n")
cut(O, "  MCP_PROXY_URL: 'https://mcp-proxy.anthropic.com',\n  MCP_PROXY_PATH: '/v1/mcp/{server_id}',\n")
cut(O, "        CLAUDE_AI_ORIGIN: 'https://claude-ai.staging.ant.dev',\n")
cut(O, "        MCP_PROXY_URL: 'https://mcp-proxy-staging.anthropic.com',\n        MCP_PROXY_PATH: '/v1/mcp/{server_id}',\n")
cut(O, "    CLAUDE_AI_ORIGIN: apps,\n")
cut(O, "    MCP_PROXY_URL: 'http://localhost:8205',\n    MCP_PROXY_PATH: '/v1/toolbox/shttp/mcp/{server_id}',\n")
cut(O, "      CLAUDE_AI_ORIGIN: base,\n")

# ---------------------------------------------------------------- utils/auth.ts
A = 'utils/auth.ts'
cut(A, "  CLAUDE_AI_INFERENCE_SCOPE,\n")
cut(A, "  type AccountInfo,\n")
cut(A, """// Ported from services/oauth/client.ts:38-40 — the Claude.ai inference scope test.
function shouldUseClaudeAIAuth(scopes: string[] | undefined): boolean {
  return Boolean(scopes?.includes(CLAUDE_AI_INFERENCE_SCOPE))
}

""")
cut(A, """/** Whether we are supporting direct 1P auth. */
// this code is closely related to getAuthTokenSource
export function isAnthropicAuthEnabled(): boolean {
  // API-key-only, never OAuth: the `--bare` arm of the original function is
  // the only shape this build supports, so this is the answer it returns.
  // Auth is the API key (getAnthropicApiKey / apiKeyHelper / keychain) and the
  // third-party provider paths; there is no OAuth token to enable.
  return false
}

/** Where the auth token is being sourced from, if any. */
// this code is closely related to isAnthropicAuthEnabled
export function getAuthTokenSource() {
""", """/** Where the auth token is being sourced from, if any. */
export function getAuthTokenSource() {
""")
cut(A, """export function isClaudeAISubscriber(): boolean {
  if (!isAnthropicAuthEnabled()) {
    return false
  }

  return shouldUseClaudeAIAuth(getClaudeAIOAuthTokens()?.scopes)
}

""")
cut(A, """/**
 * Gets OAuth account information when Anthropic auth is enabled.
 * Returns undefined when using external API keys or third-party services.
 */
export function getOauthAccountInfo(): AccountInfo | undefined {
  // No account is persisted in this build, so the guarded config read the
  // source performed could only have answered undefined.
  return undefined
}

""")
cut(A, """/**
 * Reads OAuth tokens. Every remaining source (environment variable, file
 * descriptor) is synchronous, so this delegates to the memoized sync reader.
 */
export async function getClaudeAIOAuthTokensAsync(): Promise<OAuthTokens | null> {
  return getClaudeAIOAuthTokens()
}

""")
cut(A, """/**
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

""")
cut(A, """  // no OAuth token to validate, the original's first guard —
  // `if (!isAnthropicAuthEnabled()) return { valid: true }` — is the whole
  // function.
""", """  // no OAuth token to validate, the original's first guard — a constant-false
  // auth-enabled check — is the whole function.
""")
cut(A, "// The plan names the subscription predicates below compare against.\n",
    "// The plan names a token can carry.\n")

# ---------------------------------------------------------------- comments
cut('utils/managedEnv.ts',
    " * env vars that the remote's ~/.claude settings.env MUST NOT clobber (see\n * isAnthropicAuthEnabled). Strip them from any settings-sourced env object.\n",
    " * env vars that the remote's ~/.claude settings.env MUST NOT clobber. Strip\n * them from any settings-sourced env object.\n")
cut('hooks/useApiKeyVerification.ts',
    """  // isAnthropicAuthEnabled() is false in this build, so the source's guard
  // (`!isAnthropicAuthEnabled() || isClaudeAISubscriber()`) took the 'valid'
  // arm and the key-verification path below it was unreachable.
""", """  // This build has no OAuth auth path, so the source's guard took the 'valid'
  // arm on every call and the key-verification path below it was unreachable.
""")

# ---------------------------------------------------------------- analytics gate
DT = 'services/analytics/metadata.ts'
cut(DT, " * - claude.ai-proxied connectors — always official (from claude.ai's list)\n")
cut(DT, """export function isAnalyticsToolDetailsLoggingEnabled(
  mcpServerType: string | undefined,
  mcpServerBaseUrl: string | undefined,
): boolean {
""", """export function isAnalyticsToolDetailsLoggingEnabled(
  mcpServerBaseUrl: string | undefined,
): boolean {
""")
cut(DT, """export function mcpToolDetailsForAnalytics(
  toolName: string,
  mcpServerType: string | undefined,
  mcpServerBaseUrl: string | undefined,
): {
""", """export function mcpToolDetailsForAnalytics(
  toolName: string,
  mcpServerBaseUrl: string | undefined,
): {
""")
cut(DT, "  if (!isAnalyticsToolDetailsLoggingEnabled(mcpServerType, mcpServerBaseUrl)) {",
    "  if (!isAnalyticsToolDetailsLoggingEnabled(mcpServerBaseUrl)) {")
TE = 'services/tools/toolExecution.ts'
cut(TE, "...mcpToolDetailsForAnalytics(toolName, mcpServerType, mcpServerBaseUrl),",
    "...mcpToolDetailsForAnalytics(toolName, mcpServerBaseUrl),")
cut(TE, "...mcpToolDetailsForAnalytics(tool.name, mcpServerType, mcpServerBaseUrl),",
    "...mcpToolDetailsForAnalytics(tool.name, mcpServerBaseUrl),", n=5)
cut(TE, """        ...mcpToolDetailsForAnalytics(
          tool.name,
          mcpServerType,
          mcpServerBaseUrl,
        ),
""", "        ...mcpToolDetailsForAnalytics(tool.name, mcpServerBaseUrl),\n", n=3)
cut(TE, """  // mcpInfo.serverName is normalized (e.g., "claude_ai_Slack"), but client.name
  // is the original name (e.g., "claude.ai Slack"). Normalize both for comparison.
""", """  // mcpInfo.serverName is normalized (spaces become underscores), but
  // client.name is the original config name. Normalize both for comparison.
""")

# ---------------------------------------------------------------- config comments
cut(C, """/**
 * CCR proxy URL path markers. In remote sessions, claude.ai connectors arrive
 * via --mcp-config with URLs rewritten to route through the CCR/session-ingress
 * SHTTP proxy. The original vendor URL is preserved in the mcp_url query param
""", """/**
 * CCR proxy URL path markers. In remote sessions, MCP servers arrive via
 * --mcp-config with URLs rewritten to route through the CCR/session-ingress
 * SHTTP proxy. The original vendor URL is preserved in the mcp_url query param
""")
cut(C, """ * signature-based dedup match a plugin's raw vendor URL against a connector's
 * rewritten proxy URL when both point at the same MCP server.
""", """ * signature-based dedup match a plugin's raw vendor URL against a rewritten
 * proxy URL when both point at the same MCP server.
""")
cut(C, """/**
 * Get Claude Code MCP configurations (excludes claude.ai servers from the
 * returned set — they're fetched separately and merged by callers).
 * This is fast: only local file reads; no awaited network calls on the
 * critical path.
""", """/**
 * Get Claude Code MCP configurations.
 * This is fast: only local file reads; no awaited network calls on the
 * critical path.
""")
cut(H, """  // On plugin reload, also disconnects stale plugin MCP servers (scope 'dynamic')
  // that no longer appear in configs — prevents ghost tools from disabled plugins.
  // Skip claude.ai dedup here to avoid blocking on the network fetch; the connect
  // useEffect below runs immediately after and dedups before connecting.
""", """  // On plugin reload, also disconnects stale plugin MCP servers (scope 'dynamic')
  // that no longer appear in configs — prevents ghost tools from disabled plugins.
""")

# ---------------------------------------------------------------- normalization
cut('services/mcp/normalization.ts', """// Claude.ai server names are prefixed with this string
const CLAUDEAI_SERVER_PREFIX = 'claude.ai '

/**
 * Normalize server names to be compatible with the API pattern ^[a-zA-Z0-9_-]{1,64}$
 * Replaces any invalid characters (including dots and spaces) with underscores.
 *
 * For claude.ai servers (names starting with "claude.ai "), also collapses
 * consecutive underscores and strips leading/trailing underscores to prevent
 * interference with the __ delimiter used in MCP tool names.
 */
export function normalizeNameForMCP(name: string): string {
  let normalized = name.replace(/[^a-zA-Z0-9_-]/g, '_')
  if (name.startsWith(CLAUDEAI_SERVER_PREFIX)) {
    normalized = normalized.replace(/_+/g, '_').replace(/^_|_$/g, '')
  }
  return normalized
}
""", """/**
 * Normalize server names to be compatible with the API pattern ^[a-zA-Z0-9_-]{1,64}$
 * Replaces any invalid characters (including dots and spaces) with underscores.
 */
export function normalizeNameForMCP(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_')
}
""")
cut('commands/commit-push-pr.ts', "  'mcp__claude_ai_Slack__slack_send_message',\n")
cut('tools/MCPTool/classifyForCollapse.ts', """ * Tool names are stable across installs (even when the server name varies,
 * e.g., "slack" vs "claude_ai_Slack"), so matching is keyed on the tool
 * name alone after normalizing camelCase/kebab-case to snake_case.
""", """ * Tool names are stable across installs (even when the server name varies),
 * so matching is keyed on the tool name alone after normalizing
 * camelCase/kebab-case to snake_case.
""")

print('cut ok')
