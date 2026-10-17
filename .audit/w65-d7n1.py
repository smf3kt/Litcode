#!/usr/bin/env python3
"""W65 wave D step 7n: the session-ingress bearer surface.

`utils/sessionIngressAuth.ts` read a bearer for the CCR/session-ingress API
from CLAUDE_CODE_SESSION_ACCESS_TOKEN, an inherited file descriptor, or a
well-known file. Every consumer below is that API's client, so the bearer and
what could not authenticate without it leave together. The declared SDK
schema member for the persistence message stays: removing a declared contract
is a separate review, the same call waves C, 7k and 7m made.
"""

import io
import os

ROOT = "/Users/mant1ssa/Projects/cc-base-2188"


def read(p):
    with io.open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return f.read()


def write(p, s):
    with io.open(os.path.join(ROOT, p), "w", encoding="utf-8", newline="") as f:
        f.write(s)


def cut(path, old, new="", n=1):
    s = read(path)
    got = s.count(old)
    assert got == n, f"{path}: expected {n}, found {got}: {old[:120]!r}"
    write(path, s.replace(old, new, n))


def cut_between(path, start, end, new=""):
    s = read(path)
    i = s.find(start)
    assert i >= 0, f"{path}: start not found: {start[:120]!r}"
    assert s.count(start) == 1, f"{path}: start not unique: {start[:120]!r}"
    j = s.find(end, i)
    assert j >= 0, f"{path}: end not found after start: {end[:120]!r}"
    assert s.count(end) == 1, f"{path}: end not unique: {end[:120]!r}"
    write(path, s[:i] + new + s[j + len(end):])


# --- The bearer module, its bootstrap cache, and the files whose only
# credential it was.

for p in [
    "utils/sessionIngressAuth.ts",
    "utils/filePersistence/filePersistence.ts",
    "utils/filePersistence/types.ts",
    "services/api/filesApi.ts",
]:
    os.remove(os.path.join(ROOT, p))

cut("bootstrap/state.ts", "  sessionIngressToken: string | null | undefined\n")
cut("bootstrap/state.ts", "    sessionIngressToken: undefined,\n")
cut("bootstrap/state.ts", "export function getSessionIngressToken(): string | null | undefined {\n  return STATE.sessionIngressToken\n}\n\nexport function setSessionIngressToken(token: string | null): void {\n  STATE.sessionIngressToken = token\n}\n\n")

# --- main.tsx: the --file download block. Its only possible path without the
# token was the error-and-exit, and the flag existed to fetch from the same
# ingress API.

cut(
    "main.tsx",
    "import {\n  type DownloadResult,\n  downloadSessionFiles,\n  type FilesApiConfig,\n  parseFileSpecs,\n} from './services/api/filesApi.js'\n",
)
cut("main.tsx", "import { getSessionIngressAuthToken } from './utils/sessionIngressAuth.js'\n")
cut("main.tsx", "      // Promise for file downloads - started early, awaited before REPL renders\n      let fileDownloadPromise: Promise<DownloadResult[]> | undefined\n\n")
cut_between(
    "main.tsx",
    "      // Download file resources if specified via --file flag\n",
    "          fileDownloadPromise = downloadSessionFiles(files, config)\n        }\n      }\n\n",
)
cut_between(
    "main.tsx",
    "        // Await file downloads before rendering REPL (files must be available)\n",
    "              `Error downloading files: ${errorMessage(error)}`,\n            )\n          }\n        }\n\n",
)

# --- services/mcp/client.ts: the ingress bearer was an extra Authorization on
# remote MCP transports, used only when the server had no OAuth tokens of its
# own.

cut("services/mcp/client.ts", "import { getSessionIngressAuthToken } from '../../utils/sessionIngressAuth.js'\n")
cut(
    "services/mcp/client.ts",
    "      // If we have the session ingress JWT, we will connect via the session ingress rather than\n      // to remote MCP's directly.\n      const sessionIngressToken = getSessionIngressAuthToken()\n\n",
)
cut(
    "services/mcp/client.ts",
    "          ...(sessionIngressToken && {\n            Authorization: `Bearer ${sessionIngressToken}`,\n          }),\n",
)
cut("services/mcp/client.ts", "            hasSessionAuth: !!sessionIngressToken,\n")
cut(
    "services/mcp/client.ts",
    "        // Check if this server has stored OAuth tokens. If so, the SDK's\n        // authProvider will set Authorization — don't override with the\n        // session ingress token (SDK merges requestInit AFTER authProvider).\n        // CCR proxy URLs (ccr_shttp_mcp) have no stored OAuth, so they still\n        // get the ingress token. See PR #24454 discussion.\n        const hasOAuthTokens = !!(await authProvider.tokens())\n\n",
    "        // The SDK's authProvider sets Authorization from this server's\n        // stored OAuth tokens (it merges requestInit AFTER authProvider).\n",
)
cut(
    "services/mcp/client.ts",
    "              ...(sessionIngressToken &&\n                !hasOAuthTokens && {\n                  Authorization: `Bearer ${sessionIngressToken}`,\n                }),\n",
)

# --- components/mcp/MCPSettings.tsx: the "session auth" arm of the
# authenticated check.

cut("components/mcp/MCPSettings.tsx", "import { getSessionIngressAuthToken } from '../../utils/sessionIngressAuth.js'\n")
cut(
    "components/mcp/MCPSettings.tsx",
    "            // Server is authenticated if:\n            // 1. It has OAuth tokens, OR\n            // 2. It's connected via session auth (has session token and is connected), OR\n            // 3. It's connected and has tools (meaning it's working, regardless of auth method)\n            const hasSessionAuth =\n              getSessionIngressAuthToken() !== null &&\n              client.type === 'connected'\n            const hasToolsAndConnected =\n",
    "            // Server is authenticated if it has OAuth tokens, or if it is\n            // connected and has tools (meaning it is working, regardless of\n            // auth method).\n            const hasToolsAndConnected =\n",
)
cut(
    "components/mcp/MCPSettings.tsx",
    "            isAuthenticated =\n              Boolean(tokens) || hasSessionAuth || hasToolsAndConnected\n",
    "            isAuthenticated = Boolean(tokens) || hasToolsAndConnected\n",
)

# --- cli/print.ts: the file-persistence call. The feature's own gate read the
# environment kind, the ingress token and the remote session id.

cut("cli/print.ts", "import { executeFilePersistence } from 'src/utils/filePersistence/filePersistence.js'\n")
cut_between(
    "cli/print.ts",
    "          if (feature('FILE_PERSISTENCE') && turnStartTime !== undefined) {\n",
    "                  uuid: randomUUID(),\n                  session_id: getSessionId(),\n                })\n              },\n            )\n          }\n\n",
)

# --- cli/remoteIO.ts: the stream-url transport's two bearer reads.

cut("cli/remoteIO.ts", "import { getSessionIngressAuthToken } from '../utils/sessionIngressAuth.js'\n")
cut(
    "cli/remoteIO.ts",
    "    // Prepare headers with session token if available\n    const headers: Record<string, string> = {}\n    const sessionToken = getSessionIngressAuthToken()\n    if (sessionToken) {\n      headers['Authorization'] = `Bearer ${sessionToken}`\n    } else {\n      logForDebugging('[remote-io] No session ingress token available', {\n        level: 'error',\n      })\n    }\n",
    "    const headers: Record<string, string> = {}\n",
)
cut(
    "cli/remoteIO.ts",
    "    // Provide a callback that re-reads the session token dynamically.\n    // When the parent process refreshes the token (via token file or env var),\n    // the transport can pick it up on reconnection.\n    const refreshHeaders = (): Record<string, string> => {\n      const h: Record<string, string> = {}\n      const freshToken = getSessionIngressAuthToken()\n      if (freshToken) {\n        h['Authorization'] = `Bearer ${freshToken}`\n      }\n      const freshErVersion = process.env.CLAUDE_CODE_ENVIRONMENT_RUNNER_VERSION\n",
    "    // Provide a callback that re-reads the runner version dynamically so the\n    // transport can pick up a change on reconnection.\n    const refreshHeaders = (): Record<string, string> => {\n      const h: Record<string, string> = {}\n      const freshErVersion = process.env.CLAUDE_CODE_ENVIRONMENT_RUNNER_VERSION\n",
)

# --- The two transports: their auth-header default was the ingress bearer and
# no caller ever passed the option, so the default becomes "no headers" — the
# arm getSessionIngressAuthHeaders() already returned without a token.

cut("cli/transports/SSETransport.ts", "import { getSessionIngressAuthHeaders } from '../../utils/sessionIngressAuth.js'\n")
cut(
    "cli/transports/SSETransport.ts",
    "    /**\n     * Per-instance auth header source. Omit to read the process-wide\n     * CLAUDE_CODE_SESSION_ACCESS_TOKEN (single-session callers). Required\n     * for concurrent multi-session callers — the env-var path is a process\n     * global and would stomp across sessions.\n     */\n",
    "    /**\n     * Per-instance auth header source. Omit to send no auth headers.\n     */\n",
)
cut(
    "cli/transports/SSETransport.ts",
    "    this.getAuthHeaders = getAuthHeaders ?? getSessionIngressAuthHeaders\n",
    "    this.getAuthHeaders = getAuthHeaders ?? (() => ({}))\n",
)

cut(
    "cli/transports/ccrClient.ts",
    "import {\n  getSessionIngressAuthHeaders,\n  getSessionIngressAuthToken,\n} from '../../utils/sessionIngressAuth.js'\n",
)
cut(
    "cli/transports/ccrClient.ts",
    "      /**\n       * Per-instance auth header source. Omit to read the process-wide\n       * CLAUDE_CODE_SESSION_ACCESS_TOKEN (single-session callers — REPL,\n       * daemon). Required for concurrent multi-session callers.\n       */\n",
    "      /**\n       * Per-instance auth header source. Omit to send no auth headers.\n       */\n",
)
cut(
    "cli/transports/ccrClient.ts",
    "    this.getAuthHeaders = opts?.getAuthHeaders ?? getSessionIngressAuthHeaders\n",
    "    this.getAuthHeaders = opts?.getAuthHeaders ?? (() => ({}))\n",
)
cut(
    "cli/transports/ccrClient.ts",
    "        // A 401 with an expired JWT is deterministic — no retry will\n        // ever succeed. Check the token's own exp before burning\n        // wall-clock on the threshold loop.\n        const tok = getSessionIngressAuthToken()\n        const exp = tok ? decodeJwtExpiry(tok) : null\n        if (exp !== null && exp * 1000 < Date.now()) {\n          logForDebugging(\n            `CCRClient: session_token expired (exp=${new Date(exp * 1000).toISOString()}) — no refresh was delivered, exiting`,\n            { level: 'error' },\n          )\n          logForDiagnosticsNoPII('error', 'cli_worker_token_expired_no_refresh')\n          this.onEpochMismatch()\n        }\n        // Token looks valid but server says 401 — possible server-side\n        // blip (userauth down, KMS hiccup). Count toward threshold.\n        this.consecutiveAuthFailures++\n",
    "        // A 401 with valid headers is a server-side condition — possible\n        // blip (userauth down, KMS hiccup). Count toward threshold.\n        this.consecutiveAuthFailures++\n",
)
cut(
    "cli/transports/ccrClient.ts",
    "            `CCRClient: ${this.consecutiveAuthFailures} consecutive auth failures with a valid-looking token — server-side auth unrecoverable, exiting`,\n",
    "            `CCRClient: ${this.consecutiveAuthFailures} consecutive auth failures — server-side auth unrecoverable, exiting`,\n",
)
# The JWT decoder pair was a port from bridge/jwtUtils.ts whose only caller was
# the expiry check above.
cut_between(
    "cli/transports/ccrClient.ts",
    "// Ported from bridge/jwtUtils.ts:22-58 — decode a session-ingress JWT payload\n",
    "    return payload.exp\n  }\n  return null\n}\n",
)

cut("cli/transports/HybridTransport.ts", "import { getSessionIngressAuthToken } from '../../utils/sessionIngressAuth.js'\n")
cut_between(
    "cli/transports/HybridTransport.ts",
    "  private async postOnce(events: StdoutMessage[]): Promise<void> {\n",
    "    throw new Error(`POST failed with ${response.status}`)\n  }\n",
    "  private async postOnce(events: StdoutMessage[]): Promise<void> {\n    logForDebugging('HybridTransport: No session token available for POST')\n    logForDiagnosticsNoPII('warn', 'cli_hybrid_post_no_token')\n  }\n",
)

print("7n part 1 applied")
