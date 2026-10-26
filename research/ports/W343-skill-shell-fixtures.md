# W343 skill Shell fixtures

Status: verified locally with independent review, 2026-10-26. Parent dac1bdc. Full-suite failures remain separately tracked. Local closure only. No coauthor or push.

## Task card

ID / subsystem: W343, skill execution verification after the W324 default Shell change.
Entry / result: explicit Shell-disabled skill fixtures keep their original denials; the compiled inline/fenced skill driver also exercises default-enabled Shell without an enable flag.
Source / dependencies: recovered fl/Kt default-enabled tool factory and Bash permission checks; existing W06 inline/fenced command extraction and preflight adaptation.
Targets: test/skill-runtime.test.ts and scripts/smoke-skill-inline-cli.mjs. Product behavior stays unchanged.
Mode / reason: repair fixture setup to author allowShell:false where an existing assertion requires disabled Shell. Preserve every original assertion.
Actual CLI: compiled inline/fenced expansion, default-enabled invocation, explicit false, whole-group preflight, pinned resume, model invocation, interactive entry, managed override and cleanup.
Completion: reproduce failures, verify source, minimal fixture repair, affected/full checks, build, actual CLI, independent review and exact-path local commit.

## Source and ownership

Sample 2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All ranges are zero-based half-open UTF-16 code units. Sources are inert data and remain unchanged.

- chunk-hwpb27as.js SHA-256 c5f6d5b8fb187a14de3db7aebcb5615a3632aa34a0e174c54d38607e7c5ead8e. fl [120818,120979) supplies isEnabled:true. Kt [121053,123737) merges that default with the tool declaration.
- chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da. Bash declaration head [4332433,4333135) has no enable override; its checkPermissions [4337644,4338198) retains the permission evaluator. W324 records the host capability adaptation and explicit false priority.
- W06 records inline/fenced extraction and permission evaluation in the same source. The actual acquired command-execution context [3368985,3370400) checks the tool permission before calling it. Existing approve in src/skill-runtime.ts checks explicit host allowShell:false before invocation approval. Existing executeBlocks wrapper and childConfig preserve the parent's false capability. No replacement executor is needed.

Both module digests were checked against extracted-v2/manifest.json before changing fixtures. The task changes no product body and introduces no new source adaptation.

## Throughput checkpoint

Blocking first step: direct skill suite and actual compiled CLI reproduce the stale default assumptions before edits.
Independent work: main owns the two coupled fixture edits; one fresh read-only reviewer verifies the stable result.
Shared state: fixture workspace and user directory belong to the driver; pre-existing three dirty paths stay outside this package.
Smallest change: explicit false in negative setups and one default-enabled positive invocation. No new product branch or test group.

## Baseline

JOB_TMP is /Users/mant1ssa/.claude/jobs/c9c17d97/tmp.

- node --import tsx --test --test-concurrency=2 --test-timeout=20000 test/skill-runtime.test.ts exits1,32/34. Logs w343-skill-baseline.txt show block-output receives true where the fixture expects false, and inline expansion reports explicit invocation approval where the fixture expects disabled Shell.
- node scripts/smoke-skill-inline-cli.mjs --compiled --fenced exits1. Its no-enable negative scenario actually finishes end_turn with one owned loopback request,code0 instead of expected2. Log w343-inline-baseline.txt.
- Baseline identity w343-baseline-identity.json matches W342 final7f18156558e7f60c135a77e3f3e494f45e786492b3f75168e9cb11215eaf1366,1856records.
- apply_patch remains absent from PATH. Dedicated Write/Edit is the recorded fallback.

## Verification

- Affected command exits0,42/42: node --import tsx --test --test-concurrency=2 --test-timeout=20000 test/skill-runtime.test.ts test/default-bypass.test.ts test/shell-permissions.test.ts test/skills-command.test.ts. Log w343-affected.txt. Both original failure assertions now pass without any assertion change.
- npm run check and npm run build exit0. Logs w343-check.txt and w343-build.txt. git diff --check exits0.
- The same actual compiled inline/fenced driver exits0 with9owned loopback model requests. Log w343-inline-final.txt. It validates default-enabled expansion,explicit false,preflight,pinned resume,model skill calls,interactive use,managed override and lock cleanup.
- node scripts/smoke-default-shell-cli.mjs exits0 with6scenarios and12owned loopback requests. Log w343-default-shell-cli.txt. It verifies default Shell effects,authored false,explicit enable,managed priority,plan denial and original pinned false on resume.
- Full npm test exits1,3380tests:3377pass,1fail,2cancelled,0skip. Log w343-full.txt. The one assertion failure is plugin-toggle forced re-enable reporting Session tool schemas changed. It reproduces independently as2/3 in w343-plugin-observation.txt and was already recorded by W332. The two cancellations are statusline and terminal-focus editor handoffs. TuiTerminal captures its editor at start,while these fixtures change VISUAL only immediately before handoff. They launch the inherited nvim instead of the fixture /usr/bin/true. A separate statusline run reproduces the same timeout. All related product/test files are byte-identical to HEAD. Three owned editors require SIGKILL after SIGTERM leaves them alive;their exact PIDs,parents and private prompt paths are checked before signalling. The complete test/editor PID set is verified exited. These are separately tracked closure work,not a green full-suite claim.
- npm run notices:check exits1 with Dependency notices are stale in w343-notices.txt. Package,lock,notices and generator are unchanged from HEAD. This separate delivery issue is tracked for follow-up instead of regenerated inside the fixture package.
- No paid or external model calls. The existing default-Shell driver retains its private evidence directory and has no active process. Inline fixture cleanup removes its owned directory.

## Content identity

Candidate w343-candidate-identity.json has1856records:inputs886,a8fa867ea4c896ca453ee0fe5f29677b6601a685945a4689029f8fd5588af77d;validation344,7407e8c86e2fb54b551ec60d042330d55ce36d60aa3aa1dffb834763bd66a945;build626,753ceddb0f08a4e0f154da74154f7ce91158194d77a5c40f989d8d4a988fd62b. Aggregate0c727dbf3365a6c567f9078e32b03a916d22dde7cc05b4001c9eb134ab921acb. The build digest is unchanged from W342.

## Rule comparison

S-1 reproduces source tests and actual compiled driver before edits. S-2 authors explicit disabled setup and retains every original assertion. The positive driver exercises default-enabled behavior without flags. S-3 has no rendering change. S-4 private fixture ownership and cleanup are retained,with JOB_TMP selected when available and exact observed editor processes reclaimed during broader validation. S-5 preserves exact text,file and request-count assertions. S-6 updates the affected source fixtures and actual CLI driver together. S-7 reads manifest-verified source defaults and permission owners before edits. The Test Behavior, Not Implementation principle keeps the existing observable effect/error assertions. No new product code,regression group,dependency or suppression.

## Independent review

A fresh Opus read-only reviewer reports no confirmed scoped defects. Independent skill-runtime34/34 and compiled inline/fenced9ownedloopbackrequests pass. It verifies both recovered module digests and the source ranges as inert data,with Bash/inline contexts distinguished from complete bodies. AST comparison preserves198test assertions,34driver assertions and34test groups. Scoped comments and suppressions both change0. All1856records before/after match aggregate0c727dbf. Baseline comparison changes only the two verification files;product source/build are identical. All three protected dirty files retain their hashes. Owned fixture directories,locks and processes are released. Evidence is JOB_TMP/w343-independent-summary.json,w343-independent-tests.txt,w343-independent-inline.txt,w343-independent-source.json,w343-independent-identity-result.json and w343-independent-cleanup-final.json. The reviewer read the task record before main added the full-suite observations,so its verdict covers the frozen fixture change and does not certify those separate failures.
