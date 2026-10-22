# W261 `/context`

The composer's context-usage grid: category totals and a glyph grid over the live request. Offsets are zero-based UTF-16 code units.

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | `DCn` 2109980 | category assembly, buffer and free-space maths, grid geometry, total and percentage |
| ↳ | | `uge` 2100188, `cge` 2100217, `Zj` 2100238 | `Autocompact buffer`, `Compact buffer`, `Free space` |
| ↳ | | `FYr` 2100254 | category kind: free, buffer, deferred, used |
| ↳ | | `qMt` 858397, `Orr` 858411 | the 13k reserve and the 3000-token compact reserve |
| ↳ | | `SBe` | `local-jsx` registration: `name:"context"`, `description:"Visualize current context usage as a colored grid"`, `argumentHint:"[all]"` |
| ↳ | | `Vue` | the non-interactive `local` twin: `Show current context usage` |
| `chunk-5d7rhstd.js` | `8bfa559970c527708ca4762b8271f3e31a90058ec4401b43e905c19b939b62c0` | `G` 22707 | the panel body: title, over-limit line, grid beside the legend |
| ↳ | | `zt` 19996 | the cell glyph: `⛶` free, `⛝` buffer, `⛁` filled at 0.7, `⛀` below |
| ↳ | | `Mt` 20257 | one grid row, each cell rendered as glyph plus space |
| ↳ | | `vt` 19811, `Nt` 19961 | the legend's non-free category and buffer predicates |

## Behaviour

- **Categories.** `DCn` pushes System prompt, System tools, MCP tools, MCP server instructions, deferred tools, custom agents, memory files, skills, then Messages, the buffer, and Free space. The host has three counts, so only the first two and Messages appear.
- **Buffer.** The reserve is `window - threshold` while automatic compaction is on and the threshold is not the model default (`Autocompact buffer`), zero when it is (`source === "auto"`), and `Orr` = 3000 when automatic compaction is off (`Compact buffer`). Free space is the window minus the used categories and the reserve, floored at zero.
- **Grid.** Five columns when the terminal is narrower than 80, twenty at a window of at least 1e6, otherwise ten; rows are ten except at 1e6, where they stay ten, or narrow, where they are five. A category occupies `max(1, round(tokens/window*cells))` cells, free space `round(...)`, and the cell at `floor(exact)` carries the fractional remainder. Free space fills every cell the categories and the buffer leave; the buffer's cells are appended last.
- **Panel.** `G` renders "Context Usage", the model, `used/max tokens (pct%)`, the legend under "Estimated usage by category", then the grid. Free space's legend line omits the word "tokens"; the other lines read `{glyph} {name}: {tokens} tokens (pct%)`. The auto-compact window line and the MCP/agent/skill detail sections have no host counterpart.
- **Non-interactive.** The `local` registration prints the totals; the host keeps its existing JSON.

## Host adaptations

- **Counts.** `Agent.contextBreakdown` makes three provider counts over the same request: without messages and tools, with the tool schemas, and live. The provider's fixed estimate overhead cancels in the differences, giving System prompt, System tools and Messages. The gateway's `countTokens` path is used unchanged when configured.
- **Surface.** The host dialog is a single text body, so the legend precedes the grid instead of sitting beside it, colour roles are dropped, and the panel is a read-only dialog closed by Escape. The recycled grid keeps the recovered glyphs and 0.7 threshold.
- **Geometry.** The terminal width comes from `process.stdout.columns` (80 when absent); the 1e6 window uses the recovered 20x10 layout.
- **Arguments.** `[all]` selected the recovered expanded detail sections; the host has no such sections, so a trailing argument is ignored. Piped `/context` keeps the JSON contract, which the recovered non-interactive twin also provides.
- **Test fixtures.** The `/btw` fixtures gained the `@anthropic-ai/sdk` 0.133 `Message` fields (`citations`, the full usage record) so `npm run check` accepts them; behavior is unchanged.

## Validation

- `test/context-panel.test.ts`: 5/5 (category order and buffer/free maths, disabled reserve, narrow and 1e6 geometry, fractional cell, panel text).
- `test/context-command.test.ts`: 1/1 (three counts, read-only dialog, legend lines, grid rows).
- Focused `context-*`, `btw`, `interactive`, `tui*`, `autocompact-toggle`: 144/144; catalog after the description update 28/28.
- Compiled `.audit/w261-context.mjs`: 7/7 at identity `f9175e46…`. The estimate path opens the panel, names the model, lists the categories and draws glyphs; Escape returns to the composer.
- `npm run check` and `npm run build` pass. Full suite 3074, 3073 pass, with only the known CLI-effort failure.
