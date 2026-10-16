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


def cut_all(p, old, new=''):
    t = rd(p)
    n = t.count(old)
    assert n >= 1, (p, old[:90], n)
    wr(p, t.replace(old, new))


R = 'screens/REPL.tsx'

# ---------- imports ----------
cut(R, "import { useRemoteSession } from '../hooks/useRemoteSession.js'\n")
cut(R, "import { useDirectConnect } from '../hooks/useDirectConnect.js'\n")
cut(R, "import type { DirectConnectConfig } from '../server/directConnectManager.js'\n")
cut(R, "import { useSSHSession } from '../hooks/useSSHSession.js'\n")
cut(R, "import type { SSHSession } from '../ssh/createSSHSession.js'\n")
cut(R, "import { restoreRemoteAgentTasks } from '../tasks/RemoteAgentTask/RemoteAgentTask.js'\n")
cut(R, "import type { RemoteSessionConfig } from '../remote/RemoteSessionManager.js'\n")
cut(R, "import type { RemoteMessageContent } from '../utils/teleport/api.js'\n")
cut(R, "import { REMOTE_SAFE_COMMANDS } from '../commands.js'\n")

# ---------- props ----------
cut(R, """  // Remote session config for --remote mode (uses CCR as execution engine)
  remoteSessionConfig?: RemoteSessionConfig
  // Direct connect config for `claude connect` mode (connects to a claude server)
  directConnectConfig?: DirectConnectConfig
  // SSH session for `claude ssh` mode (local REPL, remote tools over ssh)
  sshSession?: SSHSession
""")
cut(R, """  taskListId,
  remoteSessionConfig,
  directConnectConfig,
  sshSession,
  thinkingConfig,
}: Props): React.ReactNode {
  const isRemoteSession = !!remoteSessionConfig
""", """  taskListId,
  thinkingConfig,
}: Props): React.ReactNode {
""")

# ---------- local arms for the former remote gate ----------
cut(R, "    isRemoteSession ? undefined : getProjectRoot(),\n", "    getProjectRoot(),\n")
cut(R, "  useManagePlugins({ enabled: !isRemoteSession })\n", "  useManagePlugins({ enabled: true })\n")
cut(R, """  useEffect(() => {
    if (isRemoteSession) return
    void performStartupChecks(setAppState)
  }, [setAppState, isRemoteSession])
""", """  useEffect(() => {
    void performStartupChecks(setAppState)
  }, [setAppState])
""")
cut(R, """  useSwarmInitialization(setAppState, initialMessages, {
    enabled: !isRemoteSession,
  })
""", """  useSwarmInitialization(setAppState, initialMessages, {
    enabled: true,
  })
""")
cut(R, "  useIdeLogging(isRemoteSession ? EMPTY_MCP_CLIENTS : mcp.clients)\n",
       "  useIdeLogging(mcp.clients)\n")
cut(R, "    isRemoteSession ? EMPTY_MCP_CLIENTS : mcp.clients,\n", "    mcp.clients,\n")
cut(R, """    { enabled: !isRemoteSession },
  )

  // Memory survey: shown when the assistant mentions memory and a memory file
  // was read this conversation
  const memorySurvey = useMemorySurvey(messages, isLoading, hasActivePrompt, {
    enabled: !isRemoteSession,
  })
""", """    { enabled: true },
  )

  // Memory survey: shown when the assistant mentions memory and a memory file
  // was read this conversation
  const memorySurvey = useMemorySurvey(messages, isLoading, hasActivePrompt, {
    enabled: true,
  })
""")

# ---------- external loading state ----------
cut(R, """  // Separate loading flag for operations outside the local query guard:
  // remote sessions (useRemoteSession / useDirectConnect) and foregrounded
  // background tasks (useSessionBackgrounding). These don't route through
  // onQuery / queryGuard, so they need their own spinner-visibility state.
  // Initialize true if remote mode with initial prompt (CCR processing it).
  const [isExternalLoading, setIsExternalLoadingRaw] = React.useState(
    remoteSessionConfig?.hasInitialPrompt ?? false,
  )
""", """  // Separate loading flag for operations outside the local query guard:
  // foregrounded background tasks (useSessionBackgrounding). These don't route
  // through onQuery / queryGuard, so they need their own spinner state.
  const [isExternalLoading, setIsExternalLoadingRaw] = React.useState(false)
""")

# ---------- handleRemoteInit ----------
cut(R, """  // Callback to filter commands based on CCR's available slash commands
  const handleRemoteInit = useCallback(
    (remoteSlashCommands: string[]) => {
      const remoteCommandSet = new Set(remoteSlashCommands)
      // Keep commands that CCR lists OR that are in the local-safe set
      setLocalCommands(prev =>
        prev.filter(
          cmd =>
            remoteCommandSet.has(cmd.name) || REMOTE_SAFE_COMMANDS.has(cmd),
        ),
      )
    },
    [setLocalCommands],
  )

""")

# ---------- remote hooks ----------
cut(R, """  // Remote session hook - manages WebSocket connection and message handling for --remote mode
  const remoteSession = useRemoteSession({
    config: remoteSessionConfig,
    setMessages,
    setIsLoading: setIsExternalLoading,
    onInit: handleRemoteInit,
    setToolUseConfirmQueue,
    tools: combinedInitialTools,
    setStreamingToolUses,
    setStreamMode,
    setInProgressToolUseIDs,
  })

  // Direct connect hook - manages WebSocket to a claude server for `claude connect` mode
  const directConnect = useDirectConnect({
    config: directConnectConfig,
    setMessages,
    setIsLoading: setIsExternalLoading,
    setToolUseConfirmQueue,
    tools: combinedInitialTools,
  })

  // SSH session hook - manages ssh child process for `claude ssh` mode.
  // Same callback shape as useDirectConnect; only the transport under the
  // hood differs (ChildProcess stdin/stdout vs WebSocket).
  const sshRemote = useSSHSession({
    session: sshSession,
    setMessages,
    setIsLoading: setIsExternalLoading,
    setToolUseConfirmQueue,
    tools: combinedInitialTools,
  })

  // Use whichever remote mode is active
  const activeRemote = sshRemote.isRemoteMode
    ? sshRemote
    : directConnect.isRemoteMode
      ? directConnect
      : remoteSession

""")

# ---------- restoreRemoteAgentTasks ----------
cut_all(R, """          void restoreRemoteAgentTasks({
            abortController: new AbortController(),
            getAppState: () => store.getState(),
            setAppState,
          })
""")
cut(R, """      void restoreRemoteAgentTasks({
        abortController: new AbortController(),
        getAppState: () => store.getState(),
        setAppState,
      })
""")

# ---------- interrupt branch ----------
cut(R, """    } else if (activeRemote.isRemoteMode) {
      // Remote mode: send interrupt signal to CCR
      activeRemote.cancelRequest()
    } else {
""", """    } else {
""")

# ---------- submit path ----------
cut(R, """
      // Remote mode: skip empty input early before any state mutations
      if (activeRemote.isRemoteMode && !input.trim()) {
        return
      }
""")
cut(R, """      // Submit runs "now" (not queued) when not already loading, or when
      // accepting speculation, or in remote mode (which sends via WS and
      // returns early without calling handlePromptSubmit).
      const submitsNow =
        !isLoading || speculationAccept || activeRemote.isRemoteMode
""", """      // Submit runs "now" (not queued) when not already loading, or when
      // accepting speculation.
      const submitsNow = !isLoading || speculationAccept
""")
cut(R, """        // Show the placeholder in the same React batch as setInputValue('').
        // Skip for slash/bash (they have their own echo), speculation and remote
        // mode (both setMessages directly with no gap to bridge).
        if (
          !isSlashCommand &&
          inputMode === 'prompt' &&
          !speculationAccept &&
          !activeRemote.isRemoteMode
        ) {
""", """        // Show the placeholder in the same React batch as setInputValue('').
        // Skip for slash/bash (they have their own echo) and speculation.
        if (!isSlashCommand && inputMode === 'prompt' && !speculationAccept) {
""")

# ---------- remote send block ----------
t = rd(R)
start = t.index("      // Permission requests from the remote are bridged into toolUseConfirmQueue\n")
end_marker = "        return\n      }\n\n      // Ensure SessionStart hook context is available before the first API call.\n"
end = t.index(end_marker, start) + len(end_marker)
wr(R, t[:start] + "      // Ensure SessionStart hook context is available before the first API call.\n" + t[end:])

cut(R, """      canUseTool,
      remoteSession,
      setMessages,
""", """      canUseTool,
      setMessages,
""")

print('e4 repl ok')
