# W283 composer ultracode tag

The composer's top border now carries the `ultracode` tag while the session flag, the workflow gate
and the model gate hold, revealed over eleven 120 ms frames. Offsets are zero-based UTF-16 code
units, half-open, in `chunk-24k7d6mw.js`
(`1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`).

| Offset | Contents |
| --- | --- |
| `[153563,153784)` | `tee`: the word painted in the `effortUltra` slot; the reveal index takes `ge.hex("#d0b4ff").bold`, its two neighbours `ge.bold`, the rest plain. `T === void 0` is the settled tag. |
| `[153784,153841)` | `var XZ="ultracode",mVn="#d0b4ff",vkt=XZ.length+2,$Ie=120` |
| `[153841,154093)` | `oee`: the reveal clock. `Eu()` (reduced motion) short-circuits it; `we = floor((now-start)/$Ie)`, index `we-1`, and the hook clears its flag once `we >= vkt`. |
| `[154093,154223)` | `nee`: `{content:" "+parts.join("  ")+" ",position:"top",align:"end",offset:0}`, `undefined` for an empty list. |
| `866311` | `Ii=V(D4t)&&!Gs`: `isBriefOnly` and the negation of `viewingAgentTaskId`. |
| `866374` | `Va=V(H4t)`: the session `ultracode` flag (`H4t` at 862373). |
| `893703` | `PL=!Ii&&VC(Va,mn)`: the tag's gate; `mn` is `cu()`'s model, so `VC` is `ultracode === true && ZI(model)`. |
| `893706` | `gf=Rt(j9r,I8t)`: the internal-tag subscription, second border part. |
| `893792` | `ML=tee(ff,hy)`, `IL=nee([p9,Mx,gf])`: the word, then the border record built from it, the fast-mode tag and `gf`. |
| `850975` | `R9=GE(kn,_r)`: the composer's border style, `_r` being `nt()` (screen reader). |
| `853236` | `bf=_r?void 0:tRe??Vo`: the top-position argument hint wins over `Vo`, the tag record. |
| `853246` | `r(s,{...s$,width:"100%",borderText:bf,children:[Fo,wg]})`: the record reaches the box. |

`ZI`/`dg`/`Bit` are `chunk-9vcaezw1.js` 5771/2239/5134 and `chunk-c5zwk83v.js` 2239; `VC` is
`e===!0&&ZI(n)`.

## Behaviour

- **The gate.** `ff = !Ii && VC(Va, mn)`: no brief transcript, no agent view, the session flag on,
  and `ZI(model)` true. `ZI` is `dg() && (model === void 0 || Bit(model))`, where `dg()` reduces to
  the workflow availability and `Bit` is the model's `xhigh` support.
- **The reveal.** When the gate first holds, `oee` stamps a clock and the tag draws with the
  shimmer at `we-1`; the word is eleven frames wide (`vkt = len + 2`), so the index runs from `-1`
  (nothing shimmering) to `9`, then the hook clears its own flag and `tee` returns the plain word.
  `Eu()` (reduced motion) makes the effect inert from the start.
- **The record.** `nee` joins the word with the fast-mode tag and the internal tag by two spaces and
  pads one on each side. `borderText` draws it on the top border only when `position === "top"`, so
  the composer box must carry a top border for the tag to appear at all.
- **Precedence.** The composer's own top text is `tRe ?? Vo`: the history argument hint replaces the
  tag, and a screen reader removes both.

## Host adaptations

- **`tRe` is not ported.** The argument hint reads `gue`'s history counter, which this host has no
  equivalent of (recorded under Config residuals), so `composerBorderText` returns the tag record
  alone and there is nothing for it to lose to.
- **`gf` is not ported.** Its feed is `Rt(j9r, I8t)` where `j9r` subscribes to
  `Dio().changed` behind `Lio()`, which is `return !1`; the internal tag can never be non-empty in
  this build, so the record's second part is honestly absent rather than empty by omission.
- **`Bit` has no local table.** W212 already records that every model accepts every effort level
  here, so `setUltracodeTag` takes `modelSupportsUltracode` and `interactive.ts` passes `true`; the
  workflow gate stays the real second operand, the same reduction `modelPickerUltracodeSuffix`
  documents.
- **`Ii` maps to the brief transcript.** `isBriefOnly` is the recovered brief view and
  `viewingAgentTaskId` has no local agent view, so `!this.briefTranscript` is the whole operand.
- **The clock is a host timer.** `oee`'s `ia` interval becomes a `setInterval` at `$Ie`; it stops
  itself on the frame `oee` would clear its flag, and `close()` clears it. With reduced motion the
  clock never starts, which is what `Eu()` does to `oee` upstream.
- **The paint is the host slot painter.** `tee` builds its colour from `Wn("effortUltra", theme)`;
  `TuiTerminal` supplies `slotForeground(themeSlot('effortUltra'))` so a custom theme's override
  paints, and `tee`'s own `ge.hex("#d0b4ff").bold` and `ge.bold` bodies run unchanged.
- **The record needed a route, not a border.** `GE` (`tui-source-chrome.ts`) returns `borderBottom`
  only, but the engine's `mE` defaults `borderTop` on for any `borderStyle`, so the box already drew
  its top rule (the W44 frame test pins it). What was missing was the `borderText` parameter:
  `renderChat` now takes the record and spreads it onto that same box, and the engine's `rC` draws
  top text when `position === "top"`.

## Validation

Unit: `test/tui.test.ts` 87/87 with the new tag test (absent before the flag, present and
border-aligned after the reveal, off without workflows, back with them, hidden by the brief
transcript and shown again after leaving it, off with the flag), `test/terminal.test.ts` 29/29,
`test/effort-command.test.ts` + `test/model-picker.test.ts` 23/23. `npx tsc --noEmit` clean,
`npm run build` clean. Full suite 3201/3202 with the known `cli-migration` effort failure only.
Compiled 7/7 at identity `3c07dd53…`: no tag before the flag, `/effort ultracode` raises it on a
border row, `off` takes it down, and no provider request is sent.
