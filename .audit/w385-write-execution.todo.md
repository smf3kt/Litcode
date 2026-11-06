# W385 actual Write execution

1. State the exit condition as a checkable predicate before the first iteration (tests green, repro fixed, all N PRs merged, pixel-diff zero).
2. Pick the wake mechanism using Claude Code's `loop` skill (a built-in, not a pstack skill). An event to watch (CI, a merge, a ref advancing) gets a watcher subagent that wakes you on the event, with a long time-based heartbeat as fallback. No event gets a fixed-interval heartbeat sized to when the result is worth re-checking.
3. Each iteration makes the smallest change the evidence justifies, verifies it against the predicate, commits if it advanced, discards changes that didn't help. Belt-and-suspenders that "might help" gets reverted, not left to ride.
4. Mid-run discoveries are yours. Address broken skills, related bugs, flaky verifiers, review noise, tooling failures, orphaned follow-ups, and fixable drift yourself via poteto-mode. Put out-of-band fixes in their own PR. Do not park reversible work for the human or use `AskUserQuestion`. Surface only irreversible actions, genuine product or preference calls no experiment can settle, or a real dead end. Keep the predicate as the main drive, and return to it after each side fix.
5. Checkpoint every iteration via the **show-me-your-work** skill, a row for what changed and whether the predicate moved.
6. Stop when the predicate is met. A plateau is not a stop, so keep going and pivot your approach to push past it. Surface a genuine dead end rather than spinning, and never relax the predicate to declare victory.

The latest user request authorizes one local workspace checkpoint commit and a durable handoff. Loop 3a470107 is cancelled, with no scheduled replacement. Do not push or create a PR; omit Co-Authored-By. The original lane-binding review stays automatically interrupted with no valid conclusion and is not retried or replaced. Earlier uncommitted-loop wording is superseded by this checkpoint request.

- [x] Ground. Read CURRENT, exact Kt/uno/KWo bodies, manifest identities and host call/journal owners.
- [x] Sketch. Prefer opaque one-use execution observations minted at the actual builtin call over caller-filled callback data. Agent binds them to its private admitted start; Session validates the exact serialized event.
- [x] Agree. Proceed under existing local-work authorization. Project limits delegation to one bounded independent read-only mechanism question; no parallel design fleet.
- [x] Implement. Real Agent red, actual builtin entry/settlement, inert serialization and lifecycle controls.
- [x] Scrap. Public/direct calls do not mint the Agent's journal proof. The post-commit event-reference red was repaired by using the captured private start.
- [x] Validate. Check/build, 92 related tests, four compiled CLI/recovery tests, offline package and cold readers pass; lock-reclaim guards remain.
- [x] Record. Content identity `43524ad5c032f0bc1045b23420e0b4a2fa5a59f121d669fba549da8dc67c7b81` and current evidence recorded. #35 and #34 remain open.

Exit predicate for this unit: actual runtime-owned external Write has one admitted start and one ordered builtin entry/completion pair; substituted wrappers, public/direct calls, changed input/owner and replay cannot fabricate that pair; death between boundaries preserves only completed durable facts; required checks pass. This unit does not by itself close #35 or #34.

Throughput checkpoint: one active implementation unit, one independent hook-settlement lookup, reuse existing Agent/CLI drivers, no new dependencies or upstream calls, check before broadening.

Hook correlation unit #41 under #35 follows the same local loop and trail.

- [x] Ground. Verify dze/Okn/P9r and the separate runner identity; read actual command, async registry and journal consumers.
- [x] Implement. Carry one HookCall pair through known single-call hooks and retain returned backgroundTasks without adding stdin fields.
- [x] Reproduce and repair. Actual Agent and compiled CLI reuse one provider ID in two turns and retain distinct parent messages through two cold readers.
- [x] Validate. Affected coverage is 344 pass/three existing skips after repairing two stale human-entry fixtures; the five-case repair suite, actual CLI and installed/cold checks pass. Content identity `b5cca733068922c2666e475539a8652e20b95b27c0d530814d08cd2adff1be4b`.
- [x] Record. CURRENT, the Lifecycle hooks matrix, W385 port, standard checks and canonical trail are updated. Callback settlement and #34 stay open.

Exit predicate: known single-call hook starts retain both the actual call and parent message; results retain the real runner's async IDs; original stdin and legacy journals retain their contract; actual CLI, cold readers and required checks pass. These associations do not attest caller-filled starters or completion callback settlement.

Throughput checkpoint: one paired identity passed through existing calls; no new registry, dependency or prompt field; two behavioral regression groups and one installed fixture.


Callback settlement unit #42 under #35 follows the same local loop and trail.

- [x] Ground. AST-verify complete gc/WLe/CXo declarations and read the actual host promise/grace lifecycle and descriptor consumers.
- [x] Implement. Terminal descriptors distinguish none, pending, returned and threw from the process outcome; running descriptors have no completion fields.
- [x] Reproduce and repair. Real configured and adopted commands remain pending after bounded wait/close, then observe the held callback's actual return or throw. Actual compiled CLI checks both outcomes and releases locks.
- [x] Validate. Six-file affected run 179/179, final same-build CLI two tests/three processes, check/build and installed callback observation pass at `9e07355d801a851056af0f23365d609c58d03f38264ecb6a17bd18b5f77921d3`.
- [x] Record. CURRENT, Lifecycle hooks, W385, standards, question and the canonical trail are updated. Durable provenance and #34 stay open.

Exit predicate: terminal process state cannot be mistaken for the observed callback promise's settlement; wait/close retain their existing bounded behavior; real late effects remain visibly pending until return or throw; copies do not mutate registry state; required CLI and checks pass. Missing history does not establish settlement.

Throughput checkpoint: one discriminated descriptor and two real behavioral groups; existing process lifecycle, callback grace, ownership and history bounds remain; no new journal fields or dependencies.

Handoff unit #44 follows the user's narrowed request.

- [x] Retain only the minimal child append-tuple repair after the #42 baseline reconstruction.
- [x] Archive #43 as an inactive eight-path patch, manifest and read-only verifier; source mapping remains open.
- [x] Validate check/build, 111 affected tests and the actual compiled child/transcript CLI at 212f728bfdc720169e4bdb63ed443902cfbb8dc0c0b85155af668eecfaad43ed.
- [x] Save current evidence and the source investigation in the package record and research/HANDOFF-2026-11-06.md.
- [x] Stop the ten-minute loop.
- [x] Prepare the explicitly authorized local checkpoint with exact path staging, no vendor attribution and no push. Its containing commit records completion.

The commit containing this checklist is the checkpoint; its presence in git history supplies the final commit result. No broader task is marked complete.
