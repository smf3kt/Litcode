# W193 make the snowy owl visible

Status: implemented locally on `work/w43-choice-preview`. Follows W192. No push, no
upstream calls.

## Request

The user reported 「我看不见雪鸮」 after W192 replaced the orange mascot with a white
owl: the bird was no longer visible on their terminal.

## Diagnosis

Two independent causes, both confirmed by reading the source path rather than reasoning
from the symptom.

**1. The header collapsed to a bare line.** W192 gated the art on
`WELCOME_MIN_ROWS = 30` compared against `viewportSize().rows`
(`src/tui.ts` `welcomePreamble`), but that value is the *transcript* budget, not the
terminal height: `viewportSize()` already subtracts the composer, the status line and
the margins (`src/tui.ts:1128`). A 24-row terminal therefore reports 20 rows and fell
below the threshold, drawing only `Welcome to LiTcode v0.1.0`.

**2. White plumage had nothing to contrast against.** `src/tui-theme-state.ts:16` seeds
the saved theme as `'dark'`, so `auto` never runs unless the user picked it, and the
mascot slots resolve to `clawd_body: rgb(240,240,240)` regardless of the terminal's real
background. The previous orange mascot was legible on both light and dark terminals;
near-white plumage is invisible on a light one. `src/tui-theme-source.ts:15` shows
`auto` is the only path that consults the detected system theme.

## Change

`src/tui-welcome.ts` replaces the source's binary `compact` prop with
`WelcomeDensity = 'art' | 'owl' | 'line'`, chosen by `welcomeDensity(availableRows)`:

| Density | Threshold | Rows | Content |
| --- | --- | --- | --- |
| `art` | `WELCOME_ART_ROWS + LOG_SLACK` (20) | 16 | header, landscape, owl |
| `owl` | `WELCOME_OWL_ROWS + LOG_SLACK` (10) | 6 | header, owl |
| `line` | below 10 | 1 | header only |

`LOG_SLACK = 4` keeps the header from eating the whole transcript: at 10 rows the
transcript budget is 6 and a bird would leave no log at all, so that height falls to
`line`. The source's binary flag is a port deviation, recorded here as required by
research/coding-standard.md S-7: the explicit user constraint is that the mascot must be
visible, and a flag that drops it entirely whenever the landscape does not fit conflicts
with that.

`owlRows(trailing, ground)` gained a `ground` parameter so the bird can be drawn without
the scenery's ground line when it stands alone.

Each plumage row now paints `clawd_background` behind its eleven cells via the `owl()`
span, and the eye and beak swap both slots (`detail()`), so the bird carries its own
backdrop and stays legible whatever the terminal background is, including when theme
detection assumed the wrong one. The Apple_Terminal tufts and crown rows take the same
backdrop. The owl silhouette gained ear tufts so it reads as a bird rather than a blob:

```
 ▟█▙   ▟█▙
▟█████████▙
█◉███▽███◉█
███████████
 ██     ██
```

The talons row's prefix shortened from seven dots to six so the bird stays vertically
aligned; its light and dark trailings grew by one cell to keep every row at 58. The
Apple variant's face and feet already painted `clawd_body` as a background, which is the
same idiom.

## Validation

- `test/tui-welcome.test.ts` 9/9, including a new `the density falls back to the bird
  before it falls back to a bare line` (threshold boundaries plus the owl-only art) and
  `the owl carries its own backdrop, so a wrong theme cannot erase it`, which asserts a
  `48;2;` background on all five plumage rows in both theme families.
- `test/tui.test.ts` 60/60. `welcomeRows` now derives its offset from `welcomeDensity`
  and a named `WELCOME_CHROME_ROWS` instead of a bare threshold. The selection fixtures
  stay at 10 rows, where the density is `line`; the highlight fixture moved to 40 rows so
  the sixteen-row header leaves its heading on screen.
- Full suite 2685/2685 (118 suites), `npm run check` and `npm run build` clean.
- Compiled CLI: the emitted stream carries `38;2;240;240;240` and `48;2;60;60;60` and no
  `38;2;215;119;87` at 24, 30 and 40 rows; the in-process capture shows the owl glyphs at
  14, 24 and 40 rows with no U+FFFD, matching `welcomeDensity(rows - 4)` at every height.

## Verification note

The PTY driver (`scripts/pty-cli.exp`, expect) transcodes non-ASCII to U+FFFD under a
non-UTF-8 locale, so glyph text read back from a PTY capture is not evidence. ASCII in
the same capture is intact, and escape sequences are unaffected, so SGR checks remain
valid. Verify glyph content in-process or with `LC_ALL` set to a UTF-8 locale.

Raw samples stay unchanged; no recovered entrypoint is executed.
