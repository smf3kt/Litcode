# W375 MCP resource subscriptions: delivery contract and reconnect

Reconciliation package with one description correction. Base a7a56d5 (W374). Family: MCP resource subscriptions.

## Predicate

The advertised delivery contract names both HTTP channels, and the reconnect desired-set restore, generation retirement and unsubscribe pass the compiled drivers.

## Evidence

- Delivery: `McpHttpClient.notification` (src/mcp-http.ts:351-363) dispatches `notifications/resources/updated` to `resourceSubscriptions.updated`; the opted-in GET stream feeds the same method at src/mcp-http.ts:440. The limits base string stays conditional ("no GET stream") because the render adds the GET wording only when the stream is enabled (src/mcp.ts:2021-2024); the uncorrected surface was the static `mcp_resource_notifications` description.
- Reconnect: `replace` freezes mutations, takes the acknowledged desired set, restores it on the validated candidate, commits the new generation and closes the old connection (src/mcp.ts:1760-1808); `prepareReplacement`/`restore` in src/mcp-subscriptions.ts.
- Per-update replay stays disposed (remaining-dispositions.md item 7).

## Result

- `test/mcp-subscriptions.test.ts` 9/9.
- `node scripts/smoke-mcp-subscriptions.mjs`: stdio push, exact URI, unsubscribe and connection close pass, 0 automatic reads.
- `node scripts/smoke-mcp-reconnect-cli.mjs`: explicit reconnect, failed reconnect retained, pinned config, changed-schema journal, old session closed, no effect replay, locks released; 4 owned loopback model calls.
- `node scripts/smoke-mcp-persistence-cli.mjs` fails at its `/fork` step on the current build (the CLI exits while the driver waits for the `session:` marker; reproduced twice). That step belongs to the session-fork family, so the persistence chain is not re-verified here and the family stays Partial.

## Plan

- [x] Correct the `mcp_resource_notifications` description; leave the conditional limits base string and its render replacement as designed.
- [x] Run the subscription suite and the two passing drivers; record the persistence driver blocker.
- [x] Record W375, update the closure row and FEATURES.
- [x] Full suite 3457/3457 across 118 suites; identity c9d7e6de.
- [x] One bounded independent reader confirmed every claim with exact evidence and no defect; its two precision notes (reconnect range endpoint, citation split) are repaired in the record.

Local only. No account, OAuth, hosted subscription, paid upstream, push, coauthor or schedule.
