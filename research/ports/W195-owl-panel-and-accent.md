# W195 drop the owl panel and the orange working accent

Status: implemented locally on `work/w43-choice-preview`. Follows W194. No push, no
upstream calls.

## Request

「背景的灰色没有跟终端同步，而且任务进行时候思考的颜色还是橙色」. Two complaints: the owl
sat on a grey rectangle that did not match the terminal, and the thinking indicator was
still the recovered orange.

## Change

**The panel is gone.** W193 had the plumage carry `clawd_background` behind its nine
cells so the bird survived a wrong theme guess. That backdrop renders as a visible
rectangle on any terminal whose background is not exactly that colour, which is what the
user saw. `src/tui-welcome.ts` no longer sets a background on the plumage: `owlRow` emits
the cells directly and the terminal's own background shows through the tuft gaps and
around the feet. The only background left in the art is `clawd_body` behind the `◉` eye
and `▽` beak cells, which punches a hole in the plumage rather than drawing a panel.

The bird now contrasts with the terminal through the two palette slots, which follow the
theme. `/theme` can pin the theme or set it to `Auto (match terminal)`; the saved default
is `dark`, so a light terminal needs that setting to get the dark-plumage palette.

**The working accent is grey-white.** `claude` and `claudeShimmer` are the only two slots
the thinking label and the in-progress task marker read
(`src/tui-progress.ts:119`, `src/tui-progress-tasks.ts:18`). Both were the recovered
orange. They now match the mascot's grey-white in all six built-in palettes:

| Palette | `claude` | `claudeShimmer` |
| --- | --- | --- |
| `light` | `rgb(80,80,80)` | `rgb(40,40,40)` |
| `light-ansi` | `ansi:blackBright` | `ansi:black` |
| `dark-ansi` | `ansi:whiteBright` | `ansi:white` |
| `light-daltonized` | `rgb(80,80,80)` | `rgb(40,40,40)` |
| `dark` (default) | `rgb(230,230,230)` | `rgb(255,255,255)` |
| `dark-daltonized` | `rgb(230,230,230)` | `rgb(255,255,255)` |

Light palettes take the dark end of the ramp so the label stays legible on a light
background. No other slot changed; `briefLabelClaude` and the `rainbow_*` set keep their
values, since nothing the user raised reads them.

## Validation

- `test/tui-welcome.test.ts` 7/7. The backdrop test is inverted into
  `the owl paints no panel, so no grey box shows against the terminal`: every `48;2;` in
  an art row must be `clawd_body`'s rgb, so a panel cannot come back unnoticed. A new
  `the working and thinking accent is grey-white too, not the source orange` checks both
  slots across all six palettes.
- Full suite 2683/2683 (118 suites), `npm run check` and `npm run build` clean.
- Compiled global `litcode` against an owned loopback gateway that accepts and holds, so
  a real turn stays in the thinking state while it is captured. Startup draws the four
  owl rows with `48;2;240;240;240` as the only background; the spinner frame carries
  `38;2;230;230;230` on the `·`/`✢`/`✳` glyph and `38;2;255;255;255` on the shimmered
  character; no `38;2;215;119;87` or `38;2;255;153;51` is emitted anywhere in the
  session.

Raw samples stay unchanged; no recovered entrypoint is executed.
