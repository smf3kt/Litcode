import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "f95398a"
const digest = text => createHash("sha256").update(text).digest("hex")

// The updater core polled a release bucket, downloaded a build and installed
// it in place. `claude update` and `claude install` existed only to run that
// machinery, and the doctor/status surfaces reported its permissions, channel
// and dist-tags. All of it is software distribution; the product keeps its
// local CLI, plugins and diagnostics. The plugin-marketplace autoupdate lane
// updates marketplaces from their configured git sources and is unrelated.
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

// 1. The base carried the updater core, the commands and their consumers.
for (const f of [
  "utils/autoUpdater.ts",
  "utils/nativeInstaller/download.ts",
  "utils/nativeInstaller/index.ts",
  "utils/nativeInstaller/installer.ts",
  "utils/nativeInstaller/packageManagers.ts",
  "utils/nativeInstaller/pidLock.ts",
  "cli/update.ts",
  "commands/install.tsx",
  "migrations/migrateAutoUpdatesToSettings.ts",
  "hooks/notifs/useNpmDeprecationNotification.tsx",
]) {
  assert.ok(base(f).length > 0, `base carried ${f}`)
}
const baseMain = base("main.tsx")
for (const needle of [
  "void assertMinVersion()",
  ".command('update')",
  ".command('install [target]')",
  "auto_updater_disabled: isAutoUpdaterDisabled()",
  "migrateAutoUpdatesToSettings()",
  "Check the health of your Claude Code auto-updater",
]) {
  assert.ok(baseMain.includes(needle), `base main.tsx carried ${needle}`)
}
assert.ok(base("setup.ts").includes("lockCurrentVersion"))
assert.ok(base("utils/cleanup.ts").includes("cleanupOldVersionsThrottled"))
assert.ok(base("utils/doctorDiagnostic.ts").includes("checkGlobalInstallPermissions"))
assert.ok(base("utils/status.tsx").includes("buildInstallationDiagnostics"))
assert.ok(base("utils/localInstaller.ts").includes("installOrUpdateClaudePackage"))

// 2. The updater modules and their direct consumers are gone.
for (const f of [
  "utils/autoUpdater.ts",
  "utils/nativeInstaller/download.ts",
  "utils/nativeInstaller/index.ts",
  "utils/nativeInstaller/installer.ts",
  "utils/nativeInstaller/packageManagers.ts",
  "utils/nativeInstaller/pidLock.ts",
  "cli/update.ts",
  "commands/install.tsx",
  "migrations/migrateAutoUpdatesToSettings.ts",
  "hooks/notifs/useNpmDeprecationNotification.tsx",
]) {
  assert.ok(!exists(f), `${f} removed`)
}
assert.ok(!exists("utils/nativeInstaller"), "utils/nativeInstaller removed")
assert.equal(
  rg(
    "autoUpdater\\.js|nativeInstaller|checkGlobalInstallPermissions|getGcsDistTags|getNpmDistTags|cleanupStaleLocks|getAllLockInfo|isPidBasedLockingEnabled|migrateAutoUpdatesToSettings|useNpmDeprecationNotification|assertMinVersion|lockCurrentVersion|cleanupOldVersions|buildInstallationDiagnostics|configInstallMethod|hasUpdatePermissions|auto_updater_disabled",
  ),
  "",
  "no updater-core residue",
)
const main = read("main.tsx")
assert.doesNotMatch(main, /\.command\('update'\)|\.command\('install \[target\]'\)/)
assert.match(main, /Check the health of your Claude Code installation/)
assert.doesNotMatch(read("utils/config.ts"), /isAutoUpdaterDisabled/)
assert.doesNotMatch(read("utils/localInstaller.ts"), /ensureLocalPackageEnvironment|installOrUpdateClaudePackage/)
assert.doesNotMatch(read("utils/cleanup.ts"), /cleanupOldVersions/)

// 3. The surfaces that merely reported the updater are folded.
const doctor = read("screens/Doctor.tsx")
assert.doesNotMatch(doctor, /DistTagsDisplay|distTagsPromise|versionLockInfo|Version Locks|Updates section|configInstallMethod|recommendation/)
assert.match(doctor, /<Text>└ Path: \{diagnostic.installationPath\}<\/Text>/)
assert.match(doctor, /diagnostic.multipleInstallations.length > 1/)
assert.doesNotMatch(read("utils/doctorDiagnostic.ts"), /hasUpdatePermissions|configInstallMethod|autoUpdates:/)
assert.match(read("utils/doctorDiagnostic.ts"), /export async function getDoctorDiagnostic/)
assert.doesNotMatch(read("utils/status.tsx"), /hasUpdatePermissions|checkInstall/)

// 4. The local surfaces stay.
assert.ok(exists("utils/packageManagers.ts"), "package-manager detection relocated")
assert.match(read("utils/packageManagers.ts"), /export const getPackageManager = memoize/)
assert.match(read("utils/packageManagers.ts"), /from '\.\/execFileNoThrow\.js'/)
const local = read("utils/localInstaller.ts")
for (const fn of ["getLocalClaudePath", "isRunningFromLocalInstallation", "localInstallationExists", "getShellType"]) {
  assert.match(local, new RegExp(`export (async )?function ${fn}\\(`), `${fn} stays`)
}
const cleanup = read("utils/cleanup.ts")
assert.match(cleanup, /export async function cleanupNpmCacheForAnthropicPackages/)
assert.match(cleanup, /export async function cleanupOldMessageFilesInBackground/)
assert.match(read("utils/backgroundHousekeeping.ts"), /void cleanupNpmCacheForAnthropicPackages\(\)/)
const config = read("utils/config.ts")
assert.match(config, /export function shouldSkipPluginAutoupdate\(\): boolean \{/)
assert.match(config, /isEnvTruthy\(process\.env\.DISABLE_AUTOUPDATER\)/)
assert.match(read("utils/plugins/pluginAutoupdate.ts"), /if \(shouldSkipPluginAutoupdate\(\)\)/)
assert.match(read("commands/plugin/ManageMarketplaces.tsx"), /!shouldSkipPluginAutoupdate\(\)/)
// Nothing in the CLI host requires an update: the command list keeps its local entries.
assert.match(main, /\.command\('doctor'\)/)
assert.match(main, /\.command\('mcp'\)|\.command\('plugin'\)/)

// 5. The config/settings/Config.tsx residue was the next step's surface; step
// 7y later removed it, so the prediction is asserted as fulfilled.
assert.doesNotMatch(config, /getAutoUpdaterDisabledReason|autoUpdatesChannel/)
assert.doesNotMatch(read("utils/settings/types.ts"), /autoUpdatesChannel|minimumVersion/)
assert.doesNotMatch(read("components/Settings/Config.tsx"), /getAutoUpdaterDisabledReason|autoUpdatesChannel/)
assert.doesNotMatch(main, /autoUpdatesChannel/)

// 6. Nothing was orphaned.
const orphans = execFileSync("node", ["/Users/mant1ssa/Projects/cc_reverse/.audit/w65-orphans.mjs"], {encoding: "utf8"})
// utils/packageManagers.ts is untracked until this step commits, so the
// working-tree scan reports 1607 files; the committed tree reports 1608.
assert.match(orphans, /16(07|08) files scanned, 10 with no importer/)

// 7. The gate.
const tscText = fs.readFileSync(new URL("w65-d7x-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const files = [
  "main.tsx",
  "cli/handlers/util.tsx",
  "screens/REPL.tsx",
  "components/Settings/Status.tsx",
  "screens/Doctor.tsx",
  "setup.ts",
  "utils/backgroundHousekeeping.ts",
  "utils/cleanup.ts",
  "utils/config.ts",
  "utils/deepLink/registerProtocol.ts",
  "utils/doctorDiagnostic.ts",
  "utils/localInstaller.ts",
  "utils/plugins/officialMarketplaceGcs.ts",
  "utils/privacyLevel.ts",
  "utils/status.tsx",
]
const digests = {}
for (const f of files) digests[f] = digest(base(f))
const pmBase = digest(base("utils/nativeInstaller/packageManagers.ts"))
const pmNow = digest(read("utils/packageManagers.ts"))

fs.writeFileSync(
  new URL("w65-d7x-source-evidence.json", import.meta.url),
  JSON.stringify(
    {
      before,
      kind: "the updater core and commands removed (no ported bodies; the core downloaded and installed a release build in place)",
      surface:
        "utils/autoUpdater.ts (release-bucket dist-tags, max-version, install of the downloaded build), utils/nativeInstaller/ (download, installer, package managers, PID locks, index), cli/update.ts, commands/install.tsx, migrations/migrateAutoUpdatesToSettings.ts and hooks/notifs/useNpmDeprecationNotification.tsx; main.tsx's `claude update`, `claude install` and `assertMinVersion`; the doctor's Updates/Version Locks sections with configInstallMethod/recommendation/autoUpdates/hasUpdatePermissions; the status panel's install warnings; setup's lockCurrentVersion and the old-version cleanup",
      decisiveFact:
        "the deleted modules exist to fetch and install a newer copy of the CLI from a vendor release bucket: dist-tag lookup, platform binary download, checksum and signature checks, version-directory installation, and PID locks that protect that install tree. None of it is needed by the local agent surface. `claude update` and `claude install` were named in the W61 deferral but are not separate account features: they exist only as entry points into this machinery, and the doctor, status and npm-deprecation messages told users to run them. The package is therefore removed whole, commands included, as recorded here",
      reclassified:
        "`claude update` and `claude install` were deferred from W61 as in-place CLI entries; this step records that they belong to the updater package rather than to the account/subscription wave, because their only implementation is the release-channel install path removed here",
      changes: [
        {file: "main.tsx", change: "the isAutoUpdaterDisabled import with its telemetry field, the assertMinVersion import and call, the migration import and call, the `claude update`/`claude install` blocks, the auto-updater wording in the doctor description and the autoupdate sequencing comment are removed", sourceSha256: digests["main.tsx"], portSha256: digest(main), coordinateUnit: "utf16-half-open"},
        {file: "cli/handlers/util.tsx", change: "installHandler is removed with the `cwd` import and the header now names doctor alone", sourceSha256: digests["cli/handlers/util.tsx"], portSha256: digest(read("cli/handlers/util.tsx")), coordinateUnit: "utf16-half-open"},
        {file: "screens/REPL.tsx", change: "the useNpmDeprecationNotification import and call are removed", sourceSha256: digests["screens/REPL.tsx"], portSha256: digest(read("screens/REPL.tsx")), coordinateUnit: "utf16-half-open"},
        {file: "components/Settings/Status.tsx", change: "the buildInstallationDiagnostics import and call are removed from the status panel", sourceSha256: digests["components/Settings/Status.tsx"], portSha256: digest(read("components/Settings/Status.tsx")), coordinateUnit: "utf16-half-open"},
        {file: "screens/Doctor.tsx", change: "DistTagsDisplay, distTagsPromise, autoUpdatesChannel, versionLockInfo with its locks fetch, the Updates and Version Locks sections, the Config install method and recommendation rows, and the Suspense/use/join/lock imports they held are removed", sourceSha256: digests["screens/Doctor.tsx"], portSha256: digest(doctor), coordinateUnit: "utf16-half-open"},
        {file: "setup.ts", change: "the lockCurrentVersion import and its call are removed", sourceSha256: digests["setup.ts"], portSha256: digest(read("setup.ts")), coordinateUnit: "utf16-half-open"},
        {file: "utils/backgroundHousekeeping.ts", change: "the cleanupOldVersions import with its two call sites and the throttled variant in the ant interval are removed; the npm-cache interval and message cleanup stay", sourceSha256: digests["utils/backgroundHousekeeping.ts"], portSha256: digest(read("utils/backgroundHousekeeping.ts")), coordinateUnit: "utf16-half-open"},
        {file: "utils/cleanup.ts", change: "cleanupOldVersionsThrottled and the cleanupOldVersions import are removed; cache, message, paste, image, worktree and tool-result cleanup stay", sourceSha256: digests["utils/cleanup.ts"], portSha256: digest(cleanup), coordinateUnit: "utf16-half-open"},
        {file: "utils/config.ts", change: "isAutoUpdaterDisabled is removed with its last reader, and shouldSkipPluginAutoupdate now tests NODE_ENV/DISABLE_AUTOUPDATER/getEssentialTrafficOnlyReason directly instead of calling it", sourceSha256: digests["utils/config.ts"], portSha256: digest(config), coordinateUnit: "utf16-half-open"},
        {file: "utils/deepLink/registerProtocol.ts", change: "the binary-path comment no longer names the native installer's auto-updating symlink", sourceSha256: digests["utils/deepLink/registerProtocol.ts"], portSha256: digest(read("utils/deepLink/registerProtocol.ts")), coordinateUnit: "utf16-half-open"},
        {file: "utils/doctorDiagnostic.ts", change: "the autoUpdater/config helper imports, the four updater fields on DiagnosticInfo, the config-indicated native install probe, the install-method mismatch warnings, the local-installation warning, the permission check and the autoUpdates/hasUpdatePermissions/configInstallMethod result fields are removed; the package-manager import points at the relocated module", sourceSha256: digests["utils/doctorDiagnostic.ts"], portSha256: digest(read("utils/doctorDiagnostic.ts")), coordinateUnit: "utf16-half-open"},
        {file: "utils/localInstaller.ts", change: "writeIfMissing, ensureLocalPackageEnvironment and installOrUpdateClaudePackage are removed with their now-unused imports; the shell-type and local-path helpers stay", sourceSha256: digests["utils/localInstaller.ts"], portSha256: digest(local), coordinateUnit: "utf16-half-open"},
        {file: "utils/plugins/officialMarketplaceGcs.ts", change: "the bucket comment no longer names the deleted nativeInstaller/download.ts", sourceSha256: digests["utils/plugins/officialMarketplaceGcs.ts"], portSha256: digest(read("utils/plugins/officialMarketplaceGcs.ts")), coordinateUnit: "utf16-half-open"},
        {file: "utils/privacyLevel.ts", change: "the surface list no longer names auto-updates", sourceSha256: digests["utils/privacyLevel.ts"], portSha256: digest(read("utils/privacyLevel.ts")), coordinateUnit: "utf16-half-open"},
        {file: "utils/status.tsx", change: "buildInstallationDiagnostics and the hasUpdatePermissions warning are removed; the remaining status diagnostics stay", sourceSha256: digests["utils/status.tsx"], portSha256: digest(read("utils/status.tsx")), coordinateUnit: "utf16-half-open"},
        {file: "utils/packageManagers.ts", change: "package-manager detection moved out of the removed directory unchanged apart from its three relative import paths", sourceSha256: pmBase, portSha256: pmNow, coordinateUnit: "utf16-half-open"},
      ],
      removed: [
        "utils/autoUpdater.ts and utils/nativeInstaller/ (download, installer, package managers, PID locks, index)",
        "cli/update.ts, commands/install.tsx, migrations/migrateAutoUpdatesToSettings.ts and hooks/notifs/useNpmDeprecationNotification.tsx",
        "main.tsx's `claude update`/`claude install`, assertMinVersion, the auto-updater telemetry field and the migration call",
        "the doctor Updates/Version Locks sections and the diagnostic's updater fields, the status panel's install warnings, and setup's lockCurrentVersion",
        "cleanupOldVersions/cleanupOldVersionsThrottled and isAutoUpdaterDisabled with the local installer's install path",
      ],
      kept: [
        "the plugin-marketplace autoupdate lane (pluginAutoupdate.ts and ManageMarketplaces.tsx keep shouldSkipPluginAutoupdate, now env-only)",
        "utils/packageManagers.ts (read-only OS package-manager detection for the doctor)",
        "utils/localInstaller.ts's getShellType, getLocalClaudePath, isRunningFromLocalInstallation and localInstallationExists",
        "the doctor's installation/path/search/multi-install diagnostics and every local cleanup task",
      ],
      tsc: {
        command: "node_modules/.bin/tsc --noEmit --pretty false",
        cwd: root,
        exitCode: 0,
        diagnostics: 0,
        logSha256: digest(tscText),
      },
      validation:
        "Base-commit checks confirm every deleted module, CLI block and consumer was present at f95398a; whole-tree sweeps find no updater-core token; absence assertions cover the doctor fields, status warnings, local-installer install path and cleanup hooks; survivor assertions pin the plugin lane, package-manager detection, local shell helpers and the doctor's remaining diagnostics; the config/settings/Config.tsx channel surface is pinned as the next step's residue; the orphan scanner stays at ten entries",
      remaining:
        "the config/settings/Config.tsx channel residue (autoUpdatesChannel schema and UI, getAutoUpdaterDisabledReason/format helpers, migrateConfigFields, main's channel telemetry), then the dependency-pruning pass, the utils/filePersistence/ rename and the analytics transports",
      notes: [
        "`claude update` and `claude install` were deferred from W61 as in-place CLI entries; they are removed here with the machinery they alone invoke, and the reclassification is recorded in `reclassified`",
        "utils/nativeInstaller/packageManagers.ts is not installer machinery: it probes /etc/os-release and the OS package managers for the doctor. It moves to utils/packageManagers.ts unchanged apart from its import paths",
        "two further repair passes: setup.ts, cleanup.ts and backgroundHousekeeping.ts held lockCurrentVersion/cleanupOldVersions readers the first replay surfaced through tsc, and the moved module's untracked status makes the orphan scanner count 1607 before this step commits and 1608 after",
      ],
    },
    null,
    2,
  ) + "\n",
)
console.log("PASS updater core and commands gone; plugin lane, package-manager detection and local helpers intact; tsc log empty")
