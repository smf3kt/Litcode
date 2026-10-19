# W204 the undo push's immediate/continuous gesture

Status: implemented locally on `work/w43-choice-preview`. Follows W203. No push, no
upstream calls.

## Request

Loop prompt 「继续完善tui，直到搬运剩余还没做的的功能的tui显示」, next item in
`.audit/tui-remaining.todo.md`: 「W204 Vim immediate/continuous gesture and `editRelay`
consumers.」

## Recovered source

- `chunk-24k7d6mw.js`, sha256
  `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`: the undo push `tx`
  [829348,829655) — the recovered symbol `Du`; its component-level bindings `ss = Ww()`,
  `Xn = Dh()` at 819236, `Er = R(!1)` at 819252 and `ds` [819278,819346); `Ww` (the Vim mode
  store) [299598,299622) and `Dh` (the editor-mode gate) [747530,747580).
- `chunk-f37m98yh.js`, sha256
  `207b107a452d54c816419d533bc258f2c8567f8ccfc255cebc390160bb4c900d`: the image-paste insert
  `Pw` and its `continuesGesture` payload at 841210-841625, and the multi-file fan-out that sets
  `continuesGesture: pe > 0` at 51744.
- `chunk-k0f477m1.js`, sha256
  `2c89d198bcc1bc7db4efcd69212bc5fddb7c440bc1472156041b639182da01a9`: `x_`, `sI`, `BEe`,
  `Jgt` and `J1o` [615,1100), the input-mode helpers the BFt branch reads.

Coordinates are zero-based UTF-16 offsets.

**The push** (`tx`, recovered as `Du`):

```js
tx = (rh, jp, ry, cS) => {
  if (M.mode !== lf.current) { if (af(), rh !== M.value) return; lf.current = M.mode }
  let YA = !cS?.continuesGesture && Xn && (ss !== "INSERT" || !Er.current);
  Lv(rh, jp, ry, { immediate: YA });
  Er.current = Xn;
}
```

- `lf = R(kn)` holds `kn = UC = h => h.mode`, the editor mode; the first push after an editor-mode
  switch clears the undo buffer, and is dropped unless it carries the text already in the draft.
- `Xn = Dh()` is `settings.editorMode === "vim"`; `ss = Ww()` is the Vim mode string.
- `Er` is a component-level ref: the FIRST push of a Vim INSERT run is immediate, every later push
  in that run goes through `due`'s 1000 ms debounce and coalesces; a NORMAL-mode push is always
  immediate; with Vim off every push coalesces.
- `ds` (`setVimMode`) writes `Er.current = false`, so leaving or entering a Vim mode ends the run.
- `cS?.continuesGesture` comes only from the composer's image paste: `Pw` records the insert into
  the relay with no key, and a multi-file paste marks every image after the first as a continued
  gesture so the whole drag is one undo step.

## Port

`src/terminal.ts`: `EditorPolicy.undoPush` is the owner's push. `reduceEditorWithUndo` calls it
instead of `undo.record` when supplied, handing it this product's recorded adaptation that the
Return newline conversion is its own snapshot (`W44-return-evidence.json`, `adaptation.undo`).

`src/tui.ts`: `pushUndo` is `tx`. It baselines on `vimEnabled`, clears and drops on a mode switch,
computes `immediate` as `ownSnapshot || (!continuesGesture && vimEnabled && (vimMode !== 'INSERT'
|| !undoGesture))`, and sets `undoGesture = vimEnabled` after each push. Every composer push now
goes through it: the reducer path (via `undoPush`), the Vim `change` bridge, the external-editor
refold (`ownSnapshot`, the second recorded adaptation), history recall and leaving history search.

`src/tui-vim.ts`: the mode setter is now a single `setMode` that fires `onModeChange` on a real
change; `TuiTerminal` binds it to reset `undoGesture`, which is the source's `ds`.

## Verification

- `test/tui.test.ts` gains 「the undo push treats a Vim INSERT run as one continuous gesture」:
  with `editorMode: 'vim'`, one undo after an INSERT run of `pqr` returns the empty draft, and once
  the run's snapshot has landed a mode switch opens a new run whose first push is its own snapshot.
  Both assertions fail on the pre-port tree (`'ab' !== 'abc'`) and pass after.
- Compiled `bin/personal-harness.mjs` at 90x30 with `settings.json` `{"editorMode":"vim"}`: `pqr`,
  Esc, `u` leaves the composer empty; with `{"editorMode":"normal"}` the same keys leave `pqru`.
  This shows the contract, not the delta: the pre-port tree already coalesced ordinary typing
  (only Return was immediate), so the compiled probe reads the same before and after.
- `npm run check` clean, `npm run build` clean, full suite 2742/2742 (118 suites).

## What the scout found and what stays out

Four independent searches over the recovered bundle settled the scope:

- The Vim command table and its pending state machine (`chunk-qh0w98pn.js`, sha256
  `a6f4555b23f747a11e952695c27895a1f2c76e2cf92396754242e9c23fdd8472`, `si` [24855,25898),
  `ir` [24470,24851), `Uo` [25899,26823), `Do` [26823,27189)) are already copied in full; the
  port's pending command survives across key events. "Immediate/continuous" never described the
  Vim parser, so nothing there was missing.
- The relay host is fully wired (`read`, `commit`, `carry`, `paint`, `report`) at `src/tui.ts`.
  `chunk-6ejn7q9s.js` (sha256 `e652d11d8941d479b41f93f296877a1bc0544c549ddd6b9999f681192effbfee`,
  `YHo` [121977,122681), `or` [121674,121977)) only forwards the decorations a `prompt.edit` hook
  returns; the product consumes them through `PaintedDecorations`.
- Not ported, and recorded here: BFt's prompt→bash mode switch
  (`chunk-f37m98yh.js` `Yt` [46442,48081), branch [47974,48062), `qe` read at 48659). Typing `!` at
  the start of an empty prompt inserts the marker, moves the caret before it and suppresses that
  one keystroke from the relay. The product has no input-mode concept and no shell-execution lane,
  so porting the marker alone would change what `!` means without anything to run; it stays out
  with the composer image paste that supplies `continuesGesture`. `pushUndo` already carries the
  `continuesGesture` parameter, so both producers can be added without touching the push.
- The editor-mode baseline branch of `tx` is ported but has no dedicated test; the two assertions
  above cover the gesture derivation.
