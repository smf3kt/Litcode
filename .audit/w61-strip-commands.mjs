import fs from 'node:fs'

// W61 package 1: strip the non-coding slash-command surface from commands.ts.
// Deletion list = the 43 command modules removed from disk; every identifier
// bound here is removed from imports, gated consts, and the registration arrays.

const FILE = '/Users/mant1ssa/Projects/cc-base-2188/commands.ts'
const removed = new Set([
  'autofixPr', 'backfillSessions', 'breakCache', 'bughunter', 'ctx_viz', 'goodClaude',
  'issue', 'desktop', 'installGitHubApp', 'installSlackApp', 'mobile', 'remoteEnv',
  'releaseNotes', 'session', 'share', 'teleport', 'agentsPlatform', 'usage',
  'proactive', 'briefCommand', 'assistantCommand', 'bridge', 'remoteControlServerCommand',
  'voiceCommand', 'forceSnip', 'webCmd', 'subscribePr', 'ultraplan', 'torch',
  'peersCmd', 'forkCmd', 'buddy', 'clearSkillIndexCache', 'thinkback', 'thinkbackPlay',
  'privacySettings', 'passes', 'bridgeKick', 'version', 'mockLimits', 'summary',
  'resetLimits', 'resetLimitsNonInteractive', 'antTrace', 'perfIssue', 'env',
  'oauthRefresh', 'debugToolCall', 'chrome', 'stickers', 'usageReport', 'login', 'logout',
])

let text = fs.readFileSync(FILE, 'utf8')
const lines = text.split('\n')
const out = []
let removedImports = 0
let removedArrayEls = 0
let removedSpreads = 0

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]

  // import lines binding a removed identifier: `import x from '...'` or `import { x } from '...'`
  const imp = line.match(/^import\s+(?:{\s*([^}]+)\s*}|(\w+))(?:\s*,\s*{([^}]*)})?\s+from\s+/)
  if (imp) {
    const named = (imp[1] ?? '') + (imp[3] ?? '')
    const default_ = imp[2] ?? ''
    const names = named.split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)
    const hitDefault = default_ && removed.has(default_)
    const hitNamed = names.filter(n => removed.has(n))
    if (hitDefault && !names.length) { removedImports++; continue } // drop whole line
    if (hitDefault || hitNamed.length) {
      // rebuild the line without removed names, or drop it if nothing survives
      const fromMatch = line.match(/from\s+(.*)$/)
      const from = fromMatch ? fromMatch[1] : "''"
      const keepDefault = default_ && !hitDefault ? default_ : null
      const keepNamed = names.filter(n => !removed.has(n))
      if (!keepDefault && !keepNamed.length) { removedImports++; continue }
      let rebuilt = 'import '
      if (keepDefault) rebuilt += keepDefault
      if (keepNamed.length) rebuilt += (keepDefault ? ', ' : '') + '{ ' + keepNamed.join(', ') + ' }'
      rebuilt += ' from ' + from
      out.push(rebuilt)
      removedImports++
      continue
    }
    out.push(line)
    continue
  }

  // multi-name import: `import {\n  a,\n  b,\n} from '...'` — drop removed name lines only
  if (/^\s+\w+,$/.test(line) && removed.has(line.trim().replace(/,$/, ''))) {
    removedImports++
    continue
  }

  // gated const blocks: `const X =\n  cond\n    ? require(...)\n    : null` — cut the whole statement
  const constDecl = line.match(/^const\s+(\w+)\s*=/)
  if (constDecl && removed.has(constDecl[1])) {
    // skip until the statement closes: next line at depth 0 that doesn't extend the expression
    let depth = 0
    let j = i
    for (; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '(' || ch === '[' || ch === '{') depth++
        else if (ch === ')' || ch === ']' || ch === '}') depth--
      }
      const ends = /[,;]\s*$/.test(lines[j]) || (j + 1 < lines.length && !/[,+\s]$|^\s*[?:.)\]}|&]/.test(lines[j + 1]) && depth <= 0)
      if (depth <= 0 && (ends || j === i)) {
        // heuristic: continue while next line starts a continuation ( ? : . ( etc.)
        const nxt = lines[j + 1]
        if (nxt !== undefined && /^\s*[?:.)\]}|&]|^\s*\?\s*require|^\s*:\s/.test(nxt)) continue
        break
      }
    }
    i = j
    removedImports++
    continue
  }

  // single-name array elements in registration arrays
  const trimmed = line.trim()
  if (/^\w+,$/.test(trimmed) && removed.has(trimmed.slice(0, -1))) {
    removedArrayEls++
    continue
  }
  // spread lines over removed identifiers
  const spread = line.match(/^\s*\.\.\.\((.+)\s*\?\s*\[(.+)\]\s*:\s*\[\]\),?\s*$/)
  if (spread && removed.has(spread[2].trim())) {
    removedSpreads++
    continue
  }
  out.push(line)
}

text = out.join('\n')
// the login/logout spread has a different shape
const before = text
text = text.replace(/\s*\.\.\.\(!isUsing3PServices\(\) \? \[logout, login\(\)\] : \[\]\),/g, '')
if (text !== before) removedSpreads++

fs.writeFileSync(FILE, text)
console.log(`imports/consts removed=${removedImports} array elements=${removedArrayEls} spreads=${removedSpreads}`)
