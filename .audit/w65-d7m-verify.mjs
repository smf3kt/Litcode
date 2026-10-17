import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "627859b"
const digest = text => createHash("sha256").update(text).digest("hex")

// This wave ports nothing. Two QueuedCommand fields had no producer anywhere in
// the tree: every queue entry is built by handlePromptSubmit from local input or
// by REPL/print's own enqueue, and none of those sets `skipSlashCommands` or
// `bridgeOrigin`. The bridge inbound path that did is absent, so both are
// permanently falsy and every gate written on them folds. The bridge status
// message and three more bridge-owned slots had no reader at all.
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

// 1. The whole surface is gone.
assert.equal(
  rg("bridgeOrigin|skipSlashCommands|isBridgeSafeCommand|BRIDGE_SAFE_COMMANDS|createBridgeStatusMessage|SystemBridgeStatusMessage|bridge_status|remoteControlSpawnMode|updateSessionBridgeId|sessionSource"),
  "",
  "a live reference to the removed surface remains",
)

// 2. Each gate folded to the arm the falsy value produced.
const queue = fs.readFileSync(`${root}/utils/messageQueueManager.ts`, "utf8")
assert.match(
  queue,
  /export function isSlashCommand\(cmd: QueuedCommand\): boolean \{\n  return typeof cmd\.value === 'string' && cmd\.value\.trim\(\)\.startsWith\('\/'\)\n\}/,
)
assert.match(queue, / \* processSlashCommand rather than sent to the model as text\.\n \*\/\n/)

const pui = fs.readFileSync(`${root}/utils/processUserInput/processUserInput.ts`, "utf8")
assert.match(pui, /    \(mode !== 'prompt' \|\| !inputString\.startsWith\('\/'\)\)/)
assert.match(pui, /  \/\/ Slash commands\n  if \(inputString !== null && inputString\.startsWith\('\/'\)\) \{/)
assert.doesNotMatch(pui, /effectiveSkipSlash|Bridge-safe/)

const hps = fs.readFileSync(`${root}/utils/handlePromptSubmit.ts`, "utf8")
assert.match(
  hps,
  /  \/\/ Handle exit commands by triggering the exit command instead of direct process\.exit\n  if \(\['exit', 'quit', ':q', ':q!', ':wq', ':wq!'\]\.includes\(input\.trim\(\)\)\) \{/,
)
assert.match(
  hps,
  /  \/\/ Handle local-jsx immediate commands \(e\.g\., \/config, \/doctor\)\n  if \(finalInput\.trim\(\)\.startsWith\('\/'\)\) \{/,
)
assert.match(hps, /    uuid,\n  \} = params\n/)
assert.match(hps, /    pastedContents: hasImages \? pastedContents : undefined,\n    uuid,\n  \}\n/)
assert.match(hps, /          isMeta: cmd\.isMeta,\n          skipAttachments: !isFirst,/)

const inputTypes = fs.readFileSync(`${root}/types/textInputTypes.ts`, "utf8")
assert.match(inputTypes, /  preExpansionValue\?: string\n  \/\*\*\n   \* When true, the resulting UserMessage gets `isMeta: true`/)

const config = fs.readFileSync(`${root}/utils/config.ts`, "utf8")
assert.doesNotMatch(config, /remoteControl/)

const state = fs.readFileSync(`${root}/bootstrap/state.ts`, "utf8")
assert.match(state, /  clientType: string\n  questionPreviewFormat: 'markdown' \| 'html' \| undefined/)
assert.match(state, /    clientType: 'cli',\n    questionPreviewFormat: undefined,/)

const main = fs.readFileSync(`${root}/main.tsx`, "utf8")
assert.match(main, /  setQuestionPreviewFormat,\n  setSdkBetas,/)
assert.match(main, /  profileCheckpoint\('main_client_type_determined'\)/)

const sessions = fs.readFileSync(`${root}/utils/concurrentSessions.ts`, "utf8")
assert.doesNotMatch(sessions, /bridgeSessionId/)
assert.match(sessions, /export async function updateSessionActivity\(patch: \{/)

// 3. The message surface: constructor, type member, type alias and renderer all
//    left together, and the two imports only that renderer used.
const messages = fs.readFileSync(`${root}/utils/messages.ts`, "utf8")
assert.doesNotMatch(messages, /BridgeStatus/)
assert.match(messages, /export function createTurnDurationMessage/)

const messageTypes = fs.readFileSync(`${root}/types/message.ts`, "utf8")
assert.match(messageTypes, /"scheduled_task_fire" \| "turn_duration" \| "informational"/)

const sysText = fs.readFileSync(`${root}/components/messages/SystemTextMessage.tsx`, "utf8")
assert.doesNotMatch(sysText, /BridgeStatus|from '\.\.\/design-system\/ThemedText\.js'|\/ink\/components\/Link\.js/)
assert.match(sysText, /  if \(message\.subtype === 'scheduled_task_fire'\) \{/)

// 4. The declared SDK surface and the retained transport lane stay. The
//    SendMessageTool's `bridge:` row is untouched here: it sits in the false
//    arm of `feature('UDS_INBOX')` and belongs to the peer-messaging lane.
assert.match(
  fs.readFileSync(`${root}/entrypoints/agentSdkTypes.ts`, "utf8"),
  /  bridgeSessionId: string/,
)
assert.equal(fs.existsSync(`${root}/cli/transports/ccrClient.ts`), true)
assert.equal(
  digest(execFileSync("git", ["-C", root, "show", `${before}:tools/SendMessageTool/prompt.ts`], {encoding: "utf8"})),
  digest(fs.readFileSync(`${root}/tools/SendMessageTool/prompt.ts`, "utf8")),
  "the peer-messaging prompt is not this step's business",
)

const tscText = fs.readFileSync(new URL("w65-d7m-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const digests = {}
for (const f of [
  "utils/processUserInput/processUserInput.ts",
  "utils/handlePromptSubmit.ts",
  "utils/messageQueueManager.ts",
  "commands.ts",
  "types/textInputTypes.ts",
  "utils/messages.ts",
  "components/messages/SystemTextMessage.tsx",
  "bootstrap/state.ts",
  "utils/config.ts",
  "main.tsx",
]) {
  digests[f] = digest(execFileSync("git", ["-C", root, "show", `${before}:${f}`], {encoding: "utf8"}))
}

fs.writeFileSync(
  new URL("w65-d7m-source-evidence.json", import.meta.url),
  JSON.stringify({
    before,
    kind: "bridge-origin command gate and bridge-owned slot removal (no ported bodies)",
    surface:
      "the two bridge-only QueuedCommand fields (skipSlashCommands, bridgeOrigin) with every gate written on them, the bridge command allowlist (BRIDGE_SAFE_COMMANDS, isBridgeSafeCommand), the bridge status message (constructor, subtype member, type alias, renderer), the remote-control spawn-mode config key, the bridge-session pid write, and the session-source tag",
    decisiveFact:
      "both QueuedCommand fields are written only by the absent bridge inbound path — the tree's three queue producers (handlePromptSubmit's two enqueue sites and the cmd literal it builds) never set them — so `!skipSlashCommands` is constant true, the bridgeOrigin override block is unreachable, and createBridgeStatusMessage, remoteControlSpawnMode, updateSessionBridgeId and sessionSource have no caller or reader at all",
    evidence: [
      {
        file: "utils/handlePromptSubmit.ts",
        change: "the option threaded through four layers, its two `!skipSlashCommands &&` gates (the exit-word list and the local-jsx immediate dispatch) and the two reads of the QueuedCommand fields deleted",
        sourceSha256: digests["utils/handlePromptSubmit.ts"],
        portSha256: digest(hps),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "utils/processUserInput/processUserInput.ts",
        change: "the bridgeOrigin override block and the now-constant effectiveSkipSlash deleted; the attachment gate keeps its other two terms and the slash-command gate becomes a plain startsWith test",
        sourceSha256: digests["utils/processUserInput/processUserInput.ts"],
        portSha256: digest(pui),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "utils/messageQueueManager.ts",
        change: "isSlashCommand's third term dropped; it now answers exactly the question its doc comment names",
        sourceSha256: digests["utils/messageQueueManager.ts"],
        portSha256: digest(queue),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "commands.ts",
        change: "BRIDGE_SAFE_COMMANDS and isBridgeSafeCommand removed — their one caller was the override block deleted here",
        sourceSha256: digests["commands.ts"],
        portSha256: digest(fs.readFileSync(`${root}/commands.ts`, "utf8")),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "utils/messages.ts",
        change: "createBridgeStatusMessage removed with its type and its renderer; the subtype member left SystemSubtype in the same commit so no message type can be constructed",
        sourceSha256: digests["utils/messages.ts"],
        portSha256: digest(messages),
        coordinateUnit: "utf16-half-open",
      },
    ],
    removed: [
      "the bridge command gate: BRIDGE_SAFE_COMMANDS, isBridgeSafeCommand, and the processUserInput block that was their only caller (with the `/x isn't available over Remote Control.` short-circuit it produced)",
      "the two input-path fields: skipSlashCommands and bridgeOrigin on QueuedCommand and on processUserInput's and handlePromptSubmit's option objects, plus the three gates and two pass-throughs they reached",
      "the bridge status message: createBridgeStatusMessage, SystemBridgeStatusMessage, the 'bridge_status' union member, the SystemTextMessage renderer, and the Link/ThemedText imports it was the only user of",
      "the readerless slots: remoteControlSpawnMode (config), updateSessionBridgeId (the pid write no peer enumeration could read back) and sessionSource with its getter, setter and the CLAUDE_CODE_ENVIRONMENT_KIND branch in main.tsx that was its only writer",
    ],
    kept: [
      "entrypoints/agentSdkTypes.ts' bridgeSessionId and its remote-control bridge declaration — a declared SDK contract with no producer, the same call waves C and 7k made",
      "CLAUDE_CODE_ENVIRONMENT_KIND itself: cli/remoteIO.ts' isBridge and filePersistence' outputs scanner are live users of the same variable",
      "the retained cli/transports/ + cli/remoteIO.ts lane, and SendMessageTool's `bridge:<session-id>` recipient prose, which belongs to the peer-messaging lane",
    ],
    tsc: {
      command: "node_modules/.bin/tsc --noEmit --pretty false",
      cwd: root,
      exitCode: 0,
      diagnostics: 0,
      logSha256: digest(tscText),
    },
    validation:
      "Absence sweep over every removed name; each folded gate asserted as the arm the falsy value produced (isSlashCommand's single-expression body, the attachment gate's two remaining terms, the two handlePromptSubmit gates without their leading term, the destructure and both object literals losing their field); the message surface asserted gone from all four carriers at once; the declared SDK field, the environment-kind variable and the peer-messaging prose asserted still present; import-graph orphan scan stays at its 10 legitimate entries with the file count unchanged, since this step deletes no module",
    remaining:
      "the session-ingress bearer surface (utils/sessionIngressAuth.ts and its eight importers), then the peer-messaging lane — SendMessageTool's `uds:` and `bridge:` recipient rows and its Cross-session section sit in the false arm of `feature('UDS_INBOX')`, so the whole peer surface is constant there, including `ListPeers` — then the model-call seams (which must not be removed wholesale — API-key auth is the retained path), utils/fastMode.ts's remaining gates, the ~33 in-place CLI blocks, cli/transports/, and the dependency-pruning pass",
    notes: [
      "this is the first package in wave D that removes a *producer-less field* rather than a gate: the writes exist but no read can observe them, so the statements go without a caller rewrite",
      "the two SystemTextMessage imports went in the same commit as the component that used them, because tsc accepts an unused import under strict:false",
    ],
  }, null, 2) + "\n",
)
console.log("PASS bridge gate gone; message surface gone; readerless slots gone; SDK declaration intact")
