import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "47b5ef3"
const digest = text => createHash("sha256").update(text).digest("hex")

// This wave ports nothing. `utils/sessionIngressAuth.ts` read a bearer for the
// CCR/session-ingress API from an inherited env var, a file descriptor, or a
// well-known file; every one of its consumers is that API's client, so the
// bearer and the surfaces that could not authenticate without it leave
// together. The transport lane itself stays, folded to the no-headers arm its
// own code already had for a missing token.
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

// 1. The bearer, its cache, its env var, and the four modules whose only
//    credential it was.
assert.equal(
  rg("sessionIngressAuth|getSessionIngressAuthToken|getSessionIngressAuthHeaders|updateSessionIngressAuthToken|sessionIngressToken|CLAUDE_CODE_SESSION_ACCESS_TOKEN|WEBSOCKET_AUTH_FILE_DESCRIPTOR|executeFilePersistence|downloadSessionFiles|parseFileSpecs|FilesApiConfig|findModifiedFiles"),
  "",
  "a live reference to the removed bearer surface remains",
)
for (const p of [
  "utils/sessionIngressAuth.ts",
  "utils/filePersistence/filePersistence.ts",
  "utils/filePersistence/types.ts",
  "services/api/filesApi.ts",
]) {
  assert.equal(fs.existsSync(`${root}/${p}`), false, `${p} is gone`)
}

// 2. Each consumer folded to the arm a missing token produced.
const state = fs.readFileSync(`${root}/bootstrap/state.ts`, "utf8")
assert.doesNotMatch(state, /sessionIngressToken/)
assert.match(state, /  clientType: string\n  questionPreviewFormat/)

const main = fs.readFileSync(`${root}/main.tsx`, "utf8")
assert.doesNotMatch(main, /fileSpecs|fileDownloadPromise|--file/)
assert.match(
  main,
  /    \/\/ A remote session identifies itself through the entrypoint\.\n    if \(process\.env\.CLAUDE_CODE_ENTRYPOINT === 'remote'\) \{\n      return 'remote'\n    \}\n/,
)

const client = fs.readFileSync(`${root}/services/mcp/client.ts`, "utf8")
assert.doesNotMatch(client, /sessionIngressToken|hasOAuthTokens/)
assert.match(client, /        \/\/ The SDK's authProvider sets Authorization from this server's\n        \/\/ stored OAuth tokens \(it merges requestInit AFTER authProvider\)\./)

const mcpSettings = fs.readFileSync(`${root}/components/mcp/MCPSettings.tsx`, "utf8")
assert.doesNotMatch(mcpSettings, /hasSessionAuth/)
assert.match(mcpSettings, /            isAuthenticated = Boolean\(tokens\) \|\| hasToolsAndConnected\n/)

const print = fs.readFileSync(`${root}/cli/print.ts`, "utf8")
assert.doesNotMatch(print, /FILE_PERSISTENCE|executeFilePersistence|turnStartTime/)
assert.match(print, /          abortController = createAbortController\(\)\n\n          headlessProfilerCheckpoint\('before_ask'\)/)

// 3. This step pinned the transport lane as retained with its auth default
//    folded to no headers. Wave D step 7u then removed the whole lane
//    (RemoteIO and cli/transports/: WebSocket/SSE/Hybrid transports and the
//    CCR v2 client), so the pins are retired in favour of absence. The
//    environment-kind contract the lane shared with the scanner reader
//    survives in section 4.
for (const f of [
  "cli/remoteIO.ts",
  "cli/transports/ccrClient.ts",
  "cli/transports/HybridTransport.ts",
  "cli/transports/SSETransport.ts",
]) {
  assert.equal(fs.existsSync(`${root}/${f}`), false, `${f} was removed by step 7u`)
}

// 4. What survives of the scanner module is the environment-kind reader, which
//    utils/plans.ts still imports. The declared SDK subtype stays: removing a
//    declared contract is a separate review.
// Step 7za later moved this module to utils/environmentKind.ts (the
// filePersistence directory held nothing else); the body assertion follows it.
assert.equal(
  fs.readFileSync(`${root}/utils/environmentKind.ts`, "utf8"),
  [
    "import { logForDebugging } from './debug.js'",
    "",
    "// Ported from utils/teleport/environments.ts:9 — the environment-kind union",
    "// read out of CLAUDE_CODE_ENVIRONMENT_KIND.",
    "type EnvironmentKind = 'anthropic_cloud' | 'byoc' | 'bridge'",
    "",
    "export function getEnvironmentKind(): EnvironmentKind | null {",
    "  const kind = process.env.CLAUDE_CODE_ENVIRONMENT_KIND",
    "  if (kind === 'byoc' || kind === 'anthropic_cloud') {",
    "    return kind",
    "  }",
    "  return null",
    "}",
    "",
  ].join("\n"),
)
assert.match(fs.readFileSync(`${root}/entrypoints/sdk/coreSchemas.ts`, "utf8"), /subtype: z\.literal\('files_persisted'\)/)
assert.match(fs.readFileSync(`${root}/utils/plans.ts`, "utf8"), /from '\.\/environmentKind\.js'/)

const tscText = fs.readFileSync(new URL("w65-d7n-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const digests = {}
for (const f of [
  "utils/sessionIngressAuth.ts",
  "services/api/filesApi.ts",
  "utils/filePersistence/filePersistence.ts",
  "services/mcp/client.ts",
  "cli/transports/ccrClient.ts",
  "cli/transports/HybridTransport.ts",
  "cli/remoteIO.ts",
  "main.tsx",
]) {
  digests[f] = digest(execFileSync("git", ["-C", root, "show", `${before}:${f}`], {encoding: "utf8"}))
}

fs.writeFileSync(
  new URL("w65-d7n-source-evidence.json", import.meta.url),
  JSON.stringify({
    before,
    kind: "session-ingress bearer surface removal (no ported bodies; one port deleted with its last consumer)",
    surface:
      "utils/sessionIngressAuth.ts (the bearer reader: env var, file descriptor, well-known file, with its bootstrap cache and its Cookie-vs-Bearer header builder), the four modules whose only credential it was (utils/filePersistence/filePersistence.ts, utils/filePersistence/types.ts, services/api/filesApi.ts and main.tsx' --file download block), and the token reads at the remote-MCP client, the MCP settings dialog and the four SDK transport files",
    decisiveFact:
      "the bearer authenticates the CCR/session-ingress API, and every consumer of it is that API's client: the MCP transports attach it as an extra Authorization, the settings dialog counts it as 'authenticated', main.tsx' --file block cannot proceed without it, and file persistence's own enable gate it is a term of — so nothing survives the bearer as a working feature",
    evidence: [
      {
        file: "utils/sessionIngressAuth.ts",
        change: "the module removed whole (140 lines): the three-source reader, its bootstrap cache, the Cookie/Bearer header builder and the in-process env-var updater",
        sourceSha256: digests["utils/sessionIngressAuth.ts"],
        portSha256: null,
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "services/api/filesApi.ts",
        change: "removed whole (748 lines) — its two importers were main.tsx' --file block and file persistence, both bearer-gated",
        sourceSha256: digests["services/api/filesApi.ts"],
        portSha256: null,
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "utils/filePersistence/filePersistence.ts",
        change: "removed whole (287 lines) with types.ts; outputsScanner.ts survives as the environment-kind reader utils/plans.ts imports, and the declared files_persisted SDK subtype stays",
        sourceSha256: digests["utils/filePersistence/filePersistence.ts"],
        portSha256: null,
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "cli/transports/ccrClient.ts",
        change: "the auth default becomes no headers (which makes initialize raise no_auth_headers, its own documented failure), the JWT-expiry short-circuit goes, and the decodeJwtPayload/decodeJwtExpiry pair — a port from bridge/jwtUtils.ts:22-58 whose only caller was that check — is deleted with it; wave D step 7u later removed the file whole, so the port coordinate is retired",
        sourceSha256: digests["cli/transports/ccrClient.ts"],
        portSha256: null,
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "services/mcp/client.ts",
        change: "the ingress Authorization dropped from both the WebSocket headers and the HTTP requestInit, and the hasOAuthTokens probe it was paired with deleted; the authProvider's own OAuth Authorization stays as the source's comment says it should",
        sourceSha256: digests["services/mcp/client.ts"],
        portSha256: digest(client),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "main.tsx",
        change: "the --file option, the download block, the promise it set and the await before REPL render all removed, along with the four filesApi imports; the client-type detection keeps only the entrypoint term",
        sourceSha256: digests["main.tsx"],
        portSha256: digest(main),
        coordinateUnit: "utf16-half-open",
      },
    ],
    removed: [
      "the bearer module and its bootstrap cache (getSessionIngressToken/setSessionIngressToken plus the sessionIngressToken field and default)",
      "the file surface: main.tsx' --file option with its download block, promise and await; utils/filePersistence/filePersistence.ts and types.ts; services/api/filesApi.ts; cli/print.ts' executeFilePersistence call and its turnStartTime gate",
      "the token reads: services/mcp/client.ts (two header spreads, the log field and the hasOAuthTokens probe), components/mcp/MCPSettings.tsx' hasSessionAuth arm, and the four transport files' auth default",
      "the JWT decoder pair in ccrClient.ts — a port from bridge/jwtUtils.ts:22-58 whose only caller was the expiry check on the ingress token"
    ],
    kept: [
      "cli/transports/ and cli/remoteIO.ts as the retained SDK transport lane at the time of this cut: they kept their option-supplied auth header path, their refreshHeaders callback (the runner-version read alone) and their no-headers failure modes; wave D step 7u removed the lane whole, so this entry records history, not the current tree",
      "entrypoints/sdk/coreSchemas.ts' declared files_persisted subtype and entrypoints/agentSdkTypes.ts' declarations — declared contracts wait for the SDK review",
      "utils/filePersistence/outputsScanner.ts' getEnvironmentKind, which utils/plans.ts imports, and the CLAUDE_CODE_ENVIRONMENT_KIND contract cli/remoteIO.ts and that reader share",
      "cli/structuredIO.ts' update_environment_variables handler — the stdin contract is general, only its comment's example named the token",
    ],
    tsc: {
      command: "node_modules/.bin/tsc --noEmit --pretty false",
      cwd: root,
      exitCode: 0,
      diagnostics: 0,
      logSha256: digest(tscText),
    },
    validation:
      "Absence sweep over every removed name plus the three env vars; each consumer asserted as the arm a missing token produced (the transport defaults as arrow functions, ccrClient's no_auth_headers guard still reachable, HybridTransport's postOnce reduced to its two log lines, remoteIO's headers and refresh callback, MCPSettings' isAuthenticated expression, main.tsx' entrypoint-only client detection, print.ts' abortController-to-profiler seam); the surviving scanner module asserted byte-for-byte against its intended text; the declared SDK subtype and the agents/plans importers asserted present; import-graph orphan scan stays at its 10 legitimate entries with the file count down by exactly the four deleted modules (1643 → 1639)",
    remaining:
      "the peer-messaging lane (feature('UDS_INBOX') is false), the model-call seams (which must not be removed wholesale — API-key auth is the retained path), utils/fastMode.ts's remaining gates, the ~33 in-place CLI blocks, the cli/transports/ package, the dependency-pruning pass, and the stale utils/filePersistence/ directory name (it now holds one environment-kind reader)",
    notes: [
      "the fold target here is a documented arm, not a new behaviour: HybridTransport's own doc comment already listed 'no token' among the permanent failures postOnce returns on, and SSETransport/ccrClient each already had an empty-auth guard",
      "three prose sites named the token after the code was gone (structuredIO's env-update rationale, WebSocketTransport's 4003 retry rationale, print.ts' turnStartTime comment) and were reworded to keep the why without the name",
    ],
  }, null, 2) + "\n",
)
console.log("PASS bearer gone; file surface gone; transports folded to no-headers; scanner narrowed")
