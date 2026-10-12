# W05 standard task results

Status: verified finite foreground requestor. Date: 2026-10-12.
Task: negotiated task-augmented tools/call -> CreateTaskResult.task -> tasks/get polling -> terminal or input_required tasks/result -> existing roots/form reverse RPC -> correlated original tool content -> journal/resume without effect replay.
Entry: features.mcpStandardTasks optional authored/managed/pinned; defaults absent/false. Existing features.mcpTasks remains separate extension. Targets: mcp-standard-task.ts, mcp.ts, mcp-http.ts, mcp-client-requests.ts, runtime/cli/session.

## Source facts and port decision

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All recovered coordinates zero-based UTF16, left-closed/end-exclusive; modules are inert.
- chunk-3d69zma1.js digest efb80057e2fa0526d212ff27e36f3ca3ff97b8e232a3ca41b4446e5c9dd93bb9: _ve/z2r/AX[751,849) version2025-11-25; Q/X[2846,3132) task capabilities; request task/related metadata[995,1230); at/g/Dme/Vjt/Hyn/Myn/Dyn/ae/Lyn/Nyn/Fyn/K2r[4354,4964) task/get/result/cancel; Rt/Uyn/Lme/ft/UU[7353,8107) tool execution taskSupport/call.
- chunk-5aypb49d.js digest949ebffb96a5c4bba3013f2ff2e29524ff06bc8288326f541a68a977946a1e2d: Wjt.requestStream[20550,21675) task creation/get/result/input_required/default1000 poll; request[21675,23626) params.task, task helpers[23626,23948), Ayn[28658,28907) capability check.
- chunk-4vr415ka.js digest01c2a556237e9a957f29cd7de89b228439e6621ea982a0b5b0bd10be4cd20580: Bt[18778,20012) task tool stream; Rt.connect[24091,24898) version/capabilities; task capability handlers[27119,27313); callTool/isToolTask/cache/list[28193,29810).
Verified actual module digests match extracted provenance. Direct declaration dependencies schema primitives/date validators; no attempt to execute recovered transport/validator factories.

Classification: adapt finite SDK requestStream and tool task metadata behavior, with owned transport/error/timers replacing SDK class graph. Not a wholesale original SDK copy: async generator events become foreground result/error, bounded250..30000poll/5retry/wholedeadline added, finite timestamps/TTL and exact task IDs enforced; SDK direct failed/cancelled errors adapted to retrieve original result per normative protocol. No recovered entrypoints executed.

Normative reference: https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks (read2026-10-12): tasks introduced2025-11-25 experimental; server request capability plus tool-level required/optional/forbidden; CreateTaskResult wrapper, tasks/result original payload, input_required opens result stream, task result/reverse messages carry io.modelcontextprotocol/related-task. Official facts have separate authority from sample static observation.

## Owned finite contract

HTTP and stdio offer2025-11-25 only when enabled; default versions remain unchanged. Older accepted versions stay normal calls except required tasks fail before effects. Client advertises tasks:{} with no receiving requests/list/cancel operations. Server tools/call capability plus parsed/pinned execution.taskSupport decides augmentation. Replacement metadata drift requires rediscovery; no auto tools/call fallback/retry.

Task fields validate originaltaskId, status, RFC3339created/updated, finite nonnegative ttl|null and pollInterval; host IDs bounded128printable chars. Createdtask mustworking. Polls/get/result/cancel use ordinary transport/session/auth without extension Mcp-Name header. Input_required opens tasks/result and lets POST SSE/stdio handle existing reverse requests; result content/isError/relatedtask validated. Failed/cancelled terminal tasks retrieve original result instead of inventing successful tool payload.

Each active task is registered through the synchronous validated tools/call reply hook before the next frame is dispatched. Independent review reproduced a same-chunk stdio creation+roots ownership race in the first implementation; both transports now register synchronously and release even if the initial request later fails. Existing stdio smoke now emits both frames in one write and verifies the reply before completing tasks/get. Related requests with absent/wrong ownership fail before callback; successful and error replies preserve correlation. Release cancels pending related callbacks; close clears owned tasks. Noncooperative host callbacks retain concurrency slot until actual settlement as existing contract. Whole drive caller/connection/deadline-owned; five-second cancellation is best effort only if server advertises cancel. Transportloss/expiredtasks/cleanupfail may leave remote effects unknown; no backgroundtaskjournal or crossprocessreattachment.

GET stream still dispatches notifications only; servers delivering input exclusively via GET, arrayclientoutputs, task-augmented sampling/elicitation receiver, task listing, full outputSchema validation/progressUI and broad2025-11-25features remain gaps. Enabling taskrequestor does not claim every new protocol feature is implemented.

## Acceptance

Two new combined regressions: version/capability/create/get/result/correlation/poll/cancel and relatedcallbackownership/release/metadata. Focused21/21 passed1489.946708ms. Existing actual task smoke reused with --standard: source+compiledHTTP/stdio, roots/form resultstream, task mismatch/result mismatch, terminalerror,userabort,lifetimeclose,legacy normalcall,pinnedresume and no replay passed; each3ownedCLI modelrequests,2activecancel acknowledgements,5DELETEs. Existing extension compiled chain separately passed3requests. After the synchronous ownership fix, final compiled chain passed3localrequests and final installedpackage60files passed0upstream calls. Final full1036/1036 passed44323.619958ms with0fail/cancel/skip; source188files independently rebuilt53files byte-identically after offline install/check/build. Earlier focused/source/extension checks retain their pre-review scope. Final source/runtime identity: [W05-standard-tasks-evidence.json](W05-standard-tasks-evidence.json).

First full1036run had1existing async-hook descendant observation failure, isolated run passed; PID fixture previously acceptedempty child.pid, now waitsnonempty and assertspositivePID, productasync-hook unchanged. Intermediate failure retained. The first adjacent-frame smoke also used a hardcoded tasks/get RPC ID; the fixture now saves the actual ID and waits for the correlated roots response. The final compiled smoke passed after that fixture correction.
