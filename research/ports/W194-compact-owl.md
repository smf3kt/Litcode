# W194 replace the splashed art with one small owl

Status: implemented locally on `work/w43-choice-preview`. Follows W192 and W193. No push,
no upstream calls.

## Request

「雪鸮太大了而且完全仿照claudecode原来的贴画，只需要一个简洁的猫头鹰形象就可以了」.
The sixteen-row landscape was both too tall and too close a copy of the other product's
splash; the header should be one simple owl.

## Change

`src/tui-welcome.ts` keeps only a four-row, nine-cell mark and puts it beside the title:

```
 ▟█▙ ▟█▙   Welcome to LiTcode v0.1.0
█◉██▽██◉█
█████████
 ██   ██
```

Removed: the eleven scenery rows, the ten-line `lightArt`/`darkArt` and their
`appleLightArt`/`appleDarkArt` variants, the dotted rule, the `Apple_Terminal` `V` art
with its `▗`/`▖` idiom, the `appleTerminal` prop, and the `WELCOME_ART_WIDTH = 58` box
with its `WELCOME_OWL_ROWS` tier. `WELCOME_ART_WIDTH` is now 36, the width of the title
row.

The port deviation is recorded here as research/coding-standard.md S-7 requires: the
recovered art is obtainable and was ported faithfully in W192, but it conflicts with an
explicit user constraint, because at sixteen rows it is a pastiche of another product's
splash rather than this product's identity. The row accounting and the two colour slots
are still the source's.

W193's three-way density collapses back to the source's binary shape, since a four-row
mark fits any terminal that can show a log at all: `welcomeDensity(availableRows)` is
`art` at `WELCOME_ART_ROWS + LOG_SLACK` (8) and `line` below. The `line` fallback and
`WELCOME_MESSAGE` are unchanged.

`Welcome` no longer takes `appleTerminal`, so `TuiTerminalOptions.termProgram`
(`src/tui.ts:122`) and its `src/cli.ts` assignment are gone too; nothing else read that
option.

The backdrop from W193 stays: the plumage still carries `clawd_background` behind its
nine cells and the eye and beak swap both slots, so the bird is legible when theme
detection assumed the wrong terminal background.

## Validation

- `test/tui-welcome.test.ts` 7/7: the four-row lockup with the title at cell 11, the
  density boundary and the `line` fallback, the owl glyphs in both theme families, the
  `48;2;` backdrop on every plumage row, no row wider than 36 cells across four themes,
  and the grey-white palette in all six built-in themes.
- `test/tui.test.ts` 60/60; its `welcomeRows` helper follows the binary density.
- Full suite 2682/2682 (118 suites), `npm run check` and `npm run build` clean.
- Compiled global `litcode` at 24 rows draws the mark at rows 0 to 3 with the transcript
  and composer below it; the capture reads back cleanly now that `scripts/pty-cli.exp`
  passes bytes through (W193), and the in-process render carries `48;2;60;60;60` behind
  the plumage with `38;2;240;240;240` for the body and per-cell inverted detail.

Raw samples stay unchanged; no recovered entrypoint is executed.
