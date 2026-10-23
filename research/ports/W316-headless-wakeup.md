# W316 headless dynamic wakeup waiting

Status: verified locally on 2026-10-24, including independent correctness review and the requested provenance-anchor correction. Local commit only; no push.

## Task card

- Entry: a one-shot local CLI model turn arms schedule_wakeup and completes after its input is exhausted.
- Outcome: retain the session for pending dynamic wakeups, deliver each through the same Agent, allow explicit rearm or stop, finish once none remains, and release resources on completion or interruption. Ordinary cron does not keep the headless process alive.
- Shape: headless scheduler ownership plus a parked-since timestamp and bounded original-id notification queue. The existing scheduler remains the pending-task authority.
- Targets: scheduler filter/lease hooks, runtime ownership and selective drain, a local headless waiting adapter, CLI integration, three regression groups and the existing compiled scheduler driver.
- Method: adapt KL.er, KL scheduler options, Zy and the dynamic-wakeup branch of Ap.park to local Agent/runtime/CLI interfaces. Use the source100ms ref'ed parking timer and120000ms overdue grace.
- Gate: source scheduler availability and default-true local wait gate; exhausted owned usage budget, interrupted response, cancellation and shutdown end waiting. Vendor feature services are omitted.
- Checks: source baseline, focused/affected regressions, compiled rearm/stop/cron/interrupt chains, check/build, exact body comparisons, independent review and content identity.
- Boundary: interactive EOF is a different input owner; background shells/teammates/notification parking, remote keep_alive transport and pending-wakeup sidecar are separate. Headless does not invoke the interactive C2o fallback. W301 stays paused.

## Source preflight

Sample2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All coordinates are half-open zero-based UTF-16 code units. Module digests match extracted-v2/manifest.json. Source is read as inert text; recovered entrypoints are never executed.

| Module | SHA-256 | Obtained implementation |
| --- | --- | --- |
| chunk-rx2nah4x.js | cfb79b3b3d580f450f8184e5873a686eb083e9ea3abd4e0a58268425de6acc51 | Zy [87478,87623), nE=120000 at87468, Ap [89082,93532), Ap.park [90210,92849), Ap.announceLongWait [92849,93503), oS [88801,88917), KL.er [484728,484814), scheduler caller [562879,563257), ae [562457,562875), sync resolver [562811,562865), async resolver [562584,562646), completion [558900,560100), input-close body near659273 |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | set [164857,164904), f1 [407432,407477) |
| chunk-vg0mp7xh.js | 5b25db93875a030f456b8f9f6e337a9978bf663ac4e12d0df8fe91c641a8dafc | re-export x0r as createCronScheduler |
| chunk-jrz2zk22.js | da64f780f2b184a92cd87a21d03c8a02ca80ec4124edf791eccd988a67c980a3 | x0r [5233,11476), me [6337,7616), ne [7616,9890), oe [9890,10444), stop/checkNow lifetime |
| chunk-yjc18bey.js | e53a75c48188dd5f345841ef87e452840622f9d61bc86e97b2edea656866a687 | mIr [940,1103), nS [1107,1117), Q [1118,1503), native ref'ed100ms parking and clearTimeout cleanup |

KL.er requires closed input, a live scheduler, the scheduler gate, remaining spend budget and default-true set(). Its scheduler filter admits only kind loop after input closes and leaseFileTasks returns false then. The loading callback admits delivery only while the headless owner is parked, not during a model request. ae also rejects ordinary cron on closed input and preserves pending asynchronous expansion count. This host resolves sentinels synchronously and keeps the original scheduled id through its existing queue claim.

Zy checks only kind loop. A task remains eligible through now <= max(scheduledFor, parkedSince ?? now)+120000. Source tasks lacking scheduledFor remain eligible; this host's dynamic task always has that field. Ap.park waits while that predicate or other owned background work remains and no abort/end-session/shutdown is active, sets runPhase waiting_for_agents and returns Q(100). Its background-shell/teammate/wind-down branches are outside this package. Ap.announceLongWait announces each id once after5000ms using oS's stderr/format/TTY gate. Headless has no C2o idle fallback or tick-in-flight prompt bookkeeping. Completion shuts down Tn and the session.

## Baseline and throughput checkpoint

HEAD0d11065's one-shot CLI binds loading then calls finish immediately after Agent.run. Pending dynamic wakeups are never drained. Source headless waiting is a local owner that already has corresponding Agent and runtime interfaces. One direct in-place writer owns all shared state. Source acquisition and the public baseline block implementation; the pure pending predicate, scheduler ownership, CLI driver and independent review form verifiable units. Model the Domain keeps mode/queue/park state under the session. Sequence Work into Verifiable Units completes the one-shot chain before another package. Project rules override writer fanout. Dedicated Write/Edit remains the documented fallback because apply_patch was verified absent.

## Implementation and source comparison

The prior compiled artifact at0d11065 fails the new retained-process assertion after its first two model requests. It exits after arming the task; the public red result is retained in w316-cli-baseline.txt. Source implementation now lives in headless-wakeup.ts. Its pending predicate retains the inclusive120000ms grace and its100ms native parking timer keeps the invocation alive. Queued dynamic notifications are drained before the pending check so an already-fired slot is not lost. Each original id is claimed immediately before dispatch through the same Agent. The latest result text and cumulative model-call count feed the existing final output adapter. No pending task or a completed tick without rearm ends waiting. Budget exhaustion, abort and a non-successful turn end it too.

Runtime binds a headless owner before model work, uses its live Agent busy reader, excludes ordinary cron and file leasing, and suppresses the separate interactive keepalive. The existing one-shot CLI already has its whole prompt at invocation, so this maps that lane to source closed input from startup. Runtime.loopWakeup is a passive read and drainLoopWakeups selects only dynamic scheduled events, preserving unrelated notifications. Both drains use the shared original sentinel resolver. The scheduler adapts x0r's filter at startup catch-up and delivery, Q at initial/retry acquisition and lease release before the loading guard. Public create/list/delete and current creator handling remain shared. Session release clears the new headless owner set with loading/resource state.

Source KL's feature and dollar-budget gates adapt to the local scheduler feature and existing invocation usage budget. The remote feature service and transport keep_alive frames are excluded. This host's synchronous sentinel read removes the source asynchronous expansion count. Background-task parking, input-stream command delivery and per-turn result envelopes remain outside the one-shot adapter; the owned CLI keeps its existing single final result. A stopped or non-successful result remains the terminal result. The exact-limit completed response retains its existing success status and stops waiting. No recovered body is executed.

Thirteen AST-bound pairs and their module/body/target SHA-256 values, coordinates and diff files are recorded in /Users/mant1ssa/.claude/jobs/c9c17d97/tmp/w316-source-comparison.json. All13 diffs were read. They cover Zy, Ap.park/announceLongWait, KL.er/oS/scheduler/ae/resolver and x0r's delivery, initial lease, retry lease and catch-up filter. These are adaptations to the owned runtime and CLI; the local branch predicates, timing and original-id semantics follow the acquired source. Q/mIr was acquired after the first implementation to confirm the native timer's ref and cleanup details. Its default ref'ed timeout agrees with the chosen Node adapter, and no behavior correction resulted. The delayed dependency verification is retained as a source-preflight shortcoming.

## Validation

- Initial focused headless/keepalive/idle run passes9/9 in w316-focused.txt. Typechecks pass in w316-check.txt, w316-check2.txt and w316-check-final.txt. Builds pass in w316-build.txt and w316-build2.txt.
- Affected scheduler/creator/watcher/idle/wakeup/timing/keepalive/headless/runtime/events/interactive/loop-file run passes125/125 in w316-affected.txt. Three new groups cover the grace boundary, dynamic-only ownership, file bytes and locks, live model loading, other-owner isolation, sentinel resolution, same-Agent rearm/stop, cumulative result, cancellation and budget. The later strengthened owner transition is independently covered by final3/3 in w316-focused-final.txt.
- CLI, advanced, gateway, background-session and migration suites pass43/43 in w316-cli-tests.txt.
- Actual compiled headless drivers pass explicit rearm5 requests, stop-pending5, SIGINT2 with exit130, exact-budget2, and no-rearm3. Logs w316-cli-headless.txt, w316-cli-stop.txt, w316-cli-interrupt.txt, w316-cli-budget.txt and w316-cli-no-rearm.txt. Each preserves seeded ordinary cron bytes and releases file/session locks. No-rearm proves headless adds no interactive fallback.
- Existing compiled headless busy cron passes2 requests, interactive keepalive passes9, and durable watcher/successor passes3. Logs w316-cli-idle-headless.txt, w316-cli-interactive.txt and w316-cli-watch.txt.
- Compiled stream output, final schema and combined stream/schema pass5 requests each in w316-cli-stream.txt, w316-cli-schema.txt and w316-cli-stream-schema.txt. Each emits one final result with cumulative calls and the final structured value when requested.
- Independent correctness review verified core source module hashes, passed3/3 headless tests and the compiled no-rearm3-request chain, and confirmed already-fired queue/claim/count behavior with an additional probe. It found no scoped correctness defect. Its last supplemental abort assertion expected the supplied reason at the top level instead of AbortError.cause; cancellation occurred and its finally cleaned up, but explicit release assertions after the failed check were unrun. Main's actual SIGINT chain separately verifies final cleanup. The review's outstanding machine-output and live-lease-transition coverage was completed by the explicit main checks above.
- Independent comment review found no redundant comments or new suppressions and requested a shared digest/coordinate anchor for three files. Each now links this exact module table and labels zero-based UTF-16. No executable change results. Final build passes in w316-build-final.txt. The initial comment-only verifier assumed source indentation in emitted JavaScript and stopped correctly; w316-comment-only-fixed.txt removes only the exact three approved comment lines regardless of indentation and verifies all1772 input/validation/build hashes against the reviewed identity.
- Full-suite, live Magpie and paid upstream calls are not_run. All model requests above use owned loopback SSE fixtures.

Final content identity is /Users/mant1ssa/.claude/jobs/c9c17d97/tmp/w316-final-identity.json, with845 input,321 validation and606 build files. After the final behavior checks, only three provenance anchors changed in source and emitted JavaScript. The exact hash comparison confirms zero executable changes.

| Part | SHA-256 |
| --- | --- |
| Inputs | 76de50147d471e0a2bdd24ba9428dffdd1892d088bfe1641cdf3fa9e74c47182 |
| Validation | bfd3328590c407e07455c75913f90a0e59b10a613e72c1bb4a1040cc7bf51238 |
| Build | a5eddc4b9b73c22ce34e20c22621f34bbac8d25c72110ce0638a4d15375a5b76 |
| Combined | fd2ccf8de81be921b183889261c734cdf0dc533759dcfdc34219e888b0bef43c |

## Standard check and remaining work

S-1/S-7 acquire source gates, lifecycle owners and source-body diffs, retain the public failing baseline, and record the delayed Q dependency check. S-2 retains old schemas, timing gates, single final output and ordinary cron exit behavior. S-3 is not applicable. S-4 clears mode/readers/queues with the session and tests locks and abort. S-5 binds clock jumps, model requests and final data rather than transient status text. S-6 updates runtime, both one-shot model branches, scheduler and smoke drivers together. Investigation and probe incidents are in research/question.md; the existing standards cover them.

The scheduler family remains Partial. Interactive piped EOF lifetime is a separate input owner. Background-shell/teammate/observer parking, noop transcript folding, background-job sidecar recovery and inherited unsettled-write unlink stay separate. W301 stays paused. Local commits only; no push.
