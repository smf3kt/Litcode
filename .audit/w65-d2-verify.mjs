import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"
import ts from "/tmp/w47-tools/node_modules/typescript/lib/typescript.js"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const original = "bd958088195aefbb4bce96ba966447e5e09b1312"
const digest = text => createHash("sha256").update(text).digest("hex")

function declared(text, path, name) {
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const node = sf.statements.find(n =>
    ts.isFunctionDeclaration(n)
      ? n.name?.text === name
      : ts.isVariableStatement(n) &&
        n.declarationList.declarations.some(d => d.name.getText(sf) === name))
  assert.ok(node, `${path}:${name}`)
  return {text: node.getText(sf), range: [node.getStart(sf), node.end]}
}

function run(body, name, scope) {
  const context = {exports: {}, ...scope}
  const js = ts.transpile(body, {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022})
  return vm.runInNewContext(`${js}; ${name}`, context)
}

const cases = [
  {
    port: "utils/auth.ts",
    symbol: "shouldUseClaudeAIAuth",
    source: "services/oauth/client.ts",
    scope: {CLAUDE_AI_INFERENCE_SCOPE: "user:inference"},
    probe: [["user:inference"], ["user:profile"], []],
    probeAs: () => scopes => [scopes],
  },
  {
    port: "utils/auth.ts",
    symbol: "isOAuthTokenExpired",
    source: "services/oauth/client.ts",
    scope: {Date},
    // null never expires; everything inside the 5-minute buffer does.
    probe: [null, 0, 1, 299_999, 300_000, 600_000],
    probeAs: fn => value => [value === null ? null : fn === null ? null : 1_700_000_000_000 + value],
    clock: 1_700_000_000_000,
  },
]

const evidence = []
for (const entry of cases) {
  const changed = fs.readFileSync(`${root}/${entry.port}`, "utf8")
  const recovered = execFileSync("git", ["-C", root, "show", `${original}:${entry.source}`], {
    encoding: "utf8",
  })
  const a = declared(recovered, entry.source, entry.symbol)
  const b = declared(changed, entry.port, entry.symbol)
  // Whitespace- and trailing-comma-insensitive: the formatter reflowed the port.
  const flat = text =>
    text.replace(/^export /gm, "").replace(/\s+/g, "").replace(/,([)\]}:])/g, "$1")
  assert.equal(flat(b.text), flat(a.text), `${entry.symbol} body differs from ${entry.source}`)

  const RealDate = Date
  const scope = {...entry.scope, _isCseShimEnabled: undefined}
  if (entry.clock) {
    scope.Date = class extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : [entry.clock]))
      }
      static now() {
        return entry.clock
      }
    }
  }
  const oldFn = run(a.text, entry.symbol, scope)
  const newFn = run(b.text, entry.symbol, scope)
  for (const probe of entry.probe) {
    const args = entry.probeAs ? entry.probeAs(newFn)(probe) : Array.isArray(probe) ? probe : [probe]
    assert.equal(
      JSON.stringify(newFn(...args)),
      JSON.stringify(oldFn(...args)),
      `${entry.symbol}(${JSON.stringify(args)})`,
    )
  }
  evidence.push({
    port: entry.port,
    symbol: entry.symbol,
    source: entry.source,
    sourceSha256: digest(recovered),
    sourceRange: a.range,
    portSha256: digest(changed),
    portRange: b.range,
    coordinateUnit: "utf16-half-open",
    mode: "port",
    difference: "None — body and behaviour identical.",
    probes: entry.probe.length,
  })
}

// The removed module and its UI must be absent, and no live import may name
// them anywhere in the tree.
for (const gone of [
  "services/oauth",
  "components/ConsoleOAuthFlow.tsx",
]) {
  assert.equal(fs.existsSync(`${root}/${gone}`), false, `${gone} still present`)
}
function rg(pattern) {
  try {
    return execFileSync("rg", [
      "-n",
      "--glob", "!node_modules",
      "--glob", "!*.w*bak",
      "--glob", "!*.json",
      "--glob", "!*.md",
      "-e", pattern,
      root,
    ], {encoding: "utf8"}).trim()
  } catch (e) {
    assert.equal(e.status, 1, `rg failed: ${e.message}`)
    return ""
  }
}
for (const pattern of [
  "from ['\"][^'\"]*services/oauth/",
  "from ['\"][^'\"]*\\.\\./oauth/",
  "require\\(['\"][^'\"]*services/oauth/",
  "import\\(['\"][^'\"]*services/oauth/",
  "ConsoleOAuthFlow",
  "setupTokenHandler",
  "populateOAuthAccountInfoIfNeeded",
]) {
  assert.equal(rg(pattern), "", `live reference remains for ${pattern}`)
}

const tscText = fs.readFileSync(new URL("w65-d2-tsc-final.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")
fs.writeFileSync(
  new URL("w65-d2-source-evidence.json", import.meta.url),
  JSON.stringify({
    original,
    evidence,
    removed: ["services/oauth/ (6 files)", "components/ConsoleOAuthFlow.tsx", "claude setup-token"],
    tsc: {
      command: "node_modules/.bin/tsc --noEmit --pretty false",
      cwd: root,
      exitCode: 0,
      diagnostics: 0,
      logSha256: digest(tscText),
    },
    validation:
      "Ported bodies compared textually and behaviourally against the recovered source; absence and no-live-import sweeps bound the removal",
    remaining:
      "oauthAccount config field, the subscription predicates and their 22-file reading set, the token consumers (voice, MCP claude.ai, analytics exporter, feedback, fastMode, http)",
  }, null, 2) + "\n",
)
console.log(`PASS ${evidence.length} ports match recovered bodies; oauth module absent; no live oauth imports; tsc log empty`)
