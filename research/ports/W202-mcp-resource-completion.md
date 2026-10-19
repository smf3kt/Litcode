# W202 MCP resource and template completion

Status: implemented locally on `work/w43-choice-preview`. Follows W201. No push, no
upstream calls.

## Request

Loop prompt 「继续完善tui，直到搬运剩余还没做的的功能的tui显示」, next item in
`.audit/tui-remaining.todo.md`: the `mcp-resource-` and `mcp-template::` id families, their
row branches, and the `@server:` explicit form.

## Recovered source

- `chunk-24k7d6mw.js`, sha256
  `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`: the resource and
  template rows inside `tse` 562716, the adapter `$0e` 561755, the explicit list `ose` 564216,
  the replacement shaping `ese` 565691, the template head `Nre` 491566, the replacement test
  `JI` 491357, the description cut `q0` 560849, and the accept gate 583448.
- `chunk-n3ykh62m.js`, sha256
  `2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac` at 378662: the app-only
  filter `aAt` with its constants `Xc` = `ui://`, `S1` = 1024, `y1` = `mcp-app`, `Jc`, `_1`
  and `Ip`.

Coordinates are zero-based UTF-16 offsets.

**The rows** (`He`/`$e` inside `tse`): both listings are flattened server-first and filtered
through `aAt`. A resource reads `${server}:${uri}`; a template reads
`${server}:${Nre(uriTemplate)}`, so the display text stops at the first placeholder. Both cut
their description with `q0` to 60 cells, falling back description → name → URI.

**The app-only filter** (`aAt`): hidden when the URI starts with `ui://`, or when the mime
type parses as `text/html` and carries a `profile=mcp-app` parameter. A mime type over 1024
characters, or one that does not parse, is listed.

**The adapter** (`$0e`): `mcp-resource-${server}__${uri}`, and
`mcp-template::${server}__${uriTemplate}` carrying `metadata.replacement` and
`metadata.partial = true`.

**The replacement** (`ese`): a text with a space is quoted, and a partial never closes the
quote. Unlike `dse` it adds no trailing space, so an accepted template leaves the draft open.

**The explicit form** (`ose`): a `server:` partial filters that server's templates to the
ones whose `uriTemplate` starts with the typed remainder and is longer than it, then returns
up to `W0` rows. Null means "no explicit answer", and the caller falls through to `tse`.

**The accept**: the composer skips the shared-prefix fill entirely when any row carries a
replacement (`Gs = Ct.some(JI) ? "" : k6r(Ct)`) and writes `${replacement}${partial ? "" : " "}`.

## Change

- `src/tui-at-suggestions.ts`: `isUiOnlyResource` (`aAt`), `mcpResourceRows` (`He`),
  `mcpTemplateRows` (`$e`), `shapeTemplateReplacement` (`ese`), `AtSuggestionRow.metadata`,
  and `$0e`'s template metadata. `CombinedAtOptions` now takes the source's own shape,
  `mcpResources` and `mcpResourceTemplates` keyed by server name.
- `src/tui-mcp-suggestions.ts` (new): `templateArgumentRows` ports `ose`'s static branch.
- `src/tui.ts`: `TuiOptions.mcpCatalog` is a one-shot loader; `ensureMcpCatalog` reads it on
  the first `@` draft and repaints the band when it lands, the same shape as the W200 file
  index. `atSuggestionRows` tries the explicit template list before the explicit path and the
  combined provider, and `acceptAutocomplete` gains the replacement branch and the
  shared-prefix skip.
- `src/mcp.ts`: `listMcpCatalog` and `McpConnection.catalogListing`, present only in catalog
  mode. Each capable server is read once through the existing bounded, cursor-cycle-checked
  pagination, capped at 500 entries per family, and a server that fails contributes nothing.
- `src/runtime.ts` and `src/cli.ts`: pass the accessor through to the TUI.

Three adaptations are recorded rather than ported verbatim:

- The source reads a live React store that its MCP clients fill at connect and refresh on
  `resources/list_changed`. The local render path is synchronous, so the listing is read once
  in the background on the first `@` and the band repaints when it arrives. A later
  `list_changed` does not refresh it.
- `ose` first completes the next template argument through the connected client
  (`o0e`/`bEt`/`n0e` plus `completeResourceTemplate`). That path needs a live server round
  trip; only the static prefix list is ported, and the dynamic path is not.
- `ose` runs only when the token starts with `@` and the session is not a remote host
  (`!Ht()`). The local product is always the local host, so the gate is always open.

## Validation

- `test/tui-at-suggestions.test.ts` 18 tests: the new ones cover the `ui://` and
  `profile=mcp-app` filters (including a quoted parameter, a wrong subtype and an oversized
  mime type), the two row builders dropping hidden entries, the template row's metadata, and
  `shapeTemplateReplacement`.
- `test/tui-mcp-suggestions.test.ts` (new, 4 tests): the explicit prefix list, the hidden
  template, the null cases (no colon, unknown server, empty remainder, already complete), and
  the description fallback.
- `test/mcp-catalog.test.ts` 10/10: new tests assert `catalogListing` returns both families
  with the server prefix and is absent without catalog mode.
- `test/tui-autocomplete.test.ts` 22/22: a new composer test lists `◇ docs:docs://guide`,
  narrows to `◇ repo:repo://file/` on the explicit form, and asserts the accept writes
  `@repo:repo://file/` without submitting.
- Full suite 2740/2740 (118 suites), `npm run check` and `npm run build` clean.
- Compiled PTY probe at 90x30 against an owned HTTP MCP fixture serving one resource and one
  template: `@repo` draws `◇ repo:repo://file/ – File` and `◇ repo:repo://notes – Notes`;
  `@repo:repo://fi` narrows to the template row alone; Enter leaves `@repo:repo://file/` in
  the draft and submits nothing.

Raw samples stay unchanged; no recovered entrypoint is executed.
