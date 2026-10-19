# W200 `@path` file completion

Status: implemented locally on `work/w43-choice-preview`. Follows W199. No push, no
upstream calls.

## Request

Loop prompt 「继续完善tui，直到搬运剩余还没做的的功能的tui显示」, next item in
`.audit/tui-remaining.todo.md`: the `@path` trigger, the `file-` id family and the
three-column row layout.

## Recovered source

- `chunk-24k7d6mw.js`, sha256
  `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`: the separator
  class `S5` (chunk-sfn1dbxq.js 3565490), the token regexes `jDt` 565774, `V0e` 565816,
  `WDt` 565857, `qDt` 565934, `$Dt` 565975 and `VDt` 565998; the parser `ak` 568974, the
  partial accessor `lse` 567681, the display shaping `dse` 567832 and `ese` 565691, the
  explicit-path test `Ure` 502887, and the directory provider `jre` 503694 over `I0e`
  501861, `bDt` 501669 and `kDt` 503023.
- `chunk-vr7yfckx.js`, sha256
  `3f82078066ff8460dd7239a5535627a492ce1771a0b08dec654b5af955eeb7c6`: the provider
  `SDs` 9313, the `file-` row `C` 8050, the cwd listing `H` 9002, the limit `k` 8140 with
  `qQe` 15, the longest common prefix `k6r` 7894, and the splice `pbn` 10590.
- `chunk-3cynezh1.js`, sha256
  `c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3`: the fuzzy index
  `mnn` [93619,97113) and its scoring helpers `tp` 97113, `Fr` 97285, `$r` 97370, `np`
  97504, `op` 97573, `sp` 97609, `rp` 97644 and `ip` 97840.
- `chunk-qfjvvwpv.js`, sha256
  `116de8fc147859476928cc4bb1a0c61d1a54b1373f46eb01bfee91349e1b2504`: the row families
  `ue` 2788 and `Zt` 3955, the row renderer `ze` [4084,8770) and the row height `_o`
  10835.
- `chunk-yn0pfn70.js`, sha256
  `1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f`: the path cuts
  `ct` 8443, `OO` 8612 and `hc` 8192, and the head cut `qB` 8856.

Coordinates are zero-based UTF-16 offsets.

**The index** (`mnn`): each path is lower-cased and given an a-z bitmask, a length, and a
basename offset with its own mask. A search pre-filters on the query's bitmask, greedily
matches the query characters in order, and scores the result from the contiguous runs, the
gap penalties, the boundary and camel-hump bonuses (`$r`/`Fr`), an optional basename pass
that can outrank a directory match (`tp`), and the path length. The bounded top-N list
keeps the best scores only; the final score is the rank ratio, lifted 5% for a path
containing `test`. An empty query lists the shallowest distinct directories (`ip`).

**The provider** (`SDs`): an empty, `.` or `./` partial lists the working directory; any
other partial strips a leading `./`, expands `~`, and runs `index.search(query, 15)`.
Each match becomes `{id: "file-<path>", displayText: "<path>"}`; the composer's rows carry
no description.

**The directory family** (`jre`): an explicit partial (`Ure`: `~/`, `/`, `./`, `../`, or
exactly `~`, `.`, `..`) lists one directory instead. Directories sort first, the filter is
a case-insensitive prefix, the listing is capped at 5000 entries and returns 10 rows, and a
directory keeps a trailing separator. These rows carry the bare path as their id, so they
take the plain row layout rather than the file glyph.

**The trigger** (`ak` with its file flag, gated by `VDt`): a quoted token `@"..."` wins
first; then an `@` at the draft's start or after a separator, whose run must be entirely
at-head characters; otherwise the last path run in the text. The token continues past the
cursor (`V0e`), and the partial is the token without its `@` or quotes (`lse`).

**The accept** (`dse` + `pbn`): Tab first fills the longest common prefix of the rows
(`k6r`) when it is longer than what is typed, then a second Tab accepts the selected row.
An accepted path keeps its `@`, becomes `@"path"` when it contains a space, and adds one
trailing space when complete. The splice replaces the whole token, `@` included.

**The row** (`ze` special branch, `Zt`/`ue`): `file-`/`mcp-resource-`/`mcp-template`/
`agent-` rows draw a lane glyph instead of the kind lane (`+`, `◇`, `◇`, `*`). A file row
reserves a description column capped at 20 cells, cuts the path to the remaining budget
with the middle cut `hc` (which keeps the basename), then cuts the description with `ct`.
Such a row is always one line (`_o`).

## Change

- `src/tui-file-index.ts` (new): `FileIndex` ports `mnn`, with `tp`, `Fr`, `$r`, `np`,
  `op`, `sp`, `rp` and `ip`. The source's async build and cache generation are not ported:
  the search is synchronous and the caller owns the build.
- `src/tui-file-suggestions.ts` (new): the separator class, the five token regexes, `atToken`
  (`ak`), `atPartial` (`lse`), `isExplicitPath` (`Ure`), `atQuery`, `fileSuggestionRows`
  (the local branches of `SDs`), `listWorkingDirectory` (`H`), `splitDirectoryQuery`
  (`bDt`/`I0e`), `directorySuggestionRows` (`jre`/`kDt`), `commonPrefix` (`k6r`),
  `shapeAtDisplayText` (`dse`) and `applyFileSuggestion` (`pbn`).
- `src/tui-autocomplete.ts`: `CommandSuggestion.kind` gains `'file'` and `'directory'`;
  `isSpecialRow` (`Zt`) and `specialRowGlyph` (`ue`); `clipEnd`/`clipHead`/`clipLeading`/
  `clipMiddle` port `ct`/`qB`/`OO`/`hc`; `suggestionRowSegments` gains the special branch of
  `ze`; `suggestionRowHeight` returns 1 for a special row (`_o`).
- `src/tui.ts`: the `@` query is tried after the emoji and command providers, which is the
  source's order. `atSuggestionRows` produces the rows, `directoryListing` caches a
  directory for the source's 15-second TTL, and `acceptAutocomplete` gains the file accept
  (shared prefix, then the selected row). The index is built once, in the background, on
  the first `@`: `git ls-files` plus `git ls-files --others --exclude-standard`, with a
  bounded directory walk when the workspace is not a repository.

Two adaptations are recorded rather than ported verbatim:

- The source's index refresh is event-driven: a background promise, a git-index mtime
  check and a cache generation, all tied to its async React store. The local render path is
  synchronous, so the index is built once per process and the refresh machinery is omitted.
  A stale index only changes which paths are offered, never how a row is drawn.
- The source's `kDt` directory listing is async with the same cache. The local listing is a
  synchronous `readdirSync` behind the same 15-second TTL.

`truncateCells`, the W197/W198 port of the plain row's cut, is corrected to `ct`: the
source appends an ellipsis, which the earlier port dropped. The plain row's name now reads
`/mo…` at 20 columns rather than `/mod`, and `splitDescription` keeps the unellipsised
`qB` head it needs.

## Validation

- `test/tui-file-index.test.ts` (new, 8 tests): basename outranking, boundary and camel
  bonuses, original-offset positions, the letter prefilter, the top-level listing and its
  order, the `test` lift and score range, dedupe, the limit and the empty index.
- `test/tui-file-suggestions.test.ts` (new, 11 tests): token parsing including the quoted
  form and a run-internal `@`, the explicit-path set, the query gate, the `file-` rows, the
  `./` strip and `~` expansion, the cwd listing, the directory ordering and prefix filter,
  the common prefix, the display shaping with quoting, and the splice.
- `test/tui-autocomplete.test.ts` 20/20. New: a file row draws `❯ + …`, keeps its basename
  through the middle cut at 40 columns, stays one line with a description, and shows the
  ` – ` separator; the composer test opens the list on `@src/al`, Tabs to the shared
  prefix, Tabs again to accept without submitting, and shows the plain explicit-path rows.
  The 20-column assertion moves from `/mod` to `/mo…` for the `ct` correction.
- Full suite 2714/2714 (118 suites), `npm run check` and `npm run build` clean.
- Compiled PTY probe at 100x40 over a temp git workspace with three tracked files and one
  untracked file: `@alp` draws `❯ + src/alpha.ts`, `+ src/alphabet.ts`,
  `+ src/alpine.untracked.ts`; Tab fills `@src/alp`; a second Tab accepts
  `@src/alpha.ts `; `@./src/` lists `src/very/` first and then the files, in the plain
  layout.
- A second compiled probe at 44x30: `@ome` draws
  `❯ + src/very/deeply/nested/dir…/omega.ts`, the middle cut keeping the basename, and
  `@src/very` draws the same row one line above the composer.

Raw samples stay unchanged; no recovered entrypoint is executed.
