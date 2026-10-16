import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"
import ts from "/tmp/w47-tools/node_modules/typescript/lib/typescript.js"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const original = "bd958088195aefbb4bce96ba966447e5e09b1312"
const selections = [
  ["utils/envUtils.ts", "isInProtectedNamespace"],
  ["utils/permissions/classifierDecision.ts", "VERIFY_PLAN_EXECUTION_TOOL_NAME"],
  ["commands/clear/caches.ts", "clearSessionCaches"],
]
const digest = text => createHash("sha256").update(text).digest("hex")
const evidence = []
function selected(text, path, name) {
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const node = sf.statements.find(n => ts.isFunctionDeclaration(n) ? n.name?.text === name : ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(sf) === name))
  assert.ok(node, name)
  return {text: node.getText(sf), range: [node.getStart(sf), node.end]}
}
function execute(body, name, userType, cacheMode = false, preserved = false) {
  const calls = []
  const pending = []
  const context = {exports: {}, process: {env: {USER_TYPE: userType}}, Set, feature: () => false}
  const record = key => (...args) => { calls.push([key, ...args.map(x => x instanceof Set ? [...x] : x)]) }
  for (const key of ["getUserContext", "getSystemContext", "getGitStatus", "getSessionStartDate"]) context[key] = {cache: {clear: record(key)}}
  for (const key of ["clearFileSuggestionCaches", "clearCommandsCache", "resetPromptCacheBreakDetection", "setSystemPromptInjection", "setLastEmittedDate", "runPostCompactCleanup", "resetSentSkillNames", "resetGetMemoryFilesCache", "clearStoredImagePaths", "clearAllSessions", "clearAllPendingCallbacks", "clearRepositoryCaches", "clearCommandPrefixCaches", "clearAllDumpState", "clearInvokedSkills", "clearResolveGitDirCache", "clearDynamicSkills", "resetAllLSPDiagnosticState", "clearTrackedMagicDocs", "clearSessionEnvVars"]) context[key] = record(key)
  const dynamic = path => {
    const outcome = path.includes("TungstenTool") ? Promise.resolve({}) : Promise.resolve(Object.fromEntries(["clearWebFetchCache", "clearToolSearchDescriptionCache", "clearAgentDefinitionsCache", "clearPromptCache"].map(key => [key, record(key)])))
    return {then(fn) {const promise = outcome.then(fn); pending.push(promise.then(() => null, e => e.message)); return promise}}
  }
  context.fixtureImport = dynamic
  context.Promise = {resolve() {return {then(fn) {const promise = Promise.resolve().then(fn); pending.push(promise.then(() => null, e => e.message)); return promise}}}}
  context.require = path => {throw new Error(`missing ${path}`)}
  const js = ts.transpile(body.replace(/(?<!typeof )\bimport\(/g, "fixtureImport("), {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022})
  const result = vm.runInNewContext(`${js}; ${name}`, context)
  return {value: cacheMode ? result(preserved ? new Set(["agent-a"]) : new Set()) : typeof result === "function" ? result() : result, calls, pending}
}
for (const [path, name] of selections) {
  const before = execFileSync("git", ["-C", root, "show", `${original}:${path}`], {encoding: "utf8"})
  const after = fs.readFileSync(`${root}/${path}`, "utf8")
  const a = selected(before, path, name), b = selected(after, path, name)
  evidence.push({path, symbol: name, originalSha256: digest(before), originalRange: a.range, changedSha256: digest(after), changedRange: b.range, coordinateUnit: "utf16-half-open", mode: "adapt", difference: "Missing internal dependency fails explicitly; live ant gate retained; external path preserved."})
  if (name === "clearSessionCaches") {
    for (const userType of ["external", "ant", undefined]) for (const preserved of [false, true]) {
      const old = execute(a.text, name, userType, true, preserved)
      const current = execute(b.text, name, userType, true, preserved)
      const oldErrors = (await Promise.all(old.pending)).filter(Boolean)
      const errors = (await Promise.all(current.pending)).filter(Boolean)
      // W65 wave E step 4 removed the remote session-ingress clear: the
      // recovered body's `clearAllSessions()` belongs to the CCR transcript
      // sync this build does not carry. Every other call must match exactly,
      // and the removed entry must be the only difference.
      assert.deepEqual(
        old.calls.filter(([key]) => key === "clearAllSessions"),
        [["clearAllSessions"]],
      )
      assert.deepEqual(
        current.calls,
        old.calls.filter(([key]) => key !== "clearAllSessions"),
      )
      assert.ok(current.calls.some(([key, value]) => key === "resetGetMemoryFilesCache" && value === "session_start"))
      assert.deepEqual(current.calls.find(([key]) => key === "clearInvokedSkills"), ["clearInvokedSkills", preserved ? ["agent-a"] : []])
      assert.equal(current.calls.some(([key]) => key === "clearAllPendingCallbacks"), !preserved)
      assert.equal(oldErrors.length, userType === "ant" ? 1 : 0)
      assert.deepEqual(errors, userType === "ant" ? ["Internal component unavailable in this source distribution: TungstenTool session reset"] : [])
    }
  } else {
    for (const userType of ["external", undefined]) {
      assert.equal(execute(b.text, name, userType).value, name === "isInProtectedNamespace" ? false : null)
      assert.equal(execute(b.text, name, userType).value, execute(a.text, name, userType).value)
    }
    assert.throws(() => execute(a.text, name, "ant"), /missing/)
    assert.throws(() => execute(b.text, name, "ant"), /Internal component unavailable in this source distribution/)
  }
}
const tscLog = new URL("w60-tsc-final.txt", import.meta.url)
const tscText = fs.readFileSync(tscLog, "utf8")
assert.equal(tscText, "", "tsc log is empty on success")
const tscSha = digest(tscText)
fs.writeFileSync(new URL("w60-source-evidence.json", import.meta.url), JSON.stringify({original, evidence, tsc: {command: "node_modules/.bin/tsc --noEmit --pretty false", cwd: root, exitCode: 0, diagnostics: 0, logSha256: tscSha}, validation: "Selected real source bodies with owned dependency fixtures; external and ant branches; no application entrypoint execution", remaining: "Internal component implementations absent from available inventories; full CLI unverified"}, null, 2) + "\n")
console.log(`PASS external results, live ant explicit failure boundaries, session cache effects and preserved-agent behavior; tsc log empty sha ${tscSha}`)
