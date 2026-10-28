# W374 MCP transports: list change and reopen refresh

Reconciliation package. Base e976c79 (W372 review repair). Family: MCP transports and catalogs (stays Partial for parked subscriptions/listen and the codec).

## Predicate

Tools, prompts and resources each adopt a list_changed notification, and a recovered HTTP GET stream refetches every advertised catalog on reopen, in the actual compiled CLI.

## Source owners (extracted-v2, zero-based half-open UTF-16)

- `Vm` chunk-sb190ksj.js [118119,118292) 4f0215f15fa748d4: registers the tools handler; a notification clears the paged tools list-ahead state (`$Br`) and coalesces a refetch; a change that arrived before handler registration replays once (`rGo`/`I6e`).
- `Km` [118292,118418) 60ee084f1cb12f5a: prompts handler through the coalescing notifier `T2e`.
- `Gm` [118418,118548) 84bdd21e37103cf7: resources handler through `T2e`.
- `T2e` chunk-zqyjdv9s.js [7849,8425) 763a7b255f5882f2: coalesces list_changed and refetches the catalog with the last cause, logging a failed refetch.
- `$Br`/`rGo` chunk-89aw29ag.js [1472,1614) 9cce43981ebab747 / [1614,1781) 4c1f02426e1a329d: a list_changed that arrives before the tools handler registers is remembered and replayed.
- `ka` chunk-sb190ksj.js [48170,48515) b71af41f58922d44: on reopen, calls the registered tools/prompts/resources refetch handlers selected by the server's listChanged capabilities.
- `Ia` [48913,50690) bf8a088b42d8e6f4: the recovered listen/reopen loop (its text names `subscriptions/listen`; the host maps it to the GET stream).

## Host owners

`src/mcp.ts` dispatch [850,865) (stdio); `DynamicMcpCatalog` [1297,1415) (dirty set, background refetch, coalescing); `initialDirty`/`markDirty` [1907,1981) (early tools change); `src/mcp-http.ts` notification [350,365) and `refetchReopenedCatalogs` [368,378), gated on the advertised `listChanged`.

## Result

All three compiled acceptance drivers pass on identity dc976fb5: resource refresh 9 checks/0 model requests, prompt 11 checks/2 owned loopback model requests, reopen 8 checks/4 GETs/0 model requests. No product change; the host matches the source bodies with recorded adaptations (background refetch instead of an in-handler await, cause-tagged catalog publish, tools-only early replay as in the source).

## Plan

- [x] Measure source bodies and digests.
- [x] Map host owners and compare semantics.
- [x] Run the three compiled drivers on the current build.
- [x] Record W374 and update the closure row, FEATURES and CURRENT.
- [x] One bounded independent reader verified 8/8 ranges, the module digests, the source behaviour, the host wiring and the three driver counts with no factual mismatch; its three presentational notes are repaired in the record.

Local only. No account, OAuth, hosted subscription, paid upstream, push, coauthor or schedule.
