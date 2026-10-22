# W269 panel key hints

Every read-only panel this host opens declares `keys` on its dialog request, but the hint line
drew only the navigation text, so the action keys existed without being named. This is a host
surface fix, not a recovered-body port.

## Change

`src/tui.ts` `renderDialog` composes the hint line from the request's keys:

- A request with no keys keeps its existing hint (`Esc close / PgUp/PgDn`, `Enter next / Esc
  back / PgUp/PgDn`, or the question guide).
- A request with keys appends ` / <key> <label>` for each, in request order. `/usage` now reads
  `Esc close / PgUp/PgDn / t Last 7 days`, and `/mcp` reads its `r reconnect` the same way.
- The progress prefix (`Question N of M`) is unchanged, and a dialog error still replaces the
  whole line.

The recovered panels draw their own key rows inside the panel body; this host has one hint line,
so the keys ride on it rather than adding a second row.

## Validation

- Focused TUI/usage/MCP/status/context/btw: 88/88.
- Compiled `.audit/w264-usage.mjs`: 15/15 at identity `8d0d8699…`; the Stats panel advertises
  `t Last 7 days`, and the key still cycles both ranges.
- `npm run check` and `npm run build` pass. Full suite 3102, 3101 pass, with only the known
  CLI-effort failure.
