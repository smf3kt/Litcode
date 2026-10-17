# -*- coding: utf-8 -*-
"""Wave D step 7t research record: four files, one commit."""
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
## Wave D step 7t — the stranded in-place CLI blocks (`19bce58`, landed)

**What remained of the W61 list was shells, not bodies.** W61 recorded 33 in-place CLI subcommand blocks for later packages; the feature packages consumed the auth, ssh, teleport/remote, assistant, brief and proactive entries. `git log -S` on the survivors shows why they are empty: the recorder install call, the event-loop stall detector and the other bodies were absent from the first compilable-base commit (`2148015`), which elided them and left an empty statement, a comment, or a whitespace-only line behind. The cut deletes eleven `{}` statements and their stale comments in `main.tsx`, the `claude server`/`claude connect`/`claude up`/`claude rollback`/ant-only registration stubs, the six absent-command fast-path comments in `entrypoints/cli.tsx` (daemon worker, daemon, ps/logs/attach/kill, template jobs, environment-runner, self-hosted-runner), and `setup.ts`'s empty `COMMIT_ATTRIBUTION` block with its then-unused `feature` import. The unchecked `installAsciicastRecorder` import goes with its shell.

**The live install/update blocks are reclassified, not removed.** The W61 deferral named `claude install` and `claude update`, and they are live: `cli/update.ts` runs the npm/native update path and `installHandler` reaches `commands/install.ts`, while `utils/autoUpdater.ts` still fetches the release bucket and its min-version, doctor and npm-deprecation messages tell users to run these exact commands. That surface is software distribution rather than account/subscription network handling; cutting the commands alone would leave the live updater advertising commands the tree no longer has. It stays with the updater package, which must take the commands, the background updater, its UI and those messages together.

**No behaviour changes.** Every removed statement was empty and every removed comment described a body the base dump had already elided. `utils/asciicast.ts` stays whole because REPL and ResumeConversation still read `renameRecordingForSession` and the flush path stays wired; only the base dump's absent installer call is recorded. `assertMinVersion`, the migration tail, the deferred-prefetch tail, the advisor option, the teammate flags and the SDK URL option are untouched.

### Port coordinate refresh

Ten historical evidence files moved, all by re-running their own fixtures: `w65-d7h`, `w65-d7i`, `w65-d7j`, `w65-d7l`, `w65-d7n`, `w65-d7o`, `w65-d7p`, `w65-d7q`, `w65-d7r` and `w65-d7s`. `portSha256` only; no `sourceSha256` changed and no range moved.

### Verification

tsc 0, twenty-eight fixtures pass (the new `w65-d7t-verify` plus twenty-seven carried), `git diff --check` clean, the orphan scan at its ten legitimate entries with the file count unchanged (1632). No carried fixture needed amendment: this step removes no exported symbol a fixture pinned.

The fixture's base check confirms `8c8d201` carried every shell, the current-tree sweep asserts no empty statement remains in `main.tsx` and no absent-command residue in the entrypoint or setup, and the survivor assertions pin the reclassified install/update blocks with both handlers, the asciicast module with its live readers, and the migration/deferred-prefetch tails as the shapes the removals left. One repair pass: the first cut anchored a stub block with empty lines where the source has whitespace-only lines; the cut now uses `cut_between` anchored on surrounding live code, and the tree was restored from `HEAD` before the replay.

**Next (step 7u):** `cli/transports/` with `--sdk-url`, then the dependency-pruning pass (nine zero-importer dependencies), the `utils/filePersistence/` rename, and the auto-updater surface.

## Protocol slip (recorded)""")

C = 'research/CURRENT.md'
rep(C, "Eleven earlier evidence records refreshed digest-only.\n", """Eleven earlier evidence records refreshed digest-only.

Wave D step 7t (`19bce58`): the stranded in-place CLI blocks are gone. W61 deferred 33 entries; the feature packages consumed the auth, ssh, teleport/remote, assistant, brief and proactive blocks, and what remained was shells — eleven empty `{}` statements with comments naming bodies the first compilable-base commit (`2148015`) had elided, the `claude server`/`connect`/`up`/`rollback`/ant-only registration stubs, six absent-command fast-path comment blocks in `entrypoints/cli.tsx`, and `setup.ts`'s empty `COMMIT_ATTRIBUTION` block with its unused `feature` import. The unchecked `installAsciicastRecorder` import goes with its shell; `utils/asciicast.ts` stays for its live resume-rename and flush readers. `claude update`/`claude install` are reclassified to the updater package rather than cut alone: the live `utils/autoUpdater.ts` and its doctor/npm-deprecation messages still direct users to them, and software distribution is outside the account/subscription boundary. No behaviour changes. 3 files, +0/-68; tsc exits 0; twenty-eight fixtures pass (none amended). Ten earlier evidence records refreshed digest-only.
""")

S = 'research/STATUS.md'
rep(S, "eleven earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).\n",
"""eleven earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).

Wave D step 7t (`19bce58`) removes the stranded in-place CLI blocks: eleven empty `{}` statements and their stale comments in `main.tsx`, the `claude server`/`claude connect`/`claude up`/`claude rollback`/ant-only registration stubs, the six absent-command fast-path comment blocks in `entrypoints/cli.tsx` (daemon worker, daemon, ps/logs/attach/kill, template jobs, environment-runner, self-hosted-runner), `setup.ts`'s empty `COMMIT_ATTRIBUTION` block with its then-unused `feature` import, and the unchecked `installAsciicastRecorder` import. `git log -S` shows the bodies were absent from the first compilable-base commit (`2148015`), which elided them and left empty statements, comments or whitespace-only lines. The live `claude update`/`claude install` blocks are reclassified to the auto-updater package instead of being cut alone: `utils/autoUpdater.ts` and its min-version, doctor and npm-deprecation messages still direct users to those commands, and software distribution is outside the account/subscription boundary. No behaviour changes; `utils/asciicast.ts` stays for its live resume-rename and flush readers. 3 files, +0/-68; tsc exits 0; twenty-eight fixtures pass (none amended); ten earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).
""")

F = 'research/FEATURES.md'
rep(F, "Remaining under the 2026-10-16 local-only directive: cli/transports/ as the SDK transport, in-place CLI blocks, the analytics transports",
    "Remaining under the 2026-10-16 local-only directive: the auto-updater surface (the update/install commands with utils/autoUpdater.ts and its UI), cli/transports/ as the SDK transport, the analytics transports")

rep(F, " Next: the in-place CLI blocks, cli/transports/, and the dependency-pruning pass. [W65](ports/W65-account-network.md). |",
    " Step 7t (`19bce58`) removes the stranded in-place CLI blocks: eleven empty statement shells and their stale comments in `main.tsx`, the `claude server`/`connect`/`up`/`rollback` and ant-only registration stubs, six absent-command fast-path comments in `entrypoints/cli.tsx`, `setup.ts`'s empty `COMMIT_ATTRIBUTION` block with its unused `feature` import, and the unchecked `installAsciicastRecorder` import. `git log -S` shows the bodies were absent from the first compilable-base commit (`2148015`), which elided them. The live `claude update`/`install` blocks stay with the auto-updater surface (software distribution, not account network; cutting the commands alone would strand the updater's messages). 3 files, +0/-68. Next: the auto-updater surface, cli/transports/ with `--sdk-url`, the dependency-pruning pass and the `utils/filePersistence/` rename. [W65](ports/W65-account-network.md). |")

print('record ok')
