import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "98e4ff1"
const digest = text => createHash("sha256").update(text).digest("hex")

// This wave ports nothing. Brief mode — the SendUserMessage tool and its
// chat-style view — sat behind feature('KAIROS') || feature('KAIROS_BRIEF'),
// and the tool's own isEnabled() was that same build-time ternary, so the false
// arm the source already wrote is "no tool, no brief view". The checks are that
// the module tree is gone, no code reference to it survives, the opt-in state
// and the AppState mirror that drove the view are gone, and every folded layout
// branch is the plain arm.
for (const gone of [
  "tools/BriefTool",
  "utils/formatBriefTimestamp.ts",
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

// 1. No code reference to the tool, the flag, or the state it needed.
for (const pattern of [
  "KAIROS_BRIEF",
  "BRIEF_TOOL_NAME|LEGACY_BRIEF_TOOL_NAME|BRIEF_TOOL_PROMPT|BRIEF_PROACTIVE_SECTION",
  "isBriefOnly|isBriefEnabled|isBriefEntitled|userMsgOptIn|maybeActivateBrief",
  "BriefSpinner|BriefIdleStatus|useBriefLayout|briefEnvEnabled|briefOwnsGap",
  "formatBriefTimestamp|briefLabelYou|briefLabelClaude",
  "toggleBrief",
  "SendUserMessage",
]) {
  assert.equal(rg(pattern), "", `live reference remains for ${pattern}`)
}

// 1a. The two `--brief` hits are GNU file's own flag in the read-only command
//     classification tables, not this CLI's option; the option is gone.
const briefFlag = rg("'--brief'").split("\n").filter(Boolean)
assert.equal(briefFlag.length, 2, `--brief appears ${briefFlag.length} times: ${briefFlag.join(" | ")}`)
for (const line of briefFlag) {
  assert.match(line, /tools\/(Bash|PowerShell)Tool\/readOnlyValidation\.ts:/)
}

// 1b. The two inert prose comments that still name the tool while documenting
//     attachment shapes (recorded, kept).
const briefProse = rg("BriefTool|filterForBriefTool").split("\n").filter(Boolean)
assert.equal(briefProse.length, 2, `prose mentions: ${briefProse.join(" | ")}`)
for (const line of briefProse) {
  assert.match(line, /utils\/(messages\/mappers|imagePaste)\.ts:/)
}

// 2. The startup paths and the option are gone.
const main = fs.readFileSync(`${root}/main.tsx`, "utf8")
assert.doesNotMatch(main, /BriefTool|userMsgOptIn|--brief/)
// This step left the Proactive Mode prompt block alone (a different lane); step
// 7j removed it with the rest of the PROACTIVE surface.
assert.doesNotMatch(main, /Proactive Mode/)
const state = fs.readFileSync(`${root}/bootstrap/state.ts`, "utf8")
assert.doesNotMatch(state, /userMsgOptIn/)
const store = fs.readFileSync(`${root}/state/AppStateStore.ts`, "utf8")
assert.doesNotMatch(store, /isBriefOnly/)
const settings = fs.readFileSync(`${root}/utils/settings/types.ts`, "utf8")
assert.doesNotMatch(settings, /defaultView/)
assert.doesNotMatch(fs.readFileSync(`${root}/components/Settings/Config.tsx`, "utf8"), /defaultView|userMsgOptIn/)

// 3. The transcript no longer filters; the resume classifier no longer asks.
const messages = fs.readFileSync(`${root}/components/Messages.tsx`, "utf8")
assert.doesNotMatch(messages, /filterForBriefTool|dropTextInBriefTurns|briefFiltered/)
assert.match(messages, /\{streamingText && \(/)
assert.match(messages, /\{isStreamingThinkingVisible && streamingThinking && \(/)
const recovery = fs.readFileSync(`${root}/utils/conversationRecovery.ts`, "utf8")
assert.doesNotMatch(recovery, /isTerminalToolResult|BRIEF/)
assert.match(recovery, /if \(isToolUseResultMessage\(lastMessage\)\) \{\n      return \{ kind: 'interrupted_turn' \}/)

// 4. Every view branch is the plain arm the false gate produced.
const spinner = fs.readFileSync(`${root}/components/Spinner.tsx`, "utf8")
assert.match(spinner, /export function SpinnerWithVerb\(\{\n  mode,\n/)
assert.doesNotMatch(spinner, /SpinnerWithVerbInner|isEnvTruthy|ASSISTANT|brief/)
const repl = fs.readFileSync(`${root}/screens/REPL.tsx`, "utf8")
assert.match(repl, /import \{ SpinnerWithVerb, type SpinnerMode \} from '\.\.\/components\/Spinner\.js'/)
assert.doesNotMatch(repl, /BriefIdleStatus|isBriefOnly/)
// This step kept the tools memo's proactiveActive dependency (a different
// lane); step 7j removed the store it read and left `[toolPermissionContext]`.
assert.match(repl, /    \[toolPermissionContext\],\n/)
const upm = fs.readFileSync(`${root}/components/messages/UserPromptMessage.tsx`, "utf8")
assert.doesNotMatch(upm, /useBriefLayout|timestamp|useAppState|isEnvTruthy/)
assert.match(upm, /isSelected \? 'messageActionsBackground' : 'userMessageBackground'/)
assert.match(upm, /<HighlightedThinkingText text=\{displayText\} \/>/)
const htt = fs.readFileSync(`${root}/components/messages/HighlightedThinkingText.tsx`, "utf8")
assert.match(htt, /type Props = \{\n  text: string\n\}/)
assert.match(fs.readFileSync(`${root}/context/QueuedMessageContext.tsx`, "utf8"), /const padding = PADDING_X/)
assert.match(
  fs.readFileSync(`${root}/components/PromptInput/PromptInput.tsx`, "utf8"),
  /<Box flexDirection="column" marginTop=\{1\}>/,
)
assert.match(
  fs.readFileSync(`${root}/components/PromptInput/Notifications.tsx`, "utf8"),
  /<TokenWarning tokenUsage=\{tokenUsage\} model=\{mainLoopModel\} \/>/,
)

const tscText = fs.readFileSync(new URL("w65-d7i-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const digests = {}
for (const f of [
  "tools/BriefTool/BriefTool.ts",
  "tools/BriefTool/prompt.ts",
  "constants/prompts.ts",
  "components/Messages.tsx",
  "components/Spinner.tsx",
  "main.tsx",
  "utils/conversationRecovery.ts",
  "utils/theme.ts",
]) {
  digests[f] = digest(execFileSync("git", ["-C", root, "show", `${before}:${f}`], {encoding: "utf8"}))
}

fs.writeFileSync(
  new URL("w65-d7i-source-evidence.json", import.meta.url),
  JSON.stringify({
    before,
    kind: "brief-mode surface removal (no ported bodies)",
    surface:
      "brief mode: the SendUserMessage tool (BriefTool), its prompt text, UI and attachment resolver, the three startup opt-in paths, the /config view picker, the ctrl+shift+b toggle, the transcript filters, and the chat-style view branch it drove",
    decisiveFact:
      "BriefTool.isEnabled() returned isBriefEnabled(), whose body is the same `feature('KAIROS') || feature('KAIROS_BRIEF')` ternary, so the tool is never enabled in this build and every reader is a constant fold",
    evidence: [
      {
        file: "tools/BriefTool/BriefTool.ts",
        change:
          "deleted with prompt.ts, UI.tsx and attachments.ts (405 lines): the tool, its input/output schemas, the entitlement and activation gates whose ternary arms were already false, and the logEvent its activation emitted",
        sourceSha256: digests["tools/BriefTool/BriefTool.ts"],
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "constants/prompts.ts",
        change:
          "the brief system-prompt section removed (the conditional require pair, the systemPromptSection('brief') spread, getBriefSection(), and the proactive section's trailing interpolation, whose false arm was the empty string)",
        sourceSha256: digests["constants/prompts.ts"],
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "components/Messages.tsx",
        change:
          "filterForBriefTool and dropTextInBriefTurns deleted (130 lines) with the three-tier filtering they fed, leaving the unfiltered list; the isBriefOnly prop and its two streaming suppressions removed",
        sourceSha256: digests["components/Messages.tsx"],
        portSha256: digest(messages),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "components/Spinner.tsx",
        change:
          "the brief branch removed from the SpinnerWithVerb wrapper (the wrapper's inner component takes its name), and BriefSpinner with BriefIdleStatus (139 lines) deleted; five imports only they used were pruned",
        sourceSha256: digests["components/Spinner.tsx"],
        portSha256: digest(spinner),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "main.tsx",
        change:
          "the --tools opt-in path, the defaultView opt-in path, the --brief option and maybeActivateBrief with its four call sites removed; initialIsBriefOnly leaves the initial state",
        sourceSha256: digests["main.tsx"],
        portSha256: digest(main),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "utils/conversationRecovery.ts",
        change:
          "the resume classifier loses isTerminalToolResult, which asked whether the last tool_result came from SendUserMessage — both names null, so its answer was always false and its caller folds to the interrupted-turn arm",
        sourceSha256: digests["utils/conversationRecovery.ts"],
        portSha256: digest(recovery),
        coordinateUnit: "utf16-half-open",
      },
    ],
    removed: [
      "modules: tools/BriefTool/ (BriefTool.ts, prompt.ts, UI.tsx, attachments.ts) and utils/formatBriefTimestamp.ts; the UI.tsx.w54bak copy was quarantined to .audit/w65-d7i-baks/ before deletion",
      "state: bootstrap/state.ts userMsgOptIn with both accessors; state/AppStateStore.ts isBriefOnly with its default; Tool.ts's isBriefOnly render option and UserToolSuccessMessage's pass-through",
      "startup: main.tsx's --tools listing opt-in, the defaultView:'chat' opt-in, --brief, maybeActivateBrief (its guard was `if (!(feature('KAIROS') || feature('KAIROS_BRIEF'))) return`, so the function goes with its callers), and the proactive prompt's briefVisibility ternary",
      "settings/keybindings: the defaultView schema entry, the /config view picker with its userMsgOptIn snapshot and Escape restore, the ctrl+shift+b binding, its action id and its handler (with ctrl+o's stuck-state escape hatch)",
      "readers that named the tool by string: the transcript filters, the resume classifier, the permission-rule alias, the tool-search deferral bypass, and the two todo/task nags that suppressed themselves when it was present",
      "the view: the chat-style 'You' label branch in HighlightedThinkingText with its timestamp formatter, the queue's brief padding (useBriefLayout through QueuedMessageContext), the brief gap/margin rules in PromptInput, the brief-only spinner and idle status, and the two theme keys (briefLabelYou, briefLabelClaude) with their 12 values",
    ],
    tsc: {
      command: "node_modules/.bin/tsc --noEmit --pretty false",
      cwd: root,
      exitCode: 0,
      diagnostics: 0,
      logSha256: digest(tscText),
    },
    validation:
      "Absence sweeps for the flag, the name constants, the opt-in state, the view symbols, the theme keys and the CLI option; the folded arms asserted textually (the spinner signature, the REPL import and deps, UserPromptMessage's JSX, HighlightedThinkingText's props, the queue padding, PromptInput's marginTop, Notifications' unwrapped TokenWarning, Messages' two streaming conditions, the resume classifier's body); import-graph orphan scan shows no new orphan; tsc log empty",
    remaining:
      "the PROACTIVE tick machinery next (feature('PROACTIVE') || feature('KAIROS') across ~15 files: the tick prompt, ScheduleCronTool/SleepTool enablement, sessionStorage's tick handling, the footer's next-tick display, print.ts's tick loop), then the replBridge* AppState leftovers with getRemoteControlAtStartup(), the session-ingress bearer surface, the model-call seams, the ~33 in-place CLI blocks, cli/transports/, and the dependency-pruning pass",
    notes: [
      "the two `file`-command hits for --brief (BashTool/PowerShellTool readOnlyValidation) are GNU file's own flag, not this CLI's option, and stay",
      "three prose comments still name the tool while documenting attachment and meta-message shapes (utils/messages/mappers.ts, utils/imagePaste.ts, utils/messages.ts); inert, kept",
    ],
  }, null, 2) + "\n",
)
console.log("PASS brief surface absent; no code reference to the tool; folded view arms intact; tsc log empty")
