# -*- coding: utf-8 -*-
"""Wave D step 7x research record: four files, one commit."""
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
## Wave D step 7x — the updater core and commands (`780b3fc`, landed)

**The core fetched and installed a vendor release build.** `utils/autoUpdater.ts` looked up dist-tags, compared versions against the running build and drove the download; `utils/nativeInstaller/` resolved the platform binary, downloaded it, verified checksums and signatures, installed it into a versioned directory tree, and held PID locks over that tree. `cli/update.ts` composed the flow, `commands/install.tsx` exposed it as a slash command, the migration copied the legacy `autoUpdaterStatus` into settings, and `useNpmDeprecationNotification` told npm users to run the installer. None of it is needed to run the local agent.

**The commands were the entry points and go with the machinery.** `claude update`/`claude install`, main.tsx's `assertMinVersion`, the doctor's Updates and Version Locks sections, the status panel's install warnings, setup's `lockCurrentVersion` and the old-version cleanup all existed to invoke or report that install path, so they are folded with it. The W61 deferral named the two commands as in-place CLI entries; this step records the reclassification — they belong to the updater package, because their only implementation is the release install path removed here.

**Package-manager detection is not installer machinery.** `utils/nativeInstaller/packageManagers.ts` probes `/etc/os-release` and the OS package managers for the doctor's diagnostic row; it moves to `utils/packageManagers.ts` unchanged apart from its relative imports. The plugin-marketplace autoupdate lane is independent too — it updates marketplaces from their configured git sources — and `shouldSkipPluginAutoupdate` now tests the environment (`NODE_ENV`, `DISABLE_AUTOUPDATER`, `getEssentialTrafficOnlyReason`) directly instead of asking the removed predicate.

### Port coordinate refresh

Fourteen historical evidence files moved, all by re-running their own fixtures: `w65-d7b`, `d7h`, `d7i`, `d7j`, `d7l`, `d7n`, `d7o`, `d7p`, `d7q`, `d7r`, `d7s`, `d7t`, `d7u` and `d7w`. `portSha256` only; no `sourceSha256` changed and no range moved.

### Verification

tsc 0, thirty-two fixtures pass (the new `w65-d7x-verify` plus thirty-one carried), `git diff --check` clean, the orphan scan at its ten legitimate entries with the file count down nine to 1608 (ten modules out, the relocated detector in). Four carried fixtures were amended: 7u, 7v and 7w file counts, and 7t's "the commands stay" prediction, which this step fulfils and which now asserts their absence; 7w's own updater-core section is inverted the same way.

**Next (step 7y):** the config/settings residue — `autoUpdatesChannel` in `utils/settings/types.ts` and Config.tsx with the disabled-reason dialogs and `ChannelDowngradeDialog`, `getAutoUpdaterDisabledReason`/`formatAutoUpdaterDisabledReason`/`AutoUpdaterDisabledReason`, `migrateConfigFields`, the `installMethod`/`autoUpdates` fields and defaults with their `GLOBAL_CONFIG_KEYS` entries, and main.tsx's channel telemetry — then the dependency-pruning pass and the `utils/filePersistence/` rename.

## Protocol slip (recorded)""")

C = 'research/CURRENT.md'
rep(C, "thirty-one fixtures pass (three file-count pins amended). Two earlier evidence records refreshed digest-only.\n", """thirty-one fixtures pass (three file-count pins amended). Two earlier evidence records refreshed digest-only.

Wave D step 7x (`780b3fc`): the updater core and commands are gone. `utils/autoUpdater.ts` and `utils/nativeInstaller/` (dist-tags, platform download with checksum/signature verification, the versioned install tree, PID locks) are deleted with `cli/update.ts`, `commands/install.tsx`, the autoUpdates migration and the npm-deprecation hook; `claude update`/`claude install`, `assertMinVersion`, the doctor's Updates/Version Locks diagnostics, the status install warnings, setup's `lockCurrentVersion` and the old-version cleanup are folded, and `isAutoUpdaterDisabled` is removed with its last reader while `shouldSkipPluginAutoupdate` tests the environment directly. Package-manager detection moves to `utils/packageManagers.ts`; the plugin-marketplace lane stays. 25 files, +20/-4,548; tsc exits 0; thirty-two fixtures pass (four amended). Fourteen earlier evidence records refreshed digest-only.
""")

S = 'research/STATUS.md'
rep(S, "thirty-one fixtures pass (three file-count pins amended); two earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).\n",
"""thirty-one fixtures pass (three file-count pins amended); two earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).

Wave D step 7x (`780b3fc`) removes the updater core and commands: `utils/autoUpdater.ts` (dist-tags, version comparison, install of the downloaded build), `utils/nativeInstaller/` (platform download with checksum/signature checks, the versioned install tree, PID locks), `cli/update.ts`, `commands/install.tsx`, the autoUpdates-to-settings migration and the npm-deprecation hook, plus everything that invoked or reported them — `claude update`/`claude install`, `assertMinVersion`, the doctor's Updates and Version Locks sections and the diagnostic's updater fields, the status panel's install warnings, setup's `lockCurrentVersion` and the old-version cleanup. `isAutoUpdaterDisabled` goes with its last reader and `shouldSkipPluginAutoupdate` tests the environment directly; package-manager detection moves to `utils/packageManagers.ts` and the plugin-marketplace lane stays. 25 files, +20/-4,548; tsc exits 0; thirty-two fixtures pass (four amended); fourteen earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).
""")

F = 'research/FEATURES.md'
rep(F, "Remaining under the 2026-10-16 local-only directive: the updater core and commands (utils/autoUpdater.ts, utils/nativeInstaller/, cli/update.ts, commands/install.tsx with their config/settings residue and doctor diagnostics), the analytics transports",
    "Remaining under the 2026-10-16 local-only directive: the auto-update channel configuration residue (autoUpdatesChannel with the disabled-reason dialogs in Config.tsx, the config fields and migrateConfigFields), the analytics transports")

rep(F, "Next: the updater core and commands, the dependency-pruning pass, the `utils/filePersistence/` rename and the analytics transports. [W65](ports/W65-account-network.md). |",
    "Step 7x (`780b3fc`) removes the updater core and commands: utils/autoUpdater.ts, utils/nativeInstaller/, cli/update.ts, commands/install.tsx, the autoUpdates migration and the npm-deprecation hook, with the CLI blocks, min-version gate, doctor diagnostics, status warnings and cleanup hooks they fed; package-manager detection moves to utils/packageManagers.ts, and the plugin-marketplace lane stays. 25 files, +20/-4,548. Next: the auto-update channel configuration residue, the dependency-pruning pass, the `utils/filePersistence/` rename and the analytics transports. [W65](ports/W65-account-network.md). |")

print('record ok')
