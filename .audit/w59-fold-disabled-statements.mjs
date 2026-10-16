import fs from "node:fs"
import crypto from "node:crypto"
import {execFileSync} from "node:child_process"
import ts from "/tmp/w47-tools/node_modules/typescript/lib/typescript.js"
const root = "/Users/mant1ssa/Projects/cc-base-2188"
const hash = text => crypto.createHash("sha256").update(text).digest("hex")
const shim = fs.readFileSync(`${root}/shims/bun-bundle.ts`, "utf8")
if (!shim.includes("const enabled = new Set<string>([]);")) throw Error("Feature contract changed")
const files = ["setup.ts", "utils/sessionRestore.ts", "services/compact/postCompactCleanup.ts"]
const rows = []
for (const file of files) {
  const original = execFileSync("git", ["-C", root, "show", `bd958088195aefbb4bce96ba966447e5e09b1312:${file}`], {encoding:"utf8"})
  const text = fs.readFileSync(`${root}/${file}`, "utf8")
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const source = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true)
  const sourceBodies = []
  function collect(n) {
    if (ts.isIfStatement(n) && ts.isCallExpression(n.expression) && n.expression.expression.getText(source) === "feature" && ts.isStringLiteral(n.expression.arguments[0]) && n.expression.arguments[0].text === "CONTEXT_COLLAPSE") sourceBodies.push(n)
    ts.forEachChild(n, collect)
  }
  collect(source)
  const edits = []
  function visit(n) {
    if (ts.isIfStatement(n) && !n.elseStatement && ts.isCallExpression(n.expression) && n.expression.expression.getText(sf) === "feature" && ts.isStringLiteral(n.expression.arguments[0]) && n.expression.arguments[0].text === "CONTEXT_COLLAPSE" && /null\./.test(n.thenStatement.getText(sf))) {
      const before = n.getText(sf)
      const body = sourceBodies[edits.length]
      if (!body || !body.getText(source).includes("contextCollapse/")) throw Error(`Original gate absent: ${file}`)
      edits.push({start:n.getStart(sf), end:n.end, originalStart:body.getStart(source), originalEnd:body.end, originalBody:body.getText(source), before, after:`// W59: disabled CONTEXT_COLLAPSE; original ${file} UTF-16 [${body.getStart(source)},${body.end}) in audit evidence.`})
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  let output = text
  for (const e of edits.toSorted((a,b)=>b.start-a.start)) output = output.slice(0,e.start)+e.after+output.slice(e.end)
  rows.push({file, source_commit:"bd958088195aefbb4bce96ba966447e5e09b1312", source_sha256:hash(original), input_sha256:hash(text), output_sha256:hash(output), coordinates:"utf16-half-open", edits})
  if (process.argv.includes("--apply")) fs.writeFileSync(`${root}/${file}`,output)
}
const evidence = {feature_shim_sha256:hash(shim),rows}
if (process.argv.includes("--apply")) fs.writeFileSync("/Users/mant1ssa/Projects/cc_reverse/.audit/w59-disabled-statements-evidence-v2.json",JSON.stringify(evidence,null,2)+"\n",{flag:"wx"})
console.log(JSON.stringify(evidence))
