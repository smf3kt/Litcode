import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "f1b8fb1"
const digest = text => createHash("sha256").update(text).digest("hex")

// This wave ports nothing. feature('PROACTIVE') and feature('KAIROS') are both
// false and no proactive/ directory exists in the build, so every
// proactiveModule was null, every isProactiveActive() read was constant false,
// and the Sleep tool (whose module file was absent) was never in the tool list.
// Every reader folds to the arm the false value produced; the tick loop, the
// --proactive / CLAUDE_CODE_PROACTIVE entry points and the tick-tag readers go
// with it.
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

// 1. The whole surface is gone: the module handles, the activation API, the
//    tick loop, the tick tag, the Sleep tool and the two settings.
for (const pattern of [
  "PROACTIVE|proactiveModule|isProactiveActive|activateProactive|deactivateProactive|pauseProactive|resumeProactive|setContextBlocked|subscribeToProactiveChanges|getNextTickAt|scheduleProactiveTick|TICK_TAG|SLEEP_TOOL|SleepTool|sleep_progress|minSleepDurationMs|maxSleepDurationMs|CLAUDE_CODE_PROACTIVE|'--proactive'|ProactiveCountdown|hasNextTick|nextTickAt|useProactive",
  "maybeActivateProactive|set_proactive",
]) {
  assert.equal(rg(pattern), "", `live reference remains for ${pattern}`)
}
assert.equal(fs.existsSync(`${root}/tools/SleepTool`), false, "the Sleep tool directory is gone")

// 2. Each folded reader is the arm the false value produced.
const tools = fs.readFileSync(`${root}/tools.ts`, "utf8")
assert.doesNotMatch(tools, /SleepTool/)

const query = fs.readFileSync(`${root}/query.ts`, "utf8")
assert.match(query, /const queuedCommandsSnapshot = getCommandsByMaxPriority\('next'\)\.filter\(\n      cmd => \{/)

const log = fs.readFileSync(`${root}/utils/log.ts`, "utf8")
assert.match(log, /const useFirstPrompt = strippedFirstPrompt\n/)
assert.doesNotMatch(log, /isAutonomousPrompt/)

const sys = fs.readFileSync(`${root}/utils/systemPrompt.ts`, "utf8")
assert.doesNotMatch(sys, /isProactiveActive_SAFE_TO_CALL_ANYWHERE/)
assert.match(sys, /return asSystemPrompt\(\[\n    \.\.\.\(agentSystemPrompt/)

const prompts = fs.readFileSync(`${root}/constants/prompts.ts`, "utf8")
assert.doesNotMatch(prompts, /getProactiveSection|simple-proactive|Autonomous work/)
assert.match(prompts, /const dynamicSections = \[/)

const messages = fs.readFileSync(`${root}/components/Messages.tsx`, "utf8")
assert.match(messages, /const progressEnabled =\n    getGlobalConfig\(\)\.terminalProgressBarEnabled && !getIsRemoteMode\(\)/)

const placeholder = fs.readFileSync(`${root}/components/PromptInput/usePromptInputPlaceholder.ts`, "utf8")
assert.match(placeholder, /if \(submitCount < 1 && promptSuggestionEnabled\) \{/)

const footer = fs.readFileSync(`${root}/components/PromptInput/PromptInputFooterLeftSide.tsx`, "utf8")
assert.doesNotMatch(footer, /ProactiveCountdown|NO_OP_SUBSCRIBE/)
assert.match(footer, /\} else if \(!hasTeammatePills && showHint\) \{/)
assert.match(footer, /const isCoordinator = feature\('COORDINATOR_MODE'\)/)

const repl = fs.readFileSync(`${root}/screens/REPL.tsx`, "utf8")
assert.match(repl, /    \[toolPermissionContext\],\n/)
assert.doesNotMatch(repl, /onlySleepToolActive/)
assert.match(repl, /const SUGGEST_BG_PR_NOOP = \(_p: string, _n: string\): boolean => false/)

const main = fs.readFileSync(`${root}/main.tsx`, "utf8")
assert.doesNotMatch(main, /Proactive Mode/)
assert.match(main, /isEnvTruthy\(process\.env\.CLAUDE_CODE_USE_BEDROCK\)/)

const print = fs.readFileSync(`${root}/cli/print.ts`, "utf8")
assert.match(print, /import \{ TEAMMATE_MESSAGE_TAG \} from 'src\/constants\/xml\.js'/)
assert.match(print, /sendControlResponseError/)

const storage = fs.readFileSync(`${root}/utils/sessionStorage.ts`, "utf8")
assert.match(storage, /const EPHEMERAL_PROGRESS_TYPES = new Set\(\[\n  'bash_progress',/)
assert.match(storage, /import \{ COMMAND_NAME_TAG \} from '\.\.\/constants\/xml\.js'/)

const textInput = fs.readFileSync(`${root}/types/textInputTypes.ts`, "utf8")
assert.match(textInput, /export type QueuePriority = 'now' \| 'next' \| 'later'/)

const xml = fs.readFileSync(`${root}/constants/xml.ts`, "utf8")
assert.doesNotMatch(xml, /TICK_TAG/)

// 3. The cron/AGENT_TRIGGERS surface was left intact by this step as a later
//    wave; step 7k then removed it (the flag is false, so the tools, the skill
//    and the scheduler were all unreachable).
assert.equal(fs.existsSync(`${root}/tools/ScheduleCronTool`), false)
assert.equal(fs.existsSync(`${root}/hooks/useScheduledTasks.ts`), false)

const tscText = fs.readFileSync(new URL("w65-d7j-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const digests = {}
for (const f of [
  "constants/prompts.ts",
  "utils/systemPrompt.ts",
  "screens/REPL.tsx",
  "cli/print.ts",
  "main.tsx",
  "tools/SleepTool/prompt.ts",
]) {
  digests[f] = digest(execFileSync("git", ["-C", root, "show", `${before}:${f}`], {encoding: "utf8"}))
}

fs.writeFileSync(
  new URL("w65-d7j-source-evidence.json", import.meta.url),
  JSON.stringify({
    before,
    kind: "PROACTIVE tick machinery removal (no ported bodies)",
    surface:
      "the proactive tick mechanism: the proactiveModule handles and the whole activation API (activate/deactivate/pause/resume/setContextBlocked/getNextTickAt), the tick system-prompt section and the simple-proactive prompt path, the Sleep tool with its prompt module and both settings, the tick loop in print.ts with the set_proactive control branch, the --proactive option and CLAUDE_CODE_PROACTIVE entry points, the footer countdown, and the four tick-tag readers",
    decisiveFact:
      "feature('PROACTIVE') and feature('KAIROS') are both false and this build contains no proactive/ directory, so every proactiveModule was null, every isProactiveActive() read was a constant false, and tools/SleepTool/ held only a prompt module whose tool file does not exist",
    evidence: [
      {
        file: "constants/prompts.ts",
        change: "the simple-proactive prompt path (a whole return-branch of getSimpleSystemPrompt) and getProactiveSection deleted, along with the proactiveModule require and the TICK_TAG import it used",
        sourceSha256: digests["constants/prompts.ts"],
        portSha256: digest(prompts),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "screens/REPL.tsx",
        change: "the useSyncExternalStore over the null module, the Sleep-only spinner rule, and five `if (feature('PROACTIVE') || feature('KAIROS')) { proactiveModule?.… }` blocks plus the terminalFocus spread deleted; the tools memo keeps its getTools dependency alone",
        sourceSha256: digests["screens/REPL.tsx"],
        portSha256: digest(repl),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "cli/print.ts",
        change: "the tick scheduler and its two call sites, the set_proactive control-request branch, the CLAUDE_CODE_PROACTIVE fallback and the always-null module deleted; the control loop keeps its error branch",
        sourceSha256: digests["cli/print.ts"],
        portSha256: digest(print),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "main.tsx",
        change: "maybeActivateProactive with its four call sites, the --proactive option and the Proactive Mode appendSystemPrompt block removed — every one of them gated on the two false flags",
        sourceSha256: digests["main.tsx"],
        portSha256: digest(main),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "utils/systemPrompt.ts",
        change: "the module was `feature(…) ? null : null`, so isProactiveActive_SAFE_TO_CALL_ANYWHERE() was constant false and its one reader — the agent-instructions append branch — folded away",
        sourceSha256: digests["utils/systemPrompt.ts"],
        portSha256: digest(sys),
        coordinateUnit: "utf16-half-open",
      },
    ],
    removed: [
      "the module handles: proactiveModule in constants/prompts.ts, utils/systemPrompt.ts, services/compact/prompt.ts, cli/print.ts, screens/REPL.tsx, components/Messages.tsx, components/PromptInput/PromptInputFooterLeftSide.tsx, components/PromptInput/usePromptInputPlaceholder.ts; the useProactive require in REPL.tsx with no caller",
      "the tool: tools/SleepTool/prompt.ts (the tool module itself was never in the build) and its two settings minSleepDurationMs/maxSleepDurationMs; SLEEP_TOOL_NAME's four readers — tools.ts' gate, query.ts' drain-threshold upgrade, REPL's Sleep-only spinner rule, classifierDecision's auto-mode allowlist",
      "the tick loop: cli/print.ts scheduleProactiveTick with both call sites, the set_proactive control branch, the CLAUDE_CODE_PROACTIVE fallback; TICK_TAG itself and its four readers (constants/prompts.ts, utils/log.ts's resume-title fallback, UserTextMessage's hide rule, MessageSelector's transcript filter)",
      "the prompt surface: the simple-proactive return branch of getSimpleSystemPrompt, getProactiveSection (67 lines), the Proactive Mode appendSystemPrompt block in main.tsx",
      "the activation API: maybeActivateProactive with four call sites, --proactive, commands/clear/conversation.ts' setContextBlocked reset, REPL's pause/resume/setContextBlocked calls, the terminalFocus user-context spread, and the /compact and partial-compact both folded to their unchanged tails",
      "the UI: ProactiveCountdown with the footer's nextTickAt/hasNextTick pair, Messages.tsx' terminal-progress gate, usePromptInputPlaceholder's example-command gate",
    ],
    kept: [
      "the cron/AGENT_TRIGGERS surface (ScheduleCronTool, isKairosCronEnabled, useScheduledTasks, the /loop skill) — a separate wave",
      "SUGGEST_BG_PR_NOOP and the coordinator gates in REPL.tsx and the footer, which are other lanes",
      "the neutral uses of the word in prose (services/mcp/auth.ts' token refresh, compact's reactive/proactive autocompact, BashTool's 'too proactive' instruction)",
    ],
    tsc: {
      command: "node_modules/.bin/tsc --noEmit --pretty false",
      cwd: root,
      exitCode: 0,
      diagnostics: 0,
      logSha256: digest(tscText),
    },
    validation:
      "Absence sweep for every module handle, activation call, tick symbol and Sleep name; the folded arms asserted textually (query.ts' drain call, log.ts' title fallback, systemPrompt's tail return, Messages' progress gate, the placeholder's example gate, the footer's else-if chain, REPL's tools memo); the cron surface asserted still intact; import-graph orphan scan stays at its 10 legitimate entries with the file count down by exactly one",
    remaining:
      "the AGENT_TRIGGERS/cron wave (isKairosCronEnabled and its four callers, the three ScheduleCronTool modules, the /loop skill), then the replBridge* AppState leftovers with getRemoteControlAtStartup(), the session-ingress bearer surface, the model-call seams (which must not be removed wholesale — API-key auth is the retained path), utils/fastMode.ts's remaining gates, the ~33 in-place CLI blocks, cli/transports/, and the dependency-pruning pass",
    notes: [
      "no queued-work name survives the wave: the queue priorities 'now' | 'next' | 'later' keep their semantics with the Sleep clauses dropped from their doc comment, and their one remaining producer is the cron scheduler",
      "constants/xml.ts lost TICK_TAG, the last tag that no producer could emit",
    ],
  }, null, 2) + "\n",
)
console.log("PASS proactive surface gone; readers folded; Sleep tool gone; cron surface intact; tsc log empty")
