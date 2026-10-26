# W344 mounted editor fixtures

Status: verified locally with independent review, 2026-10-26. Parent c1e254f. One local closure package. No coauthor or push.

## Task card

Entry / result: statusline and terminal-focus handoff tests select their owned editor before terminal startup and finish without launching an inherited interactive editor.
Data / ownership: the existing cached editor command belongs to each mounted TuiTerminal. Fixture VISUAL/EDITOR overrides belong to the test and restore after close.
Source: recovered C/P/hx cache and Zie launcher, plus W287's independently verified mounted-selection adaptation.
Targets: test/statusline.test.ts and test/terminal-focus.test.ts. No product body or signature change.
Mode: move existing fixture setup to the owner's creation boundary. Preserve all original behavior assertions and timeouts.
Validation: prior full/single-run failures, focused tests, check/build, existing actual compiled editor-hint/handoff driver and independent review. Full suite remains W343's failing scope until plugin closure.
Completion: no inherited editor, exact draft/focus/mode assertions retained, fixture cleanup, identity and exact-path local commit.

## Source evidence

Sample2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All ranges are zero-based half-open UTF-16 code units. Both modules are verified against extracted-v2/manifest.json before fixture edits and are read as inert data.

- chunk-7tnkhv2k.js SHA-256 9ffb6fdc8861a418299ffa0765be70a40cdb348468f8bcae67d846ea155ee4d9. Context [2499,2988) contains C [2499,2801), P/hx through2908 and XG through2988. C resolves VISUAL,EDITOR or a PATH default once;hx uses the host-owned cached resolver. Zie [3072,3957) reads hx before launch and restores terminal state in finally.
- chunk-24k7d6mw.js SHA-256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31. WR hint effect [722518,722821) uses the resolved command for the displayed editor name.
- W287 source/independent review records that TuiTerminal passes its mounted cached command to draft and existing-file opens. Existing editor tests must configure the command before mount. Line-mode direct calls retain a per-call resolver.

Current start captures externalEditorCommand at src/tui.ts;handoffEditor passes that command to editExternal. Both failing tests instead set VISUAL only immediately before editDraft. The inherited nvim is therefore selected at startup. Fixture repair follows the existing source-backed owner contract.

## Baseline and throughput

JOB_TMP is /Users/mant1ssa/.claude/jobs/c9c17d97/tmp.

W343 full log records both handoff cases timed out after20000ms and stalled the test files. The separate statusline observation reproduces the same timeout. Process-tree observations identify three nvim launchers under exactly those test owners and private prompt paths. Main verifies PID,parent,path before signalling and confirms all test/editor PIDs exited after SIGTERM followed by SIGKILL. No other process is selected. Related files are unchanged from c1e254f.

Baseline1856record identity is0c727dbf3365a6c567f9078e32b03a916d22dde7cc05b4001c9eb134ab921acb in w344-baseline-identity.json. Source and build are unchanged from W343. Apply_patch is absent;dedicated Edit/Write remains the established fallback.

Blocking first steps: source cache and current creation/handoff contract are read before edits. Main owns fixture mutations. One independent reader follows the stable identity. Shared env overrides are established before mount and restored after owned terminal close. No new abstraction or product branch is needed.

## Verification

- node --import tsx --test --test-concurrency=2 --test-timeout=20000 test/statusline.test.ts test/terminal-focus.test.ts test/external-editor.test.ts test/tui.test.ts test/terminal.test.ts test/vim.test.ts exits0,141/141,zero failures,cancellations or skips. Log w344-affected.txt. The two original handoff cases finish without modifying their existing timeouts or assertions.
- npm run check and npm run build exit0. Logs w344-check.txt,w344-build.txt. git diff --check exits0.
- W287_RESULT=JOB_TMP/w344-compiled-editor-result.json node .audit/w287-external-editor-hint.mjs exits0. Log w344-compiled-editor.txt. The existing driver verifies the source/default selection,decoded PTY hint and actual compiled editor success/failure,launcher/descendant cleanup,TTY restoration,exact submitted draft and released locks. All requests use the owned loopback provider. No paid or external upstream call.
- Product inputs886 and build626 records are unchanged. Only the two test files differ from W343. Candidate1856file aggregate b355a00d1b2be2e760e5a0d00305d65d38428e8ec9f9fa8875e486d8d9e0eecd binds validation344,05fd721490e9aeadd68dcecc1e72fefd12718c0548751a5482ed68efaa36c8eb. Input a8fa867ea4c896ca453ee0fe5f29677b6601a685945a4689029f8fd5588af77d and build753ceddb0f08a4e0f154da74154f7ce91158194d77a5c40f989d8d4a988fd62b remain the prior values.
- Full suite is not repeated for this fixture-only package. W343's3377pass,1plugin failure and2editor cancellations remain historical scope. This package closes the two editor cases through the original tests plus the affected and actual compiled chains. Plugin re-enable/schema failure and stale dependency notices remain next separate packages.

## Rule comparison

S-1 retains the original timeout observations and reads the owner/source before edits. S-2 preserves all assertions and timeouts. S-3 changes no rendered product. S-4 moves environment setup to before mount and restores it with the test cleanup hook after terminal close. Existing terminal/file/process cleanup stays exercised. S-5 keeps exact drafts,colors,cursor positions,focus reports and terminal-mode assertions. S-6 updates both stale fixtures. S-7 binds source digests and cached resolver/launch ranges. The Test Behavior, Not Implementation principle preserves the observable handoff assertions. No new regression group,product body,dependency,comment or suppression.

## Independent review

A fresh Opus read-only reviewer reports no confirmed scoped defects. Independent two-file tests pass6/6 with zero failures,cancellations or skips. The existing actual compiled driver passes26checks with1ownedloopbackrequest and verifies launcher/descendant exit,terminal restoration,private-file removal,exact draft submission and released locks. Observed owned processes and directories remaining are0. Exact AST comparison preserves all94assertion expressions,every timer expression and test option. Whole-file normalization confirms only fixture environment relocation and the test callback parameter change. No comments or suppressions change. Both source module digests and all supplied UTF-16 ranges match. All1856before/after records match b355a00d;inputs/build match baseline and only the two test files differ. All three protected dirty paths retain their hashes. Environment restoration is verified from test-hook/finally ordering without a separate instrumented restoration test. No build/full-suite rerun is claimed. Evidence is JOB_TMP/w344-independent-result.json and its linked logs/manifests. The reviewer makes0repository edits.
