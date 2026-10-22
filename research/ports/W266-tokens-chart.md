# W266 `/usage` tokens-per-day chart

The `Tokens per Day` section of the Stats tab: the bundled plotter, `ai` and its x-axis ticks.
Offsets are zero-based UTF-16 code units, ranges half-open.

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-dag4qhha.js` | `cd1a28e9b3a52a9e2fa16901017bf7b0151c67d1859d5104a840d41e33f3f4d2` | `plot` `[6162,7637)` | the bundled `asciichart` plotter: series scaling, 3-column offset, axis glyphs `┼ ┤ ╶ ╴ ─ ╰ ╭ ╮ ╯ │`, label column |
| ↳ | | `ai` `[110439,111305)` | `Tokens per Day`: repeat or slice to `min(52, max(20, columns - 7))` days, top three models with any tokens, height 8, `B`/`M`/`k` labels padded to 6, legend bullets |
| ↳ | | `Um` `[111305,111652)` | up to four `Oct 20` ticks under the chart |

## Behaviour

- **Arity.** Fewer than two token days or no models returns nothing. Only the first three ranked
  models are considered, and a model with no positive day is dropped from both the plot and the
  legend.
- **Series width.** The day series is the last `width` days; when shorter, each day is repeated
  `floor(width / days)` times, which is why adjacent ticks can carry the same label.
- **Labels.** `>= 999950000` prints `B`, `>= 1e6` `M`, `>= 1000` rounded `k`, otherwise the raw
  integer, all padded to six columns; the plotter writes the axis glyph into the third column of
  that label cell, so a label cell is one array slot rather than one character.
- **Section.** The title, the plot, the tick line and `● model · ● model` follow the modality
  totals line, matching `ii`'s placement below the summary rows.

## Host adaptations

- **Colour.** The recovered plotter wraps every glyph in `colors` and the legend in
  suggestion/success/warning swatches; the plain-text dialog keeps the glyphs and a `●` bullet.
- **Model names.** The legend shows the recorded model IDs; the vendor maps them through its model
  catalog.
- **Data.** `usageStats` now returns `dailyModelTokens` in the source's `{date, tokensByModel}`
  shape, sorted by date and filtered by the selected range like `No`'s `fromDate`.

## Not ported

- The per-model rows under the legend (`In: … · Out: …`, `Cache: … read · … write`, percentage)
  and the four-row scroll window; the hour histogram (`Do`) also stays out.

## Validation

- `test/usage-panel.test.ts`: 10/10, including the plotter's exact three rows for `[[0, 1]]`, the
  9-row fixture chart with its `7k` top label, the tick line, the legend, and the three null cases.
- `test/usage-command.test.ts`: 2/2 (a single-day journal draws no chart).
- Focused usage/MCP/status/context/autocomplete: 38/38.
- Compiled `.audit/w264-usage.mjs`: 14/14 at identity `2f152ae6…`; a two-day, two-model fixture
  renders `Tokens per Day` with `● other · ● fixture` beside the heatmap and summary rows.
- `npm run check` and `npm run build` pass. Full suite 3096, 3095 pass, with only the known
  CLI-effort failure.
