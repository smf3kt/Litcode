# W205 the footer's permission-mode chip

Status: implemented locally on `work/w43-choice-preview`. Follows W204. No push, no
upstream calls.

## Request

Loop prompt 「继续完善tui，直到搬运剩余还没做的的功能的tui显示」, next item in
`.audit/tui-remaining.todo.md`: 「W205 footer service branches beyond the current port.」

## What was there

The product's footer was one hand-built string: `ready`/`running`, the Vim mode, the transient
status text, and a right-aligned hint list. The recovered footer `LVe`
(`chunk-24k7d6mw.js` 762242) is an indicator row: a permission-mode chip, task, agent, IDE,
artifact, voice and feedback indicators joined by ` · `, plus one right-hand hint chosen by the
`Ei` priority chain.

## Recovered source

- `chunk-3cynezh1.js`, sha256
  `c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3`:
  the mode glyphs `jbe`/`lut` at 65901; the descriptor table `ur` [69464,70196); `Pt` (70231)
  and its accessors `Y$`/`o9e`/`bD` [70773,70880); `cPs` [70583,70632).
- `chunk-24k7d6mw.js`, sha256
  `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`:
  the chip `DR` [628129,628675); the footer `LVe` (762242) with its chord lookups
  `co = us(KR(), "Chat", "shift+tab")` (762826) and `Bn = us("chat:cancel", "Chat", "esc")`
  (763439), the chip gate `ji = !!zr && La` (765024), the `Ei` priority chain
  [765142,766700) and the chip's placement `let Rs = ji && zr ? … : null` (766685).

Coordinates are zero-based UTF-16 offsets.

**The chip** (`DR`):

```js
function DR(h){
  let {mode:T,bare:M,children:L}=h;
  he=bD(T); we=o9e(T); Te=[we," "]; Me=Y$(T); const Le=M?"":" on";
  return [symbol+" ", indicator, " on", children]  // coloured by `he`
}
```

The descriptor table supplies the indicator text, the glyph and the theme slot:

| mode | indicator | glyph | slot |
|---|---|---|---|
| `default` | `manual mode` | `⏸` | `inactive` |
| `plan` | `plan mode` | `⏸` | `planMode` |
| `acceptEdits` | `accept edits` | `⏵⏵` | `autoAccept` |
| `bypassPermissions` | `bypass permissions` | `⏵⏵` | `error` |
| `dontAsk` | `don't ask` | `⏵⏵` | `error` |
| `auto` | `auto mode` | `⏵⏵` | `warning` |

**The right-hand hint** (`Ei`) is a priority chain; only two of its branches have data in this
product: `Me` (a turn is running) takes `Ei="interrupt"`, rendered as
`chord + " to interrupt"` with the chord read from the keymap, and the chip branch
`ji && ys && co !== ""` renders `(shift+tab to cycle)`. Warm-up, team-lead, artifacts, tasks,
agents, voice, IDE and feedback branches all read stores this product does not have.

## Port

`src/tui-footer-source.ts` copies the descriptor table and the accessors under their source names
(`Pt` becomes `modeDescriptor`, `Y$`/`o9e`/`bD` become `modeIndicator`/`modeSymbol`/`modeColorSlot`)
and reproduces `DR` as the string builder `modeChip`, because the product's footer is a string row
rather than a React tree. `externalMode` maps this product's internal `bypass` spelling to the
table's `bypassPermissions`; `ask` has no descriptor and lands on `Pt`'s own `ur.default` fallback.

`src/tui.ts` reads the mode from the bound session
(`effectivePermissionPolicy(session.config.permissions, session.permissionUpdates)?.mode`) in
`bindStatusLine`, repaints on `session.subscribePermissions`, and unsubscribes on `close`.
`statusRow` became `statusFooter`, which returns the chip as its own footer part and keeps the
existing left/right padding math on visible cell widths, counting the ` · ` the footer's `Se`
component inserts. While a turn is running the right hint becomes
`${chordForAction('app:interrupt','Global','ctrl+c')} to interrupt`, the `Ei` interrupt branch
with this product's own keymap.

`src/tui-keys.ts` gains `chordForAction`, the source's `us` lookup with a fallback.
`src/tui-renderer.ts` gives `renderChat` a `FooterPart` type so a part can carry a theme slot;
string parts keep the dim styling.

## Verification

- `test/tui.test.ts` gains 「the footer leads with the permission-mode chip and answers a running
  turn with its chord」: a session configured with `permissions.mode = 'plan'` renders
  `⏸ plan mode on`, `setRunning(true)` renders `ctrl+c to interrupt`, and
  `adoptPermissionUpdates([{type:'setMode',mode:'acceptEdits',destination:'session'}])` repaints
  the chip to `⏵⏵ accept edits on`. The test fails before the port (no chip in any row) and passes
  after.
- Compiled probe `.audit/w205-footer.mjs` at 90x30 with workspace settings
  `{"permissions":{"mode":"plan"}}`: the pre-port build prints `footer chip: false`, the post-port
  build `footer chip: true`, with the row reading
  `⏸ plan mode on · ready  session: … ctrl+o transcript  ctrl+r search  ctrl+c inte`.
- 64/64 in `test/tui.test.ts`, full suite 2743/2743 (118 suites), `npm run check` and
  `npm run build` clean.

## Adaptations and what stays out

- The chip is a footer part painted in its descriptor's theme slot; the source paints the same
  slot through `DR`'s `color` prop.
- The source's cycle hint (`(shift+tab to cycle)`) is not rendered: this product binds no
  `chat:cycleMode` action, so advertising the key would be false. The interrupt branch is
  rendered because `app:interrupt` is bound.
- `? for shortcuts` is not rendered: the product has no shortcuts overlay behind it. The idle
  hint list stays the product's own.
- The task, subagent, background-task, IDE, artifact, voice, retention, PR and feedback
  indicators have no local source and stay unported; `WVe` (`N background`) needs the TUI to
  observe `src/background.ts`, which it does not today.
