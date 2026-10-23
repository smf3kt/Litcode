# W312 cron idle delivery

Status: verified locally on 2026-10-24, including independent idle lifecycle tests. Local commit only; no push.

## Task card

- Entry: a cron or dynamic wakeup becomes due during a model turn, including a durable recurring task.
- Outcome: retain its due time and file state while busy, then check it when the model becomes idle. A long turn produces one overdue recurring fire, followed by the next occurrence from actual delivery time.
- Source: x0r.ne loading guard and Ie live-loading callback plus idle checkNow effect.
- Shape: the scheduler reads a live loading callback; the runtime binds that reader to the current Agent busy owner. A completed action checks the existing scheduler without allocating it.
- Targets: scheduler, runtime reader binding, Agent busy accessor, interactive startup/successor/finish, existing tests and compiled scheduler driver.
- Method: adapt the recovered read callback and checkNow effect. Ordinary local dialogs remain independent from model loading.
- Checks: up to three necessary regression groups, affected scheduler/runtime/interactive suites, compiled held-response chain, check/build, identity and independent narrow review.
- Boundary: teammate-targeted cron requires the unimplemented teammate owner; ordinary isolated children remain isolated. W301 stays paused.

## Source preflight

Sample 2.1.296 SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`. Module digests were verified against extracted-v2/manifest.json before product edits. Coordinates are half-open zero-based UTF-16 code units.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-jrz2zk22.js | da64f780f2b184a92cd87a21d03c8a02ca80ec4124edf791eccd988a67c980a3 | x0r [5233,11476), ne [7616,9890), loading prefix [7616,7735) |
| chunk-appb2dtz.js | f907c40bc2574ae400d65a4764ffbd500f770290f697a2c2db12f6bd2a52e887 | Ie [17435,19295), To loading reader [17528,17539), x0r call [18344,19042), onFireTask [18384,18879), isLoading callback [18880,18897), assistantMode [18898,18913), idle effect [19175,19294) |
| chunk-68g5e6vr.js | 744653993cecb30c1252f18cb7d92c8955e901c6ba5172cec97fdd90bd8a6dc9 | w [3775,4151), y [4744,4850), BG [4875,4928) |
| chunk-rx2nah4x.js | cfb79b3b3d580f450f8184e5873a686eb083e9ea3abd4e0a58268425de6acc51 | KL headless scheduler call [562879,563257) |

The complete acquired x0r body retains `if (isLoading() && !assistantMode) return` before reading the clock, testing jobs, invoking callbacks or stamping/removing a file row. Ie supplies its latest model-loading prop through To. Its idle effect returns while loading and calls the existing scheduler's checkNow after idle loop bookkeeping. The dynamic wakeup source w registers a sessionCron task with kind loop, so it is subject to the same driver guard; this host retains its existing exact dynamic-slot timing and adds the same loading guard.

Lifecycle failure behavior stays in the existing owner. A thrown or aborted model action resets Agent.busy in its finally; the runtime reader observes that reset, then the interactive completion check processes overdue tasks. Cleanup removes the reader with the session scope and does not allocate a scheduler merely to check it. Replaced runtimes receive a new callback tied to the active Agent slot before attachment. No durable loading state is journaled. The headless KL caller reads Me.running and has additional closed-input/agent-wait rules. This one-shot host binds the same active Agent reader without starting a new drain loop; closed-input keepalive remains a separate unported behavior.

## Baseline and scope decision

At ec60673 an owned probe supplied isLoading returning true, advanced three minutes, and ticked a durable recurring task. It still delivered the prompt, changed nextAt and persisted lastFiredAt during that busy period. The option did not exist and was ignored. Existing runtime-events only checked that delivery to the model waited behind the active turn; it did not check whether the task was already removed or stamped.

Cron agentId belongs to source teammate context. Pot writes agentId only for session-only tasks, CronCreate rejects durable teammates, CronList filters current teammate rows and CronDelete enforces ownership. Host selectChildTools and childConfig deliberately omit scheduler controls from ordinary AgentRegistry children, and no team owner is present. W216 already records that distinction. W312 retains this dependency rather than treating a named child as a teammate. Full targeted delivery awaits that execution owner and its lifecycle.

## Host adaptation and throughput checkpoint

Model the Domain keeps loading as a reader of the actual Agent busy field, rather than a second mutable copy of model state. The runtime owns reader registration and removes it on release. Ie's idle effect maps to checking the scheduler after an interactive action settles; ordinary dialogs do not set Agent busy.

Source preflight and a failing baseline are the blocking steps. Independent source research is read-only. Scheduler callbacks, runtime release and interactive replacement share one lifecycle, so one direct in-place implementation owner keeps the diff together. Sequence Work into Verifiable Units orders predicate regression, runtime binding, held compiled request and independent review. Project rules override the skill's default writer fanout. apply_patch was verified absent in W310; manual changes use dedicated Write/Edit.

## Implementation and verification

The scheduler reads `isLoading` at the start of tick, before due-state changes or store operations. Its default reader is idle and the recovered assistant-mode exception remains available to the owned scheduler API. The runtime owns loading readers by session, removes them on release, and checks only an already allocated scheduler. The interactive loop supplies its active Agent slot at startup and accepted replacement, then checks after an action settles. A one-shot CLI binds the same Agent reader without adding a headless event-drain loop.

- `npm run check` and `npm run build` pass.
- Scheduler, idle, creator, watcher, runtime-events, runtime-resources, interactive and interactive-loop suites pass 103/103. Three new regression groups verify no busy mutations, one deferred recurring fire, one-shot/dynamic retention, the assistant exception, passive runtime binding/release and real Agent failure/abort reset. The existing interactive test now verifies that a due one-shot remains in the task list and outside the event queue while its model is busy.
- CLI, advanced CLI, gateway and background-session suites pass 31/31. Earlier Agent plus CLI/runtime checks pass 63/63.
- `node scripts/smoke-scheduler-cli.mjs --compiled --idle` passes with three owned loopback SSE requests. A held model response crosses three minutes, preserves the original task file, then yields one scheduled turn. The next occurrence is calculated from actual idle delivery, another busy-era occurrence is not replayed, and locks are released.
- `node scripts/smoke-scheduler-cli.mjs --compiled --idle-headless` passes with two owned requests. The first response creates a durable cron; the second is held while the clock advances. The file remains unchanged until exit and scheduler/journal locks are released.
- Existing compiled `--creators` and `--durable` chains also pass after the final idle binding, with seven and three owned requests respectively. This covers clear/original resume and watcher/lease cleanup under the new completion check.
- No paid calls or recovered application entrypoints. Full-suite and live Magpie are not_run. The two pre-existing tracked user changes remain untouched.
- Independent correctness review passes. The reviewer ran test/scheduler-idle.test.ts once, 3/3 pass, and found no confirmed scoped defect after reading the source and owner lifecycle. The reviewer inspected the supplied broader logs rather than rerunning those suites. The headless probe proves busy suppression and exit cleanup; it does not claim headless idle event delivery. A separate comment review retained eight S-7 source citations, with zero optional deletions, workaround flags or suppressions.
- Final compiler/build proof paths are `/Users/mant1ssa/.claude/jobs/c9c17d97/tmp/w312-check2.txt` and `/Users/mant1ssa/.claude/jobs/c9c17d97/tmp/w312-build2.txt`. Independent trail review found these pointers missing from the initial verification row; an append-only evidence row now supplies them.

Identity from scripts/identity.mjs on the final tested build:

| Set | SHA-256 |
| --- | --- |
| Inputs | 3c832dc3dba58da4046b828a4bfeefe1ced35677186a81bc11407ddf30b1c621 |
| Validation | 21dce27915a6e75f88579baa33dc1ee7fd4b6f9bba501b7d726d4a3785bbe72f |
| Build | acb30aab692bbbaa509979687a617d1cad78c95de926d3bfa7d952e2dd77724a |
| Combined | fc02b99e259793945c71f0ff1c16b366fc8615f1980afc0473f7498892c4f84f |

## Source comparison and standard check

Six acquired source ranges and adapted handlers were extracted with exact half-open UTF-16 coordinates and compared through `diff -u`. The scratch report is `/Users/mant1ssa/.claude/jobs/c9c17d97/tmp/w312-source-comparison.json`, which binds module/body hashes and each adapted handler digest. The ne guard preserves loading-before-mutation order and the assistant-mode exception. Ie's To callback maps to Agent.isRunning instead of a React ref; its idle effect maps to a passive runtime check after the Agent resets. KL's loading callback maps to a one-shot reader, while its closed-input agent-wait behavior remains separate.

S-1/S-7 bind the recovered bodies and baseline before edits. S-2 retains child isolation, exact dynamic timing and ordinary idle scheduler behavior. S-3 is not applicable. S-4 keeps readers under the session lifetime and verifies failure/abort/reset. S-5 uses held HTTP completion and actual file bytes. S-6 changes both CLI lanes and startup/successor readers together. Existing standards cover the work; no new suppression or rule is introduced.

## Remaining boundaries

Teammate-targeted creation, listing, deletion and delivery await a teammate execution owner. Acquired source evidence is recorded above; the teammate lifecycle and its direct delivery/stop dependencies are not fully acquired. The main onFireTask removes an agentId task whose teammate is absent or terminal; the host has no such task producer, so W312 does not manufacture one. W310's unsettled-write unlink limitation remains. The one-shot headless host still exits after its ordinary task and does not implement the source's closed-input loop keepalive. Dynamic wakeup timing stays on the host's prior exact-delay contract.
