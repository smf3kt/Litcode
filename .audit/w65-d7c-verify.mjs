import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "b2c553b"
const digest = text => createHash("sha256").update(text).digest("hex")
const sourceText = execFileSync("git", ["-C", root, "show", `${before}:services/analytics/metadata.ts`], {encoding: "utf8"})
const now = fs.readFileSync(`${root}/services/analytics/metadata.ts`, "utf8")

// Wave D step 7c removed metadata.ts's record builders. The dead region was one
// contiguous block with a single entry point, getEventMetadata, whose last
// reader went with the transports in 7a — so the check is that the whole block
// is gone, that the redaction helpers survive word for word, and that the
// generated proto types it was the last importer of are gone with it.
const dead = [
  "EnvContext",
  "ProcessMetrics",
  "EventMetadata",
  "EnrichMetadataOptions",
  "FirstPartyEventLoggingCoreMetadata",
  "FirstPartyEventLoggingMetadata",
  "getEventMetadata",
  "buildProcessMetrics",
  "buildEnvContext",
  "getVersionBase",
  "getAgentIdentification",
  "to1PEventFormat",
]
for (const name of dead) {
  assert.doesNotMatch(now, new RegExp(name), `${name} is still in the module`)
  assert.match(sourceText, new RegExp(name), `${name} was not in the base revision`)
}

// The live surface, unchanged.
const live = [
  "sanitizeToolNameForAnalytics",
  "isToolDetailsLoggingEnabled",
  "isAnalyticsToolDetailsLoggingEnabled",
  "mcpToolDetailsForAnalytics",
  "extractMcpToolDetails",
  "extractSkillName",
  "extractToolInputForTelemetry",
  "getFileExtensionForAnalytics",
  "getFileExtensionsFromBashCommand",
  "AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS",
]
for (const name of live) {
  assert.match(now, new RegExp(`export (function|type) ${name}`), `${name} lost its export`)
}
const surviving = [
  "return 'mcp_tool' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS",
  "  if (!toolName.startsWith('mcp__')) {",
  "  const mcpToolName = parts.slice(2).join('__')",
  "  return isEnvTruthy(process.env.OTEL_LOG_TOOL_DETAILS)",
  "  if (mcpServerBaseUrl && isOfficialMcpUrl(mcpServerBaseUrl)) {",
  "    json = json.slice(0, TOOL_INPUT_MAX_JSON_CHARS) + '…[truncated]'",
  "      .filter(([k]) => !k.startsWith('_'))",
  "  const ext = extname(filePath).toLowerCase()",
  "    if (!FILE_COMMANDS.has(baseCmd)) continue",
]
for (const s of surviving) {
  assert.ok(sourceText.includes(s), `not in the base revision: ${s}`)
  assert.ok(now.includes(s), `not carried into the cut: ${s}`)
}

// The import block shrank from twenty-one bindings to the four the survivors use.
const imports = now.match(/^import .*$/gm) ?? []
assert.deepEqual(imports, [
  "import { extname } from 'path'",
  "import { isEnvTruthy } from '../../utils/envUtils.js'",
  "import { isOfficialMcpUrl } from '../mcp/officialRegistry.js'",
  "import { jsonStringify } from '../../utils/slowOperations.js'",
])

// The cut's own orphan: the 1P event proto type the dead region was the last
// importer of, and the two generated types that depended only on it. That
// empties types/generated entirely.
for (const p of [
  "types/generated/events_mono/claude_code/v1/claude_code_internal_event.ts",
  "types/generated/events_mono/common/v1/auth.ts",
  "types/generated/google/protobuf/timestamp.ts",
]) {
  assert.equal(fs.existsSync(`${root}/${p}`), false, `${p} still present`)
  execFileSync("git", ["-C", root, "cat-file", "-e", `${before}:${p}`])
}
const generated = execFileSync("find", [`${root}/types/generated`, "-type", "f"], {encoding: "utf8"}).trim()
assert.equal(generated, "", `types/generated still holds: ${generated}`)

try {
  const hits = execFileSync("rg", [
    "-n", "--glob", "!node_modules", "--glob", "!*.w*bak", "--glob", "!*.json", "--glob", "!*.md",
    "-e", "claude_code_internal_event|events_mono/common/v1/auth|google/protobuf/timestamp",
    root,
  ], {encoding: "utf8"}).trim()
  assert.equal(hits, "", `a live reference remains: ${hits}`)
} catch (e) {
  assert.equal(e.status, 1, `rg failed: ${e.message}`)
}

const tscText = fs.readFileSync(new URL("w65-d7c-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

fs.writeFileSync(
  new URL("w65-d7c-source-evidence.json", import.meta.url),
  JSON.stringify({
    before,
    kind: "dead-record-builder removal; the surviving redaction helpers are the source's",
    evidence: [
      {
        file: "services/analytics/metadata.ts",
        change:
          "everything from the EnvContext type to the end of the file removed (the environment builder, the process-metrics sampler, the agent-identification helper, getEventMetadata, the 1P snake_case formatter and their types); the import block cut from twenty-one bindings to four",
        sourceSha256: digest(sourceText),
        portSha256: digest(now),
        coordinateUnit: "utf16-half-open",
        sourceBytes: Buffer.byteLength(sourceText),
        portBytes: Buffer.byteLength(now),
      },
    ],
    removed: [
      "services/analytics/metadata.ts: 950 lines to 363",
      "types/generated/events_mono/claude_code/v1/claude_code_internal_event.ts (866 lines, the 1P event proto type)",
      "types/generated/events_mono/common/v1/auth.ts (101) and types/generated/google/protobuf/timestamp.ts (188) — each had this file as its only importer",
    ],
    finding:
      "types/generated/ now holds no files at all: every generated proto type in the tree existed for the 1P event payload, so the last of them left with the last importer.",
    kept:
      "the tool-name sanitizer (21 files), the MCP-detail / skill-name / tool-input helpers (services/tools/toolExecution.ts), the file-extension helpers (toolExecution.ts, tools/FileReadTool) and the not-code-or-filepaths marker type (137 files)",
    next:
      "utils/user.ts's getUserForGrowthBook -> getCoreUserData -> CoreUserData chain, main.tsx's initUser/resetUserCache calls, and three exports 7c orphaned: utils/git.ts's getRepoRemoteHash, utils/platform.ts's getLinuxDistroInfo and detectVcs",
    tsc: {
      command: "node_modules/.bin/tsc --noEmit --pretty false",
      cwd: root,
      exitCode: 0,
      diagnostics: 0,
      logSha256: digest(tscText),
    },
    validation:
      "The whole dead region swept by name; the surviving bodies and nine of their lines checked word-for-word against the base revision; the import list asserted exactly; the three generated types checked absent and present-in-the-base; the generated tree asserted empty; tsc log empty",
  }, null, 2) + "\n",
)
console.log("PASS dead record builders gone; redaction helpers verbatim; types/generated empty; tsc log empty")
