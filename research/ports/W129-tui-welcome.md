# W129 — Startup header

The product's first interactive frame was an empty input box, so the session read as a black box
with no identity or version. The recovered app paints a startup header before the first message.
This package ports that header.

## Source position

- `Hee` (chunk-9c78dh5n.js [960,15899), zero-based UTF-16 code units): reads the theme (`hr`),
  the screen-reader flag (`nt`), and terminal rows (`ke`). Compact when the flag is set or
  `rows < z`; otherwise `Apple_Terminal` gets component `V`, light themes
  (`light`, `light-daltonized`, `light-ansi`) get the light art, and every other theme gets the
  dark art. Constants `A = 58` (art width) and `z = 30` (minimum rows for the art).
- `V` (same module, after the generic art): the Apple_Terminal-specific light/dark art with a
  `welcomeMessage` prop.
- Each art is a `Box` of width 58 and a column child list of 16 rows: a header row
  (`Text color claude` "Welcome to ...", then a dim `Text` "v" + version + " "), a 58-dot rule,
  the ASCII art, and the clawd body rows drawn with the `clawd_body` color and
  `clawd_background` background. Light art uses `░` blocks; dark art adds stars and the comet.
- The compact branch is an outer `Text` holding the colored welcome string and a dim
  `Text` with "v" + version (no trailing space).

## Port

- `src/tui-welcome.ts` exports `Welcome({theme, version, compact})`, `WELCOME_ART_WIDTH = 58`,
  `WELCOME_MIN_ROWS = 30`, and `WELCOME_MESSAGE = "Welcome to LiTcode"`. The compact branch and
  every row of the generic light and dark art are copied in source order, including the inline
  `Text` runs, `dimColor`, `bold`, `color` and `backgroundColor` attributes. Block glyphs are
  written as `█`, `▄`, `░`, `▒` so the source file stays ASCII.
- `src/tui.ts` adds `TuiOptions.version`; `renderWelcome(columns, rows)` renders the element
  through a dedicated `TuiDocumentRenderer`, cached by columns, compact flag, version, theme and
  theme overrides, and closed in `close()`. `render()` substitutes those rows at the top of the
  transcript area only while `transcript.entries.length === 0`; the art is clipped to the
  available region and the rest of the rows stay blank.
- `src/cli.ts` passes `version: cliVersion()` at the interactive call site.

## Adaptation

- The recovered product name is replaced with this product's neutral name, and the build-literal
  version with the version reported by the package.
- The Apple_Terminal `V` variant is not ported; Apple Terminal falls through to the light/dark
  art. The branch difference is styling only.
- The screen-reader flag is the recovered presentation context, which this runtime never
  provides (it is `false`), so the compact branch is selected by terminal rows alone.
- The header is shown only while the transcript is empty rather than as a transcript entry, so it
  disappears on the first committed message and cannot be scrolled back into after output starts.

## Verification

New `test/tui-welcome.test.ts` asserts the 16-row dark art, the starless light art and the
single-line compact branch. Focused TUI/terminal tests 75/75, tsc 0, build 0, notices 0, source
index unchanged (75 chunks, 1743/30144 statements, 323525 units), identity `b86d2a9d…`.

Live PTY checks with a fresh tmux server at 120x40 show the full dark header and art above the
prompt; at 80x24 the frame is the single `Welcome to LiTcode v0.1.0` line; after one submitted
message the header is gone and the transcript starts with the reply. The same run exercised a
real local model call and returned to `ready`.
