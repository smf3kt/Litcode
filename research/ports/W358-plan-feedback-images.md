# W358 plan feedback images

Status: verified locally with fresh independent VERIFIED_SCOPED, 2026-10-27. Initial acceptance is NOT_VERIFIED for a reproduced direct-journal P2; the repaired candidate resolves it with no residual scoped defect reproduced. Base commit is 7620c8d1e973c5f6f837d607120d6b2def7fc95c. JOB_TMP is /Users/mant1ssa/.claude/jobs/c9c17d97/tmp.

## Task card

- Outcome: paste and remove images in plan feedback; submit image-only or text/image feedback while retaining plan mode; send native blocks with the failed tool result. Approval omits feedback images.
- Source: complete Got/$ot, input and codec owners, ro/g1t/w8n permission consumers, and KWo result publication.
- Targets: existing terminal/dialog attachments, interactive review, plan callback, Agent result publication, Session journal and pending recovery.
- Mode: adapt the obtained bodies to the existing callback/error, modal and durable journal interfaces.
- Validation: actual compiled red/green, three regression groups, affected tests, check/build, complete source comparisons, frozen identity, independent acceptance and owned resource cleanup.
- Constraints: one active package, main implementation, one bounded reader at a time, original samples inert/read-only, local only, no credentials/accounts/paid calls/coauthor/push/new schedule.

## Source

All ranges are zero-based half-open UTF16 code units. The sample2.1.296 SHA-256 is c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Captures verify decoded module hashes against extracted-v2/manifest.json. No recovered application entrypoint is executed.

| Module | SHA-256 | Complete bodies |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | P3/Qet[1178668,1179811), $ot[1220957,1221697), Got[1221697,1230824). |
| chunk-yygmb66g.js | 93220b26616034b337ff622aa95b4125688626cc0a1a883c473f2703565d60b0 | yo[23738,24437), gEe[25027,31575), Ve[40861,41667), Yi[41667,54367). |
| chunk-v96accjb.js | 254872d392ad7917b0f7d66e55a4fcac638af5a0ec459ce30f108f404021c499 | mb[13222,14061). |
| chunk-agyp1qjr.js | 7959d496ef89e04625196bceac40da127ceafe5d100833db3cc1284f390d87aa | DEe[5424,5526), LEe[5526,5601). |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | hA[213168,213206), Ac[2641118,2641532), Msr[2236895,2237185), h2e[2237185,2237279), _Wo[2237279,2239655), Cge[2239655,2240346), HWo[2258166,2258251), KWo[2275902,2308030), S2[4361275,4361347), uE[4361351,4361581), CM[4361582,4361782), Rne[4362001,4362162). |
| chunk-9c5se12s.js | a701e1d055f89288d2387018877f50d06a67ea82c1bc7209a21cf5bf3487c0f2 | w8n[5644,5725), g1t[5863,10103), cancelAndAbort[6777,7099), handleUserAllow[8786,9602), ro[56388,59378). |

Retained captures under JOB_TMP are w358-plan-image-source.json, w358-permission-feedback-source.json, w358-permission-decision-source.json, w358-denied-review-transform-source.json, w358-plan-input-source.json, w358-plan-input-owner-source.json, w358-plan-feedback-deps.json and w358-plan-image-label-source.json. Main reads the entire32128-unit KWo in three contiguous ranges. The initial locator uses10calls and leaves its transformation conclusion unknown after oversized output; main closes that gap by reading complete ro/g1t/w8n and KWo.

Got converts current images through mb before returning feedback. $ot requires text or images for its no branch, uses `(See attached image)` for image-only feedback, and carries blocks only on that branch. Keep-context approval carries text feedback without images. ro forwards deny feedback and blocks to g1t.cancelAndAbort, which returns an ask decision preserving blocks. w8n aborts only when feedback, blocks and a child context are absent. KWo emits an error tool_result followed by native image/text siblings in the same user message; its post-hook output path retains those siblings too.

## Design and implementation

The caller supplies reviewPlan. Only its deny variant gains optional contentBlocks. Shared admission produces typed image/text blocks for both questions and feedback, preserving existing question error text, block limits and media checks. A narrow ToolFeedbackError carries those blocks across the existing tool failure boundary. Agent owns their publication, per-call association, durable result record and pending recovery.

The alternative universal tool-result envelope would migrate every tool consumer and still need a journal adapter. Main selects the narrow error because the existing ToolDefinition failure path and KWo sibling placement already fit it. No new tool framework or feature flag is introduced; sourcePlanTools remains the pinned catalog choice.

The source publishes one message per tool; this host batches results. The host therefore keeps all tool_result blocks first, then feedback siblings in call order, followed by hook context. This preserves assertPaired and PostToolBatch indexing. Each tool_result journal record stores its feedback companions before post hooks. A later tool_output changes only result text. recoverPending retains the companions and reconstructs pairing without replaying a started tool.

TuiTerminal reuses dialog.images with a plan-feedback key. Only the feedback input accepts image paste or empty-input Backspace removal. Image-only submission is accepted. Existing finish/capture owners abort stale work and clear private attachments. Ctrl+G carries text and image content through interactiveLoop into the replacement modal; cleaned private paths are discarded. Approval returns its existing mode/plan/text contract. Inline feedback keeps its existing text path. Labels follow yo's `[Image #ID]` form.

Accepted adapters include the local callback/error pipeline, batched message ordering, durable companion records, sequential display IDs and private attachment ownership. Existing codec fallback remains unchanged. Source clear-context, child approval, custom instructions, workshop, StorageV5 and global renderer differences remain separate; this package leaves the feature family Partial.

## Initial validation and independent finding

The pre-edit compiled command `node scripts/smoke-plan-mode-cli.mjs --images` exits1 at `plan image captured`. The decoded frame shows focused plan feedback with no attachment. Evidence is w358-cli-red.txt. The driver intercepts only the explicit PNG clipboard query and uses an owned loopback SSE provider.

| Initial validation | Result |
| --- | --- |
| Three new groups | 3/3, w358-focused3.txt. |
| Affected interaction/session/agent/image tests | 81/81, w358-affected-first.txt. |
| TUI/interactive/new groups | 131/131, w358-tui-interactive.txt. |
| Final check/build | exit0, w358-check-final.txt and w358-build-final.txt. |
| Compiled image/editor chain | 26 requests, w358-cli-final.txt. |
| Compiled image/cancel chain | 27 requests, w358-cli-cancel.txt. |
| Original inline/editor | 24 requests, w358-cli-inline.txt. |
| Question partial/AFK/images | 24 requests, w358-question-image-compat.txt. |
| Full suite | 3416/3416,118suites,0fail/cancel/skip/todo; w358-full-proof.json verifies all1911records unchanged. |
| Independent acceptance | NOT_VERIFIED, w358-independent-038c74-verdict.json. One reproduced P2 in direct Session.append admission. |

Initial identity4799ab2c6c7c8ba8cdf052656f4b66ae16a1607f1bcc89a41cdd70c931ac7fc4 contains inputs913,validation355,build643. The original14complete comparisons occupy357840UTF8bytes, SHA b4dd131fcceb5cb2bb8f13e63f3e7c81bd3d8e641867392c3f7ecbccba43ae3b, in w358-source-host-character-diff.json.

The independent reader passes3/3 and actual compiled26. Two real failure hooks witness companions committed before hooks. Interrupted three-call recovery retains two feedback owners and two later tool_output rewrites in order with0replays; producer mutation is isolated. All1911before/after records,three protected hashes,seven source modules,eight captures/32bodies and14pairs/1064opcodes match. Its18observed owned PIDs exit with0owned processes/directories/locks. These passing observations do not close the P2. The reader uses38leafcalls, exceeding its requested budget; two earlier fixture-assumption failures remain in its verdict.

The P2 trigger is `Session.append` with `feedbackBlocks:[Object.create(validNativeImageBlock)]`. Admission constructs a valid native block, but append validates then serializes the raw event. JSON drops inherited fields to `[{}]`; cold Session.open fails. Ordinary reviewPlan rejects the nonplain value through checkData before persistence. The defect is confined to direct journal admission.

## Journal repair

Main rereads complete append, readSessionJournal, eventSchema, admitContentBlocks and admittedImageBlock, plus manifest-bound P3/Qet/$ot/w8n/cancelAndAbort/_Wo. The same existing second regression group reproduces inherited block loss in w358-repair-red-inherited.txt. An earlier combined toJSON probe exposes DataCloneError after raw bytes are written; w358-repair-red.txt is retained.

append now assigns admitted feedbackBlocks to the tool_result event before full validation and writing. Other fields and event kinds preserve their existing raw contract. The existing parser owns canonical construction; no new inherited-object rejection or generic journal migration is added. The second group checks inherited image/source and image/text toJSON values through exact live/disk/cold results and unchanged cold journal bytes.

| Repaired validation | Result |
| --- | --- |
| Three groups | 3/3, w358-repair-groups.txt. |
| Affected tests | 90/90, w358-repair-affected.txt. |
| Check/build | exit0, w358-repair-check.txt and w358-repair-build.txt. |
| Actual compiled image/editor | 26 requests, w358-repair-cli.txt. |
| Full suite | 3416/3416,118suites,0fail/cancel/skip/todo, w358-repair-full-proof.json. All1911records unchanged. |
| Main identity/source check | All1911records,15complete pairs and three protected hashes match, w358-repair-main-final-verification.json. |
| Fresh independent repair review | VERIFIED_SCOPED, w358-independent-repair-7d143e-verdict.json. Own3/3 andcompiled26;9directcompiled journal cases,4nonplain callback rejections,2plain/null callback admissions,2locks released and0residual scoped defects. All1911records/15pairs/protectedhashes match. |
| Final owned resource census | 0processes/0directories, w358-main-resource-verification.json. Main removes only two proved-empty directories left by the initial missing-model fixture; w358-old-fixture-cleanup.json retains ownership/birthtime/handle evidence. |

Repaired identity is a26d2581820eeaef3da8ee6aa5fc62dea8673e51f876a84c98f409f591c2e78e in w358-repair-identity.json. Inputs913 SHA aa2723781604fa5e797bf3888bd4d124ee3412768e4ddd3c493a3d15a4adc484; validation355 SHA0e24313b56f6aa23d5b015e0e9616407c4feb710399c7b2a09bc3eb5da0eee4c; build643 SHAb6d188c111ab0b182e6f9a5a84adc666d6a3b2874382c2591871e5c14202c96a. Exact delta from the initial candidate is src/session.ts,test/plan-feedback-images.test.ts,dist/session.js, recorded in w358-repair-scope-proof.json.

The new15complete pairs include append and occupy396685UTF8bytes, SHA dbed694565883b3450564e35c93ba5d450381f86dbcfd51f221ffaf19cff9a8a, in w358-repair-source-host-character-diff.json. Continuous UTF16 opcodes reconstruct both full texts. This is finite correspondence evidence with explicit adapters. Repaired full log SHA is2a41bc1c35bf55882cdeebffc994c1582e9161fb64adbfd5e62ac92a4143f709.

## Reconciliation

S-1/S-7 bind source bodies and compiled red before edits. S-2 preserves original catalogs, error text, result-first pairing and raw nonfeedback journal contracts. S-3 separates native companions from result/model text. S-4 reuses modal, capture, attachment and journal owners. S-5 observes decoded labels, exact PNG/journal bytes and nonreplay. S-6 covers callback, live, journal, pending and original drivers. Existing S-2 gains live/JSON/cold checks for normalization, grounded in W357 container admission and this independent journal finding.

The comment reader uses8calls. Main accepts five redundant suffix deletions and moves the existing clipboard documentation back to its capture method. Required source anchors remain; no suppressions or unsafe casts are added. Final scoped deslop inspection finds no further change to make.

Initial test incidents cover batch ordering, a missing fixture model, raw ANSI assertions, capture publication versus completed insertion, and the per-review edited marker. Source Got keeps that marker per review; the new image/editor driver checks ordinary approval after an earlier rejected edited review, while the original standalone editor assertions stay intact. apply_patch is absent, so dedicated Edit/Write is the recorded fallback. Locator, filename and AST selector corrections remain in research/question.md. No failure evidence is overwritten.

All model request counts are owned loopback fixtures. External and paid model calls are0. Real Magpie/model acceptance is not_run. Original three dirty tracked paths and unrelated untracked artifacts are preserved. Fresh repair review uses20leafcalls. It checks1106continuous UTF16opcodes,7manifest-bound modules,8captures/32bodies and4226import slices,plus complete P3/Qet. Nine direct compiled journal cases include inherited block/source, image/text/source toJSON, plain/null JSON and absent/empty legacy feedback. Live/disk/cold equality andproducer isolation pass;toJSON invocation count is0. Invalid17blocks/media reject before bytes or events change. Own3groups/compiled26pass once,25trackedPIDs exit andownedresources are0. Main verifies referenced logs/script digests andbefore/after full inventories,then finishes resource census. The23file evidence manifest w358-evidence-manifest.json has aggregateSHA087309367008efdfd19d9c11e4b3fe5e597f6320fba1a1c234267c66692ea882. Exact18-path local commit is the remaining delivery step.
