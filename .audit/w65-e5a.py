import os
import re

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


def drop_if_blocks(p, cond):
    """Remove every `cond { ... }` statement block, brace-matched."""
    text = rd(p)
    needle = 'if (' + cond + ') {'
    out = text
    while True:
        i = out.find(needle)
        if i < 0:
            break
        line_start = out.rfind('\n', 0, i) + 1
        depth = 0
        j = out.index('{', i)
        k = j
        while k < len(out):
            c = out[k]
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    break
            k += 1
        assert depth == 0, (p, cond)
        end = k + 1
        if out[end:end + 1] == '\n':
            end += 1
        out = out[:line_start] + out[end:]
    assert out != text, (p, cond)
    wr(p, out)


# ============ 1. constants/product.ts — 移植 toCompatSessionId ============
P = 'constants/product.ts'
cut_range(
    P,
    " * environment_kind and the frontend accepts `cse_*` directly, flip the gate\n",
    " * to keep constants/ leaf-of-DAG at module-load time).\n",
    """ * environment_kind and the frontend accepts `cse_*` directly, flip the gate
 * off. No-op for IDs already in `session_*` form.
""")
cut_range(
    P,
    "  /* eslint-disable @typescript-eslint/no-require-imports */\n",
    "  /* eslint-enable @typescript-eslint/no-require-imports */\n",
    "",
)
t = rd(P)
assert 'toCompatSessionId(' in t and '../bridge' not in t, 'product.ts 残留'
# 追加移植的 helper（引用 bridge/sessionIdCompat.ts 的原始实现）
t += """
// Ported from bridge/sessionIdCompat.ts:26-42 — the cse_→session_ retag. The
// bridge's kill switch (`setCseShimGate`, called only from bridge init) is gone
// with bridge/, so the shim's own documented default applies: active.
function toCompatSessionId(id: string): string {
  if (!id.startsWith('cse_')) return id
  return 'session_' + id.slice('cse_'.length)
}
"""
wr(P, t)

# ============ 2. utils/config.ts ============
C = 'utils/config.ts'
cut(C, """const ccrAutoConnect = feature('CCR_AUTO_CONNECT')
  ? (require('../bridge/bridgeEnabled.js') as typeof import('../bridge/bridgeEnabled.js'))
  : null
""")
cut(C, """  if (feature('CCR_AUTO_CONNECT')) {
    if (ccrAutoConnect?.getCcrAutoConnectDefault()) return true
  }
""")
cut(C, """ *   2. CCR auto-connect default (ant-only build, GrowthBook-gated)
""")

# ============ 3. commands/rename/rename.ts ============
R = 'commands/rename/rename.ts'
cut(R, """import {
  getBridgeBaseUrlOverride,
  getBridgeTokenOverride,
} from '../../bridge/bridgeConfig.js'
""")
cut(R, """  // Sync title to bridge session on claude.ai/code (best-effort, non-blocking).
  // v2 env-less bridge stores cse_* in replBridgeSessionId —
  // updateBridgeSessionTitle retags internally for the compat endpoint.
  const appState = context.getAppState()
  const bridgeSessionId = appState.replBridgeSessionId
  if (bridgeSessionId) {
    const tokenOverride = getBridgeTokenOverride()
    void import('../../bridge/createSession.js').then(
      ({ updateBridgeSessionTitle }) =>
        updateBridgeSessionTitle(bridgeSessionId, newName, {
          baseUrl: getBridgeBaseUrlOverride(),
          getAccessToken: tokenOverride ? () => tokenOverride : undefined,
        }).catch(() => {}),
    )
  }

""")

# ============ 4. components/Spinner.tsx — 移植 shimmer ============
S = 'components/Spinner.tsx'
cut(S, """import {
  computeGlimmerIndex,
  computeShimmerSegments,
  SHIMMER_INTERVAL_MS,
} from '../bridge/bridgeStatusUtil.js'
""")
cut(S, "import { stringWidth } from '../ink/stringWidth.js'\n",
    "import { stringWidth } from '../ink/stringWidth.js'\nimport { getGraphemeSegmenter } from '../utils/intl.js'\n")
t = rd(S)
assert 'computeShimmerSegments(' in t
t += """
// Ported from bridge/bridgeStatusUtil.ts:20,53-77,80-116 — the shimmer tick and
// the three-way visual-column split the verb highlight renders from.
const SHIMMER_INTERVAL_MS = 150

/** Compute the glimmer index for a reverse-sweep shimmer animation. */
function computeGlimmerIndex(tick: number, messageWidth: number): number {
  const cycleLength = messageWidth + 20
  return messageWidth + 10 - (tick % cycleLength)
}

/**
 * Split text into three segments by visual column position for shimmer
 * rendering. Uses grapheme segmentation and `stringWidth` so the split is
 * correct for multi-byte characters, emoji, and CJK glyphs.
 */
function computeShimmerSegments(
  text: string,
  glimmerIndex: number,
): { before: string; shimmer: string; after: string } {
  const messageWidth = stringWidth(text)
  const shimmerStart = glimmerIndex - 1
  const shimmerEnd = glimmerIndex + 1

  // When shimmer is offscreen, return all text as "before"
  if (shimmerStart >= messageWidth || shimmerEnd < 0) {
    return { before: text, shimmer: '', after: '' }
  }

  // Split into at most 3 segments by visual column position
  const clampedStart = Math.max(0, shimmerStart)
  let colPos = 0
  let before = ''
  let shimmer = ''
  let after = ''
  for (const { segment } of getGraphemeSegmenter().segment(text)) {
    const segWidth = stringWidth(segment)
    if (colPos + segWidth <= clampedStart) {
      before += segment
    } else if (colPos > shimmerEnd) {
      after += segment
    } else {
      shimmer += segment
    }
    colPos += segWidth
  }

  return { before, shimmer, after }
}
"""
wr(S, t)

# ============ 5. components/PromptInput/PromptInputFooter.tsx ============
F = 'components/PromptInput/PromptInputFooter.tsx'
cut(F, "import { isBridgeEnabled } from '../../bridge/bridgeEnabled.js'\n")
cut(F, "import { getBridgeStatus } from '../../bridge/bridgeStatusUtil.js'\n")
cut(F, "import { Box, Text } from '../../ink.js'\n", "import { Box } from '../../ink.js'\n")
cut(F, "  bridgeSelected: boolean\n  tmuxSelected: boolean\n", "  tmuxSelected: boolean\n")
cut(F, "  bridgeSelected,\n  tmuxSelected,\n", "  tmuxSelected,\n")
cut(F, """          {false}
          <BridgeStatusIndicator bridgeSelected={bridgeSelected} />
""", """          {false}
""")
cut_range(F, "type BridgeStatusProps = {\n", "    </Text>\n  )\n}\n", "")
t = rd(F)
assert 'BridgeStatus' not in t, 'PIFooter 残留'

# ============ 6. components/Settings/Config.tsx ============
G = 'components/Settings/Config.tsx'
cut(G, "import { isBridgeEnabled } from '../../bridge/bridgeEnabled.js'\n")
cut_range(
    G,
    "    // Remote at startup toggle — gated on build flag + GrowthBook + policy\n",
    "        ]\n      : []),\n",
    "",
)

# ============ 7. components/PromptInput/PromptInput.tsx ============
I = 'components/PromptInput/PromptInput.tsx'
cut(I, "import { BridgeDialog } from '../BridgeDialog.js'\n")
cut(I, "  const [showBridgeDialog, setShowBridgeDialog] = useState(false)\n")
cut(I, """  const replBridgeConnected = useAppState(s => s.replBridgeConnected)
  const replBridgeExplicit = useAppState(s => s.replBridgeExplicit)
  const replBridgeReconnecting = useAppState(s => s.replBridgeReconnecting)
  // Must match BridgeStatusIndicator's render condition (PromptInputFooter.tsx) —
  // the pill returns null for implicit-and-not-reconnecting, so nav must too,
  // otherwise bridge becomes an invisible selection stop.
  const bridgeFooterVisible =
    replBridgeConnected && (replBridgeExplicit || replBridgeReconnecting)
""")
cut(I, "  const bridgeSelected = footerItemSelected === 'bridge'\n")
cut(I, "        bridgeFooterVisible && 'bridge',\n")
cut(I, "      bridgeFooterVisible,\n")
cut(I, """          case 'bridge':
            setShowBridgeDialog(true)
            selectFooterItem(null)
            break
""")
cut(I, """  if (showBridgeDialog) {
    return (
      <BridgeDialog
        onDone={() => {
          setShowBridgeDialog(false)
          selectFooterItem(null)
        }}
      />
    )
  }

""")
cut(I, "        bridgeSelected={bridgeSelected}\n")
t = rd(I)
assert 'Bridge' not in t and 'bridgeFooterVisible' not in t, 'PromptInput 残留'

# ============ 8. hooks/toolPermission/handlers/interactiveHandler.ts ============
H = 'hooks/toolPermission/handlers/interactiveHandler.ts'
cut(H, "import type { BridgePermissionCallbacks } from '../../../bridge/bridgePermissionCallbacks.js'\n")
cut(H, "import { randomUUID } from 'crypto'\n")
cut(H, "  bridgeCallbacks?: BridgePermissionCallbacks\n")
cut(H, "    bridgeCallbacks,\n")
cut(H, "  const bridgeRequestId = bridgeCallbacks ? randomUUID() : undefined\n")
cut_range(
    H,
    "  // Race 4: Bridge permission response from CCR (claude.ai)\n",
    "    signal.addEventListener('abort', unsubscribe, { once: true })\n  }\n\n",
    "",
)
drop_if_blocks(H, 'bridgeCallbacks && bridgeRequestId')
cut(H, """          // Bridge is the other remote — tell it we're done.
""")
cut(H, "  // Channel permission relay — races alongside the bridge block above. Send a\n",
    "  // Channel permission relay. Send a\n")
cut(H, """  // permission prompt to every active channel (Telegram, iMessage, etc.) via
  // its MCP send_message tool, then race the reply against local/bridge/hook/
  // classifier. The inbound "yes abc123" is intercepted in the notification
""", """  // permission prompt to every active channel (Telegram, iMessage, etc.) via
  // its MCP send_message tool, then race the reply against local/hook/classifier.
  // The inbound "yes abc123" is intercepted in the notification
""")
cut(H, """  // Unlike the bridge block, this still guards on `requiresUserInteraction` —
""", """  // This still guards on `requiresUserInteraction` —
""")
cut(H, """      // hasPermissionsToUseTool call above opens a window where CCR
        // could have responded in flight. Matches onAllow/onReject/hook
        // paths. cancelRequest tells CCR to dismiss its prompt — without
        // it, the web UI shows a stale prompt for a tool that's already
        // executing (particularly visible when recheck is triggered by
        // a CCR-initiated mode switch, the very case this callback exists
        // for after useReplBridge started calling it).
        if (!claim()) return
""", """      // hasPermissionsToUseTool call above opens a window where a
        // concurrent racer could have resolved in flight. Matches
        // onAllow/onReject/hook paths.
        if (!claim()) return
""")
t = rd(H)
assert 'bridgeCallbacks' not in t and 'bridgeRequestId' not in t, 'IH 残留'

# ============ 9. hooks/useCanUseTool.tsx ============
U = 'hooks/useCanUseTool.tsx'
cut(U, """                    bridgeCallbacks: feature('BRIDGE_MODE')
                      ? appState.replBridgePermissionCallbacks
                      : undefined,
""")

# ============ 10. cli/remoteIO.ts ============
O = 'cli/remoteIO.ts'
cut(O, "import { getPollIntervalConfig } from '../bridge/pollConfig.js'\n")
cut(O, "  private keepAliveTimer: ReturnType<typeof setInterval> | null = null\n")
cut_range(
    O,
    "    // Bridge-only: fixes Envoy idle timeout on bridge-topology sessions\n",
    "      this.keepAliveTimer.unref?.()\n    }\n\n",
    "",
)
cut_range(
    O,
    "    // proxies and the session-ingress layer don't GC an otherwise-idle\n",
    "    // need it — different network path.\n",
    "",
)
cut(O, """    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = null
    }
""")

# ============ 11. cli/transports/ccrClient.ts — 移植 decodeJwtExpiry ============
K = 'cli/transports/ccrClient.ts'
cut(K, "import { decodeJwtExpiry } from '../../bridge/jwtUtils.js'\n")
t = rd(K)
t += """
// Ported from bridge/jwtUtils.ts:22-58 — decode a session-ingress JWT payload
// without verifying the signature. The `sk-ant-si-` prefix is stripped first.
function decodeJwtPayload(token: string): unknown | null {
  const jwt = token.startsWith('sk-ant-si-')
    ? token.slice('sk-ant-si-'.length)
    : token
  const parts = jwt.split('.')
  if (parts.length !== 3 || !parts[1]) return null
  try {
    return jsonParse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

/** Decode the `exp` (expiry) claim, in Unix seconds, or null if unparseable. */
function decodeJwtExpiry(token: string): number | null {
  const payload = decodeJwtPayload(token)
  if (
    payload !== null &&
    typeof payload === 'object' &&
    'exp' in payload &&
    typeof payload.exp === 'number'
  ) {
    return payload.exp
  }
  return null
}
"""
wr(K, t)

# ============ 12. tools/BriefTool ============
A = 'tools/BriefTool/attachments.ts'
cut(A, """  // Dynamic import inside the feature() guard so upload.ts (axios, crypto,
  // zod, auth utils, MIME map) is fully eliminated from non-BRIDGE_MODE
  // builds. A static import would force module-scope evaluation regardless
  // of the guard inside uploadBriefAttachment — CLAUDE.md: "helpers defined
  // outside remain in the build even if never called".
  if (feature('BRIDGE_MODE')) {
    // Headless/SDK callers never set appState.replBridgeEnabled (only the TTY
    // REPL does, at main.tsx init). CLAUDE_CODE_BRIEF_UPLOAD lets a host that
    // runs the CLI as a subprocess opt in — e.g. the cowork desktop bridge,
    // which already passes CLAUDE_CODE_OAUTH_TOKEN for auth.
    const shouldUpload =
      uploadCtx.replBridgeEnabled ||
      isEnvTruthy(process.env.CLAUDE_CODE_BRIEF_UPLOAD)
    const { uploadBriefAttachment } = await import('./upload.js')
    const uuids = await Promise.all(
      stated.map(a =>
        uploadBriefAttachment(a.path, a.size, {
          replBridgeEnabled: shouldUpload,
          signal: uploadCtx.signal,
        }),
      ),
    )
    return stated.map((a, i) =>
      uuids[i] === undefined ? a : { ...a, file_uuid: uuids[i] },
    )
  }
  return stated
""", "  return stated\n}\n")
cut(A, """ * Shared attachment validation + resolution for SendUserMessage and
 * SendUserFile. Lives in BriefTool/ so the dynamic `./upload.js` import
 * inside the feature('BRIDGE_MODE') guard stays relative and upload.ts
 * (axios, crypto, auth utils) remains tree-shakeable from non-bridge builds.
 */

import { feature } from 'bun:bundle'
import { stat } from 'fs/promises'
""", """ * Shared attachment validation + resolution for SendUserMessage and
 * SendUserFile.
 */

import { stat } from 'fs/promises'
""")
cut(A, "import { isEnvTruthy } from '../../utils/envUtils.js'\n")
os.remove(B + 'tools/BriefTool/upload.ts')

print('e5a ok')
