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


# ---------- cli/remoteIO.ts 收尾 ----------
O = 'cli/remoteIO.ts'
cut_range(
    O,
    "    // Push a silent keep_alive frame on a fixed interval so upstream\n",
    "    // session_keepalive_interval_v2_ms, default 120s); 0 = disabled.\n",
    "",
)
cut(O, """    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = null
    }
""")
assert 'keepAlive' not in rd(O), 'remoteIO 残留'

# ---------- 11. cli/transports/ccrClient.ts ----------
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

# ---------- 12. tools/BriefTool ----------
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

print('e5a2 ok')
