# W296 copy picker

Status: verified locally, 2026-10-23. Local work on work/w43-choice-preview; no push or account services.

Task card. `/copy [N]` normalizes the selected response, offers full/code/quote/always rows, copies on Enter/click, writes the focused content on plain w, and cancels with Escape or repeated Ctrl+C/Ctrl+D. Always persists copyFullResponse; Config resets it. Settings loading, reload and session metadata retain the user-only preference. Actual compiled CLI validation will cover clipboard bytes, files, cancellation, settings and restart. Required checks are focused tests, check, build and a bounded independent review.

Source artifact 2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All ranges below are zero-based UTF-16 code units, half-open. Extracted files remain inert and unchanged.

| Module SHA-256 | Ranges and role |
| --- | --- |
| c283tj3z 79b675ce7d1fe271ccc2fb0ba60f71b9899f5a7ac9e98a5fafe7582c1a7c82af | Je [16517,16871), ke [16871,16927), Ve [16927,17469), Ge [17469,17750), Ye [17750,17979), ye [17979,18085), ue [18085,18207), A [18207,18528), Be [18528,22085), ve [22085,22222), cn [22233,22896). Parsing, normalization, choices, write/copy/cancel and feedback. |
| 0wtqg4zf 37fffc2f615ac9aaf5d92ff2cacd3d96cb7191880b1115f02b8f3353eb85a50f | mn [7642,9547), fn [9547,12509), Qe [15880,18925), Vn [19681,21102), Fo [21102,22985), be/ro/Pee [23053,23330). Clamp navigation, row-height window, count markers and metadata columns. |
| nybcbd9t 0abe0d704940977466d81c1efab7f953d8f9dac0f30cd758c4a3d0286b5c1bca | copyFullResponse row [23698,23897), global G [8266,8318). |
| bk5ct2gw efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1 | Ze default body [558427,559209), copyFullResponse false at 559188. |
| 2bcyxj9q fac54023446990731332f837b388955e357036b2797a11f93150648afb45f7e0 | Gs/Bs/Us/Sn [83027,83266), zh [83349,83388). Memory wrappers only. |
| sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | Mqr/mK [4430083,4430224). Analysis removal only for block extraction. |
| x3k1646w 2f8e8b1c145d62e9b614863492fbed535bf183812602c8bfe2610f77f133c5c1 | FXe [2213,2309), complete formatter core [1652,23249), reused from tui-markdown. |
| n3ykh62m 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac | Lexer [411715,450354), Cm [449872,449910), reused. |
| ax7r0qj7 8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e | vi [615,677), ne/Lt reused from existing host/source exports. |
| yn0pfn70 1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f | ae [892,935). Existing Node cellWidth/ANSI adapter replaces Bun.stringWidth. |
| am9mebpw 5f299ffd418fdb1dc31123d44ad13270aa6fcbb68e0686709982292c7a1e3f14 | iq [1563,1917), a=800. Adapt refs/effects to two owner-held timer records. |
| 9pedrxny fcabe4b83433a1de48b7eead9aff55c63c79666e930152fa81a7a6c19722aeb0 | Xo [863,1035), c [1220,1611). Global cancel bindings and pending guide. |
| kexg5hxg ff0c3b2de749b1a99560e47932f3e6f8976b4128d678bf28189128944cadd3f4 | mt/_xn [10057,10253), Sv [10735,11558). Reuse bounded OSC52 writer and existing Nx bug predicate; omit native clipboard subprocesses and telemetry. |
| 70nf72b4 fcace513f43a275080517d548c036c517b26349b41bf31c17d26c92361bbdaac | l [903,957), aS [957,1312), c [1391,1422). Copied predicates with owner-held mount time. |
| 06azbynj 5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd | vje=300 at135715; Os handleTerminalFocus [237674,238218), consumeWindowActivationLatch [238218,238371), Ax [242075,244661). Adapt window-activation admission to decoded focus and pointer events. |

Implementation shape. The command owns untruncated text and effects. The modal receives display rows only; a CopyPicker owner owns focus/window, pointer admission and cancellation lifetime. The already recovered settingsWindow adapter supplies the same mn/fn/Qe line-window algorithm. Vn/Fo metadata sizing and row layout are adapted to native JSX and the existing document renderer. Large selections do not copy full text into the dialog display budget. The existing per-process private scratch directory and OSC52 size limit remain host boundaries. Piped input keeps the existing direct full-response path because it has no mounted selector. Screen-reader layout has no host setting and stays outside this package.

Throughput checkpoint. Parsing reuses existing lexer exports; no duplicated parser or framework. One package, one actual compiled CLI driver and at most three new regression groups. apply_patch is absent from this host (command lookup exit 1); dedicated Edit/Write tools are the manual-edit fallback.

## Port and boundaries

Je, ke, Ve and Ge retain their complete source bodies after TypeScript annotations, undefined spelling and string-literal formatting. zh, Nr, l and c are copied with the documented Sn name binding. ve/ye, Be, fn/mn/Vn/Fo, iq and the command are adapted to journal messages, native JSX, the existing line-window adapter and terminal-owned effects. `_xn` is the recovered VS Code 1.123/1.124 UTF-8 advisory, superseding W213's missing-dependency claim. No recovered entrypoint ran.

The command keeps raw selection text; rows contain only labels and metadata. Nr cleans displayed labels without changing clipboard or file bytes. Always saves the user preference before copying; failed settings writes leave the live preference and clipboard unchanged. `w` performs only the file write, including on the Always row. Config changes the live preference in place. Project/local/flag settings do not override this global preference. Reload deletion restores false, and session metadata preserves an existing authored boolean.

The picker adapts aS mount/activation admission, so's physical-row repeat filter and the native focus latch. Pointer state clears on resize/unmount; timer cleanup belongs to the modal. At item-window heights below 3, the fixed modal omits unreserved overflow hints so the source-focused row remains visible. Normal windows retain count hints. This host does not port the scrollbar drag/thumb, screen-reader mode or telemetry. Piped/line-editor sessions retain full-response copying. The existing 256 KiB display budget and 100000 UTF-8 byte OSC52 limit remain; large raw text is never put into request display data. Scratch storage stays private and per-process, not the source session directory. File writes use Node synchronous filesystem operations.

## Validation

All final commands exit 0. New regression groups 3/3; combined affected suite 161/161. `npm run check` and `npm run build` pass. `.audit/w296-copy-picker.mjs` drives the actual compiled CLI through an owned loopback SSE fixture and passes 22/22 checks. Existing `.audit/w233-config-panel.mjs` passes 35/35. Both report the same identity. Requests 3, paid upstream calls 0. Full suite, package smoke and live Magpie are not_run. W283's prior 3201/3202 full-suite baseline and known CLI effort mismatch remain unchanged.

Source verifier `.audit/w296-source-compare.mjs` verifies 15 module hashes against manifest, 8 copied AST bodies, the false default/global write and 4 adapted character comparisons. Expression-free template literals canonicalize to their cooked string value; raw source and comparison digests remain recorded.

Common identity `da1c4c08b1e5fa5d4bc2dd1902b201e20bd5d259b476b8c8f4f5694bfb8f5e33`.
Inputs `7385bbe8029961d71ed2bf3084d16ef5768bcf8756ee3d054af9f81d9f226d07` (832 files).
Validation `a1a596573089d558cecb73509b878c2b585ee3f31bd76fd0812702276a99b4ab` (305 files).
Build `88dda6fcb820ece7540ca0f6449f2a03799161524e742015a02ac2f8a61da0fc` (593 files).
These counts describe inventories, not completion ratios.

Independent review reproduced four defects: missing mount/window-activation filtering, overflow-click row reuse, missing Nr label normalization and an obscured short-window focus row. Each repair follows its owning source range. Final original probe has no findings; the extra 12 checks pass, including 20x10/8 PageDown and End, delayed legitimate clicks, abort/resize ownership, independent cancellation timers and failed Always persistence. Start/end hashes match:

- copy-command `55232e95ec8ef9d8399034880f668668f309b232aa3bfa3d7492b1ef013be289`.
- copy-picker `25c2f98075958a9a6615e876888d6a5d993862bd7e3f95ee48c3857ca3f3c5ed`.
- tui `56baa8248d44dbe0533baed6c8be8de30b5d7edc5d7b98fb31cf8a332520d40e`.
- interactive `7d82c29a8609622f398d7438ec2e137c8b248e2521bc63214127f5728fb6d5f7`.

Comment review inspected 22 added/replaced comments. Deletions 0, new TypeScript/lint suppressions 0, MUST KILL 0. Source-coordinate comments remain as the project requires; the short-window comment records the fixed-modal boundary. Deslop review found no unrelated abstractions or broad exception changes.

S-1/S-7: source task card precedes product changes; defects are reproduced then traced to owning source. S-2: existing copy N/plain-response, settings, draft and paging contracts remain. S-3: normalized display labels never replace raw content. S-4: modal owns focus/window/pointer/timers; finish and resize clear stale effects. S-5: waits bind to files, clipboard payloads and persisted settings. S-6: startup/reload/global layer/session/live Config/runtime identity and compiled drivers are updated. No new coding-standard rule is required.

Logs and JSON live under `$CLAUDE_JOB_DIR/tmp`: w296-tests-final.log, w296-check-final.log, w296-build-final.log, w296-cli-final.log/json, w296-config-final.log, w296-source-final.log, w296-source-comparison.json, w296-delivery-identity.json and independent-final/extra-final logs. Durable drivers and this record reproduce the evidence. Adapted diff SHA-256 values are command `4be5b654584e531293bece45376e29059a2556199e5032ba67d5bb149f512acc`, picker `0edab6652794f40ac2491eec981e73d9d7da0a4401dd9ab4baf71875e9c2d0eb`, pointer `68985c83f09da970424a73dc814e1633c25101812055b5e11b0846467107851d`, settings `469ebfd44775aa1459b885e9a9c4368aadc1266e031ca207df1a5f8df0de4018`.
