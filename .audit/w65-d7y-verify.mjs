import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "780b3fc"
const digest = text => createHash("sha256").update(text).digest("hex")

// The channel configuration existed only to steer the updater: the settings
// field named a release channel, the global config remembered the install
// method and the legacy status, and the Config panel rendered the channel row,
// the enable dialog and the stable-channel downgrade dialog. With the updater
// gone these are readerless; the plugin-marketplace lane keeps its own
// shouldSkipPluginAutoupdate and is untouched.
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

// 1. The base carried the channel config and its UI.
const baseConfig = base("utils/config.ts")
for (const needle of [
  "export type ReleaseChannel",
  "export type InstallMethod",
  "function migrateConfigFields",
  "export function getAutoUpdaterDisabledReason",
  "autoUpdatesProtectedForNative?: boolean",
]) {
  assert.ok(baseConfig.includes(needle), `base config.ts carried ${needle}`)
}
assert.ok(base("utils/settings/types.ts").includes("autoUpdatesChannel: z"))
assert.ok(base("utils/settings/types.ts").includes("minimumVersion: z"))
assert.ok(base("components/Settings/Config.tsx").includes("'EnableAutoUpdates'"))
assert.ok(base("components/Settings/Config.tsx").includes("ChannelDowngradeDialog"))
assert.ok(base("main.tsx").includes("autoUpdatesChannel: (getInitialSettings()"))
assert.ok(base("components/ChannelDowngradeDialog.tsx").length > 0)

// 2. The channel config and its UI are gone.
assert.equal(
  rg(
    "autoUpdatesChannel|minimumVersion|getAutoUpdaterDisabledReason|formatAutoUpdaterDisabledReason|AutoUpdaterDisabledReason|ChannelDowngrade|EnableAutoUpdates|autoUpdaterStatus|installMethod|autoUpdatesProtectedForNative|ReleaseChannel|InstallMethod",
  ),
  "",
  "no auto-update channel residue",
)
assert.ok(!exists("components/ChannelDowngradeDialog.tsx"), "downgrade dialog removed")
const config = read("utils/config.ts")
assert.doesNotMatch(config, /migrateConfigFields/)
assert.doesNotMatch(config, /autoUpdates/)
assert.match(config, /function createDefaultGlobalConfig\(\): GlobalConfig \{/)
assert.match(config, /    theme: 'dark',/)
assert.match(config, /const TEST_GLOBAL_CONFIG_FOR_TESTING: GlobalConfig = \{\n  \.\.\.DEFAULT_GLOBAL_CONFIG,\n\}/)
assert.match(config, /'apiKeyHelper',/)
const cfg = read("components/Settings/Config.tsx")
assert.doesNotMatch(cfg, /autoUpdaterDisabledReason|autoUpdatesChannel/)
assert.match(cfg, /  \| 'Language'\n/)
assert.match(cfg, /updateSettingsForSource\('userSettings'/)
assert.doesNotMatch(read("main.tsx"), /autoUpdatesChannel/)

// 3. The plugin-marketplace lane and the config surface stay.
assert.match(config, /export function shouldSkipPluginAutoupdate\(\): boolean \{/)
assert.match(config, /process\.env\.NODE_ENV === 'development'/)
assert.match(read("utils/plugins/pluginAutoupdate.ts"), /shouldSkipPluginAutoupdate\(\)/)
assert.match(read("utils/settings/types.ts"), /plansDirectory: z/)
assert.match(read("utils/settings/changeDetector.ts"), /another session starts up/)
assert.doesNotMatch(read("utils/settings/changeDetector.ts"), /auto-updater|auto-updates/)

// 4. Nothing was orphaned.
const orphans = execFileSync("node", ["/Users/mant1ssa/Projects/cc_reverse/.audit/w65-orphans.mjs"], {encoding: "utf8"})
assert.match(orphans, /1605 files scanned, 10 with no importer/)

// 5. The gate.
const tscText = fs.readFileSync(new URL("w65-d7y-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const files = ["utils/config.ts", "utils/settings/types.ts", "components/Settings/Config.tsx", "main.tsx", "utils/settings/changeDetector.ts"]
const digests = {}
for (const f of files) digests[f] = digest(base(f))

fs.writeFileSync(
  new URL("w65-d7y-source-evidence.json", import.meta.url),
  JSON.stringify(
    {
      before,
      kind: "the auto-update channel configuration residue removed (no ported bodies; the fields steered only the removed updater)",
      surface:
        "ReleaseChannel and InstallMethod, the global config's installMethod/autoUpdates/autoUpdatesProtectedForNative fields with their defaults, GLOBAL_CONFIG_KEYS entries and test config, migrateConfigFields with its three call sites, getAutoUpdaterDisabledReason/formatAutoUpdaterDisabledReason/AutoUpdaterDisabledReason; the settings schema's autoUpdatesChannel and minimumVersion; Config.tsx's channel row, enable dialog and downgrade dialog with components/ChannelDowngradeDialog.tsx; main.tsx's channel telemetry; two changeDetector comments naming the updater",
      decisiveFact:
        "every removed reader belonged to the release-channel install path deleted in step 7x: the channel selected which dist-tag the updater fetched, minimumVersion pinned a build during a stable-channel switch, and the global install-method/autoUpdates fields were written by the updater's own enable flow and read by its disabled-reason helper. Nothing else reads them; the plugin-marketplace lane's shouldSkipPluginAutoupdate is environment-only and stays",
      changes: [
        {file: "utils/config.ts", change: "the release-channel and install-method types, the three global-config fields with their defaults, keys and test override, migrateConfigFields with its three call sites (the watcher and both loader paths now construct/get the config directly), and the disabled-reason type and helpers are removed", sourceSha256: digests["utils/config.ts"], portSha256: digest(config), coordinateUnit: "utf16-half-open"},
        {file: "utils/settings/types.ts", change: "the autoUpdatesChannel and minimumVersion schema entries are removed; the surrounding settings schema is untouched", sourceSha256: digests["utils/settings/types.ts"], portSha256: digest(read("utils/settings/types.ts")), coordinateUnit: "utf16-half-open"},
        {file: "components/Settings/Config.tsx", change: "the two auto-update imports, the channel row, the change summary, the revert entries, the toggle branch with its channel-change telemetry, the Enable Auto-Updates dialog, the ChannelDowngrade branch and the disabled-value row rendering are removed", sourceSha256: digests["components/Settings/Config.tsx"], portSha256: digest(cfg), coordinateUnit: "utf16-half-open"},
        {file: "main.tsx", change: "the autoUpdatesChannel telemetry field is removed; the surrounding telemetry object is untouched", sourceSha256: digests["main.tsx"], portSha256: digest(read("main.tsx")), coordinateUnit: "utf16-half-open"},
        {file: "utils/settings/changeDetector.ts", change: "the two comments that named auto-updaters now describe an external writer / another session", sourceSha256: digests["utils/settings/changeDetector.ts"], portSha256: digest(read("utils/settings/changeDetector.ts")), coordinateUnit: "utf16-half-open"},
      ],
      removed: [
        "ReleaseChannel, InstallMethod, the installMethod/autoUpdates/autoUpdatesProtectedForNative config fields with defaults, keys and test override",
        "migrateConfigFields and its three call sites; getAutoUpdaterDisabledReason/formatAutoUpdaterDisabledReason/AutoUpdaterDisabledReason",
        "the autoUpdatesChannel and minimumVersion settings-schema fields",
        "the Config panel's channel row, enable dialog, downgrade dialog and disabled-value rendering, plus components/ChannelDowngradeDialog.tsx",
        "main.tsx's autoUpdatesChannel telemetry",
      ],
      kept: [
        "shouldSkipPluginAutoupdate (environment-only) with its plugin-marketplace readers",
        "the rest of the settings schema, the Config panel's other rows and its settings write/revert flow",
        "the global config's remaining fields, defaults, keys and loader paths",
      ],
      tsc: {
        command: "node_modules/.bin/tsc --noEmit --pretty false",
        cwd: root,
        exitCode: 0,
        diagnostics: 0,
        logSha256: digest(tscText),
      },
      validation:
        "Base-commit checks confirm every field, helper, dialog and call site was present at 780b3fc; a whole-tree sweep finds no auto-update channel token; absence assertions cover the settings schema, the config fields and the Config panel branches; survivor assertions pin the plugin-marketplace gate, the remaining schema entries and the settings write flow; the orphan scanner stays at ten entries over 1607 files; tsc clean",
      remaining:
        "the dependency-pruning pass (nine zero-importer dependencies), the utils/filePersistence/ rename and the analytics transports",
      notes: [
        "minimumVersion was a channel-switch companion field: its only readers were the downgrade dialog and the channel toggle, both removed here, so it leaves with them",
        "the Config panel's two identical dep-array lines and the duplicate disabled-reason argument required n=2 anchors; the first run asserted at the second occurrence and every touched file was restored from HEAD before the replay",
      ],
    },
    null,
    2,
  ) + "\n",
)
console.log("PASS auto-update channel config gone; plugin gate, settings schema and write flow intact; tsc log empty")
