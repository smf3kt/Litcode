import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "5b50aac"
const digest = text => createHash("sha256").update(text).digest("hex")

// This wave ports nothing: it is a dead-flag cluster behind feature('VOICE_MODE'),
// so the check that matters is that the branch and its fallback collapsed to the
// fallback everywhere the flag was read.
for (const gone of [
  "voice",
  "services/voiceStreamSTT.ts",
  "services/voice.ts",
  "services/voiceKeyterms.ts",
  "hooks/useVoice.ts",
  "hooks/useVoiceEnabled.ts",
  "hooks/useVoiceIntegration.tsx",
  "context/voice.tsx",
  "components/PromptInput/VoiceIndicator.tsx",
  "components/LogoV2/VoiceModeNotice.tsx",
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

// 1. Nothing anywhere still reads the flag. Comments naming it are the cut's
//    own citations, so the sweep looks for the call.
assert.equal(rg("feature\\('VOICE_MODE'\\)"), "", "a VOICE_MODE read remains")

// 2. Nothing names a removed symbol or path as an import edge.
for (const pattern of [
  "from ['\"][^'\"]*(voiceStreamSTT|/voice\\.js|voiceKeyterms|voiceModeEnabled|context/voice|useVoiceEnabled|useVoiceIntegration|VoiceIndicator|VoiceModeNotice)",
  "require\\(['\"][^'\"]*(voiceStreamSTT|/voice\\.js|voiceKeyterms|voiceModeEnabled|context/voice|useVoiceEnabled|useVoiceIntegration|VoiceIndicator|VoiceModeNotice)",
  "voice:pushToTalk",
  "hidePlaceholderText",
  "voiceFooterHintSeenCount|voiceNoticeSeenCount|voiceLangHintShownCount|voiceLangHintLastLanguage",
  "insertTextRef|voiceInterimRange",
  "claude_cli_feedback",
]) {
  assert.equal(rg(pattern), "", `live reference remains for ${pattern}`)
}

// 3. The one user-visible string that claimed a dictation use is gone from both
//    registries.
assert.equal(rg("voice dictation"), "", "the language setting still advertises dictation")

// 4. The external-build shapes the flag used to select are the only ones left:
//    TextInput's invert has two arms and no waveform tables, and the REPL mounts
//    no keybinding handler for a hook that no longer exists.
const textInput = fs.readFileSync(`${root}/components/TextInput.tsx`, "utf8")
assert.doesNotMatch(textInput, /BARS|LEVEL_BOOST|SILENCE_THRESHOLD|CURSOR_WAVEFORM_WIDTH|SMOOTH/)
assert.match(textInput, /const animRef = \(\) => \{\}/)
assert.match(textInput, /const invert: \(text: string\) => string = canShowCursor/)
const placeholder = fs.readFileSync(`${root}/hooks/renderPlaceholder.ts`, "utf8")
assert.doesNotMatch(placeholder, /hidePlaceholderText/)

const tscText = fs.readFileSync(new URL("w65-d5-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

fs.writeFileSync(
  new URL("w65-d5-source-evidence.json", import.meta.url),
  JSON.stringify({
    before,
    kind: "dead-flag cluster removal (no ported bodies)",
    evidence: [
      {
        file: "components/TextInput.tsx",
        change: "the voice-waveform cursor branch removed, leaving the source's own two-arm invert; the animation ref keeps the external-build value [() => {}, 0] destructured",
        sourceSha256: digest(execFileSync("git", ["-C", root, "show", `${before}:components/TextInput.tsx`], {encoding: "utf8"})),
        portSha256: digest(textInput),
        coordinateUnit: "utf16-half-open",
      },
    ],
    removed: [
      "voice/ (1 file), services/voiceStreamSTT.ts (544 lines), services/voice.ts (525), services/voiceKeyterms.ts (106)",
      "hooks/useVoice.ts (1,144), hooks/useVoiceEnabled.ts, hooks/useVoiceIntegration.tsx, context/voice.tsx",
      "components/PromptInput/VoiceIndicator.tsx, components/LogoV2/VoiceModeNotice.tsx",
      "11 hosts: the AppState provider passthrough, the push-to-talk binding and its validator branch, both setting registries, the ConfigTool pre-flight and kill-switch checks, the REPL mounts, the Notifications indicator, the footer warmup/hold hints, TextInput's waveform, and four voice config counters",
    ],
    tsc: {
      command: "node_modules/.bin/tsc --noEmit --pretty false",
      cwd: root,
      exitCode: 0,
      diagnostics: 0,
      logSha256: digest(tscText),
    },
    validation:
      "Absence sweeps for the flag, the module paths and the removed symbols; the surviving external-build shapes asserted textually; tsc log empty",
    remaining:
      "the model-call seams (services/api/client, claude, errors, withRetry, utils/http.ts, utils/betas.ts), utils/fastMode.ts, the subscription predicates, the replBridge* AppState leftovers, the session-ingress bearer surface, cli/transports/, in-place CLI blocks, the analytics decision",
  }, null, 2) + "\n",
)
console.log("PASS voice cluster absent; no VOICE_MODE read; no live reference to 7 removed surfaces; tsc log empty")
