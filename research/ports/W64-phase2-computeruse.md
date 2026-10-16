# W64 — phase 2 package 4: the Computer Use cluster

Status: verified (independent review not run — gateway rate-limited until 2026-10-17 21:17 UTC+8). Base commit `453b8e3`. 17 files deleted (2,679 lines) plus site cuts in 9 hosts and the `@ant/*` vendor block (26 files, +5/−2,895 total); `tsc --noEmit --pretty false` exits 0. User directive: continue with the computerUse cluster.

## Removed

- `utils/computerUse/` (16 files: `appNames.ts`, `cleanup.ts`, `common.ts`, `computerUseLock.ts`, `drainRunLoop.ts`, `escHotkey.ts`, `executor.ts`, `gates.ts`, `hostAdapter.ts`, `inputLoader.ts`, `mcpServer.ts`, `setup.ts`, `swiftLoader.ts`, `toolRendering.tsx`, `wrapper.tsx`)
- `components/permissions/ComputerUseApproval/` (its only importer was `wrapper.tsx`)
- the `declare module '@ant/*'` block in `types/vendor.d.ts` (70 lines) — after this cut nothing in the tree imports any `@ant/…` specifier, including the two that W63 left behind

Three `*.w54bak` inline source maps are quarantined to `.audit/w64-source-baks/` and byte-compared.

## Site cuts

| Host | Cut |
| --- | --- |
| `entrypoints/cli.tsx` | the `--computer-use-mcp` branch (10 lines); the argument chain now ends after the `--dump-system-prompt` branch |
| `main.tsx` | the reserved-MCP-name machinery (`nonSdkConfigNames`, `reservedNameError`, the CHICAGO_MCP arm and its `process.exit(1)` block — the CU arm was the only producer of a reserved name) and the whole chicago setup block (31 lines: `getChicagoEnabled` gate, `setupComputerUseMCP`, the `dynamicMcpConfig`/`allowedTools` merge) |
| `query.ts` | two `cleanupComputerUseAfterTurn` calls with their comments — the interrupt path and the aborted-mid-tool-call path |
| `query/stopHooks.ts` | the turn-end `cleanupComputerUseAfterTurn` call and the CU-lock rationale comment |
| `services/analytics/metadata.ts` | `BUILTIN_MCP_SERVER_NAMES` and its require; the `mcpToolDetailsForAnalytics` gate now calls `isAnalyticsToolDetailsLoggingEnabled` directly (the set was empty, so the dropped conjunct was already a no-op) |
| `services/mcp/config.ts` | the `feature` import, the `addMcpServer` reserved-name guard, `DEFAULT_DISABLED_BUILTIN`/`isDefaultDisabledBuiltin`, the built-in arm of `isMcpServerDisabled`, and the built-in arm plus `tengu_builtin_mcp_toggle` event of `setMcpServerEnabled`; the two now-unused analytics imports went too |
| `services/mcp/client.ts` | the `computerUseWrapper`/`isComputerUseMCPServer` lazy declarations, the in-process Computer Use branch of `connectToServer`, and the `getComputerUseMCPToolOverrides` spread in `fetchToolsForClient` |
| `state/AppStateStore.ts` | the `computerUseMcpState` field and its inlined grant/display type block (46 lines) |
| `utils/cronTasksLock.ts` | the header sentence pointing at the deleted `computerUseLock.ts` as the pattern source |

## Kept, with reasons

- `skills/bundled/claude-api/shared/{live-sources,tool-use-concepts}.md` still mention computer use as an API concept. They are documentation for the bundled claude-api skill, not the harness feature, and the skill is coding-facing.
- Nothing else references the cluster: a residual scan for `computeruse|computer-use|COMPUTER_USE|tengu_malort_pedway|sentinelApps` over the tree (excluding the two docs above) is empty.

## Verification and limits

`tsc --noEmit --pretty false` exits 0. All four owned fixtures (`w58-verify`, `w59-verify`, `w59-followup-verify`, `w60-verify`) pass. `git diff --check` clean. The base has no test suite or runtime, so the acceptance surface is the compiler plus fixtures — no CLI ran, and no recovered entrypoint was executed.

Adaptation notes, each a deletion of code that could no longer run rather than a rewrite: `setMcpServerEnabled` and `isMcpServerDisabled` lost their built-in-server arms (`isDefaultDisabledBuiltin` returned false unconditionally once `DEFAULT_DISABLED_BUILTIN` was null); `mcpToolDetailsForAnalytics` lost a conjunct that an empty `BUILTIN_MCP_SERVER_NAMES` made vacuously true; `main.tsx`'s reserved-name block lost its only producer. The `feature` import was removed from `services/mcp/config.ts` (no other user) and restored in `services/analytics/metadata.ts` after tsc caught three remaining `feature(...)` call sites there.
