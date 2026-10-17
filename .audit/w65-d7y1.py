# -*- coding: utf-8 -*-
"""Wave D step 7y cut: the auto-update channel configuration residue.

Removes the settings field and global-config fields that only the updater read,
the disabled-reason helpers, the legacy status migration, the main-process
channel telemetry, and the Config panel's channel rows, enable dialog and
downgrade dialog with their component.
"""
import os

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


# ----------------------------------------------------------- utils/config.ts
C = 'utils/config.ts'
cut(C, "export type ReleaseChannel = 'stable' | 'latest'\n\n")
cut(C, "export type InstallMethod = 'local' | 'native' | 'global' | 'unknown'\n\n")
cut(C, """  installMethod?: InstallMethod
  autoUpdates?: boolean
  // Flag to distinguish protection-based disabling from user preference
  autoUpdatesProtectedForNative?: boolean
""")
cut(C, """    installMethod: undefined,
    autoUpdates: undefined,
""")
cut(C, """  'installMethod',
  'autoUpdates',
  'autoUpdatesProtectedForNative',
""")
cut(C, """const TEST_GLOBAL_CONFIG_FOR_TESTING: GlobalConfig = {
  ...DEFAULT_GLOBAL_CONFIG,
  autoUpdates: false,
}
""", """const TEST_GLOBAL_CONFIG_FOR_TESTING: GlobalConfig = {
  ...DEFAULT_GLOBAL_CONFIG,
}
""")

cut_between(C, '/**\n * Migrates old autoUpdaterStatus to new installMethod and autoUpdates fields',
            '/**\n * Removes history field from projects (migrated to history.jsonl)')

cut(C, """          globalConfigCache = {
            config: migrateConfigFields({
              ...createDefaultGlobalConfig(),
              ...(parsed as Partial<GlobalConfig>),
            }),
            mtime: curr.mtimeMs,
          }
""", """          globalConfigCache = {
            config: {
              ...createDefaultGlobalConfig(),
              ...(parsed as Partial<GlobalConfig>),
            },
            mtime: curr.mtimeMs,
          }
""")
cut(C, """    const config = migrateConfigFields(
      getConfig(getGlobalClaudeFile(), createDefaultGlobalConfig),
    )
""", """    const config = getConfig(
      getGlobalClaudeFile(),
      createDefaultGlobalConfig,
    )
""")
cut(C, """    return migrateConfigFields(
      getConfig(getGlobalClaudeFile(), createDefaultGlobalConfig),
    )
""", """    return getConfig(getGlobalClaudeFile(), createDefaultGlobalConfig)
""")

cut_between(C, 'export type AutoUpdaterDisabledReason =',
            'export function getOrCreateUserID(): string {')

# --------------------------------------------------- utils/settings/types.ts
T = 'utils/settings/types.ts'
cut(T, """      autoUpdatesChannel: z
        .enum(['latest', 'stable'])
        .optional()
        .describe('Release channel for auto-updates (latest or stable)'),
""")
cut(T, """      minimumVersion: z
        .string()
        .optional()
        .describe(
          'Minimum version to stay on - prevents downgrades when switching to stable channel',
        ),
""")

# --------------------------------------------------------- components/Settings/Config.tsx
G = 'components/Settings/Config.tsx'

cut(G, """import {
  getGlobalConfig,
  getAutoUpdaterDisabledReason,
  formatAutoUpdaterDisabledReason,
} from '../../utils/config.js'
""", "import { getGlobalConfig } from '../../utils/config.js'\n")

cut(G, """import {
  ChannelDowngradeDialog,
  type ChannelDowngradeChoice,
} from '../ChannelDowngradeDialog.js'
""")

cut(G, "  | 'ChannelDowngrade'\n")
cut(G, "  | 'EnableAutoUpdates'\n")
cut(G, "  const autoUpdaterDisabledReason = getAutoUpdaterDisabledReason()\n\n")

cut(G, """    // autoUpdates setting is hidden - use DISABLE_AUTOUPDATER env var to control
    autoUpdaterDisabledReason
      ? {
          id: 'autoUpdatesChannel',
          label: 'Auto-update channel',
          value: 'disabled',
          type: 'managedEnum' as const,
          onChange() {},
        }
      : {
          id: 'autoUpdatesChannel',
          label: 'Auto-update channel',
          value: settingsData?.autoUpdatesChannel ?? 'latest',
          type: 'managedEnum' as const,
          onChange() {
            // Handled via toggleSetting -> 'ChannelDowngrade'
          },
        },
""")

cut(G, """    if (
      settingsData?.autoUpdatesChannel !==
      initialSettingsData.current?.autoUpdatesChannel
    ) {
      formattedChanges.push(
        `Set auto-update channel to ${chalk.bold(settingsData?.autoUpdatesChannel ?? 'latest')}`,
      )
    }
""")

cut(G, "    settingsData?.autoUpdatesChannel,\n", n=2)
cut(G, """      autoUpdatesChannel: iu?.autoUpdatesChannel,
      minimumVersion: iu?.minimumVersion,
""")

cut_between(G, "    if (setting.id === 'autoUpdatesChannel') {",
            "    if (setting.type === 'enum') {")
cut(G, "    autoUpdaterDisabledReason,\n", n=2)

cut_between(G, "      ) : showSubmenu === 'EnableAutoUpdates' ? (",
            """      ) : (
        <Box
          flexDirection="column"
          gap={1}
          marginY={insideModal ? undefined : 1}
        >""")

cut_between(G, """                            ) : setting.id === 'autoUpdatesChannel' &&
                              autoUpdaterDisabledReason ? (""",
            """                            ) : (
                              <Text""")

os.remove(os.path.join(ROOT, 'components/ChannelDowngradeDialog.tsx'))

# ------------------------------------------------------------------ main.tsx
M = 'main.tsx'
cut(M, """      autoUpdatesChannel: (getInitialSettings().autoUpdatesChannel ??
        'latest') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
""")

# ------------------------------------------------------ settings comments
CD = 'utils/settings/changeDetector.ts'
cut(CD, """ * Handles the common delete-and-recreate pattern during auto-updates or when
 * another session starts up.""", """ * Handles the common delete-and-recreate pattern when an external writer or
 * another session starts up.""")
cut(CD, """ * patterns (e.g. auto-updater, another session starting up). If the file is""",
       """ * patterns (e.g. another session starting up). If the file is""")

print('cut ok')
