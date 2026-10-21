# W242 the kill-agents chord's confirmation and stop

Status: implemented and verified locally, 2026-10-22. Local only; no push, no paid calls.

## Task card

- Entry is the Chat chord `ctrl+x ctrl+k` (`chat:killAgents`), the last unhandled action in the
  composer's binding table.
- Outcome requires both recovered arms: with no live background work the source emits its
  `kill-agents-none` feedback; with live work the first press arms a three-second confirmation and
  a second press inside that window stops the work. The first delivery wired only the none arm and
  claimed no local producer existed; an independent review disproved that claim (the CLI enables
  `features.background` and registers `run_background`/`monitor`), so both arms are wired to the
  session's real background registry here.
- Validate the compiled CLI, cite source ranges, take one bounded independent review. One lead
  writer.

## Baseline

At 0be4b54 the chord decoded to `chat:killAgents` and `applyAction` returned false: the key was
consumed by the keybinding table and nothing happened.

## Source gate

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Ranges are zero-based UTF-16 code units, half-open, verified against extracted-v2/manifest.json.
Recovered application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | handler registration 437758 (`Ze("chat:killAgents",Jr,{context:"Chat"})`), footer handler `Jr` 435644, `kill-agents-none` feedback 436017, double-press feedback 437642, running-task predicate `ane` 429125, double-press window `mFe` 429116 |
| chunk-6ccen3s8.js | 4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d | Chat binding 2623 (`"ctrl+x ctrl+k":"chat:killAgents"`) |
| chunk-0gtwhfja.js | 49469b8bbb240ac6c16d48a01dd9840c259dd45a78b1f4f3ec4b975e7eff455d | stoppable-task predicate `s2t` 41247 (`vJn(e,zp)`) |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | retained-completed task predicate `mS` 4221742 (`status === "completed" && LC(e).size > 0`), keepalive-reason set `LC` |

## Recovered behaviour

- `Jr` treats the host as having background work when any task matches `ane` (a running background
  task, a local-agent task that is running or `mS` completed-but-retained, or a running in-process
  teammate), when a service reports a stoppable count, when an
  auto-reply subscription is armed, when a task matches `s2t`, when live document watches exist,
  when artifact auto-reply consent exists, or when `zp()` reports work.
- With none of those it emits `kill-agents-none`, text `No background agents running`,
  `priority:"immediate"`, `timeoutMs:2000`, and returns.
- Otherwise it compares `Date.now()` with the last press (`go.current`) inside `mFe=3000`. A press
  outside the window stores the timestamp and emits `kill-agents-confirm`, text
  `Press <chord> again to stop background agents`, `priority:"immediate"`, `timeoutMs:3000`.
- A press inside the window zeroes `go.current`, clears the `kill-agents-confirm` feedback and
  stops the counted work: `pFe(xt)` interrupts stoppable services, `ine?.stopAllLiveDocWatches()`
  ends live document watches, `DGr()` and `$me`/`Y_n` stop artifact auto-replies, and the local
  agent tasks are stopped. In the same `as` branch it separately clears the command queue
  (`po.clearCommandQueue`, reason `cleared_on_cancel`); that clear is a side effect of the branch,
  not part of the stopped set.

## Adaptations and ownership

- The TUI cannot import the runtime, so the host binds the live count and the stop action the same
  way it binds the prompt queue: `TerminalSurface.bindBackgroundWork(probe, stop)`, implemented by
  `TuiTerminal.bindBackgroundWork`. Interactive binds the probe to
  `Runtime.backgroundWorkCount(owner)` and the stop to `Runtime.stopBackground(owner)`.
- `backgroundWorkCount` is the local `ane` set: the owner's `BackgroundRegistry.active()` jobs
  (running shell/monitor jobs) plus `AgentRegistry` children whose status is `running`. The
  status gate matches `ane`'s running clause; a child that has a worker but is still `queued`
  during registry startup is not counted, exactly as the source only counts `status === "running"`.
  A `WorkflowRegistry` is built over the same child registry, so a workflow's running children are
  included; stopping them through this chord is the intended "stop the counted work" effect, and no
  separate workflow stop path exists to double-report. The durable filesystem task store is not
  consulted, so it cannot report phantom agents.
- `stopBackground` stops that same set: `BackgroundRegistry.stop(id)` kills each job's process
  group and `AgentRegistry.stop(id)` aborts each running (including workflow-owned) child; the
  child stop is asynchronous and the chord does not wait for its teardown. A closed runtime
  returns 0 from both methods.
- The armed press is modelled as `killAgentsArmed: number | undefined` rather than the source's
  `0` sentinel. With a real epoch the two are indistinguishable, and the explicit absence is the
  correct state under a mocked clock.
- The source builds the confirm text from the binding chord; the local text uses
  `chordForAction('chat:killAgents', 'Chat', 'ctrl+x ctrl+k')`, the same helper the footer uses.
- Out of scope with the record: the command-queue clear (the local prompt queue exists, but the
  clear belongs to the loop-owned queue and is not wired here), service stubs, armed
  subscriptions, live document watches and artifact auto-replies (no local producer). The source's
  `mS` arm, completed local-agent tasks retained by a keepalive reason, has no local producer:
  `AgentRegistry` prunes completed children by history limit rather than retaining them, and a
  retained completed child has no work left to stop. The source's in-process teammates are
  represented locally by `AgentRegistry` children and are included above.
- Stopping a job can free a queued background notification, which the existing loop may drain into
  a follow-up turn; that is the host's pre-existing background-notification behavior, not part of
  this chord.

## Throughput

One bounded independent reader checked the ranges, the reachable-arm argument and the integration.
Its first review found the none-arm-only claim false (CLI defaults enable background tools) and
required the live count plus stop path; its second review of the corrected delivery returned
SOUND, with one medium wording defect and five low findings, all addressed below. A delta
re-review of the child-agent inclusion and the low fixes also returned SOUND, with six low
observations that are folded into the record and tests below. One lead writer
owns all product changes. The compiled acceptance drives the real CLI under a PTY.

## Validation

- `npm run check` and `npm run build` pass.
- `test/tui.test.ts`: four tests cover the none arm (feedback paints, draft untouched, row clears
  at 2000 ms), the confirm arm (first press shows the confirmation without stopping, second press
  inside the window calls the bound stop once and clears the row, a third press arms again instead
  of stopping twice), the inclusive 3000 ms boundary (a press exactly at the boundary stops) and
  window expiry (a press after 3000 ms re-arms instead of stopping). Mock timers include `Date`
  for the window. Whole file: 80 tests pass.
- `test/runtime-resources.test.ts`: three tests cover `stopBackground` over running jobs, aborting
  a running child (the held provider settles only on the registry's abort, so a count-only stop
  fails) and excluding a completed child from both the count and the stop while a live sibling is
  counted; whole file 15 tests pass.
- Full suite: 2998 tests, 2997 pass. The single failure, CLI effort flag overrides environment, is
  the pre-existing W231 divergence reproduced at HEAD.
- Compiled acceptance `.audit/w242-kill-agents.mjs` (wide PTY `.audit/w242-kill-agents.exp`,
  rows 30 columns 160): 10/10 checks at identity
  `174700e3f16378ffcff23fd0921d514de22ff6571e89cbcdb2482e7f84327203`. The fixture provider drives
  `run_background` with a shell that writes its pid; the chord with no job reports none, the first
  press with a live job asks for confirmation while the job stays alive, the second press kills
  the process group (pid observed dead), the row clears, a later press reports none again, no
  prompt is sent by the chord, and the CLI exits zero. At the default 90-column footer the status
  row is clipped after a few characters, which is why this package's PTY is wider.
- Reviews: the first delivery returned NOT SOUND (blocking: the no-background-work premise was
  false). The second, corrected delivery returned SOUND. Its medium (an overstated sentence about
  what the stop arm stops) is fixed by separating the stopped set from the queue-clear side
  effect; its lows are fixed: probe and stop share one owner-resources lookup, a non-positive or
  malformed probe count takes the none arm, the inclusive-boundary and no-double-stop cases are
  tested, and a throwing stop reports through the status stream instead of being swallowed.
- The delta re-review returned SOUND and its lows are addressed: the interactive fallback that
  fell back to a narrower jobs-only probe is removed; the child test now proves the abort rather
  than a release, and a second test keeps a completed child present while asserting the count;
  the record names the `mS` retained-completed arm as having no local producer, the workflow-owned
  children sharing the registry, the `queued`-with-worker window, and the `mS` module in the table.
