import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "755d79b"
const digest = text => createHash("sha256").update(text).digest("hex")

// utils/fastMode.ts's account-status path was a subscription probe: a GET of
// `${getOauthConfig().BASE_API_URL}/api/claude_code_penguin_mode` whose OAuth
// arm attached OAUTH_BETA_HEADER and whose gates read getClaudeAIOAuthTokens
// through hasProfileScope. The only two token producers this build keeps
// hardcode scopes ['user:inference'], so hasProfileScope was false and the
// OAuth arm could never run; the API-key arm still called a remote account
// endpoint. Under the local-only directive the probe, its cache substitute and
// the startup throttle go. The rejection path stays: the inference API remains
// the authority, and its 400 is handled locally.
function rg(pattern) {
  try {
    return execFileSync("rg", [
      "-n", "--glob", "!node_modules", "--glob", "!*.w*bak", "--glob", "!*.json", "--glob", "!*.md",
      "-e", pattern, root,
    ], {encoding: "utf8"}).trim()
  } catch (e) {
    assert.equal(e.status, 1, `rg failed: ${e.message}`)
    return ""
  }
}

const read = p => fs.readFileSync(`${root}/${p}`, "utf8")
const base = p => execFileSync("git", ["-C", root, "show", `${before}:${p}`], {encoding: "utf8"})

// 1. The base carried the probe this step removes.
const baseFast = base("utils/fastMode.ts")
for (const needle of [
  "claude_code_penguin_mode",
  "prefetchFastModeStatus",
  "resolveFastModeStatusFromCache",
  "hasProfileScope()",
  "handleOAuth401Error(failedAccessToken)",
  "OAUTH_BETA_HEADER",
  "CLAUDE_CODE_SKIP_FAST_MODE_NETWORK_ERRORS",
  "penguinModeOrgEnabled",
]) {
  assert.ok(baseFast.includes(needle), `base fastMode carried ${needle}`)
}
const baseAuth = base("utils/auth.ts")
assert.ok(baseAuth.includes("export function hasProfileScope(): boolean {"))
assert.ok(baseAuth.includes("export function handleOAuth401Error("))

// 2. The probe family is gone tree-wide.
assert.equal(
  rg("fetchFastModeStatus|FastModeResponse|prefetchFastModeStatus|resolveFastModeStatusFromCache|FastModeOrgStatus|FastModeDisabledReason|getDisabledReasonMessage|PREFETCH_MIN_INTERVAL_MS|inflightPrefetch|lastPrefetchAt"),
  "",
  "a name owned by the account-status probe remains",
)
assert.equal(
  rg("claude_code_penguin_mode|penguinModeOrgEnabled|tengu_org_penguin_mode_fetch_failed|CLAUDE_CODE_SKIP_FAST_MODE_NETWORK_ERRORS|startupPrefetchedAt|tengu_cicada_nap_ms|tengu_miraculo_the_bard"),
  "",
  "a remote account-status artifact remains",
)
// The predicates whose last reader the probe was, and the header only it read.
assert.equal(
  rg("hasProfileScope|handleOAuth401Error|OAUTH_BETA_HEADER"),
  "",
  "a predicate the probe kept alive remains",
)

// 3. The local fast-mode surface stays, with the rejection path folded.
const fast = read("utils/fastMode.ts")
for (const keep of [
  "export function isFastModeEnabled(): boolean {",
  "export function isFastModeAvailable(): boolean {",
  "export function getFastModeUnavailableReason(): string | null {",
  "export function isFastModeSupportedByModel(",
  "export function getInitialFastModeSetting(",
  "export function triggerFastModeCooldown(",
  "export function handleFastModeRejectedByAPI(): void {",
  "export const onOrgFastModeChanged = orgFastModeChange.subscribe",
  "const orgFastModeChange = createSignal()",
  "'tengu_penguins_off'",
  "'tengu_marble_sandcastle'",
  "getAPIProvider() !== 'firstParty'",
]) {
  assert.ok(fast.includes(keep), `local fast-mode surface lost: ${keep}`)
}
assert.match(fast, /\/\/ Set when the API rejects a fast mode request for this account\. The server is\n\/\/ the only authority this build consults; no status probe runs\.\nlet orgFastModeDisabled = false\n/)
assert.match(
  fast,
  /  if \(orgFastModeDisabled\) \{\n    const reason = 'Fast mode has been disabled by your organization'\n    logForDebugging\(`Fast mode unavailable: \$\{reason\}`\)\n    return reason\n  \}\n\n  return null\n\}\n/,
)
assert.match(
  fast,
  /  orgFastModeDisabled = true\n  updateSettingsForSource\('userSettings', \{ fastMode: undefined \}\)\n  orgFastModeChange\.emit\(\)\n/,
)
assert.doesNotMatch(fast, /axios|BASE_API_URL|x-api-key|accessToken|isEssentialTrafficOnly/)

// 4. Every host as the arm the absent probe left.
const main = read("main.tsx")
assert.doesNotMatch(main, /prefetchFastModeStatus|resolveFastModeStatusFromCache|startupPrefetchedAt|tengu_cicada_nap_ms|tengu_miraculo_the_bard/)
assert.ok(
  main.includes("      if (!isNonInteractiveSession) {\n        void refreshExampleCommands()"),
  "the settings-dialog block is followed directly by the example-command prefetch",
)
assert.ok(main.includes("fastMode: getInitialFastModeSetting("), "the local initial-setting read stays")

const cmd = read("commands/fast/fast.tsx")
assert.doesNotMatch(cmd, /prefetchFastModeStatus/)
assert.ok(
  cmd.includes("  const arg = args?.trim().toLowerCase()\n"),
  "the /fast command goes straight from the enabled guard to its argument",
)

const hook = read("hooks/notifs/useFastModeNotification.tsx")
assert.match(hook, /return onOrgFastModeChanged\(\(\) => \{\n      if \(isFastMode\) \{/)
assert.doesNotMatch(hook, /\/fast to turn on/)

assert.match(read("services/api/withRetry.ts"), /handleFastModeRejectedByAPI\(\)/)
assert.match(read("services/api/claude.ts"), /isFastModeAvailable\(\)/)

// 5. The bearer/API-key surface survives; the two predicates do not.
const auth = read("utils/auth.ts")
assert.match(auth, /export const getClaudeAIOAuthTokens = memoize/)
assert.match(auth, /export function getAccountInformation\(\) \{/)
assert.match(auth, /export function getAuthTokenSource\(\)/)
assert.doesNotMatch(auth, /CLAUDE_AI_PROFILE_SCOPE/)

const oauth = read("constants/oauth.ts")
assert.match(oauth, /export function getOauthConfig\(\): OauthConfig \{/)
assert.match(oauth, /export const CLAUDE_AI_PROFILE_SCOPE = 'user:profile' as const/)
assert.doesNotMatch(oauth, /OAUTH_BETA_HEADER/)

const config = read("utils/config.ts")
assert.doesNotMatch(config, /penguinModeOrgEnabled|startupPrefetchedAt/)

// 6. The gate.
const tscText = fs.readFileSync(new URL("w65-d7s-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const files = [
  "utils/fastMode.ts",
  "utils/auth.ts",
  "constants/oauth.ts",
  "utils/config.ts",
  "main.tsx",
  "commands/fast/fast.tsx",
  "hooks/notifs/useFastModeNotification.tsx",
]
const digests = {}
for (const f of files) {
  digests[f] = digest(base(f))
}

const probeStart = baseFast.indexOf("type FastModeResponse = {")
const orgStart = baseFast.indexOf("// Disabled reason returned by the API.")
const authStart = baseAuth.indexOf('/**\n * Handle a 401 "OAuth token has expired" error from the API.')
const authEnd = baseAuth.indexOf("export function is1PApiCustomer(): boolean {")

fs.writeFileSync(
  new URL("w65-d7s-source-evidence.json", import.meta.url),
  JSON.stringify(
    {
      before,
      kind: "remote account-status probe removed (no ported bodies; the removed code was a network fetch and its cache substitute)",
      surface:
        "utils/fastMode.ts's GET of `${getOauthConfig().BASE_API_URL}/api/claude_code_penguin_mode` with an OAuth bearer + OAUTH_BETA_HEADER or an x-api-key, its auth selection through getClaudeAIOAuthTokens/hasProfileScope, the 401 retry through handleOAuth401Error, the cache-resolution substitute, the 30s prefetch throttle, the startup kill switch and startupPrefetchedAt bookkeeping, and the org-status reason table",
      decisiveFact:
        "the OAuth arm could never run: both token producers this build keeps hardcode scopes ['user:inference'], so hasProfileScope() was constant false (the fact its own deleted comment recorded). The surviving arm posted a remote account endpoint whose answer only the server can give, so under the local-only directive the client-side probe goes; the inference API's own rejection (handleFastModeRejectedByAPI) remains the authority and is handled locally",
      sourceRanges: {
        "utils/fastMode.ts": {
          sha256: digests["utils/fastMode.ts"],
          statusReasonTable: [orgStart, probeStart],
          probeAndPrefetch: [probeStart, baseFast.length],
          coordinateUnit: "utf16-half-open",
        },
        "utils/auth.ts": {
          sha256: digests["utils/auth.ts"],
          deletedPredicates: [authStart, authEnd],
          coordinateUnit: "utf16-half-open",
        },
      },
      changes: [
        {
          file: "utils/fastMode.ts",
          change:
            "fetchFastModeStatus, prefetchFastModeStatus, resolveFastModeStatusFromCache, the FastModeResponse/FastModeOrgStatus/FastModeDisabledReason model, the reason-message table, the 30s throttle and the auth selection are deleted; getFastModeUnavailableReason drops the orgStatus arm and folds the rejection to an in-session flag; handleFastModeRejectedByAPI sets that flag, clears the persisted preference and emits the payloadless signal; orgFastModeChange loses its boolean payload. The local flags (tengu_penguins_off, tengu_marble_sandcastle), the SDK/provider checks, cooldown and the model predicates are untouched",
          sourceSha256: digests["utils/fastMode.ts"],
          portSha256: digest(fast),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/auth.ts",
          change:
            "handleOAuth401Error and hasProfileScope are deleted — the fast-mode account-status path was the last reader of both — and the CLAUDE_AI_PROFILE_SCOPE import goes with them. getClaudeAIOAuthTokens with both producers, getAuthTokenSource, getAccountInformation, the API-key surface and the SubscriptionType-typed token field stay",
          sourceSha256: digests["utils/auth.ts"],
          portSha256: digest(auth),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "constants/oauth.ts",
          change:
            "OAUTH_BETA_HEADER leaves; the probe was its only reader. The scope constants, the authorize URLs and getOauthConfig stay",
          sourceSha256: digests["constants/oauth.ts"],
          portSha256: digest(oauth),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/config.ts",
          change:
            "penguinModeOrgEnabled and startupPrefetchedAt leave the global config; the probe and its startup throttle were their only writer and reader",
          sourceSha256: digests["utils/config.ts"],
          portSha256: digest(config),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "main.tsx",
          change:
            "the startup prefetch block (throttle, kill switch, cache resolution, startupPrefetchedAt write, both log lines) is deleted together with the two fastMode imports and the growthbook import only it used; the settings-dialog block is followed directly by the example-command prefetch",
          sourceSha256: digests["main.tsx"],
          portSha256: digest(main),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "commands/fast/fast.tsx",
          change:
            "the pre-picker prefetch call and its comment are deleted; the local enabled guard, the unavailable-reason read and the toggle path stay",
          sourceSha256: digests["commands/fast/fast.tsx"],
          portSha256: digest(cmd),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "hooks/notifs/useFastModeNotification.tsx",
          change:
            "the org-status effect loses the orgEnabled=true arm (no probe can report re-enablement) and subscribes to the payloadless signal; the API-rejection notification and the cooldown notifications stay",
          sourceSha256: digests["hooks/notifs/useFastModeNotification.tsx"],
          portSha256: digest(hook),
          coordinateUnit: "utf16-half-open",
        },
      ],
      removed: [
        "utils/fastMode.ts's /api/claude_code_penguin_mode fetch, its OAuth bearer + anthropic-beta header, the 30s prefetch throttle and the startup kill switch",
        "resolveFastModeStatusFromCache, the startupPrefetchedAt write and the penguinModeOrgEnabled cache",
        "the org-status discriminated union, the API-reason table and the network-error bypass env",
        "handleOAuth401Error and hasProfileScope (their last reader)",
        "OAUTH_BETA_HEADER, penguinModeOrgEnabled and startupPrefetchedAt",
        "the hook's now-impossible re-enablement branch",
      ],
      kept: [
        "the whole local fast-mode surface: isFastModeEnabled, isFastModeAvailable, getFastModeUnavailableReason's local checks, the cooldown state machine and signals, getFastModeState, the model-support and initial-setting predicates, the /fast command and the picker",
        "handleFastModeRejectedByAPI as the server-feedback arm, now in-session only: it clears the persisted preference and emits the payloadless signal, which the notification hook consumes",
        "the bearer/API-key surface in utils/auth.ts: getClaudeAIOAuthTokens with both producers, getAuthTokenSource, getAccountInformation and the API-key helpers",
        "getOauthConfig and the scope constants in constants/oauth.ts",
      ],
      tsc: {
        command: "node_modules/.bin/tsc --noEmit --pretty false",
        cwd: root,
        exitCode: 0,
        diagnostics: 0,
        logSha256: digest(tscText),
      },
      validation:
        "Tree-wide absence sweep over the probe family (fetch/prefetch/resolve/cache names, the endpoint, the reason table, the env bypass, the throttles, the endpoint's analytics event), over the three config/header artifacts and over the two auth predicates whose last reader the probe was; survivor assertions for the local fast-mode surface with the folded rejection body, the payloadless signal and its hook arm; every host asserted as the arm the absent probe left (the direct settings-dialog→example-command seam, the /fast argument path, the retained withRetry call and the claude.ts availability reads); tsc clean",
      remaining:
        "the ~33 in-place CLI blocks, cli/transports/, the dependency-pruning pass (nine zero-importer dependencies) and the utils/filePersistence/ rename",
      notes: [
        "the OAuth arm of the deleted probe was dead on the same scope fact step 7r recorded: both token producers hardcode ['user:inference']. The surviving API-key arm was a remote subscription/account lookup, which the local-only directive removes",
        "one repair pass in w65-d7s1.py: the first cut_between kept the end anchor and the replacement re-declared the signal, so tsc reported four TS2451s; the script now deletes up to the old signal and rewrites it in a separate cut, and the tree was restored from HEAD before the replay that produced this state",
        "the org-rejection memory is now session-scoped. The persisted preference is still cleared on rejection, so a restart starts with fast mode off; the source's cross-session disabled state came from the deleted cache and its probe",
      ],
    },
    null,
    2,
  ) + "\n",
)
console.log("PASS account-status probe gone; local fast-mode surface intact; last-reader predicates deleted; tsc log empty")
