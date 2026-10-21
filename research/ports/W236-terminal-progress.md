# W236 Config terminal progress bar

Status: implemented and verified locally, 2026-10-21. Local only; no push, no paid calls.

## Task card

- Entry is the remaining local Config "Terminal progress bar" row behind the slash composer.
- Outcome requires the terminal's OSC 9;4 indicator to appear while the agent runs, clear when idle,
  persist, apply live, survive restart and stay silent when disabled or unsupported.
- Reuse the existing settings queue, successor-session application and agent progress events.
- Validate the compiled CLI, character-exact sequences, source ranges and independent review.
- One lead writer. Account/network/OAuth, paid upstream calls and push stay excluded.

## Baseline

At 52ab78d the Config panel lists eleven rows and has no progress row; the compiled CLI never emits
an OSC 9;4 sequence around a turn. The recovered tree exposes the row after Verbose, defaults it on
and writes the indicator from a terminal-write provider mounted beside the transcript.

## Source gate

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Every range is zero-based UTF-16 code units, half-open. Static Acorn reads verify each module against
extracted-v2/manifest.json. Recovered application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-nybcbd9t.js | 0abe0d704940977466d81c1efab7f953d8f9dac0f30cd758c4a3d0286b5c1bca | row progressBar [20202,20454), onChange writes terminalProgressBarEnabled |
| chunk-3gz7s57c.js | 9d44818f1c5a17e8ddddbce66694eab43a75e489d8afbeaf0369756daf2e378b | om [138656,138739), y0 [138878,138941), qa [138941,139637) |
| chunk-z7whhrje.js | imported writer provider | s7e [3953,4315), progress writer p [8457,8902) |
| chunk-kexg5hxg.js | OSC framing | gh [8412,8488), OI [8488,8667), Yp 13634, Ekt 15837, vkt 15871 |
| chunk-yn0pfn70.js | 1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f | PH/nG/Y9e/CZ 1154-1199, ESC/OSC/BEL framing |
| chunk-bk5ct2gw.js | efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1 | settings defaults used by the row snapshot |

The row value is `terminalProgressBarEnabled`; its `onChange` writes the user setting and updates
the live snapshot. `y0` resolves the live value with default true. `om` returns null when disabled,
`indeterminate` while the turn loads or tools or background work are active, and `completed` when
idle. `qa` calls the terminal writer on each state change and clears on unmount. The writer gate
`s7e` accepts non-TTY as false, rejects Windows Terminal, accepts ConEmu, and accepts Ghostty
1.2.0+ or iTerm2 3.6.6+ by `TERM_PROGRAM_VERSION`. The writer maps CLEAR 0, SET 1, ERROR 2,
INDETERMINATE 3 into `ESC ] 9 ; 4 ; code ; [pct] BEL`, clamping percentages to 0..100; tmux and
screen wrap the sequence in their passthrough guard with doubled ESC bytes. No recovered caller
emits `running` or `error` for an agent turn, so the host writes indeterminate and clear only.

## Adaptations and ownership

`src/terminal-progress.ts` is a direct port of the gate, mapping, framing and mux wrapper.
`TuiTerminal` owns one write path: `setTerminalProgress` records the state and emits only when the
row is enabled, the output is a TTY and the gate accepts the terminal; duplicate sequences are
skipped, so a start/complete pair writes exactly two. Agent `progress` start/finish events, already
bound to the spinner, now also select indeterminate and clear; the host has no background-work
branch, and the source's loading/tools states both fall inside the turn's progress lifetime.
Disabling through Config or `/reload` clears an indicator already written; enabling while a turn
runs re-asserts indeterminate. `close` clears once if anything had been written, matching `qa`'s
unmount cleanup, then the alternate screen is restored. `SessionConfig` carries the authored boolean;
fresh startup and reload resolve absence as true; the Config row lives after Verbose with label
"Terminal progress bar"; persistence writes the source key through the per-file queue; successor
sessions apply the value to the live surface. Unknown or unsupported terminals write nothing.

## Throughput

One bounded independent reader checked the gate, framing and lifecycle against the cited ranges.
One lead writer owns all product changes. The compiled acceptance drives the real CLI under a PTY
with `TERM_PROGRAM=iTerm.app` and `TERM_PROGRAM_VERSION=3.6.6`.

## Validation

- `npm run check` and `npm run build` pass.
- 89 affected tests pass across terminal-progress, config-panel, tui, focus-command and
  tui-tool-result.
- Full suite: 2981 tests, 2980 pass. The single failure, CLI effort flag overrides environment,
  remains the pre-existing W231 divergence reproduced at HEAD5717eb9; recorded in question.md.
- Compiled acceptance `.audit/w236-progress.mjs`: 10/10 checks at identity
  6586b1f38451f4f416efb955d45b77e519c1d667e23d01f6577e70313232200f. It covers: the row present
  and defaulting true; an active turn writes indeterminate and the idle transition writes clear;
  toggling false persists `terminalProgressBarEnabled` beside authored keys; a disabled turn writes
  no OSC 9;4; re-enabling while idle writes the source idle clear and the next turn writes the
  indicator; a fresh CLI restores false and stays silent; an absent key resolves on and writes the
  indicator; every CLI exits zero.
- Independent review confirmed the framing, gate, row placement, persistence and lifecycle, with
  no high or medium findings. Its low findings are closed: `null` now takes the source's clear arm;
  the gate uses the output stream's TTY; enabling idle writes the recomputed clear; version parsing
  mirrors `semver.coerce`; and the live row re-reads the merged setting so higher layers win.
