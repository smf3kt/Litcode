# W62 — phase 2 package 2: the login/auth surface and upgrade

Status: verified (independent review not run — gateway rate-limited until 2026-10-17 21:17 UTC+8). Base commit `bea1b62`. 8 files deleted (938 lines) plus site cuts in 7 hosts (15 files, +6/−956 total); `tsc --noEmit --pretty false` exits 0. User directive: remove login/authentication and upgrade.

## Removed

- `commands/login`, `commands/logout`, `commands/upgrade` (the three commands; their `*.w54bak` source maps quarantined to `.audit/w62-source-baks/`, byte-compared)
- `cli/handlers/auth.ts` — the `claude auth login|status|logout` CLI handlers
- `hooks/notifs/useCanSwitchToExistingSubscription.tsx`

## Site cuts

| Host | Cut |
| --- | --- |
| `commands.ts` | `upgrade` import + `COMMANDS` entry |
| `main.tsx` | the whole `claude auth` subcommand block (50 lines) and the orphaned closers the first cut left behind |
| `cli/print.ts` | `OAuthService` and `installOAuthTokens` imports, the `claudeOAuth` slot declaration, and the two control-channel branches `claude_authenticate` and `claude_oauth_callback`/`claude_oauth_wait_for_completion` (137 lines); the `mcp_clear_auth` chain after them is untouched |
| `screens/REPL.tsx` | `useCanSwitchToExistingSubscription` import + call |
| `commands/rate-limit-options` | `upgrade` imports, the `'upgrade'` menu arm and its select branch; `'upgrade'` dropped from the option-type union |
| `commands/extra-usage` | the `<Login>` render arm; the non-message branch now returns null with a comment |
| `components/ConsoleOAuthFlow.tsx` | `installOAuthTokens` import; the success path now throws "OAuth token installation is unavailable in this distribution" and its dead tail (org validation, success notification) is cut |

## Kept, with reasons

- `services/oauth` stays. Its runtime modules are load-bearing outside auth: `getOrganizationUUID` serves six remote/bridge sites, and `utils/auth.ts`'s token layer (`getClaudeAIOAuthTokens`, `shouldUseClaudeAIAuth`, `SubscriptionType`) plus `utils/config.ts`'s `BillingType`/`ReferralEligibilityResponse` types sit on it. Deleting the module means re-wiring the model-call core — that is the remote-cluster package, not this one. `utils/auth.ts` itself stays: it is imported by `commands.ts` and the permission/API paths.
- `components/ConsoleOAuthFlow.tsx` stays: `Onboarding.tsx`, `TeleportError.tsx` and `cli/handlers/util.tsx` (doctor) still render it. Its token-persistence path now fails loudly (W60 precedent). It goes when the Onboarding cluster is stripped.

## Verification and limits

`tsc --noEmit --pretty false` exits 0. All four owned fixtures (`w58/w59/w59-followup/w60-verify.mjs`) pass. `git diff --check` clean. The base has no test suite or runtime, so no CLI ran; no recovered entrypoint was executed. The rate-limit outage that blocked independent review for W61's recon also covers this package; the fix loop was local, and each cut was made against read code, with the compiler as the gate.

Known sharp edge: `ConsoleOAuthFlow`'s setup-token mode still completes its UI flow and only the persistence path throws; `extra-usage` returns null when its core result is not a message. Both are recorded adaptations, not recovered behaviour.
