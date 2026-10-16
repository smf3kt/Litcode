# W65 — removing the account/subscription network (program)

Status: in progress. User directive (2026-10-16): do not carry over the network functionality that handles accounts and subscriptions; keep local functionality only. Base commits: wave A `2d741a2`, wave B `3e4e3f0`, wave C `35c180c`. Independent review not run — gateway rate-limited until 2026-10-17 21:17 UTC+8.

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

## Wave C — usage, limits and credits (landed, `35c180c`)

21 files / 3,267 lines deleted, 31 host files cut, +25/−4,358.

| Deleted | Role |
| --- | --- |
| `services/claudeAiLimits.ts`, `claudeAiLimitsHook.ts`, `rateLimitMessages.ts` | the limits engine, its React hook, and the message builder that turned a `ClaudeAILimits` object into user-facing rate-limit copy |
| `services/mockRateLimits.ts`, `rateLimitMocking.ts` | the `/mock-limits` testing harness for Ant employees |
| `services/api/{usage,referral,overageCreditGrant,firstTokenDate}.ts` | the utilization, referral/guest-pass, overage-credit-grant and first-token-date endpoints |
| `utils/extraUsage.ts` | `isBilledAsExtraUsage`, subscriber-gated to `false` from its first line |
| `commands/{extra-usage,rate-limit-options}/`, `components/Settings/Usage.tsx` | the `/extra-usage`, `/rate-limit-options` and `/usage`-tab surfaces |
| `components/messages/RateLimitMessage.tsx`, `hooks/notifs/useRateLimitWarningNotification.tsx` | the rate-limit message component and warning notifier |
| `components/LogoV2/{OverageCreditUpsell,GuestPassesUpsell}.tsx` | the startup-logo upsell panels |

The host cuts fall into four groups. **Model-call seams**: `services/api/claude.ts` loses the quota-header extraction at its three sites, the `isClaudeAISubscriber() && !currentLimits.isUsingOverage` term in the 1h-cache latch (leaving the ant and allowlist terms) and the `isUsingOverage` request-context field; `services/api/errors.ts` loses the whole subscription 429 branch including the header interpretation, so a 429 falls through to the generic rejection message; `services/api/withRetry.ts` loses the mock-limits check, the mock guard in `shouldRetry` and the fast-mode overage-rejection path (whose trigger header family is the one removed from `errors.ts`). **Local predicates**: `utils/billing.ts` keeps `hasConsoleBillingAccess` only, reduced; `utils/model/check1mAccess.ts` reduces to `!is1mContextDisabled()` for both models; `promptSuggestion` loses its `rate_limit` suppression reason; `utils/config.ts` loses the overage-credit, guest-pass and extra-usage caches. **Contract surfaces**: `toSDKRateLimitInfo` leaves `utils/messages/mappers.ts` with its only producer, and `cli/print.ts` loses the status-listener that emitted `rate_limit_event`; `commands/cost/cost.ts` reduces to `formatTotalCost()`. **UI plumbing**: the `onOpenRateLimitOptions` callback was prop-drilled `REPL → Messages → MessageRow → Message → AssistantTextMessage → RateLimitMessage` over four components, so it is cut at all five hops plus the `handleOpenRateLimitOptions` definition; `components/StatusLine.tsx` loses `getRawUtilization` and the `rate_limits` field of its command input; `tipRegistry` loses the guest-passes and overage-credit tips; `LogoV2.tsx`, `CondensedLogo.tsx` and `feedConfigs.tsx` lose the upsell feeds, keeping the local recent-activity, what's-new and onboarding feeds.

Two adaptations beyond deletion, both deliberate:

1. `hasConsoleBillingAccess` was `!DISABLE_COST_WARNINGS && !subscriber && any-credential && oauthAccount.{org,workspace}Role ∈ admin|billing`. Both removed terms are account-identity: the subscriber term and the role gate, whose only data source is `oauthAccount`. The surviving predicate is the conjunction of the local terms. Cost reporting is a local accounting feature and would otherwise be permanently dead.
2. `services/api/promptCacheBreakDetection.ts` loses its `isUsingOverage` snapshot field and its `overageChanged` diff dimension, because nothing sets the field any more and a dimension that cannot differ is dead state in a cache-break report. The ten other dimensions are untouched.

Kept deliberately: the `rate_limit_event` / `SDKRateLimitInfo` schemas in `entrypoints/sdk/{coreSchemas,coreTypes}.ts`. They are the SDK's declared output union rather than network functionality, and no producer emits the event now; removing them is a public-contract change that belongs with the SDK surface review, not with this cut. Also kept: the `extra_usage_disabled` fast-mode reason case, still a server-declared status, with its `/extra-usage` pointer trimmed from the display string since the command no longer exists.


## Wave D step 1 — auth stops consulting the account network (landed, `03713f4`)

Wave D is the OAuth identity and token core. It is being cut in steps so each commit stays green; step 1 removes the *consult* path, and the data layer (`services/oauth/`, the token store, `oauthAccount`) plus the model-call seams follow.

The transform for step 1 is written from the tree's own `--bare` arm rather than composed: `isAnthropicAuthEnabled()` already began with `if (isBareMode()) return false`, documented at `utils/auth.ts:100` as "API-key-only, never OAuth". That arm is now the function. Only an OAuth subscriber's answer changes — a Bedrock/Vertex/Foundry user and an external-API-key user already received `false` from the removed tail — and with it every reader of `isAnthropicAuthEnabled()` collapses to the value its own surviving expression produces, without touching those functions.

| Function | Before | After | Why the answer is the tree's own |
| --- | --- | --- | --- |
| `isAnthropicAuthEnabled` | bare guard, then ssh-proxy/env/3P/external-key logic | `return false` | the `--bare` arm, verbatim |
| `getAuthTokenSource` | env token, OAuth env token, FD token, apiKeyHelper, claude.ai store | env `ANTHROPIC_AUTH_TOKEN`, configured apiKeyHelper, else none | the two local terms kept verbatim; the OAuth sources deleted |
| `isClaudeAISubscriber` | `!isAnthropicAuthEnabled() \|\| shouldUseClaudeAIAuth(tokens?.scopes)` | unreached | `shouldUseClaudeAIAuth(undefined)` is `Boolean(undefined?.includes(…))` = false; both operands false |
| `hasProfileScope`, `getSubscriptionType`, `getRateLimitTier` | read the token store | unreached | each already returns its null/false answer when the token store is empty |
| `getSubscriptionName` | switches on the plan | `'Claude API'` | the function's own default arm, written for exactly this case |
| `getAccountInformation` | subscriber arm + two OAuth-account blocks | token source and API-key source only | both blocks read `getOauthAccountInfo()` |
| `validateForceLoginOrg` | OAuth org pinning against `forceLoginOrgUUID` | `{ valid: true }` | the function's own first guard |

The value of doing it this way is that the compiler then names the real work: narrowing `getAuthTokenSource`'s returned union turned the remaining OAuth comparisons into eight type errors (`utils/auth.ts` ×6, `utils/statusNoticeDefinitions.tsx` ×2), each of which is an OAuth-only arm. tsc exits 0, four fixtures pass, +14/−200 across three files.

Residual after step 1, deliberate and recorded: `getClaudeAIOAuthTokens` and the other token-store readers are still present and still reachable *by signature* — no caller can now get a non-null token, but the functions and `services/oauth/` are not yet deleted. That deletion is step 2, and it is where the 30 files that import the token store get cut.


## Wave E step 1 — the organization policy-limits service (landed, `75c7aa8`)

`services/policyLimits/` (2 files, 690 lines) plus 12 host cuts, +3/−790. The service fetched an organization policy document and polled it on a background interval; all thirteen call sites were gates — `allow_remote_sessions` on the remote/teleport/bridge/tool paths, `allow_remote_control` on the bridge CLI, `allow_product_feedback` (a ZDR check) on the two feedback-survey hooks.

Removing the gate first, before the paths it guards, is safe here for a specific reason worth recording: every ungated path requires an OAuth token (`getClaudeAIOAuthTokens()?.accessToken`, `checkAndRefreshOAuthTokenIfNeeded`), and wave D step 1 made the token store unreachable. They cannot run, so removing the gate changes no observable behaviour — the same "consult path first, delete the consumer after" ordering wave D used, and it is what shrinks the remote cluster before that cluster's own deletion.

`README.md` still names `remoteManagedSettings` and `policyLimits` in its module map. That map is the dump's architecture diagram, not a live inventory (it also lists modules deleted in wave A), and the file is CRLF throughout, so a two-line edit makes `git diff --check` red on an unrelated line. Left alone deliberately; a doc sweep can take it up with the line-ending question in hand.


## Wave E step 2 — scheduled remote agents and the remote callout (landed, `0ec1f6a`)

5 files / 725 lines deleted, 5 host files cut, 765 deletions total. The trigger side of remote sessions: `tools/RemoteTriggerTool/` (the tool that created and ran remote agents on a cron schedule, its prompt, its UI), `skills/bundled/scheduleRemoteAgents.ts` (the bundled skill teaching the model to use it), and `components/RemoteCallout.tsx` (the one-time offer to enable the remote-control bridge).

Cuts: `tools.ts` (both the `AGENT_TRIGGERS_REMOTE`-gated registration and its registry spread — the tree's last two uses of that flag), `skills/bundled/index.ts` (the same feature block), `screens/REPL.tsx` (the callout's import, dialog-priority arm and JSX arm), `state/AppStateStore.ts` and `main.tsx` (the `showRemoteCallout` field).

Worth recording: `showRemoteCallout` had no producer left. Its field comment said "/remote-control command sets it", but no site in the tree assigns it `true` — only `false`, in the store's initial value and in the bridge initial state — so the field was already dead state when the callout went. That is the shape this wave keeps finding: a gate or a flag whose producer left, still typechecked because nothing removes it.

The slice was chosen with the classifier (`.audit/w65-classify.mjs`, `.audit/w65-e-targets.json`): of the 29-file remote cluster, `RemoteTriggerTool/` has exactly one outside importer (`tools.ts`) and `scheduleRemoteAgents.ts` exactly one (`skills/bundled/index.ts`), which is what made this the cheapest first bite of a ~30,000-line cluster. The remaining 22 referenced targets — `bridge/` (31 files), `remote/`, `assistant/`, `ssh/`, `server/`, `cli/transports/`, the teleport family, `tasks/RemoteAgentTask/` and the remote-session task UI — need cuts at their hosts and come next.


## Protocol slip (recorded)

The three wave-A directories were removed with `rm -rf` **before** the `*.w*bak` quarantine step that every earlier package ran. Baks are gitignored, so their loss is not recoverable from history. Bounded afterwards: of the 12 files, exactly one (`services/remoteManagedSettings/securityCheck.tsx`) carried an inline `sourceMappingURL` in its dump text and so was a candidate for a W54-generation bak; the other 11 never had one. The dump-state text of all 12 — which for that one file still embeds its original TypeScript source — was extracted from the dump commit `bd958088` into `.audit/w65-source-baks/` as a substitute record, and the file content of all 12 is recoverable exactly from `453b8e3`. Measured base rate for context: 682 baks across 1,832 source files, and a 40-file sample showed 16 byte-identical to their dump-commit text, so an intermediate-generation bak cannot be ruled out for the one candidate.

Wave B repeated the slip (4 of 9 files carried baks, dump-state text recovered from `bd958088`). Wave C ran the quarantine first: `find <targets> -name '*.w*bak'` copied two files (`commands/extra-usage/extra-usage.tsx.w54bak`, `commands/rate-limit-options/rate-limit-options.tsx.w54bak`) into `.audit/w65-c-baks/`, both byte-compared with `cmp` before any deletion; no other target carried one.

One leftover cleaned up while deleting: `commands/passes/` held only `passes.tsx.w54bak`, a stray from the earlier package `bea1b62` ("Remove the non-coding slash-command surface"), which had deleted the `.tsx` and left its bak behind. The directory was removed with the rest of the command dirs. No source is lost — `bea1b62^:commands/passes/passes.tsx` exists, so that command's source is recoverable from history, and the bak predated this wave.

## Verification and limits

`tsc --noEmit --pretty false` exits 0 after each wave. All four owned fixtures (`w58-verify`, `w59-verify`, `w59-followup-verify`, `w60-verify`) pass. `git diff --check` clean. The base has no test suite and no runtime, so the acceptance surface is the compiler plus fixtures — no CLI ran, and no recovered entrypoint was executed. Two cut sites needed a repair pass: the first `settings.ts` edit left an orphan `}` from the removed `if/else` (TS1472/TS1005/TS1128), fixed by removing the leftover closer.

Wave C's cuts were driven the same way, and five repair passes came out of it: an over-wide range for the `createGuestPassesFeed` tail (fixed by reading the file's exact end bytes), a `cut_all` where an 8-space anchor was a substring of a 16-space one (`onOpenRateLimitOptions` in `REPL.tsx`, reordered to cut the deeper indent first), and the `onOpenRateLimitOptions` prop chain, which surfaced one host at a time as `tsc` named the next component that still passed it. That chain is the wave's clearest illustration of why the compiler is the acceptance surface here: the prop was drilled through five components, so a single missed hop is a type error rather than a silent behaviour change.


## Remaining waves (recorded, not started)

- **OAuth identity and token core** — `services/oauth/`, `utils/auth.ts` subscriber half, `utils/config.ts` `oauthAccount`/`AccountInfo`/`hasAvailableSubscription`, and the model-call seams: `services/api/client.ts:128-135,307-313` (`isClaudeAISubscriber()` branch, `authToken`, staging baseURL), `claude.ts:408,522,1030`, `withRetry.ts:20-21,247,332,739,768`, `errors.ts:468,737,798`, `utils/http.ts:70`, `utils/betas.ts:25,71,251`, `utils/model/*`.
- **Usage, limits and credits** — landed as wave C (`35c180c`). Two residues kept on purpose: the SDK `rate_limit_event` schema and the server-declared `extra_usage_disabled` fast-mode reason. The plan's other named targets resolved differently than expected: there is no `components/Tips` directory in this tree (`services/tips/tipRegistry.ts` holds the tip content, and it was cut), and `components/Settings/Usage.tsx` was the usage endpoint's only consumer, so both left with this wave. `components/FeedbackSurvey/` is not part of this cluster — it posts survey answers and belongs with the product-feedback surface.
- **Remote sessions** — `remote/`, `assistant/`, `ssh/`, `server/`, `cli/transports/`, `tools/RemoteTriggerTool/`, `utils/teleport*`, `utils/background/remote/`, `bridge/`, and their hosts (`main.tsx` argv blocks, `entrypoints/cli.tsx`, `screens/REPL.tsx` hooks, `commands.ts`).
- **Policy limits** — `services/policyLimits/`; every `isPolicyAllowed` call site is a remote-session, remote-control or product-feedback policy, so it goes with those.
- **Open decisions.** `services/analytics/` is network (`logEvent`, GrowthBook) and is imported by hundreds of local files — a no-op stub is the realistic cut, but the GrowthBook gates the coding loop reads (`getDynamicConfig_BLOCKS_ON_INIT` at `claude.ts:96`) need a product call. `services/teamMemorySync/teamMemSecretGuard.checkTeamMemSecrets` was local code inside a network feature. `hooks/useApiKeyVerification.ts` is API-key-shaped but routes through `isAnthropicAuthEnabled` and may need a bare rewrite rather than deletion.

## Feature loss to record in the product record

Removing the subscriber branch is not behaviour-neutral in two places that are not network losses: the 1-hour prompt-cache TTL (`claude.ts:408`) falls to 5 minutes, and subscriber 429 responses stop being exempt from retry (`withRetry.ts:739,768`). Both are recorded so the port can decide deliberately rather than inherit them.
