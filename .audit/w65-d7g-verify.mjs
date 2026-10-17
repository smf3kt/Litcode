import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "64c2520"
const digest = text => createHash("sha256").update(text).digest("hex")

// This wave ports nothing: the assistant-mode tools sat behind feature('KAIROS'),
// feature('KAIROS_PUSH_NOTIFICATION') and feature('KAIROS_GITHUB_WEBHOOKS') —
// all false — and each require target was already absent from this build. The
// checks are that the registrations, the shared name constant and its readers,
// and the push-notification settings are gone, and that each surviving shape is
// the arm the false flag already produced.
assert.equal(fs.existsSync(`${root}/tools/SendUserFileTool`), false, "the port directory survives")

function rg(pattern) {
  try {
    return execFileSync("rg", [
      "-n", "--glob", "!node_modules", "--glob", "!*.w*bak", "--glob", "!*.json",
      "-e", pattern, root,
    ], {encoding: "utf8"}).trim()
  } catch (e) {
    assert.equal(e.status, 1, `rg failed: ${e.message}`)
    return ""
  }
}

for (const pattern of [
  "SendUserFileTool|SubscribePRTool|PushNotificationTool",
  "SEND_USER_FILE_TOOL_NAME|taskCompleteNotifEnabled|inputNeededNotifEnabled|agentPushNotifEnabled",
  "KAIROS_PUSH_NOTIFICATION|KAIROS_GITHUB_WEBHOOKS",
  "'--push-notification'|Push when idle|Push when input needed|Push when Claude decides",
  "Local notifications",
]) {
  assert.equal(rg(pattern), "", `live reference remains for ${pattern}`)
}

// The pool no longer holds the three entries, and the neighbouring optional
// tools are untouched.
const tools = fs.readFileSync(`${root}/tools.ts`, "utf8")
assert.doesNotMatch(tools, /SendUserFileTool|PushNotificationTool|SubscribePRTool|SleepTool'\)/)
assert.match(tools, /const SleepTool =\n  feature\('PROACTIVE'\) \|\| feature\('KAIROS'\)/)
assert.match(tools, /const MonitorTool = feature\('MONITOR_TOOL'\)/)

// Each reader keeps the arm the false flag produced.
const messages = fs.readFileSync(`${root}/components/Messages.tsx`, "utf8")
assert.match(messages, /const briefToolNames = \[BRIEF_TOOL_NAME\]\.filter\(/)
const recovery = fs.readFileSync(`${root}/utils/conversationRecovery.ts`, "utf8")
assert.match(recovery, /return b\.name === BRIEF_TOOL_NAME \|\| b\.name === LEGACY_BRIEF_TOOL_NAME/)
const toolSearch = fs.readFileSync(`${root}/tools/ToolSearchTool/prompt.ts`, "utf8")
assert.doesNotMatch(toolSearch, /isReplBridgeActive/)
assert.match(toolSearch, /tool\.name === BRIEF_TOOL_NAME/)

// The notifChannel setting keeps its other (unflagged) name.
const config = fs.readFileSync(`${root}/components/Settings/Config.tsx`, "utf8")
assert.match(config, /id: 'notifChannel',\n      label: 'Notifications',/)

const tscText = fs.readFileSync(new URL("w65-d7g-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

fs.writeFileSync(
  new URL("w65-d7g-source-evidence.json", import.meta.url),
  JSON.stringify({
    before,
    kind: "assistant-mode tool surface removal (no ported bodies)",
    surface:
      "assistant mode's three tools (SendUserFile, PushNotification, SubscribePR) and the push-notification settings group that configured the second",
    evidence: [
      {
        file: "tools.ts",
        change: "the three flag-conditional requires and their pool entries removed; the neighbouring SleepTool/MonitorTool conditions untouched",
        sourceSha256: digest(execFileSync("git", ["-C", root, "show", `${before}:tools.ts`], {encoding: "utf8"})),
        portSha256: digest(tools),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "tools/SendUserFileTool/prompt.ts",
        change: "deleted — a W47 port whose three readers were the constants removed here; the recovered chunk it re-exported stays untouched",
        sourceSha256: digest(execFileSync("git", ["-C", root, "show", `${before}:tools/SendUserFileTool/prompt.ts`], {encoding: "utf8"})),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "components/Settings/Config.tsx",
        change: "the push-notification settings block and the notifChannel label's flag-on variant removed; the setting keeps the name its false-flag arm produced",
        sourceSha256: digest(execFileSync("git", ["-C", root, "show", `${before}:components/Settings/Config.tsx`], {encoding: "utf8"})),
        portSha256: digest(config),
        coordinateUnit: "utf16-half-open",
      },
    ],
    removed: [
      "tools.ts: three conditional requires (SendUserFileTool, PushNotificationTool, SubscribePRTool) and their three pool spreads",
      "tools/SendUserFileTool/prompt.ts and its directory (a W47 port re-exporting from recovered/chunk-5zy1gftc.js)",
      "the shared name constant and its three readers: components/Messages.tsx's brief-turn filter, tools/ToolSearchTool/prompt.ts's always-available rule (which took the now-unused isReplBridgeActive import with it), utils/conversationRecovery.ts's tool_use match",
      "the push-notification settings: three toggles in components/Settings/Config.tsx, their three entries in tools/ConfigTool/supportedSettings.ts, and the three fields plus three allowlist entries in utils/config.ts",
    ],
    tsc: {
      command: "node_modules/.bin/tsc --noEmit --pretty false",
      cwd: root,
      exitCode: 0,
      diagnostics: 0,
      logSha256: digest(tscText),
    },
    validation:
      "Absence sweeps for the flag set, the three tool names, the shared constant, the three settings keys and the label variant; the surviving arms asserted textually (the pool's neighbouring conditions, the three readers, the notifChannel label); import-graph orphan scan shows no new orphan; tsc log empty",
    remaining:
      "assistant mode's own state next (kairosEnabled and its four main.tsx sites, --assistant, the assistantModule stub, getKairosActive/setKairosActive, and the KAIROS-alone reads in BashTool, PowerShellTool, memdir, compact, attachments, StatusLine, fastMode, AgentTool and processSlashCommand), then brief mode (KAIROS || KAIROS_BRIEF across ~20 files), then PROACTIVE ticks, then KAIROS_DREAM",
    notes: [
      "isReplBridgeActive now has no caller in the product; it stays with the replBridge* AppState leftovers already on the remaining list",
      "recovered/chunk-5zy1gftc.js now has no importer; recovered/ is the research archive, not build input, so it is left as-is",
      "two prose comments still name SendUserFile (tools/BriefTool/attachments.ts, utils/transcriptSearch.ts) as documentation of tool-arg shapes; inert, kept",
    ],
  }, null, 2) + "\n",
)
console.log("PASS assistant-mode tools gone; no flag read; settings group gone; surviving arms intact; tsc log empty")
