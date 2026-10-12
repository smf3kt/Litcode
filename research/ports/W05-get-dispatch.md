# W05 GET client request dispatch

Status: verified finite dispatch chain. Date: 2026-10-12.
Task: an opt-in owned HTTP GET SSE stream delivers every server-to-client request to the same runtime callback contract as POST SSE, and a stream that carried a request is never reopened. Absent callbacks keep answering a bounded -32601, so unconfigured hosts keep their previous behavior.
Entry: features.mcpNotificationStream plus the host callbacks; no new authored setting.
Targets: mcp-http.ts readNotificationStream, mcp.ts GET limits text; regressions in mcp-standard-task.test.ts and mcp-notification-stream.test.ts; CLI smoke modes in smoke-mcp-tasks.mjs.

## Provenance and adaptation

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Inert module chunk-dt139v0s.js SHA-256 117ba6c8aea10b37caf2eb4a53724f458445f22c3880aba82a499b53634e4f3f, 8232 UTF-16 code units. Ranges are zero-based UTF-16, left-closed/end-exclusive: `_handleSseStream` [3568,3589), per-message dispatch [3936,4027), reconnect guard [4056,4219). These are source declarations, not runtime observation.

Classification: transport behavior copy. The recovered SSE handler parses each event, records that a request was seen, forces the replay message id when one is supplied, and hands every message to the single shared onmessage dispatch; its reconnect branch is guarded by that recorded flag, so a stream that carried a request is not resumed. This package copies that shape. The request-side host contract (capability gate, related-task ownership, cancellation, deadlines, bounded replies) is the existing owned contract and was not changed. No recovered entrypoint was executed.

## Contract and boundaries

Requests are dispatched only for messages that carry a string method and an id; responses stay ignored. An unsupported or unconfigured method still receives a bounded -32601 reply, invalid ids and parameters receive -32602, and related-task metadata is validated against active task ownership exactly as on POST. Reading continues after a dispatch so notifications/cancelled can interrupt a pending callback and parallel requests progress. A stream that carried a request is not reopened after EOF, idle deadline or transport failure, so a reply that is still in flight is never replayed; notification-only streams keep the existing finite five-attempt reopen budget. No new size, method or origin surface was added.

## Validation

One new transport regression: an unrelated roots/list on a non-standard connection is served and its ended stream is not reopened, while a notification-only stream still reopens. Two existing stream tests were updated to the new contract instead of asserting the previous skip-GET-requests behavior. Focused 71/71 (6466.072084ms); full 1043/1043, fail/cancel/skip 0 (45170.883041ms); check/build exit 0 (55 build files). Actual CLI: `npm run smoke:mcp-tasks -- --get --compiled` served the unrelated request on a legacy-task connection (2 GETs, all closed) and `--standard --get --durable --compiled` kept its 6 GET/6 DELETE, SIGKILL, cached-result and no-replay chain. Offline installed package 62 files with 0 upstream requests; 191-file source bundle rebuilt independently to 55 byte-identical build files. Detailed identity and receipts: [W05-get-dispatch-evidence.json](W05-get-dispatch-evidence.json).
