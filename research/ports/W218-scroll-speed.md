# W218 `/scroll-speed`

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

Part of the loop that ports the TUI surfaces behind the composer's slash commands. `/scroll-speed`
is `Adjust mouse wheel scroll speed`, the first pick from the scan of live `local-jsx`
registrations after the input-bar names ran out. Its engine was already here: W157b ported the
terminal-environment probe and the wheel acceleration curve, so this package is the command, the
value model and the persistence.

## What was there

The command did not exist. `src/plugin-chain-terminal-environment.ts` already returned the probe
(`base`, `useDecayCurve`, `xtermJs`, `wheelFlood`, `wtSession`, `jediTerm`, the terminal identity
fields), `src/plugin-chain-wheel-acceleration.ts` already stepped the wheel, and
`CLAUDE_CODE_SCROLL_SPEED` was already read by the probe's `ie` helper — but nothing offered a way
to change it, and nothing read the settings file's `env` block, which is where the recovered
command persists the choice.

## Recovered source

| Module | SHA-256 | Offset | Contents |
| --- | --- | --- | --- |
| `chunk-gz3f33zw.js` | `3fd019e969ec8e41ae3c0a33ba98763dfde674951540e32716dbb3d574ac516e` | `_t` 6959 | the live environment read |
| ↳ | | 6995 | `me` 1, `ge` 0.25, `A` 0.25, `X` 10 |
| ↳ | | `k` 7024 | the snap and clamp |
| ↳ | | `h` 7099 | `CLAUDE_CODE_SCROLL_SPEED` |
| ↳ | | `O` 7132 | the live write, `undefined` removes |
| ↳ | | `ce` 7210 | the whole dialog component |
| ↳ | | `j` 11657 | the label/value row (width 12) |
| ↳ | | `Me` 11957 | the ten-cell ruler |
| ↳ | | `xe` 12078 / `Dt` 12280 | the terminal row and the terminal name |
| ↳ | | `Ve` 12921 | the editor-sensitivity row |
| ↳ | | `call` 13280 | the command body, `Ct` 20 at 13270 |
| `chunk-ax7r0qj7.js` | `8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e` | `vi` 615 / `I` 798 | the guarded repeat and the pluralizer |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | `Xfo` 1166855 | the registration and its gate |

The value model, the ruler and the gate:

```js
var me = 1, ge = 0.25, A = 0.25, X = 10;
function k(t, o){ let S = t < 1 ? Math.round(t / A) * A : Math.round(t); return ad(S, o, X) }
var h = "CLAUDE_CODE_SCROLL_SPEED";
function O(t){ if (t === undefined) delete process.env[h]; else process.env[h] = t; s$t() }
function v4n(r, n, o){ return !n && (r || !1 || o) ? 3 : 1 }
function Me(t){ if (t < 1) return "▪" + vi("·", X - 1);
  let o = ad(Math.round(t), me, X); return "■".repeat(o) + vi("·", X - o) }
function xe(t){ let o = [Dt(t), RPe(t.platform)];
  if (t.wheelFlood) o.push("high-rate wheel events");
  else if (t.xtermJs) o.push("xterm.js"); else if (t.wtSession) o.push("Windows Terminal");
  return o.join(" · ") }
var Xfo = { type: "local-jsx", name: "scroll-speed", description: "Adjust mouse wheel scroll speed",
  isEnabled: () => { if (!Rc()) return !1; let e = Su();
    return !(e ? Fse.includes(e.terminal ?? "") : Nx.isJetBrainsIdeTerminal()) } };
```

the arrow rule and the save, from the component `ce`:

```js
function J(bt){ let Tt = bt < 0 ? (d <= 1 ? -A : -1) : (d < 1 ? A : 1);
  let fe = k(d + Tt, pe); if (fe === d) return; process.env[h] = String(fe), s$t(), Je(!0), Fe(fe) }
async function Y(){ ... let Q = !U; let $t = { [h]: Q ? void 0 : String(d) };
  let { error: ve } = await An("userSettings", { env: $t }, void 0, W);
  if (ve) { c(ve), T(), o(`Couldn't save scroll speed: ${ve.message}`); return }
  let et = `\`${Rs(yn("userSettings") ?? "settings.json")}\``;
  o(Q ? `Scroll speed reset to auto (${M} ${I(M, "line")} per notch) · removed from ${et}`
      : `Scroll speed set to ${d} ${I(d, "line")} per notch · saved to ${et}`) }
function B(){ if (F.current) return; F.current = !0; T(); o("Scroll speed unchanged") }
```

and the handler that decides both:

```js
function Z(f){ if (f.key === "left") f.preventDefault(), J(-1);
  else if (f.key === "right") f.preventDefault(), J(1);
  else if (f.key === "return") f.preventDefault(), Y();
  else if (f.key === "escape" || f.ctrl && (f.key === "c" || f.key === "d")) f.preventDefault(), B();
  else if (f.key === "r") f.preventDefault(), Ze() }
```

## Port

- `src/scroll-speed.ts` (new): `SCROLL_SPEED_ENV` (`h`), the four constants, `autoScrollSpeed`
  (`v4n`), `scrollSpeedStep` (`pe`), `snapScrollSpeed` (`k`), `adjustScrollSpeed` (`J`'s arithmetic),
  `scrollSpeedRuler` (`Me`), `scrollSpeedNotch`/`scrollSpeedNotchCount`/`scrollSpeedDialogNotch`
  (`I`, and `ee` for the dialog's own wording), `terminalName` (`Dt`) with `devinDesktopAskpass`
  (`ITo`), `platformName` (`RPe`), `terminalDescription` (`xe`), `scrollSpeedAvailable` (`Xfo`'s
  gate), `scrollSpeedValues`, `scrollSpeedExplicit` (`_t` and `ce`'s `U`), `currentScrollSpeed`
  (`ce`'s `d`), `displayPath` (`Rs`), `setLiveScrollSpeed` (`O`), `saveScrollSpeedSetting` (`Y`'s
  persistence), `applyStoredEnvironment`, `scrollSpeedSaved`/`scrollSpeedReset`/
  `SCROLL_SPEED_UNCHANGED` (`Y`/`B`) and `scrollSpeedDetail` (the ruler, the notch count and the
  terminal row `ce` renders).
- `src/interactive.ts`: the `/scroll-speed` branch next to the other configuration commands, the
  imports, and `applyStoredEnvironment(userDir)` at the top of `interactiveLoop` — inside the loop
  rather than in `cli.ts`, because `--resume` can resolve a different user directory than the one
  `cli.ts` sees, and the command and the reader have to name the same `settings.json`.
- `src/tui-autocomplete.ts` and `README.md`: the command row and the README line.

## Adaptations and what stays out

- **The dialog is a chooser, not a live adjuster.** `ce` is a component with its own key handler:
  left and right move the value, `r` resets, and a demo ruler previews the position. The local
  surface offers `readDialog`, whose contract is a titled list plus an answer, so the reachable
  values and `auto` are the rows, the current value (or auto) is preselected, and the pick is
  applied on accept. `adjustScrollSpeed` is ported and tested even though no local surface drives
  it one step at a time, because it is the rule the recovered values come from and
  `scrollSpeedValues` is derived from the same grid.
- **The demo ruler is out.** `nun(true, {demoRuler})` turns on a live-preview mode in the wheel
  recorder and `vEe` subscribes to the wheel mode so the dialog can tell a wheel from a trackpad.
  The recorder (`Cv`) is in the ported render engine but no local surface exposes it, so the
  preview and the `showDemoRuler = messages.length < 20` gate have nothing to drive them.
- **The editor row is out.** `Ve` reads VS Code's own wheel sensitivity through `FDr` and a
  250 ms timed `Bt` read of a foreign settings file, and its two messages point at
  `/terminal-setup`, which this host does not have.
- **The settings write is nested, and its reader is now ported too.** The recovered persists
  `{env: {CLAUDE_CODE_SCROLL_SPEED: …}}` into `userSettings`. This host had no `settings.env`
  layer, so the write alone would have been inert on the next start; `applyStoredEnvironment`
  applies that block to the process once at startup, filling only names the process does not
  already carry, so a real environment variable always wins.
- **An emptied `env` block stays.** `An("userSettings", {env: {[h]: undefined}})` is a customizer
  that deletes the leaf key whose incoming value is `undefined` and leaves its parent alone, so the
  local save keeps `env: {}` when the last key goes. The report's `removed from` wording describes
  the key, not the block.
- **Telemetry dropped.** `tengu_scroll_speed_set` and its eleven fields are not ported.
- **The reset word is out.** `r` resets inside the dialog; locally that is the `auto` row.
- **`Rc()` is assumed true.** `Xfo`'s gate is `Rc() && !jetBrainsTerminal`. `Rc` is the fullscreen
  check; the local `setFullscreen` has no caller, so the predicate is always false and cannot
  decide anything. This host always draws its own renderer, so the half of the gate that can still
  say no is the JetBrains terminal, which `scrollSpeedAvailable` keeps. The command also refuses
  while a turn is running and reports one line instead of opening a dialog when there is no
  prompt surface, which `readDialog` needs.
- **The autocomplete row is ungated.** `Xfo.isEnabled` is a predicate; the local `TuiCommand` row
  has no predicate field, so `/scroll-speed` is listed even in a JetBrains terminal, where running
  it prints the fixed-by-this-terminal line instead of the chooser.

## Review outcomes

A 49-agent adversarial pass over the package (three finder lenses, two skeptics per finding)
raised 23 candidates and confirmed 11. Each one is fixed in the port:

| Finding | Fix |
| --- | --- |
| Both reports named the settings file with `path.basename`, but `Rs(yn("userSettings"))` is the tilde-abbreviated full path. | `displayPath` (`Rs`), used by both report strings. |
| `xe` used the raw `process.platform`, but the recovered row runs it through `RPe`. | `platformName` (`RPe`), so the row reads `iTerm2 · macOS`. |
| `Dt` was missing the Devin Desktop arm of the askpass predicate. | `devinDesktopAskpass` (`ITo`), which also matches `windsurf`. |
| The dialog started on `parseFloat(env)`, but `ce`'s `d` is `k(u.base, pe)` — the probe's own base. | `currentScrollSpeed`, so an off-grid or out-of-range value shows as the one that would apply. |
| The dialog's notch line read `per notch`, but `ee` says `per wheel notch` with a two-space indent. | `scrollSpeedDialogNotch`. |
| A piped session threw `Cannot read properties of undefined` on `terminal.prompt`. | The branch reports one line instead of opening a dialog when no prompt surface exists. |
| `cli.ts` and the command could name different `settings.json` after `--resume`. | `applyStoredEnvironment` moved into `interactiveLoop`, and its `cli.ts` call removed. |
| The ruler's lower clamp was 0, but `ad(Math.round(t), me, X)` clamps at 1. | `scrollSpeedRuler` clamps into `[1, 10]`. |
| An emptied `env` block was deleted, but the recovered customizer deletes only the leaf. | `saveScrollSpeedSetting` keeps `env: {}`. |
| `liveScrollSpeed` tested parseability, but `_t` tests presence. | `scrollSpeedExplicit`, with the unparseable-but-present case tested. |
| The first pick's report line was asserted without its wrap. | Probe joins the hard-wrapped rows before matching (see Verification). |

## Verification

- `test/scroll-speed.test.ts` (new, 19 tests): the auto step for each terminal kind; the
  granularity both ways; the snap and clamp at both ends; the four arrow transitions and the two
  no-ops; the ruler including the below-one half dot; the singular and plural notch text; the two
  value grids; the gate; the platform names; the terminal name across eleven inputs, Devin Desktop
  included, and the description across four wheel transports; the live variable's read, write and
  removal; the detail block; the dialog's starting value including an off-grid and an out-of-range
  variable; the report path abbreviation; the two report strings; the settings write preserving
  sibling keys and mode, keeping the emptied block, and refusing a zero or NaN value; and
  `applyStoredEnvironment` filling only absent string names.
- Full suite 2848/2848 (118 suites), `npm run check` and `npm run build` clean.
- Compiled probe `.audit/w218-scroll-speed.mjs` passes 17 checks over the real CLI at the pty's
  90x30: the dialog opens with the current value, its ruler, the notch count and the terminal row;
  the rows run from `auto (1 line per notch)` through the fine grid to `2 lines per notch`; a pick
  reports the notch count and the settings file and writes `env.CLAUDE_CODE_SCROLL_SPEED`; a second
  pick replaces it; Escape reports `Scroll speed unchanged` and leaves the file alone; the auto row
  reports the reset form and drops the key while keeping the block; a pick above the grid stores
  `1`; and a second process over the same user directory reads that value back as explicit rather
  than auto. The report line is longer than the pty is wide, so the probe rejoins the hard-wrapped
  rows before matching it.
