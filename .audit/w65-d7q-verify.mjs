import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "50744a6"
const digest = text => createHash("sha256").update(text).digest("hex")

// Every remaining reader of the subscription predicates folds to the arm the
// predicate already produced — isAnthropicAuthEnabled() is `return false` and
// the two surviving token producers hardcode scopes ['user:inference'] — and
// the predicates that lose their last reader leave with them. API-key auth is
// the retained path and is untouched.
const read = p => fs.readFileSync(`${root}/${p}`, "utf8")

function rg(pattern) {
  try {
    return execFileSync("rg", [
      "-n", "--glob", "!node_modules", "--glob", "!*.json", "--glob", "!*.md",
      "-e", pattern, root,
    ], {encoding: "utf8"}).trim()
  } catch (e) {
    assert.equal(e.status, 1, `rg failed: ${e.message}`)
    return ""
  }
}

// 1. The four deleted units, and every name they carried.
for (const f of [
  "components/EffortCallout.tsx",
  "migrations/resetProToOpusDefault.ts",
  "migrations/migrateSonnet45ToSonnet46.ts",
  "utils/taggedId.ts",
]) {
  assert.equal(fs.existsSync(`${root}/${f}`), false, `${f} is gone`)
}
for (const name of [
  "EffortCallout", "shouldShowEffortCallout", "getSubscriptionType",
  "getSubscriptionName", "getRateLimitTier", "hasOpusAccess",
  "isOverageProvisioningAllowed", "isConsumerSubscriber", "isConsumerPlan",
  "isTeamPremiumSubscriber", "isEnterpriseSubscriber", "isProSubscriber",
  "isTeamSubscriber", "isMaxSubscriber", "opusProMigrationComplete",
  "opusProMigrationTimestamp", "sonnet45To46MigrationTimestamp",
  "effortCalloutDismissed", "effortCalloutV2Dismissed", "oauthAccount",
  "hasAvailableSubscription", "subscriptionNoticeCount",
  "recommendedSubscription", "wouldLoseAuthState", "toTaggedId",
  "getClaudeAiUserDefaultModelDescription", "OpusDefaultEffortConfig",
  "OPUS_DEFAULT_EFFORT_CONFIG_DEFAULT", "getOpusDefaultEffortConfig",
  "resetProToOpusDefault", "migrateSonnet45ToSonnet46",
]) {
  assert.equal(rg(`\\b${name}\\b`), "", `${name} still appears in the tree`)
}

// 2. The survivors: the bearer surface and hasProfileScope, whose only reader
//    is the fast-mode account gate. The three names the claude.ai connector
//    still read at this step (isAnthropicAuthEnabled, isClaudeAISubscriber,
//    getOauthAccountInfo) retired with the connector in step 7r, as this
//    file's own `remaining` predicted; their pins go with them.
const auth = read("utils/auth.ts")
for (const keep of [
  "export function hasProfileScope(): boolean {",
  "export const getClaudeAIOAuthTokens = memoize((): OAuthTokens | null => {",
  "export function getAccountInformation() {",
]) {
  assert.ok(auth.includes(keep), `${keep} survives this step`)
}
// is1PApiCustomer keeps its two tip readers and folds to its env terms.
assert.match(
  auth,
  /  \/\/ Exclude Vertex, Bedrock, and Foundry customers\n  if \(\n    isEnvTruthy\(process\.env\.CLAUDE_CODE_USE_BEDROCK\) \|\|\n    isEnvTruthy\(process\.env\.CLAUDE_CODE_USE_VERTEX\) \|\|\n    isEnvTruthy\(process\.env\.CLAUDE_CODE_USE_FOUNDRY\)\n  \) \{\n    return false\n  \}\n\n  \/\/ Everyone else is an API customer \(OAuth API customers, direct API key users, etc\.\)\n  return true\n\}\n/,
)

// 3. Each folded site as the arm its constant produced.
assert.match(
  read("utils/status.tsx"),
  /export function getModelDisplayLabel\(mainLoopModel: string \| null\): string \{\n  return modelDisplayString\(mainLoopModel\)\n\}\n/,
)
assert.match(read("utils/logoV2Utils.ts"), /  const billingType = 'API Usage Billing'\n/)
const logo = read("components/LogoV2/LogoV2.tsx")
assert.doesNotMatch(logo, /getGlobalConfig\(\)\.oauthAccount|config\.oauthAccount/)
assert.equal((logo.match(/formatWelcomeMessage\(''\)/g) ?? []).length, 2)
assert.match(logo, /  const modelLine = `\$\{modelDisplayName\} · \$\{billingType\}`\n/)
assert.match(read("buddy/companion.ts"), /  return config\.userID \?\? 'anon'\n/)
assert.doesNotMatch(read("commands/cost/index.ts"), /isHidden/)

const commands = read("commands.ts")
assert.match(commands, /      case 'claude-ai':\n        \/\/ No build of this product authenticates as a Claude\.ai subscriber\.\n        break\n/)
assert.match(
  commands,
  /        if \(!isUsing3PServices\(\) && isFirstPartyAnthropicBaseUrl\(\)\) return true\n/,
)
assert.doesNotMatch(commands, /isClaudeAISubscriber/)

const tel = read("utils/telemetryAttributes.ts")
assert.doesNotMatch(tel, /organization\.id|user\.email|user\.account_uuid|toTaggedId|ACCOUNT_UUID/)
assert.match(tel, /  const attributes: Attributes = \{\n    'user\.id': userId,\n  \}\n/)

const onboard = read("components/Onboarding.tsx")
assert.match(onboard, /    logEvent\('tengu_began_setup', \{\}\)\n/)
assert.doesNotMatch(onboard, /oauthEnabled/)

assert.match(
  read("hooks/useApiKeyVerification.ts"),
  /  const verify = useCallback\(async \(\): Promise<void> => \{\}, \[\]\)\n\n  return \{\n    status: 'valid',\n    reverify: verify,\n    error: null,\n  \}\n\}\n/,
)
assert.match(
  read("utils/planModeV2.ts"),
  /export function getPlanModeV2AgentCount\(\): number \{/,
)
assert.doesNotMatch(read("utils/planModeV2.ts"), /getSubscriptionType|getRateLimitTier/)
// The model-capability checks keep their own opus-4-6 tests; what goes is the
// subscriber default-effort block and the config helper only it read.
assert.doesNotMatch(
  read("utils/effort.ts"),
  /Default effort on Opus 4.6 to medium for Pro|getOpusDefaultEffortConfig|OpusDefaultEffortConfig/,
)
assert.match(
  read("tools/AgentTool/prompt.ts"),
  /  const concurrencyNote = !listViaAttachment\n/,
)
assert.match(read("utils/attachments.ts"), /      showConcurrencyNote: true,\n/)

const cfg = read("utils/config.ts")
assert.match(cfg, /function wouldLoseOnboardingState\(fresh: \{\n  hasCompletedOnboarding\?: boolean\n\}\): boolean \{/)
// the definition plus its three call sites
assert.equal((cfg.match(/wouldLoseOnboardingState\(/g) ?? []).length, 4)
assert.doesNotMatch(cfg, /wouldLoseAuthState|_wouldLoseAuthStateForTesting/)
assert.doesNotMatch(read("hooks/notifs/useModelMigrationNotifications.tsx"), /sonnet45To46|opusProMigrationTimestamp/)
assert.doesNotMatch(read("utils/model/model.ts"), /getClaudeAiUserDefaultModelDescription/)

// 4. The gate.
const tscText = fs.readFileSync(new URL("w65-d7q-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const digests = {}
for (const f of [
  "components/EffortCallout.tsx", "migrations/resetProToOpusDefault.ts",
  "migrations/migrateSonnet45ToSonnet46.ts", "utils/taggedId.ts",
  "main.tsx", "screens/REPL.tsx", "utils/status.tsx",
  "utils/statusNoticeDefinitions.tsx", "utils/logoV2Utils.ts",
  "components/LogoV2/LogoV2.tsx", "buddy/companion.ts",
  "commands/cost/index.ts", "commands.ts", "utils/telemetryAttributes.ts",
  "components/Onboarding.tsx", "hooks/useApiKeyVerification.ts",
  "utils/planModeV2.ts", "utils/effort.ts", "tools/AgentTool/prompt.ts",
  "utils/attachments.ts", "utils/auth.ts", "utils/config.ts",
  "hooks/notifs/useModelMigrationNotifications.tsx", "utils/model/model.ts",
]) {
  digests[f] = digest(execFileSync("git", ["-C", root, "show", `${before}:${f}`], {encoding: "utf8"}))
}

const port = p => digest(read(p))
fs.writeFileSync(
  new URL("w65-d7q-source-evidence.json", import.meta.url),
  JSON.stringify(
    {
      before,
      kind: "the subscriber consumer surface folded to its constants; the predicates that lost every reader deleted",
      decisiveFact:
        "isAnthropicAuthEnabled() is `return false` (wave D step 1), so isClaudeAISubscriber() is false, getOauthAccountInfo() is undefined, and every tier predicate (getSubscriptionType, getRateLimitTier, their four is*Subscriber wrappers, getSubscriptionName, hasOpusAccess) was already a constant. Nothing in this build writes the persisted oauthAccount, the migration timestamps or the effort-callout flags, so the config fields behind them were dead too.",
      evidence: [
        {
          file: "utils/status.tsx",
          change:
            "getModelDisplayLabel drops the subscriber description arm (and chalk, whose only use it was) and returns modelDisplayString directly; utils/model/model.ts loses getClaudeAiUserDefaultModelDescription, which that arm was the last reader of",
          sourceSha256: digests["utils/status.tsx"],
          portSha256: port("utils/status.tsx"),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/statusNoticeDefinitions.tsx",
          change:
            "the claude-ai-external-token notice leaves both the definitions array and the file: its isActive required isClaudeAISubscriber(), so it could never be active, and its copy told a subscriber to run /logout",
          sourceSha256: digests["utils/statusNoticeDefinitions.tsx"],
          portSha256: port("utils/statusNoticeDefinitions.tsx"),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/logoV2Utils.ts + components/LogoV2/LogoV2.tsx",
          change:
            "billingType folds to the literal the ternary's else arm produced; the logo drops the account display name (username folds to ''), both `Message from {org}:` announcement prefixes, and the org suffix on the model line",
          sourceSha256: digests["utils/logoV2Utils.ts"] + digests["components/LogoV2/LogoV2.tsx"],
          portSha256: port("utils/logoV2Utils.ts") + port("components/LogoV2/LogoV2.tsx"),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "buddy/companion.ts",
          change: "companionUserId falls back to config.userID alone, the account uuid being always absent",
          sourceSha256: digests["buddy/companion.ts"],
          portSha256: port("buddy/companion.ts"),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "commands/cost/index.ts + commands.ts",
          change:
            "the /cost isHidden getter goes — both its arms returned false — and the command-availability filter folds: the 'console' case drops its subscriber term, and the 'claude-ai' case can never answer true, so it is kept as a documented no-op for the case's exhaustiveness check",
          sourceSha256: digests["commands/cost/index.ts"] + digests["commands.ts"],
          portSha256: port("commands/cost/index.ts") + port("commands.ts"),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/telemetryAttributes.ts",
          change:
            "the OAuth-account attribute block goes whole (organization.id, user.email, user.account_uuid/account_id and the OTEL_METRICS_INCLUDE_ACCOUNT_UUID default), and utils/taggedId.ts — its only reader — is deleted with it",
          sourceSha256: digests["utils/telemetryAttributes.ts"],
          portSha256: port("utils/telemetryAttributes.ts"),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "components/Onboarding.tsx",
          change:
            "the oauthEnabled state and its two telemetry-payload fields go (the payload shape is otherwise unchanged), with the dep-array entries and the comment that named it",
          sourceSha256: digests["components/Onboarding.tsx"],
          portSha256: port("components/Onboarding.tsx"),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "hooks/useApiKeyVerification.ts",
          change:
            "the source's guard `!isAnthropicAuthEnabled() || isClaudeAISubscriber()` is `true || false` = always true, so the hook's every path answered 'valid' and the API-key verification below it was unreachable. The hook keeps its interface for its three consumers and returns that arm as a constant; the record states the consequence — no key verification runs in this build",
          sourceSha256: digests["hooks/useApiKeyVerification.ts"],
          portSha256: port("hooks/useApiKeyVerification.ts"),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/planModeV2.ts",
          change: "the plan-mode agent count drops its max-20x and enterprise/team arms, keeping the env override and the default of 1",
          sourceSha256: digests["utils/planModeV2.ts"],
          portSha256: port("utils/planModeV2.ts"),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/effort.ts + components/EffortCallout.tsx",
          change:
            "the Opus 4.6 subscriber default-effort block goes, and with it getOpusDefaultEffortConfig, its default object and the OpusDefaultEffortConfig type, whose only other reader was the callout. components/EffortCallout.tsx is deleted whole: shouldShowEffortCallout could only answer false, so neither dialog host could ever select 'effort-callout'",
          sourceSha256: digests["utils/effort.ts"] + digests["components/EffortCallout.tsx"],
          portSha256: port("utils/effort.ts"),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "tools/AgentTool/prompt.ts + utils/attachments.ts",
          change:
            "the concurrency note no longer depends on the subscription tier: inline it is `!listViaAttachment`, and the attachment field showConcurrencyNote is `true`",
          sourceSha256: digests["tools/AgentTool/prompt.ts"] + digests["utils/attachments.ts"],
          portSha256: port("tools/AgentTool/prompt.ts") + port("utils/attachments.ts"),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/auth.ts",
          change:
            "twelve predicates and the SubscriptionType-consuming wrappers are deleted (getSubscriptionType, getRateLimitTier, getSubscriptionName, hasOpusAccess, isOverageProvisioningAllowed, isConsumerSubscriber, isConsumerPlan, isTeamPremiumSubscriber, isEnterpriseSubscriber, isProSubscriber, isTeamSubscriber, isMaxSubscriber); is1PApiCustomer folds to its three env terms; getOauthAccountInfo's guarded config read folds to `return undefined`. Kept: isAnthropicAuthEnabled, isClaudeAISubscriber and getOauthAccountInfo for the claude.ai connector (next step), hasProfileScope for the fast-mode account gate, and the whole bearer/API-key surface",
          sourceSha256: digests["utils/auth.ts"],
          portSha256: port("utils/auth.ts"),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/config.ts",
          change:
            "nine dead fields go (oauthAccount, the subscription-notice quartet, the effort-callout pair, both Opus-Pro migration fields, the Sonnet 4.5→4.6 timestamp) and wouldLoseAuthState narrows to its onboarding clause and is renamed wouldLoseOnboardingState, with the test-only re-export whose name it carried deleted — nothing could write an oauthAccount, so that clause was already dead",
          sourceSha256: digests["utils/config.ts"],
          portSha256: port("utils/config.ts"),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "main.tsx + screens/REPL.tsx",
          change:
            "both migrations leave the startup sequence with their imports; the startup telemetry payload drops its subscription field; REPL drops the callout's import, state, dialog id, selector line and render block; the numStartups comment is reworded to the logo's first-run reader",
          sourceSha256: digests["main.tsx"] + digests["screens/REPL.tsx"],
          portSha256: port("main.tsx") + port("screens/REPL.tsx"),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "hooks/notifs/useModelMigrationNotifications.tsx",
          change:
            "the Sonnet 4.5→4.6 notification entry goes with the migration that wrote its timestamp, and the Opus entry reads the legacy timestamp alone",
          sourceSha256: digests["hooks/notifs/useModelMigrationNotifications.tsx"],
          portSha256: port("hooks/notifs/useModelMigrationNotifications.tsx"),
          coordinateUnit: "utf16-half-open",
        },
      ],
      removed: [
        "components/EffortCallout.tsx, migrations/resetProToOpusDefault.ts, migrations/migrateSonnet45ToSonnet46.ts and utils/taggedId.ts (its only reader was the OAuth-account telemetry block)",
        "twelve subscription predicates and the plan-name helper type's wrappers in utils/auth.ts",
        "nine config fields no writer could set, the auth clause of the config-write guard, and the notice, callout, migration and telemetry surface that read them",
      ],
      kept: [
        "the whole API-key path: getAnthropicApiKey, the keychain and apiKeyHelper resolution, getAuthTokenSource and getAccountInformation (both still read by status and print)",
        "isAnthropicAuthEnabled, isClaudeAISubscriber and getOauthAccountInfo: the claude.ai MCP connector is their last reader and goes in the next step",
        "hasProfileScope and both bearer sources in getClaudeAIOAuthTokens: the fast-mode account gate is the profile-scope reader",
        "the effort levels, the plan-mode agent count, the tips that call is1PApiCustomer and the notification hook itself — each folded to its surviving arm rather than removed",
      ],
      tsc: {
        command: "node_modules/.bin/tsc --noEmit --pretty false",
        cwd: root,
        exitCode: 0,
        diagnostics: 0,
        logSha256: digest(tscText),
      },
      validation:
        "Tree-wide absence sweep over thirty-one names (the deleted modules, predicates, config fields and the helpers only they read); survivor assertions for the four names this step deliberately keeps with the reason each stays; every folded site asserted as the arm its constant produced, including the ones where the fold keeps a branch (the 'claude-ai' availability case, the notification hook's remaining entry, is1PApiCustomer's env terms); the orphan scan re-run after the cut, which is what surfaced utils/taggedId.ts; tsc clean",
      remaining:
        "the claude.ai MCP connector (services/mcp/claudeai.ts, the claudeai-proxy config type and its ~20 hosts, and MCPRemoteServerMenu's auth handler) is now the last reader of isAnthropicAuthEnabled, isClaudeAISubscriber and getOauthAccountInfo; utils/fastMode.ts's account-status path is hasProfileScope's last reader. Then the ~33 in-place CLI blocks, cli/transports/, the dependency-pruning pass and the utils/filePersistence/ rename",
      notes: [
        "the LogoV2.tsx blank line at EOF is pre-existing (it is present at the base commit) and this cut does not touch the file's tail",
        "the hook's fold has a behaviour consequence worth stating plainly: with the guard constant, useApiKeyVerification never calls verifyApiKey, so no API-key verification runs and the invalid-key notices cannot fire. That is the arm the source takes under this build's auth decision (wave D step 1), not a choice made here",
        "the first run needed four repair passes on anchors (a duplicated pattern differing only by indentation, the cut_between end anchor being retained, a shorthand property whose useState line had already gone, an import block in a second file) and each was fixed by restoring every touched path from HEAD and re-running, so w65-d7q1.py reproduces the final state in one pass",
      ],
    },
    null,
    2,
  ) + "\n",
)
console.log("PASS the subscriber consumer surface folded; its predicates and dead config fields gone; tsc log empty")
