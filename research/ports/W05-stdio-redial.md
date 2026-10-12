# W05 stdio re-dial on next use

Status: verified finite stdio recovery chain. Date: 2026-10-12.
Task: a failed stdio child -> transport closed and cache cleared -> the next tool call or catalog request dials one fresh process -> pinned tool metadata is re-validated before the call -> the call runs on the new process; without recovery the connection stays unavailable until an explicit reconnect.
Entry: `features.mcpRecovery: true` in settings; the recovery flag that already governs HTTP replacement now also governs use-driven stdio re-dial. Absent/false preserves the previous fail-closed behavior.
Targets: mcp.ts (ManagedMcpClient callTool/catalogRequest, limits text), test/mcp.test.ts, scripts/smoke-mcp-stdio-redial.mjs.

## Provenance and adaptation

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Module chunk-sb190ksj.js SHA-256 0a1c2aa1424babd95eeec371f67c875b6382db0c891b3b3e90f710f2102b16df. All ranges are zero-based UTF-16, left-closed/end-exclusive, read from extracted bytes as inert data:

- Fatal failure closes only: `et` [102466,102534) `if(Jt)return;Jt=!0,wt.closeReason=b,re(e,"Closing transport"...`; `se.onclose` [107489,107545) and the cache invalidation that follows [107903,107987) `ko().connections.delete(Z),re(e,"Cleared connection cache for reconnection"),kt)kt()`.
- Re-attach is lazy and spawns a new process: ensure-connected `no` [119034,119113), whose dial is `h=s===void 0?Lt(e.name,e.config):Lt(e.name,e.config,void 0,void 0,void 0,s)` [119632,119708); `Lt` [76848,76883) is the memoized dial factory that constructs a fresh `BoundedStdioClientTransport` (`class Rt extends br` [26161,26374)) on every call.
- In-connect restart is separately bounded: the version-probe fallback re-spawns once "restarting it once without the probe, within the remaining connect budget" [92972,93045).

These are source declarations, not runtime observation.

Classification: copy of the lifecycle shape with an owned placement. The recovered client re-dials unconditionally on next use; this harness keeps one owner for transport replacement and therefore routes the dial through the existing `replace()` path — the same candidate-dial, catalog validation, subscription restoration and rollback that HTTP recovery and explicit reconnect already use — instead of adding a second dial path. Owned decisions, marked as such: the behavior is gated by the existing `mcpRecovery` opt-in rather than being unconditional, one attempt per call is enforced (no loop, no timer), and the pinned-metadata check runs after the dial so a server whose tool schema changed cannot serve the definition the caller already saw. Not ported: the connect-time probe restart (this harness has a single protocol version and no probe) and the memoized connection cache (the managed client holds its own current transport). No recovered entrypoint was executed.

## Contract and boundaries

A disconnected managed stdio client no longer fails the call outright when recovery is on: `callTool` and `catalogRequest` first attempt exactly one replacement, then proceed. The replacement increments `generation` and `attempts`, rebinds listeners and re-validates the whole catalog against the collision and byte limits before it is adopted; a failed replacement keeps the old (dead) transport, leaves the state `disconnected` and surfaces the dial error, so the following call tries once more. Without recovery the call fails with the fixed disconnected message and no process is spawned. An explicit `/mcp-reconnect` still works for stdio and remains the only path when recovery is off. A crashed child never replays the failed call; only the call that arrives after the failure is attempted.

## Validation

Three actual-CLI modes of the new driver `npm run smoke:mcp-stdio-redial` against a fixture that exits on its first tool call: source with recovery (2 distinct processes, the second call's result reaches the model), source without recovery (1 process, the model sees the disconnected error, no result), and the compiled entrypoint with recovery (2 processes, result delivered). Focused MCP suites 46/46. Full suite 1049/1049, fail 0. Detailed identity, receipts and intermediate failures: [W05-stdio-redial-evidence.json](W05-stdio-redial-evidence.json).
