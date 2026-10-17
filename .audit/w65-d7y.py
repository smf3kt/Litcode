# -*- coding: utf-8 -*-
"""Wave D step 7y research record: four files, one commit."""
def rd(p): return open(p, encoding='utf-8').read()
def wr(p, t): open(p, 'w', encoding='utf-8').write(t)
def rep(p, old, new):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:80], n)
    wr(p, t.replace(old, new))

W = 'research/ports/W65-account-network.md'
rep(W, """
## Protocol slip (recorded)""", """
## Wave D step 7y — the auto-update channel configuration residue (`51f7625`, landed)

**The channel settings steered the updater and nothing else.** `autoUpdatesChannel` chose which dist-tag the removed updater fetched; `minimumVersion` pinned the running build while a stable-channel switch waited; the global config's `installMethod`/`autoUpdates`/`autoUpdatesProtectedForNative` were written by the updater's enable flow and read by its disabled-reason helper; `migrateConfigFields` translated the legacy `autoUpdaterStatus` into those fields. With step 7x gone, every one of them is readerless.

**The panel was the channel's only UI.** Config.tsx rendered the channel row, the Enable Auto-Updates dialog (which wrote both the settings field and the global config) and the stable-channel `ChannelDowngradeDialog` (which set `minimumVersion`), and the change summary and revert path echoed the field. They are removed with `components/ChannelDowngradeDialog.tsx`, the `ChannelDowngrade`/`EnableAutoUpdates` submenu states, the channel-change and auto-update-enable telemetry, and main.tsx's `autoUpdatesChannel` telemetry field. Two `changeDetector` comments that named the updater now describe an external writer.

**What stays is the plugin lane and the config surface.** `shouldSkipPluginAutoupdate` is environment-only and still gates marketplace autoupdate; the remaining settings schema, config fields and the panel's other rows and write/revert flow are untouched.

### Port coordinate refresh

Fifteen historical evidence files moved, all by re-running their own fixtures: `w65-d7b`, `d7g`, `d7h`, `d7i`, `d7j`, `d7l`, `d7n`, `d7o`, `d7p`, `d7q`, `d7r`, `d7s`, `d7t`, `d7u` and `d7x`. `portSha256` only; no `sourceSha256` changed and no range moved.

### Verification

tsc 0, thirty-three fixtures pass (the new `w65-d7y-verify` plus thirty-two carried), `git diff --check` clean, the orphan scan at its ten legitimate entries with the file count down one to 1607. One carried fixture was amended: `w65-d7x` pinned this residue as the next step's surface, and its assertions now record the removal. The first cut run stopped on the duplicated disabled-reason dep line; the script uses `n=2` and every touched file was restored from `HEAD` before the replay.

**Next:** the dependency-pruning pass (nine zero-importer dependencies), the `utils/filePersistence/` rename and the analytics transports.

## Protocol slip (recorded)""")

C = 'research/CURRENT.md'
rep(C, "Fourteen earlier evidence records refreshed digest-only.\n", """Fourteen earlier evidence records refreshed digest-only.

Wave D step 7y (`51f7625`): the auto-update channel configuration residue is gone. `autoUpdatesChannel` and `minimumVersion` leave the settings schema; `ReleaseChannel`, `InstallMethod`, the global config's `installMethod`/`autoUpdates`/`autoUpdatesProtectedForNative` fields, `migrateConfigFields` and the disabled-reason type/helpers leave the config; Config.tsx loses the channel row, the Enable Auto-Updates dialog, the ChannelDowngrade branch and `components/ChannelDowngradeDialog.tsx`; main's channel telemetry and two updater-naming comments are removed. The plugin-marketplace gate stays environment-only. 6 files, +9/-380; tsc exits 0; thirty-three fixtures pass (one amended). Fifteen earlier evidence records refreshed digest-only.
""")

S = 'research/STATUS.md'
rep(S, "fourteen earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).\n",
"""fourteen earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).

Wave D step 7y (`51f7625`) removes the auto-update channel configuration residue: the settings schema's `autoUpdatesChannel` and `minimumVersion`, `ReleaseChannel`/`InstallMethod`, the global config's `installMethod`/`autoUpdates`/`autoUpdatesProtectedForNative` fields with their defaults, keys and test override, `migrateConfigFields` with its three call sites, and the `AutoUpdaterDisabledReason` type with its format/lookup helpers; the Config panel loses the channel row, change summary, revert entries, toggle branch, Enable Auto-Updates dialog, downgrade branch and `components/ChannelDowngradeDialog.tsx`; main loses the channel telemetry field, and two changeDetector comments are reworded. The plugin-marketplace gate stays environment-only. 6 files, +9/-380; tsc exits 0; thirty-three fixtures pass (one amended); fifteen earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).
""")

F = 'research/FEATURES.md'
rep(F, "Remaining under the 2026-10-16 local-only directive: the auto-update channel configuration residue (autoUpdatesChannel with the disabled-reason dialogs in Config.tsx, the config fields and migrateConfigFields), the analytics transports",
    "Remaining under the 2026-10-16 local-only directive: the analytics transports")

rep(F, "Next: the auto-update channel configuration residue, the dependency-pruning pass, the `utils/filePersistence/` rename and the analytics transports. [W65](ports/W65-account-network.md). |",
    "Step 7y (`51f7625`) removes the auto-update channel configuration residue: the settings schema's autoUpdatesChannel and minimumVersion, the global config's installMethod/autoUpdates fields with migrateConfigFields, the disabled-reason helpers, main's channel telemetry, and the Config panel's channel row, enable dialog and downgrade dialog. 6 files, +9/-380. Next: the dependency-pruning pass, the `utils/filePersistence/` rename and the analytics transports. [W65](ports/W65-account-network.md). |")

print('record ok')
