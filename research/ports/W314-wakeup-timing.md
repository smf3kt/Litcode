# W314 dynamic wakeup timing

Status: verified locally on 2026-10-24, including fresh independent44/44 after the fractional-deadline repair. Local commit only; no push.

## Task card

- Entry: schedule_wakeup with features.schedulerJitter enabled, followed by an idle scheduler tick.
- Outcome: use source minute rounding and short-delay cache lead, retain the source scheduling metadata, and deliver through the same one-shot early-fire calculation as the recovered loop task.
- Source: F/O/T/w in chunk-68g5e6vr.js and E0n/wqe in chunk-atzjaveb.js.
- Shape: one timing result with clamped delay, clamp status, target time and cron-search baseline; the scheduler retains its pending dynamic task plus a delivery deadline.
- Targets: scheduler timing body, existing scheduler tests, up to three necessary timing regression groups and the compiled scheduler driver.
- Method: adapt the obtained arithmetic to an injected clock. The existing schedulerJitter gate selects source timing; absent/false retains exact delays and strict finite-number validation.
- Checks: literal baseline, source-body diffs, focused and affected checks, actual compiled CLI, build/identity and independent review.
- Boundary: source pending-wakeup persistence requires a background job or takeover owner that this host lacks. Record that dependency rather than adding foreground-session persistence. W301 stays paused.

## Source preflight

Sample 2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Ranges are half-open zero-based UTF-16 code units. Module digests match extracted-v2/manifest.json before product changes.

| Module | SHA-256 | Obtained bodies |
| --- | --- | --- |
| chunk-68g5e6vr.js | 744653993cecb30c1252f18cb7d92c8955e901c6ba5172cec97fdd90bd8a6dc9 | C [2208,3481), w [3775,4151), F [4151,4515), O [4515,4658), T [4658,4744), R2o [3481,3775) |
| chunk-atzjaveb.js | 71378d5821cac631dfe41fe2db138ed7853b6008545668f423b89cbf4d060a2a | wqe [7779,7878), _9 [7882,8029), E0n [8395,8604), S0n=300000 |
| chunk-1shb9gj1.js | 821d52e2e4fa6dbc3ea936a2c02fc27672c64c44d19a242d7124083e5e9a9eb4 | QEe [1223,1326), cacheLeadMs schema/default |
| chunk-jrz2zk22.js | da64f780f2b184a92cd87a21d03c8a02ca80ec4124edf791eccd988a67c980a3 | ne [7616,9890), b invokes E0n for nonrecurring loop tasks |

F rounds the chosen delay, clamps it to60..3600 seconds, then rounds the planned time up to a local minute through O. For clamped delays at most300 seconds, it subtracts whole minutes while the target is more than285 seconds away and another subtraction would retain at least60 seconds. The source default cacheLeadMs is15000. createdAt is planned when planned precedes target, otherwise target-1ms. w registers a nonrecurring session task with the target minute/hour, that createdAt and an eight-hex random T id. ne uses E0n for actual delivery, so target minutes00/30 may fire early, bounded by createdAt. The tool's scheduledFor remains the target minute, independently of the actual delivery deadline.

F handles nonfinite values internally; the owned public API continues rejecting them before entering this arithmetic. Source was read as inert data and no recovered application entrypoint runs.

## Recovery investigation and scope decision

The candidate pending-wakeup resume chain was acquired first. FNt/gLo/qHr in chunk-4rj4sh8g.js have SHA-256 b285bc82fb7dfb36adc4247b0fab7b5888dab471b9e355e52d75af6b2b97a331 and ranges [1352,1526), [1526,1669), [1669,2020). The sidecar is .pending-wakeup, at most1024 bytes, with {toolUseId,scheduledFor,chainStartedAt}. qHr subscribes to yIo, serializes writes by revision, skips new values during shutdown and flushes an owned write chain. FNt uses the obtained atomic tOe [1887,2029), chunk-afp70n0f.js SHA-256 c81d1efcc6cf69ae19bf71b60c29f43690cbf23a6f01570585950e098d8dd513. gLo uses ja [1049,1174), chunk-64ag51qf.js SHA-256 23d6c6928ff6c0f325ac3fa61bd1dd61f60982d008f8b9970983060a17127c92.

Yi [62585,64239) and zOr [44297,48799), chunk-6ejn7q9s.js SHA-256 e652d11d8941d479b41f93f296877a1bc0544c549ddd6b9999f681192effbfee, match the last completed tool result by id and scheduledFor, require a bounded tool-call age, avoid delivered/notified duplicates, rearm a future wakeup and leave a past-due wakeup stopped with a local notice.

Its persistence gate is bd [466224,466263), chunk-bk5ct2gw.js SHA-256 efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1. bd is Nt() || HS()!==null; Nt [466111,466144) checks background session kind and HS [462673,462710) reads bgTakeover. dO [466263,466315) selects that owner's jobDir or the background job environment directory. This product has neither a background-session jobDir nor takeover owner. An ordinary session journal directory is not the source jobDir. The acquired host binding investigation identifies possible local hooks, but does not supply the missing source job owner. Resume remains blocked on that owner; no foreground persistence is invented. ToolContext/session schemas remain unchanged in this package.

## Baseline and throughput checkpoint

At f209125, jitter:true with a clock at local12:00:30 and delay300 schedules exactly12:05:30 and stores createdAt12:00:30. Source F/O produces target12:05:00, createdAt12:04:59.999 and a270-second target delay. Additional owned arithmetic probes confirm60 seconds at :30 rounds to90 seconds, delay270 at :00 becomes240 seconds, delay301 at :30 becomes330 seconds and delay3600 at :30 becomes3630 seconds. No sample application code was executed.

Source and the baseline block implementation. One read-only host researcher checked binding independently; their budget overrun is recorded. The timing function and its consumers share one pending task, so one direct in-place owner changes them together. Model the Domain keeps target metadata and delivery deadline distinct. Sequence Work into Verifiable Units orders pure arithmetic, scheduler delivery, compiled CLI and independent review. Project rules override writer fanout. The established Write/Edit fallback applies because apply_patch is absent.

## Implementation and source comparison

The jitter-enabled scheduler uses F/O's target and creation baseline, source T's eight-hex id and E0n's actual delivery deadline. DynamicWakeup.nextAt stores the delivery deadline separately from scheduledFor. The loading gate, one-shot removal, delivered-id claim and cancellation remain shared with W313. The absent/false gate retains exact timing and its prior rounded-versus-requested clamp status.

Seven source-to-adapter comparisons bind exact Acorn source nodes, module/body hashes, target ranges/hashes and diff -u outputs in /Users/mant1ssa/.claude/jobs/c9c17d97/tmp/w314-source-comparison.json. The comparisons cover F, O, T, w, C, ne and E0n. Each diff was read. Source T is copied with TypeScript annotation/formatting only; F/O are adapted for clock/default injection, and w/ne use the host's existing dynamic slot. A shared E0n flooring defect found independently is repaired so it retains the numeric fractional deadline. The public finite-number guard and existing cron parser/DST search contract remain explicit host adaptations.

## Verification

- Typecheck and build pass after the fractional repair. Logs w314-check2.txt and w314-build2.txt.
- The focused scheduler run passes50/50 before the fractional repair; the final affected scheduler/runtime/interactive/loop-file run passes119/119 in w314-affected-fixed.txt. Three new timing groups cover minute/cache boundaries, clamp status, search baseline, target versus E0n fire, deterministic fractional floor/ceil behavior, loading/cleanup, legacy exact timing and both DST transitions.
- Final CLI, advanced, gateway and background-session run passes31/31 in w314-cli-tests-fixed.txt.
- Final compiled --wakeup-timing passes9 owned loopback requests, verifies target minute/cache lead, actual event delivery, stop/rearm and released locks. Log w314-cli-timing-fixed.txt.
- The existing --wakeup168-hour chain passes344 owned requests after its clock fixture was corrected. Log w314-cli-chain-fixed.txt. The earlier real-elapsed preload caused the old iteration-count assertion to fail at166 iterations because source minute rounding had already elapsed seven days. Only this session-only hourly fixture freezes Date/Date.now at explicit jumps; timing and durable-watch fixtures keep elapsed wall milliseconds. This compiled chain predates the later shared E0n fractional repair; final source regressions verify the repair.
- Final compiled --idle passes3 owned requests, unchanged busy file state, one deferred fire and released locks. Log w314-cli-idle.txt.
- The first independent reviewer confirmed a1ms-early E0n defect with a deterministic fractional deadline and independently checked168 exact hourly re-arms. The shared helper now preserves the fraction and its regression proves floor pending/ceil eligible. Fresh independent repair verification ran the timing and scheduler suites once, passing44/44 with no further confirmed scoped defect. The reviewer read the shared cron consumer and verified that it too retains the fraction. The comment-only review kept the five added/updated provenance citations and the gate documentation, removed one optional parameter-description clause and found no suppressions or workaround flags. A failed automatic review-skill fork performed no work; the independent reviewer completed the recorded direct verification instead.
- All model requests use owned loopback fixtures. Full-suite, live Magpie and paid upstream calls are not_run.

The initial DST expectation guessed05:02 instead of the source's observed05:01 repeated-hour result. It was corrected against the direct Date/F/O probe. The backward target is inherited source behavior and is retained. All incidents are recorded in research/question.md; no new suppression is introduced.

Final reviewed content identity is /Users/mant1ssa/.claude/jobs/c9c17d97/tmp/w314-final-identity.json. Inputs844, validation319 and build605 files. The final build passes in w314-build-final.txt. w314-comment-only.txt verifies that all source/test/build bytes match the repaired identity after restoring only the one removed comment clause in scheduler.ts and emitted scheduler.js. No executable code changed after the final behavior checks.

| Part | SHA-256 |
| --- | --- |
| Inputs | 6e670382f779e77fbcd3ba6846f2ed54b3cd86cefa368c0f044931cb4620945b |
| Validation | 670aa92d46cf9416951a49b4212d2ef12257137e3d4c6f6e9f0faed063a5b47f |
| Build | 7019e5d579dcc70be87f1666044655215de822e4af89f89fb6a8690e2fcf83a4 |
| Combined | f02b9d4a5cc02cbaeeeded26f78c87541aee3456538dc0046cbc29d20ab2df0a |

## Standard check and remaining work

S-1/S-7 bind source gates and timing bodies before edits, acquire the actual shared E0n owner before repair, and compare seven source bodies. S-2 preserves absent/false exact timing and strict public finite input; the old jitter-exact assertion moves to the legacy path and the new groups test source timing explicitly. S-3 is not applicable. S-4 retains session-owned pending/delivered state and loading cleanup. S-5 binds hour progression and fractional comparisons to literal clock instants. S-6 updates DynamicWakeup.nextAt readers, the CLI fixture and the stale README algorithm description together. Existing seven rules cover the incidents.

Pending-wakeup sidecar/reconstruction stays blocked on a background-job/takeover owner. Headless closed-input/fallback keepalive, noop transcript collapse, teammate targeting and inherited unstable-write unlink remain Partial. W301 stays paused.
