# W66 — the hook terminal wrapper through real tmux and screen

## Source position

The recovered wrapper is `OI` in `chunk-kexg5hxg.js` UTF-8 bytes [8488,8667), with mux detection
`K3t` at [7526,7656): tmux and screen both double every ESC inside DCS. The port in
`src/hook-terminal.ts` reproduces that body for the two supported multiplexers; zellij detection
is not ported. `HOOKS.md` recorded the wrapper bytes but not real mux decoding, which this package
adds.

## Verification

`scripts/smoke-hook-mux.mjs` emits the product wrapper from inside a real multiplexer and lets a
second, independent terminal implementation parse the forwarded bytes:

1. an outer `tmux` server runs the case in its pane with `automatic-rename off`;
2. the pane starts the inner `tmux` (`allow-passthrough all`) or `screen`, which runs an emitter
   that calls `formatHookTerminalSequence` with the matching environment;
3. after a startup delay the emitter writes the wrapped OSC 0 with a per-run title;
4. the outer tmux parses the forwarded OSC 0 and reports `#{pane_title}`.

Both muxes decode to the exact title in source and compiled modes. The emitted bytes are hashed in
the smoke output; tmux starts with `ESC Ptmux;`, screen with `ESC P` and doubled ESC inside. This
proves decoding by a real parser, not only that the wrapper bytes were written.

## Crash-safe delivery disposition

Display effects are appended to the session journal before the TTY write
(`src/interactive.ts` drain), and resume preserves the records as data without replaying them. A
crash between the journal append and the TTY write therefore loses at most that display effect; a
crash before the append leaves no journal record and no effect. Exactly-once delivery would need a
terminal acknowledgment the TTY does not provide, so the recorded contract is at-most-once attempt
delivery with no replay, as `HOOKS.md` states.

## Verification totals

Source and compiled mux smokes pass, tsc 0, full 2,090/2,090 at concurrency 2 (host load made the
default-concurrency run time out in unrelated worktree cases; the isolated rerun passed), chain
767/767, notices 0, source index unchanged, identity `bb47c630…`.
