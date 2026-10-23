# W320 task details

Status: verified locally with fresh independent repair recheck, 2026-10-24. One active local package. W301 paused. Local commit only, no push or coauthor.

## Task card

- Entry: open /tasks or the live Background footer,inspect an owned local shell or script monitor,view its output,go back or stop it,and release dialog resources.
- Outcome: port the source legacy shell/monitor detail chain,including single-task auto-open,status/runtime/command,ten output lines,one-second refresh,close/back/stop and loss-of-task fallback.
- Shape: list or detail state owned by the existing interactive dialog; output read from the owner's bounded registry snapshot. No model call for inspection,no extra output file or remote registry.
- Targets: tasks-panel/detail projection,runtime read-only accessor,interactive state,terminal/TUI detail reader and existing modal timer cleanup; reuse PTY/terminal-screen verification components.
- Source method: adapt fLt/YG/Eae/bj/zG/iKe/aC to the owned registry and terminal. Source ct command truncation and existing source-derived rn/Qt formatters are reused.
- Boundary: this package closes shell/script-monitor details only. Agent detail source kG is acquired but needs prompt/progress/model/transcript ownership beyond the public descriptor. Foregrounding,WebSocket monitor detail,new false-gated detail screens and remote/account functionality stay separate.
- Throughput: one in-place writer; one bounded independent host reader. Acquire source/body/dependency/cleanup and actual compiled red baseline before edits. At most3new regression groups; affected/check/build/compiled/sourceDiff/independent review/identity precede exact-path local commit.

## Source preflight

Sample2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Module bytes verified against extracted-v2/manifest.json before reads. All ranges are half-open zero-based UTF-16 code units. Recovered sources are inert text and application entrypoints are never executed.

| Module | SHA-256 | Acquired bodies |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | fLt [674472,698750),init [674472,675750),selection Vl around678145,detail/return clauses [682000,689000),_p [632764,633243),YG [667173,670211),zG [667037,667173),Eae [670211,671410),dHt [666968,667037),vB [673586,673732),ojt [671443,671484),CE [674264,674472),Ale [699634,699743),GUt [701039,701063),Rf=null [674152,674159),kje [674200,674232); separate agent component kG [633300,637661) |
| chunk-n7mc1kmr.js | e6445a9841b7affe8ddb66781cf06fffe9345799dece494fb88b8ef0584b76ae | bj [1038,1312) key dispatch |
| chunk-yn0pfn70.js | 1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f | ct [8443,8612),rn [9654,10354),ae [892,935); Bun string width is an existing owned host seam |
| chunk-5sxzysbh.js | f011c32103b7ae04033cdff3555774f413ee90c5b1bc0d0ae7a725a33a1ff162 | Qt [615,844),already adapted by shellBytesText |
| chunk-eb9r2hbv.js | 3b1f83a5d1fcec7a1aa8a7d0adf139d8643ace6755985b79f19ddc1e7de22abe | ra [720,803),already copied to tui-graphemes.ts |
| chunk-f0442373.js | ff76012ebdd7b6e01188c07575ffaab34311d83eeda08e3d47681da030c8a6e9 | iKe [14457,14501),aKe [14501,14650),Zgr=8192 [14448,14456),Ru [3041,3214),H_e [9015,10104) protected output-file open |
| chunk-gyf58rwf.js | 7a6a01732760c89b5d434cc5ba98faf72b10917d85b771671f8201e9e3d8d2ad | aC [81001,81379),last n-byte read/stat/finally close |
| chunk-1r9zp6s1.js | 444d1adce233caec24f15e8203bd02c9ae6313df62af94ff0c81ea669458936e | Di [24622,24861),running-only1000ms refresh through source clock/effect teardown; owned modal timer is the host seam |
| chunk-j8hqhz0c.js | 484244ab875460f17f03ba710c6297940ac16c3742592218c4c05af8d9815891 | Vg [16174,16309),running/pending visible background admission |

Source Rf is null,so the newer oQ/nQ detail branches stay off. GUt returns false,so fLt's default can auto-open exactly one visible detail-capable task. Legacy YG displays Shell details or Monitor details,Status,Runtime,Command or Script,and Output. zG falls back to an empty output on read errors;iKe reads8192bytes;aC closes its file handle. Eae chooses up to ten final nonempty line slices using a backwards newline scan,shows No output available for empty content,and optionally adds total-byte count to Showing N lines. dHt truncates each output line at the available width. YG truncates command to280display cells with ct and polls output each1000ms only while running. bj binds Enter/Space close,Left back,and plain x stop; dialog cancel closes. fLt closes task loss from an initial detail unconditionally. Initial Left closes when at most one visible task remains; otherwise it clears the initial flag and returns to the list.

The owned registry retains separate bounded stdout/stderr tails and totals,not the source merged output file. Adaptation reads those snapshots without waiting or consuming notification events. Their stream interleave is unavailable; rendering joins retained stdout followed by stderr,then applies the source8192-byte/ten-line view. It preserves the existing UTF-8 tail contract. Completed/evicted jobs return through fLt's legacy visibility/loss behavior rather than inventing finished-history listing.

Before W320, openTasksPanelLive only handled x and discarded Enter. Runtime backgroundTasks projects active jobs,agents and crons. Terminal dialog cloning already excludes callbacks explicitly; new detail readers must follow that ownership and be cleared with their modal clock on finish/abort/close and on preemption by permissions or forms. Shell output polling must remain active even under reduced motion because it carries data.

## Pre-edit baseline and ownership

Independent reader afba85ea103544ad7 confirms BackgroundRegistry.snapshot is nonblocking,owner-local and non-consuming; waitFor/drainNotifications are unnecessary for details. Existing runtime owners.get avoids allocating resources. AgentDescriptor has no prompt/live activity/transcript reader,so kG remains separate. Source status/elapsed/output adapters for the selected shell/monitor chain are complete.

The first PTY fixture failed before feature dispatch because its physical dimensions defaulted to20columns. Explicit36x120 dimensions through the existing expect wrapper corrected that fixture. The second compiled run starts the shell through real run_background and opens the current list; it fails the expected Shell details/Output auto-open assertion (w320-cli-baseline2.txt,exit1). This is the valid product red baseline. Failed fixtures close the expect process group; later process inspection finds detached registry workers,which are identified by exact fixture paths and terminated. The final driver adds control-file shutdown before group cleanup. No recovered source executes.

Before product edits,the implementation shape was recorded. It adds a passive runtime snapshot accessor; one interactive list/detail sum-state retains selected id and initial-auto-open/back semantics; a terminal request carries its callback outside cloned display data. TUI owns a1000ms data clock only for a running detail and cancels it on finish/abort/close/preemption. The exact Eae line selection and ct clipping are copied/adapted to the existing source-derived width/segmenter/formatters. Output is read from retained stream tails,never from notification queues. Closing emits YG's Shell details dismissed system line,Left returns to list or closes the initial single-task detail,plain x delegates to existing stopTask. Permissions/forms use the existing task-dialog preemption and release the clock.

Write/Edit remains the documented manual-edit fallback because apply_patch is absent.

## Implementation and comparison

`BackgroundTaskDetail` derives its fields from BackgroundJobView. `initialTaskDetail` applies the default single-task branch to supported shell/monitor jobs. `openTasksPanelLive` owns a list/detail sum-state and the source initial-detail flag. It retains the selected id/index across Back, closes an initial detail on task loss, and uses the current list count only for the initial Left branch. A detail entered from the list returns there after completion. Existing stopTask owns termination and settlement.

`Runtime.backgroundTaskDetail` reads owners.get and registry.snapshot without allocation, waiting, or notification draining. TerminalPromptRequest carries the reader outside structuredClone. TuiTerminal owns the running detail's1000ms interval and clears it in the existing finish path, shared by close,abort and form/permission preemption. Data refresh remains active under reduced motion. The initial refresh can finish a vanished detail before the modal mounts; that path returns without reviving the screen.

`taskDetailOutput` adapts the source8192-byte read to retained UTF-8 stream tails and ports Eae's exact backwards newline scan. A trailing newline occupies one of ten slices before empty filtering. Thus thirteen newline-terminated lines yield nine visible nonempty tail lines. `taskDetailClip` copies ct with mechanical identifiers/types. `taskDetailFrame` adapts YG/Eae to plain rows, the existing modal viewport and a twelve-row rounded output box. It reuses source rn/Qt formatters and width/segmenter hosts, strips terminal control effects, and omits React memoization,Suspense loading,color and italic wrappers. Long commands remain clipped at280display cells, then wrap in the host viewport. PgUp/PgDn exposes rows below that viewport.

Source Di delegates to SEe [24861,24997), chunk-1r9zp6s1.js. SEe recursively schedules a source-clock timeout and its teardown sets a stopped flag and cancels the pending callback. T4n is the null sentinel [1484,1496) in chunk-k1caxvem.js SHA-2560486ac30af93e1201282a5264304b0c84a83f55ba2f901a884fbff45fbe6f3a5. These two supporting bodies were acquired during comparison after implementation; the earlier preflight acquired Di and the modal finish owner. The owned synchronous snapshot reader uses a native interval with explicit clearInterval instead of the source clock's recursive timeout. Both use1000ms running-only updates and teardown cancellation; clock-engine equivalence is unclaimed.

Thirteen AST-bound comparisons were generated by scratch w320-source-diff.mjs and read in full. They bind initial,selection,loss,back,live-focus,clipping,output-lines,detail-view,reader,file-tail,refresh,timer-cleanup and keys to exact recovered nodes and owned bodies. Additional exact fLt nodes are initial [674926,675189),Vl [678168,678433),Ra [683126,683641),wi [683955,684091). Source file digests match the manifest. No recovered entrypoint executes.

| Owned target | Mode | Source and host adaptation |
| --- | --- | --- |
| src/task-details.ts taskDetailClip | copy | ct [8443,8612),chunk-yn0pfn70.js. Mechanical name/type changes,existing ae/ra imports. |
| src/task-details.ts initialTaskDetail,taskDetailOutput,taskDetailFrame | adapt | fLt initial,YG/Eae and aC. Supported registry kinds,UTF-8 stream tails and plain modal rows replace React/file hosts. |
| src/runtime.ts backgroundTaskDetail | adapt | zG/iKe. Existing owner registry replaces protected output-file read. Missing/evicted owner returns undefined through legacy task-loss path. |
| src/interactive.ts openTasksPanelLive | adapt | fLt initial/Vl/Ra/wi/Gs. Promise dialogs replace React state;initial flag,live id/index,Back,loss and stop retain their owners. |
| src/terminal.ts TerminalPromptRequest,TerminalPromptAnswer | adapt | YG callback and Gs selected js. Typed callbacks/index cross the existing modal boundary without entering cloned display data. |
| src/tui.ts prompt,refreshBackgroundDialog,renderDialog,handleDialogAction,advanceDialog | adapt | YG/Eae/bj/Di/SEe/Gs. Native1000ms data interval,clearInterval,existing viewport and answer index replace React subscriptions and source clock. |

## Main validation

- Valid red baseline w320-cli-baseline2.txt reaches the actual run_background tool and fails single-task auto-detail before product edits.
- `node --import tsx --test --test-timeout=20000 test/task-details.test.ts` passes3groups. They cover literal tail/grapheme/control-byte behavior, passive owner/event isolation, and real TUI/interactive navigation,polling,held model,draft,form preemption,completion and abort cleanup.
- Affected task/runtime/interactive/TUI suites pass166/166. Background/session/interaction/stash/CLI suites pass72/72. Their commands and logs live in the job scratch as w320-affected.txt and w320-owners-cli.txt.
- `npm run check` and `npm run build` pass, w320-check-final.txt and w320-build-final.txt.
- `node scripts/smoke-task-details-cli.mjs` passes on the rebuilt CLI, w320-cli-final.txt. Real PTY actions verify auto-open,output tail/count scrolling,reduced-motion live update,Enter close,list Enter/Back,monitor stderr,stop,completion and exit0. Inspection adds zero requests while work runs. Two authored tool turns use4requests, followed by1existing generated background-completion turn, total5. The driver permits one or two completion deliveries and checks every later request's actual notification envelope. Locks release and process scan finds no remaining fixture workers.
- Independent comment audit a4c20903f3e6f4f4c retains8required provenance lines in7groups with0deletions,0suppressions and0findings. It makes no edits. Independent correctness review aae20f77f5efecf38 independently passes3groups and compiled5requests,but reproduces one P2 live-focus defect. The original review is bound to its own saved identity and the initial manifest below. Repair and fresh review are recorded separately.
- Live Magpie and the full suite are not_run. All network requests above reach an owned loopback SSE fixture. Paid upstream calls0.

## Incidents and coding standard

The first repaired driver incorrectly expects a below-viewport count, then treats persistent footer ready as restored chat, then decodes UTF-8 per Buffer chunk. The corrections exercise PgDn,check modal absence and use stream UTF-8 decoding. A late assertion incorrectly fixes total requests at4despite existing completion deliveries; the owned journal proves the extra generated event,so the driver checks its actual envelope. Failed expect teardown leaves detached registry workers; exact fixture workers are terminated and every finalizer writes done before PTY teardown. The new type fixture initially omitted required tasks/subagents flags; check exposes that fixture defect and the final typed config passes. Source comparison distinguishes Ra loss from wi Back and adds retained focus; both are corrected before the final artifact run. Failures remain in question.md and scratch,not promoted to passing evidence.

S-1 retains the valid red baseline and every failed fixture. S-2 preserves schema,owner,event queue and explicit source gates. S-3 decodes actual terminal rows and keeps them separate from stored message text. S-4 assigns selected state and polling to the modal and termination to the registry. S-5 checks concrete frames,event envelopes,model counts and resource release. S-6 wires runtime,interactive,terminal,TUI and actual driver together. S-7 records source ranges/digests before edits,adapts existing owners and labels the supporting late clock-body acquisition above. No new suppression or broad behavior rewrite.

## Independent focus repair

Reviewer aae20f77f5efecf38 opens tasks A..F,removes A while the list remains mounted,selects D at the live index2,then removes D while viewing details. The initial adapter uses a pre-await list and saves D's stale index3. Returned rows B,C,E,F therefore select F and first x stops F. Source Gs [677501,677704) saves the current js,and wa falls back by that index. Its supporting full closure [677240,678145) was read before repair.

The repaired TerminalPromptAnswer carries optional backgroundTaskIndex. TuiTerminal.advanceDialog sets it from the mounted list's dialog.index,and openTasksPanelLive uses it with the selected id. This avoids a later snapshot that could change again. Existing exact-answer assertions now verify the additional live index for selection,stop and explicit navigation; other dialog answers omit it. The third regression group includes the reproduced shrink/selection/loss path and verifies E is focused and first x stops E. It still verifies polling cleanup,held model,draft,forms and abort. No extra test group is added.

Repair check/build pass. Final affected166/166 pass in w320-repair-final-affected.txt. The exact original compiled probe now returns selected E and stoppedAfterOneX:[E],w320-main-focus-repair.txt. Rebuilt actual CLI full chain passes5owned requests,exit0 and lock cleanup,w320-repair-cli.txt. One expanded-test retry settles a final modal release before immediately reopening,and existing exact-answer fixtures gain the additive metadata instead of dropping assertions. Fresh independent repair reviewer add626135baef9bdd runs the original compiled probe,asserts returned focus E and first stop E,passes3/3 expanded groups and the existing exact-answer1/1 test,and independently confirms source Gs provenance. Its full content identity matches696d39dff985bc633c0d7602b0609e4476f5986ab12627af01f442dfa2a79640. No additional concrete defect is found. The repair's new ninth provenance-comment line is required by S-7 and independently verified accurate.

## Superseded initial content identity

Captured with `node scripts/identity.mjs --output JOB_TMP/w320-reviewed-identity.json` after the initial reviewed build and actual CLI. This identity includes the untouched pre-existing skills-command test change as part of the validated working tree; it is excluded from the W320 commit.

| Inventory | Files | SHA-256 |
| --- | --- | --- |
| Inputs | 849 | a58a9a928fa2f0421094cefe8730ae10af322e3932f66d6b90da30f7e98e7fe3 |
| Validation | 325 | 960bcec5668204b34874b26d5eb9817740f34d2a7cf94fe8357fea1c46bd7d79 |
| Build | 608 | ad63bbb3c8457ca435d634bedf99ede17ddd936924c1886e25a0940be149a34a |
| Combined | 1782 | c1cf48a0223903f524f51e47332d48dd089156e338d2995ac4a2d28035cfc02d |

The full JSON manifests and thirteen final source/target/diff sidecars are retained in `/Users/mant1ssa/.claude/jobs/c9c17d97/tmp`. Their durable summary is this record. This initial manifest is superseded by the focus repair identity below.

## Repaired content identity

Captured after the repaired build,expanded three-group regression and final166/166 affected run. Actual compiled CLI and the exact original focus probe run on this build. Main rechecks all1782file hashes and the fresh independent reviewer captures the same combined identity.

| Inventory | Files | SHA-256 |
| --- | --- | --- |
| Inputs | 849 | 13ebad67cc99860ae37606577d116a29786a3775b3907873c7a0826ae1434ebe |
| Validation | 325 | c844f59cbf7763f61ac29a5250b3509798a8cea765cacf08826930c9d1ebab5d |
| Build | 608 | 857c905ac1ad8ca5141e61308fa3473219aeafd26d5c4fe67411eb8390ab9114 |
| Combined | 1782 | 696d39dff985bc633c0d7602b0609e4476f5986ab12627af01f442dfa2a79640 |

Full manifest `JOB_TMP/w320-repaired-identity.json` replaces the initial identity. Its validation inventory includes the preserved unrelated skills-command user change; that file remains excluded from this package's stage/commit.

## Remaining

Agent kG details still need prompt/progress/transcript ownership. Foregrounding,WebSocket monitor details,newer oQ/nQ screens,teammate/sidecar ownership and remote/account surfaces stay separate. W301 remains paused. All package verification gates are complete. The final source/tests/build match the independently rechecked identity. Commit stays on the local work branch; no push.
