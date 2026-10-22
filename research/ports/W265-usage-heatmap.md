# W265 `/usage` activity heatmap

The daily-activity heatmap inside the Stats tab from W264. Offsets are zero-based UTF-16 code
units, ranges half-open.

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-dag4qhha.js` | `cd1a28e9b3a52a9e2fa16901017bf7b0151c67d1859d5104a840d41e33f3f4d2` | `Dd` `[69243,69459)` | positive-count percentiles p25/p50/p75 |
| ↳ | | `Fn` `[69459,70586)` | the grid: 4-column gutter, `min(52, max(10, width - 4))` weeks, Sunday-first rows, month labels, legend |
| ↳ | | `vd` `[70586,70725)` | day key |
| ↳ | | `xd` `[70725,70836)` | bucket: 0 empty, else 1–4 against p25/p50/p75 |
| ↳ | | `Md` 70861 | `·` for empty, `░ ▒ ▓ █` for the four levels |

## Behaviour

- **Window.** The grid ends at the current week's Sunday and reaches back `weeks - 1` weeks. Cells
  after today are a space; today is drawn.
- **Levels.** Only days with `messageCount > 0` feed the percentiles, sorted ascending with
  `floor(n * .25/.5/.75)` indexes. `count >= p75` is the full block, down to any positive count
  below `p25` as `░`.
- **Labels.** A month is recorded at each Sunday whose month differs from the previous Sunday's;
  each name is padded to `floor(weeks / max(labels, 1))` and concatenated after a 4-column gutter.
  Rows carry `Sun`/`Mon`/`Tue`/`Wed`/`Thu`/`Fri`/`Sat` on rows 0, 1, 3 and 5.
- **Legend.** A blank line, then `    Less ░ ▒ ▓ █ More`.

## Host adaptations

- **Day keys.** The vendor keys `Fn`'s cells with local dates while `No` stores the activity under
  UTC dates, so half the day can miss on a non-UTC host. Both sides here use `usageDayKey`, and
  the week anchor is the UTC day.
- **Chart source.** `ni` draws the map from the all-time activity regardless of the selected
  range; the host recomputes the all-time aggregate once per command and reuses it across the
  `t` cycle.
- **Colour.** `Md` paints the levels with `#da7756`; the plain-text dialog keeps the glyphs only.

## Validation

- `test/usage-panel.test.ts`: 8/8, including a hand-computed 10-week grid (month labels, three
  bucketed days, future cells as spaces, legend) and the width clamps (52 weeks at 200 columns,
  10 at 4).
- `test/usage-command.test.ts`: 2/2 (the heatmap precedes the range line; the range still cycles).
- Focused usage/MCP/status/context/autocomplete: 36/36.
- Compiled `.audit/w264-usage.mjs`: 13/13 at identity `acacd460…`; the heatmap legend renders and
  PgDn reaches the modality totals line.
- `npm run check` and `npm run build` pass. Full suite 3094, 3093 pass, with only the known
  CLI-effort failure.
