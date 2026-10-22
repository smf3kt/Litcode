# W267 `/usage` per-model rows

The model groups under the `Tokens per Day` chart. Offsets are zero-based UTF-16 code units,
ranges half-open.

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-dag4qhha.js` | `cd1a28e9b3a52a9e2fa16901017bf7b0151c67d1859d5104a840d41e33f3f4d2` | `Uo` `[109350,110439)` | one group: `●` bullet, model, `(pct%)`, `In: … · Out: …`, `Cache: … read · … write` |
| ↳ | | `ti` `[97816,97884)` | the percentage: `(tokens / total * 100).toFixed(1)`, `0.0` for an empty total |
| ↳ | | `oi` `[97884,98003)` | the cache line |
| ↳ | | `Hm` `[113186,113926)` | the plain list: three ranked models, `No model usage data available` when none |

## Behaviour

- **Rank.** Models sort by input + output + cache-read + cache-write tokens, the same `go` ranking
  that picks `Favorite model`; the list keeps the first three.
- **Group.** `● <model> (<pct>%)` then `  In: <n> · Out: <n>` then `  Cache: <n> read · <n> write`,
  all counts through `Bs` (`chunk-yn0pfn70.js` 10886).
- **Empty.** With no model usage the section prints `No model usage data available` instead of
  groups; it sits after the chart section, as `Hm` appends it after `ai`.

## Host adaptations

- **Layout.** The dashboard's `Uo` sits inside a two-column, four-row scroll window with an
  up/down hint; the plain dialog uses `Hm`'s flat three-model list, so no scroll state is needed.
- **Model names.** Recorded model IDs, not the vendor's display labels.
- **Colour.** The bullet and percentage drop the theme accent.

## Not ported

- The four-row scroll window and its `↑ ↓ 1-4 of N models` hint, and the `Favorite model: … ·
  Total: … tokens` line above the groups (the summary rows already carry both facts).

## Validation

- `test/usage-panel.test.ts`: 11/11, including both groups for the two-model fixture
  (`m2` 59.1%, `m1` 40.9%), the one-model limit and the no-usage fallback line.
- Focused usage/MCP/status/context/autocomplete: 39/39.
- Compiled `.audit/w264-usage.mjs`: 14/14 at identity `e5431057…`; after PgDn the panel shows
  `● other (66.7%)` with `In: 2.0k · Out: 1.0k` and `Cache: 0 read · 0 write`.
- `npm run check` and `npm run build` pass. Full suite 3097, 3096 pass, with only the known
  CLI-effort failure.
