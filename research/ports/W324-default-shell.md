# W324 default Shell access

Status: verified locally on 2026-10-24. User explicitly requests Shell access and a default equivalent to bypass permissions on. W323 and the loop remain paused.

## Task card

ID / subsystem: W324, default Shell capability.
Entry / result: a fresh ordinary LiTcode session can execute Shell under the existing default bypass without an allow-shell flag; current user settings enable it too.
Source / dependencies: Bash ki declaration/create/checkPermissions and permission dispatcher $pn in chunk-sfn1dbxq.js; fl/Kt defaults/factory in chunk-hwpb27as.js. W303 owns the existing default bypass policy.
Targets: one boolean default, defaultConfig, CLI startup, reload, system/help/docs and existing focused CLI tests.
Data shape: SessionConfig.allowShell is a resolved boolean; authored settings and CLI overrides remain optional booleans. Resolve absent at configuration assembly, preserving explicit false and managed policy priority.
Mode: adapt the recovered default-enabled tool to the host's existing capability bit. Retain the current permission evaluator, child narrowing, abort and cleanup owners.
Actual CLI: owned loopback tool call writes a marker without explicit allowShell; controls cover authored false, managed false and original pinned resume.
Completion: source/card before edits, actual compiled red/green, at most three added regression groups, affected checks/build, independent review, identity and local commit. No coauthor/no push.

## Source evidence acquired before product edits

Sample2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All ranges are zero-based half-open UTF-16 code units, obtained by Acorn after manifest digest validation. Source files remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-hwpb27as.js | c5f6d5b8fb187a14de3db7aebcb5615a3632aa34a0e174c54d38607e7c5ead8e | fl [120818,120979) sets isEnabled true; Kt [121053,123737) merges fl with each declaration |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | ki object [4332433,4347620) has no isEnabled override; declaration head [4332433,4333135); create [4336748,4347619); checkPermissions [4337644,4338198); $pn [3360771,3364305); axr starts [3321476,3349547), focused entry [3321476,3323500) |

$pn preserves deny/ask and mandatory interaction decisions before its bypass allow branch. Bash has its own validation and permission checks but no separate default-off enable switch. The host's existing allowShell capability is retained as an explicit narrowing setting, with a default true adapted from fl. This does not port the entire Bash executor, sandbox, parser or remote host. Existing root guard, authored rules and pinned session metadata retain their owners.

## Throughput checkpoint

Blocking first steps. Validate recovered default/Bash/permission source and task card before product edits. Reproduce missing default capability through the compiled CLI.
Independent workstreams. One bounded read-only workflow explained host startup/reload/resume readers. Main owns source acquisition and all coupled edits. A fresh independent review follows the stable diff.
Shared mutable state. Only main writes product files. Real user settings use the existing serialized atomic writer and preserve unrelated fields/mode. Fixture directories are private.
Smallest safe decomposition. One resolved boolean with absent authored values is sufficient. No new permission evaluator, CLI mode or resource owner is added.

## Validation

apply_patch is absent from PATH; dedicated Write/Edit fallback remains in use. Before the change,current user settings had bypassPermissions and absent allowShell. The existing serialized atomic writer now saves allowShell:true and retains bypassPermissions. A before/after structural comparison verifies every unrelated field and mode0600. Only those two nonsecret permission fields are printed. Global litcode resolves to this checkout's bin/litcode.mjs; the rebuilt parser resolves actual settings to allowShell:true and mode:bypass.

`node scripts/smoke-default-shell-cli.mjs --baseline` passes the pre-change observation in JOB_TMP/w324-cli-red.txt: two owned requests,mode bypass,allowShell false,paired error result and no marker. The new source/default edit follows that actual compiled observation.

`npm run check` and `npm run build` pass,exit0,in JOB_TMP/w324-check.txt and w324-build.txt. Affected command passes136/136 in w324-affected.txt: `node --import tsx --test --test-concurrency=4 --test-timeout=20000 test/default-bypass.test.ts test/shell-permissions.test.ts test/permissions.test.ts test/permission-cycle.test.ts test/bypass-guard.test.ts test/reload.test.ts test/tools.test.ts test/agent-registry.test.ts test/agent-isolation-runtime.test.ts`. One added group covers base default,reload,explicit false and original pinned false. Existing CLI effects/resume assertions now run with no enable setting. The WebSocket-without-Shell fixture explicitly authors false and retains its original assertion.

CLI command passes37/37 in w324-cli-tests.txt: `node --import tsx --test --test-concurrency=4 --test-timeout=20000 test/cli.test.ts test/cli-advanced.test.ts test/cli-gateway.test.ts test/cli-migration.test.ts`.

Actual compiled `node scripts/smoke-default-shell-cli.mjs` passes12owned loopback requests in w324-cli-green.txt. Six scenarios verify default Shell marker creation without an enable flag,authored false,explicit enable over authored false,managed false over explicit enable,plan-mode denial despite capability true,and original resume retaining false after settings become true. Every invocation exits0 and releases journal locks. Main process scan finds no remaining owned fixture. The default-marker file content is exactly shell-default; pairing is checked in actual follow-up requests.

An additional actual compiled Expect PTY in JOB_TMP/w324-interactive-shell.mjs starts without any Shell or permission-mode flags,shows bypass permissions on,accepts `!printf interactive-default > interactive.txt`,writes the exact marker and exits0 with no locks. respondToBashCommands:false keeps this direct human Shell validation at0model requests. Result w324-tui.txt binds the same2bf7602a identity. It verifies the interactive composer path independently of the model tool-call driver.

Full suite,real Magpie,paid upstream and package smoke are not_run. Paid calls0. All model requests use owned loopback. JOB_TMP means `/Users/mant1ssa/.claude/jobs/c9c17d97/tmp`.

## Source and target comparison

Four AST-bound literal diffs compare source fl.isEnabled [120822,120838) with DEFAULT_ALLOW_SHELL,defaultConfig's property,CLI assignment and reload assignment. The adapter is the existing optional authored boolean precedence around source true. Each source module matches manifest and target ranges/body digests are recorded in JOB_TMP/w324-source-comparison.json. All four diffs are read. This is a default/capability adaptation,not a port of the full recovered tool factory or executor.

## Content identity

`node scripts/identity.mjs --output JOB_TMP/w324-review-identity.json` binds inputs859files,bf84be79fdd05f53e2f45f18ef269eb820eb17808e9b1e55d4b5ebcc52f04185; validation328files,34e55d4dc60a09bb07574c0f9dba57b1b6f98792f048732ab6edcfd881e7ac8c; build614files,c74770bf695fa51d2ee144393d858b31337057e515a270d1c941fcf1bfdd0588. Combined1801file digest is2bf7602a4c2eb8e593bada2f3253086deef259e7a681ad7ee0a2451ac7e518ce. The compiled run reports that exact identity. Research/README/audit docs lie outside the shared product identity. Validation includes the user's pre-existing skills-command modification; it remains outside the package commit.

## Review and delivery

Workflow wf_8581fa6e-fde completes independent correctness and comment reviews sequentially. Correctness reports no verified scoped defect,reruns default-bypass/reload6/6 and the compiled six-scenario12request smoke,all exit0. Identity before and after matches2bf7602a. Logs are w324-independent-tests.log and w324-independent-smoke.log. Its verdict covers default/priority/resume,not complete application equivalence.

Comment audit reports0writes,0suppressions,0MUST KILL and one redundant capability narration in tools.ts. Main removes that narration while retaining the OS permission boundary and all mandatory provenance. `npm run build` passes again in w324-final-build.txt. TypeScript AST printing with comments removed proves src/tools.ts and dist/tools.js executable syntax unchanged. Comparing complete manifests verifies those are the only changed product/build files and validation stays byte-identical after review.

Final `w324-final-identity.json` binds inputs859,a1213bec7fe21d0e16e57cf4f7dd01e1671a921033d9db21b1310bb45e96e3fa;validation328,34e55d4dc60a09bb07574c0f9dba57b1b6f98792f048732ab6edcfd881e7ac8c;build614,ff1c3eb603cb01714b79a6f5eb3fd52f2896d3a0a79db9d21608a29747dd9579. Combined1801file digest is121c45188e36c4421994444a5fba1e5bb33c6275a93aab56ee4e0e8b8120754d. The reviewed behavior transfers through this measured comment-only change; successful CLI suites are not mechanically repeated.

S-1 verifies actual baseline,source coordinates,marker effects and identity. S-2 preserves authored/managed false,plan,rules and original resume. S-3 is inapplicable to this non-rendering default. S-4 retains existing executors/child narrowing and closes each fixture;real settings use the serialized atomic owner. S-5 binds exact bytes,paired requests and released locks. S-6 updates base/startup/reload/system/help/docs and preserves parser absence. S-7 acquires source/card before edits and reads4literal source/target diffs. Existing seven rules cover filename/import-boundary incidents in local question.md. Model the Domain retains one resolved boolean and optional authored values. No additional rule or suppression is introduced.

W323 and the loop remain paused. Local commit uses exact paths,no coauthor/no push,and preserves .audit/w45-77-evidence.mjs plus test/skills-command.test.ts.
