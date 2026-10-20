# W220 `/tui`

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

Part of the loop that ports the TUI surfaces behind the composer's slash commands. `/tui` is
`Set the terminal UI renderer (default | fullscreen)`, the next live `local-jsx` registration after
`/help`.

## What was there

The command did not exist. This build draws one renderer: `Tui` constructs a
`TerminalModeController` that enters the alternate screen for the whole session, so the recovered
`Rc()` predicate is always true and there is no classic, main-screen renderer to switch to. There
is also no process relaunch, which is how the recovered command applies a switch.

## Recovered source

| Module | SHA-256 / offset | Contents |
| --- | --- | --- |
| `chunk-24k7d6mw.js` | `lZ` 63380 | `["default","fullscreen"]` |
| ↳ | `yan` 63413 | the relaunch into the picked renderer |
| ↳ | `_an` 63857 | `Couldn't switch renderers — … The setting was saved; restart Claude Code to apply it.` |
| ↳ | `THs` 64013 | the uncarriable-restrictions refusal |
| ↳ | `OHo` 64259 | `Staying on the default renderer without a restart — …` |
| ↳ | `RHs` 64445 | `Staying on the ${h} renderer without a restart — …` |
| ↳ | `b1s` 64587 | the command body |
| `chunk-sfn1dbxq.js` | `STo` 1636494 | the registration, `argumentHint: "[default|fullscreen]"` |
| `chunk-1wsqtf4b.js` | sha256 `854c4a1af9be3812a3cfbbf32c1275c8df03c14b760b7dcad401cc201d5ef101` | the re-export (`call` = `b1s`) |
| `chunk-3cynezh1.js` | 264584 | the setting schema: `tui: enum(["default","fullscreen"]).optional()` |

The body:

```js
var lZ=["default","fullscreen"];
var b1s=async(h,T,M)=>{ let L=M.trim().toLowerCase(), ee=Rc()?"fullscreen":"default";
  if(L==="") return h(`Current renderer: ${ee}${Mt}. Usage: /tui <${lZ.join("|")}>`),null;
  if(!lZ.includes(L)) return h(`Unknown renderer "${L}". Usage: /tui <${lZ.join("|")}>`),null;
  let he=L; ... if(Nt()) {save only, background sessions}; if(mm()) {screen reader};
  let $e=he==="fullscreen", je=$e===Rc();
  if(je&&ft().tui===he) return h(`Already using the ${he} renderer.`),null;
  ... Je() refuses on uncarriable restrictions or running work ...
  await An("userSettings",{tui:he},...); if(je) return h(`Already using the ${he} renderer.`);
  return yan(he,at.flags,Me(),at.handoff,storageV5,{...}).catch(Mt=>h(_an(Mt))) }
```

## Port

- `src/tui-command.ts` (new): `TUI_RENDERERS` (`lZ`), `parseTuiArgument` (`b1s`'s
  `trim().toLowerCase()` and its two argument arms), `currentRenderer` (`Rc()`), `tuiUsage`,
  `tuiCurrentReport`, `tuiUnknownReport`, `tuiAlreadyReport`, `TUI_CLASSIC_UNAVAILABLE` (the
  recovered refusal frame for the arm this build cannot honour) and `tuiReport`.
- `src/interactive.ts`: the `/tui` branch next to the other configuration commands.
- `src/tui-autocomplete.ts`, `COMMAND_HELP` and `README.md`: the command row with the recovered
  description, which the recovered kind table classes as `config`.

## Adaptations and what stays out

- **The setting is not written.** `b1s` persists `{tui: <renderer>}` into `userSettings`; nothing
  in this build reads that key (the setting gates the recovered renderer choice and the
  `no-flicker` startup tip, and neither exists here), so writing it would be inert state.
- **There is no relaunch.** `yan` starts a new process with `CLAUDE_CODE_TUI_JUST_SWITCHED` and
  drops `CLAUDE_CODE_NO_FLICKER`, `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` and
  `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL`. This host has no equivalent, which is why the `default`
  arm refuses instead of switching.
- **The `default` arm is the local deviation.** The recovered would save and relaunch; here the
  arm reports `Cannot switch renderers — this build draws only the fullscreen renderer. Nothing was
  changed.` and leaves state alone. The wording keeps the recovered refusal frame, where a switch
  that cannot complete says so and changes nothing.
- **Out with the arms that need a second renderer or a session kind:** the background-session
  `Saved. …` report (`Nt()`), the screen-reader note (`mm()`), the downsell feedback dialog
  (`ZPe`/`UVn`), the uncarriable-restrictions list (`K7`), the running-work refusals and the two
  `Staying on …` reports. None of their preconditions exist locally.
- **The crash-recovery note is out.** `Mt` reads `RL() === "crash_auto_off"` and `t4t()`; this
  host records no renderer crash state, so the note is always empty.

## Verification

- `test/tui-command.test.ts` (new, 5 tests): the renderer list and the usage line; the trim,
  lowercase and three argument arms; the two recovered report strings with and without the note;
  `currentRenderer`; and each arm's report, including the refusal ending in `Nothing was changed.`
- Full suite 2865/2865 (118 suites), `npm run check` and `npm run build` clean.
- Compiled probe `.audit/w220-tui.mjs` passes 4 checks over the real CLI: `/tui` reports
  `Current renderer: fullscreen. Usage: /tui <default|fullscreen>`; `/tui fullscreen` reports
  `Already using the fullscreen renderer.`; `/tui bogus` quotes the word back with the usage line;
  and `/tui default` refuses without changing anything.
