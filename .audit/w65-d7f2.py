"""W65 wave D step 7f, part 2: the hosts that fed or rendered the channel push.

Every site below was `feature('KAIROS') || feature('KAIROS_CHANNELS')` (both
false). Where the guard is the only condition, the source's own fallback is the
else branch, so the block is dropped rather than kept. Two sites invert the
guard (`if (!(feature('KAIROS') || feature('KAIROS_CHANNELS'))) return` in
print.ts) — the source's fallback there is the early return, which makes the
whole remainder dead, so the function goes with its callers.
"""

B = '/Users/mant1ssa/Projects/cc-base-2188/'


def rd(p):
    return open(B + p, encoding='utf-8').read()


def wr(p, t):
    open(B + p, 'w', encoding='utf-8').write(t)


def cut(p, old, new='', n=1):
    t = rd(p)
    c = t.count(old)
    assert c == n, (p, old[:70], c)
    wr(p, t.replace(old, new))


def drop_exact_lines(p, stripped, n=None):
    """Remove every line whose stripped text is exactly `stripped`."""
    lines = rd(p).split('\n')
    keep = [ln for ln in lines if ln.strip() != stripped]
    removed = len(lines) - len(keep)
    if n is not None:
        assert removed == n, (p, stripped, removed)
    assert removed > 0, (p, 'no line to drop', stripped)
    wr(p, '\n'.join(keep))
    return removed


def cut_upto(p, start_sub, keep_sub, new=''):
    """Drop the block starting at start_sub up to (not including) keep_sub."""
    t = rd(p)
    assert t.count(start_sub) == 1, (p, 'start', start_sub[:70], t.count(start_sub))
    i = t.index(start_sub)
    i = t.rindex('\n', 0, i) + 1
    k = t.index(keep_sub, i)
    k = t.rindex('\n', 0, k) + 1
    seg = t[i:k]
    seg = (seg.rstrip('\n') + '\n\n') if seg.strip() else ''
    wr(p, t[:i] + new + seg + t[k:])


# ---------------------------------------------------------------- constants
cut(
    'constants/xml.ts',
    """// XML tag name for external channel messages
export const CHANNEL_MESSAGE_TAG = 'channel-message'

""",
)

# ------------------------------------------------------------------- main.tsx
cut('main.tsx', "  type ChannelEntry,\n  getInitialMainLoopModel,\n", "  getInitialMainLoopModel,\n")
cut('main.tsx', "  setAllowedChannels,\n")
cut_upto(
    'main.tsx',
    '      // Channel server allowlist from --channels flag — servers whose',
    '      // SDK opt-in for SendUserMessage via --tools.',
)
cut('main.tsx', "          devChannels,\n")
cut(
    'main.tsx',
    """  if (feature('KAIROS') || feature('KAIROS_CHANNELS')) {
    program.addOption(
      new Option(
        '--channels <servers...>',
        'MCP servers whose channel notifications (inbound push) should register this session. Space-separated server names.',
      ).hideHelp(),
    )
    program.addOption(
      new Option(
        '--dangerously-load-development-channels <servers...>',
        'Load channel servers not on the approved allowlist. For local channel development only. Shows a confirmation dialog at startup.',
      ).hideHelp(),
    )
  }

""",
)

# ----------------------------------------------------------------- cli/print.ts
cut(
    'cli/print.ts',
    """import {
  ChannelMessageNotificationSchema,
  gateChannelServer,
  wrapChannelMessage,
  findChannelEntry,
} from 'src/services/mcp/channelNotification.js'
import {
  isChannelAllowlisted,
  isChannelsEnabled,
} from 'src/services/mcp/channelAllowlist.js'
""",
)
cut('cli/print.ts', "  getAllowedChannels,\n  setAllowedChannels,\n  type ChannelEntry,\n")
cut(
    'cli/print.ts',
    """      // Capabilities passthrough with allowlist pre-filter. The IDE reads
      // experimental['claude/channel'] to decide whether to show the
      // Enable-channel prompt — only echo it if channel_enable would
      // actually pass the allowlist. Not a security boundary (the
      // handler re-runs the full gate); just avoids dead buttons.
      let capabilities: { experimental?: Record<string, unknown> } | undefined
      if (
        (feature('KAIROS') || feature('KAIROS_CHANNELS')) &&
        connection.type === 'connected' &&
        connection.capabilities.experimental
      ) {
        const exp = { ...connection.capabilities.experimental }
        if (
          exp['claude/channel'] &&
          (!isChannelsEnabled() ||
            !isChannelAllowlisted(connection.config.pluginSource))
        ) {
          delete exp['claude/channel']
        }
        if (Object.keys(exp).length > 0) {
          capabilities = { experimental: exp }
        }
      }
""",
    """      // The channel capability passthrough used to sit here: the IDE reads
      // experimental['claude/channel'] to decide whether to show its
      // Enable-channel prompt, and this pre-filtered the field against the
      // channels allowlist. Channels are gone, so the field is never echoed
      // and this stays undefined — the same value a filtered-out server got.
      let capabilities: { experimental?: Record<string, unknown> } | undefined
""",
)
cut(
    'cli/print.ts',
    """          // Channel handlers for servers allowlisted via --channels at
          // construction time (or enableChannel() mid-session). Runs every
          // turn like registerElicitationHandlers — idempotent per-client
          // (setNotificationHandler replaces, not stacks) and no-ops for
          // non-allowlisted servers (one feature-flag check).
          for (const client of allMcpClients) {
            reregisterChannelHandlerAfterReconnect(client)
          }

""",
)
cut(
    'cli/print.ts',
    "              reregisterChannelHandlerAfterReconnect(result.client)\n",
    '',
    2,
)
cut(
    'cli/print.ts',
    """        } else if (message.request.subtype === 'channel_enable') {
          const currentAppState = getAppState()
          handleChannelEnable(
            message.request_id,
            message.request.serverName,
            // Pool spread matches mcp_status — all three client sources.
            [
              ...currentAppState.mcp.clients,
              ...sdkClients,
              ...dynamicMcpState.clients,
            ],
            output,
          )
        } else if (message.request.subtype === 'mcp_authenticate') {""",
    "        } else if (message.request.subtype === 'mcp_authenticate') {",
)
cut_upto(
    'cli/print.ts',
    '/**\n * IDE-triggered channel enable. Derives the ChannelEntry from the connection\'s',
    '/**\n * Re-register the channel notification handler after mcp_reconnect /',
)
cut_upto(
    'cli/print.ts',
    '/**\n * Re-register the channel notification handler after mcp_reconnect /',
    '/**\n * Emits an error message in the correct format based on outputFormat.',
)

# ------------------------------------------- services/mcp/useManageMCPConnections.ts
P = 'services/mcp/useManageMCPConnections.ts'
cut(P, "import { getAllowedChannels } from '../../bootstrap/state.js'\n")
cut(
    P,
    """import {
  CHANNEL_PERMISSION_METHOD,
  ChannelMessageNotificationSchema,
  ChannelPermissionNotificationSchema,
  findChannelEntry,
  gateChannelServer,
  wrapChannelMessage,
} from './channelNotification.js'
import {
  type ChannelPermissionCallbacks,
  createChannelPermissionCallbacks,
  isChannelPermissionRelayEnabled,
} from './channelPermissions.js'
""",
)
cut(
    P,
    """  // Dedup the --channels blocked warning per skip kind so that a user who
  // sees "run /login" (auth skip), logs in, then hits the policy gate
  // gets a second toast.
  const channelWarnedKindsRef = useRef<
    Set<'disabled' | 'auth' | 'policy' | 'marketplace' | 'allowlist'>
  >(new Set())
  // Channel permission callbacks — constructed once, stable ref. Stored in
  // AppState so interactiveHandler can subscribe. The pending Map lives inside
  // the closure (not module-level, not AppState — functions-in-state is brittle).
  const channelPermCallbacksRef = useRef<ChannelPermissionCallbacks | null>(
    null,
  )
  if (
    (feature('KAIROS') || feature('KAIROS_CHANNELS')) &&
    channelPermCallbacksRef.current === null
  ) {
    channelPermCallbacksRef.current = createChannelPermissionCallbacks()
  }
  // Store callbacks in AppState so interactiveHandler.ts can reach them via
  // ctx.toolUseContext.getAppState(). One-time set — the ref is stable.
  useEffect(() => {
    if (feature('KAIROS') || feature('KAIROS_CHANNELS')) {
      const callbacks = channelPermCallbacksRef.current
      if (!callbacks) return
      // GrowthBook runtime gate — separate from channels so channels can
      // ship without this. Checked at mount; mid-session flips need restart.
      // If off, callbacks never go into AppState → interactiveHandler sees
      // undefined → never sends → intercept has nothing pending → "yes tbxkq"
      // flows to Claude as normal chat. One gate, full disable.
      if (!isChannelPermissionRelayEnabled()) return
      setAppState(prev => {
        if (prev.channelPermissionCallbacks === callbacks) return prev
        return { ...prev, channelPermissionCallbacks: callbacks }
      })
      return () => {
        setAppState(prev => {
          if (prev.channelPermissionCallbacks === undefined) return prev
          return { ...prev, channelPermissionCallbacks: undefined }
        })
      }
    }
  }, [setAppState])
  const { addNotification } = useNotifications()

""",
)
cut_upto(
    P,
    '          // Channel push: notifications/claude/channel → enqueue().',
    '          // Register notification handlers for list_changed notifications',
)
cut(P, "import { useNotifications } from '../../context/notifications.js'\n")

# ------------------------------------------------- hooks/useCanUseTool.tsx
cut(
    'hooks/useCanUseTool.tsx',
    """                    channelCallbacks:
                      feature('KAIROS') || feature('KAIROS_CHANNELS')
                        ? appState.channelPermissionCallbacks
                        : undefined,
""",
)

# ------------------------- hooks/toolPermission/handlers/interactiveHandler.ts
H = 'hooks/toolPermission/handlers/interactiveHandler.ts'
cut(H, "import { getAllowedChannels } from '../../../bootstrap/state.js'\n")
cut(
    H,
    """import {
  CHANNEL_PERMISSION_REQUEST_METHOD,
  type ChannelPermissionRequestParams,
  findChannelEntry,
} from '../../../services/mcp/channelNotification.js'
import type { ChannelPermissionCallbacks } from '../../../services/mcp/channelPermissions.js'
import {
  filterPermissionRelayClients,
  shortRequestId,
  truncateForPreview,
} from '../../../services/mcp/channelPermissions.js'
""",
)
cut(H, "  channelCallbacks?: ChannelPermissionCallbacks\n")
cut(H, "    channelCallbacks,\n")
cut(
    H,
    """  // Hoisted so local/hook/classifier wins can remove the pending channel
  // entry. No "tell remote to dismiss" equivalent — the text sits in your
  // phone, and a stale "yes abc123" after local-resolve falls through
  // tryConsumeReply (entry gone) and gets enqueued as normal chat.
  let channelUnsubscribe: (() => void) | undefined

""",
)
cut_upto(
    H,
    '  // Channel permission relay. Send a',
    '  // Skip hooks if they were already awaited in the coordinator branch above',
)
# the six win paths dropped their pending-channel cleanup with the channel send
drop_exact_lines(H, 'channelUnsubscribe?.()')

# ------------------------------------------ utils/messageQueueManager.ts
cut(
    'utils/messageQueueManager.ts',
    """/**
 * Whether this queued command should render in the queue preview under the
 * prompt. Superset of editable — channel messages show (so the keyboard user
 * sees what arrived) but stay non-editable (raw XML).
 */
export function isQueuedCommandVisible(cmd: QueuedCommand): boolean {
  if (
    (feature('KAIROS') || feature('KAIROS_CHANNELS')) &&
    cmd.origin?.kind === 'channel'
  )
    return true
  return isQueuedCommandEditable(cmd)
}""",
    """/**
 * Whether this queued command should render in the queue preview under the
 * prompt. Superset of editable: channel messages used to be the one extra
 * case (so the keyboard user saw what arrived while staying non-editable);
 * they went with the channel push surface.
 */
export function isQueuedCommandVisible(cmd: QueuedCommand): boolean {
  return isQueuedCommandEditable(cmd)
}""",
)

# ------------------------------------------------------------ utils/messages.ts
cut(
    'utils/messages.ts',
    """    // Channel messages stay isMeta (for snip-tag/turn-boundary/brief-mode
    // semantics) but render in the default transcript — the keyboard user
    // should see what arrived. The <channel> tag in UserTextMessage handles
    // the actual rendering.
    if (
      (feature('KAIROS') || feature('KAIROS_CHANNELS')) &&
      message.origin?.kind === 'channel'
    )
      return true
    return false
""",
    """    return false
""",
)

# ------------------------------------------------------- the three plan tools
cut('tools/EnterPlanModeTool/EnterPlanModeTool.ts', "  getAllowedChannels,\n")
cut(
    'tools/EnterPlanModeTool/EnterPlanModeTool.ts',
    """    // When --channels is active, ExitPlanMode is disabled (its approval
    // dialog needs the terminal). Disable entry too so plan mode isn't a
    // trap the model can enter but never leave.
    if (
      (feature('KAIROS') || feature('KAIROS_CHANNELS')) &&
      getAllowedChannels().length > 0
    ) {
      return false
    }
    return true
""",
    """    return true
""",
)
cut('tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts', "  getAllowedChannels,\n")
cut(
    'tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts',
    """    // When --channels is active the user is likely on Telegram/Discord, not
    // watching the TUI. The plan-approval dialog would hang. Paired with the
    // same gate on EnterPlanMode so plan mode isn't a trap.
    if (
      (feature('KAIROS') || feature('KAIROS_CHANNELS')) &&
      getAllowedChannels().length > 0
    ) {
      return false
    }
    return true
""",
    """    return true
""",
)
cut('tools/AskUserQuestionTool/AskUserQuestionTool.tsx', "  getAllowedChannels,\n")
cut(
    'tools/AskUserQuestionTool/AskUserQuestionTool.tsx',
    """    // When --channels is active the user is likely on Telegram/Discord, not
    // watching the TUI. The multiple-choice dialog would hang with nobody at
    // the keyboard. Channel permission relay already skips
    // requiresUserInteraction() tools (interactiveHandler.ts) so there's
    // no alternate approval path.
    if (
      (feature('KAIROS') || feature('KAIROS_CHANNELS')) &&
      getAllowedChannels().length > 0
    ) {
      return false
    }
    return true
""",
    """    return true
""",
)

# ------------------------------------------------------------------ LogoV2.tsx
L = 'components/LogoV2/LogoV2.tsx'
cut(
    L,
    """// Conditional require so ChannelsNotice.tsx tree-shakes when both flags are
// false. A module-scope helper component inside a feature() ternary does NOT
// tree-shake (docs/feature-gating.md); the require pattern eliminates the
// whole file.
/* eslint-disable @typescript-eslint/no-require-imports */
const ChannelsNoticeModule =
  feature('KAIROS') || feature('KAIROS_CHANNELS')
    ? (require('./ChannelsNotice.js') as typeof import('./ChannelsNotice.js'))
    : null
/* eslint-enable @typescript-eslint/no-require-imports */
""",
)
cut(L, "        {ChannelsNoticeModule && <ChannelsNoticeModule.ChannelsNotice />}\n", '', 3)

# ------------------------------------------------------- utils/settings/types.ts
cut(
    'utils/settings/types.ts',
    """      // Teams/Enterprise opt-IN for channel notifications. Default OFF.
      // MCP servers that declare the claude/channel capability can push
      // inbound messages into the conversation; for managed orgs this only
      // works when explicitly enabled. Which servers can connect at all is
      // still governed by allowedMcpServers/deniedMcpServers. Not
      // feature-spread: KAIROS_CHANNELS is external:true, and the spread
      // wrecks type inference for allowedChannelPlugins (the .passthrough()
      // catch-all gives {} instead of the array type).
      channelsEnabled: z
        .boolean()
        .optional()
        .describe(
          'Teams/Enterprise opt-in for channel notifications (MCP servers with the ' +
            'claude/channel capability pushing inbound messages). Default off. ' +
            'Set true to allow; users then select servers via --channels.',
        ),
      // Org-level channel plugin allowlist. When set, REPLACES the
      // Anthropic ledger — admin owns the trust decision. Undefined means
      // fall back to the ledger. Plugin-only entry shape (same as the
      // ledger); server-kind entries still need the dev flag.
      allowedChannelPlugins: z
        .array(
          z.object({
            marketplace: z.string(),
            plugin: z.string(),
          }),
        )
        .optional()
        .describe(
          'Teams/Enterprise allowlist of channel plugins. When set, ' +
            'replaces the default Anthropic allowlist — admins decide which ' +
            'plugins may push inbound messages. Undefined falls back to the default. ' +
            'Requires channelsEnabled: true.',
        ),
""",
)

# ------------------------------------------------------- interactiveHelpers.tsx
I = 'interactiveHelpers.tsx'
cut(I, "import { checkGate_CACHED_OR_BLOCKING } from './services/analytics/growthbook.js'\n")
cut(
    I,
    """import {
  type ChannelEntry,
  getAllowedChannels,
  setAllowedChannels,
  setHasDevChannels,
  setSessionTrustAccepted,
  setStatsStore,
} from './bootstrap/state.js'
""",
    """import {
  setSessionTrustAccepted,
  setStatsStore,
} from './bootstrap/state.js'
""",
)
cut(I, "  devChannels?: ChannelEntry[],\n")
cut_upto(
    I,
    '  // --dangerously-load-development-channels confirmation. On accept, append',
    '  return onboardingShown\n}',
)

print('d7f2 ok')
