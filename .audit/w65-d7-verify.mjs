import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "b2c553b"
const digest = text => createHash("sha256").update(text).digest("hex")

// Wave D step 7a removed the two analytics transports. Nothing was ported: the
// destination was an inert no-op API, so the checks are absence plus the two
// switch shapes the cut rewrote.
const removed = [
  "services/analytics/datadog.ts",
  "services/analytics/firstPartyEventLoggingExporter.ts",
  "services/analytics/firstPartyEventLogger.ts",
  "services/analytics/sink.ts",
  "services/analytics/sinkKillswitch.ts",
  "hooks/useTimeout.ts",
  "types/generated/events_mono/growthbook/v1/growthbook_experiment_event.ts",
]
for (const p of removed) {
  assert.equal(fs.existsSync(`${root}/${p}`), false, `${p} still present`)
  // each must have existed in the base before this step, so the absence is a
  // deletion and not a typo
  execFileSync("git", ["-C", root, "cat-file", "-e", `${before}:${p}`])
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

// 1. No resolution edge to any removed module. A bare name would also match this
//    cut's own citation comments, so every pattern below is an import or require.
const stub = "(analytics/datadog|analytics/sink|sinkKillswitch|firstPartyEventLogger|firstPartyEventLoggingExporter|useTimeout|growthbook_experiment_event|initializeAnalyticsSink|initializeAnalyticsGates|shutdownDatadog|shutdown1PEventLogging|logGrowthBookExperimentTo1P)"
assert.equal(rg(`from ['"][^'"]*${stub}`), "", "an import edge to a removed module remains")
assert.equal(rg(`require\\(['"][^'"]*${stub}`), "", "a require edge to a removed module remains")

// 2. The 1P predicate now has no declaration and no reader. Its name survives
//    only inside the citation comment growthbook.ts carries, so the sweep
//    requires every remaining mention to be a comment line.
for (const line of rg("is1PEventLoggingEnabled").split("\n").filter(Boolean)) {
  assert.match(line, /:\d+:\s*(\/\/|\*)/, `the 1P predicate is named outside a comment: ${line}`)
}
assert.equal(rg("function is1PEventLoggingEnabled"), "", "the 1P predicate is still declared")

// 3. The two outbound endpoints are named only by the cut's own citations in
//    index.ts. metadata.ts's remaining mention is inside a converter that has no
//    reader (the deferred in-file cleanup), so it is allowed and recorded.
const urls = rg("http-intake\\.logs\\.us5\\.datadoghq\\.com|api/event_logging/batch")
for (const line of urls.split("\n").filter(Boolean)) {
  assert.match(line, /analytics\/(index|metadata)\.ts/, `an endpoint is still named in live code: ${line}`)
}

// 4. index.ts is the inert API: no imports, two no-op bodies, types intact.
const index = fs.readFileSync(`${root}/services/analytics/index.ts`, "utf8")
assert.doesNotMatch(index, /^import /m)
assert.match(index, /export function logEvent\(\n {2}_eventName: string,\n[\s\S]*?\): void \{\}/)
assert.match(index, /export async function logEventAsync\(\n {2}_eventName: string,\n[\s\S]*?\): Promise<void> \{\}/)
assert.match(index, /AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS = never/)

// 5. GrowthBook's switch is the literal the cut wrote, and the exposure site no
//    longer ships anything.
const gb = fs.readFileSync(`${root}/services/analytics/growthbook.ts`, "utf8")
assert.match(gb, /function isGrowthBookEnabled\(\): boolean \{[\s\S]{0,400}?\n {2}return false\n\}/)
assert.doesNotMatch(gb, /logGrowthBookExperimentTo1P/)
// The exposure-log line this fixture used to assert went with the rest of the
// fetch machinery in step 7b, which replaced it with w65-d7b-verify.
assert.doesNotMatch(gb, /logExposureForFeature/)

// 6. The sinks module attaches one sink now.
const sinks = fs.readFileSync(`${root}/utils/sinks.ts`, "utf8")
assert.doesNotMatch(sinks, /initializeAnalyticsSink/)
assert.match(sinks, /initializeErrorLogSink\(\)/)

// 7. The recursion guard's sampler is gone from utils/config.ts.
assert.doesNotMatch(fs.readFileSync(`${root}/utils/config.ts`, "utf8"), /insideGetConfig/)

const tscText = fs.readFileSync(new URL("w65-d7-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

fs.writeFileSync(
  new URL("w65-d7-source-evidence.json", import.meta.url),
  JSON.stringify({
    before,
    kind: "outbound-telemetry removal; destination is an inert no-op API (no ported bodies)",
    evidence: [
      {
        file: "services/analytics/index.ts",
        change: "rewritten as an inert API: the two marker types plus logEvent/logEventAsync as no-ops, so ~230 call sites keep compiling",
        sourceSha256: digest(execFileSync("git", ["-C", root, "show", `${before}:services/analytics/index.ts`], {encoding: "utf8"})),
        portSha256: digest(index),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "services/analytics/growthbook.ts",
        change: "isGrowthBookEnabled() replaced with a literal false carrying the source's own predicate as its citation",
        sourceSha256: digest(execFileSync("git", ["-C", root, "show", `${before}:services/analytics/growthbook.ts`], {encoding: "utf8"})),
        portSha256: digest(gb),
        coordinateUnit: "utf16-half-open",
      },
    ],
    removed: [
      "services/analytics/datadog.ts (307 lines; POSTed to http-intake.logs.us5.datadoghq.com)",
      "services/analytics/firstPartyEventLoggingExporter.ts (820; OpenTelemetry batch exporter to api.anthropic.com/api/event_logging/batch)",
      "services/analytics/firstPartyEventLogger.ts (451), sink.ts (114), sinkKillswitch.ts (25)",
      "hooks/useTimeout.ts (15), orphaned by step 6's preflight deletion",
      "types/generated/events_mono/growthbook/v1/growthbook_experiment_event.ts (224)",
      "host cuts: utils/sinks.ts, main.tsx, entrypoints/init.ts's deferred logger import, utils/gracefulShutdown.ts's racing flush, utils/config.ts's recursion guard",
    ],
    behaviourChange:
      "is1PEventLoggingEnabled() was !isAnalyticsDisabled(), true in a normal run, and GrowthBook's enable switch was that same predicate: the exporter was live and the remote-eval client is now unconstructible, so every dynamic-config read answers with its caller's default.",
    deferred: "services/analytics/metadata.ts's getEventMetadata / buildProcessMetrics / FirstPartyEventLogging* converters now have no reader (its tool-name and skill-name helpers keep live consumers in the tool path)",
    tsc: {
      command: "node_modules/.bin/tsc --noEmit --pretty false",
      cwd: root,
      exitCode: 0,
      diagnostics: 0,
      logSha256: digest(tscText),
    },
    validation:
      "Absence of all seven paths asserted against the base commit; every removed symbol swept as a resolution edge so the cut's own citation comments do not self-match; the two rewritten shapes and the inert API asserted textually; tsc log empty",
  }, null, 2) + "\n",
)
console.log("PASS analytics transports absent; no import edge remains; index.ts inert; growthbook switch literal; tsc log empty")
