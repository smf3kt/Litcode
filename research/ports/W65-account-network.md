# W65 — removing the account/subscription network (program)

Status: in progress. User directive (2026-10-16): do not carry over the network functionality that handles accounts and subscriptions; keep local functionality only. Base commit for wave A: `2d741a2`. Independent review not run — gateway rate-limited until 2026-10-17 21:17 UTC+8.

## Target end state

The tree already contains the local-only auth mode this directive describes: `isBareMode()` (`utils/envUtils.ts:60`), documented in `utils/auth.ts:100` as "--bare: API-key-only, never OAuth". The end state is that its auth shape becomes the only one: API key (`getAnthropicApiKey`, apiKeyHelper, config/keychain) and the 3P provider paths (Bedrock / Vertex / Foundry) stay; the Claude.ai OAuth token store, account identity, subscription tiering and every usage/quota/credit/org-settings endpoint go. Nothing is invented: `--bare` already defines the shape, so each cut is a deletion of a branch the build already treats as unreachable or of a mode the product already defines as the minimal one.

## Surface (44 targets, classified)

`.audit/w65-targets.json` lists the surface; `.audit/w65-classify.mjs` classifies it by its importers outside the whole target set, producing `.audit/w65-targets-report.json`. Result: **5 leaf, 39 referenced**. The five pure leaves are `services/api/{adminRequests,firstTokenDate}.ts`, `utils/teleport/{environmentSelection,gitBundle}.ts`, `components/RemoteEnvironmentDialog.tsx`. Everything else needs a cut at a host import site.

The classifier needed three fixes before its output was trustworthy, recorded here because the first two produced a wrong leaf list:

1. the relative-spec branch compared an absolute joined path against a set of tree-relative paths, so **every relative import was dropped** — this classified `services/oauth/` as a leaf even though `utils/auth.ts`, `entrypoints/init.ts` and `services/api/usage.ts` import it;
2. the "is this importer internal" test used only the current entry's modules instead of the union of the whole target set, so cluster-internal imports counted as outside references.

## Wave A — org-pushed settings (landed, `2d741a2`)

Deletes `services/remoteManagedSettings/` (5), `services/settingsSync/` (2), `services/teamMemorySync/` (5) — 12 files, 3,963 lines — plus site cuts in 11 hosts (23 files, +7/−3,982).

| Host | Cut |
| --- | --- |
| `main.tsx` | the remote-settings import and its `loadRemoteManagedSettings()` call, `refreshRemoteManagedSettings()`, and the `UPLOAD_USER_SETTINGS` settings-sync block |
| `entrypoints/init.ts` | the remote-settings import, the eligibility-gated loading-promise init, and the whole remote-settings branch of `initializeTelemetryAfterTrust` (telemetry now initializes immediately, which was already the non-eligible path) |
| `cli/print.ts` | the settings-sync and remote-settings imports; the headless user-settings download; the `Promise.all` join point; the plugin-cache re-pull |
| `utils/managedEnv.ts` | the eligibility probe before policy env application |
| `utils/settings/settings.ts` | the three remote branches of `policySettings` resolution — the source now resolves HKLM/plist → managed-settings.json → HKCU, all local |
| `commands/reload-plugins/reload-plugins.ts` | the settings re-pull block |
| `tools/FileEditTool`, `tools/FileWriteTool` | the `checkTeamMemSecrets` guard calls |
| `utils/sessionFileAccessHooks.ts` | the `teamMemWatcher` require and its two `notifyTeamMemoryWrite()` calls |
| `setup.ts` | the `TEAMMEM` watcher start |

Adaptation, recorded: `checkTeamMemSecrets` was a *local* secret scan, but its only purpose was to stop secrets reaching team memory, which is the network feature being removed. It leaves with the feature rather than staying as a vestigial check. Same for the `policySettings` "remote is highest priority" branch: with the remote source gone, the local sources keep their relative order.

## Protocol slip (recorded)

The three directories were removed with `rm -rf` **before** the `*.w*bak` quarantine step that every earlier package ran. Baks are gitignored, so their loss is not recoverable from history. Bounded afterwards: of the 12 files, exactly one (`services/remoteManagedSettings/securityCheck.tsx`) carried an inline `sourceMappingURL` in its dump text and so was a candidate for a W54-generation bak; the other 11 never had one. The dump-state text of all 12 — which for that one file still embeds its original TypeScript source — was extracted from the dump commit `bd958088` into `.audit/w65-source-baks/` as a substitute record, and the file content of all 12 is recoverable exactly from `453b8e3`. Measured base rate for context: 682 baks across 1,832 source files, and a 40-file sample showed 16 byte-identical to their dump-commit text, so an intermediate-generation bak cannot be ruled out for the one candidate. The remaining waves quarantine before deleting.

## Verification and limits

`tsc --noEmit --pretty false` exits 0. All four owned fixtures (`w58-verify`, `w59-verify`, `w59-followup-verify`, `w60-verify`) pass. `git diff --check` clean. The base has no test suite and no runtime, so the acceptance surface is the compiler plus fixtures — no CLI ran, and no recovered entrypoint was executed. Two cut sites needed a repair pass: the first `settings.ts` edit left an orphan `}` from the removed `if/else` (TS1472/TS1005/TS1128), fixed by removing the leftover closer.

## Remaining waves (recorded, not started)

- **OAuth identity and token core** — `services/oauth/`, `utils/auth.ts` subscriber half, `utils/config.ts` `oauthAccount`/`AccountInfo`/`hasAvailableSubscription`, and the model-call seams: `services/api/client.ts:128-135,307-313` (`isClaudeAISubscriber()` branch, `authToken`, staging baseURL), `claude.ts:408,522,1030`, `withRetry.ts:20-21,247,332,739,768`, `errors.ts:468,737,798`, `utils/http.ts:70`, `utils/betas.ts:25,71,251`, `utils/model/*`.
- **Usage, limits and credits** — `services/claudeAiLimits.ts`, `claudeAiLimitsHook.ts`, `rateLimitMessages.ts`, `mockRateLimits.ts`, `services/api/{usage,referral,grove,overageCreditGrant,ultrareviewQuota,metricsOptOut,sessionIngress}.ts`, `utils/{billing,extraUsage}.ts`, and their UI (`RateLimitMessage`, `useRateLimitWarningNotification`, `OverageCreditUpsell`, `Passes/`, `grove/`, `Settings/Usage`, `FeedbackSurvey/`).
- **Remote sessions** — `remote/`, `assistant/`, `ssh/`, `server/`, `cli/transports/`, `tools/RemoteTriggerTool/`, `utils/teleport*`, `utils/background/remote/`, `bridge/`, and their hosts (`main.tsx` argv blocks, `entrypoints/cli.tsx`, `screens/REPL.tsx` hooks, `commands.ts`).
- **Policy limits** — `services/policyLimits/`; every `isPolicyAllowed` call site is a remote-session, remote-control or product-feedback policy, so it goes with those.
- **Open decisions.** `services/analytics/` is network (`logEvent`, GrowthBook) and is imported by hundreds of local files — a no-op stub is the realistic cut, but the GrowthBook gates the coding loop reads (`getDynamicConfig_BLOCKS_ON_INIT` at `claude.ts:96`) need a product call. `services/teamMemorySync/teamMemSecretGuard.checkTeamMemSecrets` was local code inside a network feature. `hooks/useApiKeyVerification.ts` is API-key-shaped but routes through `isAnthropicAuthEnabled` and may need a bare rewrite rather than deletion.

## Feature loss to record in the product record

Removing the subscriber branch is not behaviour-neutral in two places that are not network losses: the 1-hour prompt-cache TTL (`claude.ts:408`) falls to 5 minutes, and subscriber 429 responses stop being exempt from retry (`withRetry.ts:739,768`). Both are recorded so the port can decide deliberately rather than inherit them.
