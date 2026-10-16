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

// Minimal stand-ins for the two host helpers the shimmer split depends on.
const stringWidth = text => Array.from(text).length
const getGraphemeSegmenter = () => ({
  segment: text => Array.from(text, segment => ({segment})),
})

const cases = [
  // W65 wave E step 5 ports — cite the recovered body each one came from.
  {
    port: "constants/product.ts",
    symbol: "toCompatSessionId",
    source: "bridge/sessionIdCompat.ts",
    scope: {},
    probe: ["cse_0123456789abcdef", "session_0123456789abcdef", "plain-uuid"],
    // The kill switch's only registrant (setCseShimGate) was bridge init, so
    // the port drops the gate; the shim's own default is active, which is
    // what `_isCseShimEnabled` being unset already produced.
    adapt: {removed: "  if (_isCseShimEnabled && !_isCseShimEnabled()) return id\n"},
  },
  {
    port: "components/Spinner.tsx",
    symbol: "computeGlimmerIndex",
    source: "bridge/bridgeStatusUtil.ts",
    scope: {},
    probe: [0, 1, 7, 19, 20, 21, 100],
    probeAs: fn => tick => [tick, 12],
  },
  {
    port: "components/Spinner.tsx",
    symbol: "computeShimmerSegments",
    source: "bridge/bridgeStatusUtil.ts",
    scope: {stringWidth, getGraphemeSegmenter},
    probe: [
      ["Thinking", -100],
      ["Thinking", -1],
      ["Thinking", 0],
      ["Thinking", 1],
      ["Thinking", 4],
      ["Thinking", 8],
      ["Thinking", 20],
      ["ab", 0],
    ],
  },
]

// A synthetic session-ingress JWT: sk-ant-si- prefix + three base64url segments.
const jwtPayload = Buffer.from(JSON.stringify({exp: 1893456000, sub: "s"})).toString("base64url")
const token = `sk-ant-si-${Buffer.from(JSON.stringify({alg: "HS256"})).toString("base64url")}.${jwtPayload}.sig`
cases.push({
  port: "cli/transports/ccrClient.ts",
  symbol: "decodeJwtExpiry",
  source: "bridge/jwtUtils.ts",
  scope: {jsonParse: JSON.parse, Buffer},
  probe: [token, "not-a-jwt", `sk-ant-si-a.b.c`, "a.b.c"],
  // decodeJwtExpiry is a thin wrapper over this sibling in both copies.
  also: "decodeJwtPayload",
})

const evidence = []
for (const entry of cases) {
  const changed = fs.readFileSync(`${root}/${entry.port}`, "utf8")
  const recovered = execFileSync("git", ["-C", root, "show", `${original}:${entry.source}`], {
    encoding: "utf8",
  })
  const a = declared(recovered, entry.source, entry.symbol)
  const b = declared(changed, entry.port, entry.symbol)
  // Whitespace- and trailing-comma-insensitive: the ported bodies were
  // reflowed by the formatter, which changes token spacing only.
  const flat = text =>
    text
      .replace(/^export /gm, "")
      .replace(/\s+/g, "")
      .replace(/,([)\]}:])/g, "$1")
  const expected = entry.adapt ? a.text.replace(entry.adapt.removed, "") : a.text
  assert.equal(flat(b.text), flat(expected), `${entry.symbol} body differs from ${entry.source}`)
  const recoveredScope = {...entry.scope, _isCseShimEnabled: undefined}
  const prefixA = entry.also ? declared(recovered, entry.source, entry.also).text + "\n" : ""
  const prefixB = entry.also ? declared(changed, entry.port, entry.also).text + "\n" : ""
  const oldFn = run(prefixA + a.text, entry.symbol, recoveredScope)
  const newFn = run(prefixB + b.text, entry.symbol, entry.scope)
  for (const probe of entry.probe) {
    const args = entry.probeAs ? entry.probeAs(newFn)(probe) : Array.isArray(probe) ? probe : [probe]
    // vm contexts have separate Object prototypes, so compare serialized form.
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
    mode: entry.adapt ? "adapt" : "port",
    difference: entry.adapt
      ? "Kill-switch gate dropped: its only registrant was bridge init; the unset default is unchanged."
      : "None — body and behaviour identical.",
    probes: entry.probe.length,
  })
}

// The deleted corpus and every bridge host import must be gone from the tree.
// Bound to the wave's own commit, not HEAD, so the check stays true as later
// waves land on top.
const WAVE = "88545db"
const deleted = execFileSync("git", ["-C", root, "diff", "--name-only", "--diff-filter=D", `${WAVE}^`, WAVE], {
  encoding: "utf8",
}).trim().split("\n").filter(Boolean)
assert.ok(deleted.some(p => p === "bridge/replBridge.ts"), "bridge corpus deleted")
// rg exits 1 for no matches, which is the pass case here; exit 2 is an error.
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
  "from ['\"][^'\"]*bridge/",
  "require\\(['\"][^'\"]*bridge/",
  "import\\(['\"][^'\"]*bridge/",
]) {
  assert.equal(rg(pattern), "", `live bridge imports remain for ${pattern}`)
}
const residue = rg("bridge/")

const tscText = fs.readFileSync(new URL("w65-e5-tsc-final.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")
fs.writeFileSync(
  new URL("w65-e5-source-evidence.json", import.meta.url),
  JSON.stringify({
    original,
    deletedFiles: deleted.length,
    evidence,
    tsc: {
      command: "node_modules/.bin/tsc --noEmit --pretty false",
      cwd: root,
      exitCode: 0,
      diagnostics: 0,
      logSha256: digest(tscText),
    },
    validation:
      "Ported bodies compared textually and behaviourally against the recovered source; deleted-file inventory and live-import sweep bound the removal",
    remaining:
      "replBridge* AppState fields, cli/transports and the session-ingress bearer surface remain for later waves",
  }, null, 2) + "\n",
)
console.log(`PASS ${evidence.length} ports match recovered bodies; ${deleted.length} files deleted; no live bridge imports; tsc log empty`)
