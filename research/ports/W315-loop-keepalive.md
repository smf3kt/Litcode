# W315 local loop keepalive

Status: verified locally on 2026-10-24, including independent correctness and completed fresh comment review. Local commit only; no push.

## Task card

- Entry: a dispatched dynamic wakeup finishes its interactive model turn without another pending dynamic wakeup.
- Outcome: arm one 1200-second fallback with the same original prompt. A second consecutive missing rearm ends the chain. Explicit rearm resets the budget; stop, interruption and session close clear it.
- Shape: the existing pending/delivered/active wakeup lifecycle plus a session-owned consecutiveKeepalives counter. A fallback carries keepalive:true in its pending metadata.
- Targets: scheduler, runtime forwarding, scheduler regression groups and existing compiled CLI driver.
- Method: adapt C2o/C and Ie's idle effect to the existing LocalScheduler and exact delivered-id claim. Reuse source timing and the existing prompt queue.
- Gate: k2o defaults true and reads a tri-state environment override. Its neutral local name is HARNESS_LOOP_KEEPALIVE. No account or service lookup is added.
- Checks: baseline, focused and affected regressions, actual compiled interactive CLI, check/build, exact source comparisons, identity and independent review.
- Boundary: headless/closed-input process keepalive, pending-wakeup sidecar, noop transcript folding and teammate execution remain separate. W301 stays paused.

## Source preflight

Sample 2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Ranges use half-open zero-based UTF-16 code units. Each module digest was compared with extracted-v2/manifest.json before product edits. Recovered text is inert data; no recovered application entrypoint executes.

| Module | SHA-256 | Acquired bodies |
| --- | --- | --- |
| chunk-68g5e6vr.js | 744653993cecb30c1252f18cb7d92c8955e901c6ba5172cec97fdd90bd8a6dc9 | L [1175,1246), k2o [1246,1362), C2o [1437,1642), A1r [1642,1671), T2o [1671,2208), C [2208,3481), w [3775,4151), F/O [4151,4658), N8n [4928,5325) |
| chunk-appb2dtz.js | f907c40bc2574ae400d65a4764ffbd500f770290f697a2c2db12f6bd2a52e887 | Ie [17435,19295), idle effect [19175,19294), onFireTask [18384,18879) |
| chunk-4bw62nzm.js | 1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713 | he [34628,35290), efe/jpt [106619,106739), wPr/zsn [106739,106865), qsn/yDt/Zzn [106961,107141) |
| chunk-yvnhkg35.js | ce3689687897e987959f19ab07f98d79e5c925a8b15620dce02d29ba4943348d | WR=M.triBool() [58356,58370), environment export at 48680 |
| chunk-phz47asr.js | 3d37bfa1a457f1e45fa115ea9002376a2549517043763e9cdb0d29e09e8d967d | i/t/u [716,854), s [893,947), M declarator [1032,1168) |
| chunk-fdxhcr6b.js | 3c625e31827ca4ef7cc3a4691103fbbb3abbdd338778cbf70c0054f37359507b | Ne [615,757), Es [757,908) |
| chunk-1h28m7y3.js | 5a3fa4c727e1683d3d018ab6172f841d972519ce2528a8a63d8c26249f246f04 | kv [947,1025), scheduler availability defaults true, with process disable and feature-service gate |
| chunk-1eegq95r.js | b84d67a18c2873ac0f54b882718647305d0c037b20d1b873b5a2d49b9b3db65b | se/registerLoopSkill [22959,24166), A1r only for a fresh bare or prompt-bearing user command |

C2o checks consecutiveKeepalives>=1 before calling C(1200,prompt,{viaKeepalive:true}). C resets that counter only for a model-authored schedule, applies the existing chain-age gate, records the same prompt and timing, then increments for fallback. T2o and N8n clear the active prompt and counter before cancelling. Ie clears the active prompt on idle, invokes C2o only with k2o enabled and no pending loop task, then checks the scheduler. Source true literals are 1/true/yes/on and false literals are 0/false/no/off after lowercase and trim. Unrecognized or absent values use the default true. The vendor feature service is excluded; the local scheduler availability and neutral environment variable supply its local gate.

## Throughput checkpoint

Blocking first steps are complete source ownership and a baseline. One bounded read-only researcher located the host completion seam and reported remaining EOF reads explicitly. Independent work is limited to that question and later review. Shared session state has one direct in-place writer. One implementation unit keeps scheduling, idle completion, cancellation and compiled verification together. Model the Domain keeps fallback budget with scheduler ownership. Sequence Work into Verifiable Units orders scheduler behavior, runtime integration, compiled CLI and independent review. The existing Write/Edit fallback applies because apply_patch was previously verified absent.

## Implementation and source comparison

The baseline at HEAD0bd1b3a dispatched a dynamic wakeup, claimed it and completed it with pending:null. The adapted scheduler now keeps one consecutiveKeepalives counter beside its existing pending, delivered and active wakeup state. C's shared body distinguishes explicit schedules from automatic fallbacks. An explicit valid schedule clears the counter, a successful fallback increments it, and stop/close reset it. finishWakeup claims only the matching active id, keeps the original prompt, clears active state and follows Ie/C2o's no-pending-task and budget gates before arming1200 seconds. An undispatched or stale id earns no fallback. A fallback passes through the same source age/timing path and carries keepalive:true.

The interactive completion path calls finishLoopWakeup after the Agent has reset loading and before checkScheduler, matching Ie's order. Runtime forwarding uses the existing owner and allocates nothing on completion. The environment adapter keeps the source tri-state spellings with a default true and a neutral name. It makes no vendor feature-service call. The source ended/wake-fire telemetry has no local consumer and is omitted; finite public input validation, legacy exact timing and the established additional queue/claim adaptation remain.

Nine AST-bound source-to-adapter pairs, their module and body SHA-256 values, target coordinates and diff files live in /Users/mant1ssa/.claude/jobs/c9c17d97/tmp/w315-source-comparison.json. All nine diffs were read. They cover k2o, Ne, Es, C2o, C, T2o, N8n and Ie's completion and checkNow order. Each body is an adaptation because its source reads the recovered process/session store and React effect while this host has an owned LocalScheduler plus an explicit async turn boundary. No rewrite of the source budget or fallback interval is introduced.

## Validation

- Initial focused wakeup/timing/keepalive run passes9/9, and the first typecheck passes. Logs w315-focused.txt and w315-check.txt.
- Final affected scheduler/creator/watcher/idle/wakeup/timing/keepalive/runtime/events/interactive/loop-file run passes122/122 in w315-affected.txt. Three new groups cover one fallback, budget reset, original prompt, pending replacement, gate spellings, stop, stale and undispatched identity, age, close, sentinel resolution and session lock cleanup.
- CLI, advanced, gateway and background-session suites pass31/31 in w315-cli-tests.txt. Typecheck and build pass in w315-check2.txt and w315-build.txt.
- Actual compiled interactive --keepalive performs9 owned loopback requests. It confirms the1200-second deadline, one fallback followed by budget exhaustion, explicit rearm restoring the budget, stop cancelling the pending fallback and released locks. Log w315-cli-keepalive.txt.
- Actual compiled --keepalive --keepalive-disabled performs3 owned loopback requests. off suppresses the automatic fallback and exit releases the lock. Log w315-cli-disabled.txt.
- Existing compiled --wakeup-timing and --idle pass9 and3 owned loopback requests. They explicitly turn the new independent keepalive gate off so each retains its original timing or busy-cron contract. Logs w315-cli-timing.txt and w315-cli-idle.txt.
- Independent correctness review verified the two core source module digests and passed12/12 targeted keepalive/wakeup/timing/idle tests. It also passed13 direct scheduler assertions and four interactive cases for true, false, absent/default and interruption. Instrumentation confirmed finishLoopWakeup precedes checkScheduler. No scoped defect was confirmed. Its stricter fifth probe observed a temporary pending fallback during terminal teardown and stopped before testing final cleanup. The separate main-owned w315-close-probe.mjs advances the fallback clock during terminal flush and confirms three model calls total, zero post-close model delivery, no pending wakeup after release, zero owned timers and no session lock. Log w315-close-probe.txt. That transient state is recorded rather than hidden or changed without source evidence. The review's standalone typecheck and compiled smoke were not run; main's results above retain their separate authority.
- The first comment reviewer returned an incomplete result because its reads omitted the six changed comments. That pass provides no line-level approval. Two ambiguous cross-module citations were made explicit before a fresh narrow review. The fresh reviewer read all six comments and the bounded diff, accepted all six as required provenance or ordering explanations, and found zero new suppressions and zero required deletions. No behavior changed.
- Full-suite, live Magpie and paid upstream calls are not_run.

Final content identity is /Users/mant1ssa/.claude/jobs/c9c17d97/tmp/w315-final-identity.json, with844 input,320 validation and605 build files. The final build passes in w315-build-final.txt. w315-comment-only.txt verifies all1769 file hashes against the behavior-tested identity after restoring only two clarified provenance clauses in scheduler.ts and emitted scheduler.js. Executable changes after the successful behavior checks are zero.

| Part | SHA-256 |
| --- | --- |
| Inputs | 6b8978064443f0180a73cb4afe8226e17c747a6ee197e9e1e6f67f35d5b69866 |
| Validation | 1ee8dfc39301b87f35d457ffb0f9523caccaf32c794f01158447e6aee713ba54 |
| Build | 84acd319ede670b3d974277ab74700841080e9a9cc5d468abd10cfa6ae8bdc92 |
| Combined | afeafd6036db9336e8ddbea4e5dad9108e61a698124d529ac9867e89d0bd8dd7 |

## Standard check and remaining work

S-1/S-7 acquire module bodies and parser closure before edits, reproduce the missing fallback, verify AST coordinates and read nine exact source diffs. S-2 preserves old schemas, finite public inputs and exact/jitter timing contracts. S-3 is not applicable. S-4 binds counter, prompt and cancellation to the current scheduler and clears them on stop/close. S-5 uses fixed local fixture time and public result/lock observations. S-6 updates idle completion and actual CLI drivers together. Local investigation and verifier failures are recorded in research/question.md. The existing seven standards cover them.

The functional family remains Partial. Headless and closed-input process keepalive, background-job sidecar recovery, noop transcript folding, teammate ownership and the inherited unsettled-write unlink issue remain separate. The source DST fall-back target remains inherited from W314. W301 stays paused. Local commits only; no push.
