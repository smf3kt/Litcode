# W374 — MCP transports: list change and reopen refresh

Status: reconciliation and compiled verification, no product change. Identity dc976fb5. Base: e976c79 (W372 review repair).

## Source position

All coordinates are zero-based half-open UTF-16 code units in the extracted 2.1.296 sample (artifact `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`). `body16` is the first 16 hex of sha256 over the UTF-8 bytes of the code-unit slice, the same encoding as the other records.

| Symbol | Module | Range | body16 |
| --- | --- | --- | --- |
| `Vm` (tools handler) | chunk-sb190ksj.js | [118119,118292) | 4f0215f15fa748d4 |
| `Km` (prompts handler) | chunk-sb190ksj.js | [118292,118418) | 60ee084f1cb12f5a |
| `Gm` (resources handler) | chunk-sb190ksj.js | [118418,118548) | 84bdd21e37103cf7 |
| `T2e` (coalescing notifier) | chunk-zqyjdv9s.js | [7849,8425) | 763a7b255f5882f2 |
| `$Br` (early change) | chunk-89aw29ag.js | [1472,1614) | 9cce43981ebab747 |
| `rGo` (handler registration) | chunk-89aw29ag.js | [1614,1781) | 4c1f02426e1a329d |
| `ka` (reopen dispatch) | chunk-sb190ksj.js | [48170,48515) | b71af41f58922d44 |
| `Ia` (reopen loop) | chunk-sb190ksj.js | [48913,50690) | bf8a088b42d8e6f4 |

Module digests: chunk-sb190ksj.js 0a1c2aa1424babd95eeec371f67c875b6382db0c891b3b3e90f710f2102b16df (198048 bytes); chunk-zqyjdv9s.js 8ec0e33931aebba32cca32bb658513e5588ec3079d53c456e08d032d539b0b63 (19068 bytes); chunk-89aw29ag.js 2b85979055f6175ee3b65dcf49dd3f23e1c65a5cf1719c7b0b6c948c07ba3f49 (2353 bytes).

## Source behaviour

- `Vm` registers the tools notification handler: `setNotificationHandler("notifications/tools/list_changed", h => ($Br(r), s(h)))`. `$Br` clears the paged tools list-ahead state (its timer, page and expiry) and marks whether a change arrived before handler registration; `rGo` returns that flag and marks the handler registered, and `Vm` then calls the notifier once with `I6e` so an early change is replayed.
- `Km` and `Gm` register the prompts and resources handlers through `T2e`, the coalescing notifier.
- `T2e(e, r, o)`: each notification sets a pending flag and records the last cause; a drain calls `r(cause)` once, and a failed refetch is logged as "list_changed refetch failed".
- `ka(e, n, r, s)`: on reopen, reads the registered handlers and calls the tools, prompts and resources refetch handlers selected by the server's `listChanged` capabilities, logging a failed one as "post-reopen list refetch failed".
- `Ia` owns the recovered listen/reopen loop: its text names `subscriptions/listen`, and the host maps it to the GET notification stream; it reopens after the stream closes, within a 1/2/4-second retry budget and a five-attempt park, then re-listens and calls `ka`.

## Host mapping

- `src/mcp.ts` stdio dispatch [850,865) emits tools changes, and prompts/resources changes gated on `supportsCatalog`.
- `DynamicMcpCatalog` [1297,1415): a tools listener increments the revision, marks the server dirty and refetches in the background; passes are serialized through one queue and coalesced per server; a change during a pass schedules exactly one follow-up.
- `initialDirty`/`markDirty` [1907,1981): the tools listener is registered before `initialize`, so a change before the dynamic catalog exists is recorded and refetched at construction.
- `src/mcp-http.ts` notification [350,365) mirrors the stdio dispatch; `refetchReopenedCatalogs` [368,378) calls the tools, resources and prompts listeners after a successful recovery GET, gated on each advertised `listChanged`, with the cause `reopen`.
- The prompt and resource catalogs publish cause-tagged changes (`notification` or `reopen`) to their consumers.

## Adaptations and limitations

- The host refetches a changed tools catalog in the background instead of awaiting the refetch inside the notification handler; the decision is the same and a failed pass leaves the server dirty for the next call.
- The source's early-change replay exists for tools only; the host reproduces it through `initialDirty`. Prompts and resources have no early replay in either.
- Parked subscriptions/listen and the codec remain separate owners and are not part of this predicate.

## Validation

The three existing compiled acceptance drivers pass on identity dc976fb5117db23aaab4ad578856cadeef8122dac6c55ac9bd3ec250b62b1bb0 (941 input / 360 validation / 662 build records):

- `node scripts/smoke-mcp-resource-refresh-cli.mjs`: 9 checks, 0 model requests.
- `node scripts/smoke-mcp-prompt-cli.mjs`: 11 checks, 2 owned loopback model requests.
- `node scripts/smoke-mcp-reopen-refresh-cli.mjs`: 8 checks, 4 GETs, 0 model requests.

Check and build pass; the full suite passes 3457/3457 across 118 suites at the same identity. No product files changed, so no new regression group or red baseline applies.

One bounded independent reader verified the eight source ranges and digests (8/8), the module digests and sizes, the quoted source behaviour, the host wiring and the three driver counts. It found no factual mismatch. Its three presentational notes were repaired in this record: the `body16` encoding is now stated, the `initialDirty` range ends at 1981, and the `Ia` description now says its text names `subscriptions/listen` and that the host maps it to the GET stream.

## Reproduction

```sh
node scripts/smoke-mcp-resource-refresh-cli.mjs
node scripts/smoke-mcp-prompt-cli.mjs
node scripts/smoke-mcp-reopen-refresh-cli.mjs
```
