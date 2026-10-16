import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import ts from "/tmp/w47-tools/node_modules/typescript/lib/typescript.js"
const root = "/Users/mant1ssa/Projects/cc-base-2188"
const log = fs.readFileSync(process.argv[2], "utf8")
const apply = process.argv.includes("--apply")
const hash = text => crypto.createHash("sha256").update(text).digest("hex")
const shim = fs.readFileSync(path.join(root, "shims/bun-bundle.ts"), "utf8")
if (!shim.includes("const enabled = new Set<string>([]);")) throw Error("Feature proof changed")
const rows = []
for (const file of new Set([...log.matchAll(/^(.+?)\(\d+,\d+\): error TS18050:/gm)].map(m => m[1]))) {
  const target = path.join(root, file)
  const text = fs.readFileSync(target, "utf8")
  const sf = ts.createSourceFile(target, text, ts.ScriptTarget.Latest, true)
  const edits = []
  function visit(n) {
    if (ts.isConditionalExpression(n) && ts.isCallExpression(n.condition) && n.condition.expression.getText(sf) === "feature" && n.condition.arguments.length === 1 && ts.isStringLiteral(n.condition.arguments[0]) && /^null\.\w+$/.test(n.whenTrue.getText(sf)) && n.whenFalse.kind === ts.SyntaxKind.NullKeyword) {
      edits.push({ start: n.getStart(sf), end: n.end, before: n.getText(sf), after: "null", flag: n.condition.arguments[0].text })
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (!edits.length) continue
  let output = text
  for (const e of edits.toSorted((a,b) => b.start-a.start)) output = output.slice(0,e.start)+e.after+output.slice(e.end)
  rows.push({ file, sha256: hash(text), output_sha256: hash(output), coordinates: "utf16-half-open", edits })
  if (apply) fs.writeFileSync(target, output)
}
const evidence = { feature_shim_sha256: hash(shim), rows }
const evidencePath = "/Users/mant1ssa/Projects/cc_reverse/.audit/w59-disabled-evidence.json"
if (apply && rows.length) fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2)+"\n", {flag:"wx"})
console.log(JSON.stringify({files:rows.length, edits:rows.reduce((n,r)=>n+r.edits.length,0), apply}))
