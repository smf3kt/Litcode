# -*- coding: utf-8 -*-
"""Wave D step 7u research record: four files, one commit."""
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
## Wave D step 7u — the SDK transport lane (`e864296`, landed)

**RemoteIO was a second I/O implementation, not a helper.** `--sdk-url` passed a session URL to `new RemoteIO(url, inputStream, replayUserMessages)`, which opened a WebSocket (or SSE with `CLAUDE_CODE_USE_CCR_V2`, or WS-reads/POST-writes with `CLAUDE_CODE_POST_FOR_SESSION_INGRESS_V2`) to that URL, streamed control traffic over it, and under CCR v2 registered the internal-event reader/writer plus the session-state, session-metadata and command-lifecycle listeners against `CCRClient`. The nine files under `cli/remoteIO.ts` and `cli/transports/` exist for that connection alone.

**The local path is StructuredIO, and it does not need any of it.** `getStructuredIO` had exactly two arms; the second was plain `StructuredIO` over the same `inputStream`, and every local print-mode feature — `replayUserMessages`, control_request/response handling, SDK MCP servers, elicitation — is implemented on `StructuredIO` itself. With the RemoteIO arm gone, the function returns `StructuredIO` unconditionally, and `--sdk-url`'s only justification (auto-setting stream-json, verbose and print, skipping UUID validation for server-assigned tagged IDs) disappears with the option. The option registration, `hasSdkUrl` in the early non-interactive predicate, the extraction, the format auto-set, the validation block and the pass-through all go; the session-ID validation is unwrapped back to unconditional.

**Every survivor is local.** `services/mcp/SdkControlTransport.ts` (the in-process SDK control channel), `utils/mcpWebSocketTransport.ts` (the MCP client's own WebSocket transport, imported by `services/mcp/client.ts`), `--init-only` and the non-TTY term of the interactive predicate stay. Four comments that named the removed classes were reworded: `gracefulShutdown`'s SIGINT note, `cliHighlight`'s DOM-types note, `caCertsConfig`'s bundle-size note and `userAgent`'s dependency-free note.

**What the transports fed is now producerless and waits for 7v.** `setSessionStateChangedListener`/`setSessionMetadataChangedListener` had RemoteIO as their only caller, and the CCR v2 branch of print-mode `--resume` reaches `hydrateFromCCRv2InternalEvents` only after RemoteIO registered a reader. Those, `structuredIO.restoredWorkerState`, `externalMetadataToAppState` and the URL arm of `--resume` are recorded as the next cut rather than folded here, because each needs its own source read.

### Port coordinate refresh

Thirteen historical evidence files moved, all by re-running their own fixtures: `w65-d7f`, `w65-d7h`, `w65-d7i`, `w65-d7j`, `w65-d7k`, `w65-d7l`, `w65-d7n`, `w65-d7o`, `w65-d7p`, `w65-d7q`, `w65-d7r`, `w65-d7s` and `w65-d7t`. `portSha256` only; no `sourceSha256` changed and no range moved. `w65-d7n`'s ccrClient port coordinate becomes null with the file.

### Verification

tsc 0, twenty-nine fixtures pass (the new `w65-d7u-verify` plus twenty-eight carried), `git diff --check` clean, the orphan scan at its ten legitimate entries with the file count down by nine to 1623. Four carried fixtures were amended, each a pin this step supersedes: `w65-d7l`, `w65-d7m` and `w65-d7n` pinned the transport lane as retained (7n's whole no-headers section becomes an absence assertion, and its ccrClient port coordinate is retired), and `w65-d7t` pinned the 1632 file count, now 1623 with the orphan set unchanged.

The fixture's base check confirms `19bce58` carried all nine files and the option; the current tree has no `--sdk-url`/`sdkUrl` token, no `remoteIO` import, and a direct `StructuredIO` return; survivor assertions pin `replayUserMessages`, the MCP WebSocket transport, the SDK control transport and `--init-only`, and the four rewritten comments. Two repair passes: the first cut matched `sdkUrl: string | undefined` twice in `print.ts` (the print options type and `getStructuredIO`'s narrowed parameter), so the type cut is anchored on the preceding field; the `userAgent` comment was found after a complete pass, so every touched and deleted file was restored from `HEAD` and the script replayed to reproduce the final state in one pass.

**Next (step 7v):** the CCR v2 session-state residue (the two listener setters, the sessionStorage internal-event writer/reader with `hydrateFromCCRv2InternalEvents`, `structuredIO.restoredWorkerState`, `externalMetadataToAppState` and the URL arm of `--resume`), then the auto-updater surface, the dependency-pruning pass and the `utils/filePersistence/` rename.

## Protocol slip (recorded)""")

C = 'research/CURRENT.md'
rep(C, "twenty-eight fixtures pass (none amended). Ten earlier evidence records refreshed digest-only.\n", """twenty-eight fixtures pass (none amended). Ten earlier evidence records refreshed digest-only.

Wave D step 7u (`e864296`): the SDK transport lane is gone. `--sdk-url` selected `RemoteIO`, which opened a WebSocket/SSE session to the given URL and under CCR v2 registered the internal-event reader/writer and the session-state, metadata and command-lifecycle listeners against `CCRClient`. Deleted with it: `cli/remoteIO.ts`, `cli/transports/` (WebSocket, SSE, Hybrid, `CCRClient`, the two uploaders, `Transport`, `transportUtils`) — nine files, 3447 deleted lines — the `--sdk-url` option with its auto-format block, validation and UUID-check bypass, the `sdkUrl` print option, `isUsingSdkUrl`, the stdio permission-prompt override and the RemoteIO arm of `getStructuredIO` (which now always returns `StructuredIO` over stdin). The local stream-json surface, `services/mcp/SdkControlTransport.ts`, the MCP WebSocket transport and `--init-only` stay; four comments that named the removed classes were reworded. 15 files, +27/-3449; tsc exits 0; twenty-nine fixtures pass (four carried pins amended: 7l/7m/7n retired the retained-lane pins, 7t the file count). Thirteen earlier evidence records refreshed digest-only.
""")

S = 'research/STATUS.md'
rep(S, "ten earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).\n",
"""ten earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).

Wave D step 7u (`e864296`) removes the SDK transport lane: `--sdk-url` (registration, non-interactive predicate, extraction, format auto-set, validation, UUID-validation bypass and pass-through), `cli/remoteIO.ts`'s `RemoteIO` (URL-derived headers, transport selection, CCR v2 client wiring, internal-event registration, the three session listeners) and all of `cli/transports/` (WebSocket, SSE, Hybrid, `CCRClient`, `SerialBatchEventUploader`, `WorkerStateUploader`, `Transport`, `transportUtils`). The local print-mode path is unaffected: `getStructuredIO` returns `StructuredIO` over stdin unconditionally, and `replayUserMessages`, the control protocol, SDK MCP servers, `SdkControlTransport`, the MCP WebSocket transport and `--init-only` stay. The CCR v2 state the transports fed (`setSessionStateChangedListener`/`setSessionMetadataChangedListener`, the sessionStorage internal-event writer/reader with `hydrateFromCCRv2InternalEvents`, `restoredWorkerState`, `externalMetadataToAppState`, the URL arm of `--resume`) is producerless and recorded as step 7v. 15 files, +27/-3449; tsc exits 0; twenty-nine fixtures pass (four carried pins amended); thirteen earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).
""")

F = 'research/FEATURES.md'
rep(F, "Remaining under the 2026-10-16 local-only directive: the auto-updater surface (the update/install commands with utils/autoUpdater.ts and its UI), cli/transports/ as the SDK transport, the analytics transports",
    "Remaining under the 2026-10-16 local-only directive: the auto-updater surface (the update/install commands with utils/autoUpdater.ts and its UI), the CCR v2 session-state residue the transports fed, the analytics transports")

rep(F, " Next: the auto-updater surface, cli/transports/ with `--sdk-url`, the dependency-pruning pass and the `utils/filePersistence/` rename. [W65](ports/W65-account-network.md). |",
    " Step 7u (`e864296`) removes the SDK transport lane: `--sdk-url` with its auto-format block, validation and UUID-check bypass, `RemoteIO`, and `cli/transports/` (WebSocket, SSE, Hybrid, the CCR v2 client and its uploaders) — nine files, 3447 deleted lines. The local path is untouched: `getStructuredIO` now always returns `StructuredIO` over stdin, and `SdkControlTransport`, the MCP WebSocket transport and `--init-only` stay. Four comments naming the removed classes were reworded; four historical fixtures had pinned the lane as retained and now assert its absence (7l/7m/7n) or the new 1623 file count (7t). 15 files, +27/-3449. Next: the CCR v2 session-state residue, the auto-updater surface, the dependency-pruning pass and the `utils/filePersistence/` rename. [W65](ports/W65-account-network.md). |")

print('record ok')
