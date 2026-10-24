# W322 local agent transcript

Status: verified locally, 2026-10-24. Parent HEAD `6340989`, branch `work/w43-choice-preview`.

## Task card

- Entry: `/tasks` or footer, local agent detail, `f` opens the selected child's conversation.
- Outcome: live committed user/assistant/tool rows, selected-child loading, completed-view retention, ordinary human input delivered to that child, local-command gates, scroll/selection isolation, Escape stop/exit and session/terminal cleanup.
- Source: `kG/fLt -> im/am -> Zee/Dns/Lns -> gie/jw`; `JYe -> N4.submitToAgent -> tqt/eqt/xX/Ve/kn`; `Ble`, `kve/aR/Iie/p0`, `OCe`.
- Host: `AgentRegistry` owns bounded transcript records, pending human messages and retention; Runtime exposes existing-owner reads/submit/retain; interactive owns destination and confirmation; TUI owns visible projection and its teardown.
- Mode: adapt recovered state transitions and routing to the existing journal, mailbox and native viewport. Preserve the local command gate's branches and text through the typed host interface. Exact adapters below.
- CLI: actual compiled entry, real child file read, f view, queued human input, completion and resumed child, main transcript/draft isolation, local commands, Escape and final locks.
- Checks: at most three new regression groups, affected existing owner/TUI/interactive tests, check/build, source body comparison, independent review and final identity.
- Scope: same-process local children. W301 paused. No account/subscription/OAuth/service work, paid upstream, recovered entry execution, coauthor or push.
- Completion: source closure recorded before edits; actual CLI and necessary checks pass; independent review closes; evidence and current matrix updated; explicit-path local commit.

## Source identity

Artifact Claude Code 2.1.296, SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`. All ranges are zero-based half-open UTF-16 code units. Module bytes are checked against `extracted-v2/manifest.json` before Acorn selection. Extracted text is inert.

| Module | SHA-256 | Acquired bodies |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | Ule [706014,706092), JYe Vim/inputOwnsEscape [864750,865090)/[879560,880270), AB [705452,705482), i8t [863125,863158), kG [633300,637661), local dispatch [685700,687200), soe [397952,398041), ioe [398041,398164), aoe [398164,398352), im [398352,398888), am [398888,399172), doe [399172,399452), Vp [210906,210978), Zee [210978,211342), VOe [339498,340137), kve [1304882,1305454), aR [427980,428667), p0 [427532,427980), OCe [1501794,1502367), Pg [592354,592527), pse [592527,592742), Ble [705483,706014), JYe submit [875160,878682), N4.submitToAgent [1497670,1498885), N0 [480187,480257), WO [1305590,1309198), c4 [1330762,1333395), GZ [141280,142056), xEo [1679828,1679894), global interrupt wo [432968,434531) |
| chunk-j8hqhz0c.js | 484244ab875460f17f03ba710c6297940ac16c3742592218c4c05af8d9815891 | Ep [13803,13899), Pn [42501,42589), _kt [42796,42945), Skt [42995,43107), le [43879,43968), V3t [43968,44011), Dns [44011,44085), Lns [44085,44378), R6e [36038,36044), hkt [36056,36098) |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | CI [239588,239636), mS [4221742,4221801), IC [4222190,4222263), esr [4230112,4230226), tsr [4230226,4230489), tqt [4224269,4224352), eqt [4223404,4223933), k7 [4224511,4224653), zHe [991469,991509), Hle [4709382,4709960), ri [4505466,4505523), _Qr [4505646,4505792); _k/dne/IX lifecycle dependencies inherited from W321 |
| chunk-qw2csqy5.js | 5760cfd0169ae25b5932d60ed9ca45f045facac0a3303a73c6f6361f48abfb19 | xX [8817,8860), Ve [9117,9345), kn [9345,31492), complete body read in two bounded slices |
| chunk-3gz7s57c.js | 9d44818f1c5a17e8ddddbce66694eab43a75e489d8afbeaf0369756daf2e378b | gie [185681,188242), Iw [184957,185002), Dw [185006,185657), jw [167024,183767), nD [163176,163206) |
| chunk-6p4kvraw.js | 2bd1263567797dc481a64702e12619d3debf5987f288d6c045561d995f2e5642 | Ws [709,775) |
| chunk-tar639dc.js | c8f74100741e1b26457915d3a67a41b9a9ae9ef5bab44e7c334f18c8fbb6f2fc | Iie [16436,16719) |

## Recovered contract and host adapters

`im` switches viewingAgentTaskId and viewSelectionMode, retains the selected local agent and releases any previous one. `am` clears both and releases retention. `aoe` gives terminal source records a 30-second eviction time. `OCe` leaves completed local agents visible; only missing local tasks exit or return to their known parent. This host has a bounded count-based history owner rather than the source timer eviction owner. A view lease exempts exactly its child from that existing cap; release immediately reapplies the cap. No extra history browser or disk hydrator is introduced.

`Zee/Dns/Lns` project the selected transcript, conversation key, in-progress tool IDs and child loading separately from the main conversation. `gie/jw` keep the main streaming preview out of the selected-child projection, force detailed rows in the transcript screen and key rows by conversation. This host reuses its existing Markdown/tool rendering and native transcript scroll/selection owner. Main producers continue writing the main transcript while a separate selected-child projection is visible. Switching/exit clears selection and repins the new conversation as WO does. The view shows committed messages, matching gie's lack of a child streaming preview. It does not claim byte-for-byte JSX/layout or all source transcript-normalizer equivalence.

The journal is already bounded to 10,000 events/16 MiB and mailbox to 32 messages/128 KiB. Child display records share those owner limits. A completed child's records survive Session.close without retaining the session descriptor, hooks or Agent. Passive readers clone data and neither open a Session nor drain notifications. Runtime changes repaint committed child events, without a view polling clock.

`N4.submitToAgent` appends a human row immediately with tqt, queues to a running child with eqt or resumes an idle one with xX/Ve. Host mailbox items gain origin and display identity; the human echo is replaced by its committed journal row, preserving order and preventing duplication. Existing peer send_message continues using peer provenance. The existing same-process mailbox serializes resumes instead of the source resumesInFlight Set and sidecar reconstruction. Cold/disk hydration, nested ownership/handback, observers, teammate transport and worktree recovery are separate. A settled stopped or failed nonisolated child accepts an explicit human restart with a new controller while peer messages keep the existing stop rule. An already closed isolated environment reports its missing owner rather than running its closed tool clients. Human submit uses only the selected retained child in the current Runtime/session.

`Ble` blocks model/fast and asks for confirmation for compact/clear/rewind, whose confirmed effect targets the main conversation. Other registered local commands remain local; unrecognized text and prompt skills go to the child. The host's existing command table/canonical aliases define which commands are local. Draft and target identity are checked again after asynchronous confirmation so a stale answer clears neither a replacement draft nor a new view. Native form/permission dialogs keep input priority.

`kve` skips the transcript screen, lets an input owner consume Escape, stops a running local agent through aR, then exits a settled view through am. The host retains its existing global interrupt behavior and the registry's stop/cleanup implementation. Source CI parking is false by default and is not enabled. First Escape stops a running selected child, a subsequent Escape exits its settled view; Ctrl+O and transcript exit only change transcript/chat presentation. Terminal close, missing owner, session replacement and runtime release remove the view lease and reader.

The final independent boundary probe exposes an incomplete failed-state restart and a reset before input validation. Before the repair, manifest/Acorn rechecks acquire _kt/Skt above and kn's setup [9345,14300) and publication/stop-count recheck [26300,31492). _kt admits explicit human resumes independently of the retained terminal status; kn checks eligibility again before publishing dne and clears the stop marker only after admission. The same-process adapter therefore waits for the old worker, validates existing capacity/message/mailbox/journal limits, then publishes the new controller and queued state without an intervening await. Failed admission leaves status, error and the stopped controller intact. An owned red regression confirms invalid human input enabling a peer. A separate scheduledFire red confirms the selected-child selection is cleared by the hidden main marker; gie owns that separation, so main marker publication must preserve child selection too.

## Source and target comparison

JOB_TMP means `/Users/mant1ssa/.claude/jobs/c9c17d97/tmp`. The source helper verifies manifest digests and Acorn node coordinates. The comparison helper parses target TypeScript declarations,methods,getters and actual assignment-arrow handlers. Sixteen final source/target body diffs are generated and read in full. Their five directly compared modules are a subset of the seven-module source table,not the complete dependency count. The report stores body digests,target ranges and diff sidecars in `JOB_TMP/w322-source-comparison.json`.

| Target | Method | Source and required adapter |
| --- | --- | --- |
| agent-transcript command gate | adapt | Ble's local-agent branches and exact text. The teammate variant is absent from this host. Typed name/result replaces command object/notification segments. |
| agent-transcript projection | adapt | Zee/Lns/gie/jw into existing journal/native rows. Meta/preload filtering differs from _Qr,which retains some source TL origins. Exact humanText and tool IDs survive. Full source multimedia/normalizer layout is separate. |
| registry transcript/retain/history | adapt | Vp/im/am/aoe into cloned Child records and per-view leases. Existing count cap replaces source30-second expiry. |
| registry enqueue/send/journal/run | adapt | N4/tqt/eqt/_kt/Ve/kn into serialized same-process mailbox,journal echo replacement and existing resume resources. Validation precedes restart publication. Cold sidecar/worktree reconstruction is separate. |
| runtime/interactive/terminal | adapt | Existing-owner Vp/im/am/N4/OCe reads,retention,input destination and cleanup. Main confirmation is aborted on view release. No new registry or Session is opened by a reader. |
| TUI mount/render/input | adapt | im/am/WO/gie/kve/JYe/Ble through native transcript,selection and input owners. Main streaming and scheduled markers remain in main storage. View feedback has its own row. |
| detail f dispatch | adapt | kG/fLt callback and supported-key preservation through the existing modal. Legacy line terminal retains its existing entrypoints. |

The16comparison labels are command-gate,view-snapshot,retain,view-mount,mailbox,resume,projection,input-owner,draft-owner,entry,detail-keys,escape,focused-load,restart-admission,main-selection and runtime-view. No rewrite or whole-source equivalence claim is made.

## Validation

- Before product edits,the actual compiled `node scripts/smoke-agent-transcript-cli.mjs --entry-only` reaches an owned child read and agent detail,then fails because f has no view handler. `w322-cli-red.txt` retains the valid red baseline.
- Three groups in `test/agent-transcript.test.ts` pass after the final repair in `w322-admission-green.txt`. They cover exact human origin/order and echo replacement,passive reads,limits/retention,explicit human stop/failure resume,peer rejection after empty/oversize/capacity failures,tool pairing,command gates,draft/modal/Vim ownership,stream/scheduled selection and teardown. The repair red in `w322-admission-red.txt` reproduces invalid-human peer admission and scheduled-selection loss before those edits.
- `npm run check` and `npm run build` pass in `w322-check5.txt` and `w322-build5.txt` on the final product/test/script identity.
- Final affected command `node --import tsx --test --test-concurrency=4 --test-timeout=20000 test/agent-transcript.test.ts test/agent-details.test.ts test/agent-registry.test.ts test/agent-isolation-runtime.test.ts test/runtime-resources.test.ts test/runtime-events.test.ts test/interactive.test.ts test/task-details.test.ts test/tui.test.ts test/terminal.test.ts test/loop-noop-fold.test.ts` passes255/255 in `w322-affected-final.txt`.
- Additional CLI/owner command covers cli,cli-advanced,cli-migration,agent,agent-lifecycle and tui-bash-mode. It passes120/120 in `w322-owners-cli.txt` before the final admission/scheduled-selection repairs. That result retains its earlier candidate scope.
- Main actual compiled `node scripts/smoke-agent-transcript-cli.mjs` passes11owned loopback requests in `w322-cli-final2.txt` before the last repair. It exercises real read_file,held child view,queued human echo/continuation,exact child destination,model blocking with draft retention,compact confirmation cancellation,transcript return,stop/exit and exit0/lock release. It does not claim execution of confirmed compact/clear/rewind. Previous details smoke passes9owned requests in `w322-existing-details.txt` at that earlier candidate.
- Final candidate compiled replay is run independently by correctness reviewer a286a671648b65391. It passes11owned requests after the repair,with the complete fixture at `JOB_TMP/w322-review-replay/tmp/agent-transcript-cli-FSqQf6`. New3/3 and five compiled supplemental scenario groups pass. Details below.
- `git diff --check` passes. Final fixture process scan finds no active owned smoke processes. Main verifies zero `.lock` entries in the final independent CLI,boundary fixture and prior main CLI fixture. All1792current file digests match the final identity.
- Full suite,real Magpie and paid upstream are not_run. Paid calls0. All model requests above use owned loopback SSE or local scripted providers.

## Independent review

Correctness reviewer a286a671648b65391 verifies source/manifest correspondence and finds three defect families. Hidden main stream and scheduled-marker updates reset selected-child anchors. Vim INSERT Escape reaches stop/exit before its input owner. Restart admission resets a controller before validation and retains the failed-state guard. Main repairs each against gie,JYe/kve and _kt/kn. Final reviewer verdict has no remaining confirmed scoped correctness defect.

The final rerunnable compiled probe is `JOB_TMP/w322-review-boundaries.mjs`. It imports the owned dist modules and checks identity before/after. Its five scenario groups cover real stopped/failed human recovery,old queue retirement and peer gating after invalid input;50passive clone reads with untouched notification state;view-lease eviction;native Vim/stream/scheduled-selection/feedback/stale-target/form/loading isolation;and Runtime.releaseSession invalidation with released locks. Final fixture is `JOB_TMP/w322-review-boundaries-AsLbZo`. All groups pass at exact6d309e0d identity. The reviewer also repeats actual compiled smoke11requests and new3/3 against that identity.

Comment reviewer aa1493b4d1b1422db reports0unnecessary comments,0suppressions,0deletions and0repository writes. Its initial20blocks/21tokens count describes the audit candidate. Required handler anchors and two attribution gaps are repaired. The meta filter explicitly names the host adaptation,gie has its range,and final restart/scheduled fixes have exact source comments. The final main deslop pass retains required provenance and finds no unrelated behavior change or added any/suppression.

Model the Domain keeps transcript data,retention and input ownership in the existing Child/Runtime/TUI owners. Type System Discipline uses SessionEvent-derived records and explicit view results. Prove It Works requires the actual compiled CLI and independently rerun boundary probe. Build the Lever provides the reusable smoke and exact body-comparison drivers.

## Content identity

`node scripts/identity.mjs --output JOB_TMP/w322-final-identity.json` captures the candidate after final check/build and product/test changes. Independent replay matches this manifest before and after. Main recomputes every file digest.

| Inventory | Files | SHA-256 |
| --- | --- | --- |
| Inputs | 854 | a4b65739f4e69ff73edde05029c3c9b96b99fdeb8bcaf73328f71844c792be09 |
| Validation | 327 | 753b11f92340625ef566a2998355d937662da21c59523aa59b76af298bfe5d12 |
| Build | 611 | e96474a16b7c52f32cf1f9cfb71e1c4001d38d7603942aa5ab2ea13fe87ae3b0 |
| Combined | 1792 | 6d309e0d9bb34971715c878668ce67c2230db50da99e47aad6fbb83ce9f0e0d1 |

Validation includes the existing user's skills-command test change. That file and the user's .audit/w45-77-evidence.mjs change remain outside the package commit. Prior candidate e0870a8a is superseded for final acceptance by6d309e0d. Documentation/audit edits do not enter the shared product identity. Large raw logs and comparison sidecars remain in JOB_TMP;this record preserves their results and exact final digests.

## Research incidents

ImportSpecifier-only extraction initially hid module provenance. Selecting its enclosing ImportDeclaration repaired the helper. The name xX exists independently in sfn and qw. Import resolution selected the resume body in qw before product edits. A nested function made text-based JYe truncation incomplete. Acorn supplied its exact body. Missing guessed filenames and broad reads were replaced with real rg/source declarations and bounded ranges. A wrong Return helper import was corrected from the existing terminal import before typecheck. apply_patch is absent as rechecked before edits. The existing dedicated Write/Edit fallback applies.

Two interrupted Write arguments fail parsing without writes. Nonunique edits fail atomically and succeed with narrower context. An unchanged Edit is rejected without a write. The first green CLI loses f during detail refresh. Source kG/fLt requires retaining its callback while refreshing. The next fixture batches /tasks and f across a modal owner handoff and correctly loses the old batch suffix. Waiting for the second detail fixes that driver. A new test omits required features.tasks and typecheck catches it. The fixture then names tasks:false. No product input contract is weakened.

Independent main-selection,Vim and human-resume findings lead to source-bound repairs above. A later compiled run shows parent child-event status overwriting model-command feedback. The JYe/Ble adapter moves feedback onto the view. Runtime release publishes missing-owner invalidation after removal. The final boundary probe then exposes failed-state restart and validation-before-reset. The owned red reproduces invalid-human peer reopening and scheduledFire selection loss. Both repairs pass final regressions and independent replay. Visible stopped queued echoes remain separate from deliverable input and are not automatically replayed.

The independent final probe first leaves a trailing character because Vim places its NORMAL caret before the final character. Its Ctrl+U setup clears only the prefix. Scratch setup now uses Ctrl+E then Ctrl+U and asserts an empty draft before the next command. A main identity check mixes require and top-level await,so Node rejects its module format before checking any digest. Explicit ESM passes all1792hashes. An oversized combined diff and an offset beyond the short probe are replaced by bounded reads. All failed steps remain in question.md and scratch.

## Coding-standard check

S-1 verifies source nodes,literal expectations,real compiled outcomes and final identity while retaining failed runs. S-2 preserves existing schemas,peer stop gates,input limits and notification consumption. S-3 keeps exact humanText,tool content and journal identity separate from rendered native rows. S-4 assigns records/leases to Child,existing-owner lookup to Runtime,destination/confirmation to interactive and selection/loading/draft to the visible TUI. Admission validation precedes controller/state publication. S-5 tests real cancellation/failure,invalid admission,stable decoded frames and released locks. S-6 updates registry mailbox consumers,Runtime/terminal interfaces,detail key refresh and every visible transcript reader. S-7 acquires source/card before edits and reads all16final body diffs. Existing seven rules cover these incidents. No new suppression or rule is added.

## Remaining and delivery

The local viewing usage chain is complete for retained same-process children. The feature family stays Partial. Completed-history browsing,cold/disk hydration,sidecar recovery,closed-isolation reconstruction,nested handback,teammate/observer ownership,WebSocket/newer false-gated details and complete renderer/normalizer parity are separate. No account/subscription/service work is added. W301 stays paused. Next preflight is the local completed-task/history picker and its retained/disk source owner before any behavior change. Delivery uses explicit-path local staging on work/w43-choice-preview,with no coauthor or push. The user's two unrelated tracked changes remain untouched.
