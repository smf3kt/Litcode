import fs from 'node:fs'
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'

// Classify phase-2 removal candidates by whether coding paths import them.
// Candidate entries come from the recon JSON; paths are normalized to
// filesystem paths (prose annotations stripped).

const BASE = '/Users/mant1ssa/Projects/cc-base-2188'
const recon = JSON.parse(fs.readFileSync('/Users/mant1ssa/Projects/cc_reverse/.audit/w61-phase2-recon.json', 'utf8'))

function normalizePath(p) {
  // strip prose annotations: "commands.ts (内联 shim) → commands/insights.ts"
  const arrow = p.split('→').pop()
  let s = arrow.trim().replace(/\(.*$/, '').trim()
  s = s.replace(/ \+ .*/, '') // multi-file entries: keep first
  s = s.replace(/\/$/, '')
  return s
}

// expand a path to the set of modules it represents (dir -> all source files under it)
function modulesOf(p) {
  const abs = `${BASE}/${p}`
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    const out = execSync(`find ${JSON.stringify(abs)} \\( -name '*.ts' -o -name '*.tsx' \\) ! -name '*.w*bak'`, { encoding: 'utf8' })
    return out.trim().split('\n').filter(Boolean)
  }
  if (fs.existsSync(abs)) return [abs]
  return []
}

const relFiles = execSync(`cd ${BASE} && rg --files -g '*.ts' -g '*.tsx' -g '*.js' -g '!node_modules' -g '!*.w*bak'`, { encoding: 'utf8', cwd: BASE }).trim().split('\n')
const relSet = new Set(relFiles)

// Entries whose "path" is an entrypoint file name the recon produced for
// subcommand blocks inside that file (cli-surface face). Those are edit-in-place
// removals, not file deletions; classify them separately.
const IN_PLACE = /^main\.tsx$|^entrypoints\/cli\.tsx$|^setup\.ts$|^commands\.ts/

// Build candidate module set
const candEntries = [] // {name, normPath, modules:[abs...], inPlace:boolean}
for (const c of recon.removalCandidates) {
  const np = normalizePath(c.path)
  candEntries.push({ name: c.name, normPath: np, modules: modulesOf(np), inPlace: IN_PLACE.test(np) })
}
const candModules = new Set(candEntries.filter(e => !e.inPlace).flatMap(e => e.modules))

// For every non-candidate file, find its imports that resolve into candidate modules
// Cheap approach: rg for import specifiers, resolve relative specifiers.
function resolveImport(spec, fromFile) {
  let base = spec.replace(/\.mjs$/, '.ts')
  // path parts carry no extension; extension candidates are tried at the end
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
    // the dump maps the build's `src/x` alias to the tree root
    const stripped = parts.slice(1) // historic: some builds keep a src/ prefix
    for (const tail of [parts, stripped]) {
      const cand = `${BASE}/${tail.join('/')}`
      for (const e of ['.ts', '.tsx', '.js', '']) {
        if (relSet.has(`${cand}${e}`.replace(`${BASE}/`, ''))) return `${cand}${e}`
      }
    }
    return null
  } else {
    return null
  }
  for (const e of ['.ts', '.tsx', '.js', '']) {
    if (relSet.has(`${joined}${e}`.replace(`${BASE}/`, ''))) return `${joined}${e}`
  }
  return null
}

const importers = new Map() // candidateModule -> [{from, spec}]
for (const f of relFiles) {
  const abs = `${BASE}/${f}`
  if (candModules.has(abs)) continue // intra-candidate imports don't block
  const text = fs.readFileSync(abs, 'utf8')
  const specs = [...text.matchAll(/(?:from\s+|import\s*\(\s*|require\(\s*)['"]([^'"]+)['"]/g)]
    .map(m => m[1]).filter(s => s.startsWith('.') || s.startsWith('src/'))
  for (const spec of new Set(specs)) {
    const r = resolveImport(spec, abs)
    if (r && candModules.has(r)) {
      if (!importers.has(r)) importers.set(r, [])
      importers.get(r).push({ from: f, spec })
    }
  }
}

// classify each candidate entry
const rows = []
for (const e of candEntries) {
  if (e.inPlace) { rows.push({ name: e.name, normPath: e.normPath, status: 'in-place', outsideImporters: [] }); continue }
  if (!e.modules.length) { rows.push({ name: e.name, normPath: e.normPath, status: 'missing', outsideImporters: [] }); continue }
  const outside = new Map()
  for (const m of e.modules) {
    for (const imp of importers.get(m) ?? []) {
      outside.set(imp.from, imp.spec)
    }
  }
  rows.push({
    name: e.name,
    normPath: e.normPath,
    moduleCount: e.modules.length,
    status: outside.size ? 'referenced' : 'leaf',
    outsideImporters: [...outside.entries()].map(([from, spec]) => `${from} -> ${spec}`).slice(0, 12),
    more: Math.max(0, outside.size - 12),
  })
}

const leaves = rows.filter(r => r.status === 'leaf')
const referenced = rows.filter(r => r.status === 'referenced')
const missing = rows.filter(r => r.status === 'missing')
const inPlace = rows.filter(r => r.status === 'in-place')
console.log(`leaf=${leaves.length} referenced=${referenced.length} missing=${missing.length} in-place=${inPlace.length}`)
fs.writeFileSync('/Users/mant1ssa/Projects/cc_reverse/.audit/w61-phase2-references.json', JSON.stringify({ generatedFrom: 'w61-phase2-recon.json', base: BASE, summary: { leaf: leaves.length, referenced: referenced.length, missing: missing.length }, leaf: leaves, referenced, missing }, null, 1))
console.log('--- leaf (deletable once their command registration is cut) ---')
for (const r of leaves) console.log(' ', r.normPath)
