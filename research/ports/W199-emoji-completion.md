# W199 `:name:` emoji completion

Status: implemented locally on `work/w43-choice-preview`. Follows W198. No push, no
upstream calls.

## Request

Loop prompt 「继续完善tui，直到搬运剩余还没做的的功能的tui显示」, next item in
`.audit/tui-remaining.todo.md`: the `emoji:` suggestion id family, its own row branch in
the row renderer, and the `emojiCompletionEnabled` setting.

## Recovered source

`extracted-v2/modules/chunk-24k7d6mw.js`, sha256
`1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`. Zero-based UTF-16
offsets: `H0e` [558112,558600) builds the rows, `B0e` [558169,558203) resolves one name,
`rse` 566121 the popup trigger, `KDt` 566153 the completed-shortcode trigger, `GDt` 566183
the guard on the inline replacement, `tE` 568396 the popup's accept, `zre` 558020 the
name map, `RDt` 558060 the ordered names, `xDt` 558096 the row cap.

**The name map** (`zre`): the short names first, then every alias whose target exists and
which is not itself a short name, so an alias never shadows a real one. `RDt` keeps the
insertion order, which is the tie-break inside one name length.

**The rows** (`H0e`): names containing the query, prefix matches before the rest, then the
shortest name; at most twenty rows; each row is `emoji:<name>` with the glyph as its
display text and `:<name>:` as its description. There is no lane, so the row draws the
blank lane `_t` produces for an undefined lane.

**The two triggers.** `rse` opens the popup on `:partial` at the end of the text before
the cursor, at least two characters. `KDt` is the inline one: a keystroke that completes a
known `:name:` replaces the whole shortcode with its glyph and no trailing space. `GDt`
confines that to the single edit that completed it — the edit must have removed something,
the text with the removed span deleted must equal the previous draft, and the removed span
must itself match `[a-z0-9_+-]*:`. A paste of the whole `:rocket:` in one edit removes
`:rocket` (no trailing colon) and so fails the guard, which is the source's behaviour.

**The accept** (`tE`): the popup's accept rewrites `:partial` as the glyph plus one space,
and reports false when the draft no longer matches. It never submits.

## Change

- `src/tui-emoji-data.ts` (new, generated): `EMOJI` (1566 names) and `EMOJI_ALIASES` (46),
  emitted from `zre` by `$CLAUDE_JOB_DIR/tmp/gen-emoji.mjs` in source order.
- `src/tui-emoji.ts` (new): `GLYPHS` and `NAMES` port `zre`/`RDt`; `emojiSuggestions` ports
  `H0e`; `emojiGlyph` ports `B0e`; `EMOJI_QUERY` ports `rse` and `EMOJI_COMPLETED` ports
  `KDt`; `acceptEmojiQuery` ports `tE`; `inlineEmojiCompletion` ports `KDt` with the `GDt`
  guard.
- `src/tui-autocomplete.ts`: `CommandSuggestion.kind` gains `'emoji'`, and `lane` becomes
  optional so an emoji row carries none. `emojiRows` adapts `H0e` onto the local row shape
  and returns `undefined` when the draft is not a partial, so the caller falls through.
- `src/tui.ts`: `autocompleteState` tries the emoji rows first and falls through to
  `commandSuggestions`, which is the source's check order and leaves a slash draft alone.
  `acceptAutocomplete` gains the emoji branch (`tE`) before the command branch. The reducer
  transition runs `inlineEmojiCompletion` on every keystroke before anything else reads the
  draft. New `emojiCompletionEnabled` field, default true, with a `setEmojiCompletion`
  setter.
- Setting plumbing for `emojiCompletionEnabled`, in the order the other TUI settings use:
  `src/session.ts` (`SessionConfig` and the zod schema), `src/runtime.ts`
  (`ParsedRuntimeSettings` and `parseSettings`), `src/cli.ts`, `src/reload.ts`,
  `src/terminal.ts` (`TerminalSurface.setEmojiCompletion`), `src/interactive.ts` (the
  setter call beside the other terminal settings).

## Validation

- `test/tui-emoji.test.ts` (new, 5 tests): table and alias resolution including the
  no-shadowing rule, the prefix-first ranking, the twenty-row cap, `acceptEmojiQuery`
  including the cursor and two-character guards, and `inlineEmojiCompletion` including all
  four `GDt` rejections.
- `test/tui-autocomplete.test.ts` 18/18. New: typing a colon opens the emoji list and Enter
  inserts the glyph without submitting; a completed shortcode is replaced inline and a slash
  draft still lists commands.
- `npm run check` and `npm run build` clean; full suite 2693/2693 (118 suites).
- Compiled PTY probe at 100x40 (`LC_ALL=en_US.UTF-8`). `:roc` draws five rows with the
  pointer on the first, `❯ 🚀 :rocket:`, then `:morocco:`, `:broccoli:`, `:shamrock:`,
  `:crocodile:` — prefix match first, then shortest name, and no lane column. Enter yields
  `❯ 🚀 ` and submits nothing. Typing `:rocket` and then the closing colon yields `❯ 🚀`.
  Sending `:rocket:` as one chunk leaves `❯ :rocket:`, which is the `GDt` guard behaving as
  the source specifies rather than a defect.
- Second compiled PTY probe with `--settings` carrying `emojiCompletionEnabled: false`:
  `:roc` draws no band, Enter submits `:roc` as a prompt, and `:rocket` plus `:` stays
  literal. Both triggers are gated by the setting.

Raw samples stay unchanged; no recovered entrypoint is executed.
