import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import ts from '/tmp/w47-tools/node_modules/typescript/lib/typescript.js'

const root = '/Users/mant1ssa/Projects/cc-base-2188'
const log = process.argv[2]
const apply = process.argv.includes('--apply')
const cfg = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, root)
const program = ts.createProgram(parsed.fileNames, parsed.options)
const checker = program.getTypeChecker()
const wanted = new Set([...fs.readFileSync(log, 'utf8').matchAll(/^(.+?)\(\d+,\d+\): error TS2339:/gm)]
  .map(m => path.resolve(root, m[1])))
const hash = s => crypto.createHash('sha256').update(s).digest('hex')
const rows = []

function booleanContext(n) {
  const p = n.parent
  if (!p) return false
  if (ts.isParenthesizedExpression(p)) return booleanContext(p)
  if ((ts.isIfStatement(p) || ts.isWhileStatement(p) || ts.isDoStatement(p)) && p.expression === n) return true
  if (ts.isConditionalExpression(p) && p.condition === n) return true
  if (ts.isBinaryExpression(p) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken].includes(p.operatorToken.kind)) return booleanContext(p)
  return false
}

for (const sf of program.getSourceFiles()) {
  if (!wanted.has(sf.fileName)) continue
  const edits = []
  function visit(n) {
    if (ts.isPropertyAccessExpression(n)) {
      const owner = checker.getTypeAtLocation(n.expression)
      const prop = checker.getTypeAtLocation(n)
      if (owner.isUnion() && (prop.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral | ts.TypeFlags.Union))) {
        const members = owner.types
        const propertyTypes = members.map(t => {
          const s = checker.getPropertyOfType(t, n.name.text)
          return s && checker.getTypeOfSymbolAtLocation(s, n)
        })
        const booleanish = t => t && (t.isUnion() ? t.types.every(booleanish) : !!(t.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral | ts.TypeFlags.Undefined | ts.TypeFlags.Null)))
        if (members.length > 1 && propertyTypes.every(booleanish)) {
          const negated = ts.isPrefixUnaryExpression(n.parent) && n.parent.operator === ts.SyntaxKind.ExclamationToken
          const target = negated ? n.parent : n
          if (booleanContext(target)) {
            const before = target.getText(sf)
            const after = `${n.getText(sf)} ${negated ? '!==' : '==='} true`
            const line = sf.getLineAndCharacterOfPosition(target.getStart(sf)).line + 1
            edits.push({ start: target.getStart(sf), end: target.end, before, after, line,
              domain: propertyTypes.map(t => checker.typeToString(t)),
              context: sf.text.split('\n').slice(Math.max(0, line - 3), line + 3).join('\n') })
          }
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (!edits.length) continue
  let out = sf.text
  for (const e of edits.toSorted((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.after + out.slice(e.end)
  const check = ts.createSourceFile(sf.fileName, out, ts.ScriptTarget.Latest, true)
  if (check.parseDiagnostics.length) throw new Error(`Parse failure: ${sf.fileName}`)
  const file = path.relative(root, sf.fileName)
  rows.push({file, sha256: hash(sf.text), output_sha256: hash(out), coordinates: 'utf16', edits})
  for (const e of edits) console.log(`${file}:${e.line} ${e.before} -> ${e.after} [${e.domain.join(' | ')}]\n${e.context}\n`)
  if (apply) fs.writeFileSync(sf.fileName, out)
}
const evidence = JSON.stringify({root, compiler: ts.version, rows}, null, 2) + '\n'
// Preserve the first migration evidence across dry runs and already-applied runs.
const evidencePath = new URL('./w58-boolean-evidence.json', import.meta.url)
if (rows.length && !fs.existsSync(evidencePath)) fs.writeFileSync(evidencePath, evidence, {flag: 'wx'})
else console.log('Original migration evidence preserved; current proposals are printed above.')
console.log(`${rows.length} files, ${rows.reduce((n, r) => n + r.edits.length, 0)} comparisons; ${apply ? 'applied' : 'dry run'}`)
