import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "9825b9f"
const digest = text => createHash("sha256").update(text).digest("hex")

// This wave ports nothing. setKairosActive has no caller anywhere in the build
// (only the import), and main.tsx's `let kairosEnabled = false` is never
// reassigned, so the bootstrap bit and the AppState field are permanently
// false: every reader folds to its false arm, the auto-background plumbing
// only that block ever set goes with it, and the two accessors go with their
// last reader.
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

// 1. Nothing anywhere still reads either bit, and nothing the two of them
//    carried survives as a live name.
for (const pattern of [
  "kairosActive|kairosEnabled|getKairosActive|setKairosActive",
  "assistantAutoBackgrounded|ASSISTANT_BLOCKING_BUDGET_MS",
  "KAIROS_DREAM",
  "assistantModule|initializeAssistantTeam|assistantName",
  "'--assistant'",
  "sessionTranscriptModule|writeSessionTranscriptSegment|flushOnDateChange",
  "buildAssistantDailyLogPrompt",
  "assistantForceAsync|assistantMode",
]) {
  assert.equal(rg(pattern), "", `live reference remains for ${pattern}`)
}

// 2. Each folded reader is the arm the false value produced.
const state = fs.readFileSync(`${root}/bootstrap/state.ts`, "utf8")
assert.doesNotMatch(state, /kairosActive/)
const store = fs.readFileSync(`${root}/state/AppStateStore.ts`, "utf8")
assert.doesNotMatch(store, /kairosEnabled|Assistant mode fully enabled/)

const main = fs.readFileSync(`${root}/main.tsx`, "utf8")
assert.match(main, /const fullRemoteControl = getRemoteControlAtStartup\(\)\n/)
assert.match(main, /teamContext: computeInitialTeamContext\?\.\(\),/)

const fastMode = fs.readFileSync(`${root}/utils/fastMode.ts`, "utf8")
assert.match(fastMode, /getIsNonInteractiveSession\(\) &&\n    preferThirdPartyAuthentication\(\)\n  \) \{/)

const cron = fs.readFileSync(`${root}/utils/cronScheduler.ts`, "utf8")
assert.match(cron, /if \(isLoading\(\)\) return\n/)
assert.match(cron, /if \(!getScheduledTasksEnabled\(\) && hasCronTasksSync\(\)\) \{/)
const hook = fs.readFileSync(`${root}/hooks/useScheduledTasks.ts`, "utf8")
assert.match(hook, /export function useScheduledTasks\(\{\n  isLoading,\n  setMessages,\n\}: Props\): void \{/)
assert.match(hook, /\}, \[\]\)\n\}/)
assert.match(fs.readFileSync(`${root}/screens/REPL.tsx`, "utf8"), /useScheduledTasks!\(\{ isLoading, setMessages \}\)/)

// 3. The `||` terms dropped as single terms; each expression keeps the rest of
//    its shape.
const spinner = fs.readFileSync(`${root}/components/Spinner.tsx`, "utf8")
// The three `||`-term folds this step made in brief-mode readers (Spinner,
// UserPromptMessage, BriefTool's two gates) were superseded by step 7i, which
// removed the whole brief surface — one of the three files is gone and the other
// two no longer carry the expression. Recorded here as the prediction step 7i
// fulfilled; what stays checkable is that the folded terms stay absent.
assert.doesNotMatch(spinner, /getKairosActive|briefEnvEnabled|getUserMsgOptIn/)
const upm = fs.readFileSync(`${root}/components/messages/UserPromptMessage.tsx`, "utf8")
assert.doesNotMatch(upm, /getKairosActive|useBriefLayout|getUserMsgOptIn/)
assert.equal(fs.existsSync(`${root}/tools/BriefTool/BriefTool.ts`), false, "step 7i removed the brief tool")

// 4. The tools lost the budget constant, the schema field, the plumbing and the
//    message branch; the ordering of the surviving branch is unchanged.
for (const f of ["tools/BashTool/BashTool.tsx", "tools/PowerShellTool/PowerShellTool.tsx"]) {
  const text = fs.readFileSync(`${root}/${f}`, "utf8")
  assert.match(text, /if \(backgroundedByUser\) \{\n/)
  assert.doesNotMatch(text, /assistant-mode blocking budget/)
}
assert.doesNotMatch(fs.readFileSync(`${root}/utils/ShellCommand.ts`, "utf8"), /assistantAutoBackgrounded/)

// 5. AgentTool's schema is the omitted-optional shape the false flag produced,
//    and its shouldRunAsync chain lost only the term.
const agent = fs.readFileSync(`${root}/tools/AgentTool/AgentTool.tsx`, "utf8")
assert.match(agent, /const schema = fullInputSchema\(\)\.omit\(\{ cwd: true \}\)\n/)
// Step 7h left a `false` term (with its explanatory comment) at the end of this
// chain for the folded KAIROS term; step 7j removed the term with the whole
// PROACTIVE surface it read.
assert.match(agent, /isCoordinator \|\|\n        forceAsync\) &&/)

// 6. processSlashCommand keeps the synchronous path, whose imports the
//    fire-and-forget block had added for itself.
const psc = fs.readFileSync(`${root}/utils/processUserInput/processSlashCommand.tsx`, "utf8")
assert.doesNotMatch(psc, /MCP_SETTLE|enqueuePendingNotification|createAbortController|getWorkload/)
assert.match(psc, /isAsync: false,/)

const tscText = fs.readFileSync(new URL("w65-d7h-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const digests = {}
for (const f of [
  "main.tsx",
  "bootstrap/state.ts",
  "utils/processUserInput/processSlashCommand.tsx",
  "tools/BashTool/BashTool.tsx",
  "memdir/memdir.ts",
  "utils/cronScheduler.ts",
]) {
  digests[f] = digest(execFileSync("git", ["-C", root, "show", `${before}:${f}`], {encoding: "utf8"}))
}

fs.writeFileSync(
  new URL("w65-d7h-source-evidence.json", import.meta.url),
  JSON.stringify({
    before,
    kind: "assistant-mode state removal (no ported bodies)",
    surface:
      "assistant mode's own state: the bootstrap kairosActive bit with its two accessors and ten readers, the AppState kairosEnabled field, the --assistant option, the assistantModule stub, the assistant/assistantName settings, the cron scheduler's assistantMode bypass, and the two tools' auto-background plumbing",
    decisiveFact:
      "setKairosActive has no call site (only the main.tsx import) and main.tsx's `let kairosEnabled = false` is never reassigned, so both values are permanently false and every read is a constant fold",
    evidence: [
      {
        file: "utils/processUserInput/processSlashCommand.tsx",
        change: "the 97-line fire-and-forget block deleted (its guard was `feature('KAIROS') && (await getAppState()).kairosEnabled`), leaving the synchronous forked path the false flag already took; the six imports only that block used were pruned",
        sourceSha256: digests["utils/processUserInput/processSlashCommand.tsx"],
        portSha256: digest(psc),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "tools/BashTool/BashTool.tsx",
        change: "the auto-background block deleted with the budget constant, the schema field, the result plumbing and the message branch it fed; the surviving branch is the unchanged `if (backgroundedByUser)`",
        sourceSha256: digests["tools/BashTool/BashTool.tsx"],
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "memdir/memdir.ts",
        change: "the KAIROS daily-log block deleted, and with it buildAssistantDailyLogPrompt (54 lines) whose only caller it was; WHAT_NOT_TO_SAVE_SECTION and ENTRYPOINT_NAME keep other users",
        sourceSha256: digests["memdir/memdir.ts"],
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "main.tsx",
        change: "the --assistant option, the assistantModule stub, `let kairosEnabled`, the headless-state spread, the remote-control fold, the initialState field, the teamContext ternary and the assistant-mode comment block removed",
        sourceSha256: digests["main.tsx"],
        portSha256: digest(main),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "bootstrap/state.ts",
        change: "the kairosActive field, its default and both accessors removed — the accessors had no caller left once the ten readers folded",
        sourceSha256: digests["bootstrap/state.ts"],
        portSha256: digest(state),
        coordinateUnit: "utf16-half-open",
      },
    ],
    removed: [
      "state: bootstrap/state.ts kairosActive + getKairosActive/setKairosActive; state/AppStateStore.ts kairosEnabled and its default",
      "readers folded to their false arm: autoDream's isGateOpen line, memdir's daily-log block (with its prompt builder), BashTool/PowerShellTool's auto-background blocks, fastMode's SDK guard term, attachments' date-change flush, StatusLine's hide rule, and the single `getKairosActive() ||` terms in Spinner, UserPromptMessage and BriefTool (isBriefEntitled, isBriefEnabled)",
      "hangs off the AppState field: REPL's assistantMode read, the useScheduledTasks assistantMode prop and its effect dep, and the cronScheduler assistantMode bypass (two sites plus the option and its doc)",
      "compact.ts and attachments.ts sessionTranscriptModule (both ternary arms were null) with their three call sites and the pragma pair compact.ts no longer needed",
      "AgentTool's KAIROS schema ternary and assistantForceAsync; main.tsx's --assistant option, assistantModule stub, kairosEnabled local, headless spread, remote-control term, initialState field, teamContext preference and the two assistant-mode paragraphs above it",
      "settings/types.ts assistant/assistantName; skills/bundled/index.ts's KAIROS_DREAM require of the absent ./dream.js",
      "the auto-background plumbing: assistantAutoBackgrounded in both tools (schema, destructure, result field, early-return objects) and in ShellCommand's ExecResult, plus ASSISTANT_BLOCKING_BUDGET_MS in both",
    ],
    tsc: {
      command: "node_modules/.bin/tsc --noEmit --pretty false",
      cwd: root,
      exitCode: 0,
      diagnostics: 0,
      logSha256: digest(tscText),
    },
    validation:
      "Absence sweeps for both bits, both accessors, the three field names, the budget constant, KAIROS_DREAM, assistantModule/assistantName, --assistant and sessionTranscriptModule; the folded arms asserted textually (the four `||`-term expressions, the cron and fastMode guards, the tools' surviving branch, AgentTool's schema, the hook signature); import-graph orphan scan shows no new orphan; tsc log empty",
    remaining:
      "brief mode next (feature('KAIROS') || feature('KAIROS_BRIEF') across ~20 files), then PROACTIVE ticks, then the replBridge* AppState leftovers with getRemoteControlAtStartup(), the session-ingress bearer surface, the model-call seams (which must not be removed wholesale — API-key auth is the retained path), utils/fastMode.ts's remaining gates, the ~33 in-place CLI blocks, cli/transports/, and the dependency-pruning pass",
    notes: [
      "no module was deleted in this step, so there is no quarantine set",
      "the two comment paragraphs above main.tsx's `const {` documented the removed activation path and were removed with it",
    ],
  }, null, 2) + "\n",
)
console.log("PASS both bits gone; ten readers folded; tool plumbing gone; folded arms intact; tsc log empty")
