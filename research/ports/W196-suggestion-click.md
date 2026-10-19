# W196 the inline suggestion list takes a click

Status: implemented locally on `work/w43-choice-preview`. Follows W195. No push, no
upstream calls.

## Request

「项目里是否实现了workflow等功能，我点击了还是没有反应」. Two questions: is the workflow
feature implemented, and why does clicking produce nothing.

**It is implemented.** `src/workflow.ts` exposes `workflow_run`/`workflow_get` through
`createWorkflowTools`, `src/workflow-script.ts` is the `agent`/`parallel`/`pipeline`/
`phase`/`log` engine, `src/workflow-named.ts` is the named catalog, and `src/runtime.ts:963`
wires all three behind `current.features?.workflow`, which `src/cli.ts` defaults to `true`.
The `/workflows` command in `src/interactive.ts:902` lists the session's runs. Typed and
submitted with Enter it answers `[]` on a fresh session, which is the empty run list, not a
failure.

**The click had no surface.** The composer's slash-command list was keyboard-only. This
package gives it one.

## Recovered source

`extracted-v2/modules/chunk-24k7d6mw.js`, sha256
`1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`. Zero-based UTF-16
code-unit offsets.

`Oi` (the controller's `selectSuggestion`) is defined at offset 590243:

```js
Oi = le((Tn, ls) => {
  if (at.click(ls)) return;
  const _s = _t.getState().suggestions.findIndex((Os) => Os.id === ls);
  if (_s < 0) return;
  Er(_s, h.value, h.cursorOffset);
}, [Er, h, _t, at])
```

A click carries the row's id, resolves it to an index, and calls `Er(index, draft,
cursorOffset)` — the same accept path Tab takes, which fills the draft. It is not the
submit path Enter takes. The renderer passes that callback down as `onSelectSuggestion`
at offset 880167:

```js
Sx = (bx, Cq) => vn.current?.selectSuggestion(bx, Cq)
```

W191 left this surface out because the inline call site it had ported passed no
`onSelect`; the row-id callback above is the one that does.

## Change

`src/tui.ts`:

- `autocompleteBand: { top, first, count }` records where the drawn band sits, and
  `autocompleteWindowStart` records the first suggestion `suggestionWindow` is showing.
  Both are set in `render()` from the same `hintRows` and `progressRows` the frame is
  built from, so the geometry is the drawn geometry.
- `autocompleteRowAt(row)` maps a 1-based screen row to a suggestion index, or `-1`
  outside the band.
- `handleMouse` hit-tests the band on a left press from that geometry, before the
  transcript/selection split, and calls `acceptAutocomplete(false)`.

The placement is the fix, not a detail. `viewportSize()` (`src/tui.ts:1128`) computes its
row budget from the prompt, the three chrome rows, `progressHeight` and the status rows,
and it does not know about the band. On a 40-row terminal it reports 36 transcript rows
while `render()` lays out 29 and draws the band at rows 33-36. A click on a suggestion row
was therefore `inside` the viewport, fell through to `anchorAt`, resolved to no anchor and
returned silently — the reported symptom. Hit-testing the band first uses its exact
recorded rows and does not depend on that approximation.

`acceptAutocomplete(execute)` is unchanged: `execute` stays false for a click, so a
clicked row fills the draft and does not submit, matching `Oi`.

## Validation

- New `test/tui.test.ts` case `clicking a suggestion row fills the draft with that row,
  and a click elsewhere does not`: on a 100x40 terminal, `/work` opens the band, a press
  one row above it leaves the draft at `/work`, a press on the `/workflows` row sets it to
  `/workflows ` and the band closes. Removing the `handleMouse` block makes it fail; with
  it, it passes.
- TUI suite 61/61, full suite 2684/2684 (118 suites), `npm run check` and `npm run build`
  clean.
- Compiled PTY probe (`scripts/pty-cli.exp` + `scripts/terminal-screen.mjs`, 100x40,
  `LC_ALL=en_US.UTF-8`): typing `/workflows` and pressing Enter gives `> /workflows` then
  `[]`; typing `/work` and clicking the `/workflows` row at 1-based row 34 fills the
  composer with `❯ /workflows` and blanks the band.

Raw samples stay unchanged; no recovered entrypoint is executed.
