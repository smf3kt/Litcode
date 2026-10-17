import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "d66887e"
const digest = text => createHash("sha256").update(text).digest("hex")

// The interactive auto-update lane rendered a component that polled the
// release bucket every 30 minutes and installed it in place. The whole
// REPL -> PromptInput -> Footer/Notifications prop chain fed only those
// components, so the lane comes out with its props. The update/install
// commands and the updater core stay for the next step.
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

const repl = read("screens/REPL.tsx")
const input = read("components/PromptInput/PromptInput.tsx")
const footer = read("components/PromptInput/PromptInputFooter.tsx")
const notifications = read("components/PromptInput/Notifications.tsx")

// 1. The base carried the lane.
for (const f of [
  "components/AutoUpdater.tsx",
  "components/AutoUpdaterWrapper.tsx",
  "components/NativeAutoUpdater.tsx",
  "components/PackageManagerAutoUpdater.tsx",
  "hooks/useUpdateNotification.ts",
  "hooks/notifs/useInstallMessages.tsx",
]) {
  assert.ok(base(f).length > 0, `base carried ${f}`)
}
assert.ok(base("screens/REPL.tsx").includes("setAutoUpdaterResult"))

// 2. The lane is gone.
for (const f of [
  "components/AutoUpdater.tsx",
  "components/AutoUpdaterWrapper.tsx",
  "components/NativeAutoUpdater.tsx",
  "components/PackageManagerAutoUpdater.tsx",
  "hooks/useUpdateNotification.ts",
  "hooks/notifs/useInstallMessages.tsx",
]) {
  assert.ok(!exists(f), `${f} removed`)
}
assert.equal(
  rg("AutoUpdaterWrapper|autoUpdaterResult|useUpdateNotification|useInstallMessages|onChangeIsUpdating|showSuccessMessage|isAutoUpdating"),
  "",
  "no updater UI residue",
)
assert.doesNotMatch(repl, /autoUpdater/i)
assert.doesNotMatch(input, /autoUpdater/i)
assert.doesNotMatch(footer, /autoUpdater/i)
assert.doesNotMatch(notifications, /AutoUpdater/i)
assert.equal(rg("Installation type: development"), "", "debug example reworded")
assert.doesNotMatch(read("components/PromptInput/PromptInput.tsx"), /initial-check effect/)

// 3. The notification surface the lane sat in stays.
assert.match(notifications, /<NotificationContent/)
assert.match(notifications, /<TokenWarning tokenUsage=\{tokenUsage\} model=\{mainLoopModel\} \/>/)
assert.match(notifications, /<MemoryUsageIndicator \/>/)
assert.match(input, /<Notifications\n/)
assert.match(footer, /<Notifications\n/)
assert.match(repl, /usePluginAutoupdateNotification\(\)/)

// 4. The updater core and commands stay for the next step.
assert.ok(exists("utils/autoUpdater.ts"))
assert.ok(exists("utils/nativeInstaller/installer.ts"))
assert.ok(exists("cli/update.ts"))
assert.ok(exists("commands/install.tsx"))
assert.match(read("utils/nativeInstaller/index.ts"), /installLatest/)

// 5. Nothing was orphaned.
const orphans = execFileSync("node", ["/Users/mant1ssa/Projects/cc_reverse/.audit/w65-orphans.mjs"], {encoding: "utf8"})
assert.match(orphans, /1617 files scanned, 10 with no importer/)

// 6. The gate.
const tscText = fs.readFileSync(new URL("w65-d7w-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const files = ["screens/REPL.tsx", "components/PromptInput/PromptInput.tsx", "components/PromptInput/PromptInputFooter.tsx", "components/PromptInput/Notifications.tsx", "utils/debugFilter.ts"]
const digests = {}
for (const f of files) digests[f] = digest(base(f))

fs.writeFileSync(
  new URL("w65-d7w-source-evidence.json", import.meta.url),
  JSON.stringify(
    {
      before,
      kind: "the background auto-update UI lane removed (no ported bodies; the lane polled the release bucket every 30 minutes)",
      surface:
        "components/AutoUpdater.tsx, AutoUpdaterWrapper.tsx, NativeAutoUpdater.tsx and PackageManagerAutoUpdater.tsx (installation-type detection, the 30-minute check, max-version messages, installGlobalPackage/installLatest calls), hooks/useUpdateNotification.ts (semver-part display helpers) and hooks/notifs/useInstallMessages.tsx (startup install messages), plus the REPL autoUpdaterResult state and the four-layer prop chain through PromptInput, PromptInputFooter and Notifications",
      decisiveFact:
        "the prop chain existed only for these components: REPL held autoUpdaterResult, PromptInput held isAutoUpdating, and Footer/Notifications forwarded all four props straight into AutoUpdaterWrapper. Deleting the components leaves the chain with no consumer, so it comes out with them; the rest of the notification footer (tokens, IDE, memory, token warning, plugin notifications) is independent",
      changes: [
        {
          file: "screens/REPL.tsx",
          change:
            "the autoUpdaterResult state with its notification effect, the useInstallMessages call and the two props passed to PromptInput are removed",
          sourceSha256: digests["screens/REPL.tsx"],
          portSha256: digest(repl),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "components/PromptInput/PromptInput.tsx",
          change:
            "the isAutoUpdating state, the two updater props in the interface and destructure, and both pass-through blocks (footer and notifications) are removed; the comment that named the updater's mount rationale is shortened",
          sourceSha256: digests["components/PromptInput/PromptInput.tsx"],
          portSha256: digest(input),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "components/PromptInput/PromptInputFooter.tsx",
          change: "the four updater props are removed from the interface, the destructure and the Notifications element",
          sourceSha256: digests["components/PromptInput/PromptInputFooter.tsx"],
          portSha256: digest(footer),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "components/PromptInput/Notifications.tsx",
          change:
            "the AutoUpdaterWrapper render, the shouldShowAutoUpdater gate and the four updater props through both component boundaries are removed",
          sourceSha256: digests["components/PromptInput/Notifications.tsx"],
          portSha256: digest(notifications),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/debugFilter.ts",
          change: "the example message no longer names AutoUpdaterWrapper",
          sourceSha256: digests["utils/debugFilter.ts"],
          portSha256: digest(read("utils/debugFilter.ts")),
          coordinateUnit: "utf16-half-open",
        },
      ],
      removed: [
        "the four updater components and the two hooks",
        "the REPL state/effect/useInstallMessages call and the four-prop chain",
        "the two comments naming removed updater components",
      ],
      kept: [
        "the rest of the notification footer (apiKeyStatus, tokens, IDE indicator, memory usage, token warning, plugin notifications)",
        "utils/autoUpdater.ts, utils/nativeInstaller/, cli/update.ts and commands/install.tsx, which the next step removes with the CLI blocks and the config/settings residue",
        "usePluginAutoupdateNotification and the plugin-marketplace update lane, which is a separate (local settings driven) surface",
      ],
      tsc: {
        command: "node_modules/.bin/tsc --noEmit --pretty false",
        cwd: root,
        exitCode: 0,
        diagnostics: 0,
        logSha256: digest(tscText),
      },
      validation:
        "Base-commit checks confirm the six files and the REPL state were present at d66887e; the current tree has no updater UI token and none of the four files; survivor assertions pin the remaining notification surface and the core files the next step owns; the orphan scanner reports the same ten entries over 1617 files (six fewer); tsc clean",
      remaining:
        "the updater core and commands (autoUpdater.ts, nativeInstaller/, cli/update.ts, commands/install.tsx, main.tsx' assertMinVersion and update/install blocks, Doctor diagnostics, config/settings/migrations residue), the dependency-pruning pass, and the utils/filePersistence/ rename",
      notes: [
        "two repair passes: the PromptInput and Footer pass-through blocks interleave debug/isAutoUpdating rather than grouping the updater props, and the Notifications type/destructure pairs occur twice; the cut anchors include the surrounding props, and every touched file was restored from HEAD before each replay",
        "the plugin autoupdate lane is untouched: it updates marketplaces from their configured git sources and is not the CLI release channel",
      ],
    },
    null,
    2,
  ) + "\n",
)
console.log("PASS background update UI lane gone; notification surface and updater core intact; tsc log empty")
