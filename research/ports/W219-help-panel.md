# W219 `/help` panel

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

Part of the loop that ports the TUI surfaces behind the composer's slash commands. `/help` is
`Show help and available commands`, the next live `local-jsx` registration after `/scroll-speed`,
and the first one whose surface is a whole panel rather than a chooser.

## What was there

`/help` existed as one line of text: the `COMMAND_HELP` block, printed for every session. The
recovered command is a three-tab panel that replaces the flat list whenever a modal surface exists.

## Recovered source

| Module | SHA-256 | Offset | Contents |
| --- | --- | --- | --- |
| `chunk-yehhb8pt.js` | `c0ac0c13483588de94e740c94fa2865a11beb09a7bfb2e9073f44a7211955b7b` | `Do` 16615 | the name comparator |
| ↳ | | `Po` 16668 | the row model |
| ↳ | | `vo` 16741 / `Bo` 16832 | the plain row and the list row |
| ↳ | | `C` 16914 / `U` 17270 | the section and its list |
| ↳ | | `mo` 17950 / `v` 17960 | the tall threshold and the General tab |
| ↳ | | `Uo` 18765 | the builtin predicate |
| ↳ | | `to` 18849 / `so` 18849 | the tall and compact row thresholds |
| ↳ | | `G` 18865 | the panel |
| ↳ | | `De` 21301 | the entry |
| `chunk-24k7d6mw.js` | (the bootstrap chunk) | `e2` 778164 / `Im` 778210 / `hft` 778248 | the chord formatter, its options and the shortcuts table |
| `chunk-qh0w98pn.js` | | `Z0r` 6253 | the newline hint |
| `chunk-0qkpwgr4.js` | | `JD` 4537 | `${chord} to ${action}` behind the `z` component |

The panel:

```js
var mo=44, to=44, so=21;
function Uo(V){ return V.type!=="prompt" || V.source==="builtin" || V.source==="bundled" }
function U(x){ let {commands:m,maxHeight:a}=x, {headerFocused:i,focusHeader:c}=Sy(),
  t=2*Math.max(1,Math.floor((a-10)/2));
  let u=m.filter(dedupe).sort(Do).map(Po); ... e(tn,{visibleCount:t,...}) }
function v(){ let m = rows < mo;
  return [ "Claude understands your codebase, …", !m && "New here? Run /powerup …",
    "Shortcuts" + e(hft,{gap:2,fixedWidth:!0}) ] }
function G(x){ let u = rows>=to && uR(), p = Zft()&&rows<so ? 0 : 1;
  M = commands.filter(c=>Uo(c)&&!c.isHidden); D = commands.filter(c=>!Uo(c)&&!c.isHidden);
  e(sS,{title:"Help",color:"professionalBlue",defaultTab:"general",navFromContent:!0,children:[
    e(Na,{id:"general",title:"General",children:e(v,{})}),
    e(Na,{id:"commands",title:"Commands",children:e(C,{commands:M,title:"Browse default commands"})}),
    e(Na,{id:"custom",title:"Custom commands",children:e(C,{commands:D,
      title:"Browse custom commands",emptyMessage:"No custom commands found"})})]}); }
```

and the shortcuts table's three columns, from `hft`:

```js
e(s,{flexDirection:"column",width:M?24:void 0,children:[ "! for shell mode","/ for commands",
  "@ for file paths","/btw for side question" ]})            // Kt
e(s,{flexDirection:"column",width:M?35:void 0,children:[ "double tap esc to clear input",
  e(z,{chord:je,action:"auto-accept edits",format:Im}), null,
  e(n,{dimColor:!0,children:[Te," for verbose output"]}),
  e(z,{chord:Me,action:"toggle tasks",format:Im}), null, null, go ]})     // ko
e(s,{flexDirection:"column",children:[ e(z,{chord:He,action:"undo",format:Im}),
  Vo, e(z,{chord:xt,action:"paste images",format:Im}), e(z,{chord:Je,action:"switch model",format:Im}),
  On, e(z,{chord:$e,action:"stash prompt",format:Im}), e(z,{chord:_t,action:"edit in $EDITOR",format:Im}),
  kn ]})                                                      // yn
```

## Port

- `src/help-panel.ts` (new): the title and the dismiss notice, the recovered copy
  (`HELP_INTRO`, the `/powerup` pointer, the two browse titles, the custom empty message, the docs
  link, the feedback line), the two thresholds `HELP_TALL_ROWS` (`to`) and `HELP_COMPACT_ROWS`
  (`so`), `HELP_TABS` (`G`'s three `Na` tabs), `isBuiltinHelpCommand` (`Uo`), `helpEntries`
  (`U`'s filter/sort/map over `Po`), `helpVisibleCount` (`U`'s `t`), `helpCompact`/`helpTall`,
  `newlineHint` (`Z0r`), `chordDisplay` (`e2` with the `h9` glyphs the table's chords need),
  `helpShortcutColumns` (`hft`'s three columns), `helpShortcutTable`, `helpCommandRow` (`vo`) and
  `helpCommandRowParts` (`Bo`), `helpTabRow`, `helpTabBody`, `helpFooter`,
  `helpPanelRequest` (`G`'s `sS`) and `browseHelp` (`G`'s navigation).
- `src/interactive.ts`: the `/help` branch opens the panel when a modal surface exists and keeps
  the flat `COMMAND_HELP` for a piped session, which is what the same command does without Ink.
  The command's description is now the recovered `Show help and available commands`.
- `src/tui-autocomplete.ts` and `README.md`: the recovered description and the panel note.

## Adaptations and what stays out

- **The tabs are the chooser's rows.** The recovered dialog keeps `navFromContent`, so a tab step
  does not leave the panel; the local `readDialog` surface is a titled list plus an answer, so the
  three tabs are the rows and `Enter` reopens the panel on the picked tab. `Esc` dismisses, which
  is the recovered `help:dismiss` binding with `Xo`'s pending-confirm arm dropped.
- **The shortcuts table stacks when it does not fit.** `hft` draws 24 + 35 + 35 columns side by
  side; below that width the three columns are printed one after another so no row is lost.
- **The table shows this host's own bindings.** The recovered rows resolve each action through
  `us`/`ma` with a fallback; the local rows resolve through `chordForAction`, so a terminal here
  prints the chords this product actually binds (for example `meta + p to switch model`, not the
  recovered `alt + p`).
- **The newline hint is the conservative form.** `Z0r` picks between a `shift + ⏎` form, a `\⏎`
  form and a spelled-out form through `PIe`/`NDr`, which are terminal-capability probes this host
  does not carry; `newlineHint(false)` is the spelled-out form.
- **`isHidden` is always false.** `G` filters on it; no local command declares one.
- **`uR()` is assumed true.** It gates the feedback line together with `rows >= 44`. The local
  renderer is the alternate-screen one, which is the arm `uR` selects.
- **The key-hint row is the dialog's own.** `G` renders `esc to cancel` in italic and, while a
  dismissal is pending, `Press esc again to exit`; the local dialog draws its own
  `Enter next / Esc cancel / PgUp/PgDn` row, and the dismiss notice lands on the status row.
- **Telemetry dropped.** The panel has none; the command's own `tengu_*` events do not exist here.

## Verification

- `test/help-panel.test.ts` (new, 12 tests): the builtin split, the name dedupe and sort and the
  row model; the visible count at four heights; both thresholds; the two newline forms; the chord
  spelling including the `⏎` glyph; the three columns' exact rows, the Windows suspend drop and a
  rebound action; the side-by-side and stacked tables; both General layouts; both list tabs with
  their empty state; the footer with and without the feedback line; the request's title, message,
  choices and default index, and the tab row in three states; and the browser's tab switch followed
  by the dismiss notice.
- Full suite 2860/2860 (118 suites), `npm run check` and `npm run build` clean.
- Compiled probe `.audit/w219-help.mjs` passes 13 checks over the real CLI at the pty's 90x30: the
  panel opens on `[General]` with the intro, the Shortcuts heading and the four composer sigils; the
  composer chords follow; a 30-row terminal shows neither the `/powerup` pointer nor the feedback
  line; `PgDn` reaches the session chords and the docs footer; the Custom commands tab reports its
  empty state; the Commands tab lists the default commands by number; the tab row follows each
  step; and `Esc` reports `Help dialog dismissed`, clipped by the status row's key hints at this
  width.
