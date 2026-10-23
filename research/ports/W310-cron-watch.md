# W310 durable cron file watching and session ownership

Status: verified locally on 2026-10-24, including independent handoff recheck. Local commit only; no push.

## Task card

- Entry: an active session with `features.schedulerDurable`, followed by atomic replacement, removal or recreation of `.harness/scheduled_tasks.json`, or release of another session's scheduler lock.
- Outcome: the live session reloads file tasks, preserves session-only jobs, retries a contended lock, and closes every watcher, timer and pending write before releasing its owner.
- Source: `x0r` and its `me`, `ne`, `oe`, `pe` bodies plus `Pot`, `s_e`, `bds` and `cre`.
- Shape: one durable-store owner holds the file snapshot, watcher, lease and mutation queue. `LocalScheduler` retains its in-memory jobs and due-time cache.
- Targets: scheduler, scheduler store, runtime owner binding, existing scheduler CLI driver and necessary regressions.
- Method: adapt the recovered driver and reuse its already ported `ww` watcher. Preserve the existing exact-timing setting when jitter is disabled.
- CLI chain: edit a store during an interactive compiled session, observe changed jobs and a scheduled event, release a competing owner, exit and verify cleanup.

## Source preflight

Sample 2.1.296 SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`. Module bytes match `extracted-v2/manifest.json`. All ranges below are half-open zero-based UTF-16 code units, parsed with Acorn before editing.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-jrz2zk22.js | da64f780f2b184a92cd87a21d03c8a02ca80ec4124edf791eccd988a67c980a3 | `de` [3257,4023), `N` [4023,4238), `He` [4469,4566), `x0r` [5233,11476), `me` [6337,7616), `ne` [7616,9890), `oe` [9890,10444), `pe` [10444,10901), `Ke` [11476,11998) |
| chunk-atzjaveb.js | 71378d5821cac631dfe41fe2db138ed7853b6008545668f423b89cbf4d060a2a | `D9t` [5270,6340), `w0n` [6582,6985), `Pot` [6985,7298), `s_e` [7298,7491), `bds` [7491,7656), `cre` [7656,7779) |
| chunk-2djwkyet.js | 53209fb11ff7bc22f686e4380a92171639a41eaddb055c7d3e6b125cf68fd558 | `ww` watcher imported through chunk-610fwv8s.js; the same watcher is already ported in src/tui-theme-watcher-source.ts under W44 |

The driver watches the exact task file with `persistent:false`, `ignoreInitial:true`, `awaitWriteFinish.stabilityThreshold:300`, and `ignorePermissionErrors:true`. Add/change replaces the watcher and refreshes after the new watcher's ready event. Unlink clears file tasks while keeping session tasks and their due-time entries. The poll is 1000 ms; the contended-lock retry is 5000 ms. `x0r.stop` marks the driver stopped before it closes watchers/timers and releases the lease. The awaited acquisition checks the stopped state before publishing a live lease.

`Pot` reads the latest file and appends one record, `s_e` removes selected ids, and `bds` changes only matching `lastFiredAt`. Each preserves unrelated rows and accepted creator fields. The current snapshot writer instead reconstructs all durable rows from `ScheduledJob`, which drops these fields and overwrites file edits. This is part of the watch/reload chain and will be replaced with those source mutations.

## Baseline observations

The current e99435c code was run in an owned temporary workspace. After replacing a stored `existing` job with an `external` row, the live scheduler still listed `existing` after 750 ms. A subsequent durable create wrote `new` plus the stale `existing` row, erasing `external`, `permanent`, `lastFiredAt` and creator metadata. The probe read the source-owned mutation bodies before testing this difference.

## Decisions and implementation

The organizing data shape follows Model the Domain. Each scheduler has one `detached | waiting | held` file lease and owns its watcher, lock retry, attach promise and ordered store operations. The existing id-keyed due cache and session jobs stay in `LocalScheduler`. Source `pe` reuses W44's copied `ww` watcher without another dependency. Source `oe` supplies the five-second retry and stopped checks after asynchronous acquisition.

`Pot`, `s_e` and `bds` now append, remove or stamp the latest file instead of publishing an old in-memory snapshot. Accepted metadata and unrelated rows survive. Reads caused by watcher events share the local operation queue, so this owner's pending mutation finishes before its own reload. `permanent` and a zero max age now reach the existing `He` helper. Tool `flushStore` reports a failed write instead of returning a successful durable create with a swallowed error.

Independent tracing found that W309 started an `initial` scheduler while constructing schemas, then started another for the real session using the same PID lease. The first could consume startup catch-up into an undrained queue. Schema construction is now passive, and `settleScheduler(realSessionId)` starts exactly the session that receives the event. `/clear` and other accepted successor sessions start after the prior scheduler's awaited cleanup. `close` marks the owner closed before waiting for attach, watcher teardown, queued operations and lease release.

Independent review then reproduced a duplicate recurring fire on lease handoff. A waiting scheduler retained an old deadline after the holder stamped `lastFiredAt`. Source `ke` runs before `b` fills the due cache. On acquisition this port discards file deadlines that had no lease and rebuilds from the latest file before ticking. Session-only deadlines survive.

The throughput checkpoint used one direct implementation owner because file changes, lease acquisition, queue delivery and close share state. A bounded read-only helper traced runtime ownership. A separate reviewer tested lifecycle behavior. The project in-place rule overrides pstack's default writer fan-out. Source preflight and a failing baseline ran before product edits. Sequence work into verifiable units kept watcher fixtures, affected regressions and actual CLI validation in that order.

## Verification

- `npm run check` and `npm run build` exit 0.
- Scheduler, watcher, runtime-resources, runtime-events and interactive suites pass 97/97. Two new watcher/lease regressions and one strengthened runtime-owner regression cover the change.
- Existing CLI, advanced CLI, gateway and background-session suites pass 31/31.
- The existing `scripts/smoke-scheduler-cli.mjs` path passes with six owned loopback requests. Its assertion now uses the source id fraction, preserving the exact due-time contract.
- `node scripts/smoke-scheduler-cli.mjs --compiled --durable` passes with three owned loopback requests. It observes startup catch-up exactly once before typed input, stable atomic replacement, unlink/recreate, changed task delivery, metadata and `lastFiredAt`, `/clear` lease identity transfer, a successor fire, and released scheduler/session locks.
- Independent review reproduced the handoff P1 and the existing regression was strengthened before the final passing run. A separate read-only reviewer ran the contended lease test once, 1/1 pass, and confirmed the P1 closed in that path.
- No paid upstream calls. No recovered application entrypoint was executed. The user's two unrelated tracked changes were retained.

Content identity from `scripts/identity.mjs` after the final build:

| Set | SHA-256 |
| --- | --- |
| Inputs | 31f74369c2067d884e0368a36a908302a274012fb488b48c978a09a97c160802 |
| Validation | 003fe9f5371f543987fffb11e9dbbd739f3e378ed82939838f479514cc75aae9 |
| Build | a30bd050d26ac947d182eb1ef7c7fe0b7693cc31a3490f499d7dff639947cd9c |
| Combined | 137df9670fa6736ecd337b7aa6444f400d3b0747bdc91fa1f42b539394efebf0 |

## Remaining boundaries

- The inherited `ww` watcher can miss unlink when a file is deleted during successive unsettled atomic writes. Both the raw recovered watcher and this adapter reproduced that sequence. Stable replacement/unlink/recreate is verified; this package keeps the source implementation and records the limitation.
- The source's full creator eligibility `ke` includes historical session lineage and process-birth checks. This package retains the workspace filter and the file lease; complete per-agent and creator eligibility remains open.
- The local operation queue orders this scheduler's mutations. It does not add a cross-process file-write transaction beyond the recovered atomic file publication and scheduler lease.
- Same-id cron changes keep the source's id-keyed cached deadline until its next recomputation.
- Runtime stores remain opt-in through `features.schedulerDurable`. Absent/false keeps the existing session-only path. Jitter-disabled file reload now honors the same exact-timing setting as new jobs.

## Coding-standard check

S-1 binds source coordinates with Acorn and records the failing baseline and watcher/clock fixture corrections in `research/question.md`. S-2 retains existing input, callback, DST, timing-option and session-only contracts. S-3 is not applicable. S-4 tests owner cleanup during attach, wait and handoff. S-5 uses stable watcher reloads and real elapsed clock time. S-6 updates runtime startup, successor cleanup, the CLI driver and their readers together. S-7 records full recovered bodies and reuses the already copied watcher. Existing rules cover the incidents; no new suppression or standard rule is needed.
