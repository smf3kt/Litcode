import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "2823ec8"
const digest = text => createHash("sha256").update(text).digest("hex")

// The transports went in step 7a; what remained were two payload builders that
// gathered local state only to hand it to the no-op logEvent, the analytics
// gate whose only readers they were, and the gh-CLI probe that existed solely
// for the startup payload. Removing them closes the analytics transport
// surface; the no-op logEvent/logEventAsync API stays by the step-7a decision
// so the remaining ~190 call sites keep compiling.
const read = p => fs.readFileSync(`${root}/${p}`, "utf8")
const exists = p => fs.existsSync(`${root}/${p}`)
const base = p => execFileSync("git", ["-C", root, "show", `${before}:${p}`], {encoding: "utf8"})
function rg(pattern) {
  try {
    return execFileSync("rg", [
      "-n", "--glob", "!node_modules", "--glob", "!*.json", "--glob", "!*.md",
      "-e", pattern, root,
    ], {encoding: "utf8"}).trim()
  } catch (e) {
    assert.equal(e.status, 1, `rg failed: ${e.message}`)
    return ""
  }
}

// 1. The base carried both payload builders, the gate and the gh probe.
assert.ok(base("main.tsx").includes("async function logStartupTelemetry(): Promise<void> {"))
assert.ok(base("main.tsx").includes("function getCertEnvVarTelemetry()"))
assert.ok(base("main.tsx").includes("void logContextMetrics(regularMcpConfigs, toolPermissionContext)"))
assert.ok(base("utils/api.ts").includes("export async function logContextMetrics("))
assert.ok(base("services/analytics/config.ts").includes("export function isAnalyticsDisabled()"))
assert.ok(base("utils/github/ghAuthStatus.ts").includes("export async function getGhAuthStatus()"))

// 2. The payload builders, the gate and the probe are gone.
assert.equal(
  rg("isAnalyticsDisabled|logStartupTelemetry|logContextMetrics|getCertEnvVarTelemetry|getGhAuthStatus|ghAuthStatus\\.js|analytics/config\\.js"),
  "",
  "no analytics-computation residue",
)
assert.ok(!exists("services/analytics/config.ts"), "analytics config removed")
assert.ok(!exists("utils/github/ghAuthStatus.ts"), "gh auth probe removed")
assert.doesNotMatch(read("main.tsx"), /tengu_startup_telemetry/)
assert.doesNotMatch(read("utils/api.ts"), /tengu_context_size/)

// 3. The no-op contract and its call sites stay by the recorded decision.
const index = read("services/analytics/index.ts")
assert.match(index, /export function logEvent\(/)
assert.match(index, /_metadata: LogEventMetadata,\n\): void \{\}/)
assert.match(index, /export async function logEventAsync\(/)
assert.match(read("utils/api.ts"), /logEvent\('tengu_bash_tool_simple_echo', \{\}\)/)
const callers = execFileSync("rg", ["-l", "logEvent\\(", "--glob", "!node_modules", root], {encoding: "utf8"}).trim().split("\n")
assert.ok(callers.length > 150, `the call-site contract remains (${callers.length} files)`)

// 4. No outbound telemetry path is left.
assert.equal(rg("firstPartyEventLogger|services/analytics/datadog|analytics/datadog\\.js"), "", "no analytics transport module")
for (const f of ["index.ts", "growthbook.ts", "metadata.ts"]) {
  assert.doesNotMatch(read(`services/analytics/${f}`), /\bfetch\(|axios|undici|opentelemetry/, `${f} makes no outbound call`)
}

// 5. The gates and the orphan scanner.
const tscText = fs.readFileSync(new URL("w65-d7zb-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")
const scan = execFileSync("node", ["/Users/mant1ssa/Projects/cc_reverse/.audit/w65-orphans.mjs"], {encoding: "utf8"})
assert.match(scan, /1605 files scanned, 10 with no importer/)

const files = ["main.tsx", "utils/api.ts"]
const digests = {}
for (const f of files) digests[f] = digest(base(f))

fs.writeFileSync(
  new URL("w65-d7zb-source-evidence.json", import.meta.url),
  JSON.stringify(
    {
      before,
      kind: "final analytics cleanup: the two payload builders, the analytics gate and the gh probe that existed only for them",
      surface:
        "main.tsx's logStartupTelemetry (getIsGit/getWorktreeCount/getGhAuthStatus, sandbox flags, reduced motion, cert-env flags) with getCertEnvVarTelemetry and hasNodeOption, its logContextMetrics import and call; utils/api.ts's logContextMetrics (MCP prefetch, tool enumeration, user/system context, ripgrep file count, token estimation) with its imports; services/analytics/config.ts's isAnalyticsDisabled and utils/github/ghAuthStatus.ts",
      decisiveFact:
        "with the transports removed in step 7a, logEvent/logEventAsync are empty functions. These two helpers exist only to gather local state and hand it to those empty calls, so their entire body is dead work — logContextMetrics even ran an MCP prefetch and a ripgrep scan on every session. isAnalyticsDisabled's only two readers were these helpers, and getGhAuthStatus's only caller was logStartupTelemetry, so the gate and the probe close with them",
      changes: [
        {
          file: "main.tsx",
          change:
            "logStartupTelemetry, getCertEnvVarTelemetry and the hasNodeOption/getIsGit/getWorktreeCount/getGhAuthStatus imports are removed, along with the deferred call, the logContextMetrics import and its initialization call",
          sourceSha256: digests["main.tsx"],
          portSha256: digest(read("main.tsx")),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/api.ts",
          change:
            "logContextMetrics and the imports that served only it (context, MCP prefetch, tools, ignore patterns, ripgrep, tool types, token estimation, analytics gate) are removed; the function's neighbors and the remaining logEvent calls are untouched",
          sourceSha256: digests["utils/api.ts"],
          portSha256: digest(read("utils/api.ts")),
          coordinateUnit: "utf16-half-open",
        },
      ],
      removed: [
        "main.tsx's logStartupTelemetry and getCertEnvVarTelemetry with their call sites",
        "utils/api.ts's logContextMetrics with its import set",
        "services/analytics/config.ts (isAnalyticsDisabled, readerless after the two helpers)",
        "utils/github/ghAuthStatus.ts (its only caller was the startup payload)",
      ],
      kept: [
        "services/analytics/index.ts's no-op logEvent/logEventAsync and the ~190 files that call them, per the step-7a decision",
        "services/analytics/growthbook.ts's local env/config override channels",
        "services/analytics/metadata.ts's PII-redaction surface used by the tool path",
        "logSessionTelemetry and the other startup helpers that still have local effects or readers",
      ],
      tsc: {
        command: "node_modules/.bin/tsc --noEmit --pretty false",
        cwd: root,
        exitCode: 0,
        diagnostics: 0,
        logSha256: digest(tscText),
      },
      validation:
        "Base checks confirm both builders, the gate and the probe at 2823ec8; whole-tree sweeps find no residue identifier and no telemetry endpoint; survivor assertions pin the no-op API, its call-site count and the remaining analytics modules; the orphan scan stays at ten legitimate entries over 1605 files; tsc clean",
      remaining:
        "none under the 2026-10-16 local-only directive",
      notes: [
        "the first replay exposed a new orphan, utils/github/ghAuthStatus.ts, which existed only for the removed startup payload; it is deleted with its directory",
        "two imports lost their last reader with the functions (hasNodeOption, roughTokenCountEstimation) and were removed in the same pass",
      ],
    },
    null,
    2,
  ) + "\n",
)
console.log("PASS analytics payload builders gone; no-op contract and local analytics modules intact; tsc log empty")
