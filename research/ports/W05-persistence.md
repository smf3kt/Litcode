# W05 durable resource subscriptions

Status: verified finite persistence slice. Date: 2026-10-12.

Task chain: subscribe A/B -> unsubscribe B -> exit/resume pinned journal -> restore A before task -> unsubscribe A -> resume empty -> transient restore failure retains journal -> retry -> fork empty -> resume original -> real SIGKILL/dead-lock recovery.
Entry: features.mcpPersistence AND mcpRecovery AND mcpSubscriptions must all be true; absent/false retains historical connection-local behavior. Runtime.bindSession binds one journal before any owned subscription tool executes.
Targets: session.ts, mcp-session-subscriptions.ts, mcp.ts, mcp-subscriptions.ts, runtime.ts, interactive.ts, cli.ts and mcp-http.ts.

## Provenance and implementation choice

Classification: rewrite. No recovered durable resource-subscription journal algorithm was established. Source observation is bounded lifecycle/listener metadata, already digest-verified in W02 and W05-recovery; adapting the existing owned connection manager and JSONL session journal preserves product ownership instead of inventing upstream equivalence.
Artifact SHA-256: c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Module chunk-sb190ksj.js SHA-256: 0a1c2aa1424babd95eeec371f67c875b6382db0c891b3b3e90f710f2102b16df. Zo/ka UTF-8 byte ranges [48080,48170)/[48170,48515); Aa/Ia/js/Oa [48515,48913)/[48913,50441)/[50441,50690)/[50690,51588).
Module chunk-8sj9gbsq.js SHA-256: 86e5e1c62a4509d1ead03e93cea5a61bcecd910fc4f06ec218b653528b975704. UMo/de UTF-8 byte ranges [8755,9928)/[10045,13327). All ranges zero-based, left-closed/end-exclusive; no recovered entrypoint executed.

## Owned contract

- Server identity hashes canonical pinned workspace/server definition; restore validates every event digest, exact URI, configured server and32URI/4096UTF-8-byte bounds. Restore appends no duplicate acknowledgement.
- Current transport validates object reply before synchronous journal append/fsync. Acknowledged remote membership and desired intent survive append failure, then all managers in the binding block mutations/reconnect/candidate replay. Poll remains diagnostic.
- Journal write/fsync is not an atomic transaction with the remote RPC. A failed fsync may leave complete bytes on disk absent from Session.events; failure never becomes success. Inspect/reconcile the journal before creating a new connection; process/power failure between acknowledgement and journal commit may retain prior durable intent. No automatic remote rollback or claim of exactly-once distributed effects.
- New owner uses fresh connection and own journal; direct other-owner subscription/poll/reconnect calls fail before effects. Accepted replacement outlives old runtime; pending initialization follows close/release and cleans up fresh. File rewind can rebind after releasing old owner.
- Interactive resume/reload/model/permissions/fork/clear/history/workspace transitions bind before acceptance. File rewind still quiesces workers and restores files before journal binding; binding failure retains old selected journal/runtime but already-applied file effects and released workers remain.
- Transient startup failures seed desired intent before automatic recovery; fatal stdio retains desired intent for explicit reconnect. Notifications remain transport-local and are not replayed; no resource auto-read, tool-call replay or credential values in evidence.

## Acceptance and delivery

Final npm run check and npm run build exit0. Full npm test1027/1027, fail/cancel/skip0,41843.799208ms. Compiled actual CLI --sigkill:3groups,37scripted local requests,17generations,19acknowledged mutations,10primary journal events,16DELETEs (killed transport exempt); fork/resume/digest/restore-before-model/no-replay/credential/lock contracts passed. Source driver previously passed at its pre-review identity; corrected final compiled acceptance is authoritative.
Existing tests extended for journal poison and stdio desire; two journal helper tests and one combined actual HTTP lifecycle/owner test. This package adds6focused tests total; no duplicate test-only implementation. Final fsync fixture was refined after full-suite acceptance: the9/9 focused run verifies that final test identity; product sources/build remain unchanged. The evidence keeps both scopes explicit.
Production package smoke passed58files with installed launcher fixtures, offline install/demo and0upstream requests. Current source/runtime archives: release/litcode-source-persistence and release/persistence-runtime. Complete final content/build identity, frozen driver digest, verification receipts and source rebuild result: [W05-persistence-evidence.json](W05-persistence-evidence.json).

Whole MCP family remains Partial: tasks, sampling media/URL flows, original park/refetch, event replay, power-loss acknowledgement/journal reconciliation and original behavioral equivalence remain unverified. No paid model call or external management mutation in this package.

That list is this package's landing-time reading of the family, not its current state. Most of it has since been closed by later W05 packages: the task family (foreground driver, standard results, GET-dispatched inputs, durable handles) and the sampling media and block/array flows all landed, power-loss acknowledgement and journal reconciliation landed with the durable task package, and parked list_changed refetch and next-turn redial are decided in `ports/remaining-dispositions.md`. What the current FEATURES rows still record as gaps is lost-event replay, URL elicitation and the `subscriptions/listen` parked-refetch stream; `CURRENT.md`'s W05 row and those rows are authoritative for the family's status, and no full-family behavioral equivalence to the original is claimable in any case.
