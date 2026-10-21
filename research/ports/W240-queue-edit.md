# W240 queued-prompt selection and pop-to-edit

Status: implemented and verified locally, 2026-10-22. Local only; no push, no paid calls.

## Task card

- Entry is the composer's queued-prompt UI behind the input queue: the empty-draft placeholder,
  up/down over queued prompts, Enter pulling the selected prompt back into the draft, Escape
  clearing the selection, and the default up-arrow pop-all path.
- Outcome requires the real recovered behaviour: selection indexes the editable queue oldest-first
  from the newest row, a pulled prompt leaves the queue so it is sent once, and nothing submits
  while the pull is in progress. No settings write, no account or network work.
- Validate the compiled CLI, cite source ranges, take one bounded independent review. One lead
  writer.

## Baseline

At 84362e0 the composer had no knowledge of the loop's queue. The up arrow always recalled prompt
history, Enter always submitted, and nothing communicated how many prompts were waiting.

## Source gate

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Ranges are zero-based UTF-16 code units, half-open, verified against extracted-v2/manifest.json.
Recovered application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | `Gv` up 834139, `bS` down 834853, Escape clear 835688, `Zm` pop-all 832576, `gpe` hints 856156, selection setter/clamp 819890-820950, Enter `cg` 872150-872950 (`popEditableAt` call 872617), submit guard 875332, `chat:cancel` gate 434932 |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | `Kp`/`zMe` 218170/218238, `jct` 220636, `Wct` 220780, `pi`/popAllEditable 235258, `dl`/popEditableAt 236078, queue entry table 237564 |
| chunk-nhnx1tam.js | eee1529d300ade5ea10008828d9391a99804cf82219cc1edfb17c93dfcd42aad | `ik` 661 (reads `a.CLAUDE_CODE_KB_COHESION_FIXES`) |
| chunk-yvnhkg35.js | ce3689687897e987959f19ab07f98d79e5c925a8b15620dce02d29ba4943348d | env object `a` 68762 |
| chunk-jtkw6zm9.js | a51faafc01160c3b3e88690341049baaf1ee6dcb6afa5a7dd5d0ee4f1566cab2 | text input placeholder 8209-8280 (dim `Text` when the value is empty) |

## Recovered behaviour

- `gpe` returns the hint only while the draft is empty and the queue has an editable row. With a
  selection it says "Press Enter to edit the selected message, or up again for history" at the
  oldest row and "…or up again for an older one" elsewhere. Without one, `ik()` true gives
  "Press up to select a queued message, then Enter to edit it"; false gives
  "Press up to edit queued messages". The `Psr()` (`tengu_jiggly_mochi`) send-now wording is dead
  in this artifact, and `queuedCommandUpHintCount` has no writer, so its `< 3` cap always holds.
- `Gv` runs only with the caret on the draft's first line and at most one suggestion row. With
  `ik()` it starts at index `count-1`, walks down by one, and at index 0 clears the selection and
  falls through to history up. `bS` walks toward `count-1` and clears at the newest row.
- `yS`/`Zm` is the `ik()`-false path: up calls `popAllEditable(editor.value, cursor, pastes)`; a
  successful pull consumes the key, a failed one falls through to history.
- `cg` (Enter with a selection) calls `popEditableAt(index, draft, cursor, pastes)`, clears the
  selection, and returns true so the submit path returns without submitting. A missing row logs
  `stale_index` and still consumes the key.
- `Wct` places the pulled text above the draft (`queue + "\n" + draft`) and puts the cursor after
  the draft. `jct` folds image tags into the text; this host has no queued images.
- Escape clears the selection at the input layer (835688); the Chat `chat:cancel` handler declines
  while a selection is up (434932), so the first Escape does not cancel the turn.
- `Kp` admits a queued row only when it is prompt-mode, not meta, and from a user origin; `zMe`
  additionally requires an empty draft for bash rows.

## Adaptations and ownership

- `keyboardCohesion()` (already recorded by the diff-dialog package) is the local `ik()`. It parses
  explicit truthy spellings (`1`/`true`/`yes`/`on`) where the source tests raw truthiness; the
  adapter predates this package and is reused unchanged.
- This host has no bash queue mode, so `Kp`'s mode gate and `zMe`'s empty-draft clause collapse to
  the editable-prompt filter. `src/interactive.ts` models source `isMeta` with a local `meta`
  flag on the slash commands it queues itself (`/editor`, the permission cycle, `/model`,
  `/thinking`, `/tasks`, `/reload`); typed lines and event prompts keep their existing sources.
- `TerminalPromptQueue` is the cross-layer contract: `snapshot` returns the editable prompts oldest
  first, `pop` removes one by filtered index, and `popAll` removes every editable prompt and joins
  them; both return the text plus the IDE selection the source restores (`TerminalQueuedPrompt`).
  The line-mode terminal does not bind it; the TUI treats an absent queue as empty.
- The TUI does the `Wct` merge itself (`replaceDraftFromQueue`). The source's IDE selection maps to
  the local diff attachment: a pull replaces the pending selection (`returnIdeSelection` runs
  unconditionally), setting it when the item carries one and no panel is mounted or the attachment
  names the mounted panel, and dismissing it otherwise so a cross-session or absent selection
  cannot ride along with the pulled text; `popAll` takes the first item carrying a non-empty one
  (`pi`'s `find(ideSelection?.text) ?? find(ideSelection !== undefined)`). The pull is announced to
  Vim as an external mutation, like the paste path. There are no queued images, no paste tags, no
  `unpassed`/`markCameBack` state, and no vim-NORMAL cursor remap; those source branches have no
  local counterpart. The SessionStart message is modelled as `meta` because the host generates it.
- Selection clamping and clearing mirror `js`/`ls`: a queue change clamps to the last row or
  clears at zero, and an edit that changes the draft text drops the selection. Queue mutations
  outside the composer (typed submit, meta pushes, drain) notify the TUI so the hint repaints.
- Escape with a selection is consumed by the composer before any gesture or cancel path, which is
  the observable result of the source's input-level clear plus the `chat:cancel` decline.

## Throughput

One bounded independent reader checks the ranges, semantics and integration. One lead writer owns
all product changes. The compiled acceptance drives the real CLI under a PTY.

## Validation

- `npm run check` and `npm run build` pass.
- `test/tui.test.ts`: two new tests cover the selection session (hint wording at both ends, oldest
  row handing the key to history, Enter pulling without submitting, Escape clearing, down clearing
  at the end) and the default pop-all path. Whole file: 75 tests pass.
- Full suite: 2990 tests, 2989 pass. The single failure, CLI effort flag overrides environment,
  is the pre-existing W231 divergence reproduced at HEAD5717eb9.
- Compiled acceptance `.audit/w240-queue-edit.mjs`: 15/15 checks at identity
  `9b389688a22c3489f5b046c8fee1a1479a17efc8896971d24e65852e248d9e58`. First session (flag on): the
  queued prompt paints the select hint while the turn runs; two queued prompts leave one live
  request; up selects the newest, Escape clears it without cancelling, up walks to the oldest;
  Enter pulls it into the composer and sends nothing; the remaining prompt pulls afterwards; the
  CLI exits zero. Second session (flag off): the plain hint paints, up pulls both prompts at once
  and sends nothing, and the CLI exits zero.
- Independent review returned SOUND with no blocking defect. Its mediums were fixed: the pull now
  announces itself to Vim as an external mutation; the diff attachment replaces the pending
  selection and is dismissed when it names another mounted panel (so it cannot ride along with
  pulled text); the SessionStart message is `meta` and not pullable. Its lows were assessed: the
  Escape/autocomplete overlap cannot arise (a selection needs an empty draft), the placeholder
  caret uses the same `+2` prefix offset as the normal composer path, `ctrl+l` is bound to
  `chat:clearInput` (W241 later aligned that chord with the source's repaint handler, so it no
  longer resets the draft), and the popAll comment now states the first-non-empty rule.
  The `stale_index` arm consumes the key without submitting and the pull sends nothing, both in
  the compiled run.
