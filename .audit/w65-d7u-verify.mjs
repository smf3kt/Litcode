import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "19bce58"
const digest = text => createHash("sha256").update(text).digest("hex")

// `--sdk-url` selected RemoteIO, which opened a WebSocket/SSE session to a
// remote endpoint: the whole lane is remote I/O. The local print-mode path is
// StructuredIO over the input stream, and every part of it stays.
const read = p => fs.readFileSync(`${root}/${p}`, "utf8")
const exists = p => fs.existsSync(`${root}/${p}`)
const base = p => execFileSync("git", ["-C", root, "show", `${before}:${p}`], {encoding: "utf8"})
function rg(pattern) {
  try {
    return execFileSync("rg", [
      "-n", "--glob", "!node_modules", "--glob", "!*.json", "--glob", "!*.md",
      "-e", pattern, root,
    ], {encoding: "utf8"}).trim()
  } catch (e) {
    assert.equal(e.status, 1, `rg failed: ${e.message}`)
    return ""
  }
}

const main = read("main.tsx")
const print = read("cli/print.ts")

// 1. The base carried the lane.
for (const f of [
  "cli/remoteIO.ts",
  "cli/transports/ccrClient.ts",
  "cli/transports/HybridTransport.ts",
  "cli/transports/SerialBatchEventUploader.ts",
  "cli/transports/SSETransport.ts",
  "cli/transports/Transport.ts",
  "cli/transports/transportUtils.ts",
  "cli/transports/WebSocketTransport.ts",
  "cli/transports/WorkerStateUploader.ts",
]) {
  assert.ok(base(f).length > 0, `base carried ${f}`)
}
assert.ok(base("main.tsx").includes("'--sdk-url <url>'"))
assert.ok(base("cli/print.ts").includes("new RemoteIO(options.sdkUrl"))

// 2. The lane is gone.
for (const f of [
  "cli/remoteIO.ts",
  "cli/transports/ccrClient.ts",
  "cli/transports/HybridTransport.ts",
  "cli/transports/SerialBatchEventUploader.ts",
  "cli/transports/SSETransport.ts",
  "cli/transports/Transport.ts",
  "cli/transports/transportUtils.ts",
  "cli/transports/WebSocketTransport.ts",
  "cli/transports/WorkerStateUploader.ts",
]) {
  assert.ok(!exists(f), `${f} removed`)
}
assert.ok(!exists("cli/transports"), "cli/transports removed")
assert.equal(rg("--sdk-url|sdkUrl"), "", "no sdk-url residue")
assert.ok(!print.includes("remoteIO"), "print.ts no longer imports RemoteIO")
assert.doesNotMatch(main, /hasSdkUrl/)
assert.doesNotMatch(print, /isUsingSdkUrl/)
assert.match(print, /  if \(!inputPrompt && !hasValidResumeSessionId\) \{/)
assert.match(print, /  const effectivePermissionPromptToolName = options\.permissionPromptToolName\n/)
assert.match(print, /  return new StructuredIO\(inputStream, options\.replayUserMessages\)\n/)
assert.match(main, /        const validatedSessionId = validateUuid\(sessionId\)\n/)

// 3. The local stream-json surface stays.
assert.match(print, /replayUserMessages && batch\.length > 1/)
assert.match(print, /new StructuredIO\(inputStream, options\.replayUserMessages\)/)
assert.ok(read("cli/structuredIO.ts").includes("export class StructuredIO"))
assert.ok(read("cli/ndjsonSafeStringify.ts").includes("ndjsonSafeStringify"))
// The MCP WebSocket transport is a different class and stays.
assert.match(read("services/mcp/client.ts"), /import \{ WebSocketTransport \} from '\.\.\/\.\.\/utils\/mcpWebSocketTransport\.js'/)
assert.ok(exists("utils/mcpWebSocketTransport.ts"))
// The SDK control transport and the --init-only path are local.
assert.ok(exists("services/mcp/SdkControlTransport.ts"))
assert.match(main, /hasInitOnlyFlag/)

// 4. Comments naming the removed modules were rewritten.
assert.doesNotMatch(read("utils/gracefulShutdown.ts"), /--sdk-url/)
assert.doesNotMatch(read("utils/cliHighlight.ts"), /SSETransport/)
assert.doesNotMatch(read("utils/caCertsConfig.ts"), /WebSocketTransport|CCRClient/)
assert.doesNotMatch(read("utils/userAgent.ts"), /cli\/transports/)

// 5. No module was orphaned by the deletion.
const orphans = execFileSync("node", ["/Users/mant1ssa/Projects/cc_reverse/.audit/w65-orphans.mjs"], {encoding: "utf8"})
assert.match(orphans, /1623 files scanned, 10 with no importer/)

// 6. The gate.
const tscText = fs.readFileSync(new URL("w65-d7u-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const files = ["main.tsx", "cli/print.ts", "utils/gracefulShutdown.ts", "utils/cliHighlight.ts", "utils/caCertsConfig.ts", "utils/userAgent.ts"]
const digests = {}
for (const f of files) digests[f] = digest(base(f))

fs.writeFileSync(
  new URL("w65-d7u-source-evidence.json", import.meta.url),
  JSON.stringify(
    {
      before,
      kind: "the SDK transport lane deleted (nine files) with the --sdk-url option that selected it; no ported bodies",
      surface:
        "cli/remoteIO.ts (RemoteIO: URL-derived headers, transport selection, CCR v2 client wiring, internal-event reader/writer registration, session-state/metadata/command-lifecycle listeners) and cli/transports/ (WebSocketTransport, SSETransport, HybridTransport, CCRClient, SerialBatchEventUploader, WorkerStateUploader, Transport, transportUtils); the --sdk-url option, its format auto-set and validation, and the RemoteIO arm of getStructuredIO",
      decisiveFact:
        "RemoteIO is a remote I/O implementation: it opens a WebSocket/SSE session to the URL given by --sdk-url and streams control traffic over it. The local print-mode path does not need it: StructuredIO reads the same stream-json input from stdin and writes the SDK event stream, and every local feature (replayUserMessages, MCP SDK servers, control requests) is implemented on StructuredIO itself",
      changes: [
        {
          file: "main.tsx",
          change:
            "`--sdk-url` registration, `hasSdkUrl` in the non-interactive predicate, the sdkUrl extraction with its format auto-set, the sdkUrl validation, the UUID-validation bypass (unwrapped) and the options pass-through are removed",
          sourceSha256: digests["main.tsx"],
          portSha256: digest(main),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "cli/print.ts",
          change:
            "the RemoteIO import, the sdkUrl option field, `isUsingSdkUrl`, the stdio permission-prompt override and the RemoteIO arm of getStructuredIO are removed; getStructuredIO now always returns StructuredIO",
          sourceSha256: digests["cli/print.ts"],
          portSha256: digest(print),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/gracefulShutdown.ts",
          change: "the SIGINT comment no longer names --sdk-url among non-interactive sessions",
          sourceSha256: digests["utils/gracefulShutdown.ts"],
          portSha256: digest(read("utils/gracefulShutdown.ts")),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/cliHighlight.ts",
          change: "the dom-lib comment no longer names SSETransport",
          sourceSha256: digests["utils/cliHighlight.ts"],
          portSha256: digest(read("utils/cliHighlight.ts")),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/caCertsConfig.ts",
          change: "the bundle-size comment no longer names WebSocketTransport/CCRClient",
          sourceSha256: digests["utils/caCertsConfig.ts"],
          portSha256: digest(read("utils/caCertsConfig.ts")),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/userAgent.ts",
          change: "the dependency-free comment no longer names cli/transports",
          sourceSha256: digests["utils/userAgent.ts"],
          portSha256: digest(read("utils/userAgent.ts")),
          coordinateUnit: "utf16-half-open",
        },
      ],
      removed: [
        "cli/remoteIO.ts and the eight cli/transports/ modules",
        "the --sdk-url option with its auto-format block, validation and UUID-check bypass",
        "the RemoteIO branch of getStructuredIO and the sdkUrl print option",
      ],
      kept: [
        "StructuredIO and the whole local print-mode stream-json surface (replayUserMessages, control_request/response, SDK MCP servers)",
        "services/mcp/SdkControlTransport.ts (the in-process SDK control channel) and utils/mcpWebSocketTransport.ts with its MCP client readers",
        "--init-only handling in the non-interactive predicate",
      ],
      tsc: {
        command: "node_modules/.bin/tsc --noEmit --pretty false",
        cwd: root,
        exitCode: 0,
        diagnostics: 0,
        logSha256: digest(tscText),
      },
      validation:
        "Base-commit checks confirm the nine files and the --sdk-url option were present at 19bce58; current-tree sweeps assert no sdk-url/sdkUrl token, no remoteIO import, and the direct StructuredIO return; survivor assertions pin replayUserMessages, the MCP WebSocket transport, the SDK control transport and --init-only; the orphan scanner reports the same ten legitimate entries over 1623 files (nine fewer); tsc clean",
      remaining:
        "the CCR v2 residue the transports fed: setSessionStateChangedListener/setSessionMetadataChangedListener (their only caller was RemoteIO), the sessionStorage internal-event writer/reader and hydrateFromCCRv2InternalEvents, structuredIO.restoredWorkerState, externalMetadataToAppState, and the URL arm of --resume",
      notes: [
        "one repair pass: the sdkUrl field appears twice in print.ts (the print options type and getStructuredIO's narrowed parameter); the first cut matched both, so the type cut is anchored on the preceding fallbackModel field, and every touched file was restored from HEAD before the replay",
        "the orphan count is unchanged at ten while the file count drops by the nine deleted modules",
      ],
    },
    null,
    2,
  ) + "\n",
)
console.log("PASS transport lane removed; local StructuredIO surface intact; tsc log empty")
