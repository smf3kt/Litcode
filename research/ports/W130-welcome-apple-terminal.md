# W130 — Apple Terminal welcome art

W129 ported the generic startup header and recorded that the recovered `V` variant was left out.
On macOS in Apple Terminal the source selects `V` instead, so the first frame still differed from
the recovered app. This package ports `V`.

## Source position

- `V` (chunk-9c78dh5n.js, immediately after `Hee` in [960,15899), zero-based UTF-16 code units).
  Props are the theme and the welcome message. The branch order repeats `Hee`: light themes use
  the light body, every other theme uses the dark body.
- Light body: the first 12 rows are the generic light art; row 13 is the plain
  `▒▒░░▒▒      ▒ ▒▒` row; rows 14-16 draw the clawd with quarter blocks `▗`/`▖` and a
  `clawd_body` background on the inner run and nine background spaces for the belly.
- Dark body: the first 12 rows are the generic dark art; row 13 is 54 spaces, a dim `*` and three
  spaces; rows 14-16 mirror the light body but add the dark art's bold star.
- The body rows use `color: clawd_body` on the quarter blocks, and
  `color: clawd_background` with `backgroundColor: clawd_body` on the inner run so the face reads
  as a filled band in a real terminal.

## Port

- `src/tui-welcome.ts` gains `appleArt`, `appleLightArt` and `appleDarkArt`. Both reuse the first
  12 rows of the already-ported generic art and replace the body with `V`'s four rows; the
  quarter blocks are `▗` and `▖`.
- `WelcomeProps.appleTerminal` selects the variant. `TuiOptions.termProgram` carries
  `TERM_PROGRAM`, `renderWelcome` sets `appleTerminal = termProgram === "Apple_Terminal"`, and the
  render cache key includes it. `src/cli.ts` passes `process.env.TERM_PROGRAM`.
- The direct equality matches the recovered terminal detector for this branch: it returns
  `TERM_PROGRAM` when that variable is set, so `Apple_Terminal` reaches `V` and `tmux`, `vscode`
  and other programs do not.

## Verification

`test/tui-welcome.test.ts` adds an Apple Terminal case for both themes: 16 rows, a quarter-block
body, and no generic `██▄█████▄██` body. Focused TUI/terminal tests 76/76, tsc 0, build 0,
notices 0, source index unchanged, identity `21ac3022…`.

A fresh tmux PTY at 120x40 with `TERM_PROGRAM=Apple_Terminal` shows the source dark rows and the
`▗`/`▖` body; the same PTY without that variable still shows the generic art.
