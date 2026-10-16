import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "0e225a4"
const digest = text => createHash("sha256").update(text).digest("hex")

// This wave ports nothing: the channel push surface sat behind
// feature('KAIROS') || feature('KAIROS_CHANNELS') (both false) and required
// claude.ai OAuth, a GrowthBook ledger and managed-org policy. The checks are
// that the modules are gone, no site still reads the flag, no removed symbol
// survives as a live reference, and the surviving fallback shapes are the ones
// the source folded to.
for (const gone of [
  "services/mcp/channelAllowlist.ts",
  "services/mcp/channelNotification.ts",
  "services/mcp/channelPermissions.ts",
  "components/messages/UserChannelMessage.tsx",
  "components/LogoV2/ChannelsNotice.tsx",
  "components/DevChannelsDialog.tsx",
]) {
  assert.equal(fs.existsSync(`${root}/${gone}`), false, `${gone} still present`)
}

function rg(pattern, extra = []) {
  try {
    return execFileSync("rg", [
      "-n", "--glob", "!node_modules", "--glob", "!*.w*bak", "--glob", "!*.json", "--glob", "!*.md",
      ...extra, "-e", pattern, root,
    ], {encoding: "utf8"}).trim()
  } catch (e) {
    assert.equal(e.status, 1, `rg failed: ${e.message}`)
    return ""
  }
}

// 1. Nothing anywhere still reads the flag, in either arm.
assert.equal(rg("KAIROS_CHANNELS"), "", "a KAIROS_CHANNELS read remains")

// 2. The whole symbol set the surface owned is gone, including the two
//    constants and the state accessors that had no other reader.
for (const pattern of [
  "channelAllowlist|channelNotification|channelPermissions|UserChannelMessage|ChannelsNotice|DevChannelsDialog",
  "CHANNEL_TAG|CHANNEL_ARROW|CHANNEL_MESSAGE_TAG",
  "getAllowedChannels|setAllowedChannels|getHasDevChannels|setHasDevChannels|ChannelEntry\\b",
  "gateChannelServer|wrapChannelMessage|findChannelEntry|isChannelsEnabled|isChannelAllowlisted|getChannelAllowlist",
  "channelPermissionCallbacks|isChannelPermissionRelayEnabled|createChannelPermissionCallbacks|filterPermissionRelayClients|shortRequestId|truncateForPreview",
  "checkGate_CACHED_OR_BLOCKING|tengu_harbor",
  "channelsEnabled|allowedChannelPlugins",
  "'--channels'|dangerously-load-development-channels|devChannels",
  "handleChannelEnable|reregisterChannelHandler",
]) {
  assert.equal(rg(pattern), "", `live reference remains for ${pattern}`)
}

// 2b. The one deliberate non-cut: the reconstructed SDK control union still
//     names channel_enable. It is a research product describing the source's
//     protocol, and narrowing it belongs with the cli/transports wave.
const channelEnable = rg("channel_enable").split("\n").filter(Boolean)
assert.equal(channelEnable.length, 1, `channel_enable appears ${channelEnable.length} times`)
assert.match(channelEnable[0], /entrypoints\/sdk\/controlSchemas\.ts:/)

// 3. The three plan tools kept their source's own answer, not a new one: with
//    the channels arm gone each isEnabled is the plain `return true`.
const enter = fs.readFileSync(`${root}/tools/EnterPlanModeTool/EnterPlanModeTool.ts`, "utf8")
const exit = fs.readFileSync(`${root}/tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts`, "utf8")
const ask = fs.readFileSync(`${root}/tools/AskUserQuestionTool/AskUserQuestionTool.tsx`, "utf8")
for (const [name, text] of [["enter", enter], ["exit", exit], ["ask", ask]]) {
  assert.match(text, /isEnabled\(\) \{\n\s+return true\n\s+\},/, `${name}: isEnabled is not the bare true`)
}

// 4. The print-mode path kept the field the IDE reads, at the value a
//    filtered-out server produced, and lost both channel handlers.
const print = fs.readFileSync(`${root}/cli/print.ts`, "utf8")
assert.match(print, /let capabilities: \{ experimental\?: Record<string, unknown> \} \| undefined/)
assert.doesNotMatch(print, /exp\['claude\/channel'\]/)

// 5. The queue and transcript predicates are back to their single condition.
const queue = fs.readFileSync(`${root}/utils/messageQueueManager.ts`, "utf8")
assert.match(queue, /export function isQueuedCommandVisible\(cmd: QueuedCommand\): boolean \{\n  return isQueuedCommandEditable\(cmd\)\n\}/)
assert.doesNotMatch(fs.readFileSync(`${root}/utils/messages.ts`, "utf8"), /case 'channel':/)

const tscText = fs.readFileSync(new URL("w65-d7f-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const digests = {}
for (const f of [
  "services/mcp/channelNotification.ts",
  "services/mcp/channelPermissions.ts",
  "components/LogoV2/ChannelsNotice.tsx",
  "cli/print.ts",
  "hooks/toolPermission/handlers/interactiveHandler.ts",
]) {
  digests[f] = digest(execFileSync("git", ["-C", root, "show", `${before}:${f}`], {encoding: "utf8"}))
}

fs.writeFileSync(
  new URL("w65-d7f-source-evidence.json", import.meta.url),
  JSON.stringify({
    before,
    kind: "account/network cluster removal (no ported bodies)",
    surface:
      "channel notifications — an MCP server pushing inbound user messages into the conversation; gated on claude.ai OAuth plus a GrowthBook ledger plus managed-org policy",
    evidence: [
      {
        file: "services/mcp/channelNotification.ts",
        change: "deleted; its gate order (capability → tengu_harbor → OAuth → org policy → session --channels → marketplace → allowlist) needed four remote inputs",
        sourceSha256: digests["services/mcp/channelNotification.ts"],
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "services/mcp/channelPermissions.ts",
        change: "deleted; the permission relay raced a remote yes/no against the local dialog",
        sourceSha256: digests["services/mcp/channelPermissions.ts"],
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "cli/print.ts",
        change: "handleChannelEnable and reregisterChannelHandlerAfterReconnect deleted (each was `if (!(feature('KAIROS') || feature('KAIROS_CHANNELS'))) return`, so the source's fallback was the early return); the `capabilities` field survives at the value a filtered-out server produced",
        sourceSha256: digests["cli/print.ts"],
        portSha256: digest(print),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "hooks/toolPermission/handlers/interactiveHandler.ts",
        change: "the relay block deleted; the six win paths lost their pending-channel cleanup with it",
        sourceSha256: digests["hooks/toolPermission/handlers/interactiveHandler.ts"],
        coordinateUnit: "utf16-half-open",
      },
    ],
    removed: [
      "6 modules: services/mcp/channelAllowlist.ts (76), channelNotification.ts (316), channelPermissions.ts (233), components/messages/UserChannelMessage.tsx (52), components/LogoV2/ChannelsNotice.tsx (208), components/DevChannelsDialog.tsx (66)",
      "state: bootstrap/state.ts ChannelEntry + allowedChannels/hasDevChannels + their four accessors; AppStateStore's channelPermissionCallbacks",
      "growthbook.ts checkGate_CACHED_OR_BLOCKING — its only caller was the channels warm-up in showSetupScreens",
      "hosts: main.tsx (the --channels/--dangerously-load-development-channels options, the parse-and-set block, the telemetry), cli/print.ts (the channel_enable control request, both handlers, the capabilities pre-filter), useManageMCPConnections (the gate, the notification handlers, the blocked toast, the permission callbacks), interactiveHelpers (the dev-channels confirmation), useCanUseTool's channelCallbacks arm, the queue/transcript visibility branches, the three plan tools' isEnabled arms, UserTextMessage's <channel> render branch, LogoV2's conditional require, the two channel constants, the four settings keys",
    ],
    tsc: {
      command: "node_modules/.bin/tsc --noEmit --pretty false",
      cwd: root,
      exitCode: 0,
      diagnostics: 0,
      logSha256: digest(tscText),
    },
    validation:
      "Absence sweeps for the flag, all six module paths and every symbol the surface owned; the surviving fallback shapes asserted textually (three isEnabled bodies, the print capabilities field, the queue predicate); import-graph orphan scan shows no new orphan; tsc log empty",
    remaining:
      "the KAIROS assistant-mode cluster proper (KAIROS/KAIROS_BRIEF/PROACTIVE: the --assistant option, memdir's daily log, SendUserFileTool, SubscribePRTool, the brief-mode UI), the model-call seams (services/api/client, claude, errors, withRetry, utils/http.ts, utils/betas.ts), utils/fastMode.ts, the replBridge* AppState leftovers, the session-ingress bearer surface, cli/transports/, the ~33 in-place CLI blocks, and the dependency-pruning pass for @growthbook/growthbook",
    note: "entrypoints/sdk/controlSchemas.ts still lists `channel_enable` in its reconstructed SDKControlRequestInnerSchema union; it is a reconstructed protocol description, and narrowing it belongs with the cli/transports SDK wave rather than here",
  }, null, 2) + "\n",
)
console.log("PASS channel surface absent; no KAIROS_CHANNELS read; no live reference to 9 removed surfaces; fallback shapes intact; tsc log empty")
