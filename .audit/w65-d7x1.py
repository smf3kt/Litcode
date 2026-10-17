# -*- coding: utf-8 -*-
"""Wave D step 7x cut: the updater core and commands.

Deletes the release-channel client (utils/autoUpdater.ts), the native installer
(utils/nativeInstaller/), the update/install command handlers, the
autoUpdates-to-settings migration and the npm-deprecation hook, and folds the
importers: the CLI blocks and the startup min-version gate in main.tsx, the
install handler, the doctor diagnostics, the status panel's install warnings
and the local installer's dead install path.
"""
import os
import subprocess

ROOT = '/Users/mant1ssa/Projects/cc-base-2188'


def rd(rel):
    return open(os.path.join(ROOT, rel), encoding='utf-8').read()


def wr(rel, text):
    open(os.path.join(ROOT, rel), 'w', encoding='utf-8').write(text)


def cut(rel, old, new='', n=1):
    text = rd(rel)
    count = text.count(old)
    assert count == n, (rel, 'found', count, 'expected', n, old[:120])
    wr(rel, text.replace(old, new))


def cut_between(rel, start, end, new=''):
    text = rd(rel)
    assert text.count(start) == 1, (rel, 'start', text.count(start), start[:120])
    assert text.count(end) >= 1, (rel, 'end', text.count(end), end[:120])
    i = text.index(start)
    j = text.index(end, i + len(start))
    wr(rel, text[:i] + new + text[j:])


# ------------------------------------------------------------------ main.tsx
M = 'main.tsx'

cut(M, """import {
  checkHasTrustDialogAccepted,
  getGlobalConfig,
  isAutoUpdaterDisabled,
  saveGlobalConfig,
} from './utils/config.js'
""", """import {
  checkHasTrustDialogAccepted,
  getGlobalConfig,
  saveGlobalConfig,
} from './utils/config.js'
""")

cut(M, "    auto_updater_disabled: isAutoUpdaterDisabled(),\n")
cut(M, "import { assertMinVersion } from './utils/autoUpdater.js'\n")
cut(M, "import { migrateAutoUpdatesToSettings } from './migrations/migrateAutoUpdatesToSettings.js'\n")
cut(M, "    migrateAutoUpdatesToSettings()\n")

cut(M, """      void assertMinVersion()

      // Kick off MCP config loading early""", """      // Kick off MCP config loading early""")

cut(M, "      'Check the health of your Claude Code auto-updater. Note: The workspace trust dialog is skipped and stdio servers from .mcp.json are spawned for health checks. Only use this command in directories you trust.',\n",
      "      'Check the health of your Claude Code installation. Note: The workspace trust dialog is skipped and stdio servers from .mcp.json are spawned for health checks. Only use this command in directories you trust.',\n")

cut(M, """  // claude update
  //
  // For SemVer-compliant versioning with build metadata (X.X.X+SHA):
  // - We perform exact string comparison (including SHA) to detect any change
  // - This ensures users always get the latest build, even when only the SHA changes
  // - UI shows both versions including build metadata for clarity
  program
    .command('update')
    .alias('upgrade')
    .description('Check for updates and install if available')
    .action(async () => {
      const { update } = await import('src/cli/update.js')
      await update()
    })

  // claude install
  program
    .command('install [target]')
    .description(
      'Install Claude Code native build. Use [target] to specify version (stable, latest, or specific version)',
    )
    .option('--force', 'Force installation even if already installed')
    .action(
      async (target: string | undefined, options: { force?: boolean }) => {
        const { installHandler } = await import('./cli/handlers/util.js')
        await installHandler(target, options)
      },
    )

""")

# --------------------------------------------------------- cli/handlers/util
U = 'cli/handlers/util.tsx'

cut(U, " * doctor, install\n", " * doctor\n")
cut(U, "import { cwd } from 'process'\n")
_u = rd(U)
wr(U, _u[:_u.index('// install handler\n')].rstrip('\n') + '\n')

# ------------------------------------------------------------------- REPL.tsx
R = 'screens/REPL.tsx'
cut(R, "import { useNpmDeprecationNotification } from 'src/hooks/notifs/useNpmDeprecationNotification.js'\n")
cut(R, "  useNpmDeprecationNotification()\n")

# --------------------------------------------------------------- status.tsx
S = 'utils/status.tsx'
cut(S, "import { checkInstall } from './nativeInstaller/index.js'\n")
cut(S, """export async function buildInstallationDiagnostics(): Promise<Diagnostic[]> {
  const installWarnings = await checkInstall()
  return installWarnings.map(warning => warning.message)
}

""")
cut(S, """  if (diagnostic.hasUpdatePermissions === false) {
    items.push('No write permissions for auto-updates (requires sudo)')
  }

""")

ST = 'components/Settings/Status.tsx'
cut(ST, "  buildInstallationDiagnostics,\n")
cut(ST, "    ...(await buildInstallationDiagnostics()),\n")

# ------------------------------------------------------------- Doctor.tsx
D = 'screens/Doctor.tsx'

cut(D, """import {
  getGcsDistTags,
  getNpmDistTags,
  type NpmDistTags,
} from '../utils/autoUpdater.js'
""")
cut(D, """import {
  cleanupStaleLocks,
  getAllLockInfo,
  isPidBasedLockingEnabled,
  type LockInfo,
} from '../utils/nativeInstaller/pidLock.js'
""")
cut(D, "import { getInitialSettings } from '../utils/settings/settings.js'\n")
cut(D, "import { getXDGStateHome } from '../utils/xdg.js'\n")

cut(D, """function DistTagsDisplay({
  promise,
}: {
  promise: Promise<NpmDistTags>
}): React.ReactNode {
  const distTags = use(promise)
  if (!distTags.latest) {
    return <Text dimColor>└ Failed to fetch versions</Text>
  }
  return (
    <>
      {distTags.stable && <Text>└ Stable version: {distTags.stable}</Text>}
      <Text>└ Latest version: {distTags.latest}</Text>
    </>
  )
}

""")

cut(D, """  // Create promise once for dist-tags fetch (depends on diagnostic)
  const distTagsPromise = useMemo(
    () =>
      getDoctorDiagnostic().then(diag => {
        const fetchDistTags =
          diag.installationType === 'native' ? getGcsDistTags : getNpmDistTags
        return fetchDistTags().catch(() => ({ latest: null, stable: null }))
      }),
    [],
  )
  const autoUpdatesChannel =
    getInitialSettings()?.autoUpdatesChannel ?? 'latest'
""")

cut(D, """  const [versionLockInfo, setVersionLockInfo] =
    useState<VersionLockInfo | null>(null)
""")

cut(D, """      // Fetch version lock info if PID-based locking is enabled
      if (isPidBasedLockingEnabled()) {
        const locksDir = join(getXDGStateHome(), 'claude', 'locks')
        const staleLocksCleaned = cleanupStaleLocks(locksDir)
        const locks = getAllLockInfo(locksDir)
        setVersionLockInfo({
          enabled: true,
          locks,
          locksDir,
          staleLocksCleaned,
        })
      } else {
        setVersionLockInfo({
          enabled: false,
          locks: [],
          locksDir: '',
          staleLocksCleaned: 0,
        })
      }
""")

cut(D, """        <Text>└ Config install method: {diagnostic.configInstallMethod}</Text>
""")

cut(D, """        {/* Show recommendation if auto-updates are disabled */}
        {diagnostic.recommendation && (
          <>
            <Text></Text>
            <Text color="warning">
              Recommendation: {diagnostic.recommendation.split('\\n')[0]}
            </Text>
            <Text dimColor>{diagnostic.recommendation.split('\\n')[1]}</Text>
          </>
        )}

""")

cut(D, """      {/* Updates section */}
      <Box flexDirection="column">
        <Text bold>Updates</Text>
        <Text>
          └ Auto-updates:{' '}
          {diagnostic.packageManager
            ? 'Managed by package manager'
            : diagnostic.autoUpdates}
        </Text>
        {diagnostic.hasUpdatePermissions !== null && (
          <Text>
            └ Update permissions:{' '}
            {diagnostic.hasUpdatePermissions ? 'Yes' : 'No (requires sudo)'}
          </Text>
        )}
        <Text>└ Auto-update channel: {autoUpdatesChannel}</Text>
        <Suspense fallback={null}>
          <DistTagsDisplay promise={distTagsPromise} />
        </Suspense>
      </Box>

""")

cut_between(D, '      {/* Version Locks (PID-based locking) */}\n', '      {agentInfo?.failedFiles && agentInfo.failedFiles.length > 0 && (\n')

cut(D, "  Suspense,\n  use,\n")

# VersionLockInfo type and the `use` import
cut(D, """type VersionLockInfo = {
  enabled: boolean
  locks: LockInfo[]
  locksDir: string
  staleLocksCleaned: number
}

""")

# ------------------------------------------------------- doctorDiagnostic.ts
DD = 'utils/doctorDiagnostic.ts'

cut(DD, "import { checkGlobalInstallPermissions } from './autoUpdater.js'\n")
cut(DD, """import {
  formatAutoUpdaterDisabledReason,
  getAutoUpdaterDisabledReason,
  getGlobalConfig,
  type InstallMethod,
} from './config.js'
""")

cut(DD, """  const config = getGlobalConfig()

  // Skip most warnings for development mode""", """  // Skip most warnings for development mode""")

cut(DD, "} from './nativeInstaller/packageManagers.js'\n", "} from './packageManagers.js'\n")

cut(DD, """  configInstallMethod: InstallMethod | 'not set'
  autoUpdates: string
  hasUpdatePermissions: boolean | null
""")
cut(DD, "  recommendation?: string\n")

cut(DD, """  // Also check if config indicates native installation
  const config = getGlobalConfig()
  if (config.installMethod === 'native') {
    const nativeDataPath = join(homedir(), '.local', 'share', 'claude')
    try {
      await fs.stat(nativeDataPath)
      if (!installations.some(i => i.type === 'native')) {
        installations.push({ type: 'native', path: nativeDataPath })
      }
    } catch {
      // Not found
    }
  }

""")

cut(DD, """  // Check for configuration mismatches
  // Skip these checks if DISABLE_INSTALLATION_CHECKS is set (e.g., in HFI)
  if (!isEnvTruthy(process.env.DISABLE_INSTALLATION_CHECKS)) {
    if (type === 'npm-local' && config.installMethod !== 'local') {
      warnings.push({
        issue: `Running from local installation but config install method is '${config.installMethod}'`,
        fix: 'Consider using native installation: claude install',
      })
    }

    if (type === 'native' && config.installMethod !== 'native') {
      warnings.push({
        issue: `Running native installation but config install method is '${config.installMethod}'`,
        fix: 'Run claude install to update configuration',
      })
    }
  }

  if (type === 'npm-global' && (await localInstallationExists())) {
    warnings.push({
      issue: 'Local installation exists but not being used',
      fix: 'Consider using native installation: claude install',
    })
  }

""")

cut(DD, """  const config = getGlobalConfig()

  // Get config values for display
  const configInstallMethod = config.installMethod || 'not set'

  // Check permissions for global installations
  let hasUpdatePermissions: boolean | null = null
  if (installationType === 'npm-global') {
    const permCheck = await checkGlobalInstallPermissions()
    hasUpdatePermissions = permCheck.hasPermissions

    // Add warning if no permissions
    if (!hasUpdatePermissions && !getAutoUpdaterDisabledReason()) {
      warnings.push({
        issue: 'Insufficient permissions for auto-updates',
        fix: 'Do one of: (1) Re-install node without sudo, or (2) Use `claude install` for native installation',
      })
    }
  }

""")

cut(DD, """    configInstallMethod,
    autoUpdates: (() => {
      const reason = getAutoUpdaterDisabledReason()
      return reason
        ? `disabled (${formatAutoUpdaterDisabledReason(reason)})`
        : 'enabled'
    })(),
    hasUpdatePermissions,
""")

# --------------------------------------------------------- localInstaller.ts
L = 'utils/localInstaller.ts'

cut(L, """import { access, chmod, writeFile } from 'fs/promises'
import { join } from 'path'
import { type ReleaseChannel, saveGlobalConfig } from './config.js'
import { getClaudeConfigHomeDir } from './envUtils.js'
import { getErrnoCode } from './errors.js'
import { execFileNoThrowWithCwd } from './execFileNoThrow.js'
import { getFsImplementation } from './fsOperations.js'
import { logError } from './log.js'
import { jsonStringify } from './slowOperations.js'
""", """import { access } from 'fs/promises'
import { join } from 'path'
import { getClaudeConfigHomeDir } from './envUtils.js'
""")

cut_between(L, '/**\n * Write `content` to `path` only if the file does not already exist.', '/**\n * Check if local installation exists.')

# -------------------------------------------------------- plugin autoupdate
C = 'utils/config.ts'
cut(C, """export function isAutoUpdaterDisabled(): boolean {
  return getAutoUpdaterDisabledReason() !== null
}

""")
cut(C, """/**
 * Returns true if plugin autoupdate should be skipped.
 * This checks if the auto-updater is disabled AND the FORCE_AUTOUPDATE_PLUGINS
 * env var is not set to 'true'. The env var allows forcing plugin autoupdate
 * even when the auto-updater is otherwise disabled.
 */
export function shouldSkipPluginAutoupdate(): boolean {
  return (
    isAutoUpdaterDisabled() &&
    !isEnvTruthy(process.env.FORCE_AUTOUPDATE_PLUGINS)
  )
}
""", """/**
 * Returns true if plugin autoupdate should be skipped. The FORCE_AUTOUPDATE_PLUGINS
 * env var allows forcing plugin autoupdate past the environment gates.
 */
export function shouldSkipPluginAutoupdate(): boolean {
  return (
    (process.env.NODE_ENV === 'development' ||
      isEnvTruthy(process.env.DISABLE_AUTOUPDATER) ||
      getEssentialTrafficOnlyReason() !== null) &&
    !isEnvTruthy(process.env.FORCE_AUTOUPDATE_PLUGINS)
  )
}
""")

# ------------------------------------------------------------- stale comments
DL = 'utils/deepLink/registerProtocol.ts'
cut(DL, """ * Resolve the claude binary path for protocol registration. Prefers the
 * native installer's stable symlink (~/.local/bin/claude) which survives
 * auto-updates; falls back to process.execPath when the symlink is absent
 * (dev builds, non-native installs).
""", """ * Resolve the claude binary path for protocol registration. Prefers the
 * stable on-PATH entry point (~/.local/bin/claude); falls back to
 * process.execPath when it is absent (dev builds, other layouts).
""")

cut(M, """      // warm also lands before autoupdate (fires on first submit in REPL)
      // can orphan this session's active version underneath us.
""", """      // warm also lands before a concurrent sync can orphan this session's
      // active version underneath us.
""")

OG = 'utils/plugins/officialMarketplaceGcs.ts'
cut(OG, """// CDN-fronted domain for the public GCS bucket (same bucket the native
// binary ships from — nativeInstaller/download.ts:24 uses the raw GCS URL).
""", """// CDN-fronted domain for the public GCS bucket (the same bucket the
// release binaries ship from).
""")

PL = 'utils/privacyLevel.ts'
cut(PL, " *                       (telemetry + auto-updates, grove, release notes, model capabilities, etc.).\n",
      " *                       (telemetry, grove, release notes, model capabilities, etc.).\n")

# ------------------------------------- package-manager detection relocates
# The detector reads /etc/os-release and probes the OS package managers; it is a
# read-only diagnostic used by the doctor, not part of the installer, so it moves
# out of the removed directory unchanged except for its relative imports.
_pm = subprocess.run(
    ['git', '-C', ROOT, 'show', 'HEAD:utils/nativeInstaller/packageManagers.ts'],
    capture_output=True, text=True, check=True,
).stdout
for old, new in [("../debug.js", "./debug.js"),
                 ("../execFileNoThrow.js", "./execFileNoThrow.js"),
                 ("../platform.js", "./platform.js")]:
    assert _pm.count(old) == 1, old
    _pm = _pm.replace(old, new)
wr('utils/packageManagers.ts', _pm)

# ------------------------------------------------------- cleanup.ts
CL = 'utils/cleanup.ts'
cut(CL, "import { cleanupOldVersions } from './nativeInstaller/index.js'\n")
cut_between(CL, '/**\n * Throttled wrapper around cleanupOldVersions',
            'export async function cleanupOldMessageFilesInBackground(')

# ---------------------------------------------- backgroundHousekeeping.ts
BH = 'utils/backgroundHousekeeping.ts'
cut(BH, "  cleanupOldVersionsThrottled,\n")
cut(BH, "import { cleanupOldVersions } from './nativeInstaller/index.js'\n")
cut(BH, "\n    await cleanupOldVersions()\n  }", "\n  }")
cut(BH, """  // For long-running sessions, schedule recurring cleanup every 24 hours.
  // Both cleanup functions use marker files and locks to throttle to once per day
  // and skip immediately if another process holds the lock.
""", """  // For long-running sessions, schedule recurring cleanup every 24 hours.
  // The cleanup function uses a marker file and lock to throttle to once per day
  // and skip immediately if another process holds the lock.
""")
cut(BH, """      void cleanupNpmCacheForAnthropicPackages()
      void cleanupOldVersionsThrottled()
""", """      void cleanupNpmCacheForAnthropicPackages()
""")

# ------------------------------------------------------------- setup.ts
SP = 'setup.ts'
cut(SP, "import { lockCurrentVersion } from './utils/nativeInstaller/index.js'\n")
cut(SP, "  void lockCurrentVersion() // Lock current version to prevent deletion by other processes\n")

# --------------------------------------------------------------- deletions
for rel in [
    'utils/autoUpdater.ts',
    'utils/nativeInstaller/download.ts',
    'utils/nativeInstaller/index.ts',
    'utils/nativeInstaller/installer.ts',
    'utils/nativeInstaller/packageManagers.ts',
    'utils/nativeInstaller/pidLock.ts',
    'cli/update.ts',
    'commands/install.tsx',
    'migrations/migrateAutoUpdatesToSettings.ts',
    'hooks/notifs/useNpmDeprecationNotification.tsx',
]:
    path = os.path.join(ROOT, rel)
    assert os.path.exists(path), rel
    os.remove(path)

os.rmdir(os.path.join(ROOT, 'utils/nativeInstaller'))

print('cut ok')
