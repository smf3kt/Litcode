# W321 local agent details

Status: verified locally,2026-10-24. Independent correctness review and final identity binding complete. W301paused,local only,no push/coauthor.

## Task card

- Entry/outcome: /tasks or live Background footer opens a local child detail,showing original prompt,agent/model/effort,elapsed,live token/tool counts and recent tool activity. Back/close/stop and completion retain the existing modal owner.
- Shape: the existing task-detail kind union gains agent. Registry owns launch prompt,lifetime and bounded progress;runtime reads an existing owner only. Existing public agent descriptors and tool schemas stay unchanged.
- Source: kG/GD/gE/Cs/Nr/yXe and iCn/Zor/aCn/lCn/_tt/sYr with IX observer wiring below.
- Targets: new agent-progress/agent-details modules;agent registry capture and passive detail;runtime/task-details/interactive/terminal/TUI adapters;one actual PTY driver and at most3regression groups.
- Method: copy pure source arithmetic/tag/normalizer bodies first,adapt recovered state/rendering to existing registry,completed assistant journal records and native modal clock.
- Explicit boundaries: legacy kG displays prompt/progress itself. Its f action requires im's separate viewingAgentTaskId/transcript owner;that owner and foregrounding remain a later chain. Source nQ is false-gated. No agent history list,source keepalive/teammate/session sidecar or remote/account surfaces added.
- Validation: actual compiled child reads an owned file,stays live,opens detail and refreshes counters,returns/reopens,stops a sibling and completes. Three regression groups cover accumulator/rendering,passive registry/resume and TUI ownership. Check/build,affected suite,source comparisons,independent review and content identity precede local commit.
- Throughput: one writer,one independent host reader;source text inert,original modules untouched,no recovered entry execution.

## Source identity and ranges

Sample2.1.296 artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Module digests checked against extracted-v2/manifest.json before use. Coordinates below are half-open zero-based UTF-16 code units.

| Module | SHA-256 | Acquired bodies |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | kG[633300,637661),gE[632415,632764),_p[632764,633243),U0t[633243,633300),legacy dispatch[685700,687200),fLt initial/Ra/wi/Gs from W320,Ale[699634,699743),im[398352,398888) |
| chunk-n7mc1kmr.js | e6445a9841b7affe8ddb66781cf06fffe9345799dece494fb88b8ef0584b76ae | GD[812,1038),bj[1038,1312) |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | Jjr=5[4219659,4219664),iCn[4219665,4219883),Zor[4219883,4219975),aCn[4219975,4220874),lCn[4220874,4221067),_tt[4221067,4221217),cCn[4221217,4221460),sYr[4231061,4231623),eWr[4231623,4231759),dne[4233793,4234807),cYr[4237978,4238656),iYr[4232306,4233308),nsr[4233443,4233793),_k[4228512,4230112),Rx[1870046,1870201),IC[4222190,4222263) |
| chunk-40cepjpq.js | 473c9dfb84c9defcb7ca5bd5e6f598cd951274dc2c1334a67c8b9d25b451a8b2 | IX[104577,115399),progress/stream wiring[107910,110110),stream callback[108379,108414) |
| chunk-ax7r0qj7.js | 8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e | gl[677,739),Nr[5245,5312),Wse[5182,5218) |
| chunk-g8ycwp9n.js | 2a0835fdb92089660fff9327688f2a5b96a08b1ed5ab3e6866dd3756a3dd4089 | Cs[662,1101) |
| chunk-phg89898.js | b52cc8f30379c267a8f9afb0f475b87c00d8fd96f8ddadcd0bdab1549234dfe3 | yXe[188975,189117),pmt[116932,117230),iMr[189183,189350),aMr[189350,189514) |
| chunk-sm8jk17g.js | 3472cd5cb27a15b5f3c77b2b50adf7a602b8f8b66f61e5437f1bcaf784513a15 | A4[1027,1199) usage shape |
| chunk-6p4kvraw.js | 2bd1263567797dc481a64702e12619d3debf5987f288d6c045561d995f2e5642 | n_[1944,2105) startTime identity |
| chunk-hwpb27as.js | c5f6d5b8fb187a14de3db7aebcb5615a3632aa34a0e174c54d38607e7c5ead8e | Td[4137,4218),fn[120360,120584),f_[120584,120683) |
| chunk-68wmv4pr.js | a4dddf1befe9b6fb2195cc0a4920ba236afad5b65e61cb964a5a49a6f739fc84 | J3[18323,18649),IHt[18062,18087) |
| chunk-1hw3699f.js | a24b290df0ec056167cceb589f6d58e574ee46fc4261ae7c65988f3e293eb6d6 | SXe[2256,2360),hmt[2360,2433),tool renderer table[1230,2255) |
| chunk-5wc3wh5m.js | 1c888f1e92fba0a838031d7b1d64907de732f7c9025141cd9acaab9d2d20a562 | Ea=StructuredOutput[29524,29545) |
| chunk-x217p54g.js | c6f95830cda5ee115c4dd3379578b96f986a10068f8ee12595d88a0f20ff18b4 | td=REPL[619,628) |
| chunk-bk5ct2gw.js | efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1 | Vf[389353,389580),xw[331063,331199),mEr[330994,331019),gEr[331024,331031),nN[331032,331062) |
| chunk-9vcaezw1.js | eccb69a1f121aa90407d23fbd69b3167178da1b759c1a4cd8b29609d15cb98e0 | V1[14505,14578),CS[6206,6243),effort values/normalization reused from existing effort-command |
| chunk-yn0pfn70.js | 1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f | Bs[10886,10967),format options[10742,10885),rn[9654,10354),existing compactNumber/shellDurationText |
| chunk-wz8v981w.js | c7add42e02a826600b00d2f4b850e50d8eaf2672df33b515fa5f914ee3801323 | hr[4088,4228),theme context replaced by current terminal theme |

kG renders normalized agentType plus description,elapsed,positive token/tool counts and model/effort. Prompt truncates at300UTF16units to297+ellipsis unless Cs finds a nonempty plan tag,which renders Plan to implement. Running recentActivities show a Progress heading with the last entry marked. gE uses source-only tool display metadata and otherwise returns toolName. Errors show only for failed agents. Enter/Space/Escape close,Left returns,x stops only a live/kept agent. Foreground f is an optional independent callback,not required for prompt/progress rendering.

Progress iCn/aCn/lCn/_tt keeps latest input including cache,cumulative output,stream estimates,tool count and at most5activities. StructuredOutput and REPL increment the count but remain absent from activities. Activity IDs deduplicate the list. IX publishes streaming and completed assistant observations into its existing task and transcript owners. Source task creation retains original prompt/model/effort and Date.now start;terminal setters record endTime. No account or paid source path is needed.

## Host adaptation fixed before edits

Independent host reader a56c45836af975704 verifies child Session holds completed message/usage/tool records,but registry cleanup clears Session/Agent references after mailbox runs. Original prompt cannot be recovered reliably from the first user message because fork/preloads precede it. Retain launch prompt and task timestamps/progress on Child;expose one passive detail snapshot through owners.get without allocation or event draining. Existing registry shutdown keeps process/environment ownership.

Use the existing boundJournal append wrapper to observe newly committed assistant response records,not seeded history. Child Agent textStart/text callbacks provide provisional text-only estimates with source Td. The host provider emits only one final Anthropic.Message rather than source partial assistant usage messages;at that final boundary discard the current provisional estimate before applying aCn usage so final authoritative totals are not double-counted. Thinking-token estimates are unavailable. Keep this adapter difference explicit. Completed final usage and tool calls update before their tool execution.

Retain counters across mailbox continuations,reset endTime on restart and set it at the owned run's terminal boundary. This host has no paused-agent lifecycle,totalPausedMs remains absent and GD's default0applies. No journal replay to reconstruct a separate process registry is added. Detail reading copies data and never calls Session.open,poll/wait,drainNotifications or a lazy registry factory.

The task-detail union adds kind:agent while preserving run/monitor. kG rendering uses the owned modal row viewport,existing rn/Bs formatters,source Cs/Nr parsing and gE's actual toolName fallback. Arbitrary gateway model IDs use the obtained xw filter instead of the vendor Vf catalog. No source tool-specific render metadata exists in ToolDefinition,so no invented argument summary is rendered. Original plan content can use existing Markdown/plain wrap as a host adapter. Legacy list/completion behavior remains the active-only host projection.

At the recorded preflight checkpoint, W321 product code was unchanged. Actual compiled red baseline w321-cli-baseline.txt starts an owned background child,executes read_file successfully,holds its next response,and opens /tasks. It fails the expected original Prompt/Progress detail because the current screen remains Background with1active agent. The fixture exits and no owned CLI process remains. Full IX initial/completion/cleanup body is also read before implementation. apply_patch remains absent;dedicated Write/Edit is the documented fallback.

## Implementation and source comparison

AgentRegistry retains the exact launch prompt,creation time,terminal time and progress on Child. New committed assistant records update the tracker before tool execution. Both initial and resumed Agents expose textStart/text observations. The final-message adapter removes provisional current-response text estimates before accepting actual usage. Counts remain available across mailbox continuation after Session/Agent cleanup. detail returns an isolated snapshot from the existing owner and does not allocate,wait,read journals or consume notifications.

The source aCn usage validator accepts output_tokens:null as0. The host SDK Usage requires numeric input_tokens/output_tokens;observeAgentResponse receives that final-message type. No source partial-message null-usage equivalence is claimed. The source tool count includes repeated tool uses and the two internal tool names while its five-row activity list deduplicates IDs. The host keeps those rules. Source-only activityDescription,isRead/isSearch and lastActivity consumers are absent. The host clones retained input data with structuredClone for passive-reader isolation.

agentTaskFrame adapts kG/gE/GD into existing plain modal rows. It preserves positive counter gates,latest activity marker,300-unit prompt cut,source plan-tag parsing,model normalization and failed-only error text. Native wrapping,control stripping and the existing modal viewport replace React/Ink color,icons,italic and plan Markdown layout. No visual parity claim is made. The active-only task panel exits a terminal detail instead of listing completed history. An unnamed agent uses Async agent. Source model/effort catalog lookup is replaced by the exact xw fallback and typed local effort. Existing tool labels have no source display metadata,so gE uses its toolName fallback.

The existing list/detail union and1000ms modal clock now accept the agent variant. Single supported local agents auto-open. Enter/Space/Escape close,Left returns,x uses the registry stop path,completion and loss release polling. W320 focus-id/live-index behavior is reused. Reduced motion leaves data refresh active. Original draft,permission/form priority and parent model ownership remain with their existing owners.

Twenty-four exact AST-bound source/target comparisons are generated by JOB_TMP/w321-source-diff.mjs. Every diff is read in full. They cover iCn,Zor,aCn,lCn,_tt,Cs,Nr,xw,yXe,gE,kG,GD,dne,IX,Td,iYr,nsr,fLt initial/Vl,bj,the modal timer,_k stop,the passive runtime reader and status-variant adapter. The report stores source module/body digests and exact target ranges in JOB_TMP/w321-source-comparison.json. The full eighteen-module table also matches the manifest. Original extracted bytes remain unchanged and inert.

| Target | Method | Source and adapter |
| --- | --- | --- |
| agent-progress createAgentProgress,observeAgentStream | copy | iCn/lCn with mechanical identifiers,types and explicit initial undefined. |
| agent-progress observeAgentResponse,agentProgressSnapshot | adapt | aCn/_tt/Zor at final typed SDK messages;host data isolation and absent source-only metadata above. |
| agent-details agentPlanContent,agentTypeText | copy | Cs/gl/Nr/Wse combined with mechanical identifiers and types. |
| agent-details agentModelText,agentTaskFrame | adapt | xw/yXe,kG/gE/GD;gateway model IDs and plain native rows replace source catalogs and JSX. |
| agent-registry detail,launch,beginResponse,streamResponse,boundJournal,run,stop | adapt | dne,IX,lCn/aCn,Td,iYr/nsr/_k;retained Child and owned append/text callbacks replace source task/transcript subscriptions. |
| task-details initialTaskDetail,taskDetailRunning,taskDetailFrame | adapt | fLt initial and kG/YG;typed local variants share the prior shell output path. |
| runtime,terminal,interactive,TUI | adapt | kG/fLt/bj/GD plus existing W320 modal owner;passive callback,agent dispatch and same clock cleanup. |

## Main validation

- Valid compiled red baseline JOB_TMP/w321-cli-baseline.txt reaches a real child read_file call before the missing agent detail assertion fails.
- New test/agent-details.test.ts has three groups. Literal source arithmetic/activities/plan/prompt/model rendering,real runtime fork/mailbox/prompt/final usage/events/cleanup,and real TUI reduced-motion refresh/key/abort/loss/close ownership pass3/3.
- Affected command `node --import tsx --test --test-concurrency=4 --test-timeout=20000 test/agent-details.test.ts test/task-details.test.ts test/agent-registry.test.ts test/runtime-resources.test.ts test/runtime-events.test.ts test/interactive.test.ts test/tui.test.ts` passes207/207 in w321-affected.txt.
- Owner/CLI command covers agent-details,subagents,agent-isolation-runtime,agent-types,agent-tool-restrictions,agent-lifecycle,background,background-session,interaction-runtime,tui-stash,cli,cli-advanced and cli-migration. It passes174/174 in w321-owners-cli.txt. It includes the final private-userDir fixture change.
- npm run check and npm run build pass after provenance completion in w321-check-final.txt and w321-build-provenance.txt. Exact inverse-comment hashes verify all776reviewed source inputs. An in-memory emit under the actual project compiler context confirms all610parsed compiled JS modules match the reviewed implementation after comment removal. Receipt w321-provenance-final.txt retains this check. The earlier context-free token scanner,isolated CommonJS transpilation and d.ts-versus-JS count mistakes remain recorded verifier failures.
- Actual compiled `node scripts/smoke-agent-details-cli.mjs` passes9owned loopback requests in w321-cli-stream.txt. It launches two real background children,reads an owned file,shows original prompt/model/read activity,updates1.2k to2.2k from held SSE text,returns/reopens the selected child,stops its sibling and handles completion. Inspection alone adds no model request. Exit0 and journal lock cleanup pass.
- Final rebuilt compiled chain passes9owned requests again in w321-cli-final.txt,with exit0 and released locks. No fixture processes remain in the main process scan.
- Independent comment audit aaa0e4787136cef55 retains11required comment lines in9blocks,0deletions and0suppressions. It flags missing handler-local source anchors and ambiguous host-usage attribution. Provenance comments are extended with the acquired source ranges and the usage clause now names the host adapter. No executable behavior changes.
- Full suite and real Magpie are not_run. Paid upstream calls0. Network verification uses owned loopback SSE only.

## Incidents and coding-standard check

Initial union adoption exposes un-narrowed shell fields in an old fixture. A dismiss-message branch adds one post-close detail read and fails the old zero-late-poll assertion. Explicit kind narrowing and an existing list read fix those cases. A new fixture assumes a nonexistent agents event;the actual reader emits a notification envelope. SDK ToolUseBlock also requires caller. Correct those fixtures without weakening notification retention or timer cleanup. First affected run passes207/207 after fixes. Source-diff selection initially misses an assignment-arrow handler,then supports that actual AST shape. These failures remain in question.md and scratch. apply_patch absence uses the previously recorded dedicated edit fallback.

S-1 verifies literal expectations and retains failed logs. S-2 preserves tool schemas,descriptor contracts,event consumption and source gates. S-3 keeps stored prompt separate from decoded display rows. S-4 gives progress to Child and polling to the modal,with stop owned by the registry. S-5 asserts exact counters,owned requests,stable frames and released locks. S-6 narrows old shell readers and wires both Agent constructors plus all detail consumers. S-7 records the source closure before product edits and reads all24body diffs. Existing seven rules cover the fixture incidents;no new rule or suppression is needed.

## Independent correctness review

Reviewer aaf6dfaf4c2016cdd reads the source/target observer,rendering,lifecycle and modal bodies and independently verifies all18module digests. New3/3 and the compiled CLI9owned requests pass. An additional compiled probe performs7real owned tool executions across3responses,finalizes tokens at342,caps activities at5,preserves original prompt through fork seeds and a queued mailbox,and publishes final usage before tool execution. Fifty detail reads preserve revision and queued notification state. Failure,cancel and close probes verify terminal timestamps and released locks.

A separate compiled TUI probe passes agent refresh,MCP form preemption,retained draft and foreground signal,completion and timer/subscription cleanup. Its first footer assertion expected1agent while the actual source-bound label is1local agent. The corrected scratch probe passes. An initial isolated transpilation comparison uses CommonJS;the corrected ES-module check confirms the5comment-changed source bodies match final dist. These are retained fixture incidents,not product findings.

The reviewer captures the exact final97e74ab identity and confirms validation inputs unchanged. Zero confirmed scoped correctness defects,repository edits,nested agents,paid calls or remaining owned processes. Main reads the compact probe receipts and verifies all1788file hashes. Prove It Works requires the actual compiled CLI. Type System Discipline keeps agent/shell variants explicit. Build the Lever provides rerunnable validation drivers and probes.

## Content identity

Captured by `node scripts/identity.mjs --output JOB_TMP/w321-final-identity.json` after the provenance rebuild. The final compiled chain runs on this build. The prior review identity c4be5cef7c3fb0402ec17036a17eefb47856f1be8d83b116c1eadf86a84e38a6 differs only in source comments and emitted comments as verified above. Validation includes the preserved unrelated skills-command test change;that file is excluded from the W321 commit.

| Inventory | Files | SHA-256 |
| --- | --- | --- |
| Inputs | 852 | 1734501140c206206ed8dfd94fad84647f04fb685ad46902777d9a2165908540 |
| Validation | 326 | f01abd1770172d08b05a287e80c350a6b02b0e85f2374bf90607fe2d8cc0e927 |
| Build | 610 | 0e384c9b9f58983ee20bb2d65322c4a8bdcecd596d89af33e39efc1dc7c6fbae |
| Combined | 1788 | 97e74ab02c9284b89cccb7019c3adbf2f8a74bfaeacc4e81dd47487e20c7e2dc |

Complete manifests,24source/target/diff sidecars and logs live under `/Users/mant1ssa/.claude/jobs/c9c17d97/tmp`. This record preserves their outcome and content digests. Main checks all1788file hashes and the independently captured final manifest matches the combined identity.

## Remaining

Source f/transcript viewing through im still needs an independent viewing-agent owner. Foregrounding,completed-history listing,newer false-gated screens,WebSocket details,teammate and sidecar owners remain separate. Account and subscription surfaces remain excluded. W301 stays paused. All package gates pass. Delivery is an explicit-path local commit on work/w43-choice-preview with no coauthor or push. Next source preflight is the separate local-agent transcript/viewing owner before adding its f action.
