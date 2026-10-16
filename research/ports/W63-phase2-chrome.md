# W63 — phase 2 package 3: the Claude-in-Chrome cluster

Status: verified (independent review not run — gateway rate-limited until 2026-10-17 21:17 UTC+8). Base commit `11db4c6`. 13 files deleted (2,167 lines) plus site cuts in 14 hosts (27 files, +14/−3,211 total); `tsc --noEmit --pretty false` exits 0. User directive: continue with the chrome cluster.

## Removed

- `utils/claudeInChrome/` (7 files: `common.ts`, `setup.ts`, `setupPortable.ts`, `prompt.ts`, `mcpServer.ts`, `chromeNativeHost.ts`, `toolRendering.tsx`)
- `commands/chrome/` (the `chrome` slash command)
- `hooks/useChromeExtensionNotification.tsx`, `hooks/usePromptsFromClaudeInChrome.tsx`
- `components/ClaudeInChromeOnboarding.tsx`
- `skills/bundled/claudeInChrome.ts` (the bundled skill)

Their five `*.w54bak` inline source maps are quarantined to `.audit/w63-source-baks/` and byte-compared (the files are gitignored, so they are not recoverable from history).

## Site cuts

| Host | Cut |
| --- | --- |
| `entrypoints/cli.tsx` | the `--claude-in-chrome-mcp` and `--chrome-native-host` branches of the argument chain (16 lines); the `--computer-use-mcp` branch now opens the chain directly |
| `main.tsx` | three imports (`prompt.js`, `setup.js`, `common.js`), `setChromeFlagOverride` from the state import, the `--chrome`/`--no-chrome` commander options, the reserved-name `if` arm (the chain now starts at the CHICAGO_MCP arm), the whole `chromeOpts`/`enableClaudeInChrome`/`autoEnableClaudeInChrome` setup block (63 lines), the `enableClaudeInChrome` argument at the `showSetupScreens` call |
| `services/mcp/client.ts` | the `isClaudeInChromeMCPServer` import, the `claudeInChromeToolRendering` lazy require and its eslint-disable comment, the in-process Chrome MCP branch in `connectToServer` (21 lines), the chrome overrides spread in `fetchToolsForClient` |
| `services/mcp/config.ts` | the `isClaudeInChromeMCPServer` import and the reserved-name guard, leaving the CHICAGO_MCP guard |
| `services/api/claude.ts` | two imports, the `hasChromeTools` gate in the tool-search condition, the `CHROME_TOOL_SEARCH_INSTRUCTIONS` injection |
| `utils/attachments.ts` | two imports and the client-side chrome instruction push |
| `screens/REPL.tsx` | two hook imports, the `useChromeExtensionNotification()` call, the `usePromptsFromClaudeInChrome(...)` call with its comment |
| `skills/bundled/index.ts` | two imports and the `shouldAutoEnableClaudeInChrome()` registration block |
| `interactiveHelpers.tsx` | the `claudeInChrome` parameter of `showSetupScreens` and its onboarding dialog block |
| `utils/config.ts` | the two config-type fields and their key-list entries |
| `bootstrap/state.ts` | the `chromeFlagOverride` state field, its initializer, and the `set/getChromeFlagOverride` accessors |
| `tools/shared/spawnMultiAgent.ts`, `utils/swarm/spawnUtils.ts` | the `getChromeFlagOverride` import and the `--chrome`/`--no-chrome` flag propagation block |
| `components/Settings/Config.tsx` | the "Claude in Chrome enabled by default" settings entry |

## Kept, with reasons

- `utils/computerUse/*` stays. It is a separate cluster (the Computer Use MCP server) that only shares the CHICAGO_MCP feature gate; `services/mcp/client.ts`, `services/mcp/config.ts`, `main.tsx` and `utils/computerUse/setup.ts` still reference it, and it is its own later package.
- `services/api/claude.ts`'s `useToolSearch` gate keeps its `!isMcpInstructionsDeltaEnabled()` half; only the chrome conjunct went.

## Verification and limits

`tsc --noEmit --pretty false` exits 0. All four owned fixtures (`w58/w59/w59-followup/w60-verify.mjs`) pass. `git diff --check` clean. A residual scan for `claudeInChrome|ChromeExtensionNotification|chromeFlagOverride|CLAUDE_IN_CHROME` finds only `utils/computerUse/*`, which is the separate cluster. The base has no test suite or runtime, so the acceptance surface is the compiler plus fixtures — no CLI ran, and no recovered entrypoint was executed.

Adaptation note: `main.tsx`'s two chrome setup arms computed `dynamicMcpConfig`, `allowedTools` and `appendSystemPrompt` mutations. With the cluster gone nothing computes them, so the arms were deleted rather than left as dead branches; the `--chrome` commander option and the `getChromeFlagOverride` state slot went with them so no caller can pass a flag that no longer has a reader.
