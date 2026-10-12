# W05 GET related task inputs

Status: verified finite GET task input chain. Date: 2026-10-12.
Entry: features.mcpStandardTasks + features.mcpNotificationStream -> negotiated2025-11-25 -> related roots/form on owned GET SSE -> existing owner/validation/callback -> bounded POST answer -> tasks/result -> journal/pinned resume without tool replay.
Targets: src/mcp-http.ts, src/mcp.ts; existing task smoke and one combined regression. No new configuration flag, task receiver or event replay.

## Source and port decision

Sample SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Modules read as inert data, digests verified; coordinates zero-based UTF16, end-exclusive.
- chunk-dt139v0s.js, SHA-256117ba6c8aea10b37caf2eb4a53724f458445f22c3880aba82a499b53634e4f3f: jmn._startOrAuthSse[2336,2866), _handleSseStream[3568,4555) with validated dispatch[3936,4027), send[5228,7561) with POST[5545,5698) and reply-body release[7042,7524).
- chunk-5aypb49d.js, SHA-256949ebffb96a5c4bba3013f2ff2e29524ff06bc8288326f541a68a977946a1e2d: Wjt.connect dispatch[15978,16205), _onrequest[17015,19292), same-id success/error reply[18570,19104).
Direct dependencies include schema aL/vq/ite, SSE parser MBt, generic request dispatcher and transport.send. Recovered auth and task message-queue backends are excluded from this finite chain.
Classification: adapt dispatch/reply behavior to existing owned SSE/parser/host handler. Original generic dispatch includes all RPC families and task queues; this adaptation accepts only related roots/form under explicit gates, ignores RPC responses, uses existing validation/owner and fixed bounded reply transport. Existing five GET-only reopens remain; resumptionToken/last-event-id and message-queue replay are not ported. No recovered entrypoints executed.

## Finite ownership contract

GET requests must have an id, roots/list or elicitation/create method and related-task metadata. Existing handler rejects absent/foreign/expired ownership and malformed params before host effects; callbacks retain their own deadline/concurrency slots. Reading never awaits callback completion, so GET cancellation notifications can interrupt pending inputs. Task release and connection close abort callbacks; stream EOF/idle does not replay them. Detached reply failures follow existing POST callback behavior and leave remote delivery unknown. Ordinary GET requests/sampling/response envelopes remain ignored. The client advertises only existing roots/form capabilities and task requestor capability.

## Acceptance

Command: npm run smoke:mcp-tasks -- --standard --get --compiled. GET-only roots/form inputs, POST answers, HTTP/stdio tasks, user cancellation, close, fixed snapshot resume and no tools/call replay. Four GET streams/four closed, five DELETEs, three owned scripted model requests; zero paid upstream calls.
One combined regression covers zero-effect absent/foreign/invalid ownership, unassociated/sampling ignore, correlated form and cancellation replies, late input after task release, noncooperative callback cancellation on close. Existing notification-only legacy regression remains unchanged. Focused49/49 passed6493.297625ms; final full1037/1037 passed42721.099458ms with0fail/cancel/skip; check/build passed. Initial added fixture needed optional-signal narrowing and allowShell context field; corrected before tests ran, no product error. Final identity/results: [W05-get-task-inputs-evidence.json](W05-get-task-inputs-evidence.json).

Remaining: generic GET reverse RPC, task receivers/list/progress/outputSchema, durable task reattachment, audio and event replay. Prior60file distribution/188file source archive belongs to the standard-task package; this package validates current source/build and does not replace that archive.
