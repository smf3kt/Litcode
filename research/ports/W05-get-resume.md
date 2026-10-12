# W05 GET stream resume

Status: verified finite resume chain. Date: 2026-10-12.
Task: the owned HTTP GET SSE stream records the last event id it saw, replays it as the last-event-id request header on reopen, honors the server SSE retry delay over the local backoff table, and exposes the token through the notification-stream status. Payload replay itself stays the server responsibility and a stream that carried a client request is still never reopened.
Entry: features.mcpNotificationStream plus features.mcpRecovery (CLI); no new authored setting.
Targets: mcp-http.ts SseParser, fetchMessage, scheduleNotificationReopen, readNotificationStream; mcp.ts status type and limits text; regressions in mcp-notification-stream.test.ts; smoke fixture in smoke-mcp-tasks.mjs.

## Provenance and adaptation

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Inert module chunk-dt139v0s.js SHA-256 117ba6c8aea10b37caf2eb4a53724f458445f22c3880aba82a499b53634e4f3f, 8232 UTF-16 code units. Ranges are zero-based UTF-16, left-closed/end-exclusive: last-event-id header [2465,2505), _getNextReconnectionDelay [2866,3151), _handleSseStream resumption [3609,4219), SSE retry hook [3741,3780). These are source declarations, not runtime observation.

Classification: transport behavior copy. The recovered transport stores the last event id per stream, reports it through its resumption callback, re-sends it as last-event-id on the reconnect request, and lets a server-supplied SSE retry value replace its exponential delay; the SDK's optional caller-supplied replayMessageId is not part of this port because the harness exposes no such option. The SSE parser previously ignored id and retry fields outright, so both are now parsed under the same per-event bounds. No recovered entrypoint was executed.

## Contract and boundaries

A bare SSE id field clears the token, so the next stream starts without last-event-id. The retry value is accepted only when it is a non-negative safe integer and is clamped to 30 seconds. The reopen budget stays at five GET-only reopens per transport lifetime and a stream that carried a client request is still never reopened, so an in-flight reply cannot be replayed client-side. Rejected during development: refusing a replayed client request id on the resumed stream. The recovered transport has no such dedupe, and the guard broke the real CLI standard and durable chain, which reuses an id for a new input request; replay policy therefore stays with the server, and the limits text says so.

## Validation

Focused mcp-notification-stream.test.ts 6/6 and mcp-standard-task.test.ts 4/4. One new regression proves a notification-only stream that ends reopens with last-event-id equal to the last observed id, that a 60ms server retry beats the 1s default, and that a stream carrying requests is not reopened again; the replayed request on the resumed stream is served by the runtime callbacks. Full 1044/1044, fail/cancel/skip 0 (45189.782667ms); check/build exit 0 (55 build files). Actual CLI: `npm run smoke:mcp-tasks -- --get --compiled` resumes a dropped notification-only GET stream with last-event-id and serves the replayed request on it (3 GETs, 1 resume, roots served), while `--standard --get --durable --compiled` keeps its 6 GET/6 DELETE, SIGKILL, cached-result and no-replay chain. Offline installed package 62 files, 0 upstream requests; 191-file source bundle rebuilt independently to 55 byte-identical build files. Detailed identity and receipts: [W05-get-resume-evidence.json](W05-get-resume-evidence.json).
