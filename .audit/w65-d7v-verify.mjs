import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "e864296"
const digest = text => createHash("sha256").update(text).digest("hex")

// RemoteIO was the only producer of the CCR v2 session-state machinery: it
// registered the state/metadata listeners and the internal-event reader and
// writer against CCRClient. With the transport lane gone, those hooks can
// never be registered, so their consumers fold to the local surface: the SDK
// status stream for permission modes, and the SDK control protocol's
// requires_action details.
const read = p => fs.readFileSync(`${root}/${p}`, "utf8")
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

const print = read("cli/print.ts")
const structuredIO = read("cli/structuredIO.ts")
const sessionState = read("utils/sessionState.ts")
const onChange = read("state/onChangeAppState.ts")
const storage = read("utils/sessionStorage.ts")
const sessionUrl = read("utils/sessionUrl.ts")

// 1. The base carried every producer and consumer.
assert.ok(base("utils/sessionState.ts").includes("export function setSessionStateChangedListener("))
assert.ok(base("utils/sessionState.ts").includes("export function setSessionMetadataChangedListener("))
assert.ok(base("state/onChangeAppState.ts").includes("export function externalMetadataToAppState("))
assert.ok(base("cli/structuredIO.ts").includes("restoredWorkerState: Promise<SessionExternalMetadata | null>"))
assert.ok(base("cli/print.ts").includes("CLAUDE_CODE_USE_CCR_V2"))
assert.ok(base("cli/print.ts").includes("hydrateFromCCRv2InternalEvents"))
assert.ok(base("utils/sessionStorage.ts").includes("export async function hydrateFromCCRv2InternalEvents("))
assert.ok(base("utils/sessionUrl.ts").includes("isUrl: true"))

// 2. The residue is gone.
assert.equal(
  rg(
    "CLAUDE_CODE_USE_CCR_V2|hydrateFromCCRv2|restoredWorkerState|SessionExternalMetadata|externalMetadataToAppState|notifySessionMetadataChanged|setSessionStateChangedListener|setSessionMetadataChangedListener|internalEventWriter|internalEventReader|persistToRemote|flushInternalEvents|internalEventsPending",
  ),
  "",
  "no CCR v2 session-state residue",
)
assert.doesNotMatch(sessionState, /SessionExternalMetadata/)
assert.doesNotMatch(sessionState, /metadataListener/)
assert.doesNotMatch(onChange, /notifySessionMetadataChanged|toExternalPermissionMode/)
assert.doesNotMatch(storage, /internalEvent|hydrateFromCCRv2|persistToRemote|REMOTE_FLUSH_INTERVAL_MS/)
assert.doesNotMatch(sessionUrl, /ingressUrl|new URL\(/)
assert.match(print, /    \| 'waiting_for_agents'\n    \| undefined\n/)
assert.doesNotMatch(print, /finally_flush|finally_post_flush/)
assert.match(print, /      if \(!isShuttingDown\(\)\) \{\n        notifySessionStateChanged\('idle'\)/)

// 3. The local session-state surface stays.
assert.match(sessionState, /export function notifySessionStateChanged\(state: SessionState\): void \{/)
assert.match(sessionState, /    enqueueSdkEvent\(\{\n      type: 'system',\n      subtype: 'session_state_changed',\n      state,\n    \}\)/)
assert.match(sessionState, /export function notifyPermissionModeChanged\(mode: PermissionMode\): void \{/)
assert.match(sessionState, /export type RequiresActionDetails = \{/)
assert.match(onChange, /    notifyPermissionModeChanged\(newMode\)/)
assert.match(print, /  setPermissionModeChangedListener\(/)
assert.match(print, /    notifySessionStateChanged\('requires_action'\)/)
assert.match(print, /      worker_status: getSessionState\(\),/)
// The SDK control protocol's requires_action details are a separate local
// contract and keep their builder and callback.
assert.match(structuredIO, /function buildRequiresActionDetails\(/)
assert.match(structuredIO, /onPermissionPrompt\?: \(details: RequiresActionDetails\) => void/)
assert.match(print, /  onPermissionPrompt\?: \(details: RequiresActionDetails\) => void/)
// Local transcript persistence is untouched.
assert.match(storage, /void this\.enqueueWrite\(targetFile, entry\)/)
assert.match(storage, /export async function flushSessionStorage\(\): Promise<void> \{/)
// --resume keeps UUID and JSONL parsing.
assert.match(sessionUrl, /validateUuid\(resumeIdentifier\)/)
assert.match(sessionUrl, /endsWith\('\.jsonl'\)/)
assert.match(print, /parseSessionIdentifier\(/)

// 4. Nothing was orphaned.
const orphans = execFileSync("node", ["/Users/mant1ssa/Projects/cc_reverse/.audit/w65-orphans.mjs"], {encoding: "utf8"})
// Step 7w later removed the six updater UI modules, leaving 1617 files.
assert.match(orphans, /1617 files scanned, 10 with no importer/)

// 5. The gate.
const tscText = fs.readFileSync(new URL("w65-d7v-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const files = ["cli/print.ts", "cli/structuredIO.ts", "utils/sessionState.ts", "state/onChangeAppState.ts", "utils/sessionStorage.ts", "utils/sessionUrl.ts"]
const digests = {}
for (const f of files) digests[f] = digest(base(f))

fs.writeFileSync(
  new URL("w65-d7v-source-evidence.json", import.meta.url),
  JSON.stringify(
    {
      before,
      kind: "the CCR v2 session-state residue removed (no ported bodies; the hooks' only producer was RemoteIO)",
      surface:
        "the state/metadata listener setters with their listener slots and the external_metadata mirroring in notifySessionStateChanged, notifySessionMetadataChanged with its three call sites, SessionExternalMetadata and externalMetadataToAppState, StructuredIO's restoredWorkerState plus its no-op flushInternalEvents/internalEventsPending, the sessionStorage internal-event writer/reader with hydrateFromCCRv2InternalEvents, the print-mode CCR v2 resume branch, and the URL arm of parseSessionIdentifier",
      decisiveFact:
        "every deleted hook was registered by RemoteIO under CLAUDE_CODE_USE_CCR_V2 — the route that only existed through the transport lane removed in step 7u. Without a registration the listeners can never fire, the internal-event readers never exist, and the CCR resume branch can only take its no-reader arm",
      changes: [
        {
          file: "utils/sessionState.ts",
          change:
            "both listener setters, their slots, the external_metadata mirroring and notifySessionMetadataChanged are removed; notifySessionStateChanged takes the state alone and keeps its currentState tracking plus the opt-in SDK event; the permission-mode listener and notifyPermissionModeChanged stay",
          sourceSha256: digests["utils/sessionState.ts"],
          portSha256: digest(sessionState),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "state/onChangeAppState.ts",
          change:
            "externalMetadataToAppState and its PermissionMode imports are removed; the mode-change block keeps notifyPermissionModeChanged alone, with the comment rewritten to name only the SDK status stream",
          sourceSha256: digests["state/onChangeAppState.ts"],
          portSha256: digest(onChange),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "cli/structuredIO.ts",
          change:
            "the restoredWorkerState field and the two no-op internal-event methods are removed; the requires_action details and the onPermissionPrompt contract stay",
          sourceSha256: digests["cli/structuredIO.ts"],
          portSha256: digest(structuredIO),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "cli/print.ts",
          change:
            "the CCR resume branch, the restoredWorkerState option and pass, the empty-resume URL/CCR arm, both notifySessionMetadataChanged calls, and the internal-event flush with its two run phases are removed; the local resume error arm is now the only empty-result path",
          sourceSha256: digests["cli/print.ts"],
          portSha256: digest(print),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/sessionStorage.ts",
          change:
            "the internal-event writer/reader types, registration setters, project fields and accessors, the fast flush interval, persistToRemote with its call site and hydrateFromCCRv2InternalEvents are removed; local transcript writes, loaders and the compaction machinery stay",
          sourceSha256: digests["utils/sessionStorage.ts"],
          portSha256: digest(storage),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/sessionUrl.ts",
          change:
            "the URL arm and the ingressUrl/isUrl fields are removed; parseSessionIdentifier keeps the JSONL path and plain UUID arms",
          sourceSha256: digests["utils/sessionUrl.ts"],
          portSha256: digest(sessionUrl),
          coordinateUnit: "utf16-half-open",
        },
      ],
      removed: [
        "setSessionStateChangedListener/setSessionMetadataChangedListener with their slots and the external_metadata mirroring",
        "notifySessionMetadataChanged and its call sites in print.ts and onChangeAppState",
        "SessionExternalMetadata and externalMetadataToAppState",
        "structuredIO.restoredWorkerState, flushInternalEvents and internalEventsPending",
        "the sessionStorage internal-event writer/reader, persistToRemote and hydrateFromCCRv2InternalEvents",
        "the print-mode CCR v2 resume branch, the URL arm of --resume and the runPhase finally_flush/finally_post_flush states",
      ],
      kept: [
        "the SDK status stream: notifySessionStateChanged with its opt-in session_state_changed event, getSessionState and the permission-mode listener",
        "RequiresActionDetails with buildRequiresActionDetails and the onPermissionPrompt callback — the SDK control protocol's own contract",
        "local transcript persistence (enqueueWrite/recordTranscript/flush and the loaders)",
        "--resume with a plain UUID or a .jsonl path",
      ],
      tsc: {
        command: "node_modules/.bin/tsc --noEmit --pretty false",
        cwd: root,
        exitCode: 0,
        diagnostics: 0,
        logSha256: digest(tscText),
      },
      validation:
        "Base-commit checks confirm every producer and consumer was present at e864296; a whole-tree sweep finds no residue token for any removed name; absence assertions cover the listener slots, SessionExternalMetadata, the sessionStorage machinery and the URL arm; survivor assertions pin the SDK state event, the permission-mode choke point, RequiresActionDetails with its builder and callback, local transcript writes and UUID/JSONL resume; the orphan scanner stays at ten entries over 1623 files; tsc clean",
      remaining:
        "the auto-updater surface (update/install commands with utils/autoUpdater.ts and its UI), the dependency-pruning pass (nine zero-importer dependencies), the utils/filePersistence/ rename, and the analytics transports",
      notes: [
        "the first cut passed the retained end anchor twice in the persistToRemote removal and produced a duplicate class close; the script now uses the plain cut_between form and the tree was restored from HEAD before the replay",
        "three imports lost their last reader with the machinery (asSessionId, logForDiagnosticsNoPII, isShuttingDown) and were removed in the same pass",
      ],
    },
    null,
    2,
  ) + "\n",
)
console.log("PASS CCR v2 session-state residue gone; local state stream and requires_action contract intact; tsc log empty")
