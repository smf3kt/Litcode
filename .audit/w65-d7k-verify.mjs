import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "6014abf"
const digest = text => createHash("sha256").update(text).digest("hex")

// This wave ports nothing. feature('AGENT_TRIGGERS') is false, so
// isKairosCronEnabled() is constant false: the three cron tools never enter the
// pool, the /loop skill is never enabled, the REPL hook and the print-mode
// scheduler are never constructed, and the sentinel file was never watched.
// The scheduler, task store, jitter config, lock, cron parser, hook, skill and
// tools go as units, and the session state they owned goes with them.
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

// 1. The flag and every name in the cluster are gone from live code. The SDK
//    type declarations in entrypoints/agentSdkTypes.ts are the one kept
//    surface (an inert contract, same treatment as wave C's rate_limit_event).
for (const pattern of [
  "AGENT_TRIGGERS|isKairosCronEnabled|isDurableCronEnabled|cronScheduler|cronTasks|cronTasksLock|cronJitterConfig|CronScheduler|ScheduleCron|CronCreate|CronDelete|CronList|CRON_CREATE_TOOL_NAME|CRON_DELETE_TOOL_NAME|CRON_LIST_TOOL_NAME|scheduledTasksEnabled|sessionCronTasks|SessionCronTask|useScheduledTasks|registerLoopSkill|DEFAULT_CRON_JITTER_CONFIG|getCronJitterConfig|WORKLOAD_CRON",
  "scheduled_tasks\\.json",
]) {
  const hits = rg(pattern)
  const outside = hits
    .split("\n")
    .filter(Boolean)
    .filter(l => !l.includes("/entrypoints/agentSdkTypes.ts"))
  assert.deepEqual(outside, [], `live reference remains for ${pattern}`)
}
for (const rel of [
  "utils/cronTasks.ts",
  "utils/cronScheduler.ts",
  "utils/cronTasksLock.ts",
  "utils/cron.ts",
  "utils/cronJitterConfig.ts",
  "hooks/useScheduledTasks.ts",
  "skills/bundled/loop.ts",
  "tools/ScheduleCronTool",
]) {
  assert.equal(fs.existsSync(`${root}/${rel}`), false, `${rel} is gone`)
}

// 2. Each folded site is the arm the false flag produced.
const tools = fs.readFileSync(`${root}/tools.ts`, "utf8")
assert.doesNotMatch(tools, /cronTools/)
assert.match(tools, /\.\.\.\(WorkflowTool \? \[WorkflowTool\] : \[\]\),/)
assert.match(tools, /\.\.\.\(MonitorTool \? \[MonitorTool\] : \[\]\),/)

const constants = fs.readFileSync(`${root}/constants/tools.ts`, "utf8")
assert.doesNotMatch(constants, /CRON/)
assert.match(constants, /SEND_MESSAGE_TOOL_NAME,/)

const repl = fs.readFileSync(`${root}/screens/REPL.tsx`, "utf8")
assert.doesNotMatch(repl, /useScheduledTasks|Scheduled tasks/)
assert.match(repl, /useMailboxBridge\(\{ isLoading, onSubmitMessage: handleIncomingPrompt \}\)/)

const skills = fs.readFileSync(`${root}/skills/bundled/index.ts`, "utf8")
assert.doesNotMatch(skills, /registerLoopSkill|AGENT_TRIGGERS/)
assert.match(skills, /registerStuckSkill\(\)/)

const tips = fs.readFileSync(`${root}/services/tips/tipRegistry.ts`, "utf8")
assert.doesNotMatch(tips, /loop-command-nudge|isKairosCronEnabled/)
assert.match(tips, /id: 'feedback-command',/)

const print = fs.readFileSync(`${root}/cli/print.ts`, "utf8")
assert.doesNotMatch(print, /cronScheduler|cronGate|cronJitterConfigModule/)
assert.match(print, /import \{ runWithWorkload \} from 'src\/utils\/workloadContext.js'/)
assert.match(print, /await runWithWorkload\(cmd\.workload \?\? options\.workload, async \(\) => \{/)

const state = fs.readFileSync(`${root}/bootstrap/state.ts`, "utf8")
assert.doesNotMatch(state, /Cron|scheduledTasks/)
assert.match(state, /sessionCreatedTeams: new Set\(\),/)

const workload = fs.readFileSync(`${root}/utils/workloadContext.ts`, "utf8")
assert.doesNotMatch(workload, /WORKLOAD_CRON|type Workload/)
assert.match(workload, /export function getWorkload\(\): string \| undefined \{/)

// 3. The queue-priority type keeps its three levels and the transport that
//    still reads them.
assert.match(fs.readFileSync(`${root}/types/textInputTypes.ts`, "utf8"), /export type QueuePriority = 'now' \| 'next' \| 'later'/)

const tscText = fs.readFileSync(new URL("w65-d7k-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const digests = {}
for (const f of [
  "tools/ScheduleCronTool/CronCreateTool.ts",
  "utils/cronScheduler.ts",
  "hooks/useScheduledTasks.ts",
  "skills/bundled/loop.ts",
  "cli/print.ts",
  "bootstrap/state.ts",
]) {
  digests[f] = digest(execFileSync("git", ["-C", root, "show", `${before}:${f}`], {encoding: "utf8"}))
}

fs.writeFileSync(
  new URL("w65-d7k-source-evidence.json", import.meta.url),
  JSON.stringify({
    before,
    kind: "AGENT_TRIGGERS/cron surface removal (no ported bodies)",
    surface:
      "the cron scheduler cluster behind feature('AGENT_TRIGGERS'): the three ScheduleCronTool modules with their prompt and UI, the scheduler with its task store, lock and jitter config, the cron expression parser, the REPL hook and the print-mode scheduler, the /loop skill and its tip, the CRON_* tool names, and the session state (scheduledTasksEnabled, sessionCronTasks)",
    decisiveFact:
      "feature('AGENT_TRIGGERS') is false, so isKairosCronEnabled() — its only gate — is constant false: the tools never enter the pool, the skill is never enabled, the REPL hook and print-mode scheduler are never constructed, and the *.json sentinel was never watched",
    evidence: [
      {
        file: "tools/ScheduleCronTool/CronCreateTool.ts",
        change: "the whole tool directory deleted (create/delete/list tools with buildCron*Prompt, the shared prompt module and the UI); its only entry was tools.ts' flag-conditional require, which is gone",
        sourceSha256: digests["tools/ScheduleCronTool/CronCreateTool.ts"],
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "utils/cronScheduler.ts",
        change: "the scheduler deleted with the task store, the per-directory lock and the jitter config it read; its two constructors (the REPL hook and print.ts' block) are both behind the same false flag",
        sourceSha256: digests["utils/cronScheduler.ts"],
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "hooks/useScheduledTasks.ts",
        change: "the REPL hook deleted; REPL's require was `feature('AGENT_TRIGGERS') ? require(...) : null` and its single call site sat in the matching `if`, so the `useScheduledTasks!` non-null assertion went with both",
        sourceSha256: digests["hooks/useScheduledTasks.ts"],
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "skills/bundled/loop.ts",
        change: "the /loop skill deleted with its registration block; its isEnabled was isKairosCronEnabled itself, so registration and gate were both constant",
        sourceSha256: digests["skills/bundled/loop.ts"],
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "cli/print.ts",
        change: "the three flag-conditional requires, the scheduler block and its `cronScheduler?.stop()` cleanup line deleted; the WORKLOAD_CRON import term went with the only queue item that carried it",
        sourceSha256: digests["cli/print.ts"],
        portSha256: digest(print),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "bootstrap/state.ts",
        change: "scheduledTasksEnabled with both accessors, and sessionCronTasks with its type and three functions, deleted — the scheduler and CronCreateTool were their only writers",
        sourceSha256: digests["bootstrap/state.ts"],
        portSha256: digest(state),
        coordinateUnit: "utf16-half-open",
      },
    ],
    removed: [
      "the tool cluster: tools/ScheduleCronTool/ (CronCreateTool, CronDeleteTool, CronListTool, prompt.ts, UI.tsx) plus the three CRON_* names in constants/tools.ts' agent-disallowed set",
      "the engine: utils/cronTasks.ts, utils/cronScheduler.ts, utils/cronTasksLock.ts, utils/cron.ts, utils/cronJitterConfig.ts",
      "the hosts: REPL's require and its if-wrapped call site, print.ts' three requires with the scheduler block, skills/bundled/index.ts' registration, services/tips/tipRegistry.ts' loop-command-nudge entry",
      "the session state: bootstrap/state.ts' scheduledTasksEnabled (field, default, both accessors) and sessionCronTasks (field, default, SessionCronTask type, three functions)",
      "WORKLOAD_CRON and the Workload type, whose only producer was the cron queue item; the sanitizer constraint the type documented moved to runWithWorkload, which is still called for SDK-supplied workload tags",
      "four prose sites re-worded with the code they described (the queued-commands hide rule, handlePromptSubmit's provenance note, textInputTypes' workload field, workloadContext's ALS rationale)",
    ],
    kept: [
      "entrypoints/agentSdkTypes.ts' CronTask/ScheduledTaskEvent/ScheduledTasksHandle types with the two throwing stubs — a declared SDK contract with no producer, the same call wave C made for rate_limit_event. Named in the fixture so the absence sweep stays honest about it",
      "utils/workloadContext.ts itself: runWithWorkload/getWorkload still carry SDK-supplied tags, and --workload is still a CLI option",
      "the QueuePriority union, whose three levels the LocalShellTask and the turn drain still use",
    ],
    tsc: {
      command: "node_modules/.bin/tsc --noEmit --pretty false",
      cwd: root,
      exitCode: 0,
      diagnostics: 0,
      logSha256: digest(tscText),
    },
    validation:
      "Absence sweep for the flag, every module name, every tool name and the two state fields, with the SDK declaration file excluded explicitly and asserted separately; the folded sites asserted textually (tools.ts' neighbouring pool lines, constants/tools.ts' surviving set, REPL's neighbouring hooks, skills/bundled/index.ts' neighbouring registrations, the tips array's next entry, print.ts' surviving runWithWorkload call, state.ts' neighbouring field); the deleted paths asserted absent; import-graph orphan scan stays at its 10 legitimate entries with the file count down by exactly the twelve deleted modules",
    remaining:
      "the replBridge* AppState leftovers with getRemoteControlAtStartup(), the session-ingress bearer surface, the model-call seams (which must not be removed wholesale — API-key auth is the retained path), utils/fastMode.ts's remaining gates, the ~33 in-place CLI blocks, cli/transports/, and the dependency-pruning pass",
    notes: [
      "one quarantine ran first: tools/ScheduleCronTool/UI.tsx.w54bak was copied to .audit/w65-d7k-baks/ and byte-compared before the directory was removed",
      "the scheduler's own gate is isKairosCronEnabled, whose body is `feature('AGENT_TRIGGERS') ? !isEnvTruthy(CLAUDE_CODE_DISABLE_CRON) && getFeatureValue_CACHED_WITH_REFRESH('tengu_kairos_cron', true, …) : false` — the GrowthBook term and the env kill switch are both unreachable behind the build flag",
    ],
  }, null, 2) + "\n",
)
console.log("PASS cron cluster gone; flag reads folded; state gone; SDK declarations kept; tsc log empty")
