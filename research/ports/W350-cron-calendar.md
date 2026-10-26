# W350 Cron calendar

Status: verified locally with independent verification. Baseline cb9abd7. Work stays local and in place.

## Task card

- User entry and outcome: fresh CLI cron jobs use the recovered date search through create, jitter, file reload, catch-up, fire, dynamic wakeup and cancel.
- Source: manifest-verified atzjaveb k/x/n6/MCt/wqe/L9t/E0n/wds and jrz2zk22 x0r. Complete bodies are retained before product changes.
- Target: scheduler-calendar.ts, scheduler.ts, scheduler-store.ts, Runtime/settings/session schemas, CLI and explicit reload.
- Method: copy the complete pure MCt body with TypeScript annotations; adapt existing host consumers to one selected date function.
- Compatibility: optional pinned schedulerSourceCalendar. Fresh CLI and explicit reload select true unless authored false. Original metadata absent/false retains the one-year epoch bound, raw-field DOM/DOW rule and monotonic DST traversal. Low-level APIs keep their old default.
- Alternatives: replacing nextOccurrence directly would invalidate explicit old year/DST contracts; enabling only behind schedulerJitter would conflate date semantics with jitter and change old pinned jitter sessions. One separate compatibility version owns all calendar consumers.
- Actual CLI: future leap creation, original resume despite changed settings, file-backed fire and one file effect, list/cancel, impossible date, explicit false and absent historical metadata.
- Checks: at most three new regression groups, related suites, check/build, actual compiled driver, frozen identity and one bounded independent reader. No recovered entrypoint execution.
- Completion: literal source observations, all consumers wired, exact source/host character evidence, original regressions retained, resources released and package-only local commit. Sidecar, teammate and unsettled watcher unlink stay separate.

## Source identity and closure

Artifact 2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Coordinates below are zero-based half-open UTF-16 code units. The existing manifest selector verifies each decoded module digest and Acorn declaration range.

| Module | SHA-256 | Complete source ranges |
| --- | --- | --- |
| chunk-atzjaveb.js | 71378d5821cac631dfe41fe2db138ed7853b6008545668f423b89cbf4d060a2a | k [1073,1150), x [1151,1768), n6 [1768,1988), MCt [1988,2662), D9t [5270,6340), wqe [7779,7878), L9t [8117,8395), E0n [8395,8604), wds [8604,8697) |
| chunk-jrz2zk22.js | da64f780f2b184a92cd87a21d03c8a02ca80ec4124edf791eccd988a67c980a3 | x0r [5233,11476), including me [6337,7616), ne [7616,9890) and b [7731,9544) |
| chunk-0vpbck7s.js | 988f0155a37f92868d7c0867c68822b460ccf916684212b0d265cdc1f3a752ed | CronCreate validateInput [7081,7652) |

MCt depends only on the five parsed numeric arrays and built-in Set/Date. x/n6 and k have no application imports. The current expandCronField grammar matches x; parseCron adds raw-field restriction flags used only by legacy nextOccurrence. MCt ignores those flags and tests expanded array lengths instead. wqe supplies numeric times to L9t/E0n and wds. x0r.me uses wds for missed one-shots; ne/b caches L9t/E0n, advances recurring rows, stamps and releases through the existing owners. No new persistent task fields are introduced because D9t owns the original store shape; each scheduler's pinned session chooses the interpretation, including legacy stored rows.

Source MCt uses local setters and a527040 iteration budget with month/day/hour jumps. This is not a real one-year deadline. It can return a time before its input during a repeated DST hour. The new version preserves those observed source semantics; it makes no monotonic-epoch promise. Seven-day recurring expiry is unchanged and still runs only after a due fire.

## Observed baseline

JOB_TMP means /Users/mant1ssa/.claude/jobs/c9c17d97/tmp. w350-calendar-observations.json binds14 cases to the copied pure declarations executed in an owned VM, without any recovered entrypoint.

- From2025-01-01, Feb29 is2028-02-29 in MCt and null in the legacy host.
- `0 0 1-31 2 1` and `0 0 */1 2 1` from2024-02-01 reach Feb5 in MCt and Feb2 in the legacy host. Expanded full DOM means unrestricted in MCt.
- `0 0 30 2 0-6` is unresolved in MCt and reaches Feb2 in the legacy host. Expanded full DOW means unrestricted in MCt.
- New York from2024-11-03T05:59Z reaches07:00Z in MCt and06:00Z in the legacy host; from06:01Z reaches05:02Z versus06:02Z. Lord Howe's repeated half-hour has the corresponding skip/backward difference.
- Impossible February30 stays null. Ordinary OR, seconds flooring and spring-forward cases retain the captured literal outcomes.

## Implementation and adaptation

sourceNextOccurrence copies the entire MCt body with types, exported name, formatting and the equivalent true literal. TypeScript-erased Acorn body syntax matches the source after !0/!1 normalization. The old nextOccurrence remains unchanged. Each LocalScheduler pins one CronCalendar at construction. Its creation, acquired deadlines, file reload, subsequent recurring fire, both jitter occurrences, one-shot and dynamic delivery, and missed one-shot projection receive that same function. Runtime selects it only from the saved feature; fresh CLI/explicit reload pin true unless authored false or managed policy overrides it. This optional field has no claimed source rollout counterpart; it is the host's compatibility adapter. No persistent task fields or tool schemas change.

Source validateInput keeps its historical next-year error wording even though MCt has only an iteration cap. Preserve that exact text and existing error codes. Existing size/type budgets, capacity ordering and durable write ownership remain host adaptations. The L9t helper retains the pre-existing Math.floor at the host Date millisecond boundary. Its zero/negative DST interval behavior is inherited, not normalized away.

Thirteen complete source/host text pairs are retained in JOB_TMP/w350-source-host-character-diff.json,189982bytes. Each includes module digest, exact source/host UTF16 range, full text and reconstructable integer-unit diff opcodes. One pair is copy and twelve are adapt; none is rewrite. This text evidence does not establish whole scheduler equivalence. Key host ranges are sourceNextOccurrence[263,1230), occurrenceAfter[10409,10654), nextRecurringFire[10951,11879), nextOneShotFire[12035,12641), create[23233,26502), reloadStoredTasks[30067,33161), tick[39208,43480), missedTasks[11122,11485), armWakeup[34950,37439) and fireTime[45241,45795). File digests and remaining full adapters are in the same record.

## Validation

| Command / artifact | Result |
| --- | --- |
| node scripts/smoke-cron-calendar-cli.mjs against old compiled cb9abd7 | exit1 at paired cron_create error for the2028leap day from2025; w350-cli-baseline.txt |
| node --import tsx --test --test-concurrency=4 --test-timeout=20000 test/scheduler*.test.ts test/runtime-resources.test.ts test/runtime-events.test.ts test/interactive-loop.test.ts test/reload.test.ts test/session.test.ts test/cli-gateway.test.ts |103/103,0fail/cancel/skip; w350-affected-final.txt |
| npm run check; npm run build | both exit0; w350-check-reviewed.txt,w350-build-reviewed.txt |
| node scripts/smoke-cron-calendar-cli.mjs |5real CLI processes,29ownedloopbackrequests,0external; future creation,original resume,one write_file effect,next leap/cancel,impossible date,missed catch-up,false/absent compatibility and explicit reload; w350-cli-final.txt |
| node scripts/smoke-scheduler-cli.mjs --compiled --unresolved-recurring | legacy fixture explicitly pins false; original assertions pass3requests; w350-cli-legacy-final.txt |
| node scripts/smoke-scheduler-cli.mjs --compiled --durable | new default catches missed task,watches replacement/unlink/recreation and clears/reloads with3requests; w350-cli-watch.txt |
| node scripts/smoke-scheduler-cli.mjs --compiled --wakeup-timing | source dynamic timing and stop/restart pass9requests; w350-cli-timing.txt |
| node --import tsx --test --test-timeout=20000 test/async-hooks.test.ts test/scheduler-calendar.test.ts |20/20,including3newgroups and complete PID-publication wait; w350-pid-calendar.txt |
| npm test | final3392/3392,0fail/cancel/skip; w350-full-final.txt |

Initial full is3391/3392. Its unchanged async-hook fixture reads a created-but-empty PID file atline375;the exact isolated case passes. Reuse the same file's existing nonzero-size wait condition,retain every PID/process assertion andtimeout,and change no hook product code. Initial legacy unresolved CLI fails because the new default resolves2028and L9t adds30minutes;only that legacy fixture authors false and keeps its old literal assertions. Incidents are retained in question.md.

Comment review is read-only and finds two redundant prose lines plus two signature-restating tails;main removes those while keeping every mandatory coordinate and public API contract. No new suppression. The final artifact includes that cleanup before the successful full run. Fresh independent verdict is VERIFIED_SCOPED in JOB_TMP/w350-independent.json. Reviewer25/25new/CLI/hook tests,50/50legacy scheduler tests,check and actual compiled29ownedrequests pass. All1882records match before/after with0missing/extra/changed,and all3protectedhashes match. No scoped defect is reported;0owned live processes and0owned fixture directories remain. The reader did not rerun full/build or its own source VM;those remain bound to main's recorded commands and copied-body/text checks. Its18call budget was exceeded with35calls and is not claimed as obeyed. Source rollout/live recovered-engine behavior is not claimed. Main's final capture still equals21d82d59.

## Content identity and limits

Frozen1882records at21d82d59251abd243899dba192805d13fb1abcf9e1e413a7a2406f979bbb0945 in JOB_TMP/w350-review-candidate.json. Inputs900 SHA-256498313b0294924192973ca8a677e5be267e53ce96aeccf8622241c1e0a27e3cf;tests348 SHA-25679e519b3e52e39ef5e9b6bc471324812a3dfcba1510d3fe337687049941e017f;build634 SHA-256650011c17364ffc61a28366c2fa398f475fc6fdf22049d7f89391f0467c646c9. All three original dirty file hashes are unchanged.

S-1/S-7 use manifest/AST acquisition and observed literal comparisons before edits. S-2 retains old algorithms,metadata absence,strict schemas and error text;only the intended new default field is added to the existing deep-equality snapshot. S-4 pins the calendar to the existing resource owner and keeps cleanup;S-5 waits for complete PID publication and committed model/journal boundaries;S-6 covers settings,managed policy,stored metadata,Runtime,CLI,reload and every date consumer. Seven rules remain unchanged. Real Magpie and external models are not_run. Sidecar wakeup recovery,teammate execution,explicit piped EOF correspondence and unsettled watcher unlink remain separate.
