// The last 22 TS2307 sites, in four shapes:
//   * an `if (feature('X'))` guard whose body is the feature's only home -> the guard block goes;
//   * the same, where the guard is a `function` -> the function goes;
//   * a module that is gone but whose *type* is referenced from a surviving subsystem -> `any`;
//   * a barrel re-export or an import list naming a gone module -> the line goes.
// Block bounds are computed by walking back to the owning `if (`/`function` line and forward to the
// matching brace, so the edit does not depend on line numbers that earlier passes have shifted.
//
//   node .audit/w47-ts2307-fix.mjs [--apply]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const HARNESS = '/tmp/cc-2188-src';
const ts = createRequire(import.meta.url)('/tmp/w47-tools/node_modules/typescript');
const APPLY = process.argv.includes('--apply');

// Blocks to delete: a marker line inside the block plus the kind of construct that owns it.
const blocks = [
  { file: 'main.tsx', markers: [`await import('src/cli/up.js')`, `await import('src/cli/rollback.js')`], walk: 'if' },
  { file: 'entrypoints/cli.tsx', markers: [`await import('../daemon/workerRegistry.js')`, `await import('../daemon/main.js')`, `await import('../cli/bg.js')`, `await import('../environment-runner/main.js')`, `await import('../self-hosted-runner/main.js')`], walk: 'if' },
  { file: 'commands/bridge/bridge.tsx', markers: [`await import('../../assistant/index.js')`], walk: 'if' },
  { file: 'dialogLaunchers.tsx', markers: [`await import('./components/agents/SnapshotUpdateDialog.js')`, `await import('./commands/assistant/assistant.js')`], walk: 'function' },
  { file: 'components/messages/UserTextMessage.tsx', markers: [`typeof import('./UserCrossSessionMessage.js')`], walk: 'if' },
  { file: 'setup.ts', markers: [`import('./utils/udsMessaging.js')`], walk: 'if' },
  { file: 'components/TokenWarning.tsx', markers: [`typeof import('../services/contextCollapse/index.js')`], walk: 'function' },
];

// The cached-microcompact module is absent from this build. Its subsystem survives and is threaded
// through this file, so the type surface becomes `any` rather than the feature being torn out: the
// type is unobtainable, and the guards that reach it are already constant-false here.
const replacements = [
  ['services/compact/microCompact.ts', `let cachedMCModule: typeof import('./cachedMicrocompact.js') | null = null`, 'let cachedMCModule: any = null'],
  ['services/compact/microCompact.ts', `let cachedMCState: import('./cachedMicrocompact.js').CachedMCState | null = null`, 'let cachedMCState: any = null'],
  ['services/compact/microCompact.ts', `let pendingCacheEdits:\n  | import('./cachedMicrocompact.js').CacheEditsBlock\n  | null = null`, 'let pendingCacheEdits: any = null'],
  ['services/compact/microCompact.ts', `async function getCachedMCModule(): Promise<\n  typeof import('./cachedMicrocompact.js')\n> {`, 'async function getCachedMCModule(): Promise<any> {'],
  ['services/compact/microCompact.ts', `function ensureCachedMCState(): import('./cachedMicrocompact.js').CachedMCState {`, 'function ensureCachedMCState(): any {'],
  ['services/compact/microCompact.ts', `export function consumePendingCacheEdits():\n  | import('./cachedMicrocompact.js').CacheEditsBlock\n  | null {`, 'export function consumePendingCacheEdits(): any {'],
  ['services/compact/microCompact.ts', `export function getPinnedCacheEdits(): import('./cachedMicrocompact.js').PinnedCacheEdits[] {`, 'export function getPinnedCacheEdits(): any[] {'],
  ['services/compact/microCompact.ts', `  block: import('./cachedMicrocompact.js').CacheEditsBlock,`, '  block: any,'],
  ['services/compact/microCompact.ts', `// Lazy-initialized cached MC module and state to avoid importing in external builds.\n// The imports and state live inside feature() checks for dead code elimination.`, `// Lazy-initialized cached MC module and state to avoid importing in external builds.\n// The imports and state live inside feature() checks for dead code elimination.\n// The module itself is not in this build, so its type surface is any here.`],
  ['entrypoints/agentSdkTypes.ts', `// Re-export tool types (all marked @internal until SDK API stabilizes)\nexport * from './sdk/toolTypes.js'\n\n`, ''],
  ['main.tsx', `import { launchAssistantInstallWizard, launchInvalidSettingsDialog, launchResumeChooser, launchSnapshotUpdateDialog, launchTeleportRepoMismatchDialog, launchTeleportResumeWrapper } from './dialogLaunchers.js';`, `import { launchInvalidSettingsDialog, launchResumeChooser, launchTeleportRepoMismatchDialog, launchTeleportResumeWrapper } from './dialogLaunchers.js';`],
];

const bounds = (lines, at, walk) => {
  const startRe = walk === 'function' ? /^\s*(export\s+)?(async\s+)?function\s/ : /^\s*if\s*\(/;
  let i = at;
  while (i >= 0 && !startRe.test(lines[i])) i -= 1;
  if (i < 0) return null;
  let depth = 0;
  for (let j = i; j < lines.length; j += 1) {
    for (const ch of lines[j]) {
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
    }
    if (depth <= 0 && j > i) return [i, j];
  }
  return null;
};

const report = [];
const files = new Set([...blocks.map((b) => b.file), ...replacements.map((r) => r[0])]);
for (const file of files) {
  const full = path.join(HARNESS, file);
  const original = fs.readFileSync(full, 'utf8');
  let out = original;
  let ok = true;

  const entry = blocks.find((b) => b.file === file);
  if (entry) {
    const lines = out.split('\n');
    const cuts = [];
    for (const marker of entry.markers) {
      const at = lines.findIndex((l) => l.includes(marker));
      if (at < 0) { report.push({ file, op: `block ${marker}`, ok: false }); ok = false; continue; }
      const b = bounds(lines, at, entry.walk);
      if (!b) { report.push({ file, op: `bounds ${marker}`, ok: false }); ok = false; continue; }
      cuts.push({ from: b[0], to: b[1], marker });
    }
    // Overlapping cuts (several markers inside one guard) collapse to the outermost.
    cuts.sort((a, b) => a.from - b.from || b.to - a.to);
    const kept = [];
    for (const c of cuts) {
      if (kept.some((k) => c.from <= k.to)) continue;
      kept.push(c);
    }
    const drop = new Set();
    for (const c of kept) for (let i = c.from; i <= c.to; i += 1) drop.add(i);
    out = out.split('\n').filter((_, i) => !drop.has(i)).join('\n');
    report.push({ file, op: `blocks ${kept.length}`, ok: true, markers: kept.map((k) => k.marker) });
  }

  for (const [f, find, replace] of replacements) {
    if (f !== file) continue;
    const at = out.indexOf(find);
    if (at < 0 || out.indexOf(find, at + 1) >= 0) {
      report.push({ file, op: 'replace', ok: false, find: find.slice(0, 50) });
      ok = false;
      continue;
    }
    out = out.slice(0, at) + replace + out.slice(at + find.length);
    report.push({ file, op: 'replace', ok: true });
  }

  const check = ts.createSourceFile(file, out, ts.ScriptTarget.ES2022, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if ((check.parseDiagnostics ?? []).length > 0) {
    console.log(`SKIP ${file}: ${check.parseDiagnostics.length} parse errors after the edit`);
    continue;
  }
  if (!ok) { console.log(`SKIP ${file}: an anchor did not resolve`); continue; }
  if (APPLY) {
    if (!fs.existsSync(full + '.w47x2bak')) fs.writeFileSync(full + '.w47x2bak', original);
    fs.writeFileSync(full, out);
  }
}

console.log(`edits ${report.filter((r) => r.ok).length}/${report.length}`);
for (const r of report.filter((x) => !x.ok)) console.log(`  MISS ${r.file}: ${r.op}`);
if (APPLY) fs.writeFileSync('.audit/w47-ts2307-fix.json', JSON.stringify({ report }, null, 1) + '\n');
