# W201 `@` agent completion

Status: implemented locally on `work/w43-choice-preview`. Follows W200. No push, no
upstream calls.

## Request

Loop prompt 「继续完善tui，直到搬运剩余还没做的的功能的tui显示」, next item in
`.audit/tui-remaining.todo.md`: the `agent-` lane behind the `@` trigger.

## Recovered source

- `chunk-24k7d6mw.js`, sha256
  `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`: the combined provider
  `tse` 562716, the row adapter `$0e` 561755, the agent row builder `HDt` 562351, the
  description cut `q0` 560849 sharing `BDt`, the cap `W0` 562302, the template head `Nre`
  491566, the replacement test `JI` 491357, and the composer's `@` accept gate 583448 over
  `Gs = Ct.some(JI) ? "" : k6r(Ct)` 583522.
- `chunk-1z1j45h7.js`, sha256
  `01bb837725202a084cad281f0b8fcf059995c5d924da078b489cd9611f50fc9d`: the colour slot table
  `BM` 663 and the resolver `wLe` 1062.
- `chunk-vr7yfckx.js`, sha256
  `3f82078066ff8460dd7239a5535627a492ce1771a0b08dec654b5af955eeb7c6`: the shared-prefix
  `k6r` 7894 already ported in W200.

Coordinates are zero-based UTF-16 offsets.

**The combined list** (`tse`): a query of `""` with `showOnEmpty` false returns nothing.
Otherwise the file provider `CWt` and the agent builder `HDt` run together, then an empty
query returns `[...files, ...resources, ...templates, ...agents]` capped at `W0` = 15, and
a non-empty query scores the files by their index ratio (`?? 0.5`) and ranks
resources/templates/agents with fuse.js (`threshold` 0.6; weights displayText 2, name 3,
server 1, description 1, agentType 3, uriTemplate 2), adding 0.15 to an `mcp_resource` hit.
Both lists merge on score ascending, keep 15, and map through `$0e`.

**The adapter** (`$0e`): `file-<path>`; `mcp-resource-<server>__<uri>`; the template
`mcp-template::<server>__<uriTemplate>` plus `metadata.replacement = ese(displayText, true)`
and `partial: true`; `agent-<agentType>` with the colour slot. The template metadata is not
copied: W200's composer reads no `replacement` metadata, and W202 owns the MCP templates.

**The agent row** (`HDt`): one row per type, `displayText` `<agentType> (agent)`,
`description` = `q0(whenToUse)` cut to `BDt` = 60 cells, and colour `wLe(agentType)`. A
query keeps the rows whose `agentType` or `displayText` contains it, lower-cased; the whole
builder is wrapped in a `try` that reports and returns `[]` rather than propagating.

**The colour** (`wLe` over `BM`): `general-purpose` never takes one; otherwise the value is
the user override for that type, mapped through the eight `*_FOR_SUBAGENTS_ONLY` slots. The
local product has no override store, so the map is a caller argument and defaults empty.

**The accept**: the composer's `@` branch uses the shared prefix only when the rows carry no
template `replacement`; otherwise it goes straight to the selected row. The splice is the
W200 `dse`/`pbn` path, so an agent row accepts as `@<type> (agent)`. With one matching row
the prefix is the whole display text, so the first accept only fills it.

## Change

- `src/tui-at-suggestions.ts` (new): `combinedAtRows` ports `tse`, `adapt` ports `$0e`,
  `templatePrefix` ports `Nre`, `AT_SUGGESTION_LIMIT` is `W0`, `AT_DESCRIPTION_LIMIT` is
  `q0`'s `BDt`, and `AT_DESCRIPTION_LIMIT` is applied through the W200 `clipEnd` (`ct`).
  Resources and templates are inputs, so `aAt`/`ose` can supply them in W202 without
  changing this signature.
- `src/tui-agent-suggestions.ts` (new): `agentSuggestionRows` ports `HDt`,
  `agentColor` ports `wLe` over the `BM` table, and `AGENT_DESCRIPTION_LIMIT` is `BDt`.
- `src/tui.ts`: the `TuiTerminal` options gain `agentTypes`, and `atSuggestionRows` feeds
  the roster into `combinedAtRows` beside the file index. The rows keep `kind: 'file'`
  because `tse` labels the whole list as one suggestion family, so they splice and lay out
  through the W200 path unchanged.
- `src/cli.ts`: passes `currentSession.config.agentTypes`.
- `package.json`: `fuse.js` 7.1.0, the nearest published 7.x to the bundle's bundled build
  (7.1.4 is not on the registry). Only W202's resource ranking changes if that version
  differs; the agent path uses the same instance at the same options.

Two adaptations are recorded rather than ported verbatim:

- The source reads a per-session colour override store, and its `wLe` also consults
  `bLe` (`userOverride ?? agentDefinitionColor`) at the call site. The local row builder
  takes the override map as an argument and defaults to empty; the slot table itself is
  exact.
- `HDt` maps `he.whenToUse`; the local `AgentTypeInfo` names that field `description`, so
  the port reads `description`.

## Validation

- `test/tui-agent-suggestions.test.ts` (new, 4 tests): the `agent-` ids, `<type> (agent)`
  display text, the sixty-cell cut with its ellipsis, the empty-query gate, the
  name-or-display-text filter (a query no type name contains), and the colour slots
  including `general-purpose` refusing one.
- `test/tui-at-suggestions.test.ts` (new, 9 tests): the empty-query family order, the
  `showOnEmpty` gate, the shared fifteen-row cap, file score ordering, an exact agent name
  outranking a weak file, the resource 0.15 offset against an identical template, the
  template's literal head, the resource description fallback, and `templatePrefix`.
- `test/tui-autocomplete.test.ts` 21/21: new composer test types `@rev` with an
  `agentTypes` option, asserts `* reviewer (agent)` and its description, asserts the filter,
  then the shared-prefix fill and the submit.
- Full suite 2728/2728 (118 suites), `npm run check` and `npm run build` clean.
- Compiled probes at 90x30 through a `stty_init`-sized `pty-cli.exp` wrapper, with the
  agent definitions in a separate `--user-dir` so the workspace index is empty:
  - `@rev` draws `❯ * reviewer (agent) – Reviews a change` above the composer, and Enter
    fills `@reviewer (agent)`.
  - With a `src/reviewer.ts` in the workspace, `@rev` draws the file row first
    (`❯ + src/reviewer.ts`) and the agent row second (`  * reviewer (agent) – Reviews a
    change`), and Enter accepts the file row.

Raw samples stay unchanged; no recovered entrypoint is executed.
