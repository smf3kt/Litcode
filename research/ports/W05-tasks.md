# W05 foreground MCP task driver

Status: verified finite foreground task extension. Date: 2026-10-12.
Task chain: tool returns resultType/task -> poll working/input-required -> roots/form callback -> cached tasks/update -> terminal inline content -> normal tool journal -> exit/resume without tools/call replay. Separate malformed/unsupported/user-abort cases send cancellation; transport close fences waiting work.
Entry: authored/managed/pinned features.mcpTasks=true; absent/false keeps legacy transport behavior. Targets: mcp-task.ts, mcp.ts, mcp-http.ts, mcp-client-requests.ts, runtime.ts, cli.ts, session.ts.

## Source and classification

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Recovered chunk-f79f00pg.js digest73d50b557ed49b7de0783b46a8f6804d5c45068cd92317c413d821948032b421 verified before reading; module remains inert and unchanged. Coordinates zero-based UTF-16 left-closed/end-exclusive. Core ojr/driveMcpTask[3621,7532), hyt[3012,3064), error classification[3064,3581), m/Pjs task schemas[968,1451), W/B input/status[2297,2925).
App chunk-sb190ksj.js digest0a1c2aa1424babd95eeec371f67c875b6382db0c891b3b3e90f710f2102b16df; co[176157,190043), foreground ie[181833,182950), hd[174994,175303), Si[175303,176157).

Classification: adapt. Core state machine is ported from recovered ojr with host-bound imports and callbacks replaced. Preserved250..30000ms/default2000 poll clamp,5consecutive failure reset,16distinct served keys, cached answers across update retry, JSON-RPC classification, re-poll after rejected answer and terminal inline result. Remote status/error text is omitted from fixed errors to avoid payload echoes; every poll must match original taskId and numbers must be finite. Core returns completed result or typed error instead of an upstream tagged outcome. Owned abortable timers and promise races replace Q; no recovered module execution.

Direct recovered imports and digest provenance:
- chunk-fdwn5gdv.js p lazy initialization: bdd8f0094eb4fcd0daa8d9fa47261b47d4a0384894c1701f74ba72b338a9be11; replaced by direct owned schemas.
- chunk-yjc18bey.js Q abort-aware wait: e53a75c48188dd5f345841ef87e452840622f9d61bc86e97b2edea656866a687; replaced by owned bounded timers/listener cleanup.
- chunk-3y0g37cq.js qG error text: f73e433ea4b9f71c95e5c77bb108e9549c801fe36bd8c0c6fe8fab00cf53ad14; replaced by fixed errors.
- chunk-1x8a5y5q.js dot5000: f5d347bdcf02b5c8cf85f50b80517b92d3280cfd877c2cf4b8db98b50aa4002e; finite cleanup preserved.
- chunk-e0gkzwq9.js Wye128/Yz printable ASCII:57b301aedba5e423b021a519b7f5b9ee843ece7302c80f7869a3748162b13f51; bounds preserved.
- chunk-9cmjz7j9.js schema combinators:b53bbec49850f84dc20d0be70515e2222c6634265e98e1a062324e656d51b5f2; replaced by installed zod.
Dependency symbol ranges beyond core/app remain unreviewed; no claim that dependency implementations were copied.

## Host adaptation and boundaries

Single initial tools/call then tasks/get/update; tools/call never retried by this driver. Only roots/list and elicitation/create task inputs match recovered Si; use existing strict handler/callback deadline/capacity and independently correlated task input IDs. Headless form returns existing cancel response. No sampling input/model task callbacks.
HTTP uses protected Mcp-Name task routing, existing auth/session/protocol and body bounds; configured headers may not override task routing. Stdio has noheaders and uses taskId. Whole drive bounded by requestTimeoutMs default30s and transport close; source background driver/hourly lifecycle not ported. Original fire-and-forget cancellation adapted to awaited best-effort5s cleanup. Transport already closed/failed may prevent cancel delivery; local ownership still ends. Failed polls/update exhaustion can leave remote task running, as source; no terminal state falsely asserted. Excess input keys ignored after16, with whole deadline ending unresolved waiting.

This extension uses resultType/task handle, tasks/update and inline completed result. Standard SDK task-wrapper/tasks/result is separate; no protocolversion promotion, extra server capability guess, standardtask feature negotiation, background journal/rebinding or task-id resume added.

## Validation and delivery

Two new combined driver tests cover clamp/retry/cache/key caps/terminal validation/error hygiene and cancellation at wait/poll/input/update with5s noncooperative cleanup. Original80consumer run passed before timer refinement; final full-suite record supersedes the timing scope. First full run found5legacy limit-reference regressions, fixed by preserving original arrays when task mode is absent. Later full runs had1unrelated Git shim startup failure at500ms while isolated standard-launcher run passed; fixture-only timeout now1500ms still verifies real timeout and descendant reap. Product worktree code unchanged; all intermediate failures retained in evidence. Owned source and compiled actualCLI pass HTTP/stdio, roots/form, mismatch/unsupported cancellation, userabort, lifetimeclose, absent gate, fixed resume and no completed tool replay. Compiled3scripted model requests,3confirmed active-transport cancels,5DELETEs;0paid calls. Check/build and59file installed package exit0. Final suite1031/1031, fail/cancel/skip0,42877.631583ms. Source186files offlineinstall/check/build succeeded with52build files byte-identical; archives release/tasks-runtime and release/litcode-source-tasks. Final full-suite and identity receipts: [W05-tasks-evidence.json](W05-tasks-evidence.json).

Remaining: standard task/result protocol, background/durable reattachment, real remote service equivalence, original progress UI and cancellation after transport loss. MCP family stays Partial. Of these, the standard task/result protocol landed with ports/W05-standard-tasks.md and durable reattachment with ports/W05-durable-tasks.md; real remote service equivalence, the original progress UI and post-transport-loss cancellation remain, and CURRENT.md's W05 row is authoritative.
