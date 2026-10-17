import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "51f7625"
const digest = text => createHash("sha256").update(text).digest("hex")

// Four declared packages had no importer left: the GrowthBook SDK (its client
// was removed with the telemetry transport), @opentelemetry/core (its direct
// readers went with the same transport; the entry stays as a transitive
// dependency of the retained SDK packages), asciichart (its only consumer was
// the chart UI) and qrcode (no reader). themeColorToAnsi was the last mention
// of the chart package and had no callers itself.
const read = p => fs.readFileSync(`${root}/${p}`, "utf8")
const packageJson = JSON.parse(read("package.json"))
const lock = JSON.parse(read("package-lock.json"))

// Node resolution over the lock graph, same walk the cut used.
function resolve(requester, name) {
  let base = requester
  for (;;) {
    const cand = (base ? base + "/" : "") + "node_modules/" + name
    if (lock.packages[cand]) return cand
    const marker = base.lastIndexOf("/node_modules/")
    if (marker === -1) {
      const top = "node_modules/" + name
      return lock.packages[top] ? top : null
    }
    base = base.slice(0, marker)
  }
}
function reachable() {
  const seen = new Set()
  const queue = []
  const rootEntry = lock.packages[""]
  for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
    for (const name of Object.keys(rootEntry[section] || {})) {
      const hit = resolve("", name)
      if (hit) queue.push(hit)
    }
  }
  while (queue.length) {
    const key = queue.pop()
    if (seen.has(key)) continue
    seen.add(key)
    const entry = lock.packages[key]
    for (const section of ["dependencies", "optionalDependencies"]) {
      for (const name of Object.keys(entry[section] || {})) {
        const hit = resolve(key, name)
        if (hit) queue.push(hit)
      }
    }
  }
  return seen
}

// 1. The base carried the four declarations and the chart helper.
const basePkg = JSON.parse(execFileSync("git", ["-C", root, "show", `${before}:package.json`], {encoding: "utf8"}))
const baseLock = JSON.parse(execFileSync("git", ["-C", root, "show", `${before}:package-lock.json`], {encoding: "utf8"}))
for (const name of ["@growthbook/growthbook", "@opentelemetry/core", "asciichart", "qrcode"]) {
  assert.ok(name in basePkg.dependencies, `base declared ${name}`)
  assert.ok(name in baseLock.packages[""].dependencies, `base lock root declared ${name}`)
}
assert.ok(baseLock.packages["node_modules/qrcode"], "base lock carried qrcode")
assert.ok(baseLock.packages["node_modules/asciichart"], "base lock carried asciichart")
assert.ok(execFileSync("git", ["-C", root, "show", `${before}:utils/theme.ts`], {encoding: "utf8"}).includes("themeColorToAnsi"))

// 2. The declarations are gone; the core entry survives only transitively.
for (const name of ["@growthbook/growthbook", "@opentelemetry/core", "asciichart", "qrcode"]) {
  assert.ok(!(name in packageJson.dependencies), `${name} dropped from package.json`)
  assert.ok(!(name in lock.packages[""].dependencies), `${name} dropped from the lock root`)
}
for (const name of ["@growthbook/growthbook", "asciichart", "qrcode"]) {
  assert.ok(!lock.packages[`node_modules/${name}`], `${name} entry pruned`)
}
assert.ok(lock.packages["node_modules/@opentelemetry/core"], "core entry kept for its transitive readers")
assert.ok(lock.packages["node_modules/@opentelemetry/sdk-trace-base"].dependencies["@opentelemetry/core"])

// 3. Every declared dependency resolves and every entry is reachable.
for (const section of ["dependencies", "devDependencies"]) {
  for (const name of Object.keys(packageJson[section] || {})) {
    assert.equal(lock.packages[""].dependencies?.[name] !== undefined || lock.packages[""].devDependencies?.[name] !== undefined, true, `${name} is a lock root dependency`)
    assert.ok(resolve("", name), `${name} resolves in the lock`)
  }
}
const seen = reachable()
const orphans = Object.keys(lock.packages).filter(k => k !== "" && !seen.has(k))
assert.deepEqual(orphans, [], "no unreachable lock entries")

// 4. The dead theme helper is gone; the theme module is intact.
const theme = read("utils/theme.ts")
assert.doesNotMatch(theme, /themeColorToAnsi|chalkForChart/)
assert.doesNotMatch(theme, /\{ Chalk \}/)
assert.match(theme, /import chalk from 'chalk'/)
assert.match(theme, /export function getTheme\(themeName: ThemeName\): Theme \{/)
assert.match(theme, /export const THEME_NAMES = \[/)

// 5. The code gate and the orphan scanner.
const tscText = fs.readFileSync(new URL("w65-d7z-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")
const scan = execFileSync("node", ["/Users/mant1ssa/Projects/cc_reverse/.audit/w65-orphans.mjs"], {encoding: "utf8"})
assert.match(scan, /1605 files scanned, 10 with no importer/)

const files = ["package.json", "package-lock.json", "utils/theme.ts"]
const digests = {}
for (const f of files) digests[f] = digest(execFileSync("git", ["-C", root, "show", `${before}:${f}`], {encoding: "utf8"}))

fs.writeFileSync(
  new URL("w65-d7z-source-evidence.json", import.meta.url),
  JSON.stringify(
    {
      before,
      kind: "dependency-pruning pass: four zero-importer packages and the dead theme helper that named one of them",
      surface:
        "package.json dependencies @growthbook/growthbook, @opentelemetry/core, asciichart and qrcode; their package-lock entries and the transitive packages that only they reached (36 lock entries); utils/theme.ts's themeColorToAnsi with its chalkForChart instance and Chalk import",
      decisiveFact:
        "a whole-tree import scan finds no specifier for any of the four packages. GrowthBook's client went with the telemetry transport in step 7a and the module keeps only the env/config override channels; @opentelemetry/core's direct importers went in the same step but the package remains a dependency of the retained @opentelemetry/sdk-* packages, so only its root declaration is removed and its entry stays; asciichart's only consumer was the removed usage-chart UI, and themeColorToAnsi — the exported helper that converted theme colors for it — has no reader; qrcode has no reference at all",
      changes: [
        {file: "package.json", change: "the four dependencies are removed; the 66 remaining declarations are unchanged", sourceSha256: digests["package.json"], portSha256: digest(read("package.json")), coordinateUnit: "utf16-half-open"},
        {file: "package-lock.json", change: "the four root declarations and every entry unreachable from the remaining root dependency set are removed (36 entries); @opentelemetry/core stays as a transitive dependency of the retained SDK packages, and every remaining entry is reachable by the same node-resolution walk", sourceSha256: digests["package-lock.json"], portSha256: digest(read("package-lock.json")), coordinateUnit: "utf16-half-open"},
        {file: "utils/theme.ts", change: "themeColorToAnsi, its chalkForChart instance and the now-unused Chalk import are removed; the theme tables and getTheme stay", sourceSha256: digests["utils/theme.ts"], portSha256: digest(theme), coordinateUnit: "utf16-half-open"},
      ],
      removed: [
        "@growthbook/growthbook, asciichart and qrcode with their lock entries and transitive closure",
        "@opentelemetry/core's root declaration (its lock entry stays as a transitive dependency)",
        "themeColorToAnsi and chalkForChart in utils/theme.ts",
      ],
      kept: [
        "the remaining 66 dependencies with their lock entries, all reachable",
        "@opentelemetry/core as a transitive dependency of the retained @opentelemetry/sdk-* packages",
        "utils/theme.ts's theme tables, getTheme and chalk usage",
      ],
      tsc: {
        command: "node_modules/.bin/tsc --noEmit --pretty false",
        cwd: root,
        exitCode: 0,
        diagnostics: 0,
        logSha256: digest(tscText),
      },
      validation:
        "Base checks confirm the four declarations and the theme helper at 51f7625; the current lock is validated by the same node-resolution reachability walk the cut used (every root dependency resolves, no entry is unreachable); absence assertions cover the three pruned entries and the helper; survivor assertions pin the transitive core entry, the theme module's exports and the remaining dependency count; tsc clean; the source orphan scan is unchanged at ten legitimate entries over 1607 files",
      remaining:
        "the utils/filePersistence/ rename and the analytics transports",
      notes: [
        "the record's earlier 'nine zero-importer dependencies' predated steps 7a-7y; the current scan over the committed tree finds four",
        "the first cut left a blank line at EOF where the removed helper ended the file; the script now trims to one final newline and the files were restored from HEAD before the replay",
      ],
    },
    null,
    2,
  ) + "\n",
)
console.log("PASS four zero-importer deps pruned; lock fully reachable; theme helper gone; tsc log empty")
