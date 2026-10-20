# W209 the pending dialog keeps the chat frame

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

User report: 「点击model后出现了原始的纯文字显示界面」 — selecting `model` (in the composer's
suggestion list) replaced the whole terminal with a bare text screen: the dialog's own rows and
nothing else, with no transcript, no composer and no footer. The dialog body itself is the
recovered question component; only its *presentation* was wrong.

## What was there

`TuiTerminal.render` drew a pending dialog with `drawFrame(frame, …)` where `renderDialog`
returns exactly `rows` lines. The dialog therefore owned the entire screen: `renderChat` — the
transcript, the composer and the footer — was skipped for the whole time the dialog was up. On a
24-row terminal that is eight content rows over sixteen blank ones, which reads as a plain-text
screen rather than a TUI.

## Recovered source

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | `fF` [135704,137332) | the transcript footer; it renders a `dialog waiting` badge |
| `chunk-24k7d6mw.js` | same | 136157 | the badge literal, `color:"permission"` |
| `chunk-8zgs1qmk.js` | `023321c4663c081a393179a5f1ff9d533af036d7c78c366d2b31ab0657647dcb` | `IIe` [3957,4049) | the badge's gate: `dialogStore.getState().open.length > 0` |
| `chunk-24k7d6mw.js` | same | `f3` [1153793,1159815), `b3` [1159815,1161789) | the question component and the review page |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | 1650764 | `/model` as `{type:"local-jsx", name:"model", immediate:true, requires:{ink:true}}` |
| `chunk-mv5ceh8c.js` | `848c45387f153652fe2bf11fcf85251480e4dc9295d47325c0da3f26b60b3763` | 4703 | `/workflows` as `{type:"local-jsx", name:"workflows", immediate:true}` |

Coordinates are zero-based UTF-16 offsets.

The evidence that a dialog does not own the screen is the badge. `fF` is the *transcript* footer,
and it shows `dialog waiting` exactly while `IIe()` reports an open dialog. That state is only
reachable if the chat screen and its transcript view stay mounted and switchable with a dialog
pending — a full-screen dialog could never show it. The two commands are `local-jsx` panels with
`immediate: true`, which the host renders inside the REPL layout rather than as a screen
replacement. `f3`/`b3` carry no border element of their own (`borderStyle` appears nowhere in the
question or permission modules), so the local borderless body was already faithful; only the
surrounding frame was missing.

## Port

`src/tui.ts`, the dialog branch of `render`:

- the transcript keeps the top of the screen — `transcriptRows = min(rows / 3, rows - 14 - afkRows)`,
  so a small terminal gives the dialog every row it needs and a large one keeps a third for the
  conversation;
- `renderDialog(columns, bodyRows)` now takes the body height it is given instead of deriving it
  from the full screen, and the caller passes `rows - 5 - afkRows - transcriptRows`;
- the composed screen is `[...transcriptRows, ...dialogRows, ...footer]`, exactly `rows` lines, so
  the footer stays on the last row and keeps its permission-mode chip;
- `footerRows(columns)` renders `Tde` through the document renderer, the same element
  `renderChat` uses, so the chip's slot colour survives outside `renderChat`;
- the cursor row is `transcriptRows + frame.length - 2 - afkRows`, unchanged relative to the
  dialog's own answer row.

## Verification

- `test/tui.test.ts` gains `dialogLines(output)` — the dialog's own rows, with the welcome
  lockup and the footer removed — and the twelve title assertions, eight hint/countdown assertions
  and four review-page assertions use it instead of `frame()[0]`/`frame().at(-1)`. 66/66.
- Full suite 2746/2746 (118 suites), `npm run check` and `npm run build` clean.
- Screen dump `.audit/w209-dialog-screen.mjs` at 80x20: welcome lockup rows 0–3, dialog rows 6–18,
  footer row 19.
- Compiled probe `.audit/w209-probe.mjs`: after Enter on `/model` the screen is the welcome
  lockup, `> /model`, the dialog (`Model`, `Current: fixture/probe`, the two choices, the
  separator, `Selected: fixture/probe`, the hint) and the footer
  `⏸ manual mode on · running  session: … ctrl+o transcript …` on the last row. Before the change
  the same probe showed the eight dialog rows and nothing else.

## Adaptations and what stays out

- The recovered host sizes the dialog to its content through Yoga and gives the message list the
  remainder; this terminal composes a fixed frame, so the split is the stated rule above rather
  than measured content height. The dialog's own row accounting (`rows - 4`, the countdown row,
  the separator and the two control rows) is unchanged.
- The `dialog waiting` badge itself is not ported: it belongs to the transcript screen, which this
  product does not render as a separate view in the same sense.
- The composer is not shown while a dialog owns input — the dialog is modal, as before. Only the
  transcript and the footer come back.
