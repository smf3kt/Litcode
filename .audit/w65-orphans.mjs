import fs from "node:fs"
import path from "node:path"
import {execFileSync} from "node:child_process"

const root = "/Users/mant1ssa/Projects/cc-base-2188"

const files = execFileSync("git", ["-C", root, "ls-files"], {encoding: "utf8"})
  .trim()
  .split("\n")
  .filter(p => /\.(ts|tsx|mts|cts)$/.test(p))
  .filter(p => !/\.w[0-9a-z]*bak$/.test(p))
  // `git ls-files` still lists files deleted in the working tree.
  .filter(p => fs.existsSync(path.join(root, p)))

const exists = rel => fs.existsSync(path.join(root, rel))

// Resolve a specifier as TypeScript's bundler resolution would for this tree:
// relative specifiers against the importer, `src/...` against the root, and
// the `.js` extension that the source uses for what are really `.ts` files.
function resolve(fromRel, spec) {
  let base
  if (spec.startsWith(".")) base = path.join(path.dirname(fromRel), spec)
  else if (spec.startsWith("src/")) base = spec.slice("src/".length)
  else return null
  const stripped = base.replace(/\.(js|jsx|mjs|cjs)$/, "")
  for (const cand of [`${stripped}.ts`, `${stripped}.tsx`, path.join(stripped, "index.ts"), path.join(stripped, "index.tsx"), stripped]) {
    const norm = path.normalize(cand)
    if (exists(norm)) return norm
  }
  return null
}

const importers = new Map()
const adds = (to, from) => {
  if (!importers.has(to)) importers.set(to, new Set())
  importers.get(to).add(from)
}

const specRe = /(?:from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"])/g
for (const rel of files) {
  const text = fs.readFileSync(path.join(root, rel), "utf8")
  for (const m of text.matchAll(specRe)) {
    const spec = m[1] ?? m[2] ?? m[3]
    if (!spec) continue
    const to = resolve(rel, spec)
    if (to && to !== path.normalize(rel)) adds(to, rel)
  }
}

const orphans = files.filter(rel => {
  const norm = path.normalize(rel)
  return !importers.has(norm) || importers.get(norm).size === 0
})

const size = rel => fs.readFileSync(path.join(root, rel), "utf8").split("\n").length
const rows = orphans.map(rel => ({rel, lines: size(rel)})).sort((a, b) => b.lines - a.lines)

console.log(`${files.length} files scanned, ${rows.length} with no importer\n`)
for (const {rel, lines} of rows) console.log(`${String(lines).padStart(6)}  ${rel}`)
