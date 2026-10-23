# W319 recurring deadline

Status: verified locally, 2026-10-24. Independent correctness, compiled CLI, six supplemental lifecycle scenarios and comment reviews pass. W301 paused; local commit only, no push or coauthor.

## Task card

- Entry: a recurring cron fires, but the existing host date search finds no subsequent occurrence within its accepted one-year boundary.
- Outcome: retain the task and, for durable rows, stamp the attempted fire; cache Infinity instead of deleting. Listing, reload, restart, final-age cleanup and explicit cancellation must remain usable.
- Shape: nextAt remains the existing numeric deadline with Infinity as the source's unresolved sentinel. No invented finite retry interval or additional timer.
- Source: ne/b/me/He from chunk-jrz2zk22.js, wqe/L9t/n6/MCt plus persistence/listing bodies from chunk-atzjaveb.js. Readable bodies acquired as inert data before edits.
- Targets: existing scheduler and current compiled smoke driver; at most three necessary regressions. Source outcome is adapted around the host's already-tested year/DST search contract.
- Throughput: one writer; one bounded independent reader only for deadline consumers. Actual compiled failing baseline and complete source/consumer preflight precede product edits. Final affected/check/build/CLI/source-diff/independent review/identity gates precede local commit.

## Source identity and preflight

Sample2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Module bytes verified against extracted-v2/manifest.json. Ranges are half-open zero-based UTF-16 code units. No recovered entrypoint is executed.

| Module | SHA-256 | Acquired body |
| --- | --- | --- |
| chunk-jrz2zk22.js | da64f780f2b184a92cd87a21d03c8a02ca80ec4124edf791eccd988a67c980a3 | He [4469,4566), me [6337,7616), ne [7616,9890), nested b [7731,9544); source cache set, final expiry, recurring stamp and dead-id cache pruning |
| chunk-atzjaveb.js | 71378d5821cac631dfe41fe2db138ed7853b6008545668f423b89cbf4d060a2a | x [1151,1768), n6 [1768,1988), MCt [1988,2662), D9t [5270,6340), w0n [6582,6985), Pot [6985,7298), s_e [7298,7491), bds [7491,7656), cre [7656,7779), wqe [7779,7878), C [8030,8117), L9t [8117,8395), E0n [8395,8604); _9 [7882,8029), S0n [5112,5122), D [5123,5148) |

Source b computes a deadline once per id. A null initial or subsequent L9t result becomes Infinity. A recurring occurrence is stamped even if its handler throws; expiry remains checked after an attempted fire. A non-expired recurring row with an unresolved next fire is retained. me retains all accepted file rows; the source's separate F map carries computed deadlines across reloads and ne prunes ids no longer present. cre lists raw stored/session rows, not the private F deadline.

Important adapter boundary: source MCt has a527040 iteration cap but coarse calendar jumps can traverse more than one real year. The owned nextOccurrence explicitly bounds the real epoch to one calendar year and preserves monotonic DST traversal. Existing test/scheduler.test.ts tests that contract, and W310 retained it. Therefore a Feb29 job after its2024 fire returns null in this host, while source MCt may find2028. This package ports the source null-state lifecycle while retaining that established host parser contract. It must not claim source/host leap-date equivalence or silently replace the parser.

An owned direct probe at HEAD95f3770 creates 0 0 29 2 * on2024-02-28T23:58 local, fires it on Feb29 and observes jobs[]. Host nextRecurringFire returns null there. The actual compiled --unresolved-recurring driver reaches the real scheduled model turn, then fails its retained-and-stamped durable-row assertion (w319-cli-baseline.txt, exit1). This is a valid public baseline before product changes.

Independent consumer reader a79c3f60d381cf0c0 finds raw nextAt in cron_list and JSON.stringify in runtime.ts:1133, so Infinity naturally serializes as null at the existing JSON boundary. list numeric sorting already places finite dates first and falls back to creation time for two Infinity values. Background/Stop projections omit nextAt; no date formatting consumer was found in the bounded files. reloadStoredTasks currently skips a null nominal before rebuilding the job, losing a cold-start list entry. Source me/cre retain the raw row and the F map is separate. The adapter will construct such jobs with Infinity and retain an existing id deadline across eligible reloads; it will remove the null-reschedule deletion branch and still stamp the fire. Existing source He final-fire expiry stays before that branch. An unresolved task has no timer-driven expiry attempt, matching source b's due-before-expiry order; explicit cancellation remains available.

Main checked actual persistence callers: create builds an explicit StoredTask without nextAt, and stamping reads validated StoredTask rows before publishing them. The writer itself is not a field-stripping whitelist. No Infinity/null runtime field will be added to disk. Tool schemas stay unchanged; JSON nextAt:null denotes an unresolved deadline in the host's numeric-deadline projection, which has no direct source field counterpart. Initial create validation and the one-year/DST search remain unchanged. The compiled driver cancellation is exercised through real cron_delete tool use, because no /cron-delete local command exists.

## Adaptation and complete chain

- `LocalScheduler.tick` retains b's `P ?? Infinity` recurring outcome and existing bds stamping rather than deleting an unresolved row. Existing final-age deletion remains before rescheduling. Empty-error callback attempts keep the same source category behavior delivered in W318.
- `reloadStoredTasks` builds valid stored jobs even if nominal is null. Existing eligible id-cache retention wins over a recomputed nominal. Source me/cre preserve raw rows while F owns deadlines; this host combines their projection in ScheduledJob. Its existing numeric sorting and JSON serializer remain unchanged.
- The host year-bound/DST parser and initial create rejection contract are preserved, explicitly differing from source MCt as described above. No inferred timer/periodic retry/automatic dormant expiry is added. Source b checks due before final expiry, so Infinity means no further attempt until id cache is reset/reconstructed or the row is cancelled.
- Source cre lists raw rows without the host nextAt field. Thus nextAt:null in tool JSON is an owned boundary representation for Infinity, not a copied source output field. Runtime/background projections already omit nextAt and remain usable. Public schemas are unchanged; stored rows contain no nextAt field.
- Eight AST-bound source/adapter comparisons cover b/tick, b/reloadStoredTasks, me/reloadStoredTasks, MCt/nextOccurrence, L9t/nextRecurringFire, He/agedOut, bds/stampStoredTasks and cre/list. Module/body hashes and exact source/target UTF-16 ranges are in `w319-source-comparison.json`; every resulting diff was read. Parser and listing differences are documented adaptations, not text-equivalence claims.

## Validation

Scratch evidence is under `/Users/mant1ssa/.claude/jobs/c9c17d97/tmp`.

| Command / artifact | Result |
| --- | --- |
| Compiled `--unresolved-recurring` before product edits | exit1, real scheduled turn completes then durable retained/stamp assertion fails; `w319-cli-baseline.txt` |
| `node --import tsx --test --test-timeout=20000 test/scheduler-deadline.test.ts` | exit0,3/3; no-retry/sort/JSON/cancel, durable metadata/reload/restart, invalid stored date/final-expiry/permanent/zero-age/callback failure; `w319-focused.txt` |
| Scheduler/runtime/interactive/headless/loop/task-panel affected tests | exit0,131/131; `w319-affected.txt` |
| `npm run check` / `npm run build` | exit0; `w319-check.txt` / `w319-build.txt` |
| Final compiled `--unresolved-recurring` | exit0,3 owned loopback requests; stamp/retention/list nextAt:null/restart without replay/actual cron_delete/empty file/exits0/locks; `w319-cli-unresolved.txt` |
| Compiled `--delivery-failure` | exit0,2 requests; previous W318 retention/reload/restart/cleanup chain; `w319-cli-delivery.txt` |
| Compiled `--durable` | exit0,3 requests; stable watcher reload/unlink/recreate/successor/locks; `w319-cli-watch.txt` |

All model requests use owned loopback SSE, paid upstream0. Full-suite and live Magpie are not_run. One bounded independent consumer reader identified JSON/deadline/reload boundaries before implementation; actual persistence callers were then checked by main. Independent comment audit a01b0e98939e9e634 retains both source anchors under S-7, with zero findings,zero suppressions and zero edits. Independent correctness reviewer a73dca70a6bab45a9 verifies module hashes and exact b/me/cre bodies, runs3/3 and compiled unresolved3, and finds no confirmed scoped product defect. Its extra compiled lifecycle probe passes six scenarios, including stable unlink/recreate finite rearm, impossible one-shot retention and mixed restart catch-up exactly once. Logs are `w319-independent-groups.txt`, `w319-independent-cli.txt`, and `w319-independent-lifecycle-settled.txt`; product/test files are unchanged by review.

## Standards and incidents

S-1/S-7 acquire source parser dependencies,deadline cache,stamping and listing before product edits; valid public baseline precedes the adaptation. S-2 preserves the year/DST parser and create/schema contracts. S-3 has no new rendering surface. S-4 keeps id-cache ownership,store queue,metadata and locks across reload/restart/cancel. S-5 checks file rows,callback attempts,actual tool delete and released locks. S-6 checks every deadline consumer and compiled fixture. Model the Domain keeps one numeric deadline sentinel rather than another timer/state flag; Sequence Work into Verifiable Units closes initial fire,restart and cancellation together.

A guessed /cron-delete local command was found absent during preflight and replaced in the fixture with actual cron_delete tool use before it was reached. Guessed absent report/source filenames were corrected to focused known paths. A source comment briefly used an unverified subrange, then was immediately corrected to the acquired full b range before validation. The independent extra probe initially unlinks immediately after a new stamp and reproduces the already excluded unstable-write/unlink limitation; `w319-independent-lifecycle.txt` retains that failure. A1000ms stability wait then passes the six bounded scenarios, with no product change. This is inherited watcher evidence, not a W319 fix claim. No repeated successful product tests were run without a changed input or unresolved concern. Dedicated Write/Edit remains the documented fallback because apply_patch is absent.

Remaining sidecar,teammate ownership,explicit piped EOF correspondence and inherited unstable-write unlink stay separate. W301 remains paused. The next bounded source preflight is local background-task detail/output inspection from the existing Partial task panel; sidecar/teammate work still needs its absent owner.

## Content identity

`w319-reviewed-identity.json` uses the shared HarnessContentIdentity.v1 inventory. Inputs847 SHA-256 `062aaee52952814ead85477b3b29d5aca4eb3181b3c50ba1b6e5a05c2eb4727f`; validation324 `1bfc97bf9df2d657a8078067595476a2c4a396598f03254913300b984819f783`; build607 `403c8a8936c00cc429b2e148af24c111ee1e4ad5cd23d0fc6185f11adeea4aba`; combined `482250a7457152f7149087e0b5644ca13afa759d846493397236c5e9c6c7cf18`. All1778file hashes were rechecked after independent comment review with no changes. Final source/build identity must remain this value or be rebound before local commit. Unrelated user edits remain unstaged.
