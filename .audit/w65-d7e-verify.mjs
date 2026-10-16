import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "11e5a4c"
const digest = text => createHash("sha256").update(text).digest("hex")
const show = p => execFileSync("git", ["-C", root, "show", `${before}:${p}`], {encoding: "utf8"})
const read = p => fs.readFileSync(`${root}/${p}`, "utf8")

// Wave D step 7e removed the GrowthBook warm-up surface: three exports whose
// local effect had gone, and the two call sites that existed to call them.
const gbSrc = show("services/analytics/growthbook.ts")
const gbNow = read("services/analytics/growthbook.ts")
for (const gone of ["initializeGrowthBook", "resetGrowthBook", "refreshGrowthBookAfterAuthChange", "@growthbook/growthbook"]) {
  const re = new RegExp(gone.replace(/[/@.]/g, m => `\\${m}`))
  // The names survive inside this cut's own citation in the file header, so
  // every remaining mention has to be a comment line.
  for (const line of gbNow.split("\n")) {
    if (re.test(line)) assert.match(line, /^\s*(\/\/|\*|\/\*)/, `named outside a comment: ${line.trim()}`)
  }
  assert.match(gbSrc, re, `${gone} was not in the base revision`)
}

// What stays, and why each one stays.
for (const kept of [
  "onGrowthBookRefresh",
  "setGrowthBookConfigOverride",
  "clearGrowthBookConfigOverrides",
  "getGrowthBookConfigOverrides",
  "hasGrowthBookEnvOverride",
  "getFeatureValue_CACHED_MAY_BE_STALE",
  "checkStatsigFeatureGate_CACHED_MAY_BE_STALE",
  "checkSecurityRestrictionGate",
  "getDynamicConfig_BLOCKS_ON_INIT",
  "getDynamicConfig_CACHED_MAY_BE_STALE",
]) {
  assert.match(gbNow, new RegExp(`export (function|async function|const) ${kept}`), `${kept} lost its export`)
}

// The surviving bodies are the source's, word for word.
const surviving = [
  "  return getFeatureValue_DEPRECATED(configName, defaultValue)",
  "  return getFeatureValue_CACHED_MAY_BE_STALE(configName, defaultValue)",
]
for (const s of surviving) {
  assert.ok(gbSrc.includes(s), `not in the base revision: ${s}`)
  assert.ok(gbNow.includes(s), `not carried into the cut: ${s}`)
}

// interactiveHelpers: the trust block keeps its neighbours. The one caller of
// checkGate_CACHED_OR_BLOCKING was inside the dead KAIROS_CHANNELS block, which
// step 7f took together with the function itself, so the import is gone too.
const ihNow = read("interactiveHelpers.tsx")
const ihSrc = show("interactiveHelpers.tsx")
assert.doesNotMatch(ihNow, /resetGrowthBook|initializeGrowthBook/)
assert.match(ihNow, /    setSessionTrustAccepted\(true\)\n\n    \/\/ Now that trust is established/)
assert.match(ihNow, /    void getSystemContext\(\)/)
assert.doesNotMatch(ihNow, /checkGate_CACHED_OR_BLOCKING/)
assert.doesNotMatch(ihNow, /growthbook\.js'/)

// cli/print.ts: the neighbouring profiler calls stay.
const prNow = read("cli/print.ts")
assert.doesNotMatch(prNow, /initializeGrowthBook/)
assert.match(prNow, /  headlessProfilerStartTurn\(\)\n  headlessProfilerCheckpoint\('runHeadless_entry'\)\n/)
assert.match(prNow, /  if \(options\.resumeSessionAt && !options\.resume\) \{/)

// The package is now a zero-importer dependency. This cut's own header citation
// names the three exports, so a hit is only acceptable on a comment line.
try {
  const hits = execFileSync("rg", [
    "-n", "--glob", "!node_modules", "--glob", "!*.w*bak", "--glob", "!*.json", "--glob", "!*.md",
    "-e", "@growthbook/growthbook", "-e", "\\b(initializeGrowthBook|resetGrowthBook|refreshGrowthBookAfterAuthChange)\\b",
    root,
  ], {encoding: "utf8"}).trim()
  for (const line of hits.split("\n").filter(Boolean)) {
    const text = line.replace(/^[^:]+:\d+:/, "").trim()
    assert.match(text, /^(\/\/|\*|\/\*)/, `a live reference remains: ${line}`)
  }
} catch (e) {
  assert.equal(e.status, 1, `rg failed: ${e.message}`)
}

const tscText = fs.readFileSync(new URL("w65-d7e-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

fs.writeFileSync(
  new URL("w65-d7e-source-evidence.json", import.meta.url),
  JSON.stringify({
    before,
    kind: "warm-up surface removal; no ported bodies",
    evidence: [
      {
        file: "services/analytics/growthbook.ts",
        change: "initializeGrowthBook (a null-returning warm-up), resetGrowthBook (cleared a memo of an env-var parse nothing re-read) and refreshGrowthBookAfterAuthChange (emitted a refresh no write could have changed) removed, with the growthbook type import",
        sourceSha256: digest(gbSrc),
        portSha256: digest(gbNow),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "interactiveHelpers.tsx",
        change: "the two warm-up calls removed from the after-trust block, which keeps setSessionTrustAccepted and the getSystemContext prefetch; the KAIROS_CHANNELS dev-channels block kept, so checkGate_CACHED_OR_BLOCKING keeps its one caller",
        sourceSha256: digest(ihSrc),
        portSha256: digest(ihNow),
        coordinateUnit: "utf16-half-open",
      },
    ],
    behaviourChange: "none: every removed export was a no-op under the false switch, and both call sites' effects were on a client that cannot be constructed.",
    dependency: "@growthbook/growthbook now has zero importers. Removing it from package.json belongs to a dependency-pruning pass, not to this package — the lockfile is generated and hand-editing one package out of it is a worse risk than leaving the entry for that pass.",
    next:
      "the KAIROS / KAIROS_CHANNELS cluster (54 files, 124 flag reads), which is the block that holds checkGate_CACHED_OR_BLOCKING's only caller",
    fixtureMove:
      "w65-d7b-verify's guard-brace count moved from 6 to 5 in this commit, as step 7d's record said it would have to.",
    tsc: {
      command: "node_modules/.bin/tsc --noEmit --pretty false",
      cwd: root,
      exitCode: 0,
      diagnostics: 0,
      logSha256: digest(tscText),
    },
    validation:
      "The three removed exports and the package import swept as declarations; the eleven kept exports asserted by declaration; two surviving bodies checked word-for-word; both files' neighbouring lines asserted still present; the residual sweep re-run tree-wide; tsc log empty",
  }, null, 2) + "\n",
)
console.log("PASS warm-up surface gone; eleven exports kept; zero importers for the package; tsc log empty")
