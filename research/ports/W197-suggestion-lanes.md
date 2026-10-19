# W197 composer suggestion kind and source lanes

Status: implemented locally on `work/w43-choice-preview`. Follows W196. No push, no
upstream calls.

## Request

Loop prompt 「继续完善tui，直到搬运剩余还没做的的功能的tui显示」. FEATURES row 50 listed
"the kind/source lanes are not ported" as the remaining gap in the composer suggestion
list; this package closes it.

## Recovered source

- `extracted-v2/modules/chunk-qfjvvwpv.js`, sha256
  `116de8fc147859476928cc4bb1a0c61d1a54b1373f46eb01bfee91349e1b2504`. The row component
  `ze` [4084,8770) and the lane helpers `_t`/`ee`/`No` [10298,11400). Zero-based UTF-16
  offset ranges.
- `extracted-v2/modules/chunk-wtch2p0g.js`, sha256
  `00d29835d3b6ec21999ab2d38ae5086e7c798d82aa152e76a7e00cf5b0dc4b3b`. `Ixs` and the
  command-name table `a` it reads: `if (e.type === "prompt") return "skill"; return
  a[e.name] ?? "action"`, with `a` mapping every vendor command name to `config`,
  `action`, `info` or `agent`.
- `extracted-v2/modules/chunk-24k7d6mw.js`, sha256
  `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`. `Wre` [507454,507979)
  attaches `kind: Ixs(T)` and `sourceTag: Le`; `_Dt` [507195,507454) produces the source
  tag (`project`, `org`, `claude.ai`, or absent).

## The row

`_t` turns the resolved kind into a lane:

| kind | lane label | lane width |
| --- | --- | --- |
| absent | none | 0 |
| `action` | empty | 7 |
| `info` | `config` | 7 |
| `config` | `config` | 7 |
| `agent` | `agent` | 7 |
| `skill` | `skill` | 7 |

A present kind always spends seven cells, so the descriptions line up whether or not the
lane names itself. `ze` then accents only two of them: `skill` takes the `skill` slot and
`agent` the `background` slot, and both keep that colour on every row. Everything else
stays dim, as do the `[tag]` and `[sourceTag]` lanes when present.

The column the lane starts at comes from `ee`: the widest row's display text plus five,
unless that passes 40% of the terminal, where the lane moves to 40% plus as much of the
pointer as the remaining room allows (`No`). The display text is cut to keep a two-cell
gap before the lane, the description gets `width - column - lanes - 4` cells, and the row
is padded to the terminal width.

Colour follows the source too: the selected row takes the `suggestion` slot and every
other row is dim, replacing the previous local bold/dim pair.

## Change

`src/tui-autocomplete.ts`:

- `SuggestionLane` and `TuiCommand.lane`, with every entry of the product command table
  classified from the vendor table by name where the name exists there (`help`/`status`/
  `context`/`usage`/`diff`/`skills`/`sessions` → `info`, `effort`/`model`/`theme`/`plan`/
  `permissions`/`vim`/`config`/`mcp`/`agents`/`thinking`/`editor` → `config`, `tasks`/
  `workflows`/`fork`/`cron`/`peers`/`peer-held`/`peer-inbound` → `agent`) and by the same
  principle where it does not (the `worktree*`, `checkpoint*`, `cwd`, `reload`,
  `mcp-reconnect`, `attach`, `paste-image`, `continue` family → `action`).
- `CommandSuggestion` gains `lane`, `tag` and `sourceTag`; `SkillCommandSource` gains
  `source`, and a `projectSettings` skill draws `[project]`, the only source tag `_Dt`
  yields for this product's skill sources.
- `suggestionLanes` ports `_t`, `laneAccent` ports the two accents, `suggestionColumn`
  ports `ee`/`No`, and `suggestionRowSegments` ports `ze`'s children order (pointer, padded
  name, kind lane, tag, source lane, description). `layoutSuggestionRows` is now the plain
  join of those segments.

`src/tui.ts` paints the segments: a `slotForeground` helper resolves a palette value
(`rgb(r,g,b)` or `ansi:name`) to an SGR foreground, honours the terminal's colour level,
and applies the session's theme overrides; `renderAutocompleteRows` opens each segment's
state and resets it, so a lane accent survives the row's dim.

## Validation

- `test/tui-autocomplete.test.ts`: the row test now asserts the `config` lane is named,
  an `action` row leaves seven blank cells at the same column, the lane starts at the
  widest row plus five, and a 20-column row truncates the name to keep the two-cell gap.
  14/14 in the file.
- Full suite 2684/2684 (118 suites), `npm run check` and `npm run build` clean.
- Compiled PTY probe (100x40, `LC_ALL=en_US.UTF-8`): `/mo` draws
  `❯ /model           config Choose or enter a model, …` with `/mcp-reconnect` leaving the
  lane blank; `/ta` ranks `/tasks` first and shows its `agent` lane; the raw stream carries
  `38;2;0;204;204` (the `background` slot on the agent lane) and `38;2;177;185;249` (the
  `suggestion` slot on the selected row). A click still fills the draft.

Known difference, recorded rather than fixed: no local command sets a `[tag]` yet. The
source's only tag is `[dynamic workflow]` on a workflow prompt entry, and this product
exposes named workflows through the workflow keyword rather than as a slash entry.

Raw samples stay unchanged; no recovered entrypoint is executed.
