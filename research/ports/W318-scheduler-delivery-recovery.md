# W318 scheduler delivery recovery

Status: verified locally, 2026-10-24. Independent correctness, final compiled CLI and comment acceptance pass. W301 remains paused. Local commit only, no push or coauthor.

## Task card

- Entry: a local durable cron becomes due but its synchronous delivery handler throws.
- Outcome: retain an undelivered one-shot on disk for a later session, suppress retries in the same session, continue other due tasks, and preserve source recurring/expiry cleanup. A new session surfaces a retained missed one-shot once through the existing catch-up prompt.
- Shape: source catch-path outcome controls lifecycle independently of diagnostic text. Existing task-id deadlines, durable delivery suppression and ordered store operations retain ownership.
- Targets: LocalScheduler delivery/catch-up paths, at most three necessary regression groups, existing compiled scheduler driver with an owned handler fault.
- Method: adapt recovered x0r.ne.b/me and existing s_e/bds/He bodies. Preserve callbackError diagnostics and all old schemas.
- Throughput: source bodies and public compiled failing baseline block product edits. One direct in-place writer owns implementation; one bounded independent reader checks source failure semantics. Model the Domain separates error presence from text. Sequence Work into Verifiable Units closes failure, restart and cleanup together.
- Checks: source identity, actual compiled handler failure/reload/restart, focused and affected regressions, check/build, body differences, independent review, final content identity.

## Source preflight

Sample2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Coordinates are half-open zero-based UTF-16 code units. The modules below match extracted-v2/manifest.json. Text is inert data; recovered entrypoints are never executed.

| Module | SHA-256 | Acquired body |
| --- | --- | --- |
| chunk-jrz2zk22.js | da64f780f2b184a92cd87a21d03c8a02ca80ec4124edf791eccd988a67c980a3 | x0r [5233,11476), me [6337,7616), ne [7616,9890), b [7731,9544), He [4469,4566), pe [10444,10901), Ke [11476,11998), Ee [11998,12190) |
| chunk-atzjaveb.js | 71378d5821cac631dfe41fe2db138ed7853b6008545668f423b89cbf4d060a2a | s_e [7298,7491), bds [7491,7656), wds [8604,8697); D9t/w0n and creator/lease owners retained from W309-W312 |
| chunk-886tf6ja.js | 593e2ed1380725f871cb3ad6b60ab6fb270bd985462dd6ee3bf5128e003fd30b | ot [3893,4046), VV [4483,4637), G [4695,4754) |

Source b catches a delivery handler exception and unconditionally computes J=!H&&!e.recurring. For a file one-shot, it sets the id deadline to Infinity and returns without s_e, retaining the disk task for a later session. Other tasks drop this occurrence and continue source normal reschedule or expiry/removal. Error message content is used only for diagnostics, never the retain/remove branch. Source me similarly suppresses missed ids before invoking the handler and retains file rows if surfacing throws. After successful delivery, the existing s_e removes them. He supplies the source recurring/permanent/age rule. s_e and bds read the current file so unrelated accepted rows remain intact.

At HEADd690a96, tick emits a nonrecurring job, deletes its live projection, adds durable suppression and removes the disk row only when !emitted.at(-1)?.callbackError. emit serializes Error.message or String(error). An Error with empty message therefore enters the removal branch even though the handler threw. The actual compiled --delivery-failure driver reaches that branch and fails the retained-row assertion with [] instead of the failed row (w318-cli-baseline.txt, exit1). Independent reader a4eacba24dd612775 confirms the source retention rule and finds a second conversion failure: Error.message access or String(error) can throw and strand sibling delivery.

Before product edits, the diagnostic closure was acquired too. chunk-jrz2zk22.js Ee [11998,12190) tries conversion and falls back to a fixed Error if inspection throws. Its dependencies in chunk-886tf6ja.js match SHA-256 593e2ed1380725f871cb3ad6b60ab6fb270bd985462dd6ee3bf5128e003fd30b: ot [3893,4046), VV [4483,4637), G [4695,4754). All ranges use zero-based UTF-16 code units. G is the Error/String conversion; ot/VV protect telemetry property access; Ee contains conversion failures. The owned adapter keeps the existing callbackError string contract and omits telemetry mutation, but wraps diagnostic conversion with Ee's fixed-message fallback. emit returns callback success separately from diagnostic text, and only that outcome controls durable removal. Existing category lifecycle, persistence queue and public schemas remain intact. The conditional unresolvable-recurring deadline mismatch is a separate unverified candidate.

## Inherited watcher finding

W310 already reproduced missed unlink during successive unsettled atomic writes in both the copied ww watcher and recovered implementation. The current pe body retains the same300ms stable-write watcher. This package preserves that inherited behavior; it does not invent a second scanner or watcher override. Stable unlink/recreate remains covered by the existing compiled watcher driver.

## Port and comparison

- `src/scheduler.ts` adapts b's delivery/catch path through the existing private emit boundary. The new boolean is the synchronous callback outcome; callbackError remains a separate diagnostic string. Failed durable one-shots leave their disk row and enter the existing same-session suppression set. Successful siblings follow normal delivery/removal.
- Ee/G's protected diagnostic conversion becomes a nested conversion guard with the exact fixed fallback. The source telemetry-property/cause objects have no owned consumer and are omitted. The existing diagnostic string API is preserved, including empty strings. No new public tool or event schema is introduced.
- Existing me catch-up, He expiry, s_e removal and bds stamping remain unchanged. Three regression groups exercise these consumers rather than replacing their bodies. Local one-shots/dynamic occurrences are consumed on failure; recurring failures advance/stamp, and final aged-out attempts remove the row. Permanent recurring tasks retain the source exemption.
- Eight AST-bound comparisons cover b/tick, b/emit, Ee/emit, G/emit, me/reloadStoredTasks, He/agedOut, s_e/removeStoredTasks and bds/stampStoredTasks. Source module/body and target body SHA-256 plus exact UTF-16 coordinates are retained in `w318-source-comparison.json`; every resulting diff was read. These are adaptation comparisons, not text-equivalence claims.

## Validation and incidents

All scratch evidence lives under `/Users/mant1ssa/.claude/jobs/c9c17d97/tmp`.

| Command / evidence | Result |
| --- | --- |
| `node scripts/smoke-scheduler-cli.mjs --compiled --delivery-failure`, baseline | exit1, failed row unexpectedly deleted; `w318-cli-baseline.txt` |
| `node --import tsx --test --test-timeout=20000 test/scheduler-delivery.test.ts` | exit0,3/3; final job-scratch fixture run in `w318-focused-final.txt` |
| Scheduler, runtime events/resources, interactive, loop fold and headless affected tests | exit0,121/121; `w318-affected.txt` |
| `npm run check` | exit0, final test-fixture location included; `w318-check-final.txt` |
| `npm run build` | exit0, compiled product and native peer built; `w318-build.txt` |
| Final compiled `--delivery-failure` | exit0,2 owned loopback SSE requests; failed row retained, successful sibling delivered/removed, reload suppressed retry, restart surfaced AskUserQuestion catch-up once, row/locks removed; `w318-cli-delivery2.txt` |
| Compiled `--durable` | exit0,3 requests; stable watcher replacement/unlink/recreate/catch-up/successor and cleanup; `w318-cli-watch.txt` |
| Compiled `--wakeup-headless --no-rearm` | exit0,3 requests; ordinary file cron untouched, dynamic no-rearm exit and locks; `w318-cli-headless.txt` |
| Independent correctness a7de0398640fd2617 | Hash/source/adapter inspection and independent3/3 pass; no confirmed product defect. Compiled recovery initially held while main diagnosed the driver. |
| Independent comments a222da1d90103408c | One new two-line provenance block retained by S-7; zero deletion recommendations, zero suppressions, no edits. |
| Final independent compiled acceptance a9b12351aa14be980 | exit0,2 requests, explicit sibling prompt, retained row, one-failure injection exposing retries, restart catch-up instruction and empty store, both exits0 and zero residual fixture processes/locks; `w318-independent-cli-final.txt`. |

The first repaired compiled driver passed retention/reload checks but hung awaiting first-child exit with a newly frozen wall clock, after lock release. Main inspected only that verified owned child's resources, then terminated it; the preserved `w318-cli-delivery.txt` records the resulting null-versus0 assertion and is not a passing runtime claim. The driver now reuses existing durable moving-wall-clock mode and bounds both exit waits. That final chain passes. The exact frozen-clock shutdown cause remains unestablished; no speculative product cleanup change was made. The first independent CLI run passed but identified that repeat fault injection could hide callback retries from request counts. The final preload injects once per process, so a retry reaches the provider, and the driver explicitly verifies the first request's sibling prompt. Fresh independent final acceptance passes. Retry absence is measured through a bounded1.5-second window plus direct callback-count regression coverage; catch-up acceptance verifies the AskUserQuestion instruction reaches the model, not actual invocation/answering of that existing tool.

Initial overbroad report searches and guessed absent source ranges produced oversized/absent-path output. Subsequent reads used exact single lines, known paths and AST slices. Dedicated Write/Edit remains the documented fallback because apply_patch was verified absent. Recovered entrypoints were never executed. Model requests used only owned loopback SSE, paid upstream0; full suite and live Magpie are not_run.

## Standards and remaining work

S-1/S-7 bind all source bodies and dependencies before product changes, preserve the valid compiled red baseline and read eight exact diffs. S-2 retains public callback diagnostics, schemas, creator admission and category semantics. S-3 is inapplicable to the product diff. S-4 keeps failed durable row ownership, same-session suppression, store queue and awaited close. S-5 asserts actual file rows, sibling requests, restart prompts and released locks. S-6 checks all emit callers and the compiled driver; no diagnostic-truthiness lifecycle reader remains. Model the Domain supplied the distinct callback outcome; Type System Discipline kept the private total boolean without widening public optional fields. Sequence Work into Verifiable Units closes failure, restart and cleanup in one package. Existing standards cover the recorded incidents.

The inherited unstable-write unlink gap, explicit piped EOF source correspondence, background-job sidecar and teammate owner remain separate. An unresolvable recurring next-fire mismatch is a source-backed candidate for the next bounded preflight; it is not reproduced or repaired here. W301 remains paused.

## Final identity

`w318-final-identity.json` uses the shared HarnessContentIdentity.v1 inventory. Inputs847 SHA-256 `ea2ab82499b833a62f9619965e40d4be80deba8222e0fa56ad09e2312f91bd20`; validation323 `75f3d3b41f91d7ac035c38874cf9cd1026bddf863ffcf541a4bd44969c16e09f`; compiled build607 `1a66e0c89996cd122745f5a98a047ac56c8048859e92e605d9c0ac524acefa58`; combined `5f38c6a8745bfd88b07ad94880c4aa89bcc784443a2a4557139c91dc4f071345`. This supersedes the pre-strengthening reviewed identity; product source/build remain the same, while final driver and scratch-fixture test inputs are bound here. Exact file hashes are rechecked before local commit. Unrelated pre-existing user edits remain unstaged.
