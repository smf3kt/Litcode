# W192 white owl header and a scrollable startup banner

Status: implemented locally on `work/w43-choice-preview`. Restyles the startup header
ported as W44's `Hee` and fixes its lifetime in the TUI. No push, no upstream calls.

## Request

Three changes from the user: the header's orange mascot theme becomes grey-white, the
mascot becomes a white pixel snowy owl, and the startup picture must stop vanishing on
the first keystroke so it can be scrolled.

## Palette

`src/tui-theme-colors.ts` carries six built-in palettes (`S1`: `light`, `light-ansi`,
`dark-ansi`, `light-daltonized`, `dark-daltonized`, and the default `dark`). The mascot's
two colour slots were `clawd_body: rgb(215,119,87)` (the orange) and
`clawd_background: rgb(0,0,0)` in every one of them. They are now grey-white:

| Palette | `clawd_body` | `clawd_background` |
| --- | --- | --- |
| `light` | `rgb(90,90,90)` | `rgb(235,235,235)` |
| `light-ansi` | `ansi:blackBright` | `ansi:white` |
| `dark-ansi` | `ansi:whiteBright` | `ansi:blackBright` |
| `light-daltonized` | `rgb(90,90,90)` | `rgb(235,235,235)` |
| `dark-daltonized` | `rgb(240,240,240)` | `rgb(60,60,60)` |
| `dark` (default) | `rgb(240,240,240)` | `rgb(60,60,60)` |

Light palettes take a dark plumage so the bird stays visible on a light background. The
header text and the compact branch move from the `claude` accent (also orange) to `text`,
which is white on dark themes and black on light ones. The global `claude` accent is
untouched, so the prompt pointer, spinners and labels keep their colour.

## Art

`src/tui-welcome.ts` keeps the source's row accounting, landscape rows and 58-cell
`WELCOME_ART_WIDTH`; only the mascot slots change. The owl is five rows of eleven cells
(crown `▄█████▄`, head, eyes `◉`, beak `▽`, talons) drawn in the source's colour slots:
`clawd_body` for the plumage and `clawd_background` for the eye and beak detail. The
Apple_Terminal variant `V` keeps its `▗`/`▖` face idiom and gains a tufts row and a crown
row above it, so it too reads as the same bird. Every row is at most 58 cells; a test
asserts that, because an over-wide row wraps in the document renderer and breaks the art.

## Lifetime

The header used to be a frame band drawn only while `transcript.entries.length === 0`, so
the first appended entry erased it and it was never part of the scrollable content.

It is now a **preamble** of the transcript's rendered rows: `renderedTranscriptRows`,
`transcriptLines` and `layoutTranscript` in `src/tui-transcript.ts` take an optional
`preamble: readonly RenderedRow[]` that leads the log without being an entry. Because the
preamble counts toward `total`, the existing scroll commands move over it and the header
scrolls away with the log and comes back at the top, while `transcriptState.entries`
keeps exactly the entries it had, so entry indices and the message cache are unchanged.

`src/tui.ts` renders it through `welcomePreamble(columns)` — the same memoized
`TuiDocumentRenderer` pass as before, now returning `RenderedRow`s with both `ansi` and a
plain `text` (selection and copy read `text`). Every layout call site passes it, so the
render, the transcript screen, selection anchors, copy and the scroll total all agree.

## Validation

- `test/tui-welcome.test.ts` 7/7: the dark and light arts, the owl glyphs in both theme
  families, no row wider than 58 cells in any variant, the grey-white palette in all six
  themes, the starless light art, the Apple variant, and the compact branch.
- `test/tui.test.ts` gains `the startup header stays in the log and scrolls with it`:
  the header is row 0 at startup, still row 0 after an entry is appended, scrolled off
  after enough output, and back at row 0 after wheel-up. Existing selection, copy,
  scroll and highlight tests carry the header's rows in their coordinates.
- Full suite 2683/2683 (118 suites), `npm run check` and `npm run build` clean.
- Compiled PTY (`dist/cli.js`, private HOME/XDG/userDir/workspace, unreachable loopback
  gateway, `--no-inherit-gateway`, 40x100, driver
  `/Users/mant1ssa/.claude/jobs/c9c17d97/tmp/owl-probe.mjs`): the header draws at row 0,
  survives typing, survives three `/help` runs until it scrolls off, and returns to row 0
  on wheel-up; the emitted SGR carries `38;2;240;240;240` and `38;2;60;60;60` and no
  `38;2;215;119;87`; the session exits 0 and no provider request is issued.

Raw samples stay unchanged; no recovered entrypoint is executed.
