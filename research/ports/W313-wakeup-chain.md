# W313 dynamic wakeup chains

Status: verified locally on 2026-10-24, including independent cancellation repair3/3. Local commit only; no push.

## Task card

- Entry: repeated schedule_wakeup calls for one dynamic /loop prompt, stop:true and user interruption.
- Outcome: retain each prompt's continuous chain age, end scheduling at the configured recurring maximum, reset a stale chain after the source grace period and clear cancelled chain state.
- Source: C/w/T2o/N8n, he's sessionCron chain registry and the ScheduleWakeup descriptor.
- Shape: a prompt-keyed chain map owned by LocalScheduler, plus the existing pending slot and the currently delivered dynamic prompt.
- Targets: scheduler, runtime/interactive cancellation adapters, up to three regressions and the existing compiled scheduler CLI driver.
- Method: adapt the obtained branch bodies to the owned scheduler clock and session owner. Keep the established exact-delay timing and legacy tool-schema compatibility.
- Checks: source-to-adapter diffs, baseline, focused tests, actual compiled CLI, check/build, identity and independent review.
- Boundaries: future-wakeup resume sidecar, minute rounding/cache-lead timing, keepalive fallback and noop transcript collapse remain separate consumers. W301 stays paused.

## Source preflight

Sample 2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All ranges are half-open, zero-based UTF-16 code units. The selected modules match extracted-v2/manifest.json before product edits.

| Module | SHA-256 | Obtained bodies |
| --- | --- | --- |
| chunk-68g5e6vr.js | 744653993cecb30c1252f18cb7d92c8955e901c6ba5172cec97fdd90bd8a6dc9 | C [2208,3481), w [3775,4151), T2o [1671,2208), N8n [4928,5325), F [4151,4515), O [4515,4658), R2o [3481,3775) |
| chunk-4bw62nzm.js | 1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713 | he [34628,35290), hIo/bPr/Gsn/efe/jpt [106454,106739), w4 [107141,107581) |
| chunk-tar639dc.js | c8f74100741e1b26457915d3a67a41b9a9ae9ef5bab44e7c334f18c8fbb6f2fc | Ts [44477,45695), bs [45696,46240), yo descriptor [46241,50040) |
| chunk-atzjaveb.js | 71378d5821cac631dfe41fe2db138ed7853b6008545668f423b89cbf4d060a2a | _9 [7882,8029), recurringMaxAgeMs 604800000 and cacheLeadMs 15000 |
| chunk-1shb9gj1.js | 821d52e2e4fa6dbc3ea936a2c02fc27672c64c44d19a242d7124083e5e9a9eb4 | QEe [1223,1326), including recurringMaxAgeMs's zero-disable schema |
| chunk-appb2dtz.js | f907c40bc2574ae400d65a4764ffbd500f770290f697a2c2db12f6bd2a52e887 | Ie [17435,19295), k [17621,17841), M [17862,18200), onFireTask [18384,18879), idle effect [19175,19294) |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | wo [432968,434531), explicit interrupt calls N8n before the active-turn cancel |

C first removes pending loop rows, reads hIo(prompt), and resets its start only when no history exists or now > lastScheduledFor + 3600 seconds. It ends scheduling when maxAge > 0 and now-start >= maxAge. The first refusal records an agedOut tombstone with lastScheduledFor = now - 3540 seconds; repeated calls retain that tombstone, permitting a fresh chain only after its 60-second grace. w records the start and latest scheduled time after successful scheduling. T2o/N8n remove loop rows and forget the pending and in-flight prompts; cron rows stay. he owns the map and clears all fields on reset. Ie records a fired prompt until the model becomes idle. The source tool accepts noop in its schema, requires it and reason on a normal call, always reports stopped:true for stop, and returns scheduledFor:0 for age expiry.

The existing host uses a separate exact-delay slot. Its direct scheduleWakeup API rejects nonfinite values and retains that boundary. Minute rounding and source F's cache-lead calculation were obtained but are intentionally outside this package's established timing contract. The host still has no keepalive budget, wakeup resume sidecar or quiet-tick transcript renderer.

## Baseline

At 9e40b04, an owned LocalScheduler probe schedules the same prompt once per hour through age 604800000. It still has a pending wakeup after seven days. A second probe passes the exact fields emitted by loopCommandPrompt, including noop:false, and receives {ok:false,error:"unknown property 'noop'.",code:1}. Both probes only execute owned code.

## Throughput checkpoint

Blocking first steps are the verified source bodies and the two baseline probes. One read-only researcher checks the independent host lifetime question. Shared mutable state consists of one scheduler's pending slot, chain map and delivered prompt, so one direct in-place implementation owner keeps their transitions together. Sequence Work into Verifiable Units orders scheduler transitions, tool compatibility, cancellation wiring, CLI validation and independent review. Model the Domain selects a prompt-keyed map, matching source he, rather than scattering age state across tool calls. Project workflow overrides the skill's writer fanout. apply_patch was verified absent in W310; the existing dedicated Write/Edit fallback is retained.

## Implementation

LocalScheduler owns the prompt-keyed chain map. Replacing a pending wakeup preserves the previous prompt's history. A successful rearm retains the original start within one hour of the last scheduled time. An expired chain returns scheduledFor zero and leaves no pending wakeup. The aged-out tombstone keeps C's strict 60-second grace. The existing recurringMaxAgeMs option also applies to dynamic chains; zero disables age expiry.

A fire enters a delivered-id map that retains its original prompt until the event's model turn settles. The interactive dispatcher claims that exact id immediately before the turn; a missing id is a cancelled event and is skipped. This transition adapts Ie.k's scheduled identity to the host's extra queue. Id-specific retirement avoids clearing a newer wakeup fired by the idle check. Stop forgets pending and delivered prompts and invalidates all delivered ids, so already-drained local queue entries never reach the model. Ordinary cron rows stay independent. Runtime queues carry a dynamic discriminator, and the interactive queue retains wakeupId through sentinel expansion. Explicit terminal interruption clears pending/queued dynamic work before aborting the model turn. Session release clears both maps with its scheduler.

New tool schemas accept and validate noop and require both noop and reason on normal scheduling calls. The legacy schema branch keeps pre-W313 snapshots byte-for-byte and permits their old inputs. Every stop returns stopped true plus the pending-cancellation count, including zero. The result remains structured JSON, as the host's other scheduler tools expect. Noop transcript collapse is still absent and is not claimed.

## Verification

- check and build exit zero after the queue repair. Logs are w313-check5.txt and w313-build2.txt in the session scratch directory.
- Affected scheduler, runtime, interactive and loop-file suites pass116/116 after the repair. Three new groups cover continuous age, strict grace, stale/zero-age/reset behavior, tool fields, cancellation isolation, legacy original-session reopen, a real Agent interruption and the independent queued-A/B reproduction. Log w313-affected-fixed.txt. The focused repair run passes6/6 in w313-repair.txt.
- CLI, advanced, gateway and background-session suites pass31/31 after the repair. Log w313-cli-tests-fixed.txt.
- The compiled scheduler driver with --wakeup advances168 hourly deliveries. All344 owned loopback requests succeed. At seven days the tool returns zero without a pending wakeup; after grace a new chain starts, stop cancels one pending row, and a second stop returns zero. No subsequent fire occurs, and session locks release. Final repaired log w313-cli-wakeup-fixed.txt.
- Existing compiled --idle passes after repair with3 owned loopback requests in w313-cli-idle-fixed.txt. The --creators chain passed before the queue repair with6 requests in w313-cli-creators.txt; it was not rerun after that repair. Busy disk state and one deferred fire remain valid in the final build. Creator exit, clear history, original resume and cleanup were verified by the earlier compiled creator chain and final affected tests.
- Seven adapted handlers are compared against exact Acorn source nodes with module/body hashes, target ranges/hashes and diff -u outputs. Report /Users/mant1ssa/.claude/jobs/c9c17d97/tmp/w313-source-comparison.json. Each changed diff was read after the queue repair. Source C's expiry and stale ordering is retained; telemetry, source-minute rounding and absent fallback/sidecar owners are recorded adaptations.
- Full suite, live Magpie and paid upstream calls are not_run. All CLI calls use an owned loopback fixture.
- Initial independent review confirmed two queue-lifetime defects. The preserved probe is in subagents/agent-ad20f93bc00a98d82.jsonl call call_c465598759a948568893621eff2fe55f in this session's transcript directory. It showed9 requests, a cancelled A chain returning zero on restart, and queued B reaching the model after stop. The delivered-id claim/invalidation repair reduces the owned reproduction to8 requests, successfully rearms A and drops B. A fresh independent reviewer then ran the three wakeup groups once and passed3/3 with no further confirmed behavioral defect. The reviewer confirmed the8-call sequence and literal t180 rearm, while correctly distinguishing that rearm from delivery at t180.
- The comment-only review retained13 original S-7 provenance comments and recommended zero deletions. It found no suppressions or workaround flags. The repair reviewer requested two runtime forwarding citations and the Ie.k source-table range. The source-table range was already added during review; both forwarding comments are now present. No new suppression or workaround flag was added.

Content identity after the two final provenance comments is recorded by scripts/identity.mjs in w313-final-identity.json. Inputs844, validation318 and build605 files. The final build exits zero in w313-build-final.txt. w313-comments-only.txt verifies that every source/test/build digest from the repaired identity remains identical after removing exactly those two comments from runtime.ts and its emitted runtime.js. Behavior tests and compiled results bind to that unchanged code.

| Part | SHA-256 |
| --- | --- |
| Inputs | fec0ae5aa772260090d666b57c5ff3e988621fc4896535dccc61dfc4b6adba49 |
| Validation | e5ba5cb160088df7fb902a2ec27e1cad7078ce6baa7e4afda463bcb757075389 |
| Build | 4eefb19b92a6380a81d8440611b7a9b5ce4d48ef21efa320ee363f7696599f8f |
| Combined | 52e313f06d3743a0cba93d58765696482c7d21f8b3da326fac644d6c08a4d713 |

## Standard check and remaining work

S-1/S-7 bind exact source, pre-edit baselines and seven body comparisons. S-2 preserves exact timing, finite-input validation and legacy pinned schemas. S-3 is not applicable. S-4 binds chain, pending/delivered prompt and queues to one session and verifies interruption/release. S-5 checks tool results and absence of later CLI requests. S-6 propagates noop, delivery kind and wakeupId through their consumers in the same package. Fixture corrections are recorded in research/question.md under the existing seven rules; no suppression or workaround flag is added.

Future pending-wakeup resume still needs the source sidecar's toolUseId binding and the journal reconstruction consumer. Headless closed-input keepalive, fallback-budget behavior, source minute rounding/cache lead, noop transcript collapse and teammate execution ownership remain separate packages. The inherited unstable-write unlink limitation remains. W301 is paused.
