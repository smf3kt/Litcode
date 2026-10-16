# W60 remaining compiler errors

Status: verified. Baseline base commit is `336822377b183e0f963d152d4189080c0fad4ce5` in `/Users/mant1ssa/Projects/cc-base-2188`. TypeScript 7.0.2 diagnostics decreased from 4 in 3 files to 0. `tsc --noEmit --pretty false` now exits 0. Independent review confirmed all three repairs correct with no behavioural regression; full build and CLI acceptance remain pending.

## What was repaired

All four diagnostics were the same defect: W59 folded three ant-only branches onto a `null` module placeholder, so the original `require(...)`/`import(...)` call site became `null.someExport()` and produced TS18050/TS2339. The original bodies require modules that are absent from every available inventory, so the call cannot be restored. The repair keeps each gate and evaluation point and replaces the failing access with an explicit failure naming the missing component. It preserves the original call site in two of the three: `envUtils.ts` drops the `require('./protectedNamespace.js')` expression entirely and throws in its place, while `classifierDecision.ts` and `caches.ts` keep the `require`/`import` and fail inside it.

| Source | Original call | Repair |
| --- | --- | --- |
| `utils/envUtils.ts` `isInProtectedNamespace` | `return (require('./protectedNamespace.js') as typeof import('./protectedNamespace.js')).checkProtectedNamespace()` | `require` removed; throw in the same `USER_TYPE === 'ant'` branch; `return false` untouched |
| `utils/permissions/classifierDecision.ts` `VERIFY_PLAN_EXECUTION_TOOL_NAME` | `? (require('../../tools/VerifyPlanExecutionTool/constants.js') as typeof import(...)).VERIFY_PLAN_EXECUTION_TOOL_NAME : null` | same `require`, throw inside the ternary's ant arm; `: null` untouched |
| `commands/clear/caches.ts` `clearSessionCaches` | `void import('../../tools/TungstenTool/TungstenTool.js').then(({ clearSessionsWithTungstenUsage, resetInitializationState }) => { ... })` | same dynamic `import(...)` and `.then(...)`; the callback throws instead of destructuring |

## Source coordinates

All ranges are one-based inclusive text lines. Original dump reference is `bd958088195aefbb4bce96ba966447e5e09b1312`. Audit JSON ranges are UTF-16 half-open intervals.

| Source | Range | Original SHA-256 | Use |
| --- | --- | --- | --- |
| `utils/envUtils.ts` | 136-147 | `0519e43a719ad6579319021c3949d45b7360f71d31f82186df2e9e1bfbc07cdf` | `require('./protectedNamespace.js')` in a live `USER_TYPE` branch |
| `utils/permissions/classifierDecision.ts` | 37-42 | `f3797aa029ad184719677b2490d22a9c68ee9d464888229f2e117e90f8aab977` | `require('../../tools/VerifyPlanExecutionTool/constants.js')` in a live `USER_TYPE` ternary |
| `commands/clear/caches.ts` | 94-102 | `9c5eef4aead5bb81c4ff7301576be4b07d79a993355ab528d5150510d0f63da2` | dynamic `import('../../tools/TungstenTool/TungstenTool.js')` |

Absent owners confirmed absent from the original tree, `recovered/`, extracted inventories and the `*.w54bak` inline source maps: `utils/protectedNamespace.ts`, `tools/VerifyPlanExecutionTool/constants.ts`. `tools/TungstenTool/TungstenTool.ts` exists only as a stub that declares `TungstenTool` and deliberately omits the two runtime exports this call site needs.

## Why the original call sites are the faithful choice

Each ant arm is a live `process.env.USER_TYPE === 'ant'` branch, not dead code. Run against this dump in an ant build, the original bodies already fail at their own call sites: `require('./protectedNamespace.js')` and `require('../../tools/VerifyPlanExecutionTool/constants.js')` raise `MODULE_NOT_FOUND` synchronously, and the `TungstenTool` dynamic import resolves against a stub that lacks both destructured exports, so `clearSessionsWithTungstenUsage()` raises a `TypeError` inside the `.then` callback, becoming an unhandled rejection. The repair reproduces each failure's position, synchronicity and propagation path: `envUtils.ts` and `classifierDecision.ts` throw synchronously where the original threw synchronously, and `caches.ts` throws inside the same callback where the original's `TypeError` also landed.

The W59 `null` fold did not match that. `...(VERIFY_PLAN_EXECUTION_TOOL_NAME ? [VERIFY_PLAN_EXECUTION_TOOL_NAME] : [])` at `utils/permissions/classifierDecision.ts:84` and the `return false` at `utils/envUtils.ts:145` both made an ant build silently succeed with a missing entry, which the original never does. Seven `isInProtectedNamespace()` call sites exist (`utils/permissions/permissions.ts:630,670,737`, `bridge/bridgeMain.ts:1105`, `bridge/replBridge.ts:492`, `bridge/remoteBridgeCore.ts:758`, `tools/AgentTool/agentToolUtils.ts:437`, `main.tsx:5582`); every one is a bare call inside a `logEvent({...})` literal with no `try`/`catch`, so the throw reaches the same caller the original `MODULE_NOT_FOUND` would. The one deliberate deviation is `envUtils.ts`: returning `false` would be worse, since the function's own doc comment says an ambiguous namespace is assumed protected.

`TERMINAL_CAPTURE_TOOL_NAME` and `OVERFLOW_TEST_TOOL_NAME` in the same file stay folded to `null` from W59. That is behaviourally equivalent inside this tree, not a discrepancy: their gates are `feature('TERMINAL_PANEL')` / `feature('OVERFLOW_TEST_TOOL')`, which `shims/bun-bundle.ts` evaluates to `false` over an empty set, so the ant arm never runs. `VERIFY_PLAN_EXECUTION_TOOL_NAME`'s gate reads `process.env.USER_TYPE` at runtime, so its `null` fold really did drop a live allowlist entry. The two styles are recorded rather than silently unified.

## Verification and limits

Use the base project's `node_modules/.bin/tsc --noEmit --pretty false` from its own directory. The `/tmp/w47-tools` compiler is a different version and is not the measurement authority.

Owned fixture, run from cc_reverse:

```sh
node .audit/w60-verify.mjs
```

It extracts the three real source bodies with the TypeScript AST, transpiles them against owned dependency fixtures that record every cache-clearing call, and runs the external and ant paths of each. It asserts the external path is unchanged, the ant path fails with the named component, session-cache effects and preserved-agent behaviour are identical, and that the `TungstenTool` dynamic import is still triggered. W58/W59 fixtures rerun unchanged. Independent review reran `tsc` (exit 0) and re-derived each judgement from the original blobs; it confirmed all three correct with no behavioural regression and re-verified the absent owners against `recovered/`, `extracted/`, `extracted-v2/`, `dist/`, `src/` and the 686 `*.w5*bak`/`*.w4*bak` maps (zero hits).

Known limit: the ant branches now fail loudly where the original would have reached a real implementation. That is a deliberate, recorded adaptation, not a recovered behaviour; it is only correct while those implementations stay absent.

## Residual risks

- The three throws are hard-coded. If `utils/protectedNamespace.ts` or `tools/VerifyPlanExecutionTool/constants.ts` is ever recovered into the tree, `utils/envUtils.ts:142`, `utils/permissions/classifierDecision.ts:33` and `commands/clear/caches.ts:98` keep throwing and nothing forces them back. Each must be reverted in the same package that recovers its module.
- In an ant build the ant path loses telemetry: every `isInProtectedNamespace()` caller sits inside a `logEvent({...})` literal, so events such as `tengu_auto_mode_decision` stop reporting. The original against this dump behaves the same, but the repair turns that into an explicit contract.
- A more faithful alternative exists for `caches.ts`: adding two `any` declarations to the existing `TungstenTool` stub, matching the repository's other 61 stubs, would let the original body compile verbatim and produce the `TypeError` from the call itself. W58/W59 deliberately withdrew invented declarations, so the explicit throw is the defensible compromise; the stub route is strictly closer to source and is preferred if the policy changes.

No recovered application entrypoint or paid model request was executed. Full application build and CLI acceptance remain pending.
