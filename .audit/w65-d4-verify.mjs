import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"
import ts from "/tmp/w47-tools/node_modules/typescript/lib/typescript.js"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "1bc1bc0"
const digest = text => createHash("sha256").update(text).digest("hex")

function declared(text, path, name) {
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const node = sf.statements.find(n =>
    ts.isFunctionDeclaration(n)
      ? n.name?.text === name
      : ts.isVariableStatement(n) &&
        n.declarationList.declarations.some(d => d.name.getText(sf) === name))
  assert.ok(node, `${path}:${name}`)
  return {text: node.getText(sf), range: [node.getStart(sf), node.end]}
}

function run(body, name, scope) {
  const context = {exports: {}, ...scope}
  const js = ts.transpile(body, {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022})
  return vm.runInNewContext(`${js}; ${name}`, context)
}

const evidence = []

// 1. The digit validator, lifted out of the survey it belonged to. The accepted
//    set is the adaptation: the source's ['0','1','2','3'] cannot stand in a
//    two-option survey, so the port takes the host's own VALID_INPUTS.
{
  const sourcePath = "components/FeedbackSurvey/FeedbackSurveyView.tsx"
  const portPath = "components/SkillImprovementSurvey.tsx"
  const recovered = execFileSync("git", ["-C", root, "show", `${before}:${sourcePath}`], {
    encoding: "utf8",
  })
  const portText = fs.readFileSync(`${root}/${portPath}`, "utf8")

  const sourceBody =
    declared(recovered, sourcePath, "RESPONSE_INPUTS").text +
    "\n" +
    declared(recovered, sourcePath, "isValidResponseInput").text
  const portBody =
    declared(portText, portPath, "VALID_INPUTS").text +
    "\n" +
    declared(portText, portPath, "isValidResponseInput").text

  const oldFn = run(sourceBody, "isValidResponseInput", {})
  const newFn = run(portBody, "isValidResponseInput", {})
  const probes = ["0", "1", "2", "3", "x", ""]
  const oldResults = probes.map(p => oldFn(p))
  const newResults = probes.map(p => newFn(p))

  assert.deepEqual(
    oldResults,
    [true, true, true, true, false, false],
    "recovered validator no longer accepts 0-3",
  )
  assert.deepEqual(
    newResults,
    [true, true, false, false, false, false],
    "ported validator must accept exactly the host survey's two digits",
  )

  evidence.push({
    port: portPath,
    symbol: "isValidResponseInput",
    source: sourcePath,
    sourceSha256: digest(recovered),
    sourceRange: declared(recovered, sourcePath, "isValidResponseInput").range,
    portSha256: digest(portText),
    portRange: declared(portText, portPath, "isValidResponseInput").range,
    coordinateUnit: "utf16-half-open",
    mode: "adapt",
    difference:
      "accepted set narrowed from the source's ['0','1','2','3'] to the host survey's ['0','1']; body otherwise identical",
    probes: probes.length,
  })
}

// 2. The response vocabulary. The deleted module was a reconstruction stub
//    (`FeedbackSurveyResponse = any`), so there is no source body to port; the
//    rehomed union is read off this host's two live users instead, and the check
//    is that the literals actually reach the hook.
{
  const hook = fs.readFileSync(`${root}/hooks/useSkillImprovementSurvey.ts`, "utf8")
  const view = fs.readFileSync(`${root}/components/SkillImprovementSurvey.tsx`, "utf8")
  const domain = fs.readFileSync(`${root}/utils/hooks/skillImprovement.ts`, "utf8")
  assert.match(domain, /export type SkillSurveyResponse = 'good' \| 'dismissed'/)
  assert.match(hook, /selected !== 'dismissed'/, "hook must test the dismissed literal")
  assert.match(view, /onSelect\(lastChar === '1' \? 'good' : 'dismissed'\)/)
  evidence.push({
    port: "utils/hooks/skillImprovement.ts",
    symbol: "SkillSurveyResponse",
    source: "components/FeedbackSurvey/utils.ts (reconstruction stub, no body)",
    coordinateUnit: "utf16-half-open",
    mode: "adapt",
    difference:
      "declared from the host's own two users because the recovered stub is `any`; same declaration class as the wave D step 2 OAuthTokens case",
    probes: 2,
  })
}

// 3. Absence, and no live reference to anything removed.
for (const gone of [
  "components/FeedbackSurvey",
  "utils/autoRunIssue.tsx",
  "components/Feedback.tsx",
  "hooks/useDynamicConfig.ts",
]) {
  assert.equal(fs.existsSync(`${root}/${gone}`), false, `${gone} still present`)
}
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
for (const pattern of [
  // The two rehoming sites cite the deleted path in a comment, so the sweep
  // looks for a resolution edge rather than the bare string.
  "(from|require\\(|import\\()\\s*['\"][^'\"]*FeedbackSurvey/",
  "from ['\"][^'\"]*autoRunIssue",
  "useFeedbackSurvey",
  "useMemorySurvey",
  "usePostCompactSurvey",
  "useFrustrationDetection",
  "submitTranscriptShare",
  "isFeedbackSurveyDisabled",
  "feedbackSurveyState",
  "transcriptShareDismissed",
  "claude_cli_feedback",
  "useDynamicConfig",
]) {
  assert.equal(rg(pattern), "", `live reference remains for ${pattern}`)
}

const tscText = fs.readFileSync(new URL("w65-d4-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")
fs.writeFileSync(
  new URL("w65-d4-source-evidence.json", import.meta.url),
  JSON.stringify({
    before,
    evidence,
    removed: [
      "components/FeedbackSurvey/ (10 files, 1,538 lines)",
      "utils/autoRunIssue.tsx",
      "components/Feedback.tsx (758 lines, /feedback screen)",
      "hooks/useDynamicConfig.ts",
      "isFeedbackSurveyDisabled, feedbackSurveyState, transcriptShareDismissed",
      "the REPL survey wiring: four hook calls, the survey JSX chain, the auto-run-/issue chain",
    ],
    tsc: {
      command: "node_modules/.bin/tsc --noEmit --pretty false",
      cwd: root,
      exitCode: 0,
      diagnostics: 0,
      logSha256: digest(tscText),
    },
    validation:
      "The one rehomed body is compared against the recovered source over digit probes with the narrowing recorded as an explicit difference; absence and no-live-reference sweeps bound the removal",
    remaining:
      "the voice cluster, the model-call seams (services/api/*, utils/http.ts), utils/fastMode.ts, the session-ingress bearer surface, the ~33 in-place CLI blocks",
  }, null, 2) + "\n",
)
console.log(
  `PASS 1 port matches recovered body with a recorded adaptation; 12 removed names absent; tsc log empty`,
)
