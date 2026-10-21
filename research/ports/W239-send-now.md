# W239 input-bar send-now and queue-submit

Status: implemented and verified locally, 2026-10-21. Local only; no push, no paid calls.

## Task card

- Entry is the Chat keybinding `chat:sendNow` (ctrl+x ctrl+s, ctrl+enter) and
  `chat:queueSubmit` (ctrl+x enter) behind the composer.
- Outcome requires a draft to reach the running turn without waiting for it to finish: send-now
  queues a non-empty draft and interrupts the live turn so the queue drains now, while an empty
  composer flushes only the queue. Queue-submit hands the draft back as a queued submission.
- No settings write, no account or network work. Validate the compiled CLI, source ranges and
  independent review. One lead writer.

## Baseline

At 1ecb084 both chords resolve (`src/tui-keys.ts`) but `applyAction` returned false, so they fell
through to the editor's enter fallback: the draft was submitted, and nothing interrupted the turn.
Send-now therefore behaved exactly like enter and never sent during a running turn.

## Source gate

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Ranges are zero-based UTF-16 code units, half-open, verified against extracted-v2/manifest.json.
Recovered application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | `Bq`/`mL` 886226, `e9`/`z7` 887081, action map 887345, `Ovo` 1343023, `Jat` 1343180, `Zat` 1343398, `elt` 1343731, `tlt` 1343820 |

`Bq` (`mL`, 886226) runs `if (fp(void 0)) return; const value = ee.value; Gm(value);
zd(value, true, undefined, true)`: the guarded predicate, the draft hand-off and a submit whose
fourth argument marks a queued submission.

`e9` (`z7`, 887081) computes `nonEmpty = value.trim() !== "" ||
Object.values(ee.pastedContents).some(_8t)`, derives the leader/teammate prompt context from the
store, and when the draft is empty or a queued row is being edited calls `pL(mode, taskId)` only
(the queue flush). With a non-empty draft it calls `Gm(value)` then `zd(value, true).then(...)`, and
after the submit settles, when the same abort controller is still current, flushes the queue for a
leader prompt (or for any teammate prompt).

`Zat` (1343398) is the flush: with the low-latency gate `$Cn()` on a live prompt turn holding a
queue it calls `deliverWithoutCancel()` and logs `input_send_now_key`; otherwise it falls back to
`tlt` (1343820), which returns `nothing_to_send` when no turn is live, `no_live_controller` when
`interruptRunningTurn()` fails, and otherwise logs `tengu_cancel` with source `queued_send_now` and
cancels the turn. `elt` (1343731) is the live-turn predicate:
`(mode ?? "prompt") === "prompt" && turn.guard.isActive && Flr(queue)`.

## Adaptations and ownership

- This host has no low-latency mid-turn delivery channel, so `Zat`'s `$Cn()`/`deliverWithoutCancel`
  arm is unavailable and the product reproduces the recovered fallback `tlt`: cancel the running
  turn (`turnController.abort`) so the interactive loop drains the queued draft immediately. The
  footer shows the aborted turn (`finished: aborted`) before the queued prompt runs.
- The teammate/task-id branch has no local consumer; the main-session `h === undefined` arm is the
  one ported.
- `elt`'s `(mode ?? "prompt") === "prompt"` gate is an adapter: this host's composer has no
  draft-mode state, so every draft is prompt mode and the gate's other branch cannot arise.
- `src/tui.ts` owns the submission: queue-submit dispatches `submit` like enter; send-now dispatches
  `submit` only for a non-empty draft, mirroring `e9`'s `nonEmpty` (`text.trim() !== "" ||
  Object.values(pastedContents).some(_8t)`), and it does so before the action is emitted. `_8t`
  (chunk-24k7d6mw.js 863568) accepts only `type === "image"` pastes; this host's composer stores
  text pastes only and its image paste is scoped to the question dialog, so the extra
  referenced-paste clause is inert and the effective test is a non-empty trimmed draft.
- `src/interactive.ts` owns the flush: `chat:sendNow` aborts the current turn only while one is
  running and the queue holds a user prompt, which is `elt`'s live-turn predicate. The draft is
  already queued when the action arrives, and an empty composer with an empty queue is the
  recovered `nothing_to_send` no-op rather than an interrupt.
- A queued prompt drains as soon as the loop is free, so `queueSubmit`'s queued-submission flag has
  no separate local state; the observable behavior matches the recovered `zd(..., true, ..., true)`.

## Throughput

One bounded independent reader checks the ranges, semantics and integration. One lead writer owns
all product changes. The compiled acceptance drives the real CLI under a PTY.

## Validation

- `npm run check` and `npm run build` pass.
- `test/tui.test.ts`: 73 tests pass, including the new send-now/queue-submit test.
- Full suite: 2988 tests, 2987 pass. The single failure, CLI effort flag overrides environment,
  remains the pre-existing W231 divergence reproduced at HEAD5717eb9.
- Compiled acceptance `.audit/w239-send-now.mjs`: 11/11 checks at identity
  2fa9da4b1b9045888ed5d78eb0a1a49d5cabcd821415e315552cdefab882e485. It covers: a first turn that
  streams text and never stops, leaving the CLI running; an empty send-now with no queued prompt
  leaving that turn alone (`nothing_to_send`); a draft typed during the turn; ctrl+x ctrl+s
  producing exactly one request for the draft while the first turn is still open; the sent-now
  prompt running afterwards and its answer landing; a zero exit after `/exit`; then a second
  session where a plain submit during the running turn queues without sending, an empty send-now
  cancels that turn and flushes the queued prompt (`elt`'s live-turn path), exactly one flush
  request arrives, its answer lands, and the CLI exits zero again.
- Independent review found no blocking defect. Its items were assessed: the missing draft-mode
  gate is an adapter (this host has no draft-mode state; every draft is prompt mode, the only
  branch `(mode ?? "prompt") === "prompt"` admits), the approval window is theoretical because the
  dialog owns the keyboard before `applyAction` runs, the non-empty test is documented above, the
  skipped `resetKillMode` is fixed, and the missing empty-draft-plus-queue case is the new
  acceptance phase. The abort surfaces as `finished: aborted`, not an error line, in the compiled
  run.
