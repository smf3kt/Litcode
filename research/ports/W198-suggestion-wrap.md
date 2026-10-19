# W198 suggestion description wrap and the row-based window

Status: implemented locally on `work/w43-choice-preview`. Follows W197. No push, no
upstream calls.

## Request

Loop prompt 「继续完善tui，直到搬运剩余还没做的的功能的tui显示」, next item in
`.audit/tui-remaining.todo.md`. W197 left the row a single line; the source gives a row a
second line when its description does not fit, and measures the list window in rows rather
than in suggestions.

## Recovered source

`extracted-v2/modules/chunk-qfjvvwpv.js`, sha256
`116de8fc147859476928cc4bb1a0c61d1a54b1373f46eb01bfee91349e1b2504`. Zero-based UTF-16
offsets: `go` 2434, `ho` 2779, `iEe` [8770,10298), `_t` 10314, `ee` 10529, `No` 10599,
`_o` 10835, `Ue` 11088.

**Row height** (`_o`): one line when the suggestion has no description, or when the
description fits beside the lanes; two lines otherwise. The check is on the collapsed
description — `xt = /\s+/g`, so every whitespace run becomes one space before it is
measured or split.

**The split** (`Ue`): cut at the first line's cell budget; if the remainder begins with a
space, that space is the break; otherwise fall back to the last space in the head; if there
is none, break mid-word.

**The continuation line** (`ze`): indented to `j + tagWidth + laneWidth + sourceWidth`,
where `j` is the description column, and cut to `columns - indent - 4`. So the tail lines up
under the description, not under the command name.

**The window** (`iEe` and `go`): the list's budget `M` is a count of **rows**
(`Math.max(1, Math.min(Math.max(6, Math.floor(R / 2)), R - 3))`), and `iEe` grows the
window while the summed heights fit in `M`. `go` anchors the window at the previously kept
start, re-anchors it forward when the selection has passed its end, backward when the
selection is above its start, then extends upward while rows remain.

## Change

`src/tui-autocomplete.ts`:

- `suggestionRowHeight` ports `_o`; `splitDescription` ports `Ue`; `collapsedDescription`
  ports the `xt` collapse.
- `suggestionRowWindow` ports `go` and the window half of `iEe`; `suggestionRowOwners`
  returns the suggestion index behind each drawn line.
- `suggestionRowSegments` now emits one entry per drawn line, with the continuation
  indented under the description. It takes an optional `maxColumnWidth` and `heightOf` so
  the caller can share the heights it already computed for the window.
- `suggestionMaxColumnWidth` is the widest row plus five, the value `iEe` passes down.
- `suggestionWindow`, the count-based window W190 adapted, is removed: the row-based
  window supersedes it and nothing else called it.

`src/tui.ts`: the band carries `owners`, a suggestion index per drawn line, so
`autocompleteRowAt` resolves a click through the map instead of assuming one line per
suggestion. A click on a continuation line selects the suggestion it belongs to.

## Validation

- `test/tui-autocomplete.test.ts` 16/16. New: the description wraps under its own column at
  60 columns and each row spends two of the window's rows; the row height is one at 100
  columns where every description fits; the window stays inside its row budget and
  re-anchors when the selection passes it. The `suggestionWindow` assertions are replaced
  by the `maxVisibleSuggestions` budget they were really covering.
- Full suite 2686/2686 (118 suites), twice consecutively, `npm run check` and
  `npm run build` clean. One earlier full run showed a single failure in
  `test/async-hooks.test.ts:375`; that file passes 17/17 three times in isolation and both
  later full runs are clean, so it is a flake under the parallel run, not this change.
- Compiled PTY probe at 64x40 (`LC_ALL=en_US.UTF-8`): `/mo` draws
  `❯ /model           config Choose or enter a model, then` with
  `                          start a session with completed his` beneath it, the next row's
  continuation lines up the same way, and a click on the continuation line fills the
  composer with `/model` — the owner map resolving a wrapped line to its suggestion.

Raw samples stay unchanged; no recovered entrypoint is executed.
