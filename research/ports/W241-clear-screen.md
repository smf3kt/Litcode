# W241 clear chords repaint the screen

Status: implemented and verified locally, 2026-10-22. Local only; no push, no paid calls.

## Task card

- Entry is the composer's clear chords: `ctrl+l` (`chat:clearInput`) and `cmd+k`
  (`chat:clearScreen`) in the Chat context.
- Outcome requires the recovered behaviour: the source binds both action ids to one handler that
  only forces a terminal repaint. The local handler used to wipe the draft, undo stack, gestures
  and Vim mode; that was a divergence from the artifact, not a different reading of it.
- Validate the compiled CLI, cite source ranges, take one bounded independent review. One lead
  writer.

## Baseline

At f644660 `chat:clearInput` cleared the editor to a fresh state (undo, gestures, Vim reset, draft
empty) and `chat:clearScreen` was unhandled. Six test sites used `ctrl+l` as a setup clear, one of
them asserting the cleared draft.

## Source gate

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Ranges are zero-based UTF-16 code units, half-open, verified against extracted-v2/manifest.json.
Recovered application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | action map 887384 (`"chat:clearScreen":yM,"chat:clearInput":yM`), `yM` 881185 (`vx=()=>{$N(p8t)}`), state pair 874671 (`[iy,$N]=y(0)`), redraw effect 874706-874841 (`KN=()=>{if(iy===0){return}oi().get(process.stdout)?.forceRedraw()}`), `p8t` 863241 |
| chunk-06azbynj.js | 5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd | `forceRedraw` 337112 (`log.forceFullReset()`, `prevFrameContaminated=!0`, `imagesStale=!0`, `onRender()`), `forceFullReset` 254386, `forceReset` consumer 255342 (`Xl(prev,"clear")`), `Xl` 258741 (`clearTerminal` op plus the erase diff) |
| chunk-6ccen3s8.js | 4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d | Chat bindings 2623 (`"ctrl+l":"chat:clearInput","cmd+k":"chat:clearScreen"`) |

## Recovered behaviour

- Both chords dispatch their action id to the chat component's handler map, and both entries are
  the same `yM`. `yM` is `() => setCounter(previous => previous + 1)`; the counter's only consumer
  is the effect `KN`, which returns on the mount value 0 and otherwise calls
  `oi().get(process.stdout)?.forceRedraw()`.
- `forceRedraw` returns false when stdout is not a TTY, resets the frame log, marks the previous
  frame contaminated and requests a render. In alt-screen mode it also clears stale images and
  resets the screen-reader diff. The repaint writes a `clearTerminal` operation: the log's
  `forceReset` branch calls `Xl`, which emits `clearTerminal` plus an erase diff over the previous
  screen rows, then the fresh frame.
- Nothing in that path touches the draft, the undo stack, Vim or the gestures. The action ids are
  named `clearInput`/`clearScreen`, but the recovered bodies repaint only.

## Adaptations and ownership

- The local handler calls `TuiRenderer.invalidate()` and `render()` instead of bumping a React
  state counter that an effect observes. `invalidate()` is the local equivalent of the source's
  `forceFullReset` plus `prevFrameContaminated` (`src/tui-renderer.ts:193`), and the ported
  `renderTree` writes the same `clearTerminal` operation; in this product's fixed alt screen the
  writer spells it `ESC[2J ESC[3J ESC[H`, then repaints the frame. The mount-value guard has no
  local counterpart because a direct call has no mount.
- Non-TTY terminals already no-op: `render()` returns early when not a TTY, matching
  `forceRedraw`'s false return.
- `cmd+k` is declared by the same Chat table but the decoder spells `ESC k` as `meta+k`, exactly
  as it does for every other `meta+letter` sequence, so the chord cannot fire from a terminal
  unless a platform key layer converts it; that limitation predates this package and the source
  binding is reproduced as-is.
- The six test setup sites that used `ctrl+l` as a clear moved to the composer's own clear
  gestures: home plus kill-line (repeated while a wrapped line remains) or backspaces, and in the
  Vim cases the editor mode is switched off before the kill because Vim owns the key. One Vim
  assertion now states the recovered behaviour itself: the chord leaves the draft in place.

## Throughput

One bounded independent reader checks the ranges, semantics and integration. One lead writer owns
all product changes. The compiled acceptance drives the real CLI under a PTY.

## Validation

- `npm run check` and `npm run build` pass.
- `test/tui.test.ts`: one new test drives `ctrl+l` in a fresh terminal, asserts the raw output
  carries the alt-screen clear, the draft is unchanged and the typing run is still one undo away.
  Whole file: 76 tests pass. `test/vim.test.ts` and `test/input-return.test.ts` pass with their
  setup clears rewritten.
- Full suite: 2991 tests, 2990 pass. The single failure, CLI effort flag overrides environment,
  is the pre-existing W231 divergence reproduced at HEAD5717eb9. One asynchronous-hook test failed
  in a concurrent run and passed alone and in the next run; it does not touch this path.
- Compiled acceptance `.audit/w241-clear-screen.mjs`: 9/9 checks at identity
  `a3840ef378bc12b27e19ce4ab104fa3978f756056c17dd8cdf4cd9a236c7d0df`. The compiled CLI starts
  ready, the draft paints, `ctrl+l` writes `ESC[2J ESC[3J` then repaints the frame, the draft
  survives, the typing run is still undoable, no prompt is sent, the endpoint sees no request and
  the CLI exits zero.
- Independent review returned SOUND with no blocking or medium finding. Its two lows are fixed:
  the input-return setup clear now deletes the whole multiline buffer instead of one line, and the
  handler comment names the alt-screen branch it reproduces rather than the whole reset.
