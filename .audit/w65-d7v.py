# -*- coding: utf-8 -*-
"""Wave D step 7v research record: four files, one commit."""
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
## Wave D step 7v — the CCR v2 session-state residue (`d66887e`, landed)

**Every hook removed here had one producer, and it left in 7u.** `RemoteIO` registered `setSessionStateChangedListener` and `setSessionMetadataChangedListener` on `CCRClient`, and under `CLAUDE_CODE_USE_CCR_V2` it registered the sessionStorage internal-event reader and writer. Nothing else in the tree calls those setters. Without a registration the listeners can never fire, `hydrateFromCCRv2InternalEvents` only ever takes its no-reader arm, and the print-mode CCR resume branch is unreachable except through an env var that can no longer change the outcome.

**The local surface is what remains.** `notifySessionStateChanged` keeps its `currentState` tracking and the opt-in `session_state_changed` SDK event, now taking the state alone; the pending-action and task-summary external_metadata mirrors go with the metadata listener. `notifyPermissionModeChanged` and the print.ts listener stay: that is the SDK status stream's single choke point, and `onChangeAppState`'s mode diff folds to it (the externalized-mode comparison and `notifySessionMetadataChanged` are gone, so `toExternalPermissionMode` leaves this file with its last reader here). `SessionExternalMetadata` and `externalMetadataToAppState` leave with the restore path. `RequiresActionDetails` stays: it is the SDK control protocol's `can_use_tool` context, built by `buildRequiresActionDetails` and carried by `onPermissionPrompt`, and its only deleted use was the external_metadata mirror.

**Session persistence folds to the local file.** `persistToRemote` had one arm — the internal-event writer — so it and its call site are deleted, along with the writer/reader types and accessors, the fast flush interval and `hydrateFromCCRv2InternalEvents`. `recordTranscript`, `enqueueWrite`, `flushSessionStorage` and the loaders are untouched; the transcript was always written locally, the remote path was the mirror.

**Resume keeps its local arms.** `parseSessionIdentifier` drops the URL arm and the `ingressUrl`/`isUrl` fields; a JSONL path and a plain UUID remain. The print-mode empty-result branch loses its `isUrl || CLAUDE_CODE_USE_CCR_V2` case, so a resume with no transcript reports `No conversation found` and exits 1 — the source's own error path, now the only one. The `runPhase` states `finally_flush`/`finally_post_flush` and the `internal_events_pending` log field go with the flush; the other phases and `worker_status` stay.

### Port coordinate refresh

Four historical evidence files moved, all by re-running their own fixtures: `w65-d7f`, `w65-d7j`, `w65-d7k` and `w65-d7u`. `portSha256` only; no `sourceSha256` changed and no range moved.

### Verification

tsc 0, thirty fixtures pass (the new `w65-d7v-verify` plus twenty-nine carried), `git diff --check` clean, the orphan scan at its ten legitimate entries with the file count unchanged (1623 — this step deletes no module). No carried fixture needed amendment: none of them pinned the removed hooks.

The fixture's base check confirms `e864296` carried every producer and consumer; a whole-tree sweep finds no residue token for any removed name; absence assertions cover the listener slots, `SessionExternalMetadata`, the sessionStorage machinery and the URL arm; survivor assertions pin the SDK state event, the permission-mode choke point, `RequiresActionDetails` with its builder and callback, local transcript writes and UUID/JSONL resume. One repair pass: the first cut passed the retained end anchor as both `new` and `end` in the `persistToRemote` removal and produced a duplicate class close (`TS1005` at `sessionStorage.ts:1157`); the script now uses the plain `cut_between` form, and all six files were restored from `HEAD` before the replay. Three imports lost their last reader with the machinery (`asSessionId`, `logForDiagnosticsNoPII`, `isShuttingDown`) and were removed in the same pass.

**Next (step 7w):** the auto-updater surface (the update/install commands with `utils/autoUpdater.ts` and its UI), then the dependency-pruning pass (nine zero-importer dependencies), the `utils/filePersistence/` rename and the analytics transports.

## Protocol slip (recorded)""")

C = 'research/CURRENT.md'
rep(C, "twenty-nine fixtures pass (four carried pins amended: 7l/7m/7n retired the retained-lane pins, 7t the file count). Thirteen earlier evidence records refreshed digest-only.\n", """twenty-nine fixtures pass (four carried pins amended: 7l/7m/7n retired the retained-lane pins, 7t the file count). Thirteen earlier evidence records refreshed digest-only.

Wave D step 7v (`d66887e`): the CCR v2 session-state residue is folded. Every removed hook was registered only by `RemoteIO` under `CLAUDE_CODE_USE_CCR_V2`, which left in 7u. Deleted: both listener setters with their slots and the external_metadata mirroring in `notifySessionStateChanged`, `notifySessionMetadataChanged` with its three call sites, `SessionExternalMetadata` and `externalMetadataToAppState`, `StructuredIO.restoredWorkerState` with the no-op `flushInternalEvents`/`internalEventsPending`, the sessionStorage internal-event writer/reader with `persistToRemote` and `hydrateFromCCRv2InternalEvents`, the print-mode CCR v2 resume branch, and the URL arm of `parseSessionIdentifier`. The local surface stays: the opt-in `session_state_changed` SDK event, the permission-mode choke point, `RequiresActionDetails` with `buildRequiresActionDetails` and `onPermissionPrompt`, local transcript persistence, and UUID/JSONL resume. 6 files, +44/-442; tsc exits 0; thirty fixtures pass (none amended). Four earlier evidence records refreshed digest-only.
""")

S = 'research/STATUS.md'
rep(S, "twenty-nine fixtures pass (four carried pins amended); thirteen earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).\n",
"""twenty-nine fixtures pass (four carried pins amended); thirteen earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).

Wave D step 7v (`d66887e`) removes the CCR v2 session-state residue the transport lane fed: `setSessionStateChangedListener`/`setSessionMetadataChangedListener` with their slots and the external_metadata mirroring, `notifySessionMetadataChanged` with its call sites, `SessionExternalMetadata` and `externalMetadataToAppState`, `StructuredIO.restoredWorkerState` and the two no-op internal-event methods, the sessionStorage internal-event writer/reader with `persistToRemote` and `hydrateFromCCRv2InternalEvents`, the print-mode CCR v2 resume branch with its `restoredWorkerState` option and `finally_*` run phases, and the URL arm of `parseSessionIdentifier` (a URL resume now reports `No conversation found`). The SDK status stream (`notifySessionStateChanged`'s opt-in event, `notifyPermissionModeChanged`), `RequiresActionDetails` with `buildRequiresActionDetails`/`onPermissionPrompt`, local transcript persistence and UUID/JSONL resume stay. 6 files, +44/-442; tsc exits 0; thirty fixtures pass (none amended); four earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).
""")

F = 'research/FEATURES.md'
rep(F, "Remaining under the 2026-10-16 local-only directive: the auto-updater surface (the update/install commands with utils/autoUpdater.ts and its UI), the CCR v2 session-state residue the transports fed, the analytics transports",
    "Remaining under the 2026-10-16 local-only directive: the auto-updater surface (the update/install commands with utils/autoUpdater.ts and its UI), the analytics transports")

rep(F, " Next: the CCR v2 session-state residue, the auto-updater surface, the dependency-pruning pass and the `utils/filePersistence/` rename. [W65](ports/W65-account-network.md). |",
    " Step 7v (`d66887e`) folds the CCR v2 residue the transports fed: both listener setters with the external_metadata mirroring, `notifySessionMetadataChanged`, `SessionExternalMetadata`/`externalMetadataToAppState`, `StructuredIO.restoredWorkerState` and the no-op flush pair, the sessionStorage internal-event writer/reader with `persistToRemote`/`hydrateFromCCRv2InternalEvents`, the print-mode CCR v2 resume branch, and the URL arm of `parseSessionIdentifier`. The SDK status stream, `RequiresActionDetails` and local transcript persistence stay; a URL resume now takes the source's `No conversation found` error path. 6 files, +44/-442. Next: the auto-updater surface, the dependency-pruning pass, the `utils/filePersistence/` rename and the analytics transports. [W65](ports/W65-account-network.md). |")

print('record ok')
