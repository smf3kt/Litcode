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

## Protocol slip (recorded)

The three wave-A directories were removed with `rm -rf` **before** the `*.w*bak` quarantine step that every earlier package ran. Baks are gitignored, so their loss is not recoverable from history. Bounded afterwards: of the 12 files, exactly one (`services/remoteManagedSettings/securityCheck.tsx`) carried an inline `sourceMappingURL` in its dump text and so was a candidate for a W54-generation bak; the other 11 never had one. The dump-state text of all 12 — which for that one file still embeds its original TypeScript source — was extracted from the dump commit `bd958088` into `.audit/w65-source-baks/` as a substitute record, and the file content of all 12 is recoverable exactly from `453b8e3`. Measured base rate for context: 682 baks across 1,832 source files, and a 40-file sample showed 16 byte-identical to their dump-commit text, so an intermediate-generation bak cannot be ruled out for the one candidate.

Wave B repeated the slip (4 of 9 files carried baks, dump-state text recovered from `bd958088`). Wave E step 4 also ran the quarantine first: 13 `*.w54bak` source maps copied to `.audit/w65-e4-baks/` and `cmp`-verified before deletion. Wave C ran the quarantine first: `find <targets> -name '*.w*bak'` copied two files (`commands/extra-usage/extra-usage.tsx.w54bak`, `commands/rate-limit-options/rate-limit-options.tsx.w54bak`) into `.audit/w65-c-baks/`, both byte-compared with `cmp` before any deletion; no other target carried one.

One leftover cleaned up while deleting: `commands/passes/` held only `passes.tsx.w54bak`, a stray from the earlier package `bea1b62` ("Remove the non-coding slash-command surface"), which had deleted the `.tsx` and left its bak behind. The directory was removed with the rest of the command dirs. No source is lost — `bea1b62^:commands/passes/passes.tsx` exists, so that command's source is recoverable from history, and the bak predated this wave.

## Verification and limits

`tsc --noEmit --pretty false` exits 0 after each wave. All five owned fixtures (`w58-verify`, `w59-verify`, `w59-followup-verify`, `w60-verify`, `w65-e5-verify`) pass. `git diff --check` clean. The base has no test suite and no runtime, so the acceptance surface is the compiler plus fixtures — no CLI ran, and no recovered entrypoint was executed. Two cut sites needed a repair pass: the first `settings.ts` edit left an orphan `}` from the removed `if/else` (TS1472/TS1005/TS1128), fixed by removing the leftover closer.

Wave C's cuts were driven the same way, and five repair passes came out of it: an over-wide range for the `createGuestPassesFeed` tail (fixed by reading the file's exact end bytes), a `cut_all` where an 8-space anchor was a substring of a 16-space one (`onOpenRateLimitOptions` in `REPL.tsx`, reordered to cut the deeper indent first), and the `onOpenRateLimitOptions` prop chain, which surfaced one host at a time as `tsc` named the next component that still passed it. That chain is the wave's clearest illustration of why the compiler is the acceptance surface here: the prop was drilled through five components, so a single missed hop is a type error rather than a silent behaviour change.


## Remaining waves (recorded, not started)

- **OAuth identity and token core** — `services/oauth/`, `utils/auth.ts` subscriber half, `utils/config.ts` `oauthAccount`/`AccountInfo`/`hasAvailableSubscription`, and the model-call seams: `services/api/client.ts:128-135,307-313` (`isClaudeAISubscriber()` branch, `authToken`, staging baseURL), `claude.ts:408,522,1030`, `withRetry.ts:20-21,247,332,739,768`, `errors.ts:468,737,798`, `utils/http.ts:70`, `utils/betas.ts:25,71,251`, `utils/model/*`.
- **Usage, limits and credits** — landed as wave C (`35c180c`). Two residues kept on purpose: the SDK `rate_limit_event` schema and the server-declared `extra_usage_disabled` fast-mode reason. The plan's other named targets resolved differently than expected: there is no `components/Tips` directory in this tree (`services/tips/tipRegistry.ts` holds the tip content, and it was cut), and `components/Settings/Usage.tsx` was the usage endpoint's only consumer, so both left with this wave. `components/FeedbackSurvey/` is not part of this cluster — it posts survey answers and belongs with the product-feedback surface.
- **Remote sessions** — `remote/`, `assistant/`, `ssh/`, `server/`, `utils/teleport*`, `utils/background/remote/`, `tools/RemoteTriggerTool/`, the ultraplan surface and **`bridge/`** all landed (waves E steps 1-5). What remains of this cluster: the `replBridge*` AppState family and `getRemoteControlAtStartup()` (inert state with surviving readers), and the `session-ingress` bearer token surface (`utils/sessionIngressAuth.ts`, the MCP client's `Authorization` header, `filePersistence`). `cli/remoteIO.ts` and `cli/transports/` stay as the SDK `--sdk-url` transport.
- **Remote-control leftovers** — the `replBridge*` AppState fields, `getRemoteControlAtStartup()`, the `kairosEnabled` arm of the initial state, `migrations/migrateReplBridgeEnabledToRemoteControlAtStartup.ts`, `tools/ConfigTool`'s sync site, and the comment-only references in `ink/root.ts`, `utils/messages/systemInit.ts`, `utils/toolSchemaCache.ts` and `services/api/emptyUsage.ts`.
- **Policy limits** — `services/policyLimits/`; every `isPolicyAllowed` call site is a remote-session, remote-control or product-feedback policy, so it goes with those.
- **Open decisions.** `services/analytics/` is network (`logEvent`, GrowthBook) and is imported by hundreds of local files — a no-op stub is the realistic cut, but the GrowthBook gates the coding loop reads (`getDynamicConfig_BLOCKS_ON_INIT` at `claude.ts:96`) need a product call. `services/teamMemorySync/teamMemSecretGuard.checkTeamMemSecrets` was local code inside a network feature. `hooks/useApiKeyVerification.ts` is API-key-shaped but routes through `isAnthropicAuthEnabled` and may need a bare rewrite rather than deletion.

## Feature loss to record in the product record

Removing the subscriber branch is not behaviour-neutral in two places that are not network losses: the 1-hour prompt-cache TTL (`claude.ts:408`) falls to 5 minutes, and subscriber 429 responses stop being exempt from retry (`withRetry.ts:739,768`). Both are recorded so the port can decide deliberately rather than inherit them.
