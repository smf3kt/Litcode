import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "827583f"
const digest = text => createHash("sha256").update(text).digest("hex")

// utils/filePersistence/ held the ported ingress scanner and its output types;
// both were removed with the file-upload lane, leaving only outputsScanner.ts —
// a four-line environment-kind reader whose sole export is getEnvironmentKind.
// The directory name described machinery the module no longer contains, so the
// file moves to utils/environmentKind.ts beside its reader utils/plans.ts.
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

// 1. The base carried the module under the old path.
assert.ok(base("utils/filePersistence/outputsScanner.ts").includes("export function getEnvironmentKind"))
assert.ok(base("utils/plans.ts").includes("from './filePersistence/outputsScanner.js'"))

// 2. The module moved and the old path is gone.
assert.ok(exists("utils/environmentKind.ts"), "module at its new path")
assert.ok(!exists("utils/filePersistence"), "old directory removed")
assert.equal(rg("filePersistence"), "", "no filePersistence residue")
const kind = read("utils/environmentKind.ts")
assert.match(kind, /export function getEnvironmentKind\(\): EnvironmentKind \| null \{/)
assert.match(kind, /if \(kind === 'byoc' \|\| kind === 'anthropic_cloud'\) \{/)
assert.match(kind, /return null/)
assert.match(kind, /import \{ logForDebugging \} from '\.\/debug\.js'/)
assert.match(read("utils/plans.ts"), /import \{ getEnvironmentKind \} from '\.\/environmentKind\.js'/)
assert.match(read("utils/plans.ts"), /if \(getEnvironmentKind\(\) === null\)/)

// 3. The behavior is unchanged: the two remote kinds and the null fallback.
assert.match(kind, /type EnvironmentKind = 'anthropic_cloud' \| 'byoc' \| 'bridge'/)
assert.match(kind, /const kind = process\.env\.CLAUDE_CODE_ENVIRONMENT_KIND/)

// 4. The gates.
const tscText = fs.readFileSync(new URL("w65-d7za-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")
const scan = execFileSync("node", ["/Users/mant1ssa/Projects/cc_reverse/.audit/w65-orphans.mjs"], {encoding: "utf8"})
assert.match(scan, /1607 files scanned, 10 with no importer/)

const sourceDigest = digest(base("utils/filePersistence/outputsScanner.ts"))
const movedDigest = digest(kind)

fs.writeFileSync(
  new URL("w65-d7za-source-evidence.json", import.meta.url),
  JSON.stringify(
    {
      before,
      kind: "the utils/filePersistence/ follow-up rename: the surviving environment-kind reader moves beside its user",
      surface:
        "utils/filePersistence/outputsScanner.ts (getEnvironmentKind over CLAUDE_CODE_ENVIRONMENT_KIND) and the utils/plans.ts import that was its only reader; the now-empty utils/filePersistence/ directory",
      decisiveFact:
        "the directory's other modules — the file-persistence implementation and its types — were removed with the file-upload ingress lane in an earlier step. What survived is a four-line environment-kind reader with no persistence machinery, so the directory name misdescribed it; the module moves unchanged to utils/environmentKind.ts, matching its only export and its source provenance (utils/teleport/environments.ts)",
      changes: [
        {
          file: "utils/plans.ts",
          change: "the import path points at ./environmentKind.js; the two getEnvironmentKind() call sites are untouched",
          sourceSha256: digest(base("utils/plans.ts")),
          portSha256: digest(read("utils/plans.ts")),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/environmentKind.ts",
          change: "the module moves out of utils/filePersistence/ unchanged except its relative debug import and one comment word (the removed scanner); getEnvironmentKind and its union are byte-identical otherwise",
          sourceSha256: sourceDigest,
          portSha256: movedDigest,
          coordinateUnit: "utf16-half-open",
        },
      ],
      removed: [
        "the utils/filePersistence/ directory path (the module itself continues at utils/environmentKind.ts)",
      ],
      kept: [
        "getEnvironmentKind and its EnvironmentKind union, unchanged in behavior",
        "utils/plans.ts's remote-plan recovery and file-snapshot paths, which call it twice",
      ],
      tsc: {
        command: "node_modules/.bin/tsc --noEmit --pretty false",
        cwd: root,
        exitCode: 0,
        diagnostics: 0,
        logSha256: digest(tscText),
      },
      validation:
        "Base checks confirm the module and its import at 827583f; the current tree has the module at the new path with the same union and return arms, the plans.ts import updated and no filePersistence token anywhere; the orphan scan is unchanged at ten entries over 1607 files; tsc clean",
      remaining:
        "the analytics transports",
      notes: [
        "the first tsc run caught the moved module's relative import (../debug.js); it is now ./debug.js",
      ],
    },
    null,
    2,
  ) + "\n",
)
console.log("PASS filePersistence rename complete; environment-kind behavior unchanged; tsc log empty")
