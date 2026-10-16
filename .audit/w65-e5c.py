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


# ================= entrypoints/cli.tsx =================
C = 'entrypoints/cli.tsx'
cut_range(
    C,
    "  // Fast-path for `claude remote-control` (also accepts legacy `claude remote` / `claude sync` / `claude bridge`):\n",
    "    await bridgeMain(args.slice(1))\n    return\n  }\n\n",
    "",
)

# ================= main.tsx =================
M = 'main.tsx'
cut(M, """// Set by early argv processing when `claude assistant [sessionId]` is detected
type PendingAssistantChat = { sessionId?: string; discover: boolean }
const _pendingAssistantChat: PendingAssistantChat | undefined = feature(
  'KAIROS',
)
  ? { sessionId: undefined, discover: false }
  : undefined

""")
cut_range(
    M,
    "  // `claude assistant [sessionId]` — stash and strip so the main\n",
    "      // else: `claude assistant --help` → fall through to stub\n    }\n  }\n\n",
    "",
)
cut(M, """      // Extract --remote-control / --rc flag (enable bridge in interactive session)
      const remoteControlOption =
        (options as { remoteControl?: string | true }).remoteControl ??
        (options as { rc?: string | true }).rc
      // Actual bridge check is deferred to after showSetupScreens() so that
      // trust is established and GrowthBook has auth headers.
      let remoteControl = false
      const remoteControlName =
        typeof remoteControlOption === 'string' &&
        remoteControlOption.length > 0
          ? remoteControlOption
          : undefined

""")
cut(M, """        // Now that trust is established and GrowthBook has auth headers,
        // resolve the --remote-control / --rc entitlement gate.
        if (feature('BRIDGE_MODE') && remoteControlOption !== undefined) {
          const { getBridgeDisabledReason } = await import(
            './bridge/bridgeEnabled.js'
          )
          const disabledReason = await getBridgeDisabledReason()
          remoteControl = disabledReason === null
          if (disabledReason) {
            process.stderr.write(
              chalk.yellow(`${disabledReason}\\n--rc flag ignored.\\n`),
            )
          }
        }

""")
cut(M, """          refreshGrowthBookAfterAuthChange()
          // Clear any stale trusted device token then enroll for Remote Control.
          // Both self-gate on tengu_sessions_elevated_auth_enforcement internally
          // — enrollTrustedDevice() via checkGate_CACHED_OR_BLOCKING (awaits
          // the GrowthBook reinit above), clearTrustedDeviceToken() via the
          // sync cached check (acceptable since clear is idempotent).
          void import('./bridge/trustedDevice.js').then(m => {
            m.clearTrustedDeviceToken()
            return m.enrollTrustedDevice()
          })
""", """          refreshGrowthBookAfterAuthChange()
""")
cut(M, """      const fullRemoteControl =
        remoteControl || getRemoteControlAtStartup() || kairosEnabled
      let ccrMirrorEnabled = false
      if (feature('CCR_MIRROR') && !fullRemoteControl) {
        /* eslint-disable @typescript-eslint/no-require-imports */
        const { isCcrMirrorEnabled } =
          require('./bridge/bridgeEnabled.js') as typeof import('./bridge/bridgeEnabled.js')
        /* eslint-enable @typescript-eslint/no-require-imports */
        ccrMirrorEnabled = isCcrMirrorEnabled()
      }

""", "      const fullRemoteControl = getRemoteControlAtStartup() || kairosEnabled\n\n")
cut(M, """        replBridgeEnabled: fullRemoteControl || ccrMirrorEnabled,
        replBridgeExplicit: remoteControl,
        replBridgeOutboundOnly: ccrMirrorEnabled,
""", """        replBridgeEnabled: fullRemoteControl,
        replBridgeExplicit: false,
        replBridgeOutboundOnly: false,
""")
cut(M, """        replBridgeInitialName: remoteControlName,
""", """        replBridgeInitialName: undefined,
""")
cut_range(
    M,
    "  if (feature('BRIDGE_MODE')) {\n    program.addOption(\n      new Option(\n        '--remote-control [name]',\n",
    "    program.addOption(\n      new Option('--rc [name]', 'Alias for --remote-control')\n        .argParser(value => value || true)\n        .hideHelp(),\n    )\n  }\n\n",
    "",
)
cut_range(
    M,
    "  // Remote Control command — connect local environment to claude.ai/code.\n",
    "        await bridgeMain(process.argv.slice(3))\n      })\n  }\n\n",
    "",
)
cut_range(
    M,
    "  if (feature('KAIROS')) {\n    program\n      .command('assistant [sessionId]')\n",
    "            'Omit sessionId to discover and pick from available sessions.\\n',\n        )\n        process.exit(1)\n      })\n  }\n\n",
    "",
)
cut(M, """  // on baseline — mostly the isBridgeEnabled() call (25ms settings Zod parse
  // + 40ms sync keychain subprocess), both hidden by the try/catch that
  // always returns false before enableConfigs(). cc:// URLs are rewritten to
""", """  // on baseline. cc:// URLs are rewritten to
""")

# ================= state/AppStateStore.ts =================
S = 'state/AppStateStore.ts'
cut(S, "import type { BridgePermissionCallbacks } from '../bridge/bridgePermissionCallbacks.js'\n")
cut(S, """  // Always-on bridge: permission callbacks for bidirectional permission checks
  replBridgePermissionCallbacks?: BridgePermissionCallbacks
""")

# ================= screens/REPL.tsx =================
R = 'screens/REPL.tsx'
cut(R, "import { useReplBridge } from '../hooks/useReplBridge.js'\n")
cut(R, """  // Ref for the bridge result callback — set after useReplBridge initializes,
  // read in the onQuery finally block to notify mobile clients that a turn ended.
  const sendBridgeResultRef = useRef<() => void>(() => {})

""")
cut(R, """  // Track bridge cleanup functions for sandbox permission requests so the
  // local dialog handler can cancel the remote prompt when the local user
  // responds first. Keyed by host to support concurrent same-host requests.
  const sandboxBridgeCleanupRef = useRef<Map<string, Array<() => void>>>(
    new Map(),
  )

""")
cut_range(
    R,
    "        // When the REPL bridge is connected, also forward the sandbox\n",
    "          }\n        }\n      })\n    },\n",
    "      })\n    },\n",
)
cut(R, """          // Notify bridge clients that the turn is complete so mobile apps
          // can stop the spark animation and show post-turn UI.
          sendBridgeResultRef.current()

""")
cut(R, """  // REPL Bridge: replicate user/assistant messages to the bridge session
  // for remote access via claude.ai. No-op in external builds or when not enabled.
  const { sendBridgeResult } = useReplBridge(
    messages,
    setMessages,
    abortControllerRef,
    commands,
    mainLoopModel,
  )
  sendBridgeResultRef.current = sendBridgeResult

""")
cut(R, """                      // Clean up bridge subscriptions and cancel remote prompts
                      // for this host since the local user already responded.
                      const cleanups =
                        sandboxBridgeCleanupRef.current.get(approvedHost)
                      if (cleanups) {
                        for (const fn of cleanups) {
                          fn()
                        }
                        sandboxBridgeCleanupRef.current.delete(approvedHost)
                      }
""")

# ================= tools/SendMessageTool/SendMessageTool.ts =================
T = 'tools/SendMessageTool/SendMessageTool.ts'
cut(T, "import { isReplBridgeActive } from '../../bootstrap/state.js'\n")
cut(T, "import { getReplBridgeHandle } from '../../bridge/replBridgeHandle.js'\n")
cut(T, "for a Remote Control peer (use ListPeers to discover)'\n",
       "for a Remote Control peer'\n")
cut(T, """      if (feature('UDS_INBOX') && parseAddress(input.to).scheme === 'bridge') {
        return {
          behavior: 'ask' as const,
          message: `Send a message to Remote Control session ${input.to}? It arrives as a user prompt on the receiving Claude (possibly another machine) via Anthropic's servers.`,
          // safetyCheck (not mode) — permissions.ts guards this before both
          // bypassPermissions (step 1g) and auto-mode's allowlist/classifier.
          // Cross-machine prompt injection must stay bypass-immune.
          decisionReason: {
            type: 'safetyCheck',
            reason:
              'Cross-machine bridge message requires explicit user consent',
            classifierApprovable: false,
          },
        }
      }
""")
cut(T, """      const addr = parseAddress(input.to)
      if (
        (addr.scheme === 'bridge' || addr.scheme === 'uds') &&
""", """      const addr = parseAddress(input.to)
      if (
        addr.scheme === 'uds' &&
""")
cut(T, """      if (feature('UDS_INBOX') && parseAddress(input.to).scheme === 'bridge') {
        // Structured-message rejection first — it's the permanent constraint.
        // Showing "not connected" first would make the user reconnect only to
        // hit this error on retry.
        if (typeof input.message !== 'string') {
          return {
            result: false,
            message:
              'structured messages cannot be sent cross-session — only plain text',
            errorCode: 9,
          }
        }
        // postInterClaudeMessage derives from= via getReplBridgeHandle() —
        // check handle directly for the init-timing window. Also check
        // isReplBridgeActive() to reject outbound-only (CCR mirror) mode
        // where the bridge is write-only and peer messaging is unsupported.
        if (!getReplBridgeHandle() || !isReplBridgeActive()) {
          return {
            result: false,
            message:
              'Remote Control is not connected — cannot send to a bridge: target. Reconnect with /remote-control first.',
            errorCode: 9,
          }
        }
        return { result: true }
      }
""")

# ================= utils/peerAddress.ts =================
A = 'utils/peerAddress.ts'
cut(A, """/**
 * Peer address parsing — kept separate from peerRegistry.ts so that
 * SendMessageTool can import parseAddress without transitively loading
 * the bridge (axios) and UDS (fs, net) modules at tool-enumeration time.
 */

/** Parse a URI-style address into scheme + target. */
export function parseAddress(to: string): {
  scheme: 'uds' | 'bridge' | 'other'
  target: string
} {
  if (to.startsWith('uds:')) return { scheme: 'uds', target: to.slice(4) }
  if (to.startsWith('bridge:')) return { scheme: 'bridge', target: to.slice(7) }
  // Legacy: old-code UDS senders emit bare socket paths in from=; route them
  // through the UDS branch so replies aren't silently dropped into teammate
  // routing. (No bare-session-ID fallback — bridge messaging is new enough
  // that no old senders exist, and the prefix would hijack teammate names
  // like session_manager.)
  if (to.startsWith('/')) return { scheme: 'uds', target: to }
  return { scheme: 'other', target: to }
}
""", """/**
 * Peer address parsing — kept separate from peerRegistry.ts so that
 * SendMessageTool can import parseAddress without transitively loading the
 * UDS (fs, net) modules at tool-enumeration time.
 */

/** Parse a URI-style address into scheme + target. */
export function parseAddress(to: string): {
  scheme: 'uds' | 'other'
  target: string
} {
  if (to.startsWith('uds:')) return { scheme: 'uds', target: to.slice(4) }
  // Legacy: old-code UDS senders emit bare socket paths in from=; route them
  // through the UDS branch so replies aren't silently dropped into teammate
  // routing. (No bare-session-ID fallback — the prefix would hijack teammate
  // names like session_manager.)
  if (to.startsWith('/')) return { scheme: 'uds', target: to }
  return { scheme: 'other', target: to }
}
""")

print('e5c ok')
