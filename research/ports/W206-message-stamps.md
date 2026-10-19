# W206 the message stamp and its clock

Status: implemented locally on `work/w43-choice-preview`. Follows W205. No push, no
upstream calls.

## Request

Loop prompt 「继续完善tui，直到搬运剩余还没做的的功能的tui显示」, next item in
`.audit/tui-remaining.todo.md`: 「W206 time widgets and the remaining timestamp consumers.」

## What was there

`src/tui-progress-time.ts` already carried the turn-duration formatter (`EXe`) and the
`timeFormat`/`timeZone` resolver (`w_t`), but not the two message clocks. The product had no
`showMessageTimestamps` setting at all, and no transcript entry carried an arrival time.

## Recovered source

- `extracted-v2/modules/chunk-3gz7s57c.js`, sha256
  `9d44818f1c5a17e8ddddbce66694eab43a75e489d8afbeaf0369756daf2e378b`:
  the full clock `zd` [128693,128934); the stamp gate `Os` [128934,129659); the message wrapper
  `Va` [129659,130231); the short clock `sb` [130231,130328).
- `extracted-v2/modules/chunk-7d9mja9n.js`, sha256
  `f2ec68dd9f326a4052e48c8127d93c9c99db0deed2faa0672978a7667331d5bb`:
  the strftime body `P` [1152,2439); the clock presets `L` [3905,4031); the short formatter
  `fKo` [4031,4139); the full-date preset `E` [4139,4278); the full formatter `mKo`
  [4278,4665).
- `extracted-v2/modules/chunk-3cynezh1.js`, sha256
  `c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3`:
  the setting key at 273990, `showMessageTimestamps: () => H().optional()
  .describe("Stamp each message with its arrival time")`.

Coordinates are zero-based UTF-16 offsets.

**The gate** (`Os`, called as `Os(message, isTranscriptMode, showMessageTimestamps,
isSplitUserContinuation)`):

```js
function qd(l){if(l.type==="attachment"&&l.attachment.type==="queued_command")
  return l.attachment.timestamp??l.timestamp;return l.timestamp}
function Os(l,u,m,f=!1){
  if(!qd(l))return!1;
  if(l.type==="attachment"){ /* queued commands only; origin/meta/blank-prompt rules */ }
  if(l.type==="assistant")return(m||u)&&l.message.content.some(h=>h.type==="text");
  if(l.type==="user"){
    if(!m||l.isCompactSummary||f)return!1;
    let h=l.message.content[0];
    if(h?.type==="image")return!0;
    if(h?.type!=="text"||typeof h.text!=="string")return!1;
    return!kLo(l,h.text);
  }
  return!1;
}
```

So the transcript viewer stamps both user and assistant messages; the live chat screen stamps
only assistant messages, and only with the setting on. The setting does not add user stamps to
the chat screen.

**The renderer** (`Va`) picks the clock by the setting and paints it dim:

```js
let E = T ? zd(L) : sb(L);      // T = showMessageTimestamps
W = e(n,{dimColor:!0,children:E});
j = e(_,{minWidth:D,children:W});   // _ = s, a box with the stamp's measured width
```

`zd` is `mKo(w_t(), date, AWe(), u)` and `sb` is `fKo(w_t(), date, AWe())`; `Va` passes no
fourth argument, so the optional timezone fallback `o` is always undefined.

## Port

`src/tui-progress-time.ts` adds `fKo`, `mKo`, the preset tables `L`/`E` and the strftime body
`P`, copied verbatim; the copied `P` calls the module's existing date helper, so the source's
one-letter `d(...)` was renamed `dl(...)` to avoid colliding with the module's `const d`.

`src/tui-progress-settings-source.ts` returns `short` and `stamp` next to `format`, with the
same `w_t()`/`AWe()` inputs the source uses.

`src/tui-transcript.ts` gives `TranscriptEntry` a `timestamp` in epoch milliseconds.
`src/tui.ts` stamps an entry at arrival in `append()` (and at `assistantMessage` creation);
`entryStamp` reproduces `Os` for this product's six entry kinds, and `renderEntryRows` prepends
the stamp row outside the body, using the markdown renderer for markdown/duration entries and
the built-in wrapper for plain ones. `wrapEntryRows` routes a timestamped entry through the
host renderer so that row can exist at all; the plain branch calls the same built-in wrapper,
so its rows are unchanged. The setting flows from the settings file through `src/runtime.ts`,
`src/session.ts` (`showMessageTimestamps: z.boolean().optional()`), `src/cli.ts`,
`src/reload.ts` and `src/interactive.ts` into `TuiOptions.showMessageTimestamps` and
`TerminalSurface.setShowMessageTimestamps`.

## Verification

- `test/tui.test.ts` gains 「the message stamp follows the showMessageTimestamps setting and the
  transcript screen」: with `progressSettings: {timeFormat:'24-hour', timeZone:'UTC'}` and a
  fixed `Date.UTC(2026,0,2,15,45,30)`, chat mode off shows no stamp; the setting on shows one
  full `2026-01-02 15:45:30 UTC` row (the assistant message only); turning it off removes it;
  `ctrl+o` into the transcript screen shows two short `15:45` rows and no full stamp. The test
  failed before the port and passes after.
- Two existing tests were updated because the ported behaviour changes their coordinates, not
  to fit the implementation: the transcript scroll offsets move by one row per assistant
  message (14→34, 15→35, 9→29), and the cross-screen click test targets the message row one
  row below the screen's new stamp. Both are the source's transcript stamp, not a product
  invention.
- The settings-parse branch gains `showMessageTimestamps` true/false assertions next to
  `showTurnDuration`.
- 65/65 in `test/tui.test.ts`; full suite 2744/2744 (118 suites); `npm run check` and
  `npm run build` clean.

## Adaptations and what stays out

- `Os`'s content checks (image parts, `isCompactSummary`, split user continuations, the
  `kLo` synthetic-text filter) have no analogue: this product's transcript entries are typed
  kinds and its attachments are not entries. The gate reduces to kind + transcript screen +
  setting + non-empty text.
- `Va`'s `minWidth` box has no per-row analogue in the row renderer; the stamp is a plain
  zero-indent row. The dim colour is carried by the row text in the row-based transcript; the
  markdown branch paints the stamp through the document renderer's `dimColor`.
- The `queued_command` attachment timestamp path (`qd`) is not ported: the product's queued
  prompts are not transcript entries.
- Copied transcript rows include the stamp text, because selection copies rendered rows. The
  source's copy affordance is not in this product's transcript, so there is no recovered answer
  to compare against.
- `zd`'s optional timezone argument stays unported because `Va` never passes it.
