# W282 footer paste expand hint

A collapsed paste now raises the composer footer's `paste again to expand` row, and the expansion
or an 8000 ms timer takes it down. Offsets are zero-based UTF-16 code units, half-open.

| Module | SHA-256 | Offset | Contents |
| --- | --- | --- | --- |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | `[760326,760469)` | `if(Ct&&!Pt){…children:"paste again to expand"…,"expand-paste-hint")…return gr}` in `Fz` |
| ↳ | | `[760198,760326)` | `if(xt){…children:"Pasting…"…,"pasting-message")…return gr}` — the row before it |
| ↳ | | `[839453,839552)` | `if(Xu.length<=fVe)Bo(!0),Ei.current?.(),Ei.current=ys.setTimeout(()=>{Bo(!1),Ei.current=null},8000)` |
| ↳ | | `[821273,821331)` | `Va=()=>{if(Ei.current)Ei.current(),Ei.current=null;Bo(!1)}`, bound as `xl` |
| ↳ | | `838706` | `xl()` inside `Pq`, the expand-on-second-paste path |
| ↳ | | `[777565,777673)` | `he=M.isSearching\|\|M.exitMessage.show\|\|M.isPasting===!0\|\|M.showExpandPasteHint===!0` |
| ↳ | | `868097` | `[nf,fl]=y(!1)`, the state the footer reads as `Ct` |
| `chunk-f37m98yh.js` | `207b107a452d54c816419d533bc258f2c8567f8ccfc255cebc390160bb4c900d` | `[52087,52172)` | `de`: `E.preventDefault(),d(!0),v(E.text,…)` — the paste path raises `isPasting` |
| ↳ | | `[52172,52432)` | `Y`: the long-key arm `E.key.length>$q` does the same |
| ↳ | | `[50871,50902)` | `J`: `d(!1)` after the paste is folded in |
| `chunk-n3ykh62m.js` | `2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac` | `[465508,465520)` | `var fVe=1e5`, the collapse-size ceiling for the hint |
| `chunk-8s56nf7t.js` | `7fc34a2aa3076cceb825a0094eece20ccf89346ea895c7731bbd2760000c5cc7` | `[1411,1422)` | `var $q=800`, the paste-collapse threshold |

## Behaviour

- **The row.** `Fz` returns the dim `paste again to expand` string alone, before the sparse/dense
  split, before the bash label and before every other indicator. Its guard is `Ct && !Pt`: the hint
  flag and the negation of the history-search flag.
- **The producer.** A paste folds into `[Pasted text #N]` when it exceeds `$q = 800` characters or
  the row budget. When the folded payload is at most `fVe = 100000` characters, the producer calls
  `Bo(!0)`, cancels any previous timer through `Ei.current`, and arms `ys.setTimeout` for 8000 ms to
  clear both. A payload above `fVe` raises no hint, because the second paste could not expand it.
- **The clear.** `xl` cancels the timer and calls `Bo(!1)`. It runs from the expand path (`Pq`,
  which deletes the record and splices the payload into the draft) and from unmount.
- **`Pasting…` is the other row.** `xt` is `isPasting`, raised by the paste handler `de` and by the
  long-key arm of `Y`, and cleared by `J` once the payload is folded in.

## Host adaptations

- **`Pasting…` is not ported.** Its producer is the recovered composer's asynchronous paste path:
  `de`/`Y` set the flag and then await clipboard image reads before `J` clears it. This host's
  bracketed paste is decoded atomically in `TerminalKeyDecoder` and applied in one reducer step, so
  there is no interval in which a paste is in flight and the row would never be observable. The
  row's own rendering is a one-line early return in `Fz`; porting it without a producer would be
  inventing the state.
- **The hint's producer is real and is wired.** `InputPaste` gained two constructor parameters:
  `onExpandPasteHintChange` and a scheduler. `initializePasteSource` now takes the recovered
  `Bo`/`Ei`/`ys` triple as optional hooks instead of its inert stubs, so the copied `xM` body runs
  unchanged and the host supplies the setter, the cancel handle and the timer. `TuiTerminal` owns
  the flag and repaints from the callback; `close()` cancels the timer.
- **The paste path already repaints.** `InputPaste.pasting` is true while the producer runs, so the
  setter skips its own frame there and only the 8000 ms timer repaints. Without that the paste
  would paint twice.
- **The notice band is the host's left text.** The source draws notices in their own row and the
  hint row replaces only the footer. This host has no notice band: its notice is the footer's left
  text, so the hint yields while a `statusNoticeText` is live. Without that, the hint row would hide
  the `no longer available` notice the submit path raises.
- **Search screen.** `Pt` is the history-search flag. This host renders the history search over the
  footer, so the hint also stands down while `screen === 'search'`.

## Validation

Unit: `test/tui.test.ts` 86/86 including the new paste test, `test/terminal.test.ts` 29/29.
`npx tsc --noEmit` clean, `npm run build` clean. Full suite 3200/3201 with the known
`cli-migration` effort failure only. Compiled 10/10 at identity `e1af61e6…`: no hint before a
paste, an 801-character paste collapses and raises it, the same payload pasted again expands and
takes it down, a fresh collapse raises it again, it clears itself after 8000 ms, and the paste
sends no provider request.
