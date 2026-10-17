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


## Wave E step 3 — remote assistant history and two orphans (landed, `bd7f6c7`)

5 files / 715 lines deleted, 2 host files cut (717 deletions).

| Deleted | Role |
| --- | --- |
| `assistant/sessionHistory.ts` | paged the OAuth session-events endpoint through teleport's api helpers |
| `assistant/sessionDiscovery.ts` | the dump-absent stub the dialog launchers typed against |
| `hooks/useAssistantHistory.ts` | the scroll-up lazy loader built on the above |
| `services/api/adminRequests.ts` | no importer anywhere in the tree |
| `components/RemoteEnvironmentDialog.tsx` | no importer anywhere in the tree |

Cuts: `screens/REPL.tsx` (the hook import, the `HISTORY_STUB` stand-in and its comment, the KAIROS-gated call, the matching `maybeLoadOlder` scroll arm and its dependency entry, plus a comment naming the hook) and `dialogLaunchers.tsx` (the `AssistantSession` type import). A prose comment in `dialogLaunchers.tsx` still names `assistant/AssistantSessionChooser` as a module this build never contained; that is project history rather than a live reference, so it stays.

The assistant-history feature was unreachable twice over: it sits behind the constant-folded `KAIROS` flag in REPL, and its only data path is the remote session-events endpoint, which needs an OAuth token. Deleting it changes nothing in a non-KAIROS local build.

The two orphans are worth naming as a category. `adminRequests.ts` and `RemoteEnvironmentDialog.tsx` have no importer at all — they were already dead when this program started, and only the classifier's "leaf" column surfaced them. Every wave so far has found a few of these; they cost nothing to confirm and nothing to remove.


## Wave E step 4 — teleport and the remote-session cluster (landed, `db6e7c7`)

33 files deleted, 31 hosts cut, 64 files changed, +54/−11,452 — the largest slice of the program.

| Deleted | Role |
| --- | --- |
| `utils/teleport.tsx` | the teleport entrypoint: create/resume a Claude Code Web session, git bundle, repo validation, branch checkout |
| `utils/teleport/{api,environments,environmentSelection,gitBundle}.ts` | the Sessions API client, the environment model, the environment picker, the git bundle |
| `components/{TeleportError,TeleportProgress,TeleportRepoMismatchDialog,TeleportResumeWrapper,TeleportStash,ResumeTask}.tsx` | the teleport UI |
| `hooks/useTeleportResume.tsx` | the resume flow built on the above |
| `hooks/{useRemoteSession,useSSHSession,useDirectConnect}.ts` | the three transport hooks that drove the REPL from elsewhere (WebSocket, ssh child process, direct connect) |
| `remote/` (5) | `RemoteSessionManager`, the permission bridge, the SDK message adapter, `SessionsWebSocket` |
| `server/` (3) | `createDirectConnectSession`, `directConnectManager`, types |
| `ssh/` (2) | `createSSHSession`, `SSHSessionManager` |
| `utils/background/remote/` (2) | the background remote-session preconditions and runner |
| `services/api/sessionIngress.ts` | the v1 session-ingress transcript API |
| `tasks/RemoteAgentTask/` (2) | the remote agent task type and its renderer |
| `components/tasks/{RemoteSessionDetailDialog,RemoteSessionProgress}.tsx` | the remote session UI |
| `commands/ultraplan.tsx` | `/ultraplan`: launch a CCR session, poll for the approved plan, offer to implement |
| `utils/ultraplan/keyword.ts` | the keyword detector that routed a plain prompt to `/ultraplan` |

Host cuts, by host:

| Host | Cut |
| --- | --- |
| `screens/REPL.tsx` | the three transport hooks and `activeRemote`; `isRemoteSession` and its six gate uses (each takes the local arm, e.g. `enabled: !isRemoteSession` → `enabled: true`, `isRemoteSession ? EMPTY_MCP_CLIENTS : mcp.clients` → `mcp.clients`); `handleRemoteInit` and the `onInit` wiring; the two `restoreRemoteAgentTasks` calls; the remote interrupt arm; the empty-input early return; the three `submitsNow` / placeholder / speculation conditions; the whole remote-send block including the content-block and `RemoteMessageContent` construction; the two ultraplan dialog entries and their state reads |
| `main.tsx` | the `PendingConnect`/`PendingSSH` types and their argv blocks, the DIRECT_CONNECT launch branch, the `--teleport`/`--remote` branch (240 lines) with its `cc://` rewrite stub, the `claude ssh` command registration, the `teleport`/`remote` option extraction, the `--teleport`/`--remote` CLI registrations, the `messages` local and the teleport arm of the resume-data construction |
| `cli/print.ts` | the teleport-resume branch, the `teleport` field in three type positions, the v1 ingress hydration branch and its import |
| `utils/sessionStorage.ts` | the v1 remote-ingress append path, `setRemoteIngressUrl`, the `remoteIngressUrl` field, `hydrateRemoteSession`, `setRemoteIngressUrlForTesting`, and the whole remote-agent metadata sidecar family (`RemoteAgentMetadata`, `getRemoteAgentsDir`, read/write/delete/list) |
| `components/tasks/BackgroundTasksDialog.tsx` | the `remote_agent` list-item variant, the sort bucket, the kill arm, the detail arm, the group render and its `marginTop` term, the `toListItem` arm, the subtitle count |
| `tools/AgentTool/AgentTool.tsx` | the four remote imports, `teleportToRemote`, `RemoteLaunchedOutput`, the `isolation: 'remote'` arm, the remote-launched tool result |
| `tools/AgentTool/UI.tsx` | the `RemoteLaunchedOutput` import, the remote-launched render branch, the `backgroundedMidExecution` term |
| `utils/processUserInput/processUserInput.ts` | the ultraplan keyword import and its routing block |
| `components/PromptInput/PromptInput.tsx` | the keyword import, the trigger computation, the rainbow arm, the notification effect, the dependency entry |
| `state/AppStateStore.ts` | `ultraplanLaunching`, `ultraplanSessionUrl`, `ultraplanPendingChoice`, `ultraplanLaunchPending`, `isUltraplanMode`, `remoteSessionUrl` |
| `state/onChangeAppState.ts` | the `is_ultraplan_mode` metadata write (the `set_permission_mode` handler still applies the mode) |
| `bootstrap/state.ts` | `teleportedSessionInfo`, `setTeleportedSessionInfo`, `getTeleportedSessionInfo`, `markFirstTeleportMessageLogged` |
| `services/api/logging.ts` | the two first-message teleport reliability log blocks and their imports |
| `components/permissions/ExitPlanModePermissionRequest/…` | the `ultraplan` response value, the Ultraplan button and its props |
| `components/tasks/{BackgroundTask,BackgroundTaskStatus}.tsx` | the remote render arm, the pill's `remote_agent` case, `pillNeedsCta` and its call |
| `tools/TaskOutputTool/TaskOutputTool.tsx` | the `remote_agent` output arm and the render branch |
| others | `bridge/createSession.ts`, `dialogLaunchers.tsx`, `commands/clear/caches.ts`, `tasks.ts`, `tasks/types.ts`, `Task.ts`, `tasks/pillLabel.ts`, `utils/filePersistence/outputsScanner.ts`, `components/PromptInput/PromptInputFooterLeftSide.tsx`, `utils/sessionTitle.ts`, `types/textInputTypes.ts`, `utils/config.ts`, `constants/xml.ts`, `utils/sessionStorage.ts` |

### Adaptations (each one recorded, none invented)

1. **`bridge/createSession.ts`** was the only remaining consumer of `getOAuthHeaders`, which lived in the deleted `utils/teleport/api.ts`. Its 6-line body is ported verbatim from `utils/teleport/api.ts:276-282` (unit: UTF-16 half-open) into the file, with the range cited in the comment. No other bridge file used it, so no shared module was needed.
2. **`utils/filePersistence/outputsScanner.ts`** typed `getEnvironmentKind()` against `EnvironmentKind` from the deleted `utils/teleport/environments.ts`. The union is declared locally with the source line (`:9`) cited. The function's own value set (`'byoc' | 'anthropic_cloud'`) is unchanged; only the type's home moved.
3. **`commands/clear/caches.ts`** lost its `clearAllSessions()` call: the imported `sessionIngress.clearAllSessions` was the remote transcript sync's cache reset, so it leaves with the sync. The `w60-verify` fixture asserted call-sequence equality with the recovered body; it now asserts that this entry is the **only** difference, and that the recovered body does call it. That keeps the port honest — the deviation is named and measured rather than absorbed.

### Kept as inert declarations

- `entrypoints/sdk/controlSchemas.ts` `ultraplan` and `utils/sessionState.ts` `is_ultraplan_mode` — SDK protocol fields. With no producer, they are inert; removing them is a public-contract change, the same call already recorded for `rate_limit_event`.
- `utils/sessionIngressAuth.ts` and the `sessionIngressToken` bootstrap field — the SDK/ingress bearer token still read by `services/mcp/client.ts`, `utils/filePersistence/filePersistence.ts` and `main.tsx`. That surface belongs to the SDK transport wave, not this one.

### Verification

`tsc --noEmit --pretty false` exits 0; all four owned fixtures pass; `git diff --check` clean. 13 `*.w54bak` source maps were copied to `.audit/w65-e4-baks/` and `cmp`-verified **before** the files went. Four repair passes: two `cut_all` anchors that were substrings of longer indents removed a line they should not have (`remoteSessions,` inside a `count(` call and a JSX `marginTop` term), one `else if` chain whose closer left an unbalanced brace (found by counting brace depth per line — `tsc` only reports it at EOF), and one `cut_range` whose end anchor matched too early and left a dangling `if (`.

## Wave E step 5 — the bridge cluster (landed, `88545db`)

The whole `bridge/` module is gone: 31 files, 12,595 lines, plus `hooks/useReplBridge.tsx` and `components/BridgeDialog.tsx`. 18 hosts were re-stitched; the tree went from 28 `TS2307` errors to 0 in three passes. 53 files changed, +114/−14,675.

**Order reversed from the previous tick's plan.** That tick said wave D step 2 (the OAuth token core) came next because `bridge/createSession.ts` calls `getClaudeAIOAuthTokens`. Inverting it is cheaper: `bridge/` is the token store's largest consumer, so cutting the token core first would leave the compiler unable to name a single bridge host — the bridge cuts would have to happen anyway, with less type information to drive them. Cutting `bridge/` first means the token core's remaining consumers are already visible.

### Deleted roles

| Deleted | Role |
| --- | --- |
| `bridge/bridgeEnabled.ts` | The runtime GrowthBook gate plus `getBridgeDisabledReason`, `checkBridgeMinVersion`, `isCcrMirrorEnabled`, `getCcrAutoConnectDefault` |
| `bridge/bridgeMain.ts`, `sessionRunner.ts`, `remoteBridgeCore.ts`, `codeSessionApi.ts`, `createSession.ts`, `capacityWake.ts` | The standalone `claude remote-control` environment loop |
| `bridge/replBridge.ts`, `replBridgeHandle.ts`, `replBridgeTransport.ts`, `initReplBridge.ts`, `envLessBridgeConfig.ts`, `bridgePointer.ts`, `pollConfig.ts`, `pollConfigDefaults.ts`, `flushGate.ts` | The in-REPL bridge: session create, poll loop, transport, pointer file |
| `bridge/bridgePermissionCallbacks.ts`, `bridgeMessaging.ts`, `inboundMessages.ts`, `inboundAttachments.ts` | The bidirectional permission relay and inbound message/attachment ingest |
| `bridge/jwtUtils.ts`, `workSecret.ts`, `trustedDevice.ts`, `sessionIdCompat.ts`, `types.ts`, `bridgeConfig.ts`, `bridgeApi.ts`, `bridgeDebug.ts`, `debugUtils.ts`, `bridgeStatusUtil.ts`, `bridgeUI.ts` | Token refresh, trusted-device enrollment, the `cse_` retag, headers, the status labels and the shimmer helpers |

### Host cuts

| Host | What went |
| --- | --- |
| `constants/product.ts` | `getRemoteSessionUrl`'s lazy `require` — replaced by a ported local `toCompatSessionId` |
| `components/Spinner.tsx` | The `bridgeStatusUtil` import — replaced by three ported local helpers |
| `cli/transports/ccrClient.ts` | The `jwtUtils` import — replaced by two ported local helpers |
| `utils/config.ts` | `ccrAutoConnect`; `getRemoteControlAtStartup()` keeps only its explicit local value |
| `entrypoints/cli.tsx` | The `claude remote-control` / `rc` / `remote` / `sync` / `bridge` fast-path (44 lines) |
| `main.tsx` | The `--remote-control` / `--rc` options and their entitlement gate, the trusted-device enrollment after login, `ccrMirrorEnabled`, the hidden `remote-control` command, the `claude assistant` attach path and its `_pendingAssistantChat` stash |
| `screens/REPL.tsx` | `useReplBridge` and `sendBridgeResult`, the sandbox-permission bridge relay and its cleanup map |
| `commands/rename/rename.ts` | The `updateBridgeSessionTitle` sync |
| `cli/print.ts` | The SDK `remote_control` control message, `bridgeHandle`, `forwardMessagesToBridge`, the `tengu_bridge_message_received` event, the `resolveAndPrepend` attachment fetch |
| `hooks/toolPermission/handlers/interactiveHandler.ts` | The `bridgeCallbacks` parameter and its eight call sites, including the `Race 4` permission race |
| `components/PromptInput/PromptInput.tsx`, `PromptInputFooter.tsx` | The `bridge` footer item, `bridgeFooterVisible`, `BridgeDialog`, `BridgeStatusIndicator` |
| `components/Settings/Config.tsx` | The Remote-at-startup toggle |
| `cli/remoteIO.ts` | The bridge-topology keep-alive timer and its `pollConfig` read |
| `tools/SendMessageTool/SendMessageTool.ts`, `utils/peerAddress.ts` | The `bridge:` peer scheme and its cross-machine consent check |
| `state/AppStateStore.ts` | `replBridgePermissionCallbacks` |
| `hooks/useCanUseTool.tsx` | The `bridgeCallbacks` argument |
| `tools/BriefTool/attachments.ts` | The `BRIDGE_MODE` upload branch, and `tools/BriefTool/upload.ts` with it |

### Adaptations (ported, not invented)

Four bodies were still load-bearing when their module left. Each was ported from the recovered source and is cited at the port site; the new `w65-e5-verify` fixture compares both copies textually (whitespace- and trailing-comma-insensitive, because the formatter reflowed them) and behaviourally over probes.

1. `constants/product.ts` — `toCompatSessionId` from `bridge/sessionIdCompat.ts:26-42`. The `_isCseShimEnabled` gate is dropped: its only registrant was `setCseShimGate`, called from bridge init, and the module's own comment records that an unregistered gate means the shim is active — which is what the port produces. This is the one entry the fixture marks `mode: "adapt"`.
2. `components/Spinner.tsx` — `SHIMMER_INTERVAL_MS`, `computeGlimmerIndex` and `computeShimmerSegments` from `bridge/bridgeStatusUtil.ts:20,53-77,80-116`. The shimmer is a plain progress animation, not bridge state; only its module home was bridge.
3. `cli/transports/ccrClient.ts` — `decodeJwtPayload` and `decodeJwtExpiry` from `bridge/jwtUtils.ts:22-58`. The CCR client is the `--sdk-url` transport this build keeps; the 401-with-expired-JWT early exit it drives is local transport logic.

### Behaviour changes

Two are visible and deliberate. `--remote-control` / `--rc` is gone as a flag, a command and an AppState input, so `replBridgeEnabled` now starts from `getRemoteControlAtStartup()` alone — the field family stays because `ConfigTool`, `migrations/migrateReplBridgeEnabledToRemoteControlAtStartup.ts` and `services/api/emptyUsage.ts` still read it, and removing it is the remote-control-leftovers wave. And `resolveAndPrepend` is gone from `print.ts`'s inbound prompt path: it fetched web-composer `file_uuid` attachments from `/api/oauth/files/{uuid}/content` with the bridge token, which is exactly the account-network shape this wave removes. The prompt content is passed through unchanged.

### Kept as inert declarations

- The `replBridge*` AppState family (14 fields) and `getRemoteControlAtStartup()`. Survivors read them; nothing produces bridge state any more.
- `utils/sessionIngressAuth.ts` and the `sessionIngressToken` bootstrap field, still read by `services/mcp/client.ts`, `utils/filePersistence/` and `main.tsx`.
- `cli/remoteIO.ts`, `cli/transports/` and `--sdk-url` streaming. `RemoteIO` keeps its `isBridge` env check and its debug stdout echo; only the keep-alive timer depended on a deleted module.
- `commands/bridge/` held only three `*.w54bak` files, already quarantined in `.audit/w61-source-baks/`; the directory was removed after a byte comparison.

### Verification

`tsc --noEmit --pretty false` exits 0; all five owned fixtures pass; `git diff --check` clean. No `bridge/*.w*bak` file ever existed — the directory was never edited in an earlier wave — so the only baks to quarantine were the nine under `hooks/` and `components/`, copied to `.audit/w65-e5-baks/` and `cmp`-verified before the deletions. Two repair passes: one `cut_range` whose start anchor sat *after* the end anchor of the previous cut (the remoteIO keep-alive comment block), and one replacement that left a doubled `}` at the end of `tools/BriefTool/attachments.ts`.

## Wave D step 2 — the OAuth service and the token store (landed, `e47f4a5`)

`services/oauth/` is gone: 6 files, 1,064 lines — `client.ts` (the authorize/exchange/refresh/profile/roles/keychain surface), `index.ts` (`OAuthService`), `auth-code-listener.ts` (the loopback redirect listener), `crypto.ts` (PKCE), `getOauthProfile.ts` (the account API) and `types.ts`. The wave came in well under the size the plan expected because waves E 4 and 5 had already deleted the remote sites: `getOrganizationUUID` and `storeOAuthAccountInfo` were left with **zero importers**, so only five hosts needed re-stitching.

### What `utils/auth.ts` keeps

The token reader survives with its two local sources and no others — `CLAUDE_CODE_OAUTH_TOKEN` and the token from the file descriptor — and returns `null` where it used to read the encrypted keychain blob. Removed with the keychain read: `saveOAuthTokensIfNeeded`, the cross-process `.credentials.json` staleness check (`invalidateOAuthCacheIfDiskChanged` and its `lastCredentialsMtimeMs`), the 401 recovery chain (`handleOAuth401ErrorImpl`, `pending401Handlers`, the "another tab already refreshed" keychain comparison), the lock-guarded refresh scheduler behind `checkAndRefreshOAuthTokenIfNeededImpl` (five retries, `ELOCKED` backoff, double-checked re-read) and `getClaudeAIOAuthTokensAsync`'s async storage read. `handleOAuth401Error` and `checkAndRefreshOAuthTokenIfNeeded` keep their signatures and return `false` unconditionally, which is what an unrefreshable env-var bearer means; both carry a doc comment saying so.

### Adaptations (ported, not invented)

1. `shouldUseClaudeAIAuth` — ported verbatim from `services/oauth/client.ts:38-40`, with the `CLAUDE_AI_INFERENCE_SCOPE` constant now imported from `constants/oauth.ts`.
2. `isOAuthTokenExpired` — ported verbatim from `services/oauth/client.ts:344-353` (5-minute buffer). It has two homes because two callers needed it: `utils/auth.ts` and `services/analytics/firstPartyEventLoggingExporter.ts`, whose `isClaudeAISubscriber()` guard reads it. Both cite the same range; the exporter's copy is noted as going with the exporter's own removal.
3. `OAuthTokens` and `SubscriptionType` — **no source form exists to port.** `services/oauth/types.ts` was itself a stub created during reconstruction ("this module is absent from the dump; names are taken from the import sites", eleven `any` aliases). The two names still needed are declared from evidence instead: `OAuthTokens` from the field names `getClaudeAIOAuthTokens` constructs and `saveOAuthTokensIfNeeded` persisted as a group, `SubscriptionType` from the plan literals the predicates compare against and `isConsumerPlan`'s narrowing. This is recorded rather than glossed, because it is the one place the wave invents a declaration.

### Host cuts

| Host | What went |
| --- | --- |
| `components/ConsoleOAuthFlow.tsx` | Deleted (611 lines). Reached the browser-based login flow. |
| `components/Onboarding.tsx` | The `oauth` step, its `skipOAuth` state, and `SkippableStep` — whose only consumer the oauth step was, so the exported wrapper is gone too |
| `cli/handlers/util.tsx`, `main.tsx` | `setupTokenHandler` and the `claude setup-token` subcommand; minting an OAuth token was the command's whole purpose |
| `entrypoints/init.ts` | The `populateOAuthAccountInfoIfNeeded()` call and its profile checkpoint |
| `utils/config.ts` | The `services/oauth/types.js` type import; `BillingType` is now a local alias, noted as standing in for a stub |
| `services/analytics/firstPartyEventLoggingExporter.ts` | The `oauth/client` import, replaced by the ported helper |

### Verification

`tsc --noEmit --pretty false` exits 0; all six owned fixtures pass (the new `w65-d2-verify` compares both ported bodies textually and behaviourally against the recovered source, asserts the module and its UI are absent, and sweeps for eight live-reference patterns); `git diff --check` clean; +81/−2,105. One `*.w54bak` source map quarantined to `.audit/w65-d2-baks/components/` and `cmp`-verified before deletion — `services/oauth/` itself never had one. The `w65-e5-verify` fixture was rebound to its own wave commit (`88545db`) rather than `HEAD`, because a HEAD-relative deletion check stops being true as soon as the next wave lands.

## Wave D step 3 — the BigQuery metrics exporter and the importer-graph scan (landed, `c11b5be`, `41e43e3`, `1bc1bc0`)

Two things landed together, and the second is the more useful one.

**The exporter.** `utils/telemetry/bigqueryExporter.ts` (243 lines) POSTed OpenTelemetry metrics to a claude.ai-hosted endpoint with account auth headers, gated by a predicate that was pure account-plan logic: `is1PApiCustomer() || (isClaudeAISubscriber() && subscription is enterprise|team)`. Deleted, with its only consumer `utils/telemetry/instrumentation.ts` losing the import, `getBigQueryExportingReader`, `isBigQueryMetricsEnabled` and the reader push (9 files, +1/−1,888 with the orphans below). The user-configured OTLP path behind `CLAUDE_CODE_ENABLE_TELEMETRY` stays: that endpoint is the user's, not the account's.

**The scan.** `.audit/w65-orphans.mjs` builds the import graph over all 1,715 source files — resolving relative specifiers, the `src/` alias, the `.js`-spelling-of-`.ts` convention and directory `index` files — and lists files with zero importers. Four earlier waves each rediscovered this category by hand (`services/api/adminRequests.ts`, `components/RemoteEnvironmentDialog.tsx`, `getOrganizationUUID`, `storeOAuthAccountInfo`); this names it in one pass. It found seven:

| Removed | Left behind by |
| --- | --- |
| `components/Stats.tsx` (1,166 lines) | Package 1's non-coding slash-command cut |
| `constants/github-app.ts` | The same cut, via `commands/install-github-app/`, which had already lost its `.tsx` sources |
| `components/ManagedSettingsSecurityDialog/` (dialog + its `utils.ts`) | Wave A's managed-settings cut |
| `services/mcp/InProcessTransport.ts` | The in-process MCP branch, which went with the computer-use and chrome clusters |
| `components/tasks/WorkflowDetailDialog.ts`, `services/skillSearch/prefetch.ts` | Reconstruction-era stubs with nothing pointing at them |

**The useful property is that the scan is run again after a deletion, not just before it.** Re-running it named two further orphans that only the `Stats.tsx` deletion created — `utils/heatmap.ts` and `utils/screenshotClipboard.ts`, its two private helpers — which a name grep cannot find and a single pre-cut pass would have missed. That follow-on is `41e43e3` (−321).

**And again after that.** Re-running it a third time named `utils/ansiToPng.ts`, which nothing but `screenshotClipboard.ts` had ever imported; reading `ansiToPng` then showed its `parseAnsi` import as `ansiToSvg`'s only edge. So the chain is four levels deep:

```
components/Stats.tsx -> utils/screenshotClipboard.ts -> utils/ansiToPng.ts -> utils/ansiToSvg.ts
```

`1bc1bc0` removes the last two (−606). Each level was found by the scan that ran after the level above it was gone, and none of the three could have been found by grepping for names: once the head of the chain is deleted, no surviving file names anything behind it. This is the same lesson as the brace-depth counter from wave E step 4 and the `onOpenRateLimitOptions` chain from wave C, sharpened — the removal's own aftermath is not one reconnaissance step but a sequence of them, and it terminates only when a scan comes back with nothing but known-legitimate entries.

### Verification

`tsc --noEmit --pretty false` exits 0 after all three commits; all six owned fixtures pass; `git diff --check` clean; 13 files, +1/−2,815. No `*.w*bak` existed for any removed file except `ManagedSettingsSecurityDialog.tsx`, copied to `.audit/w65-d3-baks/` and byte-compared first; the ANSI pair was checked for sibling baks with a directory glob before removal (the `find <file> -name '*.w*bak'` form finds nothing, since a sibling bak is named `<file>.w54bak`).

The zero-importer list is down from 12 to 10 entries, and all ten are legitimate: the `entrypoints/cli.tsx` entry point, six ambient `*.d.ts` declarations (`types/vendor.d.ts`, `types/lodash-es.d.ts`, `types/assets.d.ts`, `types/globals.d.ts`, `types/react-compiler-runtime.d.ts`, `ink/global.d.ts`), `shims/bun-bundle.ts`, `utils/withResolvers.ts`, and `native-ts/color-diff/index.ts`, which the native-module loader resolves by path rather than by import. That list is what "the cascade has terminated" looks like: every remaining entry has a reason it is on it, so the scan is now a no-op and further passes would find nothing.

## Wave D step 4 — the feedback-survey and transcript-share surface (landed, `5b50aac`)

The survey family was a question asked for Anthropic's benefit and a network call to answer it. `components/FeedbackSurvey/` held ten files and 1,538 lines: the session, memory and post-compact hooks, the shared survey state machine and digit-input debouncer, the view, the transcript prompt, and `submitTranscriptShare.ts`, which POSTs the whole conversation to `api.anthropic.com/api/claude_code_shared_session_transcripts`. The closure check came out clean in every direction — the gate `isFeedbackSurveyDisabled` was read by nothing but the three hooks, and the two config fields the hooks wrote (`feedbackSurveyState`, `transcriptShareDismissed`) were read by nothing but each other.

Two satellite chains belong to the same feature and went with it:

- `utils/autoRunIssue.tsx` plus the REPL's `autoRunIssueReason` / `didAutoRunIssueRef` / `handleAutoRunIssue` / `handleCancelAutoRunIssue` chain, which existed so a "bad" answer could submit `/issue`.
- `handleSurveyRequestFeedback`, which existed so the survey's `[1]` key could submit `/feedback`.

The ant-only frustration detector was already a local stub in this build (`useFrustrationDetection` returned `{state: 'closed'}` unconditionally), so its call site and the JSX branch behind it were unreachable; both are gone.

### The one rehomed body, and why it is an adaptation

`components/SkillImprovementSurvey.tsx` **survives**, and the reason is worth recording: its hook calls `applySkillImprovement`, which edits the user's skill files on disk. That is local behaviour, not account behaviour, so the survey stays even though its sibling did not. It imported two symbols from the deleted directory, and both needed somewhere to live:

| Symbol | Disposition |
| --- | --- |
| `isValidResponseInput` | Ported from `FeedbackSurveyView.tsx:13-24`. Body identical; the accepted set is narrowed from the source's `['0','1','2','3']` to this survey's own `VALID_INPUTS` (`['0','1']`), because a two-option prompt must not accept `2`. |
| `FeedbackSurveyResponse` | Re-declared as `SkillSurveyResponse = 'good' \| 'dismissed'` in `utils/hooks/skillImprovement.ts`. The deleted module was a reconstruction stub of `any` aliases with no source body, so the union is read off the survey's two live users — the literal its view emits and the literal its hook tests. Same declaration class as the wave D step 2 `OAuthTokens` case, and flagged the same way. |

### The scan after the cut, again

Re-running `.audit/w65-orphans.mjs` immediately named two modules this cut itself had orphaned, and neither would have been found by grepping for the removed names:

- `components/Feedback.tsx` (758 lines) — the `/feedback` screen, whose command was removed in package 1. It POSTs to `api.anthropic.com/api/claude_cli_feedback` and summarizes with a Haiku call, so it is account-network twice over.
- `hooks/useDynamicConfig.ts` (23 lines) — a GrowthBook-backed hook with no remaining caller.

One process note: `w65-d4d.py`'s own pre-delete assert caught a sibling `Feedback.tsx.w54bak` that I had assumed absent, which is why the quarantine ran in `w65-d4e.py` instead. The assert is the reason the bak exists in `.audit/w65-d4-baks/` rather than having been deleted with the file.

### Verification

`tsc --noEmit --pretty false` exits 0; seven owned fixtures pass, the seventh being the new `w65-d4-verify`, which compares the ported validator against the recovered source over digit probes with the narrowing recorded as an explicit difference, asserts the response vocabulary reaches both of its users, and sweeps twelve removed names for live references. `git diff --check` clean. 20 files changed, +33/−2,623. Eight `*.w54bak` files quarantined to `.audit/w65-d4-baks/` and byte-compared before deletion.

The scan is back to its ten known-legitimate entries, so this cut's cascade has terminated.

## Wave D step 5 — the voice cluster (landed, `6e580ac`)

`VOICE_MODE` is one of the 88 flags that constant-fold to false in this build, so every read of it already took the fallback. The cluster still typechecked, and what it typechecked is the account path — `voice/voiceModeEnabled.ts` states the reason in its own comment: voice mode requires Anthropic OAuth because it streams audio to the `voice_stream` WebSocket on `api.anthropic.com` with `stt_provider=deepgram-nova3`. That is the same boundary the rest of this wave is drawn along.

| Removed | Lines |
| --- | --- |
| `hooks/useVoice.ts` | 1,144 |
| `services/voiceStreamSTT.ts` | 544 |
| `services/voice.ts` | 525 |
| `services/voiceKeyterms.ts` | 106 |
| `voice/voiceModeEnabled.ts` | 54 |
| `hooks/useVoiceIntegration.tsx`, `hooks/useVoiceEnabled.ts`, `context/voice.tsx` | — |
| `components/PromptInput/VoiceIndicator.tsx`, `components/LogoV2/VoiceModeNotice.tsx` | 114 |

### The hosts

Eleven files, and every arm had the same shape — `feature('VOICE_MODE') ? X : fallback` — so each cut keeps the fallback:

- `state/AppState.tsx` — the `VoiceProvider` conditional require, whose external build was already `({children}) => children`; the wrapper at the call site went with it.
- `keybindings/defaultBindings.ts` — `space: 'voice:pushToTalk'`, plus the action's entry in `schema.ts` and its `validate.ts` branch. The action had no handler left, so leaving it registered would have kept a no-op binding that still warned about warmup.
- `tools/ConfigTool/supportedSettings.ts`, `utils/settings/types.ts` — the `voiceEnabled` registration in both registries.
- `tools/ConfigTool/prompt.ts` — the GrowthBook filter that hid the key from the model prompt.
- `tools/ConfigTool/ConfigTool.ts` — the kill-switch pre-check and the ~50-line pre-flight (auth check, `isVoiceStreamAvailable`, `checkRecordingAvailability`, `checkVoiceDependencies`, microphone permission with per-platform guidance), plus the `settingsChangeDetector.notifyChange` call whose stated reason was to resync `AppState.settings` for `useVoiceEnabled`.
- `screens/REPL.tsx` — the two `typeof import` conditional requires, the `useVoiceIntegration` call, and both `VoiceKeybindingHandler` mounts.
- `components/PromptInput/Notifications.tsx` — the conditional-require indicator, the three voice state selectors and the early return that replaced all notifications with the indicator.
- `components/PromptInput/PromptInputFooterLeftSide.tsx` — the warmup hint, the hold-to-speak hint, the mount-time hint counter and its `useEffect` write, and `MAX_VOICE_HINT_SHOWS`.
- `components/TextInput.tsx` — the waveform cursor, its five tuning constants and the animation frame that drove it.

### Dead parameters with no supplier left

Three props existed only so the voice cluster could reach into shared components, and all three were cut with it: `insertTextRef` and `voiceInterimRange` on `PromptInput` (STT spliced text at the cursor and dimmed interim dictation), and `hidePlaceholderText` on `BaseTextInput`/`renderPlaceholder` (the recording state blanked the placeholder). Four voice counters left `utils/config.ts` the same way — `voiceNoticeSeenCount`, `voiceLangHintShownCount`, `voiceLangHintLastLanguage`, `voiceFooterHintSeenCount`.

Two user-visible strings that had become untrue were corrected rather than left: the `language` setting's description no longer advertises dictation, and `LanguagePicker` no longer says "response and voice language".

### The one shape worth recording

`TextInput`'s `invert` was a three-arm chain: no cursor, voice waveform, `chalk.inverse`. The cut leaves the two arms the source's own external build runs, and `animRef` keeps the value that build assigned it — `[() => {}, 0]` destructured, of which only the ref ever reached the `Box`. Nothing was invented; both are the flag's false arm made literal.

### Verification

`tsc --noEmit --pretty false` exits 0; eight owned fixtures pass. The new `w65-d5-verify` asserts no `feature('VOICE_MODE')` read survives, no import edge names any of the ten removed paths, the seven removed symbol families (`voice:pushToTalk`, `hidePlaceholderText`, the four counters, `insertTextRef`/`voiceInterimRange`) are unreferenced, and the surviving shapes are the external-build ones. `git diff --check` clean; 28 files changed, +24/−3,792; four `*.w54bak` quarantined to `.audit/w65-d5-baks/` and byte-compared first.

One honest note about the tooling: the import-graph scan could not have found this cluster. Every one of these modules was reached through a conditional `require` inside a flag ternary, not through an import edge, so the scan's list is unchanged at its ten legitimate entries — this is the wave where the scanner was the wrong instrument and reading the flag's own call sites was the right one.

## Wave D step 6 — the first-run connectivity and region preflight (landed, `b2c553b`)

`utils/preflightChecks.tsx` (151 lines) was the first onboarding step whenever `isAnthropicAuthEnabled()` was true. It fetched two endpoints — `${getOauthConfig().BASE_API_URL}/api/hello` and the OAuth token origin's `/v1/oauth/hello` — and on any failure printed `Claude Code might not be available in your country` with a link to `anthropic.com/supported-countries`, then called `process.exit(1)` 100ms later.

Two of those three properties put it inside the boundary: it talked to the account and region service, and its failure mode was to stop the agent from starting at all. Removed with its step id in `Onboarding`'s `StepId` union; theme, API-key approval, security and terminal setup are untouched. 2 files, +1/−157.

**Kept deliberately:** `utils/apiPreconnect.ts`. It looks account-shaped — it reads `getOauthConfig().BASE_API_URL` — but its comment and code are explicit that this is the *inference* host's connection pool (`ANTHROPIC_BASE_URL || BASE_API_URL`), warmed with a HEAD so the first real API call skips a TCP+TLS handshake. That is a local startup optimization on a path that stays, not an account call. The distinction the whole wave turns on: reading the OAuth *config* is not the same as using the OAuth *account*.

## Wave D step 7a — the two analytics transports (landed, `18fbacc`)

The one decision still open from the wave-D plan, now scoped in `.audit/w65-d7-recon.md`. The package is 4,020 lines across nine modules with 232 importing files, and the shape of the cut follows wave D step 3's precedent: remove the outbound transports, keep the local entry points inert so 232 call sites do not churn.

| Transport | Endpoint | Disposition |
| --- | --- | --- |
| `datadog.ts` (307 lines) | `http-intake.logs.us5.datadoghq.com` | delete the transport; `logEvent`'s Datadog arm goes with it |
| `firstPartyEventLoggingExporter.ts` (820) | `api.anthropic.com` / `api-staging` | delete the exporter; already lost its BigQuery reader in step 3 |
| `growthbook.ts` (1,155) | `api.anthropic.com/` GB proxy + Statsig gates | drop the fetch; `getDynamicConfig` returns the caller's default, which is the documented no-init behaviour; keep `setGrowthBookConfigOverride` and the env overrides so local behaviour stays configurable |
| `sink.ts` (114) | local fan-out | shrink to the surviving arms |

The two questions this scoping left open were answered by reading the sources rather than guessing, and both answers made the cut larger than "dead code":

**`is1PEventLoggingEnabled()` was `!isAnalyticsDisabled()`, which is true in a normal run.** So the exporter was not sitting behind a dead flag: every session POSTed its event batches to `api.anthropic.com/api/event_logging/batch`, with an axios retry queue, an on-disk batch spool and a killswitch probe. This is a live behaviour change, not dead-weight removal, and it is the intended one.

**GrowthBook's enable switch was literally `return is1PEventLoggingEnabled()`.** Delete the logger and the switch is false, so `new GrowthBook(...)`, `remoteEval` and the periodic refresh can no longer be reached and every `getFeatureValue` / `getDynamicConfig` read answers with its caller's default — the documented no-init behaviour. The switch is written as a literal `false` carrying that citation rather than deleted outright, because collapsing the machinery around it is step 7b.

### What went, and what stayed inert

Deleted: `datadog.ts` (307), `firstPartyEventLoggingExporter.ts` (820), `firstPartyEventLogger.ts` (451), `sink.ts` (114), `sinkKillswitch.ts` (25), the generated `growthbook_experiment_event` proto type (224), and `hooks/useTimeout.ts` (15), which step 6's preflight deletion had already orphaned. `services/analytics/index.ts` is kept as an inert API — the two marker types plus `logEvent`/`logEventAsync` as no-ops — so roughly 230 call sites stay readable instead of churning. Host cuts: `utils/sinks.ts` now attaches only the error-log sink, `main.tsx` drops the gates call, `entrypoints/init.ts` drops the deferred `import('../services/analytics/firstPartyEventLogger.js')` block and its `profileCheckpoint`, and `utils/gracefulShutdown.ts` drops the 500ms racing flush.

Two smaller removals the deletion made mandatory rather than optional: `utils/config.ts` loses `insideGetConfig` and its recursion guard (the sampler that re-entered the config reader was its only reason to exist) in favour of the `logError(error)` the guard was standing in for; and `metadata.ts` keeps its tool-name and skill-name helpers, which have live consumers in the tool execution path, while its `getEventMetadata` / `buildProcessMetrics` / `FirstPartyEventLogging*` converters now have no reader — a deferred in-file cleanup recorded here rather than done in this pass.

The import-graph scan, re-run after the cut, named both new orphans (`growthbook_experiment_event.ts` and `hooks/useTimeout.ts`). 17 files, +55/−2,190. tsc 0, nine fixtures pass (new `w65-d7-verify`, which asserts the seven paths against the base commit and sweeps every removed symbol as a resolution edge so the cut's own citation comments cannot self-match), `git diff --check` clean.

## Wave D step 7b — the GrowthBook fetch machinery (landed, `25c134f`)

Step 7a left the module's switch as a literal `false`, which is what made the client unconstructible. This step removes the machinery that switch guards, leaving the local half the module still serves: the env-var override channel (`CLAUDE_INTERNAL_FC_OVERRIDES`) and the `growthBookOverrides` config channel, both consulted before the switch exactly as in the source. 1,148 lines to 457; 6 files, +126/−847.

Gone: the client construction with its trust check, auth headers, ant base-URL override and attribute set; the remote-eval payload transform and its `{value}` → `{defaultValue}` workaround; the disk-cache writer; the exposure log and its three tracking sets; the light refresh; the periodic interval (6h, 20min for ants) and its two named process handlers; the user-attribute builder; `getApiBaseUrlHost`; `getAllGrowthBookFeatures`; and `constants/keys.ts`, whose single export — the GrowthBook SDK client key — had exactly one caller, the client construction.

### The one design call: the disk cache does not survive

`getFeatureValue_CACHED_MAY_BE_STALE` fell back to a disk cache that `syncRemoteEvalToDisk` had written from the last successful remote-eval payload. Two reasons it goes rather than moves: it is a stale copy of *server* state rather than local configuration, and in the source it sat **below** the `!isGrowthBookEnabled()` guard. Honouring it would mean moving the guard above it, which is the one thing a port of this kind may not do — so a read without a local override answers with the caller's default, and that is a recorded behaviour change for any session whose cache held a value.

### Two things a later reader needs

**The duplicated return is load-bearing.** Each read keeps the source's `if (!isGrowthBookEnabled())` line and then returns the same value a second time. With this tsconfig's `"strict": false`, tsc accepts falling off the end of the function, so deleting that second return compiles clean and silently hands all ~80 call sites `undefined` instead of their default. Both facts were measured, not assumed: with `: false` on the switch the file compiles, and with the tail removed it also compiles. The fixture pins the counts (four `return defaultValue`, six `return false`, six guards).

**The three zero-caller local functions stay.** `setGrowthBookConfigOverride`, `clearGrowthBookConfigOverrides` and `getGrowthBookConfigOverrides` have no caller left — the `/config Gates` panel that used them left in an earlier wave, and `main.tsx`'s import of `hasGrowthBookEnvOverride` was a dead import that this step removed. They stay because they are the local writer of the path the reads consult, and because they are the only remaining emitter of `onGrowthBookRefresh`, which two live hooks (`useSkillsChange`, `useMainLoopModel`) subscribe to. Deleting them would have cascaded into both hooks for no observable gain.

`utils/config.ts` loses the three flag-cache fields with it. `cachedStatsigGates` and `cachedGrowthBookFeatures` had their last readers here; `cachedDynamicConfigs` had already lost both its reader and its writer when the Statsig client left, and goes with its siblings rather than staying as the odd one out.

### Verification

The surviving bodies were extracted verbatim from `b2c553b` rather than retyped, and the new `w65-d7b-verify` fixture checks each of eight of them word-for-word against that revision, alongside the absence sweep for the 22 collapsed declarations (matched by declaration form, since this cut's own comments still name three of them) and the count assertions above. tsc 0, ten fixtures pass, `git diff --check` clean. The orphan scan, re-run after the deletion, stays at its ten legitimate entries. The step-7a fixture was amended in one assertion — the exposure-log line it checked is what 7b deliberately removes.

**Next (step 7c):** `services/analytics/metadata.ts`'s `getEventMetadata`, `buildProcessMetrics` and the `FirstPartyEventLogging*` converters, and with them `utils/user.ts`'s `getUserForGrowthBook` → `getCoreUserData` → `CoreUserData` chain. All of it is reader-less now; the only live surface left in `metadata.ts` is the tool-name and skill-name helpers the tool path still calls.

## Wave D step 7c — the record builders and the generated protos (landed, `ce11027`)

`services/analytics/metadata.ts` existed to build one record: an environment context, a process-metrics sample, the swarm/team agent identification, the user data, and a 1P snake_case formatter. `getEventMetadata` assembled them for the two transports that went in step 7a, and step 7b then took the last remaining reader — `tools/BashTool/bashSecurity.ts` names the function only in a note about `process.memoryUsage`. So the module's second half was dead as one contiguous block and went as one: from the `EnvContext` type to the end of the file. 950 lines to 363; 4 files, +10/−1,749.

What is left is the part the tree still calls, and after this it is a PII-redaction module rather than a metadata module: the tool-name sanitizer (21 files), the MCP-detail, skill-name and bounded tool-input helpers (`services/tools/toolExecution.ts`), the file-extension helpers for two callers, and the `not_code_or_filepaths` marker type (137 files). Nine surviving lines are checked word-for-word against the base revision by the new fixture. The import block shrank from twenty-one bindings to four, because every other one existed for the dead half.

### The deletion named its own orphans, twice

The cut made `types/generated/events_mono/claude_code/v1/claude_code_internal_event.ts` — the 866-line 1P event proto type — unreferenced. Deleting that made `events_mono/common/v1/auth.ts` and `google/protobuf/timestamp.ts` unreferenced, because this file was each one's only importer. The scanner caught both rounds: 11 orphans after the truncation, back to the ten legitimate entries after the second deletion. This is the third time the post-cut re-scan has found a chain nothing else would (wave D step 3's `Stats.tsx` cascade, then the voice cluster, now this), and the first time it found a *second* round caused by the first round's own cleanup.

**Recorded finding:** `types/generated/` now holds no files at all. Every generated proto type in this tree existed for the 1P event payload, so the last of them left with the last importer. Anyone looking for the proto schemas should know the directory is emptied deliberately rather than by accident.

### Verification

tsc 0, eleven fixtures pass, `git diff --check` clean (one repair: the truncation left a blank line at EOF, which `git diff --check` caught and the same script's neighbour removed). The orphan scan's ten remaining entries are all legitimate — a vendored TypeScript file, ambient declaration files, the CLI entrypoint, a shim and a utility with no importer by design.

**Next (step 7d):** the last reader-less cluster this wave left behind. `utils/user.ts`'s `getUserForGrowthBook` → `getCoreUserData` → `CoreUserData` chain (all three reader-less now, and `CoreUserData`'s only other mention was the dead half of `metadata.ts`), the `initUser`/`resetUserCache` pair in `main.tsx` that exists to pre-fetch the email those records carried, the `GitHubActionsMetadata` type whose remaining user was this cut's generated file, and three exports 7c orphaned in modules that keep other live exports: `utils/git.ts`'s `getRepoRemoteHash`, `utils/platform.ts`'s `getLinuxDistroInfo` and `detectVcs`.

## Wave D step 7d — the leftovers the analytics removal stranded (landed, `11e5a4c`)

Four files, one shape: modules and call sites whose only purpose was to feed the transports removed in 7a and the record builders removed in 7c. 4 files, +8/−335.

`utils/user.ts` existed to build the analytics user record. `getCoreUserData` assembled it, `getUserForGrowthBook` was its GrowthBook variant, `initUser` pre-fetched the email so the record could stay synchronous, and `resetUserCache` cleared that cache on login/logout. All four, the `CoreUserData` and `GitHubActionsMetadata` types, and the two email helpers behind them had no reader left — 194 lines to 33, leaving the one export with a live caller, `getGitEmail`, which `utils/exampleCommands.ts` calls.

`main.tsx` loses the startup prefetch and the post-login reset that went with it. **Two behaviour changes worth naming because they are real rather than notional:** the tree no longer spawns `git config --get user.email` during startup, and the `if (onboardingShown)` block that ordered the cache reset before a GrowthBook refresh is gone entirely rather than left as a no-op call. The prefetch comment above the skip-list was corrected to stop naming a prefetch that no longer exists.

Three exports that step 7c orphaned, in modules that keep other live exports:

- `getRepoRemoteHash` (`utils/git.ts`) hashed the normalized remote for the analytics `rh` field; `normalizeGitRemoteUrl` was its only caller and `isLocalHost` was the normalizer's only helper, so all three went, taking the `crypto` import with them.
- `getLinuxDistroInfo` and `detectVcs` (`utils/platform.ts`) filled the environment context, and took the `fs/promises` and `os` imports. `getPlatform`, `getWslVersion` and `SUPPORTED_PLATFORMS` stay.

### One call site is now deliberately caller-less

`refreshGrowthBookAfterAuthChange` had exactly one caller — the block removed here — so its export is now the fourth caller-less export in `growthbook.ts`, alongside the local override trio 7b kept on purpose. It stays for now rather than being deleted in this package, and the reason is mechanical: `w65-d7b-verify` pins the guard-brace count at 6, and deleting this function drops it to 5. Step 7e should take it together with `initializeGrowthBook`'s two remaining warm-up calls (`interactiveHelpers.tsx`, `cli/print.ts`) and move that fixture in the same commit.

### Verification

tsc 0, twelve fixtures pass, `git diff --check` clean, the orphan scan at its ten legitimate entries. Three exports the cut could have orphaned were checked and still have readers: `getRateLimitTier`, `getOrCreateUserID`, `getHostPlatformForAnalytics`.

**Next (step 7e):** the growthbook warm-up surface — `refreshGrowthBookAfterAuthChange`'s caller-less export, `initializeGrowthBook`'s two `void` calls, the `checkGate_CACHED_OR_BLOCKING('tengu_harbor')` call inside `interactiveHelpers.tsx`'s dead `KAIROS` block, and the resulting move of the 7b fixture.

## Wave D step 7e — the GrowthBook warm-up surface (landed, `0e225a4`)

Three exports and two call sites existed only to warm up, reset and refresh a client that cannot be constructed. Each had already lost every local effect: `initializeGrowthBook`'s body was `return null` (step 7b collapsed it to the source's own disabled-switch arm), `resetGrowthBook`'s only remaining work was clearing the memoized parse of `CLAUDE_INTERNAL_FC_OVERRIDES` that nothing re-read, and `refreshGrowthBookAfterAuthChange` emitted a refresh no write could have changed. Step 7d removed the last caller of the third and deliberately left the export so this step could take it together with the fixture it moves. 3 files, +12/−63. **Behaviour change: none** — every removed export was a no-op under the false switch.

Both call sites were warm-ups: `interactiveHelpers.tsx`'s after-trust block and `print.ts`'s headless entry. The trust block keeps `setSessionTrustAccepted(true)` and the `getSystemContext` prefetch; `print.ts` keeps both profiler calls that surrounded it. Two comments went with them: the header note about `resetGrowthBook` not clearing the listener set, and the trust-block comment that awaited "the same memoized `initializeGrowthBook` promise fired earlier".

### What was deliberately not taken

`checkGate_CACHED_OR_BLOCKING` keeps its export because it keeps a caller — inside `interactiveHelpers.tsx`'s `KAIROS_CHANNELS` dev-channels block. That block is dead by constant folding, but removing it is a package of its own rather than a tail of this one: **54 files read `KAIROS` or `KAIROS_CHANNELS`, 124 times between them.** The two cannot be separated without straddling a package boundary, so the gate function waits for that package (step 7f).

With the `type GrowthBook` import gone, `@growthbook/growthbook` now has **zero importers** in the tree. It is not removed from `package.json` here: the lockfile is generated, and hand-editing one package out of it is a worse risk than carrying the entry until a dependency-pruning pass does the whole set. That pass is named in the remaining-waves list below.

### Verification

The 7b fixture's guard-brace count moved from 6 to 5 in this commit, exactly as step 7d's record predicted it would have to — the third amendment to a per-step fixture this wave, and the reason the note was written where the next package would read it rather than only in this section. tsc 0, thirteen fixtures pass, `git diff --check` clean, the orphan scan unchanged at its ten legitimate entries.

**Next (step 7f):** the `KAIROS` / `KAIROS_CHANNELS` cluster — 54 files, 124 flag reads, including `interactiveHelpers`' dev-channels dialog block and, with it, `checkGate_CACHED_OR_BLOCKING` and its import.

## Wave D step 7f — the channel notification surface (landed, `64c2520`)

A channel is an MCP server that pushes user messages into the conversation: the server sends `notifications/claude/channel`, the process wraps the content in a `<channel>` tag, enqueues it at priority `next`, and the model replies through the server's own tool. The gate in front of it read, in order, the server's `claude/channel` capability, the GrowthBook `tengu_harbor` killswitch, a claude.ai OAuth token, the managed org's `channelsEnabled` policy, the session's `--channels` list, the marketplace the plugin actually came from, and the `tengu_harbor_ledger` allowlist. Four of those are remote account inputs, so the whole surface is the kind the port excludes, and every site read `feature('KAIROS') || feature('KAIROS_CHANNELS')` — both false. 25 files, +8/−1,928. **Behaviour change: none** (all under false flags; nothing local depended on the state it kept).

### What went

Six modules: `services/mcp/channelAllowlist.ts` (the ledger read and the plugin-source check), `channelNotification.ts` (the notification schemas, `wrapChannelMessage`, `findChannelEntry`, `gateChannelServer`), `channelPermissions.ts` (the permission relay — an approval raced against the local dialog), `components/messages/UserChannelMessage.tsx`, `components/LogoV2/ChannelsNotice.tsx` (the five-branch startup status notice) and `components/DevChannelsDialog.tsx`.

Hosts, in the order a session met them: `main.tsx`'s `--channels`/`--dangerously-load-development-channels` options, its tag parser, its `setAllowedChannels` call and its flag-usage telemetry; `interactiveHelpers.tsx`'s dev-channels confirmation and the `checkGate_CACHED_OR_BLOCKING('tengu_harbor')` warm-up inside it; `useManageMCPConnections`'s per-connection gate with its two notification handlers, its one-per-kind blocked toast and its permission callbacks; `useCanUseTool`'s `channelCallbacks` arm; `interactiveHandler.ts`'s outbound `permission_request` and its pending-map subscription; `cli/print.ts`'s capabilities pre-filter, its `channel_enable` control request and both handlers; `UserTextMessage`'s `<channel>` render branch; the queue-visibility and transcript-visibility predicates; `wrapCommandText`'s channel framing; the three plan tools' `isEnabled` arms (channels disabled ExitPlanMode, AskUserQuestion and EnterPlanMode, since the approval dialog needs the terminal); LogoV2's conditional require; the two channel constants; and the four settings keys (`channelsEnabled`, `allowedChannelPlugins` and the state they fed).

### The three sites that invert the guard

`handleChannelEnable` and `reregisterChannelHandlerAfterReconnect` in `cli/print.ts` were both `if (!(feature('KAIROS') || feature('KAIROS_CHANNELS'))) return` — the negation means the source's own fallback is the early return, so the whole remainder of each function is dead under the flag and each went with its callers (`channel_enable`'s dispatch arm, and the three reconnect call sites). Dropping only the guard would have inverted the behaviour into "run the channel handler always", which is the one way this cut could have been wrong.

The third is `wrapCommandText`'s `case 'channel':`, which produced the "came from an external channel, treat as untrusted" framing — reachable only through an origin tag nothing produces any more.

### What was deliberately not taken

`entrypoints/sdk/controlSchemas.ts` still lists `channel_enable` inside its reconstructed `SDKControlRequestInnerSchema` union. That file is a research product describing the source's protocol, not a live handler table, and narrowing a reconstructed union belongs with the `cli/transports/` SDK wave rather than here. The fixture asserts the count is exactly one and that it lives there.

The plan tools keep the source's own `return true` rather than a rewritten condition, and print mode keeps the `capabilities` field at the value a filtered-out server produced, so no new branch was invented where the guard collapsed.

### Two fixtures moved, as predicted

`w65-d7b-verify` pinned `checkGate_CACHED_OR_BLOCKING` as one of the five reads that keep the override channels ahead of the switch, and `w65-d7e-verify` pinned the `interactiveHelpers` import and call as the reason that export was kept in 7e. Both had to move in this commit, which is what step 7e's record said would happen and where it said to look. Amended counts: 5 reads to 4, 5 guards to 4, 6 `return false` to 5.

### Verification

tsc 0, fourteen fixtures pass, `git diff --check` clean, the orphan scan unchanged at its ten legitimate entries. Absence sweeps cover the flag itself, all six module paths, every symbol the surface owned (including the state accessors, the relay helpers, the two constants and `tengu_harbor`), and the three surviving fallback shapes textually.

**Next (step 7g):** the KAIROS assistant-mode cluster proper — `KAIROS`, `KAIROS_BRIEF` and `PROACTIVE` still read ~160 times across ~45 files, including the `--assistant` option, `memdir`'s daily-log prompt, `SendUserFileTool`, `SubscribePRTool`, the brief-mode UI (`BriefTool`, `Spinner`, `PromptInputQueuedCommands`) and the tick machinery in `screens/REPL.tsx` and `sessionStorage.ts`.

## Wave D step 7g — the assistant-mode tool surface (`9825b9f`, landed)

Assistant mode's three tools were registered the way the rest of the flag family is: a conditional require at the top of `tools.ts` whose target is absent from this build, then a spread into the pool. `SendUserFileTool` (deliver a file to the user as a message), `PushNotificationTool` (push to a phone) and `SubscribePRTool` (GitHub PR webhooks) each sat behind their own flag — `KAIROS`, `KAIROS || KAIROS_PUSH_NOTIFICATION`, `KAIROS_GITHUB_WEBHOOKS` — all false. 8 files, +5/−180. **Behaviour change: none.** Nothing local read the settings the third one configured, and the pool array gained nothing while the flags were false.

Two things are worth recording for whoever reads this next.

**The name constant's three readers each folded to their own fallback.** `SEND_USER_FILE_TOOL_NAME` was read in `components/Messages.tsx` (the brief-turn filter's tool-name set), `tools/ToolSearchTool/prompt.ts` (a rule keeping the tool out of deferred search while the REPL bridge is active) and `utils/conversationRecovery.ts` (the tool_use match that decides whether an assistant turn is a checkpoint). In all three the constant itself was flag-gated, so removing it reproduces exactly what the false flag produced: the brief set keeps only the Brief name, the de-fer rule loses its SendUserFile case, and the recovery match keeps the two Brief names. That case was also the last use of the `isReplBridgeActive` import in that file, which goes with it; the export itself now has no caller in the product and stays with the `replBridge*` AppState leftovers already on the remaining list.

**A W47 port lost its last consumer.** `tools/SendUserFileTool/prompt.ts` was a named re-export of one name from the 2.1.296 shipped build (`recovered/chunk-5zy1gftc.js`), written when the dump omitted the module. Its three readers were exactly the constants removed here, so the port has no consumer left and is deleted; the recovered chunk stays untouched, since `recovered/` is the research archive rather than build input. Two prose comments elsewhere still name SendUserFile while documenting tool-arg shapes — inert, kept.

### Verification

tsc 0, fifteen fixtures pass, `git diff --check` clean, the orphan scan unchanged at its ten legitimate entries. Absence sweeps cover the three tool names, the three flags, the shared constant, the three settings keys and the notifChannel label variant; the surviving shapes are asserted textually (the pool's neighbouring SleepTool/MonitorTool conditions, all three readers, the label's unflagged name).

**Next (step 7h):** assistant mode's own state — `kairosEnabled` in `AppStateStore` with its four `main.tsx` sites, the `--assistant` option, the `assistantModule` stub that was already null, `getKairosActive`/`setKairosActive` (whose setter has no caller at all, so the getter is permanently false), and the KAIROS-alone reads in `BashTool`, `PowerShellTool`, `memdir`, `compact`, `attachments`, `StatusLine`, `fastMode`, `AgentTool` and `processSlashCommand`.

## Wave D step 7h — assistant mode's own state (`98e4ff1`, landed)

Step 7g removed the tools; this removes the state behind them. 23 files, +31/−474. **Behaviour change: none** — and that is the decisive fact, not an assumption: `setKairosActive` has no call site anywhere in the build (the only occurrence was the `main.tsx` import that went with it), and `main.tsx`'s `let kairosEnabled = false` is never reassigned. Both values are permanently false, so every read is a constant fold rather than a judgement call about what the flag "would" have done.

**What the fold looked like at each of the ten sites.** The `feature('KAIROS')`-guarded blocks drop out whole: `autoDream`'s `isGateOpen` line (`if (getKairosActive()) return false`), `memdir`'s daily-log block, the two tools' auto-background blocks, `attachments`' date-change flush, `StatusLine`'s hide rule and `processSlashCommand`'s 97-line fire-and-forget path. The `||` terms drop as single terms, keeping the rest of the expression: `fastMode`'s SDK guard, and the `getKairosActive() ||` term in `Spinner`, `UserPromptMessage` and `BriefTool` (`isBriefEntitled`, `isBriefEnabled`). `compact.ts` and `attachments.ts` both held `const sessionTranscriptModule = feature('KAIROS') ? null : null` — a ternary whose arms were already identical — with three call sites behind `feature('KAIROS')` guards; all of it goes, and the pragma pair that existed only for that const in `compact.ts` goes with it.

**The plumbing followed the producer.** `assistantAutoBackgrounded` was written in exactly one place per tool — the block removed here — so its schema field, result plumbing, early-return entries and the "assistant-mode blocking budget" message branch go with it, along with `ASSISTANT_BLOCKING_BUDGET_MS` and the optional field in `ShellCommand`'s `ExecResult`. The surviving branch keeps its position unchanged: `if (backgroundedByUser)`, then the plain background message.

**Hangs off the AppState field.** `REPL.tsx`'s `assistantMode` read fed `useScheduledTasks`, whose prop was threaded into `createCronScheduler` — a bypass that skipped the `isLoading()` gate. With the read gone the prop has no other caller, so the hook signature, its effect dep and the scheduler option go too, and the scheduler's two uses fold to `if (isLoading()) return` and `if (!getScheduledTasksEnabled() && hasCronTasksSync())`. `AgentTool` folds its schema to the omitted-optional shape and loses `assistantForceAsync` from `shouldRunAsync`.

**Two things the next reader should know.** `memdir`'s daily-log block was the only caller of a 44-line prompt builder (`buildAssistantDailyLogPrompt`), which went with it; the two constants it used keep other callers. And `processSlashCommand`'s block had brought six imports for itself (`createAbortController`, `getWorkload`, `sleep`, `enqueuePendingNotification`, the two MCP-settle constants); with the block gone they have no reader and were pruned, leaving the synchronous forked path the false flag already took.

### Verification

tsc 0, sixteen fixtures pass, `git diff --check` clean, no added blank lines, the orphan scan unchanged at its ten legitimate entries. Absence sweeps cover both bits, both accessors, the three field names, the budget constant, `KAIROS_DREAM`, `assistantModule`/`assistantName`, `--assistant` and `sessionTranscriptModule`; the folded arms are asserted textually (the four `||`-term expressions, the cron and `fastMode` guards, both tools' surviving branch, `AgentTool`'s schema, the hook signature, `main.tsx`'s remote-control and teamContext lines).

**Next (step 7i):** brief mode — `feature('KAIROS') || feature('KAIROS_BRIEF')` across ~20 files, with `getUserMsgOptIn()` and the `tengu_kairos_brief` gate as the terms that survive.

## Wave D step 7i — the brief-mode surface (`f1b8fb1`, landed)

Brief mode is the SendUserMessage tool (`BriefTool` internally) plus the chat-style view it drove: user text rendered as a "You" label on a stripped background, the model's replies as SendUserMessage blocks with a "Claude" label, everything else filtered out. 34 files, +34/−1,447, five modules deleted. **Behaviour change: none** — `BriefTool.isEnabled()` returned `isBriefEnabled()`, whose body is the same `feature('KAIROS') || feature('KAIROS_BRIEF')` ternary, so the tool is never enabled in this build and every reader is a constant fold.

**The module tree went as one unit.** `tools/BriefTool/` (BriefTool.ts, prompt.ts, UI.tsx, attachments.ts — 405 lines) held the tool with its input/output schemas, the two gates (`isBriefEntitled`, `isBriefEnabled`), the prompt text and the chat-style renderers. Its attachment resolver had already lost its upload half in an earlier wave (the `uploadCtx` parameter was ignored by the time this cut ran). `utils/formatBriefTimestamp.ts` had exactly two callers — both brief layouts — so it went too. Its `UI.tsx.w54bak` copy was quarantined to `.audit/w65-d7i-baks/` and byte-compared before deletion.

**Three startup opt-in paths and the state behind them.** `userMsgOptIn` existed only to gate the tool's `isEnabled()`: the `--tools` listing opt-in, the persisted `defaultView: 'chat'` opt-in, the `--brief` flag and `maybeActivateBrief` (whose own guard was `if (!(feature('KAIROS') || feature('KAIROS_BRIEF'))) return` — the early-return shape, so the function went with its four call sites) all fold away, and `userMsgOptIn` with both accessors goes with its last reader. `AppState.isBriefOnly` — the mirror `/brief` and the view picker wrote — leaves the store, the `/config` picker and its Escape-restore snapshot go with it, and so do the `ctrl+shift+b` binding, its action id and its handler (the `ctrl+o` stuck-state escape hatch existed only for a stuck `isBriefOnly`).

**Reads that only made sense with the tool alive.** `messages/mappers`-style prose aside, three code readers named it by string: the transcript's two-tier filter (130 lines: `filterForBriefTool` and `dropTextInBriefTurns`), the permission-rule alias `Brief → SendUserMessage`, and the ToolSearch deferral bypass. The resume classifier is the interesting one: `isTerminalToolResult` walked back to ask whether a trailing tool_result came from SendUserMessage, and both names were `null`, so its answer was always false and its caller folds to the interrupted-turn arm with the function. Two todo/task nags also suppressed themselves when the tool was present; with the constant null they can no longer fire.

**The view folds to the plain arm.** `Spinner`'s `SpinnerWithVerb` was a wrapper whose only job was the brief branch, so it collapses and the inner component takes the name; `BriefSpinner` and `BriefIdleStatus` (139 lines) go with it. `HighlightedThinkingText` loses its `useBriefLayout` branch and with it the `timestamp` prop that threaded from `Message` through `UserTextMessage` to `UserPromptMessage`, and `QueuedMessageContext` loses the padding override. The two theme keys the brief labels used (`briefLabelYou`, `briefLabelClaude`, twelve values across seven themes) go as well.

### Verification

tsc 0, seventeen fixtures pass, `git diff --check` clean, no added blank lines, the orphan scan down to its ten legitimate entries with no new orphan (the file count fell by exactly the five deleted modules). Absence sweeps cover the flag, the four name constants, the opt-in state, the view symbols, the theme keys and the CLI option; the folded arms are asserted textually (the spinner signature, REPL's import and memo deps, `UserPromptMessage`'s JSX, `HighlightedThinkingText`'s props, the queue padding, `PromptInput`'s `marginTop`, `Notifications`' unwrapped `TokenWarning`, `Messages`' two streaming conditions, and the resume classifier's body). Two fixtures were amended, as the 7h record predicted: `w65-d7h-verify` asserted the three `||`-term folds this step superseded (one file gone, two no longer carrying the expression), and `w65-d7g-verify` asserted two readers this step removed. One deliberate non-cut: `--brief` still appears twice in `BashTool`/`PowerShellTool`'s read-only command tables, where it is GNU `file`'s own flag rather than this CLI's option.

**Next (step 7j):** the PROACTIVE tick machinery — `feature('PROACTIVE') || feature('KAIROS')` across ~15 files: the tick system-prompt section, the Sleep/ScheduleCron tool enablement, `sessionStorage`'s tick handling, the footer's next-tick display, and `print.ts`'s tick loop.

## Wave D step 7j — the proactive tick machinery (`6014abf`, landed)

**The decisive fact is the same shape as 7h's, one flag wider.** `feature('PROACTIVE')` and `feature('KAIROS')` are both false in the shim, *and* this build contains no `proactive/` directory at all: `require('../proactive/index.js')` and `require('../proactive/useProactive.js')` name files that do not exist. Every `proactiveModule` was therefore null — not "off", absent — so `proactiveModule?.x()` was a no-op, `!proactiveModule?.isProactiveActive()` was `true`, and `proactiveModule!.isProactiveActive()` sat only inside branches the false flags had already closed. Two of the eight handles were written `feature(…) ? null : null`, the arms identical, which made `isProactiveActive_SAFE_TO_CALL_ANYWHERE()` constant false the same way 7h's `sessionTranscriptModule` was.

**The Sleep tool was a prompt module for a tool that does not exist.** `tools/SleepTool/` contained exactly one file, `prompt.ts` (17 lines: the name constant, a description and the prompt text), while `tools.ts`'s `require('./tools/SleepTool/SleepTool.js')` addressed a file never present in the build. The gate was `feature('PROACTIVE') || feature('KAIROS')`, so the tool was null in the pool, and its name had four readers, each of which folds: `query.ts`'s queue-drain upgrade (`sleepRan ? 'later' : 'next'` → `'next'`, with `toolUseBlocks` left to its other readers), REPL's Sleep-only spinner rule (constant false, so the `!onlySleepToolActive &&` term drops out of the spinner chain), and `classifierDecision`'s auto-mode allowlist entry. The prompt module went with the two settings that only it read (`minSleepDurationMs`, `maxSleepDurationMs`).

**The tick loop was unreachable in three independent ways.** `cli/print.ts` built `scheduleProactiveTick` only under the false flag (`: undefined` otherwise), its two call sites were each behind a `proactiveModule?.isProactiveActive()` guard, and it enqueued a `<tick>` payload nothing could reject — but the whole chain hung off `proactiveModule`, so removing the module removes the loop. The `set_proactive` control-request branch went with it; the surrounding `else` chain keeps its unknown-subtype error arm. `TICK_TAG` itself had four readers beyond `print.ts` and the prompt section: `utils/log.ts`'s resume-picker fallback (`isAutonomousPrompt` constant falsy → `useFirstPrompt` loses its `&& !isAutonomousPrompt` term and the `'Autonomous session'` label arm goes), `UserTextMessage`'s hide rule, `MessageSelector`'s transcript filter row, and `constants/prompts.ts`'s section builder. With all of them folded the tag itself left `constants/xml.ts` — no producer could emit it.

**Two whole prompt paths went.** `getSimpleSystemPrompt` had a second return branch for `simple-proactive` (the autonomous-agent preamble plus `getProactiveSection()`, 841 characters of branch) and `getProactiveSection` itself was a 67-line section builder; both are behind the false flag, so both go. `main.tsx`'s `Proactive Mode` `appendSystemPrompt` block and `maybeActivateProactive` (with its four call sites and the `--proactive` option) are the same shape one layer up. `cli/print.ts`'s `CLAUDE_CODE_PROACTIVE` fallback activation goes too; the env var has no reader left.

**Folds, not judgement calls.** The tick readers follow the rules this wave has used throughout: a `?.`-call behind a false flag deletes with its block, a `??`-default takes the default, a `||`-term drops as a term, and a `useSyncExternalStore` over a store that can never notify takes its `getSnapshot` constant and leaves nothing to subscribe to. REPL's `proactiveActive` therefore disappears from the tools memo (`[toolPermissionContext]` alone), the footer's `ProactiveCountdown` (with `nextTickAt`/`hasNextTick` and the countdown branch it fed) leaves the hint chain, and `Messages.tsx`'s terminal-progress gate and the placeholder's example-command gate fold to their plain conditions.

### Verification

tsc 0, eighteen fixtures pass (the new `w65-d7j-verify` plus seventeen carried), `git diff --check` clean, no added blank lines, the orphan scan down to its ten legitimate entries with no new orphan (file count 1657 → 1656, exactly the one deleted module). Absence sweeps cover every module handle, every activation call, the tick symbols and the Sleep names. Three earlier fixtures were amended, and the amendments are the supersessions the earlier records predicted: `w65-d7g-verify` asserted `tools.ts`'s SleepTool condition *stayed* (it named it as untouched neighbour), `w65-d7h-verify` asserted the `false` term 7h left at the end of AgentTool's `shouldRunAsync` chain, and `w65-d7i-verify` asserted both the Proactive Mode prompt block and the tools memo's `proactiveActive` dependency as deliberately-kept neighbours. Each amendment is written as the folded form with a comment naming this step. Three prose mentions were trimmed with the code they described: REPL's `sleep_progress` progress note, `handlePromptSubmit`'s `(e.g. SleepTool)` interrupt example, and `textInputTypes`' queue-priority doc comment, which described what "wakes SleepTool" meant for `next` and `later`.

### Port coordinate refresh

Five historical evidence files moved with this cut, all of them by re-running their own fixtures against the new tree rather than by editing them by hand. `w60-source-evidence.json`'s `classifierDecision.ts` entry (`VERIFY_PLAN_EXECUTION_TOOL_NAME`) shifts from utf16 `[2326,2595)` to `[1865,2180)` — the two lines this step removed above it — and its `changedSha256` is the redigest of the shifted text; the ported body is unchanged. The other four are `portSha256` re-digests on the files this step edited: `w65-d7f`'s `cli/print.ts` entry, `w65-d7g`'s `tools.ts` entry, `w65-d7h`'s `main.tsx` entry, and `w65-d7i`'s `components/Messages.tsx` and `main.tsx` entries. Same treatment as the post-7h refresh: the fixture is the authority on the coordinate, so the record follows it.

**Kept on purpose.** The whole `AGENT_TRIGGERS`/cron surface — `isKairosCronEnabled` (gated on `feature('AGENT_TRIGGERS')`, a different flag from the two this step folded), the three `ScheduleCronTool` modules, `useScheduledTasks`, the `/loop` skill and the tip that advertises it. It shares the `Kairos` name but not the gate, and folding it here would decide a wave that has not been scoped. Also kept: `SUGGEST_BG_PR_NOOP` and the two coordinator gates in `REPL.tsx`/the footer, which belong to other lanes, and the ordinary-English uses of "proactive" in prose (the MCP token refresh, compact's autocompact modes, BashTool's "too proactive" instruction).

**Next (step 7k):** the `AGENT_TRIGGERS`/cron wave — `isKairosCronEnabled` and its four callers (`services/tips/tipRegistry.ts`, `hooks/useScheduledTasks.ts` ×2, `skills/bundled/loop.ts`), the three `tools/ScheduleCronTool` modules, `utils/cronScheduler.ts`'s remaining callers, and the `/loop` skill itself. Then the `replBridge*` AppState leftovers with `getRemoteControlAtStartup()`, the session-ingress bearer surface, the model-call seams, `utils/fastMode.ts`'s remaining gates, the ~33 in-place CLI blocks, `cli/transports/`, and the dependency-pruning pass.

## Wave D step 7k — the AGENT_TRIGGERS/cron surface (`e6a4caf`, landed)

**One flag, one gate, and the gate is the flag.** This cluster hangs off a single predicate: `isKairosCronEnabled()`'s body is `feature('AGENT_TRIGGERS') ? !isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_CRON) && getFeatureValue_CACHED_WITH_REFRESH('tengu_kairos_cron', true, …) : false`. The build flag is false, so the GrowthBook kill switch and the env override are both unreachable — three gates collapse into one constant. The source is explicit that this flag ships independently of KAIROS (the cron module graph has zero imports into `src/assistant/` and no `feature('KAIROS')` call), which is why 7j deliberately left it standing rather than folding it with its namesake.

**Everything the constant gated goes as a unit.** `tools/ScheduleCronTool/` held the three tools with their shared prompt module and UI, reached only through `tools.ts`'s `feature('AGENT_TRIGGERS') ? [require(…), require(…), require(…)] : []`; the engine is `utils/cronTasks.ts` (the `scheduled_tasks.json` store), `utils/cronScheduler.ts` (the poll/fire loop with its per-directory PID lock), `utils/cronTasksLock.ts`, `utils/cron.ts` (the expression parser and humaniser) and `utils/cronJitterConfig.ts`; the two constructors are `hooks/useScheduledTasks.ts` in the REPL and a block in `cli/print.ts` for `-p` mode. Two hosts read the flag directly. `constants/tools.ts` put the three names into the agent-disallowed set, and `skills/bundled/index.ts` registered `/loop`, whose `isEnabled` *is* `isKairosCronEnabled` — so registration and gate were both constant, and the skill's tip entry (`loop-command-nudge`, gated by the same call) is unreachable too.

**The state the cluster owned leaves with it.** `bootstrap/state.ts` carried `scheduledTasksEnabled` (a watcher flag with two writers, both deleted here) and `sessionCronTasks` (the in-memory durable:false tasks) with the `SessionCronTask` type and its three functions. `WORKLOAD_CRON` and the `Workload` type go as well: their only producer was the queue item the scheduler fired, while `runWithWorkload`/`getWorkload` stay — the SDK's `--workload` tag and the `cc_workload=` attribution header are a separate contract, so the sanitizer constraint the type documented moved to the function that still enforces it.

**One declared surface is kept deliberately.** `entrypoints/agentSdkTypes.ts` declares `CronTask`, `ScheduledTaskEvent` and `ScheduledTasksHandle` with two throwing stubs (`watchScheduledTasks`, `buildMissedTaskNotification`). That is an SDK contract with no producer left in this tree — the same call wave C made for `rate_limit_event`: removing a declaration changes a public contract, so it waits for the SDK review. The fixture names the file explicitly so the absence sweep cannot silently widen.

### Port coordinate refresh

Four historical evidence files moved, all by re-running their own fixtures. `w65-d7f`'s `cli/print.ts` entry and `w65-d7g`'s `tools.ts` entry re-digest the files this step edited; `w65-d7h`'s `bootstrap/state.ts` entry does the same; `w65-d7j` re-digests both `screens/REPL.tsx` and `cli/print.ts`. No range moved this time — every edited file kept the ported bodies in place below the cut.

### Verification

tsc 0, nineteen fixtures pass (the new `w65-d7k-verify` plus eighteen carried), `git diff --check` clean, no added blank lines, the orphan scan at its ten legitimate entries with the file count down by exactly the twelve deleted modules (1656 → 1644). Two fixtures were amended, both for supersessions their own records predicted: `w65-d7h-verify` asserted the cron scheduler's `isLoading`/`hasCronTasksSync` guards (the file it read no longer exists) and `w65-d7j-verify` asserted this surface *stays intact* as "a later wave" — the sentence it wrote to justify the non-cut. Four prose sites were re-worded with the code they described: the queued-commands hide rule (`scheduled tasks, proactive ticks`), `handlePromptSubmit`'s provenance note, `textInputTypes`' workload field, and `workloadContext`'s ALS rationale, whose worked example was a leaked cron context.

**Kept on purpose.** The SDK declarations above; `utils/workloadContext.ts`'s mechanism; the `QueuePriority` union, whose three levels other producers still use. One quarantine ran first: `tools/ScheduleCronTool/UI.tsx.w54bak` was copied to `.audit/w65-d7k-baks/` and byte-compared before the directory was removed.

**Next (step 7l):** the `replBridge*` AppState leftovers — the family itself with `getRemoteControlAtStartup()`, `migrations/migrateReplBridgeEnabledToRemoteControlAtStartup.ts`, `tools/ConfigTool`'s sync site and the four comment-only references (`ink/root.ts`, `utils/messages/systemInit.ts`, `utils/toolSchemaCache.ts`, `services/api/emptyUsage.ts`). Then the session-ingress bearer surface, the model-call seams, `utils/fastMode.ts`'s remaining gates, the ~33 in-place CLI blocks, `cli/transports/`, and the dependency-pruning pass.

## Wave D step 7l — the `replBridge*` / Remote Control leftovers (`627859b`, landed)

**A fold to nothing, not to an arm.** Every step before this one in wave D removed a surface whose surviving reader took the arm a constant already produced. Here there is no arm: no module in this build reads or writes any of these slots, so the statements go and the call sites around them simply shrink. The distinguishing fact is what wrote them — the twelve `replBridge*` AppState fields (`enabled`, `explicit`, `outboundOnly`, `connected`, `sessionActive`, `reconnecting`, `connectUrl`, `sessionUrl`, `environmentId`, `sessionId`, `error`, `initialName`) and the two viewer counters (`remoteConnectionStatus`, `remoteBackgroundTaskCount`) were written by `useReplBridge`, the bridge dialog and `initReplBridge`, none of which this build contains. The two counters carry the sharpest version of the argument: their own comments say the values are event-sourced from a WebSocket in a *different process* (`claude assistant` viewer mode) and that the local `AppState.tasks` "is always empty in viewer mode" — a value whose only producer is an absent daemon cannot be anything but its default.

**The settings row was already dead before the cut.** `getRemoteControlAtStartup()`'s precedence ladder had collapsed to one branch in an earlier wave (`explicit !== undefined ? explicit : false`), leaving a gap in its own comment's numbering; its config key was settable through exactly one row, in `tools/ConfigTool/supportedSettings.ts`, and that row sat behind `feature('BRIDGE_MODE')` — false, so the spread was already `{}`, `isSupported` already rejected the key, and `ConfigTool`'s two AppState sync blocks (the `'default'` unset branch and the general set branch) already wrote fields nothing read. The `GLOBAL_CONFIG_KEYS` entries and `migrations/migrateReplBridgeEnabledToRemoteControlAtStartup.ts` — a rename for a key the type no longer declared, reached through an untyped cast — went the same way, as did `components/Settings/Config.tsx`'s Escape-restore pair, whose only purpose was reverting a bridge toggle.

**Two keys with no reader at all, and one that has a live one.** `remoteDialogSeen` (a callout for a dialog that does not exist) and the `bridgeOauthDead{ExpiresAt,FailCount}` backoff pair (whose own comment documents `initReplBridge`'s skip) leave `utils/config.ts`. `desktopUpsellSeenCount` sits directly beside them and stays: `components/DesktopUpsell/DesktopUpsellStartup.tsx` reads it.

**Bootstrap state whose writer never ran.** `bootstrap/state.ts` set `replBridgeActive` only inside `...(process.env.USER_TYPE === 'ant' ? { replBridgeActive: false } : {})`, and this shim's `USER_TYPE` is `'external'` — so the field's own default was unreachable and `isReplBridgeActive()` returned `undefined`. It had no reader either. `directConnectServerUrl` was the same shape with different evidence: the getter had one reader (`utils/logoV2Utils.ts`' header suffix) and the setter had **no callers**, so the URL was permanently `undefined`. That reader folds to the bare display path — and since `displayPath` existed only to be suffixed, the fold renames it to `cwd` rather than keeping a one-use alias.

**Four comments named things that are not here.** `ink/root.ts` cited "useReplBridge notification state" as the async work the microtask boundary protects, `utils/toolSchemaCache.ts`'s import-cycle chain ran through the `bridgeEnabled` field, `utils/messages/systemInit.ts` documented a second caller (`useReplBridge` via `writeSdkMessages`, a function with no definition anywhere in the tree) and `services/api/emptyUsage.ts` explained its extraction by `bridge/replBridge.ts`'s import path. Each was rewritten to keep the *why* and drop the name.

**Kept on purpose.** The `/remote-control` command family — `commands.ts`' two prose blocks, `utils/processUserInput/processUserInput.ts`'s unavailability message, `utils/messages.ts`' and `SystemTextMessage`'s activation notices, `utils/concurrentSessions.ts`' peer-enumeration state and `utils/config.ts`' `remoteControlSpawnMode` — is a distinct surface with its own readers and is the next wave. `entrypoints/agentSdkTypes.ts`' declaration, the retained `cli/transports/` + `cli/remoteIO.ts` lane, and `SendMessageTool`'s `bridge:` recipient prose stay as before. The recovered-source references inside retained files (`cli/transports/*.ts`, `utils/controlMessageCompat.ts`, `commands/rename/generateSessionName.ts`) also stay: they document where the upstream bridge called into those transports, which is true of the sample regardless of what this tree contains.

### Port coordinate refresh

Six historical evidence files moved, all by re-running their own fixtures with no assertion change: `w65-d7b` (`utils/config.ts`), `w65-d7g` (`components/Settings/Config.tsx`), `w65-d7h` (`main.tsx`, `bootstrap/state.ts`), `w65-d7i` (`main.tsx`), `w65-d7j` (`main.tsx`) and `w65-d7k` (`bootstrap/state.ts`). Only `portSha256` values changed — the `sourceSha256` row in each entry still names the pre-cut revision, so no ported range moved.

### Verification

tsc 0, twenty fixtures pass (the new `w65-d7l-verify` plus nineteen carried), `git diff --check` clean, no blank line left behind, the orphan scan at its ten legitimate entries with the file count down by exactly the one deleted migration (1644 → 1643). One fixture was amended: `w65-d7h-verify` asserted `const fullRemoteControl = getRemoteControlAtStartup()` as proof the bridge lane was intact at step 7h — and step 7h's own record listed "the `replBridge*` AppState leftovers with `getRemoteControlAtStartup()`" as remaining, so the assertion flips to its absence. The absence sweep runs over both spellings of the whole family plus the migration name, and asserts the next wave's surface (`remoteControlSpawnMode`, the transports, `desktopUpsellSeenCount`) still present, so the sweep cannot widen silently.

**Next (step 7m):** the `/remote-control` command family with `remoteControlSpawnMode`. Then the session-ingress bearer surface, the model-call seams (which must not be removed wholesale — API-key auth is the retained path), `utils/fastMode.ts`'s remaining gates, the ~33 in-place CLI blocks, `cli/transports/`, and the dependency-pruning pass.

## Wave D step 7m — the bridge-origin command gate (`47b5ef3`, landed)

**A producer fact, not a flag.** The decisive evidence this time is that two `QueuedCommand` fields are read in five places and written in none. `skipSlashCommands` and `bridgeOrigin` exist so the bridge's inbound path can push a mobile client's text through the local input pipeline as plain text; the tree has exactly three queue producers — `handlePromptSubmit`'s two `enqueue` sites and the `cmd` literal it builds for `executeUserInput` — and none of them sets either field. The bridge that would is absent. Both are therefore permanently `undefined`, so `!skipSlashCommands` is constant true, the `bridgeOrigin` override block is unreachable, and the two option-object fields thread a value with no source through four layers.

**What the constant gates.** Three gates and two pass-throughs: `handlePromptSubmit`'s exit-word list (`'exit' | 'quit' | ':q' | ':q!' | ':wq' | ':wq!'`), its local-jsx immediate-command dispatch, and `messageQueueManager`'s `isSlashCommand`, plus the option fields on both public option objects and the `QueuedCommand` type. `processUserInput`'s override block goes whole: it parsed the leading `/`, resolved the command and either cleared the skip or returned the `/x isn't available over Remote Control.` message. Its only caller relationship outside itself makes `commands.ts`'s pair collateral — `BRIDGE_SAFE_COMMANDS` (whose own comment already recorded that a previous edit had emptied part of it) and `isBridgeSafeCommand`, whose doc comment explains the PR #19134 regression they were written for. One gate keeps its other terms: `shouldExtractAttachments` was `!skipAttachments && … && (mode !== 'prompt' || effectiveSkipSlash || !inputString.startsWith('/'))` and now reads `(mode !== 'prompt' || !inputString.startsWith('/'))`.

**Three slots with no reader at all.** `createBridgeStatusMessage` kept a constructor, a `"bridge_status"` member in `SystemSubtype`, a `SystemBridgeStatusMessage` alias and a 31-line Ink renderer (`BridgeStatusMessage`, with a `Link` and a `ThemedText` import that were its only users) for a message no code path could construct. `remoteControlSpawnMode` was a `ProjectConfig` key documented as set "by first-run dialog or `w` toggle" — neither of which exists here. `sessionSource`'s single writer sat behind `process.env.CLAUDE_CODE_ENVIRONMENT_KIND === 'bridge'` in `main.tsx`, and nothing read the value back. The **variable** stays: `cli/remoteIO.ts`'s `isBridge` and `filePersistence/outputsScanner.ts` read the same env var for the retained remote-IO lane, so only the tag and its branch go, not the contract. `updateSessionBridgeId` wrote a `bridgeSessionId` key into the pid file that no peer enumeration could read back — the file's patch parameter is an untyped `Record<string, unknown>`, so no schema needed changing.

**Kept on purpose.** `entrypoints/agentSdkTypes.ts`' declared `bridgeSessionId` (a declared SDK contract with no producer, the same call waves C and 7k made), and `SendMessageTool`'s `uds:`/`bridge:` recipient rows — which turn out to sit in the false arm of `feature('UDS_INBOX')`, so the whole peer-messaging surface is constant there and belongs to its own package. The fixture pins that file's digest as unchanged rather than asserting dead prose stays.

### Port coordinate refresh

Six historical evidence files moved, all by re-running their own fixtures: `w65-d7b` (`utils/config.ts`), `w65-d7h` (`main.tsx`, `bootstrap/state.ts`), `w65-d7i` (`main.tsx`), `w65-d7j` (`main.tsx`), `w65-d7k` (`bootstrap/state.ts`) and `w65-d7l` (`main.tsx`, `utils/config.ts`, `bootstrap/state.ts`). `portSha256` only; no `sourceSha256` changed and no range moved.

### Verification

tsc 0, twenty-one fixtures pass (the new `w65-d7m-verify` plus twenty carried), `git diff --check` clean, no blank line added at EOF (the one file that ends with a blank line, `bootstrap/state.ts`, already did at `before`), the orphan scan at its ten legitimate entries with the file count unchanged at 1643 — this step deletes no module. One fixture was amended: `w65-d7l-verify` asserted `remoteControlSpawnMode` present as "the next wave's surface", and its own record named that key as step 7m's target, so the assertion flips to its absence. The absence sweep covers every removed name, and each folded gate is asserted as the arm the falsy value produced — `isSlashCommand`'s single-expression body, the attachment gate's two remaining terms, both `handlePromptSubmit` gates without their leading term, the destructure and both object literals losing their field.

**Next (step 7n):** the session-ingress bearer surface — `utils/sessionIngressAuth.ts` with its eight importers (`services/mcp/client.ts`, `cli/remoteIO.ts`, `main.tsx`, `cli/transports/*`, `filePersistence/filePersistence.ts`, `components/mcp/MCPSettings.tsx`) and the token state in `bootstrap/state.ts`. Then the peer-messaging lane (`feature('UDS_INBOX')` is false, so the `uds:`/`bridge:` addressing and the Cross-session prompt section are constant), the model-call seams, `utils/fastMode.ts`'s remaining gates, the ~33 in-place CLI blocks, `cli/transports/`, and the dependency-pruning pass.

## Wave D step 7n — the session-ingress bearer surface (`34b8444`, landed)

**The fold target is a documented arm, not a constant.** Every earlier step in this wave decided a branch on a build flag; this one decides it on evidence the code itself already recorded. `utils/sessionIngressAuth.ts` read a bearer for the CCR/session-ingress API from three sources in priority order — `CLAUDE_CODE_SESSION_ACCESS_TOKEN`, an inherited file descriptor (`CLAUDE_CODE_WEBSOCKET_AUTH_FILE_DESCRIPTOR`, the legacy CCR path), or a well-known file (`CLAUDE_SESSION_INGRESS_TOKEN_FILE` or `/home/claude/.claude/remote/.session_ingress_token`) — and built either `Cookie: sessionKey=` + `X-Organization-Uuid` for an `sk-ant-sid` key or `Authorization: Bearer` for a JWT. `getSessionIngressAuthHeaders()` already returned `{}` when no token was found; that empty object is the arm the consumers now take permanently.

**Everything that could not authenticate without it leaves with it.** `main.tsx`'s `--file` block downloaded file resources from the same ingress API and its only possible path without a token was the error-and-exit, so the flag, the block, the promise it set and the await before REPL render all go, along with the four `filesApi` imports. `utils/filePersistence/filePersistence.ts` and its `types.ts` go with them: the module's own enable gate listed the token as one of three terms, and its upload config took the token as `oauthToken`. `services/api/filesApi.ts` (748 lines) had exactly two importers — the `--file` block and file persistence — so it goes too. `cli/print.ts` loses the `executeFilePersistence` call, its `feature('FILE_PERSISTENCE')` gate and the `turnStartTime` that existed only to feed it. `components/mcp/MCPSettings.tsx` loses the "connected via session auth" arm of its authenticated check, and `services/mcp/client.ts` loses the extra `Authorization` it attached to remote MCP transports in both the WebSocket headers and the HTTP `requestInit`, plus the `hasOAuthTokens` probe that existed to decide against it — the authProvider's own OAuth header stays, exactly as the source's comment says it should.

**One port died with its last consumer.** `decodeJwtPayload`/`decodeJwtExpiry` in `cli/transports/ccrClient.ts` were copied from `bridge/jwtUtils.ts:22-58` and existed for one caller: the 401 handler's "is this JWT already expired" short-circuit, which burned no retry wall-clock on a token that could not be refreshed. With the token gone the check has no subject, so the pair is deleted and the e5 fixture — the file that verified that port against its recovered source — now records it under `removedPorts` instead of asserting it. This is the same call 7g made for `tools/SendUserFileTool/prompt.ts`: a port whose readers are exactly the deleted constants goes with them.

**The transport lane stays, folded to no headers.** `cli/transports/` and `cli/remoteIO.ts` are a declared retained surface, and no caller ever passed their `getAuthHeaders` option — the default *was* the ingress bearer. Both defaults become `() => ({})`, which is the value the deleted function returned without a token, so nothing new is invented: `ccrClient.initialize` still refuses with its own `no_auth_headers` error, `SSETransport.write` still logs and returns on empty headers, and `HybridTransport.postOnce` reduces to the two log lines its doc comment already listed among the outcomes it returns on ("4xx non-429, no token"). `remoteIO`'s `refreshHeaders` keeps its callback but now re-reads only the runner version. The consequence is recorded rather than hidden: this lane can no longer authenticate, which is what makes the `cli/transports/` package a deletion question rather than a trim.

**What survives, and why.** `utils/filePersistence/outputsScanner.ts` is narrowed to the 13-line `getEnvironmentKind()` that `utils/plans.ts` imports, keeping its `CLAUDE_CODE_ENVIRONMENT_KIND` contract and its teleport port comment; the file's other two exports (`findModifiedFiles`, `logDebug`) had no caller outside the deleted module. `entrypoints/sdk/coreSchemas.ts`' declared `files_persisted` subtype stays — a declared contract with its producer gone is the same disposition waves C, 7k and 7m recorded. `cli/structuredIO.ts`'s `update_environment_variables` handler stays; only its comment's example named the token. Three prose sites were reworded after the code left (`structuredIO`'s env-update rationale, `WebSocketTransport`'s 4003 retry rationale, `print.ts`'s `turnStartTime` comment).

### Port coordinate refresh

Six historical evidence files moved, all by re-running their own fixtures: `w65-d7f` (`cli/print.ts`), `w65-d7h` (`main.tsx`, `bootstrap/state.ts`), `w65-d7i` (`main.tsx`), `w65-d7j` (`cli/print.ts`, `main.tsx`), `w65-d7k` (`cli/print.ts`, `bootstrap/state.ts`) and `w65-d7l` (`main.tsx`, `bootstrap/state.ts`). `portSha256` only. `w65-e5`'s evidence is a content change, not a refresh: one of its four verified ports is gone and is recorded in `removedPorts`.

### Verification

tsc 0, twenty-two fixtures pass (the new `w65-d7n-verify` plus twenty-one carried), `git diff --check` clean, no blank line left at EOF (two were introduced by a mid-edit trim and removed in the same package), the orphan scan at its ten legitimate entries with the file count down by exactly the four deleted modules (1643 → 1639). One fixture was amended: `w65-e5-verify` verified the `decodeJwtExpiry` port, and its own `remaining` line named "cli/transports and the session-ingress bearer surface" as later waves — the case is replaced by a `removedPorts` record. The absence sweep runs over every removed name plus the three env vars, each consumer is asserted as the arm a missing token produced, and the surviving scanner module is asserted byte-for-byte against its intended text so a later edit has to say so out loud.

**Next (step 7o):** the peer-messaging lane — `feature('UDS_INBOX')` is false, so `SendMessageTool`'s `uds:`/`bridge:` recipient rows, its Cross-session prompt section, and whatever `ListPeers`/peer discovery hangs off the same flag are constant. Then the model-call seams (which must not be removed wholesale — API-key auth is the retained path), `utils/fastMode.ts`'s remaining gates, the ~33 in-place CLI blocks, `cli/transports/`, and the dependency-pruning pass. A stray follow-up from this step: `utils/filePersistence/` now holds one environment-kind reader and wants renaming.

## Wave D step 7o — the peer-messaging lane (`4a799eb`, landed)

**The gated requires name modules that do not exist.** `feature('UDS_INBOX')` is false in every build of this product, and the three things the gated requires resolve to are absent from the tree: `tools/ListPeersTool/ListPeersTool.js` (there is no `tools/ListPeersTool/` directory), `../udsMessaging.js` (no such module), and the `utils/peerRegistry.ts` that `utils/peerAddress.ts`' own header says it exists to avoid loading. That absence is what makes this a fold rather than a judgement about a flag's meaning: every gated arm already returned its off value, every gated doc row already interpolated the empty string, and `setup.ts`'s UDS server gate was already an `if` with an empty body — the `startUdsMessaging()` call it was written around left in an earlier wave, and only its comment and its `messagingSocketPath` escape hatch remained.

**The tool surface folds to what the flag already produced.** `tools.ts` loses the `ListPeersTool` require ternary and its pool entry, leaving `getSendMessageTool()`'s own slot and the swarm gate beside it untouched. `SendMessageTool` loses the `uds:`/`bridge:` arm of its recipient `describe` — the surviving string is verbatim the ternary's else-branch — both cross-session validation branches (the string-message early return and the structured-message rejection), their stranded rationale comment, and the `bun:bundle` import that had no other use. Its prompt module loses the `udsRow` and `udsSection` constants with their two interpolations, which is where the `ListPeers` documentation lives; both were already `''`, so the rendered prompt is byte-identical to what the falsy flag produced.

**The plumbing goes with the surface.** `utils/messages/systemInit.ts` drops the hidden `messaging_socket_path` field — a `require('../udsMessaging.js')` of a module the build does not contain, behind a comment that already called it ant-only and hidden from the public SDK types — with its `feature` import; the declared `initMessage` shape has no such member anywhere else in the tree. `utils/concurrentSessions.ts` drops the PID file's `messagingSocketPath` spread: the env var it read (`CLAUDE_CODE_MESSAGING_SOCKET`) has no writer in the build, and the PID registry itself (writePidFile, `updatePidFile`, the `onSessionSwitch` hook) stays, as do the `BG_SESSIONS` fields beside it. `main.tsx` drops the `messagingSocketPath` local and its argument at the `setup()` call, the six-line replay-promotion comment with the promotion block — `effectiveReplayUserMessages` folds to `!!options.replayUserMessages` alone, which is the value it already had whenever the socket was not requested — and the `--messaging-socket-path <path>` option declaration. `setup.ts` drops the parameter and the emptied gate, plus the `--bare / SIMPLE` comment that explained both. `components/messages/UserTextMessage.tsx` drops a comment whose branch an earlier wave had already removed, leaving the fork-boilerplate comment above it and the `UserPromptMessage` arm below untouched.

**One branch was removed beyond the gates, and it is recorded as an adaptation.** `SendMessageTool.validateInput` opened with `const addr = parseAddress(input.to)` and rejected an empty target when the scheme was `uds` — not feature-gated, so live. Its only trigger is a `uds:`-prefixed or bare `/`-prefixed recipient, which is the grammar the deleted prompt rows were the sole documentation of; every `to` the retained tool documents (a teammate name or `"*"`) takes the `other` arm, so its only remaining effect would be a bespoke error message for input the product no longer advertises. The empty-name check directly above it and teammate resolution still reject malformed recipients. Keeping `utils/peerAddress.ts` alive for that one branch would have retained the lane it belongs to, so the module goes with it — `parseAddress`'s last consumer was the branch pair above. This is the same disposition 7n gave the `bridge/jwtUtils.ts` port and 7g gave `tools/SendUserFileTool/prompt.ts`: a module whose readers are exactly the deleted call sites leaves with them.

**Kept on purpose.** `SendMessageTool`'s teammate and broadcast path is untouched end to end: the schema, the summary requirement for string messages, the structured-message rules, the `shutdown_response` recipient check and the `'@'` format rejection. `hooks/useInboxPoller.ts` and `screens/REPL.tsx`'s call to it stay — that lane is gated by `isAgentSwarmsEnabled()`, not by `UDS_INBOX`, and its mailbox, teammate-task and permission-bridge imports are all live. `utils/plans.ts`' importer of `filePersistence/outputsScanner.ts` is unaffected.

### Port coordinate refresh

Six historical evidence files moved, all by re-running their own fixtures: `w65-d7g` (`tools.ts`), `w65-d7h`, `w65-d7i`, `w65-d7j`, `w65-d7l` and `w65-d7n` (`main.tsx`). `portSha256` only; no `sourceSha256` changed and no range moved.

### Verification

tsc 0, twenty-three fixtures pass (the new `w65-d7o-verify` plus twenty-two carried), `git diff --check` clean, no blank line at EOF in any touched file, the orphan scan at its ten legitimate entries with the file count down by exactly the one deleted module (1639 → 1638). One fixture was amended: `w65-d7m-verify` pinned `tools/SendMessageTool/prompt.ts` by digest as "not this step's business" and its own comment named the peer-messaging lane as the owner — the pin is retired in favour of the teammate table that survives this cut. The absence sweep runs over the lane's whole vocabulary (the flag, the tool name, both module names, the peer parser, the env var and the option in both spellings) plus an existence check on the four paths it lived in, and each folded site is asserted as the arm the falsy flag produced with its surviving sibling expression asserted beside it.

One repair pass: the first cut left `TS2304 parseAddress` at `SendMessageTool.ts:591` — the peer-grammar check was the module's third consumer and the only one not wrapped in the flag, and the reconnaissance grep had searched for the module path rather than the function name. The script was extended with that cut, the nine touched paths were restored from `HEAD`, and the step was re-run from the restored tree, so `w65-d7o1.py` reproduces the final state in one pass. The three module absences that justify the fold were each checked on disk rather than assumed.

**Next (step 7p):** the model-call seams — `services/api/client.ts:128-135,307-313` (`isClaudeAISubscriber()`, `authToken`, the staging baseURL), `claude.ts:408,522,1030`, `withRetry.ts:20-21,247,332,739,768`, `errors.ts:468,737,798`, `utils/http.ts:70`, `utils/betas.ts:25,71,251`, `utils/model/*` — which must not be removed wholesale, since API-key auth is the retained path. Then `utils/fastMode.ts`'s remaining gates, the ~33 in-place CLI blocks, `cli/transports/`, and the dependency-pruning pass (nine zero-importer dependencies), with the `utils/filePersistence/` rename as a stray follow-up.

## Wave D step 7p — the subscriber constants out of the model-call path (`50744a6`, landed)

**The decisive fact is a body plus a producer, not a flag.** Two independent reasons make every subscription read on the request path constant, and the record needs both because they cover different predicates. The first is wave D step 1's `isAnthropicAuthEnabled()`: its body is `return false`, so `isClaudeAISubscriber()` (which early-returns on `!isAnthropicAuthEnabled()`), `getOauthAccountInfo()` (`isAnthropicAuthEnabled() ? getGlobalConfig().oauthAccount : undefined`, so `undefined`) and `getSubscriptionType()` (which returns `null` on the same guard, taking `isEnterpriseSubscriber()`, `isProSubscriber()` and the rest of the tier predicates with it) were already constants. The second is a producer fact: `hasProfileScope()` does **not** go through that guard — its body is `getClaudeAIOAuthTokens()?.scopes?.includes(CLAUDE_AI_PROFILE_SCOPE) ?? false` — and the only two `OAuthTokens` producers left in this build (`CLAUDE_CODE_OAUTH_TOKEN` and the inherited file descriptor, at `utils/auth.ts:1156` and `:1170`) both hardcode `scopes: ['user:inference']`. The source says so itself, in `hasProfileScope`'s own doc comment: "Env-var and file-descriptor tokens (service keys) hardcode scopes to `['user:inference']` only. Use this to gate calls to profile-scoped endpoints so service key sessions don't generate 403 storms against `/api/oauth/profile`, bootstrap, etc." The `bootstrap` it names as a motivation is the module this package deletes. The third producer in the file (the GCP path at `:804`) carries `cloud-platform` scopes and never reaches this predicate.

**Every folded site is the arm its constant already produced.** `services/api/client.ts` loses the OAuth token check (`checkAndRefreshOAuthTokenIfNeeded()`, a call that has been a no-op stub since wave D step 2) with its two debug lines, which is what makes the `configureApiKeyHeaders` call below it unconditional; its client config keeps only `apiKey: apiKey || getAnthropicApiKey()` — the `authToken` field and the ant-only staging baseURL (the last `getOauthConfig` reader in this file) go with the arm that set them. `claude.ts`' system-prompt metadata folds `account_uuid: getOauthAccountInfo()?.accountUuid ?? ''` to `''` with a comment saying why, and the off-switch gate drops its subscriber term and the comment clause that explained it ("Subscribers don't hit this path at all."). `withRetry.ts` folds four sites: the `x-should-retry` exemption's subscriber/enterprise disjunction, the 429 arm to a plain `return true`, the 9xx fallback condition's subscriber term, and the 401/revoked refresh block — `handleOAuth401Error` returns false unconditionally in this build, so the call could only fall through to re-reading the client, which the surrounding block still does; the comment now says that rather than naming a handler that cannot exchange anything. `errors.ts` deletes the whole Pro-plan-Opus 400 error block, folds the ANT org message's ternary to a single template (`getOauthAccountInfo()` is `undefined`, so the `orgId` branch was unreachable), and drops the subscriber term from the env-var org-disabled guard. `utils/http.ts` loses `getAuthHeaders`' OAuth arm, keeping the API-key path, and loses `withOAuth401Retry`, whose only caller was bootstrap — taking the imports its two deletions orphaned (`axios`, `getClaudeAIOAuthTokens`, `handleOAuth401Error`); the file's live surface, the three user-agent helpers, is untouched. `utils/betas.ts` loses both subscriber blocks: the custom-betas warning and the `OAUTH_BETA_HEADER` push. `utils/model/modelCapabilities.ts` folds `anthropic.models.list({ betas })` to `({})`. `utils/model/model.ts` loses the Max and Team-Premium arms of the default-model resolver, collapses `getClaudeAiUserDefaultModelDescription()` to its surviving string (which retires the `fastMode` parameter only that arm read), reduces `isOpus1mMergeEnabled()` to its `is1mContextDisabled() || getAPIProvider() !== 'firstParty'` guard plus its `return true`, and drops `modelDisplayString`'s subscriber label arm.

**One module could not survive its own clients.** `utils/model/modelOptions.ts` loses the subscriber Default option and the entire Max/Team-Premium/Pro-Team-Enterprise block with the two `' · Billed as extra usage'` interpolations. Four builders and prepared options were read by nothing outside that block — `getMaxSonnet46_1MOption`, `getMaxOpus46_1MOption`, `MaxSonnet46Option`, `MaxHaiku45Option` — so they leave with it; `getMaxOpusOption` and `getMergedOpus1MOption` stay because the PAYG option list beside them still reads them, which the fixture pins in the same pass that asserts the four are gone. `services/api/bootstrap.ts` goes whole (141 lines): a GET of `${getOauthConfig().BASE_API_URL}/api/claude_cli/bootstrap` behind `hasProfileScope()`, persisting server-declared `client_data` and `additional_model_options` into the global config. With it go `main.tsx`'s `fetchBootstrapData` import and call (and its TODO about consolidating prefetches), and `utils/http.ts`' `withOAuth401Retry`. `main.tsx` also loses an `isClaudeAISubscriber` import that had no call site in the file already — the import block that carried the bootstrap call is what made it look live.

**Kept on purpose, because API-key auth is the retained path.** The client keeps `apiKey: apiKey || getAnthropicApiKey()` and the whole API-key branch above it; `getAuthHeaders` keeps its key path and its `api_key_helper`/`ANTHROPIC_API_KEY` fallback, and the third `getAuthHeaders` callers that matter — the transports' own header options — were never this file's; `getClaudeAIOAuthTokens` keeps both bearer sources, which is what `hasStoredOAuth` in `errors.ts` and `getAuthTokenSource` still read, so an env-var or file-descriptor bearer still changes which message a user sees; `handleOAuth401Error`, `checkAndRefreshOAuthTokenIfNeeded` and `getClaudeAIOAuthTokensAsync` stay as the no-op stubs wave D step 2 left, with their `services/mcp/client.ts` and `utils/fastMode.ts` callers; and the constants themselves stay in `utils/auth.ts`, because their remaining readers are the status, commands and onboarding surface the next package owns — a predicate goes when its last reader does, not before.

### Port coordinate refresh

Six historical evidence files moved, all by re-running their own fixtures: `w65-d7h` (`main.tsx`), `w65-d7i`, `w65-d7j`, `w65-d7l`, `w65-d7n` (`main.tsx`) and `w65-d7o` (`main.tsx`). `portSha256` only; no `sourceSha256` changed and no range moved.

### Verification

tsc 0, twenty-four fixtures pass (the new `w65-d7p-verify` plus twenty-three carried, none amended), `git diff --check` clean, no blank line at EOF in any touched file, the orphan scan at its ten legitimate entries with the file count down by exactly the one deleted module (1638 → 1637). The absence sweep runs over the ten touched files for every subscription constant and the oauth beta header, with a tree-wide sweep proving `fetchBootstrapData`, `withOAuth401Retry` and `api/bootstrap` left no reference anywhere and an existence check on the deleted module, and each folded site is asserted as the arm the constant produced — including the survivors that must not fold with them (`hasStoredOAuth`, the two-term merge guard, the two live Opus builders, the three user-agent helpers).

Two repair passes, both from the same class of mistake. The script's first run died on an anchor that occurs twice (`const billingInfo = …` in two option blocks, now cut with `n=2`), and the second left `utils/model/model.ts` unbalanced because a cut consumed the closer that opened `modelDisplayString`'s surviving `} else if` branch. Each time the touched paths were restored from `HEAD` and the script re-run, so `w65-d7p1.py` reproduces the final state in one pass. One post-cut correction: the `getClaudeAIOAuthTokens` import was removed along with the others while `hasStoredOAuth` still reads it, which tsc caught at `errors.ts:682` — the record keeps that import and the fixture now asserts `hasStoredOAuth`'s line verbatim.

**Next (step 7q):** the subscriber consumer surface, which is what lets the predicates go — `utils/status.tsx` (2), `utils/statusNoticeDefinitions.tsx` (2), `utils/logoV2Utils.ts` (2), `commands.ts` (3), `commands/cost/index.ts` (2), `components/Onboarding.tsx`, `components/EffortCallout.tsx`, `utils/effort.ts`, `utils/planModeV2.ts`, `utils/telemetryAttributes.ts`, `services/tips/tipRegistry.ts` (2 `is1PApiCustomer`), `hooks/useApiKeyVerification.ts`, `components/mcp/MCPRemoteServerMenu.tsx`, `utils/fastMode.ts` (2 `hasProfileScope` reads and 3 other gates) and the two `migrations/` entries — plus the claude.ai MCP connector (`services/mcp/claudeai.ts` with `claudeai-proxy`), whose `user:mcp_servers` scope check the same producer fact kills and whose prose names the two predicates. Then `utils/fastMode.ts`'s remaining gates, the ~33 in-place CLI blocks, `cli/transports/`, and the dependency-pruning pass (nine zero-importer dependencies), with the `utils/filePersistence/` rename as a stray follow-up.

## Wave D step 7q — the subscriber consumer surface (`6fa308a`, landed)

**The predicates had readers but no inputs.** Step 7p removed every subscription read on the request path; this step takes the rest — the status, command, settings, telemetry, onboarding and model-default reads that were the reason the predicates still existed — and then deletes the predicates that lose their last reader with them. The evidence is the same two facts: `isAnthropicAuthEnabled()` is `return false`, so `isClaudeAISubscriber()` (which early-returns on it), `getSubscriptionType()` and `getRateLimitTier()` (which return `null` on it) and the four `is*Subscriber` wrappers built on them were constants; and no writer exists anywhere in this build for `getGlobalConfig().oauthAccount`, so `getOauthAccountInfo()`'s guarded read could only have answered `undefined`.

**Twelve predicates go.** From `utils/auth.ts`: `getSubscriptionType`, `getRateLimitTier`, `getSubscriptionName`, `hasOpusAccess` (whose `null` arm had made it constant true), `isOverageProvisioningAllowed` (constant false), `isConsumerSubscriber` with the private `isConsumerPlan` behind it, `isTeamPremiumSubscriber`, `isEnterpriseSubscriber`, `isProSubscriber`, `isTeamSubscriber` and `isMaxSubscriber`. `is1PApiCustomer` folds instead of leaving — it keeps two tip readers — to its three `isEnvTruthy` terms, and `getOauthAccountInfo` keeps its signature for the claude.ai connector's auth handler while its body becomes `return undefined`. Four names stay with a stated reason: `isAnthropicAuthEnabled`, `isClaudeAISubscriber` and `getOauthAccountInfo` (the connector, next step) and `hasProfileScope` (the fast-mode account gate, the step after). The bearer surface — `getClaudeAIOAuthTokens` with both producers, `getAuthTokenSource`, `getAccountInformation`, `validateForceLoginOrg` and the API-key helpers — is untouched, as is the `SubscriptionType`-typed field of the token interface.

**Where each read folded.** `utils/status.tsx`'s `getModelDisplayLabel` returns `modelDisplayString` directly and loses `chalk`, whose only use was the description arm; `utils/model/model.ts` loses `getClaudeAiUserDefaultModelDescription`, that arm's last reader. `utils/logoV2Utils.ts`'s `billingType` becomes the literal `'API Usage Billing'`. `components/LogoV2/LogoV2.tsx` drops the account display name (the greeting's `username` folds to `''`, which `formatWelcomeMessage` treats like its `null` arm), both `Message from {organizationName}:` announcement prefixes, and the organization suffix on the model line. `buddy/companion.ts`'s `companionUserId` falls back to `config.userID` alone. `/cost`'s `isHidden` getter goes — both its arms returned false, so the command is unconditionally visible, which is what the absent getter means. The command-availability filter in `commands.ts` folds both subscriber terms: the `'console'` case is `!isUsing3PServices() && isFirstPartyAnthropicBaseUrl()`, and the `'claude-ai'` case can never answer true, so it stays as a documented no-op that keeps the switch exhaustive over the union. `utils/telemetryAttributes.ts` loses the whole OAuth-account block (`organization.id`, `user.email`, `user.account_uuid`/`account_id` and the `OTEL_METRICS_INCLUDE_ACCOUNT_UUID` default) — and `utils/taggedId.ts`, whose only reader it was. `components/Onboarding.tsx` loses the `oauthEnabled` state with both telemetry fields that carried it and the comment and dep-array entries that named it.

**Four surfaces lose their reason to exist.** `components/EffortCallout.tsx` is deleted whole: `shouldShowEffortCallout`'s two remaining arms were the Pro and Max/Team branches, so it could only return false, which means neither dialog host could ever select `'effort-callout'` — REPL loses the import, the state, the dialog id, the selector line and the render block, and `utils/effort.ts` loses the Opus 4.6 default-effort block together with `getOpusDefaultEffortConfig`, its default object and the `OpusDefaultEffortConfig` type (the callout was their only other reader). `migrations/resetProToOpusDefault.ts` always took its own skip arm (`apiProvider !== 'firstParty' || !isProSubscriber()` — the second term constant true) and `migrations/migrateSonnet45ToSonnet46.ts` always returned at its guard, so both leave the startup sequence with their imports, and the Sonnet notification entry leaves `hooks/notifs/useModelMigrationNotifications.tsx` with the timestamp its migration wrote (the Opus entry reads the legacy timestamp alone). `utils/config.ts` loses nine fields no writer could set — `oauthAccount`, the subscription-notice quartet, the effort-callout pair, both Opus-Pro migration fields and the Sonnet timestamp — and its config-write guard narrows to the onboarding clause and is renamed `wouldLoseOnboardingState`, with the test-only re-export whose name it carried deleted (it had no reader).

**One fold changes a behaviour, and the record states it.** `hooks/useApiKeyVerification.ts`'s guard is `!isAnthropicAuthEnabled() || isClaudeAISubscriber()` — `true || false`, always true — so the hook's initializer returned `'valid'` on every call and the API-key verification below it was unreachable. The hook keeps its interface for its three consumers (`screens/REPL.tsx`, `PromptInput`, `PromptInput/Notifications`) and returns that arm as a constant. The consequence is that no key verification runs in this build and the invalid-key notices cannot fire: that is the arm the source takes under this build's auth decision (wave D step 1, which made `isAnthropicAuthEnabled()` mean "the `--bare` arm"), not a choice made here. Keeping the verification path alive would have meant inventing a guard the source does not have.

### Port coordinate refresh

Ten historical evidence files moved, all by re-running their own fixtures: `w65-d2`, `w65-d7b`, `w65-d7h`, `w65-d7i`, `w65-d7j`, `w65-d7l`, `w65-d7m`, `w65-d7n`, `w65-d7o` and `w65-d7p`. `portSha256` only (14 fields); no `sourceSha256` changed and no range moved.

### Verification

tsc 0, twenty-five fixtures pass (the new `w65-d7q-verify` plus twenty-four carried), `git diff --check` clean, the orphan scan back at its ten legitimate entries with the file count down by exactly the four deleted modules (1637 → 1633). Two carried fixtures were amended, each because the later step owns a pin the earlier one wrote as "not this step's business" — the standing pattern of a prediction fulfilled: `w65-d7l-verify` pinned `main.tsx`'s import of the Sonnet migration as a surviving neighbour, and `w65-d7p-verify` pinned `getClaudeAiUserDefaultModelDescription`'s constant body. Both pins are retired in favour of an assertion that survives, and the amendments are recorded in those fixtures' comments.

The fixture's absence sweep covers thirty-one names — the four deleted modules, the twelve predicates, the nine config fields and the helpers only the deleted call sites read (`toTaggedId`, `getOpusDefaultEffortConfig` with its type and default object, `getClaudeAiUserDefaultModelDescription`, `wouldLoseAuthState`). Survivor assertions name the four kept predicates with the reader that keeps each. Every folded site is asserted as the arm its constant produced, including the folds that keep a branch.

Four repair passes, all on anchors and each fixed by restoring every touched path from `HEAD` and re-running, so `w65-d7q1.py` reproduces the final state in one pass: a block that differed only by indentation between its two layout variants, a `cut_between` whose end anchor is retained by design while `new` had already re-supplied it, a shorthand property whose `useState` line a previous cut had taken, and a second host file importing the predicate under its own import block. The orphan scan is what surfaced `utils/taggedId.ts` — no name sweep would have, since nothing in the tree names it any more.

**Next (step 7r):** the claude.ai MCP connector — `services/mcp/claudeai.ts` with `fetchClaudeAIMcpConfigsIfEligible`, the `claudeai-proxy` config type in `services/mcp/types.ts`, `config.ts`, `utils.ts` and `entrypoints/sdk/coreSchemas.ts`, and its hosts (`cli/handlers/mcp.tsx`, `cli/print.ts`, `commands/plugin/ManagePlugins.tsx`, `components/mcp/{MCPListPanel,MCPRemoteServerMenu,MCPSettings}.tsx`, `hooks/notifs/useMcpConnectivityStatus.tsx`, `main.tsx`, `services/mcp/{client,config,useManageMCPConnections,utils}.ts`, `services/tools/toolExecution.ts`, `tools/McpAuthTool/McpAuthTool.ts`, `utils/plugins/mcpPluginIntegration.ts`, `utils/settings/types.ts`, `services/analytics/metadata.ts`) — whose `user:mcp_servers` scope check the same producer fact kills, and which is the last reader of `isAnthropicAuthEnabled`, `isClaudeAISubscriber` and `getOauthAccountInfo`. Then `utils/fastMode.ts`'s account-status path, `hasProfileScope`'s last reader, the ~33 in-place CLI blocks, `cli/transports/`, the dependency-pruning pass (nine zero-importer dependencies) and the `utils/filePersistence/` rename.

## Wave D step 7r — the claude.ai MCP connector (`755d79b`, landed)

**The module was a fetch no token in this build could authorize.** `services/mcp/claudeai.ts` memoized a GET of `${getOauthConfig().BASE_API_URL}/v1/mcp_servers?limit=1000` with an `Authorization: Bearer` header and `anthropic-beta: mcp-servers-2025-12-04`, gated on `ENABLE_CLAUDEAI_MCP_SERVERS` and `tokens.scopes?.includes('user:mcp_servers')`, and turned the response into `{type:'claudeai-proxy', url, id, scope:'claudeai'}` configs under collision-suffixed `claude.ai <name>` keys. The two OAuthTokens producers this build keeps (`CLAUDE_CODE_OAUTH_TOKEN` and the file descriptor) hardcode `scopes: ['user:inference']` — the fact `hasProfileScope`'s own comment records — so the scope check could only answer false and the fetch could only resolve `{}`. No `claudeai-proxy` config could exist, which makes every branch keyed on that type unreachable. The second, independent fact is the one step 7p established: `isAnthropicAuthEnabled()` is `return false`, so `isClaudeAISubscriber()` was false and `getOauthAccountInfo()` always undefined — and the connector was their last reader.

**Every host folds.** The module is deleted whole. `services/mcp/types.ts` loses the `'claudeai'` scope member, the proxy schema and its union member and the type. `services/mcp/config.ts` loses `dedupClaudeAiMcpServers` (its only callers were the connector merges), the `extraDedupTargets` parameter of `getClaudeCodeMcpConfigs` with the spread it fed, the proxy arm of the expand switch and the `claudeai` scope throw of `addMcpConfig`, and `getAllMcpConfigs` becomes a bare `getClaudeCodeMcpConfigs()` call. `services/mcp/utils.ts` loses both scope cases and the `claude_ai_` prefix fallback — no source of such names remains. `services/mcp/client.ts` loses `createClaudeAiProxyFetch` (the bearer wrapper that retried a 401 through `handleOAuth401Error`), the transport branch that composed the proxy URL from `MCP_PROXY_URL` and `MCP_PROXY_PATH`, the `claudeai-proxy` member of the auth-failure union with its label, the proxy arm of the connection-failure branch, both `markClaudeAiMcpConnected` blocks and the four session-expiry/auth-cache comparisons, which fold to their http/sse terms. `useManageMCPConnections.ts`'s two-phase lane folds to one: the prefetch with its cache clear, the Phase 2 policy filter, dedup and pending-client merge all go, and the counts object loses its `claudeai` bucket. `main.tsx` loses three lanes — the `-p` `claudeaiConfigPromise` fetch with its enterprise/strict/bare gate, the `claudeaiMcpPromise` prefetch with the `uniqBy` merge, and the lazy dedup + `connectMcpBatch('claudeai')` block with its 5s `CLAUDE_AI_MCP_TIMEOUT_MS` race — while the single local prefetch and the regular connect stay.

**The UI and the SDK status path.** `MCPRemoteServerMenu` loses the connector auth surface: the five claude.ai states, both completion handlers, both Escape keybindings, the Enter and copy branches of `useInput`, `handleClaudeAIAuth` (which composed `/api/organizations/<org>/mcp/start-auth/<serverId>` or `/settings/connectors` from `CLAUDE_AI_ORIGIN`), `handleClaudeAIClearAuth`, the two connector screens, the connector menu branch with its `Select` cases, the toggle and reconnect analytics blocks, both early returns, and the transport guard on the Auth row; the menu now branches on `isEffectivelyAuthenticated` alone. `MCPSettings` loses the proxy transport branch and its default tab folds to `'Claude Code'`; `MCPListPanel` loses the claude.ai filter, memo, items loop and section; `ManagePlugins` loses the proxy detail branch, the two connector fallbacks and the union members. `useMcpConnectivityStatus` loses both claude.ai filters and their notifications together with the ever-connected gate. `entrypoints/sdk/coreSchemas.ts` collapses `McpServerStatusConfigSchema` to the process-transport schema and drops the proxy schema; `cli/print.ts` and `cli/handlers/mcp.tsx` lose their proxy branches. `services/analytics/metadata.ts` loses the `claudeai-proxy` arm, which orphans the `mcpServerType` parameter of the tool-details gate — both signatures drop it and all nine `toolExecution` call sites drop the argument. `normalizeNameForMCP` loses its `claude.ai ` prefix case (the collapse-and-trim that kept connector names clear of the `__` delimiter) and becomes the plain replace; the two comments and the `commit-push-pr` allowlist entry that used a connector name as their example go with it.

**The last readers leave.** `isAnthropicAuthEnabled`, the private `shouldUseClaudeAIAuth`, `isClaudeAISubscriber` and `getOauthAccountInfo` are deleted — the connector was the last reader of all four — together with `getClaudeAIOAuthTokensAsync` and `checkAndRefreshOAuthTokenIfNeeded`, whose only caller was the proxy fetch. `handleOAuth401Error` stays for `utils/fastMode.ts`; the whole retained surface (`getClaudeAIOAuthTokens` with both producers, `getAuthTokenSource`, `getAccountInformation`, `hasProfileScope`, the API-key helpers) is untouched. `utils/config.ts` loses `claudeAiMcpEverConnected` and, with the accessor gone, `AccountInfo` and the `BillingType` alias it carried. `constants/oauth.ts` loses `CLAUDE_AI_ORIGIN` with its doc block and `MCP_PROXY_URL`/`MCP_PROXY_PATH` from the type and all four arms; the authorize URLs, the scope constants and every other field stay.

**No behaviour changes.** Every deleted branch was unreachable by the scope-gate fact, so the retained manual, local, plugin and SDK MCP servers and the API-key auth path are byte-identical in behaviour. The connector's unavailable and needs-auth notices could not fire before the cut either — the filters that fed them matched a type that could not exist. Two comments that named the deleted predicates (`getAuthTokenSource`'s sibling note, the `useApiKeyVerification` guard, the `validateForceLoginOrg` provenance and `utils/managedEnv`'s aside) are rewritten rather than left pointing at symbols the tree no longer has.

### Port coordinate refresh

Thirteen historical evidence files moved, all by re-running their own fixtures: `w65-d2`, `w65-d7b`, `w65-d7c`, `w65-d7f`, `w65-d7h`, `w65-d7i`, `w65-d7j`, `w65-d7k`, `w65-d7l`, `w65-d7n`, `w65-d7o`, `w65-d7p` and `w65-d7q`. `portSha256` only; no `sourceSha256` changed and no range moved.

### Verification

tsc 0, twenty-five fixtures pass (the new `w65-d7r-verify` plus twenty-four carried), `git diff --check` clean, the orphan scan at its ten legitimate entries with the file count down by exactly the deleted module (1633 → 1632). Two carried fixtures were amended, each a pin this step supersedes: `w65-d7q-verify` pinned the three predicates it kept "for the connector, next step", so those pins retire for the bearer surface that stays; `w65-d2-verify` carried the port-parity case for `shouldUseClaudeAIAuth`, whose ported body this step deletes — the case retires with the note that its recovered range stays cited here.

The fixture's absence sweep covers the connector family under every spelling (the module, the proxy type, the fetch/mark/cache helpers, the ever-connected field, the menu auth flow, the analytics events, the `claude.ai ` normalization prefix and the `claude_ai_` name shape), the three OAuth-config fields only the connector read, and the six predicates and stubs it kept alive. Survivors are asserted with the reader that keeps each. Every host is asserted as the arm the absent connector left, including the two `getClaudeCodeMcpConfigs` call sites, the direct `connectMcpBatch`→headless seam, the two-member auth-failure union, the folded session-expiry terms and the two-argument analytics gate.

Two repair passes, both fixed in `w65-d7r1.py` with every touched path restored from `HEAD` before the replay, which then reproduces the final state in one pass: four comparison folds in `client.ts` that strict narrowing rejected once the union lost its member, and a normalization special case with three comment/allowlist examples that still named connector-shaped strings. The fixture's first run also tightened one absence regex to a word boundary, because `UserAccountInfo` legitimately contains the deleted `AccountInfo` substring.

**Next (step 7s):** `utils/fastMode.ts`'s account-status path — `hasProfileScope`'s last reader — then the ~33 in-place CLI blocks, `cli/transports/`, the dependency-pruning pass (nine zero-importer dependencies) and the `utils/filePersistence/` rename.

## Wave D step 7s — the fast-mode account-status probe (`8c8d201`, landed)

**The probe was a subscription lookup with one dead arm and one live one.** `utils/fastMode.ts` fetched `GET ${getOauthConfig().BASE_API_URL}/api/claude_code_penguin_mode`, chose between an OAuth bearer with `anthropic-beta: OAUTH_BETA_HEADER` and an `x-api-key`, and cached the org answer in `orgStatus` for `getFastModeUnavailableReason`. The OAuth arm was dead on the same producer fact step 7r recorded: both surviving token sources hardcode `scopes: ['user:inference']`, so `hasProfileScope()` was constant false. The API-key arm still posted a remote account endpoint whose answer only the server can give — what the 2026-10-16 local-only directive excludes — so the whole probe goes.

**The local surface stays.** `isFastModeEnabled` (the disable env flag), the cached GrowthBook flags (`tengu_penguins_off`, `tengu_marble_sandcastle`), the SDK `flagSettings` opt-in, the first-party provider gate, the model-support and initial-setting predicates, the cooldown state machine with its two signals, `/fast` and the picker are untouched. The gate the probe fed — `orgStatus.status === 'disabled'` — has no producer left, so it folds to an in-session flag set by the API-rejection path. `handleFastModeRejectedByAPI` remains the server-feedback arm: it still clears the persisted `fastMode` preference and emits the notification signal, now payloadless because no probe can report the opposite transition. The hook loses its unreachable `orgEnabled === true` arm.

**Every host folds.** `prefetchFastModeStatus`, `resolveFastModeStatusFromCache`, `fetchFastModeStatus`, the `FastModeResponse`/`FastModeOrgStatus`/`FastModeDisabledReason` model, the reason table, the 30 s throttle and the `startupPrefetchedAt` bookkeeping are deleted. `main.tsx` loses the whole startup-prefetch block (the throttle, the kill switch, the cache resolution, the config write and both log lines) and the two imports it alone read (`prefetchFastModeStatus`/`resolveFastModeStatusFromCache`, `getFeatureValue_CACHED_MAY_BE_STALE`); the settings-dialog block is followed directly by the example-command prefetch. `commands/fast/fast.tsx` no longer awaits the probe before its picker. `penguinModeOrgEnabled` and `startupPrefetchedAt` leave `utils/config.ts`.

**The last readers leave.** `handleOAuth401Error` and `hasProfileScope` are deleted — the probe was the last reader of both — and `OAUTH_BETA_HEADER` leaves `constants/oauth.ts` with them. The bearer/API-key surface stays in full: `getClaudeAIOAuthTokens` with both producers, `getAuthTokenSource`, `getAccountInformation`, the API-key helpers and the `SubscriptionType`-typed token field.

**One behaviour change, stated.** The org-disabled memory is now session-scoped: the source persisted it through `penguinModeOrgEnabled` and restored it at startup from the deleted cache. The preference is still cleared on rejection, so a restart begins with fast mode off, and the inference API remains the authority on the next request. Before any probe answer arrived the source treated fast mode as available (`pending` fell through), so a fresh session's availability answer is unchanged.

### Port coordinate refresh

Eleven historical evidence files moved, all by re-running their own fixtures: `w65-d2`, `w65-d7b`, `w65-d7h`, `w65-d7i`, `w65-d7j`, `w65-d7l`, `w65-d7n`, `w65-d7o`, `w65-d7p`, `w65-d7q` and `w65-d7r`. `portSha256` only; no `sourceSha256` changed and no range moved.

### Verification

tsc 0, twenty-seven fixtures pass (the new `w65-d7s-verify` plus twenty-six carried), `git diff --check` clean, the orphan scan at its ten legitimate entries with the file count unchanged (1632 — no module was deleted). Two carried fixtures were amended, each a pin this step supersedes: `w65-d7q-verify` pinned `hasProfileScope` as the fast-mode account gate, and `w65-d7r-verify` pinned both predicates the probe kept alive. Both now assert their absence.

The fixture's absence sweep covers the probe family (the fetch/prefetch/resolve names, the status model, the reason table, the throttle, the endpoint, the env bypass, the analytics event and both config fields), the two auth predicates and the header only the probe read. Survivors are asserted with the reader that keeps each, including the folded rejection body, the payloadless signal, the hook's single arm, the direct settings-dialog→example-command seam and the `/fast` argument path. The base-commit check confirms `755d79b` carried the probe the tree no longer has.

One repair pass: `w65-d7s1.py`'s first `cut_between` retained its end anchor while the replacement re-declared the signal, which tsc rejected with four TS2451s; the script now deletes up to the old signal block and rewrites it in a separate cut, and the tree was restored from `HEAD` before the replay that produced the final state in one pass.

**Next (step 7t):** the ~33 in-place CLI blocks, `cli/transports/`, the dependency-pruning pass (nine zero-importer dependencies) and the `utils/filePersistence/` rename.

## Protocol slip (recorded)

The three wave-A directories were removed with `rm -rf` **before** the `*.w*bak` quarantine step that every earlier package ran. Baks are gitignored, so their loss is not recoverable from history. Bounded afterwards: of the 12 files, exactly one (`services/remoteManagedSettings/securityCheck.tsx`) carried an inline `sourceMappingURL` in its dump text and so was a candidate for a W54-generation bak; the other 11 never had one. The dump-state text of all 12 — which for that one file still embeds its original TypeScript source — was extracted from the dump commit `bd958088` into `.audit/w65-source-baks/` as a substitute record, and the file content of all 12 is recoverable exactly from `453b8e3`. Measured base rate for context: 682 baks across 1,832 source files, and a 40-file sample showed 16 byte-identical to their dump-commit text, so an intermediate-generation bak cannot be ruled out for the one candidate.

Wave B repeated the slip (4 of 9 files carried baks, dump-state text recovered from `bd958088`). Wave E step 4 also ran the quarantine first: 13 `*.w54bak` source maps copied to `.audit/w65-e4-baks/` and `cmp`-verified before deletion. Wave C ran the quarantine first: `find <targets> -name '*.w*bak'` copied two files (`commands/extra-usage/extra-usage.tsx.w54bak`, `commands/rate-limit-options/rate-limit-options.tsx.w54bak`) into `.audit/w65-c-baks/`, both byte-compared with `cmp` before any deletion; no other target carried one.

One leftover cleaned up while deleting: `commands/passes/` held only `passes.tsx.w54bak`, a stray from the earlier package `bea1b62` ("Remove the non-coding slash-command surface"), which had deleted the `.tsx` and left its bak behind. The directory was removed with the rest of the command dirs. No source is lost — `bea1b62^:commands/passes/passes.tsx` exists, so that command's source is recoverable from history, and the bak predated this wave.

## Verification and limits

`tsc --noEmit --pretty false` exits 0 after each wave. All five owned fixtures (`w58-verify`, `w59-verify`, `w59-followup-verify`, `w60-verify`, `w65-e5-verify`) pass. `git diff --check` clean. The base has no test suite and no runtime, so the acceptance surface is the compiler plus fixtures — no CLI ran, and no recovered entrypoint was executed. Two cut sites needed a repair pass: the first `settings.ts` edit left an orphan `}` from the removed `if/else` (TS1472/TS1005/TS1128), fixed by removing the leftover closer.

Wave C's cuts were driven the same way, and five repair passes came out of it: an over-wide range for the `createGuestPassesFeed` tail (fixed by reading the file's exact end bytes), a `cut_all` where an 8-space anchor was a substring of a 16-space one (`onOpenRateLimitOptions` in `REPL.tsx`, reordered to cut the deeper indent first), and the `onOpenRateLimitOptions` prop chain, which surfaced one host at a time as `tsc` named the next component that still passed it. That chain is the wave's clearest illustration of why the compiler is the acceptance surface here: the prop was drilled through five components, so a single missed hop is a type error rather than a silent behaviour change.


## Remaining waves (recorded, not started)

- **OAuth identity and token core** — `services/oauth/` and the token store landed as wave D step 2 (`e47f4a5`); the model-call seams landed as wave D step 7p (`50744a6`) with `services/api/bootstrap.ts`; the subscriber consumer surface landed as wave D step 7q (`6fa308a`), which deleted twelve predicates and the nine config fields behind them. The claude.ai MCP connector landed as wave D step 7r (`755d79b`), taking those three predicates with it; under the 2026-10-16 local-only directive this cluster is complete.
- **Usage, limits and credits** — landed as wave C (`35c180c`). Two residues kept on purpose: the SDK `rate_limit_event` schema and the server-declared `extra_usage_disabled` fast-mode reason. The plan's other named targets resolved differently than expected: there is no `components/Tips` directory in this tree (`services/tips/tipRegistry.ts` holds the tip content, and it was cut), and `components/Settings/Usage.tsx` was the usage endpoint's only consumer, so both left with this wave. `components/FeedbackSurvey/` is not part of this cluster — it posts survey answers and belongs with the product-feedback surface.
- **Remote sessions** — `remote/`, `assistant/`, `ssh/`, `server/`, `utils/teleport*`, `utils/background/remote/`, `tools/RemoteTriggerTool/`, the ultraplan surface and **`bridge/`** all landed (waves E steps 1-5). What remains of this cluster: the `replBridge*` AppState family and `getRemoteControlAtStartup()` (inert state with surviving readers), and the `session-ingress` bearer token surface (`utils/sessionIngressAuth.ts`, the MCP client's `Authorization` header, `filePersistence`). `cli/remoteIO.ts` and `cli/transports/` stay as the SDK `--sdk-url` transport.
- **Remote-control leftovers** — the `replBridge*` AppState fields, `getRemoteControlAtStartup()`, the `kairosEnabled` arm of the initial state, `migrations/migrateReplBridgeEnabledToRemoteControlAtStartup.ts`, `tools/ConfigTool`'s sync site, and the comment-only references in `ink/root.ts`, `utils/messages/systemInit.ts`, `utils/toolSchemaCache.ts` and `services/api/emptyUsage.ts`.
- **Peer messaging** — landed as wave D step 7o (`4a799eb`). `feature('UDS_INBOX')`'s three require targets (`tools/ListPeersTool/`, `utils/udsMessaging.ts`, `utils/peerRegistry.ts`) were never in the build, so the lane folded to its off arm everywhere it was read and `utils/peerAddress.ts` left with its last consumer.
- **Policy limits** — `services/policyLimits/`; every `isPolicyAllowed` call site is a remote-session, remote-control or product-feedback policy, so it goes with those.
- **Open decisions.** `services/analytics/` is network (`logEvent`, GrowthBook) and is imported by hundreds of local files — a no-op stub is the realistic cut, but the GrowthBook gates the coding loop reads (`getDynamicConfig_BLOCKS_ON_INIT` at `claude.ts:96`) need a product call. `services/teamMemorySync/teamMemSecretGuard.checkTeamMemSecrets` was local code inside a network feature. `hooks/useApiKeyVerification.ts` is API-key-shaped but routes through `isAnthropicAuthEnabled` and may need a bare rewrite rather than deletion.

## Feature loss to record in the product record

Removing the subscriber branch is not behaviour-neutral in two places that are not network losses: the 1-hour prompt-cache TTL (`claude.ts:408`) falls to 5 minutes, and subscriber 429 responses stop being exempt from retry (`withRetry.ts:739,768`). Both are recorded so the port can decide deliberately rather than inherit them.
