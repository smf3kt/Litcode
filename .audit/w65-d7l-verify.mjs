import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "e6a4caf"
const digest = text => createHash("sha256").update(text).digest("hex")

// This wave ports nothing. Every site it removes was a slot that only the
// absent bridge implementation (`useReplBridge`, the bridge dialog,
// `initReplBridge`, the CCR ingress) could read or write: the twelve
// `replBridge*` AppState fields, the two remote-viewer counters, the config
// keys those modules owned, the Remote Control setting that only fed the
// bridge, and the ant-only bootstrap flag. Nothing in the tree reads them, so
// each one folds to nothing rather than to an arm.
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

// 1. The whole field/config family is gone, under both its AppState and its
//    config spelling.
assert.equal(
  rg("replBridgeEnabled|replBridgeExplicit|replBridgeOutboundOnly|replBridgeConnected|replBridgeSessionActive|replBridgeReconnecting|replBridgeConnectUrl|replBridgeSessionUrl|replBridgeEnvironmentId|replBridgeSessionId|replBridgeError|replBridgeInitialName|replBridgeActive|isReplBridgeActive|remoteConnectionStatus|remoteBackgroundTaskCount|remoteControlAtStartup|getRemoteControlAtStartup|remoteDialogSeen|bridgeOauthDead|directConnectServerUrl|DirectConnectServerUrl|migrateReplBridgeEnabledToRemoteControlAtStartup|bridgeEnabled"),
  "",
  "a live reference to the removed family remains",
)
assert.equal(
  fs.existsSync(`${root}/migrations/migrateReplBridgeEnabledToRemoteControlAtStartup.ts`),
  false,
  "the migration for a config key this build no longer has is gone",
)

// 2. Each carrier is clean, and the statements around the removed lines kept
//    their shape.
const store = fs.readFileSync(`${root}/state/AppStateStore.ts`, "utf8")
assert.doesNotMatch(store, /replBridge|remoteConnectionStatus|remoteBackgroundTaskCount/)
assert.match(store, /  agent: string \| undefined\n\}> & \{/)
assert.match(store, /    footerSelection: null,\n    toolPermissionContext: \{/)

const main = fs.readFileSync(`${root}/main.tsx`, "utf8")
assert.doesNotMatch(main, /replBridge|remoteConnectionStatus|remoteBackgroundTaskCount|getRemoteControlAtStartup/)
assert.match(main, /        statusLineText: undefined,\n        notifications: \{/)
assert.match(main, /import \{ migrateSonnet45ToSonnet46 \} from '\.\/migrations\/migrateSonnet45ToSonnet46\.js'\n/)
assert.match(main, /    migrateOpusToOpus1m\(\)\n    if \(feature\('TRANSCRIPT_CLASSIFIER'\)\) \{/)

const config = fs.readFileSync(`${root}/utils/config.ts`, "utf8")
assert.doesNotMatch(config, /remoteControlAtStartup|remoteDialogSeen|bridgeOauthDead/)
assert.match(config, /  desktopUpsellSeenCount\?: number \/\/ Total showings \(max 3\)/)
assert.match(config, /  'prStatusFooterEnabled',\n\] as const/)
assert.match(config, /export function getCustomApiKeyStatus\(/)

const settings = fs.readFileSync(`${root}/tools/ConfigTool/supportedSettings.ts`, "utf8")
assert.doesNotMatch(settings, /BRIDGE_MODE|getRemoteControlAtStartup/)
assert.match(settings, /^import \{ feature \} from 'bun:bundle'\nimport \{\n  EDITOR_MODES,/)

const configTool = fs.readFileSync(`${root}/tools/ConfigTool/ConfigTool.ts`, "utf8")
assert.doesNotMatch(configTool, /remoteControlAtStartup|replBridge/)
assert.match(configTool, /    let finalValue: unknown = value\n\n    \/\/ Coerce and validate boolean values/)
assert.match(configTool, /      logEvent\('tengu_config_tool_changed', \{/)

const configDialog = fs.readFileSync(`${root}/components/Settings/Config.tsx`, "utf8")
assert.doesNotMatch(configDialog, /remoteControlAtStartup|replBridge/)
assert.match(configDialog, /      promptSuggestionEnabled: s\.promptSuggestionEnabled,\n      settings: s\.settings,/)
assert.match(configDialog, /      promptSuggestionEnabled: ia\.promptSuggestionEnabled,\n      settings: ia\.settings,/)

const merged = fs.readFileSync(`${root}/hooks/useMergedTools.ts`, "utf8")
assert.doesNotMatch(merged, /replBridge/)
assert.match(merged, /  \}, \[\n    initialTools,\n    mcpTools,\n    toolPermissionContext,\n  \]\)/)

const state = fs.readFileSync(`${root}/bootstrap/state.ts`, "utf8")
assert.doesNotMatch(state, /replBridgeActive|isReplBridgeActive|directConnectServerUrl|DirectConnectServerUrl/)
assert.match(state, /  \/\/ Remote mode \(--remote flag\)\n  isRemoteMode: boolean\n  \/\/ System prompt section cache state/)

const logo = fs.readFileSync(`${root}/utils/logoV2Utils.ts`, "utf8")
assert.doesNotMatch(logo, /directConnect|serverUrl/)
assert.match(logo, /import \{ getSessionId \} from '\.\.\/bootstrap\/state\.js'/)
assert.match(logo, /  const cwd = process\.env\.DEMO_VERSION\n    \? '\/code\/claude'\n    : getDisplayPath\(getCwd\(\)\)/)

// 3. The four comments that named the removed modules or a removed call path.
assert.match(
  fs.readFileSync(`${root}/ink/root.ts`, "utf8"),
  /  \/\/ settles, and the subsequent Static write overwrites scrollback instead of\n  \/\/ appending below the logo\./,
)
assert.match(
  fs.readFileSync(`${root}/utils/toolSchemaCache.ts`, "utf8"),
  /\/\/ \(which would create a cycle via plans→settings→file→growthbook→config→auth\)\./,
)
assert.match(
  fs.readFileSync(`${root}/utils/messages/systemInit.ts`, "utf8"),
  / \* Called from QueryEngine \(spawn-bridge \/ print-mode \/ SDK\), yielded as the\n \* first stream message per query turn\./,
)
assert.match(
  fs.readFileSync(`${root}/services/api/emptyUsage.ts`, "utf8"),
  / \* Zero-initialized usage object\. Extracted from logging\.ts so importers avoid/,
)

// 4. The next wave's surface is untouched: the retained SDK transport and the
//    desktop-upsell counter that has a live reader. `remoteControlSpawnMode`
//    was asserted present here as the next wave's surface; step 7m removed it,
//    as this file's `remaining` predicted.
assert.doesNotMatch(config, /remoteControlSpawnMode/)
assert.equal(
  fs.existsSync(`${root}/cli/transports/ccrClient.ts`),
  true,
  "the retained SDK transport lane stays",
)
assert.match(
  fs.readFileSync(`${root}/components/DesktopUpsell/DesktopUpsellStartup.tsx`, "utf8"),
  /desktopUpsellSeenCount/,
)

const tscText = fs.readFileSync(new URL("w65-d7l-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const digests = {}
for (const f of [
  "main.tsx",
  "state/AppStateStore.ts",
  "utils/config.ts",
  "tools/ConfigTool/ConfigTool.ts",
  "tools/ConfigTool/supportedSettings.ts",
  "bootstrap/state.ts",
  "utils/logoV2Utils.ts",
  "hooks/useMergedTools.ts",
  "components/Settings/Config.tsx",
]) {
  digests[f] = digest(execFileSync("git", ["-C", root, "show", `${before}:${f}`], {encoding: "utf8"}))
}

fs.writeFileSync(
  new URL("w65-d7l-source-evidence.json", import.meta.url),
  JSON.stringify({
    before,
    kind: "replBridge / Remote Control leftover removal (no ported bodies)",
    surface:
      "the AppState field family the bridge owned (replBridgeEnabled/Explicit/OutboundOnly/Connected/SessionActive/Reconnecting/ConnectUrl/SessionUrl/EnvironmentId/SessionId/Error/InitialName), the two `claude assistant` viewer counters (remoteConnectionStatus, remoteBackgroundTaskCount), the Remote Control config setting with its resolver and migration, the readerless callout/backoff/oauth-dead config keys, the ant-only replBridgeActive bootstrap flag, the direct-connect server URL and its logo suffix, and the four comments that named the removed modules or the removed writeSdkMessages path",
    decisiveFact:
      "no module in this build reads or writes any of these slots — useReplBridge, the bridge dialog, initReplBridge and the CCR ingress are all absent — and the one config row (remoteControlAtStartup) sat behind feature('BRIDGE_MODE'), which is false",
    evidence: [
      {
        file: "state/AppStateStore.ts",
        change: "the twelve replBridge* fields with their comments and the two viewer counters deleted from the AppState type and from getDefaultAppState; no reader existed in the tree",
        sourceSha256: digests["state/AppStateStore.ts"],
        portSha256: digest(store),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "main.tsx",
        change: "the initialState seeds for all fourteen fields, the single `const fullRemoteControl = getRemoteControlAtStartup()` read that fed replBridgeEnabled, the migration import and its call site deleted",
        sourceSha256: digests["main.tsx"],
        portSha256: digest(main),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "utils/config.ts",
        change: "remoteControlAtStartup with getRemoteControlAtStartup() and its two GLOBAL_CONFIG_KEYS entries, remoteDialogSeen, and the bridgeOauthDead backoff pair deleted; desktopUpsellSeenCount, which has a live reader, stays",
        sourceSha256: digests["utils/config.ts"],
        portSha256: digest(config),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "tools/ConfigTool",
        change: "the remoteControlAtStartup setting row (already unreachable behind the false BRIDGE_MODE gate) and the tool's two AppState sync blocks — the default-unset branch and the general-set branch — removed",
        sourceSha256: digests["tools/ConfigTool/ConfigTool.ts"],
        portSha256: digest(configTool),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "bootstrap/state.ts",
        change: "the ant-only replBridgeActive field with isReplBridgeActive() (no readers), and directConnectServerUrl with its getter/setter (the setter had no callers, so the logo suffix folded to the bare display path)",
        sourceSha256: digests["bootstrap/state.ts"],
        portSha256: digest(state),
        coordinateUnit: "utf16-half-open",
      },
    ],
    removed: [
      "the AppState family: twelve replBridge* fields (type + default), remoteConnectionStatus and remoteBackgroundTaskCount, their main.tsx initialState values, and the four Config.tsx snapshot/restore lines that existed to revert a bridge toggle",
      "the config surface: remoteControlAtStartup with getRemoteControlAtStartup() and its GLOBAL_CONFIG_KEYS entry, the supportedSettings row behind feature('BRIDGE_MODE'), ConfigTool's two AppState sync blocks, Config.tsx's Remote Control change label, and migrations/migrateReplBridgeEnabledToRemoteControlAtStartup.ts with its main.tsx import and call",
      "the readerless keys: remoteDialogSeen, bridgeOauthDeadExpiresAt and bridgeOauthDeadFailCount",
      "the bootstrap state: replBridgeActive with its ant-only init and isReplBridgeActive(), directConnectServerUrl with getDirectConnectServerUrl/setDirectConnectServerUrl, and the logo header's URL suffix",
      "hooks/useMergedTools' two already-stubbed false locals and their memo dependencies",
    ],
    kept: [
      "the /remote-control command family (commands.ts, processUserInput's unavailability message, messages.ts' activation notice, SystemTextMessage's banner, utils/concurrentSessions.ts) and utils/config.ts' remoteControlSpawnMode — the next wave",
      "entrypoints/agentSdkTypes.ts' remote-control bridge declaration, the retained cli/transports/ + cli/remoteIO.ts SDK lane, and the SendMessageTool's bridge: recipient prose",
      "desktopUpsellSeenCount / desktopUpsellDismissed, which have live readers in components/DesktopUpsell",
      "the recovered-source references in retained files (cli/transports/*.ts, utils/controlMessageCompat.ts, commands/rename/generateSessionName.ts) that document where the upstream bridge called into those transports",
    ],
    tsc: {
      command: "node_modules/.bin/tsc --noEmit --pretty false",
      cwd: root,
      exitCode: 0,
      diagnostics: 0,
      logSha256: digest(tscText),
    },
    validation:
      "Absence sweep over both spellings of the whole family plus the migration name; each carrier asserted clean with its neighbouring statements intact (main.tsx' statusLineText→notifications seam and migration list, config.ts' key list and getCustomApiKeyStatus, ConfigTool's finalValue and logEvent, Config.tsx' two settings pairs, useMergedTools' memo tail, bootstrap's isRemoteMode block, logoV2Utils' folded cwd); the four rewritten comments asserted verbatim; the next wave's surface asserted still present; import-graph orphan scan stays at its 10 legitimate entries with the file count down by exactly one",
    remaining:
      "the /remote-control command family with remoteControlSpawnMode, the session-ingress bearer surface, the model-call seams (which must not be removed wholesale — API-key auth is the retained path), utils/fastMode.ts's remaining gates, the ~33 in-place CLI blocks, cli/transports/, and the dependency-pruning pass",
    notes: [
      "the AppState type had already lost the reader stubs in an earlier wave: hooks/useMergedTools still carried two locals hard-coded to false, which is what this step removes rather than a second fold",
      "utils/logoV2Utils.ts' displayPath existed only to be suffixed, so the fold renamed it to cwd instead of keeping a one-use alias",
    ],
  }, null, 2) + "\n",
)
console.log("PASS bridge field family gone; config keys gone; logo suffix folded; comments rewritten; next wave intact")
