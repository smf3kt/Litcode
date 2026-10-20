# W216 `/color`

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

Part of the loop that ports the TUI surfaces behind the composer's slash commands. `/color` is
`Set the prompt bar color for this session`: a small visual surface on the composer this host
already draws, and one of the two live names left in the scan (`/loops` and `/branch` are
`isEnabled:()=>!1`, `/insights` sits behind a policy gate, `/memory` is a thin-client form).

## What was there

Nothing. The command did not exist, `COMMAND_HELP` and the composer's command list did not name
it, and the session journal had no record for it. The eight subagent colour slots were already in
the six theme catalogs (`src/tui-theme-colors.ts`) and `tui-agent-suggestions.ts` kept a private
copy of the `BM` name table, but no user-facing pick existed.

## Recovered source

| Module | SHA-256 | Offset | Contents |
| --- | --- | --- | --- |
| `chunk-zm6kh5jw.js` | `857c50354b6a9e92382a46c6fb8cad46077640d9b1960f12fc07b2647956c3fc` | `c` 394 | the five reset words |
| ↳ | | `b2s` 472 | the `local-jsx` body, which renders the answer as a system message |
| ↳ | | `BQn` 580 | the command body: parse, persist, resolve, report |
| ↳ | | `p` 1597 | the remote bridge session colour tag |
| `chunk-1z1j45h7.js` | `01bb837725202a084cad281f0b8fcf059995c5d924da078b489cd9611f50fc9d` | `BM` 43 / `B_` 366 | the eight names and their theme slots |
| ↳ | | `bLe` 459 | `userOverride ?? agentDefinitionColor` |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | `Mk` 1567586 | the banner row above the box |
| ↳ | | `xzt` 1576494 | the chip `{text: he \|\| agent \|\| "", bgColor}`, or `null` |
| ↳ | | `p2` 1577469 | a name to its slot, anything else to the fallback |
| ↳ | | `Rzt` 1577813 | `promptBorder`, the border the banner defaults to |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | `Jco` 1831786 / `cBe` 1832036 | the two registrations, `immediate:!0` and the argument hint |
| `chunk-3wyskt03.js` | `59d30d4e7ad9ba0f1094d0b86fb05941a677b2a21cb87d39d78b805bf1e4a1b2` | `KWe` 190 | the app-state write |

The command body:

```js
let o = n?.trim() ?? "";
let t = o === "" ? B_[Math.floor(Math.random() * B_.length)] : o.toLowerCase();
let r = c.includes(t);
if (!r && !B_.includes(t)) { let s = B_.join(", ");
  return `Invalid color "${t}". Available colors: ${s}, default`; }
...
let i = r ? "default" : t;          // the persisted value
let l = r ? undefined : t;          // the app-state override
await XKt(d, i, m, e.storageV5);
e.setAppState((s)=>KWe(s, { color: l }));
u4t(nm(), bLe({ userOverride: l, agentDefinitionColor: g?.color }), e.storageV5);
if (r) return "Session color reset to default";
return `Session color set to: ${t}`;
```

and the banner the colour paints:

```js
function Mk(h){ let {banner, columns} = h; ... Te = banner.bgColor === "promptBorder" ? undefined : banner.bgColor;
  let Pt = Math.max(0, columns - Me - xt - Ct.length);
  return r(n, { color: banner_bgColor, children: [ "─".repeat(Pt), Ft ] }) }
```

## Port

- `src/session-color.ts` (new): `SESSION_COLORS` (`B_`), `SESSION_COLOR_RESETS` (`c`),
  `SESSION_COLOR_SLOTS` (`BM`), `sessionColorSlot` (`p2`), `effectiveSessionColor` (`bLe`),
  `sessionColorArgumentHint`, `parseSessionColor` (`BQn`'s parse with the pick injected),
  `sessionColorMessage`, and `composeBanner` (`Mk`'s row). `tui-agent-suggestions.ts` now imports
  the slot table instead of keeping its own copy.
- `src/session.ts`: a `session_color` event kind, its schema entry, and a `Session.sessionColor`
  getter. `sessions.ts` and both `interactive.ts` carry-forward lists keep it across a fork, a
  rewind and a `/reload`.
- `src/tui-renderer.ts`: `renderChat` takes a `banner` and draws it as its own row above the box,
  shrinking the transcript by one row when it exists.
- `src/tui.ts`: `setSessionColor`, `sessionBanner` (`xzt`'s `null` gate and `p2` over
  `promptBorder`), the row budget and the cursor target.
- `src/terminal.ts`: `TerminalSurface.setSessionColor?`.
- `src/interactive.ts`: the `/color` branch, the help line, and the restore on open and on a
  session rebind.

## Adaptations and what stays out

- **The banner chip has no text yet.** `xzt` draws `he || agent || ""` — the standalone-agent name
  or the agent chip. This host renders neither on the composer, so `/color` alone produces the
  collapsed chip: `Mk`'s full-width rule in the chosen slot. `composeBanner` keeps the text
  parameter and its cut so the recovered geometry is the one under test.
- **The explicit branch is dropped.** `BQn` branches on `Oc()` — a teammate session (`dT()` or a
  dynamic team context) whose colours belong to the team leader. This host has no team context, so
  `TEAMMATE_COLOR_MESSAGE` is recorded rather than reachable.
- **Latest write wins, not earliest.** `XKt` appends the colour to the transcript and the reader
  takes the first record it meets (`r.currentSessionAgentColor ??= e.agentColor`). A local
  `/color default` has to clear the session that issued it, so the getter reads the last record.
- **The per-agent record is out.** `u4t(nm(), bLe(...))` writes the effective colour into a
  per-job file keyed by the job or session id, for the subagent roster. This host has no such
  store, so only the session record and the composer are written.
- **The remote tag is out.** `p` pushes the colour to the bridge session (`updateBridgeSessionColorTag`)
  over `baseUrl` with an access token. Local-only constraint.
- **The agent-definition source is out.** `wLe`/`fPr()` read a per-agent-type colour map this host
  has no source for, so `bLe` only ever sees the user override.
- **Telemetry dropped.** `tengu_agent_color_set` is not ported.

## Verification

- `test/session-color.test.ts` (new, 9 tests): the eight names and the hint; every reset word
  including case and padding; the lowercased set and its message; the injected pick; the verbatim
  invalid line; the slot resolver at both fallbacks; the override precedence; and the banner
  geometry at the collapsed chip and at the `columns - 3` cut.
- `test/interactive.test.ts` (+1 test): a live loop takes `/color Red`, refuses `teal` without
  touching the record, clears with `default`, and picks one for a bare `/color`.
- Full suite 2824/2824 (118 suites), `npm run check` and `npm run build` clean.
- Compiled probe `.audit/w216-color.mjs` passes 11 checks over the real CLI at the pty's 90x30:
  a fresh composer draws no banner, `red` paints `rgb(220,38,38)` on a rule above the box while
  the box border stays `promptBorder`, `teal` reports the list and leaves the banner, `default`
  removes it, a bare `/color` picks one of the eight slots, and a `/reload` carries cyan
  (`rgb(8,145,178)`) into the new session.
