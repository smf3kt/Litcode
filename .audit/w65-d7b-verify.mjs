import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "b2c553b"
const digest = text => createHash("sha256").update(text).digest("hex")
const sourceText = execFileSync("git", ["-C", root, "show", `${before}:services/analytics/growthbook.ts`], {encoding: "utf8"})
const now = fs.readFileSync(`${root}/services/analytics/growthbook.ts`, "utf8")

// Wave D step 7b collapsed the fetch machinery around a switch that is false.
// The bodies that survive were extracted verbatim from the source, so the check
// is two-fold: every collapsed declaration is gone, and every surviving body is
// still findable word-for-word in the revision this step started from.
const collapsed = [
  "GrowthBookUserAttributes",
  "MalformedFeatureDefinition",
  "StoredExperimentData",
  "getGrowthBookClient",
  "getUserAttributes",
  "getApiBaseUrlHost",
  "getAllGrowthBookFeatures",
  "logExposureForFeature",
  "processRemoteEvalPayload",
  "syncRemoteEvalToDisk",
  "refreshGrowthBookFeatures",
  "setupPeriodicGrowthBookRefresh",
  "stopPeriodicGrowthBookRefresh",
  "experimentDataByFeature",
  "remoteEvalFeatureValues",
  "pendingExposures",
  "loggedExposures",
  "reinitializingPromise",
  "clientCreatedWithAuth",
  "GROWTHBOOK_REFRESH_INTERVAL_MS",
  "beforeExitListener",
  "refreshInterval",
]
const declared = collapsed.map(n => `(function|const|let|type|var) ${n}\\b`).join("|")
function rg(pattern, extra = []) {
  try {
    return execFileSync("rg", [
      "-n", "--glob", "!node_modules", "--glob", "!*.json", "--glob", "!*.md", ...extra,
      "-e", pattern, root,
    ], {encoding: "utf8"}).trim()
  } catch (e) {
    assert.equal(e.status, 1, `rg failed: ${e.message}`)
    return ""
  }
}
assert.equal(rg(declared, ["--glob", "!*.w*bak"]), "", "a collapsed declaration is still present")

// each collapsed name must have existed in the base revision, so the absence is
// a collapse and not a typo
for (const name of collapsed) {
  assert.match(sourceText, new RegExp(`(function|const|let|type|var) ${name}\\b`), `${name} was not in the base revision`)
}

// the key module held one export, the SDK client key, and nothing imports it now
assert.equal(fs.existsSync(`${root}/constants/keys.ts`), false, "constants/keys.ts still present")
assert.equal(
  rg("from ['\"][^'\"]*constants/keys"),
  "",
  "an import edge to constants/keys remains",
)

// The switch is the literal, and exactly one emit path is left.
assert.match(now, /function isGrowthBookEnabled\(\): boolean \{[\s\S]{0,400}?\n {2}return false\n\}/)
const emits = (now.match(/refreshed\.emit\(\)/g) ?? []).length
assert.equal(emits, 2, `expected the two override writers to be the emitters, saw ${emits}`)
assert.doesNotMatch(now, /queueMicrotask/, "the refresh catch-up microtask is still present")

// Every read keeps both local override channels ahead of the switch.
const reads = [
  "getFeatureValueInternal",
  "getFeatureValue_CACHED_MAY_BE_STALE",
  "checkStatsigFeatureGate_CACHED_MAY_BE_STALE",
  "checkSecurityRestrictionGate",
]
// Four reads plus hasGrowthBookEnvOverride, which reads the env channel on its own.
// Step 7f removed checkGate_CACHED_OR_BLOCKING (the blocking gate) with the
// channels warm-up that was its only caller, so both counts dropped by one.
assert.equal((now.match(/const overrides = getEnvOverrides\(\)/g) ?? []).length, reads.length + 1)
assert.equal((now.match(/const configOverrides = getConfigOverrides\(\)/g) ?? []).length, reads.length)

// The duplicated return after each guard is what hands the caller its default
// (strict is off, so tsc accepts falling off the end). Two generic reads return
// defaultValue twice each; the three boolean gates return false.
assert.equal((now.match(/return defaultValue/g) ?? []).length, 4)
// Four reads. Step 7e removed refreshGrowthBookAfterAuthChange (the sixth
// guard, no local effect left) and step 7f removed checkGate_CACHED_OR_BLOCKING
// (the blocking gate, whose only caller was the channels warm-up), so the count
// moved 6 → 5 → 4.
assert.equal((now.match(/if \(!isGrowthBookEnabled\(\)\) \{/g) ?? []).length, 4)
// The switch itself, then two per boolean gate for Statsig and security.
assert.equal((now.match(/return false/g) ?? []).length, 5)

// The surviving bodies are the source's, word for word.
const surviving = [
  "void Promise.resolve(listener()).catch(e => {",
  "envOverrides = JSON.parse(raw) as Record<string, unknown>",
  "return overrides !== null && feature in overrides",
  "const { [feature]: _, ...rest } = current",
  "const { growthBookOverrides: _, ...rest } = c",
  "return getFeatureValue_CACHED_MAY_BE_STALE(feature, defaultValue)",
  "return getFeatureValue_DEPRECATED(configName, defaultValue)",
  "return getFeatureValue_CACHED_MAY_BE_STALE(configName, defaultValue)",
]
for (const s of surviving) {
  assert.ok(sourceText.includes(s), `not in the base revision: ${s}`)
  assert.ok(now.includes(s), `not carried into the cut: ${s}`)
}

// The three flag-cache fields lost their last reader.
const config = fs.readFileSync(`${root}/utils/config.ts`, "utf8")
for (const field of ["cachedStatsigGates", "cachedDynamicConfigs", "cachedGrowthBookFeatures"]) {
  assert.doesNotMatch(config, new RegExp(field), `${field} is still declared`)
}
// The first two were this module's readers; cachedDynamicConfigs had already
// lost both its reader and its writer when the Statsig client left, and goes
// with its two siblings rather than staying as the odd one out.
assert.match(sourceText, /config\.cachedStatsigGates/)
assert.match(sourceText, /config\.cachedGrowthBookFeatures/)
assert.doesNotMatch(sourceText, /config\.cachedDynamicConfigs/)
assert.match(config, /growthBookOverrides\?: \{ \[featureName: string\]: unknown \}/)

const tscText = fs.readFileSync(new URL("w65-d7b-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

fs.writeFileSync(
  new URL("w65-d7b-source-evidence.json", import.meta.url),
  JSON.stringify({
    before,
    kind: "collapse to the source's own disabled-switch arm; surviving bodies extracted verbatim",
    evidence: [
      {
        file: "services/analytics/growthbook.ts",
        change:
          "the remote-eval client, its payload transform, the exposure log, the disk cache and the periodic refresh removed; every read keeps the source's local override channels and its !isGrowthBookEnabled() guard",
        sourceSha256: digest(sourceText),
        portSha256: digest(now),
        coordinateUnit: "utf16-half-open",
        sourceBytes: Buffer.byteLength(sourceText),
        portBytes: Buffer.byteLength(now),
      },
      {
        file: "utils/config.ts",
        change: "cachedStatsigGates / cachedDynamicConfigs / cachedGrowthBookFeatures removed; growthBookOverrides kept as the local override channel",
        sourceSha256: digest(execFileSync("git", ["-C", root, "show", `${before}:utils/config.ts`], {encoding: "utf8"})),
        portSha256: digest(config),
        coordinateUnit: "utf16-half-open",
      },
    ],
    removed: [
      "constants/keys.ts (one export, getGrowthBookClientKey, whose only caller was the client construction)",
      "the remote-eval client, processRemoteEvalPayload, syncRemoteEvalToDisk, getUserAttributes, getApiBaseUrlHost, getAllGrowthBookFeatures, the exposure log and its three sets",
      "refreshGrowthBookFeatures, setupPeriodicGrowthBookRefresh, stopPeriodicGrowthBookRefresh, the interval constant and the two named process handlers",
      "two never-called imports in main.tsx (hasGrowthBookEnvOverride, initializeGrowthBook) and two hooks comments that described the removed fetch",
    ],
    behaviourChange:
      "a feature read answered from the disk cache or the remote-eval map when neither a previous process nor this one had a local override; it now answers with the caller's default. The disk cache was deliberately not moved above the source's guard.",
    kept:
      "the env-var and config override channels, onGrowthBookRefresh with its two subscribers, initializeGrowthBook as a null-returning warm-up, and the three zero-caller local override functions (their /config Gates panel left in an earlier wave)",
    next:
      "services/analytics/metadata.ts's getEventMetadata / buildProcessMetrics / FirstPartyEventLogging* converters and utils/user.ts's getUserForGrowthBook + CoreUserData + getCoreUserData are now reader-less — the deferred in-file cleanup",
    tsc: {
      command: "node_modules/.bin/tsc --noEmit --pretty false",
      cwd: root,
      exitCode: 0,
      diagnostics: 0,
      logSha256: digest(tscText),
    },
    validation:
      "Every collapsed declaration swept by declaration form; each surviving body checked word-for-word against the base revision; the emit count and the two override channels counted; the removed config fields checked against the source's own reads; tsc log empty",
  }, null, 2) + "\n",
)
console.log("PASS fetch machinery collapsed; surviving bodies verbatim from the source; one emit path; config fields gone; tsc log empty")
