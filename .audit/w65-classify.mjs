import fs from 'node:fs'
import { execSync } from 'node:child_process'

// W65: classify a target set (account/subscription network surface) by whether
// local coding paths import it. Usage: node w65-classify.mjs targets.json
// targets.json = ["services/oauth/", "bridge/", ...] (paths relative to BASE).
//
// Reuses the W61 scanner's fixed resolver: relative and `src/`-aliased specs,
// extension variants tried last, .js core files included.

const BASE = '/Users/mant1ssa/Projects/cc-base-2188'
const targetFile = process.argv[2]
if (!targetFile) throw new Error('usage: node w65-classify.mjs <targets.json>')
const targets = JSON.parse(fs.readFileSync(targetFile, 'utf8'))

const relFiles = execSync(
  `rg --files -g '*.ts' -g '*.tsx' -g '*.js' -g '!node_modules' -g '!*.w*bak'`,
  { encoding: 'utf8', cwd: BASE },
)
  .trim()
  .split('\n')
const relSet = new Set(relFiles)

function modulesOf(p) {
  const abs = `${BASE}/${p.replace(/\/$/, '')}`
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    return relFiles.filter(f => f.startsWith(p.replace(/\/$/, '') + '/')).map(f => `${BASE}/${f}`)
  }
  if (fs.existsSync(abs)) return [abs]
  return []
}

const entries = targets.map(t => ({ target: t, modules: modulesOf(t) }))
const targetModules = new Set(entries.flatMap(e => e.modules))

function resolveImport(spec, fromFile) {
  let base = spec.replace(/\.mjs$/, '.ts')
  const ext = base.match(/\.(ts|tsx|js|jsx)$/)
  if (ext) base = base.slice(0, -ext[0].length)
  const parts = base.split('/')
  let joined
  if (spec.startsWith('.')) {
    const from = fromFile.split('/').slice(0, -1)
    for (const part of parts) {
      if (part === '.') continue
      else if (part === '..') from.pop()
      else from.push(part)
    }
    joined = from.join('/')
  } else if (spec.startsWith('src/')) {
    for (const tail of [parts.slice(1), parts]) {
      const cand = `${BASE}/${tail.join('/')}`.replace(`${BASE}/`, '')
      for (const e of ['.ts', '.tsx', '.js', '']) {
        if (relSet.has(`${cand}${e}`)) return `${BASE}/${cand}${e}`
      }
    }
    return null
  } else {
    return null
  }
  // `joined` is absolute here; relSet holds tree-relative paths
  const rel = joined.replace(`${BASE}/`, '')
  for (const e of ['.ts', '.tsx', '.js', '']) {
    if (relSet.has(`${rel}${e}`)) return `${BASE}/${rel}${e}`
  }
  return null
}

const importers = new Map()
for (const f of relFiles) {
  const abs = `${BASE}/${f}`
  if (targetModules.has(abs)) continue
  const text = fs.readFileSync(abs, 'utf8')
  const specs = [
    ...text.matchAll(/(?:from\s+|import\s*\(\s*|require\(\s*)['"]([^'"]+)['"]/g),
  ]
    .map(m => m[1])
    .filter(s => s.startsWith('.') || s.startsWith('src/'))
  for (const spec of new Set(specs)) {
    const r = resolveImport(spec, abs)
    if (r && targetModules.has(r)) {
      if (!importers.has(r)) importers.set(r, [])
      importers.get(r).push({ from: f, spec })
    }
  }
}

const rows = entries.map(e => {
  const outside = new Map()
  for (const m of e.modules) {
    for (const imp of importers.get(m) ?? []) outside.set(imp.from, imp.spec)
  }
  // an importer that is itself inside the whole target set is not "outside"
  const external = [...outside.entries()].filter(
    ([from]) => !targetModules.has(`${BASE}/${from}`),
  )
  return {
    target: e.target,
    moduleCount: e.modules.length,
    status: e.modules.length === 0 ? 'missing' : external.length ? 'referenced' : 'leaf',
    importers: external.map(([from, spec]) => `${from} -> ${spec}`),
  }
})

const leaf = rows.filter(r => r.status === 'leaf')
const referenced = rows.filter(r => r.status === 'referenced')
const missing = rows.filter(r => r.status === 'missing')
console.log(`targets=${rows.length} leaf=${leaf.length} referenced=${referenced.length} missing=${missing.length}`)
console.log('--- leaf (deletable with no local rewire) ---')
for (const r of leaf) console.log(`  ${r.target} (${r.moduleCount} files)`)
console.log('--- referenced (cut at the import site) ---')
for (const r of referenced) {
  console.log(`  ${r.target} (${r.moduleCount} files)`)
  for (const i of r.importers.slice(0, 10)) console.log(`      ${i}`)
  if (r.importers.length > 10) console.log(`      ... +${r.importers.length - 10} more`)
}
if (missing.length) {
  console.log('--- missing ---')
  for (const r of missing) console.log(`  ${r.target}`)
}
fs.writeFileSync(targetFile.replace(/\.json$/, '-report.json'), JSON.stringify(rows, null, 1))
