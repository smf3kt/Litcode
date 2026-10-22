# W264 `/usage` (`/cost`, `/stats`)

The Settings Stats tab behind the composer. Offsets are zero-based UTF-16 code units, ranges
half-open.

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-dag4qhha.js` | `cd1a28e9b3a52a9e2fa16901017bf7b0151c67d1859d5104a840d41e33f3f4d2` | `No` `[80670,83385)` | journal aggregation: per-day activity, daily model tokens, model usage, session spans, message count, hour counts |
| ↳ | | `zd` `[89449,90357)` | aggregate shape: total days, active days, streaks, longest session, first/last session date, peak day |
| ↳ | | `gr` `[90466,91062)` | current and longest streak over the active-day set |
| ↳ | | `Js` `[91732,91838)` | `Oct 20` day label |
| ↳ | | `Jn` `[92361,93589)` | the Stats tab: all/7d/30d selector, empty state, dismissal text |
| ↳ | | `go` `[97415,97550)` | model ranking and token total |
| ↳ | | `ei` `[97550,97816)` | `Input … · Output … · Cache read … · Cache write …` |
| ↳ | | `ni` `[98003,104329)` | dashboard: summary rows, daily chart, model table |
| ↳ | | `si` `[105724,106329)` | comparison fun fact |
| `chunk-yn0pfn70.js` | `1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f` | `Bs` `[10886,10967)` | compact number (`en-US`, one fraction digit from 1000, lower-cased) |
| ↳ | | `rn` `[9654,10354)` | duration format |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | `Xje` 1635436 | `local-jsx` registration: `usage`, aliases `cost`, `stats`, `Show session cost, plan usage, and activity stats` |

## Behaviour

- **Summary rows.** Two 28-column cells with a 4-column gap: `Favorite model` and
  `Total tokens`, `Sessions` and `Longest session`, `Active days: n/totalDays` and
  `Longest streak: n day(s)`, `Most active day` and `Current streak: n day(s)`. Cells hard-cut at
  28 columns (`wrap="truncate"`), then the modality totals line follows.
- **Aggregate.** A session's day is its first message's UTC day; its duration is last message
  minus first message. The streak counts back from today's UTC day while that day is active.
  `totalDays` spans first to last session day inclusive. The favorite model is the one with the
  most input + output + cache-read + cache-write tokens.
- **Ranges.** `all` → `7d` → `30d`. A range keeps sessions whose first day is inside the window
  and counts only in-window messages.
- **Empty.** `No stats available yet.`

## Host adaptations

- **Journal timestamps.** Host journals carry no per-entry timestamp. Messages inherit the
  timestamp of the `turn_end` that closes their turn (`duration.timestamp`); a session starts at
  its recorded `startedAt`, or at its first stamped message when that is absent. A session with
  no stamped message contributes nothing, matching the recovered skip for invalid timestamps.
- **Scope.** The vendor aggregates every project under its history root; the host reads the one
  workspace `.agent` directory through the same UUID-journal filter as `listSessions`.
- **Model names.** The vendor maps a model ID to a display label through its vendor catalog; the
  host has no such table and shows the recorded model ID.
- **Empty text.** The recovered string names the vendor product; the host keeps the first
  sentence only.

## Not ported

- The Usage tab (plan, credits and spend) reads account data.
- The per-model token table with its 7d/30d bars (`ai`) and the hour histogram (`Do`), which
  need the vendor chart components and per-model series. The daily activity heatmap `Fn` is
  ported separately in [W265](W265-usage-heatmap.md).
- The comparison fun fact (`si`), which picks a random line per render.
- The session-duration panel (`Gd`/`Tr`) and the thin-client dispatch.

## Validation

- `test/usage-panel.test.ts`: 7/7 (formatters, streaks, aggregate fields, two-cell layout,
  range filter, journal stamping, journal directory filter).
- `test/usage-command.test.ts`: 2/2 (dialog title, rows, `t` range cycle, `/stats` and `/cost`
  reach the panel).
- `test/tui-autocomplete.test.ts`: 23/23 including the `cost`/`stats` alias rows.
- Focused usage/MCP/status/context/autocomplete: 34/34.
- Compiled `.audit/w264-usage.mjs`: 12/12 at identity `0ae8aa21…` over a fixture journal: the
  panel opens from all three names, all-time and both windows render, Escape returns.
- `npm run check` and `npm run build` pass. Full suite 3093, 3092 pass, with only the known
  CLI-effort failure.
