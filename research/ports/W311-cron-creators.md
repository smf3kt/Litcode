# W311 cron creator eligibility and session history

Status: verified locally on 2026-10-24, including an independent paused-read repair recheck. Local commit only; no push.

## Task card

- Entry: a durable task created by this session, an earlier session in this process, or a departed creator in the same project.
- Outcome: deliver only source-eligible tasks, retain foreign live creators' records, stamp the creator birth token, and preserve delivery across clear/restart.
- Source: Je/Pe/he/Le/ke/me/ne in x0r, Pot, _a, $$e/lse/Hue, NP/o1e/a8e/Oh and K/vd/mn.
- Shape: one creator context holds the current session, observed session IDs, legacy transcript evidence and a 60-second PID birth cache; only eligible file tasks hold delivery deadlines.
- Targets: scheduler creator adapter, scheduler, runtime/interactive session adoption, existing tests and compiled scheduler driver.
- Method: adapt the recovered predicates and startup refresh. Map the source project transcript directory to the owning local journal directory.
- CLI chain: observe exclusion of a live foreign creator, creator exit and takeover, owned task creation, clear inheritance and original-session restart refresh.
- Checks: at most three new regression groups, affected scheduler/runtime/interactive checks, compiled CLI, check/build and content identity.
- Boundaries: W301 remains paused. Agent-targeted filtering and the inherited unsettled-write watcher limitation remain separate.

## Source preflight

Sample 2.1.296 SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`. Each module below was verified against its manifest `decodedSha256` before product edits. Ranges are half-open, zero-based UTF-16 code units from Acorn.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-jrz2zk22.js | da64f780f2b184a92cd87a21d03c8a02ca80ec4124edf791eccd988a67c980a3 | Je [4566,5233), x0r [5233,11476), Pe [5610,5804), he [5804,5839), Le [5839,5987), ke [5987,6337), me [6337,7616), ne [7616,9890) |
| chunk-atzjaveb.js | 71378d5821cac631dfe41fe2db138ed7853b6008545668f423b89cbf4d060a2a | Pot [6985,7298), s_e/bds [7298,7656) |
| chunk-akfkn8xh.js | dcae213f12d26a84eface39176fff4ed4a0cb63f83e6a3f32336dd6ca0ad36d0 | _a [1624,1704) |
| chunk-3sda67c1.js | 285259b1c6dcf821a48f703d5fb866a9f69e9b52f19a235a9ae68f7dd7384cef | $$e [4509,4634), Hue holder [5100,5209), lse [5307,5366), Ul [5636,5899), P [6054,6368) |
| chunk-nca5bd28.js | a6f69359e93ba0c15ee9da0020883965ad9b61175383f270f55b09fe7bffcd6a | UUID expression [1995,2063), NP [2064,2139), o1e [12727,12801), a8e [13384,13408), Df/VE [13408,13483), Oh [13537,13577) |
| chunk-4bw62nzm.js | 1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713 | K [76686,76729), LRo [76950,77630), mn [77630,77706), A_ [77819,78508), session emitter [78989,79008), vd [79009,79055) |

The complete x0r body was read as inert text, including its stopped checks, watcher/retry, catch-up failure retention, id-keyed cache cleanup and session subscription teardown. Source ke admits a creatorless task only under the lease, admits the current creator directly, admits an observed in-process session only with matching PID and birth token (or creation after performance.timeOrigin), and otherwise requires a lease, project evidence, and an absent or demonstrably departed/recycled creator. Pe uses kill(pid,0) and caches the synchronous stable-locale ps birth lookup for 60 seconds. A live creator without a token remains ineligible. Source he folds slashes and case in this macOS build. Je accepts only UUID-shaped legacy creator IDs and regular transcript files under the current project's directory.

Source me refreshes PID and birth only for current-session records whose PID differs, then filters missed one-shots through ke regardless of lease. Pot writes lse with the creator session, PID and project. Source ne checks ke before creating a delivery deadline and drops cached deadlines for tasks that cease to be eligible. W310's lease handoff protection must remain, while a current creator's valid cache must survive acquiring an unrelated lease.

## Host adaptation and throughput checkpoint

The host closes and rebuilds a scheduler on session replacement instead of mutating the source singleton's current session. The interactive owner will retain the observed session-ID set and pass it through runtime replacements. A runtime supplies that set and its bound journal directory to the creator context; schemas remain passive. Session IDs and filesystem paths are host inputs. There is no recovered entrypoint execution or service dependency.

One implementation owner keeps predicate, cache, watcher and session adoption changes together. Model the Domain chooses the creator context and eligible-deadline set; Sequence Work into Verifiable Units orders baseline, predicate regressions, compiled use and independent review. Manual edits use the available Write/Edit tools because apply_patch was verified absent during W310.

## Baseline and implementation

At HEAD 222c0e9, an owned probe wrote a recurring row with a different creator session, the live process PID, its actual birth token and the same project. The lease holder fired it and stamped lastFiredAt. Source ke rejects that delivery until the creator departs or its PID birth changes.

`src/scheduler-creators.ts` adapts Je, Pe, he, Le and ke. The synchronous ps boundary uses execFileSync with argument separation and a 1000 ms timeout, retaining the source LC_ALL=C/TZ=UTC contract. The own token is cached like Hue/lse; each foreign PID's birth observation expires after 60 seconds. The source `_a` behavior is retained locally instead of reusing the distinct lock helper `processGone`, which treats non-ESRCH errors differently. Project identity keeps this sample's slash and lowercase transform. Transcript checks use the source UUID grammar and lstat regular-file check. They map Oh(project) to the owning `.agent` directory, including an explicitly bound journal directory where available.

Pot now writes the creator token. Startup me refreshes PID and token for this creator when its PID differs and filters missed one-shots through ke even under lock contention. Failures retain the file. All stored tasks remain listable, as cre/CronList does in the source. A separate set tracks which file jobs own a deadline. Ineligible rows lose that cache and acquire a fresh deadline from their persisted stamp when they become eligible. An already eligible current or prior-session creator retains its deadline during unrelated lease acquisition. File and session jobs retain their existing callback and exact-timing contracts.

The interactive session tracks IDs actually observed during this process and passes them to each accepted runtime. The runtime feeds that history to its creator context before attachment. It survives `/clear` and runtime replacement but is absent after a process restart. A restarted original session instead takes the source current-creator refresh path.

## Verification

- `npm run check` and `npm run build` exit 0.
- Scheduler, creator, watcher, runtime-resources, runtime-events, interactive and interactive-loop pass 100/100. Three new regression groups cover project and legacy transcript evidence, live/dead/recycled PID behavior, own resume, contended current/prior delivery and retained eligible deadlines. The existing creatorless lease-handoff regression still checks duplicate prevention.
- CLI, advanced CLI and gateway suites pass 25/25. The actual background-session suite separately passes 6/6, for 31/31 combined.
- `node scripts/smoke-scheduler-cli.mjs --compiled --creators` passes with seven owned loopback SSE requests on the final build. An earlier run had six; both due recurring rows can enqueue separate turns. It observes silence while a real foreign creator lives, delivery after that process exits, actual creator fields written by cron_create, `/clear` history delivery, original-session restart PID/birth refresh, another scheduled turn and released scheduler/journal locks.
- Existing compiled `--durable` passes with three requests. Existing compiled session-only chain passes with six requests.
- No paid upstream call or recovered entrypoint execution. Pre-existing tracked user edits were preserved. Full-suite and live Magpie are not_run.
- Independent bounded review reproduced a duplicate at the lease acquisition boundary. The reviewer paused the first task-file reload after acquiring the lock and ticked with an old list projection. Removing only its deadline marker allowed that tick to rebuild from the old lastFiredAt. The fix removes the entire previously ineligible projection before publishing held, while retaining eligible current/prior creator jobs. The existing handoff regression pauses that exact read; affected 100/100 and final compiled creator7/watch3 pass after the repair. A fresh independent reviewer ran the exact contended-file-lease test once, 1/1 passed, and confirmed the P1 closed. No additional confirmed defect remained in the scoped review.
- The bounded comment review requested one optional navigation-line deletion. That deletion was accepted, source citations were retained, and the build was refreshed. No workaround/suppression findings or new constraint encoding.

Content identity after the acquisition repair and final build:

| Set | SHA-256 |
| --- | --- |
| Inputs | 8c12064b1f0b12ba9bcffb80d269b79f44f35f6a7beb6662cc6f8c1ac4137be3 |
| Validation | aa7458d2c6b0ba12f41e92f814caf59b94d966f2b552c93b23274f9956332b40 |
| Build | 1d03413a6aad05806359af5279ead4df75040fd20fc503c2305841ec37f2bf46 |
| Combined | 7a28a4ce0fb4feb4c7b8176700ef0b31d9c6a3c6234b123979050ec8694da0dd |

## Source comparison

Eight acquired source ranges and their adapted handler ranges were extracted and compared with character-level `diff -u`. The scratch report is `/Users/mant1ssa/.claude/jobs/c9c17d97/tmp/w311-source-comparison.json`, with one exact source digest, port digest and diff path per pair. The adapted predicates were also compared branch by branch. Pe preserves alive check, absent-token result, cache TTL and exact mismatch condition. he/Le preserve project precedence over legacy transcript evidence. ke preserves current creator precedence, observed in-process creator PID and birth checks, timestamp fallback, and lease/project/departed takeover. Je preserves unique noncurrent IDs, UUID validation, regular transcript evidence and failed-lookup exclusion. me preserves own-PID refresh before eligible catch-up, delivered-ID suppression and failed-handler retention. ne keeps eligibility before a retained delivery deadline; the host stores a list projection separately so ineligible rows stay visible. No source application was executed for this comparison.

## Remaining boundaries and standard check

Agent-targeted filtering remains open. The W310 unsettled-write unlink and cross-process write-transaction limitations remain. Current-session-ID authority and this macOS sample's case folding are preserved as source behavior. S-1 through S-7 were checked; fixture/type corrections and the live-creator baseline are recorded in local research/question.md. S-3 is not applicable. Existing standards cover the incidents, so no new rule is added.
