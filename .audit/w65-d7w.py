# -*- coding: utf-8 -*-
"""Wave D step 7w research record: four files, one commit."""
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
## Wave D step 7w — the background auto-update UI lane (`f95398a`, landed)

**The lane was a poller and an in-place installer, rendered from the footer.** `AutoUpdaterWrapper` detected the installation type and selected `NativeAutoUpdater`, `PackageManagerAutoUpdater` or `AutoUpdater`; the selected component checked the release bucket on mount and every 30 minutes thereafter, compared versions against `getMaxVersion`, and on `wasUpdated` reported through `onAutoUpdaterResult`. `useUpdateNotification` supplied the semver display helpers, and `useInstallMessages` surfaced the native installer's startup messages. All of it is remote release-channel machinery: the product's own update path calls a vendor bucket and replaces the running build.

**The prop chain existed only for these components.** REPL held `autoUpdaterResult` with a notification effect and called `useInstallMessages`; `PromptInput` held `isAutoUpdating`; `PromptInputFooter` and `Notifications` forwarded `autoUpdaterResult`, `isAutoUpdating`, `onAutoUpdaterResult` and `onChangeIsUpdating` through to `AutoUpdaterWrapper`. With the components gone the chain has no consumer, so it is removed with them. The rest of the notification footer — API-key status, token count, IDE indicator, memory usage, token warning, plugin notifications — is independent and stays.

**Two comments named the removed components.** `PromptInput`'s overlay note justified `height=0` (not unmount) by the updater's initial-check effect; the structural reason remains and the clause is dropped. `debugFilter`'s secondary-category example used an `AutoUpdaterWrapper` log line and now uses an MCP transport line. `usePluginAutoupdateNotification` and the plugin-marketplace lane are untouched: they update marketplaces from their configured git sources, which is not the CLI release channel.

**The core stays for the next step.** `utils/autoUpdater.ts`, `utils/nativeInstaller/`, `cli/update.ts`, `commands/install.tsx` and `main.tsx`'s `assertMinVersion` still compile and now have no UI consumer; they, the CLI blocks, the config/settings keys, the migration and the doctor diagnostics are step 7x.

### Port coordinate refresh

Two historical evidence files moved, both by re-running their own fixtures: `w65-d7j` and `w65-d7q`. `portSha256` only; no `sourceSha256` changed and no range moved.

### Verification

tsc 0, thirty-one fixtures pass (the new `w65-d7w-verify` plus thirty carried), `git diff --check` clean, the orphan scan at its ten legitimate entries with the file count down by six to 1617. Three carried fixtures were amended, all file-count pins this step supersedes: `w65-d7t`, `w65-d7u` and `w65-d7v` now expect 1617 with a comment naming the six removed modules.

The fixture's base check confirms `d66887e` carried the six files and the REPL state; the current tree has no updater UI token and none of the files; survivor assertions pin the remaining notification surface and the updater core the next step owns. Two repair passes: `PromptInput` and `PromptInputFooter` interleave `debug`/`isAutoUpdating` rather than grouping the updater props, and `Notifications` carries its two updater prop pairs in both the component and `NotificationContent` types; the anchors now include the surrounding props and the pairs use `n=2`, with every touched file restored from `HEAD` before each replay.

**Next (step 7x):** the updater core and commands — `utils/autoUpdater.ts`, `utils/nativeInstaller/`, `cli/update.ts`, `commands/install.tsx`, `main.tsx`'s `assertMinVersion` and update/install blocks, the doctor diagnostics, and the config/settings/migration residue — then the dependency-pruning pass and the `utils/filePersistence/` rename.

## Protocol slip (recorded)""")

C = 'research/CURRENT.md'
rep(C, "Four earlier evidence records refreshed digest-only.\n", """Four earlier evidence records refreshed digest-only.

Wave D step 7w (`f95398a`): the background auto-update UI lane is gone. `AutoUpdaterWrapper` detected the installation type and selected `NativeAutoUpdater`/`PackageManagerAutoUpdater`/`AutoUpdater`, which checked the release bucket every 30 minutes and installed in place; both hooks and all four components are deleted. The prop chain that fed them — REPL's `autoUpdaterResult` state with its notification effect and `useInstallMessages` call, `PromptInput`'s `isAutoUpdating`, and the four props through Footer and Notifications — is folded, and two comments naming the components are reworded. The rest of the notification footer, the plugin-marketplace update lane, and the updater core (`utils/autoUpdater.ts`, `utils/nativeInstaller/`, `cli/update.ts`, `commands/install.tsx`) stay for 7x. 11 files, +2/-831; tsc exits 0; thirty-one fixtures pass (three file-count pins amended). Two earlier evidence records refreshed digest-only.
""")

S = 'research/STATUS.md'
rep(S, "thirty fixtures pass (none amended); four earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).\n",
"""thirty fixtures pass (none amended); four earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).

Wave D step 7w (`f95398a`) removes the background auto-update UI lane: `AutoUpdaterWrapper`, `NativeAutoUpdater`, `PackageManagerAutoUpdater` and `AutoUpdater` (installation-type detection, the 30-minute release-bucket check, max-version messages, in-place installs), `useUpdateNotification` and `useInstallMessages`, with the whole REPL→PromptInput→Footer/Notifications prop chain that fed them and two comments that named the components. The remaining notification footer (API-key status, tokens, IDE, memory, token warning, plugin notifications) and the plugin-marketplace update lane stay; the updater core, commands, doctor diagnostics and config/settings residue are step 7x. 11 files, +2/-831; tsc exits 0; thirty-one fixtures pass (three file-count pins amended); two earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).
""")

F = 'research/FEATURES.md'
rep(F, "Remaining under the 2026-10-16 local-only directive: the auto-updater surface (the update/install commands with utils/autoUpdater.ts and its UI), the analytics transports",
    "Remaining under the 2026-10-16 local-only directive: the updater core and commands (utils/autoUpdater.ts, utils/nativeInstaller/, cli/update.ts, commands/install.tsx with their config/settings residue and doctor diagnostics), the analytics transports")

rep(F, " Next: the auto-updater surface, the dependency-pruning pass, the `utils/filePersistence/` rename and the analytics transports. [W65](ports/W65-account-network.md). |",
    " Step 7w (`f95398a`) removes the background auto-update UI lane: the four updater components (installation-type detection, 30-minute release-bucket checks, in-place installs), both update/install hooks, and the REPL→PromptInput→Footer/Notifications prop chain that fed them. The rest of the notification footer and the plugin-marketplace lane stay; the updater core, commands, doctor diagnostics and config/settings residue move to 7x. 11 files, +2/-831. Next: the updater core and commands, the dependency-pruning pass, the `utils/filePersistence/` rename and the analytics transports. [W65](ports/W65-account-network.md). |")

print('record ok')
