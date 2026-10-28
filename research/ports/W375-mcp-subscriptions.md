# W375 — MCP resource subscriptions: delivery contract and reconnect

Status: reconciliation with one delivery-description correction. Identity c9d7e6de. Base: a7a56d5 (W374).

## Predicate

The advertised delivery contract names both HTTP channels, and the reconnect desired-set restore, generation retirement and unsubscribe pass the compiled drivers.

## Source position

- A subscription update is a bare notification with no identity or sequence (`Qs` [6035,6058) and `ea` [6059,6126), chunk-2rxk8n7w.js, per remaining-dispositions.md item 7); the recovered client delivers updates only on its listen stream, and the host's opted-in GET stream feeds the same `notification` handler that the POST stream uses.
- Reconnect: `replace` freezes subscription mutations, takes the acknowledged desired set, restores it on the validated candidate, commits the new generation and closes the old connection (src/mcp.ts:1760-1808); `prepareReplacement`/`restore` own the freeze and replay (src/mcp-subscriptions.ts:109-121, [70,74)).
- Per-update replay stays disposed: remaining-dispositions.md item 7 records that the specification defines no request that re-announces an individual update.

## Product change

The `mcp_resource_notifications` tool description said HTTP delivery covers active POST SSE responses only. The opted-in GET stream dispatches `notifications/resources/updated` through the same handler (src/mcp-http.ts:351-363, fed by the stream at :440), so the description now names both channels. No behaviour changes. The limits array keeps its conditional base string: when the notification stream is enabled the render replaces "no GET stream or continuous HTTP push" with the owned GET stream wording (src/mcp.ts:2021-2024), so the base string is correct when the stream is off.

## Validation

- `test/mcp-subscriptions.test.ts` 9/9.
- `node scripts/smoke-mcp-subscriptions.mjs`: stdio push, exact URI, unsubscribe and connection close pass, 0 automatic reads.
- `node scripts/smoke-mcp-reconnect-cli.mjs`: explicit reconnect, failed reconnect retained, pinned config, changed-schema journal, old session closed, no effect replay, locks released; 4 owned loopback model calls.
- `node scripts/smoke-mcp-persistence-cli.mjs` failed at its `/fork` step during W375. The old wait conflated a CLI exit with a timeout; the reported outcome did not establish which occurred. At a later compiled baseline, W383 observes the old assertion selecting the parent's `session:` ID; its updated driver verifies the persistence chain, while the family stays Partial.
- Check and build pass. Full suite 3457/3457 across 118 suites, 0 fail/cancel/skip/todo. Identity c9d7e6dee72f72aa8cb13968d641bdd2e40d15e53a1380bf799c54a947bb3fe5 (941 input / 360 validation / 662 build records).

One bounded independent reader confirmed every claim with exact evidence: the single-line product diff, the conditional limits replacement and its runtime rendering with the stream off and on, the GET delivery path and its existing test, the reconnect freeze/restore/commit/close chain, the three validation results, the notification citation and the disposition. It found no defect. Two precision notes were repaired: the reconnect range now ends at 1808 (`old.close()`), and the citation now gives `Qs` [6035,6058) and `ea` [6059,6126) separately. Two incidental pre-existing notes stay out of this package: the `no standalone GET stream,` replacement at src/mcp.ts:2021 never matches the transport string (it says `or`, not a comma), and remaining-dispositions.md numbers two sections 7.

## Dispositions

- Lost resource-update replay: remaining-dispositions.md item 7 (no protocol or source basis; a lost update is stale-known and the content is re-read on the next `resources/read`).
- Server-reported subscription reconciliation: remaining-dispositions.md item 8 (the host does not use `subscriptions/listen`).
- At W375's identity, the persistence driver's `/fork` dependency blocked that acceptance chain; W383 updates the stale fork observer and re-verifies the compiled chain. The subscription delivery/reconnect scope remains independently verified by the reconnect driver and suite.

## Reproduction

```sh
node --import tsx --test test/mcp-subscriptions.test.ts
node scripts/smoke-mcp-subscriptions.mjs
node scripts/smoke-mcp-reconnect-cli.mjs
```
