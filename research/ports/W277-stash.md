# W277 composer stash

The `chat:stash` chord, its one tip, and the `Draft restored` feedback that brings a stashed
draft back. Offsets are zero-based UTF-16 code units.

| Module | SHA-256 | Offset | Contents |
| --- | --- | --- | --- |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | 484409 | `stash`: the draft store's store move |
| ↳ | | 484692 | `popStash`: the draft store's pop move |
| ↳ | | 843876 | `qq`: the chord handler — stash on a non-empty draft, pop on an empty one |
| ↳ | | 817896 | `bJt`: the `hasUsedStash` latch |
| ↳ | | 844018 | `Ce(bJt,Jr)`: the latch write |
| ↳ | | 828570 | `Yc`: the draft-length gate behind the tip |
| ↳ | | 828513 | `Cl`: the tip row's clear |
| ↳ | | 828775 | `Pr({key:"stash-hint",…})`: `["Tip:", " ", <chord>]` |
| ↳ | | 721485 | `XS`: the tip's 5000 ms |
| ↳ | | 1492930 | the submit path's restore, with `Draft restored` at 1493000 |
| ↳ | | 1495345 | `#s`: the post-command restore, with `Draft restored` at 1495489 |
| `chunk-sxm1dh4y.js` | `4b99782cd2c85d7c09cfd155118e1b9d052d81501a83aa7d672cf8ed1111613e` | 1640 | `t$r`: the stash slot writer |
| ↳ | | 2407 | `l9n`: the launch-warning writer the swap carries |
| `chunk-nh8hd3rr.js` | `5194b7a0a1b3c5beeae642f9b337330dabb12d436085c4aa52a1cf5ff81d1794` | 800 | `pt`: the key hint |
| `chunk-0qkpwgr4.js` | `470fcab1f965a43d7ec6a08213a15a49218e65d7e2cc8b4bef21d8c4622335a6` | 3890 | `z`: joins a chord and its action with `" to "` (4270) |
| `chunk-z3f0m1q8.js` | `f035b4067fe457f5a4584fe03292045e6d53134136827d2236d1e1540cc87d1f` | 771 | `ma`: the binding lookup the hint's chord goes through |
| `chunk-bk5ct2gw.js` | `efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1` | 558688 | `Ze`: the global record carrying `hasUsedStash:!1` |

## Behaviour

- **The swap.** `qq` reads the draft. A non-empty draft moves into the stash slot through
  `t$r` and the composer is refilled from whatever the slot held before, so two presses swap
  the two drafts; an empty composer pops the slot back. With both sides empty the handler
  returns without a write.
- **Nothing is announced.** The chord itself writes no status row and raises no notification.
  The only copy on this surface is the tip and the restore feedback.
- **The tip.** `Yc` watches the draft length. A shrink from at least 20 characters to at most 5
  raises `Pr({key:"stash-hint", text:["Tip:", " ", <chord chat:stash>]})` for `XS` (5000 ms).
  A typed change clears the row first (`Cl`), so a shrink that happens inside a longer edit
  still raises it. The gate fires once per shrink, and any draft growth re-baselines it.
- **The latch.** The first successful stash writes `hasUsedStash` through `bJt`/`Ce`, and a set
  latch suppresses the tip for good. The latch lives on the global record `Ze`.
- **The restore.** Two paths bring the stash back, both only when the composer is empty and both
  reporting `{key:"stash-restored", kind:"feedback", text:"Draft restored", priority:"high",
  timeoutMs:5000}`: the submit path at 1492930 (skipped for slash commands) and `#s` at 1495345
  after a command finishes. The restored draft carries its cursor and pasted contents.

## Host adaptations

- **The latch is a settings document.** This host has no global record equivalent to `Ze`, so
  `hasUsedStash` is a key in `<userDir>/settings.json`, written atomically and preserved beside
  the other keys. A missing or unreadable document reads as "not set"; a write that fails does
  not block the swap.
- **One status row, keyed by owner.** `Pr` is a keyed notification store; this terminal models
  it as its single status row with an owner key. The tip and the restore notice each own their
  key, so the restore notice is not cleared by a later tip check and the tip is cleared by a
  typed change as `Cl` describes.
- **The post-dispatch restore is called from the loop.** `#s` lives in the interactive loop's
  queue dispatch: once a user prompt is accepted, `terminal.restoreStashedDraft()` runs. The
  TUI's own submit path calls the same method, so both owners reach one implementation.
- **A repaint closes the chord.** The source store notifies its subscribers after the swap;
  this terminal's composer is drawn from the editor the swap replaced, so `stashDraft` renders
  once at the end.
- **Not ported.** The `input_stash` telemetry, the stash slot's persistence across sessions,
  `l9n`'s launch-warning row (this host has no launch warnings), and the settings-document
  migration for the latch.

## Validation

Unit 5/5 (`test/tui-stash.test.ts`: the exact copy and timings, the gate's 20→5 window with its
once-per-shrink guard and the 0-length case, the latch preserving `theme`, an unreadable file
reading false). New TUI test with a real user directory: the tip after a 25→5 erase, typing
clearing it, the chord swapping both ways with no status copy, the latch written, a submit
restoring the draft with `Draft restored`, and the tip staying away afterwards. Updated three
existing tests that encoded the removed host copy. Focused 91/91 (tui, vim, tui-stash).
Full suite 3182/3183 with the known `cli-migration` effort failure. Compiled 11/11 at identity
`13ec59f0…`: tip on the shrink, cleared by typing, chord stashes and pops with no status line,
`hasUsedStash` in the settings document, submit restores with `Draft restored` while the turn
runs, tip suppressed after the latch, `/exit` code 0.
